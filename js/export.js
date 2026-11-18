/* 匯出作答：Markdown 與 JSON，皆在瀏覽器內產生檔案，不經過任何伺服器。 */
(function (root) {
  var FDE = (root.FDE = root.FDE || {});

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function formatDateTime(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function completedCount(data, groups) {
    var n = 0;
    groups.forEach(function (g) {
      g.scenarios.forEach(function (s) {
        if (data.answers[s.id] && data.answers[s.id].completed) n += 1;
      });
    });
    return n;
  }

  function total(groups) {
    return groups.reduce(function (sum, g) { return sum + g.scenarios.length; }, 0);
  }

  function ans(text) {
    var t = (text || '').trim();
    return t === '' ? '（未作答）' : t;
  }

  function buildMarkdown(data, groups, now) {
    var lines = [
      '# 海豹學院｜FDE 商業情境實戰 作答紀錄',
      '',
      '- 學生姓名：' + (data.studentName.trim() || '（未填寫）'),
      '- 匯出時間：' + formatDateTime(now),
      '- 完成進度：' + completedCount(data, groups) + '／' + total(groups),
      '',
    ];
    groups.forEach(function (g) {
      lines.push('## 題組 ' + g.id + '｜' + g.name, '');
      g.scenarios.forEach(function (s) {
        var rec = data.answers[s.id] || FDE.storage.emptyAnswer();
        lines.push(
          '### ' + s.id + ' ' + s.title + '（' + (rec.completed ? '已完成' : '未完成') + '）',
          '',
          '> 客戶：' + s.clientQuote,
          '',
          '#### 任務 A｜調查',
          '',
          '題目：' + s.tasks.investigation,
          '',
          ans(rec.investigation),
          '',
          '#### 任務 B｜解決',
          '',
          '題目：' + s.tasks.solution,
          '',
          ans(rec.solution),
          '',
          '#### 任務 C｜追加情境',
          '',
          '題目：' + s.tasks.edgeCase,
          '',
          ans(rec.edgeCase),
          '',
          '#### 我的假設／待向客戶確認的問題',
          '',
          (rec.assumptions || '').trim() || '（未填寫）',
          ''
        );
        if (rec.updatedAt) {
          var d = new Date(rec.updatedAt);
          if (!isNaN(d.getTime())) lines.push('_最後修改：' + formatDateTime(d) + '_', '');
        }
      });
    });
    return lines.join('\n');
  }

  function buildJson(data, now) {
    return JSON.stringify(
      { exportedAt: now.toISOString(), version: data.version, studentName: data.studentName, answers: data.answers },
      null,
      2
    );
  }

  function fileName(data, now, ext) {
    var name = data.studentName.trim().replace(/[\\/:*?"<>|\s]+/g, '_') || '未具名';
    var stamp = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes());
    return '海豹學院FDE作答_' + name + '_' + stamp + '.' + ext;
  }

  function download(name, content, mime) {
    var blob = new Blob([content], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  FDE.exporter = {
    buildMarkdown: buildMarkdown,
    buildJson: buildJson,
    fileName: fileName,
    download: download,
    completedCount: completedCount,
    total: total,
    formatDateTime: formatDateTime,
  };
})(typeof window !== 'undefined' ? window : globalThis);
