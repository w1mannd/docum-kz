/* docum.kz — зашифрованный ящик для подписи по ссылке (функция Vercel).
   Браузер шифрует документ, подписи и ответы ключом, который живёт только в ссылке после «#» и на сервер не попадает.
   Здесь хранится шифротекст: прочитать ФИО, ИИН или текст договора сервер не может.
   Писать в ящик может только тот, у кого есть ключ: сервер сверяет хэш токена записи, сам токен выводится из ключа.
   Ящик удаляется через 14 дней или раньше, когда документ подписан обеими сторонами.
   Хранилище — Redis (Upstash, интеграция Vercel). Без него функция отвечает 503, и сайт работает длинными ссылками. */
'use strict';
const crypto = require('crypto');

const TTL = 14 * 24 * 3600;          // срок жизни ящика, секунд
const MAX_MSG = 96 * 1024;           // одно сообщение (Base64), байт
const MAX_LIST = 40;                 // сообщений в ящике
const NEW_PER_HOUR = 30;             // новых ящиков с одного адреса в час
const ID_RE = /^[A-Za-z0-9]{12}$/, HEX64 = /^[0-9a-f]{64}$/, B64 = /^[A-Za-z0-9_-]+$/;

function store() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}
// Несколько команд Redis одним запросом (Upstash REST /pipeline).
async function redis(db, cmds) {
  const r = await fetch(db.url + '/pipeline', {
    method: 'POST', headers: { Authorization: 'Bearer ' + db.token, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error('store ' + r.status);
  const out = await r.json();
  return out.map((x) => { if (x.error) throw new Error(x.error); return x.result; });
}
function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b || {};
}
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
function newId() {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', b = crypto.randomBytes(12);
  let s = ''; for (const x of b) s += abc[x % 62]; return s;
}
const okMsg = (m) => typeof m === 'string' && m.length > 20 && m.length <= MAX_MSG && B64.test(m);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const db = store();
  const op = String((req.query && req.query.op) || '');
  if (op === 'info') { res.status(200).json({ on: !!db }); return; }
  if (!db) { res.status(503).json({ error: 'off' }); return; }
  const id = String((req.query && req.query.id) || '');
  try {
    // Новый ящик: первое сообщение отправителя и хэш токена записи.
    if (op === 'new' && req.method === 'POST') {
      const b = body(req);
      if (!okMsg(b.m) || !HEX64.test(String(b.w || ''))) { res.status(400).json({ error: 'bad' }); return; }
      const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
      const [n] = await redis(db, [['INCR', 'rate:' + sha(ip).slice(0, 24)], ['EXPIRE', 'rate:' + sha(ip).slice(0, 24), 3600, 'NX']]);
      if (n > NEW_PER_HOUR) { res.status(429).json({ error: 'rate' }); return; }
      const nid = newId();
      const [set] = await redis(db, [['SET', 'box:' + nid + ':w', b.w, 'EX', TTL, 'NX'], ['RPUSH', 'box:' + nid, b.m], ['EXPIRE', 'box:' + nid, TTL]]);
      if (set !== 'OK') { res.status(409).json({ error: 'retry' }); return; }
      res.status(200).json({ id: nid, ttl: TTL });
      return;
    }
    if (!ID_RE.test(id)) { res.status(400).json({ error: 'bad' }); return; }
    // Чтение: только шифротекст, без ключа он бесполезен.
    if (op === 'get' && req.method === 'GET') {
      const [list, ttl] = await redis(db, [['LRANGE', 'box:' + id, 0, MAX_LIST - 1], ['TTL', 'box:' + id]]);
      if (!list || !list.length) { res.status(404).json({ error: 'gone' }); return; }
      res.status(200).json({ m: list, ttl });
      return;
    }
    // Запись и удаление — с токеном, который знает только владелец ключа.
    if ((op === 'put' || op === 'del') && req.method === 'POST') {
      const b = body(req);
      const [w] = await redis(db, [['GET', 'box:' + id + ':w']]);
      if (!w) { res.status(404).json({ error: 'gone' }); return; }
      const given = Buffer.from(sha(b.t || '')), want = Buffer.from(String(w));
      if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) { res.status(403).json({ error: 'token' }); return; }
      if (op === 'del') { await redis(db, [['DEL', 'box:' + id, 'box:' + id + ':w']]); res.status(200).json({ ok: true }); return; }
      if (!okMsg(b.m)) { res.status(400).json({ error: 'bad' }); return; }
      const [len] = await redis(db, [['LLEN', 'box:' + id]]);
      if (len >= MAX_LIST) { res.status(413).json({ error: 'full' }); return; }
      await redis(db, [['RPUSH', 'box:' + id, b.m]]);
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: 'method' });
  } catch (e) {
    res.status(502).json({ error: 'store' });
  }
};
