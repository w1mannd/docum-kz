/* docum.kz — анимации нижнего меню на телефонах.
   Подсветка выбранного раздела переезжает к нажатой вкладке, иконка пружинит при нажатии,
   меню уезжает вниз при прокрутке вниз и возвращается при прокрутке вверх.
   При «уменьшить движение» в системе анимации не запускаются. */
(function () {
  'use strict';
  var bar = document.querySelector('.tab-bar');
  if (!bar) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var phone = window.matchMedia('(max-width: 768px)');

  // Пока страница загружается, меню не анимируется: в конструкторе оно сразу скрыто, без мелькания.
  bar.style.transition = 'none';
  window.addEventListener('load', function () {
    window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { bar.style.transition = ''; }); });
  });

  var ind = document.createElement('span');
  ind.className = 'tab-ind';
  ind.setAttribute('aria-hidden', 'true');
  bar.insertBefore(ind, bar.firstChild);
  bar.classList.add('has-ind');

  var start = bar.querySelector('.tab[aria-current="page"]');
  var current = start;

  function place(tab, animate) {
    if (!tab) { ind.style.opacity = '0'; return; }
    if (!animate) ind.style.transition = 'none';
    ind.style.opacity = '1';
    ind.style.width = tab.offsetWidth + 'px';
    ind.style.transform = 'translateX(' + tab.offsetLeft + 'px)';
    if (!animate) { void ind.offsetWidth; ind.style.transition = ''; }
  }
  place(current, false);
  window.addEventListener('resize', function () { place(current, false); });

  // Нажатие на вкладку: подсветка переезжает, затем открывается раздел.
  bar.addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (!tab || tab === current || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    if (reduce.matches || !phone.matches) return;
    e.preventDefault();
    if (!current) {
      // На главной подсветки нет: она появляется сразу под нажатой вкладкой.
      ind.style.transition = 'none';
      ind.style.width = tab.offsetWidth + 'px';
      ind.style.transform = 'translateX(' + tab.offsetLeft + 'px) scale(.6)';
      ind.style.opacity = '0';
      void ind.offsetWidth;
      ind.style.transition = '';
    } else {
      current.removeAttribute('aria-current');
    }
    tab.setAttribute('aria-current', 'page');
    current = tab;
    place(tab, true);
    setTimeout(function () { window.location.href = tab.href; }, 160);
  });

  // Стекло слегка увеличивается, пока палец на меню.
  function press(on) { bar.classList.toggle('is-pressed', on); }
  bar.addEventListener('pointerdown', function () { press(true); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
    bar.addEventListener(t, function () { press(false); });
  });

  // Прокрутка: вниз — меню прячется, вверх или у краёв страницы — возвращается.
  var lastY = window.scrollY, ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.scrollY, dy = y - lastY;
    var nearEnd = window.innerHeight + y >= document.documentElement.scrollHeight - 40;
    if (y < 80 || nearEnd || dy < -6) bar.classList.remove('is-hidden');
    else if (dy > 6) bar.classList.add('is-hidden');
    if (Math.abs(dy) > 6 || y < 80) lastY = y;
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
    bar.classList.remove('is-hidden', 'is-pressed');
    place(current, false);
  });
})();
