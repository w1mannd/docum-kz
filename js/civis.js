/* docum.kz — консультант «Цивис». Окно чата открывается кнопкой на главной.
   Два режима:
   — нейросеть (если на сервере задан ключ Gemini): отвечает только по найденным фрагментам НПА, сервер проверяет ссылки;
   — без нейросети: готовые сценарии и дословные цитаты из загруженных актов (npa/npa.json), ничего не сочиняет.
   Переписка хранится только в памяти страницы. */
(function () {
  'use strict';
  var lang = function () { return window.getLang ? window.getLang() : 'kk'; };
  var T = {
    ru: {
      title: 'Цивис', sub: 'ИИ-консультант docum.kz', close: 'Закрыть', send: 'Отправить', ph: 'Спросите про документы ИП…',
      modeAi: 'Нейросеть: отвечает только по загруженным НПА', modeOff: 'Без нейросети: сценарии и цитаты из НПА',
      hello: 'Здравствуйте! Я Цивис. Помогу выбрать шаблон, объясню, что заполнять, и покажу нормы из загруженных актов со ссылками.',
      can: 'Умею: подобрать документ, объяснить поля и шаги, найти норму в Трудовом, Гражданском и Налоговом кодексах, законе о бухучёте и приказах, которые есть на сайте.',
      cannot: 'Не умею: давать юридические консультации по вашей ситуации, считать налоги и зарплату, составлять документы вне 8 шаблонов. Не присылайте ФИО, ИИН и другие персональные данные.',
      aiNote: 'Вопросы, на которые нет готового ответа, отправляются через сервер сайта в нейросеть Google Gemini. Переписка на сайте не сохраняется.',
      foot: 'Цивис не заменяет юриста. Проверяйте нормы на adilet.zan.kz.',
      chips: ['Нанимаю первого работника', 'Нужен договор с клиентом', 'Сколько дней отпуска?', 'Работник увольняется', 'Где хранятся мои данные?'],
      typing: 'Цивис печатает…', sources: 'Источники:', found: 'Нашёл в загруженных актах (дословно):', open: 'Открыть шаблон',
      unverified: 'Внимание: ссылки {n} нет среди загруженных актов. Не полагайтесь на неё, проверьте на adilet.zan.kz.',
      none: 'В загруженных актах я не нашёл ответа. Проверьте действующую редакцию на adilet.zan.kz или обратитесь к юристу.',
      pd: 'Похоже, в сообщении есть номер (ИИН, счёт или документ). Пожалуйста, не присылайте персональные данные: для ответа они не нужны.',
      refuse: 'Я не даю юридических консультаций по конкретной ситуации: суды, споры, проверки, налоговые расчёты. Здесь нужен юрист. Могу показать нормы, которые есть на сайте.',
      thanks: 'Пожалуйста! Если появятся вопросы по документам, пишите.',
      err: 'Нейросеть сейчас недоступна, отвечаю без неё.',
      rate: 'Слишком много вопросов подряд. Подождите несколько минут.',
      privacy: 'Данные из форм остаются в вашем браузере и никуда не отправляются. Профиль и черновики хранятся только на этом устройстве. Исключение — вопросы мне, когда включена нейросеть: текст вопроса передаётся в Google Gemini, поэтому не пишите персональные данные.',
      howto: 'Выберите документ в конструкторе, заполните шаги (поля проверяются сразу), на последнем шаге проверьте текст и скачайте .docx или .pdf. Звёздочкой можно отметить нужные документы, а данные ИП один раз сохранить в профиле.',
      fab: 'Цивис'
    },
    kk: {
      title: 'Цивис', sub: 'docum.kz ЖИ-кеңесшісі', close: 'Жабу', send: 'Жіберу', ph: 'ЖК құжаттары туралы сұраңыз…',
      modeAi: 'Нейрожелі: тек жүктелген НҚА бойынша жауап береді', modeOff: 'Нейрожелісіз: сценарийлер мен НҚА-дан дәйексөздер',
      hello: 'Сәлеметсіз бе! Мен Цивиспін. Шаблон таңдауға көмектесемін, нені толтыру керегін түсіндіремін және жүктелген актілерден нормаларды сілтемесімен көрсетемін.',
      can: 'Істей аламын: құжат таңдау, өрістер мен қадамдарды түсіндіру, сайттағы Еңбек, Азаматтық және Салық кодекстерінен, бухгалтерлік есеп туралы заңнан және бұйрықтардан норма табу.',
      cannot: 'Істей алмаймын: сіздің жағдайыңыз бойынша заң кеңесін беру, салық пен жалақыны есептеу, 8 шаблоннан тыс құжат жасау. Т.А.Ә., ЖСН және басқа дербес деректерді жібермеңіз.',
      aiNote: 'Дайын жауабы жоқ сұрақтар сайт сервері арқылы Google Gemini нейрожелісіне жіберіледі. Хат алмасу сайтта сақталмайды.',
      foot: 'Цивис заңгерді алмастырмайды. Нормаларды adilet.zan.kz сайтынан тексеріңіз.',
      chips: ['Алғашқы жұмыскерді аламын', 'Клиентпен шарт керек', 'Еңбек демалысы неше күн?', 'Жұмыскер жұмыстан кетеді', 'Деректерім қайда сақталады?'],
      typing: 'Цивис жазып жатыр…', sources: 'Дереккөздер:', found: 'Жүктелген актілерден таптым (сөзбе-сөз):', open: 'Шаблонды ашу',
      unverified: 'Назар аударыңыз: {n} сілтемесі жүктелген актілерде жоқ. Оған сенбеңіз, adilet.zan.kz сайтынан тексеріңіз.',
      none: 'Жүктелген актілерден жауап таппадым. Қолданыстағы редакцияны adilet.zan.kz сайтынан тексеріңіз немесе заңгерге жүгініңіз.',
      pd: 'Хабарламада нөмір (ЖСН, шот немесе құжат) бар сияқты. Дербес деректерді жібермеңізші: жауап үшін олар қажет емес.',
      refuse: 'Мен нақты жағдай бойынша заң кеңесін бермеймін: сот, дау, тексеру, салық есептері. Мұнда заңгер керек. Сайттағы нормаларды көрсете аламын.',
      thanks: 'Оқасы жоқ! Құжаттар бойынша сұрақ туса, жазыңыз.',
      err: 'Нейрожелі қазір қолжетімсіз, онсыз жауап беремін.',
      rate: 'Қатарынан тым көп сұрақ. Бірнеше минут күтіңіз.',
      privacy: 'Формалардағы деректер браузеріңізде қалады және ешқайда жіберілмейді. Профиль мен нобайлар тек осы құрылғыда сақталады. Ерекшелік — нейрожелі қосулы кездегі маған қойылған сұрақтар: сұрақ мәтіні Google Gemini-ге беріледі, сондықтан дербес деректерді жазбаңыз.',
      howto: 'Конструктордан құжатты таңдаңыз, қадамдарды толтырыңыз (өрістер бірден тексеріледі), соңғы қадамда мәтінді тексеріп, .docx немесе .pdf жүктеңіз. Қажетті құжаттарды жұлдызшамен белгілеуге, ал ЖК деректерін профильде бір рет сақтауға болады.',
      fab: 'Цивис'
    }
  };
  var tx = function (k) { return (T[lang()] || T.kk)[k]; };
  var dname = function (code) { return window.t ? window.t('d.' + code) : code; };

  // Сценарии: ключевые основы слов → ответ и шаблоны.
  var INTENTS = [
    { id: 'thanks', keys: ['спасиб', 'благодар', 'рахмет', 'рақмет'] },
    { id: 'refuse', keys: ['суд', 'иск', 'спор', 'штраф', 'проверк', 'налогов', 'посчита', 'рассчита', 'сот', 'дау', 'айыппұл', 'есепте'] },
    { id: 'privacy', keys: ['данны', 'хранит', 'безопас', 'конфиденц', 'деректе', 'сақтал', 'қауіпсі'] },
    { id: 'howto', keys: ['как пользов', 'как работает', 'как заполн', 'как скач', 'қалай толтыр', 'қалай жүкте', 'қалай пайдалан'] },
    { id: 'hire', keys: ['нанима', 'нанять', 'наня', 'принять на работу', 'прием на работу', 'приема на работу', 'приему на работу', 'первого работник', 'сотрудник', 'жұмысқа ал', 'жұмыскерді ал', 'жұмыскер ал', 'қабылда'], docs: ['employment', 'hire'] },
    { id: 'services', keys: ['клиент', 'заказчик', 'услуг', 'договор с', 'қызмет', 'тапсырыс', 'клиентпен'], docs: ['services', 'invoice', 'act'] },
    { id: 'invoice', keys: ['счет', 'счёт', 'оплат', 'шот', 'төлем'], docs: ['invoice'] },
    { id: 'act', keys: ['акт', 'выполнен', 'орындалған'], docs: ['act'] },
    { id: 'leave', keys: ['отпуск', 'демалыс'], docs: ['leave'], law: true },
    { id: 'quit', keys: ['увольн', 'уволь', 'увол', 'расторж', 'кетеді', 'кетсе', 'шығу', 'босат'], docs: ['termination'], law: true },
    { id: 'cert', keys: ['справк', 'анықтама'], docs: ['certificate'] }
  ];
  var DOC_TEXT = {
    ru: { hire: 'Для первого работника нужны трудовой договор и приказ о приёме на работу. Сначала заключается договор, затем издаётся приказ.', services: 'Для работы с клиентом обычно нужны договор оказания услуг, счёт на оплату и акт выполненных работ.', invoice: 'Счёт на оплату собирается в конструкторе: позиции, НДС и сумма прописью считаются сами.', act: 'Акт выполненных работ (форма Р-1) подтверждает, что услуги оказаны.', leave: 'Отпуск оформляется приказом. Ниже нормы о продолжительности отпуска из Трудового кодекса.', quit: 'На сайте есть приказ о прекращении трудового договора по соглашению сторон. Другие основания увольнения требуют отдельной проверки юристом. Ниже норма о расторжении по инициативе работника.', cert: 'Справку с места работы можно собрать в конструкторе.' },
    kk: { hire: 'Алғашқы жұмыскерге еңбек шарты мен жұмысқа қабылдау туралы бұйрық керек. Алдымен шарт жасалады, содан кейін бұйрық шығарылады.', services: 'Клиентпен жұмыс үшін әдетте қызмет көрсету шарты, төлем шоты және орындалған жұмыстар актісі керек.', invoice: 'Төлем шоты конструкторда жасалады: позициялар, ҚҚС және сома жазумен өзі есептеледі.', act: 'Орындалған жұмыстар актісі (Ж-1 нысаны) қызмет көрсетілгенін растайды.', leave: 'Еңбек демалысы бұйрықпен ресімделеді. Төменде Еңбек кодексіндегі демалыс ұзақтығы туралы нормалар.', quit: 'Сайтта еңбек шартын тараптардың келісімі бойынша бұзу туралы бұйрық бар. Басқа негіздерді заңгер тексеруі керек. Төменде жұмыскердің бастамасы бойынша бұзу туралы норма.', cert: 'Жұмыс орнынан анықтаманы конструкторда жасауға болады.' }
  };
  var LAW_Q = { leave: { ru: 'основной оплачиваемый ежегодный трудовой отпуск продолжительность 24 календарных дня', kk: 'негізгі жыл сайынғы ақы төленетін еңбек демалысы ұзақтығы күнтізбелік күн' }, quit: { ru: 'расторжение трудового договора по инициативе работника уведомив за один месяц', kk: 'еңбек шартын жұмыскердің бастамасы бойынша бұзу бір ай бұрын хабардар ету' } };

  var state = { open: false, ai: null, msgs: [], index: null, busy: false };
  var box, log, input, sendBtn, chips, modeEl, fab;

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  function build() {
    box = el('div', 'civis');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'civis-title');
    var head = el('div', 'civis-head');
    var av = el('span', 'civis-av', 'Ц'); av.setAttribute('aria-hidden', 'true');
    var ttl = el('div', 'civis-ttl');
    var h = el('h2', null, tx('title')); h.id = 'civis-title';
    ttl.appendChild(h); ttl.appendChild(el('span', 'civis-sub', tx('sub')));
    var x = el('button', 'civis-x'); x.type = 'button'; x.setAttribute('aria-label', tx('close'));
    x.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    x.addEventListener('click', close);
    head.appendChild(av); head.appendChild(ttl); head.appendChild(x);
    log = el('div', 'civis-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite');
    chips = el('div', 'civis-chips');
    var form = el('form', 'civis-form');
    input = el('textarea', 'civis-in'); input.rows = 1; input.maxLength = 600; input.placeholder = tx('ph'); input.setAttribute('aria-label', tx('ph'));
    sendBtn = el('button', 'civis-send'); sendBtn.type = 'submit'; sendBtn.setAttribute('aria-label', tx('send'));
    sendBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    form.appendChild(input); form.appendChild(sendBtn);
    form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input.value); } });
    input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
    var foot = el('p', 'civis-foot', tx('foot'));
    box.appendChild(head); box.appendChild(log); box.appendChild(chips); box.appendChild(form); box.appendChild(foot);
    box.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.body.appendChild(box);

    bot([tx('hello'), tx('can'), tx('cannot')]);
    renderChips();
    checkAi();
  }

  function renderChips() {
    chips.textContent = '';
    tx('chips').forEach(function (c) {
      var b = el('button', 'civis-chip', c); b.type = 'button';
      b.addEventListener('click', function () { ask(c); });
      chips.appendChild(b);
    });
  }

  function setMode() { /* надпись о режиме убрана по просьбе автора */ }

  function checkAi() {
    setMode();
    if (location.protocol === 'file:') { state.ai = false; setMode(); return; }
    fetch('api/civis', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : { ai: false }; })
      .then(function (d) { state.ai = !!d.ai; setMode(); if (state.ai) bot([tx('aiNote')], null, 'civis-note'); })
      .catch(function () { state.ai = false; setMode(); });
  }

  function scrollEnd() { log.scrollTop = log.scrollHeight; }

  function bubble(cls) { var b = el('div', 'civis-msg ' + cls); log.appendChild(b); return b; }

  // Ответ бота: абзацы текста, ссылки на шаблоны и источники.
  function bot(paras, extra, cls) {
    var b = bubble('civis-bot' + (cls ? ' ' + cls : ''));
    paras.forEach(function (p) { if (p) b.appendChild(el('p', null, p)); });
    if (extra && extra.docs) {
      var row = el('div', 'civis-links');
      extra.docs.forEach(function (code) {
        var a = el('a', 'civis-link', dname(code)); a.href = 'constructor.html?doc=' + code;
        row.appendChild(a);
      });
      b.appendChild(row);
    }
    if (extra && extra.quotes) {
      extra.quotes.forEach(function (q) {
        var bq = el('blockquote', 'civis-quote');
        bq.appendChild(el('p', null, q.text));
        var a = el('a', null, q.label); a.href = q.url; a.target = '_blank'; a.rel = 'noopener';
        bq.appendChild(a);
        b.appendChild(bq);
      });
    }
    if (extra && extra.sources && extra.sources.length) {
      var s = el('p', 'civis-src', tx('sources') + ' ');
      extra.sources.forEach(function (src, i) {
        var a = el('a', null, src.label); a.href = src.url; a.target = '_blank'; a.rel = 'noopener';
        if (i) s.appendChild(document.createTextNode(', '));
        s.appendChild(a);
      });
      b.appendChild(s);
    }
    if (extra && extra.warn) b.appendChild(el('p', 'civis-warn', extra.warn));
    scrollEnd();
    return b;
  }

  function loadIndex() {
    if (state.index) return Promise.resolve(state.index);
    return fetch('npa/npa.json').then(function (r) { return r.json(); }).then(function (d) {
      state.index = new window.CivisSearch.Index(d.units); return state.index;
    });
  }

  function shortLabel(u) {
    var t = u.title.split(' от ')[0].split(',')[0];
    return t + ', ' + u.ref;
  }

  function quotes(q, n) {
    return loadIndex().then(function (ix) {
      var res = ix.search(q, lang(), n || 2), top = res.length ? res[0].score : 0;
      // Второй фрагмент показываем, только если он почти так же близок к вопросу, как первый.
      return res.filter(function (r) { return r.score > 4 && r.score >= top * 0.7; }).map(function (r) {
        return { text: window.CivisSearch.excerpt(r.u, q, 700), label: shortLabel(r.u), url: r.u.url };
      });
    });
  }

  function intentOf(q) {
    var s = q.toLowerCase().replace(/ё/g, 'е'), best = null, bestN = 0;
    INTENTS.forEach(function (it) {
      var n = 0; it.keys.forEach(function (k) { if (s.indexOf(k.replace(/ё/g, 'е')) >= 0) n++; });
      if (n > bestN) { best = it; bestN = n; }
    });
    return best;
  }

  function typing() { var b = bubble('civis-bot civis-typing'); b.setAttribute('aria-label', tx('typing')); b.innerHTML = '<span></span><span></span><span></span>'; scrollEnd(); return b; }

  function ask(raw) {
    var q = String(raw || '').trim();
    if (!q || state.busy) return;
    input.value = ''; input.style.height = '';
    var u = bubble('civis-user'); u.textContent = q; scrollEnd();
    state.msgs.push({ role: 'user', text: q });
    if (/\d{9,}|KZ\d{2}[0-9A-Z]{10,}/i.test(q.replace(/\s/g, ''))) { bot([tx('pd')]); }
    var it = intentOf(q);
    if (it && it.id === 'thanks') { reply([tx('thanks')]); return; }
    if (it && it.id === 'refuse') { reply([tx('refuse')]); return; }
    if (it && it.id === 'privacy') { reply([tx('privacy')]); return; }
    if (it && it.id === 'howto') { reply([tx('howto')]); return; }
    if (it && it.docs) {
      var text = DOC_TEXT[lang()][it.id];
      if (it.law) {
        state.busy = true; var tp = typing();
        quotes(LAW_Q[it.id][lang()] + ' ' + q, 1).then(function (qs) { tp.remove(); state.busy = false; reply([text], { docs: it.docs, quotes: qs }); })
          .catch(function () { tp.remove(); state.busy = false; reply([text], { docs: it.docs }); });
      } else reply([text], { docs: it.docs });
      return;
    }
    // Свободный вопрос: нейросеть по НПА, иначе — дословные цитаты.
    state.busy = true; sendBtn.disabled = true;
    var tp2 = typing();
    var offline = function (note) {
      return quotes(q, 2).then(function (qs) {
        tp2.remove(); state.busy = false; sendBtn.disabled = false;
        var paras = note ? [note] : [];
        if (qs.length) { paras.push(tx('found')); reply(paras, { quotes: qs }); }
        else { paras.push(tx('none')); reply(paras); }
      });
    };
    if (!state.ai) { offline(); return; }
    fetch('api/civis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lang: lang(), messages: state.msgs.slice(-6) })
    }).then(function (r) {
      if (r.status === 429) { tp2.remove(); state.busy = false; sendBtn.disabled = false; reply([tx('rate')]); return; }
      if (!r.ok) throw new Error('http');
      return r.json().then(function (d) {
        tp2.remove(); state.busy = false; sendBtn.disabled = false;
        var warn = d.unverified && d.unverified.length ? tx('unverified').replace('{n}', d.unverified.join(', ')) : '';
        reply(d.text.split(/\n{2,}/), { sources: d.sources, warn: warn });
      });
    }).catch(function () { offline(tx('err')); });
  }

  function reply(paras, extra) {
    bot(paras, extra);
    state.msgs.push({ role: 'model', text: paras.join('\n\n') });
  }

  function open() {
    if (!box) build();
    state.open = true;
    box.classList.add('is-open');
    document.body.classList.add('civis-open');
    if (fab) fab.setAttribute('aria-expanded', 'true');
    setTimeout(function () { input.focus(); }, 60);
  }
  function close() {
    state.open = false;
    box.classList.remove('is-open');
    document.body.classList.remove('civis-open');
    if (fab) { fab.setAttribute('aria-expanded', 'false'); fab.focus(); }
  }

  // Смена языка сайта: подписи окна обновляются, переписка остаётся.
  document.addEventListener('docum:lang', function () {
    if (!box) return;
    box.querySelector('#civis-title').textContent = tx('title');
    box.querySelector('.civis-sub').textContent = tx('sub');
    box.querySelector('.civis-x').setAttribute('aria-label', tx('close'));
    input.placeholder = tx('ph'); input.setAttribute('aria-label', tx('ph'));
    sendBtn.setAttribute('aria-label', tx('send'));
    box.querySelector('.civis-foot').textContent = tx('foot');
    setMode(); renderChips();
  });

  window.Civis = { open: open, close: close, toggle: function () { if (state.open) close(); else open(); }, bind: function (b) { fab = b; } };
})();
