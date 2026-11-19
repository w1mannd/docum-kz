/* docum.kz — меню, язык, оговорка. */
(function () {
  'use strict';
  var I18N = window.I18N || {};
  var langs = Object.keys(I18N);
  var DEFAULT_LANG = I18N.kk ? 'kk' : 'ru';
  var lang = DEFAULT_LANG;

  // Выбранный язык запоминается в браузере. Черновики и профиль хранит js/drafts.js.
  try {
    var saved = localStorage.getItem('docum-lang');
    if (saved && I18N[saved]) lang = saved;
  } catch (e) { /* хранилище недоступно: работаем с языком по умолчанию */ }

  window.t = function (key) {
    var d = I18N[lang] || {};
    if (d[key] !== undefined) return d[key];
    return (I18N.ru && I18N.ru[key] !== undefined) ? I18N.ru[key] : key;
  };
  window.getLang = function () { return lang; };
  window.tHas = function (key) {
    return !!((I18N[lang] && I18N[lang][key] !== undefined) || (I18N.ru && I18N.ru[key] !== undefined));
  };

  // Тёмная тема: картинка на главной меняется вместе с настройкой системы.
  var dark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (dark && dark.addEventListener) dark.addEventListener('change', function () { applyLang(); });
  var theme = document.documentElement.getAttribute('data-theme') || 'auto';
  function isDark() { return theme === 'dark' || (theme !== 'light' && !!(dark && dark.matches)); }
  var THEME_NEXT = { auto: 'light', light: 'dark', dark: 'auto' };
  var THEME_KEY = { auto: 'a.themeAuto', light: 'a.themeLight', dark: 'a.themeDark' };
  var metaLight = document.querySelector('meta[name="theme-color"][media*="light"]');
  var metaDark = document.querySelector('meta[name="theme-color"][media*="dark"]');
  function applyTheme() {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    var color = theme === 'dark' ? '#000000' : theme === 'light' ? '#ffffff' : null;
    if (metaLight) metaLight.content = color || '#ffffff';
    if (metaDark) metaDark.content = color || '#000000';
    var b = document.querySelector('.theme-btn');
    if (b) { b.setAttribute('data-mode', theme); b.setAttribute('data-i18n-label', THEME_KEY[theme]); }
  }

  function applyLang() {
    document.documentElement.lang = lang === 'kk' ? 'kk' : 'ru';
    var titleKey = document.documentElement.getAttribute('data-title');
    if (titleKey) document.title = window.t(titleKey) + ' — docum.kz';
    document.querySelectorAll('[data-lk]').forEach(function (n) {
      n.setAttribute('data-label', window.t(n.getAttribute('data-lk')));
    });
    document.querySelectorAll('[data-i18n]').forEach(function (n) {
      n.textContent = window.t(n.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-src]').forEach(function (n) {
      var src = window.t(n.getAttribute('data-i18n-src'));
      if (n.hasAttribute('data-dark') && isDark()) src = src.replace(/\.webp$/, '-dark.webp');
      if (n.getAttribute('src') !== src) n.setAttribute('src', src);
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (n) {
      n.alt = window.t(n.getAttribute('data-i18n-alt'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (n) {
      n.placeholder = window.t(n.getAttribute('data-i18n-ph'));
    });
    document.querySelectorAll('[data-i18n-label]').forEach(function (n) {
      n.setAttribute('aria-label', window.t(n.getAttribute('data-i18n-label')));
    });
    document.querySelectorAll('[data-adilet]').forEach(function (a) {
      var id = a.getAttribute('data-adilet');
      a.href = 'https://adilet.zan.kz/' + (lang === 'kk' ? 'kaz' : 'rus') + (id ? '/docs/' + id : '');
    });
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang));
    });
    var dates = window.DocumLogic ? window.DocumLogic.CHECK_DATE : null;
    if (dates) document.querySelectorAll('[data-check-date]').forEach(function (n) { n.textContent = dates; });
  }

  // Переключатель показывается, когда готово больше одного языка.
  var sw = document.querySelector('.lang');
  if (sw) {
    sw.hidden = langs.length < 2;
    sw.addEventListener('click', function (e) {
      var b = e.target.closest('.lang-btn');
      if (!b || !I18N[b.getAttribute('data-lang')]) return;
      lang = b.getAttribute('data-lang');
      try { localStorage.setItem('docum-lang', lang); } catch (err) { /* не критично */ }
      applyLang();
      document.dispatchEvent(new CustomEvent('docum:lang'));
    });
  }

  // Кнопка темы: как в системе → светлая → тёмная.
  var tb = document.querySelector('.theme-btn');
  if (tb) {
    tb.addEventListener('click', function () {
      theme = THEME_NEXT[theme] || 'auto';
      try { if (theme === 'auto') localStorage.removeItem('docum-theme'); else localStorage.setItem('docum-theme', theme); } catch (err) { /* не критично */ }
      applyTheme();
      applyLang();
    });
  }

  // Консультант «Цивис»: скрипты грузятся только при первом обращении к кнопке.
  var cfab = document.querySelector('.civis-fab'), cload = null;
  function civisLoad() {
    if (window.Civis) return Promise.resolve();
    if (cload) return cload;
    var one = function (src) {
      return new Promise(function (ok, fail) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
    };
    cload = one(cfab.getAttribute('data-s1')).then(function () { return one(cfab.getAttribute('data-s2')); });
    cload.catch(function () { cload = null; });
    return cload;
  }
  // Кнопка в тёмном блоке на главной открывает того же Цивиса.
  document.querySelectorAll('.civis-band-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!cfab) return;
      civisLoad().then(function () { window.Civis.bind(cfab); window.Civis.open(); }).catch(function () {});
    });
  });
  if (cfab) {
    cfab.addEventListener('pointerenter', function () { civisLoad().catch(function () {}); });
    cfab.addEventListener('click', function () {
      civisLoad().then(function () { window.Civis.bind(cfab); window.Civis.toggle(); }).catch(function () {});
    });
  }

  // Счётчики на главной досчитывают до своего числа, когда появляются на экране.
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    var cio = new IntersectionObserver(function (list) {
      list.forEach(function (e) {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        var n = +e.target.getAttribute('data-count'), t0 = null;
        var step = function (ts) {
          if (!t0) t0 = ts;
          var k = Math.min(1, (ts - t0) / 900), v = 1 - Math.pow(1 - k, 3);
          e.target.textContent = String(Math.round(n * v));
          if (k < 1) window.requestAnimationFrame(step);
        };
        e.target.textContent = '0';
        window.requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (n) { cio.observe(n); });
  }

  /* Оговорка в footer */
  var info = document.querySelector('.note-btn'), pop = document.getElementById('note-pop');
  if (info && pop) {
    info.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = pop.classList.toggle('is-open');
      info.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function () {
      pop.classList.remove('is-open');
      info.setAttribute('aria-expanded', 'false');
    });
  }

  applyTheme();
  applyLang();
  document.documentElement.classList.remove('i18n-wait');

  // Блоки страницы плавно выезжают снизу, когда доходят до экрана.
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!calm && 'IntersectionObserver' in window) {
    var sel = '.section-head, .card, .how li, .perks > *, .page-head, .tbl tbody tr, .prose > *, .faq > *, .foot-grid > *, .foot-list > p';
    var fired = false;
    var seen = new IntersectionObserver(function (list) {
      fired = true;
      list.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    document.documentElement.classList.add('js-reveal');
    var fold = window.innerHeight;
    document.querySelectorAll(sel).forEach(function (n) {
      if (n.closest('.hero')) return;
      // То, что видно сразу при открытии, показывается без ожидания.
      if (n.getBoundingClientRect().top < fold) return;
      var sibs = Array.prototype.filter.call(n.parentNode.children, function (x) { return x.matches(sel); });
      n.setAttribute('data-reveal', '');
      n.style.setProperty('--d', Math.min(sibs.indexOf(n), 4) * 0.07 + 's');
      seen.observe(n);
    });
    // Если браузер так и не сообщил о видимости, показываем всё, чтобы текст не остался скрытым.
    window.setTimeout(function () {
      if (!fired) document.querySelectorAll('[data-reveal]').forEach(function (n) { n.classList.add('in'); });
    }, 1500);
  }
})();
