/* docum.kz — зашифрованный ящик: короткая ссылка вместо документа в ссылке.
   Ссылка: share.html#b.<номер ящика>.<секрет>. Секрет (128 бит) не уходит на сервер — браузер не отправляет часть после «#».
   Из секрета (HKDF-SHA-256) выводятся ключ шифрования AES-256-GCM и токен записи; серверу известен только хэш токена.
   Каждое сообщение — JSON → сжатие → AES-GCM со случайным IV. Сервер хранит и отдаёт только шифротекст. */
(function (root) {
  'use strict';
  var ST = root.DocumStore;
  var te = new TextEncoder(), td = new TextDecoder();
  function b64u(u8) { var s = ''; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function hex(u8) { return Array.prototype.map.call(u8, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }

  // Ключи ящика из секрета ссылки.
  function keys(secret) {
    return crypto.subtle.importKey('raw', unb64u(secret), 'HKDF', false, ['deriveKey', 'deriveBits']).then(function (base) {
      var p = function (info) { return { name: 'HKDF', hash: 'SHA-256', salt: te.encode('docum.kz box v1'), info: te.encode(info) }; };
      return Promise.all([
        crypto.subtle.deriveKey(p('enc'), base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']),
        crypto.subtle.deriveBits(p('write'), base, 256)
      ]).then(function (r) { return { enc: r[0], token: hex(new Uint8Array(r[1])) }; });
    });
  }
  function seal(k, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return ST.encode(obj).then(function (packed) {
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k.enc, te.encode(packed));
    }).then(function (ct) {
      var out = new Uint8Array(12 + ct.byteLength); out.set(iv, 0); out.set(new Uint8Array(ct), 12);
      return b64u(out);
    });
  }
  function open(k, msg) {
    var u = unb64u(msg);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, k.enc, u.subarray(12)).then(function (pt) { return ST.decode(td.decode(pt)); });
  }
  function api(op, id, payload) {
    var url = '/api/box?op=' + op + (id ? '&id=' + encodeURIComponent(id) : '');
    var init = payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : { method: 'GET' };
    return fetch(url, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw { code: j.error || ('http' + r.status), status: r.status }; return j; });
    });
  }

  var onP = null;
  // Есть ли хранилище на сервере. Без него сайт работает длинными ссылками, как раньше.
  function available() {
    if (!onP) onP = (location.protocol === 'file:' ? Promise.resolve(false) : api('info').then(function (j) { return !!j.on; }, function () { return false; }));
    return onP;
  }
  function link(id, secret) { return location.origin + '/share.html#b.' + id + '.' + secret; }
  function parse(hash) {
    var m = /^b\.([A-Za-z0-9]{12})\.([A-Za-z0-9_-]{22})$/.exec(hash || '');
    return m ? { id: m[1], s: m[2] } : null;
  }
  // Новый ящик с первым сообщением. Возвращает { id, s, url }.
  function create(obj) {
    var secret = b64u(crypto.getRandomValues(new Uint8Array(16)));
    return keys(secret).then(function (k) {
      return Promise.all([seal(k, obj), crypto.subtle.digest('SHA-256', te.encode(k.token))]).then(function (r) {
        return api('new', null, { m: r[0], w: hex(new Uint8Array(r[1])) });
      });
    }).then(function (j) { return { id: j.id, s: secret, url: link(j.id, secret) }; });
  }
  // Сообщение в существующий ящик (ответ второй стороны или новый запрос отправителя).
  function put(box, obj) {
    return keys(box.s).then(function (k) { return seal(k, obj).then(function (m) { return api('put', box.id, { t: k.token, m: m }); }); });
  }
  // Все сообщения ящика, расшифрованные. Повреждённые пропускаются.
  function read(box) {
    return Promise.all([keys(box.s), api('get', box.id)]).then(function (r) {
      var k = r[0];
      return Promise.all(r[1].m.map(function (m) { return open(k, m).catch(function () { return null; }); }))
        .then(function (list) { return { list: list.filter(Boolean), ttl: r[1].ttl }; });
    });
  }
  function remove(box) {
    return keys(box.s).then(function (k) { return api('del', box.id, { t: k.token }); });
  }

  root.DocumBox = { available: available, create: create, put: put, read: read, remove: remove, parse: parse, link: link };
})(window);
