/* docum.kz — согласование документа ЭЦП по ссылке.
   Обе стороны подписывают один и тот же PDF: отправитель — до того, как получит ссылку, вторая сторона — поверх его подписи
   (PAdES, две подписи в одном файле). Каждую подпись сайт проверяет: документ не изменён, подпись сходится, сертификат
   действует и не отозван, ИИН или БИН в ключе — тот, что указан в документе. Без ЭЦП ссылку на подпись не получить.
   Всё считается в браузере. В ссылке — данные анкеты и подписи, на сервер они не уходят; в НУЦ для проверки отзыва
   отправляются только номер сертификата и хэши. */
(function (root) {
  'use strict';
  var E = root.DocumEcp, PA = root.DocumPades, EX = root.DocumExport, ST = root.DocumStore, TPL = root.DocumTemplates;
  var RESERVE = 32768;   // место под подпись с меткой времени НУЦ
  var t = function (k) { return root.t ? root.t(k) : k; };
  var f = function (k, o) { var s = t(k); Object.keys(o || {}).forEach(function (x) { s = s.split('{' + x + '}').join(o[x]); }); return s; };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function sha(u8) { return crypto.subtle.digest('SHA-256', u8).then(function (h) { return E.hex(new Uint8Array(h)); }); }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function fmt(ms) { var d = new Date(ms), p = function (n) { return ('0' + n).slice(-2); }; return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

  /* ---------- Файл и подписи ---------- */
  // PDF отправителя: версия и штамп ЭЦП, дата файла — дата версии. Так же собирает его вкладка ЭЦП в «Моих документах».
  function first(blocks, stamp, at, reserve) {
    return EX.pdfBytes(stamp ? blocks.concat([stamp]) : blocks, at).then(function (pdf) { return PA.prepare(pdf, at, reserve || RESERVE); });
  }
  // Тот же PDF с подписью отправителя и местом под подпись второй стороны.
  function second(prep1, cms1, at2, reserve) {
    return Promise.resolve().then(function () { return PA.prepare(PA.embed(prep1, E.unb64(cms1)), at2, reserve || RESERVE); });
  }

  // Проверка подписи над известными байтами файла. ok — подпись можно принять.
  function check(cmsB64, content) {
    var p;
    try { p = E.parse(E.unb64(cmsB64)); } catch (e) { return Promise.reject({ code: 'parse' }); }
    p.content = content;
    return Promise.all([E.verify(p), E.ocsp(p.info)]).then(function (r) {
      var res = r[0], inf = p.info, subj = inf.subject || {}, o = r[1];
      var t0 = (p.tsp && p.tsp.time) || p.attrs.time || Date.now();
      var x = {
        cms: cmsB64, cn: subj.cn || '', given: subj.given || '', org: subj.org || '', iin: inf.iin || '', bin: inf.bin || '',
        issuer: (inf.issuer || {}).cn || '', from: inf.notBefore, to: inf.notAfter, serial: inf.serial || '',
        time: p.attrs.time || null, tsp: p.tsp ? { time: p.tsp.time, tsa: p.tsp.tsa, check: res.tsp } : null, ocsp: o,
        alg: E.alg(p.sigAlg).n + ' / ' + E.alg(p.digestAlg).n, digest: res.digest, crypto: res.crypto, gost: res.gost,
        valid: inf.notBefore && inf.notAfter ? (t0 >= inf.notBefore && t0 <= inf.notAfter) : null
      };
      var revoked = o && o.status === 'revoked' && !(x.tsp && x.tsp.time && o.revokedAt && x.tsp.time < o.revokedAt);
      x.ok = x.digest === 'ok' && x.crypto !== 'fail' && x.valid !== false && !revoked && !(o && o.status === 'unknown') && !(x.tsp && x.tsp.check === 'fail');
      return x;
    });
  }

  /* ---------- Кто должен подписать ---------- */
  // ИИН или БИН второй стороны из документа: контрагент, работник или представитель.
  function expected(data) {
    data = data || {};
    return digits(data.cp_bin) || digits(data.w_iin) || digits(data.rep_iin);
  }
  function owns(x, id) { return !!id && (digits(x.iin) === id || digits(x.bin) === id); }
  function upName(s) { return String(s || '').toUpperCase().replace(/Ё/g, 'Е').replace(/\s+/g, ' ').trim(); }
  function sameName(x, fio) { return !!upName(fio) && upName([x.cn, x.given].filter(Boolean).join(' ')) === upName(fio); }
  // Подписал ли тот, кто указан в документе: true, false или null (в документе нет ни ИИН, ни ФИО).
  function matchSender(x, data) {
    data = data || {};
    if (digits(data.ip_iin)) return digits(x.iin) === digits(data.ip_iin);
    return data.ip_fio ? sameName(x, data.ip_fio) : null;
  }
  function matchOther(x, data) {
    data = data || {};
    var id = expected(data);
    if (id) return owns(x, id);
    return data.w_fio ? sameName(x, data.w_fio) : null;
  }
  // Короткая метка подписи отправителя: по ней журнал находит, поверх какой подписи подписала вторая сторона.
  function tag(cms) { return String(cms || '').slice(-80); }

  // Реквизиты второй стороны, которые отправитель оставил пустыми или заполнил с ошибкой.
  function missing(code, data) {
    var L = root.DocumLogic, out = [];
    TPL.DOCS[code].steps.forEach(function (s) {
      s.fields.forEach(function (id) {
        var def = TPL.FIELDS[id];
        if (!def || !def.later) return;
        var r = L.checkField(def, id, data[id], data, code, true);
        if (r && r.type === 'error') out.push(id);
      });
    });
    return out;
  }
  // Поля, которые вторая сторона заполняет по ссылке «Запросить реквизиты».
  function partyFields(code) {
    var out = [];
    TPL.DOCS[code].steps.forEach(function (s) {
      s.fields.forEach(function (id) { var d = TPL.FIELDS[id]; if (d && (d.later || ((id === 'cp_rep' || id === 'cp_contact') && d.type !== 'check'))) out.push(id); });
    });
    return out;
  }

  /* ---------- Карточка подписи ---------- */
  function card(x, role, opt) {
    opt = opt || {};
    var c = el('article', 'ecp-card ag-card' + (x.ok && opt.who !== false ? '' : ' is-bad'));
    var top = el('div', 'ecp-top');
    top.appendChild(el('span', 'ecp-av', (x.cn || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('')));
    var nm = el('div');
    nm.appendChild(el('b', null, [x.cn, x.given].filter(Boolean).join(' ')));
    nm.appendChild(el('p', 'jr-meta', role + (x.org ? ' · ' + x.org : '')));
    top.appendChild(nm);
    c.appendChild(top);
    var dl = el('dl', 'ecp-dl');
    var row = function (k, v) { if (!v) return; dl.appendChild(el('dt', null, t(k))); dl.appendChild(el('dd', null, v)); };
    row('ec.iin', x.iin); row('ec.bin', x.bin); row('ec.issuer', x.issuer);
    if (x.tsp && x.tsp.time) row('ec.time', fmt(x.tsp.time) + ' · ' + t('ec.byTsp'));
    else row('ec.time', x.time ? fmt(x.time) + ' · ' + t('ec.byClock') : '');
    c.appendChild(dl);
    var ul = el('ul', 'ecp-checks');
    var ck = function (st, text) { var li = el('li', 'is-' + st); li.appendChild(el('span', null, text)); ul.appendChild(li); };
    if (opt.doc != null) ck(opt.doc ? 'ok' : 'fail', t(opt.doc ? 'ag.docOk' : 'ag.docBad'));
    ck(x.digest === 'ok' ? 'ok' : 'fail', t(x.digest === 'ok' ? 'ag.digOk' : 'ag.digBad'));
    ck(x.crypto === 'ok' ? 'ok' : x.crypto === 'fail' ? 'fail' : 'skip', t(x.crypto === 'ok' ? 'ec.cryOk' : x.crypto === 'fail' ? 'ec.cryBad' : 'ag.crySkip'));
    ck(x.valid === true ? 'ok' : x.valid === false ? 'fail' : 'skip', t(x.valid === true ? 'ec.certOk' : x.valid === false ? 'ec.certBad' : 'ec.certSkip'));
    var o = x.ocsp;
    if (!o || o.status === 'error' || o.status === 'notNuc') ck('skip', t(o && o.status === 'notNuc' ? 'ec.ocspNotNuc' : 'ec.ocspErr'));
    else if (o.status === 'good') ck('ok', f('ec.ocspGood', { d: fmt(o.at) }));
    else if (o.status === 'unknown') ck('fail', t('ec.ocspUnknown'));
    else ck(x.ok ? 'ok' : 'fail', t(x.ok ? 'ec.ocspRevAfter' : 'ec.ocspRev').replace('{d}', o.revokedAt ? fmt(o.revokedAt).slice(0, 10) : '?'));
    if (opt.who === true) ck('ok', t('ag.whoOk'));
    else if (opt.who === false) ck('fail', f('ag.whoBad', { a: [x.iin, x.bin].filter(Boolean).join(' / ') || '—', b: opt.id || '—' }));
    else if (opt.who === null) ck('skip', t('ag.whoSkip'));
    c.appendChild(ul);
    return c;
  }

  // Ошибки NCALayer человеческим языком.
  function errText(e) {
    var c = e && e.code;
    return c === 'noLayer' ? t('ec.none') : c === 'cancel' ? t('ec.cancel') : c === 'timeout' ? t('ec.timeout') : f('ec.err', { m: (e && e.message) || '' });
  }

  /* ---------- Ответ второй стороны → журнал отправителя ---------- */
  // fill — реквизиты (новая версия без подписи), change — предложение правок, sign — подпись ЭЦП поверх подписи отправителя.
  function importResponse(p) {
    if (!p || p.t !== 'r' || p.v !== 2) return Promise.reject({ code: 'old' });
    return ST.get(p.id).then(function (rec) {
      if (!rec) throw { code: 'norec' };
      if (p.mode === 'fill') {
        var prev = rec.versions[rec.versions.length - 1];
        // Из ответа берутся только поля второй стороны: остальной текст договора она поменять не может.
        var data = Object.assign({}, prev.data || {});
        partyFields(rec.code).forEach(function (id) { if (p.data && p.data[id] != null) data[id] = String(p.data[id]).slice(0, 300); });
        var blocks = TPL.build(rec.code, data, prev.lang || rec.lang);
        return ST.hash(ST.text(blocks)).then(function (h) {
          var same = rec.versions.filter(function (v) { return v.hash === h; })[0];
          if (!same) rec.versions.push({ n: rec.versions.length + 1, at: p.at, blocks: blocks, data: data, lang: prev.lang || rec.lang, hash: h, note: t('ag.filledNote'), byOther: true });
          rec.status = 'final';
          return ST.put(rec).then(function () { return { rec: rec, kind: 'fill' }; });
        });
      }
      if (p.mode === 'change') {
        rec.changes = rec.changes || [];
        if (!rec.changes.some(function (c) { return c.at === p.at; })) rec.changes.push({ at: p.at, n: p.n, text: String(p.text || '').slice(0, 4000) });
        return ST.put(rec).then(function () { return { rec: rec, kind: 'change' }; });
      }
      if (p.mode !== 'sign') throw { code: 'bad' };
      var v = rec.versions[p.n - 1];
      var bi = (rec.ecp || []).map(function (r) { return r.who === 'self' ? tag(r.cms) : null; }).indexOf(p.base);
      if (!v || bi < 0) throw { code: 'nobase' };
      var base = rec.ecp[bi];
      if (rec.ecp.some(function (r) { return r.cms === p.cms; })) return { rec: rec, kind: 'dup' };
      return first(v.blocks, base.stamp, v.at, base.reserve)
        .then(function (prep1) { return second(prep1, base.cms, p.at, p.reserve); })
        .then(function (prep2) { return Promise.all([check(p.cms, prep2.toSign), sha(prep2.toSign)]); })
        .then(function (r) {
          var x = r[0];
          x.who = 'other'; x.kind = 'pades2'; x.base = bi; x.at2 = p.at; x.reserve = p.reserve || RESERVE; x.n = v.n; x.at = Date.now(); x.contentHash = r[1];
          x.match = matchOther(x, v.data);
          rec.ecp = rec.ecp || []; rec.ecp.push(x);
          if (x.ok && x.match !== false) rec.status = 'signed';
          return ST.put(rec).then(function () { return { rec: rec, kind: 'sign', sig: x }; });
        });
    });
  }

  // PDF с обеими подписями из журнала.
  function signedPdf(rec, r) {
    var v = rec.versions[r.n - 1], base = rec.ecp[r.base];
    return first(v.blocks, base.stamp, v.at, base.reserve)
      .then(function (prep1) { return second(prep1, base.cms, r.at2, r.reserve); })
      .then(function (prep2) { return PA.embed(prep2, E.unb64(r.cms)); });
  }

  root.DocumAgree = { RESERVE: RESERVE, first: first, second: second, check: check, expected: expected, owns: owns, missing: missing,
    partyFields: partyFields, matchSender: matchSender, matchOther: matchOther, tag: tag, card: card, errText: errText, importResponse: importResponse, signedPdf: signedPdf, sha: sha };
})(window);
