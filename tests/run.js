/* 不需安裝任何套件：在專案根目錄執行 `node tests/run.js`。 */
const assert = require('node:assert/strict');

globalThis.window = globalThis;
['data', 'lab', 'storage', 'erd', 'board', 'prompt', 'export'].forEach((f) => require('../js/' + f + '.js'));
const { groups, lab, storage: S, erd, board, prompt, exporter } = globalThis.FDE;
const fs = require('node:fs');
const path = require('node:path');

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
test('畫布：每張資料表都有預設位置、互不重疊，每條關聯都算得出連線', () => {
  groups.forEach((g) => {
    assert.deepEqual(Object.keys(g.layout).sort(), g.tables.map((t) => t.name).sort());
    const rects = g.tables.map((t) => ({ n: t.name, x: g.layout[t.name][0], y: g.layout[t.name][1], w: board.CARD_WIDTH, h: board.cardHeight(t) }));
    rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => {
      const apart = a.x + a.w + 20 <= b.x || b.x + b.w + 20 <= a.x || a.y + a.h + 20 <= b.y || b.y + b.h + 20 <= a.y;
      assert.ok(apart, a.n + ' 與 ' + b.n + ' 重疊');
    }));
    g.relations.forEach((r) => {
      const geo = board.edgeGeometry(g, r, g.layout);
      assert.ok(/^M[-\d. ]+C[-\d. ]+$/.test(geo.d), r.one + '→' + r.many);
    });
  });
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

test('部署實作的 IP、網域與勾選進度可存取，異常值會被濾掉', () => {
  const st = fakeStorage();
  const d = S.emptyData();
  d.lab = { ip: '203.0.113.10', domain: 'lab.example.com', done: { 'key-1': true } };
  S.save(st, d);
  assert.deepEqual(S.load(st).data.lab, d.lab);
  const odd = fakeStorage({ [S.KEY]: JSON.stringify({ lab: { ip: 5, done: { a: 'yes', b: true } } }) });
  assert.deepEqual(S.load(odd).data.lab, { ip: '', domain: '', done: { b: true } });
});

console.log('Day 06 部署實作');
test('步驟編號不重複，每步都有執行位置，佔位符只有 IP 與網域', () => {
  const steps = lab.allSteps();
  assert.equal(new Set(steps.map((s) => s.id)).size, steps.length);
  steps.forEach((s) => {
    assert.ok(['local', 'server', 'web'].includes(s.where), s.id);
    assert.ok(s.text.length > 5, s.id);
    const all = [s.text, s.cmd || '', s.link || ''].join(' ');
    assert.deepEqual((all.match(/\{\{\w+\}\}/g) || []).filter((m) => m !== '{{IP}}' && m !== '{{DOMAIN}}'), [], s.id);
    assert.ok(!/[\u201c\u201d\u2018\u2019]/.test(s.cmd || ''), s.id + ' 指令含全形引號');
  });
  assert.equal(lab.sections[lab.sections.length - 1].id, 'destroy');
});
test('帶入 IP／網域，未填時顯示提示字；進度不計選修', () => {
  assert.equal(lab.fill('ssh root@{{IP}}', { ip: '203.0.113.10' }), 'ssh root@203.0.113.10');
  assert.equal(lab.fill('ssh root@{{IP}} {{DOMAIN}}', {}), 'ssh root@你的IP 你的網域');
  assert.ok(lab.isIp('203.0.113.10') && !lab.isIp('203.0.113') && !lab.isIp('999.1.1.1') && !lab.isIp('1.1.1.1; rm -rf /'));
  assert.ok(lab.isDomain('lab.example.com') && !lab.isDomain('http://x.com') && !lab.isDomain('a b.com') && !lab.isDomain('x.com;ls'));
  const optional = lab.sections.filter((s) => s.optional).flatMap((s) => s.steps);
  const done = {};
  lab.allSteps().forEach((s) => { done[s.id] = true; });
  assert.deepEqual(lab.progress(done), { total: lab.allSteps().length - optional.length, done: lab.allSteps().length - optional.length });
  assert.equal(lab.progress({ [optional[0].id]: true }).done, 0);
});
test('教材指令與範例應用程式的檔案一致', () => {
  const dir = path.join(__dirname, '..', 'day06-app');
  ['docker-compose.yml', 'Caddyfile', '.env.example', 'db/init.sql', 'api/Dockerfile', 'api/server.js', 'api/package-lock.json', 'web/index.html']
    .forEach((f) => assert.ok(fs.existsSync(path.join(dir, f)), f));
  const env = fs.readFileSync(path.join(dir, '.env.example'), 'utf8');
  assert.ok(/^POSTGRES_PASSWORD=change-me$/m.test(env) && /^SITE_ADDRESS=:80$/m.test(env));
  const compose = fs.readFileSync(path.join(dir, 'docker-compose.yml'), 'utf8');
  ['db:', 'api:', 'web:', 'POSTGRES_USER: academy', 'POSTGRES_DB: academy'].forEach((k) => assert.ok(compose.includes(k), k));
  const cmds = lab.allSteps().map((s) => s.cmd || '').join('\n');
  assert.ok(cmds.includes('git clone ' + lab.repo) && cmds.includes('cd db-fde-learning/day06-app'));
  assert.ok(cmds.includes('s/change-me/') && cmds.includes('psql -U academy -d academy'));
  const sql = fs.readFileSync(path.join(dir, 'db/init.sql'), 'utf8');
  groups[0].tables.forEach((t) => {
    assert.ok(sql.includes('CREATE TABLE ' + t.name + ' ('), t.name);
    t.columns.forEach((c) => assert.ok(new RegExp('\\n\\s+' + c.name + '\\s').test(sql), t.name + '.' + c.name));
  });
  groups[0].statuses.forEach((st) => st.values.forEach((v) => assert.ok(sql.includes("'" + v.value + "'"), st.field + ' ' + v.value)));
});
test('卡關 Prompt 帶入該節步驟，不含學員的 IP', () => {
  const p = prompt.buildLabPrompt(lab, lab.sections[4]);
  ['部署助教', '繁體中文', 'docker compose up -d --build', '應該看到', '不要要求我提供密碼'].forEach((k) => assert.ok(p.includes(k), k));
  assert.ok(p.includes('http://你的IP') && !p.includes('{{'));
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
