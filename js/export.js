/* docum.kz — предпросмотр и выгрузка .docx и .pdf.
   Файлы создаются в браузере. Библиотеки и шрифты лежат в проекте и подгружаются при первом скачивании. */
(function (root) {
  'use strict';

  var FONT_DOCX = 'Times New Roman';
  var loaded = {};

  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    loaded[src] = new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = src; s.onload = ok;
      s.onerror = function () { delete loaded[src]; fail(new Error('script')); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }

  function saveBlob(blob, name) {
    var a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------- Предпросмотр ---------- */
  function toHTML(blocks) {
    return blocks.map(function (b) {
      switch (b.k) {
        case 'title': return '<p class="d-title">' + esc(b.text) + '</p>';
        case 'center': return '<p class="d-center' + (b.bold ? ' d-bold' : '') + '">' + esc(b.text) + '</p>';
        case 'row': return '<p class="d-row"><span>' + esc(b.left) + '</span><span>' + esc(b.right) + '</span></p>';
        case 'h': return '<p class="d-h">' + esc(b.text) + '</p>';
        case 'small': return '<p class="d-small' + (b.right ? ' d-right' : '') + '">' + esc(b.text) + '</p>';
        case 'order': return '<p class="d-order">' + esc(b.text || 'ПРИКАЗЫВАЮ:') + '</p>';
        case 'gap': return '<p class="d-gap"></p>';
        case 'p':
          return '<p class="d-p' + (b.bold ? ' d-bold' : '') + (b.right ? ' d-right' : '') + (b.center ? ' d-center' : '') + '">' + esc(b.text) + '</p>';
        case 'cols':
          var col = function (lines, head) {
            return '<div>' + lines.map(function (l, i) {
              return '<p class="' + (head && i === 0 ? 'd-bold' : '') + '">' + (l ? esc(l) : '&nbsp;') + '</p>';
            }).join('') + '</div>';
          };
          // Подписи идут отдельным рядом, поэтому стоят на одном уровне при любой длине реквизитов.
          return '<div class="d-cols">' + col(b.left, true) + col(b.right, true) + '</div>' +
            '<div class="d-cols d-cols-sign">' + col(b.signLeft) + col(b.signRight) + '</div>';
        case 'stamp':
          // Штамп ЭЦП: визуальная отметка о подписи. Сама подпись — в файле .cms.
          return '<div class="d-stamp"><p class="d-stamp-h">' + esc(b.head) + '</p><dl>' + b.rows.map(function (r) {
            return '<dt>' + esc(r[0]) + '</dt><dd' + (r[2] ? ' class="d-mono"' : '') + '>' + esc(r[1]) + '</dd>';
          }).join('') + '</dl><p class="d-stamp-f">' + esc(b.foot) + '</p></div>';
        case 'table':
          var head = b.headTop
            ? '<tr>' + b.headTop.map(function (h) {
                return '<th' + (h.r ? ' rowspan="' + h.r + '"' : '') + (h.c ? ' colspan="' + h.c + '"' : '') + '>' + esc(h.t) + '</th>';
              }).join('') + '</tr><tr>' + b.headSub.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr>'
            : '<tr>' + b.head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr>';
          if (b.numbers) head += '<tr>' + b.numbers.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr>';
          var body = b.rows.map(function (r) {
            return '<tr>' + r.map(function (c, i) {
              return '<td class="a-' + b.align[i] + '">' + esc(c) + '</td>';
            }).join('') + '</tr>';
          }).join('');
          return '<div class="d-tablewrap"><table class="d-table' + (b.small ? ' d-table-s' : '') + '"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
      }
      return '';
    }).join('');
  }

  /* ---------- .docx ---------- */
  function toDocx(blocks) {
    var D = root.docx;
    var run = function (text, o) {
      return new D.TextRun(Object.assign({ text: String(text), font: FONT_DOCX, size: 24 }, o || {}));
    };
    var para = function (text, o, r) {
      return new D.Paragraph(Object.assign({ children: [run(text, r)], spacing: { after: 100 } }, o || {}));
    };
    var none = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    var noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
    var PAGE_W = 9638; // ширина текста A4 при полях 20 мм, в DXA
    var out = [];

    blocks.forEach(function (b) {
      switch (b.k) {
        case 'title': out.push(para(b.text, { alignment: D.AlignmentType.CENTER, spacing: { before: 120, after: 160 } }, { bold: true, size: 26 })); break;
        case 'center': out.push(para(b.text, { alignment: D.AlignmentType.CENTER }, { bold: b.bold })); break;
        case 'h': out.push(para(b.text, { alignment: D.AlignmentType.CENTER, spacing: { before: 200, after: 100 }, keepNext: true }, { bold: true })); break;
        case 'small': out.push(para(b.text, { alignment: b.right ? D.AlignmentType.RIGHT : D.AlignmentType.LEFT, spacing: { after: 40 } }, { size: 18 })); break;
        case 'order': out.push(para(b.text || 'ПРИКАЗЫВАЮ:', { spacing: { before: 120, after: 120 } }, { bold: true })); break;
        case 'gap': out.push(para('', { spacing: { after: 60 } })); break;
        case 'p':
          out.push(para(b.text, {
            alignment: b.right ? D.AlignmentType.RIGHT : b.center ? D.AlignmentType.CENTER : D.AlignmentType.JUSTIFIED
          }, { bold: b.bold }));
          break;
        case 'row':
          var half = function (text, right) {
            return new D.TableCell({
              width: { size: PAGE_W / 2, type: D.WidthType.DXA },
              borders: { top: none, bottom: none, left: none, right: none },
              children: [para(text, { spacing: { after: 60 }, alignment: right ? D.AlignmentType.RIGHT : D.AlignmentType.LEFT })]
            });
          };
          out.push(new D.Table({
            width: { size: PAGE_W, type: D.WidthType.DXA },
            columnWidths: [PAGE_W / 2, PAGE_W / 2],
            layout: D.TableLayoutType.FIXED,
            borders: noBorders,
            rows: [new D.TableRow({ children: [half(b.left, false), half(b.right, true)] })]
          }));
          break;
        case 'cols':
          var cell = function (lines, head, top) {
            return new D.TableCell({
              width: { size: PAGE_W / 2, type: D.WidthType.DXA },
              borders: { top: none, bottom: none, left: none, right: none },
              margins: { top: top || 0 },
              children: lines.map(function (l, i) {
                return para(l, { spacing: { after: 40 }, keepNext: !!head }, { bold: head && i === 0, size: 22 });
              })
            });
          };
          out.push(new D.Table({
            width: { size: PAGE_W, type: D.WidthType.DXA },
            columnWidths: [PAGE_W / 2, PAGE_W / 2],
            layout: D.TableLayoutType.FIXED,
            borders: noBorders,
            rows: [
              new D.TableRow({ cantSplit: true, children: [cell(b.left, true), cell(b.right, true)] }),
              new D.TableRow({ cantSplit: true, children: [cell(b.signLeft, false, 240), cell(b.signRight, false, 240)] })
            ]
          }));
          break;
        case 'stamp':
          var blue = { style: D.BorderStyle.SINGLE, size: 12, color: '1F4FD8' };
          var lab = Math.round(PAGE_W * 0.34);
          var srow = function (r) {
            return new D.TableRow({ cantSplit: true, children: [
              new D.TableCell({ width: { size: lab, type: D.WidthType.DXA }, borders: noBorders, margins: { left: 160, right: 60 },
                children: [para(r[0], { spacing: { after: 30 } }, { size: 18, color: '5A6478' })] }),
              new D.TableCell({ width: { size: PAGE_W - lab, type: D.WidthType.DXA }, borders: noBorders, margins: { left: 60, right: 160 },
                children: [para(r[1], { spacing: { after: 30 } }, { size: r[2] ? 15 : 19, bold: !r[2], font: r[2] ? 'Courier New' : FONT_DOCX })] })
            ] });
          };
          var inner = new D.Table({ width: { size: PAGE_W - 120, type: D.WidthType.DXA }, columnWidths: [lab, PAGE_W - 120 - lab], borders: noBorders, rows: b.rows.map(srow) });
          out.push(para('', { spacing: { before: 200, after: 0 } }));
          out.push(new D.Table({
            width: { size: PAGE_W, type: D.WidthType.DXA }, columnWidths: [PAGE_W],
            borders: { top: blue, bottom: blue, left: blue, right: blue, insideHorizontal: none, insideVertical: none },
            rows: [new D.TableRow({ cantSplit: true, children: [new D.TableCell({
              width: { size: PAGE_W, type: D.WidthType.DXA }, margins: { top: 120, bottom: 120, left: 60, right: 60 },
              children: [
                para(b.head, { alignment: D.AlignmentType.CENTER, spacing: { after: 100 }, keepNext: true }, { bold: true, size: 20, color: '1F4FD8' }),
                inner,
                para(b.foot, { alignment: D.AlignmentType.CENTER, spacing: { before: 80, after: 0 } }, { size: 16, color: '5A6478' })
              ]
            })] })]
          }));
          break;
        case 'table':
          var widths = b.widths.map(function (w) { return Math.round(PAGE_W * w / 100); });
          var size = b.small ? 17 : 21;
          var mk = function (row, bold) {
            return new D.TableRow({
              tableHeader: !!bold, cantSplit: true,
              children: row.map(function (c, i) {
                var al = bold ? 'c' : b.align[i];
                return new D.TableCell({
                  width: { size: widths[i], type: D.WidthType.DXA },
                  margins: { top: 40, bottom: 40, left: 60, right: 60 },
                  children: [para(c, {
                    spacing: { after: 0 },
                    alignment: al === 'c' ? D.AlignmentType.CENTER : al === 'r' ? D.AlignmentType.RIGHT : D.AlignmentType.LEFT
                  }, { bold: bold, size: bold && b.small ? 15 : size })]
                });
              })
            });
          };
          var rows;
          if (b.headTop) {
            var hc = function (text, width, extra) {
              return new D.TableCell(Object.assign({
                width: { size: width, type: D.WidthType.DXA },
                margins: { top: 40, bottom: 40, left: 40, right: 40 },
                children: [para(text, { spacing: { after: 0 }, alignment: D.AlignmentType.CENTER }, { bold: true, size: 15 })]
              }, extra));
            };
            var pos = 0;
            var top = b.headTop.map(function (h) {
              var span = h.c || 1, w = widths.slice(pos, pos + span).reduce(function (a, x) { return a + x; }, 0);
              pos += span;
              return hc(h.t, w, h.c ? { columnSpan: h.c } : { rowSpan: h.r });
            });
            var offset = b.headTop.length - 1;
            rows = [
              new D.TableRow({ tableHeader: true, cantSplit: true, children: top }),
              new D.TableRow({ tableHeader: true, cantSplit: true, children: b.headSub.map(function (t2, i) { return hc(t2, widths[offset + i], {}); }) })
            ];
          } else rows = [mk(b.head, true)];
          if (b.numbers) rows.push(mk(b.numbers, true));
          b.rows.forEach(function (r) { rows.push(mk(r, false)); });
          out.push(new D.Table({ width: { size: PAGE_W, type: D.WidthType.DXA }, columnWidths: widths, layout: D.TableLayoutType.FIXED, rows: rows }));
          break;
      }
    });

    return new D.Document({
      creator: 'docum.kz', title: 'Документ',
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children: out
      }]
    });
  }

  /* ---------- .pdf ---------- */
  function toPdf(blocks, at) {
    var content = [];
    blocks.forEach(function (b) {
      switch (b.k) {
        case 'title': content.push({ text: b.text, bold: true, fontSize: 13, alignment: 'center', margin: [0, 6, 0, 8] }); break;
        case 'center': content.push({ text: b.text, bold: b.bold, alignment: 'center', margin: [0, 0, 0, 5] }); break;
        case 'h': content.push({ text: b.text, bold: true, alignment: 'center', margin: [0, 10, 0, 5] }); break;
        case 'small': content.push({ text: b.text, fontSize: 9, alignment: b.right ? 'right' : 'left', margin: [0, 0, 0, 2] }); break;
        case 'order': content.push({ text: b.text || 'ПРИКАЗЫВАЮ:', bold: true, margin: [0, 6, 0, 6] }); break;
        case 'gap': content.push({ text: ' ', fontSize: 6 }); break;
        case 'p':
          content.push({ text: b.text, bold: b.bold, alignment: b.right ? 'right' : b.center ? 'center' : 'justify', margin: [0, 0, 0, 5] });
          break;
        case 'row':
          content.push({ columns: [{ text: b.left }, { text: b.right, alignment: 'right' }], margin: [0, 0, 0, 5] });
          break;
        case 'cols':
          var col = function (lines, head) {
            return { width: '*', stack: lines.map(function (l, i) { return { text: l || ' ', bold: head && i === 0, fontSize: 11, margin: [0, 0, 0, 2] }; }) };
          };
          content.push({
            unbreakable: true,
            stack: [
              { columns: [col(b.left, true), col(b.right, true)], columnGap: 16 },
              { columns: [col(b.signLeft), col(b.signRight)], columnGap: 16, margin: [0, 12, 0, 0] }
            ]
          });
          break;
        case 'stamp':
          content.push({
            unbreakable: true, margin: [0, 12, 0, 4],
            table: { widths: ['*'], body: [[{ stack: [
              { text: b.head, bold: true, fontSize: 10, color: '#1F4FD8', alignment: 'center', margin: [0, 0, 0, 6] },
              { table: { widths: [150, '*'], body: b.rows.map(function (r) {
                return [{ text: r[0], fontSize: 8.5, color: '#5A6478' }, { text: r[1], fontSize: r[2] ? 7.5 : 9.5, bold: !r[2] }];
              }) }, layout: { hLineWidth: function () { return 0; }, vLineWidth: function () { return 0; }, paddingLeft: function () { return 2; }, paddingRight: function () { return 2; }, paddingTop: function () { return 1.5; }, paddingBottom: function () { return 1.5; } } },
              { text: b.foot, fontSize: 7.5, color: '#5A6478', alignment: 'center', margin: [0, 6, 0, 0] }
            ] }]] },
            layout: { hLineWidth: function () { return 1.2; }, vLineWidth: function () { return 1.2; }, hLineColor: function () { return '#1F4FD8'; }, vLineColor: function () { return '#1F4FD8'; },
              paddingLeft: function () { return 10; }, paddingRight: function () { return 10; }, paddingTop: function () { return 8; }, paddingBottom: function () { return 8; } }
          });
          break;
        case 'table':
          var fs = b.small ? 8.5 : 10.5;
          var cell = function (c, i, bold) {
            var al = bold ? 'c' : b.align[i];
            return { text: c, bold: bold, fontSize: bold && b.small ? 7.5 : fs, alignment: al === 'c' ? 'center' : al === 'r' ? 'right' : 'left' };
          };
          var body;
          if (b.headTop) {
            var r1 = [], r2 = [];
            b.headTop.forEach(function (h) {
              var c0 = cell(h.t, 0, true);
              if (h.r) { c0.rowSpan = h.r; r1.push(c0); r2.push({}); }
              else { c0.colSpan = h.c; r1.push(c0); for (var k = 1; k < h.c; k++) r1.push({}); }
            });
            b.headSub.forEach(function (t2) { r2.push(cell(t2, 0, true)); });
            body = [r1, r2];
          } else body = [b.head.map(function (c, i) { return cell(c, i, true); })];
          if (b.numbers) body.push(b.numbers.map(function (c, i) { return cell(c, i, true); }));
          b.rows.forEach(function (r) { body.push(r.map(function (c, i) { return cell(c, i, false); })); });
          content.push({
            table: { headerRows: (b.headTop ? 2 : 1) + (b.numbers ? 1 : 0), widths: b.widths.map(function (w) { return w + '%'; }), body: body },
            layout: { paddingLeft: function () { return 3; }, paddingRight: function () { return 3; }, paddingTop: function () { return 2; }, paddingBottom: function () { return 2; } }
          });
          break;
      }
    });
    return {
      pageSize: 'A4', pageMargins: [56.7, 56.7, 56.7, 56.7],
      defaultStyle: { font: 'Tinos', fontSize: 12 },
      // Для подписи ЭЦП дата файла фиксируется датой версии: тогда у обеих сторон получается один и тот же PDF байт в байт.
      info: at ? { title: 'Документ', creator: 'docum.kz', producer: 'docum.kz', creationDate: new Date(at), modDate: new Date(at) } : { title: 'Документ', creator: 'docum.kz' },
      content: content
    };
  }

  // Шрифты подключаются обычным скриптом: так PDF работает и на сайте, и при открытии файла с диска.
  var pdfReady = null;
  function preparePdf() {
    if (pdfReady) return pdfReady;
    pdfReady = loadScript('vendor/pdfmake.min.js').then(function () {
      return loadScript('vendor/pdf-fonts.js');
    }).then(function () {
      var f = root.DocumPdfFonts;
      root.pdfMake.vfs = { 'Tinos-Regular.ttf': f.regular, 'Tinos-Bold.ttf': f.bold };
      root.pdfMake.fonts = { Tinos: { normal: 'Tinos-Regular.ttf', bold: 'Tinos-Bold.ttf', italics: 'Tinos-Regular.ttf', bolditalics: 'Tinos-Bold.ttf' } };
    }).catch(function (e) { pdfReady = null; throw e; });
    return pdfReady;
  }

  function downloadDocx(blocks, name) {
    return loadScript('vendor/docx.iife.js').then(function () {
      root.docx = root.docx || (typeof docx !== 'undefined' ? docx : undefined);
      return root.docx.Packer.toBlob(toDocx(blocks));
    }).then(function (blob) { saveBlob(blob, name + '.docx'); });
  }

  function downloadPdf(blocks, name) {
    return preparePdf().then(function () {
      return new Promise(function (ok) {
        root.pdfMake.createPdf(toPdf(blocks)).getBlob(function (blob) { saveBlob(blob, name + '.pdf'); ok(); });
      });
    });
  }

  // Сравнение версий в .docx с настоящими исправлениями Word: их можно принять или отклонить в Word.
  function downloadRedline(list, name, meta) {
    return loadScript('vendor/docx.iife.js').then(function () {
      var D = root.docx = root.docx || (typeof docx !== 'undefined' ? docx : undefined);
      var id = 1, date = new Date().toISOString().replace(/\.\d+Z$/, 'Z'), author = (meta && meta.author) || 'docum.kz';
      var run = function (o) {
        var opts = { text: o.s.replace(/\t/g, '    '), font: FONT_DOCX, size: 22 };
        if (o.t === 'ins') return new D.InsertedTextRun(Object.assign({ id: id++, author: author, date: date }, opts));
        if (o.t === 'del') return new D.DeletedTextRun(Object.assign({ id: id++, author: author, date: date }, opts));
        return new D.TextRun(opts);
      };
      var children = [];
      if (meta && meta.title) children.push(new D.Paragraph({ spacing: { after: 200 }, children: [new D.TextRun({ text: meta.title, bold: true, font: FONT_DOCX, size: 24 })] }));
      list.forEach(function (p) {
        var ops = p.type === 'chg' ? p.ops : p.type === 'ins' ? [{ t: 'ins', s: p.b }] : p.type === 'del' ? [{ t: 'del', s: p.a }] : [{ t: 'eq', s: p.a }];
        children.push(new D.Paragraph({ spacing: { after: 80 }, children: ops.map(run) }));
      });
      var doc = new D.Document({ creator: 'docum.kz', features: { trackRevisions: true }, sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1701, right: 850 } } }, children: children }] });
      return D.Packer.toBlob(doc);
    }).then(function (blob) { saveBlob(blob, name + '.docx'); });
  }

  // Байты PDF версии для подписи ЭЦП (одинаковые при каждой сборке).
  function pdfBytes(blocks, at) {
    return preparePdf().then(function () {
      return new Promise(function (ok) {
        root.pdfMake.createPdf(toPdf(blocks, at)).getBuffer(function (buf) { ok(new Uint8Array(buf)); });
      });
    });
  }

  root.DocumExport = { toHTML: toHTML, downloadDocx: downloadDocx, downloadPdf: downloadPdf, downloadRedline: downloadRedline, pdfBytes: pdfBytes, saveBlob: saveBlob };
})(window);
