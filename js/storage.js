/* 本機儲存：只讀寫本網站自己的 localStorage key，不會動到其他網站或其他 key。 */
(function (root) {
  var FDE = (root.FDE = root.FDE || {});

  var KEY = 'seal-fde-scenario-v1';
  var BACKUP_KEY = KEY + '-corrupt-backup';
  var VERSION = 1;
  var FIELDS = ['investigation', 'solution', 'edgeCase', 'assumptions'];

  function emptyAnswer() {
    return { investigation: '', solution: '', edgeCase: '', assumptions: '', completed: false, updatedAt: '' };
  }

  function emptyData() {
    return { version: VERSION, studentName: '', answers: {} };
  }

  function str(v) {
    return typeof v === 'string' ? v : '';
  }

  /** 把任何來源的資料整理成目前版本的格式；缺漏或型別錯誤的欄位以空值補上。 */
  function normalize(raw) {
    var out = emptyData();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    out.studentName = str(raw.studentName);
    var answers = raw.answers;
    if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
      Object.keys(answers).forEach(function (id) {
        var a = answers[id];
        if (!a || typeof a !== 'object') return;
        var rec = emptyAnswer();
        FIELDS.forEach(function (f) {
          rec[f] = str(a[f]);
        });
        rec.completed = a.completed === true;
        rec.updatedAt = str(a.updatedAt);
        out.answers[id] = rec;
      });
    }
    return out;
  }

  /**
   * 讀取資料。JSON 損壞時把原始內容另存到備份 key 後回傳空白資料（recovered = true）。
   * 未來若有新版格式，在 normalize 之前依 parsed.version 做轉換即可。
   */
  function load(storage) {
    var raw;
    try {
      raw = storage.getItem(KEY);
    } catch (e) {
      return { data: emptyData(), recovered: false, unavailable: true };
    }
    if (raw === null || raw === undefined) return { data: emptyData(), recovered: false, unavailable: false };
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      try {
        storage.setItem(BACKUP_KEY, raw);
      } catch (e2) {
        /* 備份失敗也不影響繼續使用 */
      }
      return { data: emptyData(), recovered: true, unavailable: false };
    }
    return { data: normalize(parsed), recovered: false, unavailable: false };
  }

  function save(storage, data) {
    try {
      storage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clear(storage) {
    try {
      storage.removeItem(KEY);
      storage.removeItem(BACKUP_KEY);
    } catch (e) {
      /* 儲存空間不可用時沒有東西可清 */
    }
  }

  function isAnswered(rec) {
    if (!rec) return false;
    return ['investigation', 'solution', 'edgeCase'].some(function (f) {
      return rec[f].trim() !== '';
    });
  }

  function hasAnyText(rec) {
    return isAnswered(rec) || (!!rec && rec.assumptions.trim() !== '');
  }

  FDE.storage = {
    KEY: KEY,
    BACKUP_KEY: BACKUP_KEY,
    emptyAnswer: emptyAnswer,
    emptyData: emptyData,
    normalize: normalize,
    load: load,
    save: save,
    clear: clear,
    isAnswered: isAnswered,
    hasAnyText: hasAnyText,
  };
})(typeof window !== 'undefined' ? window : globalThis);
