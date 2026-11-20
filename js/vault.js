/* docum.kz — защита «Моих документов» и «Профиля» паролем и журнал действий.
   Пароль нигде не хранится: ни сам, ни его хэш. Из пароля и случайной «соли» функцией PBKDF2-SHA-256
   (600 000 повторов) получается ключ AES-GCM 256 бит. Им шифруются документы, черновики, профиль и журнал действий.
   В браузере лежит только зашифрованный текст и контрольная фраза, зашифрованная тем же ключом:
   расшифровалась — пароль верный.
   Ключ на время сеанса хранится в IndexedDB как неизвлекаемый объект CryptoKey: им можно шифровать,
   но прочитать его байты нельзя. Сеанс — эта вкладка (метка в sessionStorage) и не дольше 15 минут бездействия. */
(function (root) {
  'use strict';
  var CFG = 'docum-vault', SID = 'docum-vsid', AUDIT = 'docum-audit';
  var PROTECTED = ['docum-drafts', 'docum-profile', AUDIT];
  var ITER = 600000, IDLE = 15 * 60000, MAX_LOG = 500;
  var subtle = root.crypto && root.crypto.subtle;
  var key = null, cache = {}, writes = {}, lastTouch = Date.now();

  function t(k) { return root.t ? root.t(k) : k; }
  function emit() { document.dispatchEvent(new CustomEvent('docum:vault', { detail: { on: on(), open: !!key } })); }
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function rnd(n) { var a = new Uint8Array(n); root.crypto.getRandomValues(a); return a; }
  function ls(k, v) {
    try {
      if (v === undefined) return root.localStorage.getItem(k);
      if (v === null) root.localStorage.removeItem(k); else root.localStorage.setItem(k, v);
    } catch (e) { return null; }
    return null;
  }

  var cfg = null;
  try { cfg = JSON.parse(ls(CFG) || 'null'); } catch (e) { cfg = null; }
  function on() { return !!(cfg && cfg.salt); }

  /* ---------- Криптография ---------- */
  function derive(pw, salt, iter) {
    return subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function enc(k, value) {
    var iv = rnd(12);
    return subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(JSON.stringify(value)))
      .then(function (ct) { return { iv: b64(iv), ct: b64(new Uint8Array(ct)) }; });
  }
  function dec(k, box) {
    return subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, k, unb64(box.ct))
      .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
  }

  /* ---------- Ключ сеанса ---------- */
  var kdb = null;
  function keyDb() {
    if (kdb) return kdb;
    kdb = new Promise(function (ok, fail) {
      var r = root.indexedDB.open('docum-vault', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('k'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { fail(r.error); };
    });
    return kdb;
  }
  function kx(mode, fn) {
    return keyDb().then(function (db) {
      return new Promise(function (ok, fail) {
        var tr = db.transaction('k', mode), res = fn(tr.objectStore('k'));
        tr.oncomplete = function () { ok(res && res.result); };
        tr.onerror = function () { fail(tr.error); };
      });
    });
  }
  function sid() { try { return root.sessionStorage.getItem(SID); } catch (e) { return null; } }
  function saveSession(k) {
    var s = b64(rnd(12));
    try { root.sessionStorage.setItem(SID, s); } catch (e) { /* нет */ }
    return kx('readwrite', function (st) { return st.put({ key: k, sid: s, last: Date.now() }, 'session'); }).catch(function () { /* без IndexedDB — ключ только в памяти */ });
  }
  function dropSession() {
    try { root.sessionStorage.removeItem(SID); } catch (e) { /* нет */ }
    return kx('readwrite', function (st) { return st.delete('session'); }).catch(function () { /* нет */ });
  }
  function loadSession() {
    var s = sid();
    if (!s) return Promise.resolve(null);
    return kx('readonly', function (st) { return st.get('session'); }).then(function (x) {
      if (!x || x.sid !== s || Date.now() - x.last > IDLE) { dropSession(); return null; }
      return x.key;
    }).catch(function () { return null; });
  }
  function touch() {
    if (!key || Date.now() - lastTouch < 30000) return;
    lastTouch = Date.now();
    kx('readwrite', function (st) {
      var g = st.get('session');
      g.onsuccess = function () { if (g.result) { g.result.last = lastTouch; st.put(g.result, 'session'); } };
      return g;
    }).catch(function () { /* нет */ });
  }
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, touch, { passive: true }); });
  setInterval(function () { if (key && Date.now() - lastTouch > IDLE) lock('idle'); }, 30000);

  /* ---------- Защищённые записи localStorage: профиль, черновики, журнал действий ---------- */
  function isBox(s) { return typeof s === 'string' && s.indexOf('{"vault":1') === 0; }
  function fillCache() {
    cache = {};
    return Promise.all(PROTECTED.map(function (name) {
      var v = ls(name);
      if (!isBox(v)) { if (v !== null) cache[name] = v; return null; }
      return dec(key, JSON.parse(v)).then(function (plain) { cache[name] = plain; }, function () { /* повреждено */ });
    }));
  }
  function writeBox(name) {
    var p = (writes[name] || Promise.resolve()).then(function () {
      if (!(name in cache)) { ls(name, null); return; }
      return enc(key, cache[name]).then(function (box) { box.vault = 1; ls(name, JSON.stringify({ vault: 1, iv: box.iv, ct: box.ct })); });
    });
    writes[name] = p.catch(function () { /* нет */ });
    return p;
  }
  function getItem(name) {
    if (!on() || PROTECTED.indexOf(name) < 0) return ls(name);
    return key && name in cache ? cache[name] : null;
  }
  function setItem(name, value) {
    if (!on() || PROTECTED.indexOf(name) < 0) { root.localStorage.setItem(name, value); return; }
    if (!key) throw { code: 'locked' };
    cache[name] = value; writeBox(name);
  }
  function removeItem(name) {
    if (!on() || PROTECTED.indexOf(name) < 0) { ls(name, null); return; }
    if (!key) throw { code: 'locked' };
    delete cache[name]; writeBox(name);
  }

  /* ---------- Записи журнала документов (IndexedDB) ---------- */
  function sealRec(rec) {
    if (!on()) return Promise.resolve(rec);
    if (!key) return Promise.reject({ code: 'locked' });
    return enc(key, rec).then(function (box) { return { id: rec.id, updated: rec.updated, vault: box }; });
  }
  function openRec(row) {
    if (!row || !row.vault) return Promise.resolve(row);
    if (!key) return Promise.reject({ code: 'locked' });
    return dec(key, row.vault);
  }

  /* ---------- Журнал действий ---------- */
  function readLog() { try { return JSON.parse(getItem(AUDIT) || '[]') || []; } catch (e) { return []; } }
  // Пишется только то, что нужно для истории: тип, время, документ, номер версии, статус. Без персональных данных.
  function log(type, data) {
    if (on() && !key) return;
    var list = readLog();
    var e = { at: Date.now(), t: type };
    if (data) Object.keys(data).forEach(function (k) { if (data[k] !== undefined && data[k] !== null && data[k] !== '') e[k] = data[k]; });
    list.push(e);
    if (list.length > MAX_LOG) list = list.slice(-MAX_LOG);
    try { setItem(AUDIT, JSON.stringify(list)); } catch (x) { /* нет */ }
  }

  /* ---------- Включение, вход, выход ---------- */
  function store() { return root.DocumStore; }
  // Без модуля журнала включать или менять защиту нельзя: документы остались бы незашифрованными.
  function readAll() { return store() ? store().all() : Promise.reject(new Error('no-store')); }
  function rewriteAll(recs) { return store() ? Promise.all(recs.map(function (r) { return store().put(r, { keep: true }); })) : Promise.resolve(); }
  function plainItems() { var o = {}; PROTECTED.forEach(function (n) { var v = getItem(n); if (v !== null) o[n] = v; }); return o; }

  function setPassword(pw) {
    var salt = rnd(16);
    return derive(pw, salt, ITER).then(function (k) {
      return enc(k, 'docum').then(function (check) {
        return { cfg: { v: 1, salt: b64(salt), iter: ITER, check: check, fails: [] }, key: k };
      });
    });
  }
  // Включить защиту: всё, что лежало открыто, шифруется новым ключом.
  function enable(pw) {
    var items = plainItems();
    return readAll().then(function (recs) {
      return setPassword(pw).then(function (x) {
        cfg = x.cfg; key = x.key; ls(CFG, JSON.stringify(cfg));
        cache = items; PROTECTED.forEach(writeBox);
        return Promise.all([rewriteAll(recs), saveSession(key)]);
      });
    }).then(function () { lastTouch = Date.now(); log('vaultOn'); emit(); });
  }
  // Сменить пароль: всё перешифровывается.
  function change(pw) {
    if (!key) return Promise.reject({ code: 'locked' });
    var items = plainItems();
    return readAll().then(function (recs) {
      return setPassword(pw).then(function (x) {
        cfg = x.cfg; key = x.key; ls(CFG, JSON.stringify(cfg));
        cache = items; PROTECTED.forEach(writeBox);
        return Promise.all([rewriteAll(recs), saveSession(key)]);
      });
    }).then(function () { log('vaultChange'); emit(); });
  }
  // Выключить защиту: данные снова хранятся открыто, как до включения.
  function disable() {
    if (!key) return Promise.reject({ code: 'locked' });
    var items = plainItems();
    return readAll().then(function (recs) {
      return Promise.all(Object.keys(writes).map(function (n) { return writes[n]; })).then(function () {
        cfg = null; key = null; ls(CFG, null);
        PROTECTED.forEach(function (n) { if (n in items) ls(n, items[n]); else ls(n, null); });
        cache = {};
        return Promise.all([rewriteAll(recs), dropSession()]);
      });
    }).then(function () { log('vaultOff'); emit(); });
  }
  function unlock(pw) {
    if (!on()) return Promise.resolve(true);
    // После 5 неудачных попыток подряд — пауза, растущая с каждой следующей.
    var fails = (cfg.fails || []).filter(function (x) { return Date.now() - x < 3600000; });
    var wait = fails.length >= 5 ? Math.min(60000, 2000 * Math.pow(2, fails.length - 5)) : 0;
    var since = fails.length ? Date.now() - fails[fails.length - 1] : Infinity;
    if (since < wait) return Promise.reject({ code: 'wait', s: Math.ceil((wait - since) / 1000) });
    return derive(pw, unb64(cfg.salt), cfg.iter).then(function (k) {
      return dec(k, cfg.check).then(function (v) {
        if (v !== 'docum') throw new Error('bad');
        return k;
      });
    }).then(function (k) {
      key = k; lastTouch = Date.now();
      var missed = fails.length;
      cfg.fails = []; ls(CFG, JSON.stringify(cfg));
      return Promise.all([saveSession(k), fillCache()]).then(function () {
        log('unlock', missed ? { s: missed } : null);
        emit(); return true;
      });
    }, function () {
      cfg.fails = fails.concat([Date.now()]); ls(CFG, JSON.stringify(cfg));
      throw { code: 'bad' };
    });
  }
  function lock(why) {
    if (!key) return;
    log(why === 'idle' ? 'lockIdle' : 'lock');
    var pend = Object.keys(writes).map(function (n) { return writes[n]; });
    Promise.all(pend).then(function () {
      key = null; cache = {};
      dropSession().then(emit);
    });
  }

  var ready = (on() ? loadSession().then(function (k) {
    if (!k) return null;
    key = k; return fillCache();
  }) : Promise.resolve()).catch(function () { key = null; }).then(function () { return true; });

  /* ---------- Окно ввода пароля ---------- */
  function el(tag, cls, text) { var x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; }
  function lockIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>'; }
  // Форма входа: в окне (prompt) или прямо на странице (gate).
  function form(onDone, onCancel) {
    var f = el('form', 'vault-form');
    f.setAttribute('autocomplete', 'off');
    var ic = el('span', 'vault-ico'); ic.innerHTML = lockIcon(); f.appendChild(ic);
    f.appendChild(el('h2', 'vault-title', t('va.lockedTitle')));
    f.appendChild(el('p', 'vault-lead', t('va.lockedLead')));
    var inp = el('input', 'input'); inp.type = 'password'; inp.autocomplete = 'current-password'; inp.placeholder = t('va.password'); inp.setAttribute('aria-label', t('va.password'));
    f.appendChild(inp);
    var msg = el('p', 'msg'); msg.setAttribute('role', 'status'); f.appendChild(msg);
    var row = el('div', 'vault-row');
    var go = el('button', 'btn btn-primary', t('va.unlock')); go.type = 'submit'; row.appendChild(go);
    if (onCancel) { var no = el('button', 'btn btn-ghost', t('va.cancel')); no.type = 'button'; no.addEventListener('click', onCancel); row.appendChild(no); }
    f.appendChild(row);
    f.appendChild(el('p', 'vault-note', t('va.forgot')));
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!inp.value) { inp.focus(); return; }
      go.disabled = true; msg.className = 'msg'; msg.textContent = t('va.checking');
      unlock(inp.value).then(function () { inp.value = ''; onDone(); }, function (err) {
        go.disabled = false; inp.select();
        msg.className = 'msg msg-error';
        msg.textContent = err && err.code === 'wait' ? t('va.wait').replace('{s}', err.s) : t('va.bad');
      });
    });
    setTimeout(function () { inp.focus(); }, 30);
    return f;
  }
  function prompt() {
    if (!on() || key) return Promise.resolve(true);
    return new Promise(function (ok, fail) {
      var dlg = el('dialog', 'vault-dlg');
      var close = function (v) { dlg.close(); dlg.remove(); if (v) ok(true); else fail({ code: 'cancel' }); };
      dlg.appendChild(form(function () { close(true); }, function () { close(false); }));
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(false); });
      document.body.appendChild(dlg);
      dlg.showModal();
    });
  }
  // Спросить пароль (например, от зашифрованной резервной копии). Ничего не проверяет и не сохраняет.
  function askPassword(title, lead) {
    return new Promise(function (ok, fail) {
      var dlg = el('dialog', 'vault-dlg'), f = el('form', 'vault-form');
      var ic = el('span', 'vault-ico'); ic.innerHTML = lockIcon(); f.appendChild(ic);
      f.appendChild(el('h2', 'vault-title', title));
      if (lead) f.appendChild(el('p', 'vault-lead', lead));
      var inp = el('input', 'input'); inp.type = 'password'; inp.autocomplete = 'off'; inp.placeholder = t('va.password'); inp.setAttribute('aria-label', t('va.password'));
      f.appendChild(inp);
      var row = el('div', 'vault-row');
      var go = el('button', 'btn btn-primary', t('va.ok')); go.type = 'submit';
      var no = el('button', 'btn btn-ghost', t('va.cancel')); no.type = 'button';
      row.appendChild(go); row.appendChild(no); f.appendChild(row);
      var done = function (v) { dlg.close(); dlg.remove(); if (v) ok(v); else fail({ code: 'cancel' }); };
      f.addEventListener('submit', function (e) { e.preventDefault(); if (inp.value) done(inp.value); });
      no.addEventListener('click', function () { done(null); });
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); done(null); });
      dlg.appendChild(f); document.body.appendChild(dlg); dlg.showModal();
      setTimeout(function () { inp.focus(); }, 30);
    });
  }
  function gate(container) {
    container.textContent = '';
    var box = el('section', 'vault-gate');
    box.appendChild(form(function () { location.reload(); }));
    container.appendChild(box);
  }

  /* ---------- Кнопка-замок в шапке ---------- */
  function headButton() {
    var host = document.querySelector('.head-in');
    var old = document.getElementById('vault-btn');
    if (!on()) { if (old) old.remove(); return; }
    if (!host) return;
    var b = old || el('button', 'vault-btn');
    b.id = 'vault-btn'; b.type = 'button';
    b.innerHTML = key ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 7.6-1.8"/></svg>' : lockIcon();
    b.classList.toggle('is-open', !!key);
    var label = key ? t('va.lockNow') : t('va.unlock');
    b.setAttribute('aria-label', label); b.title = label;
    if (!old) {
      b.addEventListener('click', function () {
        if (key) { lock(); setTimeout(function () { location.reload(); }, 150); }
        else prompt().then(function () { location.reload(); }, function () { /* отмена */ });
      });
      var theme = host.querySelector('.theme-btn');
      if (theme) theme.parentNode.insertBefore(b, theme); else host.appendChild(b);
    }
  }
  ready.then(headButton);
  document.addEventListener('docum:vault', headButton);
  document.addEventListener('docum:lang', headButton);

  root.DocumVault = {
    ready: ready, on: on, open: function () { return !!key; }, locked: function () { return on() && !key; },
    enable: enable, change: change, disable: disable, unlock: unlock, lock: lock, prompt: prompt, gate: gate,
    getItem: getItem, setItem: setItem, removeItem: removeItem, sealRec: sealRec, openRec: openRec,
    log: log, readLog: readLog,
    // Резервная копия при включённой защите шифруется ключом сеанса; расшифровать её можно тем же паролем.
    sealBackup: function (value) { if (!key) return Promise.reject({ code: 'locked' }); return enc(key, value).then(function (box) { box.salt = cfg.salt; box.iter = cfg.iter; return box; }); },
    ask: askPassword,
    // Для резервной копии: зашифровать и расшифровать паролем (с отдельной солью).
    seal: function (pw, value) { var salt = rnd(16); return derive(pw, salt, ITER).then(function (k) { return enc(k, value); }).then(function (box) { box.salt = b64(salt); box.iter = ITER; return box; }); },
    unseal: function (pw, box) { return derive(pw, unb64(box.salt), box.iter || ITER).then(function (k) { return dec(k, box); }); },
    strength: function (pw) {
      var s = 0;
      if (pw.length >= 8) s++; if (pw.length >= 12) s++; if (pw.length >= 16) s++;
      if (/[a-zа-яәіңғүұқөһ]/.test(pw) && /[A-ZА-ЯӘІҢҒҮҰҚӨҺ]/.test(pw)) s++;
      if (/\d/.test(pw)) s++; if (/[^\wа-яәіңғүұқөһА-ЯӘІҢҒҮҰҚӨҺ]/.test(pw)) s++;
      if (/^(.)\1+$/.test(pw) || /^(1234|qwer|пароль|password)/i.test(pw)) s = 0;
      return Math.min(4, Math.floor(s * 4 / 6));
    }
  };
})(window);
