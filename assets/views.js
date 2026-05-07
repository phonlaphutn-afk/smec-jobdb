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
      }).join('') + '<th style="min-width:140px">การกระทำ</th>';
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
  function dashboard() {
    const topbar = document.getElementById('topbar');
    const root = document.getElementById('viewRoot');

    const jobs = state.data.jobs;
    const delivery = state.data.delivery;
    const gp = state.data.gatepass;
    const sched = state.data.schedule;
    const costs = state.data.costs;

    const statusCount = {};
    for (const j of jobs) {
      const s = (j['สถานะ'] || '').toString().trim() || 'ไม่ระบุ';
      statusCount[s] = (statusCount[s] || 0) + 1;
    }
    const totalCostsVat = costs.reduce((s, r) => s + (Number(r['จำนวนเงินรวม Vat']) || 0), 0);
    const totalCostsNoVat = costs.reduce((s, r) => s + (Number(r['จำนวนเงินรวม']) || 0), 0);

    // Recent jobs
    const recentJobs = [...jobs].sort((a,b) => {
      const da = a['วันที่'] instanceof Date ? a['วันที่'].getTime() : new Date(a['วันที่']||0).getTime();
      const db_ = b['วันที่'] instanceof Date ? b['วันที่'].getTime() : new Date(b['วันที่']||0).getTime();
      return db_ - da;
    }).slice(0, 8);

    // overdue tasks (Schedule)
    const today = new Date(); today.setHours(0,0,0,0);
    const overdue = sched.filter(t => {
      if (!t.EndDate) return false;
      const ed = t.EndDate instanceof Date ? t.EndDate : new Date(t.EndDate);
      const status = (t.Status||'').trim();
      return ed < today && !/เสร็จ|สำเร็จ|complete/i.test(status);
    });

    topbar.innerHTML = `
      <div class="title">หน้าแรก / Dashboard</div>
      <div class="sub">${state.folderName ? 'โฟลเดอร์: ' + escapeHTML(state.folderName) : ''}</div>
      <div class="toolbar">
        <button class="btn btn-primary" id="btnSaveAll">💾 บันทึกทั้งหมด</button>
      </div>
    `;
    document.getElementById('btnSaveAll').onclick = () => App.saveAll();

    // Most recent job for quick print
    const lastJob = jobs.length ? [...jobs].sort((a,b) => {
      const da = a['วันที่ลงบันทึก'] instanceof Date ? a['วันที่ลงบันทึก'].getTime() : new Date(a['วันที่ลงบันทึก']||a['วันที่']||0).getTime();
      const db = b['วันที่ลงบันทึก'] instanceof Date ? b['วันที่ลงบันทึก'].getTime() : new Date(b['วันที่ลงบันทึก']||b['วันที่']||0).getTime();
      return db - da;
    })[0] : null;

    root.innerHTML = `
      <!-- Quick action panel -->
      <div class="panel" style="border-top:3px solid var(--primary);">
        <div class="panel-header">⚡ ทำงานด่วน</div>
        <div class="panel-body" style="display:flex;gap:12px;flex-wrap:wrap;">
          <button class="btn btn-success" id="btnQuickAdd" style="font-size:15px;padding:12px 22px;">
            ➕ บันทึกงานใหม่ (ใบแจ้งงาน)
          </button>
          <button class="btn btn-primary" id="btnPrintLast" ${lastJob ? '' : 'disabled'} style="font-size:15px;padding:12px 22px;">
            🖨 พิมพ์ใบแจ้งงานล่าสุด ${lastJob ? '('+escapeHTML(lastJob['เลขที่']||'')+')' : ''}
          </button>
          <button class="btn" id="btnGoJobsAll" style="font-size:14px;padding:12px 18px;">
            📋 ดูใบงานทั้งหมด
          </button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card primary"><div class="label">ใบงานทั้งหมด</div><div class="value">${jobs.length.toLocaleString()}</div><div class="delta">รายการในชีต1</div></div>
        <div class="stat-card success"><div class="label">ใบส่งของชั่วคราว</div><div class="value">${delivery.length.toLocaleString()}</div><div class="delta">รายการ</div></div>
        <div class="stat-card warning"><div class="label">GatePass</div><div class="value">${gp.length.toLocaleString()}</div><div class="delta">ใบขอผ่านประตู</div></div>
        <div class="stat-card primary"><div class="label">Schedule Tasks</div><div class="value">${sched.length.toLocaleString()}</div><div class="delta">${overdue.length} เลยกำหนด</div></div>
        <div class="stat-card success"><div class="label">ยอดค่าใช้จ่าย (รวม VAT)</div><div class="value">${fmtMoney(totalCostsVat)}</div><div class="delta">${costs.length} รายการ</div></div>
        <div class="stat-card warning"><div class="label">ยอดค่าใช้จ่าย (ไม่รวม VAT)</div><div class="value">${fmtMoney(totalCostsNoVat)}</div><div class="delta">บาท</div></div>
      </div>

      <div class="panel">
        <div class="panel-header">สรุปสถานะใบงาน</div>
        <div class="panel-body">
          ${Object.keys(statusCount).length === 0 ? '<div class="muted">ยังไม่มีข้อมูลใบงาน</div>' :
            Object.entries(statusCount).map(([s,c]) =>
              `<div style="display:inline-block;margin:4px 8px 4px 0;">${renderStatusPill(s)} <b>${c}</b></div>`
            ).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">งานล่าสุด <span class="right"><button class="btn btn-sm" id="btnGoJobs">ดูทั้งหมด</button></span></div>
        <div class="panel-body" style="padding:0;">
          <div class="table-wrap" style="border:none;border-radius:0;max-height:320px;">
            <table class="data">
              <thead><tr><th>วันที่</th><th>เลขที่</th><th>รายละเอียด</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th></tr></thead>
              <tbody>
                ${recentJobs.length === 0 ? '<tr><td colspan="5" class="muted" style="text-align:center;padding:30px;">ไม่มีข้อมูล</td></tr>' :
                  recentJobs.map(j => `<tr>
                    <td>${fmtDate(j['วันที่'])}</td>
                    <td>${escapeHTML(j['เลขที่']||'')}</td>
                    <td class="wrap">${escapeHTML((j['รายละเอียด']||'').toString().slice(0, 120))}${(j['รายละเอียด']||'').toString().length>120?'…':''}</td>
                    <td>${escapeHTML(j['ผู้รับผิดชอบ']||'')}</td>
                    <td>${renderStatusPill(j['สถานะ'])}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      ${overdue.length > 0 ? `
      <div class="panel">
        <div class="panel-header">⚠️ งานที่เลยกำหนด (${overdue.length})</div>
        <div class="panel-body" style="padding:0;">
          <div class="table-wrap" style="border:none;border-radius:0;max-height:280px;">
            <table class="data">
              <thead><tr><th>DocNo</th><th>งาน</th><th>ผู้รับผิดชอบ</th><th>กำหนดส่ง</th><th>สถานะ</th></tr></thead>
              <tbody>
                ${overdue.slice(0, 20).map(t => `<tr>
                  <td>${escapeHTML(t.DocNo||'')}</td>
                  <td>${escapeHTML(t.TaskName||'')}</td>
                  <td>${escapeHTML(t.Assignee||'')}</td>
                  <td>${fmtDate(t.EndDate)}</td>
                  <td>${renderStatusPill(t.Status)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>` : ''}
    `;

    const btn = document.getElementById('btnGoJobs');
    if (btn) btn.onclick = () => render('jobs');
    const btn2 = document.getElementById('btnGoJobsAll');
    if (btn2) btn2.onclick = () => render('jobs');
    const btnAdd = document.getElementById('btnQuickAdd');
    if (btnAdd) btnAdd.onclick = () => Forms.openJob(null);
    const btnPrint = document.getElementById('btnPrintLast');
    if (btnPrint && lastJob) {
      btnPrint.onclick = () => {
        const idx = state.data.jobs.indexOf(lastJob);
        if (idx >= 0) Print.printWorkRequest(idx);
      };
    }
  }

  // -------------------- JOBS (ชีต1) --------------------
  function jobsView() {
    renderGenericTable({
      view: 'jobs',
      title: 'ใบงาน (Jobs)',
      columns: [
        { key: 'วันที่', label: 'วันที่', type: 'date' },
        { key: 'เลขที่', label: 'เลขที่' },
        { key: 'PO', label: 'PO' },
        { key: 'บริษัท', label: 'บริษัท' },
        { key: 'ประเภท', label: 'ประเภท' },
        { key: 'รายละเอียด', label: 'รายละเอียด', type: 'long' },
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
        { id: 'print', label: '🖨', cls: 'btn-primary', title: 'พิมพ์ใบแจ้งงาน',
          handler: (idx) => Print.printWorkRequest(idx) }
      ],
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
    renderGenericTable({
      view: 'delivery',
      title: 'ใบส่งของชั่วคราว',
      columns: [
        { key: 'วันที่', label: 'วันที่', type: 'date' },
        { key: 'เลขที่ใบส่งของ', label: 'เลขที่ใบส่งของ' },
        { key: 'ประเภท', label: 'ประเภท' },
        { key: 'บริษัท', label: 'บริษัท' },
        { key: 'ผู้จัดทำ/ผู้แจ้ง', label: 'ผู้จัดทำ' },
        { key: 'แผนก', label: 'แผนก' },
        { key: 'PO', label: 'PO' },
        { key: 'รายละเอียด/อ้างอิง', label: 'อ้างอิง', type: 'long' },
        { key: 'รายการสินค้า', label: 'รายการสินค้า', type: 'long' },
        { key: 'ไฟล์เอกสาร', label: 'ไฟล์', type: 'file' }
      ],
      filterFields: [
        { key: 'ประเภท', label: 'ประเภท', type: 'select', options: collectUnique('delivery', 'ประเภท') },
        { key: 'บริษัท', label: 'บริษัท', type: 'select', options: collectUnique('delivery', 'บริษัท') },
        { key: 'แผนก', label: 'แผนก', type: 'select', options: collectUnique('delivery', 'แผนก') }
      ],
      onAdd: () => Forms.openDelivery(null),
      onEdit: idx => Forms.openDelivery(idx),
      onDelete: async idx => {
        state.data.delivery.splice(idx, 1);
        await App.saveAll();
        render('delivery');
      }
    });
  }

  // -------------------- GATEPASS --------------------
  function gatepassView() {
    renderGenericTable({
      view: 'gatepass',
      title: 'GatePass — ใบขออนุญาตผ่านประตู',
      columns: [
        { key: 'วันที่', label: 'วันที่', type: 'date' },
        { key: 'เลขที่', label: 'เลขที่' },
        { key: 'บริษัท', label: 'บริษัท' },
        { key: 'ผู้ขออนุญาต', label: 'ผู้ขออนุญาต' },
        { key: 'แผนก', label: 'แผนก' },
        { key: 'เหตุผล', label: 'เหตุผล' },
        { key: 'รายการ', label: 'รายการ', type: 'long' },
        { key: 'ยานพาหนะ', label: 'ยานพาหนะ' },
        { key: 'สี', label: 'สี' },
        { key: 'เอกสารอ้างอิง', label: 'เอกสาร', type: 'file' }
      ],
      filterFields: [
        { key: 'บริษัท', label: 'บริษัท', type: 'select', options: collectUnique('gatepass', 'บริษัท') },
        { key: 'แผนก', label: 'แผนก', type: 'select', options: collectUnique('gatepass', 'แผนก') }
      ],
      onAdd: () => Forms.openGatepass(null),
      onEdit: idx => Forms.openGatepass(idx),
      onDelete: async idx => {
        state.data.gatepass.splice(idx, 1);
        await App.saveAll();
        render('gatepass');
      }
    });
  }

  // -------------------- SCHEDULE --------------------
  function scheduleView() {
    const topbar = document.getElementById('topbar');
    const root = document.getElementById('viewRoot');
    topbar.innerHTML = `
      <div class="title">Schedule — แผนงาน</div>
      <div class="sub">ทั้งหมด ${state.data.schedule.length} งาน</div>
      <div class="toolbar">
        <button class="btn btn-success" id="btnAdd">+ เพิ่มงาน</button>
        <button class="btn" id="btnExportEx">Export Excel</button>
        <button class="btn" id="btnExportPDF">Export PDF</button>
        <button class="btn btn-primary" id="btnSave">💾 บันทึก</button>
      </div>
    `;
    document.getElementById('btnAdd').onclick = () => Forms.openSchedule(null);
    document.getElementById('btnSave').onclick = () => App.saveAll();
    document.getElementById('btnExportEx').onclick = () => Exports.exportExcel('schedule', 'Schedule');
    document.getElementById('btnExportPDF').onclick = () => Exports.exportPDF('schedule', 'Schedule', [
      { key: 'Task_ID', label: 'ID' },
      { key: 'DocNo', label: 'DocNo' },
      { key: 'TaskName', label: 'Task' },
      { key: 'Assignee', label: 'Assignee' },
      { key: 'StartDate', label: 'Start', type: 'date' },
      { key: 'EndDate', label: 'End', type: 'date' },
      { key: 'Status', label: 'Status' }
    ]);

    const tasks = state.data.schedule;
    if (tasks.length === 0) {
      root.innerHTML = `<div class="panel"><div class="panel-body muted">ยังไม่มีงาน คลิก "+ เพิ่มงาน" เพื่อเริ่ม</div></div>`;
      return;
    }

    // Compute date range
    const allDates = [];
    for (const t of tasks) {
      const s = t.StartDate ? new Date(t.StartDate) : null;
      const e = t.EndDate ? new Date(t.EndDate) : null;
      if (s) allDates.push(s);
      if (e) allDates.push(e);
    }
    const minD = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxD = new Date(Math.max(...allDates.map(d => d.getTime())));
    minD.setDate(minD.getDate() - 2);
    maxD.setDate(maxD.getDate() + 2);
    const totalDays = Math.max(1, Math.round((maxD - minD) / 86400000));
    const dayPx = 24;
    const totalWidth = totalDays * dayPx;

    // Day grid header
    const months = [];
    let cur = new Date(minD);
    while (cur <= maxD) {
      months.push(new Date(cur));
      cur.setDate(cur.getDate()+1);
    }

    // Group by DocNo
    const byDoc = {};
    for (const t of tasks) {
      const k = t.DocNo || '— ไม่ระบุ —';
      (byDoc[k] = byDoc[k] || []).push(t);
    }

    let html = `
      <div class="panel">
        <div class="panel-header">มุมมอง Gantt (โครงสร้างเวลา)</div>
        <div class="panel-body" style="padding:0;overflow:auto;">
          <div class="gantt" style="min-width:${totalWidth + 220}px;">
            <div class="row" style="border-bottom:2px solid var(--border);">
              <div class="label" style="font-weight:700;">DocNo / งาน</div>
              <div class="timeline" style="height:32px;width:${totalWidth}px;">
                ${months.filter((_,i)=>i%7===0).map((d,i) => {
                  const left = i * 7 * dayPx;
                  return `<div style="position:absolute;left:${left}px;top:8px;font-size:11px;color:var(--muted);">${fmtDate(d)}</div>`;
                }).join('')}
              </div>
            </div>
            ${Object.entries(byDoc).map(([doc, arr]) => `
              <div class="row" style="background:#fafbfc;border-bottom:1px solid var(--border);">
                <div class="label" style="font-weight:600;">${escapeHTML(doc)}</div>
                <div class="timeline" style="width:${totalWidth}px;height:8px;"></div>
              </div>
              ${arr.map(t => {
                const s = t.StartDate ? new Date(t.StartDate) : null;
                const e = t.EndDate ? new Date(t.EndDate) : s;
                const aS = t.ActualStartDate ? new Date(t.ActualStartDate) : null;
                const aE = t.ActualEndDate ? new Date(t.ActualEndDate) : null;
                const left = s ? Math.round((s - minD)/86400000) * dayPx : 0;
                const width = (s && e) ? Math.max(dayPx, Math.round((e - s)/86400000) * dayPx + dayPx) : dayPx;
                const aLeft = aS ? Math.round((aS - minD)/86400000) * dayPx : null;
                const aWidth = (aS && aE) ? Math.max(dayPx, Math.round((aE - aS)/86400000) * dayPx + dayPx) : (aS ? dayPx : 0);
                const isLate = e && aE && aE > e;
                const idx = state.data.schedule.indexOf(t);
                return `
                  <div class="row" data-idx="${idx}">
                    <div class="label" style="cursor:pointer;" data-edit-task="${idx}">
                      <div style="font-weight:500;">${escapeHTML(t.TaskName||'')}</div>
                      <div class="muted" style="font-size:11px;">${escapeHTML(t.Assignee||'')} · ${escapeHTML(t.Status||'')}</div>
                    </div>
                    <div class="timeline" style="width:${totalWidth}px;">
                      ${s ? `<div class="bar ${isLate?'late':''}" style="left:${left}px;width:${width}px;" title="${escapeHTML((t.TaskName||''))} (${fmtDate(s)} → ${fmtDate(e)})">${escapeHTML(t.TaskName||'')}</div>` : ''}
                      ${aS ? `<div class="bar actual" style="left:${aLeft}px;width:${aWidth}px;" title="ทำจริง: ${fmtDate(aS)} → ${aE?fmtDate(aE):'-'}"></div>` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            `).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">ตารางงาน</div>
        <div class="panel-body" style="padding:0;">
          <div class="table-wrap" style="border:none;border-radius:0;">
            <table class="data">
              <thead><tr>
                <th>Task ID</th><th>DocNo</th><th>งาน</th><th>ผู้รับผิดชอบ</th>
                <th>เริ่ม (แผน)</th><th>เสร็จ (แผน)</th>
                <th>เริ่มจริง</th><th>เสร็จจริง</th>
                <th>สถานะ</th><th>การกระทำ</th>
              </tr></thead>
              <tbody id="scheduleTbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    root.innerHTML = html;

    document.querySelectorAll('[data-edit-task]').forEach(el => {
      el.onclick = () => Forms.openSchedule(parseInt(el.dataset.editTask, 10));
    });

    const tbody = document.getElementById('scheduleTbody');
    tbody.innerHTML = tasks.map((t, i) => `
      <tr>
        <td>${escapeHTML(t.Task_ID||'')}</td>
        <td>${escapeHTML(t.DocNo||'')}</td>
        <td>${escapeHTML(t.TaskName||'')}</td>
        <td>${escapeHTML(t.Assignee||'')}</td>
        <td>${fmtDate(t.StartDate)}</td>
        <td>${fmtDate(t.EndDate)}</td>
        <td>${fmtDate(t.ActualStartDate)}</td>
        <td>${fmtDate(t.ActualEndDate)}</td>
        <td>${renderStatusPill(t.Status)}</td>
        <td class="actions">
          <button class="btn btn-sm" data-edit="${i}">แก้ไข</button>
          <button class="btn btn-sm btn-danger" data-del="${i}">ลบ</button>
        </td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => Forms.openSchedule(parseInt(b.dataset.edit, 10)));
    tbody.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (await App.confirmDialog('ลบรายการนี้?', { danger: true })) {
        state.data.schedule.splice(parseInt(b.dataset.del, 10), 1);
        await App.saveAll();
        render('schedule');
      }
    });
  }

  // -------------------- COSTS --------------------
  function costsView() {
    // additional summary at top
    const data = state.data.costs;
    const total = data.reduce((s, r) => s + (Number(r['จำนวนเงินรวม Vat']) || 0), 0);
    const totalNoVat = data.reduce((s, r) => s + (Number(r['จำนวนเงินรวม']) || 0), 0);

    renderGenericTable({
      view: 'costs',
      title: 'Costs — รายการค่าใช้จ่าย',
      columns: [
        { key: 'วันที่', label: 'วันที่', type: 'date' },
        { key: 'เลขที่งาน', label: 'เลขที่งาน' },
        { key: 'เลขที่โครงการ', label: 'โครงการ' },
        { key: 'ประเภท', label: 'ประเภท' },
        { key: 'ผู้ขาย / Sup', label: 'ผู้ขาย/Sup' },
        { key: 'รายละเอียด', label: 'รายละเอียด', type: 'long' },
        { key: 'จำนวน', label: 'จำนวน', type: 'number' },
        { key: 'ราคา / หน่วย', label: 'ราคา/หน่วย', type: 'money' },
        { key: 'จำนวนเงินรวม', label: 'รวม', type: 'money' },
        { key: 'VAT', label: 'VAT', type: 'money' },
        { key: 'จำนวนเงินรวม Vat', label: 'รวม VAT', type: 'money' },
        { key: 'ผู้บันทึก', label: 'ผู้บันทึก' }
      ],
      filterFields: [
        { key: 'ประเภท', label: 'ประเภท', type: 'select', options: collectUnique('costs', 'ประเภท') },
        { key: 'เลขที่งาน', label: 'เลขที่งาน', type: 'text', placeholder: 'เช่น SM-2605001-PC' },
        { key: 'เลขที่โครงการ', label: 'โครงการ', type: 'text' }
      ],
      headerExtra: `
        <div class="status-pill" style="background:#dbeafe;color:#1d4ed8;">รวม: ${fmtMoney(totalNoVat)}</div>
        <div class="status-pill" style="background:#dcfce7;color:#166534;">รวม VAT: ${fmtMoney(total)}</div>
      `,
      onAdd: () => Forms.openCost(null),
      onEdit: idx => Forms.openCost(idx),
      onDelete: async idx => {
        state.data.costs.splice(idx, 1);
        await App.saveAll();
        render('costs');
      }
    });
  }

  function collectUnique(view, key) {
    const set = new Set();
    for (const r of state.data[view]) {
      const v = r[key];
      if (v != null && v !== '') set.add(String(v).trim());
    }
    return [...set].sort((a,b) => a.localeCompare(b, 'th'));
  }

  // -------------------- Dispatch --------------------
  function render(view) {
    state.currentView = view;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === view);
    });
    if (!state.folderHandle) {
      document.getElementById('topbar').innerHTML = `<div class="title">SMEC Job Database</div>`;
      document.getElementById('viewRoot').innerHTML = '';
      document.getElementById('welcome').classList.remove('hidden');
      return;
    }
    document.getElementById('welcome').classList.add('hidden');
    if (view === 'dashboard') return dashboard();
    if (view === 'jobs') return jobsView();
    if (view === 'delivery') return deliveryView();
    if (view === 'gatepass') return gatepassView();
    if (view === 'schedule') return scheduleView();
    if (view === 'costs') return costsView();
  }

  return { render, renderGenericTable, renderStatusPill, renderFileLinks, collectUnique };
})();
