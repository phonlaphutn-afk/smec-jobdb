/* ==========================================================================
 * Exports — Excel / PDF (print-friendly)
 * ========================================================================== */

const Exports = (() => {
  const { state, fmtDate, fmtMoney, fmtNum, escapeHTML } = App;

  function getCurrentRows(view) {
    return App.sortRows(view, App.filterRows(view, state.data[view]));
  }

  function exportExcel(view, title) {
    const rows = getCurrentRows(view);
    if (!rows.length) { App.toast('ไม่มีข้อมูลให้ส่งออก', 'warning'); return; }
    const def = App.SHEETS[view];
    const cols = def.cols.filter(Boolean);
    const aoa = [cols];
    for (const r of rows) {
      aoa.push(cols.map(c => {
        const v = r[c];
        if (v instanceof Date) return v;
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
          const d = new Date(v);
          if (!isNaN(d.getTime())) return d;
        }
        return v == null ? '' : v;
      }));
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
    ws['!cols'] = cols.map(c => ({ wch: Math.min(40, Math.max(10, (c||'').length + 4)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, def.sheetName);
    const ts = new Date().toISOString().slice(0,10);
    const fname = `${title.replace(/[^\w฀-๿\-]+/g,'_')}_${ts}.xlsx`;
    XLSX.writeFile(wb, fname);
    App.toast(`ส่งออก ${rows.length} รายการแล้ว`, 'success');
  }

  function exportPDF(view, title, columns) {
    const rows = getCurrentRows(view);
    if (!rows.length) { App.toast('ไม่มีข้อมูลให้ส่งออก', 'warning'); return; }

    // Build HTML table for print window (better Thai support than jsPDF)
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) { App.toast('โปรดอนุญาต popup เพื่อพิมพ์ PDF', 'warning'); return; }

    const headers = columns.map(c => `<th>${escapeHTML(c.label)}</th>`).join('');
    const body = rows.map(r => {
      const tds = columns.map(c => {
        let v = r[c.key];
        if (c.type === 'date') v = fmtDate(v);
        else if (c.type === 'datetime') v = App.fmtDateTime(v);
        else if (c.type === 'thaiDate') v = App.fmtThaiDate(v);
        else if (c.type === 'number') v = fmtNum(v, 0);
        else if (c.type === 'money') v = fmtMoney(v);
        else if (c.type === 'file') v = (v||'').toString().split('/').pop();
        else v = (v||'').toString();
        return `<td>${escapeHTML(v)}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('');

    const ts = new Date().toLocaleString('th-TH');
    const html = `<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8" /><title>${escapeHTML(title)}</title>
<style>
  body { font-family: "Sarabun", "Tahoma", "Segoe UI", sans-serif; padding: 16px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 6px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; }
  tr:nth-child(even) td { background: #fafafa; }
  .btns { margin-bottom: 12px; }
  .btn { padding: 6px 12px; background: #2563eb; color:#fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
  @media print { .btns { display: none; } body { padding: 4px; } }
</style></head>
<body>
  <div class="btns"><button class="btn" onclick="window.print()">🖨 พิมพ์ / Save as PDF</button>
    <span style="margin-left:8px;color:#666;">เลือก Destination = "Save as PDF" ในกล่องพิมพ์</span></div>
  <h1>${escapeHTML(title)}</h1>
  <div class="meta">วันที่พิมพ์: ${escapeHTML(ts)} · จำนวน ${rows.length} รายการ · โฟลเดอร์: ${escapeHTML(state.folderName||'')}</div>
  <table>
    <thead><tr>${headers}</tr></thead>
    <tbody>${body}</tbody>
  </table>
</body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return { exportExcel, exportPDF };
})();
