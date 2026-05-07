/* ==========================================================================
 * Costs Manager — บันทึกค่าใช้จ่าย / Cost Management
 * Port จาก React CostManagementApp → vanilla JS
 * ใช้ SheetsAPI + DriveAPI (OAuth) แทน Firebase + Google Script
 * ========================================================================== */

const CostsManager = (() => {
  const { state, escapeHTML, fmtDate, fmtMoney, fmtNum, toast, confirmDialog, nextCostCode } = App;

  /* ---- Constants ---- */
  const COST_CATEGORIES = ['วัสดุอุปกรณ์', 'ค่าแรง/รับเหมา', 'ค่าเดินทางขนส่ง', 'ค่าอาหาร/รับรอง', 'เบ็ดเตล็ด'];
  const PAYMENT_STATUSES = ['เงินสด', 'โอนเงิน', 'เครดิต', 'ยังไม่จ่าย'];
  const CHART_COLORS = ['#f43f5e', '#f97316', '#8b5cf6', '#0ea5e9', '#10b981'];

  /* ---- State ---- */
  let _viewMode   = 'list';   // 'list' | 'report'
  let _form       = null;     // current add/edit form state
  let _editIdx    = null;     // index in state.data.costs being edited
  let _search     = '';
  let _filters    = { category: '', month: '', year: '' };
  let _page       = 1;
  let _perPage    = 30;
  let _repType    = 'all';    // 'all' | 'project' | 'general'
  let _repSearch  = '';
  let _expanded   = new Set(); // expanded job keys in report view
  let _repConfig  = _initRepConfig();
  let _styleOK    = false;
  let _chartInst  = {};       // Chart.js instances keyed by canvas id

  function _initRepConfig() {
    const now = new Date();
    const y   = String(now.getFullYear());
    const m   = String(now.getMonth() + 1).padStart(2, '0');
    const d   = now.toISOString().split('T')[0];
    const wAgo = new Date(now - 7 * 86400000).toISOString().split('T')[0];
    return { type: 'monthly', date: d, startDate: wAgo, endDate: d, month: m, year: y, jobNo: '', projectNo: '' };
  }

  function _today() { return new Date().toISOString().split('T')[0]; }

  /* ---- CSS ---- */
  function _css() {
    if (_styleOK) return; _styleOK = true;
    const s = document.createElement('style');
    s.textContent = `
      .cm-root{padding:0;display:flex;flex-direction:column;height:100%;}
      .cm-tabs{background:#fff;border-bottom:1px solid #e5e7eb;padding:0 24px;display:flex;gap:0;position:sticky;top:0;z-index:10;}
      .cm-tab{padding:14px 16px;border:none;background:transparent;border-bottom:3px solid transparent;font-weight:700;font-size:13px;cursor:pointer;color:#6b7280;display:flex;align-items:center;gap:6px;transition:color .15s;}
      .cm-tab.active{border-bottom-color:#e11d48;color:#e11d48;}
      .cm-tab:hover:not(.active){color:#374151;}
      .cm-body{flex:1;overflow-y:auto;padding:20px 24px;background:#f8fafc;}
      .cm-stats-grid{display:grid;grid-template-columns:200px 1fr;gap:16px;margin-bottom:16px;}
      .cm-kpi-stack{display:flex;flex-direction:column;gap:12px;}
      .cm-kpi{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.05);}
      .cm-kpi-label{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;}
      .cm-kpi-val{font-size:22px;font-weight:800;color:#111827;line-height:1.1;}
      .cm-kpi-sub{font-size:11px;color:#9ca3af;margin-top:2px;}
      .cm-charts-row{display:grid;grid-template-columns:1fr 2fr;gap:14px;align-items:start;}
      .cm-chart-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.05);}
      .cm-chart-title{font-size:12px;font-weight:700;color:#374151;margin-bottom:10px;}
      .cm-chart-wrap{position:relative;height:180px;}
      .cm-filter-bar{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,.05);}
      .cm-filter-bar input,.cm-filter-bar select{padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;}
      .cm-filter-bar input:focus,.cm-filter-bar select:focus{outline:none;border-color:#e11d48;box-shadow:0 0 0 3px rgba(225,29,72,.1);}
      .cm-filter-search{flex:1;min-width:160px;}
      .cm-table-wrap{background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);}
      .cm-table{width:100%;border-collapse:collapse;font-size:13px;}
      .cm-table th{background:#f9fafb;padding:9px 10px;border-bottom:2px solid #e5e7eb;font-weight:700;font-size:11px;text-align:left;color:#374151;white-space:nowrap;}
      .cm-table td{padding:8px 10px;border-bottom:1px solid #f3f4f6;vertical-align:top;}
      .cm-table tbody tr:hover{background:#fef2f2;}
      .cm-table .num{text-align:right;}
      .cm-badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;}
      .cm-badge.cash{background:#dcfce7;color:#166534;}
      .cm-badge.transfer{background:#dbeafe;color:#1e40af;}
      .cm-badge.credit{background:#fef3c7;color:#92400e;}
      .cm-badge.unpaid{background:#fee2e2;color:#991b1b;}
      .cm-cat-chip{display:inline-block;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600;background:#f3f4f6;color:#374151;}
      .cm-receipt-link{color:#2563eb;text-decoration:none;font-size:12px;}
      .cm-receipt-link:hover{text-decoration:underline;}
      .cm-pagination{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;font-size:13px;color:#6b7280;}
      .cm-pag-btn{padding:6px 12px;border:1px solid #e5e7eb;border-radius:6px;background:#fff;font-size:12px;cursor:pointer;font-weight:600;color:#374151;}
      .cm-pag-btn:disabled{opacity:.4;cursor:default;}
      .cm-pag-btn:not(:disabled):hover{background:#f3f4f6;}
      .cm-rep-tabs{display:flex;gap:4px;background:#f3f4f6;border-radius:8px;padding:4px;margin-bottom:14px;width:fit-content;}
      .cm-rep-tab{padding:7px 16px;border:none;background:transparent;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;color:#6b7280;}
      .cm-rep-tab.active{background:#fff;color:#e11d48;box-shadow:0 1px 3px rgba(0,0,0,.1);}
      .cm-job-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);}
      .cm-job-hd{padding:14px 16px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;gap:12px;}
      .cm-job-hd:hover{background:#fff7f7;}
      .cm-job-body{padding:0 16px 16px;border-top:1px solid #f3f4f6;}
      .cm-job-cat-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;padding-top:12px;}
      .cm-job-cat-chip{padding:4px 10px;border-radius:8px;font-size:12px;font-weight:600;}
      .cm-print-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:300;display:flex;flex-direction:column;align-items:center;overflow-y:auto;}
      .cm-print-header{background:#1f2937;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;width:100%;box-sizing:border-box;position:sticky;top:0;z-index:10;flex-shrink:0;}
      .cm-print-header h3{margin:0;font-size:15px;}
      .cm-a4l{background:#fff;width:1080px;font-family:"Sarabun","Tahoma",sans-serif;color:#000;margin:20px auto;padding:32px 36px;box-sizing:border-box;box-shadow:0 4px 24px rgba(0,0,0,.15);}
      @media print{.cm-print-overlay{position:static;background:transparent;overflow:visible;} .cm-print-header{display:none;} .cm-a4l{box-shadow:none;margin:0;width:100%;}}
      .cm-form-grid{display:grid;gap:12px;}
      .cm-form-grid.cols2{grid-template-columns:1fr 1fr;}
      .cm-form-grid.cols3{grid-template-columns:1fr 1fr 1fr;}
      .cm-field{display:flex;flex-direction:column;gap:4px;}
      .cm-field label{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;}
      .cm-field input,.cm-field select,.cm-field textarea{width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box;}
      .cm-field input:focus,.cm-field select:focus,.cm-field textarea:focus{outline:none;border-color:#e11d48;box-shadow:0 0 0 3px rgba(225,29,72,.1);}
      .cm-vat-row{display:flex;align-items:center;gap:10px;font-size:13px;padding:8px 10px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;}
      .cm-vat-row input[type=checkbox]{width:16px;height:16px;}
      .cm-total-box{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;}
      .cm-total-row{display:flex;justify-content:space-between;font-size:13px;}
      .cm-total-row.main{font-weight:800;font-size:16px;color:#e11d48;}
      .cm-thumb-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;}
      .cm-thumb{position:relative;width:72px;height:72px;border:2px solid #e5e7eb;border-radius:6px;overflow:hidden;background:#f9fafb;flex-shrink:0;}
      .cm-thumb img{width:100%;height:100%;object-fit:cover;}
      .cm-rep-type-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;}
      .cm-rep-type-btn{padding:12px 10px;border:2px solid #e5e7eb;border-radius:8px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;text-align:center;color:#374151;transition:all .15s;}
      .cm-rep-type-btn.active{border-color:#e11d48;background:#fef2f2;color:#e11d48;}
      .cm-rep-type-btn:hover:not(.active){border-color:#9ca3af;}
      @media(max-width:800px){.cm-stats-grid{grid-template-columns:1fr;} .cm-charts-row{grid-template-columns:1fr;}}
    `;
    document.head.appendChild(s);
  }

  /* ---- Helpers ---- */
  function _getFinalCost(row) {
    const tv = parseFloat(row['จำนวนเงินรวม Vat']);
    if (!isNaN(tv) && tv > 0) return tv;
    return parseFloat(row['จำนวนเงินรวม']) || 0;
  }

  function _getJobMap() {
    const map = new Map();
    (state.data.jobs || []).forEach(j => {
      if (j['เลขที่']) map.set(j['เลขที่'], j);
    });
    return map;
  }

  function _getPayBadge(status) {
    const cls = { 'เงินสด': 'cash', 'โอนเงิน': 'transfer', 'เครดิต': 'credit', 'ยังไม่จ่าย': 'unpaid' };
    return `<span class="cm-badge ${cls[status] || 'cash'}">${escapeHTML(status || 'เงินสด')}</span>`;
  }

  function _receiptHtml(val) {
    if (!val) return '-';
    // drive:ID|name format
    if (val.startsWith('drive:')) {
      const parts = val.slice(6).split('|');
      const id = parts[0];
      const name = parts[1] || 'ใบเสร็จ';
      return `<a href="https://drive.google.com/file/d/${escapeHTML(id)}/view" target="_blank" class="cm-receipt-link">📎 ${escapeHTML(name)}</a>`;
    }
    if (val.startsWith('http')) {
      return `<a href="${escapeHTML(val)}" target="_blank" class="cm-receipt-link">📎 ดูใบเสร็จ</a>`;
    }
    return '-';
  }

  function _catChipColor(cat) {
    const idx = COST_CATEGORIES.indexOf(cat);
    const palettes = [
      {bg:'#fef2f2',color:'#991b1b'},
      {bg:'#fff7ed',color:'#9a3412'},
      {bg:'#f5f3ff',color:'#5b21b6'},
      {bg:'#eff6ff',color:'#1e40af'},
      {bg:'#f0fdf4',color:'#166534'},
    ];
    const p = palettes[idx >= 0 ? idx : palettes.length - 1];
    return `background:${p.bg};color:${p.color};`;
  }

  /* ---- Chart Loading ---- */
  let _chartLoadPromise = null;
  function _loadChartJs() {
    if (window.Chart) return Promise.resolve();
    if (_chartLoadPromise) return _chartLoadPromise;
    _chartLoadPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
    return _chartLoadPromise;
  }

  function _destroyChart(id) {
    if (_chartInst[id]) { try { _chartInst[id].destroy(); } catch(e){} delete _chartInst[id]; }
    if (window.Chart) { const ex = Chart.getChart(id); if (ex) ex.destroy(); }
  }

  function _renderPie(canvasId, pieData) {
    _loadChartJs().then(() => {
      const canvas = document.getElementById(canvasId);
      if (!canvas || !window.Chart) return;
      _destroyChart(canvasId);
      if (!pieData.length) return;
      _chartInst[canvasId] = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: pieData.map(d => d.name),
          datasets: [{ data: pieData.map(d => d.value), backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: '#fff' }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12, padding: 8 } }, tooltip: {
            callbacks: { label: ctx => ` ${ctx.label}: ฿${ctx.parsed.toLocaleString('th-TH', {minimumFractionDigits:2})}` }
          } }
        }
      });
    }).catch(() => {});
  }

  function _renderBar(canvasId, barData) {
    _loadChartJs().then(() => {
      const canvas = document.getElementById(canvasId);
      if (!canvas || !window.Chart) return;
      _destroyChart(canvasId);
      if (!barData.length) return;
      _chartInst[canvasId] = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: barData.map(d => d.name),
          datasets: [{ label: 'ค่าใช้จ่าย (฿)', data: barData.map(d => d.value), backgroundColor: '#f43f5e', borderRadius: 4 }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: {
            callbacks: { label: ctx => ` ฿${ctx.parsed.y.toLocaleString('th-TH', {minimumFractionDigits:2})}` }
          } },
          scales: { y: { ticks: { callback: v => '฿' + (v >= 1000 ? (v/1000).toFixed(0)+'K' : v), font:{size:10} }, grid:{color:'#f3f4f6'} }, x: { ticks: { font:{size:10} } } }
        }
      });
    }).catch(() => {});
  }

  /* ---- Data Computations ---- */
  function _filterRows() {
    return (state.data.costs || []).filter(row => {
      const s = _search.toLowerCase();
      const matchSearch = !s ||
        (row['รายละเอียด'] || '').toLowerCase().includes(s) ||
        (row['เลขที่งาน'] || '').toLowerCase().includes(s) ||
        (row['ผู้ขาย / Sup'] || '').toLowerCase().includes(s) ||
        (row['เลขที่โครงการ'] || '').toLowerCase().includes(s) ||
        (row['Code'] || '').toLowerCase().includes(s);
      const dateStr = row['วันที่'] || '';
      const matchCat  = !_filters.category || row['ประเภท'] === _filters.category;
      const matchMon  = !_filters.month || dateStr.slice(5, 7) === _filters.month;
      const matchYear = !_filters.year  || dateStr.slice(0, 4) === _filters.year;
      return matchSearch && matchCat && matchMon && matchYear;
    });
  }

  function _computeStats(rows) {
    const total = rows.reduce((s, r) => s + _getFinalCost(r), 0);
    const catMap = {};
    rows.forEach(r => {
      const cat = r['ประเภท'] || 'อื่นๆ';
      catMap[cat] = (catMap[cat] || 0) + _getFinalCost(r);
    });
    const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }));
    const monMap = {};
    rows.forEach(r => {
      const d = r['วันที่'] || '';
      if (!d) return;
      const key = d.slice(0, 7);
      monMap[key] = (monMap[key] || 0) + _getFinalCost(r);
    });
    const barData = Object.entries(monMap).sort(([a],[b]) => a.localeCompare(b)).map(([key, value]) => {
      const dt = new Date(key + '-01');
      const name = dt.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
      return { name, value };
    });
    const years = [...new Set((state.data.costs || []).map(r => (r['วันที่'] || '').slice(0,4)).filter(Boolean))].sort().reverse();
    return { total, count: rows.length, pieData, barData, years };
  }

  function _buildJobSummary() {
    const jobMap = _getJobMap();
    const summary = {};
    (state.data.costs || []).forEach(row => {
      const ref = (row['เลขที่งาน'] || '').trim();
      const isGeneral = !ref || ref === '-';
      let key, docNo, details, company, projectNo;
      projectNo = row['เลขที่โครงการ'] || '';

      if (isGeneral) {
        const d = row['วันที่'] || '';
        let ym = 'ไม่ระบุเดือน';
        if (d) {
          const dt = new Date(d.slice(0,7) + '-01');
          ym = dt.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
        }
        key = `GENERAL_${ym}`;
        docNo = 'งานปกติ';
        details = `ค่าใช้จ่ายดำเนินงาน ประจำเดือน ${ym}`;
        company = 'สำนักงาน (ภายใน)';
      } else {
        key = ref;
        docNo = ref;
        const job = jobMap.get(ref) || {};
        details = job['รายละเอียด'] || job['ชื่อโครงการ'] || 'ไม่พบข้อมูลงาน';
        company = job['บริษัท'] || '-';
        if (!projectNo) projectNo = job['เลขที่โครงการ'] || '';
      }

      if (!summary[key]) {
        summary[key] = { key, docNo, projectNo, isGeneral, details, company, total: 0, count: 0, rows: [], catTotals: {} };
      }
      const amt = _getFinalCost(row);
      summary[key].total += amt;
      summary[key].count++;
      summary[key].rows.push(row);
      const cat = row['ประเภท'] || 'อื่นๆ';
      summary[key].catTotals[cat] = (summary[key].catTotals[cat] || 0) + amt;
    });
    return Object.values(summary).sort((a, b) => b.total - a.total);
  }

  /* ---- Main Render ---- */
  function render() {
    _css();
    const topbar = document.getElementById('topbar');
    topbar.innerHTML = `
      <div class="title">💰 Costs — บันทึกค่าใช้จ่าย</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn btn-ghost" id="cmBtnReport">📊 สร้างรายงาน</button>
        <button class="btn btn-primary" id="cmBtnAdd">+ เพิ่มค่าใช้จ่าย</button>
      </div>
    `;
    topbar.querySelector('#cmBtnAdd').onclick = () => _openAddEdit();
    topbar.querySelector('#cmBtnReport').onclick = () => _openReportModal();

    const root = document.getElementById('viewRoot');
    root.innerHTML = `
      <div class="cm-root">
        <div class="cm-tabs">
          <button class="cm-tab ${_viewMode==='list'?'active':''}" data-v="list">📋 บันทึกค่าใช้จ่าย</button>
          <button class="cm-tab ${_viewMode==='report'?'active':''}" data-v="report">💼 สรุปต้นทุนโครงการ</button>
        </div>
        <div class="cm-body" id="cmBody"></div>
      </div>
    `;
    root.querySelectorAll('.cm-tab').forEach(btn => {
      btn.onclick = () => { _viewMode = btn.dataset.v; render(); };
    });

    if (_viewMode === 'list') _renderList();
    else _renderReport();
  }

  /* ---- List View ---- */
  function _renderList() {
    const rows   = _filterRows();
    const stats  = _computeStats(rows);
    const total  = rows.length;
    const pages  = Math.ceil(total / _perPage) || 1;
    if (_page > pages) _page = pages;
    const slice  = rows.slice((_page - 1) * _perPage, _page * _perPage);
    const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    const monthNames = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

    const body = document.getElementById('cmBody');
    body.innerHTML = `
      <!-- Stats -->
      <div class="cm-stats-grid">
        <div class="cm-kpi-stack">
          <div class="cm-kpi">
            <div class="cm-kpi-label">ยอดรวมทั้งหมด</div>
            <div class="cm-kpi-val">฿${fmtMoney(stats.total)}</div>
            <div class="cm-kpi-sub">${stats.count} รายการ</div>
          </div>
          <div class="cm-kpi">
            <div class="cm-kpi-label">หมวดหมู่สูงสุด</div>
            <div class="cm-kpi-val" style="font-size:15px;">
              ${stats.pieData.length ? escapeHTML(stats.pieData.sort((a,b)=>b.value-a.value)[0].name) : '-'}
            </div>
            <div class="cm-kpi-sub">${stats.pieData.length ? '฿'+fmtMoney(stats.pieData[0].value) : '-'}</div>
          </div>
          <div class="cm-kpi">
            <div class="cm-kpi-label">เฉลี่ย / รายการ</div>
            <div class="cm-kpi-val">฿${stats.count ? fmtMoney(stats.total / stats.count) : '0.00'}</div>
          </div>
        </div>
        <div class="cm-charts-row">
          <div class="cm-chart-card">
            <div class="cm-chart-title">สัดส่วนตามหมวดหมู่</div>
            <div class="cm-chart-wrap"><canvas id="cmPieChart"></canvas></div>
          </div>
          <div class="cm-chart-card">
            <div class="cm-chart-title">ค่าใช้จ่ายรายเดือน</div>
            <div class="cm-chart-wrap"><canvas id="cmBarChart"></canvas></div>
          </div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="cm-filter-bar">
        <input class="cm-filter-search" type="search" placeholder="🔍 ค้นหา รายละเอียด / เลขงาน / ผู้ขาย…" value="${escapeHTML(_search)}" id="cmSearch" />
        <select id="cmFiltCat">
          <option value="">ทุกหมวดหมู่</option>
          ${COST_CATEGORIES.map(c => `<option value="${c}" ${_filters.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
        <select id="cmFiltMon">
          <option value="">ทุกเดือน</option>
          ${months.map((m,i) => `<option value="${m}" ${_filters.month===m?'selected':''}>${monthNames[i]}</option>`).join('')}
        </select>
        <select id="cmFiltYear">
          <option value="">ทุกปี</option>
          ${stats.years.map(y => `<option value="${y}" ${_filters.year===y?'selected':''}>${y}</option>`).join('')}
        </select>
        <button class="btn btn-ghost" id="cmBtnClear" style="white-space:nowrap;">ล้างตัวกรอง</button>
        <button class="btn btn-ghost" id="cmBtnExport" style="white-space:nowrap;">⬇ CSV</button>
        <span style="margin-left:auto;font-size:12px;color:#9ca3af;">${total} รายการ</span>
      </div>

      <!-- Table -->
      <div class="cm-table-wrap">
        <table class="cm-table">
          <thead>
            <tr>
              <th style="width:36px;">#</th>
              <th>วันที่</th>
              <th>เลขที่งาน</th>
              <th>หมวดหมู่</th>
              <th>ผู้ขาย / Sup</th>
              <th>รายละเอียด</th>
              <th>จำนวน</th>
              <th class="num">ราคา/หน่วย</th>
              <th class="num">VAT</th>
              <th class="num">ยอดสุทธิ</th>
              <th>สถานะ</th>
              <th>ใบเสร็จ</th>
              <th style="width:70px;"></th>
            </tr>
          </thead>
          <tbody id="cmTbody">
            ${slice.length === 0 ? `<tr><td colspan="13" style="text-align:center;padding:32px;color:#9ca3af;">ไม่พบข้อมูล</td></tr>` : ''}
            ${slice.map((row, si) => {
              const globalIdx = (state.data.costs || []).indexOf(row);
              const i = (_page - 1) * _perPage + si + 1;
              const vatAmt = parseFloat(row['VAT']) || 0;
              const unitP  = parseFloat(row['ราคา / หน่วย']) || 0;
              const final  = _getFinalCost(row);
              return `
                <tr data-idx="${globalIdx}">
                  <td style="color:#9ca3af;font-size:11px;">${i}</td>
                  <td style="white-space:nowrap;font-size:12px;">${escapeHTML(fmtDate(row['วันที่']) || row['วันที่'] || '-')}</td>
                  <td>
                    <div style="font-weight:700;font-size:12px;color:#4f46e5;">${escapeHTML(row['เลขที่งาน'] || '-')}</div>
                    ${row['เลขที่โครงการ'] ? `<div style="font-size:11px;color:#059669;">PJ: ${escapeHTML(row['เลขที่โครงการ'])}</div>` : ''}
                  </td>
                  <td><span class="cm-cat-chip" style="${_catChipColor(row['ประเภท'])}">${escapeHTML(row['ประเภท'] || '-')}</span></td>
                  <td style="font-size:12px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHTML(row['ผู้ขาย / Sup'] || '')}">${escapeHTML(row['ผู้ขาย / Sup'] || '-')}</td>
                  <td style="max-width:160px;font-size:12px;" title="${escapeHTML(row['รายละเอียด'] || '')}">${escapeHTML(row['รายละเอียด'] || '-')}</td>
                  <td style="font-size:12px;white-space:nowrap;">${escapeHTML(row['จำนวน'] || '-')}</td>
                  <td class="num" style="font-size:12px;">${unitP ? fmtMoney(unitP) : '-'}</td>
                  <td class="num" style="font-size:12px;color:#6b7280;">${vatAmt > 0 ? fmtMoney(vatAmt) : '-'}</td>
                  <td class="num" style="font-weight:700;color:#e11d48;">฿${fmtMoney(final)}</td>
                  <td>${_getPayBadge(row['สถานะจ่าย'])}</td>
                  <td>${_receiptHtml(row['ใบเสร็จ'])}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm cm-btn-edit" data-idx="${globalIdx}" title="แก้ไข">✏️</button>
                    <button class="btn btn-ghost btn-sm cm-btn-del" data-idx="${globalIdx}" title="ลบ" style="color:#ef4444;">🗑</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div class="cm-pagination">
          <span>หน้า ${_page} / ${pages} (${total} รายการ)</span>
          <div style="display:flex;gap:6px;align-items:center;">
            <select id="cmPerPage" style="padding:4px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;">
              ${[15,30,50,100].map(n=>`<option value="${n}" ${_perPage===n?'selected':''}>${n}/หน้า</option>`).join('')}
            </select>
            <button class="cm-pag-btn" id="cmPrev" ${_page<=1?'disabled':''}>‹ ก่อนหน้า</button>
            <button class="cm-pag-btn" id="cmNext" ${_page>=pages?'disabled':''}>ถัดไป ›</button>
          </div>
        </div>
      </div>
    `;

    // Wire events
    body.querySelector('#cmSearch').oninput = e => { _search = e.target.value; _page = 1; _renderList(); };
    body.querySelector('#cmFiltCat').onchange = e => { _filters.category = e.target.value; _page = 1; _renderList(); };
    body.querySelector('#cmFiltMon').onchange = e => { _filters.month = e.target.value; _page = 1; _renderList(); };
    body.querySelector('#cmFiltYear').onchange = e => { _filters.year = e.target.value; _page = 1; _renderList(); };
    body.querySelector('#cmBtnClear').onclick = () => { _search=''; _filters={category:'',month:'',year:''}; _page=1; _renderList(); };
    body.querySelector('#cmBtnExport').onclick = () => _exportCSV(rows);
    body.querySelector('#cmPrev').onclick = () => { _page--; _renderList(); };
    body.querySelector('#cmNext').onclick = () => { _page++; _renderList(); };
    body.querySelector('#cmPerPage').onchange = e => { _perPage = Number(e.target.value); _page = 1; _renderList(); };

    body.querySelectorAll('.cm-btn-edit').forEach(btn => {
      btn.onclick = () => _openAddEdit(Number(btn.dataset.idx));
    });
    body.querySelectorAll('.cm-btn-del').forEach(btn => {
      btn.onclick = () => _deleteCost(Number(btn.dataset.idx));
    });

    // Charts (deferred)
    const statsRef = _computeStats(rows);
    _renderPie('cmPieChart', statsRef.pieData);
    _renderBar('cmBarChart', statsRef.barData);
  }

  /* ---- Report View ---- */
  function _renderReport() {
    const summary = _buildJobSummary();
    const filtered = summary.filter(job => {
      let matchType = false;
      if (_repType === 'all')     matchType = true;
      else if (_repType === 'project') matchType = !!job.projectNo;
      else if (_repType === 'general') matchType = !job.projectNo;
      const s = _repSearch.toLowerCase();
      const matchSearch = !s ||
        job.docNo.toLowerCase().includes(s) ||
        job.details.toLowerCase().includes(s) ||
        job.company.toLowerCase().includes(s) ||
        (job.projectNo || '').toLowerCase().includes(s);
      return matchType && matchSearch;
    });

    const grandTotal = filtered.reduce((s, j) => s + j.total, 0);

    const body = document.getElementById('cmBody');
    body.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px;flex-wrap:wrap;">
        <div class="cm-rep-tabs">
          <button class="cm-rep-tab ${_repType==='all'?'active':''}" data-t="all">ทั้งหมด</button>
          <button class="cm-rep-tab ${_repType==='project'?'active':''}" data-t="project">📁 โครงการ</button>
          <button class="cm-rep-tab ${_repType==='general'?'active':''}" data-t="general">🏢 งานทั่วไป</button>
        </div>
        <input type="search" placeholder="🔍 ค้นหาโครงการ / งาน…" value="${escapeHTML(_repSearch)}"
          id="cmRepSearch" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;flex:1;min-width:160px;max-width:300px;font-family:inherit;" />
        <div class="cm-kpi" style="min-width:180px;">
          <div class="cm-kpi-label">ยอดรวมที่แสดง</div>
          <div class="cm-kpi-val">฿${fmtMoney(grandTotal)}</div>
          <div class="cm-kpi-sub">${filtered.length} งาน / โครงการ</div>
        </div>
      </div>

      <div id="cmRepList">
        ${filtered.length === 0 ? `<div style="text-align:center;padding:48px;color:#9ca3af;background:#fff;border-radius:12px;">ไม่พบข้อมูล</div>` : ''}
        ${filtered.map(job => {
          const isExpanded = _expanded.has(job.key);
          const catEntries = Object.entries(job.catTotals).sort((a,b)=>b[1]-a[1]);
          return `
            <div class="cm-job-card">
              <div class="cm-job-hd" data-key="${escapeHTML(job.key)}">
                <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">
                  <div style="font-size:18px;">${job.isGeneral ? '🏢' : '📋'}</div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:800;font-size:14px;color:#111827;">
                      ${escapeHTML(job.docNo)}
                      ${job.projectNo ? `<span style="font-size:11px;color:#059669;font-weight:600;margin-left:8px;">PJ: ${escapeHTML(job.projectNo)}</span>` : ''}
                    </div>
                    <div style="font-size:12px;color:#6b7280;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(job.details)}</div>
                    <div style="font-size:11px;color:#9ca3af;">${escapeHTML(job.company)}</div>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:16px;flex-shrink:0;">
                  <div style="text-align:right;">
                    <div style="font-weight:800;font-size:18px;color:#e11d48;">฿${fmtMoney(job.total)}</div>
                    <div style="font-size:11px;color:#9ca3af;">${job.count} รายการ</div>
                  </div>
                  <span style="font-size:20px;color:#6b7280;transition:transform .2s;${isExpanded?'transform:rotate(180deg)':''}">${isExpanded?'▲':'▼'}</span>
                </div>
              </div>
              ${isExpanded ? `
                <div class="cm-job-body">
                  <div class="cm-job-cat-row">
                    ${catEntries.map(([cat, amt], i) => `
                      <span class="cm-job-cat-chip" style="${_catChipColor(cat)}">
                        ${escapeHTML(cat)}: ฿${fmtMoney(amt)}
                      </span>
                    `).join('')}
                  </div>
                  <table class="cm-table" style="font-size:12px;">
                    <thead>
                      <tr>
                        <th>วันที่</th><th>หมวดหมู่</th><th>ผู้ขาย</th><th>รายละเอียด</th><th>จำนวน</th><th class="num">ยอดสุทธิ</th><th>สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${job.rows.sort((a,b)=>(a['วันที่']||'').localeCompare(b['วันที่']||'')).map(row => `
                        <tr>
                          <td style="white-space:nowrap;">${escapeHTML(fmtDate(row['วันที่']) || row['วันที่'] || '-')}</td>
                          <td><span class="cm-cat-chip" style="${_catChipColor(row['ประเภท'])};font-size:11px;">${escapeHTML(row['ประเภท']||'-')}</span></td>
                          <td>${escapeHTML(row['ผู้ขาย / Sup']||'-')}</td>
                          <td>${escapeHTML(row['รายละเอียด']||'-')}</td>
                          <td>${escapeHTML(row['จำนวน']||'-')}</td>
                          <td class="num" style="font-weight:700;color:#e11d48;">฿${fmtMoney(_getFinalCost(row))}</td>
                          <td>${_getPayBadge(row['สถานะจ่าย'])}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                    <tfoot>
                      <tr style="background:#fef2f2;">
                        <td colspan="5" style="text-align:right;font-weight:700;font-size:12px;">รวม (${job.count} รายการ)</td>
                        <td class="num" style="font-weight:800;color:#e11d48;">฿${fmtMoney(job.total)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    body.querySelectorAll('.cm-rep-tab').forEach(btn => {
      btn.onclick = () => { _repType = btn.dataset.t; _renderReport(); };
    });
    body.querySelector('#cmRepSearch').oninput = e => { _repSearch = e.target.value; _renderReport(); };
    body.querySelectorAll('.cm-job-hd').forEach(hd => {
      hd.onclick = () => {
        const key = hd.dataset.key;
        if (_expanded.has(key)) _expanded.delete(key);
        else _expanded.add(key);
        _renderReport();
      };
    });
  }

  /* ---- Add / Edit Modal ---- */
  function _openAddEdit(idx = null) {
    _editIdx = idx;
    const existing = idx !== null ? (state.data.costs[idx] || {}) : {};
    _form = {
      code:       existing['Code'] || nextCostCode(),
      date:       existing['วันที่'] || _today(),
      jobNo:      existing['เลขที่งาน'] || '',
      projectNo:  existing['เลขที่โครงการ'] || '',
      category:   existing['ประเภท'] || COST_CATEGORIES[0],
      supplier:   existing['ผู้ขาย / Sup'] || '',
      desc:       existing['รายละเอียด'] || '',
      qty:        existing['จำนวน'] || '',
      unitPrice:  existing['ราคา / หน่วย'] || '',
      amount:     existing['จำนวนเงินรวม'] || '',
      vat:        existing['VAT'] || '',
      totalVat:   existing['จำนวนเงินรวม Vat'] || '',
      recorder:   existing['ผู้บันทึก'] || (state.userEmail || ''),
      remark:     existing['หมายเหตุ'] || '',
      payStatus:  existing['สถานะจ่าย'] || 'เงินสด',
      receipt:    existing['ใบเสร็จ'] || '',
      hasVat:     !!(parseFloat(existing['VAT']) > 0),
    };

    const jobOptions = (state.data.jobs || []).map(j =>
      `<option value="${escapeHTML(j['เลขที่']||'')}">` +
      `${escapeHTML(j['เลขที่']||'')} — ${escapeHTML((j['รายละเอียด']||j['ชื่อโครงการ']||'').slice(0,40))}</option>`
    ).join('');

    App.openModal({ title: idx === null ? '+ เพิ่มค่าใช้จ่าย' : '✏️ แก้ไขค่าใช้จ่าย', large: true, body: `
      <div style="max-height:60vh;overflow-y:auto;padding-right:4px;">
        <div class="cm-form-grid cols2" style="margin-bottom:12px;">
          <div class="cm-field">
            <label>วันที่</label>
            <input type="date" id="cfDate" value="${escapeHTML(_form.date)}" />
          </div>
          <div class="cm-field">
            <label>หมวดหมู่</label>
            <select id="cfCat">
              ${COST_CATEGORIES.map(c=>`<option value="${c}" ${_form.category===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="cm-form-grid cols2" style="margin-bottom:12px;">
          <div class="cm-field" style="position:relative;">
            <label>อ้างอิงใบงาน</label>
            <input type="text" id="cfJobNo" value="${escapeHTML(_form.jobNo)}" placeholder="เลขที่ใบงาน (ถ้ามี)" list="cfJobList" autocomplete="off" />
            <datalist id="cfJobList">${jobOptions}</datalist>
          </div>
          <div class="cm-field">
            <label>เลขที่โครงการ</label>
            <input type="text" id="cfProjNo" value="${escapeHTML(_form.projectNo)}" placeholder="กรอกอัตโนมัติจากใบงาน" />
          </div>
        </div>

        <div class="cm-form-grid cols2" style="margin-bottom:12px;">
          <div class="cm-field">
            <label>ผู้ขาย / Supplier</label>
            <input type="text" id="cfSupplier" value="${escapeHTML(_form.supplier)}" placeholder="ชื่อร้านค้า / บริษัท" />
          </div>
          <div class="cm-field">
            <label>สถานะการจ่าย</label>
            <select id="cfPayStatus">
              ${PAYMENT_STATUSES.map(p=>`<option value="${p}" ${_form.payStatus===p?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="cm-field" style="margin-bottom:12px;">
          <label>รายละเอียด</label>
          <input type="text" id="cfDesc" value="${escapeHTML(_form.desc)}" placeholder="รายละเอียดค่าใช้จ่าย" />
        </div>

        <div class="cm-form-grid cols3" style="margin-bottom:12px;">
          <div class="cm-field">
            <label>จำนวน (เช่น 2 ชิ้น)</label>
            <input type="text" id="cfQty" value="${escapeHTML(_form.qty)}" placeholder="เช่น 2 ชิ้น" />
          </div>
          <div class="cm-field">
            <label>ราคา / หน่วย (฿)</label>
            <input type="number" id="cfUnitPrice" value="${escapeHTML(String(_form.unitPrice))}" placeholder="0.00" step="0.01" min="0" />
          </div>
          <div class="cm-field">
            <label>จำนวนเงินรวม (฿)</label>
            <input type="number" id="cfAmount" value="${escapeHTML(String(_form.amount))}" placeholder="0.00" step="0.01" min="0" />
          </div>
        </div>

        <div class="cm-vat-row" style="margin-bottom:12px;">
          <input type="checkbox" id="cfHasVat" ${_form.hasVat?'checked':''} />
          <label for="cfHasVat" style="font-size:13px;cursor:pointer;">มี VAT 7%</label>
          <span id="cfVatDisplay" style="margin-left:auto;font-size:13px;color:#6b7280;">
            ${_form.hasVat ? `VAT: ฿${fmtMoney(_form.vat)}` : ''}
          </span>
        </div>

        <div class="cm-total-box" style="margin-bottom:12px;">
          <div class="cm-total-row"><span>จำนวนเงินก่อน VAT:</span><span>฿<span id="cfAmtDisplay">${fmtMoney(_form.amount)}</span></span></div>
          <div class="cm-total-row"><span>VAT 7%:</span><span>฿<span id="cfVatDisp">${fmtMoney(_form.vat)}</span></span></div>
          <div class="cm-total-row main"><span>ยอดสุทธิ:</span><span>฿<span id="cfTotalDisp">${fmtMoney(_form.totalVat || _form.amount)}</span></span></div>
        </div>

        <div class="cm-form-grid cols2" style="margin-bottom:12px;">
          <div class="cm-field">
            <label>ผู้บันทึก</label>
            <input type="text" id="cfRecorder" value="${escapeHTML(_form.recorder)}" />
          </div>
          <div class="cm-field">
            <label>หมายเหตุ</label>
            <input type="text" id="cfRemark" value="${escapeHTML(_form.remark)}" />
          </div>
        </div>

        <div class="cm-field" style="margin-bottom:12px;">
          <label>ใบเสร็จ / หลักฐาน</label>
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="file" id="cfReceiptFile" accept="image/*,application/pdf" style="flex:1;font-size:13px;" />
          </div>
          ${_form.receipt ? `<div style="margin-top:6px;font-size:12px;">${_receiptHtml(_form.receipt)}</div>` : ''}
          <div id="cfReceiptStatus" style="font-size:12px;color:#6b7280;margin-top:4px;"></div>
        </div>
      </div>
    ` });

    // Wire live calculations
    const amtCalc = () => {
      const qty     = _form.qty; // keep as text
      const unitP   = parseFloat(document.getElementById('cfUnitPrice').value) || 0;
      // Try to extract numeric part from qty string for calculation
      const qtyNum  = parseFloat(String(qty).replace(/[^\d.]/g, '')) || 0;
      let amt = 0;
      if (qtyNum > 0 && unitP > 0) {
        amt = qtyNum * unitP;
        document.getElementById('cfAmount').value = amt.toFixed(2);
      } else {
        amt = parseFloat(document.getElementById('cfAmount').value) || 0;
      }
      const hasVat  = document.getElementById('cfHasVat').checked;
      const vat     = hasVat ? amt * 0.07 : 0;
      const total   = amt + vat;
      _form.amount   = amt ? amt.toFixed(2) : '';
      _form.vat      = vat ? vat.toFixed(2) : '';
      _form.totalVat = total ? total.toFixed(2) : '';
      if (document.getElementById('cfAmtDisplay')) document.getElementById('cfAmtDisplay').textContent = fmtMoney(amt);
      if (document.getElementById('cfVatDisp'))    document.getElementById('cfVatDisp').textContent    = fmtMoney(vat);
      if (document.getElementById('cfTotalDisp'))  document.getElementById('cfTotalDisp').textContent  = fmtMoney(total);
      if (document.getElementById('cfVatDisplay')) document.getElementById('cfVatDisplay').textContent = hasVat ? `VAT: ฿${fmtMoney(vat)}` : '';
    };

    document.getElementById('cfUnitPrice').addEventListener('input', amtCalc);
    document.getElementById('cfAmount').addEventListener('input', amtCalc);
    document.getElementById('cfHasVat').addEventListener('change', amtCalc);

    // Auto-fill projectNo from job selection
    document.getElementById('cfJobNo').addEventListener('change', e => {
      const jn = e.target.value;
      _form.jobNo = jn;
      if (jn) {
        const job = (state.data.jobs || []).find(j => j['เลขที่'] === jn);
        if (job) {
          const projNo = job['เลขที่โครงการ'] || '';
          document.getElementById('cfProjNo').value = projNo;
          _form.projectNo = projNo;
        }
      }
    });

    document.getElementById('cfQty').addEventListener('input', e => {
      _form.qty = e.target.value;
      amtCalc();
    });

    // Receipt upload
    document.getElementById('cfReceiptFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const statusEl = document.getElementById('cfReceiptStatus');
      statusEl.textContent = '⏳ กำลังอัปโหลด…';
      try {
        const ref = await App.uploadAttachment('costs', file, 'RCPT');
        _form.receipt = ref;
        statusEl.innerHTML = `✅ อัปโหลดสำเร็จ: ${_receiptHtml(ref)}`;
      } catch(err) {
        statusEl.textContent = '❌ อัปโหลดล้มเหลว: ' + err.message;
      }
    });

    // Save handler wired to modal confirm button
    document.getElementById('modalConfirm').onclick = async () => {
      _form.date      = document.getElementById('cfDate').value;
      _form.category  = document.getElementById('cfCat').value;
      _form.jobNo     = document.getElementById('cfJobNo').value;
      _form.projectNo = document.getElementById('cfProjNo').value;
      _form.supplier  = document.getElementById('cfSupplier').value;
      _form.payStatus = document.getElementById('cfPayStatus').value;
      _form.desc      = document.getElementById('cfDesc').value;
      _form.qty       = document.getElementById('cfQty').value;
      _form.unitPrice = document.getElementById('cfUnitPrice').value;
      _form.recorder  = document.getElementById('cfRecorder').value;
      _form.remark    = document.getElementById('cfRemark').value;
      _form.hasVat    = document.getElementById('cfHasVat').checked;
      amtCalc();
      await _saveCost();
    };
  }

  /* ---- Save Cost ---- */
  async function _saveCost() {
    if (!_form.desc && !_form.amount) {
      toast('กรุณากรอกรายละเอียดและจำนวนเงิน', 'warning'); return;
    }
    const now = new Date().toLocaleString('th-TH');
    const row = {
      'Code':                _form.code,
      'วันที่':              _form.date,
      'เลขที่งาน':           _form.jobNo,
      'เลขที่โครงการ':       _form.projectNo,
      'ประเภท':              _form.category,
      'ผู้ขาย / Sup':        _form.supplier,
      'รายละเอียด':          _form.desc,
      'จำนวน':               _form.qty,
      'ราคา / หน่วย':        _form.unitPrice,
      'จำนวนเงินรวม':        _form.amount,
      'VAT':                 _form.vat,
      'จำนวนเงินรวม Vat':   _form.totalVat || _form.amount,
      'ผู้บันทึก':            _form.recorder,
      'หมายเหตุ':             _form.remark,
      'วันที่ บันทึก':       now,
      'สถานะจ่าย':           _form.payStatus,
      'ใบเสร็จ':             _form.receipt,
    };

    try {
      if (_editIdx !== null) {
        state.data.costs[_editIdx] = row;
      } else {
        state.data.costs.unshift(row);
      }
      await App.saveAll();
      App.closeModal();
      toast(_editIdx !== null ? 'แก้ไขรายการสำเร็จ' : 'บันทึกค่าใช้จ่ายสำเร็จ', 'success');
      _editIdx = null; _form = null;
      render();
    } catch (err) {
      toast('บันทึกล้มเหลว: ' + err.message, 'error');
    }
  }

  /* ---- Delete Cost ---- */
  async function _deleteCost(idx) {
    const row = state.data.costs[idx];
    if (!row) return;
    const ok = await confirmDialog(`ลบรายการ "${row['รายละเอียด'] || row['Code']}" ใช่หรือไม่?`);
    if (!ok) return;
    state.data.costs.splice(idx, 1);
    await App.saveAll();
    toast('ลบรายการสำเร็จ', 'success');
    render();
  }

  /* ---- CSV Export ---- */
  function _exportCSV(rows) {
    if (!rows.length) { toast('ไม่มีข้อมูลสำหรับส่งออก', 'warning'); return; }
    const headers = ['Code','วันที่','เลขที่งาน','เลขที่โครงการ','ประเภท','ผู้ขาย / Sup','รายละเอียด','จำนวน','ราคา / หน่วย','จำนวนเงินรวม','VAT','จำนวนเงินรวม Vat','ผู้บันทึก','หมายเหตุ','วันที่ บันทึก','สถานะจ่าย','ใบเสร็จ'];
    const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
    const csv = [headers.join(','), ...rows.map(r => [
      esc(r['Code']), esc(r['วันที่']), esc(r['เลขที่งาน']), esc(r['เลขที่โครงการ']),
      esc(r['ประเภท']), esc(r['ผู้ขาย / Sup']), esc(r['รายละเอียด']), esc(r['จำนวน']),
      r['ราคา / หน่วย'] || 0, r['จำนวนเงินรวม'] || 0, r['VAT'] || 0, r['จำนวนเงินรวม Vat'] || 0,
      esc(r['ผู้บันทึก']), esc(r['หมายเหตุ']), esc(r['วันที่ บันทึก']),
      esc(r['สถานะจ่าย']), esc(r['ใบเสร็จ'])
    ].join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `SMEC_Costs_${_today()}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast('ส่งออก CSV สำเร็จ', 'success');
  }

  /* ---- Report Modal ---- */
  function _openReportModal() {
    const years   = [...new Set((state.data.costs||[]).map(r=>(r['วันที่']||'').slice(0,4)).filter(Boolean))].sort().reverse();
    const jobs    = [...new Set((state.data.costs||[]).map(r=>r['เลขที่งาน']).filter(j=>j&&j!=='-'))].sort();
    const projects= [...new Set((state.data.costs||[]).map(r=>r['เลขที่โครงการ']).filter(Boolean))].sort();
    const types   = [
      { v:'daily',   label:'📅 รายวัน' },
      { v:'weekly',  label:'📅 รายสัปดาห์' },
      { v:'monthly', label:'📅 รายเดือน' },
      { v:'yearly',  label:'📅 รายปี' },
      { v:'job',     label:'📋 ตามใบงาน' },
      { v:'project', label:'📁 ตามโครงการ' },
    ];

    App.openModal({ title: '📊 สร้างรายงานค่าใช้จ่าย', body: `
      <div class="cm-rep-type-grid">
        ${types.map(t=>`<button class="cm-rep-type-btn ${_repConfig.type===t.v?'active':''}" data-rt="${t.v}">${t.label}</button>`).join('')}
      </div>
      <div id="crpOptions"></div>
    ` });

    const modal = document.getElementById('modal');
    modal.querySelectorAll('.cm-rep-type-btn').forEach(btn => {
      btn.onclick = () => {
        _repConfig.type = btn.dataset.rt;
        modal.querySelectorAll('.cm-rep-type-btn').forEach(b => b.classList.toggle('active', b===btn));
        _renderRepOptions();
      };
    });

    function _renderRepOptions() {
      const opts = document.getElementById('crpOptions');
      const t = _repConfig.type;
      opts.innerHTML = `
        <div class="cm-form-grid" style="gap:12px;">
          ${t === 'daily' ? `
            <div class="cm-field"><label>วันที่</label><input type="date" id="crpDate" value="${_repConfig.date}" /></div>
          ` : t === 'weekly' ? `
            <div class="cm-form-grid cols2">
              <div class="cm-field"><label>วันเริ่มต้น</label><input type="date" id="crpStart" value="${_repConfig.startDate}" /></div>
              <div class="cm-field"><label>วันสิ้นสุด</label><input type="date" id="crpEnd" value="${_repConfig.endDate}" /></div>
            </div>
          ` : t === 'monthly' ? `
            <div class="cm-form-grid cols2">
              <div class="cm-field"><label>เดือน</label>
                <select id="crpMonth">
                  ${['01','02','03','04','05','06','07','08','09','10','11','12'].map((m,i)=>
                    `<option value="${m}" ${_repConfig.month===m?'selected':''}>
                      ${['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'][i]}</option>`
                  ).join('')}
                </select>
              </div>
              <div class="cm-field"><label>ปี</label>
                <select id="crpYear">
                  ${(years.length ? years : [String(new Date().getFullYear())]).map(y=>`<option value="${y}" ${_repConfig.year===y?'selected':''}>${y}</option>`).join('')}
                </select>
              </div>
            </div>
          ` : t === 'yearly' ? `
            <div class="cm-field"><label>ปี</label>
              <select id="crpYear">
                ${(years.length ? years : [String(new Date().getFullYear())]).map(y=>`<option value="${y}" ${_repConfig.year===y?'selected':''}>${y}</option>`).join('')}
              </select>
            </div>
          ` : t === 'job' ? `
            <div class="cm-field"><label>เลขที่ใบงาน</label>
              <input type="text" id="crpJobNo" value="${_repConfig.jobNo}" list="crpJobList" placeholder="พิมพ์หรือเลือกเลขที่ใบงาน" />
              <datalist id="crpJobList">${jobs.map(j=>`<option value="${escapeHTML(j)}">`).join('')}</datalist>
            </div>
          ` : `
            <div class="cm-field"><label>รหัสโครงการ</label>
              <input type="text" id="crpProjNo" value="${_repConfig.projectNo}" list="crpProjList" placeholder="พิมพ์หรือเลือกรหัสโครงการ" />
              <datalist id="crpProjList">${projects.map(p=>`<option value="${escapeHTML(p)}">`).join('')}</datalist>
            </div>
          `}
        </div>
      `;
    }
    _renderRepOptions();

    document.getElementById('modalConfirm').textContent = 'ดูรายงาน →';
    document.getElementById('modalConfirm').onclick = () => {
      const t = _repConfig.type;
      if (t==='daily')  _repConfig.date      = document.getElementById('crpDate')?.value || _repConfig.date;
      if (t==='weekly') { _repConfig.startDate = document.getElementById('crpStart')?.value; _repConfig.endDate = document.getElementById('crpEnd')?.value; }
      if (t==='monthly'){ _repConfig.month = document.getElementById('crpMonth')?.value; _repConfig.year = document.getElementById('crpYear')?.value; }
      if (t==='yearly') _repConfig.year      = document.getElementById('crpYear')?.value;
      if (t==='job')    _repConfig.jobNo     = document.getElementById('crpJobNo')?.value || '';
      if (t==='project')_repConfig.projectNo = document.getElementById('crpProjNo')?.value || '';
      App.closeModal();
      _generateReport();
    };
  }

  /* ---- Generate Report ---- */
  function _generateReport() {
    const t = _repConfig.type;
    const costs = state.data.costs || [];
    let filtered = [], title = '', subtitle = '';

    if (t === 'daily') {
      filtered = costs.filter(c => c['วันที่'] === _repConfig.date);
      title = 'รายงานสรุปค่าใช้จ่ายประจำวัน';
      subtitle = `วันที่ ${fmtDate(_repConfig.date)}`;
    } else if (t === 'weekly') {
      filtered = costs.filter(c => c['วันที่'] >= _repConfig.startDate && c['วันที่'] <= _repConfig.endDate);
      title = 'รายงานสรุปค่าใช้จ่ายรายสัปดาห์';
      subtitle = `ระหว่างวันที่ ${fmtDate(_repConfig.startDate)} ถึง ${fmtDate(_repConfig.endDate)}`;
    } else if (t === 'monthly') {
      filtered = costs.filter(c => (c['วันที่']||'').startsWith(`${_repConfig.year}-${_repConfig.month}`));
      const mn = new Date(+_repConfig.year, +_repConfig.month-1, 1).toLocaleDateString('th-TH', {month:'long'});
      title = 'รายงานสรุปค่าใช้จ่ายประจำเดือน';
      subtitle = `เดือน ${mn} ปี ${_repConfig.year}`;
    } else if (t === 'yearly') {
      filtered = costs.filter(c => (c['วันที่']||'').startsWith(_repConfig.year));
      title = 'รายงานสรุปค่าใช้จ่ายประจำปี';
      subtitle = `ประจำปี ${_repConfig.year}`;
    } else if (t === 'job') {
      filtered = costs.filter(c => (c['เลขที่งาน']||'').toLowerCase().includes((_repConfig.jobNo||'').toLowerCase()));
      title = 'รายงานสรุปต้นทุนใบแจ้งงาน';
      subtitle = `อ้างอิงใบงาน: ${_repConfig.jobNo}`;
    } else if (t === 'project') {
      filtered = costs.filter(c => (c['เลขที่โครงการ']||'').toLowerCase().includes((_repConfig.projectNo||'').toLowerCase()));
      title = 'รายงานสรุปต้นทุนโครงการ';
      subtitle = `รหัสโครงการ: ${_repConfig.projectNo}`;
    }

    filtered = filtered.slice().sort((a,b) => (a['วันที่']||'').localeCompare(b['วันที่']||''));
    _openPrintPreview(filtered, { title, subtitle });
  }

  /* ---- Print Preview Overlay ---- */
  function _openPrintPreview(data, meta) {
    const existing = document.getElementById('cmPrintOverlay');
    if (existing) existing.remove();

    const catSummary = {};
    data.forEach(r => {
      const cat = r['ประเภท'] || 'อื่นๆ';
      catSummary[cat] = (catSummary[cat] || 0) + _getFinalCost(r);
    });
    const grandTotal = data.reduce((s, r) => s + _getFinalCost(r), 0);
    const grandVat   = data.reduce((s, r) => s + (parseFloat(r['VAT']) || 0), 0);
    const printDate  = new Date().toLocaleString('th-TH');
    const SMEC_LOGO  = 'https://lh3.googleusercontent.com/d/1M2t7dFe5AskW8Zc1hiANYwUeaow6Km5_';

    const overlay = document.createElement('div');
    overlay.id = 'cmPrintOverlay';
    overlay.className = 'cm-print-overlay';
    overlay.innerHTML = `
      <div class="cm-print-header no-print">
        <div>
          <div style="font-size:15px;font-weight:700;">📊 ตรวจสอบรายงาน — ${escapeHTML(meta.title)}</div>
          <div style="font-size:12px;color:#9ca3af;margin-top:2px;">${escapeHTML(meta.subtitle)}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <button id="cmPrintClose" style="padding:8px 16px;background:#374151;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">✕ ปิด</button>
          <button id="cmPrintBtn" style="padding:8px 16px;background:#64748b;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">🖨 พิมพ์</button>
          <button id="cmDownloadBtn" style="padding:8px 20px;background:#e11d48;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">⬇ ดาวน์โหลด PDF</button>
        </div>
      </div>

      ${data.length === 0 ? `
        <div style="background:#fff;margin:40px auto;padding:60px 40px;text-align:center;border-radius:16px;max-width:500px;">
          <div style="font-size:64px;margin-bottom:16px;">📭</div>
          <div style="font-size:20px;font-weight:700;color:#374151;margin-bottom:8px;">ไม่พบข้อมูล</div>
          <div style="color:#9ca3af;">ไม่มีข้อมูลค่าใช้จ่ายสำหรับเงื่อนไขรายงานที่คุณเลือก</div>
        </div>
      ` : `
        <div class="cm-a4l" id="cmPdfArea">
          <!-- Header -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #1f2937;">
            <div style="display:flex;align-items:center;gap:16px;">
              <img src="${SMEC_LOGO}" alt="SMEC" style="height:52px;object-fit:contain;" crossorigin="anonymous" />
              <div>
                <div style="font-size:20px;font-weight:900;margin-bottom:4px;">${escapeHTML(meta.title)}</div>
                <div style="font-size:13px;color:#374151;">${escapeHTML(meta.subtitle)}</div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px;font-weight:700;color:#111827;">บริษัท สยามแมค เอ็นจิเนียริ่ง แอนด์ คอนสตรัคชั่น</div>
              <div style="font-size:10px;color:#6b7280;">SIAM MECH ENGINEERING AND CONSTRUCTION CO., LTD.</div>
              <div style="font-size:11px;color:#6b7280;margin-top:4px;">พิมพ์เมื่อ: ${printDate}</div>
            </div>
          </div>

          <!-- Category Summary -->
          <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
            ${Object.entries(catSummary).sort((a,b)=>b[1]-a[1]).map(([cat, amt]) => `
              <div style="border:1px solid #e5e7eb;padding:8px 12px;border-radius:8px;background:#f9fafb;min-width:110px;">
                <div style="font-size:10px;color:#6b7280;margin-bottom:2px;">${escapeHTML(cat)}</div>
                <div style="font-size:13px;font-weight:700;">฿${fmtMoney(amt)}</div>
              </div>
            `).join('')}
          </div>

          <!-- Table -->
          <table style="width:100%;border-collapse:collapse;font-size:11px;font-family:'Sarabun','Tahoma',sans-serif;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;width:32px;">ลำดับ</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;white-space:nowrap;">วันที่</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;">อ้างอิง/โครงการ</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;">หมวดหมู่</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;">ร้านค้า/ผู้ขาย</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;min-width:140px;">รายละเอียด</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;">จำนวน</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;text-align:right;">ราคา/หน่วย</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;text-align:right;">VAT 7%</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;text-align:right;min-width:80px;">ยอดสุทธิ (฿)</th>
                <th style="border:1px solid #d1d5db;padding:6px 8px;">สถานะ/หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((row, idx) => {
                const vatAmt = parseFloat(row['VAT']) || 0;
                const unitP  = parseFloat(row['ราคา / หน่วย']) || 0;
                const final  = _getFinalCost(row);
                const isPaid = row['สถานะจ่าย'] === 'เงินสด' || row['สถานะจ่าย'] === 'โอนเงิน';
                return `
                  <tr>
                    <td style="border:1px solid #e5e7eb;padding:5px 7px;text-align:center;color:#9ca3af;">${idx+1}</td>
                    <td style="border:1px solid #e5e7eb;padding:5px 7px;white-space:nowrap;">${escapeHTML(fmtDate(row['วันที่'])||row['วันที่']||'-')}</td>
                    <td style="border:1px solid #e5e7eb;padding:5px 7px;text-align:center;">
                      <div style="font-weight:700;color:#4f46e5;font-size:10px;">${escapeHTML(row['เลขที่งาน']||'-')}</div>
                      ${row['เลขที่โครงการ']?`<div style="font-size:9px;color:#059669;margin-top:2px;">PJ: ${escapeHTML(row['เลขที่โครงการ'])}</div>`:''}
                    </td>
                    <td style="border:1px solid #e5e7eb;padding:5px 7px;font-size:10px;">${escapeHTML(row['ประเภท']||'-')}</td>
                    <td style="border:1px solid #e5e7eb;padding:5px 7px;font-size:10px;max-width:90px;overflow:hidden;">${escapeHTML(row['ผู้ขาย / Sup']||'-')}</td>
                    <td style="border:1px solid #e5e7eb;padding:5px 7px;">${escapeHTML(row['รายละเอียด']||'-')}</td>
                    <td style="border:1px solid #e5e7eb;padding:5px 7px;text-align:center;">${escapeHTML(row['จำนวน']||'-')}</td>
                    <td style="border:1px solid #e5e7eb;padding:5px 7px;text-align:right;">${unitP ? fmtMoney(unitP) : '-'}</td>
                    <td style="border:1px solid #e5e7eb;padding:5px 7px;text-align:right;color:#6b7280;">${vatAmt > 0 ? fmtMoney(vatAmt) : '-'}</td>
                    <td style="border:1px solid #e5e7eb;padding:5px 7px;text-align:right;font-weight:700;color:#e11d48;">฿${fmtMoney(final)}</td>
                    <td style="border:1px solid #e5e7eb;padding:5px 7px;">
                      <span style="font-size:9px;padding:1px 6px;border-radius:10px;font-weight:700;background:${isPaid?'#dcfce7':'#fef9c3'};color:${isPaid?'#166534':'#854d0e'};">${escapeHTML(row['สถานะจ่าย']||'เงินสด')}</span>
                      ${row['หมายเหตุ'] ? `<div style="font-size:9px;color:#6b7280;margin-top:2px;">${escapeHTML(row['หมายเหตุ'])}</div>` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f8fafc;">
                <td colspan="8" style="border:1px solid #d1d5db;padding:8px;text-align:right;font-weight:700;font-size:12px;">รวมทั้งสิ้น (${data.length} รายการ)</td>
                <td style="border:1px solid #d1d5db;padding:8px;text-align:right;font-size:12px;color:#6b7280;">${fmtMoney(grandVat)}</td>
                <td style="border:1px solid #d1d5db;padding:8px;text-align:right;font-weight:900;font-size:14px;color:#e11d48;">฿${fmtMoney(grandTotal)}</td>
                <td style="border:1px solid #d1d5db;"></td>
              </tr>
            </tfoot>
          </table>

          <!-- Signatures -->
          <div style="display:flex;justify-content:space-around;margin-top:36px;padding-top:16px;">
            ${['ผู้จัดทำรายงาน','ผู้ตรวจสอบ','ผู้อนุมัติ'].map(role=>`
              <div style="text-align:center;width:160px;">
                <div style="border-bottom:1px solid #9ca3af;height:40px;margin-bottom:8px;"></div>
                <div style="font-size:11px;color:#6b7280;">${role}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `}
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#cmPrintClose').onclick = () => overlay.remove();
    overlay.querySelector('#cmPrintBtn').onclick = () => window.print();
    overlay.querySelector('#cmDownloadBtn').onclick = async () => {
      if (!window.html2pdf) {
        // Lazy load html2pdf
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        }).catch(() => { toast('โหลด html2pdf ล้มเหลว', 'error'); return; });
      }
      const btn = overlay.querySelector('#cmDownloadBtn');
      btn.textContent = '⏳ กำลังสร้างไฟล์…';
      btn.disabled = true;
      if (document.fonts?.ready) await document.fonts.ready;
      const el = document.getElementById('cmPdfArea');
      if (!el) { btn.disabled=false; btn.textContent='⬇ ดาวน์โหลด PDF'; return; }
      const origW = el.style.width, origMW = el.style.maxWidth;
      el.style.width = '1123px'; el.style.maxWidth = '1123px';
      try {
        await window.html2pdf().set({
          margin: [10,10,10,10],
          filename: `${meta.title.replace(/\s+/g,'_')}_${_today()}.pdf`,
          image: { type:'jpeg', quality:1.0 },
          html2canvas: { scale:2, useCORS:true, logging:false, width:1123, windowWidth:1123, scrollX:0, scrollY:0 },
          jsPDF: { unit:'mm', format:'a4', orientation:'landscape' },
          pagebreak: { mode:['css','legacy'], avoid:'tr' }
        }).from(el).save();
        toast('ดาวน์โหลด PDF สำเร็จ', 'success');
      } catch(err) {
        toast('สร้าง PDF ล้มเหลว: ' + err.message, 'error');
      } finally {
        el.style.width = origW; el.style.maxWidth = origMW;
        btn.disabled=false; btn.textContent='⬇ ดาวน์โหลด PDF';
      }
    };
  }

  /* ---- Public API ---- */
  return { render };
})();
