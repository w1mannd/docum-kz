/* docum.kz — цепочка доверия ЭЦП: сертификат подписанта → НУЦ РК → корневой центр РК.
   Каждое звено проверяется подписью вышестоящего центра (RSA — через WebCrypto, ГОСТ — через js/gost.js),
   а цепочка должна закончиться одним из корневых сертификатов НУЦ, встроенных ниже.
   Сертификаты НУЦ взяты с pki.gov.kz и root.gov.kz (по https с двух адресов, байты совпали).
   Здесь же проверяются подпись ответа НУЦ об отзыве (OCSP) и подпись метки времени (TSP).
   Ничего не сохраняется и никуда не отправляется, кроме запроса недостающего сертификата центра у НУЦ. */
(function (root) {
  'use strict';
  var E = root.DocumEcp, A = E.asn;
  var ROOTS = [
    // Корневые центры НУЦ РК (ГОСТ 2022, RSA 2020): им доверяем без проверки — это начало цепочки.
    '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'
  ];
  var INTER = [
    // Национальный удостоверяющий центр (ГОСТ 2022, RSA 2022): выдаёт ключи гражданам и организациям.
    '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'
  ];

  function hex(u) { return E.hex(u); }
  var OID = { bc: '2.5.29.19', ku: '2.5.29.15', eku: '2.5.29.37', ski: '2.5.29.14', aki: '2.5.29.35', pol: '2.5.29.32' };
  var EKU = { '1.3.6.1.5.5.7.3.9': 'ocsp', '1.3.6.1.5.5.7.3.8': 'tsp', '1.3.6.1.5.5.7.3.4': 'email', '1.3.6.1.5.5.7.3.2': 'clientAuth' };

  // Разбор сертификата: что подписано (TBS), подпись, имена в виде байтов, ключ, расширения.
  function cert(der) {
    var c = A.node(der, 0), t = c.kids[0].kids, q = t[0].cls === 2 ? 1 : 0, ex = A.exts(der, t), ku = [], eku = [], ca = false, ski = null;
    try { if (ex[OID.bc]) { var bc = A.node(ex[OID.bc], 0); ca = !!(bc.kids[0] && bc.kids[0].tag === 0x01 && ex[OID.bc][bc.kids[0].start]); } } catch (e) { /* нет */ }
    try {
      if (ex[OID.ku]) {
        var kb = A.bytes(ex[OID.ku], A.node(ex[OID.ku], 0)), bits = ['digitalSignature', 'nonRepudiation', 'keyEncipherment', 'dataEncipherment', 'keyAgreement', 'keyCertSign', 'cRLSign'];
        bits.forEach(function (n, i) { var byte = kb[1 + (i >> 3)]; if (byte !== undefined && (byte & (0x80 >> (i & 7)))) ku.push(n); });
      }
    } catch (e) { /* нет */ }
    try { if (ex[OID.eku]) A.node(ex[OID.eku], 0).kids.forEach(function (k) { eku.push(A.oid(ex[OID.eku], k)); }); } catch (e) { /* нет */ }
    try { if (ex[OID.ski]) ski = hex(A.bytes(ex[OID.ski], A.node(ex[OID.ski], 0))); } catch (e) { /* нет */ }
    var info = E.certInfo(der, c);
    return {
      der: der, info: info, tbs: new Uint8Array(A.raw(der, c.kids[0])), sigAlg: A.oid(der, c.kids[1].kids[0]),
      sig: A.bytes(der, c.kids[2]).slice(1), issuerRaw: hex(A.raw(der, t[q + 2])), subjectRaw: hex(A.raw(der, t[q + 4])),
      spki: info.spki, keyAlg: info.keyAlg, ca: ca, ku: ku, eku: eku, ski: ski, aki: info.aki ? hex(info.aki) : null,
      cn: info.subject.cn || '', from: info.notBefore, to: info.notAfter, id: hex(der.subarray(0, Math.min(der.length, 4096)))
    };
  }
  function unb(s) { return E.unb64(s); }
  var anchors = null, inters = null;
  function load() {
    if (anchors) return;
    anchors = ROOTS.map(function (s) { return cert(unb(s)); });
    inters = INTER.map(function (s) { return cert(unb(s)); });
  }
  function same(a, b) { return a.der.length === b.der.length && hex(a.der) === hex(b.der); }
  function isAnchor(c) { return anchors.some(function (a) { return same(a, c); }); }
  function selfSigned(c) { return c.issuerRaw === c.subjectRaw; }

  // Недостающий сертификат центра — по адресу из сертификата, только с адресов НУЦ (через api/pki.js).
  function fetchIssuer(c) {
    var url = c.info.caUrl;
    if (!url || !/(^|\.)(pki|root)\.gov\.kz$/i.test((url.match(/^https?:\/\/([^/:]+)/i) || [])[1] || '')) return Promise.resolve(null);
    return fetch('/api/pki?op=cert&url=' + encodeURIComponent(url)).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.cert) return null;
      var der = unb(j.cert);
      if (der[0] !== 0x30) der = unb(new TextDecoder().decode(der));
      return cert(der);
    }).catch(function () { return null; });
  }

  // Цепочка от сертификата до корневого центра НУЦ.
  // status: ok — доверенная цепочка; untrusted — заканчивается чужим корнем; incomplete — не нашли центр;
  // broken — подпись центра не сходится; unsupported — алгоритм не поддерживается.
  // at — момент, на который проверяется срок действия каждого звена.
  function chain(leafDer, poolDers, at) {
    load();
    var leaf = cert(leafDer), pool = inters.concat((poolDers || []).map(function (d) { try { return cert(d); } catch (e) { return null; } }).filter(Boolean));
    var path = [leaf], out = { status: 'incomplete', path: [], root: '' };
    function finish(st, extra) {
      out.status = st;
      out.path = path.map(function (c) { return { cn: c.cn, org: c.info.subject.org || '', from: c.from, to: c.to, valid: at >= c.from && at <= c.to }; });
      out.allValid = out.path.every(function (x) { return x.valid; });
      if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
      return out;
    }
    function step(cur, depth) {
      if (isAnchor(cur)) return Promise.resolve(finish('ok', { root: cur.cn }));
      if (depth > 6) return Promise.resolve(finish('incomplete'));
      var cands = anchors.concat(pool).filter(function (c) { return c.subjectRaw === cur.issuerRaw && (!cur.aki || !c.ski || c.ski === cur.aki) && !same(c, cur); });
      var get = cands.length ? Promise.resolve(cands) : fetchIssuer(cur).then(function (c) { return c ? [c] : []; });
      return get.then(function (list) {
        if (!list.length) return finish(selfSigned(cur) ? 'untrusted' : 'incomplete', { issuer: cur.info.issuer.cn || '' });
        var i = 0, sawNull = false;
        function tryNext() {
          if (i >= list.length) return finish(sawNull ? 'unsupported' : 'broken', { issuer: cur.info.issuer.cn || '' });
          var p = list[i++];
          return E.checkSig(p.spki, p.keyAlg, cur.sigAlg, cur.tbs, cur.sig).then(function (ok) {
            if (ok === null) { sawNull = true; return tryNext(); }
            if (!ok) return tryNext();
            if (!isAnchor(p) && !p.ca) return finish('broken', { notCa: p.cn });
            path.push(p);
            return step(p, depth + 1);
          });
        }
        return tryNext();
      });
    }
    return step(leaf, 0).catch(function () { return finish('incomplete'); });
  }

  // Назначение ключа: НУЦ выдаёт отдельные ключи для подписи (неотрекаемость) и для входа (аутентификация).
  function purpose(der) {
    var c = cert(der);
    return { sign: c.ku.indexOf('nonRepudiation') >= 0, auth: c.eku.indexOf('1.3.6.1.5.5.7.3.2') >= 0 && c.ku.indexOf('nonRepudiation') < 0, ku: c.ku, eku: c.eku };
  }

  // Ответ НУЦ об отзыве: подпись ответчика и его цепочка до корня.
  function ocspCheck(o) {
    load();
    if (!o || !o.sig) return Promise.resolve({ sig: 'skip' });
    var s = o.sig, list = (s.certs || []).map(function (d) { try { return cert(d); } catch (e) { return null; } }).filter(Boolean).concat(inters);
    var i = 0;
    function next() {
      if (i >= list.length) return Promise.resolve({ sig: 'fail' });
      var c = list[i++];
      return E.checkSig(c.spki, c.keyAlg, s.alg, s.tbs, s.value).then(function (ok) {
        if (!ok) return next();
        var direct = inters.some(function (x) { return same(x, c); });
        if (!direct && c.eku.indexOf('1.3.6.1.5.5.7.3.9') < 0) return { sig: 'fail', responder: c.cn, reason: 'eku' };
        return chain(c.der, s.certs, o.producedAt || Date.now()).then(function (ch) { return { sig: 'ok', responder: c.cn, chain: ch.status }; });
      });
    }
    return next();
  }

  // Метка времени: подпись службы меток времени над TSTInfo и её цепочка до корня.
  function tspCheck(tsp) {
    if (!tsp || !tsp.der) return Promise.resolve({ sig: 'skip' });
    var p;
    try { p = E.parse(tsp.der); } catch (e) { return Promise.resolve({ sig: 'skip' }); }
    return E.verifyCore(p, 'none').then(function (r) {
      var sig = r.digest === 'fail' || r.crypto === 'fail' ? 'fail' : r.digest === 'ok' && r.crypto === 'ok' ? 'ok' : 'skip';
      if (!p.signerDer) return { sig: sig, chain: 'incomplete' };
      var pu = cert(p.signerDer);
      return chain(p.signerDer, p.certs, tsp.time).then(function (ch) {
        return { sig: sig, chain: ch.status, tsa: pu.cn, eku: pu.eku.indexOf('1.3.6.1.5.5.7.3.8') >= 0 };
      });
    });
  }

  root.DocumPki = { cert: cert, chain: chain, purpose: purpose, ocspCheck: ocspCheck, tspCheck: tspCheck, EKU: EKU };
})(window);
