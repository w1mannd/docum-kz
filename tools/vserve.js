// Локальный аналог Vercel для проверки (в сайт не входит): статика + заголовки из vercel.json + функции из api/.
// node tools/vserve.js ПАПКА_САЙТА [порт] ["доп. адреса для connect-src, например ws://127.0.0.1:13580"]
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const ROOT = process.argv[2], PORT = +process.argv[3] || 8322, EXTRA_WS = process.argv[4] || '';
const conf = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain', '.xml': 'application/xml' };
http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  for (const rule of conf.headers) {
    const re = new RegExp('^' + rule.source.replace(/\(\.\*\)/g, '(.*)') + '$');
    if (re.test(u.pathname)) for (const h of rule.headers) {
      let v = h.value;
      if (h.key === 'Content-Security-Policy' && EXTRA_WS) v = v.replace("connect-src 'self'", "connect-src 'self' " + EXTRA_WS);
      if (h.key !== 'Strict-Transport-Security') res.setHeader(h.key, v);
    }
  }
  if (u.pathname.startsWith('/api/')) {
    const name = u.pathname.slice(5).replace(/[^\w-]/g, '');
    const fn = require(path.join(ROOT, 'api', name + '.js'));
    let body = ''; for await (const c of req) body += c;
    try { body = JSON.parse(body); } catch (e) { /* строка */ }
    const r = { query: u.query, method: req.method, headers: req.headers, body };
    const w = { status(c) { res.statusCode = c; return w; }, json(o) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); }, setHeader: (k, v) => res.setHeader(k, v) };
    return fn(r, w);
  }
  let p = path.join(ROOT, decodeURIComponent(u.pathname));
  if (u.pathname === '/') p = path.join(ROOT, 'index.html');
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.statusCode = 404; p = path.join(ROOT, '404.html'); if (!fs.existsSync(p)) return res.end('404'); }
  res.setHeader('Content-Type', TYPES[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log('vserve http://localhost:' + PORT));
