/* docum.kz — сравнение версий как в режиме исправлений Word.
   1) абзацы выравниваются по наибольшей общей подпоследовательности;
   2) изменённые абзацы сравниваются по словам: удалённое — зачёркнуто, добавленное — подчёркнуто. */
(function (root) {
  'use strict';
  function lcs(a, b, eq) {
    var n = a.length, m = b.length, dp = [], i, j;
    for (i = 0; i <= n; i++) { dp.push(new Uint16Array(m + 1)); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--)
      dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    var out = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (eq(a[i], b[j])) { out.push(['eq', a[i], b[j]]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(['del', a[i], null]); i++; }
      else { out.push(['ins', null, b[j]]); j++; }
    }
    while (i < n) out.push(['del', a[i++], null]);
    while (j < m) out.push(['ins', null, b[j++]]);
    return out;
  }
  function tokens(s) { return String(s).match(/\s+|[^\s]+/g) || []; }
  // Сравнение по словам с объединением соседних кусков одного типа.
  function words(a, b) {
    var ops = lcs(tokens(a), tokens(b), function (x, y) { return x === y; }), out = [];
    ops.forEach(function (o) {
      var t = o[0], s = t === 'ins' ? o[2] : o[1], last = out[out.length - 1];
      if (last && last.t === t) last.s += s; else out.push({ t: t, s: s });
    });
    // Пробел между двумя изменениями не показываем отдельным «равным» куском.
    for (var i = 1; i < out.length - 1; i++) if (out[i].t === 'eq' && /^\s+$/.test(out[i].s) && out[i - 1].t !== 'eq' && out[i + 1].t !== 'eq') { out[i - 1].s += out[i].s; out[i + 1].s = out[i].s + out[i + 1].s; out.splice(i, 1); i--; }
    return out;
  }
  function similar(a, b) {
    var ta = tokens(a).filter(function (x) { return /\S/.test(x); }), tb = tokens(b).filter(function (x) { return /\S/.test(x); });
    if (!ta.length || !tb.length) return 0;
    var common = lcs(ta, tb, function (x, y) { return x === y; }).filter(function (o) { return o[0] === 'eq'; }).length;
    return 2 * common / (ta.length + tb.length);
  }
  // Абзацы: точные совпадения — якоря; между ними удалённый и добавленный абзацы,
  // похожие друг на друга больше чем на 40 %, считаются изменённым абзацем.
  function paras(A, B) {
    var ops = lcs(A, B, function (x, y) { return x === y; }), res = [], i = 0;
    while (i < ops.length) {
      if (ops[i][0] === 'eq') { res.push({ type: 'eq', a: ops[i][1], b: ops[i][2] }); i++; continue; }
      var dels = [], ins = [];
      while (i < ops.length && ops[i][0] !== 'eq') { if (ops[i][0] === 'del') dels.push(ops[i][1]); else ins.push(ops[i][2]); i++; }
      var used = {};
      dels.forEach(function (d) {
        var best = -1, bs = 0.4;
        ins.forEach(function (x, k) { if (!used[k]) { var s = similar(d, x); if (s > bs) { bs = s; best = k; } } });
        if (best >= 0) { used[best] = true; res.push({ type: 'chg', a: d, b: ins[best], ops: words(d, ins[best]), at: best }); }
        else res.push({ type: 'del', a: d });
      });
      ins.forEach(function (x, k) { if (!used[k]) res.push({ type: 'ins', b: x }); });
    }
    return res;
  }
  var api = { words: words, paras: paras };
  root.DocumDiff = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
