/* docum.kz — PAdES: подпись ЭЦП внутри PDF.
   PDF дополняется «инкрементным обновлением»: поле подписи, словарь /Sig с /ByteRange и местом под /Contents.
   NCALayer подписывает отсоединённо (CMS без вложенного содержимого) все байты файла, кроме /Contents,
   и готовая подпись вписывается в это место. Исходные байты PDF при этом не меняются.
   Подготовка детерминирована (дата — дата версии), поэтому подписанный PDF можно собрать заново из версии и подписи. */
(function (root) {
  'use strict';

  var RESERVE = 16384;   // байт под подпись: CMS с цепочкой сертификатов НУЦ занимает 2–8 КБ

  function dec(u8) { var s = ''; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return s; }
  function enc(str) { var u = new Uint8Array(str.length); for (var i = 0; i < str.length; i++) u[i] = str.charCodeAt(i) & 255; return u; }
  function pad(n, w, ch) { n = String(n); while (n.length < w) n = (ch || '0') + n; return n; }
  function concat(a, b) { var u = new Uint8Array(a.length + b.length); u.set(a, 0); u.set(b, a.length); return u; }

  // Словарь << … >> начиная с позиции i, с учётом вложенности, hex-строк <…> и строк (…).
  function dictAt(s, i) {
    var depth = 0, j = i;
    while (j < s.length) {
      var c = s[j];
      if (c === '<' && s[j + 1] === '<') { depth++; j += 2; continue; }
      if (c === '>' && s[j + 1] === '>') { depth--; j += 2; if (!depth) return s.slice(i, j); continue; }
      if (c === '<') { j = s.indexOf('>', j) + 1; continue; }
      if (c === '(') {
        var d = 1; j++;
        while (j < s.length && d) { if (s[j] === '\\') { j += 2; continue; } if (s[j] === '(') d++; else if (s[j] === ')') d--; j++; }
        continue;
      }
      j++;
    }
    throw new Error('pdf-dict');
  }
  // Последняя редакция объекта (после инкрементных обновлений действует последняя).
  function obj(s, id) {
    var re = new RegExp('(^|\\s)' + id + ' 0 obj\\s*<<', 'g'), m, last = null;
    while ((m = re.exec(s))) last = m;
    if (!last) throw new Error('pdf-obj');
    return dictAt(s, last.index + last[0].length - 2);
  }
  function ref(dict, key) { var m = dict.match(new RegExp('/' + key + '\\s+(\\d+)\\s+0\\s+R')); return m ? +m[1] : null; }
  function firstPage(s, id) {
    var d = obj(s, id);
    if (/\/Type\s*\/Page\b(?!s)/.test(d)) return id;
    var kids = d.match(/\/Kids\s*\[\s*(\d+)\s+0\s+R/);
    if (!kids) throw new Error('pdf-pages');
    return firstPage(s, +kids[1]);
  }
  function pdfDate(ms) {
    var d = new Date(ms);
    return 'D:' + d.getUTCFullYear() + pad(d.getUTCMonth() + 1, 2) + pad(d.getUTCDate(), 2) + pad(d.getUTCHours(), 2) + pad(d.getUTCMinutes(), 2) + pad(d.getUTCSeconds(), 2) + 'Z';
  }

  // PDF версии → PDF с пустым полем подписи и байты, которые нужно подписать.
  function prepare(pdf, at) {
    var s = dec(pdf);
    var tIdx = s.lastIndexOf('trailer');
    var sx = s.match(/startxref\s+(\d+)\s*%%EOF\s*$/);
    if (tIdx < 0 || !sx) throw new Error('pdf-trailer');
    var trailer = dictAt(s, s.indexOf('<<', tIdx));
    var size = +trailer.match(/\/Size\s+(\d+)/)[1], rootId = ref(trailer, 'Root'), infoId = ref(trailer, 'Info');
    var idm = trailer.match(/\/ID\s*\[[^\]]*\]/);
    var cat = obj(s, rootId);
    if (/\/AcroForm/.test(cat)) throw new Error('pdf-acroform');
    var pageId = firstPage(s, ref(cat, 'Pages')), page = obj(s, pageId);
    var sigId = size, widId = size + 1;

    var newCat = cat.slice(0, -2) + '/AcroForm << /Fields [' + widId + ' 0 R] /SigFlags 3 >>\n>>';
    var newPage = /\/Annots\s*\[/.test(page)
      ? page.replace(/\/Annots\s*\[/, '/Annots [' + widId + ' 0 R ')
      : page.slice(0, -2) + '/Annots [' + widId + ' 0 R]\n>>';
    var zeros = new Array(RESERVE * 2 + 1).join('0');
    var objs = [
      [rootId, newCat],
      [pageId, newPage],
      [sigId, '<<\n/Type /Sig\n/Filter /Adobe.PPKLite\n/SubFilter /adbe.pkcs7.detached\n/ByteRange [0 ########## ########## ##########]\n/Contents <' + zeros + '>\n/M (' + pdfDate(at) + ')\n/Reason (docum.kz)\n>>'],
      [widId, '<<\n/Type /Annot\n/Subtype /Widget\n/FT /Sig\n/T (Signature' + sigId + ')\n/Rect [0 0 0 0]\n/F 132\n/V ' + sigId + ' 0 R\n/P ' + pageId + ' 0 R\n>>']
    ];
    var out = /\n$/.test(s) ? '' : '\n', offs = {};
    objs.forEach(function (o) { offs[o[0]] = pdf.length + out.length; out += o[0] + ' 0 obj\n' + o[1] + '\nendobj\n'; });
    var xrefAt = pdf.length + out.length;
    out += 'xref\n0 1\n0000000000 65535 f \n';
    Object.keys(offs).map(Number).sort(function (a, b) { return a - b; }).forEach(function (id) {
      out += id + ' 1\n' + pad(offs[id], 10) + ' 00000 n \n';
    });
    out += 'trailer\n<<\n/Size ' + (size + 2) + '\n/Root ' + rootId + ' 0 R\n' + (infoId ? '/Info ' + infoId + ' 0 R\n' : '') + (idm ? idm[0] + '\n' : '') +
      '/Prev ' + sx[1] + '\n>>\nstartxref\n' + xrefAt + '\n%%EOF\n';

    var bytes = concat(pdf, enc(out));
    var a = pdf.length + out.indexOf('/Contents <') + '/Contents '.length;   // позиция «<»
    var b = a + RESERVE * 2 + 2;                                               // сразу после «>»
    var br = [0, a, b, bytes.length - b].map(function (n, i) { return i ? pad(n, 10, ' ') : '0'; });
    var brAt = pdf.length + out.indexOf('[0 ##########') + 1;
    bytes.set(enc(br.join(' ')), brAt);
    return { bytes: bytes, a: a, b: b, toSign: concat(bytes.subarray(0, a), bytes.subarray(b)) };
  }

  // Вписать CMS в подготовленный PDF.
  function embed(prep, cms) {
    if (cms.length > RESERVE) throw new Error('pdf-sig-big');
    var hex = '';
    for (var i = 0; i < cms.length; i++) hex += pad(cms[i].toString(16), 2);
    var out = new Uint8Array(prep.bytes);
    out.set(enc(hex.toUpperCase()), prep.a + 1);
    return out;
  }

  // Подписи из PDF: для проверки скачанного или присланного файла.
  function read(pdf) {
    var s = dec(pdf), re = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g, m, list = [];
    while ((m = re.exec(s))) {
      var r = [+m[1], +m[2], +m[3], +m[4]];
      if (r[1] + 1 >= s.length || s[r[1]] !== '<' || r[2] + r[3] > pdf.length) continue;
      var hex = s.slice(r[1] + 1, r[2] - 1).replace(/\s+/g, '');
      if (/^0*$/.test(hex)) continue;
      var u = new Uint8Array(hex.length / 2);
      for (var i = 0; i < u.length; i++) u[i] = parseInt(hex.substr(i * 2, 2), 16);
      u = u.subarray(0, derLen(u));
      list.push({ range: r, cms: u, signed: concat(pdf.subarray(r[0], r[0] + r[1]), pdf.subarray(r[2], r[2] + r[3])), whole: r[2] + r[3] === pdf.length });
    }
    return list;
  }
  function derLen(u) {
    var l = u[1];
    if (!(l & 0x80)) return 2 + l;
    var n = l & 0x7f, v = 0;
    for (var i = 0; i < n; i++) v = v * 256 + u[2 + i];
    return 2 + n + v;
  }

  root.DocumPades = { prepare: prepare, embed: embed, read: read, isPdf: function (u8) { return u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46; } };
})(window);
