/* docum.kz — пошаговый конструктор.
   Введённые данные живут в переменной state и никуда не отправляются.
   В браузере они остаются, только если пользователь сам сохранил черновик. */
(function () {
  'use strict';
  var L = window.DocumLogic, TPL = window.DocumTemplates, EX = window.DocumExport, DR = window.DocumDrafts;
  var t = window.t;
  var root = document.getElementById('builder');
  if (!root) return;

  var state = { code: null, step: 0, data: {}, msgs: {}, itemMsgs: {}, draftId: null, draftNote: '', prefilled: {}, docLang: null, docLangSet: false };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function doc() { return TPL.DOCS[state.code]; }
  function stepCount() { return doc().steps.length + 1; }
  function isReview() { return state.step === doc().steps.length; }
  function stepTitle(i) { return i < doc().steps.length ? t(doc().steps[i].key) : t('s.review'); }
  function visible(id) {
    var f = TPL.FIELDS[id];
    return !f.showIf || f.showIf(state.data);
  }
  function itemsField() {
    var hit = null;
    doc().steps.forEach(function (s) { s.fields.forEach(function (id) { if (TPL.FIELDS[id].type === 'items') hit = id; }); });
    return hit;
  }

  function start(code) {
    state.code = code; state.step = 0; state.data = {}; state.msgs = {}; state.itemMsgs = {};
    state.draftId = null; state.draftNote = ''; state.prefilled = {}; state.journalId = null;
    state.docLang = window.getLang(); state.docLangSet = false;
    var profile = DR.getProfile();
    doc().steps.forEach(function (s) {
      s.fields.forEach(function (id) {
        var f = TPL.FIELDS[id];
        if (f.type === 'items') state.data[id] = [{}];
        else if (f.type === 'check') state.data[id] = false;
        else state.data[id] = f.init !== undefined ? f.init : '';
        if (profile[id]) { state.data[id] = profile[id]; state.prefilled[id] = true; }
      });
    });
    render();
  }

  function openDraft(d) {
    state.code = d.code; state.step = d.step; state.data = d.data; state.msgs = {}; state.itemMsgs = {};
    state.draftId = d.id; state.draftNote = t('b.draftOpened'); state.prefilled = {}; state.journalId = null;
    state.docLang = d.lang || window.getLang(); state.docLangSet = !!d.lang;
    // Предупреждения пройденных шагов нужны на шаге проверки и после открытия черновика.
    doc().steps.forEach(function (s, i) {
      if (i >= state.step) return;
      s.fields.forEach(function (id) {
        var f = TPL.FIELDS[id];
        if (f.type === 'items' || !visible(id)) return;
        var r = checkOne(f, id);
        if (r && r.type === 'warn') state.msgs[id] = r;
      });
    });
    render();
  }

  /* ---------- Черновик ---------- */
  function draftsLink() {
    var dl = el('a', 'crumb crumb-right', t('b.drafts'));
    dl.href = 'profile.html#drafts';
    return dl;
  }
  function renderDraftBar() {
    var bar = el('div', 'draft-bar');
    var b = el('button', 'btn btn-ghost', t('b.draftSave'));
    b.type = 'button'; b.id = 'btn-draft';
    var st = el('p', 'msg', state.draftNote);
    st.id = 'draft-status';
    st.setAttribute('role', 'status');
    b.addEventListener('click', function () {
      var id = DR.save(state.draftId, state.code, state.step, state.data, state.docLang);
      if (id) {
        state.draftId = id;
        state.draftNote = t('b.draftDone') + ' ' + DR.fmtSaved(Date.now());
        st.textContent = state.draftNote;
        st.className = 'msg';
        var head = root.querySelector('.builder-head');
        if (head && !head.querySelector('.crumb-right')) head.insertBefore(draftsLink(), head.querySelector('.builder-title'));
      } else {
        state.draftNote = '';
        st.textContent = t('e.draft');
        st.className = 'msg msg-error';
      }
    });
    bar.appendChild(b);
    bar.appendChild(st);
    bar.appendChild(el('p', 'hint', t('b.draftNote')));
    return bar;
  }

  /* ---------- Избранное: коды документов в браузере ---------- */
  var FAV_KEY = 'docum-favs';
  function favList() {
    try { var a = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function favSave(a) { try { localStorage.setItem(FAV_KEY, JSON.stringify(a)); } catch (e) { /* не критично */ } }
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.6l6-.9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  /* ---------- Выбор документа ---------- */
  function renderPicker() {
    root.textContent = '';
    var head = el('div', 'page-head');
    head.appendChild(el('h1', null, t('b.pickTitle')));
    head.appendChild(el('p', 'lead', t('b.pickLead')));
    root.appendChild(head);

    var count = DR.list().length, hasProfile = DR.hasProfile();
    if (count || !hasProfile) {
      var tip = el('p', 'notice notice-info');
      var link = el('a', null, count ? t('b.toDrafts').replace('{n}', count) : t('b.toProfile'));
      link.href = count ? 'profile.html#drafts' : 'profile.html';
      tip.appendChild(link);
      root.appendChild(tip);
    }

    var search = el('div', 'search');
    var label = el('label', 'label', t('cat.searchLabel'));
    label.htmlFor = 'doc-search';
    var input = el('input', 'input');
    input.id = 'doc-search'; input.type = 'search'; input.autocomplete = 'off';
    input.placeholder = t('cat.search');
    search.appendChild(label); search.appendChild(input);
    root.appendChild(search);

    var chips = el('div', 'chips'), cat = 'all', rows = [];
    var empty = el('p', 'empty', t('c.empty'));
    var favs = favList();
    var apply = function () {
      var q = input.value.trim().toLowerCase(), shown = 0;
      rows.forEach(function (r) {
        var inCat = cat === 'all' || (cat === 'fav' ? favs.indexOf(r.code) >= 0 : r.cat === cat);
        var ok = inCat && r.text.toLowerCase().indexOf(q) >= 0;
        r.node.hidden = !ok;
        if (ok) shown++;
      });
      empty.textContent = cat === 'fav' && !favs.length ? t('c.favEmpty') : t('c.empty');
      empty.hidden = shown > 0;
    };
    // Избранные документы стоят первыми; перестановка анимируется (FLIP).
    var order = function (animate) {
      var before = {};
      if (animate) rows.forEach(function (r) { if (!r.node.hidden) before[r.code] = r.node.getBoundingClientRect(); });
      rows.slice().sort(function (a, b) {
        var fa = favs.indexOf(a.code) >= 0 ? 0 : 1, fb = favs.indexOf(b.code) >= 0 ? 0 : 1;
        return fa - fb || a.i - b.i;
      }).forEach(function (r) { grid.appendChild(r.node); });
      if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      rows.forEach(function (r) {
        var old = before[r.code];
        if (!old || r.node.hidden) return;
        var now = r.node.getBoundingClientRect(), dx = old.left - now.left, dy = old.top - now.top;
        if (!dx && !dy) return;
        r.node.style.transition = 'none';
        r.node.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        void r.node.offsetWidth;
        r.node.style.transition = 'transform .45s cubic-bezier(.32, .72, 0, 1)';
        r.node.style.transform = '';
      });
    };
    ['all', 'fav', 'contracts', 'accounting', 'hr'].forEach(function (c) {
      var b = el('button', 'chip', t('cat.' + c));
      b.type = 'button'; b.setAttribute('aria-pressed', String(c === 'all'));
      b.addEventListener('click', function () {
        cat = c;
        chips.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        apply();
      });
      chips.appendChild(b);
    });
    root.appendChild(chips);
    input.addEventListener('input', apply);

    var grid = el('div', 'doc-list');
    Object.keys(TPL.DOCS).forEach(function (code, i) {
      var item = el('div', 'doc-item');
      var a = el('a', 'doc-row');
      a.href = 'constructor.html?doc=' + code;
      a.appendChild(el('span', 'doc-row-title', t('d.' + code)));
      a.appendChild(el('span', 'doc-row-text', t('dd.' + code)));
      a.appendChild(el('span', 'doc-row-meta', t('db.' + code)));
      var star = el('button', 'fav-btn');
      star.type = 'button';
      star.innerHTML = STAR;
      var mark = function () {
        var on = favs.indexOf(code) >= 0;
        star.setAttribute('aria-pressed', String(on));
        star.setAttribute('aria-label', t(on ? 'a.favDel' : 'a.favAdd') + ': ' + t('d.' + code));
      };
      mark();
      star.addEventListener('click', function () {
        var k = favs.indexOf(code);
        if (k >= 0) favs.splice(k, 1); else favs.push(code);
        favSave(favs);
        mark();
        star.classList.remove('is-pop'); void star.offsetWidth; star.classList.add('is-pop');
        apply();
        order(true);
      });
      item.appendChild(a);
      item.appendChild(star);
      rows.push({ node: item, cat: TPL.DOCS[code].cat, code: code, i: i, text: a.textContent });
    });
    root.appendChild(grid);
    order(false);
    empty.hidden = true;
    root.appendChild(empty);
  }

  /* ---------- Каркас шага ---------- */
  var lastStep = -1, lastCode = '';
  function render(focusId) {
    document.body.classList.toggle('is-building', !!state.code);
    if (!state.code) { renderPicker(); return; }
    root.textContent = '';

    var head = el('div', 'builder-head');
    var back = el('a', 'crumb', t('b.allDocs'));
    back.href = 'constructor.html';
    head.appendChild(back);
    if (DR.list().length) head.appendChild(draftsLink());
    head.appendChild(el('h1', 'builder-title', t('d.' + state.code)));
    root.appendChild(head);

    var wrap = el('div', 'builder');

    var nav = el('ol', 'steps');
    nav.setAttribute('aria-label', t('b.stepsLabel'));
    for (var i = 0; i < stepCount(); i++) {
      var li = el('li', 'step' + (i === state.step ? ' is-current' : '') + (i < state.step ? ' is-done' : ''));
      if (i === state.step) li.setAttribute('aria-current', 'step');
      var inner;
      if (i < state.step) {
        inner = el('button', 'step-btn');
        inner.type = 'button';
        (function (n) { inner.addEventListener('click', function () { state.step = n; render(); scrollTop(); }); })(i);
      } else inner = el('span', 'step-btn');
      inner.appendChild(el('span', 'step-num', String(i + 1)));
      inner.appendChild(el('span', 'step-name', stepTitle(i)));
      li.appendChild(inner);
      nav.appendChild(li);
    }
    wrap.appendChild(nav);

    var main = el('div', 'panel');
    main.appendChild(el('p', 'step-count', t('b.stepOf').replace('{n}', state.step + 1).replace('{m}', stepCount())));
    main.appendChild(el('h2', 'panel-title', stepTitle(state.step)));
    main.appendChild(renderProgress());

    if (isReview()) renderReview(main);
    else renderFields(main);
    main.appendChild(renderDraftBar());

    wrap.appendChild(main);
    root.appendChild(wrap);
    root.appendChild(renderActions());
    fillSummary();
    updateProgress();
    // Новый шаг плавно появляется; перерисовка того же шага (выбор в списке) не анимируется.
    if (state.step !== lastStep || state.code !== lastCode) wrap.classList.add('is-enter');
    lastStep = state.step; lastCode = state.code;

    if (focusId) {
      var f = document.getElementById(focusId);
      if (f) f.focus();
    }
  }

  /* ---------- Полоса заполнения: обязательные поля всех шагов ---------- */
  function progress() {
    var tot = 0, ok = 0;
    doc().steps.forEach(function (s) {
      s.fields.forEach(function (id) {
        var f = TPL.FIELDS[id];
        if (!visible(id) || f.optional) return;
        tot++;
        var v = state.data[id], filled;
        if (f.type === 'items') filled = Array.isArray(v) && v.length > 0 && v.every(function (it) { return !L.isEmpty(it.name); });
        else if (f.type === 'check') filled = !!v;
        else {
          filled = !L.isEmpty(v);
          if (filled && f.type !== 'select') { var r = checkOne(f, id); if (r && r.type === 'error') filled = false; }
        }
        if (filled) ok++;
      });
    });
    return { ok: ok, tot: tot };
  }
  var lastPct = 0;
  function renderProgress() {
    var box = el('div', 'fill');
    box.setAttribute('role', 'progressbar');
    box.setAttribute('aria-valuemin', '0');
    box.setAttribute('aria-label', t('b.fillLabel'));
    var top = el('div', 'fill-top');
    top.appendChild(el('span', null, t('b.fill')));
    top.appendChild(el('span', 'fill-num'));
    var track = el('div', 'fill-track');
    var bar = el('i');
    bar.style.width = lastPct + '%';
    track.appendChild(bar);
    box.appendChild(top); box.appendChild(track);
    return box;
  }
  function updateProgress() {
    var box = root.querySelector('.fill');
    if (!box) return;
    var p = progress(), pct = p.tot ? Math.round(p.ok / p.tot * 100) : 100;
    box.setAttribute('aria-valuemax', String(p.tot));
    box.setAttribute('aria-valuenow', String(p.ok));
    box.setAttribute('aria-valuetext', t('b.fillOf').replace('{n}', p.ok).replace('{m}', p.tot));
    box.querySelector('.fill-num').textContent = t('b.fillOf').replace('{n}', p.ok).replace('{m}', p.tot);
    box.classList.toggle('is-full', p.ok === p.tot);
    var bar = box.querySelector('i');
    window.requestAnimationFrame(function () { bar.style.width = pct + '%'; });
    lastPct = pct;
  }

  function renderActions() {
    var bar = el('div', 'action-bar');
    var inner = el('div', 'action-inner');
    if (state.step > 0) {
      var b = el('button', 'btn btn-ghost', t('b.back'));
      b.type = 'button';
      b.addEventListener('click', function () { state.step--; render(); scrollTop(); });
      inner.appendChild(b);
    }
    if (!isReview()) {
      var n = el('button', 'btn btn-primary', t('b.next'));
      n.type = 'button'; n.id = 'btn-next';
      n.addEventListener('click', next);
      inner.appendChild(n);
    } else {
      var d = el('button', 'btn btn-primary', t('b.docx'));
      d.type = 'button'; d.id = 'btn-docx';
      d.addEventListener('click', function () { download('docx', d); });
      var p = el('button', 'btn btn-primary', t('b.pdf'));
      p.type = 'button'; p.id = 'btn-pdf';
      p.addEventListener('click', function () { download('pdf', p); });
      inner.appendChild(d); inner.appendChild(p);
    }
    bar.appendChild(inner);
    return bar;
  }

  function scrollTop() { window.scrollTo({ top: 0 }); }

  /* ---------- Поля ---------- */
  function renderFields(main) {
    var fields = doc().steps[state.step].fields;
    if (fields.some(function (id) { return state.prefilled[id]; })) {
      main.appendChild(el('p', 'notice notice-info', t('b.prefilled')));
    }
    fields.forEach(function (id) {
      var f = TPL.FIELDS[id];
      if (!visible(id)) return;
      if (f.group) main.appendChild(el('h3', 'group-title', t(f.group)));
      if (f.type === 'items') main.appendChild(renderItems(id, f));
      else main.appendChild(renderField(id, f));
    });
    var s = doc().steps[state.step].summary;
    if (s) {
      var box = el('div', 'summary');
      box.id = 'summary';
      box.setAttribute('aria-live', 'polite');
      main.appendChild(box);
    }
  }

  function checkOne(f, id) { return L.checkField(f, id, state.data[id], state.data, state.code); }
  function hintOf(id) { return window.tHas('h.' + id) ? t('h.' + id) : ''; }
  function sameText(a, b) { return a.replace(/\.$/, '') === b.replace(/\.$/, ''); }

  // Под полем всегда одна строка: подсказка либо сообщение проверки вместо неё.
  // Если текст совпадает с подсказкой, она просто меняет цвет.
  function paintMessage(node, res, hint) {
    var text = res ? t(res.key) : (hint || '');
    if (res && hint && sameText(text, hint)) text = hint;
    node.textContent = text;
    node.className = res ? 'msg msg-' + res.type : (hint ? 'hint' : 'msg');
  }
  function fieldMessage(id) {
    var m = el('p', 'msg');
    m.id = 'm-' + id;
    paintMessage(m, state.msgs[id], hintOf(id));
    return m;
  }
  function setInvalid(input, res) {
    if (res && res.type === 'error') input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
  function repaint(id) {
    var m = document.getElementById('m-' + id);
    if (m) paintMessage(m, state.msgs[id], hintOf(id));
  }

  function renderField(id, f) {
    var box = el('div', 'field' + (f.type === 'check' ? ' field-check' : ''));
    var fid = 'f-' + id, input;

    if (f.type === 'check') {
      var lab = el('label', 'check');
      input = el('input');
      input.type = 'checkbox'; input.id = fid; input.checked = !!state.data[id];
      lab.appendChild(input);
      lab.appendChild(el('span', null, t('f.' + id)));
      box.appendChild(lab);
    } else {
      var label = el('label', 'label', t('f.' + id) + (f.optional ? ' ' + t('b.optional') : ''));
      label.htmlFor = fid;
      box.appendChild(label);
      if (f.type === 'select') {
        input = el('select', 'input');
        f.options.forEach(function (o) {
          var op = el('option', null, t('o.' + o));
          op.value = o;
          input.appendChild(op);
        });
      } else if (f.type === 'area') {
        input = el('textarea', 'input');
        input.rows = 4;
      } else {
        input = el('input', 'input');
        input.type = f.type === 'date' ? 'date' : 'text';
        if (f.mode) input.inputMode = f.mode;
        if (f.max) input.maxLength = f.max;
      }
      input.id = fid;
      input.autocomplete = 'off';
      if (window.tHas('p.' + id)) input.placeholder = t('p.' + id);
      input.value = state.data[id];
      box.appendChild(input);
    }
    box.appendChild(fieldMessage(id));
    input.setAttribute('aria-describedby', 'm-' + id);
    if (state.msgs[id] && state.msgs[id].type === 'error') input.setAttribute('aria-invalid', 'true');

    var handler = function () {
      state.data[id] = f.type === 'check' ? input.checked : input.value;
      if (f.type === 'select' || f.type === 'check') {
        // От этих полей зависят другие поля шага: перепроверяем их и перерисовываем шаг.
        recheckShown();
        render(fid);
        return;
      }
      if (state.msgs[id] !== undefined) {
        state.msgs[id] = checkOne(f, id);
        repaint(id);
        setInvalid(input, state.msgs[id]);
      }
      fillSummary();
      updateProgress();
    };
    input.addEventListener(f.type === 'select' || f.type === 'check' ? 'change' : 'input', handler);
    if (f.type !== 'select' && f.type !== 'check') {
      input.addEventListener('blur', function () {
        if (L.isEmpty(state.data[id]) && !state.msgs[id]) return;
        state.msgs[id] = checkOne(f, id);
        repaint(id);
        setInvalid(input, state.msgs[id]);
      });
    }
    return box;
  }

  function recheckShown() {
    doc().steps[state.step].fields.forEach(function (id) {
      var f = TPL.FIELDS[id];
      if (f.type === 'items') return;
      if (state.msgs[id] !== undefined || ['leave_days', 'probation'].indexOf(id) >= 0 && !L.isEmpty(state.data[id])) {
        state.msgs[id] = visible(id) ? checkOne(f, id) : null;
      }
    });
  }

  /* ---------- Позиции счёта и акта ---------- */
  function renderItems(id, f) {
    var box = el('div', 'items');
    var list = state.data[id];
    list.forEach(function (it, i) {
      var card = el('div', 'item');
      var top = el('div', 'item-top');
      top.appendChild(el('span', 'item-num', t('b.position') + ' ' + (i + 1)));
      if (list.length > 1) {
        var rm = el('button', 'link-btn', t('b.remove'));
        rm.type = 'button';
        rm.addEventListener('click', function () {
          list.splice(i, 1);
          state.itemMsgs = {};
          render();
        });
        top.appendChild(rm);
      }
      card.appendChild(top);
      var grid = el('div', 'item-grid');
      var cols = ['name', 'unit', 'qty', 'price'];
      if (f.withDate) cols.splice(1, 0, 'done');
      cols.forEach(function (c) {
        var cell = el('div', 'field item-' + c);
        var fid = 'i-' + i + '-' + c;
        var lab = el('label', 'label', t('i.' + c));
        lab.htmlFor = fid;
        cell.appendChild(lab);
        var inp = el('input', 'input');
        inp.id = fid;
        inp.type = c === 'done' ? 'date' : 'text';
        inp.autocomplete = 'off';
        if (c === 'qty' || c === 'price') inp.inputMode = 'decimal';
        if (window.tHas('ip.' + c)) inp.placeholder = t('ip.' + c);
        inp.value = it[c] || '';
        var m = el('p', 'msg');
        m.id = 'm-' + fid;
        var res = (state.itemMsgs[i] || {})[c];
        paintMessage(m, res);
        inp.setAttribute('aria-describedby', m.id);
        inp.addEventListener('input', function () {
          window.setTimeout(updateProgress, 0);
          it[c] = inp.value;
          if (state.itemMsgs[i]) {
            state.itemMsgs[i] = L.checkItem(it, f.withDate);
            paintMessage(m, state.itemMsgs[i][c]);
          }
          var cost = document.getElementById('cost-' + i);
          if (cost) cost.textContent = L.fmtMoney(L.itemCost(it));
          fillSummary();
        });
        cell.appendChild(inp);
        cell.appendChild(m);
        grid.appendChild(cell);
      });
      card.appendChild(grid);
      var line = el('p', 'item-cost');
      line.appendChild(document.createTextNode(t('i.cost') + ': '));
      var sum = el('b', null, L.fmtMoney(L.itemCost(it)));
      sum.id = 'cost-' + i;
      line.appendChild(sum);
      line.appendChild(document.createTextNode(' ' + t('b.tenge')));
      card.appendChild(line);
      box.appendChild(card);
    });
    var add = el('button', 'btn btn-ghost btn-add', t('b.addItem'));
    add.type = 'button';
    add.addEventListener('click', function () {
      list.push({});
      render('i-' + (list.length - 1) + '-name');
    });
    box.appendChild(add);
    var m2 = el('p', 'msg');
    m2.id = 'm-' + id;
    paintMessage(m2, state.msgs[id]);
    box.appendChild(m2);
    return box;
  }

  /* ---------- Итоги ---------- */
  function line(box, label, value, strong) {
    var r = el('p', 'sum-row' + (strong ? ' sum-strong' : ''));
    r.appendChild(el('span', null, label));
    r.appendChild(el('span', null, value));
    box.appendChild(r);
  }
  function fillSummary() {
    var box = document.getElementById('summary');
    if (!box) return;
    box.textContent = '';
    var kind = doc().steps[state.step].summary, d = state.data, tt;
    if (kind === 'leave') {
      var r = L.leaveDates(d.leave_start, d.leave_days, d.holidays);
      line(box, t('b.leaveEnd'), r ? L.fmtDate(r.end) : '—');
      line(box, t('b.leaveBack'), r ? L.fmtDate(r.back) : '—', true);
      return;
    }
    if (kind === 'price') {
      var p = L.toTiyn(d.price);
      tt = L.totals(isNaN(p) ? 0 : p, d.vat);
    } else {
      tt = L.calcItems(d[itemsField()], d.vat);
    }
    line(box, t('b.subtotal'), L.fmtMoney(tt.subtotal) + ' ' + t('b.tenge'));
    line(box, t('b.vat'), d.vat ? L.fmtMoney(tt.vat) + ' ' + t('b.tenge') : t('b.noVat'));
    line(box, t('b.total'), L.fmtMoney(tt.total) + ' ' + t('b.tenge'), true);
    box.appendChild(el('p', 'sum-words', window.getLang() === 'kk' ? L.moneyWordsKz(tt.total) : L.moneyWordsRu(tt.total)));
  }

  /* ---------- Переход ---------- */
  function next() {
    var fields = doc().steps[state.step].fields, first = null;
    state.itemMsgs = {};
    fields.forEach(function (id) {
      var f = TPL.FIELDS[id];
      if (!visible(id)) { state.msgs[id] = null; return; }
      if (f.type === 'items') {
        var list = state.data[id];
        state.msgs[id] = list.length ? null : { type: 'error', key: 'e.noItems' };
        list.forEach(function (it, i) {
          var e = L.checkItem(it, f.withDate);
          if (Object.keys(e).length) {
            state.itemMsgs[i] = e;
            if (!first) first = 'i-' + i + '-' + ['name', 'done', 'unit', 'qty', 'price'].filter(function (c) { return e[c]; })[0];
          }
        });
        if (!first && L.calcItems(list, state.data.vat).total > L.MAX_MONEY) {
          state.msgs[id] = { type: 'error', key: 'e.sumMax' };
          first = 'i-0-qty';
        }
        return;
      }
      var r = checkOne(f, id);
      state.msgs[id] = r;
      if (r && r.type === 'error' && !first) first = 'f-' + id;
    });
    if (first) { render(first); return; }
    state.step++;
    render();
    scrollTop();
  }

  /* ---------- Проверка и скачивание ---------- */
  function renderReview(main) {
    var warns = [];
    Object.keys(state.msgs).forEach(function (id) {
      var m = state.msgs[id];
      if (m && m.type === 'warn') warns.push(t(m.key));
    });
    main.appendChild(el('p', 'lead-s', t('b.reviewLead')));
    warns.forEach(function (w) { main.appendChild(el('p', 'notice notice-warn', w)); });
    var langBox = el('div', 'field doc-lang');
    var langLabel = el('label', 'label', t('b.docLang'));
    langLabel.htmlFor = 'doc-lang';
    var langSel = el('select', 'input');
    langSel.id = 'doc-lang';
    [['kk', 'Қазақша'], ['ru', 'Русский']].forEach(function (o) {
      var op = el('option', null, o[1]);
      op.value = o[0];
      langSel.appendChild(op);
    });
    langSel.value = state.docLang;
    langSel.addEventListener('change', function () {
      state.docLang = langSel.value;
      state.docLangSet = true;
      render('doc-lang');
    });
    langBox.appendChild(langLabel); langBox.appendChild(langSel);
    main.appendChild(langBox);
    var sheet = el('div', 'sheet');
    sheet.id = 'preview';
    sheet.lang = state.docLang;
    sheet.innerHTML = EX.toHTML(TPL.build(state.code, state.data, state.docLang));
    var copy = el('button', 'btn btn-ghost btn-copy');
    copy.type = 'button';
    copy.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
    copy.appendChild(el('span', null, t('b.copy')));
    copy.addEventListener('click', function () { copyText(sheet, copy); });
    main.appendChild(copy);
    main.appendChild(sheet);
    var st = el('p', 'msg');
    st.id = 'dl-status';
    st.setAttribute('role', 'status');
    main.appendChild(st);
    // Действия после проверки: сохранить в журнал (с состоянием «сохранено») и начать заново.
    var acts = el('div', 'review-acts');
    var keep = el('button', 'btn btn-ghost j-save');
    keep.type = 'button'; keep.id = 'j-save';
    keep.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 7c0-1.1.9-2 2-2h4l2 2h7c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2h-13c-1.1 0-2-.9-2-2z"/><path d="M12 10.5v5M9.5 13h5"/></svg>';
    keep.appendChild(el('span', null, t('b.toJournal')));
    keep.addEventListener('click', saveToJournal);
    acts.appendChild(keep);
    main.appendChild(acts);
    var again = el('button', 'link-btn review-again', t('b.restart'));
    again.type = 'button';
    again.addEventListener('click', function () { start(state.code); scrollTop(); });
    acts.appendChild(again);
  }

  // Текст документа без оформления: для вставки в письмо или мессенджер.
  function copyText(sheet, btn) {
    var text = sheet.innerText.replace(/\n{3,}/g, '\n\n').trim();
    var done = function (ok) {
      var label = btn.querySelector('span');
      label.textContent = t(ok ? 'b.copied' : 'e.copy');
      btn.classList.toggle('is-done', ok);
      var status = document.getElementById('dl-status');
      if (status) { status.textContent = t(ok ? 'b.copied' : 'e.copy'); status.className = ok ? 'msg' : 'msg msg-error'; }
      window.clearTimeout(btn._t);
      btn._t = window.setTimeout(function () { label.textContent = t('b.copy'); btn.classList.remove('is-done'); }, 2200);
    };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      done(ok);
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    else fallback();
  }

  /* ---------- Журнал «Мои документы» ---------- */
  // Готовый документ попадает в журнал: новый — новой записью, изменённый — новой версией той же записи.
  // Кнопка «Сохранить» превращается в отметку «Сохранено» со ссылкой на редактор.
  function markSaved(jid) {
    var keep = document.getElementById('j-save');
    if (!keep) return;
    var a = el('a', 'btn btn-ghost j-save is-saved');
    a.id = 'j-save'; a.href = 'documents.html?id=' + jid;
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    a.appendChild(el('span', null, t('b.inJournal')));
    keep.replaceWith(a);
  }
  function saveToJournal() {
    var ST = window.DocumStore;
    if (!ST) return Promise.resolve(null);
    var blocks = TPL.build(state.code, state.data, state.docLang);
    var data = JSON.parse(JSON.stringify(state.data));
    return ST.hash(ST.text(blocks)).then(function (h) {
      var load = state.journalId ? ST.get(state.journalId) : Promise.resolve(null);
      return load.then(function (rec) {
        if (rec) {
          var last = rec.versions[rec.versions.length - 1];
          if (last && last.hash === h) return rec;
          rec.versions.push({ n: rec.versions.length + 1, at: Date.now(), blocks: blocks, data: data, lang: state.docLang, hash: h, note: '' });
          rec.number = data.number || rec.number;
          return ST.put(rec);
        }
        rec = { id: ST.newId(), code: state.code, lang: state.docLang, number: data.number || '', created: Date.now(), status: 'final',
          versions: [{ n: 1, at: Date.now(), blocks: blocks, data: data, lang: state.docLang, hash: h, note: '' }], shares: [], signs: [] };
        return ST.put(rec);
      });
    }).then(function (rec) {
      if (rec) state.journalId = rec.id;
      if (rec) markSaved(rec.id);
      return rec;
    }).catch(function (e) { if (window.console) console.error(e); return null; });
  }

  function download(kind, btn) {
    var name = 'docum-' + state.code + '-' + (state.data.date || new Date().toISOString().slice(0, 10));
    var blocks = TPL.build(state.code, state.data, state.docLang);
    var status = document.getElementById('dl-status');
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = t('b.preparing');
    status.textContent = ''; status.className = 'msg';
    (kind === 'docx' ? EX.downloadDocx(blocks, name) : EX.downloadPdf(blocks, name)).catch(function (e) {
      if (window.console) console.error(e);
      status.textContent = t('e.download');
      status.className = 'msg msg-error';
    }).then(function () {
      btn.disabled = false; btn.textContent = label;
      if (status.className.indexOf('msg-error') < 0) saveToJournal();
    });
  }

  /* ---------- Запуск ---------- */
  var query = new URLSearchParams(location.search);
  var code = query.get('doc'), draft = query.get('draft') ? DR.get(query.get('draft')) : null;
  var jid = query.get('journal');
  if (jid && window.DocumStore) {
    // «Изменить данные в конструкторе»: последняя версия из журнала открывается на шаге проверки.
    window.DocumStore.get(jid).then(function (rec) {
      if (!rec || !TPL.DOCS[rec.code]) { render(); return; }
      var last = rec.versions[rec.versions.length - 1];
      openDraft({ code: rec.code, step: TPL.DOCS[rec.code].steps.length, data: JSON.parse(JSON.stringify(last.data || {})), lang: last.lang || rec.lang });
      state.draftId = null; state.draftNote = ''; state.journalId = rec.id;
      render();
    }).catch(function () { render(); });
  }
  else if (draft) openDraft(draft);
  else if (code && TPL.DOCS[code]) start(code);
  else render();

  document.addEventListener('docum:lang', function () {
    if (!state.docLangSet) state.docLang = window.getLang();
    render();
  });
  window.DocumBuilder = { state: state };
})();
