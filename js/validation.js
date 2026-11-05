/* docum.kz — расчёты и проверки ввода. Данные обрабатываются только в браузере. */
(function (root) {
  'use strict';

  // Дата проверки содержания по официальным источникам. Меняется только здесь.
  var CHECK_DATE = '05.11.2026';
  // Ставка НДС: Налоговый кодекс РК, ст. 503 п. 1.
  var VAT_RATE = 0.16;
  var MAX_MONEY = 99999999999999; // 999 999 999 999,99 тенге в тиынах
  // Технические пределы ввода, а не правовые нормы: защищают расчёты и запись прописью.
  var MAX_DAYS = 365, MAX_TERM_DAYS = 3650, MAX_MONTHS = 1200, MAX_QTY = 1000000000;
  var MIN_YEAR = 1900, MAX_YEAR = 2100;

  function clean(v) {
    return String(v === undefined || v === null ? '' : v).replace(/[\s ]/g, '').replace(',', '.');
  }
  function isEmpty(v) {
    return String(v === undefined || v === null ? '' : v).trim() === '';
  }
  function parseNum(v) {
    var s = clean(v);
    return /^\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
  }
  function parseInt10(v) {
    var s = clean(v);
    return /^\d+$/.test(s) ? Number(s) : NaN;
  }
  function toTiyn(v) {
    var s = clean(v);
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    var p = s.split('.');
    return Number(p[0]) * 100 + Number(((p[1] || '') + '00').slice(0, 2));
  }

  /* ---------- Даты ---------- */
  function parseISO(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return d;
  }
  function toISO(d) {
    return d.toISOString().slice(0, 10);
  }
  function fmtDate(iso) {
    var d = parseISO(iso);
    if (!d) return '';
    return iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4);
  }
  function addDays(iso, n) {
    var d = parseISO(iso);
    if (!d) return '';
    d.setUTCDate(d.getUTCDate() + n);
    return toISO(d);
  }
  // Окончание отпуска = начало + дни + праздничные дни − 1 (ТК РК, ст. 90 п. 1).
  function leaveDates(startISO, days, holidays) {
    var n = parseInt10(days), h = isEmpty(holidays) ? 0 : parseInt10(holidays);
    if (!parseISO(startISO) || isNaN(n) || n < 1 || isNaN(h) || n + h > MAX_DAYS * 2) return null;
    var end = addDays(startISO, n + h - 1);
    return { end: end, back: addDays(end, 1) };
  }

  /* ---------- Деньги ---------- */
  function fmtMoney(tiyn) {
    var t = Math.round(tiyn), whole = Math.floor(t / 100), frac = String(t % 100);
    if (frac.length < 2) frac = '0' + frac;
    return String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + frac;
  }
  function itemCost(item) {
    var q = parseNum(item.qty), p = toTiyn(item.price);
    if (isNaN(q) || isNaN(p)) return 0;
    return Math.round(q * p);
  }
  function totals(subtotal, vatOn) {
    var vat = vatOn ? Math.round(subtotal * VAT_RATE) : 0;
    return { subtotal: subtotal, vat: vat, total: subtotal + vat };
  }
  function calcItems(items, vatOn) {
    var sum = (items || []).reduce(function (a, it) { return a + itemCost(it); }, 0);
    return totals(sum, vatOn);
  }

  /* ---------- Сумма прописью ---------- */
  var ONES_M = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  var ONES_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  var TEENS = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  var TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  var HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  var SCALES = [
    null,
    { f: true, w: ['тысяча', 'тысячи', 'тысяч'] },
    { f: false, w: ['миллион', 'миллиона', 'миллионов'] },
    { f: false, w: ['миллиард', 'миллиарда', 'миллиардов'] },
    { f: false, w: ['триллион', 'триллиона', 'триллионов'] }
  ];
  function plural(n, w) {
    var a = n % 100, b = n % 10;
    if (a > 10 && a < 20) return w[2];
    if (b === 1) return w[0];
    if (b >= 2 && b <= 4) return w[1];
    return w[2];
  }
  function triad(n, fem) {
    var out = [], h = Math.floor(n / 100), r = n % 100;
    if (h) out.push(HUNDREDS[h]);
    if (r >= 10 && r < 20) out.push(TEENS[r - 10]);
    else {
      var t = Math.floor(r / 10), o = r % 10;
      if (t) out.push(TENS[t]);
      if (o) out.push((fem ? ONES_F : ONES_M)[o]);
    }
    return out;
  }
  function moneyWordsRu(tiyn) {
    var t = Math.round(tiyn), n = Math.floor(t / 100), frac = String(t % 100);
    if (frac.length < 2) frac = '0' + frac;
    var parts = [], i = 0, words = [];
    if (n === 0) words = ['ноль'];
    while (n > 0) { parts.push(n % 1000); n = Math.floor(n / 1000); }
    for (i = parts.length - 1; i >= 0; i--) {
      if (!parts[i]) continue;
      var sc = SCALES[i];
      words = words.concat(triad(parts[i], sc ? sc.f : false));
      if (sc) words.push(plural(parts[i], sc.w));
    }
    return words.join(' ') + ' тенге ' + frac + ' тиын';
  }
  // Целое число словами, со строчной буквы.
  function intWordsRu(num, fem) {
    var n = Math.floor(num), parts = [], words = [], i;
    if (n === 0) return 'ноль';
    while (n > 0) { parts.push(n % 1000); n = Math.floor(n / 1000); }
    for (i = parts.length - 1; i >= 0; i--) {
      if (!parts[i]) continue;
      var sc = SCALES[i];
      words = words.concat(triad(parts[i], sc ? sc.f : (fem && i === 0)));
      if (sc) words.push(plural(parts[i], sc.w));
    }
    return words.join(' ');
  }
  // Дробное число словами: 0,1 — ноль целых одна десятая. До трёх знаков после запятой.
  function decimalWordsRu(v) {
    var s = clean(v), p = s.split('.'), whole = Number(p[0]);
    var frac = (p[1] || '').replace(/0+$/, '');
    if (!frac) return intWordsRu(whole);
    var n = Number(frac);
    var names = [null, ['десятая', 'десятых', 'десятых'], ['сотая', 'сотых', 'сотых'], ['тысячная', 'тысячных', 'тысячных']][frac.length];
    return intWordsRu(whole, true) + ' ' + plural(whole, ['целая', 'целых', 'целых']) + ' ' + intWordsRu(n, true) + ' ' + plural(n, names);
  }

  /* ---------- Прописью на казахском ---------- */
  var KZ_ONES = ['', 'бір', 'екі', 'үш', 'төрт', 'бес', 'алты', 'жеті', 'сегіз', 'тоғыз'];
  var KZ_TENS = ['', 'он', 'жиырма', 'отыз', 'қырық', 'елу', 'алпыс', 'жетпіс', 'сексен', 'тоқсан'];
  var KZ_SCALES = ['', 'мың', 'миллион', 'миллиард', 'триллион'];
  function intWordsKz(num) {
    var n = Math.floor(num), parts = [], words = [], i;
    if (n === 0) return 'нөл';
    while (n > 0) { parts.push(n % 1000); n = Math.floor(n / 1000); }
    for (i = parts.length - 1; i >= 0; i--) {
      var p = parts[i], h = Math.floor(p / 100), r = p % 100;
      if (!p) continue;
      if (h) words.push(KZ_ONES[h], 'жүз');
      if (r >= 10) words.push(KZ_TENS[Math.floor(r / 10)]);
      if (r % 10) words.push(KZ_ONES[r % 10]);
      if (KZ_SCALES[i]) words.push(KZ_SCALES[i]);
    }
    return words.join(' ');
  }
  function moneyWordsKz(tiyn) {
    var t = Math.round(tiyn), frac = String(t % 100);
    if (frac.length < 2) frac = '0' + frac;
    return intWordsKz(Math.floor(t / 100)) + ' теңге ' + frac + ' тиын';
  }
  function decimalWordsKz(v) {
    var s = clean(v), p = s.split('.'), whole = Number(p[0]);
    var frac = (p[1] || '').replace(/0+$/, '');
    if (!frac) return intWordsKz(whole);
    return intWordsKz(whole) + ' бүтін ' + ['', 'оннан', 'жүзден', 'мыңнан'][frac.length] + ' ' + intWordsKz(Number(frac));
  }

  /* ---------- Проверки ---------- */
  // Возвращает null либо { type: 'error' | 'warn', key: ключ сообщения }.
  function err(key) { return { type: 'error', key: key }; }
  function warn(key) { return { type: 'warn', key: key }; }

  var RULES = {
    iin: function (v) { return /^\d{12}$/.test(String(v).trim()) ? null : err('e.iin'); },
    money: function (v) {
      var t = toTiyn(v);
      return (isNaN(t) || t <= 0 || t > MAX_MONEY) ? err('e.money') : null;
    },
    qty: function (v) {
      var n = parseNum(v);
      if (isNaN(n) || n <= 0) return err('e.qty');
      return n > MAX_QTY ? err('e.tooBig') : null;
    },
    date: function (v) {
      var d = parseISO(v);
      if (!d || d.getUTCFullYear() < MIN_YEAR || d.getUTCFullYear() > MAX_YEAR) return err('e.date');
      return null;
    },
    // Рабочий год: 12 календарных месяцев с первого дня работы (ТК РК, ст. 92 п. 2).
    workYear: function (v, d) {
      var from = parseISO(d.year_from), to = parseISO(v);
      if (!from || !to) return null;
      from.setUTCFullYear(from.getUTCFullYear() + 1);
      from.setUTCDate(from.getUTCDate() - 1);
      return from.getTime() === to.getTime() ? null : err('e.workYear');
    },
    penalty: function (v) {
      var n = parseNum(v);
      return (isNaN(n) || n > 100 || !/^\d+(\.\d{1,3})?$/.test(clean(v))) ? err('e.penalty') : null;
    },
    posInt: function (v) {
      var n = parseInt10(v);
      if (isNaN(n) || n < 1) return err('e.posInt');
      return n > MAX_TERM_DAYS ? err('e.tooBig') : null;
    },
    nonNegInt: function (v) {
      var n = parseInt10(v);
      if (isNaN(n)) return err('e.nonNegInt');
      return n > MAX_DAYS ? err('e.tooBig') : null;
    },
    termMonths: function (v) {
      var n = parseInt10(v);
      if (isNaN(n) || n < 12) return err('e.termMonths');
      return n > MAX_MONTHS ? err('e.tooBig') : null;
    },
    probation: function (v, d) {
      var n = parseInt10(v), max = d.manager ? 6 : 3;
      return (isNaN(n) || n > max) ? err('e.probation') : null;
    },
    hours: function (v) {
      var n = parseInt10(v);
      return (isNaN(n) || n < 1 || n > 40) ? err('e.hours') : null;
    },
    payDay: function (v) {
      var n = parseInt10(v);
      return (isNaN(n) || n < 1 || n > 10) ? err('e.payDay') : null;
    },
    leaveContract: function (v) {
      var n = parseInt10(v);
      if (isNaN(n) || n < 24) return err('e.leaveContract');
      return n > MAX_DAYS ? err('e.tooBig') : null;
    },
    leaveDays: function (v, d) {
      var n = parseInt10(v);
      if (d.leave_kind === 'part') {
        if (isNaN(n) || n < 1 || n > 23) return err('e.leavePart');
        return n < 14 ? warn('w.leavePart') : null;
      }
      if (isNaN(n) || n < 24) return err('e.leaveFull');
      return n > MAX_DAYS ? err('e.tooBig') : null;
    },
    age: function (v) { return v === true ? null : err('e.age'); }
  };

  // Поля, где дата не может быть раньше другой даты.
  var DATE_ORDER = {
    end: ['start', 'e.dateOrder'],
    due: ['date', 'e.dateOrder'],
    year_to: ['year_from', 'e.dateOrder'],
    term_date: ['contract_date', 'e.termDate']
  };

  // Дата начала раньше даты договора не запрещена, но похожа на опечатку.
  // В справке и других документах работа началась раньше даты документа, там проверки нет.
  var START_WARN = {
    services: { start: 'date' },
    employment: { work_start: 'date' },
    hire: { work_start: 'contract_date' }
  };

  function checkField(def, id, value, data, code) {
    var isBool = def.type === 'check';
    var empty = isBool ? false : isEmpty(value);
    if (empty) return def.optional ? null : err('e.required');
    if (def.rule) {
      var r = RULES[def.rule](value, data);
      if (r) return r;
    }
    if (def.type === 'date') {
      var r2 = RULES.date(value);
      if (r2) return r2;
      var ord = DATE_ORDER[id];
      if (ord && parseISO(data[ord[0]]) && value < data[ord[0]]) return err(ord[1]);
      var base = START_WARN[code] && START_WARN[code][id];
      if (base && parseISO(data[base]) && value < data[base]) return warn('w.startBefore');
    }
    return null;
  }

  function checkItem(item, withDate) {
    var e = {};
    if (isEmpty(item.name)) e.name = err('e.required');
    if (isEmpty(item.unit)) e.unit = err('e.required');
    var q = isEmpty(item.qty) ? err('e.required') : RULES.qty(item.qty);
    if (q) e.qty = q;
    var p = isEmpty(item.price) ? err('e.required') : RULES.money(item.price);
    if (p) e.price = p;
    if (!e.qty && !e.price && itemCost(item) > MAX_MONEY) e.qty = err('e.sumMax');
    // Дата в акте необязательна: форма Р-1 заполняет её только в отдельных случаях.
    if (withDate && !isEmpty(item.done)) {
      var d = RULES.date(item.done);
      if (d) e.done = d;
    }
    return e;
  }

  var api = {
    CHECK_DATE: CHECK_DATE, VAT_RATE: VAT_RATE, MAX_MONEY: MAX_MONEY,
    isEmpty: isEmpty, parseNum: parseNum, parseInt10: parseInt10, toTiyn: toTiyn,
    parseISO: parseISO, fmtDate: fmtDate, addDays: addDays, leaveDates: leaveDates,
    fmtMoney: fmtMoney, itemCost: itemCost, totals: totals, calcItems: calcItems,
    moneyWordsRu: moneyWordsRu, intWordsRu: intWordsRu, decimalWordsRu: decimalWordsRu,
    moneyWordsKz: moneyWordsKz, intWordsKz: intWordsKz, decimalWordsKz: decimalWordsKz, plural: plural, checkField: checkField, checkItem: checkItem
  };
  root.DocumLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
