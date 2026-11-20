/* docum.kz — подписание ЭЦП через NCALayer и разбор подписи CMS в браузере.
   NCALayer — программа НУЦ РК на компьютере пользователя (wss://127.0.0.1:13579).
   Ключ и пароль остаются в NCALayer; сайт получает только готовую подпись CMS с документом внутри.
   Проверка на сайте: что подписан именно этот документ, данные сертификата и, для ключей RSA, сама подпись.
   Отзыв сертификата (OCSP/CRL) и ГОСТ-подпись проверяет сервис проверки ЭЦП, не этот сайт. */
(function (root) {
  'use strict';

  /* ---------- NCALayer ---------- */
  function url() {
    // Для проверки на компьютере разработчика можно указать другой адрес; на сайте всегда официальный.
    var dev = null;
    try { if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) dev = localStorage.getItem('docum-ncalayer'); } catch (e) { /* нет */ }
    return dev || 'wss://127.0.0.1:13579/';
  }
  function call(msg, wait) {
    return new Promise(function (ok, fail) {
      var ws, done = false, version = null, timer;
      var finish = function (fn, v) { if (done) return; done = true; clearTimeout(timer); try { ws.close(); } catch (e) { /* ничего */ } fn(v); };
      try { ws = new WebSocket(url()); } catch (e) { fail({ code: 'noLayer' }); return; }
      timer = setTimeout(function () { finish(fail, { code: 'timeout' }); }, wait || 180000);
      ws.onerror = function () { finish(fail, { code: 'noLayer' }); };
      ws.onclose = function () { finish(fail, { code: 'noLayer' }); };
      ws.onopen = function () { if (msg) ws.send(JSON.stringify(msg)); };
      ws.onmessage = function (e) {
        var d; try { d = JSON.parse(e.data); } catch (x) { return; }
        // Сразу после подключения NCALayer присылает свою версию.
        if (d && d.result && d.result.version && !d.body && !d.responseObject) {
          version = d.result.version;
          if (!msg) finish(ok, { version: version });
          return;
        }
        d.version = version;
        finish(ok, d);
      };
    });
  }
  function check() { return call(null, 8000); }
  // NCALayer может вернуть подпись строкой, массивом или объектом, с заголовками PEM и переносами строк.
  function pick(v) {
    if (Array.isArray(v)) v = v[0];
    if (v && typeof v === 'object') v = v.cms || v.signature || v.result || v.data || Object.keys(v).map(function (k) { return v[k]; }).filter(function (x) { return typeof x === 'string'; })[0];
    return clean(String(v || ''));
  }
  function clean(s) {
    return s.replace(/-----(BEGIN|END)[^-]*-----/g, '').replace(/[\s"]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  }
  // detached: подпись без вложенного содержимого — для PAdES (подпись внутри PDF).
  function sign(base64, detached) {
    var basics = {
      module: 'kz.gov.pki.knca.basics', method: 'sign',
      args: {
        allowedStorages: ['PKCS12', 'AKKaztokenStore', 'AKKZIDCardStore', 'AKEToken72KStore', 'AKEToken5110Store', 'AKJaCartaStore', 'AKAKEYStore'],
        format: 'cms', data: base64,
        signingParams: { decode: true, encapsulate: !detached, digested: false },
        signerParams: { extKeyUsageOids: ['1.3.6.1.5.5.7.3.4'], chain: [] },
        locale: (root.getLang && root.getLang() === 'kk') ? 'kk' : 'ru'
      }
    };
    return call(basics).then(function (d) {
      // Ответ без ключей и паролей: только подпись и служебные поля. Видно в консоли браузера при разборе ошибок.
      if (root.console) console.info('NCALayer:', JSON.stringify(d).slice(0, 240));
      if (d.status === true && d.body && d.body.result) return pick(d.body.result);
      if (d.status === true) throw { code: 'cancel' };
      // Старые версии NCALayer без модуля basics: тот же результат через commonUtils.
      if (/module|bundle|not found|не найден/i.test(String(d.message || d.code || ''))) {
        return call({ module: 'kz.gov.pki.knca.commonUtils', method: 'createCAdESFromBase64', args: ['PKCS12', 'SIGNATURE', base64, !detached] }).then(function (r) {
          if (String(r.code) === '200' && r.responseObject) return pick(r.responseObject);
          throw { code: 'layer', message: r.message };
        });
      }
      throw { code: 'layer', message: d.message || d.code };
    });
  }

  /* ---------- ASN.1 DER ---------- */
  function node(b, off) {
    var tag = b[off], p = off + 1, len = b[p++], indef = false;
    if (len & 0x80) {
      var n = len & 0x7f;
      if (n === 0) { indef = true; len = 0; }
      else { len = 0; for (var i = 0; i < n; i++) len = len * 256 + b[p++]; }
    }
    var x = { tag: tag, cls: tag >> 6, cons: !!(tag & 0x20), num: tag & 0x1f, off: off, start: p, kids: null };
    if (x.cons) {
      x.kids = [];
      var q = p, end = indef ? b.length : p + len;
      while (q < end) {
        if (indef && b[q] === 0 && b[q + 1] === 0) { q += 2; break; }
        var k = node(b, q); x.kids.push(k); q = k.end;
      }
      x.end = indef ? q : p + len; x.len = (indef ? q - 2 : x.end) - p;
    } else { x.end = p + len; x.len = len; }
    return x;
  }
  function bytes(b, x) { return b.subarray(x.start, x.start + x.len); }
  function raw(b, x) { return b.subarray(x.off, x.end); }
  function oid(b, x) {
    var v = bytes(b, x), out = [Math.floor(v[0] / 40), v[0] % 40], n = 0;
    for (var i = 1; i < v.length; i++) { n = n * 128 + (v[i] & 0x7f); if (!(v[i] & 0x80)) { out.push(n); n = 0; } }
    return out.join('.');
  }
  function str(b, x) {
    var v = bytes(b, x);
    if (x.tag === 0x1e) { var s = ''; for (var i = 0; i + 1 < v.length; i += 2) s += String.fromCharCode(v[i] << 8 | v[i + 1]); return s; }
    return new TextDecoder().decode(v);
  }
  function time(b, x) {
    var s = str(b, x), y, r;
    if (x.tag === 0x17) { y = +s.slice(0, 2); y += y < 50 ? 2000 : 1900; r = s.slice(2); } else { y = +s.slice(0, 4); r = s.slice(4); }
    return Date.UTC(y, +r.slice(0, 2) - 1, +r.slice(2, 4), +r.slice(4, 6), +r.slice(6, 8), +r.slice(8, 10) || 0);
  }
  function octets(b, x) {   // OCTET STRING может быть составной (BER)
    if (!x.cons) return bytes(b, x);
    var parts = x.kids.map(function (k) { return octets(b, k); }), n = 0, out, p = 0;
    parts.forEach(function (q) { n += q.length; }); out = new Uint8Array(n);
    parts.forEach(function (q) { out.set(q, p); p += q.length; });
    return out;
  }
  var NAMES = { '2.5.4.3': 'cn', '2.5.4.4': 'surname', '2.5.4.42': 'given', '2.5.4.5': 'serial', '2.5.4.10': 'org', '2.5.4.11': 'ou', '2.5.4.6': 'country', '2.5.4.7': 'city', '1.2.840.113549.1.9.1': 'email' };
  function name(b, x) {
    var o = {};
    x.kids.forEach(function (set) { set.kids.forEach(function (av) { var k = NAMES[oid(b, av.kids[0])]; if (k) o[k] = str(b, av.kids[1]); }); });
    return o;
  }
  var ALG = {
    '2.16.840.1.101.3.4.2.1': { n: 'SHA-256', web: 'SHA-256' }, '1.3.14.3.2.26': { n: 'SHA-1', web: 'SHA-1' },
    '1.2.840.113549.1.1.1': { n: 'RSA', rsa: true }, '1.2.840.113549.1.1.11': { n: 'RSA SHA-256', rsa: true }, '1.2.840.113549.1.1.5': { n: 'RSA SHA-1', rsa: true },
    '1.2.398.3.10.1.3.3': { n: 'ГОСТ 34.11-2015' }, '1.2.398.3.10.1.1.2.3.2': { n: 'ГОСТ 34.10-2015 (512)' }, '1.2.398.3.10.1.1.2.3.1': { n: 'ГОСТ 34.10-2015 (256)' },
    '1.2.643.7.1.1.2.2': { n: 'ГОСТ Р 34.11-2012 (256)' }, '1.2.643.7.1.1.1.1': { n: 'ГОСТ Р 34.10-2012 (256)' }
  };
  function alg(id) { return ALG[id] || { n: id }; }
  function hex(a) { return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }

  // Разбор подписи CMS: подписанный документ, сертификат подписанта, время подписи, алгоритмы.
  // Данные сертификата X.509: владелец, ИИН/БИН, кем выдан, срок, ключ.
  function certInfo(b, cert) {
    var t = cert.kids[0].kids, q = t[0].cls === 2 ? 1 : 0;
    var subj = name(b, t[q + 4]), iss = name(b, t[q + 2]);
    return {
      serial: hex(bytes(b, t[q])), subject: subj, issuer: iss,
      notBefore: time(b, t[q + 3].kids[0]), notAfter: time(b, t[q + 3].kids[1]),
      spki: raw(b, t[q + 5]), keyAlg: oid(b, t[q + 5].kids[0].kids[0]),
      iin: (subj.serial || '').replace(/^IIN/i, ''), bin: (subj.ou || '').replace(/^BIN/i, '')
    };
  }
  function cert(der) { return certInfo(der, node(der, 0)); }
  function parse(cms) {
    var b = cms instanceof Uint8Array ? cms : new Uint8Array(cms);
    var ci = node(b, 0);
    if (oid(b, ci.kids[0]) !== '1.2.840.113549.1.7.2') throw new Error('not-cms');
    var sd = ci.kids[1].kids[0], k = sd.kids, i = 1;
    var digestAlgs = k[i++];
    var enc = k[i++], content = null;
    if (enc.kids[1]) content = octets(b, enc.kids[1].kids[0]);
    var certs = [];
    while (i < k.length && k[i].cls === 2) {
      if (k[i].num === 0) k[i].kids.forEach(function (c) { certs.push(c); });
      i++;
    }
    var si = k[i].kids[0], s = si.kids, j = 1;
    var sid = s[j++], digestAlg = oid(b, s[j++].kids[0]), signedAttrs = null;
    if (s[j].cls === 2 && s[j].num === 0) signedAttrs = s[j++];
    var sigAlg = oid(b, s[j++].kids[0]), signature = bytes(b, s[j++]);
    var serial = sid.tag === 0x30 ? hex(bytes(b, sid.kids[1])) : null;
    var cert = certs.filter(function (c) { return hex(bytes(b, c.kids[0].kids[c.kids[0].kids[0].cls === 2 ? 1 : 0])) === serial; })[0] || certs[0];
    var info = cert ? certInfo(b, cert) : {}, attrs = {};
    if (signedAttrs) signedAttrs.kids.forEach(function (a) {
      var id = oid(b, a.kids[0]), v = a.kids[1].kids[0];
      if (id === '1.2.840.113549.1.9.4') attrs.digest = bytes(b, v);
      if (id === '1.2.840.113549.1.9.5') attrs.time = time(b, v);
    });
    return { content: content, info: info, attrs: attrs, digestAlg: digestAlg, sigAlg: sigAlg, signature: signature,
      signedAttrs: signedAttrs ? raw(b, signedAttrs) : null, certCount: certs.length };
  }

  // Проверка: (1) отпечаток содержимого совпадает с атрибутом подписи; (2) для RSA — подпись по открытому ключу сертификата.
  function verify(p) {
    var subtle = root.crypto && root.crypto.subtle, d = alg(p.digestAlg), res = { digest: 'skip', crypto: 'skip', gost: !d.web };
    if (!subtle || !d.web || !p.content) return Promise.resolve(res);
    return subtle.digest(d.web, p.content).then(function (h) {
      res.digest = p.attrs.digest ? (hex(new Uint8Array(h)) === hex(p.attrs.digest) ? 'ok' : 'fail') : 'skip';
      var sa = alg(p.sigAlg), ka = alg(p.info.keyAlg);
      if (!(sa.rsa || ka.rsa) || !p.signedAttrs || !p.info.spki) return res;
      var data = new Uint8Array(p.signedAttrs); data[0] = 0x31;   // подписывается SET, а не [0]
      return subtle.importKey('spki', p.info.spki, { name: 'RSASSA-PKCS1-v1_5', hash: d.web }, false, ['verify'])
        .then(function (key) { return subtle.verify('RSASSA-PKCS1-v1_5', key, p.signature, data); })
        .then(function (ok) { res.crypto = ok ? 'ok' : 'fail'; return res; })
        .catch(function () { res.crypto = 'skip'; return res; });
    });
  }

  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(s) { var bin = atob(clean(s)), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }

  /* ---------- Штамп ЭЦП ---------- */
  // Блок «Документ подписан ЭЦП» для просмотра, .docx и .pdf. Текст — на языке документа,
  // данные — из сертификата подписи. Это визуализация: юридически значим файл .cms.
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function when(ms, withTime) {
    var d = new Date(ms), off = -d.getTimezoneOffset() / 60;
    return two(d.getDate()) + '.' + two(d.getMonth() + 1) + '.' + d.getFullYear() +
      (withTime ? ' ' + two(d.getHours()) + ':' + two(d.getMinutes()) + ' (UTC' + (off >= 0 ? '+' : '') + off + ')' : '');
  }
  function stamp(r, lang) {
    var L = (root.I18N && root.I18N[lang === 'kk' ? 'kk' : 'ru']) || {};
    var s = function (k) { return L[k] || (root.I18N && root.I18N.ru[k]) || k; };
    // Штамп без данных подписанта: отметка и время. Кто подписал — в самой подписи и в карточке на сайте.
    return { k: 'stamp', head: s('st.head'), rows: [[s('st.time'), when(r.time || r.at, true), false]], foot: '' };
  }

  root.DocumEcp = { check: check, sign: sign, parse: parse, verify: verify, alg: alg, b64: b64, unb64: unb64, hex: hex, stamp: stamp, cert: cert };
})(window);
