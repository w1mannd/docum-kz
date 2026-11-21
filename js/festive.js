/* docum.kz — новогоднее оформление: редкий падающий снег и гирлянда под шапкой.
   Работает только в сезон (с 15 ноября по 20 января) и включено по умолчанию.
   Выключается снежинкой рядом с кнопкой темы; выбор запоминается в браузере (docum-festive).
   При «уменьшении движения» в системе снег не падает, гирлянда не мигает. */
(function () {
  'use strict';
  var KEY = 'docum-festive';
  var now = new Date(), m = now.getMonth() + 1, d = now.getDate();
  var season = (m === 11 && d >= 15) || m === 12 || (m === 1 && d <= 20);
  var tb = document.querySelector('.theme-btn');
  if (!season || !tb) return;

  var root = document.documentElement;
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* хранилище недоступно: оформление включено */ }
  function tt(k) { return window.t ? window.t(k) : k; }

  // Кнопка-снежинка в одной «капсуле» с кнопкой темы.
  var pill = document.createElement('div');
  pill.className = 'theme-pill';
  tb.parentNode.insertBefore(pill, tb);
  pill.appendChild(tb);
  var fb = document.createElement('button');
  fb.type = 'button';
  fb.className = 'fest-btn';
  fb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.6 4.3 12 6.2l2.4-1.9M9.6 19.7 12 17.8l2.4 1.9M4.1 10.6l2.9-1.1-.5-3M19.9 13.4l-2.9 1.1.5 3M4.1 13.4l2.9 1.1-.5 3M19.9 10.6l-2.9-1.1.5-3"/></svg>';
  pill.appendChild(fb);

  /* ---------- Гирлянда ---------- */
  var gar = null;
  var COLORS = ['g1', 'g2', 'g3', 'g4'];
  function buildGarland() {
    var head = document.querySelector('.site-head');
    if (!head) return;
    if (!gar) { gar = document.createElement('div'); gar.className = 'garland'; gar.setAttribute('aria-hidden', 'true'); head.appendChild(gar); }
    var step = 64, n = Math.ceil(head.clientWidth / step) + 1, html = '';
    for (var i = 0; i < n; i++) {
      html += '<i class="' + COLORS[i % 4] + '" style="left:' + (i * step + step / 2) + 'px;animation-delay:' + ((i * 0.37) % 4).toFixed(2) + 's"></i>';
    }
    gar.innerHTML = html;
  }

  /* ---------- Снег ---------- */
  var cv = null, ctx = null, flakes = [], raf = 0, last = 0, W = 0, H = 0, dpr = 1;
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Немного: примерно одна снежинка на 30 000 px², не больше 55.
    var want = Math.max(12, Math.min(55, Math.round(W * H / 30000)));
    while (flakes.length < want) flakes.push(flake(true));
    flakes.length = want;
  }
  function flake(anywhere) {
    var r = 0.9 + Math.random() * 1.8;
    return {
      x: Math.random() * W, y: anywhere ? Math.random() * H : -6,
      r: r, v: 14 + r * 9 + Math.random() * 8,            // px в секунду: медленно
      a: 0.35 + Math.random() * 0.45,
      ph: Math.random() * Math.PI * 2, sw: 6 + Math.random() * 14, fr: 0.25 + Math.random() * 0.35
    };
  }
  function color() {
    var dark = root.getAttribute('data-theme') === 'dark' ||
      (root.getAttribute('data-theme') !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    return dark ? '255,255,255' : '150,175,210';   // на белом фоне — голубовато-серый, иначе снег не виден
  }
  function frame(ts) {
    var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
    last = ts;
    ctx.clearRect(0, 0, W, H);
    var c = color();
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      f.y += f.v * dt; f.ph += f.fr * dt;
      if (f.y > H + 6) { flakes[i] = f = flake(false); }
      var x = f.x + Math.sin(f.ph) * f.sw;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(' + c + ',' + f.a + ')';
      ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = window.requestAnimationFrame(frame);
  }
  function startSnow() {
    if (calm && calm.matches) return;
    if (!cv) {
      cv = document.createElement('canvas');
      cv.className = 'snow';
      cv.setAttribute('aria-hidden', 'true');
      document.body.appendChild(cv);
      ctx = cv.getContext('2d');
    }
    cv.hidden = false;
    size();
    if (!raf && !document.hidden) { last = 0; raf = window.requestAnimationFrame(frame); }
  }
  function stopSnow() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    if (cv) { ctx.clearRect(0, 0, W, H); cv.hidden = true; }
  }

  function apply() {
    root.classList.toggle('festive', on);
    fb.setAttribute('aria-pressed', String(on));
    fb.setAttribute('data-i18n-label', on ? 'a.festOff' : 'a.festOn');
    fb.setAttribute('aria-label', tt(on ? 'a.festOff' : 'a.festOn'));
    fb.title = fb.getAttribute('aria-label');
    if (on) { buildGarland(); startSnow(); } else { stopSnow(); }
  }
  fb.addEventListener('click', function () {
    on = !on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* не критично */ }
    apply();
  });
  document.addEventListener('docum:lang', function () { fb.setAttribute('aria-label', tt(on ? 'a.festOff' : 'a.festOn')); fb.title = fb.getAttribute('aria-label'); });
  document.addEventListener('visibilitychange', function () {
    if (!on || !cv) return;
    if (document.hidden) { if (raf) window.cancelAnimationFrame(raf); raf = 0; }
    else if (!raf && !(calm && calm.matches)) { last = 0; raf = window.requestAnimationFrame(frame); }
  });
  var rt = 0;
  window.addEventListener('resize', function () {
    window.clearTimeout(rt);
    rt = window.setTimeout(function () { if (!on) return; buildGarland(); if (cv && !cv.hidden) size(); }, 150);
  });
  if (calm && calm.addEventListener) calm.addEventListener('change', function () { if (on) { stopSnow(); startSnow(); } });
  apply();
})();
