/* docum.kz — страница «Проверка ЭЦП».
   Принимает PDF с подписями внутри (PAdES), файл .cms/.p7s с документом внутри или открепленную подпись вместе с исходным файлом.
   Для каждой подписи: кто подписал (из сертификата), целостность документа, математика подписи (RSA или ГОСТ),
   цепочка сертификатов до корневого центра НУЦ РК, срок действия на момент подписи, назначение ключа,
   отзыв в НУЦ (OCSP, с проверкой подписи ответа) и метка времени (подпись службы и её цепочка).
   Файл не покидает браузер: в НУЦ уходит только OCSP-запрос (хэши издателя и серийный номер). Ничего не сохраняется. */
(function () {
  'use strict';
  var E = window.DocumEcp, P = window.DocumPki, PA = window.DocumPades;
  var app = document.getElementById('verify-app');
  if (!app || !E || !P || !PA || !window.DocumGost) return;
  var t = window.t;
  var f = function (k, o) { var s = t(k); Object.keys(o || {}).forEach(function (x) { s = s.split('{' + x + '}').join(o[x]); }); return s; };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function fdate(ms) { if (!ms) return '—'; var d = new Date(ms); return two(d.getDate()) + '.' + two(d.getMonth() + 1) + '.' + d.getFullYear(); }
  function fmt(ms) { if (!ms) return '—'; var d = new Date(ms); return fdate(ms) + ' ' + two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds()); }

  var MAX = 30 * 1024 * 1024;
  var input = document.getElementById('vf-file'), origIn = document.getElementById('vf-orig');
  var zone = app.querySelector('.vf-zone'), origBox = app.querySelector('.vf-orig');
  var msg = app.querySelector('.vf-pick .msg'), out = app.querySelector('.vf-results');
  var cur = null;        // { name, kind: 'pdf' | 'cms', items: [результаты], pending: CMS без документа }
  var urls = [];         // ссылки blob: для скачивания — освобождаются при новой проверке

  function say(k, bad) { msg.textContent = k ? t(k) : ''; msg.className = 'msg' + (bad ? ' msg-error' : ''); }
  function readFile(file) {
    if (file.size > MAX) return Promise.reject(new Error('big'));
    return file.arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  // Подпись .cms бывает в DER или текстом Base64 (в том числе с заголовками PEM).
  function toDer(u8) {
    if (u8[0] === 0x30) return u8;
    var s = new TextDecoder().decode(u8).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/=]+$/.test(s)) throw new Error('fmt');
    var d = E.unb64(s);
    if (d[0] !== 0x30) throw new Error('fmt');
    return d;
  }

  /* ---------- Проверка одной подписи ---------- */
  function safe(fn, dflt) { try { return fn(); } catch (e) { return dflt; } }
  function analyze(src) {
    var p = E.parse(src.cms);
    if (!p.content && src.content) p.content = src.content;
    var o = { p: p, info: p.info || {}, pdf: src.pdf || null, content: p.content, detached: !!src.detached };
    return E.verify(p).then(function (res) {
      o.res = res;
      // Метку времени проверяем полностью, только если она относится к этой подписи.
      return p.tsp && res.tsp === 'ok' ? P.tspCheck(p.tsp).catch(function () { return { sig: 'skip' }; }) : null;
    }).then(function (tc) {
      o.tspc = tc;
      o.tspOk = !!(p.tsp && o.res.tsp === 'ok' && tc && tc.sig === 'ok' && tc.chain === 'ok');
      // Момент подписи: по проверенной метке времени НУЦ, иначе по часам компьютера подписанта, иначе — сейчас.
      o.atSrc = o.tspOk ? 'tsp' : p.attrs.time ? 'clock' : 'now';
      o.at = o.tspOk ? p.tsp.time : p.attrs.time || Date.now();
      var inf = o.info;
      o.valid = inf.notBefore && inf.notAfter ? o.at >= inf.notBefore && o.at <= inf.notAfter : null;
      o.use = p.signerDer ? safe(function () { return P.purpose(p.signerDer); }, null) : null;
      var ch = p.signerDer ? P.chain(p.signerDer, p.certs, o.at) : Promise.resolve({ status: 'incomplete', path: [] });
      var oc = E.ocsp(inf, true).then(function (r) {
        return P.ocspCheck(r).catch(function () { return { sig: 'skip' }; }).then(function (c) { r.check = c; delete r.sig; return r; });
      });
      return Promise.all([ch.catch(function () { return { status: 'incomplete', path: [] }; }), oc]);
    }).then(function (r) {
      o.chain = r[0]; o.ocsp = r[1];
      o.verdict = verdict(o);
      return o;
    });
  }
  // Отзыв после проверенной метки времени подпись не портит: в момент подписи сертификат действовал.
  function revokedAfter(o) { return o.ocsp.status === 'revoked' && o.tspOk && o.ocsp.revokedAt && o.at < o.ocsp.revokedAt; }
  function verdict(o) {
    var r = o.res, oc = o.ocsp;
    if (!o.content || r.digest === 'fail' || r.crypto === 'fail' || o.chain.status === 'broken' || o.valid === false ||
      (oc.status === 'revoked' && !revokedAfter(o)) || r.tsp === 'fail' || (o.tspc && o.tspc.sig === 'fail')) return 'bad';
    var ocOk = (oc.status === 'good' && oc.check && oc.check.sig === 'ok') || revokedAfter(o);
    if (r.digest === 'ok' && r.crypto === 'ok' && o.chain.status === 'ok' && o.valid === true && ocOk && !(o.use && o.use.auth)) return 'ok';
    return 'warn';
  }

  /* ---------- Загрузка файлов ---------- */
  function reset() {
    urls.forEach(function (u) { URL.revokeObjectURL(u); }); urls = [];
    out.textContent = ''; origBox.hidden = true; cur = null;
  }
  function run(name, kind, sources) {
    say('vf.checking');
    out.setAttribute('aria-busy', 'true');
    var items = [], i = 0;
    // По очереди: так НУЦ получает не больше одного запроса за раз.
    function next() {
      if (i >= sources.length) return Promise.resolve();
      var s = sources[i++];
      return analyze(s).then(function (o) { items.push(o); }, function () { items.push({ error: true }); }).then(next);
    }
    return next().then(function () {
      cur = { name: name, kind: kind, items: items };
      out.removeAttribute('aria-busy');
      say('');
      render();
      var h = out.querySelector('h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); h.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  }
  function openMain(file) {
    reset();
    if (!file) return;
    readFile(file).then(function (u8) {
      if (PA.isPdf(u8)) {
        var list = PA.read(u8);
        if (!list.length) { say('vf.noSig', true); return; }
        return run(file.name, 'pdf', list.map(function (s, n) {
          return { cms: s.cms, content: s.signed, pdf: { n: n + 1, of: list.length, whole: s.whole, rev: u8.subarray(0, s.range[2] + s.range[3]), size: u8.length } };
        }));
      }
      var der = toDer(u8), p = E.parse(der);
      if (!p.content) {
        // Открепленная подпись: ждём исходный файл.
        cur = { name: file.name, kind: 'cms', pending: der };
        origBox.hidden = false; origIn.value = '';
        say('');
        return;
      }
      return run(file.name, 'cms', [{ cms: der }]);
    }).catch(function (e) { say(e && e.message === 'big' ? 'vf.big' : 'vf.badFile', true); });
  }
  input.addEventListener('change', function () { openMain(input.files[0]); });
  origIn.addEventListener('change', function () {
    var file = origIn.files[0];
    if (!file || !cur || !cur.pending) return;
    var der = cur.pending, name = cur.name;
    readFile(file).then(function (u8) {
      out.textContent = '';
      return run(name, 'cms', [{ cms: der, content: u8, detached: true }]).then(function () { cur.pending = der; });
    }).catch(function (e) { say(e && e.message === 'big' ? 'vf.big' : 'vf.badFile', true); });
  });
  // Перетаскивание файла на область выбора.
  ['dragenter', 'dragover'].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add('is-over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { zone.addEventListener(ev, function () { zone.classList.remove('is-over'); }); });
  zone.addEventListener('drop', function (e) { e.preventDefault(); var fl = e.dataTransfer && e.dataTransfer.files[0]; if (fl) openMain(fl); });

  /* ---------- Вывод ---------- */
  function fullName(s) { return [s.cn, s.given].filter(Boolean).join(' '); }
  function useText(o) {
    if (!o.use) return '';
    if (o.use.sign) return t('vf.useSign');
    if (o.use.auth) return t('vf.useAuth');
    return t('vf.useOther');
  }
  function ext(u8) {
    if (PA.isPdf(u8)) return ['pdf', 'application/pdf'];
    if (u8[0] === 0x50 && u8[1] === 0x4b) return ['zip', 'application/zip'];
    try { new TextDecoder('utf-8', { fatal: true }).decode(u8.subarray(0, 4096)); return ['txt', 'text/plain;charset=utf-8']; } catch (e) { return ['bin', 'application/octet-stream']; }
  }
  function dl(box, cls, label, sub, bytes, type, name) {
    var u = URL.createObjectURL(new Blob([bytes], { type: type })); urls.push(u);
    var a = el('a', 'btn ' + cls); a.href = u; a.download = name;
    a.appendChild(el('b', null, label)); if (sub) a.appendChild(el('small', null, sub));
    box.appendChild(a);
  }
  function base() { return (cur.name || 'document').replace(/\.[^.]+$/, '').replace(/[^\wА-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі.-]+/g, '_').slice(0, 60); }

  function card(o, idx) {
    var c = el('article', 'ecp-card vf-card is-' + (o.error ? 'bad' : o.verdict));
    var head = el('div', 'vf-head');
    head.appendChild(el('span', 'vf-ic', o.error || o.verdict === 'bad' ? '!' : o.verdict === 'ok' ? '✓' : 'i'));
    var ht = el('div');
    ht.appendChild(el('b', null, o.error ? t('vf.err') : t('vf.' + o.verdict)));
    if (cur.items.length > 1) ht.appendChild(el('small', null, f('vf.nOf', { n: idx + 1, m: cur.items.length })));
    head.appendChild(ht);
    c.appendChild(head);
    if (o.error) { c.appendChild(el('p', 'jr-note', t('vf.errSub'))); return c; }

    var s = o.info.subject || {}, inf = o.info, p = o.p;
    var top = el('div', 'ecp-top');
    top.appendChild(el('span', 'ecp-av', (s.cn || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('')));
    var nm = el('div');
    nm.appendChild(el('b', null, fullName(s) || '—'));
    nm.appendChild(el('p', 'jr-meta', (cur.kind === 'pdf' ? 'PAdES' : o.detached ? 'CAdES (detached)' : 'CAdES') + (s.org ? ' · ' + s.org : '')));
    top.appendChild(nm);
    c.appendChild(top);

    var d = el('dl', 'ecp-dl');
    var row = function (k, v) { if (!v) return; d.appendChild(el('dt', null, t(k))); d.appendChild(el('dd', null, v)); };
    row('ec.iin', inf.iin); row('vf.org', s.org); row('ec.bin', inf.bin);
    row('vf.serial', (inf.serial || '').replace(/^00(?=[89a-f])/i, '').toUpperCase());   // без ведущего нуля знака DER
    row('ec.issuer', (inf.issuer || {}).cn);
    row('ec.valid', fdate(inf.notBefore) + ' — ' + fdate(inf.notAfter));
    row('vf.use', useText(o));
    row('ec.alg', E.alg(p.sigAlg).n + ' / ' + E.alg(p.digestAlg).n);
    row('ec.time', o.atSrc === 'tsp' ? fmt(o.at) + ' · ' + t('ec.byTsp') + (p.tsp.tsa ? ' (' + p.tsp.tsa + ')' : '') :
      o.atSrc === 'clock' ? fmt(o.at) + ' · ' + t('ec.byClock') : t('vf.noTime'));
    c.appendChild(d);

    var ul = el('ul', 'ecp-checks');
    var ck = function (st, text) { var li = el('li', 'is-' + st); li.appendChild(el('span', null, text)); ul.appendChild(li); return li; };
    var r = o.res;
    // 1. Документ не изменён.
    if (!o.content) ck('fail', t('vf.noContent'));
    else ck(r.digest === 'ok' ? 'ok' : r.digest === 'fail' ? 'fail' : 'skip', t(r.digest === 'ok' ? 'vf.digOk' : r.digest === 'fail' ? 'vf.digBad' : 'vf.digSkip'));
    if (o.pdf) ck(o.pdf.whole ? 'ok' : 'skip', t(o.pdf.whole ? 'vf.pdfWhole' : 'vf.pdfIncr'));
    // 2. Математика подписи.
    var an = r.gost ? 'ГОСТ' : 'RSA';
    ck(r.crypto === 'ok' ? 'ok' : r.crypto === 'fail' ? 'fail' : 'skip', r.crypto === 'ok' ? f('vf.cryOk', { a: an }) : r.crypto === 'fail' ? f('vf.cryBad', { a: an }) : t('vf.crySkip'));
    // 3. Цепочка доверия.
    var chs = o.chain.status, li = ck(chs === 'ok' ? 'ok' : chs === 'broken' ? 'fail' : 'skip',
      chs === 'ok' ? t('vf.chOk') : chs === 'untrusted' ? f('vf.chUntrusted', { r: o.chain.issuer || '?' }) : chs === 'broken' ? t('vf.chBroken') : chs === 'unsupported' ? t('vf.chUnsup') : f('vf.chIncomplete', { r: o.chain.issuer || (inf.issuer || {}).cn || '?' }));
    if (o.chain.path && o.chain.path.length > 1) {
      var ol = el('ol', 'vf-path');
      o.chain.path.forEach(function (x, k) {
        var item = el('li', x.valid ? null : 'is-off', x.cn + ' · ' + fdate(x.from) + ' — ' + fdate(x.to));
        if (k === o.chain.path.length - 1 && chs === 'ok') item.appendChild(el('span', 'vf-root', t('vf.root')));
        ol.appendChild(item);
      });
      li.appendChild(ol);
    }
    // 4. Срок действия на момент подписи.
    ck(o.valid === true ? 'ok' : o.valid === false ? 'fail' : 'skip', o.valid === true ? t(o.atSrc === 'now' ? 'vf.timeNow' : 'vf.timeOk') : o.valid === false ? t('vf.timeBad') : t('ec.certSkip'));
    if (o.chain.path && o.chain.path.length > 1 && o.chain.allValid === false && o.valid !== false) ck('skip', t('vf.chainTime'));
    // 5. Назначение ключа.
    if (o.use) ck(o.use.sign ? 'ok' : 'skip', o.use.sign ? t('vf.useOk') : o.use.auth ? t('vf.useAuthW') : t('vf.useOtherW'));
    // 6. Отзыв в НУЦ.
    var oc = o.ocsp, sigNote = oc.check && oc.check.sig === 'ok' ? ' ' + f('vf.ocSig', { r: oc.check.responder || 'OCSP' }) : '';
    if (oc.status === 'good') ck(oc.check && oc.check.sig === 'fail' ? 'fail' : 'ok', oc.check && oc.check.sig === 'fail' ? t('vf.ocSigBad') : f('ec.ocspGood', { d: fmt(oc.at) }) + '.' + sigNote);
    else if (oc.status === 'revoked') ck(revokedAfter(o) ? 'ok' : 'fail', revokedAfter(o) ? f('ec.ocspRevAfter', { d: fdate(oc.revokedAt) }) : f('ec.ocspRev', { d: oc.revokedAt ? fdate(oc.revokedAt) : '?' }));
    else if (oc.status === 'unknown') ck('skip', t('ec.ocspUnknown'));
    else if (oc.status === 'notNuc') ck('skip', t('ec.ocspNotNuc'));
    else ck('skip', t('ec.ocspErr'));
    // 7. Метка времени.
    if (!p.tsp) ck('skip', t('vf.tsNone'));
    else if (r.tsp === 'fail' || (o.tspc && o.tspc.sig === 'fail')) ck('fail', t('ec.tspBad'));
    else if (o.tspOk) ck('ok', f('vf.tsOk', { d: fmt(p.tsp.time) }));
    else ck('skip', f('vf.tsPart', { d: fmt(p.tsp.time) }));
    c.appendChild(ul);

    // Содержимое и сертификат: ст. 50 п. 4 — средство проверки извлекает содержимое и показывает данные владельца.
    var acts = el('div', 'ecp-dls'), b = base();
    if (o.pdf && !o.pdf.whole) dl(acts, 'btn-primary', t('vf.dlRev'), t('vf.dlRevSub'), o.pdf.rev, 'application/pdf', b + '-signed-rev' + o.pdf.n + '.pdf');
    else if (!o.pdf && o.content && !o.detached) { var x = ext(o.content); dl(acts, 'btn-primary', t('vf.dlContent'), f('vf.dlContentSub', { e: x[0].toUpperCase() }), o.content, x[1], b + '-content.' + x[0]); }
    if (p.signerDer) dl(acts, 'btn-ghost', t('vf.dlCert'), t('vf.dlCertSub'), p.signerDer, 'application/pkix-cert', b + '-cert' + (idx + 1) + '.cer');
    if (acts.childNodes.length) c.appendChild(acts);
    return c;
  }

  function render() {
    urls.forEach(function (u) { URL.revokeObjectURL(u); }); urls = [];
    out.textContent = '';
    if (!cur || !cur.items) return;
    var box = el('section', 'sh-box vf-res');
    box.appendChild(el('h2', 'panel-title', t('vf.resH')));
    var cnt = { ok: 0, warn: 0, bad: 0 };
    cur.items.forEach(function (o) { cnt[o.error ? 'bad' : o.verdict]++; });
    box.appendChild(el('p', 'lead-s', f('vf.summary', { f: cur.name, n: cur.items.length }) + (cnt.bad ? ' ' + f('vf.sumBad', { n: cnt.bad }) : '')));
    cur.items.forEach(function (o, i) { box.appendChild(card(o, i)); });
    box.appendChild(el('p', 'jr-note', f('vf.checkedAt', { d: fmt(Date.now()) })));
    out.appendChild(box);
  }
  document.addEventListener('docum:lang', render);
})();
