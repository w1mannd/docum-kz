/* docum.kz — черновики и данные профиля. Хранятся только в localStorage этого браузера и никуда не передаются.
   И то и другое появляется, лишь когда пользователь сам нажимает кнопку сохранения. */
(function (root) {
  'use strict';
  var KEY = 'docum-drafts', PROFILE_KEY = 'docum-profile';
  // В профиль входят только данные самого ИП. Документ, удостоверяющий личность, не хранится.
  var PROFILE_FIELDS = ['ip_name', 'ip_fio', 'ip_iin', 'ip_addr', 'ip_contact', 'ip_iik', 'ip_bank', 'ip_bik'];
  var TPL = root.DocumTemplates;

  // Данные из хранилища не считаем надёжными: оставляем только известные поля нужного типа.
  function sanitize(draft) {
    if (!draft || typeof draft !== 'object' || !TPL.DOCS[draft.code] || typeof draft.id !== 'string') return null;
    var doc = TPL.DOCS[draft.code], src = draft.data && typeof draft.data === 'object' ? draft.data : {}, data = {};
    doc.steps.forEach(function (s) {
      s.fields.forEach(function (id) {
        var f = TPL.FIELDS[id], v = src[id];
        if (f.type === 'items') {
          var rows = Array.isArray(v) ? v.filter(function (r) { return r && typeof r === 'object'; }) : [];
          data[id] = rows.length ? rows.map(function (r) {
            var o = {};
            ['name', 'done', 'unit', 'qty', 'price'].forEach(function (k) { if (typeof r[k] === 'string') o[k] = r[k]; });
            return o;
          }) : [{}];
        } else if (f.type === 'check') data[id] = v === true;
        else if (f.type === 'select') data[id] = f.options.indexOf(v) >= 0 ? v : f.init;
        else data[id] = typeof v === 'string' ? v : (f.init !== undefined ? f.init : '');
      });
    });
    var step = Number(draft.step);
    if (!(step >= 0 && step <= doc.steps.length)) step = 0;
    return { id: draft.id, code: draft.code, step: Math.floor(step), data: data, lang: draft.lang === 'kk' || draft.lang === 'ru' ? draft.lang : null, savedAt: Number(draft.savedAt) || 0 };
  }

  function list() {
    try {
      var raw = JSON.parse(root.localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.map(sanitize).filter(Boolean).sort(function (a, b) { return b.savedAt - a.savedAt; });
    } catch (e) { return []; }
  }

  function write(items) {
    root.localStorage.setItem(KEY, JSON.stringify(items));
  }

  // Возвращает id черновика либо null, если браузер не дал сохранить.
  function save(id, code, step, data, lang) {
    try {
      var items = list().filter(function (d) { return d.id !== id; });
      var newId = id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      items.push({ id: newId, code: code, step: step, data: data, lang: lang, savedAt: Date.now() });
      write(items);
      return newId;
    } catch (e) { return null; }
  }

  function get(id) {
    return list().filter(function (d) { return d.id === id; })[0] || null;
  }

  function remove(id) {
    try { write(list().filter(function (d) { return d.id !== id; })); return true; } catch (e) { return false; }
  }

  function clear() {
    try { root.localStorage.removeItem(KEY); return true; } catch (e) { return false; }
  }

  function fmtSaved(ms) {
    var d = new Date(ms), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* ---------- Профиль ---------- */
  function getProfile() {
    var out = {};
    try {
      var raw = JSON.parse(root.localStorage.getItem(PROFILE_KEY) || '{}');
      PROFILE_FIELDS.forEach(function (k) {
        if (raw && typeof raw[k] === 'string' && raw[k].trim()) out[k] = raw[k];
      });
    } catch (e) { /* хранилище недоступно или повреждено: профиль пуст */ }
    return out;
  }
  function hasProfile() { return Object.keys(getProfile()).length > 0; }
  function clearProfile() {
    try { root.localStorage.removeItem(PROFILE_KEY); return true; } catch (e) { return false; }
  }
  function saveProfile(values) {
    var out = {};
    PROFILE_FIELDS.forEach(function (k) {
      if (typeof values[k] === 'string' && values[k].trim()) out[k] = values[k].trim();
    });
    try {
      if (Object.keys(out).length) root.localStorage.setItem(PROFILE_KEY, JSON.stringify(out));
      else root.localStorage.removeItem(PROFILE_KEY);
      return true;
    } catch (e) { return false; }
  }

  root.DocumDrafts = {
    list: list, save: save, get: get, remove: remove, clear: clear, fmtSaved: fmtSaved,
    PROFILE_FIELDS: PROFILE_FIELDS, getProfile: getProfile, hasProfile: hasProfile, saveProfile: saveProfile, clearProfile: clearProfile
  };
})(window);
