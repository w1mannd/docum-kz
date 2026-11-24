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


  /* ---------- Отправка на подпись: общий блок для «Моих документов» и конструктора ---------- */
  var BX = root.DocumBox;
  function btn(cls, text, fn) { var b = el('button', cls, text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function flash(node, text, bad) { node.textContent = text; node.className = 'msg' + (bad ? ' msg-error' : ' msg-ok'); }
  function logEv(type, data) { if (root.DocumVault) root.DocumVault.log(type, data); }
  function last(rec) { return rec.versions[rec.versions.length - 1]; }
  function sigOk(r) {
    return !!r && r.digest === 'ok' && r.crypto !== 'fail' && r.valid !== false &&
      !(r.ocsp && (r.ocsp.status === 'unknown' || (r.ocsp.status === 'revoked' && !(r.tsp && r.tsp.time && r.ocsp.revokedAt && r.tsp.time < r.ocsp.revokedAt))));
  }
  // Подпись версии ЭЦП отправителя (PAdES со штампом, как во вкладке «ЭЦП»), проверка и запись в журнал.
  function signVersion(rec, v) {
    var stamp = E.stamp({ time: Date.now() }, v.lang || rec.lang), prep = null;
    return first(v.blocks, stamp, v.at, RESERVE).then(function (pp) {
      prep = pp;
      return E.sign(E.b64(prep.toSign), true);
    }).then(function (cms) {
      return Promise.all([check(cms, prep.toSign), sha(prep.toSign)]);
    }).then(function (r) {
      var x = r[0];
      x.who = 'self'; x.kind = 'pades'; x.n = v.n; x.at = Date.now(); x.stamp = stamp; x.reserve = RESERVE; x.contentHash = r[1];
      rec.ecp = rec.ecp || []; rec.ecp.push(x);
      logEv('signed', { id: rec.id, n: v.n, s: x.tsp ? 'tsp' : '' });
      return ST.put(rec).then(function () { return x; });
    });
  }
  // Ссылка: короткая через зашифрованный ящик (один ящик на документ), без сервера — длинная, как раньше.
  function deliver(rec, payload) {
    var alive = rec.box && !rec.box.closed && Date.now() - rec.box.at < 13 * 86400000;
    var viaBox = (alive ? BX.put(rec.box, payload).then(function () { return { url: BX.link(rec.box.id, rec.box.s), box: true, same: true }; }) : Promise.reject())
      .catch(function () {
        return BX.available().then(function (on) {
          if (!on) throw { code: 'nobox' };
          return BX.create(payload).then(function (b) { rec.box = { id: b.id, s: b.s, at: Date.now(), seen: [] }; return { url: b.url, box: true }; });
        });
      });
    return viaBox.catch(function () {
      return ST.encode(payload).then(function (code) { return { url: location.origin + '/share.html#' + code, box: false }; });
    });
  }
  // Готовая ссылка: пояснение, затем одна строка — ссылка и кнопки рядом с ней.
  function linkOut(out, res, rec) {
    out.textContent = '';
    var url = res.url;
    out.appendChild(el('p', 'jr-note', t(res.box ? (res.same ? 'bx.same' : 'bx.short') : 'bx.long')));
    var row = el('div', 'sh-linkrow');
    var field = res.box ? el('input', 'input sh-link') : el('textarea', 'input sh-link');
    field.readOnly = true; field.value = url; if (!res.box) field.rows = 3;
    field.addEventListener('focus', function () { field.select(); });
    if (res.box) row.appendChild(field); else out.appendChild(field);
    row.appendChild(btn('btn btn-primary', t('dm.copy'), function (e) {
      var b = e.currentTarget;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { b.textContent = t('dm.copied'); }, function () { field.select(); document.execCommand('copy'); b.textContent = t('dm.copied'); });
    }));
    if (navigator.share) row.appendChild(btn('btn btn-ghost', t('dm.shareBtn'), function () { navigator.share({ title: t('d.' + rec.code), url: url }).catch(function () {}); }));
    if (!res.box) {
      // Запасной путь для длинных ссылок: тот же запрос файлом, его открывают на странице share.html.
      row.appendChild(btn('btn btn-ghost', t('dm.file'), function () {
        var code = url.slice(url.indexOf('#') + 1);
        EX.saveBlob(new Blob([JSON.stringify({ app: 'docum.kz', kind: 'share', data: code })], { type: 'application/json' }), 'docum-' + rec.code + '-' + (rec.number || rec.id.slice(0, 6)) + '.docum.json');
      }));
    }
    out.appendChild(row);
  }
  // Блок «Отправить на подпись». opt.onSent(rec) — после создания ссылки.
  function sharePanel(rec, opt) {
    opt = opt || {};
    var v = last(rec), data = v.data || {}, fields = partyFields(rec.code);
    var miss = missing(rec.code, data), canFill = fields.length && !v.edited;
    var box = el('section', 'sh-box');
    box.appendChild(el('h2', 'panel-title', t('dm.shTitle')));
    box.appendChild(el('p', 'lead-s', t('dm.shLead')));
    var mode = miss.length && canFill ? 'fill' : 'sign';
    var step = function (n, title) { var h = el('h3', 'sh-step'); h.appendChild(el('span', 'sh-num', String(n))); h.appendChild(el('span', null, title)); return h; };
    box.appendChild(step(1, t('dm.step1')));
    var modes = el('div', 'sh-modes'), make = btn('btn btn-primary');
    var setMake = function () { make.textContent = t(mode === 'sign' ? 'dm.makeSign' : 'dm.make'); };
    [['sign', 'dm.mSign', 'dm.mSignD'], ['fill', 'dm.mFill', 'dm.mFillD']].forEach(function (m) {
      if (m[0] === 'fill' && !fields.length) return;
      var lab = el('label', 'sh-mode'); var r = el('input'); r.type = 'radio'; r.name = 'sh-mode'; r.value = m[0];
      r.checked = m[0] === mode; r.disabled = (m[0] === 'fill' && !canFill) || (m[0] === 'sign' && miss.length > 0);
      r.addEventListener('change', function () { mode = m[0]; setMake(); });
      var tx = el('span'); tx.appendChild(el('b', null, t(m[1]))); tx.appendChild(el('span', null, t(m[2])));
      lab.appendChild(r); lab.appendChild(tx); modes.appendChild(lab);
    });
    box.appendChild(modes);
    if (miss.length) box.appendChild(el('p', 'notice notice-warn', f('dm.needFill', { f: miss.map(function (id) { return t('f.' + id); }).join(', ') })));
    if (fields.length && !canFill) box.appendChild(el('p', 'jr-note', t('dm.noFill')));
    box.appendChild(step(2, t('dm.step2')));
    box.appendChild(el('p', 'notice notice-warn', t('dm.pdWarn')));
    var okL = el('label', 'check'); var ok = el('input'); ok.type = 'checkbox';
    okL.appendChild(ok); okL.appendChild(el('span', null, t('dm.pdOk'))); box.appendChild(okL);
    box.appendChild(step(3, t('dm.step3')));
    setMake();
    var out = el('div', 'sh-out'), msg = el('p', 'msg'); msg.setAttribute('role', 'status');
    box.appendChild(make); box.appendChild(msg);
    var inst = el('p', 'jr-note'); inst.appendChild(document.createTextNode(t('dm.ecpNeed') + ' '));
    var na = el('a', null, 'ncl.pki.gov.kz'); na.href = 'https://ncl.pki.gov.kz/'; na.target = '_blank'; na.rel = 'noopener'; inst.appendChild(na);
    box.appendChild(inst);
    box.appendChild(out);
    // Ссылка готова: кнопка создания и подсказка про NCALayer больше не нужны — остаётся статус и ссылка.
    function done() { make.hidden = true; inst.hidden = true; box.classList.add('sh-done'); }
    function sent(m, res, extra) {
      done();
      rec.shares = rec.shares || [];
      rec.shares.push(Object.assign({ at: Date.now(), n: v.n, mode: m, box: !!res.box }, extra || {}));
      if (rec.status !== 'signed') rec.status = 'sent';
      logEv('shared', { id: rec.id, n: v.n, s: m + (res.box ? '+box' : '') });
      return ST.put(rec).then(function () { if (opt.onSent) opt.onSent(rec); });
    }
    make.addEventListener('click', function () {
      if (!ok.checked) { flash(msg, t('dm.needOk'), true); return; }
      var lang = v.lang || rec.lang;
      // В сообщении — данные анкеты и правки относительно шаблона; получатель собирает документ и сверяет отпечаток.
      var payload = { t: 'q', v: 2, id: rec.id, n: v.n, code: rec.code, lang: lang, number: rec.number, mode: mode,
        from: data.ip_name || '', hash: v.hash, at: Date.now(), vat: v.at, data: data };
      if (v.edited) payload.patch = ST.patch(TPL.build(rec.code, data, lang), v.blocks);
      make.disabled = true;
      if (mode === 'fill') {
        payload.fields = fields;
        flash(msg, t('bx.making'));
        deliver(rec, payload).then(function (res) { make.disabled = false; flash(msg, t('dm.fillReady')); linkOut(out, res, rec); return sent('fill', res); })
          .catch(function (e) { make.disabled = false; flash(msg, errText(e), true); });
        return;
      }
      if (miss.length) { make.disabled = false; flash(msg, t('dm.needFillShort'), true); return; }
      flash(msg, t('ec.prep'));
      var own = (rec.ecp || []).filter(function (r) { return r.who === 'self' && r.kind === 'pades' && r.n === v.n && sigOk(r) && matchSender(r, data) !== false; }).pop();
      (own ? Promise.resolve(own) : (flash(msg, t('ec.confirm')), signVersion(rec, v))).then(function (r) {
        if (r.n !== v.n || !sigOk(r)) throw { code: 'sig' };
        if (matchSender(r, data) === false) throw { code: 'who', a: [r.iin, [r.cn, r.given].filter(Boolean).join(' ')].filter(Boolean).join(', ') };
        payload.sig = { cms: r.cms, stamp: r.stamp, reserve: r.reserve };
        flash(msg, t('bx.making'));
        return deliver(rec, payload).then(function (res) {
          make.disabled = false;
          flash(msg, f('dm.signedReady', { n: [r.cn, r.given].filter(Boolean).join(' ') }));
          linkOut(out, res, rec);
          return sent('sign', res, { base: rec.ecp.indexOf(r) });
        });
      }).catch(function (e) {
        make.disabled = false;
        var c = e && e.code;
        flash(msg, c === 'who' ? f('dm.whoBad', { a: e.a || '—', b: data.ip_iin || data.ip_fio || '—' }) : c === 'sig' ? t('dm.sigBad') : errText(e), true);
      });
    });
    return box;
  }

  // Ответы из ящика → журнал. Возвращает число новых ответов. После подписи второй стороны ящик удаляется.
  var polling = {};
  function poll(rec) {
    if (!rec || !rec.box || rec.box.closed) return Promise.resolve(0);
    if (polling[rec.id]) return polling[rec.id];
    var box = rec.box;
    polling[rec.id] = BX.read(box).then(function (res) {
      var seen = box.seen || [], fresh = res.list.filter(function (m) { return m.t === 'r' && seen.indexOf(m.mode + ':' + m.at) < 0; });
      var n = 0, signed = false;
      return fresh.reduce(function (p, m) {
        return p.then(function () {
          return importResponse(m).then(function (r) {
            n++; if (r.kind === 'sign' && r.sig && r.sig.ok && r.sig.match !== false) signed = true;
            return ST.get(rec.id).then(function (fr) { fr.box = fr.box || box; fr.box.seen = (fr.box.seen || []).concat([m.mode + ':' + m.at]); return ST.put(fr); });
          }, function () {
            return ST.get(rec.id).then(function (fr) { fr.box = fr.box || box; fr.box.seen = (fr.box.seen || []).concat([m.mode + ':' + m.at]); return ST.put(fr); });
          });
        });
      }, Promise.resolve()).then(function () {
        if (!signed) return n;
        return ST.get(rec.id).then(function (fr) {
          return BX.remove(fr.box).catch(function () {}).then(function () { fr.box.closed = true; return ST.put(fr); });
        }).then(function () { return n; });
      });
    }, function (e) {
      // Ящик удалён или истёк срок: больше не опрашиваем.
      if (e && e.status === 404) return ST.get(rec.id).then(function (fr) { if (fr && fr.box) { fr.box.closed = true; return ST.put(fr); } }).then(function () { return 0; });
      return 0;
    }).then(function (n) { delete polling[rec.id]; return n; });
    return polling[rec.id];
  }

  root.DocumAgree = { RESERVE: RESERVE, first: first, second: second, check: check, expected: expected, owns: owns, missing: missing,
    partyFields: partyFields, matchSender: matchSender, sharePanel: sharePanel, signVersion: signVersion, poll: poll, sigOk: sigOk, deliver: deliver, matchOther: matchOther, tag: tag, card: card, errText: errText, importResponse: importResponse, signedPdf: signedPdf, sha: sha };
})(window);
