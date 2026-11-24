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

  /* Кнопка «Заполнить по БИН» под полем БИН.
     o.input — поле БИН, o.lang() — язык документа, o.set(id, value) — вписать значение, o.host — куда поставить кнопку. */
  function attach(o) {
    var t = root.t;
    var wrap = document.createElement('div'); wrap.className = 'bin-fill'; wrap.hidden = true;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-ghost'; b.textContent = t('bn.fill');
    var m = document.createElement('p'); m.className = 'msg'; m.setAttribute('role', 'status');
    wrap.appendChild(b); wrap.appendChild(m);
    o.host.appendChild(wrap);
    var on = false;
    var sync = function () { wrap.hidden = !(on && isBin(String(o.input.value || '').trim())); if (wrap.hidden) m.textContent = ''; };
    available().then(function (x) { on = x; sync(); });
    o.input.addEventListener('input', sync);
    b.addEventListener('click', function () {
      var bin = String(o.input.value || '').trim(), lang = o.lang();
      b.disabled = true; m.className = 'msg'; m.textContent = t('bn.wait');
      lookup(bin).then(function (j) {
        var name = pick(j.name, lang), addr = pick(j.addr, lang), st = pick(j.status, lang);
        if (name) o.set('cp_name', name);
        if (addr) o.set('cp_addr', addr);
        m.className = bad(st) ? 'msg msg-error' : 'msg';
        m.textContent = (bad(st) ? t('bn.closed') + ' ' : t('bn.done') + ' ') + (st ? '(' + st + ')' : '');
      }, function (e) {
        m.className = 'msg msg-error';
        m.textContent = t(e && e.code === 'none' ? 'bn.none' : e && e.code === 'rate' ? 'bn.rate' : 'bn.err');
      }).then(function () { b.disabled = false; });
    });
    return wrap;
  }
  root.DocumBin = { isBin: isBin, available: available, lookup: lookup, attach: attach };
})(window);
