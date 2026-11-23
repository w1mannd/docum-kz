"""docum.kz: ставит версию (?v=хэш содержимого) у css и js в HTML-страницах.
Файлы с версией браузер кэширует на год (vercel.json), а новая версия меняет адрес.
Заодно пересчитывает хэши встроенных скриптов в заголовке Content-Security-Policy (vercel.json):
браузер выполнит только те встроенные скрипты, чей хэш там указан.
Запуск после любых правок css/js и встроенных скриптов: python3 tools/stamp.py"""
import base64, glob, hashlib, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAT = re.compile(r'(["\'])((?:css|js)/[\w.-]+\.(?:css|js))(?:\?v=[0-9a-f]+)?\1')


def ver(path):
    with open(os.path.join(ROOT, path), 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()[:8]


for page in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
    with open(page, encoding='utf-8') as f:
        s = f.read()
    new = PAT.sub(lambda m: '%s%s?v=%s%s' % (m.group(1), m.group(2), ver(m.group(2)), m.group(1)), s)
    if new != s:
        with open(page, 'w', encoding='utf-8') as f:
            f.write(new)
        print('обновлено', os.path.basename(page))


# Хэши встроенных <script> всех страниц → script-src в CSP.
INLINE = re.compile(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', re.S)
hashes = set()
for page in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
    with open(page, encoding='utf-8') as f:
        for body in INLINE.findall(f.read()):
            hashes.add("'sha256-%s'" % base64.b64encode(hashlib.sha256(body.encode('utf-8')).digest()).decode())
vpath = os.path.join(ROOT, 'vercel.json')
with open(vpath, encoding='utf-8') as f:
    conf = json.load(f)
for rule in conf.get('headers', []):
    for h in rule['headers']:
        if h['key'] == 'Content-Security-Policy':
            parts = [x.strip() for x in h['value'].split(';')]
            for i, x in enumerate(parts):
                if x.startswith('script-src'):
                    keep = [w for w in x.split()[1:] if not w.startswith("'sha256-") and w != 'HASHES']
                    parts[i] = ' '.join(['script-src'] + keep + sorted(hashes))
            new = '; '.join(parts)
            if new != h['value']:
                h['value'] = new
                with open(vpath, 'w', encoding='utf-8') as f:
                    json.dump(conf, f, ensure_ascii=False, indent=2)
                    f.write('\n')
                print('CSP: хэши встроенных скриптов обновлены')


# Версия кэша сервис-воркера = хэш всех страниц (в них уже стоят версии css/js).
# После каждой выкладки sw.js меняется, браузер ставит новый воркер, он заново кэширует
# все страницы и удаляет старый кэш. Иначе страница, которую давно не открывали,
# могла прийти из кэша со старыми скриптами (например, без названий новых документов).
site = hashlib.md5()
for page in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
    with open(page, 'rb') as f:
        site.update(f.read())
swp = os.path.join(ROOT, 'sw.js')
with open(swp, encoding='utf-8') as f:
    sw = f.read()
sw_new = re.sub(r"const CACHE = 'docum-[\w]+';", "const CACHE = 'docum-%s';" % site.hexdigest()[:8], sw)
if sw_new != sw:
    with open(swp, 'w', encoding='utf-8') as f:
        f.write(sw_new)
    print('sw.js: версия кэша обновлена')
