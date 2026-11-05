/* docum.kz — раздел «Профиль»: данные ИП и черновики.
   Входа нет. Всё хранится только в localStorage этого браузера и никуда не передаётся. */
(function () {
  'use strict';
  var L = window.DocumLogic, TPL = window.DocumTemplates, DR = window.DocumDrafts;
  var t = window.t;
  var box = document.getElementById('profile-form'), draftsBox = document.getElementById('drafts');
  if (!box || !draftsBox) return;

  var values = DR.getProfile();
  var msgs = {};
  var note = { text: '', cls: 'msg' };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // Поля профиля необязательны: можно заполнить только часть.
  function check(id) {
    var def = Object.assign({}, TPL.FIELDS[id], { optional: true });
    return L.checkField(def, id, values[id], values);
  }
  function paint(id) {
    var m = document.getElementById('m-' + id), input = document.getElementById('f-' + id);
    var hint = window.tHas('h.' + id) ? t('h.' + id) : '', res = msgs[id];
    m.textContent = res ? t(res.key) : hint;
    m.className = res ? 'msg msg-' + res.type : (hint ? 'hint' : 'msg');
    if (res) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function field(id) {
    var wrap = el('div', 'field');
    var label = el('label', 'label', t('f.' + id));
    label.htmlFor = 'f-' + id;
    wrap.appendChild(label);
    var input = el('input', 'input');
    input.id = 'f-' + id; input.type = 'text'; input.autocomplete = 'off';
    var def = TPL.FIELDS[id];
    if (def.mode) input.inputMode = def.mode;
    if (def.max) input.maxLength = def.max;
    if (window.tHas('p.' + id)) input.placeholder = t('p.' + id);
    input.value = values[id] || '';
    input.setAttribute('aria-describedby', 'm-' + id);
    input.addEventListener('input', function () {
      values[id] = input.value;
      if (msgs[id]) { msgs[id] = check(id); paint(id); }
    });
    wrap.appendChild(input);
    var m = el('p', 'msg');
    m.id = 'm-' + id;
    wrap.appendChild(m);
    return wrap;
  }

  function save() {
    var first = null;
    DR.PROFILE_FIELDS.forEach(function (id) {
      msgs[id] = check(id);
      paint(id);
      if (msgs[id] && !first) first = id;
    });
    if (first) {
      note = { text: '', cls: 'msg' };
      showNote();
      document.getElementById('f-' + first).focus();
      return;
    }
    note = DR.saveProfile(values)
      ? { text: t('pr.saved'), cls: 'msg' }
      : { text: t('e.draft'), cls: 'msg msg-error' };
    showNote();
    renderActions();
  }

  function showNote() {
    var n = document.getElementById('profile-status');
    n.textContent = note.text;
    n.className = note.cls;
  }

  function renderActions() {
    var row = document.getElementById('profile-actions');
    row.textContent = '';
    var b = el('button', 'btn btn-primary', t('pr.save'));
    b.type = 'button'; b.id = 'btn-profile-save';
    b.addEventListener('click', save);
    row.appendChild(b);
    if (DR.hasProfile()) {
      var del = el('button', 'link-btn link-danger', t('pr.delete'));
      del.type = 'button'; del.id = 'btn-profile-delete';
      del.addEventListener('click', function () {
        if (!window.confirm(t('pr.deleteAsk'))) return;
        DR.clearProfile();
        DR.clear();
        values = {}; msgs = {};
        note = { text: t('pr.deleted'), cls: 'msg' };
        renderAll();
      });
      row.appendChild(del);
    }
  }

  function renderForm() {
    box.textContent = '';
    box.appendChild(el('h2', 'section-title', t('pr.data')));
    ['ip_name', 'ip_fio', 'ip_iin', 'ip_addr', 'ip_contact'].forEach(function (id) { box.appendChild(field(id)); });
    box.appendChild(el('h3', 'group-title', t('pr.bank')));
    ['ip_iik', 'ip_bank', 'ip_bik'].forEach(function (id) { box.appendChild(field(id)); });
    var row = el('div', 'profile-actions');
    row.id = 'profile-actions';
    box.appendChild(row);
    var st = el('p', 'msg');
    st.id = 'profile-status';
    st.setAttribute('role', 'status');
    box.appendChild(st);
    DR.PROFILE_FIELDS.forEach(paint);
    renderActions();
    showNote();
  }

  /* ---------- Черновики ---------- */
  function draftTitle(d) {
    return t('d.' + d.code) + (L.isEmpty(d.data.number) ? '' : ' № ' + String(d.data.number).trim());
  }
  function renderDrafts() {
    draftsBox.textContent = '';
    var drafts = DR.list();
    var top = el('div', 'drafts-top');
    top.appendChild(el('h2', 'section-title', t('b.drafts')));
    if (drafts.length) {
      var all = el('button', 'link-btn link-danger', t('b.draftsClear'));
      all.type = 'button';
      all.addEventListener('click', function () {
        if (window.confirm(t('b.draftsClearAsk'))) { DR.clear(); renderDrafts(); }
      });
      top.appendChild(all);
    }
    draftsBox.appendChild(top);
    if (!drafts.length) {
      var p = el('p', 'hint', t('pr.noDrafts') + ' ');
      var a = el('a', null, t('pr.toBuilder'));
      a.href = 'constructor.html';
      p.appendChild(a);
      draftsBox.appendChild(p);
      return;
    }
    var list = el('div', 'draft-list');
    drafts.forEach(function (d) {
      var row = el('div', 'draft');
      var link = el('a', 'draft-open');
      link.href = 'constructor.html?draft=' + encodeURIComponent(d.id);
      link.appendChild(el('span', 'doc-row-title', draftTitle(d)));
      var steps = TPL.DOCS[d.code].steps.length + 1;
      link.appendChild(el('span', 'doc-row-text', t('b.draftSaved') + ' ' + DR.fmtSaved(d.savedAt) + ' · ' + t('b.stepOf').replace('{n}', d.step + 1).replace('{m}', steps)));
      row.appendChild(link);
      var rm = el('button', 'link-btn link-danger', t('b.remove'));
      rm.type = 'button';
      rm.setAttribute('aria-label', t('b.remove') + ': ' + draftTitle(d));
      rm.addEventListener('click', function () {
        if (window.confirm(t('b.draftRemoveAsk'))) { DR.remove(d.id); renderDrafts(); }
      });
      row.appendChild(rm);
      list.appendChild(row);
    });
    draftsBox.appendChild(list);
  }

  function renderAll() { renderForm(); renderDrafts(); }
  renderAll();
  document.addEventListener('docum:lang', renderAll);
})();
