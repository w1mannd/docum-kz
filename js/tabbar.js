/* docum.kz — нижнее меню на телефонах.
   Подсветка раздела стоит в разметке, её место задаёт CSS по выбранной вкладке (aria-current):
   при нажатии вкладка выбирается сразу, подсветка переезжает, и открывается раздел.
   Между страницами работает плавный переход (View Transitions), меню и подсветка в нём не мигают.
   Меню закреплено и не прячется при прокрутке; скрыто только в конструкторе, пока заполняется документ (is-building).
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

  // Возврат кнопкой «Назад»: страница из кэша браузера показывает исходный раздел.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    if (current && current !== start) current.removeAttribute('aria-current');
    if (start) start.setAttribute('aria-current', 'page');
    current = start;
  });
})();
