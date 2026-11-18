/* ERD：由題組資料產生 Mermaid 原始碼與文字版結構，並負責載入 Mermaid 繪圖。 */
(function (root) {
  var FDE = (root.FDE = root.FDE || {});

  function toMermaid(group) {
    var lines = ['erDiagram'];
    group.relations.forEach(function (r) {
      lines.push('  ' + r.one + ' ' + (r.optional ? 'o|' : '||') + '--o{ ' + r.many + ' : ' + r.verb);
    });
    group.tables.forEach(function (t) {
      lines.push('  ' + t.name + ' {');
      t.columns.forEach(function (c) {
        lines.push('    ' + c.type + ' ' + c.name + (c.key ? ' ' + c.key : ''));
      });
      lines.push('  }');
    });
    return lines.join('\n');
  }

  var KEY_LABEL = { PK: '主鍵 PK', FK: '外鍵 FK', UK: '唯一 UK' };

  /** ERD 的文字版：給 AI Prompt 使用，也是圖無法顯示時的備援。 */
  function toText(group) {
    var lines = [];
    group.tables.forEach(function (t) {
      lines.push('資料表 ' + t.name + '（' + t.label + '）：' + t.desc);
      t.columns.forEach(function (c) {
        lines.push('  - ' + c.name + ' ' + c.type + (c.key ? ' [' + KEY_LABEL[c.key] + ']' : '') + '：' + c.desc);
      });
      lines.push('');
    });
    lines.push('資料表關聯：');
    group.relations.forEach(function (r) {
      lines.push(
        '  - ' + r.one + '（' + (r.optional ? '0 或 1' : '1') + '）對 ' + r.many + '（0 到多）：' + r.desc +
          '。' + r.many + '.' + r.fk + ' 指向 ' + r.one + '.id'
      );
    });
    lines.push('');
    lines.push('狀態值：');
    group.statuses.forEach(function (s) {
      lines.push(
        '  - ' + s.field + '：' +
          s.values.map(function (v) { return v.value + '（' + v.meaning + '）'; }).join('、')
      );
    });
    if (group.notes.length) {
      lines.push('');
      lines.push('補充說明：');
      group.notes.forEach(function (n) {
        lines.push('  - ' + n);
      });
    }
    return lines.join('\n');
  }

  var mermaidPromise = null;
  var renderCount = 0;

  /** Mermaid 放在本站的 vendor/ 內，只有需要畫 ERD 時才載入。 */
  function loadMermaid() {
    if (mermaidPromise) return mermaidPromise;
    mermaidPromise = new Promise(function (resolve, reject) {
      if (root.mermaid) return resolve(root.mermaid);
      var s = document.createElement('script');
      s.src = 'vendor/mermaid.min.js';
      s.onload = function () {
        if (root.mermaid) resolve(root.mermaid);
        else reject(new Error('mermaid 未正確載入'));
      };
      s.onerror = function () {
        reject(new Error('mermaid 載入失敗'));
      };
      document.head.appendChild(s);
    }).then(function (mermaid) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: {
          primaryColor: '#FDF1E3',
          primaryBorderColor: '#263744',
          primaryTextColor: '#263744',
          lineColor: '#263744',
          tertiaryColor: '#FFFFFF',
          fontFamily: 'system-ui, -apple-system, "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif',
        },
        er: { useMaxWidth: true },
      });
      return mermaid;
    });
    mermaidPromise.catch(function () {
      mermaidPromise = null; // 下次可再重試
    });
    return mermaidPromise;
  }

  /** 把題組的 ERD 畫進 container；失敗時 reject，由呼叫端顯示文字版。 */
  function renderInto(container, group) {
    return loadMermaid()
      .then(function (mermaid) {
        renderCount += 1;
        return mermaid.render('erd-' + group.id + '-' + renderCount, toMermaid(group));
      })
      .then(function (result) {
        container.innerHTML = result.svg;
        var svg = container.querySelector('svg');
        if (svg) {
          svg.setAttribute('role', 'img');
          svg.setAttribute('aria-label', '題組 ' + group.id + ' 的 ERD 實體關聯圖');
        }
      });
  }

  FDE.erd = { toMermaid: toMermaid, toText: toText, renderInto: renderInto };
})(typeof window !== 'undefined' ? window : globalThis);
