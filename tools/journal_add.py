"""Добавляет в журнал промптов новую версию: строку сводной таблицы и страницу версии (копия страницы
предыдущей версии с новым текстом и снимком). Остальное содержимое журнала не меняется.
python journal_add.py ЖУРНАЛ ВЫХОД СНИМОК НОМЕР ДАТА КРАТКО ЦЕЛЬ РЕЗУЛЬТАТ ПРОВЕРКА ПРОМПТ [ПРОМПТ ...]"""
import copy, sys
from docx import Document
from docx.shared import Cm
from docx.oxml.ns import qn

SRC, OUT, SHOT, N, DATE, SHORT, GOAL, RESULT, MANUAL = sys.argv[1:10]
PROMPTS = sys.argv[10:]
d = Document(SRC)
W14 = '{http://schemas.microsoft.com/office/word/2010/wordml}'


def clean(e):
    for x in e.iter():
        for k in (W14 + 'paraId', W14 + 'textId'):
            if k in x.attrib:
                del x.attrib[k]
    return e


def setlines(cell, lines):
    p = cell.paragraphs[0]
    rp = next((r._r.rPr for r in p.runs if r._r.rPr is not None), None)
    for r in list(p.runs):
        r._r.getparent().remove(r._r)
    for e in cell.paragraphs[1:]:
        e._p.getparent().remove(e._p)
    for i, line in enumerate(lines):
        q = p if i == 0 else cell.add_paragraph()
        run = q.add_run(line)
        if rp is not None:
            run._r.insert(0, copy.deepcopy(rp))


body = list(d.element.body)
last = d.tables[-1]._tbl
head = body[body.index(last) - 1]
assert ('Версия ' + str(int(N) - 1)) in ''.join(x.text or '' for x in head.iter(qn('w:t')))
h, t = clean(copy.deepcopy(head)), clean(copy.deepcopy(last))
ts = list(h.iter(qn('w:t')))
ts[0].text = 'Версия ' + N
for x in ts[1:]:
    x.text = ''
for dr in t.xpath('.//w:drawing'):
    r = dr.getparent()
    r.getparent().remove(r)
last.addnext(h)
h.addnext(t)
tb = d.tables[-1]
assert tb._tbl is t
r = tb.rows
setlines(r[0].cells[1], [N]); setlines(r[0].cells[3], [DATE])
setlines(r[2].cells[1], [GOAL]); setlines(r[3].cells[1], PROMPTS)
setlines(r[4].cells[1], [RESULT]); setlines(r[5].cells[1], [MANUAL])
setlines(r[6].cells[1], ['docum-kz_v' + N + '.zip'])
setlines(r[7].cells[1], [''])
r[7].cells[1].paragraphs[0].add_run().add_picture(SHOT, width=Cm(6.2))
s = d.tables[2]
prev = s.rows[-1]._tr
assert s.rows[-1].cells[0].text == str(int(N) - 1)
tr = clean(copy.deepcopy(prev))
prev.addnext(tr)
c = s.rows[-1].cells
setlines(c[0], [N]); setlines(c[1], [DATE]); setlines(c[2], [SHORT]); setlines(c[3], ['docum-kz_v' + N + '.zip'])
d.save(OUT)
