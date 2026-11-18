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
      saveStatus.textContent = '已自動儲存於這個瀏覽器（' + FDE.exporter.formatDateTime(d).slice(11) + '）';
      saveStatus.classList.remove('error');
    } else {
      saveStatus.textContent = '無法儲存到瀏覽器（可能是無痕模式或儲存空間已滿）。請盡快用「匯出作答」保存內容。';
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
    document.getElementById('prompt-steps').hidden = !ai;
    document.getElementById('prompt-links').hidden = !ai;
    document.getElementById('prompt-disclaimer').hidden = !ai;
    document.getElementById('prompt-label').textContent = ai ? '即將複製的完整提問' : '要複製的內容';
    promptCopyBtn.textContent = ai ? '複製完整提問' : '複製';
    promptText.value = text;
    promptCopyMsg.textContent = '';
    promptCopyMsg.classList.remove('error');
    promptDialog.showModal();
    promptText.scrollTop = 0;
    if (!ai) {
      selectPromptText();
      promptCopyMsg.textContent = '無法自動複製。內容已全選，請按 Ctrl+C（Mac 為 ⌘+C）手動複製。';
      promptCopyMsg.classList.add('error');
    }
  }

  promptCopyBtn.addEventListener('click', function () {
    copyText(promptText.value).then(function (ok) {
      if (ok) {
        promptCopyMsg.classList.remove('error');
        promptCopyMsg.textContent = '已複製到剪貼簿。請開啟 AI 服務後自行貼上並送出。';
      } else {
        selectPromptText();
        promptCopyMsg.classList.add('error');
        promptCopyMsg.textContent = '無法自動複製。內容已全選，請按 Ctrl+C（Mac 為 ⌘+C）手動複製。';
      }
    });
  });

  var erdDialog = document.getElementById('erd-dialog');
  var erdCanvas = document.getElementById('erd-dialog-canvas');
  var erdZoom = 1;
  setupDialog(erdDialog);

  function applyZoom() {
    erdCanvas.style.width = Math.round(erdZoom * 1100) + 'px';
    document.getElementById('erd-zoom-reset').textContent = Math.round(erdZoom * 100) + '%';
  }
  document.getElementById('erd-zoom-in').addEventListener('click', function () {
    erdZoom = Math.min(3, erdZoom + 0.25);
    applyZoom();
  });
  document.getElementById('erd-zoom-out').addEventListener('click', function () {
    erdZoom = Math.max(0.5, erdZoom - 0.25);
    applyZoom();
  });
  document.getElementById('erd-zoom-reset').addEventListener('click', function () {
    erdZoom = 1;
    applyZoom();
  });

  function openErdDialog(group) {
    document.getElementById('erd-dialog-title').textContent = '題組 ' + group.id + ' ERD';
    erdZoom = 1;
    applyZoom();
    erdCanvas.textContent = 'ERD 載入中…';
    erdDialog.showModal();
    FDE.erd.renderInto(erdCanvas, group).catch(function () {
      erdCanvas.style.width = 'auto';
      erdCanvas.textContent = '';
      erdCanvas.appendChild(h('p', { class: 'notice notice-warn' }, 'ERD 圖無法載入，以下為文字版資料結構。'));
      erdCanvas.appendChild(h('pre', { class: 'erd-text' }, FDE.erd.toText(group)));
    });
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
    return h('p', { class: 'hint' }, '提醒：回答可能包含個資，送給 AI 前請先檢查並去識別化。網站不會自動送出內容，需由你在 AI 平台貼上後送出。');
  }

  function statusBadge(rec) {
    if (rec.completed) return h('span', { class: 'badge badge-done' }, '已完成');
    if (S.hasAnyText(rec)) return h('span', { class: 'badge badge-progress' }, '作答中');
    return h('span', { class: 'badge' }, '未作答');
  }

  /** ERD 區塊：圖（可橫向捲動、不裁切）、放大檢視、文字版資料結構。 */
  function erdSection(group, headingTag) {
    var canvas = h('div', { class: 'erd-canvas erd-inline' }, 'ERD 載入中…');
    var textPre = h('pre', { class: 'erd-text', id: 'erd-text-' + group.id, hidden: true, tabindex: '0' }, FDE.erd.toText(group));
    var toggle = h('button', { type: 'button', class: 'btn', 'aria-expanded': 'false', 'aria-controls': 'erd-text-' + group.id }, '顯示文字版資料結構');
    toggle.addEventListener('click', function () {
      textPre.hidden = !textPre.hidden;
      toggle.setAttribute('aria-expanded', String(!textPre.hidden));
      toggle.textContent = textPre.hidden ? '顯示文字版資料結構' : '隱藏文字版資料結構';
    });
    var zoomBtn = h('button', { type: 'button', class: 'btn', onclick: function () { openErdDialog(group); } }, '放大／全螢幕查看 ERD');
    var failNote = h('p', { class: 'notice notice-warn', hidden: true }, 'ERD 圖無法載入，已改為顯示文字版資料結構。');

    FDE.erd.renderInto(canvas, group).catch(function () {
      canvas.hidden = true;
      scroller.hidden = true;
      zoomBtn.hidden = true;
      failNote.hidden = false;
      textPre.hidden = false;
      toggle.hidden = true;
    });

    var scroller = h('div', { class: 'erd-scroll', tabindex: '0', role: 'group', 'aria-label': 'ERD 圖，可左右捲動' }, canvas);
    return h('section', { class: 'card' },
      h(headingTag, null, 'ERD 實體關聯圖'),
      h('p', { class: 'hint' }, '圖太小時可以左右捲動，或按「放大／全螢幕查看 ERD」。PK 為主鍵、FK 為外鍵、UK 為不可重複。'),
      failNote,
      scroller,
      h('div', { class: 'btn-row no-print' }, zoomBtn, toggle),
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

    var nameInput = h('input', { type: 'text', id: 'student-name', autocomplete: 'name', maxlength: '50', placeholder: '匯出作答時會寫入檔案' });
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
      toast('已產生匯出檔案，請查看瀏覽器的下載項目');
    }

    return [
      h('section', { class: 'hero' },
        h('h1', null, '海豹學院｜FDE 商業情境實戰'),
        h('p', { class: 'lead' }, '讀懂 ERD、拆解客戶需求、用自然語言提出解法'),
        h('p', null, '三大題組、12 個連續情境。每個情境都分成「調查 → 解決 → 追加情境」三階段，請用自己的話說明你的判斷與做法。這裡不考 SQL 語法，也不需要寫 SQL。')
      ),
      loaded.recovered ? h('p', { class: 'notice notice-warn' }, '先前儲存在這個瀏覽器的作答資料格式已損壞，無法讀取，已改用空白資料開始。損壞的原始內容仍保留在瀏覽器中（' + S.BACKUP_KEY + '），可請老師或助教協助取回。') : null,
      loaded.unavailable ? h('p', { class: 'notice notice-warn' }, '這個瀏覽器目前無法使用本機儲存（可能是無痕模式或設定限制），重新整理後作答會消失。請記得匯出作答。') : null,
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
      h('section', { class: 'card' },
        h('h2', null, '怎麼作答'),
        h('p', null, '每一題都請「說明你的判斷與做法」：你會看哪些資料、用什麼條件判斷、怎麼處理例外、怎麼驗證結果。可以用條列、流程或段落。'),
        h('blockquote', { class: 'example' },
          h('p', { class: 'eyebrow' }, '自然語言作答示例'),
          h('p', null, '我會先找出付款狀態成功但報名仍待付款的紀錄，透過報名編號確認對應的學生與課程。接著檢查是否存在後續退款，將可修復和需人工確認的紀錄分開。正式修改前先保存異常清單，修改後再比對結果，確保不會開通已退款的課程。')
        ),
        h('p', null, '寫完後可以按「帶這題與我的回答去問 AI」，把題目和你的回答組成一份完整提問，複製後貼到 ChatGPT、Claude 等 AI 服務取得回饋，再回來修改答案。')
      ),
      h('section', { class: 'card' },
        h('h2', null, '匯出與資料管理'),
        h('p', { class: 'notice' }, '資料儲存於目前瀏覽器，換裝置不會同步。交作業或換電腦前，請先匯出作答。'),
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { exportFile('md'); } }, '匯出作答（Markdown）'),
          h('button', { type: 'button', class: 'btn', onclick: function () { exportFile('json'); } }, '匯出作答（JSON）'),
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
        h('p', { class: 'meta' }, '已完成 ' + completedIn(group) + '／' + group.scenarios.length + '。四個情境共用同一張 ERD，建議依序作答。'),
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
        h('p', { class: 'hint no-print' }, '會帶入本題組的系統背景、ERD 文字結構、四個情境的題目，以及你在本題組的全部回答。'),
        privacyHint()
      ),
      erdSection(group, 'h2'),
      tablesSection(group, null),
      statusSection(group),
    ];
  }

  /* ---------- 情境作答頁 ---------- */

  var TASKS = [
    { field: 'investigation', label: '任務 A｜調查', help: '你會如何調查？要看哪些資料？如何辨識異常？' },
    { field: 'solution', label: '任務 B｜解決', help: '你會如何解決？如何避免錯誤修改？如何驗證？' },
    { field: 'edgeCase', label: '任務 C｜追加情境', help: '追加條件後，原方案要如何調整？' },
  ];

  function viewScenario(group, scenario) {
    document.title = scenario.id + ' ' + scenario.title + '｜海豹學院 FDE';
    var idx = group.scenarios.indexOf(scenario);
    var prev = group.scenarios[idx - 1];
    var next = group.scenarios[idx + 1];

    function answerField(field, label, help, question, rows) {
      var id = 'ans-' + scenario.id + '-' + field;
      var ta = h('textarea', { id: id, rows: String(rows), 'aria-describedby': id + '-help', placeholder: '用自己的話說明你的判斷與做法，可以條列。' });
      ta.value = peek(scenario.id)[field];
      ta.addEventListener('input', function () {
        var rec = record(scenario.id);
        rec[field] = ta.value;
        rec.updatedAt = new Date().toISOString();
        commit();
      });
      return h('section', { class: 'card task' },
        h('h2', null, h('label', { for: id }, label)),
        question ? h('p', { class: 'task-question' }, question) : null,
        h('p', { class: 'hint', id: id + '-help' }, help),
        ta
      );
    }

    var doneBtn = h('button', { type: 'button', class: 'btn' });
    function paintDone() {
      var done = peek(scenario.id).completed;
      doneBtn.setAttribute('aria-pressed', String(done));
      doneBtn.textContent = done ? '✓ 已完成（按一下取消）' : '標記完成';
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

    var erdDetails = h('details', { class: 'card erd-details' },
      h('summary', null, '查看題組 ' + group.id + ' 的 ERD 與資料結構',
        h('span', { class: 'summary-desc' }, '本題重點資料表：' + scenario.focusTables.join('、')))
    );
    var erdLoaded = false;
    erdDetails.addEventListener('toggle', function () {
      if (!erdDetails.open || erdLoaded) return;
      erdLoaded = true;
      erdDetails.appendChild(h('p', null, group.background));
      erdDetails.appendChild(erdSection(group, 'h3'));
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
      h('div', { class: 'btn-row no-print' },
        h('button', { type: 'button', class: 'btn', onclick: function () { openErdDialog(group); } }, '放大查看 ERD')),
      erdDetails,
      TASKS.map(function (t) {
        return answerField(t.field, t.label, t.help, scenario.tasks[t.field], 8);
      }),
      answerField('assumptions', '我的假設／待向客戶確認的問題（選填）', '有哪些事情題目沒說清楚、你需要先假設或回頭問客戶？', null, 4),
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
    if (parts.length === 0) view = viewHome();
    else if (parts[0] === 'print' && parts.length === 1) view = viewPrint();
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
