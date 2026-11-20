/* docum.kz — посредник к службам НУЦ РК (функция Vercel).
   Браузер не может обратиться к ocsp.pki.gov.kz напрямую: служба работает по http и не разрешает запросы с чужих сайтов.
   Через посредника проходит только то, что нужно НУЦ, и ничего лишнего:
   - op=ocsp: готовый OCSP-запрос, собранный в браузере. В нём хэши имени и ключа удостоверяющего центра
     и серийный номер сертификата — без ФИО, ИИН и без самого документа;
   - op=cert: открытый сертификат удостоверяющего центра НУЦ по адресу из сертификата подписанта.
   Ходить можно только на адреса *.pki.gov.kz и *.root.gov.kz (корневой центр НУЦ). Ничего не сохраняется. */
'use strict';

const OCSP = 'http://ocsp.pki.gov.kz/';
const MAX_REQ = 4096, MAX_RES = 65536;
const hits = new Map();   // не больше 60 обращений за 10 минут с одного адреса

function nucUrl(u) {
  try {
    const x = new URL(u);
    return (x.protocol === 'http:' || x.protocol === 'https:') && /(^|\.)(pki|root)\.gov\.kz$/i.test(x.hostname) && !x.username && !x.port ? x.href : null;
  } catch (e) { return null; }
}

// Тело запроса — JSON { der: "<OCSP-запрос в Base64>" }.
function readBody(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const der = b && typeof b.der === 'string' ? b.der : '';
  if (der.length > MAX_REQ * 2) return Buffer.alloc(0);
  return Buffer.from(der, 'base64');
}

async function pull(url, init) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    let r = await fetch(url, Object.assign({ signal: ctl.signal, redirect: 'manual' }, init));
    // Один переход по перенаправлению — и только внутри доменов НУЦ.
    if (r.status >= 300 && r.status < 400 && init.method === 'GET') {
      const next = nucUrl(new URL(r.headers.get('location') || '', url).href);
      if (!next) return { status: 400 };
      r = await fetch(next, Object.assign({ signal: ctl.signal, redirect: 'manual' }, init));
    }
    if (!r.ok) return { status: r.status };
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_RES) return { status: 413 };
    return { status: 200, b64: buf.toString('base64') };
  } finally { clearTimeout(timer); }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim(), now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 600000);
  if (list.length >= 60) { res.status(429).json({ error: 'rate' }); return; }
  list.push(now); hits.set(ip, list);

  const op = String((req.query && req.query.op) || '');
  try {
    if (op === 'ocsp' && req.method === 'POST') {
      const body = readBody(req);
      if (!body.length || body.length > MAX_REQ || body[0] !== 0x30) { res.status(400).json({ error: 'bad' }); return; }
      const r = await pull(OCSP, { method: 'POST', headers: { 'Content-Type': 'application/ocsp-request', 'Accept': 'application/ocsp-response' }, body });
      if (r.status !== 200) { res.status(502).json({ error: 'nuc', status: r.status }); return; }
      res.status(200).json({ ocsp: r.b64 });
      return;
    }
    if (op === 'cert' && req.method === 'GET') {
      const url = nucUrl(String(req.query.url || ''));
      if (!url) { res.status(400).json({ error: 'host' }); return; }
      const r = await pull(url, { method: 'GET' });
      if (r.status !== 200) { res.status(502).json({ error: 'nuc', status: r.status }); return; }
      res.status(200).json({ cert: r.b64 });
      return;
    }
    res.status(405).json({ error: 'method' });
  } catch (e) {
    res.status(e && e.name === 'AbortError' ? 504 : 502).json({ error: 'nuc' });
  }
};
