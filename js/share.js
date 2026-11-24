/* docum.kz — страница документа по ссылке.
   Запрос (q) с подписью ЭЦП отправителя: сайт проверяет её, вторая сторона подписывает тот же PDF своей ЭЦП
   и отправляет ответную ссылку. Запрос реквизитов: вторая сторона вписывает свои данные, без подписи.
   Ответ (r): отправитель проверяет подпись и добавляет её в журнал. Нарисованных подписей нет.
   Данные живут только в части ссылки после «#»: браузер не отправляет её на сервер. */
(function () {
  'use strict';
  var ST = window.DocumStore, EX = window.DocumExport, TPL = window.DocumTemplates, L = window.DocumLogic;
  var E = window.DocumEcp, PA = window.DocumPades, AG = window.DocumAgree;
  var app = document.getElementById('share-app');
  if (!app || !ST) return;
  var t = window.t;
  var f = function (k, o) { var s = t(k); Object.keys(o || {}).forEach(function (x) { s = s.split('{' + x + '}').join(o[x]); }); return s; };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function btn(cls, text, fn) { var b = el('button', cls, text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function fmt(ms) { var d = new Date(ms), p = function (n) { return ('0' + n).slice(-2); }; return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

  var raw = location.hash.slice(1), payload = null;
  // Без ссылки или с повреждённой ссылкой страница предлагает открыть файл .docum.json.
  function fail(noLink) {
    app.textContent = '';
    app.appendChild(el('h1', null, t('sp.title')));
    app.appendChild(el('p', noLink ? 'lead' : 'notice notice-warn', t(noLink ? 'sp.noLink' : 'sp.bad')));
    var file = el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
    var b = btn('btn btn-ghost', t('sp.openFile'), function () { file.click(); });
    file.addEventListener('change', function () {
      var fl = file.files[0]; if (!fl) return;
      fl.text().then(function (txt) { var d = JSON.parse(txt); if (!d || d.app !== 'docum.kz' || d.kind !== 'share') throw new Error('bad'); return ST.decode(d.data); })
        .then(function (p) { payload = p; render(); }).catch(function () { fail(false); });
    });
    app.appendChild(b); app.appendChild(file);
  }

  function sheetOf(blocks, lang) { var s = el('div', 'sheet'); s.lang = lang; s.innerHTML = EX.toHTML(blocks); return s; }
  function linkBox(out, url, title, lead) {
    out.textContent = '';
    out.appendChild(el('h3', 'sp-ready', title));
    out.appendChild(el('p', 'lead-s', lead));
    var field = el('textarea', 'input sh-link'); field.readOnly = true; field.rows = 3; field.value = url;
    out.appendChild(field);
    var row = el('div', 'sh-row');
    row.appendChild(btn('btn btn-primary', t('dm.copy'), function (e) {
      var b = e.currentTarget;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { b.textContent = t('dm.copied'); }, function () { field.select(); document.execCommand('copy'); b.textContent = t('dm.copied'); });
    }));
    if (navigator.share) row.appendChild(btn('btn btn-ghost', t('dm.shareBtn'), function () { navigator.share({ url: url }).catch(function () {}); }));
    out.appendChild(row);
    out.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return row;
  }
  function reply(res) { return ST.encode(res).then(function (code) { return location.origin + location.pathname + '#' + code; }); }
  function old() {
    app.textContent = '';
    app.appendChild(el('h1', null, t('sp.title')));
    app.appendChild(el('p', 'notice notice-warn', t('sp.old')));
  }

  /* ---------- Запрос: заполнить реквизиты или проверить подпись отправителя и подписать ЭЦП ---------- */
  function renderRequest(p) {
    if (p.v !== 2 || (p.mode === 'sign' && !p.sig)) return old();
    app.textContent = '';
    // Введённое сохраняется в самом запросе: при смене языка страницы ничего не теряется.
    p.data = p.data || {};
    var data = p.data, blocks = p._blocks || ST.applyPatch(TPL.build(p.code, data, p.lang), p.patch);
    var head = el('div', 'page-head');
    head.appendChild(el('h1', null, t('d.' + p.code) + (p.number ? ' № ' + p.number : '')));
    if (p.from) head.appendChild(el('p', 'lead', f('sp.from', { n: p.from })));
    app.appendChild(head);
    var wrap = el('div', 'sp-grid');
    var side = el('div', 'sp-side'), doc = el('div', 'sp-doc');
    var sheet = sheetOf(blocks, p.lang);
    doc.appendChild(sheet);
    doc.appendChild(btn('btn btn-ghost', t('sp.dl'), function () { EX.downloadDocx(blocks, 'docum-' + p.code + '-' + (p.number || 'doc')); }));
    wrap.appendChild(doc); wrap.appendChild(side);
    app.appendChild(wrap);
    if (p.mode === 'fill') fillSide(p, side, sheet, function (b) { blocks = b; });
    else signSide(p, side, blocks);
  }

  // Реквизиты второй стороны: без подписи, это только данные для договора.
  function fillSide(p, side, sheet, setBlocks) {
    var data = p.data, fields = (p.fields || []).filter(function (id) { var d = TPL.FIELDS[id]; return d && d.type !== 'check'; });
    var box = el('section', 'sh-box');
    box.appendChild(el('h2', 'panel-title', t('sp.fill')));
    box.appendChild(el('p', 'lead-s', t('sp.fillLead')));
    fields.forEach(function (id) {
      var def = TPL.FIELDS[id];
      var fb = el('div', 'field');
      var lab = el('label', 'label', t('f.' + id) + (def.optional ? ' ' + t('b.optional') : '')); lab.htmlFor = 'sp-' + id;
      var inp = el('input', 'input'); inp.id = 'sp-' + id;
      inp.type = def.type === 'date' ? 'date' : 'text';
      if (def.mode) inp.inputMode = def.mode;
      if (def.max) inp.maxLength = def.max;
      if (window.tHas('p.' + id)) inp.placeholder = t('p.' + id);
      inp.value = data[id] || '';
      var m = el('p', 'msg');
      inp.addEventListener('input', function () {
        data[id] = inp.value;
        var r = L.checkField(def, id, inp.value, data, p.code, true);
        m.textContent = r ? t(r.key) : ''; m.className = 'msg' + (r && r.type === 'error' ? ' msg-error' : '');
        inp.toggleAttribute('aria-invalid', !!(r && r.type === 'error'));
        var b = p._blocks = TPL.build(p.code, data, p.lang);
        setBlocks(b); sheet.innerHTML = EX.toHTML(b);
      });
      fb.appendChild(lab); fb.appendChild(inp); fb.appendChild(m);
      box.appendChild(fb);
    });
    var msg = el('p', 'msg msg-error'), out = el('div', 'sh-out');
    box.appendChild(btn('btn btn-primary', t('sp.sendFill'), function () {
      var bad = fields.filter(function (id) { var r = L.checkField(TPL.FIELDS[id], id, data[id], data, p.code, true); return r && r.type === 'error'; });
      if (bad.length) { msg.textContent = t('sp.fix'); return; }
      msg.textContent = '';
      var only = {}; fields.forEach(function (id) { if (data[id] != null) only[id] = data[id]; });
      reply({ t: 'r', v: 2, mode: 'fill', id: p.id, n: p.n, code: p.code, lang: p.lang, number: p.number, at: Date.now(), data: only })
        .then(function (url) { linkBox(out, url, t('sp.reply'), t('sp.replyFill')); });
    }));
    box.appendChild(el('p', 'jr-note', t('sp.fillNote')));
    box.appendChild(msg); box.appendChild(out);
    side.appendChild(box);
  }

  // Подпись: сначала сайт проверяет подпись отправителя, потом вторая сторона подписывает тот же PDF поверх неё.
  function signSide(p, side, blocks) {
    var data = p.data, sig = p.sig;
    var chk = el('section', 'sh-box');
    chk.appendChild(el('h2', 'panel-title', t('sp.senderSig')));
    var st = el('p', 'msg', t('ag.checking')); chk.appendChild(st);
    side.appendChild(chk);
    var mine = el('section', 'sh-box');
    side.appendChild(mine);
    var prep1 = null;
    Promise.all([ST.hash(ST.text(blocks)), AG.first(blocks, sig.stamp, p.vat, sig.reserve)]).then(function (r) {
      prep1 = r[1];
      var docOk = r[0] === p.hash;
      return AG.check(sig.cms, prep1.toSign).then(function (x) { return { x: x, docOk: docOk }; });
    }).then(function (o) {
      var who = AG.matchSender(o.x, data);
      st.remove();
      chk.appendChild(AG.card(o.x, t('sg.me'), { doc: o.docOk, who: who, id: data.ip_iin || data.ip_fio }));
      var good = o.docOk && o.x.ok && who !== false;
      chk.appendChild(el('p', good ? 'notice ag-ok' : 'notice notice-warn', t(good ? 'sp.senderOk' : 'sp.senderBad')));
      if (o.x.crypto === 'skip') chk.appendChild(verifyHint());
      mySide(p, mine, prep1, good);
    }).catch(function () {
      st.className = 'msg msg-error'; st.textContent = t('sp.senderBad');
      mySide(p, mine, null, false);
    });
  }
  function verifyHint() {
    var n = el('p', 'jr-note'); n.appendChild(document.createTextNode(t('ag.gostHint') + ' '));
    var a = el('a', null, t('ec.verifyLink')); a.href = 'verify.html'; n.appendChild(a);
    return n;
  }
  function mySide(p, box, prep1, good) {
    var data = p.data;
    box.appendChild(el('h2', 'panel-title', t('sp.sign')));
    var out = el('div', 'sh-out'), msg = el('p', 'msg'); msg.setAttribute('role', 'status');
    if (good) {
      box.appendChild(el('p', 'lead-s', t('sp.signLead')));
      var agreeL = el('label', 'check'), agree = el('input'); agree.type = 'checkbox';
      agreeL.appendChild(agree); agreeL.appendChild(el('span', null, t('sp.agree'))); box.appendChild(agreeL);
      var go = btn('btn btn-primary', t('sp.signBtn'), function () {
        if (!agree.checked) { msg.className = 'msg msg-error'; msg.textContent = t('sp.needAgree'); return; }
        var at2 = Date.now(), prep2 = null;
        go.disabled = true; msg.className = 'msg'; msg.textContent = t('ec.prep');
        AG.second(prep1, p.sig.cms, at2, AG.RESERVE).then(function (pp) {
          prep2 = pp; msg.textContent = t('ec.confirm');
          return E.sign(E.b64(prep2.toSign), true);
        }).then(function (cms) {
          msg.textContent = t('ag.checking');
          return AG.check(cms, prep2.toSign);
        }).then(function (y) {
          var who = AG.matchOther(y, data);
          box.insertBefore(AG.card(y, t('sg.other'), { who: who, id: AG.expected(data) || data.w_fio }), msg);
          if (!y.ok) throw { code: 'sig' };
          if (who === false) throw { code: 'who' };
          var pdf = PA.embed(prep2, E.unb64(y.cms)), name = 'docum-' + p.code + '-' + (p.number || 'doc') + '-signed-2.pdf';
          EX.saveBlob(new Blob([pdf], { type: 'application/pdf' }), name);
          go.remove(); agreeL.remove(); msg.textContent = '';
          return reply({ t: 'r', v: 2, mode: 'sign', id: p.id, n: p.n, code: p.code, lang: p.lang, number: p.number, hash: p.hash, at: at2, reserve: AG.RESERVE, base: AG.tag(p.sig.cms), cms: y.cms })
            .then(function (url) {
              var row = linkBox(out, url, t('sp.signed'), t('sp.signedLead'));
              row.appendChild(btn('btn btn-ghost', t('ag.dl2'), function () { EX.saveBlob(new Blob([pdf], { type: 'application/pdf' }), name); }));
            });
        }).catch(function (e) {
          go.disabled = false; msg.className = 'msg msg-error';
          var c = e && e.code;
          msg.textContent = c === 'who' ? t('sp.whoBad') : c === 'sig' ? t('dm.sigBad') : AG.errText(e);
        });
      });
      box.appendChild(go);
      box.appendChild(msg);
      var inst = el('p', 'jr-note'); inst.appendChild(document.createTextNode(t('sp.pcOnly') + ' '));
      var na = el('a', null, 'ncl.pki.gov.kz'); na.href = 'https://ncl.pki.gov.kz/'; na.target = '_blank'; na.rel = 'noopener'; inst.appendChild(na);
      box.appendChild(inst);
    } else {
      box.appendChild(el('p', 'lead-s', t('sp.cantSign')));
    }
    // Не согласны с текстом — предложить правки. Это не подпись: отправитель исправит документ и пришлёт новую ссылку.
    var ch = el('details', 'ag-propose');
    ch.appendChild(el('summary', null, t('sp.propose')));
    var ta = el('textarea', 'input'); ta.rows = 4; ta.maxLength = 4000; ta.setAttribute('aria-label', t('sp.propose'));
    var cm = el('p', 'msg msg-error');
    ch.appendChild(ta);
    ch.appendChild(btn('btn btn-ghost', t('sp.proposeBtn'), function () {
      var text = ta.value.trim();
      if (!text) { cm.textContent = t('sp.proposeNeed'); return; }
      cm.textContent = '';
      reply({ t: 'r', v: 2, mode: 'change', id: p.id, n: p.n, code: p.code, lang: p.lang, number: p.number, at: Date.now(), text: text })
        .then(function (url) { linkBox(out, url, t('sp.reply'), t('sp.replyChange')); });
    }));
    ch.appendChild(cm);
    box.appendChild(ch);
    box.appendChild(out);
  }

  /* ---------- Ответ: проверить и добавить в журнал отправителя ---------- */
  function renderResponse(p) {
    if (p.v !== 2) return old();
    app.textContent = '';
    var head = el('div', 'page-head');
    var title = t('d.' + p.code) + (p.number ? ' № ' + p.number : '');
    head.appendChild(el('h1', null, t('sp.resTitle')));
    head.appendChild(el('p', 'lead', f(p.mode === 'sign' ? 'sp.resSign' : p.mode === 'fill' ? 'sp.resFill' : 'sp.resChange', { d: title })));
    app.appendChild(head);
    if (p.mode === 'change') { var q = el('blockquote', 'notice ag-change'); q.textContent = p.text || ''; app.appendChild(q); }
    var res = el('div');
    var msg = el('p', 'msg');
    var add = btn('btn btn-primary', t(p.mode === 'sign' ? 'sp.addSign' : 'sp.addJ'), function () {
      // При защите паролем журнал сначала нужно открыть.
      var VA = window.DocumVault;
      add.disabled = true; msg.className = 'msg'; msg.textContent = p.mode === 'sign' ? t('ag.checking') : '';
      (VA && VA.locked() ? VA.prompt() : Promise.resolve()).then(function () { return AG.importResponse(p); }).then(function (r) {
        msg.textContent = '';
        if (VA) VA.log('response', { id: r.rec.id, s: r.kind });
        if (r.sig) {
          var vv = r.rec.versions[r.sig.n - 1];
          res.appendChild(AG.card(r.sig, t('sg.other'), { who: r.sig.match, id: AG.expected((vv && vv.data) || {}) }));
          res.appendChild(el('p', r.sig.ok && r.sig.match !== false ? 'notice ag-ok' : 'notice notice-warn', t(r.sig.ok && r.sig.match !== false ? 'sp.bothOk' : 'sp.otherBad')));
        }
        var a = el('a', null, t('sp.added')); a.href = 'documents.html?id=' + r.rec.id; msg.appendChild(a);
      }, function (e) {
        add.disabled = false; msg.className = 'msg msg-error';
        var c = e && e.code;
        msg.textContent = c === 'cancel' ? '' : t(c === 'norec' ? 'ag.noRec' : c === 'nobase' ? 'ag.noBase' : 'sp.bad');
      });
    });
    app.appendChild(add); app.appendChild(msg); app.appendChild(res);
    app.appendChild(el('p', 'sign-legal', t('ec.legal')));
  }

  function render() {
    if (!payload) return fail();
    var ok = TPL.DOCS[payload.code] && (Array.isArray(payload.blocks) || payload.data || payload.t === 'r');
    if (payload.t === 'q' && ok) renderRequest(payload);
    else if (payload.t === 'r' && ok) renderResponse(payload);
    else fail();
  }
  if (!raw) fail(true);
  else ST.decode(raw).then(function (p) { payload = p; render(); }).catch(function () { fail(false); });
  document.addEventListener('docum:lang', function () { if (payload) render(); });
})();
