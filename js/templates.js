/* docum.kz — схемы полей и шаблоны документов.
   Один шаблон отдаёт список блоков; из него строятся предпросмотр, .docx и .pdf,
   поэтому текст во всех трёх видах совпадает. */
(function (root) {
  'use strict';
  var L = root.DocumLogic || (typeof require !== 'undefined' ? require('./validation.js') : null);

  /* ---------- Поля ---------- */
  var FIELDS = {
    number: { type: 'text' },
    date: { type: 'date' },
    city: { type: 'text' },

    ip_name: { type: 'text', group: 'g.ip' },
    ip_fio: { type: 'text' },
    ip_iin: { type: 'text', rule: 'iin', mode: 'numeric', max: 12 },
    ip_addr: { type: 'text' },
    ip_res: { type: 'text' },
    ip_contact: { type: 'text', optional: true },
    ip_doc_no: { type: 'text', rule: 'idNum', mode: 'numeric', max: 9 },
    ip_doc_date: { type: 'date' },
    ip_iik: { type: 'text' },
    ip_bank: { type: 'text' },
    ip_bik: { type: 'text' },

    cp_name: { type: 'text', group: 'g.cp' },
    cp_bin: { type: 'text', rule: 'iin', mode: 'numeric', max: 12 },
    cp_addr: { type: 'text' },
    cp_rep: { type: 'text', optional: true },
    cp_contact: { type: 'text', optional: true },

    subject: { type: 'area' },
    start: { type: 'date' },
    end: { type: 'date' },
    third: { type: 'check', optional: true },

    price: { type: 'text', rule: 'money', mode: 'decimal' },
    vat: { type: 'check', optional: true },
    pay_order: { type: 'select', options: ['prepay', 'postpay'], init: 'postpay' },
    pay_days: { type: 'text', rule: 'posInt', mode: 'numeric' },
    penalty: { type: 'text', rule: 'penalty', mode: 'decimal', optional: true },

    basis: { type: 'text', optional: true },
    due: { type: 'date' },
    items: { type: 'items' },
    items_act: { type: 'items', withDate: true },
    contract_no: { type: 'text' },
    contract_date: { type: 'date' },

    w_fio: { type: 'text', group: 'g.worker' },
    w_iin: { type: 'text', rule: 'iin', mode: 'numeric', max: 12 },
    w_addr: { type: 'text' },
    w_doc_no: { type: 'text', rule: 'idNum', mode: 'numeric', max: 9 },
    w_doc_date: { type: 'date' },
    age16: { type: 'check', rule: 'age' },
    position: { type: 'text' },
    place: { type: 'text' },
    term_kind: { type: 'select', options: ['indefinite', 'fixed'], init: 'indefinite' },
    term_months: { type: 'text', rule: 'termMonths', mode: 'numeric', showIf: function (d) { return d.term_kind === 'fixed'; } },
    work_start: { type: 'date' },
    probation: { type: 'text', rule: 'probation', mode: 'numeric', init: '0' },
    manager: { type: 'check', optional: true },
    hours: { type: 'text', rule: 'hours', mode: 'numeric', init: '40' },
    regime: { type: 'select', options: ['five', 'six'], init: 'five' },
    salary: { type: 'text', rule: 'money', mode: 'decimal' },
    pay_day: { type: 'text', rule: 'payDay', mode: 'numeric' },
    leave_contract: { type: 'text', rule: 'leaveContract', mode: 'numeric', init: '24' },

    year_from: { type: 'date' },
    year_to: { type: 'date', rule: 'workYear' },
    leave_kind: { type: 'select', options: ['full', 'part'], init: 'full' },
    leave_days: { type: 'text', rule: 'leaveDays', mode: 'numeric' },
    leave_start: { type: 'date' },
    holidays: { type: 'text', rule: 'nonNegInt', mode: 'numeric', init: '0' },
    leave_basis: { type: 'text', optional: true },

    addressee: { type: 'text' },
    cert_salary: { type: 'text', rule: 'money', mode: 'decimal', optional: true },

    term_date: { type: 'date' },
    unused_days: { type: 'text', rule: 'nonNegInt', mode: 'numeric', optional: true },

    // Аренда нежилого помещения
    lease_role: { type: 'select', options: ['lessee', 'lessor'], init: 'lessee' },
    obj_addr: { type: 'text' },
    obj_area: { type: 'text', rule: 'area', mode: 'decimal' },
    obj_purpose: { type: 'text' },
    obj_doc: { type: 'text', optional: true },
    lease_term: { type: 'select', options: ['fixed', 'indefinite'], init: 'fixed' },
    lease_months: { type: 'text', rule: 'leaseMonths', mode: 'numeric', showIf: function (d) { return d.lease_term === 'fixed'; } },
    lease_start: { type: 'date' },
    rent: { type: 'text', rule: 'money', mode: 'decimal' },
    rent_day: { type: 'text', rule: 'monthDay', mode: 'numeric', init: '10' },
    deposit: { type: 'text', rule: 'money', mode: 'decimal', optional: true },
    utilities: { type: 'select', options: ['separate', 'inRent'], init: 'separate' },

    // Поставка
    ship_days: { type: 'text', rule: 'posInt', mode: 'numeric' },
    ship_place: { type: 'text' },
    ship_by: { type: 'select', options: ['bySupplier', 'byBuyer'], init: 'bySupplier' },
    pay_mode: { type: 'select', options: ['afterShip', 'prepayFull'], init: 'afterShip' },
    valid_to: { type: 'date', optional: true },

    // Подряд
    work_subject: { type: 'area' },
    materials: { type: 'select', options: ['matContractor', 'matCustomer'], init: 'matContractor' },
    work_price: { type: 'text', rule: 'money', mode: 'decimal' },
    advance: { type: 'text', rule: 'advance', mode: 'decimal', optional: true },
    warranty: { type: 'text', rule: 'nonNegInt', mode: 'numeric', optional: true },

    // Заём
    loan_role: { type: 'select', options: ['borrower', 'lender'], init: 'borrower' },
    cp_business: { type: 'check', rule: 'cpBusiness', showIf: function (d) { return d.loan_role === 'lender'; } },
    loan_sum: { type: 'text', rule: 'money', mode: 'decimal' },
    loan_free: { type: 'check', optional: true },
    loan_rate: { type: 'text', rule: 'penalty', mode: 'decimal', showIf: function (d) { return !d.loan_free; } },
    loan_days: { type: 'text', rule: 'posInt', mode: 'numeric', init: '3' },
    loan_return: { type: 'date' },

    // Доверенность
    rep_fio: { type: 'text', group: 'g.rep' },
    rep_iin: { type: 'text', rule: 'iin', mode: 'numeric', max: 12 },
    rep_doc_no: { type: 'text', rule: 'idNum', mode: 'numeric', max: 9 },
    rep_doc_date: { type: 'date' },
    powers: { type: 'area' },
    poa_until: { type: 'date', rule: 'poaTerm' },
    subst: { type: 'check', optional: true },

    // Соглашение о расторжении
    cancel_date: { type: 'date' },
    settle: { type: 'select', options: ['settleNone', 'ipPays', 'cpPays'], init: 'settleNone' },
    settle_sum: { type: 'text', rule: 'money', mode: 'decimal', showIf: function (d) { return d.settle !== 'settleNone'; } },
    settle_days: { type: 'text', rule: 'posInt', mode: 'numeric', showIf: function (d) { return d.settle !== 'settleNone'; } },
    claims: { type: 'check', optional: true },

    // Командировка
    trip_place: { type: 'text' },
    trip_goal: { type: 'area' },
    trip_from: { type: 'date' },
    trip_to: { type: 'date' },
    trip_advance: { type: 'text', rule: 'money', mode: 'decimal', optional: true },

    // Премирование
    bonus_reason: { type: 'area' },
    bonus_sum: { type: 'text', rule: 'money', mode: 'decimal' },
    bonus_pay: { type: 'select', options: ['withSalary', 'separately'], init: 'withSalary' },

    // Дистанционная работа
    remote_kind: { type: 'select', options: ['remoteFull', 'remoteMixed'], init: 'remoteFull' },
    equip: { type: 'select', options: ['equipEmployer', 'equipOwn'], init: 'equipEmployer' },
    equip_comp: { type: 'text', rule: 'money', mode: 'decimal', showIf: function (d) { return d.equip === 'equipOwn'; } },
    comm: { type: 'text' },
    avail: { type: 'text' }
  };

  var IP_SHORT = ['ip_name', 'ip_fio', 'ip_iin', 'ip_addr'];
  var IP_BANK = IP_SHORT.concat(['ip_iik', 'ip_bank', 'ip_bik']);
  var CP = ['cp_name', 'cp_bin', 'cp_addr'];

  /* ---------- Документы ---------- */
  var DOCS = {
    services: {
      cat: 'contracts', icon: 'contract',
      steps: [
        { key: 's.general', fields: ['number', 'date', 'city'] },
        { key: 's.parties', fields: IP_BANK.concat(CP, ['cp_rep']) },
        { key: 's.subject', fields: ['subject', 'start', 'end', 'third'] },
        { key: 's.payment', fields: ['price', 'vat', 'pay_order', 'pay_days', 'penalty'], summary: 'price' }
      ]
    },
    invoice: {
      cat: 'accounting', icon: 'invoice',
      steps: [
        { key: 's.partiesInv', fields: ['number', 'date'].concat(IP_BANK, CP, ['basis']) },
        { key: 's.items', fields: ['items', 'vat', 'due'], summary: 'items' }
      ]
    },
    act: {
      cat: 'accounting', icon: 'act',
      steps: [
        { key: 's.partiesAct', fields: ['number', 'date'].concat(IP_SHORT, ['ip_contact'], CP, ['cp_contact', 'contract_no', 'contract_date']) },
        { key: 's.works', fields: ['items_act', 'vat'], summary: 'items' }
      ]
    },
    employment: {
      cat: 'hr', icon: 'contract',
      steps: [
        { key: 's.general', fields: ['number', 'date', 'city'] },
        { key: 's.parties', fields: ['ip_name', 'ip_fio', 'ip_iin', 'ip_res', 'ip_doc_no', 'ip_doc_date', 'w_fio', 'w_iin', 'w_addr', 'w_doc_no', 'w_doc_date', 'age16'] },
        { key: 's.job', fields: ['position', 'place', 'term_kind', 'term_months', 'work_start', 'probation', 'manager'] },
        { key: 's.time', fields: ['hours', 'regime', 'salary', 'pay_day', 'leave_contract'] }
      ]
    },
    hire: {
      cat: 'hr', icon: 'order',
      steps: [
        { key: 's.orderReq', fields: ['number', 'date', 'city', 'ip_name', 'ip_fio'] },
        { key: 's.workerCond', fields: ['w_fio', 'position', 'work_start', 'salary', 'probation', 'manager', 'contract_no', 'contract_date'] }
      ]
    },
    leave: {
      cat: 'hr', icon: 'order',
      steps: [
        { key: 's.orderReq', fields: ['number', 'date', 'city', 'ip_name', 'ip_fio'] },
        { key: 's.leave', fields: ['w_fio', 'position', 'year_from', 'year_to', 'leave_kind', 'leave_days', 'leave_start', 'holidays', 'leave_basis'], summary: 'leave' }
      ]
    },
    certificate: {
      cat: 'hr', icon: 'cert',
      steps: [
        { key: 's.certReq', fields: ['number', 'date', 'city', 'ip_name', 'ip_fio', 'ip_iin', 'ip_addr', 'addressee'] },
        { key: 's.certInfo', fields: ['w_fio', 'position', 'work_start', 'cert_salary'] }
      ]
    },
    termination: {
      cat: 'hr', icon: 'order',
      steps: [
        { key: 's.orderReq', fields: ['number', 'date', 'city', 'ip_name', 'ip_fio'] },
        { key: 's.termination', fields: ['w_fio', 'position', 'contract_no', 'contract_date', 'term_date', 'unused_days'] }
      ]
    },
    lease: {
      cat: 'contracts', icon: 'contract',
      steps: [
        { key: 's.general', fields: ['number', 'date', 'city'] },
        { key: 's.parties', fields: ['lease_role'].concat(IP_BANK, CP, ['cp_rep']) },
        { key: 's.object', fields: ['obj_addr', 'obj_area', 'obj_purpose', 'obj_doc', 'lease_term', 'lease_months', 'lease_start'] },
        { key: 's.rent', fields: ['rent', 'vat', 'rent_day', 'deposit', 'utilities', 'penalty'], summary: 'rent' }
      ]
    },
    supply: {
      cat: 'contracts', icon: 'contract',
      steps: [
        { key: 's.general', fields: ['number', 'date', 'city'] },
        { key: 's.parties', fields: IP_BANK.concat(CP, ['cp_rep']) },
        { key: 's.goods', fields: ['items', 'vat'], summary: 'items' },
        { key: 's.delivery', fields: ['ship_days', 'ship_place', 'ship_by', 'pay_mode', 'pay_days', 'penalty', 'valid_to'] }
      ]
    },
    works: {
      cat: 'contracts', icon: 'contract',
      steps: [
        { key: 's.general', fields: ['number', 'date', 'city'] },
        { key: 's.parties', fields: IP_BANK.concat(CP, ['cp_rep']) },
        { key: 's.subject', fields: ['work_subject', 'start', 'end', 'materials'] },
        { key: 's.payment', fields: ['work_price', 'vat', 'advance', 'pay_days', 'warranty', 'penalty'], summary: 'work_price' }
      ]
    },
    loan: {
      cat: 'contracts', icon: 'contract',
      steps: [
        { key: 's.general', fields: ['number', 'date', 'city'] },
        { key: 's.parties', fields: ['loan_role'].concat(IP_BANK, CP, ['cp_rep', 'cp_business']) },
        { key: 's.loan', fields: ['loan_sum', 'loan_free', 'loan_rate', 'loan_days', 'loan_return', 'penalty'] }
      ]
    },
    poa: {
      cat: 'contracts', icon: 'cert',
      steps: [
        { key: 's.general', fields: ['number', 'date', 'city'] },
        { key: 's.parties', fields: IP_SHORT.concat(['rep_fio', 'rep_iin', 'rep_doc_no', 'rep_doc_date']) },
        { key: 's.powers', fields: ['powers', 'poa_until', 'subst'] }
      ]
    },
    cancel: {
      cat: 'contracts', icon: 'act',
      steps: [
        { key: 's.general', fields: ['number', 'date', 'city'] },
        { key: 's.parties', fields: IP_SHORT.concat(CP, ['cp_rep']) },
        { key: 's.cancel', fields: ['contract_no', 'contract_date', 'cancel_date', 'settle', 'settle_sum', 'settle_days', 'claims'] }
      ]
    },
    trip: {
      cat: 'hr', icon: 'order',
      steps: [
        { key: 's.orderReq', fields: ['number', 'date', 'city', 'ip_name', 'ip_fio'] },
        { key: 's.trip', fields: ['w_fio', 'position', 'trip_place', 'trip_goal', 'trip_from', 'trip_to', 'trip_advance'] }
      ]
    },
    bonus: {
      cat: 'hr', icon: 'order',
      steps: [
        { key: 's.orderReq', fields: ['number', 'date', 'city', 'ip_name', 'ip_fio'] },
        { key: 's.bonus', fields: ['w_fio', 'position', 'bonus_reason', 'bonus_sum', 'bonus_pay'] }
      ]
    },
    remote: {
      cat: 'hr', icon: 'contract',
      steps: [
        { key: 's.general', fields: ['number', 'date', 'city'] },
        { key: 's.parties', fields: ['ip_name', 'ip_fio', 'ip_iin', 'ip_res', 'ip_doc_no', 'ip_doc_date', 'w_fio', 'w_iin', 'w_addr', 'w_doc_no', 'w_doc_date', 'age16'] },
        { key: 's.job', fields: ['position', 'place', 'term_kind', 'term_months', 'work_start', 'probation', 'manager'] },
        { key: 's.remote', fields: ['remote_kind', 'equip', 'equip_comp', 'comm', 'avail'] },
        { key: 's.time', fields: ['hours', 'regime', 'salary', 'pay_day', 'leave_contract'] }
      ]
    }
  };

  // Порядок в каталоге: договоры, бухгалтерия, кадры.
  DOCS = ['services', 'lease', 'supply', 'works', 'loan', 'poa', 'cancel', 'invoice', 'act',
    'employment', 'remote', 'hire', 'leave', 'trip', 'bonus', 'certificate', 'termination'
  ].reduce(function (o, k) { o[k] = DOCS[k]; return o; }, {});

  /* ---------- Помощники текста ---------- */
  var BLANK_DATE = '___ __________ 20__ года';
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function longDate(iso) {
    if (!L.parseISO(iso)) return BLANK_DATE;
    return iso.slice(8, 10) + ' ' + MONTHS[+iso.slice(5, 7) - 1] + ' ' + iso.slice(0, 4) + ' года';
  }
  var fd = longDate;
  function v(x) { return L.isEmpty(x) ? '____________' : String(x).trim(); }
  function money(t) { return L.fmtMoney(t) + ' тенге'; }
  function monthsWord(n) {
    var a = n % 100, b = n % 10;
    if (a > 10 && a < 20) return 'месяцев';
    if (b === 1) return 'месяц';
    if (b >= 2 && b <= 4) return 'месяца';
    return 'месяцев';
  }
  function daysWord(n) {
    var a = n % 100, b = n % 10;
    if (a > 10 && a < 20) return 'календарных дней';
    if (b === 1) return 'календарный день';
    if (b >= 2 && b <= 4) return 'календарных дня';
    return 'календарных дней';
  }
  function hoursWord(n) {
    var a = n % 100, b = n % 10;
    if (a > 10 && a < 20) return 'часов';
    if (b === 1) return 'час';
    if (b >= 2 && b <= 4) return 'часа';
    return 'часов';
  }
  // Должность внутри фразы: со строчной буквы, аббревиатуры не трогаем.
  function pos(d) {
    var s = v(d.position);
    return /^[А-ЯЁA-Z][а-яёa-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  }
  function workDaysWord(n) { return L.plural(n, ['рабочий день', 'рабочих дня', 'рабочих дней']); }
  // Скобки вокруг значения прописью заданы здесь, чтобы менять их в одном месте.
  function say(text) { return '(' + text + ')'; }
  function num(value, unitFn) {
    var n = L.parseInt10(value);
    if (isNaN(n)) return '____ ' + unitFn(0);
    return n + ' ' + say(L.intWordsRu(n)) + ' ' + unitFn(n);
  }
  function moneyW(t) { return money(t) + ' ' + say(L.moneyWordsRu(t)); }
  function percentW(value) {
    var s = String(value).trim(), n = L.parseInt10(s);
    if (isNaN(n)) return s + ' ' + say(L.decimalWordsRu(s)) + ' процента';
    return n + ' ' + say(L.intWordsRu(n)) + ' ' + L.plural(n, ['процент', 'процента', 'процентов']);
  }
  var VAT_TEXT = percentW(String(Math.round(L.VAT_RATE * 100)));
  var ORDINALS = ['', 'первое', 'второе', 'третье', 'четвёртое', 'пятое', 'шестое', 'седьмое', 'восьмое', 'девятое', 'десятое'];
  function initials(fio) {
    // «улы», «кызы» и подобные части отчества инициалом не становятся.
    var p = String(fio || '').trim().split(/\s+/).filter(function (x) {
      return x && !/^(улы|ұлы|уулу|кызы|қызы|гызы|оглы|оглу)$/i.test(x);
    });
    if (!p.length) return '____________';
    return p[0] + (p.length > 1 ? ' ' + p.slice(1, 3).map(function (x) { return x.charAt(0).toUpperCase() + '.'; }).join('') : '');
  }

  var T = function (text) { return { k: 'title', text: text }; };
  var C = function (text, bold) { return { k: 'center', text: text, bold: !!bold }; };
  var R = function (l, r) { return { k: 'row', left: l, right: r }; };
  var H = function (text) { return { k: 'h', text: text }; };
  var P = function (text, opt) { return Object.assign({ k: 'p', text: text }, opt || {}); };
  var G = function () { return { k: 'gap' }; };

  // Название и ФИО идут рядом: название может отличаться от ФИО предпринимателя.
  function ipIntro(d) {
    return v(d.ip_name) + ' (индивидуальный предприниматель ' + v(d.ip_fio) + ')';
  }
  // Если приставка уже введена («г. Алматы», «с. Аксу»), вторую не добавляем.
  function place(d) {
    var s = v(d.city);
    if (L.isEmpty(d.city) || /^(г\.|с\.|п\.|пос\.|пгт|ст\.|город|село|посёлок|поселок|аул)\s*/i.test(s)) return L.isEmpty(d.city) ? 'г. ' + s : s;
    return 'г. ' + s;
  }
  function ipReq(d) {
    return [v(d.ip_name), 'ФИО: ' + v(d.ip_fio), 'ИИН: ' + v(d.ip_iin), 'Место нахождения: ' + v(d.ip_addr)];
  }
  function bankReq(d) {
    return ['ИИК: ' + v(d.ip_iik), 'Банк: ' + v(d.ip_bank), 'БИК: ' + v(d.ip_bik)];
  }
  function cpReq(d) {
    return [v(d.cp_name), 'БИН/ИИН: ' + v(d.cp_bin), 'Адрес: ' + v(d.cp_addr)];
  }
  function orderHead(d, topic) {
    return [
      C(v(d.ip_name), true),
      G(),
      T('ПРИКАЗ'),
      R(fd(d.date), '№ ' + v(d.number) + '-к'),
      C(place(d)),
      G(),
      P(topic, { bold: true })
    ];
  }
  function orderSign(d, withWorker) {
    var b = [G(), R('Индивидуальный предприниматель', '______________ ' + initials(d.ip_fio)), P('М.П. (при наличии)')];
    if (withWorker) b.push(G(), R('С приказом ознакомлен(а):', '______________ ' + initials(d.w_fio)), R('', 'Дата: ' + BLANK_DATE));
    return b;
  }

  function cpIntro(d) {
    return v(d.cp_name) + ', БИН/ИИН ' + v(d.cp_bin) + (L.isEmpty(d.cp_rep) ? '' : ', в лице ' + d.cp_rep.trim());
  }
  function penaltyText(d, no) {
    return L.isEmpty(d.penalty)
      ? no + 'За неисполнение или ненадлежащее исполнение обязательств стороны несут ответственность в соответствии с законодательством Республики Казахстан.'
      : no + 'За просрочку исполнения обязательства виновная сторона уплачивает другой стороне неустойку в размере ' + percentW(d.penalty) + ' от суммы неисполненного обязательства за каждый день просрочки.';
  }
  // Реквизиты двух сторон: у ИП есть банковский счёт, у контрагента — основные данные.
  function sides(d, ipRole, cpRole) {
    return {
      k: 'cols',
      left: [ipRole].concat(ipReq(d), bankReq(d)),
      right: [cpRole].concat(cpReq(d)),
      signLeft: ['______________ ' + initials(d.ip_fio), 'М.П. (при наличии)'],
      signRight: ['______________', 'М.П. (при наличии)']
    };
  }
  var ORDER = { k: 'order' };

  /* ---------- Шаблоны ---------- */
  var BUILD = {
    services: function (d) {
      var t = L.totals(L.toTiyn(d.price) || 0, d.vat);
      var pay = d.vat
        ? 'Стоимость услуг составляет ' + moneyW(t.subtotal) + ', НДС ' + VAT_TEXT + ' — ' + moneyW(t.vat) + '. Всего к оплате: ' + moneyW(t.total) + '.'
        : 'Стоимость услуг составляет ' + moneyW(t.total) + ', без НДС.';
      var when = d.pay_order === 'prepay' ? 'со дня заключения настоящего договора' : 'со дня подписания акта выполненных работ (оказанных услуг)';
      return [
        T('ДОГОВОР ОКАЗАНИЯ УСЛУГ № ' + v(d.number)),
        R(place(d), longDate(d.date)),
        G(),
        P(ipIntro(d) + ', ИИН ' + v(d.ip_iin) + ', далее — «Исполнитель», с одной стороны, и ' + v(d.cp_name) + ', БИН/ИИН ' + v(d.cp_bin) + (L.isEmpty(d.cp_rep) ? '' : ', в лице ' + d.cp_rep.trim()) + ', далее — «Заказчик», с другой стороны, заключили настоящий договор о следующем.'),
        H('1. Предмет договора'),
        P('1.1. Исполнитель обязуется по заданию Заказчика оказать услуги: ' + v(d.subject) + ', а Заказчик обязуется оплатить эти услуги.'),
        P('1.2. Услуги оказываются в период с ' + fd(d.start) + ' по ' + fd(d.end) + '.'),
        P(d.third ? '1.3. Исполнитель вправе привлекать к оказанию услуг третьих лиц и отвечает перед Заказчиком за их действия.' : '1.3. Исполнитель оказывает услуги лично.'),
        H('2. Права и обязанности сторон'),
        P('2.1. Исполнитель обязан оказать услуги в согласованный срок и по окончании оказания услуг представить Заказчику акт выполненных работ (оказанных услуг).'),
        P('2.2. Заказчик обязан предоставить сведения, необходимые для оказания услуг, принять оказанные услуги и оплатить их в порядке, установленном настоящим договором.'),
        H('3. Стоимость и порядок оплаты'),
        P('3.1. ' + pay),
        P('3.2. Срок оплаты услуг — ' + num(d.pay_days, workDaysWord) + ' ' + when + '. Оплата производится путём перечисления денег на банковский счёт Исполнителя.'),
        H('4. Приёмка услуг'),
        P('4.1. Факт оказания услуг подтверждается актом выполненных работ (оказанных услуг), подписанным сторонами.'),
        H('5. Отказ от исполнения договора'),
        P('5.1. Заказчик вправе отказаться от исполнения настоящего договора при условии оплаты Исполнителю фактически понесённых им расходов.'),
        P('5.2. Исполнитель вправе отказаться от исполнения обязательств по настоящему договору в порядке, предусмотренном статьёй 686 Гражданского кодекса Республики Казахстан.'),
        H('6. Ответственность сторон'),
        P(L.isEmpty(d.penalty)
          ? '6.1. За неисполнение или ненадлежащее исполнение обязательств стороны несут ответственность в соответствии с законодательством Республики Казахстан.'
          : '6.1. За просрочку исполнения обязательства виновная сторона уплачивает другой стороне неустойку в размере ' + percentW(d.penalty) + ' от суммы неисполненного обязательства за каждый день просрочки.'),
        H('7. Заключительные положения'),
        P('7.1. Договор вступает в силу со дня подписания и действует до полного исполнения сторонами своих обязательств.'),
        P('7.2. Изменения к договору действительны, если совершены в письменной форме и подписаны сторонами.'),
        P('7.3. Споры разрешаются путём переговоров, а при недостижении согласия — в суде в соответствии с законодательством Республики Казахстан.'),
        P('7.4. Договор составлен в двух экземплярах, по одному для каждой стороны.'),
        H('8. Реквизиты и подписи сторон'),
        {
          k: 'cols',
          left: ['Исполнитель'].concat(ipReq(d), bankReq(d)),
          right: ['Заказчик'].concat(cpReq(d)),
          signLeft: ['______________ ' + initials(d.ip_fio), 'М.П. (при наличии)'],
          signRight: ['______________', 'М.П. (при наличии)']
        }
      ];
    },

    invoice: function (d) {
      var items = d.items || [];
      var t = L.calcItems(items, d.vat);
      var rows = items.map(function (it, i) {
        return [String(i + 1), v(it.name), v(it.unit), String(it.qty || '').trim(), L.fmtMoney(L.toTiyn(it.price) || 0), L.fmtMoney(L.itemCost(it))];
      });
      var out = [
        T('СЧЁТ НА ОПЛАТУ № ' + v(d.number) + ' от ' + fd(d.date)),
        G(),
        P('Поставщик: ' + ipIntro(d) + ', ИИН ' + v(d.ip_iin) + ', место нахождения: ' + v(d.ip_addr) + '.'),
        P('Банковские реквизиты: ИИК ' + v(d.ip_iik) + ', ' + v(d.ip_bank) + ', БИК ' + v(d.ip_bik) + '.'),
        P('Покупатель: ' + v(d.cp_name) + ', БИН/ИИН ' + v(d.cp_bin) + ', адрес: ' + v(d.cp_addr) + '.')
      ];
      if (!L.isEmpty(d.basis)) out.push(P('Основание: ' + d.basis.trim() + '.'));
      out.push(G(), {
        k: 'table', widths: [6, 40, 10, 10, 17, 17], align: ['c', 'l', 'c', 'r', 'r', 'r'],
        head: ['№', 'Наименование', 'Ед. изм.', 'Кол-во', 'Цена, тенге', 'Сумма, тенге'], rows: rows
      }, G());
      out.push(P('Итого: ' + moneyW(t.subtotal) + '.'));
      out.push(P(d.vat ? 'НДС ' + VAT_TEXT + ': ' + moneyW(t.vat) + '.' : 'Без НДС.'));
      out.push(P('Всего к оплате: ' + moneyW(t.total) + '.', { bold: true }));
      out.push(P('Срок оплаты: до ' + fd(d.due) + '.'));
      out.push(G(), R('Индивидуальный предприниматель', '______________ ' + initials(d.ip_fio)), P('М.П. (при наличии)'));
      return out;
    },

    act: function (d) {
      var items = d.items_act || [];
      var t = L.calcItems(items, d.vat);
      var rows = items.map(function (it, i) {
        return [String(i + 1), v(it.name), L.isEmpty(it.done) ? '' : fd(it.done), '', v(it.unit), String(it.qty || '').trim(), L.fmtMoney(L.toTiyn(it.price) || 0), L.fmtMoney(L.itemCost(it))];
      });
      var qty = items.reduce(function (a, it) { return a + (L.parseNum(it.qty) || 0); }, 0);
      rows.push(['', '', '', '', 'Итого', String(Math.round(qty * 1000) / 1000).replace('.', ','), 'х', L.fmtMoney(t.subtotal)]);
      var contact = function (x) { return L.isEmpty(x) ? '' : ', ' + String(x).trim(); };
      var out = [
        { k: 'small', text: 'Форма Р-1', right: true },
        P('Заказчик: ' + v(d.cp_name) + ', ' + v(d.cp_addr) + contact(d.cp_contact) + '. ИИН/БИН: ' + v(d.cp_bin) + '.'),
        P('Исполнитель: ' + ipIntro(d) + ', место нахождения: ' + v(d.ip_addr) + contact(d.ip_contact) + '. ИИН/БИН: ' + v(d.ip_iin) + '.'),
        P('Договор (контракт) № ' + v(d.contract_no) + ' от ' + longDate(d.contract_date)),
        G(),
        R('Номер документа: ' + v(d.number), 'Дата составления: ' + fd(d.date)),
        T('АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)*'),
        {
          k: 'table', small: true, widths: [9, 21, 11, 16, 10, 11, 10, 12], align: ['c', 'l', 'c', 'l', 'c', 'r', 'r', 'r'],
          headTop: [
            { t: 'Номер по порядку', r: 2 },
            { t: 'Наименование работ (услуг) (в разрезе их подвидов в соответствии с технической спецификацией, заданием, графиком выполнения работ (услуг) при их наличии)', r: 2 },
            { t: 'Дата выполнения работ (оказания услуг)**', r: 2 },
            { t: 'Сведения об отчете о научных исследованиях, маркетинговых, консультационных и прочих услугах (дата, номер, количество страниц) (при их наличии)***', r: 2 },
            { t: 'Единица измерения', r: 2 },
            { t: 'Выполнено работ (оказано услуг)', c: 3 }
          ],
          headSub: ['количество', 'цена за единицу', 'стоимость'],
          numbers: ['1', '2', '3', '4', '5', '6', '7', '8'], rows: rows
        },
        G()
      ];
      if (d.vat) out.push(P('НДС ' + VAT_TEXT + ': ' + moneyW(t.vat) + '.'));
      out.push(P('Всего по акту: ' + moneyW(t.total) + '.', { bold: true }));
      out.push(P('Сведения об использовании запасов, полученных от заказчика: ____________'));
      out.push(P('Приложение: перечень документации, в том числе отчет(ы) о маркетинговых, научных исследованиях, консультационных и прочих услугах (обязательны при его (их) наличии) на ____ страницах.'));
      out.push(G(), {
        k: 'cols',
        left: ['Сдал (Исполнитель)'],
        right: ['Принял (Заказчик)'],
        signLeft: ['______ / ______ / ' + initials(d.ip_fio), 'должность / подпись / расшифровка подписи', 'М.П. (при наличии)'],
        signRight: ['______ / ______ / ______', 'должность / подпись / расшифровка подписи', 'М.П. (при наличии)', 'Дата подписания (принятия) работ (услуг): ' + BLANK_DATE]
      }, G());
      out.push({ k: 'small', text: '* Применяется для приемки-передачи выполненных работ (оказанных услуг), за исключением строительно-монтажных работ.' });
      out.push({ k: 'small', text: '** Заполняется в случае, если даты выполненных работ (оказанных услуг) приходятся на различные периоды, а также в случае, если даты выполнения работ (оказания услуг) и даты подписания (принятия) работ (услуг) различны.' });
      out.push({ k: 'small', text: '*** Заполняется в случае наличия отчета о научных исследованиях, маркетинговых, консультационных и прочих услугах.' });
      return out;
    },

    employment: function (d) {
      var prob = L.parseInt10(d.probation) || 0, payDay = L.parseInt10(d.pay_day);
      var term = d.term_kind === 'fixed'
        ? 'на определённый срок: ' + num(d.term_months, monthsWord)
        : 'на неопределённый срок';
      var reg = d.regime === 'six' ? 'шестидневная рабочая неделя с одним выходным днём' : 'пятидневная рабочая неделя с двумя выходными днями';
      var sal = L.toTiyn(d.salary) || 0;
      return [
        T('ТРУДОВОЙ ДОГОВОР № ' + v(d.number)),
        R(place(d), longDate(d.date)),
        G(),
        P(ipIntro(d) + ', далее — «Работодатель», с одной стороны, и ' + v(d.w_fio) + ', далее — «Работник», с другой стороны, заключили настоящий трудовой договор о следующем.'),
        H('1. Предмет договора, трудовая функция и место работы'),
        P('1.1. Работодатель принимает Работника на работу, а Работник обязуется лично выполнять работу по должности: ' + pos(d) + '.'),
        P('1.2. Место выполнения работы: ' + v(d.place) + '.'),
        P('1.3. Работник выполняет работу в соответствии с настоящим договором, правилами трудового распорядка и иными актами Работодателя, с которыми он ознакомлен.'),
        H('2. Срок договора и начало работы'),
        P('2.1. Договор заключён ' + term + '.'),
        P('2.2. Дата начала работы: ' + fd(d.work_start) + '.'),
        P(prob > 0 ? '2.3. Работнику устанавливается испытательный срок: ' + num(d.probation, monthsWord) + '.' : '2.3. Испытательный срок не устанавливается.'),
        prob > 0 ? P('2.4. Если срок испытания истёк и Работодатель не уведомил о расторжении договора, Работник считается прошедшим испытательный срок. При отрицательном результате испытания Работодатель вправе расторгнуть договор, представив Работнику уведомление с указанием причин.') : null,
        H('3. Рабочее время и время отдыха'),
        P('3.1. Работнику устанавливается ' + reg + '. Продолжительность рабочего времени — ' + num(d.hours, hoursWord) + ' в неделю.'),
        P('3.2. В течение рабочего дня Работнику предоставляется один перерыв для отдыха и приёма пищи продолжительностью не менее получаса. Перерыв не включается в рабочее время. Его время устанавливается правилами трудового распорядка, а при их отсутствии — по соглашению сторон.'),
        P('3.3. Общим выходным днём является воскресенье.' + (d.regime === 'six' ? '' : ' Второй выходной день — суббота, если правилами трудового распорядка не установлено иное.')),
        P('3.4. Сверхурочная работа и работа в выходные и праздничные дни допускаются с письменного согласия Работника, кроме случаев, предусмотренных Трудовым кодексом Республики Казахстан.'),
        P('3.5. Работнику предоставляется основной оплачиваемый ежегодный трудовой отпуск. Его продолжительность — ' + num(d.leave_contract, daysWord) + '.'),
        P('3.6. Отпуск предоставляется и оплачивается в порядке, установленном Трудовым кодексом Республики Казахстан.'),
        H('4. Оплата труда'),
        P('4.1. Работнику устанавливается оклад ' + moneyW(sal) + ' в месяц.'),
        P('4.2. Заработная плата выплачивается в национальной валюте не реже одного раза в месяц. День выплаты: ' + (ORDINALS[payDay] ? payDay + ' ' + say(ORDINALS[payDay]) : '____') + ' число месяца, следующего за отработанным. При совпадении дня выплаты с выходным или праздничным днём выплата производится накануне.'),
        P('4.3. При выплате заработной платы Работодатель ежемесячно в письменной или электронной форме извещает Работника о составных частях заработной платы, размерах и основаниях удержаний, в том числе об обязательных пенсионных взносах, и об общей сумме к выплате.'),
        P('4.4. Удержания из заработной платы производятся по решению суда, а также в случаях, предусмотренных законами Республики Казахстан и Трудовым кодексом Республики Казахстан.'),
        P('4.5. Сверхурочная работа, работа в выходные и праздничные дни, в ночное время и время простоя оплачиваются в порядке, установленном Трудовым кодексом Республики Казахстан.'),
        H('5. Условия труда'),
        P('5.1. Работа не относится к тяжёлым работам и работам с вредными и (или) опасными условиями труда.'),
        P('5.2. Работодатель за свой счёт обеспечивает Работника оборудованием, инструментами, технической документацией и иными средствами, необходимыми для исполнения трудовых обязанностей.'),
        P('5.3. Работник подлежит обязательному социальному страхованию и страхованию от несчастных случаев при исполнении трудовых обязанностей.'),
        H('6. Права и обязанности Работника'),
        P('6.1. Работник имеет право:'),
        P('1) требовать от Работодателя выполнения условий настоящего договора и актов Работодателя;'),
        P('2) на безопасность и охрану труда, рабочее место, оборудованное в соответствии с требованиями безопасности и охраны труда, а также полную и достоверную информацию о состоянии условий и охраны труда;'),
        P('3) на своевременную и в полном объёме выплату заработной платы;'),
        P('4) на отдых, в том числе оплачиваемый ежегодный трудовой отпуск;'),
        P('5) на обязательное социальное страхование и страхование от несчастных случаев при исполнении трудовых обязанностей;'),
        P('6) на возмещение вреда, причинённого здоровью в связи с исполнением трудовых обязанностей;'),
        P('7) на защиту персональных данных, хранящихся у Работодателя;'),
        P('8) получать из единой системы учёта трудовых договоров сведения о трудовом договоре и своей трудовой деятельности;'),
        P('9) отказаться от выполнения работы при возникновении ситуации, создающей угрозу его здоровью или жизни, с извещением об этом Работодателя;'),
        P('10) обращаться за рассмотрением индивидуального трудового спора в порядке, предусмотренном Трудовым кодексом Республики Казахстан.'),
        P('6.2. Работник обязан:'),
        P('1) выполнять трудовые обязанности в соответствии с настоящим договором и актами Работодателя;'),
        P('2) соблюдать трудовую дисциплину;'),
        P('3) соблюдать требования по безопасности и охране труда, пожарной безопасности, кибербезопасности и производственной санитарии на рабочем месте;'),
        P('4) бережно относиться к имуществу Работодателя и работников;'),
        P('5) сообщать Работодателю о возникшей ситуации, представляющей угрозу жизни и здоровью людей, сохранности имущества Работодателя и работников, а также о возникновении простоя;'),
        P('6) возмещать Работодателю причинённый ущерб в пределах, установленных Трудовым кодексом Республики Казахстан и иными законами Республики Казахстан.'),
        P('6.3. Работник имеет иные права и исполняет иные обязанности, предусмотренные Трудовым кодексом Республики Казахстан.'),
        H('7. Права и обязанности Работодателя'),
        P('7.1. Работодатель имеет право:'),
        P('1) требовать от Работника выполнения условий настоящего договора, правил трудового распорядка и других актов Работодателя;'),
        P('2) издавать в пределах своих полномочий акты Работодателя;'),
        P('3) поощрять Работника, налагать дисциплинарные взыскания и привлекать его к материальной ответственности в случаях и порядке, предусмотренных Трудовым кодексом Республики Казахстан;'),
        P('4) на возмещение ущерба, нанесённого Работником при исполнении трудовых обязанностей;'),
        P('5) изменять, дополнять, прекращать и расторгать договор в порядке и по основаниям, установленным Трудовым кодексом Республики Казахстан;'),
        P('6) обращаться в суд в целях защиты своих прав и законных интересов в сфере труда.'),
        P('7.2. Работодатель обязан:'),
        P('1) предоставить Работнику работу, обусловленную настоящим договором;'),
        P('2) своевременно и в полном размере выплачивать заработную плату и иные выплаты;'),
        P('3) обеспечивать условия труда в соответствии с трудовым законодательством Республики Казахстан и настоящим договором;'),
        P('4) знакомить Работника с правилами трудового распорядка и иными актами, имеющими непосредственное отношение к его работе;'),
        P('5) осуществлять обязательное социальное страхование Работника и страховать его от несчастных случаев при исполнении трудовых обязанностей;'),
        P('6) предоставлять ежегодный оплачиваемый трудовой отпуск;'),
        P('7) вести учёт рабочего времени;'),
        P('8) осуществлять сбор, обработку и защиту персональных данных Работника в соответствии с законодательством Республики Казахстан;'),
        P('9) вносить сведения о заключении, изменении и прекращении договора в единую систему учёта трудовых договоров;'),
        P('10) возмещать вред, причинённый жизни и здоровью Работника при исполнении им трудовых обязанностей.'),
        P('7.3. Работодатель имеет иные права и исполняет иные обязанности, предусмотренные Трудовым кодексом Республики Казахстан.'),
        H('8. Конфиденциальность и персональные данные'),
        P('8.1. Работник не разглашает сведения, составляющие служебную, коммерческую или иную охраняемую законом тайну, ставшие ему известными в связи с выполнением трудовых обязанностей.'),
        P('8.2. Перечень таких сведений определяется актами Работодателя, с которыми Работник ознакомлен.'),
        P('8.3. Работник согласен на сбор и обработку своих персональных данных в объёме, необходимом для исполнения настоящего договора и требований законодательства Республики Казахстан. Работодатель обеспечивает их защиту.'),
        H('9. Ответственность сторон'),
        P('9.1. Стороны несут ответственность за неисполнение условий договора в соответствии с законодательством Республики Казахстан.'),
        P('9.2. За совершение дисциплинарного проступка Работодатель вправе применить к Работнику замечание, выговор, строгий выговор или расторгнуть договор по основаниям, предусмотренным Трудовым кодексом Республики Казахстан.'),
        P('9.3. Сторона, причинившая ущерб (вред) другой стороне, возмещает его в соответствии с Трудовым кодексом Республики Казахстан и иными законами Республики Казахстан. Прекращение договора не освобождает от этой ответственности.'),
        P('9.4. При задержке заработной платы и сумм, причитающихся при прекращении договора, Работодатель выплачивает Работнику задолженность и пеню в порядке, установленном статьёй 113 Трудового кодекса Республики Казахстан.'),
        H('10. Изменение и прекращение договора'),
        P('10.1. Изменения и дополнения вносятся в письменной форме дополнительным соглашением сторон.'),
        P('10.2. Уведомление об изменении условий договора рассматривается другой стороной в течение пяти рабочих дней со дня его подачи.'),
        P('10.3. Договор прекращается по основаниям и в порядке, установленным Трудовым кодексом Республики Казахстан.'),
        P('10.4. Работник вправе расторгнуть договор по своей инициативе, уведомив Работодателя не менее чем за один месяц, за исключением случаев, предусмотренных пунктом 3 статьи 56 Трудового кодекса Республики Казахстан. До истечения этого срока договор может быть расторгнут с письменного согласия Работодателя.'),
        P('10.5. Работодатель вправе расторгнуть договор только по основаниям и в порядке, установленным Трудовым кодексом Республики Казахстан.'),
        P('10.6. В день прекращения договора Работодатель выдаёт Работнику документ, подтверждающий трудовую деятельность. Суммы, причитающиеся Работнику, выплачиваются не позднее трёх рабочих дней после прекращения договора.'),
        H('11. Рассмотрение споров'),
        P('11.1. Индивидуальные трудовые споры рассматриваются в порядке, установленном статьёй 159 Трудового кодекса Республики Казахстан: согласительной комиссией, а если рассмотрение комиссией не требуется, по неурегулированным вопросам либо при неисполнении её решения — судом.'),
        H('12. Заключительные положения'),
        P('12.1. Договор вступает в силу со дня его подписания сторонами.'),
        P('12.2. Вопросы, не урегулированные договором, регулируются Трудовым кодексом Республики Казахстан и иным законодательством Республики Казахстан.'),
        P('12.3. Признание недействительными отдельных условий договора не влечёт недействительности договора в целом.'),
        P('12.4. Договор составлен в письменной форме в двух экземплярах и подписан сторонами. По одному экземпляру хранится у Работника и Работодателя.'),
        H('13. Реквизиты и подписи сторон'),
        {
          k: 'cols',
          left: ['Работодатель', v(d.ip_name), 'ФИО: ' + v(d.ip_fio), 'ИИН: ' + v(d.ip_iin), 'Адрес постоянного места жительства, регистрация: ' + v(d.ip_res), 'Удостоверение личности № ' + v(d.ip_doc_no) + ', выдано ' + fd(d.ip_doc_date)],
          right: ['Работник', v(d.w_fio), 'ИИН: ' + v(d.w_iin), 'Адрес постоянного места жительства, регистрация: ' + v(d.w_addr), 'Удостоверение личности № ' + v(d.w_doc_no) + ', выдано ' + fd(d.w_doc_date)],
          signLeft: ['______________ ' + initials(d.ip_fio), 'М.П. (при наличии)'],
          signRight: ['______________ ' + initials(d.w_fio), 'Экземпляр договора получен: ______________']
        }
      ].filter(Boolean);
    },

    hire: function (d) {
      var prob = L.parseInt10(d.probation) || 0, sal = L.toTiyn(d.salary) || 0;
      var text = '1. Принять на работу работника ' + v(d.w_fio) + ' по должности «' + pos(d) + '» с ' + fd(d.work_start) + ' с окладом ' + moneyW(sal) + ' в месяц';
      text += prob > 0 ? ' и испытательным сроком ' + num(d.probation, monthsWord) + '.' : ' без испытательного срока.';
      return orderHead(d, 'О приёме на работу').concat([
        G(),
        P('На основании трудового договора № ' + v(d.contract_no) + ' от ' + fd(d.contract_date) + ':'),
        { k: 'order' },
        P(text)
      ], orderSign(d, true));
    },

    leave: function (d) {
      var r = L.leaveDates(d.leave_start, d.leave_days, d.holidays);
      var kind = d.leave_kind === 'part' ? 'часть оплачиваемого ежегодного трудового отпуска' : 'оплачиваемый ежегодный трудовой отпуск';
      var out = orderHead(d, 'О предоставлении оплачиваемого ежегодного трудового отпуска').concat([
        G(),
        { k: 'order' },
        P('1. Предоставить работнику ' + v(d.w_fio) + ' (должность: ' + pos(d) + ') ' + kind + ' за рабочий год с ' + fd(d.year_from) + ' по ' + fd(d.year_to) + '. Продолжительность отпуска: ' + num(d.leave_days, daysWord) + ', с ' + fd(d.leave_start) + ' по ' + fd(r && r.end) + '. Дата выхода на работу: ' + fd(r && r.back) + '.'),
        P('2. Произвести оплату отпуска в сроки, установленные пунктом 4 статьи 92 Трудового кодекса Республики Казахстан.')
      ]);
      if (!L.isEmpty(d.leave_basis)) out.push(P('Основание: ' + d.leave_basis.trim() + '.'));
      return out.concat(orderSign(d, true));
    },

    certificate: function (d) {
      var out = [
        C(v(d.ip_name), true),
        C('ФИО: ' + v(d.ip_fio) + ', ИИН ' + v(d.ip_iin) + ', место нахождения: ' + v(d.ip_addr)),
        G(),
        R(fd(d.date) + ' № ' + v(d.number), v(d.addressee)),
        C(place(d)),
        G(),
        T('СПРАВКА'),
        P('с места работы', { center: true }),
        G(),
        P('Настоящая справка подтверждает, что ' + v(d.w_fio) + ' работает у ' + v(d.ip_name) + ' по должности «' + pos(d) + '» с ' + fd(d.work_start) + ' по настоящее время.')
      ];
      if (!L.isEmpty(d.cert_salary)) {
        var s = L.toTiyn(d.cert_salary) || 0;
        out.push(P('Размер оклада: ' + moneyW(s) + ' в месяц.'));
      }
      out.push(G(), R('Индивидуальный предприниматель', '______________ ' + initials(d.ip_fio)), P('М.П. (при наличии)'));
      return out;
    },

    termination: function (d) {
      var out = orderHead(d, 'О прекращении трудового договора по соглашению сторон').concat([
        G(),
        P('В соответствии с подпунктом 1) статьи 49 и статьёй 50 Трудового кодекса Республики Казахстан:'),
        { k: 'order' },
        P('1. Прекратить трудовой договор № ' + v(d.contract_no) + ' от ' + fd(d.contract_date) + ' с работником ' + v(d.w_fio) + ' (должность: ' + pos(d) + ') по соглашению сторон ' + fd(d.term_date) + '.'),
        P('2. Произвести выплату сумм, причитающихся работнику, не позднее трёх рабочих дней после прекращения трудового договора.')
      ]);
      var u = L.parseInt10(d.unused_days);
      if (u > 0) out.push(P('3. Произвести компенсационную выплату за ' + num(d.unused_days, daysWord) + ' неиспользованного оплачиваемого ежегодного трудового отпуска.'));
      return out.concat(orderSign(d, true));
    },
    lease: function (d) {
      var ipLessor = d.lease_role === 'lessor';
      var ipRole = ipLessor ? 'Арендодатель' : 'Арендатор', cpRole = ipLessor ? 'Арендатор' : 'Арендодатель';
      var months = L.parseInt10(d.lease_months), fixed = d.lease_term !== 'indefinite', reg = fixed && months >= 12;
      var t = L.totals(L.toTiyn(d.rent) || 0, d.vat), day = L.parseInt10(d.rent_day);
      var rentText = d.vat
        ? 'Арендная плата составляет ' + moneyW(t.subtotal) + ' в месяц, НДС ' + VAT_TEXT + ' — ' + moneyW(t.vat) + '. Всего в месяц: ' + moneyW(t.total) + '.'
        : 'Арендная плата составляет ' + moneyW(t.total) + ' в месяц, без НДС.';
      var n = 0, s3 = function (x) { n++; return P('3.' + n + '. ' + x); };
      var out = [
        T('ДОГОВОР АРЕНДЫ НЕЖИЛОГО ПОМЕЩЕНИЯ № ' + v(d.number)),
        R(place(d), fd(d.date)),
        G(),
        P(ipIntro(d) + ', ИИН ' + v(d.ip_iin) + ', далее — «' + ipRole + '», с одной стороны, и ' + cpIntro(d) + ', далее — «' + cpRole + '», с другой стороны, заключили настоящий договор о следующем.'),
        H('1. Предмет договора'),
        P('1.1. Арендодатель обязуется предоставить Арендатору за плату во временное владение и пользование нежилое помещение (далее — «Помещение»), расположенное по адресу: ' + v(d.obj_addr) + ', общей площадью ' + v(d.obj_area) + ' кв. м.'),
        P('1.2. Помещение предоставляется для использования в качестве: ' + v(d.obj_purpose) + '.'),
        P((L.isEmpty(d.obj_doc) ? '1.3. ' : '1.3. Помещение принадлежит Арендодателю на основании: ' + d.obj_doc.trim() + '. ') + 'Арендодатель подтверждает, что вправе сдавать Помещение в аренду, и предупредил Арендатора обо всех правах третьих лиц на Помещение (статья 549 Гражданского кодекса Республики Казахстан).'),
        P('1.4. Помещение передаётся Арендатору ' + fd(d.lease_start) + ' по акту приёма-передачи, в котором стороны отражают состояние Помещения.'),
        H('2. Срок договора')
      ];
      if (fixed) {
        out.push(P('2.1. Договор заключён на срок ' + num(d.lease_months, monthsWord) + ' со дня передачи Помещения.'));
        out.push(P(reg
          ? '2.2. Договор заключён на срок один год и более и подлежит государственной регистрации (статья 5 Закона Республики Казахстан «О государственной регистрации прав на недвижимое имущество»). Стороны совместно обеспечивают регистрацию.'
          : '2.2. Договор заключён на срок менее одного года и государственной регистрации не подлежит.'));
        out.push(P('2.3. Арендатор, надлежащим образом исполнявший свои обязанности, по истечении срока договора имеет при прочих равных условиях преимущественное право на заключение договора на новый срок (статья 557 Гражданского кодекса Республики Казахстан).'));
      } else {
        out.push(P('2.1. Договор заключён на неопределённый срок.'));
        out.push(P('2.2. Каждая из сторон вправе отказаться от договора, предупредив об этом другую сторону письменно за три месяца (пункт 2 статьи 545 Гражданского кодекса Республики Казахстан).'));
      }
      out.push(H('3. Арендная плата'));
      out.push(s3(rentText));
      out.push(s3('Арендная плата вносится ежемесячно не позднее ' + (isNaN(day) ? '____' : day) + '-го числа текущего месяца путём перечисления денег на банковский счёт Арендодателя.'));
      out.push(s3(d.utilities === 'inRent'
        ? 'Арендная плата включает плату за коммунальные и эксплуатационные услуги.'
        : 'Коммунальные и эксплуатационные услуги в арендную плату не входят и оплачиваются Арендатором отдельно по выставленным счетам.'));
      out.push(s3('Размер арендной платы может изменяться по соглашению сторон не чаще одного раза в год (пункт 3 статьи 546 Гражданского кодекса Республики Казахстан).'));
      if (!L.isEmpty(d.deposit)) out.push(s3('Арендатор вносит обеспечительный платёж в размере ' + moneyW(L.toTiyn(d.deposit) || 0) + ' в течение пяти рабочих дней со дня подписания договора. Платёж возвращается Арендатору при возврате Помещения за вычетом задолженности Арендатора по договору.'));
      return out.concat([
        H('4. Права и обязанности сторон'),
        P('4.1. Арендодатель обязан передать Помещение в состоянии, пригодном для использования по назначению, не препятствовать Арендатору в пользовании Помещением и производить за свой счёт капитальный ремонт Помещения (статья 552 Гражданского кодекса Республики Казахстан).'),
        P('4.2. Арендатор обязан использовать Помещение по назначению, своевременно вносить арендную плату, поддерживать Помещение в исправном состоянии, производить за свой счёт текущий ремонт (статья 553 Гражданского кодекса Республики Казахстан), соблюдать санитарные правила и требования пожарной безопасности.'),
        P('4.3. Арендатор вправе сдавать Помещение в субаренду и производить его перепланировку только с письменного согласия Арендодателя (статья 551 Гражданского кодекса Республики Казахстан).'),
        P('4.4. Неотделимые улучшения, произведённые Арендатором без согласия Арендодателя, возмещению не подлежат (статья 555 Гражданского кодекса Республики Казахстан).'),
        P('4.5. При прекращении договора Арендатор возвращает Помещение по акту в том состоянии, в котором его получил, с учётом нормального износа (статья 561 Гражданского кодекса Республики Казахстан).'),
        H('5. Ответственность сторон'),
        P(penaltyText(d, '5.1. ')),
        H('6. Заключительные положения'),
        P('6.1. Договор вступает в силу со дня подписания сторонами' + (reg ? ', а для третьих лиц — со дня государственной регистрации.' : '.')),
        P('6.2. Изменения к договору действительны, если совершены в письменной форме и подписаны сторонами.'),
        P('6.3. Споры разрешаются путём переговоров, а при недостижении согласия — в суде в соответствии с законодательством Республики Казахстан.'),
        P(reg ? '6.4. Договор составлен в трёх экземплярах: по одному для каждой стороны и один для регистрирующего органа.' : '6.4. Договор составлен в двух экземплярах, по одному для каждой стороны.'),
        H('7. Реквизиты и подписи сторон'),
        sides(d, ipRole, cpRole)
      ]);
    },

    supply: function (d) {
      var items = d.items || [];
      var t = L.calcItems(items, d.vat);
      var rows = items.map(function (it, i) {
        return [String(i + 1), v(it.name), v(it.unit), String(it.qty || '').trim(), L.fmtMoney(L.toTiyn(it.price) || 0), L.fmtMoney(L.itemCost(it))];
      });
      var when = d.pay_mode === 'prepayFull' ? 'со дня заключения настоящего договора, до отгрузки товара' : 'со дня передачи товара Покупателю';
      return [
        T('ДОГОВОР ПОСТАВКИ № ' + v(d.number)),
        R(place(d), fd(d.date)),
        G(),
        P(ipIntro(d) + ', ИИН ' + v(d.ip_iin) + ', далее — «Поставщик», с одной стороны, и ' + cpIntro(d) + ', далее — «Покупатель», с другой стороны, заключили настоящий договор о следующем.'),
        H('1. Предмет договора'),
        P('1.1. Поставщик обязуется передать Покупателю товары, указанные в спецификации (пункт 1.2), для использования в предпринимательской деятельности или в иных целях, не связанных с личным, семейным, домашним и иным подобным использованием, а Покупатель обязуется принять и оплатить товары (статья 458 Гражданского кодекса Республики Казахстан).'),
        P('1.2. Спецификация товаров:'),
        {
          k: 'table', widths: [6, 40, 10, 10, 17, 17], align: ['c', 'l', 'c', 'r', 'r', 'r'],
          head: ['№', 'Наименование', 'Ед. изм.', 'Кол-во', 'Цена, тенге', 'Сумма, тенге'], rows: rows
        },
        P('1.3. Общая стоимость товаров: ' + moneyW(t.subtotal) + (d.vat ? ', НДС ' + VAT_TEXT + ' — ' + moneyW(t.vat) + '. Всего: ' + moneyW(t.total) + '.' : ', без НДС.')),
        H('2. Порядок поставки'),
        P('2.1. Срок поставки — ' + num(d.ship_days, daysWord) + ' со дня заключения договора' + (d.pay_mode === 'prepayFull' ? ' либо со дня поступления предварительной оплаты, если она поступила позже.' : '.')),
        P(d.ship_by === 'byBuyer'
          ? '2.2. Покупатель производит выборку товаров в месте их нахождения: ' + v(d.ship_place) + ', в течение пяти рабочих дней после уведомления о готовности товара (статья 468 Гражданского кодекса Республики Казахстан).'
          : '2.2. Поставщик доставляет товары своим транспортом и за свой счёт по адресу: ' + v(d.ship_place) + ' (статья 463 Гражданского кодекса Республики Казахстан).'),
        P('2.3. Право собственности и риск случайной гибели товара переходят к Покупателю с момента передачи товара. Передача оформляется накладной, подписанной сторонами.'),
        P('2.4. Покупатель обязан осмотреть товар при приёмке, проверить его количество и качество и о выявленных несоответствиях письменно уведомить Поставщика (статья 466 Гражданского кодекса Республики Казахстан).'),
        H('3. Цена и порядок расчётов'),
        P('3.1. Цена товаров указана в спецификации и в течение срока действия договора изменению не подлежит, если стороны не договорились иначе в письменной форме.'),
        P('3.2. Покупатель оплачивает товары в течение ' + num(d.pay_days, workDaysWord) + ' ' + when + ' путём перечисления денег на банковский счёт Поставщика.'),
        H('4. Качество товара'),
        P('4.1. Качество товара должно соответствовать условиям договора, а при их отсутствии — обычно предъявляемым требованиям и требованиям законодательства Республики Казахстан. Последствия поставки товара ненадлежащего качества определяются статьёй 471 Гражданского кодекса Республики Казахстан.'),
        H('5. Ответственность сторон'),
        P(L.isEmpty(d.penalty)
          ? '5.1. За неисполнение или ненадлежащее исполнение обязательств стороны несут ответственность в соответствии с законодательством Республики Казахстан.'
          : '5.1. За просрочку поставки или недопоставку товара Поставщик уплачивает Покупателю неустойку в размере ' + percentW(d.penalty) + ' от стоимости непоставленного товара за каждый день просрочки (статья 474 Гражданского кодекса Республики Казахстан). За просрочку оплаты Покупатель уплачивает Поставщику неустойку в том же размере от неоплаченной суммы за каждый день просрочки.'),
        H('6. Срок действия и заключительные положения'),
        P(L.parseISO(d.valid_to)
          ? '6.1. Договор вступает в силу со дня подписания и действует до ' + fd(d.valid_to) + ', а в части расчётов — до полного их завершения.'
          : '6.1. Договор вступает в силу со дня подписания и действует в течение одного года (пункт 1 статьи 460 Гражданского кодекса Республики Казахстан), а в части расчётов — до полного их завершения.'),
        P('6.2. Изменения к договору действительны, если совершены в письменной форме и подписаны сторонами.'),
        P('6.3. Споры разрешаются путём переговоров, а при недостижении согласия — в суде в соответствии с законодательством Республики Казахстан.'),
        P('6.4. Договор составлен в двух экземплярах, по одному для каждой стороны.'),
        H('7. Реквизиты и подписи сторон'),
        sides(d, 'Поставщик', 'Покупатель')
      ];
    },

    works: function (d) {
      var t = L.totals(L.toTiyn(d.work_price) || 0, d.vat);
      var adv = L.isEmpty(d.advance) ? 0 : (L.toTiyn(d.advance) || 0), w = L.parseInt10(d.warranty);
      var pay = d.vat
        ? 'Цена работы составляет ' + moneyW(t.subtotal) + ', НДС ' + VAT_TEXT + ' — ' + moneyW(t.vat) + '. Всего: ' + moneyW(t.total) + '.'
        : 'Цена работы составляет ' + moneyW(t.total) + ', без НДС.';
      var out = [
        T('ДОГОВОР ПОДРЯДА № ' + v(d.number)),
        R(place(d), fd(d.date)),
        G(),
        P(ipIntro(d) + ', ИИН ' + v(d.ip_iin) + ', далее — «Подрядчик», с одной стороны, и ' + cpIntro(d) + ', далее — «Заказчик», с другой стороны, заключили настоящий договор о следующем.'),
        H('1. Предмет договора'),
        P('1.1. Подрядчик обязуется по заданию Заказчика выполнить работу: ' + v(d.work_subject) + ', и сдать её результат Заказчику, а Заказчик обязуется принять результат работы и оплатить его (статья 616 Гражданского кодекса Республики Казахстан).'),
        P(d.materials === 'matCustomer'
          ? '1.2. Работа выполняется из материалов Заказчика. Подрядчик обязан экономно расходовать материалы и после окончания работы представить Заказчику отчёт об их израсходовании и возвратить остаток (статья 625 Гражданского кодекса Республики Казахстан).'
          : '1.2. Работа выполняется из материалов Подрядчика, его силами и средствами (статья 617 Гражданского кодекса Республики Казахстан).'),
        H('2. Сроки выполнения работы'),
        P('2.1. Начало работы — ' + fd(d.start) + ', окончание работы — ' + fd(d.end) + ' (статья 620 Гражданского кодекса Республики Казахстан).'),
        P('2.2. Заказчик вправе во всякое время проверять ход и качество работы, не вмешиваясь в деятельность Подрядчика (статья 627 Гражданского кодекса Республики Казахстан).'),
        H('3. Цена работы и порядок оплаты'),
        P('3.1. ' + pay + ' Цена является твёрдой (статья 621 Гражданского кодекса Республики Казахстан).')
      ];
      if (adv > 0) {
        out.push(P('3.2. Заказчик выплачивает аванс в размере ' + moneyW(adv) + ' в течение ' + num(d.pay_days, workDaysWord) + ' со дня заключения договора.'));
        out.push(P('3.3. Оставшаяся часть цены в размере ' + moneyW(Math.max(t.total - adv, 0)) + ' выплачивается в течение ' + num(d.pay_days, workDaysWord) + ' со дня подписания акта выполненных работ.'));
      } else {
        out.push(P('3.2. Заказчик оплачивает работу после окончательной сдачи её результата в течение ' + num(d.pay_days, workDaysWord) + ' со дня подписания акта выполненных работ (статья 623 Гражданского кодекса Республики Казахстан).'));
      }
      out.push(P((adv > 0 ? '3.4. ' : '3.3. ') + 'Оплата производится путём перечисления денег на банковский счёт Подрядчика.'));
      return out.concat([
        H('4. Сдача и приёмка работы'),
        P('4.1. Заказчик обязан в течение пяти рабочих дней после получения сообщения Подрядчика о готовности осмотреть и принять результат работы. Сдача и приёмка оформляются актом выполненных работ, подписанным сторонами.'),
        P('4.2. При обнаружении отступлений от договора, ухудшающих результат работы, или иных недостатков Заказчик указывает их в акте или в письменном мотивированном отказе от его подписания.'),
        H('5. Гарантия качества'),
        P(w > 0
          ? '5.1. Подрядчик предоставляет гарантию качества результата работы на срок ' + num(d.warranty, monthsWord) + ' со дня подписания акта (статья 633 Гражданского кодекса Республики Казахстан).'
          : '5.1. Качество работы должно соответствовать условиям договора, а при их отсутствии — требованиям, обычно предъявляемым к работам соответствующего рода.'),
        H('6. Ответственность сторон'),
        P(penaltyText(d, '6.1. ')),
        H('7. Заключительные положения'),
        P('7.1. Договор вступает в силу со дня подписания и действует до полного исполнения сторонами своих обязательств.'),
        P('7.2. Изменения к договору действительны, если совершены в письменной форме и подписаны сторонами.'),
        P('7.3. Споры разрешаются путём переговоров, а при недостижении согласия — в суде в соответствии с законодательством Республики Казахстан.'),
        P('7.4. Договор составлен в двух экземплярах, по одному для каждой стороны.'),
        H('8. Реквизиты и подписи сторон'),
        sides(d, 'Подрядчик', 'Заказчик')
      ]);
    },

    loan: function (d) {
      var ipLender = d.loan_role === 'lender';
      var ipRole = ipLender ? 'Займодатель' : 'Заёмщик', cpRole = ipLender ? 'Заёмщик' : 'Займодатель';
      var sum = L.toTiyn(d.loan_sum) || 0;
      var out = [
        T('ДОГОВОР ЗАЙМА № ' + v(d.number)),
        R(place(d), fd(d.date)),
        G(),
        P(ipIntro(d) + ', ИИН ' + v(d.ip_iin) + ', далее — «' + ipRole + '», с одной стороны, и ' + cpIntro(d) + ', далее — «' + cpRole + '», с другой стороны, заключили настоящий договор о следующем.'),
        H('1. Предмет договора'),
        P('1.1. Займодатель передаёт в собственность Заёмщику деньги в сумме ' + moneyW(sum) + ' (далее — «Заём»), а Заёмщик обязуется своевременно возвратить Займодателю такую же сумму денег (статья 715 Гражданского кодекса Республики Казахстан).'),
        P('1.2. Займодатель перечисляет Заём на банковский счёт Заёмщика' + (ipLender ? ', указанный Заёмщиком письменно,' : '') + ' в течение ' + num(d.loan_days, workDaysWord) + ' со дня подписания договора. Заём считается предоставленным с момента зачисления денег на банковский счёт Заёмщика (статья 719 Гражданского кодекса Республики Казахстан).')
      ];
      if (ipLender) out.push(P('1.3. Заёмщик подтверждает, что является юридическим лицом или индивидуальным предпринимателем. Договор заключён с соблюдением пункта 2-1 статьи 715 Гражданского кодекса Республики Казахстан.'));
      out.push(H('2. Вознаграждение'));
      out.push(P(d.loan_free
        ? '2.1. Заём является беспроцентным: вознаграждение за пользование Займом не выплачивается.'
        : '2.1. За пользование Займом Заёмщик выплачивает Займодателю вознаграждение по ставке ' + percentW(d.loan_rate) + ' годовых, начисляемое на фактический остаток Займа. Вознаграждение выплачивается ежемесячно (пункт 4 статьи 718 Гражданского кодекса Республики Казахстан).'));
      return out.concat([
        H('3. Возврат Займа'),
        P('3.1. Заёмщик возвращает Заём не позднее ' + fd(d.loan_return) + ' путём перечисления денег на банковский счёт Займодателя' + (ipLender ? '' : ', указанный Займодателем письменно') + '.'),
        P(d.loan_free
          ? '3.2. Заём может быть возвращён досрочно полностью или по частям (статья 722 Гражданского кодекса Республики Казахстан).'
          : '3.2. Досрочный возврат Займа допускается с согласия Займодателя (статья 722 Гражданского кодекса Республики Казахстан).'),
        P('3.3. Заём считается возвращённым в момент зачисления денег на банковский счёт Займодателя.'),
        H('4. Ответственность сторон'),
        P(L.isEmpty(d.penalty)
          ? '4.1. Если Заёмщик не возвращает Заём в срок, на эту сумму подлежит уплате неустойка в соответствии с законодательством Республики Казахстан.'
          : '4.1. За просрочку возврата Займа Заёмщик уплачивает Займодателю неустойку в размере ' + percentW(d.penalty) + ' от невозвращённой суммы за каждый день просрочки.'),
        H('5. Заключительные положения'),
        P('5.1. Договор вступает в силу с момента предоставления Займа и действует до полного исполнения Заёмщиком своих обязательств.'),
        P('5.2. Изменения к договору действительны, если совершены в письменной форме и подписаны сторонами.'),
        P('5.3. Споры разрешаются путём переговоров, а при недостижении согласия — в суде в соответствии с законодательством Республики Казахстан.'),
        P('5.4. Договор составлен в двух экземплярах, по одному для каждой стороны.'),
        H('6. Реквизиты и подписи сторон'),
        sides(d, ipRole, cpRole)
      ]);
    },

    poa: function (d) {
      return [
        T('ДОВЕРЕННОСТЬ № ' + v(d.number)),
        R(place(d), fd(d.date)),
        G(),
        P('Индивидуальный предприниматель ' + v(d.ip_fio) + ' (' + v(d.ip_name) + '), ИИН ' + v(d.ip_iin) + ', место нахождения: ' + v(d.ip_addr) + ', далее — «Доверитель», настоящей доверенностью уполномочивает ' + v(d.rep_fio) + ', ИИН ' + v(d.rep_iin) + ', удостоверение личности № ' + v(d.rep_doc_no) + ' выдано ' + fd(d.rep_doc_date) + ', далее — «Поверенный», представлять интересы Доверителя и совершать от его имени следующие действия:'),
        P(v(d.powers)),
        P('Для выполнения поручения Поверенный вправе подавать и получать документы, подписывать их от имени Доверителя и совершать иные действия, связанные с выполнением настоящего поручения.'),
        P(d.subst
          ? 'Поверенный вправе передоверить совершение указанных действий другому лицу (статья 169 Гражданского кодекса Республики Казахстан).'
          : 'Доверенность выдана без права передоверия.'),
        P('Доверенность выдана сроком до ' + fd(d.poa_until) + ' включительно (статья 168 Гражданского кодекса Республики Казахстан).'),
        G(),
        R('Образец подписи Поверенного ' + initials(d.rep_fio), '______________'),
        G(),
        R('Индивидуальный предприниматель', '______________ ' + initials(d.ip_fio)),
        P('М.П. (при наличии)')
      ];
    },

    cancel: function (d) {
      var sum = L.toTiyn(d.settle_sum) || 0, pays = d.settle === 'ipPays', none = d.settle === 'settleNone';
      var n = 1, p = function (x) { n++; return P(n + '. ' + x); };
      var out = [
        T('СОГЛАШЕНИЕ № ' + v(d.number) + ' О РАСТОРЖЕНИИ ДОГОВОРА'),
        R(place(d), fd(d.date)),
        G(),
        P(ipIntro(d) + ', ИИН ' + v(d.ip_iin) + ', с одной стороны, и ' + cpIntro(d) + ', с другой стороны, далее совместно — «Стороны», на основании пункта 1 статьи 401 Гражданского кодекса Республики Казахстан заключили настоящее соглашение о следующем.'),
        P('1. Стороны расторгают договор № ' + v(d.contract_no) + ' от ' + fd(d.contract_date) + ' (далее — «Договор») по соглашению Сторон с ' + fd(d.cancel_date) + '.'),
        p('С указанной даты обязательства Сторон по Договору прекращаются (статья 403 Гражданского кодекса Республики Казахстан). Стороны не вправе требовать возвращения того, что было исполнено ими по Договору до его расторжения.')
      ];
      if (none) out.push(p('На дату подписания соглашения Стороны произвели все расчёты по Договору и задолженности друг перед другом не имеют.'));
      else out.push(p((pays ? v(d.ip_name) : v(d.cp_name)) + ' выплачивает ' + (pays ? v(d.cp_name) : v(d.ip_name)) + ' в окончательный расчёт по Договору ' + moneyW(sum) + ' в течение ' + num(d.settle_days, workDaysWord) + ' со дня подписания настоящего соглашения.'));
      if (d.claims) out.push(p('Стороны подтверждают, что не имеют друг к другу претензий, связанных с исполнением Договора.'));
      return out.concat([
        p('Соглашение составлено в той же форме, что и Договор (пункт 1 статьи 402 Гражданского кодекса Республики Казахстан), вступает в силу со дня подписания и является неотъемлемой частью Договора.'),
        p('Соглашение составлено в двух экземплярах, по одному для каждой Стороны.'),
        H('Реквизиты и подписи Сторон'),
        {
          k: 'cols',
          left: ipReq(d),
          right: cpReq(d),
          signLeft: ['______________ ' + initials(d.ip_fio), 'М.П. (при наличии)'],
          signRight: ['______________', 'М.П. (при наличии)']
        }
      ]);
    },

    trip: function (d) {
      var days = L.daysIncl ? L.daysIncl(d.trip_from, d.trip_to) : NaN;
      var out = orderHead(d, 'О направлении работника в командировку').concat([
        G(),
        P('В соответствии со статьёй 127 Трудового кодекса Республики Казахстан:'),
        ORDER,
        P('1. Направить работника ' + v(d.w_fio) + ' (должность: ' + pos(d) + ') в командировку в ' + v(d.trip_place) + ' сроком ' + (isNaN(days) ? 'на ____ календарных дней' : 'на ' + num(String(days), daysWord)) + ' с ' + fd(d.trip_from) + ' по ' + fd(d.trip_to) + '.'),
        P('2. Цель командировки: ' + v(d.trip_goal) + '.'),
        P('3. Сохранить за работником на время командировки место работы (должность) и заработную плату за рабочие дни, приходящиеся на дни командировки.'),
        P('4. Оплатить работнику суточные за календарные дни нахождения в командировке, в том числе за время в пути, расходы по проезду к месту назначения и обратно и расходы по найму жилого помещения.')
      ]);
      if (!L.isEmpty(d.trip_advance)) out.push(P('5. Выдать работнику аванс на командировочные расходы в размере ' + moneyW(L.toTiyn(d.trip_advance) || 0) + '.'));
      out.push(P((L.isEmpty(d.trip_advance) ? '5. ' : '6. ') + 'Работнику в течение трёх рабочих дней после возвращения представить отчёт о командировочных расходах с подтверждающими документами.'));
      return out.concat(orderSign(d, true));
    },

    bonus: function (d) {
      return orderHead(d, 'О премировании работника').concat([
        G(),
        P('В соответствии с подпунктом 6) пункта 1 статьи 23 и пунктом 3 статьи 107 Трудового кодекса Республики Казахстан:'),
        ORDER,
        P('1. Премировать работника ' + v(d.w_fio) + ' (должность: ' + pos(d) + ') за ' + v(d.bonus_reason).replace(/^за\s+/i, '') + '.'),
        P('2. Размер премии — ' + moneyW(L.toTiyn(d.bonus_sum) || 0) + '.'),
        P(d.bonus_pay === 'separately'
          ? '3. Выплатить премию отдельно от заработной платы не позднее пяти рабочих дней со дня издания приказа с удержанием налогов и обязательных платежей.'
          : '3. Выплатить премию вместе с заработной платой за текущий месяц с удержанием налогов и обязательных платежей.')
      ]).concat(orderSign(d, true));
    },

    remote: function (d) {
      var mixed = d.remote_kind === 'remoteMixed', own = d.equip === 'equipOwn';
      var extra = [
        P('5.4. Работнику устанавливается ' + (mixed ? 'комбинированная дистанционная работа: работа вне места нахождения Работодателя чередуется с работой в помещении Работодателя по графику, установленному актом Работодателя' : 'дистанционная работа: трудовые обязанности выполняются вне места нахождения Работодателя') + ' (статья 138 Трудового кодекса Республики Казахстан).'),
        P(own
          ? '5.5. Работник использует собственное оборудование и иные средства и несёт расходы на услуги связи. Работодатель выплачивает Работнику компенсацию в размере ' + moneyW(L.toTiyn(d.equip_comp) || 0) + ' в месяц вместе с заработной платой (пункт 4 статьи 138 Трудового кодекса Республики Казахстан).'
          : '5.5. Работодатель обеспечивает Работника оборудованием, программными средствами и услугами связи, необходимыми для работы, и несёт расходы по их установке и обслуживанию. Работник использует их только для выполнения трудовых обязанностей (пункт 4 статьи 138 Трудового кодекса Республики Казахстан).'),
        P('5.6. Взаимодействие сторон осуществляется через: ' + v(d.comm) + '.'),
        P('5.7. Для Работника устанавливается фиксированный учёт рабочего времени. В пределах рабочего времени (' + v(d.avail) + ') Работник находится в режиме доступности для связи с Работодателем. Работодатель не вправе требовать нахождения Работника в режиме доступности вне рабочего времени (пункт 5 статьи 138 Трудового кодекса Республики Казахстан).'),
        P('5.8. Работа вне установленной продолжительности рабочего времени допускается только с письменного согласия Работника с оплатой в повышенном размере.'),
        P('5.9. Заработная плата выплачивается в полном размере при выполнении объёма работ, обусловленного договором и актами Работодателя (пункт 6 статьи 138 Трудового кодекса Республики Казахстан).'),
        P('5.10. Работодатель обеспечивает безопасность и охрану труда в объёме, предусмотренном пунктом 7 статьи 138 Трудового кодекса Республики Казахстан, и знакомит Работника с требованиями безопасности при работе с оборудованием.')
      ];
      var out = [];
      BUILD.employment(d).forEach(function (b) {
        if (b.k === 'title') b = T('ТРУДОВОЙ ДОГОВОР № ' + v(d.number) + ' (о дистанционной работе)');
        else if (b.k === 'p' && b.text.indexOf('1.2. ') === 0) b = P('1.2. ' + (mixed ? 'Место выполнения работы при работе вне места нахождения Работодателя: ' : 'Место выполнения дистанционной работы: ') + v(d.place) + '.');
        else if (own && b.k === 'p' && b.text.indexOf('5.2. ') === 0) b = P('5.2. Оборудование и средства для работы определяются пунктом 5.5 договора.');
        else if (b.k === 'h' && b.text.indexOf('5. ') === 0) b = H('5. Условия труда и дистанционная работа');
        else if (b.k === 'p' && b.text.indexOf('8.1. ') === 0) b = P(b.text + ' Условие о неразглашении распространяется и на сведения, ставшие известными Работнику в процессе дистанционной работы (пункт 8 статьи 138 Трудового кодекса Республики Казахстан).');
        out.push(b);
        if (b.k === 'p' && b.text.indexOf('5.3. ') === 0) out.push.apply(out, extra);
      });
      return out;
    }
  };

  // Казахские шаблоны лежат в js/templates-kk.js и регистрируются как BUILD_KK.
  function build(code, data, lang) {
    var kk = lang === 'kk' && api.BUILD_KK;
    return (kk || BUILD)[code](data || {});
  }

  var api = { FIELDS: FIELDS, DOCS: DOCS, build: build, helpers: { initials: initials, pos: pos } };
  root.DocumTemplates = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
