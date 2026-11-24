/* docum.kz — QR-код для короткой ссылки на подпись (ISO/IEC 18004: байтовый режим, уровень коррекции M, версии 1–10).
   Рисуется в SVG прямо в браузере, ссылка никуда не отправляется. */
(function (root) {
  'use strict';
  var ECC = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];     // кодовых слов коррекции на блок, уровень M
  var BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];            // блоков, уровень M
  var ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var na = Math.floor(v / 7) + 2; r -= (25 * na - 10) * na - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataCodewords(v) { return Math.floor(rawModules(v) / 8) - ECC[v - 1] * BLOCKS[v - 1]; }
  function mul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; }
  function divisor(deg) {
    var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1);
    var rt = 1;
    for (var k = 0; k < deg; k++) {
      for (var j = 0; j < r.length; j++) { r[j] = mul(r[j], rt); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      rt = mul(rt, 2);
    }
    return r;
  }
  function remainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) {
      var fct = b ^ r.shift(); r.push(0);
      div.forEach(function (c, i) { r[i] ^= mul(c, fct); });
    });
    return r;
  }

  function encode(text) {
    var bytes = Array.prototype.slice.call(new TextEncoder().encode(text));
    var v = 1;
    for (; v <= 10; v++) if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= dataCodewords(v) * 8) break;
    if (v > 10) throw new Error('qr-long');
    var cap = dataCodewords(v) * 8, bits = [];
    var push = function (val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4); push(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { push(b, 8); });
    push(0, Math.min(4, cap - bits.length));
    push(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) push(pad, 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) { var x = 0; for (var j = 0; j < 8; j++) x = (x << 1) | bits[i + j]; data.push(x); }

    // Блоки с коррекцией ошибок и перемежение.
    var nb = BLOCKS[v - 1], ecl = ECC[v - 1], raw = Math.floor(rawModules(v) / 8);
    var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = divisor(ecl), blocks = [], k = 0;
    for (i = 0; i < nb; i++) {
      var dat = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1)); k += dat.length;
      var ecc = remainder(dat, div);
      if (i < nShort) dat.push(-1);
      blocks.push(dat.concat(ecc));
    }
    var all = [];
    for (i = 0; i < blocks[0].length; i++) blocks.forEach(function (b) { if (b[i] !== -1) all.push(b[i]); });

    var size = 17 + 4 * v, M = [], F = [];
    for (i = 0; i < size; i++) { M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
    var set = function (x, y, d) { M[y][x] = d; F[y][x] = true; };
    // Синхронизация, поисковые и выравнивающие узоры.
    for (i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    var finder = function (cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var xx = cx + dx, yy = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, d !== 2 && d !== 4);
      }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var al = ALIGN[v - 1];
    al.forEach(function (ay, a) {
      al.forEach(function (ax, b) {
        if ((a === 0 && b === 0) || (a === 0 && b === al.length - 1) || (a === al.length - 1 && b === 0)) return;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      });
    });
    var format = function (mask) {
      var d = (0 << 3) | mask, rem = d;   // уровень M = 00
      for (var q = 0; q < 10; q++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var b = ((d << 10) | rem) ^ 0x5412, bit = function (n) { return ((b >>> n) & 1) !== 0; };
      for (var q2 = 0; q2 <= 5; q2++) set(8, q2, bit(q2));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (q2 = 9; q2 < 15; q2++) set(14 - q2, 8, bit(q2));
      for (q2 = 0; q2 < 8; q2++) set(size - 1 - q2, 8, bit(q2));
      for (q2 = 8; q2 < 15; q2++) set(8, size - 15 + q2, bit(q2));
      set(8, size - 8, true);
    };
    format(0);
    if (v >= 7) {
      var rem = v; for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vb = (v << 12) | rem;
      for (i = 0; i < 18; i++) { var bt = ((vb >>> i) & 1) !== 0, a2 = size - 11 + i % 3, b2 = Math.floor(i / 3); set(a2, b2, bt); set(b2, a2, bt); }
    }
    // Данные змейкой снизу вверх, парами столбцов, минуя столбец синхронизации.
    var n = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (j = 0; j < 2; j++) {
          var x2 = right - j, up = ((right + 1) & 2) === 0, y2 = up ? size - 1 - vert : vert;
          if (!F[y2][x2] && n < all.length * 8) { M[y2][x2] = ((all[n >>> 3] >>> (7 - (n & 7))) & 1) !== 0; n++; }
        }
      }
    }
    var MASKS = [
      function (x, y) { return (x + y) % 2 === 0; }, function (x, y) { return y % 2 === 0; }, function (x) { return x % 3 === 0; },
      function (x, y) { return (x + y) % 3 === 0; }, function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
      function (x, y) { return x * y % 2 + x * y % 3 === 0; }, function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; },
      function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }
    ];
    var apply = function (mk) { for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!F[y][x] && MASKS[mk](x, y)) M[y][x] = !M[y][x]; };
    // Штраф маски (правила 1, 2 и 4 стандарта): выбирается самая читаемая.
    var penalty = function () {
      var p = 0, dark = 0, y, x;
      for (y = 0; y < size; y++) {
        var runR = 1, runC = 1;
        for (x = 0; x < size; x++) {
          if (M[y][x]) dark++;
          if (x > 0) { if (M[y][x] === M[y][x - 1]) { runR++; if (runR === 5) p += 3; else if (runR > 5) p++; } else runR = 1; }
          if (x > 0) { if (M[x][y] === M[x - 1][y]) { runC++; if (runC === 5) p += 3; else if (runC > 5) p++; } else runC = 1; }
          if (x < size - 1 && y < size - 1 && M[y][x] === M[y][x + 1] && M[y][x] === M[y + 1][x] && M[y][x] === M[y + 1][x + 1]) p += 3;
        }
      }
      var tot = size * size; p += Math.floor(Math.abs(dark * 20 - tot * 10) / tot) * 10;
      return p;
    };
    var best = 0, bestP = Infinity;
    for (var mk = 0; mk < 8; mk++) { apply(mk); format(mk); var pp = penalty(); if (pp < bestP) { bestP = pp; best = mk; } apply(mk); }
    apply(best); format(best);
    return { size: size, m: M, version: v, mask: best };
  }

  function svg(text) {
    var q = encode(text), b = 4, n = q.size + b * 2, d = '';
    for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++) if (q.m[y][x]) d += 'M' + (x + b) + ',' + (y + b) + 'h1v1h-1z';
    var ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 ' + n + ' ' + n); s.setAttribute('role', 'img'); s.setAttribute('aria-label', 'QR');
    s.setAttribute('shape-rendering', 'crispEdges');
    var bg = document.createElementNS(ns, 'rect'); bg.setAttribute('width', n); bg.setAttribute('height', n); bg.setAttribute('fill', '#fff');
    var p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); p.setAttribute('fill', '#000');
    s.appendChild(bg); s.appendChild(p);
    return s;
  }
  root.DocumQR = { encode: encode, svg: svg };
})(typeof window !== 'undefined' ? window : globalThis);
