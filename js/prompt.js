/* AI Prompt 組裝：題組級與情境級。網站只負責產生文字，不會自動送出給任何 AI。 */
(function (root) {
  var FDE = (root.FDE = root.FDE || {});

  var COACH_RULES = [
    '你是海豹學院的 FDE 商業情境實戰教練。',
    '請使用繁體中文（台灣）回覆。',
    '本課程訓練的是需求理解、資料關聯、問題排查、流程設計、例外處理與驗證能力，不是 SQL 語法考試。',
    '不要要求學生寫 SQL，也不要以 SQL 語法正確性評分；學生沒有寫 SQL 不應被扣分。',
    '不要一開始就給完整標準答案；請先根據學生的回答提供回饋。',
  ].join('\n');

  function val(text, placeholder) {
    var t = (text || '').trim();
    return t === '' ? placeholder : t;
  }

  function scenarioBlock(scenario) {
    return [
      '情境 ' + scenario.id + '｜' + scenario.title,
      '客戶原話：「' + scenario.clientQuote + '」',
      '任務 A（調查）：' + scenario.tasks.investigation,
      '任務 B（解決）：' + scenario.tasks.solution,
      '任務 C（追加情境）：' + scenario.tasks.edgeCase,
    ].join('\n');
  }

  function acceptanceBlock(scenario) {
    return scenario.acceptance.map(function (a) { return '- ' + a; }).join('\n');
  }

  function answerBlock(rec) {
    rec = rec || {};
    return [
      '任務 A：' + val(rec.investigation, '未作答'),
      '任務 B：' + val(rec.solution, '未作答'),
      '任務 C：' + val(rec.edgeCase, '未作答'),
      '假設／待確認問題：' + val(rec.assumptions, '未填寫'),
    ].join('\n');
  }

  function buildScenarioPrompt(group, scenario, rec) {
    var answered = FDE.storage.isAnswered(rec);
    var parts = [
      COACH_RULES,
      '',
      '【題組】',
      '題組 ' + group.id + '｜' + group.name,
      '',
      '【系統背景】',
      group.background,
      '',
      '【資料庫 ERD 文字結構】',
      FDE.erd.toText(group),
      '',
      '本題重點資料表：' + scenario.focusTables.join('、'),
      '',
      '【客戶情境與任務】',
      scenarioBlock(scenario),
      '',
      '【驗收條件】',
      acceptanceBlock(scenario),
      '',
      '【學生回答】',
    ];
    if (!answered) parts.push('（目前尚未填寫答案）');
    parts.push(answerBlock(rec));
    parts.push('');
    if (answered) {
      parts.push(
        '請依序回饋：',
        '1. 用「我理解你的解法是……」簡短重述學生目前的解題方向。',
        '2. 指出已經做對、合理的部分。',
        '3. 指出可能遺漏的資料、例外與風險，並分析追加情境下可能失效的假設。',
        '4. 提出可操作的驗證方式，說明如何確認這個方案真的可行。',
        '5. 最多提出三個引導問題，讓學生自行修正。',
        '6. 如果現有 ERD 不足以解決問題，指出缺少哪些資料以及原因。',
        '未作答的任務請以提問引導，不直接公布完整解法。'
      );
    } else {
      parts.push(
        '學生目前尚未填寫答案。請不要直接公布完整解法或標準答案，改以提問與提示引導：',
        '1. 用一兩句話幫學生釐清客戶真正想解決的問題。',
        '2. 提示可以先從哪些資料表與關聯開始觀察，但不要直接說出完整做法。',
        '3. 最多提出三個引導問題，讓學生自己寫出第一版回答。'
      );
    }
    return parts.join('\n');
  }

  function buildGroupPrompt(group, answers) {
    answers = answers || {};
    var anyAnswered = group.scenarios.some(function (s) {
      return FDE.storage.isAnswered(answers[s.id]);
    });
    var parts = [
      COACH_RULES,
      '',
      '【題組】',
      '題組 ' + group.id + '｜' + group.name + '（共 ' + group.scenarios.length + ' 個連續情境，共用同一張 ERD）',
      '',
      '【系統背景】',
      group.background,
      '',
      '【資料庫 ERD 文字結構】',
      FDE.erd.toText(group),
      '',
      '【客戶情境、任務、驗收條件與學生回答】',
    ];
    group.scenarios.forEach(function (s) {
      parts.push(
        '────────────────────',
        scenarioBlock(s),
        '驗收條件：',
        acceptanceBlock(s),
        '',
        '學生對情境 ' + s.id + ' 的回答' + (FDE.storage.isAnswered(answers[s.id]) ? '：' : '（目前尚未填寫答案）：'),
        answerBlock(answers[s.id]),
        ''
      );
    });
    parts.push('────────────────────', '');
    if (anyAnswered) {
      parts.push(
        '請依序回饋：',
        '1. 先逐一評估學生在各情境已提出的想法，簡短重述並指出合理之處。',
        '2. 指出各情境的遺漏、風險、資料不足之處，以及追加情境下可能失效的假設。',
        '3. 提出可操作的驗證方法。',
        '4. 觀察學生在四個情境中是否一致地運用同一套資料模型，指出跨情境的共同盲點。',
        '5. 以引導式問題協助學生修正（每個情境最多三個），不要直接給整組標準答案。',
        '未作答的情境請以提問引導，不直接公布完整解法。'
      );
    } else {
      parts.push(
        '學生目前尚未填寫任何答案。請不要直接公布完整解法或整組標準答案，改以提問與提示引導：',
        '1. 簡短說明這四個情境各自在訓練什麼能力，以及它們如何共用同一套資料模型。',
        '2. 建議學生閱讀 ERD 時應該先注意哪些關聯與狀態。',
        '3. 每個情境提出一到兩個引導問題，讓學生自己寫出第一版回答。'
      );
    }
    return parts.join('\n');
  }

  /** 「複製本題回答」用的純文字。 */
  function buildAnswerText(group, scenario, rec) {
    return ['題組 ' + group.id + '｜' + group.name, '情境 ' + scenario.id + '｜' + scenario.title, '', answerBlock(rec)].join('\n');
  }

  /**
   * 部署實作卡關時的提問：帶入這一節的步驟與指令，請學員自行貼上錯誤訊息。
   * 不帶入學員的 IP 與網域。
   */
  function buildLabPrompt(lab, section) {
    var WHERE = { local: '自己電腦的終端機', server: 'Droplet（已用 ssh 連線）', web: '瀏覽器' };
    var steps = section.steps.map(function (st, i) {
      var lines = [(i + 1) + '. 【' + WHERE[st.where] + '】' + lab.fill(st.text)];
      if (st.list) st.list.forEach(function (l) { lines.push('   - ' + l); });
      if (st.cmd) lines.push(lab.fill(st.cmd).split('\n').map(function (l) { return '   $ ' + l; }).join('\n'));
      if (st.link) lines.push('   開啟 ' + lab.fill(st.link));
      if (st.expect) lines.push('   應該看到：' + st.expect);
      return lines.join('\n');
    }).join('\n');
    return [
      '你是一位有耐心的部署助教，請用繁體中文協助我排除問題。',
      '規則：\n- 先用一兩句話說明最可能的原因，再告訴我下一步要執行什麼指令、在哪裡執行。\n- 一次只給一個步驟，等我回報結果再繼續。\n- 我是初學者，請避免一次丟出多種做法。\n- 不要要求我提供密碼、私鑰或 .env 的內容。',
      '【課程情境】\n海豹學院 Day 06 部署實作：在 DigitalOcean 開一台 Ubuntu 24.04 的 Droplet（1 GB 記憶體），用 Docker Compose 部署三個容器：web（Caddy，對外 80／443，提供前端並把 /api 轉給 api）、api（Node.js）、db（PostgreSQL 17，資料存在 volume）。日常操作使用 deploy 使用者，程式碼在 ~/db-fde-learning/day06-app。',
      '【我卡在這一節】' + section.title + '\n' + steps,
      '【我卡住的步驟】\n（請填寫第幾步）',
      '【我執行的指令與完整錯誤訊息】\n（請貼上終端機的輸出；貼上前請移除密碼等機密）',
    ].join('\n\n');
  }

  FDE.prompt = {
    buildLabPrompt: buildLabPrompt,
    buildScenarioPrompt: buildScenarioPrompt,
    buildGroupPrompt: buildGroupPrompt,
    buildAnswerText: buildAnswerText,
  };
})(typeof window !== 'undefined' ? window : globalThis);
