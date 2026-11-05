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

  applyLang();
})();
