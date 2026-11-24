/* docum.kz — реквизиты юрлица по БИН из открытых данных (data.egov.kz, через /api/bin).
   На сервер уходит только БИН организации. ИИН человека (пятая цифра 0–3) не отправляется никогда. */
(function (root) {
  'use strict';
  var onP = null, cache = {};
  function isBin(s) { return /^\d{12}$/.test(s) && /[456]/.test(s[4]); }
  function available() {
    if (!onP) onP = location.protocol === 'file:' ? Promise.resolve(false)
      : fetch('/api/bin?op=info').then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) { return !!j.on; }, function () { return false; });
    return onP;
  }
  function lookup(bin) {
    if (!isBin(bin)) return Promise.reject({ code: 'bin' });
    if (cache[bin]) return Promise.resolve(cache[bin]);
    return fetch('/api/bin?bin=' + bin).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw { code: j.error || 'src' };
        cache[bin] = j; return j;
      });
    });
  }
  function pick(o, lang) { return (o && (o[lang === 'kk' ? 'kk' : 'ru'] || o.ru || o.kk)) || ''; }
  function bad(status) { return /ликвид|прекращ|исключ|тарат|жойыл/i.test(status || ''); }

  /* Небольшая кнопка-значок прямо в поле БИН: появляется, когда введён БИН юрлица.
     o.input — поле БИН, o.lang() — язык документа, o.set(id, value) — вписать значение, o.host — куда вывести сообщение. */
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/><path d="M8 10.5h5M10.5 8v5"/></svg>';
  function attach(o) {
    var t = root.t, inp = o.input;
    var wrap = document.createElement('div'); wrap.className = 'input-wrap';
    inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
    inp.classList.add('has-act');
    var b = document.createElement('button'); b.type = 'button'; b.className = 'field-act'; b.innerHTML = ICON;
    b.title = t('bn.fill'); b.setAttribute('aria-label', t('bn.fill')); b.hidden = true;
    wrap.appendChild(b);
    var m = document.createElement('p'); m.className = 'msg bin-msg'; m.setAttribute('role', 'status');
    o.host.appendChild(m);
    var sync = function () { b.hidden = !isBin(String(inp.value || '').trim()); if (b.hidden) m.textContent = ''; };
    sync();
    inp.addEventListener('input', sync);
    b.addEventListener('click', function () {
      var bin = String(inp.value || '').trim(), lang = o.lang();
      b.disabled = true; b.classList.add('is-busy'); m.className = 'msg bin-msg'; m.textContent = t('bn.wait');
      available().then(function (on) {
        if (!on) throw { code: 'off' };
        return lookup(bin);
      }).then(function (j) {
        var name = pick(j.name, lang), addr = pick(j.addr, lang), st = pick(j.status, lang);
        if (name) o.set('cp_name', name);
        if (addr) o.set('cp_addr', addr);
        m.className = bad(st) ? 'msg bin-msg msg-error' : 'msg bin-msg';
        m.textContent = (bad(st) ? t('bn.closed') + ' ' : t('bn.done') + ' ') + (st ? '(' + st + ')' : '');
      }, function (e) {
        var c = e && e.code;
        m.className = 'msg bin-msg' + (c === 'off' ? '' : ' msg-error');
        m.textContent = t(c === 'off' ? 'bn.off' : c === 'none' ? 'bn.none' : c === 'rate' ? 'bn.rate' : 'bn.err');
      }).then(function () { b.disabled = false; b.classList.remove('is-busy'); });
    });
    return wrap;
  }
  root.DocumBin = { isBin: isBin, available: available, lookup: lookup, attach: attach };
})(window);
