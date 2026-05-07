/* ==========================================================================
 * Print — Render ใบแจ้งงาน / Work Request from job data
 * ========================================================================== */

const Print = (() => {
  const { state, escapeHTML } = App;

  // Departments and Job Types from the form template
  const DEPARTMENTS = [
    'แผนกเครื่องจักร',
    'แผนก CNC',
    'ไวร์คัท',
    'แผนก Manual'
  ];
  const JOB_TYPES = [
    'ซ่อม',
    'สร้าง',
    'ปรับปรุง',
    'สั่งซื้อ',
    'งาน DIE'
  ];

  // ----- Sub-item parser -----
  function parseSubItems(text) {
    if (!text) return [];
    const lines = String(text).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
      if (/^\[ระบบ/.test(line)) continue;
      const stripped = line.replace(/^[-•·*]\s*/, '').trim();
      if (!stripped) continue;
      let m = stripped.match(/^(.+?)\s*\(([^)]*)\)\s*(?:\[(.+?)\])?\s*$/);
      let name = stripped, qty = '', unit = '', status = '';
      if (m) {
        name = m[1].trim();
        const inner = m[2].trim();
        status = (m[3] || '').trim();
        const qm = inner.match(/^([\d.,/]+)\s*(.*)$/);
        if (qm) {
          qty = qm[1].trim();
          unit = (qm[2] || '').trim();
        } else {
          qty = inner;
        }
      }
      out.push({ name, qty, unit, status, note: '' });
    }
    return out;
  }

  function fmtThaiShort(d) {
    if (!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return '';
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${dt.getDate()} ${months[dt.getMonth()]} ${(dt.getFullYear()+543).toString().slice(-2)}`;
  }

  function durationStr(start, end) {
    if (!start || !end) return '';
    const s = start instanceof Date ? start : new Date(start);
    const e = end instanceof Date ? end : new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';
    const ms = e.getTime() - s.getTime();
    if (ms < 0) return '';
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    return `${days} วัน ${hours} ชม.`;
  }

  function getCheckedDepartments(job) {
    const haystack = [
      job['ผู้แจ้ง'] || '',
      job['แผนก'] || '',
      job['ผู้รับผิดชอบ'] || '',
      job['ประเภท'] || '',
      job['หมายเหตุ'] || ''
    ].join(' ').toLowerCase();
    const checked = new Set();
    for (const d of DEPARTMENTS) {
      const key = d.toLowerCase();
      if (haystack.includes(key)) checked.add(d);
    }
    if (/cnc|ซีเอ็นซี/i.test(haystack)) checked.add('แผนก CNC');
    if (/เครื่องจักร|machin/i.test(haystack)) checked.add('แผนกเครื่องจักร');
    if (/ไวร์คัท|ไวคัท|wire.?cut|ไดคัต/i.test(haystack)) checked.add('ไวร์คัท');
    if (/manual|แมนนวล/i.test(haystack)) checked.add('แผนก Manual');
    return checked;
  }

  function getCheckedJobTypes(job) {
    const t = String(job['ประเภท']||'').toLowerCase();
    const checked = new Set();
    if (/ซ่อม|repair/i.test(t)) checked.add('ซ่อม');
    if (/สร้าง|create|build|new/i.test(t)) checked.add('สร้าง');
    if (/ปรับปรุง|improve|modif/i.test(t)) checked.add('ปรับปรุง');
    if (/สั่งซื้อ|purchase|order|buy/i.test(t)) checked.add('สั่งซื้อ');
    if (/die|ดาย/i.test(t)) checked.add('งาน DIE');
    const desc = String(job['รายละเอียด']||'').toLowerCase();
    if (/^die|^งาน die/i.test(desc)) checked.add('งาน DIE');
    return checked;
  }

  // ----- Logo loader -----
  async function loadLogoDataURL() {
    // Lazy-load logo-data.js (206 KB) only when printing
    if (typeof LOGO_DATA_URL === 'undefined') {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'assets/logo-data.js';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    return (typeof LOGO_DATA_URL !== 'undefined' && LOGO_DATA_URL) ? LOGO_DATA_URL : '';
  }

  // ----- Main: open print window -----
  async function printWorkRequest(idx) {
    const job = state.data.jobs[idx];
    if (!job) { App.toast('ไม่พบใบงาน', 'error'); return; }
    const w = window.open('', '_blank', 'width=900,height=1100,scrollbars=1');
    if (!w) { App.toast('โปรดอนุญาต popup เพื่อพิมพ์', 'warning'); return; }

    const items = parseSubItems(job['รายการย่อย']);
    const deptChecked = getCheckedDepartments(job);
    const typeChecked = getCheckedJobTypes(job);
    const logoDataUrl = await loadLogoDataURL();
    const html = buildHTML(job, items, deptChecked, typeChecked, logoDataUrl);

    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function buildHTML(job, items, deptChecked, typeChecked, logoDataUrl) {
    const docNo = escapeHTML(job['เลขที่'] || '—');
    const dateLabel = fmtThaiShort(job['วันที่']);
    const requester = escapeHTML(job['ผู้แจ้ง'] || '');
    const company = escapeHTML(job['บริษัท'] || '');
    const po = escapeHTML(job['PO'] || '');
    const qty = (job['จำนวน'] != null && job['จำนวน'] !== '')
      ? Number(job['จำนวน']).toLocaleString() : '';
    const description = escapeHTML(job['รายละเอียด'] || '');
    const operationReport = escapeHTML(job['รายละเอียดการดำเนินการ'] || '');
    const note = escapeHTML(job['หมายเหตุ'] || '');
    const startDate = job['วันที่เริ่ม'];
    const endDate = job['วันที่เสร็จ'];
    const duration = job['ระยะเวลา'] || durationStr(startDate, endDate);
    const operator = escapeHTML(job['ผู้ดำเนินการ'] || '');

    const deptRef = job['ผู้แจ้ง'] && !DEPARTMENTS.some(d => d.toLowerCase() === String(job['ผู้แจ้ง']).toLowerCase())
      ? `* (อ้างอิง: ${escapeHTML(job['ผู้แจ้ง'])})` : '';

    const minRows = 3;
    const renderItems = items.length > 0 ? items : [];
    const padding = Math.max(0, minRows - renderItems.length);
    const itemRows = renderItems.map((it, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${escapeHTML(it.name)}</td>
        <td>${escapeHTML(it.qty)}</td>
        <td>${escapeHTML(it.unit)}</td>
        <td>${escapeHTML(it.status)}</td>
        <td>${escapeHTML(it.note||'')}</td>
      </tr>
    `).join('') + Array(padding).fill(0).map(() => `
      <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>
    `).join('');

    const cb = (text, on) => `<span class="cb ${on?'on':''}">${escapeHTML(text)}</span>`;

    return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8" />
<title>ใบแจ้งงาน ${docNo}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Sarabun', 'TH Sarabun New', 'Tahoma', sans-serif;
    color: #000;
    font-size: 11pt;
    margin: 0;
    padding: 16px;
    background: #f0f0f0;
  }
  .controls {
    text-align: center;
    margin-bottom: 12px;
  }
  .controls button {
    padding: 8px 20px;
    background: #2563eb;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    margin: 0 4px;
  }
  .controls .hint { color: #555; font-size: 12px; margin-left: 6px; }
  .wr {
    width: 800px;
    max-width: 100%;
    margin: 0 auto;
    background: #fff;
    border: 1.5px solid #000;
    page-break-after: always;
  }
  .wr table { width: 100%; border-collapse: collapse; }
  .wr td, .wr th { border: 1px solid #000; padding: 5px 8px; vertical-align: top; }
  .header td { padding: 8px 10px; }
  .logo { width: 130px; text-align: center; padding: 4px !important; }
  .logo img { max-width: 120px; max-height: 70px; object-fit: contain; }
  .logo .badge {
    background: linear-gradient(180deg, #d62828, #a71f1f);
    color: #fff;
    padding: 12px 6px;
    border-radius: 4px;
    line-height: 1.1;
    font-size: 10pt;
    letter-spacing: .5px;
  }
  .logo .badge .small { font-size: 7pt; opacity: .9; display: block; margin-top: 4px; font-weight: 400; }
  .title-cell { text-align: center; }
  .title-cell h1 { margin: 0; font-size: 16pt; font-weight: 700; }
  .title-cell .sub { font-size: 10pt; }
  .meta-cell { width: 180px; font-size: 10pt; }
  .meta-cell .docno { font-weight: 700; font-size: 12pt; margin-top: 4px; }
  .label {
    font-weight: 600;
    background: #f5f5f5;
    width: 130px;
  }
  /* Department / job-type cells — 2-column grid for checkbox alignment */
  .checks-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 24px;
    align-items: center;
    margin-top: 4px;
  }
  .cb { display: inline-flex; align-items: center; line-height: 1.8; white-space: nowrap; }
  .cb::before { content: '☐'; margin-right: 6px; font-size: 13pt; display: inline-block; width: 16px; }
  .cb.on::before { content: '☑'; font-weight: 700; }
  .ref-line { color: #444; font-size: 9.5pt; margin-top: 6px; }
  /* Section */
  .section td { padding: 8px 10px; }
  .section .head { font-weight: 600; padding-bottom: 4px; }
  .desc-content { white-space: pre-wrap; min-height: 36px; }
  /* Items table — narrow ลำดับ, wider รายการ */
  .items th { background: #f5f5f5; font-weight: 600; text-align: center; }
  .items th:nth-child(1), .items td:nth-child(1) { width: 38px; text-align: center; }
  .items th:nth-child(2), .items td:nth-child(2) { width: auto; }
  .items th:nth-child(3), .items td:nth-child(3) { width: 70px; text-align: right; }
  .items th:nth-child(4), .items td:nth-child(4) { width: 56px; text-align: center; }
  .items th:nth-child(5), .items td:nth-child(5) { width: 100px; text-align: center; }
  .items th:nth-child(6), .items td:nth-child(6) { width: 120px; }
  /* Operation report — with writing lines */
  .op-content { white-space: pre-wrap; padding-bottom: 4px; }
  .op-lines { margin-top: 6px; margin-bottom: 6px; }
  .op-line { border-bottom: 1px dotted #555; height: 22px; margin-bottom: 2px; }
  .date-line {
    display: flex; justify-content: space-between; align-items: baseline;
    margin: 8px 0 4px;
    font-size: 11pt;
  }
  .sign-row td {
    text-align: center;
    vertical-align: bottom;
    padding-top: 40px !important;
    padding-bottom: 6px !important;
    border-top: 1px solid #000;
  }
  .sign-name { font-weight: 600; }
  .sign-date { font-size: 10pt; margin-top: 2px; }
  .note-content {
    white-space: pre-wrap;
    min-height: 200px;
    padding: 6px 0;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .controls { display: none; }
    .wr { border: 1.5px solid #000; box-shadow: none; }
    @page { size: A4; margin: 12mm 10mm; }
  }
</style>
</head>
<body>
<div class="controls">
  <button onclick="window.print()">🖨 พิมพ์ / Save as PDF</button>
  <button onclick="window.close()">ปิด</button>
  <span class="hint">เลือก "Save as PDF" ในกล่องพิมพ์ของเบราว์เซอร์</span>
</div>

<div class="wr">
  <!-- Header -->
  <table class="header">
    <tr>
      <td class="logo">
        ${logoDataUrl
          ? `<img src="${logoDataUrl}" alt="SIAMMAC" />`
          : `<div class="badge">SIAMMAC<span class="small">SIAMMAC ENGINEERING<br>&amp; CONSTRUCTION CO.,LTD.</span></div>`}
      </td>
      <td class="title-cell">
        <h1>ใบแจ้งงาน / WORK REQUEST</h1>
        <div class="sub">บริษัท สยามแมค เอ็นจิเนียริ่ง แอนด์ คอนสตรัคชั่น จำกัด</div>
      </td>
      <td class="meta-cell">
        <div>วันที่: ${escapeHTML(dateLabel)}</div>
        <div class="docno">${docNo}</div>
      </td>
    </tr>
  </table>

  <!-- Requester / Company -->
  <table>
    <tr>
      <td class="label">ผู้แจ้ง (Requester)</td>
      <td>${requester}</td>
      <td class="label">บริษัท (Company)</td>
      <td>${company}</td>
    </tr>
    <tr>
      <td class="label">เลขที่ PO</td>
      <td>${po}</td>
      <td class="label">จำนวน</td>
      <td>${escapeHTML(qty)}</td>
    </tr>
  </table>

  <!-- Department / Job Type -->
  <table>
    <tr>
      <td style="width:50%">
        <div style="font-weight:600;margin-bottom:4px;">แผนก (Department):</div>
        <div class="checks-grid">
          ${cb('แผนกเครื่องจักร', deptChecked.has('แผนกเครื่องจักร'))}
          ${cb('แผนก CNC', deptChecked.has('แผนก CNC'))}
          ${cb('ไวร์คัท', deptChecked.has('ไวร์คัท'))}
          ${cb('แผนก Manual', deptChecked.has('แผนก Manual'))}
        </div>
        ${deptRef ? `<div class="ref-line">${deptRef}</div>` : ''}
      </td>
      <td>
        <div style="font-weight:600;margin-bottom:4px;">ประเภทงาน (Job Type):</div>
        <div class="checks-grid">
          ${cb('ซ่อม', typeChecked.has('ซ่อม'))}
          ${cb('สร้าง', typeChecked.has('สร้าง'))}
          ${cb('ปรับปรุง', typeChecked.has('ปรับปรุง'))}
          ${cb('สั่งซื้อ', typeChecked.has('สั่งซื้อ'))}
          ${cb('งาน DIE', typeChecked.has('งาน DIE'))}
          <span></span>
        </div>
      </td>
    </tr>
  </table>

  <!-- Description -->
  <table>
    <tr>
      <td class="section">
        <div class="head">รายละเอียดงาน (Description):</div>
        <div class="desc-content">${description}</div>
      </td>
    </tr>
  </table>

  <!-- Sub-items -->
  <table>
    <tr>
      <td class="section">
        <div class="head">รายการสั่งซื้อ/เบิกของ / รายการย่อย (Material / Sub-Items)</div>
      </td>
    </tr>
  </table>
  <table class="items">
    <thead>
      <tr>
        <th>ลำดับ</th>
        <th>รายการ</th>
        <th>จำนวน</th>
        <th>หน่วย</th>
        <th>สถานะ</th>
        <th>หมายเหตุ</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Operation Report -->
  <table>
    <tr>
      <td class="section">
        <div class="head">รายงานการปฏิบัติงาน (Operation Report):</div>
        ${operationReport ? `<div class="op-content">${operationReport}</div>` : ''}
        <div class="op-lines">
          <div class="op-line"></div>
          <div class="op-line"></div>
          <div class="op-line"></div>
          <div class="op-line"></div>
        </div>
        <div class="date-line">
          <span>วันที่เริ่ม: <u style="display:inline-block;min-width:140px;">${escapeHTML(fmtThaiShort(startDate))}</u></span>
          <span>วันที่เสร็จ: <u style="display:inline-block;min-width:140px;">${escapeHTML(fmtThaiShort(endDate))}</u></span>
          <b>รวมเวลา: ${escapeHTML(duration||'……….')} ${escapeHTML(duration ? '' : 'วัน ……….. ชม.')}</b>
        </div>
        <table style="margin-top:4px;">
          <tr class="sign-row">
            <td>
              <div class="sign-name">ผู้ปฏิบัติงาน</div>
              ${operator ? `<div class="sign-date">${operator}</div>` : ''}
              <div class="sign-date">วันที่ ......./......./.......</div>
            </td>
            <td>
              <div class="sign-name">ผู้ตรวจสอบ</div>
              <div class="sign-date">วันที่ ......./......./.......</div>
            </td>
            <td>
              <div class="sign-name">ผู้รับงาน</div>
              <div class="sign-date">วันที่ ......./......./.......</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Note -->
  <table>
    <tr>
      <td class="section">
        <div class="head">Note:</div>
        <div class="note-content">${note}</div>
      </td>
    </tr>
  </table>
</div>

</body>
</html>`;
  }

  return { printWorkRequest, parseSubItems, DEPARTMENTS, JOB_TYPES };
})();
