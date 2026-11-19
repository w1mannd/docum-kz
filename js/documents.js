/* docum.kz — «Мои документы»: журнал, редактор, версии, сравнение и согласование по ссылке.
   Всё хранится в браузере пользователя (js/store.js), сервер не нужен. */
(function () {
  'use strict';
  var ST = window.DocumStore, EX = window.DocumExport, DF = window.DocumDiff, TPL = window.DocumTemplates;
  var app = document.getElementById('docs-app');
  if (!app || !ST) return;
  var t = window.t;
  var f = function (k, o) { var s = t(k); Object.keys(o || {}).forEach(function (x) { s = s.split('{' + x + '}').join(o[x]); }); return s; };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function btn(cls, text, fn) { var b = el('button', cls, text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function fmt(ms) {
    var d = new Date(ms), p = function (n) { return ('0' + n).slice(-2); };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function titleOf(rec) { return t('d.' + rec.code) + (rec.number ? ' № ' + rec.number : ''); }
  function last(rec) { return rec.versions[rec.versions.length - 1]; }
  function fileName(rec) { return 'docum-' + rec.code + '-' + (rec.number || rec.id.slice(0, 6)) + '-v' + last(rec).n; }
  function flash(node, text, bad) { node.textContent = text; node.className = 'msg' + (bad ? ' msg-error' : ' msg-ok'); }

  var query = new URLSearchParams(location.search);
  var id = query.get('id');

  /* ================= Журнал ================= */
  function renderList() {
    app.textContent = '';
    var head = el('div', 'page-head');
    head.appendChild(el('h1', null, t('dm.title')));
    head.appendChild(el('p', 'lead', t('dm.lead')));
    app.appendChild(head);

    var bar = el('div', 'jr-bar');
    var search = el('input', 'input'); search.type = 'search'; search.placeholder = t('dm.search'); search.setAttribute('aria-label', t('dm.search'));
    var chips = el('div', 'chips'), status = 'all';
    bar.appendChild(search); bar.appendChild(chips);
    app.appendChild(bar);
    var list = el('div', 'jr-list'); app.appendChild(list);
    var empty = el('div', 'jr-empty'); app.appendChild(empty);

    var tools = el('div', 'jr-tools');
    var msg = el('p', 'msg');
    var file = el('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true;
    tools.appendChild(btn('btn btn-ghost', t('dm.backup'), backup));
    tools.appendChild(btn('btn btn-ghost', t('dm.restore'), function () { file.click(); }));
    tools.appendChild(file);
    app.appendChild(tools);
    app.appendChild(el('p', 'jr-note', t('dm.backupNote')));
    app.appendChild(msg);

    var all = [];
    function draw() {
      var q = search.value.trim().toLowerCase();
      list.textContent = '';
      var shown = all.filter(function (r) {
        return (status === 'all' || r.status === status) && titleOf(r).toLowerCase().indexOf(q) >= 0;
      });
      shown.forEach(function (r, i) {
        var card = el('div', 'jr-item');
        card.style.setProperty('--i', i);
        var a = el('a', 'jr-main'); a.href = 'documents.html?id=' + r.id;
        a.appendChild(el('span', 'jr-title', titleOf(r)));
        a.appendChild(el('span', 'jr-meta', f('dm.c.ver', { n: r.versions.length }) + ' · ' + f('dm.c.upd', { d: fmt(r.updated) })));
        card.appendChild(a);
        card.appendChild(el('span', 'jr-badge jr-' + r.status, t('dm.s.' + r.status)));
        card.appendChild(btn('jr-del', t('dm.del'), function () {
          if (!window.confirm(t('dm.delAsk'))) return;
          ST.del(r.id).then(load);
        }));
        list.appendChild(card);
      });
      empty.textContent = '';
      if (!all.length) {
        empty.appendChild(el('p', null, t('dm.empty')));
        var go = el('a', 'btn btn-primary', t('dm.toBuilder')); go.href = 'constructor.html';
        empty.appendChild(go);
      }
    }
    ['all', 'draft', 'final', 'sent', 'signed'].forEach(function (s) {
      var c = btn('chip', s === 'all' ? t('dm.all') : t('dm.s.' + s), function () {
        status = s;
        chips.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); });
        draw();
      });
      c.setAttribute('aria-pressed', String(s === 'all'));
      chips.appendChild(c);
    });
    search.addEventListener('input', draw);

    function backup() {
      ST.all().then(function (rows) {
        var blob = new Blob([JSON.stringify({ app: 'docum.kz', kind: 'journal', v: 1, at: Date.now(), docs: rows })], { type: 'application/json' });
        var a = document.createElement('a'), url = URL.createObjectURL(blob);
        a.href = url; a.download = 'docum-journal-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      });
    }
    file.addEventListener('change', function () {
      var fl = file.files[0]; if (!fl) return;
      fl.text().then(function (txt) {
        var d = JSON.parse(txt);
        if (!d || d.app !== 'docum.kz' || !Array.isArray(d.docs)) throw new Error('bad');
        var ok = d.docs.filter(function (r) { return r && r.id && r.code && TPL.DOCS[r.code] && Array.isArray(r.versions) && r.versions.length; });
        return Promise.all(ok.map(function (r) { return ST.put(r); })).then(function () { flash(msg, f('dm.restored', { n: ok.length })); load(); });
      }).catch(function () { flash(msg, t('dm.badFile'), true); });
      file.value = '';
    });
    function load() { ST.all().then(function (rows) { all = rows; draw(); }); }
    load();
  }

  /* ================= Карточка документа ================= */
  var rec = null, model = null, undo = [], redo = [], dirty = false, focusIdx = -1, tab = 'edit';

  function renderDoc() {
    app.textContent = '';
    var back = el('a', 'crumb', t('dm.back')); back.href = 'documents.html';
    app.appendChild(back);
    var head = el('div', 'jr-head');
    head.appendChild(el('h1', 'builder-title', titleOf(rec)));
    head.appendChild(el('span', 'jr-badge jr-' + rec.status, t('dm.s.' + rec.status)));
    app.appendChild(head);
    var tabs = el('div', 'jr-tabs'); tabs.setAttribute('role', 'tablist');
    var panel = el('div', 'jr-panel');
    [['edit', 'dm.t.edit'], ['ver', 'dm.t.ver'], ['cmp', 'dm.t.cmp'], ['share', 'dm.t.share']].forEach(function (x) {
      var b = btn('jr-tab', t(x[1]), function () {
        if (tab === 'edit' && dirty && x[0] !== 'edit' && !window.confirm(t('dm.unsaved'))) return;
        if (x[0] !== 'edit') dirty = false;
        tab = x[0]; renderDoc();
      });
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(tab === x[0]));
      tabs.appendChild(b);
    });
    app.appendChild(tabs);
    app.appendChild(panel);
    if (tab === 'edit') renderEditor(panel);
    else if (tab === 'ver') renderVersions(panel);
    else if (tab === 'cmp') renderCompare(panel);
    else renderShare(panel);
  }

  /* ---------- Редактор ---------- */
  var EDIT_TEXT = { title: 1, center: 1, h: 1, p: 1, small: 1, order: 1 };
  function paint(sheet) {
    sheet.textContent = '';
    model.forEach(function (b, i) {
      var node;
      var ed = function (n, path) {
        n.contentEditable = 'true'; n.spellcheck = true; n.setAttribute('data-path', JSON.stringify(path)); n.setAttribute('data-i', i);
        return n;
      };
      if (EDIT_TEXT[b.k]) {
        var cls = { title: 'd-title', center: 'd-center', h: 'd-h', p: 'd-p', small: 'd-small', order: 'd-order' }[b.k];
        node = ed(el('p', cls + (b.bold ? ' d-bold' : '') + (b.right ? ' d-right' : '') + (b.center ? ' d-center' : ''), b.k === 'order' ? (b.text || 'ПРИКАЗЫВАЮ:') : b.text), [i, 'text']);
      } else if (b.k === 'row') {
        node = el('p', 'd-row');
        node.appendChild(ed(el('span', null, b.left), [i, 'left']));
        node.appendChild(ed(el('span', null, b.right), [i, 'right']));
      } else if (b.k === 'cols') {
        node = el('div', 'd-cols-wrap');
        [['left', 'right'], ['signLeft', 'signRight']].forEach(function (pair, row) {
          var g = el('div', 'd-cols' + (row ? ' d-cols-sign' : ''));
          pair.forEach(function (side) {
            var col = el('div');
            b[side].forEach(function (line, j) {
              col.appendChild(ed(el('p', !row && j === 0 ? 'd-bold' : '', line), [i, side, j]));
            });
            g.appendChild(col);
          });
          node.appendChild(g);
        });
      } else if (b.k === 'gap') {
        node = el('p', 'd-gap');
      } else {
        node = el('div', 'd-locked');
        node.innerHTML = EX.toHTML([b]);
      }
      sheet.appendChild(node);
    });
  }
  function setPath(path, value) {
    var b = model[path[0]];
    if (path.length === 2) b[path[1]] = value; else b[path[1]][path[2]] = value;
  }
  function snapshot() { undo.push(JSON.stringify(model)); if (undo.length > 100) undo.shift(); redo = []; }

  function renderEditor(panel) {
    if (!model) model = clone(last(rec).blocks);
    var bar = el('div', 'ed-bar');
    var bUndo = btn('ed-btn', t('dm.undo')), bRedo = btn('ed-btn', t('dm.redo'));
    var bAdd = btn('ed-btn', t('dm.addP')), bDel = btn('ed-btn', t('dm.delP'));
    [bUndo, bRedo, bAdd, bDel].forEach(function (b) { bar.appendChild(b); });
    var note = el('input', 'input ed-note'); note.placeholder = t('dm.note'); note.setAttribute('aria-label', t('dm.note')); note.maxLength = 120;
    var save = btn('btn btn-primary', t('dm.save'));
    var dlD = btn('btn btn-ghost', '.docx'), dlP = btn('btn btn-ghost', '.pdf');
    var msg = el('p', 'msg'); msg.setAttribute('role', 'status');
    panel.appendChild(el('p', 'ed-hint', t('dm.editHint')));
    panel.appendChild(bar);
    var sheet = el('div', 'sheet sheet-edit'); sheet.lang = last(rec).lang || rec.lang;
    panel.appendChild(sheet);
    var foot = el('div', 'ed-foot');
    foot.appendChild(note); foot.appendChild(save); foot.appendChild(dlD); foot.appendChild(dlP);
    panel.appendChild(foot);
    panel.appendChild(msg);
    var rebuild = el('a', 'link-btn', t('dm.rebuild')); rebuild.href = 'constructor.html?journal=' + rec.id; rebuild.title = t('dm.rebuildNote');
    panel.appendChild(rebuild);
    panel.appendChild(el('p', 'jr-note', t('dm.rebuildNote')));
    paint(sheet);

    var typing = null;
    sheet.addEventListener('focusin', function (e) { var n = e.target.closest('[data-i]'); if (n) focusIdx = +n.getAttribute('data-i'); });
    sheet.addEventListener('beforeinput', function () { if (!typing) snapshot(); clearTimeout(typing); typing = setTimeout(function () { typing = null; }, 700); });
    sheet.addEventListener('input', function (e) {
      var n = e.target.closest('[data-path]'); if (!n) return;
      setPath(JSON.parse(n.getAttribute('data-path')), n.innerText.replace(/\n+$/, '').replace(/\n/g, ' '));
      dirty = true;
    });
    // Вставка только простым текстом, без чужого оформления.
    sheet.addEventListener('paste', function (e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\s*\n\s*/g, ' ');
      document.execCommand('insertText', false, text);
    });
    sheet.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var n = e.target.closest('[data-i]'); if (!n) return;
        addAfter(+n.getAttribute('data-i'));
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? doRedo : doUndo)(); }
    });
    function refocus(i) {
      paint(sheet);
      var n = sheet.querySelector('[data-i="' + i + '"]');
      if (n) { n.focus(); var r = document.createRange(); r.selectNodeContents(n); r.collapse(false); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
    }
    function addAfter(i) {
      snapshot(); model.splice(i + 1, 0, { k: 'p', text: '' }); dirty = true; focusIdx = i + 1; refocus(i + 1);
    }
    function doUndo() { if (!undo.length) return; redo.push(JSON.stringify(model)); model = JSON.parse(undo.pop()); dirty = true; paint(sheet); }
    function doRedo() { if (!redo.length) return; undo.push(JSON.stringify(model)); model = JSON.parse(redo.pop()); dirty = true; paint(sheet); }
    bUndo.addEventListener('click', doUndo);
    bRedo.addEventListener('click', doRedo);
    bAdd.addEventListener('click', function () { if (focusIdx < 0) { flash(msg, t('dm.pickP'), true); return; } addAfter(focusIdx); });
    bDel.addEventListener('click', function () {
      if (focusIdx < 0) { flash(msg, t('dm.pickP'), true); return; }
      var b = model[focusIdx];
      if (!b || (b.k !== 'p' && b.k !== 'small')) { flash(msg, t('dm.cantDel'), true); return; }
      snapshot(); model.splice(focusIdx, 1); dirty = true; focusIdx = Math.min(focusIdx, model.length - 1); refocus(focusIdx);
    });
    save.addEventListener('click', function () {
      var blocks = clone(model);
      ST.hash(ST.text(blocks)).then(function (h) {
        if (h === last(rec).hash) { flash(msg, t('dm.nochg')); dirty = false; return; }
        var prev = last(rec);
        rec.versions.push({ n: rec.versions.length + 1, at: Date.now(), blocks: blocks, data: clone(prev.data || {}), lang: prev.lang, hash: h, note: note.value.trim(), edited: true });
        if (rec.status === 'signed' || rec.status === 'sent') rec.status = 'draft';
        return ST.put(rec).then(function () { dirty = false; note.value = ''; flash(msg, f('dm.saved', { n: rec.versions.length })); });
      });
    });
    dlD.addEventListener('click', function () { EX.downloadDocx(clone(model), fileName(rec)); });
    dlP.addEventListener('click', function () { EX.downloadPdf(clone(model), fileName(rec)); });
  }
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- Версии ---------- */
  function renderVersions(panel) {
    var list = el('ol', 'ver-list');
    var msg = el('p', 'msg');
    rec.versions.slice().reverse().forEach(function (v) {
      var li = el('li', 'ver-item');
      var top = el('div', 'ver-top');
      top.appendChild(el('b', null, f('dm.ver', { n: v.n })));
      if (v.n === last(rec).n) top.appendChild(el('span', 'jr-badge jr-final', t('dm.cur')));
      if (v.edited) top.appendChild(el('span', 'jr-badge', t('dm.edited')));
      if (v.byOther) top.appendChild(el('span', 'jr-badge jr-signed', t('dm.byOther')));
      li.appendChild(top);
      li.appendChild(el('p', 'jr-meta', fmt(v.at) + (v.note ? ' · ' + v.note : '')));
      li.appendChild(el('p', 'ver-hash', t('dm.hash') + ': ' + (v.hash || '').slice(0, 16) + '…'));
      var acts = el('div', 'ver-acts');
      if (v.n !== last(rec).n) {
        acts.appendChild(btn('link-btn', t('dm.cmpCur'), function () { cmpPair = [v.n, last(rec).n]; tab = 'cmp'; renderDoc(); }));
        acts.appendChild(btn('link-btn', t('dm.restoreV'), function () {
          var copy = clone(v); copy.n = rec.versions.length + 1; copy.at = Date.now(); copy.note = f('dm.restoredV', { a: v.n, n: copy.n });
          rec.versions.push(copy);
          ST.put(rec).then(function () { model = null; flash(msg, copy.note); renderDoc(); });
        }));
      }
      acts.appendChild(btn('link-btn', '.docx', function () { EX.downloadDocx(clone(v.blocks), 'docum-' + rec.code + '-v' + v.n); }));
      li.appendChild(acts);
      list.appendChild(li);
    });
    panel.appendChild(list);
    panel.appendChild(msg);
  }

  /* ---------- Сравнение ---------- */
  var cmpPair = null;
  function renderCompare(panel) {
    if (rec.versions.length < 2) { panel.appendChild(el('p', 'notice notice-info', t('dm.one'))); return; }
    if (!cmpPair) cmpPair = [rec.versions.length - 1, rec.versions.length];
    var row = el('div', 'cmp-pick');
    var mk = function (label, idx) {
      var box = el('label', 'cmp-sel'); box.appendChild(el('span', 'label', label));
      var s = el('select', 'input');
      rec.versions.forEach(function (v) { var o = el('option', null, f('dm.ver', { n: v.n }) + ' · ' + fmt(v.at)); o.value = v.n; s.appendChild(o); });
      s.value = cmpPair[idx];
      s.addEventListener('change', function () { cmpPair[idx] = +s.value; renderDoc(); });
      box.appendChild(s); return box;
    };
    row.appendChild(mk(t('dm.from'), 0)); row.appendChild(mk(t('dm.to'), 1));
    panel.appendChild(row);
    var A = rec.versions[cmpPair[0] - 1], B = rec.versions[cmpPair[1] - 1];
    var res = DF.paras(ST.units(A.blocks), ST.units(B.blocks));
    var c = 0, ins = 0, del = 0;
    res.forEach(function (p) { if (p.type === 'chg') c++; else if (p.type === 'ins') ins++; else if (p.type === 'del') del++; });
    var tools = el('div', 'cmp-tools');
    tools.appendChild(el('span', 'cmp-stats', c + ins + del ? f('dm.stats', { c: c, i: ins, d: del }) : t('dm.same')));
    var marks = [], cur = -1;
    var go = function (d) {
      if (!marks.length) return;
      cur = (cur + d + marks.length) % marks.length;
      marks.forEach(function (m) { m.classList.remove('is-cur'); });
      marks[cur].classList.add('is-cur');
      marks[cur].scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    tools.appendChild(btn('ed-btn', '↑ ' + t('dm.prev'), function () { go(-1); }));
    tools.appendChild(btn('ed-btn', '↓ ' + t('dm.next'), function () { go(1); }));
    tools.appendChild(btn('btn btn-ghost', t('dm.redline'), function () {
      EX.downloadRedline(res, 'docum-' + rec.code + '-v' + A.n + '-v' + B.n, { title: titleOf(rec) + ': ' + f('dm.ver', { n: A.n }) + ' → ' + f('dm.ver', { n: B.n }) });
    }));
    panel.appendChild(tools);
    panel.appendChild(el('p', 'jr-note', t('dm.legend')));
    var sheet = el('div', 'sheet cmp-sheet');
    res.forEach(function (p) {
      var line = el('p', 'cmp-p cmp-' + p.type);
      var add = function (cls, s) { var n = el(cls === 'eq' ? 'span' : cls === 'ins' ? 'ins' : 'del', null, s); line.appendChild(n); };
      if (p.type === 'eq') add('eq', p.a);
      else if (p.type === 'ins') add('ins', p.b);
      else if (p.type === 'del') add('del', p.a);
      else p.ops.forEach(function (o) { add(o.t, o.s); });
      if (p.type !== 'eq') marks.push(line);
      sheet.appendChild(line);
    });
    panel.appendChild(sheet);
  }

  /* ---------- Ссылка и согласование ---------- */
  function partyFields(code) {
    var out = [];
    TPL.DOCS[code].steps.forEach(function (s) { s.fields.forEach(function (fid) { if (/^(cp_|w_)/.test(fid)) out.push(fid); }); });
    return out;
  }
  function renderShare(panel) {
    var v = last(rec), fields = partyFields(rec.code), canFill = fields.length && !v.edited;
    var box = el('section', 'sh-box');
    box.appendChild(el('h2', 'panel-title', t('dm.shTitle')));
    box.appendChild(el('p', 'lead-s', t('dm.shLead')));
    var mode = 'sign';
    var modes = el('div', 'sh-modes');
    [['sign', 'dm.mSign'], ['fill', 'dm.mFill']].forEach(function (m) {
      var lab = el('label', 'check'); var r = el('input'); r.type = 'radio'; r.name = 'sh-mode'; r.value = m[0];
      r.checked = m[0] === 'sign'; r.disabled = m[0] === 'fill' && !canFill;
      r.addEventListener('change', function () { mode = m[0]; });
      lab.appendChild(r); lab.appendChild(el('span', null, t(m[1]))); modes.appendChild(lab);
    });
    box.appendChild(modes);
    if (!canFill) box.appendChild(el('p', 'jr-note', t('dm.noFill')));
    box.appendChild(el('p', 'notice notice-warn', t('dm.pdWarn')));
    var okL = el('label', 'check'); var ok = el('input'); ok.type = 'checkbox';
    okL.appendChild(ok); okL.appendChild(el('span', null, t('dm.pdOk'))); box.appendChild(okL);
    var make = btn('btn btn-primary', t('dm.make'));
    var out = el('div', 'sh-out'), msg = el('p', 'msg');
    box.appendChild(make); box.appendChild(msg); box.appendChild(out);
    make.addEventListener('click', function () {
      if (!ok.checked) { flash(msg, t('dm.needOk'), true); return; }
      msg.textContent = '';
      var lang = v.lang || rec.lang, data = v.data || {};
      // Неизменённый документ передаётся данными и собирается заново у получателя; изменённый — текстом.
      var payload = { t: 'q', v: 1, id: rec.id, n: v.n, code: rec.code, lang: lang, number: rec.number, mode: mode,
        from: data.ip_name || '', hash: v.hash, at: Date.now() };
      if (v.edited) payload.blocks = v.blocks; else payload.data = data;
      if (mode === 'fill') payload.fields = fields;
      ST.encode(payload).then(function (code) {
        var url = location.origin + location.pathname.replace(/documents\.html$/, '') + 'share.html#' + code;
        out.textContent = '';
        var field = el('textarea', 'input sh-link'); field.readOnly = true; field.rows = 3; field.value = url;
        out.appendChild(field);
        out.appendChild(el('p', 'jr-note', f('dm.long', { n: url.length })));
        var row = el('div', 'sh-row');
        row.appendChild(btn('btn btn-ghost', t('dm.copy'), function (e) {
          var b = e.currentTarget;
          (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { b.textContent = t('dm.copied'); }, function () { field.select(); document.execCommand('copy'); b.textContent = t('dm.copied'); });
        }));
        if (navigator.share) row.appendChild(btn('btn btn-ghost', t('dm.shareBtn'), function () { navigator.share({ title: titleOf(rec), url: url }).catch(function () {}); }));
        out.appendChild(row);
        var badge = app.querySelector('.jr-head .jr-badge');
        if (badge && rec.status !== 'signed') { badge.className = 'jr-badge jr-sent'; badge.textContent = t('dm.s.sent'); }
        rec.shares = rec.shares || [];
        rec.shares.push({ at: Date.now(), n: v.n, mode: mode });
        if (rec.status !== 'signed') rec.status = 'sent';
        ST.put(rec);
      });
    });
    panel.appendChild(box);

    // Согласования
    var sg = el('section', 'sh-box');
    sg.appendChild(el('h2', 'panel-title', t('dm.signs')));
    var list = el('div', 'sg-list');
    (rec.signs || []).forEach(function (s) {
      var it = el('div', 'sg-item');
      var im = el('img'); im.src = s.img || window.DocumSign.draw(s.strokes); im.alt = s.name; im.width = 180; im.height = 60;
      it.appendChild(im);
      var info = el('div');
      info.appendChild(el('b', null, s.name));
      info.appendChild(el('p', 'jr-meta', (s.who === 'self' ? t('sg.me') : t('sg.other')) + ' · ' + fmt(s.at) + ' · ' + f('dm.ver', { n: s.n })));
      info.appendChild(el('p', s.ok ? 'sg-ok' : 'sg-bad', s.ok ? f('dm.okHash', { n: s.n }) : t('dm.badHash')));
      it.appendChild(info);
      list.appendChild(it);
    });
    if (!(rec.signs || []).length) list.appendChild(el('p', 'jr-note', t('dm.noSigns')));
    sg.appendChild(list);

    var self = btn('btn btn-ghost', t('dm.signSelf'));
    var padHost = el('div');
    self.addEventListener('click', function () {
      self.remove();
      window.DocumSign.pad(padHost, function (s) {
        rec.signs = rec.signs || [];
        rec.signs.push({ who: 'self', name: s.name, strokes: s.strokes, at: s.at, n: v.n, hash: v.hash, ok: true });
        ST.put(rec).then(renderDoc);
      });
    });
    sg.appendChild(self); sg.appendChild(padHost);

    var impL = el('label', 'label', t('dm.import')); impL.htmlFor = 'sh-import';
    var imp = el('textarea', 'input'); imp.id = 'sh-import'; imp.rows = 2; imp.placeholder = 'https://…/share.html#…';
    var impB = btn('btn btn-ghost', t('dm.importBtn')), impMsg = el('p', 'msg');
    sg.appendChild(impL); sg.appendChild(imp); sg.appendChild(impB); sg.appendChild(impMsg);
    impB.addEventListener('click', function () {
      var s = imp.value.trim(), k = s.indexOf('#');
      if (k < 0) { flash(impMsg, t('dm.badLink'), true); return; }
      ST.decode(s.slice(k + 1)).then(function (p) {
        if (!p || p.t !== 'r') throw new Error('bad');
        return ST.importResponse(p).then(function (r) { if (!r) throw new Error('nover'); rec = r; model = null; renderDoc(); });
      }).catch(function () { flash(impMsg, t('dm.badLink'), true); });
    });
    panel.appendChild(sg);
  }

  if (id) {
    ST.get(id).then(function (r) {
      if (!r) { renderList(); return; }
      rec = r; renderDoc();
    });
  } else renderList();

  document.addEventListener('docum:lang', function () { if (rec) renderDoc(); else renderList(); });
})();
