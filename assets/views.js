/* ==========================================================================
 * Views — Dashboard / Jobs / Delivery / GatePass / Schedule / Costs
 * ========================================================================== */

const Views = (() => {
  const { state, fmtDate, fmtDateTime, fmtThaiDate, fmtNum, fmtMoney, escapeHTML } = App;

  // -------------------- Generic table view (shared) --------------------
  // `tableConfig`: { view, title, idColumn, columns: [{key,label,type,width,sortable}], onAdd, onEdit, onDelete }
  function renderGenericTable(cfg) {
    const topbar = document.getElementById('topbar');
    const root = document.getElementById('viewRoot');
    const view = cfg.view;
    const data = state.data[view] || [];

    topbar.innerHTML = `
      <div class="title">${escapeHTML(cfg.title)}</div>
      <div class="sub">ทั้งหมด ${data.length} รายการ</div>
      <div class="toolbar">
        ${cfg.headerExtra || ''}
        <button class="btn btn-success" data-action="add">+ เพิ่มรายการ</button>
        <button class="btn" data-action="export-excel">Export Excel</button>
        <button class="btn" data-action="export-pdf">Export PDF</button>
        <button class="btn btn-primary" data-action="save">💾 บันทึกทั้งหมด</button>
      </div>
    `;

    // Filter bar
    const fields = cfg.filterFields || [];
    const filterHtml = fields.map(f => {
      if (f.type === 'select') {
        const opts = (f.options || []).map(o => `<option value="${escapeHTML(o)}">${escapeHTML(o)}</option>`).join('');
        return `<div class="field"><label>${escapeHTML(f.label)}</label>
          <select data-filter="${escapeHTML(f.key)}"><option value="">ทั้งหมด</option>${opts}</select></div>`;
      }
      return `<div class="field"><label>${escapeHTML(f.label)}</label>
        <input type="${f.type || 'text'}" data-filter="${escapeHTML(f.key)}" placeholder="${escapeHTML(f.placeholder || '')}"></div>`;
    }).join('');

    root.innerHTML = `
      <div class="filters">
        <div class="field">
          <label>ค้นหา</label>
          <input type="search" data-filter="q" placeholder="พิมพ์คำที่ต้องการค้นหา..." />
        </div>
        ${filterHtml}
      </div>
      <div class="table-wrap">
        <table class="data" id="dataTable">
          <thead><tr id="tableHead"></tr></thead>
          <tbody id="tableBody"></tbody>
        </table>
      </div>
      <div class="flex" style="margin-top:10px;align-items:center;">
        <div class="muted" id="rowInfo"></div>
        <div class="flex-1"></div>
        <div class="flex" id="pager"></div>
      </div>
    `;

    // Wire toolbar
    topbar.querySelector('[data-action="add"]').onclick = () => cfg.onAdd && cfg.onAdd();
    topbar.querySelector('[data-action="save"]').onclick = async () => { await App.saveAll(); };
    topbar.querySelector('[data-action="export-excel"]').onclick = () => Exports.exportExcel(view, cfg.title);
    topbar.querySelector('[data-action="export-pdf"]').onclick = () => Exports.exportPDF(view, cfg.title, cfg.columns);

    // Wire filters
    root.querySelectorAll('[data-filter]').forEach(el => {
      const k = el.dataset.filter;
      el.value = state.filters[view][k] || '';
      el.addEventListener('input', () => {
        state.filters[view][k] = el.value;
        state.page[view] = 1;
        renderTableBody();
      });
    });

    renderTableHead();
    renderTableBody();

    function renderTableHead() {
      const tr = document.getElementById('tableHead');
      tr.innerHTML = cfg.columns.map(c => {
        const sort = state.sort[view];
        const arrow = sort && sort.key === c.key ? (sort.dir === 'desc' ? '▼' : '▲') : '';
        return `<th data-key="${escapeHTML(c.key)}" style="${c.width ? 'min-width:' + c.width : ''}">${escapeHTML(c.label)}<span class="sort-arrow">${arrow}</span></th>`;
      }).join('') + `<th style="min-width:${cfg.actionColWidth || '140px'}">การกระทำ</th>`;
      tr.querySelectorAll('th[data-key]').forEach(th => {
        th.onclick = () => {
          const key = th.dataset.key;
          const cur = state.sort[view] || {};
          if (cur.key === key) cur.dir = cur.dir === 'desc' ? 'asc' : 'desc';
          else { cur.key = key; cur.dir = 'asc'; }
          state.sort[view] = cur;
          renderTableHead();
          renderTableBody();
        };
      });
    }

    function renderTableBody() {
      const filtered = App.sortRows(view, App.filterRows(view, state.data[view]));
      const total = filtered.length;
      const page = state.page[view] || 1;
      const ps = state.pageSize;
      const pageRows = filtered.slice((page-1)*ps, page*ps);

      document.getElementById('rowInfo').textContent =
        total ? `แสดง ${(page-1)*ps + 1}-${Math.min(page*ps, total)} จาก ${total} รายการ`
              : `ไม่พบรายการ`;

      const tbody = document.getElementById('tableBody');
      if (!pageRows.length) {
        tbody.innerHTML = `<tr><td colspan="${cfg.columns.length+1}" class="muted" style="text-align:center;padding:40px;">ไม่พบข้อมูล</td></tr>`;
      } else {
        tbody.innerHTML = pageRows.map((row, idx) => {
          const realIdx = state.data[view].indexOf(row);
          const cells = cfg.columns.map(c => renderCell(row, c)).join('');
          const extraBtns = (cfg.rowActions || []).map(a =>
            `<button class="btn btn-sm ${a.cls||''}" data-x="${escapeHTML(a.id)}" title="${escapeHTML(a.title||a.label)}">${escapeHTML(a.label)}</button>`
          ).join('');
          return `<tr data-idx="${realIdx}">${cells}<td class="actions">
            ${extraBtns}
            <button class="btn btn-sm" data-edit>แก้ไข</button>
            <button class="btn btn-sm btn-danger" data-del>ลบ</button>
          </td></tr>`;
        }).join('');
        tbody.querySelectorAll('tr').forEach(tr => {
          const idx = parseInt(tr.dataset.idx, 10);
          tr.querySelector('[data-edit]').onclick = () => cfg.onEdit && cfg.onEdit(idx);
          tr.querySelector('[data-del]').onclick = async () => {
            if (await App.confirmDialog('ต้องการลบรายการนี้หรือไม่?', { danger: true, confirmText: 'ลบ' })) {
              cfg.onDelete && cfg.onDelete(idx);
            }
          };
          (cfg.rowActions || []).forEach(a => {
            const btn = tr.querySelector(`[data-x="${a.id}"]`);
            if (btn) btn.onclick = () => a.handler(idx, state.data[view][idx]);
          });
          if (cfg.onRowDetail) {
            tr.querySelectorAll('.detail-link').forEach(el => {
              el.onclick = e => { e.stopPropagation(); cfg.onRowDetail(idx); };
            });
          }
        });
      }

      // Pager
      const pager = document.getElementById('pager');
      const pages = Math.max(1, Math.ceil(total/ps));
      const cur = page;
      const btns = [];
      btns.push(`<button class="btn btn-sm" ${cur<=1?'disabled':''} data-pg="prev">‹ ก่อน</button>`);
      btns.push(`<span class="muted" style="padding:6px 8px;">หน้า ${cur} / ${pages}</span>`);
      btns.push(`<button class="btn btn-sm" ${cur>=pages?'disabled':''} data-pg="next">ถัดไป ›</button>`);
      pager.innerHTML = btns.join('');
      pager.querySelector('[data-pg="prev"]').onclick = () => { state.page[view] = Math.max(1, cur-1); renderTableBody(); };
      pager.querySelector('[data-pg="next"]').onclick = () => { state.page[view] = Math.min(pages, cur+1); renderTableBody(); };
    }

    function renderCell(row, c) {
      let v = row[c.key];
      let cls = '';
      if (c.type === 'date') v = fmtDate(v);
      else if (c.type === 'datetime') v = fmtDateTime(v);
      else if (c.type === 'thaiDate') v = fmtThaiDate(v);
      else if (c.type === 'number') { v = fmtNum(v, 0); cls = 'num'; }
      else if (c.type === 'money') { v = fmtMoney(v); cls = 'num'; }
      else if (c.type === 'status') {
        v = renderStatusPill(v);
      } else if (c.type === 'file') {
        v = renderFileLinks(v);
      } else if (c.type === 'long') {
        cls = 'wrap';
        v = escapeHTML(v);
      } else if (c.type === 'detail') {
        cls = 'wrap';
        v = v ? `<span class="detail-link" style="cursor:pointer;color:#2563eb;text-decoration:underline dotted;" title="คลิกเพื่อดูรายละเอียดเต็ม">${escapeHTML(v)}</span>` : '';
      } else {
        v = escapeHTML(v);
      }
      return `<td class="${cls}">${v ?? ''}</td>`;
    }
  }

  function renderStatusPill(s) {
    if (!s) return '';
    const t = String(s).trim();
    let cls = 'pill-grey';
    if (/เสร็จ|ส่งงานแล้ว|completed/i.test(t)) cls = 'pill-green';
    else if (/กำลัง|ดำเนินการ|in.?progress/i.test(t)) cls = 'pill-blue';
    else if (/รอ|pending|waiting/i.test(t)) cls = 'pill-yellow';
    else if (/ยกเลิก|cancel|fail/i.test(t)) cls = 'pill-red';
    return `<span class="pill ${cls}">${escapeHTML(t)}</span>`;
  }

  function renderFileLinks(v) {
    if (!v) return '';
    const items = String(v).split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    return items.map(p => {
      if (/^https?:/i.test(p)) {
        return `<a href="${escapeHTML(p)}" target="_blank" class="file-link">🔗 ลิงก์</a>`;
      }
      let displayName;
      if (p.startsWith('drive:')) {
        const m = p.substring(6).split('|');
        displayName = m[1] || m[0];
      } else {
        displayName = p.split('/').pop();
      }
      return `<a href="#" data-attach="${escapeHTML(p)}" class="file-link">📎 ${escapeHTML(displayName)}</a>`;
    }).join(' ');
  }

  // Delegate clicks for attachment links (open via FileHandle)
  document.addEventListener('click', async (ev) => {
    const a = ev.target.closest('[data-attach]');
    if (!a) return;
    ev.preventDefault();
    const url = await App.getAttachmentURL(a.dataset.attach);
    if (url) window.open(url, '_blank');
    else App.toast('ไม่พบไฟล์แนบ', 'error');
  });

  // -------------------- DASHBOARD --------------------
  let _chartJsLoaded = false;
  async function _loadChartJs() {
    if (_chartJsLoaded || window.Chart) { _chartJsLoaded = true; return; }
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      s.onload = () => { _chartJsLoaded = true; res(); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  function dashboard() {
    const topbar = document.getElementById('topbar');
    const root = document.getElementById('viewRoot');

    const jobs = state.data.jobs;
    const delivery = state.data.delivery;
    const gp = state.data.gatepass;
    const sched = state.data.schedule;
    const costs = state.data.costs;
    const today = new Date(); today.setHours(0,0,0,0);

    // ---- Stats ----
    const statusCount = {};
    for (const j of jobs) {
      const s = (j['สถานะ'] || '').toString().trim() || 'ไม่ระบุ';
      statusCount[s] = (statusCount[s] || 0) + 1;
    }
    const typeCount = {};
    for (const j of jobs) {
      const t = (j['ประเภท'] || '').toString().trim() || 'ไม่ระบุ';
      typeCount[t] = (typeCount[t] || 0) + 1;
    }
    const assigneeCount = {};
    for (const j of jobs) {
      const a = (j['ผู้รับผิดชอบ'] || '').toString().trim() || 'ไม่ระบุ';
      assigneeCount[a] = (assigneeCount[a] || 0) + 1;
    }

    // Year-month breakdown (for multi-line year trend)
    const yearMonthData = {};
    for (const j of jobs) {
      const d = j['วันที่'] instanceof Date ? j['วันที่'] : (j['วันที่'] ? new Date(j['วันที่']) : null);
      if (!d || isNaN(d.getTime())) continue;
      const yr = d.getFullYear(); const mo = d.getMonth();
      if (!yearMonthData[yr]) yearMonthData[yr] = new Array(12).fill(0);
      yearMonthData[yr][mo]++;
    }

    // Monthly trend last 24 months
    const now = new Date();
    const monthlyMap = {};
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      monthlyMap[key] = 0;
    }
    for (const j of jobs) {
      const d = j['วันที่'] instanceof Date ? j['วันที่'] : (j['วันที่'] ? new Date(j['วันที่']) : null);
      if (!d || isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (key in monthlyMap) monthlyMap[key]++;
    }

    const outstanding = jobs.filter(j => !/เสร็จ|ส่งงานแล้ว|completed|close/i.test((j['สถานะ']||'').toString().trim()));
    const overdue = sched.filter(t => {
      if (!t.EndDate) return false;
      const ed = t.EndDate instanceof Date ? t.EndDate : new Date(t.EndDate);
      return ed < today && !/เสร็จ|สำเร็จ|complete/i.test((t.Status||'').trim());
    });
    const totalCostsVat    = costs.reduce((s,r) => s + (Number(r['จำนวนเงินรวม Vat'])||0), 0);
    const totalCostsNoVat  = costs.reduce((s,r) => s + (Number(r['จำนวนเงินรวม'])||0), 0);
    const recentJobs = [...jobs].sort((a,b) => {
      const ta = new Date((a['วันที่ลงบันทึก']||a['วันที่'])||0).getTime();
      const tb = new Date((b['วันที่ลงบันทึก']||b['วันที่'])||0).getTime();
      return tb - ta;
    }).slice(0, 10);
    const lastJob = recentJobs[0] || null;
    const topAssignees = Object.entries(assigneeCount).sort((a,b)=>b[1]-a[1]).slice(0,5);

    // ---- Topbar ----
    topbar.innerHTML = `
      <div class="title">หน้าแรก / Dashboard</div>
      <div class="sub">${state.folderName ? escapeHTML(state.folderName) : ''}</div>
      <div class="toolbar">
        <button class="btn btn-success" id="btnQuickAdd2">➕ งานใหม่</button>
        <button class="btn btn-primary" id="btnSaveAll">💾 บันทึกทั้งหมด</button>
      </div>
    `;
    document.getElementById('btnSaveAll').onclick = () => App.saveAll();
    document.getElementById('btnQuickAdd2').onclick = () => Forms.openJob(null);

    // ---- HTML ----
    root.innerHTML = `
      <!-- Quick actions -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
        <button class="btn btn-success" id="btnQuickAdd" style="font-size:14px;padding:9px 20px;border-radius:8px;font-weight:600;">➕ บันทึกงานใหม่</button>
        <button class="btn btn-primary" id="btnPrintLast" ${lastJob?'':'disabled'} style="font-size:14px;padding:9px 20px;border-radius:8px;">
          🖨 พิมพ์ใบล่าสุด ${lastJob ? '('+escapeHTML(lastJob['เลขที่']||'')+')' : ''}
        </button>
        <button class="btn" id="btnGoJobsAll" style="font-size:14px;padding:9px 20px;border-radius:8px;">📋 ใบงานทั้งหมด</button>
        <button class="btn ${outstanding.length>0?'btn-warning':''}" id="btnGoOutstanding" style="font-size:14px;padding:9px 20px;border-radius:8px;">
          ⏳ งานค้าง (${outstanding.length})
        </button>
      </div>

      <!-- Stat cards -->
      <div class="stats-grid" style="margin-bottom:20px;">
        <div class="stat-card primary" style="cursor:pointer;" id="scJobsAll">
          <div class="label">📋 ใบงานทั้งหมด</div>
          <div class="value">${jobs.length.toLocaleString()}</div>
          <div class="delta">รายการในระบบ</div>
        </div>
        <div class="stat-card warning" style="cursor:pointer;" id="scOutstanding">
          <div class="label">⏳ งานค้าง / ยังไม่เสร็จ</div>
          <div class="value">${outstanding.length.toLocaleString()}</div>
          <div class="delta">${jobs.length ? Math.round(outstanding.length/jobs.length*100) : 0}% ของทั้งหมด</div>
        </div>
        <div class="stat-card success">
          <div class="label">📦 ใบส่งของ / GatePass</div>
          <div class="value">${delivery.length + gp.length}</div>
          <div class="delta">${delivery.length} ใบส่งของ · ${gp.length} gatepass</div>
        </div>
        <div class="stat-card ${overdue.length>0?'danger':'primary'}" style="cursor:${overdue.length>0?'pointer':'default'};" id="scOverdue">
          <div class="label">⚠️ Schedule เลยกำหนด</div>
          <div class="value">${overdue.length}</div>
          <div class="delta">${sched.length} งาน schedule ทั้งหมด</div>
        </div>
        <div class="stat-card success">
          <div class="label">💰 ค่าใช้จ่าย (ไม่รวม VAT)</div>
          <div class="value" style="font-size:1.05rem;">${fmtMoney(totalCostsNoVat)}</div>
          <div class="delta">บาท</div>
        </div>
        <div class="stat-card warning">
          <div class="label">💳 ค่าใช้จ่าย (รวม VAT)</div>
          <div class="value" style="font-size:1.05rem;">${fmtMoney(totalCostsVat)}</div>
          <div class="delta">${costs.length} รายการ</div>
        </div>
      </div>

      <!-- Charts row -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:0;" id="chartsRow">
        <div class="panel" style="margin:0;">
          <div class="panel-header" style="font-size:13px;font-weight:600;">สถานะใบงาน <span style="font-size:11px;color:#9ca3af;font-weight:400;">(คลิกดูรายการ)</span></div>
          <div class="panel-body" style="padding:12px;height:230px;display:flex;align-items:center;justify-content:center;">
            <canvas id="chartStatus"></canvas>
          </div>
        </div>
        <div class="panel" style="margin:0;">
          <div class="panel-header" style="font-size:13px;font-weight:600;">ประเภทงาน <span style="font-size:11px;color:#9ca3af;font-weight:400;">(คลิกดูรายการ)</span></div>
          <div class="panel-body" style="padding:12px;height:230px;display:flex;align-items:center;justify-content:center;">
            <canvas id="chartType"></canvas>
          </div>
        </div>
        <div class="panel" style="margin:0;">
          <div class="panel-header" style="font-size:13px;font-weight:600;">ผู้รับผิดชอบ (Top 5) <span style="font-size:11px;color:#9ca3af;font-weight:400;">(คลิกดูรายการ)</span></div>
          <div class="panel-body" style="padding:12px;height:230px;display:flex;align-items:center;justify-content:center;">
            <canvas id="chartAssignee"></canvas>
          </div>
        </div>
      </div>

      <!-- Chart detail panel (filtered jobs on click) -->
      <div id="chartDetailPanel" style="display:none;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px 16px;margin:12px 0 4px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <strong id="chartDetailTitle" style="font-size:14px;color:#0c4a6e;"></strong>
          <button class="btn btn-sm btn-ghost" id="btnCloseDetail">✕ ปิด</button>
        </div>
        <div id="chartDetailBody"></div>
      </div>

      <!-- Trend chart with year/month toggle -->
      <div class="panel" style="margin-bottom:16px;margin-top:16px;">
        <div class="panel-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
          <span style="font-size:13px;font-weight:600;">📈 จำนวนงานใหม่</span>
          <div style="display:flex;gap:4px;background:#f1f5f9;padding:3px;border-radius:8px;">
            <button class="trend-toggle" data-mode="month" style="padding:4px 14px;font-size:12px;border-radius:6px;border:none;cursor:pointer;transition:all .15s;">รายเดือน</button>
            <button class="trend-toggle" data-mode="year" style="padding:4px 14px;font-size:12px;border-radius:6px;border:none;cursor:pointer;transition:all .15s;">รายปี</button>
          </div>
        </div>
        <div class="panel-body" style="padding:12px 16px;height:200px;">
          <canvas id="chartTrend"></canvas>
        </div>
      </div>

      <!-- Outstanding jobs -->
      <div class="panel" style="margin-bottom:16px;" id="outstandingPanel">
        <div class="panel-header" style="display:flex;align-items:center;justify-content:space-between;">
          <span>⏳ งานค้าง <span style="color:#f59e0b;font-weight:700;">${outstanding.length}</span> รายการ</span>
          <button class="btn btn-sm" id="btnGoJobs">ดูใบงานทั้งหมด →</button>
        </div>
        <div class="panel-body" style="padding:0;">
          <div class="table-wrap" style="border:none;border-radius:0;max-height:280px;">
            <table class="data">
              <thead><tr><th>วันที่</th><th>เลขที่</th><th>รายละเอียด</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th><th></th></tr></thead>
              <tbody>
                ${outstanding.length === 0
                  ? '<tr><td colspan="6" class="muted" style="text-align:center;padding:30px;">✅ ไม่มีงานค้าง ยอดเยี่ยม!</td></tr>'
                  : outstanding.slice(0, 20).map(j => {
                      const jidx = state.data.jobs.indexOf(j);
                      return `<tr>
                        <td style="white-space:nowrap;">${fmtDate(j['วันที่'])}</td>
                        <td style="white-space:nowrap;">${escapeHTML(j['เลขที่']||'')}</td>
                        <td class="wrap">${escapeHTML((j['รายละเอียด']||'').toString().slice(0,100))}${(j['รายละเอียด']||'').toString().length>100?'…':''}</td>
                        <td>${escapeHTML(j['ผู้รับผิดชอบ']||'')}</td>
                        <td>${renderStatusPill(j['สถานะ'])}</td>
                        <td class="actions" style="white-space:nowrap;">
                          <button class="btn btn-sm" data-editjob="${jidx}">แก้ไข</button>
                          <button class="btn btn-sm btn-primary" data-printjob="${jidx}">🖨</button>
                        </td>
                      </tr>`;
                    }).join('')}
                ${outstanding.length > 20 ? `<tr><td colspan="6" class="muted" style="text-align:center;padding:10px;">และอีก ${outstanding.length-20} รายการ...</td></tr>` : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Recent jobs -->
      <div class="panel" style="margin-bottom:16px;">
        <div class="panel-header">🕐 งานล่าสุด (10 รายการ)</div>
        <div class="panel-body" style="padding:0;">
          <div class="table-wrap" style="border:none;border-radius:0;max-height:280px;">
            <table class="data">
              <thead><tr><th>วันที่</th><th>เลขที่</th><th>รายละเอียด</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th><th></th></tr></thead>
              <tbody>
                ${recentJobs.length === 0 ? '<tr><td colspan="6" class="muted" style="text-align:center;padding:30px;">ไม่มีข้อมูล</td></tr>' :
                  recentJobs.map(j => {
                    const jidx = state.data.jobs.indexOf(j);
                    return `<tr>
                      <td style="white-space:nowrap;">${fmtDate(j['วันที่'])}</td>
                      <td style="white-space:nowrap;">${escapeHTML(j['เลขที่']||'')}</td>
                      <td class="wrap">${escapeHTML((j['รายละเอียด']||'').toString().slice(0,100))}${(j['รายละเอียด']||'').toString().length>100?'…':''}</td>
                      <td>${escapeHTML(j['ผู้รับผิดชอบ']||'')}</td>
                      <td>${renderStatusPill(j['สถานะ'])}</td>
                      <td class="actions"><button class="btn btn-sm" data-editjob="${jidx}">แก้ไข</button></td>
                    </tr>`;
                  }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${overdue.length > 0 ? `
      <div class="panel" style="margin-bottom:16px;border-left:4px solid #ef4444;">
        <div class="panel-header">⚠️ Schedule เลยกำหนด (${overdue.length} งาน)</div>
        <div class="panel-body" style="padding:0;">
          <div class="table-wrap" style="border:none;border-radius:0;max-height:240px;">
            <table class="data">
              <thead><tr><th>DocNo</th><th>งาน</th><th>ผู้รับผิดชอบ</th><th>กำหนดส่ง</th><th>สถานะ</th></tr></thead>
              <tbody>
                ${overdue.slice(0,15).map(t=>`<tr>
                  <td>${escapeHTML(t.DocNo||'')}</td>
                  <td>${escapeHTML(t.TaskName||'')}</td>
                  <td>${escapeHTML(t.Assignee||'')}</td>
                  <td style="color:#ef4444;font-weight:600;">${fmtDate(t.EndDate)}</td>
                  <td>${renderStatusPill(t.Status)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>` : ''}
    `;

    // Wire buttons
    const q = id => document.getElementById(id);
    if (q('btnQuickAdd'))     q('btnQuickAdd').onclick = () => Forms.openJob(null);
    if (q('btnGoJobs'))       q('btnGoJobs').onclick = () => render('jobs');
    if (q('btnGoJobsAll'))    q('btnGoJobsAll').onclick = () => render('jobs');
    if (q('btnGoOutstanding')) q('btnGoOutstanding').onclick = () => q('outstandingPanel').scrollIntoView({ behavior:'smooth' });
    if (q('scJobsAll'))       q('scJobsAll').onclick = () => render('jobs');
    if (q('scOutstanding'))   q('scOutstanding').onclick = () => q('outstandingPanel').scrollIntoView({ behavior:'smooth' });
    if (q('btnPrintLast') && lastJob) {
      q('btnPrintLast').onclick = () => {
        const idx = state.data.jobs.indexOf(lastJob);
        if (idx >= 0) Print.printWorkRequest(idx);
      };
    }
    if (q('btnCloseDetail')) q('btnCloseDetail').onclick = () => { q('chartDetailPanel').style.display = 'none'; };
    root.querySelectorAll('[data-editjob]').forEach(b  => b.onclick  = () => Forms.openJob(parseInt(b.dataset.editjob, 10)));
    root.querySelectorAll('[data-printjob]').forEach(b => b.onclick  = () => Print.printWorkRequest(parseInt(b.dataset.printjob, 10)));

    // Trend toggle state
    function setTrendMode(mode) {
      root.querySelectorAll('.trend-toggle').forEach(b => {
        const active = b.dataset.mode === mode;
        b.style.background    = active ? '#fff' : 'transparent';
        b.style.boxShadow     = active ? '0 1px 3px rgba(0,0,0,.12)' : 'none';
        b.style.color         = active ? '#1e3a5f' : '#6b7280';
        b.style.fontWeight    = active ? '600' : '400';
      });
      if (window.Chart) _renderTrendChart(mode, yearMonthData, monthlyMap);
    }
    root.querySelectorAll('.trend-toggle').forEach(b => { b.onclick = () => setTrendMode(b.dataset.mode); });

    // Filter helper used by chart onClick
    function onChartFilter(filterKey, filterVal) {
      const panel = q('chartDetailPanel');
      if (!filterVal) { panel.style.display = 'none'; return; }
      const filtered = state.data.jobs.filter(j => (j[filterKey]||'').toString().trim() === filterVal);
      q('chartDetailTitle').textContent = `${filterKey}: ${filterVal} — ${filtered.length} รายการ`;
      q('chartDetailBody').innerHTML = `
        <div class="table-wrap" style="max-height:220px;">
          <table class="data">
            <thead><tr><th>วันที่</th><th>เลขที่</th><th>รายละเอียด</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              ${filtered.slice(0,20).map(j => {
                const jidx = state.data.jobs.indexOf(j);
                return `<tr>
                  <td style="white-space:nowrap;">${fmtDate(j['วันที่'])}</td>
                  <td style="white-space:nowrap;">${escapeHTML(j['เลขที่']||'')}</td>
                  <td class="wrap">${escapeHTML((j['รายละเอียด']||'').toString().slice(0,80))}</td>
                  <td>${escapeHTML(j['ผู้รับผิดชอบ']||'')}</td>
                  <td>${renderStatusPill(j['สถานะ'])}</td>
                  <td><button class="btn btn-sm" data-cdf="${jidx}">แก้ไข</button></td>
                </tr>`;
              }).join('')}
              ${filtered.length > 20 ? `<tr><td colspan="6" class="muted" style="text-align:center;padding:8px;">และอีก ${filtered.length-20} รายการ</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      `;
      panel.style.display = 'block';
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      panel.querySelectorAll('[data-cdf]').forEach(b => { b.onclick = () => Forms.openJob(parseInt(b.dataset.cdf, 10)); });
    }

    // Load Chart.js and render
    _loadChartJs().then(() => {
      _renderDashboardCharts({ statusCount, typeCount, topAssignees, onFilter: onChartFilter });
      setTrendMode('month');
    }).catch(() => {
      q('chartsRow').innerHTML = '<div class="muted" style="padding:20px;text-align:center;grid-column:1/-1;">ไม่สามารถโหลด Chart.js ได้ (ต้องมีอินเทอร์เน็ต)</div>';
    });
  }

  function _renderTrendChart(mode, yearMonthData, monthlyMap) {
    const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const LINE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316'];
    const canvas = document.getElementById('chartTrend');
    if (!canvas) return;
    const existing = Chart.getChart(canvas);
    if (existing) existing.destroy();

    if (mode === 'year') {
      const years = Object.keys(yearMonthData).map(Number).sort();
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: MONTHS_TH,
          datasets: years.map((yr, i) => ({
            label: `ปี ${yr + 543}`,
            data: yearMonthData[yr],
            borderColor: LINE_COLORS[i % LINE_COLORS.length],
            backgroundColor: 'transparent',
            tension: 0.4, pointRadius: 4, borderWidth: 2.5,
            pointBackgroundColor: LINE_COLORS[i % LINE_COLORS.length]
          }))
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { font: { family: 'inherit', size: 11 }, boxWidth: 12 } } },
          scales: {
            x: { ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } }
          }
        }
      });
    } else {
      function makeShortMonth(key) {
        const [y, m] = key.split('-');
        return MONTHS_TH[parseInt(m,10)-1] + ' ' + String(parseInt(y)+543).slice(-2);
      }
      const labels = Object.keys(monthlyMap).map(makeShortMonth);
      const data = Object.values(monthlyMap);
      new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'งานใหม่', data,
            borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)',
            fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#3b82f6', borderWidth: 2
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { font: { size: 11 } } },
            y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } }
          }
        }
      });
    }
  }

  function _renderDashboardCharts({ statusCount, typeCount, topAssignees, onFilter }) {
    const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899'];

    ['chartStatus','chartType','chartAssignee'].forEach(id => {
      const c = document.getElementById(id);
      if (c) { const ex = Chart.getChart(c); if (ex) ex.destroy(); }
    });

    function clickHandler(filterKey) {
      return (event, activeElements, chart) => {
        if (!activeElements.length) return;
        const label = chart.data.labels[activeElements[0].index];
        onFilter(filterKey, label);
      };
    }

    const statusCanvas = document.getElementById('chartStatus');
    if (statusCanvas && Object.keys(statusCount).length > 0) {
      new Chart(statusCanvas, {
        type: 'doughnut',
        data: {
          labels: Object.keys(statusCount),
          datasets: [{ data: Object.values(statusCount), backgroundColor: COLORS, borderWidth: 2, hoverOffset: 8 }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          onClick: clickHandler('สถานะ'),
          plugins: {
            legend: { labels: { font: { family: 'inherit', size: 11 }, boxWidth: 12 } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} งาน` } }
          }
        }
      });
    }

    const typeCanvas = document.getElementById('chartType');
    if (typeCanvas && Object.keys(typeCount).length > 0) {
      new Chart(typeCanvas, {
        type: 'doughnut',
        data: {
          labels: Object.keys(typeCount),
          datasets: [{ data: Object.values(typeCount), backgroundColor: COLORS.slice(2), borderWidth: 2, hoverOffset: 8 }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          onClick: clickHandler('ประเภท'),
          plugins: {
            legend: { labels: { font: { family: 'inherit', size: 11 }, boxWidth: 12 } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} งาน` } }
          }
        }
      });
    }

    const assigneeCanvas = document.getElementById('chartAssignee');
    if (assigneeCanvas && topAssignees.length > 0) {
      new Chart(assigneeCanvas, {
        type: 'bar',
        data: {
          labels: topAssignees.map(a => a[0]),
          datasets: [{ label: 'จำนวนงาน', data: topAssignees.map(a => a[1]),
            backgroundColor: COLORS, borderRadius: 6, borderSkipped: false }]
        },
        options: {
          indexAxis: 'y', responsive: true, maintainAspectRatio: true,
          onClick: clickHandler('ผู้รับผิดชอบ'),
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => ` ${ctx.raw} งาน` } }
          },
          scales: {
            x: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } },
            y: { ticks: { font: { size: 11 } } }
          }
        }
      });
    }
  }

  // -------------------- HELPERS --------------------
  function collectUnique(view, key) {
    const vals = new Set();
    (state.data[view] || []).forEach(r => { if (r[key]) vals.add(r[key]); });
    return [...vals].sort();
  }

  // -------------------- JOBS (ชีต1) --------------------
  function jobsView() {
    renderGenericTable({
      view: 'jobs',
      title: 'ใบงาน (Jobs)',
      actionColWidth: '240px',
      columns: [
        { key: 'วันที่', label: 'วันที่', type: 'date' },
        { key: 'เลขที่', label: 'เลขที่' },
        { key: 'PO', label: 'PO' },
        { key: 'บริษัท', label: 'บริษัท' },
        { key: 'ประเภท', label: 'ประเภท' },
        { key: 'รายละเอียด', label: 'รายละเอียด', type: 'detail' }, // คลิกดูรายละเอียด
        { key: 'สถานะ', label: 'สถานะ', type: 'status' },
        { key: 'ผู้รับผิดชอบ', label: 'ผู้รับผิดชอบ' },
        { key: 'จำนวน', label: 'จำนวน', type: 'number' },
        { key: 'จำนวนที่ส่ง', label: 'ส่งแล้ว', type: 'number' },
        { key: 'จำนวนค้างส่ง', label: 'ค้างส่ง', type: 'number' },
        { key: 'เอกสาร', label: 'เอกสารแนบ', type: 'file' },
        { key: 'รูปปิดงาน', label: 'รูปปิดงาน', type: 'file' }
      ],
      filterFields: [
        { key: 'บริษัท', label: 'บริษัท', type: 'select', options: collectUnique('jobs', 'บริษัท') },
        { key: 'ประเภท', label: 'ประเภท', type: 'select', options: collectUnique('jobs', 'ประเภท') },
        { key: 'สถานะ', label: 'สถานะ', type: 'select', options: collectUnique('jobs', 'สถานะ') },
        { key: 'ผู้รับผิดชอบ', label: 'ผู้รับผิดชอบ', type: 'select', options: collectUnique('jobs', 'ผู้รับผิดชอบ') }
      ],
      rowActions: [
        { id: 'print',    label: '🖨',  cls: 'btn-primary', title: 'พิมพ์ใบแจ้งงาน',
          handler: idx => Print.printWorkRequest(idx) },
        { id: 'delivery', label: '📦',  cls: 'btn-success', title: 'สร้างใบส่งของ',
          handler: idx => Forms.createDeliveryFromJob(idx) },
        { id: 'schedule', label: '📅',  cls: '',            title: 'วางแผนงาน',
          handler: idx => Forms.createScheduleFromJob(idx) },
        { id: 'cost',     label: '💰',  cls: '',            title: 'เพิ่มต้นทุน',
          handler: idx => Forms.createCostFromJob(idx) }
      ],
      onRowDetail: idx => Forms.openJobDetail(idx),
      onAdd: () => Forms.openJob(null),
      onEdit: idx => Forms.openJob(idx),
      onDelete: async idx => {
        state.data.jobs.splice(idx, 1);
        await App.saveAll();
        render('jobs');
      }
    });
  }

  // -------------------- DELIVERY --------------------
  function deliveryView() {
    LogisticsManager.initDelivery();
    LogisticsManager.renderDelivery();
  }

  // -------------------- GATEPASS --------------------
  function gatepassView() {
    LogisticsManager.initGatePass();
    LogisticsManager.renderGatePass();
  }

  // -------------------- SCHEDULE --------------------
  function scheduleView() {
    ScheduleManager.render();
  }

  // -------------------- RETURN --------------------
  function render(view) {
    document.querySelectorAll('.nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.view === view));
    switch (view) {
      case 'dashboard': dashboard(); break;
      case 'jobs':      jobsView(); break;
      case 'delivery':  deliveryView(); break;
      case 'gatepass':  gatepassView(); break;
      case 'schedule':  scheduleView(); break;
      case 'costs':     costsView(); break;
      default:          dashboard();
    }
  }

  function costsView() {
    CostsManager.render();
  }

  return { render, dashboard, jobsView, deliveryView, gatepassView, scheduleView, costsView };
})();
