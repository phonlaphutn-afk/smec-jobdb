/* ==========================================================================
 * SMEC Job Database — ONLINE (Google Sheets + Drive) — Core App
 * ========================================================================== */

const App = (() => {
  // -------------------- Global state --------------------
  const state = {
    signedIn: false,
    userEmail: null,
    folderName: '',
    folderHandle: true, // legacy flag for views.js compat (truthy = ready)
    workbook: null,
    data: { jobs: [], delivery: [], gatepass: [], schedule: [], costs: [] },
    attachFolderIds: {},
    currentView: 'dashboard',
    filters: { jobs: {}, delivery: {}, gatepass: {}, schedule: {}, costs: {} },
    sort: { jobs: {}, delivery: {}, gatepass: {}, schedule: {}, costs: {} },
    page: { jobs: 1, delivery: 1, gatepass: 1, schedule: 1, costs: 1 },
    pageSize: 50
  };
  // mark folderHandle as null until signed in (so welcome screen shows)
  state.folderHandle = null;

  // -------------------- Sheet schemas --------------------
  const SHEETS = {
    jobs: { sheetName: CONFIG.SHEETS.jobs, cols: ['วันที่','เลขที่','เลขที่โครงการ','ชื่อโครงการ','PO','บริษัท','ผู้แจ้ง','ประเภท','รายละเอียด','รายการย่อย','สถานะ','วันที่สถานะ','ผู้รับผิดชอบ','จำนวน','จำนวนที่ส่ง','จำนวนค้างส่ง','เลขที่ใบส่งของ','เอกสาร','เอกสารแนบใบส่งของชั่วคราว','วันที่เริ่ม','วันที่เสร็จ','ระยะเวลา','รายละเอียดการดำเนินการ','ผู้ดำเนินการ','ผู้บันทึก','วันที่ลงบันทึก','รูปปิดงาน','','หมายเหตุ','ส่งงาน','docNo','Schedule','แผนงาน'] },
    delivery: { sheetName: CONFIG.SHEETS.delivery, cols: ['Timestamp','วันที่','เลขที่ใบส่งของ','ประเภท','บริษัท','ผู้จัดทำ/ผู้แจ้ง','แผนก','รายละเอียด/อ้างอิง','PO','รายการสินค้า','ไฟล์เอกสาร'] },
    gatepass: { sheetName: CONFIG.SHEETS.gatepass, cols: ['Timestamp','เลขที่','วันที่','บริษัท','ผู้ขออนุญาต','ตำแหน่ง','แผนก','เหตุผล','รายการ','ยานพาหนะ','สี','เอกสารอ้างอิง','แผนงาน'] },
    schedule: { sheetName: CONFIG.SHEETS.schedule, cols: ['Task_ID','DocNo','TaskName','Assignee','StartDate','EndDate','Status','LastUpdated','ActualStartDate','ActualEndDate'] },
    costs: { sheetName: CONFIG.SHEETS.costs, cols: ['Code','วันที่','เลขที่งาน','เลขที่โครงการ','ประเภท','ผู้ขาย / Sup','รายละเอียด','จำนวน','ราคา / หน่วย','จำนวนเงินรวม','VAT','จำนวนเงินรวม Vat','ผู้บันทึก','หมายเหตุ','วันที่ บันทึก','สถานะจ่าย','ใบเสร็จ'] }
  };

  const FILE_FIELDS = {
    jobs: ['เอกสาร', 'เอกสารแนบใบส่งของชั่วคราว', 'รูปปิดงาน'],
    delivery: ['ไฟล์เอกสาร'],
    gatepass: ['เอกสารอ้างอิง'],
    schedule: [], costs: []
  };

  const ATTACH_DIR = CONFIG.ATTACH_DIRS;

  // -------------------- Date helpers --------------------
  function excelToDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return v;
    if (typeof v === 'number') {
      const utc = Math.round((v - 25569) * 86400 * 1000);
      const d = new Date(utc);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof v === 'string') {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }
  function fmtDate(d) {
    if (!d) return '';
    const dt = d instanceof Date ? d : excelToDate(d);
    if (!dt) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth()+1).padStart(2,'0');
    const day = String(dt.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function fmtDateTime(d) {
    if (!d) return '';
    const dt = d instanceof Date ? d : excelToDate(d);
    if (!dt) return '';
    return `${fmtDate(dt)} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
  }
  function fmtThaiDate(d) {
    if (!d) return '';
    const dt = d instanceof Date ? d : excelToDate(d);
    if (!dt) return '';
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()+543}`;
  }
  function parseDateInput(s) { if (!s) return null; const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
  function fmtNum(n, decimals = 2) {
    if (n == null || n === '') return '';
    const x = Number(n);
    if (!isFinite(x)) return String(n);
    return x.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
  }
  function fmtMoney(n) {
    if (n == null || n === '') return '';
    const x = Number(n);
    if (!isFinite(x)) return String(n);
    return x.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // -------------------- Toast / Modal --------------------
  let toastTimer = null;
  function toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast ' + type;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
  }
  function setSaveStatus(text, kind = '') {
    const el = document.getElementById('saveStatus');
    if (!el) return;
    el.textContent = text;
    el.className = 'status-pill ' + kind;
  }
  function openModal({ title, body, footer, onConfirm, large = false }) {
    const modal = document.getElementById('modal');
    const dialog = modal.querySelector('.modal-dialog');
    document.getElementById('modalTitle').textContent = title || '';
    document.getElementById('modalBody').innerHTML = '';
    if (typeof body === 'string') document.getElementById('modalBody').innerHTML = body;
    else if (body instanceof HTMLElement) document.getElementById('modalBody').appendChild(body);
    const footerEl = document.getElementById('modalFooter');
    if (footer) {
      footerEl.innerHTML = '';
      if (typeof footer === 'string') footerEl.innerHTML = footer;
      else footerEl.appendChild(footer);
    } else {
      footerEl.innerHTML = '<button class="btn btn-ghost" data-close="1">ยกเลิก</button><button class="btn btn-primary" id="modalConfirm">บันทึก</button>';
      const c = document.getElementById('modalConfirm');
      if (c && onConfirm) c.onclick = () => onConfirm();
    }
    dialog.classList.toggle('lg', !!large);
    modal.classList.remove('hidden');
  }
  function closeModal() { document.getElementById('modal').classList.add('hidden'); }
  function confirmDialog(message, opts = {}) {
    return new Promise(resolve => {
      const body = `<p>${escapeHTML(message)}</p>`;
      const footer = document.createElement('div');
      footer.style.display = 'flex'; footer.style.gap = '8px';
      const btnCancel = document.createElement('button');
      btnCancel.className = 'btn btn-ghost'; btnCancel.textContent = opts.cancelText || 'ยกเลิก';
      btnCancel.onclick = () => { closeModal(); resolve(false); };
      const btnOk = document.createElement('button');
      btnOk.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
      btnOk.textContent = opts.confirmText || 'ตกลง';
      btnOk.onclick = () => { closeModal(); resolve(true); };
      footer.appendChild(btnCancel); footer.appendChild(btnOk);
      openModal({ title: opts.title || 'ยืนยัน', body, footer });
    });
  }
  function escapeHTML(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  // -------------------- Sign in/out --------------------
  async function signIn() {
    if (!CONFIG.CLIENT_ID || CONFIG.CLIENT_ID.startsWith('YOUR_')) {
      toast('กรุณาตั้งค่า CLIENT_ID ใน config.js ก่อน — ดู setup-guide.html', 'error');
      return false;
    }
    if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID.startsWith('YOUR_')) {
      toast('กรุณาตั้งค่า SPREADSHEET_ID ใน config.js ก่อน', 'error');
      return false;
    }
    if (!CONFIG.ATTACHMENTS_FOLDER_ID || CONFIG.ATTACHMENTS_FOLDER_ID.startsWith('YOUR_')) {
      toast('กรุณาตั้งค่า ATTACHMENTS_FOLDER_ID ใน config.js ก่อน', 'error');
      return false;
    }
    setSaveStatus('กำลังเข้าสู่ระบบ...', 'busy');
    const ok = await GAuth.signIn();
    if (!ok) { setSaveStatus('ยังไม่ได้เข้าสู่ระบบ', 'error'); return false; }
    state.signedIn = true;
    state.folderHandle = true; // for views.js compat
    state.userEmail = GAuth.getEmail();
    state.folderName = state.userEmail || 'เข้าสู่ระบบแล้ว';
    document.getElementById('folderName').textContent = state.folderName;
    document.getElementById('btnPickFolder').textContent = 'ออกจากระบบ';
    document.getElementById('btnReload').disabled = false;
    document.getElementById('welcome').classList.add('hidden');
    await loadAll();
    return true;
  }
  function signOut() {
    GAuth.signOut();
    state.signedIn = false;
    state.userEmail = null;
    state.folderHandle = null;
    state.folderName = '';
    state.data = { jobs: [], delivery: [], gatepass: [], schedule: [], costs: [] };
    document.getElementById('folderName').textContent = 'ยังไม่ได้เข้าสู่ระบบ';
    document.getElementById('btnPickFolder').textContent = 'เข้าสู่ระบบ Google';
    document.getElementById('btnReload').disabled = true;
    document.getElementById('welcome').classList.remove('hidden');
    if (window.Views) Views.render('dashboard');
  }

  // -------------------- Load / Save --------------------
  async function loadAll() {
    if (!state.signedIn) return;
    setSaveStatus('กำลังโหลดข้อมูล...', 'busy');
    try {
      const sheetSpec = {};
      for (const def of Object.values(SHEETS)) sheetSpec[def.sheetName] = def.cols;
      await SheetsAPI.ensureSheetsExist(sheetSpec);

      const sheetNames = Object.values(SHEETS).map(s => s.sheetName);
      const data = await SheetsAPI.batchGet(sheetNames);

      for (const view of Object.keys(SHEETS)) {
        const def = SHEETS[view];
        const aoa = data[def.sheetName] || [];
        if (!aoa.length) { state.data[view] = []; continue; }
        const headers = aoa[0] || [];
        const keys = [];
        const used = new Set();
        for (let i = 0; i < Math.max(headers.length, def.cols.length); i++) {
          const h = headers[i] == null ? '' : String(headers[i]).trim();
          let k = '';
          if (h && def.cols.includes(h)) k = h;
          else if (def.cols[i]) k = def.cols[i];
          else if (h) k = h;
          if (k && used.has(k)) k = k + '_' + i;
          if (k) used.add(k);
          keys.push(k);
        }
        const rows = [];
        for (let i = 1; i < aoa.length; i++) {
          const r = aoa[i] || [];
          const obj = {};
          for (let c = 0; c < keys.length; c++) {
            const k = keys[c];
            if (!k) continue;
            obj[k] = r[c] == null || r[c] === '' ? null : r[c];
          }
          if (Object.values(obj).some(v => v != null && v !== '')) rows.push(obj);
        }
        state.data[view] = rows;
      }

      // Ensure attachment subfolders
      for (const [view, dirName] of Object.entries(ATTACH_DIR)) {
        try {
          state.attachFolderIds[view] = await DriveAPI.ensureFolder(dirName, CONFIG.ATTACHMENTS_FOLDER_ID);
        } catch (e) { console.warn('Folder ensure failed:', view, e); }
      }

      setSaveStatus('พร้อมใช้งาน');
      if (window.Views) Views.render(state.currentView);
      toast('โหลดข้อมูลสำเร็จ', 'success');
    } catch (err) {
      console.error(err);
      const msg = (err.result && err.result.error && err.result.error.message) || err.message || String(err);
      toast('โหลดข้อมูลล้มเหลว: ' + msg, 'error');
      setSaveStatus('ผิดพลาด', 'error');
    }
  }

  async function saveAll() {
    if (!state.signedIn) { toast('กรุณาเข้าสู่ระบบ', 'error'); return false; }
    setSaveStatus('กำลังบันทึก...', 'busy');
    try {
      const updates = [];
      for (const view of Object.keys(SHEETS)) {
        const def = SHEETS[view];
        const cols = def.cols;
        const aoa = [cols];
        for (const row of state.data[view]) {
          const arr = cols.map(c => {
            if (!c) return '';
            const v = row[c];
            if (v == null) return '';
            if (v instanceof Date) {
              // format as YYYY-MM-DD HH:MM (Sheets understands)
              const pad = n => String(n).padStart(2,'0');
              if (v.getHours()===0 && v.getMinutes()===0 && v.getSeconds()===0) {
                return `${v.getFullYear()}-${pad(v.getMonth()+1)}-${pad(v.getDate())}`;
              }
              return `${v.getFullYear()}-${pad(v.getMonth()+1)}-${pad(v.getDate())} ${pad(v.getHours())}:${pad(v.getMinutes())}`;
            }
            return v;
          });
          aoa.push(arr);
        }
        updates.push({ sheetName: def.sheetName, aoa });
      }
      await SheetsAPI.replaceMany(updates);
      setSaveStatus('บันทึกแล้ว', 'success');
      setTimeout(() => setSaveStatus('พร้อมใช้งาน'), 1500);
      return true;
    } catch (err) {
      console.error(err);
      const msg = (err.result && err.result.error && err.result.error.message) || err.message || String(err);
      toast('บันทึกล้มเหลว: ' + msg, 'error');
      setSaveStatus('ผิดพลาด', 'error');
      return false;
    }
  }

  // -------------------- Attachments --------------------
  async function uploadAttachment(viewKey, file, prefix = '') {
    if (!state.signedIn) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
    let folderId = state.attachFolderIds[viewKey];
    if (!folderId) {
      const dirName = ATTACH_DIR[viewKey] || 'misc';
      folderId = await DriveAPI.ensureFolder(dirName, CONFIG.ATTACHMENTS_FOLDER_ID);
      state.attachFolderIds[viewKey] = folderId;
    }
    const ext = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
    const baseName = file.name.replace(ext, '').replace(/[^\w฀-๿\.\-]+/g, '_').slice(0, 80);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safePrefix = (prefix || '').replace(/[^\w฀-๿\.\-]+/g, '_');
    const finalName = (safePrefix ? `${safePrefix}_` : '') + `${baseName}_${ts}${ext}`;
    const result = await DriveAPI.uploadFile(file, folderId, finalName);
    return DriveAPI.makeCellValue(result.id, finalName);
  }

  async function getAttachmentURL(value) {
    if (!value) return null;
    const parsed = DriveAPI.parseCellValue(value);
    if (!parsed) return null;
    if (parsed.url) return parsed.url;
    if (parsed.id) return DriveAPI.viewURL(parsed.id);
    return null;
  }

  // -------------------- Filter / Sort --------------------
  function filterRows(view, rows) {
    const f = state.filters[view] || {};
    let out = rows;
    if (f.q) {
      const q = String(f.q).toLowerCase();
      out = out.filter(r => Object.values(r).some(v => v != null && String(v).toLowerCase().includes(q)));
    }
    for (const [k, v] of Object.entries(f)) {
      if (k === 'q' || v == null || v === '') continue;
      out = out.filter(r => {
        const rv = r[k];
        if (rv == null) return false;
        if (typeof v === 'string') return String(rv).toLowerCase().includes(v.toLowerCase());
        return String(rv) === String(v);
      });
    }
    return out;
  }
  function sortRows(view, rows) {
    const s = state.sort[view];
    if (!s || !s.key) return rows;
    const dir = s.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = a[s.key], vb = b[s.key];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va instanceof Date || vb instanceof Date) {
        return ((va instanceof Date ? va.getTime() : new Date(va).getTime()) - (vb instanceof Date ? vb.getTime() : new Date(vb).getTime())) * dir;
      }
      const na = Number(va), nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
      return String(va).localeCompare(String(vb), 'th') * dir;
    });
  }

  // -------------------- ID generators --------------------
  function nextDocNo(prefix, view, key = 'เลขที่') {
    const yymm = (() => {
      const d = new Date();
      return `${String(d.getFullYear()).slice(-2)}${String(d.getMonth()+1).padStart(2,'0')}`;
    })();
    const reg = new RegExp(`^${prefix}-${yymm}(\\d{3})`);
    let max = 0;
    for (const r of state.data[view]) {
      const m = (r[key] || '').match(reg);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `${prefix}-${yymm}${String(max+1).padStart(3,'0')}`;
  }
  function nextTaskId() {
    let max = 0;
    for (const r of state.data.schedule) {
      const m = (r.Task_ID || '').match(/^sdb_(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return `sdb_${max + 1}`;
  }
  function nextCostCode() { return `COST-${Date.now()}`; }

  // -------------------- Public API --------------------
  return {
    state, SHEETS, FILE_FIELDS, ATTACH_DIR,
    fmtDate, fmtDateTime, fmtThaiDate, fmtNum, fmtMoney, parseDateInput, excelToDate,
    toast, openModal, closeModal, confirmDialog, escapeHTML, setSaveStatus,
    signIn, signOut,
    loadAll, saveAll,
    uploadAttachment, getAttachmentURL,
    filterRows, sortRows, nextDocNo, nextTaskId, nextCostCode,
    // legacy compat for views.js (calls App.pickFolder)
    pickFolder: signIn, tryRestoreFolder: () => Promise.resolve(false)
  };
})();
