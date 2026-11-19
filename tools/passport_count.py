"""Меняет в паспорте проекта число записей журнала: python passport_count.py ПАСПОРТ ВЫХОД БЫЛО СТАЛО"""
import sys
from docx import Document
SRC, OUT, OLD, NEW = sys.argv[1:5]
d = Document(SRC)
p = d.tables[6].rows[0].cells[1].paragraphs[0]
assert p.text == OLD, p.text
p.runs[0].text = NEW
for r in p.runs[1:]:
    r._r.getparent().remove(r._r)
d.save(OUT)
