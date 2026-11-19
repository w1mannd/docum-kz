/* docum.kz — отметка о согласовании: имя, подпись от руки на холсте и подтверждение.
   Это не ЭЦП: под формой всегда показывается предупреждение со ссылкой на закон. */
(function (root) {
  'use strict';
  var t = function (k) { return root.t ? root.t(k) : k; };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  function pad(host, onDone) {
    var box = el('div', 'sign');
    var nameL = el('label', 'label', t('sg.name')); nameL.htmlFor = 'sg-name';
    var name = el('input', 'input'); name.id = 'sg-name'; name.autocomplete = 'off'; name.maxLength = 80;
    var drawL = el('p', 'label', t('sg.draw'));
    var wrap = el('div', 'sign-canvas');
    var cv = el('canvas'); cv.setAttribute('aria-label', t('sg.draw')); cv.setAttribute('role', 'img');
    var clear = el('button', 'link-btn', t('sg.clear')); clear.type = 'button';
    wrap.appendChild(cv); wrap.appendChild(clear);
    var agreeL = el('label', 'check');
    var agree = el('input'); agree.type = 'checkbox';
    agreeL.appendChild(agree); agreeL.appendChild(el('span', null, t('sg.agree')));
    var msg = el('p', 'msg msg-error');
    var ok = el('button', 'btn btn-primary', t('sg.ok')); ok.type = 'button';
    var legal = el('p', 'sign-legal', t('dm.legal'));
    [nameL, name, drawL, wrap, agreeL, msg, ok, legal].forEach(function (n) { box.appendChild(n); });
    host.appendChild(box);

    var ctx = cv.getContext('2d'), drawn = false, down = false, last = null, strokes = [], cur = null, W = 1, H = 150;
    function size() {
      var r = wrap.getBoundingClientRect(), dpr = root.devicePixelRatio || 1; W = r.width || 1; strokes = [];
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(150 * dpr);
      cv.style.height = '150px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0B1F3A';
      drawn = false;
    }
    setTimeout(size, 0);
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    // Подпись хранится линиями в сетке 360×120: так ответная ссылка остаётся короткой.
    function q(p) { return [Math.round(p.x / W * 360), Math.round(p.y / H * 120)]; }
    cv.addEventListener('pointerdown', function (e) { down = true; last = pos(e); cur = q(last); strokes.push(cur); if (cv.setPointerCapture) try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ничего */ } e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) {
      if (!down) return;
      var p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; drawn = true;
      var k = q(p), lx = cur[cur.length - 2], ly = cur[cur.length - 1];
      if (Math.abs(k[0] - lx) + Math.abs(k[1] - ly) >= 3) { cur.push(k[0], k[1]); }
    });
    ['pointerup', 'pointercancel'].forEach(function (k) { cv.addEventListener(k, function () { down = false; }); });
    clear.addEventListener('click', size);

    ok.addEventListener('click', function () {
      if (!name.value.trim() || !drawn || !agree.checked) { msg.textContent = t('sg.need'); return; }
      msg.textContent = '';
      onDone({ name: name.value.trim(), strokes: strokes.filter(function (s) { return s.length >= 4; }), at: Date.now() });
    });
    return { box: box, button: ok };
  }
  // Картинка подписи из линий: для показа в журнале и на странице ответа.
  function draw(strokes) {
    var c = document.createElement('canvas'); c.width = 360; c.height = 120;
    var x = c.getContext('2d'); x.lineWidth = 2.2; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#0B1F3A';
    (strokes || []).forEach(function (s) {
      x.beginPath(); x.moveTo(s[0], s[1]);
      for (var i = 2; i < s.length; i += 2) x.lineTo(s[i], s[i + 1]);
      x.stroke();
    });
    return c.toDataURL('image/png');
  }
  root.DocumSign = { pad: pad, draw: draw };
})(window);
