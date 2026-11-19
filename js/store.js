/* docum.kz — журнал документов в браузере пользователя (IndexedDB), без сервера.
   Здесь же: текст документа для сравнения и отпечатка, отпечаток SHA-256 и упаковка данных в ссылку. */
(function (root) {
  'use strict';
  var DB = 'docum', STORE = 'docs', LS = 'docum-journal';
  var dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (ok, fail) {
      if (!root.indexedDB) { fail(new Error('no-idb')); return; }
      var r = root.indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE, { keyPath: 'id' }); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { fail(r.error); };
    }).catch(function (e) { dbp = null; throw e; });
    return dbp;
  }
  // Запасной вариант, если браузер запрещает IndexedDB (например, приватный режим): localStorage.
  function lsAll() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } }
  function lsSave(list) { localStorage.setItem(LS, JSON.stringify(list)); }

  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (ok, fail) {
        var t = db.transaction(STORE, mode), st = t.objectStore(STORE), res = fn(st);
        t.oncomplete = function () { ok(res && res.result !== undefined ? res.result : undefined); };
        t.onerror = function () { fail(t.error); };
      });
    });
  }
  var api = {
    all: function () {
      return tx('readonly', function (st) { return st.getAll(); }).catch(function () { return lsAll(); })
        .then(function (list) { return (list || []).sort(function (a, b) { return b.updated - a.updated; }); });
    },
    get: function (id) {
      return tx('readonly', function (st) { return st.get(id); }).catch(function () {
        return lsAll().filter(function (r) { return r.id === id; })[0];
      });
    },
    put: function (rec) {
      rec.updated = Date.now();
      return tx('readwrite', function (st) { return st.put(rec); }).catch(function () {
        var list = lsAll().filter(function (r) { return r.id !== rec.id; }); list.push(rec); lsSave(list);
      }).then(function () { return rec; });
    },
    del: function (id) {
      return tx('readwrite', function (st) { return st.delete(id); }).catch(function () {
        lsSave(lsAll().filter(function (r) { return r.id !== id; }));
      });
    },
    newId: function () {
      var a = new Uint8Array(8); (root.crypto || {}).getRandomValues ? root.crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
      return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    }
  };

  // Текст документа по абзацам: одинаково для сравнения версий и для отпечатка.
  api.units = function (blocks) {
    var out = [];
    (blocks || []).forEach(function (b) {
      switch (b.k) {
        case 'gap': break;
        case 'row': out.push(b.left + '\t' + b.right); break;
        case 'order': out.push(b.text || 'ПРИКАЗЫВАЮ:'); break;
        case 'cols':
          b.left.forEach(function (l, i) { out.push((l || '') + '\t' + (b.right[i] || '')); });
          for (var i = b.left.length; i < b.right.length; i++) out.push('\t' + b.right[i]);
          b.signLeft.forEach(function (l, i) { out.push((l || '') + '\t' + (b.signRight[i] || '')); });
          break;
        case 'table':
          if (b.head) out.push(b.head.join(' | '));
          b.rows.forEach(function (r) { out.push(r.join(' | ')); });
          (b.foot || []).forEach(function (r) { out.push([].concat(r).join(' | ')); });
          break;
        default: if (b.text != null) out.push(b.text);
      }
    });
    return out;
  };
  api.text = function (blocks) { return api.units(blocks).join('\n'); };

  api.hash = function (text) {
    if (!(root.crypto && root.crypto.subtle && root.TextEncoder)) return Promise.resolve('');
    return root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  };

  // Упаковка в ссылку: JSON → сжатие deflate → base64url. Данные идут после «#» и на сервер не отправляются.
  function b64(bytes) {
    var s = ''; for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function pipe(bytes, stream) {
    return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  api.encode = function (obj) {
    var raw = new TextEncoder().encode(JSON.stringify(obj));
    if (!root.CompressionStream) return Promise.resolve('u' + b64(raw));
    return pipe(raw, new CompressionStream('deflate-raw')).then(function (z) { return 'z' + b64(z); });
  };
  api.decode = function (str) {
    var kind = str.charAt(0), bytes = unb64(str.slice(1));
    var p = kind === 'z' ? pipe(bytes, new DecompressionStream('deflate-raw')) : Promise.resolve(bytes);
    return p.then(function (b) { return JSON.parse(new TextDecoder().decode(b)); });
  };

  // Ответ второй стороны: при заполнении — новая версия, затем отметка о согласовании с проверкой отпечатка.
  // Текст ответа: при заполнении документ собирается заново из данных, иначе берётся отправленная версия по отпечатку.
  api.responseBlocks = function (p, rec) {
    if (p.blocks) return p.blocks;
    if (p.data && root.DocumTemplates) return root.DocumTemplates.build(p.code, p.data, p.lang);
    var v = rec && rec.versions.filter(function (x) { return x.hash === p.hash; })[0];
    return v ? v.blocks : null;
  };
  api.importResponse = function (p) {
    return api.get(p.id).then(function (r) {
      var blocks = api.responseBlocks(p, r);
      if (!blocks) return null;
      return api.hash(api.text(blocks)).then(function (h) {
        var ok = h === p.hash;
        if (!r) r = { id: p.id, code: p.code, lang: p.lang, number: p.number || '', created: Date.now(), status: 'signed', versions: [], shares: [], signs: [] };
        var same = r.versions.filter(function (v) { return v.hash === h; })[0], n;
        if (same) n = same.n;
        else {
          var prev = r.versions[r.versions.length - 1];
          n = r.versions.length + 1;
          r.versions.push({ n: n, at: p.at, blocks: blocks, data: p.data || (prev && prev.data) || {}, lang: p.lang, hash: h, note: '', byOther: p.mode === 'fill' });
        }
        r.signs = r.signs || [];
        if (!r.signs.some(function (s) { return s.at === p.at && s.name === p.name; })) r.signs.push({ who: 'other', name: p.name, strokes: p.strokes, at: p.at, n: n, hash: h, ok: ok });
        r.status = 'signed';
        return api.put(r);
      });
    });
  };

  root.DocumStore = api;
})(window);
