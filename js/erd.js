/* ERD 文字版：給 AI Prompt 使用，也是畫布之外的純文字檢視。 */
(function (root) {
  var FDE = (root.FDE = root.FDE || {});

  var KEY_LABEL = { PK: '主鍵 PK', FK: '外鍵 FK', UK: '唯一 UK' };

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

  FDE.erd = { toText: toText };
})(typeof window !== 'undefined' ? window : globalThis);
