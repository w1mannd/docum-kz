/* docum.kz — сервис-воркер: страницы открываются мгновенно из кэша браузера.
   Страницы (HTML): сразу из кэша, а в фоне берётся свежая версия с сервера — она покажется при следующем открытии.
   Если в кэше страницы нет — с сервера. Файлы css/js/картинки с версией (?v=) не меняются, поэтому только из кэша.
   Версию кэша (CACHE) ставит tools/stamp.py по хэшу страниц: после выкладки старый кэш удаляется целиком.
   /api/ (OCSP НУЦ, Civis AI) и чужие адреса не трогаются. Данные пользователя здесь не хранятся: только файлы сайта. */
'use strict';
const CACHE = 'docum-afa4b32e';
const PAGES = ['/', '/constructor.html', '/documents.html', '/legal.html', '/verify.html', '/about.html', '/profile.html', '/share.html', '/404.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(PAGES.map((u) =>
    fetch(u, { cache: 'no-cache' }).then((r) => (r.ok && !r.redirected ? c.put(u, r) : null)).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

// Адрес страницы без параметров и якоря: constructor.html?doc=… и share.html#… — одна и та же страница.
function pageKey(url) { return url.pathname === '/index.html' ? '/' : url.pathname; }

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    const key = pageKey(url);
    if (!/^\/([\w-]+\.html)?$/.test(key)) return;
    const fresh = (async () => {
      const r = (await e.preloadResponse) || (await fetch(req, { cache: 'no-cache' }));
      if (r && r.ok && !r.redirected && (r.headers.get('content-type') || '').includes('text/html')) {
        const c = await caches.open(CACHE);
        await c.put(key, r.clone());
      }
      return r;
    })();
    e.respondWith((async () => {
      const hit = await caches.match(key);
      if (hit) { e.waitUntil(fresh.catch(() => null)); return hit; }
      try { return await fresh; } catch (err) { return (await caches.match('/404.html')) || Response.error(); }
    })());
    return;
  }

  // Файлы с версией: неизменны, берём из кэша, при отсутствии — с сервера и кладём в кэш.
  if (/^\/(css|js|assets|fonts|vendor)\//.test(url.pathname) && url.searchParams.has('v') || /^\/assets\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok) {
        const copy = r.clone();
        // Старые версии того же файла больше не нужны: оставляем только новую.
        caches.open(CACHE).then(async (c) => {
          for (const k of await c.keys()) { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) await c.delete(k); }
          await c.put(req, copy);
        });
      }
      return r;
    })));
  }
});
