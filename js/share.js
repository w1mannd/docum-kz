/* docum.kz — страница документа по ссылке.
   Запрос (q): вторая сторона читает документ, при необходимости заполняет свои поля и ставит отметку о согласовании,
   а сайт собирает ответную ссылку. Ответ (r): отправитель добавляет согласование в свой журнал.
   Данные живут только в части ссылки после «#»: браузер не отправляет её на сервер. */
(function () {
  'use strict';
  var ST = window.DocumStore, EX = window.DocumExport, TPL = window.DocumTemplates, L = window.DocumLogic;
  var app = document.getElementById('share-app');
  if (!app || !ST) return;
  var t = window.t;
  var f = function (k, o) { var s = t(k); Object.keys(o || {}).forEach(function (x) { s = s.split('{' + x + '}').join(o[x]); }); return s; };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function btn(cls, text, fn) { var b = el('button', cls, text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function fmt(ms) { var d = new Date(ms), p = function (n) { return ('0' + n).slice(-2); }; return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }

  var raw = location.hash.slice(1), payload = null;
  function fail() { app.textContent = ''; app.appendChild(el('h1', null, t('sp.title'))); app.appendChild(el('p', 'notice notice-warn', t('sp.bad'))); }

  function sheetOf(blocks, lang) { var s = el('div', 'sheet'); s.lang = lang; s.innerHTML = EX.toHTML(blocks); return s; }

  /* ---------- Запрос: прочитать, заполнить, согласовать ---------- */
  function renderRequest(p) {
    app.textContent = '';
    // Введённое сохраняется в самом запросе: при смене языка страницы ничего не теряется.
    p.data = p.data || {};
    var blocks = p._blocks || p.blocks || TPL.build(p.code, p.data, p.lang), data = p.data, errors = {};
    var head = el('div', 'page-head');
    head.appendChild(el('h1', null, t('d.' + p.code) + (p.number ? ' № ' + p.number : '')));
    if (p.from) head.appendChild(el('p', 'lead', f('sp.from', { n: p.from })));
    app.appendChild(head);
    var wrap = el('div', 'sp-grid');
    var side = el('div', 'sp-side'), doc = el('div', 'sp-doc');
    var sheet = sheetOf(blocks, p.lang);
    doc.appendChild(sheet);
    var dl = btn('btn btn-ghost', t('sp.dl'), function () { EX.downloadDocx(blocks, 'docum-' + p.code + '-' + (p.number || 'doc')); });
    doc.appendChild(dl);

    if (p.mode === 'fill' && Array.isArray(p.fields)) {
      var fill = el('section', 'sh-box');
      fill.appendChild(el('h2', 'panel-title', t('sp.fill')));
      fill.appendChild(el('p', 'lead-s', t('sp.fillLead')));
      p.fields.forEach(function (id) {
        var def = TPL.FIELDS[id]; if (!def) return;
        if (def.type === 'check') return;
        var box = el('div', 'field');
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
          var r = L.checkField(def, id, inp.value, data, p.code);
          errors[id] = r && r.type === 'error';
          m.textContent = r ? t(r.key) : ''; m.className = 'msg' + (errors[id] ? ' msg-error' : '');
          inp.toggleAttribute('aria-invalid', !!errors[id]);
          blocks = p._blocks = TPL.build(p.code, data, p.lang);
          sheet.innerHTML = EX.toHTML(blocks);
        });
        box.appendChild(lab); box.appendChild(inp); box.appendChild(m);
        fill.appendChild(box);
      });
      side.appendChild(fill);
    }

    var sg = el('section', 'sh-box');
    sg.appendChild(el('h2', 'panel-title', t('sp.sign')));
    var out = el('div', 'sh-out'), msg = el('p', 'msg msg-error');
    side.appendChild(sg);
    window.DocumSign.pad(sg, function (s) {
      if (p.mode === 'fill') {
        var bad = p.fields.filter(function (id) {
          var def = TPL.FIELDS[id]; if (!def || def.type === 'check') return false;
          var r = L.checkField(def, id, data[id], data, p.code); return r && r.type === 'error';
        });
        if (bad.length) { msg.textContent = t('sp.fix'); return; }
      }
      msg.textContent = '';
      var hp = ST.hash(ST.text(blocks));
      hp.then(function (h) {
        // В ответе только то, чего у отправителя нет: подпись, отпечаток и заполненные данные.
        var res = { t: 'r', v: 1, id: p.id, n: p.n, code: p.code, lang: p.lang, number: p.number, mode: p.mode, name: s.name, strokes: s.strokes, at: s.at, hash: h };
        if (p.mode === 'fill') res.data = data;
        return ST.encode(res);
      }).then(function (code) {
        var url = location.origin + location.pathname + '#' + code;
        out.textContent = '';
        out.appendChild(el('h3', 'sp-ready', t('sp.reply')));
        out.appendChild(el('p', 'lead-s', t('sp.replyLead')));
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
      });
    });
    sg.appendChild(msg);
    sg.appendChild(out);
    wrap.appendChild(doc); wrap.appendChild(side);
    app.appendChild(wrap);
  }

  /* ---------- Ответ: показать и добавить в журнал ---------- */
  function renderResponse(p) {
    app.textContent = '';
    var head = el('div', 'page-head');
    head.appendChild(el('h1', null, t('sp.resTitle')));
    head.appendChild(el('p', 'lead', f('sp.resLead', { n: p.name, d: t('d.' + p.code) + (p.number ? ' № ' + p.number : '') })));
    app.appendChild(head);
    var card = el('div', 'sg-item sg-big');
    var im = el('img'); im.src = window.DocumSign.draw(p.strokes); im.alt = p.name; im.width = 240; im.height = 80;
    card.appendChild(im);
    var info = el('div');
    info.appendChild(el('b', null, p.name));
    info.appendChild(el('p', 'jr-meta', fmt(p.at)));
    var integ = el('p', 'jr-meta');
    info.appendChild(integ);
    card.appendChild(info);
    app.appendChild(card);
    integ.textContent = f('sp.hash', { h: (p.hash || '').slice(0, 16) + '…' });
    ST.get(p.id).then(function (rec) {
      var blocks = ST.responseBlocks(p, rec);
      if (!blocks) return;
      ST.hash(ST.text(blocks)).then(function (h) { if (h !== p.hash) app.insertBefore(el('p', 'notice notice-warn', t('sp.altered')), card); });
      app.appendChild(sheetOf(blocks, p.lang));
    });
    var msg = el('p', 'msg');
    var add = btn('btn btn-primary', t('sp.addJ'), function () {
      ST.importResponse(p).then(function (r) {
        msg.textContent = '';
        if (!r) { msg.textContent = t('sp.bad'); return; }
        var a = el('a', null, t('sp.added')); a.href = 'documents.html?id=' + r.id; msg.appendChild(a);
        add.disabled = true;
      });
    });
    app.appendChild(add); app.appendChild(msg);
    app.appendChild(el('p', 'sign-legal', t('dm.legal')));
  }

  function render() {
    if (!payload) return fail();
    var ok = TPL.DOCS[payload.code] && (Array.isArray(payload.blocks) || payload.data || payload.t === 'r');
    if (payload.t === 'q' && ok) renderRequest(payload);
    else if (payload.t === 'r' && ok) renderResponse(payload);
    else fail();
  }
  if (!raw) fail();
  else ST.decode(raw).then(function (p) { payload = p; render(); }).catch(fail);
  document.addEventListener('docum:lang', function () { if (payload) render(); });
})();
