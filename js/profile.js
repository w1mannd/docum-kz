/* docum.kz — раздел «Профиль»: данные ИП и защита паролем.
   Входа нет. Всё хранится только в этом браузере и никуда не передаётся; при защите — в зашифрованном виде. */
(function () {
  'use strict';
  var L = window.DocumLogic, TPL = window.DocumTemplates, DR = window.DocumDrafts;
  var t = window.t;
  var box = document.getElementById('profile-form');
  if (!box) return;

  var VA = window.DocumVault;
  var values = {};
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
    var okSave = DR.saveProfile(values);
    if (okSave && VA) VA.log('profileSave');
    note = okSave
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
        if (VA) VA.log('profileDel');
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

  // Черновики перенесены в «Мои документы» → «Незаконченные».
  /* ---------- Защита паролем ---------- */
  // Пароль закрывает «Профиль» и «Мои документы». Он нигде не хранится; забытый пароль восстановить нельзя.
  var sec = document.createElement('section');
  sec.className = 'vault-sec'; sec.id = 'security';
  box.parentNode.appendChild(sec);
  function pwFields(withRepeat) {
    var wrap = el('div', 'vault-pw');
    var a = el('input', 'input'); a.type = 'password'; a.autocomplete = 'new-password'; a.placeholder = t('va.newPw'); a.setAttribute('aria-label', t('va.newPw'));
    var meter = el('div', 'vault-meter'); var bar = el('i'); meter.appendChild(bar);
    var hint = el('p', 'hint', t('va.pwRules'));
    wrap.appendChild(a); wrap.appendChild(meter); wrap.appendChild(hint);
    var b = null;
    if (withRepeat) { b = el('input', 'input'); b.type = 'password'; b.autocomplete = 'new-password'; b.placeholder = t('va.repeatPw'); b.setAttribute('aria-label', t('va.repeatPw')); wrap.appendChild(b); }
    a.addEventListener('input', function () {
      var sc = VA.strength(a.value);
      bar.style.width = (a.value ? 10 + sc * 22.5 : 0) + '%';
      meter.className = 'vault-meter s' + sc;
      hint.textContent = a.value ? t('va.s' + sc) : t('va.pwRules');
    });
    return { node: wrap, a: a, b: b, check: function () {
      if (a.value.length < 8) return t('va.short');
      if (VA.strength(a.value) < 2) return t('va.weak');
      if (b && a.value !== b.value) return t('va.mismatch');
      return '';
    } };
  }
  function renderSecurity() {
    sec.textContent = '';
    if (!VA || !(window.crypto && window.crypto.subtle)) return;
    sec.appendChild(el('h2', 'section-title', t('va.title')));
    var msg = el('p', 'msg'); msg.setAttribute('role', 'status');
    var flashMsg = function (txt, bad) { msg.textContent = txt; msg.className = bad ? 'msg msg-error' : 'msg'; };
    if (!VA.on()) {
      sec.appendChild(el('p', 'lead-s', t('va.offLead')));
      var list = el('ul', 'vault-facts');
      ['va.f1', 'va.f2', 'va.f3', 'va.f4'].forEach(function (k) { list.appendChild(el('li', null, t(k))); });
      sec.appendChild(list);
      var pw = pwFields(true);
      sec.appendChild(pw.node);
      var agree = el('label', 'vault-agree'); var cb = el('input'); cb.type = 'checkbox';
      agree.appendChild(cb); agree.appendChild(el('span', null, t('va.agree')));
      sec.appendChild(agree);
      var go = el('button', 'btn btn-primary', t('va.enable')); go.type = 'button';
      go.addEventListener('click', function () {
        var err = pw.check(); if (err) { flashMsg(err, true); return; }
        if (!cb.checked) { flashMsg(t('va.agreeNeed'), true); return; }
        go.disabled = true; flashMsg(t('va.encrypting'));
        VA.enable(pw.a.value).then(function () { pw.a.value = pw.b.value = ''; renderSecurity(); }).catch(function () { go.disabled = false; flashMsg(t('va.fail'), true); });
      });
      sec.appendChild(go); sec.appendChild(msg);
      return;
    }
    // Защита включена (раздел открыт — иначе вместо страницы форма входа).
    var stRow = el('p', 'vault-on'); stRow.appendChild(el('b', null, t('va.onState'))); stRow.appendChild(document.createTextNode(' ' + t('va.onLead')));
    sec.appendChild(stRow);
    var lockB = el('button', 'btn btn-ghost', t('va.lockNow')); lockB.type = 'button';
    lockB.addEventListener('click', function () { VA.lock(); setTimeout(function () { location.reload(); }, 150); });
    sec.appendChild(lockB);
    var det = el('details', 'vault-more');
    det.appendChild(el('summary', null, t('va.changeTitle')));
    var pw2 = pwFields(true);
    det.appendChild(pw2.node);
    var ch = el('button', 'btn btn-ghost', t('va.change')); ch.type = 'button';
    ch.addEventListener('click', function () {
      var err = pw2.check(); if (err) { flashMsg(err, true); return; }
      ch.disabled = true; flashMsg(t('va.encrypting'));
      VA.change(pw2.a.value).then(function () { flashMsg(t('va.changed')); pw2.a.value = pw2.b.value = ''; ch.disabled = false; }).catch(function () { ch.disabled = false; flashMsg(t('va.fail'), true); });
    });
    det.appendChild(ch);
    sec.appendChild(det);
    var off = el('button', 'link-btn link-danger', t('va.disable')); off.type = 'button';
    off.addEventListener('click', function () {
      if (!window.confirm(t('va.disableAsk'))) return;
      flashMsg(t('va.decrypting'));
      VA.disable().then(function () { renderSecurity(); }).catch(function () { flashMsg(t('va.fail'), true); });
    });
    sec.appendChild(off);
    sec.appendChild(msg);
  }

  var loaded = false;
  function renderAll() {
    if (VA && VA.locked()) { VA.gate(box); sec.textContent = ''; return; }
    if (!loaded) { values = DR.getProfile(); loaded = true; }
    renderForm(); renderSecurity();
  }
  (VA ? VA.ready : Promise.resolve()).then(renderAll);
  document.addEventListener('docum:lang', renderAll);
  document.addEventListener('docum:vault', function () { if (VA && VA.locked()) location.reload(); });
})();
