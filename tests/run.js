/* 不需安裝任何套件：在專案根目錄執行 `node tests/run.js`。 */
const assert = require('node:assert/strict');

globalThis.window = globalThis;
['data', 'storage', 'erd', 'prompt', 'export'].forEach((f) => require('../js/' + f + '.js'));
const { groups, storage: S, erd, prompt, exporter } = globalThis.FDE;

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('  ✓ ' + name);
}

function fakeStorage(initial) {
  const m = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    keys: () => [...m.keys()],
  };
}

const answer = (o) => Object.assign(S.emptyAnswer(), o);

console.log('題庫資料');
test('三大題組、合計 12 個情境，編號不重複', () => {
  assert.equal(groups.length, 3);
  const ids = groups.flatMap((g) => g.scenarios.map((s) => s.id));
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, 12);
  groups.forEach((g) => g.scenarios.forEach((s) => assert.ok(s.id.startsWith(g.id))));
});
test('每個情境都有客戶原話、A/B/C 任務與驗收條件', () => {
  groups.forEach((g) => g.scenarios.forEach((s) => {
    assert.ok(s.clientQuote.length > 20, s.id);
    ['investigation', 'solution', 'edgeCase'].forEach((t) => assert.ok(s.tasks[t].length > 15, s.id + t));
    assert.ok(s.tasks.edgeCase.startsWith('追加情境'), s.id);
    assert.ok(s.acceptance.length >= 2, s.id);
  }));
});
test('關聯、重點資料表與外鍵都指向存在的資料表與欄位', () => {
  groups.forEach((g) => {
    const tables = new Map(g.tables.map((t) => [t.name, t]));
    g.relations.forEach((r) => {
      assert.ok(tables.has(r.one) && tables.has(r.many), r.one + '→' + r.many);
      const col = tables.get(r.many).columns.find((c) => c.name === r.fk);
      assert.ok(col && col.key === 'FK', r.many + '.' + r.fk);
    });
    g.tables.forEach((t) => {
      assert.equal(t.columns.filter((c) => c.key === 'PK').length, 1, t.name);
      t.columns.filter((c) => c.key === 'FK').forEach((c) =>
        assert.ok(g.relations.some((r) => r.many === t.name && r.fk === c.name), t.name + '.' + c.name + ' 沒有對應關聯'));
    });
    g.scenarios.forEach((s) => s.focusTables.forEach((n) => assert.ok(tables.has(n), s.id + ' ' + n)));
  });
});
test('題目文字不要求 SQL', () => {
  const text = JSON.stringify(groups.map((g) => g.scenarios));
  assert.ok(!/SQL|JOIN|GROUP BY|SELECT|語法/i.test(text));
});

console.log('ERD');
test('Mermaid 原始碼包含全部資料表、關聯與 PK/FK', () => {
  groups.forEach((g) => {
    const code = erd.toMermaid(g);
    assert.ok(code.startsWith('erDiagram'));
    g.tables.forEach((t) => assert.ok(code.includes('  ' + t.name + ' {')));
    assert.equal(code.split('\n').filter((l) => l.includes('--o{')).length, g.relations.length);
  });
  assert.ok(erd.toMermaid(groups[1]).includes('orders o|--o{ inventory_movements : references'));
  assert.ok(erd.toMermaid(groups[0]).includes('BIGINT enrollment_id FK'));
});
test('文字版包含資料表、關聯、狀態值與補充', () => {
  const text = erd.toText(groups[2]);
  assert.ok(text.includes('資料表 rent_allocations（租金分配）'));
  assert.ok(text.includes('rent_allocations.bank_transaction_id 指向 bank_transactions.id'));
  assert.ok(text.includes('disputed（爭議中）'));
  assert.ok(text.includes('(lease_id, billing_month) 複合唯一約束'));
});

console.log('AI Prompt');
test('情境級 Prompt 帶入題目、ERD、回答與教練規則', () => {
  const g = groups[0];
  const p = prompt.buildScenarioPrompt(g, g.scenarios[0], answer({ investigation: '先找付款成功但報名待付款的紀錄', assumptions: '退款是否一定會寫回' }));
  ['FDE 商業情境實戰教練', '繁體中文', '不要要求學生寫 SQL', g.background, '資料表 payments（付款）', g.scenarios[0].clientQuote,
    g.scenarios[0].tasks.edgeCase, g.scenarios[0].acceptance[2], '任務 A：先找付款成功但報名待付款的紀錄', '任務 B：未作答',
    '假設／待確認問題：退款是否一定會寫回', '最多提出三個引導問題', '缺少哪些資料'].forEach((s) => assert.ok(p.includes(s), s));
  assert.ok(!p.includes('目前尚未填寫答案'));
});
test('未作答時產生引導型 Prompt', () => {
  const g = groups[1];
  const p = prompt.buildScenarioPrompt(g, g.scenarios[1], undefined);
  assert.ok(p.includes('（目前尚未填寫答案）'));
  assert.ok(p.includes('任務 A：未作答') && p.includes('假設／待確認問題：未填寫'));
  assert.ok(p.includes('不要直接公布完整解法'));
});
test('題組級 Prompt 包含該組四題與各自回答，不混入其他組', () => {
  const answers = { B1: answer({ solution: 'B1 的解法' }), B3: answer({ edgeCase: 'B3 的調整' }), A1: answer({ investigation: 'A 組機密回答' }), C2: answer({ solution: 'C 組機密回答' }) };
  const p = prompt.buildGroupPrompt(groups[1], answers);
  groups[1].scenarios.forEach((s) => {
    assert.ok(p.includes('情境 ' + s.id + '｜' + s.title));
    assert.ok(p.includes(s.clientQuote) && p.includes(s.tasks.edgeCase) && p.includes(s.acceptance[0]));
  });
  assert.ok(p.includes('任務 B：B1 的解法') && p.includes('任務 C：B3 的調整'));
  assert.ok(p.includes('學生對情境 B2 的回答（目前尚未填寫答案）'));
  assert.ok(!p.includes('機密回答') && !p.includes('students') && !p.includes('tenants'));
  assert.ok(!/情境 [AC]\d/.test(p));
  assert.ok(p.includes('不要直接給整組標準答案'));
});

console.log('本機儲存');
test('存入後可完整讀回', () => {
  const st = fakeStorage();
  const d = S.emptyData();
  d.studentName = '王小明';
  d.answers.A1 = answer({ investigation: '第一行\n第二行', completed: true, updatedAt: '2026-01-01T00:00:00.000Z' });
  assert.ok(S.save(st, d));
  assert.deepEqual(S.load(st).data, d);
  assert.deepEqual(st.keys(), ['seal-fde-scenario-v1']);
});
test('JSON 損壞時回傳空白資料並保留備份', () => {
  const st = fakeStorage({ [S.KEY]: '{"version":1,"answers":{"A1":' });
  const r = S.load(st);
  assert.equal(r.recovered, true);
  assert.deepEqual(r.data, S.emptyData());
  assert.equal(st.getItem(S.BACKUP_KEY), '{"version":1,"answers":{"A1":');
});
test('格式不完整或型別錯誤的資料會被補齊', () => {
  const st = fakeStorage({ [S.KEY]: JSON.stringify({ studentName: 5, answers: { A1: { investigation: 'x', completed: 'yes' }, A2: null } }) });
  const d = S.load(st).data;
  assert.equal(d.version, 1);
  assert.equal(d.studentName, '');
  assert.deepEqual(d.answers.A1, answer({ investigation: 'x' }));
  assert.ok(!('A2' in d.answers));
  assert.deepEqual(S.load(fakeStorage({ [S.KEY]: '[]' })).data, S.emptyData());
});
test('儲存空間不可用時不會丟出例外', () => {
  assert.equal(S.load(null).unavailable, true);
  assert.equal(S.save(null, S.emptyData()), false);
  S.clear(null);
});
test('清除只移除本網站的 key', () => {
  const st = fakeStorage({ [S.KEY]: '{}', [S.BACKUP_KEY]: 'x', 'other-site-key': 'keep' });
  S.clear(st);
  assert.deepEqual(st.keys(), ['other-site-key']);
});

console.log('匯出');
test('Markdown 包含姓名、時間、題組、12 個情境編號、中文與換行', () => {
  const d = S.emptyData();
  d.studentName = '王小明';
  d.answers.C4 = answer({ solution: '第一步：盤點\n第二步：去識別化', assumptions: '保存年限待確認', completed: true });
  const now = new Date(2026, 10, 18, 9, 5);
  const md = exporter.buildMarkdown(d, groups, now);
  assert.ok(md.includes('- 學生姓名：王小明') && md.includes('- 匯出時間：2026-11-18 09:05') && md.includes('- 完成進度：1／12'));
  groups.forEach((g) => {
    assert.ok(md.includes('## 題組 ' + g.id + '｜' + g.name));
    g.scenarios.forEach((s) => assert.ok(md.includes('### ' + s.id + ' ' + s.title)));
  });
  assert.ok(md.includes('### C4 刪除個資（已完成）') && md.includes('### A1 付款後無法上課（未完成）'));
  assert.ok(md.includes('第一步：盤點\n第二步：去識別化') && md.includes('保存年限待確認') && md.includes('（未作答）'));
  assert.equal(exporter.fileName(d, now, 'md'), '海豹學院FDE作答_王小明_20261118-0905.md');
  assert.equal(JSON.parse(exporter.buildJson(d, now)).answers.C4.completed, true);
});

console.log('\n全部通過：' + passed + ' 項');
