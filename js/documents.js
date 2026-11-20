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
  var ICON = {
    contracts: '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4M9.5 12h6M9.5 15.5h6"/>',
    accounting: '<path d="M6.5 3.5h11v17l-2.75-1.6-2.75 1.6-2.75-1.6-2.75 1.6z"/><path d="M9.5 8h5M9.5 11.5h5M9.5 15h3"/>',
    hr: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.7 3.4-5.6 7-5.6s6.2 1.9 7 5.6"/>'
  };
  function icon(code) {
    var cat = (TPL.DOCS[code] || {}).cat || 'contracts', w = el('span', 'jr-ico jr-ico-' + cat);
    w.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[cat] + '</svg>';
    return w;
  }
  // Путь документа: создан → изменён → отправлен → согласован.
  function flow(r) {
    var steps = [['created', true], ['edited', r.versions.length > 1], ['sent', (r.shares || []).length > 0 || r.status === 'sent' || r.status === 'signed'], ['signed', r.status === 'signed']];
    var w = el('ol', 'jr-flow');
    steps.forEach(function (s) { var li = el('li', s[1] ? 'is-on' : ''); li.appendChild(el('span', null, t('dm.flow.' + s[0]))); w.appendChild(li); });
    return w;
  }
  function draftTitle(d) {
    var num = d.data && d.data.number != null ? String(d.data.number).trim() : '';
    return t('d.' + d.code) + (num ? ' № ' + num : '');
  }
  function renderList() {
    app.textContent = '';
    var head = el('div', 'jr-top');
    var ht = el('div');
    ht.appendChild(el('h1', null, t('dm.title')));
    ht.appendChild(el('p', 'lead', t('dm.lead')));
    head.appendChild(ht);
    var add = el('a', 'btn btn-primary jr-new', t('dm.new')); add.href = 'constructor.html';
    head.appendChild(add);
    app.appendChild(head);

    var stats = el('div', 'jr-stats'), status = 'all';
    app.appendChild(stats);
    var sw = el('div', 'jr-search');
    sw.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>';
    var search = el('input', 'input'); search.type = 'search'; search.placeholder = t('dm.search'); search.setAttribute('aria-label', t('dm.search'));
    sw.appendChild(search);
    app.appendChild(sw);
    var drafts = el('section', 'jr-drafts'); drafts.id = 'drafts'; app.appendChild(drafts);
    var list = el('div', 'jr-list'); app.appendChild(list);
    var empty = el('div', 'jr-empty'); app.appendChild(empty);

    var tools = el('section', 'jr-backup');
    tools.appendChild(el('h2', null, t('dm.backupTitle')));
    tools.appendChild(el('p', 'jr-note', t('dm.backupNote')));
    var row = el('div', 'sh-row');
    var msg = el('p', 'msg');
    var file = el('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true;
    row.appendChild(btn('btn btn-ghost', t('dm.backup'), backup));
    row.appendChild(btn('btn btn-ghost', t('dm.restore'), function () { file.click(); }));
    tools.appendChild(row); tools.appendChild(file); tools.appendChild(msg);
    app.appendChild(tools);

    var all = [];
    function drawStats() {
      stats.textContent = '';
      var nd = window.DocumDrafts ? window.DocumDrafts.list().filter(function (d) { return TPL.DOCS[d.code]; }).length : 0;
      [['all', all.length + nd], ['draft', nd], ['final', 0], ['sent', 0], ['signed', 0]].forEach(function (k) {
        var n = k[0] === 'all' || k[0] === 'draft' ? k[1] : all.filter(function (r) { return r.status === k[0]; }).length;
        var b = btn('jr-stat jr-stat-' + k[0], null, function () { status = k[0]; drawStats(); draw(); });
        b.setAttribute('aria-pressed', String(status === k[0]));
        b.appendChild(el('b', null, String(n)));
        b.appendChild(el('span', null, k[0] === 'all' ? t('dm.k.all') : t('dm.s.' + k[0])));
        stats.appendChild(b);
      });
    }
    // Незаконченные документы (черновики конструктора) — здесь же, над готовыми.
    function drawDrafts() {
      var DR = window.DocumDrafts, q = search.value.trim().toLowerCase();
      drafts.textContent = '';
      if (!DR) return;
      var ds = DR.list().filter(function (d) { return TPL.DOCS[d.code] && draftTitle(d).toLowerCase().indexOf(q) >= 0; });
      if (!ds.length || (status !== 'all' && status !== 'draft')) return;
      drafts.appendChild(el('h2', 'jr-sub', t('dm.drafts') + ' · ' + ds.length));
      drafts.appendChild(el('p', 'jr-note', t('dm.draftsNote')));
      var box = el('div', 'jr-list');
      ds.forEach(function (d, i) {
        var card = el('article', 'jr-item jr-item-draft');
        card.style.setProperty('--i', i);
        var a = el('a', 'jr-main'); a.href = 'constructor.html?draft=' + encodeURIComponent(d.id);
        a.appendChild(icon(d.code));
        var tx = el('span', 'jr-txt');
        tx.appendChild(el('span', 'jr-title', draftTitle(d)));
        var steps = TPL.DOCS[d.code].steps.length + 1;
        tx.appendChild(el('span', 'jr-meta', f('dm.d.step', { n: d.step + 1, m: steps }) + ' · ' + f('dm.c.upd', { d: fmt(d.savedAt) })));
        a.appendChild(tx);
        card.appendChild(a);
        card.appendChild(el('span', 'jr-badge jr-draft', t('dm.s.draft')));
        var bar = el('span', 'jr-draft-bar'); var fill = el('i'); fill.style.width = Math.round((d.step + 1) / steps * 100) + '%'; bar.appendChild(fill);
        card.appendChild(bar);
        var del = btn('jr-del', null, function () { if (window.confirm(t('b.draftRemoveAsk'))) { DR.remove(d.id); drawStats(); draw(); } });
        del.setAttribute('aria-label', t('dm.del') + ': ' + draftTitle(d));
        del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l.8 12.2a1 1 0 0 0 1 .8h6.4a1 1 0 0 0 1-.8L17 7"/></svg>';
        card.appendChild(del);
        box.appendChild(card);
      });
      drafts.appendChild(box);
      if (all.length && status === 'all') drafts.appendChild(el('h2', 'jr-sub', t('dm.ready') + ' · ' + all.length));
    }
    function draw() {
      var q = search.value.trim().toLowerCase();
      drawDrafts();
      list.textContent = '';
      all.filter(function (r) {
        return (status === 'all' || r.status === status) && titleOf(r).toLowerCase().indexOf(q) >= 0;
      }).forEach(function (r, i) {
        var card = el('article', 'jr-item');
        card.style.setProperty('--i', i);
        var a = el('a', 'jr-main'); a.href = 'documents.html?id=' + r.id;
        a.appendChild(icon(r.code));
        var tx = el('span', 'jr-txt');
        tx.appendChild(el('span', 'jr-title', titleOf(r)));
        tx.appendChild(el('span', 'jr-meta', f('dm.c.ver', { n: r.versions.length }) + ' · ' + f('dm.c.upd', { d: fmt(r.updated) })));
        a.appendChild(tx);
        card.appendChild(a);
        card.appendChild(el('span', 'jr-badge jr-' + r.status, t('dm.s.' + r.status)));
        card.appendChild(flow(r));
        var del = btn('jr-del', null, function () { if (window.confirm(t('dm.delAsk'))) ST.del(r.id).then(load); });
        del.setAttribute('aria-label', t('dm.del') + ': ' + titleOf(r));
        del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l.8 12.2a1 1 0 0 0 1 .8h6.4a1 1 0 0 0 1-.8L17 7"/></svg>';
        card.appendChild(del);
        list.appendChild(card);
      });
      empty.textContent = '';
      if (!all.length && !drafts.childNodes.length && status === 'all' && !q) {
        var face = el('span', 'jr-empty-face');
        face.innerHTML = '<svg viewBox="6 5.5 28 30" aria-hidden="true"><path d="M12.5 7.5h11l6.5 6.5v18a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 10 32V10a2.5 2.5 0 0 1 2.5-2.5z" fill="#fff"/><path d="M23.5 7.5V14h6.5z" fill="#9CC8FF"/><circle cx="16.3" cy="20.5" r="1.7" fill="#0B1F3A"/><circle cx="23.7" cy="20.5" r="1.7" fill="#0B1F3A"/><path d="M16.8 26.4q3.2-2 6.4 0" fill="none" stroke="#0B1F3A" stroke-width="1.7" stroke-linecap="round"/></svg>';
        empty.appendChild(face);
        empty.appendChild(el('h2', null, t('dm.empty2')));
        empty.appendChild(el('p', null, t('dm.empty')));
        var go = el('a', 'btn btn-primary', t('dm.toBuilder')); go.href = 'constructor.html';
        empty.appendChild(go);
      }
    }
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
    function load() {
      ST.all().then(function (rows) {
        all = rows; drawStats(); draw();
        if (location.hash === '#drafts' && drafts.childNodes.length) drafts.scrollIntoView({ block: 'start' });
      });
    }
    load();
  }

  /* ================= Карточка документа ================= */
  var rec = null, model = null, undo = [], redo = [], dirty = false, focusIdx = -1, tab = 'edit';

  function renderDoc() {
    app.textContent = '';
    var back = el('a', 'crumb', t('dm.back')); back.href = 'documents.html';
    app.appendChild(back);
    var head = el('div', 'jr-hero');
    head.appendChild(icon(rec.code));
    var hx = el('div', 'jr-hero-txt');
    var h1 = el('h1', 'builder-title', titleOf(rec));
    hx.appendChild(h1);
    hx.appendChild(el('p', 'jr-meta', f('dm.created', { d: fmt(rec.created) }) + ' · ' + f('dm.c.ver', { n: rec.versions.length }) + ' · ' + f('dm.c.upd', { d: fmt(rec.updated) })));
    head.appendChild(hx);
    head.appendChild(el('span', 'jr-badge jr-' + rec.status, t('dm.s.' + rec.status)));
    app.appendChild(head);
    app.appendChild(flow(rec));
    var tabs = el('div', 'jr-tabs'); tabs.setAttribute('role', 'tablist');
    var panel = el('div', 'jr-panel');
    [['edit', 'dm.t.edit'], ['ver', 'dm.t.ver'], ['cmp', 'dm.t.cmp'], ['share', 'dm.t.share'], ['ecp', 'dm.t.ecp']].forEach(function (x) {
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
    else if (tab === 'ecp') renderEcp(panel);
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
      acts.appendChild(btn('link-btn', '.docx', function () { EX.downloadDocx(stamped(v), 'docum-' + rec.code + '-v' + v.n); }));
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
  // Свои данные вписывает вторая сторона договора, счёта и акта, а в трудовом договоре — работник.
  // Приказы и справку оформляет работодатель: там вторая сторона только знакомится и согласует.
  var FILLABLE = { services: 1, invoice: 1, act: 1, employment: 1 };
  function partyFields(code) {
    var out = [];
    if (!FILLABLE[code]) return out;
    TPL.DOCS[code].steps.forEach(function (s) { s.fields.forEach(function (fid) { if (/^(cp_|w_)/.test(fid)) out.push(fid); }); });
    return out;
  }
  function renderShare(panel) {
    var v = last(rec), fields = partyFields(rec.code), canFill = fields.length && !v.edited;
    var box = el('section', 'sh-box');
    box.appendChild(el('h2', 'panel-title', t('dm.shTitle')));
    box.appendChild(el('p', 'lead-s', t('dm.shLead')));
    var mode = 'sign';
    var step = function (n, title) { var h = el('h3', 'sh-step'); h.appendChild(el('span', 'sh-num', String(n))); h.appendChild(el('span', null, title)); return h; };
    box.appendChild(step(1, t('dm.step1')));
    var modes = el('div', 'sh-modes');
    [['sign', 'dm.mSign', 'dm.mSignD'], ['fill', 'dm.mFill', 'dm.mFillD']].forEach(function (m) {
      var lab = el('label', 'sh-mode'); var r = el('input'); r.type = 'radio'; r.name = 'sh-mode'; r.value = m[0];
      r.checked = m[0] === 'sign'; r.disabled = m[0] === 'fill' && !canFill;
      r.addEventListener('change', function () { mode = m[0]; });
      var tx = el('span'); tx.appendChild(el('b', null, t(m[1]))); tx.appendChild(el('span', null, t(m[2])));
      lab.appendChild(r); lab.appendChild(tx); modes.appendChild(lab);
    });
    box.appendChild(modes);
    if (!canFill) box.appendChild(el('p', 'jr-note', t('dm.noFill')));
    box.appendChild(step(2, t('dm.step2')));
    box.appendChild(el('p', 'notice notice-warn', t('dm.pdWarn')));
    var okL = el('label', 'check'); var ok = el('input'); ok.type = 'checkbox';
    okL.appendChild(ok); okL.appendChild(el('span', null, t('dm.pdOk'))); box.appendChild(okL);
    box.appendChild(step(3, t('dm.step3')));
    var make = btn('btn btn-primary', t('dm.make'));
    var out = el('div', 'sh-out'), msg = el('p', 'msg');
    box.appendChild(make); box.appendChild(msg); box.appendChild(out);
    make.addEventListener('click', function () {
      if (!ok.checked) { flash(msg, t('dm.needOk'), true); return; }
      msg.textContent = '';
      var lang = v.lang || rec.lang, data = v.data || {};
      // В ссылке — данные анкеты и правки относительно шаблона; получатель собирает документ и сверяет отпечаток.
      var payload = { t: 'q', v: 1, id: rec.id, n: v.n, code: rec.code, lang: lang, number: rec.number, mode: mode,
        from: data.ip_name || '', hash: v.hash, at: Date.now(), vat: v.at, data: data };
      if (v.edited) payload.patch = ST.patch(TPL.build(rec.code, data, lang), v.blocks);
      if (mode === 'fill') payload.fields = fields;
      ST.encode(payload).then(function (code) {
        var url = location.origin + location.pathname.replace(/documents\.html$/, '') + 'share.html#' + code;
        out.textContent = '';
        var field = el('textarea', 'input sh-link'); field.readOnly = true; field.rows = 3; field.value = url;
        out.appendChild(field);
        // Лимит одного сообщения Telegram — 4096 символов.
        var fits = url.length <= 4000, meter = el('div', 'sh-meter' + (fits ? '' : ' is-long'));
        var bar = el('span'); bar.style.width = Math.min(100, url.length / 40) + '%'; meter.appendChild(bar);
        out.appendChild(meter);
        out.appendChild(el('p', 'jr-note', f('dm.long', { n: url.length }) + ' · ' + t(fits ? 'dm.okLen' : 'dm.longLen')));
        var row = el('div', 'sh-row');
        row.appendChild(btn('btn btn-primary', t('dm.copy'), function (e) {
          var b = e.currentTarget;
          (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { b.textContent = t('dm.copied'); }, function () { field.select(); document.execCommand('copy'); b.textContent = t('dm.copied'); });
        }));
        if (navigator.share) row.appendChild(btn('btn btn-ghost', t('dm.shareBtn'), function () { navigator.share({ title: titleOf(rec), url: url }).catch(function () {}); }));
        // Запасной путь для длинных документов: тот же запрос файлом, его открывают на странице share.html.
        row.appendChild(btn('btn btn-ghost', t('dm.file'), function () {
          var blob = new Blob([JSON.stringify({ app: 'docum.kz', kind: 'share', data: code })], { type: 'application/json' });
          var a = document.createElement('a'), u = URL.createObjectURL(blob);
          a.href = u; a.download = 'docum-' + rec.code + '-' + (rec.number || rec.id.slice(0, 6)) + '.docum.json';
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 2000);
        }));
        out.appendChild(row);
        var badge = app.querySelector('.jr-hero .jr-badge');
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
      if (s.ecp) it.appendChild(el('span', 'ecp-tag', t('ec.tag')));
      else { var im = el('img'); im.src = s.img || window.DocumSign.draw(s.strokes); im.alt = s.name; im.width = 180; im.height = 60; it.appendChild(im); }
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

  /* ---------- Подписание ЭЦП через NCALayer ---------- */
  var E = window.DocumEcp;
  function sha(u8) { return crypto.subtle.digest('SHA-256', u8).then(function (h) { return E.hex(new Uint8Array(h)); }); }
  function fdate(ms) { return ms ? fmt(ms).slice(0, 10) : '—'; }
  function pdfOf(v) { return EX.pdfBytes(v.blocks, v.at); }
  // Версия с штампами всех ЭЦП, которыми она подписана: для печати и Word.
  // Подписывается всегда чистый PDF версии (pdfOf), штамп в подписанное содержимое не входит.
  function stamped(v) {
    var out = clone(v.blocks);
    (rec.ecp || []).forEach(function (r) { if (r.n === v.n) out.push(r.stamp || E.stamp(r, v.lang || rec.lang)); });
    return out;
  }
  // Подпись → запись журнала: кто подписал, какую версию, результаты проверок.
  // kind 'cms' — CMS с PDF внутри (.cms); 'pades' — отсоединённая CMS внутри PDF, content — подписанные байты PDF.
  var PA = window.DocumPades;
  // PDF для PAdES: версия и, если есть, штамп ЭЦП внутри подписываемого содержимого.
  function padesOf(v, stampB) {
    var bytes = stampB ? EX.pdfBytes(v.blocks.concat([stampB]), v.at) : pdfOf(v);
    return bytes.then(function (pdf) { return PA.prepare(pdf, v.at); });
  }
  function ecpRecord(cmsB64, who, opt) {
    opt = opt || {};
    var kind = opt.kind || 'cms';
    var p = E.parse(E.unb64(cmsB64));
    if (!p.content && opt.content) p.content = opt.content;
    return Promise.all([E.verify(p), p.content ? sha(p.content) : Promise.resolve('')]).then(function (r) {
      var res = r[0], ch = r[1], plain = '';
      // Какая версия подписана: собираем подписываемые байты каждой версии и сравниваем.
      var vs = rec.versions.slice().reverse(), i = 0;
      function next() {
        if (i >= vs.length) return Promise.resolve(null);
        var v = vs[i++];
        return pdfOf(v).then(function (pdf) {
          var prep = kind === 'pades' ? (opt.stamp ? padesOf(v, opt.stamp) : Promise.resolve(PA.prepare(pdf, v.at))) : null;
          return Promise.resolve(prep).then(function (pp) { return Promise.all([sha(pp ? pp.toSign : pdf), sha(pdf)]); });
        }).then(function (h) { if (h[0] === ch) { plain = h[1]; return v.n; } return next(); });
      }
      return next().then(function (n) {
        var inf = p.info, t0 = p.attrs.time || Date.now();
        return { who: who, kind: kind, at: Date.now(), n: n, cms: cmsB64, contentHash: plain || ch, serial: inf.serial || '', stamp: opt.stamp || null,
          cn: (inf.subject || {}).cn || '', given: (inf.subject || {}).given || '', iin: inf.iin || '', bin: inf.bin || '', org: (inf.subject || {}).org || '',
          issuer: (inf.issuer || {}).cn || '', from: inf.notBefore, to: inf.notAfter, time: p.attrs.time || null,
          alg: E.alg(p.sigAlg).n + ' / ' + E.alg(p.digestAlg).n, digest: res.digest, crypto: res.crypto, gost: res.gost,
          valid: inf.notBefore && inf.notAfter ? (t0 >= inf.notBefore && t0 <= inf.notAfter) : null };
      });
    });
  }
  var justSigned = -1;
  function renderEcp(panel) {
    var intro = el('section', 'sh-box ecp-intro');
    intro.appendChild(el('h2', 'panel-title', t('ec.title')));
    intro.appendChild(el('p', 'lead-s', t('ec.lead')));
    var stRow = el('div', 'ecp-status'), dot = el('span', 'ecp-dot'), stTx = el('span', null, t('ec.unknown'));
    stRow.appendChild(dot); stRow.appendChild(stTx);
    var chk = btn('btn btn-ghost', t('ec.check'), function () {
      stTx.textContent = t('ec.checking'); dot.className = 'ecp-dot';
      E.check().then(function (r) { dot.className = 'ecp-dot is-ok'; stTx.textContent = f('ec.ok', { v: r.version || '?' }); })
        .catch(function () { dot.className = 'ecp-dot is-bad'; stTx.textContent = t('ec.none'); });
    });
    stRow.appendChild(chk);
    intro.appendChild(stRow);
    var inst = el('p', 'jr-note'); inst.appendChild(document.createTextNode(t('ec.install') + ' '));
    var a = el('a', null, 'ncl.pki.gov.kz'); a.href = 'https://ncl.pki.gov.kz/'; a.target = '_blank'; a.rel = 'noopener'; inst.appendChild(a);
    intro.appendChild(inst);
    var v = last(rec), msg = el('p', 'msg'); msg.setAttribute('role', 'status');
    var go = btn('btn btn-primary ecp-sign', f('ec.sign', { n: v.n }), function () {
      go.disabled = true; flash(msg, t('ec.prep'));
      // Штамп (отметка и время) входит в PDF до подписи, NCALayer подписывает этот PDF один раз,
      // подпись встаёт внутрь файла (PAdES). Получается один PDF: и штамп, и настоящая подпись.
      var prep = null, stampB = E.stamp({ time: Date.now() }, v.lang || rec.lang);
      padesOf(v, stampB).then(function (pp) {
        prep = pp;
        flash(msg, t('ec.confirm'));
        return E.sign(E.b64(prep.toSign), true);
      }).then(function (cms) {
        return ecpRecord(cms, 'self', { kind: 'pades', content: prep.toSign, stamp: stampB });
      }).then(function (r) {
        rec.ecp = rec.ecp || []; rec.ecp.push(r); rec.status = 'signed';
        justSigned = rec.ecp.length - 1;
        return ST.put(rec).then(function () { renderDoc(); });
      }).catch(function (e) {
        go.disabled = false;
        var code = e && e.code;
        flash(msg, code === 'noLayer' ? t('ec.none') : code === 'cancel' ? t('ec.cancel') : code === 'timeout' ? t('ec.timeout') : f('ec.err', { m: (e && e.message) || '' }), true);
      });
    });
    intro.appendChild(go); intro.appendChild(msg);
    panel.appendChild(intro);

    var list = el('section', 'sh-box');
    list.appendChild(el('h2', 'panel-title', t('ec.list')));
    (rec.ecp || []).forEach(function (r, i) {
      var card = el('article', 'ecp-card');
      var top = el('div', 'ecp-top');
      var av = el('span', 'ecp-av', (r.cn || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join(''));
      top.appendChild(av);
      var nm = el('div');
      nm.appendChild(el('b', null, [r.cn, r.given].filter(Boolean).join(' ')));
      nm.appendChild(el('p', 'jr-meta', (r.who === 'self' ? t('sg.me') : t('sg.other')) + ' · ' + (r.kind === 'pades' ? 'PAdES' : 'CAdES (.cms)') + (r.org ? ' · ' + r.org : '')));
      top.appendChild(nm);
      top.appendChild(el('span', 'jr-badge ' + (r.n && r.digest !== 'fail' && r.crypto !== 'fail' ? 'jr-signed' : 'jr-sent'), r.n ? f('dm.ver', { n: r.n }) : t('ec.noVer')));
      card.appendChild(top);
      var dl = el('dl', 'ecp-dl');
      var row = function (k, val) { if (!val) return; dl.appendChild(el('dt', null, t(k))); dl.appendChild(el('dd', null, val)); };
      row('ec.iin', r.iin); row('ec.bin', r.bin); row('ec.issuer', r.issuer);
      row('ec.valid', fdate(r.from) + ' — ' + fdate(r.to)); row('ec.time', r.time ? fmt(r.time) : ''); row('ec.alg', r.alg);
      card.appendChild(dl);
      var checks = el('ul', 'ecp-checks');
      var ck = function (state, text) { var li = el('li', 'is-' + state); li.appendChild(el('span', null, text)); checks.appendChild(li); };
      ck(r.n ? 'ok' : 'fail', r.n ? f('ec.docOk', { n: r.n }) : t('ec.docBad'));
      ck(r.digest === 'ok' ? 'ok' : r.digest === 'fail' ? 'fail' : 'skip', r.digest === 'ok' ? t('ec.digOk') : r.digest === 'fail' ? t('ec.digBad') : t('ec.digSkip'));
      ck(r.crypto === 'ok' ? 'ok' : r.crypto === 'fail' ? 'fail' : 'skip', r.crypto === 'ok' ? t('ec.cryOk') : r.crypto === 'fail' ? t('ec.cryBad') : t('ec.crySkip'));
      ck(r.valid === true ? 'ok' : r.valid === false ? 'fail' : 'skip', r.valid === true ? t('ec.certOk') : r.valid === false ? t('ec.certBad') : t('ec.certSkip'));
      card.appendChild(checks);
      var v = r.n ? rec.versions[r.n - 1] : null;
      var acts = el('div', 'ecp-dls');
      var base = fileName(rec).replace(/-v\d+$/, '') + (v ? '-v' + v.n : '') + '-ecp' + (i + 1);
      if (r.kind === 'pades' && v) {
        var padBtn = btn('btn btn-primary', '', function () {
          padBtn.disabled = true;
          padesOf(v, r.stamp).then(function (pp) {
            EX.saveBlob(new Blob([PA.embed(pp, E.unb64(r.cms))], { type: 'application/pdf' }), base + '-signed.pdf');
          }).then(function () { padBtn.disabled = false; }, function () { padBtn.disabled = false; });
        });
        padBtn.appendChild(el('b', null, t(r.stamp ? 'ec.dlPadesStamp' : 'ec.dlPades')));
        padBtn.appendChild(el('small', null, t(r.stamp ? 'ec.dlPadesStampSub' : 'ec.dlPadesSub')));
        acts.appendChild(padBtn);
      } else {
        var cmsBtn = btn('btn btn-primary', '', function () {
          EX.saveBlob(new Blob([E.unb64(r.cms)], { type: 'application/pkcs7-signature' }), base + '.cms');
        });
        cmsBtn.appendChild(el('b', null, t('ec.dlCms')));
        cmsBtn.appendChild(el('small', null, t('ec.dlCmsSub')));
        acts.appendChild(cmsBtn);
      }
      // PAdES — подпись уже в PDF, отдельный «PDF со штампом» не нужен. Для .cms PDF со штампом — единственный PDF для печати.
      if (v && r.kind !== 'pades') {
        var pdfBtn = btn('btn btn-ghost', '', function () {
          pdfBtn.disabled = true;
          EX.pdfBytes(stamped(v), v.at).then(function (pdf) {
            EX.saveBlob(new Blob([pdf], { type: 'application/pdf' }), base + '-stamp.pdf');
          }).then(function () { pdfBtn.disabled = false; }, function () { pdfBtn.disabled = false; });
        });
        pdfBtn.appendChild(el('b', null, t('ec.dlPdf')));
        pdfBtn.appendChild(el('small', null, t('ec.dlPdfSub')));
        acts.appendChild(pdfBtn);
      }
      if (v) {
        var docBtn = btn('btn btn-ghost', '', function () { EX.downloadDocx(stamped(v), base + '-stamp'); });
        docBtn.appendChild(el('b', null, t('ec.dlDocx')));
        docBtn.appendChild(el('small', null, t('ec.dlDocxSub')));
        acts.appendChild(docBtn);
      }
      card.appendChild(acts);
      card.appendChild(el('p', 'jr-note ecp-howto', t(r.kind === 'pades' ? 'ec.howtoPades' : 'ec.howto')));
      if (i === justSigned) { card.classList.add('is-new'); window.setTimeout(function () { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); justSigned = -1; }
      card.appendChild(acts);
      list.appendChild(card);
    });
    if (!(rec.ecp || []).length) list.appendChild(el('p', 'jr-note', t('ec.empty')));

    var file = el('input'); file.type = 'file'; file.accept = '.cms,.p7s,.sig,.pdf,application/pkcs7-signature,application/pdf'; file.hidden = true;
    var impMsg = el('p', 'msg');
    var imp = btn('btn btn-ghost', t('ec.import'), function () { file.click(); });
    file.addEventListener('change', function () {
      var fl = file.files[0]; if (!fl) return;
      fl.arrayBuffer().then(function (buf) {
        var u8 = new Uint8Array(buf), known = (rec.ecp || []).map(function (x) { return x.cms; });
        var jobs;
        if (PA.isPdf(u8)) {
          // Подписанный PDF (PAdES): каждая подпись файла — отдельная запись.
          var sigs = PA.read(u8);
          if (!sigs.length) throw new Error('no-sig');
          jobs = sigs.map(function (sg) { return { b64: E.b64(sg.cms), opt: { kind: 'pades', content: sg.signed } }; });
        } else {
          var txt = new TextDecoder().decode(u8.subarray(0, 20));
          var b64 = /^[A-Za-z0-9+\/=\s-]+$/.test(txt) && u8[0] !== 0x30 ? new TextDecoder().decode(u8).replace(/-----[^-]+-----/g, '') : E.b64(u8);
          jobs = [{ b64: b64.replace(/\s+/g, ''), opt: {} }];
        }
        jobs = jobs.filter(function (j) { return known.indexOf(j.b64) < 0; });
        if (!jobs.length) { flash(impMsg, t('ec.dup')); return null; }
        return Promise.all(jobs.map(function (j) { return ecpRecord(j.b64, 'other', j.opt); }));
      }).then(function (rs) {
        if (!rs) return;
        rec.ecp = rec.ecp || [];
        rs.forEach(function (r) { rec.ecp.push(r); });
        return ST.put(rec).then(renderDoc);
      }).catch(function () { flash(impMsg, t('ec.badFile'), true); });
      file.value = '';
    });
    list.appendChild(el('p', 'jr-note', t('ec.importNote')));
    list.appendChild(imp); list.appendChild(file); list.appendChild(impMsg);
    panel.appendChild(list);
    panel.appendChild(el('p', 'sign-legal', t('ec.legal')));
  }

  if (id) {
    ST.get(id).then(function (r) {
      if (!r) { renderList(); return; }
      rec = r; renderDoc();
    });
  } else renderList();

  document.addEventListener('docum:lang', function () { if (rec) renderDoc(); else renderList(); });
})();
