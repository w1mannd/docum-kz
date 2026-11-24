/* docum.kz — реквизиты юридического лица по БИН (функция Vercel).
   Источник — открытые данные портала data.egov.kz: «Регистрационные данные юридических лиц, филиалов, представительств
   Казахстана» (gbd_ul, Министерство юстиции РК). Ключ API портала — только в переменной окружения DATA_EGOV_API_KEY.
   Запрашивается только БИН организации (пятая цифра 4, 5 или 6) — ИИН граждан сюда не принимается.
   Отдаются название, адрес и статус. ФИО руководителя не передаётся. Ничего не сохраняется. */
'use strict';

const API = 'https://data.egov.kz/api/v4/gbd_ul/v1';
const hits = new Map();   // не больше 40 запросов за 10 минут с одного адреса

// БИН: 12 цифр, пятая — 4 (юрлицо-резидент), 5 (нерезидент) или 6 (ИП совместного предпринимательства).
function isBin(s) { return /^\d{12}$/.test(s) && /[456]/.test(s[4]); }
const str = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, 300) : '');
// Название в реестре идёт с прямыми кавычками: в документах сайта — «ёлочки».
const quotes = (s) => s.replace(/"([^"]+)"/g, '«$1»');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.DATA_EGOV_API_KEY;
  const q = req.query || {};
  if (q.op === 'info') { res.status(200).json({ on: !!key }); return; }
  if (!key) { res.status(503).json({ error: 'off' }); return; }
  const bin = String(q.bin || '').replace(/\D/g, '');
  if (!isBin(bin)) { res.status(400).json({ error: 'bin' }); return; }
  const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim(), now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 600000);
  if (list.length >= 40) { res.status(429).json({ error: 'rate' }); return; }
  list.push(now); hits.set(ip, list);

  const source = JSON.stringify({ size: 1, query: { bool: { must: [{ match: { bin } }] } } });
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch((process.env.DATA_EGOV_API_URL || API) + '?apiKey=' + encodeURIComponent(key) + '&source=' + encodeURIComponent(source), { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) { res.status(502).json({ error: 'src', status: r.status }); return; }
    const data = await r.json();
    const row = (Array.isArray(data) ? data : []).filter((x) => x && String(x.bin) === bin)[0];
    if (!row) { res.status(404).json({ error: 'none' }); return; }
    res.status(200).json({
      bin,
      name: { ru: quotes(str(row.nameru)), kk: quotes(str(row.namekz)) },
      addr: { ru: str(row.addressru), kk: str(row.addresskz) },
      status: { ru: str(row.statusru), kk: str(row.statuskz) },
      source: 'data.egov.kz'
    });
  } catch (e) {
    res.status(502).json({ error: 'src' });
  } finally { clearTimeout(timer); }
};
