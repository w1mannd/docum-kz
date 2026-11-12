/* docum.kz — преломление для стеклянных панелей на телефонах.
   Базовое стекло сделано в CSS и работает везде. Здесь добавляется изгиб фона у краёв панели.
   backdrop-filter: url() поддерживают только браузеры на Chromium. Safari принимает это свойство,
   но ничего не рисует, поэтому @supports не подходит и движок определяется явно. */
(function () {
  'use strict';
  var data = navigator.userAgentData;
  var chromium = !!(data && data.brands && data.brands.some(function (b) { return b.brand === 'Chromium'; }));
  if (!chromium) return;

  var phone = window.matchMedia('(max-width: 768px)');
  var calm = window.matchMedia('(prefers-reduced-transparency: reduce)');
  var NS = 'http://www.w3.org/2000/svg';
  var BEZEL = 14, SCALE = 34;
  var targets = [['.tab-bar', 'lg-tab']];

  var svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  document.body.appendChild(svg);

  // Карта смещения: красный канал двигает по X, зелёный по Y, 128 — без смещения.
  function displacementMap(w, h, radius) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d'), img = ctx.createImageData(w, h), px = img.data;
    var r = Math.min(radius, w / 2, h / 2), hx = w / 2, hy = h / 2;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var dx = x + 0.5 - hx, dy = y + 0.5 - hy;
        var qx = Math.abs(dx) - (hx - r), qy = Math.abs(dy) - (hy - r);
        var ox = Math.max(qx, 0), oy = Math.max(qy, 0), len = Math.sqrt(ox * ox + oy * oy);
        var depth = r - len - Math.min(Math.max(qx, qy), 0); // расстояние от края внутрь
        var nx, ny;
        if (len > 0) { nx = ox / len * (dx < 0 ? -1 : 1); ny = oy / len * (dy < 0 ? -1 : 1); }
        else if (qx > qy) { nx = dx < 0 ? -1 : 1; ny = 0; }
        else { nx = 0; ny = dy < 0 ? -1 : 1; }
        var t = Math.max(0, Math.min(1, 1 - depth / BEZEL)), m = t * t * t;
        var i = (y * w + x) * 4;
        px[i] = 128 - nx * m * 127;
        px[i + 1] = 128 - ny * m * 127;
        px[i + 2] = 128;
        px[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  function buildFilter(id, w, h, radius) {
    var old = document.getElementById(id);
    if (old) old.remove();
    var f = document.createElementNS(NS, 'filter');
    f.id = id;
    f.setAttribute('filterUnits', 'userSpaceOnUse');
    f.setAttribute('primitiveUnits', 'userSpaceOnUse');
    f.setAttribute('x', '0'); f.setAttribute('y', '0');
    f.setAttribute('width', w); f.setAttribute('height', h);
    f.setAttribute('color-interpolation-filters', 'sRGB');
    var blur = document.createElementNS(NS, 'feGaussianBlur');
    blur.setAttribute('in', 'SourceGraphic');
    blur.setAttribute('stdDeviation', '1.2');
    blur.setAttribute('result', 'soft');
    var map = document.createElementNS(NS, 'feImage');
    map.setAttribute('href', displacementMap(w, h, radius));
    map.setAttribute('x', '0'); map.setAttribute('y', '0');
    map.setAttribute('width', w); map.setAttribute('height', h);
    map.setAttribute('preserveAspectRatio', 'none');
    map.setAttribute('result', 'map');
    var shift = document.createElementNS(NS, 'feDisplacementMap');
    shift.setAttribute('in', 'soft');
    shift.setAttribute('in2', 'map');
    shift.setAttribute('scale', String(SCALE));
    shift.setAttribute('xChannelSelector', 'R');
    shift.setAttribute('yChannelSelector', 'G');
    f.appendChild(blur); f.appendChild(map); f.appendChild(shift);
    svg.appendChild(f);
  }

  function refresh() {
    var on = phone.matches && !calm.matches;
    document.documentElement.classList.toggle('lg-refract', on);
    if (!on) return;
    targets.forEach(function (t) {
      var el = document.querySelector(t[0]);
      if (!el) return;
      var w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (!w || !h) return;
      var key = w + 'x' + h;
      if (el.getAttribute('data-glass') === key && document.getElementById(t[1])) return;
      el.setAttribute('data-glass', key);
      buildFilter(t[1], w, h, parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
    });
  }

  var timer = 0;
  function later() {
    clearTimeout(timer);
    timer = setTimeout(refresh, 60);
  }
  window.addEventListener('resize', later);
  var builder = document.getElementById('builder');
  if (builder) new MutationObserver(later).observe(builder, { childList: true });
  refresh();
})();
