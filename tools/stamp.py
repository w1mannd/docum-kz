"""docum.kz: ставит версию (?v=хэш содержимого) у css и js в HTML-страницах.
Файлы с версией браузер кэширует на год (vercel.json), а новая версия меняет адрес.
Запуск после любых правок css/js: python3 tools/stamp.py"""
import glob, hashlib, os, re

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
