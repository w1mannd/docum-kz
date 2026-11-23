/* docum.kz — нижнее меню на телефонах.
   Подсветка раздела стоит в разметке, её место задаёт CSS по выбранной вкладке (aria-current):
   при нажатии вкладка выбирается сразу, подсветка переезжает, и открывается раздел.
   Между страницами работает плавный переход (View Transitions), меню и подсветка в нём не мигают.
   Меню уезжает вниз при прокрутке вниз и возвращается при прокрутке вверх.
   При «уменьшить движение» в системе анимации не запускаются. */
(function () {
  'use strict';
  var bar = document.querySelector('.tab-bar');
  if (!bar) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var phone = window.matchMedia('(max-width: 768px)');
  // Плавный переход между страницами есть — тогда открываем раздел сразу, подсветку доведёт переход.
  var vt = !!(window.CSS && CSS.supports && CSS.supports('view-transition-name: a') && 'onpagereveal' in window);

  // Пока страница загружается, меню не анимируется: в конструкторе оно сразу скрыто, без мелькания.
  bar.style.transition = 'none';
  window.addEventListener('load', function () {
    window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { bar.style.transition = ''; }); });
  });

  var start = bar.querySelector('.tab[aria-current="page"]');
  var current = start;

  bar.addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (!tab || tab === current || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    if (current) current.removeAttribute('aria-current');
    tab.setAttribute('aria-current', 'page');
    current = tab;
    if (reduce.matches || !phone.matches || vt) return;   // браузер откроет ссылку сам
    e.preventDefault();
    setTimeout(function () { window.location.href = tab.href; }, 120);
  });

  // Прокрутка: меню прячется только после заметной прокрутки вниз (больше 120 px подряд),
  // возвращается при любой прокрутке вверх и у краёв страницы. Мелкие движения пальцем меню не трогают.
  var lastY = window.scrollY, down = 0, ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY, dy = y - lastY;
    lastY = y;
    var nearEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 40;
    if (y < 80 || nearEnd || dy < -4) { down = 0; bar.classList.remove('is-hidden'); return; }
    if (dy > 0) { down += dy; if (down > 120) bar.classList.add('is-hidden'); }
  }
  window.addEventListener('scroll', function () {
    if (reduce.matches || !phone.matches) return;
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });

  // Возврат кнопкой «Назад»: страница из кэша браузера показывает исходный раздел.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    if (current && current !== start) current.removeAttribute('aria-current');
    if (start) start.setAttribute('aria-current', 'page');
    current = start;
    bar.classList.remove('is-hidden');
  });
})();
