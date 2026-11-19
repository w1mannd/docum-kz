/* docum.kz — поиск по загруженным текстам НПА (npa/npa.json) для консультанта «Цивис».
   Один и тот же код работает в браузере (офлайн-режим) и на сервере (выбор фрагментов для нейросети).
   Поиск лексический (BM25): он находит только то, что действительно написано в актах. */
(function (root) {
  'use strict';
  var STOP = ' и в во на по с со к ко о об от до из за для не ни что как это или а но же ли при если то так также его ее их он она они мы вы я ты мой мне меня можно нужно надо какой какая какие какое каком сколько когда где есть быть будет ли ип и мен мен бен мен үшін және немесе бұл осы ол олар не неше қалай қандай қашан қай ма ме ба бе па пе да де та те жөнінде туралы бар жоқ керек ';
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); }
  function tokens(s) {
    var out = [];
    norm(s).split(/[^0-9a-zа-яәғқңөұүһі]+/i).forEach(function (w) {
      if (!w || STOP.indexOf(' ' + w + ' ') >= 0) return;
      if (/^\d+$/.test(w)) { out.push(w); return; }
      if (w.length < 3) return;
      out.push(w.length > 6 ? w.slice(0, 6) : w);   // грубое отсечение окончаний для русского и казахского
    });
    return out;
  }
  // Разговорные слова → слова, которыми пишет закон (по основам).
  var SYN = {
    'уволит': ['растор', 'прекра'], 'увольн': ['растор', 'прекра'], 'уволен': ['растор', 'прекра'], 'уволь': ['растор', 'прекра'],
    'предупр': ['уведом'], 'предуп': ['уведом'], 'зарпла': ['заработ', 'зарабо'], 'зп': ['зарабо'],
    'сотруд': ['работн'], 'нанять': ['прием', 'заключ'], 'наним': ['прием', 'заключ'], 'нанима': ['прием', 'заключ'],
    'должно': ['содерж'], 'пункты': ['содерж'], 'больни': ['нетруд'], 'декрет': ['береме', 'рожден'],
    'сверху': ['сверхур'], 'платит': ['выплат'], 'платят': ['выплат'], 'выдава': ['выплат'], 'когда': ['срок'], 'перера': ['переры'], 'обед': ['переры', 'пищи'],
    'босату': ['бұзу', 'тоқтат'], 'жұмыст': ['жұмысқ', 'жұмыск'], 'жалақы': ['жалақы']
  };
  function expand(t) {
    var out = t.slice();
    t.forEach(function (w) { Object.keys(SYN).forEach(function (k) { if (w.indexOf(k) === 0) out = out.concat(SYN[k]); }); });
    return out;
  }
  function Index(units) {
    var self = this;
    this.units = units;
    this.df = {}; this.len = []; this.tf = []; this.head = []; var total = 0;
    units.forEach(function (u, i) {
      var t = tokens(u.ref + ' ' + u.text), m = {};
      t.forEach(function (w) { m[w] = (m[w] || 0) + 1; });
      Object.keys(m).forEach(function (w) { self.df[w] = (self.df[w] || 0) + 1; });
      self.tf[i] = m; self.len[i] = t.length; total += t.length;
      self.head[i] = tokens(u.text.split('\n')[0]);
    });
    this.avg = total / Math.max(1, units.length);
  }
  // Номер статьи в вопросе («статья 56», «56-бап», «ст. 113») сильно поднимает эту статью.
  function refNums(q) {
    var n = [], m, re = /(?:стать[а-я]*|ст\.?)\s*(\d{1,3})|(\d{1,3})\s*-?\s*бап/gi;
    while ((m = re.exec(norm(q)))) n.push(m[1] || m[2]);
    return n;
  }
  Index.prototype.search = function (q, lang, k) {
    var qt = expand(tokens(q)), nums = refNums(q), N = this.units.length, res = [], self = this;
    this.units.forEach(function (u, i) {
      if (lang && u.lang !== lang) return;
      var s = 0, tf = self.tf[i], dl = self.len[i];
      qt.forEach(function (w) {
        var f = tf[w]; if (!f) return;
        var idf = Math.log(1 + (N - self.df[w] + 0.5) / (self.df[w] + 0.5));
        s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * dl / self.avg));
        if (self.head[i].indexOf(w) >= 0) s += 2 * idf;   // совпадение с названием статьи важнее
      });
      nums.forEach(function (n) { if (new RegExp('(^|\\D)' + n + '(\\D|$)').test(u.ref)) s += 8; });
      if (s > 0) res.push({ u: u, score: s });
    });
    res.sort(function (a, b) { return b.score - a.score; });
    return res.slice(0, k || 5);
  };
  // Самые подходящие абзацы статьи — дословно, в исходном порядке, с заголовком статьи.
  function excerpt(u, q, max) {
    var qt = expand(tokens(q)), lines = u.text.split('\n'), head = lines[0];
    var scored = lines.slice(1).map(function (l, i) {
      var lt = tokens(l), s = 0;
      qt.forEach(function (w) { if (lt.indexOf(w) >= 0) s++; });
      return { i: i, l: l, s: s };
    }).filter(function (x) { return x.s > 0; });
    scored.sort(function (a, b) { return b.s - a.s || a.i - b.i; });
    var pick = scored.slice(0, 3).sort(function (a, b) { return a.i - b.i; }).map(function (x) { return x.l; });
    if (!pick.length) pick = lines.slice(1, 3);
    var text = head + '\n' + pick.join('\n…\n');
    max = max || 900;
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }
  var api = { tokens: tokens, Index: Index, excerpt: excerpt };
  root.CivisSearch = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
