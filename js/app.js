/* 主程式：hash 路由、畫面繪製、自動儲存、AI 提問與 ERD 對話框。 */
(function () {
  var FDE = window.FDE;
  var S = FDE.storage;
  var groups = FDE.groups;
  var TOTAL = FDE.exporter.total(groups);

  var app = document.getElementById('app');
  var saveStatus = document.getElementById('save-status');

  /* ---------- 小工具 ---------- */

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  function append(el, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) child.forEach(function (c) { append(el, c); });
    else el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }

  function getStorage() {
    try {
      return window.localStorage;
    } catch (e) {
      return null;
    }
  }

  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  /** 複製文字：優先用 Clipboard API，失敗時改用舊式 execCommand；都失敗回傳 false。 */
  function copyText(text) {
    function legacy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        (document.querySelector('dialog[open]') || document.body).appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (e) {
        return false;
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacy(); });
    }
    return Promise.resolve(legacy());
  }

  /* ---------- 資料與自動儲存 ---------- */

  var loaded = S.load(getStorage());
  var data = loaded.data;
  var dirty = false;
  var saveTimer = null;

  function record(id) {
    if (!data.answers[id]) data.answers[id] = S.emptyAnswer();
    return data.answers[id];
  }

  function peek(id) {
    return data.answers[id] || S.emptyAnswer();
  }

  function commit() {
    dirty = true;
    saveStatus.textContent = '儲存中…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 400);
  }

  function flush() {
    if (!dirty) return;
    clearTimeout(saveTimer);
    dirty = false;
    if (S.save(getStorage(), data)) {
      var d = new Date();
      saveStatus.textContent = '已儲存 ' + FDE.exporter.formatDateTime(d).slice(11);
      saveStatus.classList.remove('error');
    } else {
      saveStatus.textContent = '無法儲存到瀏覽器，請盡快匯出作答。';
      saveStatus.classList.add('error');
    }
  }

  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
  // 另一個分頁修改了資料：若本分頁沒有未儲存的內容，就同步過來。
  window.addEventListener('storage', function (e) {
    if (e.key !== null && e.key !== S.KEY) return;
    if (dirty) return;
    var active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) return;
    data = S.load(getStorage()).data;
    render();
  });

  function completedIn(group) {
    return group.scenarios.filter(function (s) { return peek(s.id).completed; }).length;
  }

  /* ---------- 對話框 ---------- */

  function setupDialog(dialog) {
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog || (e.target.closest && e.target.closest('[data-close]'))) dialog.close();
    });
  }

  var promptDialog = document.getElementById('prompt-dialog');
  var promptText = document.getElementById('prompt-text');
  var promptCopyBtn = document.getElementById('prompt-copy');
  var promptCopyMsg = document.getElementById('prompt-copy-msg');
  setupDialog(promptDialog);

  function selectPromptText() {
    promptText.focus();
    promptText.select();
    promptText.setSelectionRange(0, promptText.value.length);
  }

  /**
   * opts.mode: 'ai'（AI 提問，含步驟與平台連結）或 'manual'（剪貼簿不可用時的手動複製）
   */
  function openPromptDialog(title, text, opts) {
    var ai = opts.mode === 'ai';
    document.getElementById('prompt-title').textContent = title;
    document.getElementById('prompt-unanswered').hidden = !opts.unanswered;
    document.getElementById('prompt-links').hidden = !ai;
    document.getElementById('prompt-disclaimer').hidden = !ai;
    document.getElementById('prompt-label').textContent = ai ? '完整提問' : '要複製的內容';
    promptCopyBtn.textContent = ai ? '複製完整提問' : '複製';
    promptText.value = text;
    promptCopyMsg.textContent = '';
    promptCopyMsg.classList.remove('error');
    promptDialog.showModal();
    promptText.scrollTop = 0;
    if (!ai) {
      selectPromptText();
      promptCopyMsg.textContent = '無法自動複製，內容已全選，請按 Ctrl／⌘+C。';
      promptCopyMsg.classList.add('error');
    }
  }

  promptCopyBtn.addEventListener('click', function () {
    copyText(promptText.value).then(function (ok) {
      if (ok) {
        promptCopyMsg.classList.remove('error');
        promptCopyMsg.textContent = '已複製，請到 AI 平台貼上送出。';
      } else {
        selectPromptText();
        promptCopyMsg.classList.add('error');
        promptCopyMsg.textContent = '無法自動複製，內容已全選，請按 Ctrl／⌘+C。';
      }
    });
  });

  var erdDialog = document.getElementById('erd-dialog');
  var erdCanvas = document.getElementById('erd-dialog-canvas');
  var inlineBoard = null;
  var dialogBoard = null;
  setupDialog(erdDialog);
  erdDialog.addEventListener('close', function () {
    if (dialogBoard) dialogBoard.destroy();
    dialogBoard = null;
    if (inlineBoard) inlineBoard.refresh();
  });

  function openErdDialog(group, focus) {
    document.getElementById('erd-dialog-title').textContent = '題組 ' + group.id + ' ERD';
    erdDialog.showModal();
    dialogBoard = FDE.board.mount(erdCanvas, group, { fullscreen: true, focus: focus });
  }

  var confirmDialog = document.getElementById('confirm-dialog');
  setupDialog(confirmDialog);
  document.getElementById('confirm-clear').addEventListener('click', function () {
    clearTimeout(saveTimer);
    dirty = false;
    S.clear(getStorage());
    data = S.emptyData();
    confirmDialog.close();
    saveStatus.textContent = '本機資料已清除。';
    toast('本機資料已清除');
    if (location.hash && location.hash !== '#/') location.hash = '#/';
    else render();
  });

  /* ---------- 共用畫面元件 ---------- */

  function privacyHint() {
    return h('p', { class: 'hint' }, '送給 AI 前請先檢查並移除個資。');
  }

  function statusBadge(rec) {
    if (rec.completed) return h('span', { class: 'badge badge-done' }, '已完成');
    if (S.hasAnyText(rec)) return h('span', { class: 'badge badge-progress' }, '作答中');
    return h('span', { class: 'badge' }, '未作答');
  }

  /** ERD 區塊：可平移縮放的畫布，加上文字版資料結構。 */
  function erdSection(group, headingTag, focus) {
    var holder = h('div');
    var textPre = h('pre', { class: 'erd-text', id: 'erd-text-' + group.id, hidden: true, tabindex: '0' }, FDE.erd.toText(group));
    var toggle = h('button', { type: 'button', class: 'btn', 'aria-expanded': 'false', 'aria-controls': 'erd-text-' + group.id }, '顯示文字版');
    toggle.addEventListener('click', function () {
      textPre.hidden = !textPre.hidden;
      toggle.setAttribute('aria-expanded', String(!textPre.hidden));
      toggle.textContent = textPre.hidden ? '顯示文字版' : '隱藏文字版';
    });
    inlineBoard = FDE.board.mount(holder, group, { focus: focus, onFullscreen: function () { openErdDialog(group, focus); } });
    return h('section', { class: 'card' },
      h(headingTag, null, 'ERD'),
      holder,
      h('p', { class: 'hint no-print' }, '拖曳移動畫布或資料表，⌘／Ctrl＋滾輪或雙指縮放。'),
      h('div', { class: 'btn-row no-print' }, toggle),
      textPre
    );
  }

  function tablesSection(group, focus) {
    return h('section', { class: 'card' },
      h('h2', null, '資料表欄位'),
      group.tables.map(function (t) {
        var isFocus = focus && focus.indexOf(t.name) !== -1;
        return h('details', { class: 'table-details' },
          h('summary', null,
            h('code', null, t.name), '（' + t.label + '）',
            isFocus ? h('span', { class: 'badge badge-progress' }, '本題重點') : null,
            h('span', { class: 'summary-desc' }, t.desc)
          ),
          h('div', { class: 'table-scroll' },
            h('table', null,
              h('thead', null, h('tr', null,
                h('th', { scope: 'col' }, '欄位'), h('th', { scope: 'col' }, '型別'),
                h('th', { scope: 'col' }, '鍵'), h('th', { scope: 'col' }, '說明'))),
              h('tbody', null, t.columns.map(function (c) {
                return h('tr', null,
                  h('td', null, h('code', null, c.name)), h('td', null, c.type),
                  h('td', null, c.key || '—'), h('td', null, c.desc));
              }))
            )
          )
        );
      })
    );
  }

  function statusSection(group) {
    return h('section', { class: 'card' },
      h('h2', null, '狀態值與補充說明'),
      h('dl', { class: 'status-list' }, group.statuses.map(function (s) {
        return [
          h('dt', null, h('code', null, s.field)),
          h('dd', null, s.values.map(function (v) {
            return h('span', { class: 'status-chip' }, h('code', null, v.value), ' ' + v.meaning);
          })),
        ];
      })),
      group.notes.length ? h('ul', { class: 'notes' }, group.notes.map(function (n) { return h('li', null, n); })) : null
    );
  }

  /* ---------- 首頁 ---------- */

  function viewHome() {
    document.title = '海豹學院｜FDE 商業情境實戰';
    var done = FDE.exporter.completedCount(data, groups);

    var nameInput = h('input', { type: 'text', id: 'student-name', autocomplete: 'name', maxlength: '50', placeholder: '會寫入匯出檔' });
    nameInput.value = data.studentName;
    nameInput.addEventListener('input', function () {
      data.studentName = nameInput.value;
      commit();
    });

    function exportFile(kind) {
      flush();
      var now = new Date();
      if (kind === 'md') FDE.exporter.download(FDE.exporter.fileName(data, now, 'md'), FDE.exporter.buildMarkdown(data, groups, now), 'text/markdown');
      else FDE.exporter.download(FDE.exporter.fileName(data, now, 'json'), FDE.exporter.buildJson(data, now), 'application/json');
      toast('已匯出');
    }

    return [
      h('section', { class: 'hero' },
        h('h1', null, '海豹學院｜FDE 商業情境實戰'),
        h('p', { class: 'lead' }, '讀懂 ERD、拆解客戶需求、用自然語言提出解法'),
        h('p', null, '每題分三階段，用自己的話說明你的判斷與做法，不需要寫 SQL。')
      ),
      loaded.recovered ? h('p', { class: 'notice notice-warn' }, '先前的作答資料已損壞，無法讀取。原始內容保留在瀏覽器的 ' + S.BACKUP_KEY + '。') : null,
      loaded.unavailable ? h('p', { class: 'notice notice-warn' }, '這個瀏覽器無法儲存作答，重新整理後會消失，請記得匯出。') : null,
      h('section', { class: 'card overview' },
        h('div', { class: 'field' },
          h('label', { for: 'student-name' }, '學生姓名'),
          nameInput
        ),
        h('div', { class: 'progress-block' },
          h('label', { for: 'overall-progress' }, '全站進度：已完成 ' + done + '／' + TOTAL + ' 個情境'),
          h('progress', { id: 'overall-progress', max: String(TOTAL), value: String(done) })
        )
      ),
      h('h2', { class: 'section-title' }, '三大題組'),
      h('div', { class: 'group-grid' }, groups.map(function (g) {
        var n = completedIn(g);
        return h('article', { class: 'card group-card' },
          h('p', { class: 'eyebrow' }, '題組 ' + g.id),
          h('h3', null, g.name),
          h('p', null, g.intro),
          h('p', { class: 'meta' }, g.scenarios.length + ' 個情境・已完成 ' + n + ' 個'),
          h('a', { class: 'btn btn-primary', href: '#/group/' + g.id }, '進入題組 ' + g.id)
        );
      })),
      h('h2', { class: 'section-title' }, '實作課'),
      (function () {
        var p = FDE.lab.progress(data.lab.done);
        return h('article', { class: 'card lab-card' },
          h('div', null,
            h('p', { class: 'eyebrow' }, 'Day 06'),
            h('h3', null, '部署實作'),
            h('p', null, FDE.lab.lead + '。'),
            h('p', { class: 'meta' }, p.total + ' 個必做步驟・已完成 ' + p.done + ' 個')),
          h('a', { class: 'btn btn-primary', href: '#/day06' }, '開始實作'));
      })(),
      h('h2', { class: 'section-title' }, '作答紀錄'),
      h('section', { class: 'card' },
        h('h2', null, '匯出作答'),
        h('p', { class: 'notice' }, '資料儲存於目前瀏覽器，換裝置不會同步。'),
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { exportFile('md'); } }, '匯出 Markdown'),
          h('button', { type: 'button', class: 'btn', onclick: function () { exportFile('json'); } }, '匯出 JSON'),
          h('a', { class: 'btn', href: '#/print' }, '列印作答'),
          h('button', { type: 'button', class: 'btn btn-danger-outline', onclick: function () { confirmDialog.showModal(); } }, '清除本機資料')
        )
      ),
    ];
  }

  /* ---------- 題組頁 ---------- */

  function groupAskButton(group) {
    return h('button', {
      type: 'button', class: 'btn btn-accent',
      onclick: function () {
        flush();
        var none = !group.scenarios.some(function (s) { return S.isAnswered(peek(s.id)); });
        openPromptDialog('帶題組 ' + group.id + ' 去問 AI', FDE.prompt.buildGroupPrompt(group, data.answers), { mode: 'ai', unanswered: none });
      },
    }, '帶本題組去問 AI');
  }

  function viewGroup(group) {
    document.title = '題組 ' + group.id + '｜' + group.name + '｜海豹學院 FDE';
    return [
      h('nav', { class: 'breadcrumb no-print', 'aria-label': '導覽路徑' }, h('a', { href: '#/' }, '首頁'), ' ／ 題組 ' + group.id),
      h('section', { class: 'hero' },
        h('p', { class: 'eyebrow' }, '題組 ' + group.id),
        h('h1', null, group.name),
        h('h2', { class: 'sub-h' }, '系統背景'),
        h('p', null, group.background)
      ),
      h('section', { class: 'card' },
        h('h2', null, '情境目錄'),
        h('p', { class: 'meta' }, '已完成 ' + completedIn(group) + '／' + group.scenarios.length),
        h('ol', { class: 'scenario-list' }, group.scenarios.map(function (s) {
          return h('li', null,
            h('a', { href: '#/group/' + group.id + '/' + s.id },
              h('span', { class: 'scenario-id' }, s.id),
              h('span', { class: 'scenario-main' }, h('strong', null, s.title), h('span', { class: 'scenario-sum' }, s.summary)),
              statusBadge(peek(s.id))
            )
          );
        })),
        h('div', { class: 'btn-row no-print' }, groupAskButton(group)),
        privacyHint()
      ),
      erdSection(group, 'h2', null),
      tablesSection(group, null),
      statusSection(group),
    ];
  }

  /* ---------- 情境作答頁 ---------- */

  var TASKS = [
    { field: 'investigation', label: '任務 A｜調查' },
    { field: 'solution', label: '任務 B｜解決' },
    { field: 'edgeCase', label: '任務 C｜追加情境' },
  ];

  function viewScenario(group, scenario) {
    document.title = scenario.id + ' ' + scenario.title + '｜海豹學院 FDE';
    var idx = group.scenarios.indexOf(scenario);
    var prev = group.scenarios[idx - 1];
    var next = group.scenarios[idx + 1];

    function answerField(field, label, question, rows) {
      var id = 'ans-' + scenario.id + '-' + field;
      var ta = h('textarea', { id: id, rows: String(rows), 'aria-describedby': question ? id + '-q' : null });
      ta.value = peek(scenario.id)[field];
      ta.addEventListener('input', function () {
        var rec = record(scenario.id);
        rec[field] = ta.value;
        rec.updatedAt = new Date().toISOString();
        commit();
      });
      return h('section', { class: 'card task' },
        h('h2', null, h('label', { for: id }, label)),
        question ? h('p', { class: 'task-question', id: id + '-q' }, question) : null,
        ta
      );
    }

    var doneBtn = h('button', { type: 'button', class: 'btn' });
    function paintDone() {
      var done = peek(scenario.id).completed;
      doneBtn.setAttribute('aria-pressed', String(done));
      doneBtn.textContent = done ? '✓ 已完成' : '標記完成';
      doneBtn.classList.toggle('btn-done', done);
    }
    doneBtn.addEventListener('click', function () {
      var rec = record(scenario.id);
      rec.completed = !rec.completed;
      rec.updatedAt = new Date().toISOString();
      commit();
      paintDone();
      toast(rec.completed ? scenario.id + ' 已標記完成' : scenario.id + ' 已取消完成標記');
    });
    paintDone();

    var askBtn = h('button', {
      type: 'button', class: 'btn btn-accent',
      onclick: function () {
        flush();
        var rec = peek(scenario.id);
        openPromptDialog('帶 ' + scenario.id + ' 與我的回答去問 AI', FDE.prompt.buildScenarioPrompt(group, scenario, rec), { mode: 'ai', unanswered: !S.isAnswered(rec) });
      },
    }, '帶這題與我的回答去問 AI');

    var copyBtn = h('button', {
      type: 'button', class: 'btn',
      onclick: function () {
        var text = FDE.prompt.buildAnswerText(group, scenario, peek(scenario.id));
        copyText(text).then(function (ok) {
          if (ok) toast('已複製本題回答');
          else openPromptDialog('複製本題回答', text, { mode: 'manual', unanswered: false });
        });
      },
    }, '複製本題回答');

    var erdDetails = h('details', { class: 'erd-details' },
      h('summary', null, 'ERD 與資料結構',
        h('span', { class: 'summary-desc' }, '本題重點：' + scenario.focusTables.join('、')))
    );
    var erdLoaded = false;
    erdDetails.addEventListener('toggle', function () {
      if (!erdDetails.open || erdLoaded) return;
      erdLoaded = true;
      erdDetails.appendChild(erdSection(group, 'h3', scenario.focusTables));
      erdDetails.appendChild(tablesSection(group, scenario.focusTables));
      erdDetails.appendChild(statusSection(group));
    });

    return [
      h('nav', { class: 'breadcrumb no-print', 'aria-label': '導覽路徑' },
        h('a', { href: '#/' }, '首頁'), ' ／ ',
        h('a', { href: '#/group/' + group.id }, '題組 ' + group.id), ' ／ ' + scenario.id),
      h('section', { class: 'hero' },
        h('p', { class: 'eyebrow' }, '題組 ' + group.id + '｜' + group.name),
        h('h1', null, scenario.id + ' ' + scenario.title),
        h('figure', { class: 'quote' },
          h('figcaption', null, '客戶這樣說'),
          h('blockquote', null, '「' + scenario.clientQuote + '」')
        )
      ),
      h('div', { class: 'card erd-card' },
        erdDetails,
        h('button', { type: 'button', class: 'btn btn-sm no-print', 'aria-label': '全螢幕查看 ERD', onclick: function () { openErdDialog(group, scenario.focusTables); } }, '全螢幕')),
      TASKS.map(function (t) {
        return answerField(t.field, t.label, scenario.tasks[t.field], 8);
      }),
      answerField('assumptions', '我的假設／待向客戶確認的問題（選填）', null, 4),
      h('section', { class: 'card' },
        h('h2', null, '驗收條件'),
        h('ul', null, scenario.acceptance.map(function (a) { return h('li', null, a); }))
      ),
      h('section', { class: 'card actions no-print' },
        h('div', { class: 'btn-row' }, askBtn, copyBtn, doneBtn),
        privacyHint()
      ),
      h('nav', { class: 'pager no-print', 'aria-label': '情境切換' },
        prev ? h('a', { class: 'btn', href: '#/group/' + group.id + '/' + prev.id }, '← ' + prev.id + ' ' + prev.title) : h('span'),
        h('a', { class: 'btn btn-ghost', href: '#/group/' + group.id }, '回題組 ' + group.id),
        next ? h('a', { class: 'btn', href: '#/group/' + group.id + '/' + next.id }, next.id + ' ' + next.title + ' →') : h('span')
      ),
    ];
  }

  /* ---------- Day 06 部署實作 ---------- */

  var WHERE = { local: '你的電腦', server: 'Droplet', web: '瀏覽器' };

  function labCtx() {
    var L = FDE.lab;
    return { ip: L.isIp(data.lab.ip) ? data.lab.ip : '', domain: L.isDomain(data.lab.domain) ? data.lab.domain : '' };
  }

  function viewLab() {
    var L = FDE.lab;
    document.title = L.title + '｜海豹學院 FDE';
    var painters = [];
    function paint() { painters.forEach(function (fn) { fn(); }); }

    /* 進度 */
    var progressLabel = h('label', { for: 'lab-progress' });
    var progressBar = h('progress', { id: 'lab-progress' });
    painters.push(function () {
      var p = L.progress(data.lab.done);
      progressLabel.textContent = '必做步驟：已完成 ' + p.done + '／' + p.total;
      progressBar.max = p.total;
      progressBar.value = p.done;
    });

    /* IP 與網域 */
    function valueField(key, label, placeholder, valid, badMsg) {
      var id = 'lab-' + key;
      var input = h('input', { type: 'text', id: id, placeholder: placeholder, autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', inputmode: key === 'ip' ? 'decimal' : 'url', 'aria-describedby': id + '-msg' });
      var msg = h('p', { class: 'hint field-msg', id: id + '-msg' });
      input.value = data.lab[key];
      function check() {
        var v = data.lab[key];
        var bad = v !== '' && !valid(v);
        msg.textContent = bad ? badMsg : '';
        msg.classList.toggle('error', bad);
        input.setAttribute('aria-invalid', String(bad));
      }
      input.addEventListener('input', function () {
        data.lab[key] = input.value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
        check();
        commit();
        paint();
      });
      check();
      return h('div', { class: 'field' }, h('label', { for: id }, label), input, msg);
    }

    /* 指令區塊 */
    function codeBlock(template) {
      var pre = h('pre', { class: 'cmd', tabindex: '0' });
      var btn = h('button', { type: 'button', class: 'btn btn-sm cmd-copy' }, '複製');
      painters.push(function () { pre.textContent = L.fill(template, labCtx()); });
      btn.addEventListener('click', function () {
        var c = labCtx();
        if (template.indexOf('{{IP}}') !== -1 && !c.ip) { toast('請先在上方填入 Droplet IP'); return; }
        if (template.indexOf('{{DOMAIN}}') !== -1 && !c.domain) { toast('請先在上方填入網域'); return; }
        var text = L.fill(template, c);
        copyText(text).then(function (ok) {
          if (ok) toast('已複製指令');
          else openPromptDialog('複製指令', text, { mode: 'manual', unanswered: false });
        });
      });
      return h('div', { class: 'cmd-wrap' }, pre, btn);
    }

    function stepItem(step, section, sectionMeta) {
      var id = 'step-' + step.id;
      var box = h('input', { type: 'checkbox', id: id });
      var li = h('li', { class: 'lab-step' });
      var text = h('label', { for: id, class: 'step-text' });
      painters.push(function () {
        text.textContent = L.fill(step.text, labCtx());
        box.checked = !!data.lab.done[step.id];
        li.classList.toggle('is-done', box.checked);
      });
      box.addEventListener('change', function () {
        if (box.checked) data.lab.done[step.id] = true;
        else delete data.lab.done[step.id];
        commit();
        paint();
      });
      var link = null;
      if (step.link) {
        link = h('a', { class: 'btn btn-sm step-link', target: '_blank', rel: 'noopener noreferrer' });
        painters.push(function () {
          var c = labCtx();
          var ready = !(step.link.indexOf('{{IP}}') !== -1 && !c.ip) && !(step.link.indexOf('{{DOMAIN}}') !== -1 && !c.domain);
          link.textContent = '開啟 ' + L.fill(step.link, c) + ' ↗';
          if (ready) { link.href = L.fill(step.link, c); link.removeAttribute('aria-disabled'); }
          else { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); }
        });
      }
      append(li, [
        box,
        h('div', { class: 'step-body' },
          h('div', { class: 'step-head' }, h('span', { class: 'where where-' + step.where }, WHERE[step.where]), text),
          step.list ? h('ul', { class: 'step-list' }, step.list.map(function (l) { return h('li', null, l); })) : null,
          step.cmd ? codeBlock(step.cmd) : null,
          link,
          step.expect ? h('p', { class: 'expect' }, h('strong', null, '應該看到'), step.expect) : null,
          step.note ? h('p', { class: 'hint step-note' }, step.note) : null
        ),
      ]);
      return li;
    }

    var sections = L.sections.map(function (sec, i) {
      var meta = h('span', { class: 'badge' });
      painters.push(function () {
        var n = sec.steps.filter(function (st) { return data.lab.done[st.id]; }).length;
        meta.textContent = n === sec.steps.length ? '已完成' : n + '／' + sec.steps.length;
        meta.className = 'badge' + (n === sec.steps.length ? ' badge-done' : n ? ' badge-progress' : '');
      });
      return h('section', { class: 'card lab-section', id: 'lab-' + sec.id },
        h('div', { class: 'lab-head' },
          h('p', { class: 'eyebrow' }, sec.optional ? '選修' : '第 ' + (i + 1) + ' 節'),
          meta
        ),
        h('h2', null, sec.title),
        h('p', { class: 'lab-goal' }, sec.goal),
        h('ol', { class: 'lab-steps' }, sec.steps.map(function (st) { return stepItem(st, sec); })),
        h('div', { class: 'btn-row no-print' },
          h('button', {
            type: 'button', class: 'btn btn-sm',
            onclick: function () { openPromptDialog('卡在「' + sec.title + '」？帶去問 AI', FDE.prompt.buildLabPrompt(L, sec), { mode: 'ai', unanswered: false }); },
          }, '卡住了？帶去問 AI'))
      );
    });

    var out = [
      h('nav', { class: 'breadcrumb no-print', 'aria-label': '導覽路徑' }, h('a', { href: '#/' }, '首頁'), ' ／ Day 06'),
      h('section', { class: 'hero' },
        h('p', { class: 'eyebrow' }, 'Day 06'),
        h('h1', null, '部署實作'),
        h('p', { class: 'lead' }, L.lead),
        h('p', null, '照順序執行每一步，完成就打勾。標示「你的電腦」的指令在自己的終端機執行，標示「Droplet」的在連線後的機器上執行。')
      ),
      h('section', { class: 'card' },
        h('h2', null, '你會部署的架構'),
        h('div', { class: 'arch', role: 'img', 'aria-label': '瀏覽器連到 Droplet 上的 Caddy，Caddy 把 /api 轉給 Node.js API，API 讀寫 PostgreSQL' },
          L.architecture.map(function (a, i) {
            return [
              i ? h('span', { class: 'arch-arrow', 'aria-hidden': 'true' }, '→') : null,
              h('div', { class: 'arch-box' + (i ? ' arch-in' : '') }, h('strong', null, a.name), h('span', null, a.sub)),
            ];
          })
        ),
        h('p', { class: 'hint' }, '藍色的三個容器都在同一台 Droplet 上，由 Docker Compose 管理。'),
        h('h3', { class: 'sub-h' }, '開始前'),
        h('ul', null, L.prerequisites.map(function (t) { return h('li', null, t); }))
      ),
      h('section', { class: 'card lab-setup' },
        h('div', { class: 'overview' },
          valueField('ip', 'Droplet IP', '第 2 節取得，例如 203.0.113.10', L.isIp, 'IP 格式應為四組數字，例如 203.0.113.10'),
          valueField('domain', '網域（選修）', '例如 lab.example.com', L.isDomain, '請只填網域，例如 lab.example.com')
        ),
        h('p', { class: 'hint' }, '填入後，下方指令會自動帶入。只存在這個瀏覽器。'),
        h('div', { class: 'progress-block' }, progressLabel, progressBar)
      ),
      sections,
      h('section', { class: 'card' },
        h('h2', null, '常見問題'),
        L.faq.map(function (f) {
          return h('details', { class: 'table-details' }, h('summary', null, f.q), h('p', { class: 'faq-a' }, f.a));
        })
      ),
    ];
    paint();
    return out;
  }

  /* ---------- 列印頁 ---------- */

  function viewPrint() {
    document.title = '海豹學院 FDE 作答紀錄' + (data.studentName.trim() ? '｜' + data.studentName.trim() : '');
    var now = new Date();
    function block(label, question, text, empty) {
      var t = (text || '').trim();
      return h('div', { class: 'print-block' },
        h('h4', null, label),
        question ? h('p', { class: 'task-question' }, question) : null,
        h('p', { class: 'print-answer' + (t ? '' : ' empty') }, t || empty)
      );
    }
    return [
      h('nav', { class: 'breadcrumb no-print', 'aria-label': '導覽路徑' }, h('a', { href: '#/' }, '首頁'), ' ／ 列印作答'),
      h('div', { class: 'btn-row no-print' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { window.print(); } }, '列印／另存 PDF')),
      h('section', { class: 'hero' },
        h('h1', null, '海豹學院｜FDE 商業情境實戰 作答紀錄'),
        h('p', null, '學生姓名：' + (data.studentName.trim() || '（未填寫）')),
        h('p', null, '列印時間：' + FDE.exporter.formatDateTime(now) + '　完成進度：' + FDE.exporter.completedCount(data, groups) + '／' + TOTAL)
      ),
      groups.map(function (g) {
        return h('section', { class: 'print-group' },
          h('h2', null, '題組 ' + g.id + '｜' + g.name),
          g.scenarios.map(function (s) {
            var rec = peek(s.id);
            return h('article', { class: 'card print-scenario' },
              h('h3', null, s.id + ' ' + s.title + '（' + (rec.completed ? '已完成' : '未完成') + '）'),
              h('blockquote', null, '「' + s.clientQuote + '」'),
              block('任務 A｜調查', s.tasks.investigation, rec.investigation, '（未作答）'),
              block('任務 B｜解決', s.tasks.solution, rec.solution, '（未作答）'),
              block('任務 C｜追加情境', s.tasks.edgeCase, rec.edgeCase, '（未作答）'),
              block('我的假設／待向客戶確認的問題', null, rec.assumptions, '（未填寫）')
            );
          })
        );
      }),
    ];
  }

  function viewNotFound() {
    document.title = '找不到頁面｜海豹學院 FDE';
    return [h('section', { class: 'hero' }, h('h1', null, '找不到這個頁面'), h('p', null, h('a', { class: 'btn btn-primary', href: '#/' }, '回首頁')))];
  }

  /* ---------- 路由 ---------- */

  function render() {
    var parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    var view;
    var activeGroup = null;
    inlineBoard = null;
    if (parts.length === 0) view = viewHome();
    else if (parts[0] === 'print' && parts.length === 1) view = viewPrint();
    else if (parts[0] === 'day06' && parts.length === 1) { view = viewLab(); activeGroup = 'day06'; }
    else if (parts[0] === 'group' && parts[1]) {
      var group = groups.filter(function (g) { return g.id === parts[1].toUpperCase(); })[0];
      var scenario = group && parts[2] ? group.scenarios.filter(function (s) { return s.id === parts[2].toUpperCase(); })[0] : null;
      if (group && parts.length === 2) view = viewGroup(group);
      else if (group && scenario && parts.length === 3) view = viewScenario(group, scenario);
      else view = viewNotFound();
      if (group) activeGroup = group.id;
    } else view = viewNotFound();

    app.textContent = '';
    append(app, view);
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === activeGroup) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  window.addEventListener('hashchange', function () {
    flush();
    render();
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
  });

  render();
})();
