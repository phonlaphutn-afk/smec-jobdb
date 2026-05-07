/* ==========================================================================
 * Schedule Manager — ระบบจัดการแผนงานรายใบงาน (Job-centric)
 * ดูโค้ดอ้างอิง: React SMECModernDashboard / ScheduleManagerApp
 * ========================================================================== */

const ScheduleManager = (() => {
  const { state, fmtDate, escapeHTML, fmtMoney } = App;

  // ---- Private state ----
  let _sel    = null;    // selected docNo
  let _tasks  = [];      // editing copy
  let _dirty  = false;
  let _search = '';
  let _filter = 'active';
  let _styleOK = false;

  // ---- CSS ----
  function _css() {
    if (_styleOK) return; _styleOK = true;
    const s = document.createElement('style');
    s.textContent = `
      .sm-root{display:flex;height:calc(100vh - 52px);overflow:hidden;}
      .sm-sidebar{width:290px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;}
      .sm-sidebar-hd{background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;padding:14px 16px;flex-shrink:0;}
      .sm-sidebar-hd h2{font-size:16px;font-weight:900;margin:0 0 2px;}
      .sm-sidebar-hd p{font-size:10px;opacity:.7;margin:0;text-transform:uppercase;letter-spacing:1px;}
      .sm-sf{padding:8px;border-bottom:1px solid #e5e7eb;background:#f8fafc;flex-shrink:0;}
      .sm-dash-btn{display:flex;align-items:center;gap:6px;width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:8px;transition:all .15s;}
      .sm-dash-btn.active{background:#ede9fe;color:#7c3aed;border-color:#c4b5fd;}
      .sm-search{width:100%;padding:7px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;margin-bottom:8px;font-family:inherit;box-sizing:border-box;}
      .sm-search:focus{outline:none;border-color:#7c3aed;}
      .sm-ftabs{display:flex;background:#f1f5f9;border-radius:6px;padding:2px;gap:2px;}
      .sm-ftab{flex:1;padding:5px;border:none;border-radius:4px;font-size:11px;font-weight:700;cursor:pointer;background:transparent;color:#64748b;font-family:inherit;}
      .sm-ftab.active{background:#fff;color:#7c3aed;box-shadow:0 1px 3px rgba(0,0,0,.1);}
      .sm-jlist{flex:1;overflow-y:auto;padding:6px;}
      .sm-jlist::-webkit-scrollbar{width:5px;}
      .sm-jlist::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px;}
      .sm-jcard{padding:11px 12px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;margin-bottom:5px;cursor:pointer;transition:all .15s;}
      .sm-jcard:hover{border-color:#c4b5fd;box-shadow:0 2px 8px rgba(124,58,237,.1);}
      .sm-jcard.sel{background:#faf5ff;border-color:#a78bfa;box-shadow:0 2px 10px rgba(124,58,237,.15);transform:scale(1.01);}
      .sm-jdoc{font-size:11px;font-weight:900;color:#4f46e5;font-family:monospace;}
      .sm-jtitle{font-size:13px;font-weight:700;color:#1e293b;margin:4px 0 0;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
      .sm-jmeta{display:flex;justify-content:space-between;align-items:center;margin-top:7px;}
      .sm-jco{font-size:10px;padding:2px 7px;background:#f1f5f9;border-radius:4px;border:1px solid #e2e8f0;color:#475569;font-weight:700;}
      .sm-jbadge{font-size:10px;padding:2px 7px;border-radius:99px;font-weight:700;}
      .sm-jbadge.has{background:#fef3c7;color:#92400e;border:1px solid #fde68a;}
      .sm-jbadge.done{background:#d1fae5;color:#065f46;border:1px solid #a7f3d0;}
      .sm-jbadge.none{background:#f1f5f9;color:#94a3b8;border:1px solid #e2e8f0;}
      .sm-sfooter{padding:8px;border-top:1px solid #e5e7eb;text-align:center;flex-shrink:0;}
      /* Main */
      .sm-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;background:#f8fafc;}
      .sm-ehd{padding:14px 18px;border-bottom:1px solid #e5e7eb;background:#fff;flex-shrink:0;}
      .sm-ejno{display:inline-block;padding:3px 10px;background:#ede9fe;color:#4f46e5;font-family:monospace;font-size:13px;font-weight:900;border-radius:6px;border:1px solid #c4b5fd;}
      .sm-etitle{font-size:17px;font-weight:900;color:#0f172a;margin-top:5px;}
      .sm-emeta{display:flex;gap:8px;margin-top:7px;flex-wrap:wrap;}
      .sm-echip{font-size:11px;padding:3px 8px;background:#f1f5f9;border-radius:5px;border:1px solid #e2e8f0;color:#475569;font-weight:700;}
      /* Editor body */
      .sm-ebody{flex:1;overflow-y:auto;padding:14px 18px;background:#f8fafc;}
      .sm-ebody::-webkit-scrollbar{width:5px;}
      .sm-ebody::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px;}
      .sm-ttbar{display:flex;justify-content:space-between;align-items:center;background:#fff;padding:9px 14px;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:10px;position:sticky;top:0;z-index:10;box-shadow:0 1px 4px rgba(0,0,0,.04);}
      .sm-ttbar-title{font-size:14px;font-weight:900;color:#1e293b;}
      .sm-ttbar-btns{display:flex;gap:6px;}
      /* Task table */
      .sm-tt{width:100%;border-collapse:collapse;background:#fff;font-size:12px;}
      .sm-tt th{background:#f8fafc;font-size:10px;font-weight:800;color:#475569;padding:7px 6px;text-align:center;border-bottom:2px solid #e2e8f0;border-right:1px solid #e5e7eb;text-transform:uppercase;white-space:nowrap;}
      .sm-tt th.plan{background:#eef2ff;color:#3730a3;}
      .sm-tt th.actual{background:#f0fdf4;color:#065f46;}
      .sm-tt td{padding:4px 5px;border-bottom:1px solid #f1f5f9;border-right:1px solid #f1f5f9;vertical-align:middle;}
      .sm-tt tr:hover td{background:#fafafa;}
      .sm-tt input[type=text],.sm-tt input[type=date]{width:100%;padding:4px 6px;border:1px solid transparent;border-radius:4px;font-size:12px;background:transparent;font-family:inherit;box-sizing:border-box;}
      .sm-tt input:hover,.sm-tt select:hover{border-color:#c4b5fd;background:#faf5ff;}
      .sm-tt input:focus,.sm-tt select:focus{border-color:#7c3aed;background:#fff;outline:none;}
      .sm-tt select{width:100%;padding:4px 5px;border:1px solid transparent;border-radius:4px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;background:transparent;}
      .sm-tt .dp{color:#4338ca;} .sm-tt .da{color:#059669;}
      .sm-tt .sp{color:#64748b;background:#f1f5f9;} .sm-tt .si{color:#92400e;background:#fef3c7;}
      .sm-tt .sd{color:#065f46;background:#d1fae5;} .sm-tt .sl{color:#991b1b;background:#fee2e2;}
      /* Gantt */
      .sm-gantt{background:#fff;border-radius:10px;border:1px solid #e5e7eb;margin-top:14px;overflow:hidden;}
      .sm-gantt-hd{padding:10px 14px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;}
      .sm-gantt-leg{display:flex;gap:10px;font-size:10px;font-weight:700;color:#64748b;flex-wrap:wrap;}
      .sm-gantt-leg-i{display:flex;align-items:center;gap:3px;}
      .sm-gantt-leg-d{width:14px;height:6px;border-radius:2px;}
      .sm-gantt-scroll{overflow-x:auto;}
      .sm-gantt-scroll::-webkit-scrollbar{height:5px;}
      .sm-gantt-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px;}
      .sm-grow{display:flex;border-bottom:1px solid #cbd5e1;min-height:20px;}
      .sm-gweek{display:flex;border-bottom:2px solid #cbd5e1;min-height:16px;background:#f8fafc;}
      .sm-gmon{border-right:1px solid #e5e7eb;font-size:10px;font-weight:800;color:#374151;display:flex;align-items:center;justify-content:center;flex-shrink:0;padding:0 2px;}
      .sm-gwk{border-right:1px solid #e5e7eb;font-size:9px;font-weight:700;color:#6b7280;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
      .sm-gtr{display:flex;align-items:stretch;min-height:38px;border-bottom:1px solid #e5e7eb;}
      .sm-gtr:hover{background:#faf5ff!important;}
      .sm-ginfo{width:40%;flex-shrink:0;display:flex;border-right:2px solid #e5e7eb;background:inherit;}
      .sm-gname{width:50%;padding:3px 6px;border-right:1px solid #e5e7eb;font-size:9px;font-weight:700;color:#1e293b;display:flex;align-items:flex-start;gap:2px;}
      .sm-gasn{width:20%;padding:3px;border-right:1px solid #e5e7eb;font-size:9px;font-weight:700;color:#475569;display:flex;align-items:center;justify-content:center;text-align:center;}
      .sm-gdates{width:30%;padding:2px 3px;font-size:8px;font-weight:700;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;}
      .sm-gchart{flex:1;position:relative;min-width:0;}
      .sm-bplan{position:absolute;height:10px;background:linear-gradient(to right,#a5b4fc,#818cf8);border:1px solid #6366f1;border-radius:3px;top:50%;transform:translateY(-11px);z-index:1;min-width:4px;box-shadow:0 1px 3px rgba(99,102,241,.3);}
      .sm-bact{position:absolute;height:9px;border-radius:3px;top:50%;transform:translateY(2px);z-index:2;min-width:4px;box-shadow:0 1px 3px rgba(0,0,0,.15);}
      /* Footer */
      .sm-foot{padding:10px 18px;background:#fff;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;box-shadow:0 -2px 8px rgba(0,0,0,.04);}
      /* Dashboard */
      .sm-dkpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px;}
      .sm-dkpi{background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #e5e7eb;border-left:4px solid #e5e7eb;}
      .sm-dkpi.in{border-left-color:#6366f1;} .sm-dkpi.sk{border-left-color:#0ea5e9;}
      .sm-dkpi.em{border-left-color:#10b981;} .sm-dkpi.fu{border-left-color:#a855f7;}
      .sm-dkpi .dl{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.3px;}
      .sm-dkpi .dv{font-size:26px;font-weight:900;color:#0f172a;}
      .sm-dpb{width:100%;background:#f1f5f9;border-radius:99px;height:8px;overflow:hidden;margin-top:6px;}
      .sm-dpbf{height:100%;border-radius:99px;background:linear-gradient(to right,#a855f7,#7c3aed);transition:width .5s;}
      .sm-dcharts{display:grid;grid-template-columns:1fr 2fr;gap:14px;}
      .sm-dcbox{background:#fff;border-radius:10px;border:1px solid #e5e7eb;padding:14px;}
      .sm-dctit{font-size:13px;font-weight:800;color:#1e293b;margin-bottom:10px;}
      /* Print overlay */
      .sm-povl{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;flex-direction:column;align-items:center;padding:16px;overflow:auto;}
      .sm-ptbar{background:#1e293b;color:#fff;padding:10px 18px;border-radius:10px 10px 0 0;width:1123px;max-width:100%;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}
      .sm-ppaper{width:1123px;height:794px;background:#fff;padding:22px;display:flex;flex-direction:column;font-size:12px;box-shadow:0 20px 60px rgba(0,0,0,.5);flex-shrink:0;box-sizing:border-box;overflow:hidden;}
      .sm-phd{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:8px;}
      .sm-psigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center;margin-top:8px;flex-shrink:0;}
      @media(max-width:900px){.sm-dkpis{grid-template-columns:1fr 1fr;} .sm-dcharts{grid-template-columns:1fr;}}
    `;
    document.head.appendChild(s);
  }

  // ---- Helpers ----
  const _docNoOf = j => String(j['เลขที่'] || '').trim();
  const _tasksOf = d => state.data.schedule.filter(t => String(t.DocNo || '').trim() === d);

  function _jobList() {
    const q = _search.toLowerCase();
    return state.data.jobs.filter(j => {
      const dn = _docNoOf(j);
      if (!dn) return false;
      if (q && !dn.toLowerCase().includes(q) &&
          !(j['รายละเอียด']||'').toLowerCase().includes(q) &&
          !(j['บริษัท']||'').toLowerCase().includes(q)) return false;
      if (_filter === 'active' && /ปิดงาน|ยกเลิก|ส่งงานแล้ว/i.test(String(j['สถานะ']||''))) return false;
      return true;
    }).sort((a, b) => {
      const da = a['วันที่'] instanceof Date ? a['วันที่'] : new Date(a['วันที่'] || 0);
      const db = b['วันที่'] instanceof Date ? b['วันที่'] : new Date(b['วันที่'] || 0);
      return db - da;
    });
  }

  function _timeline(tasks) {
    const ds = [];
    for (const t of tasks) {
      ['StartDate','EndDate','ActualStartDate','ActualEndDate'].forEach(k => {
        if (!t[k]) return;
        const d = t[k] instanceof Date ? t[k] : new Date(t[k]);
        if (!isNaN(d.getTime())) ds.push(d);
      });
    }
    if (!ds.length) return null;
    let mn = new Date(Math.min(...ds.map(d=>d.getTime())));
    let mx = new Date(Math.max(...ds.map(d=>d.getTime())));
    mn.setDate(1); mn.setHours(0,0,0,0);
    mx.setMonth(mx.getMonth()+1); mx.setDate(0); mx.setHours(23,59,59,999);
    const months = [];
    let cur = new Date(mn);
    while (cur <= mx) {
      months.push({ y:cur.getFullYear(), m:cur.getMonth(),
        days: new Date(cur.getFullYear(), cur.getMonth()+1, 0).getDate(),
        label: cur.toLocaleDateString('th-TH',{month:'short',year:'2-digit'}) });
      cur.setMonth(cur.getMonth()+1);
    }
    // build days list for day-mode
    const days = [];
    const DAY_MS = 86400000;
    let dc = new Date(mn);
    while (dc <= mx) { days.push(new Date(dc)); dc = new Date(dc.getTime() + DAY_MS); }
    return { min:mn, max:mx, months, ms: mx - mn, days };
  }

  const _pct = (ds, tl) => {
    if (!ds || !tl) return 0;
    const d = ds instanceof Date ? ds : new Date(ds);
    if (isNaN(d.getTime())) return 0;
    return Math.max(0, Math.min(100, (d - tl.min) / tl.ms * 100));
  };

  const _acolor = s => /เสร็จ/i.test(s) ? '#10b981' : /ล่าช้า/i.test(s) ? '#f43f5e' : /กำลัง/i.test(s) ? '#f59e0b' : '#64748b';
  const _scls   = s => /เสร็จ/i.test(s) ? 'sd' : /กำลัง/i.test(s) ? 'si' : /ล่าช้า/i.test(s) ? 'sl' : 'sp';

  function _dateVal(v) {
    if (!v) return '';
    if (v instanceof Date) return v.toISOString().split('T')[0];
    return String(v).split('T')[0];
  }

  // ---- Gantt HTML ----
  function _ganttHtml(tasks) {
    const vt = tasks.filter(t => t.StartDate && t.EndDate);
    if (!vt.length) return `<div class="sm-gantt"><div style="padding:24px;text-align:center;color:#94a3b8;font-weight:700;">ยังไม่มีงานที่ระบุวันที่</div></div>`;
    const tl = _timeline(vt);
    if (!tl) return '';

    const totalMonths = tl.months.length;
    const mode = totalMonths <= 2 ? 'day' : 'week';

    /* ---------- TODAY marker ---------- */
    const todayPct = _pct(new Date(), tl);
    const showToday = todayPct > 0 && todayPct < 100;
    const todayLine = showToday
      ? `<div style="position:absolute;left:${todayPct}%;top:0;bottom:0;width:2px;background:rgba(239,68,68,.55);z-index:5;pointer-events:none;">
           <div style="position:absolute;top:0;left:-14px;background:#ef4444;color:#fff;font-size:7px;font-weight:900;padding:1px 3px;border-radius:2px;white-space:nowrap;">วันนี้</div>
         </div>` : '';

    /* ---------- Header rows ---------- */
    let mHtml = '', subHtml = '', gridBg = '';

    if (mode === 'day') {
      /* DAY MODE — แสดงรายวัน */
      const totalDays = tl.days.length;
      const dayW = 100 / totalDays;

      /* Month row — width proportional to days in month */
      mHtml = tl.months.map(m => {
        const w = m.days / totalDays * 100;
        return `<div class="sm-gmon" style="width:${w}%;border-right:2px solid #6b7280;background:#eef2ff;color:#3730a3;">${m.label}</div>`;
      }).join('');

      /* Day sub-row — label every 5th day */
      const step = totalDays > 50 ? 10 : 5;
      subHtml = tl.days.map((d, i) => {
        const dn = d.getDate();
        const isMonBoundary = dn === 1;
        const label = (dn === 1 || dn % step === 0) ? String(dn) : '';
        return `<div class="sm-gwk" style="width:${dayW}%;font-size:7px;font-weight:${label?'800':'400'};color:${isMonBoundary?'#3730a3':'#6b7280'};border-right:${isMonBoundary?'2px solid #6b7280':'1px solid #e5e7eb'};background:${isMonBoundary?'#eef2ff':'transparent'};justify-content:center;">${label}</div>`;
      }).join('');

      /* Grid background — thin line every day, accent every 7 */
      gridBg = `background-image:repeating-linear-gradient(to right,rgba(209,213,219,0.55) 0,rgba(209,213,219,0.55) 1px,transparent 1px,transparent ${dayW}%);`;

    } else {
      /* WEEK MODE — แสดงรายสัปดาห์ */
      const mw = 100 / totalMonths;
      const ww = mw / 4;
      const totalCells = totalMonths * 4;
      const cw = 100 / totalCells;

      mHtml = tl.months.map(m =>
        `<div class="sm-gmon" style="width:${mw}%;border-right:2px solid #6b7280;background:#f0fdf4;color:#065f46;">${m.label}</div>`
      ).join('');

      subHtml = tl.months.map(() =>
        ['W1','W2','W3','W4'].map(w =>
          `<div class="sm-gwk" style="width:${ww}%;font-size:9px;font-weight:800;color:#374151;">${w}</div>`
        ).join('')
      ).join('');

      /* Grid — line every week, thicker every month (handled by border-right on mHtml) */
      gridBg = `background-image:repeating-linear-gradient(to right,rgba(209,213,219,0.6) 0,rgba(209,213,219,0.6) 1px,transparent 1px,transparent ${cw}%);`;
    }

    /* ---------- Task rows ---------- */
    const rowsHtml = vt.map((t, i) => {
      const pL = _pct(t.StartDate, tl);
      const pW = Math.max(0.5, _pct(t.EndDate, tl) - pL);
      let aL = null, aW = null;
      if (t.ActualStartDate) {
        aL = _pct(t.ActualStartDate, tl);
        aW = Math.max(0.5, _pct(t.ActualEndDate || new Date(), tl) - aL);
      }
      const aCol = _acolor(t.Status || '');
      const pd = `${fmtDate(t.StartDate)}${t.EndDate !== t.StartDate ? ' – ' + fmtDate(t.EndDate) : ''}`;
      const ad = t.ActualStartDate ? `${fmtDate(t.ActualStartDate)}${t.ActualEndDate ? ' – ' + fmtDate(t.ActualEndDate) : ''}` : '-';
      const isEven = i % 2 === 0;
      return `<div class="sm-gtr" style="${isEven?'background:#fafafa;':'background:#fff;'}">
        <div class="sm-ginfo">
          <div class="sm-gname"><span style="color:#94a3b8;flex-shrink:0;margin-right:3px;">${i+1}.</span><span>${escapeHTML(t.TaskName||'')}</span></div>
          <div class="sm-gasn">${escapeHTML(t.Assignee||'-')}</div>
          <div class="sm-gdates"><span style="color:#4338ca;">${escapeHTML(pd)}</span><span style="color:#059669;">${escapeHTML(ad)}</span></div>
        </div>
        <div class="sm-gchart" style="${gridBg}position:relative;">
          ${todayLine}
          <div class="sm-bplan" style="left:${pL}%;width:${pW}%;"></div>
          ${aL !== null ? `<div class="sm-bact" style="left:${aL}%;width:${aW}%;background:${aCol};"></div>` : ''}
        </div>
      </div>`;
    }).join('');

    const modeLabel = mode === 'day' ? '📅 โหมดรายวัน' : '📆 โหมดรายสัปดาห์';

    return `<div class="sm-gantt">
      <div class="sm-gantt-hd">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:14px;font-weight:900;color:#1e293b;">📊 Graphic Timeline Preview</span>
          <span style="font-size:10px;font-weight:700;padding:2px 8px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:4px;color:#64748b;">${modeLabel}</span>
        </div>
        <div class="sm-gantt-leg">
          <div class="sm-gantt-leg-i"><div class="sm-gantt-leg-d" style="background:#a5b4fc;border:1px solid #818cf8;"></div> แผนงาน (Plan)</div>
          <div class="sm-gantt-leg-i"><div class="sm-gantt-leg-d" style="background:#10b981;"></div> เสร็จแล้ว</div>
          <div class="sm-gantt-leg-i"><div class="sm-gantt-leg-d" style="background:#f59e0b;"></div> กำลังทำ</div>
          <div class="sm-gantt-leg-i"><div class="sm-gantt-leg-d" style="background:#f43f5e;"></div> ล่าช้า</div>
          ${showToday ? '<div class="sm-gantt-leg-i"><div style="width:8px;height:14px;background:rgba(239,68,68,.5);border-radius:1px;"></div> วันนี้</div>' : ''}
        </div>
      </div>
      <div class="sm-gantt-scroll">
        <div style="display:flex;border-bottom:2px solid #e2e8f0;background:#f8fafc;">
          <div style="width:40%;border-right:2px solid #cbd5e1;display:flex;background:#fff;flex-shrink:0;">
            <div style="width:50%;border-right:1px solid #e5e7eb;padding:5px 6px;font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;display:flex;align-items:center;justify-content:center;text-align:center;">รายละเอียดขั้นตอน</div>
            <div style="width:20%;border-right:1px solid #e5e7eb;padding:4px;font-size:9px;font-weight:800;color:#475569;text-transform:uppercase;display:flex;align-items:center;justify-content:center;">ผู้รับผิดชอบ</div>
            <div style="width:30%;padding:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:9px;font-weight:800;text-transform:uppercase;text-align:center;">
              <span style="color:#3730a3;">แผนงาน</span><span style="color:#065f46;font-size:8px;">ทำจริง</span>
            </div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
            <div class="sm-grow" style="border-bottom:1px solid #cbd5e1;">${mHtml}</div>
            <div class="sm-gweek">${subHtml}</div>
          </div>
        </div>
        ${rowsHtml}
      </div>
    </div>`;
  }

  // ---- Task table HTML ----
  function _taskRowHtml(t, i) {
    const sc = _scls(t.Status||'');
    return `<tr>
      <td style="text-align:center;color:#94a3b8;width:28px;font-size:11px;">${i+1}</td>
      <td><input type="text" class="smt-n" data-i="${i}" value="${escapeHTML(t.TaskName||'')}" placeholder="ชื่อขั้นตอน..."/></td>
      <td><input type="text" class="smt-a" data-i="${i}" value="${escapeHTML(t.Assignee||'')}" placeholder="ผู้รับผิดชอบ"/></td>
      <td style="background:#eef2ff18;"><input type="date" class="smt-s dp" data-i="${i}" value="${_dateVal(t.StartDate)}"/></td>
      <td style="background:#eef2ff18;"><input type="date" class="smt-e dp" data-i="${i}" value="${_dateVal(t.EndDate)}"/></td>
      <td style="background:#f0fdf418;"><input type="date" class="smt-as da" data-i="${i}" value="${_dateVal(t.ActualStartDate)}"/></td>
      <td style="background:#f0fdf418;"><input type="date" class="smt-ae da" data-i="${i}" value="${_dateVal(t.ActualEndDate)}"/></td>
      <td><select class="smt-st ${sc}" data-i="${i}">
        <option value="รอดำเนินการ" ${(t.Status||'')==='รอดำเนินการ'?'selected':''}>รอดำเนินการ</option>
        <option value="กำลังดำเนินการ" ${(t.Status||'')==='กำลังดำเนินการ'?'selected':''}>กำลังดำเนินการ</option>
        <option value="ล่าช้า" ${(t.Status||'')==='ล่าช้า'?'selected':''}>ล่าช้า</option>
        <option value="เสร็จแล้ว" ${(t.Status||'')==='เสร็จแล้ว'?'selected':''}>เสร็จแล้ว</option>
      </select></td>
      <td style="text-align:center;"><button class="btn btn-sm btn-danger smt-del" data-i="${i}">🗑</button></td>
    </tr>`;
  }

  // ---- Dashboard ----
  function _dashHtml() {
    const all = state.data.schedule;
    const jobs = state.data.jobs.filter(j => { const dn=_docNoOf(j); return dn && all.some(t=>String(t.DocNo||'').trim()===dn); });
    let done=0, inp=0, pend=0;
    const byA = {};
    for (const t of all) {
      if (/เสร็จ/i.test(t.Status||'')) done++;
      else if (/กำลัง/i.test(t.Status||'')) inp++;
      else pend++;
      const a=(t.Assignee||'ไม่ระบุ').toString().trim();
      if (!byA[a]) byA[a]={done:0,inp:0,pend:0,total:0};
      byA[a].total++;
      if (/เสร็จ/i.test(t.Status||'')) byA[a].done++;
      else if (/กำลัง/i.test(t.Status||'')) byA[a].inp++;
      else byA[a].pend++;
    }
    const total = all.length;
    const rate = total ? Math.round(done/total*100) : 0;
    return `<div style="flex:1;overflow-y:auto;padding:20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
        <span style="font-size:24px;font-weight:900;color:#1e293b;">📈 Schedule Dashboard</span>
      </div>
      <div class="sm-dkpis">
        <div class="sm-dkpi in"><div class="dl">งานที่มีแผน (Jobs)</div><div class="dv">${jobs.length}</div></div>
        <div class="sm-dkpi sk"><div class="dl">ขั้นตอนรวม (Tasks)</div><div class="dv">${total}</div></div>
        <div class="sm-dkpi em"><div class="dl">สำเร็จแล้ว</div><div class="dv" style="color:#10b981;">${done} <span style="font-size:14px;color:#94a3b8;">/ ${total}</span></div></div>
        <div class="sm-dkpi fu"><div class="dl">ความคืบหน้า</div><div class="dv" style="color:#7c3aed;">${rate}%</div><div class="sm-dpb"><div class="sm-dpbf" style="width:${rate}%;"></div></div></div>
      </div>
      <div class="sm-dcharts">
        <div class="sm-dcbox"><div class="sm-dctit">🥧 สถานะขั้นตอน</div><canvas id="smPie" height="220"></canvas></div>
        <div class="sm-dcbox"><div class="sm-dctit">📊 ภาระงานรายบุคคล</div><canvas id="smBar" height="220"></canvas></div>
      </div>
    </div>`;
  }

  async function _loadCharts() {
    if (!window.Chart) {
      await new Promise((res,rej) => {
        const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
        s.onload=res; s.onerror=rej; document.head.appendChild(s);
      });
    }
    const all = state.data.schedule;
    let done=0,inp=0,pend=0;
    const byA={};
    for (const t of all) {
      if (/เสร็จ/i.test(t.Status||'')) done++;
      else if (/กำลัง/i.test(t.Status||'')) inp++;
      else pend++;
      const a=(t.Assignee||'ไม่ระบุ').toString().trim();
      if (!byA[a]) byA[a]={done:0,inp:0,pend:0,total:0};
      byA[a].total++;
      if (/เสร็จ/i.test(t.Status||'')) byA[a].done++;
      else if (/กำลัง/i.test(t.Status||'')) byA[a].inp++;
      else byA[a].pend++;
    }
    const top = Object.entries(byA).sort((a,b)=>b[1].total-a[1].total).slice(0,7);
    const pie = document.getElementById('smPie');
    if (pie && window.Chart) {
      const ex=Chart.getChart(pie); if(ex) ex.destroy();
      new Chart(pie,{type:'doughnut',data:{
        labels:['รอดำเนินการ','กำลังดำเนินการ','เสร็จแล้ว'].filter((_,i)=>[pend,inp,done][i]>0),
        datasets:[{data:[pend,inp,done].filter(v=>v>0),backgroundColor:['#94a3b8','#f59e0b','#10b981'],borderWidth:2}]
      },options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}}});
    }
    const bar = document.getElementById('smBar');
    if (bar && window.Chart && top.length) {
      const ex=Chart.getChart(bar); if(ex) ex.destroy();
      new Chart(bar,{type:'bar',data:{
        labels:top.map(a=>a[0]),
        datasets:[
          {label:'รอดำเนินการ',data:top.map(a=>a[1].pend),backgroundColor:'#94a3b8',stack:'a'},
          {label:'กำลังดำเนินการ',data:top.map(a=>a[1].inp),backgroundColor:'#f59e0b',stack:'a'},
          {label:'เสร็จแล้ว',data:top.map(a=>a[1].done),backgroundColor:'#10b981',stack:'a',borderRadius:{topLeft:4,topRight:4}}
        ]
      },options:{responsive:true,maintainAspectRatio:true,
        plugins:{legend:{labels:{font:{size:11}}}},
        scales:{x:{stacked:true,ticks:{font:{size:10}}},y:{stacked:true,beginAtZero:true,ticks:{precision:0}}}}});
    }
  }

  // ---- Print preview ----
  function _openPrint() {
    const job = state.data.jobs.find(j=>_docNoOf(j)===_sel);
    if (!job) return;
    const vt = _tasks.filter(t=>t.StartDate&&t.EndDate);
    const tl = _timeline(vt);
    const logo = (typeof LOGO_DATA_URL!=='undefined'&&LOGO_DATA_URL)
      ? `<img src="${LOGO_DATA_URL}" style="max-width:70px;max-height:44px;object-fit:contain;"/>`
      : '<div style="font-size:18px;font-weight:900;color:#1e40af;">SMEC</div>';

    let ganttInner = '<div style="display:flex;align-items:center;justify-content:center;flex:1;color:#94a3b8;font-weight:700;">ไม่มีแผนงาน</div>';
    if (tl && vt.length) {
      const mw=100/tl.months.length;
      const mH=tl.months.map(m=>`<div style="width:${mw}%;border-right:1px solid #999;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;">${m.label}</div>`).join('');
      const wH=tl.months.map(()=>['W1','W2','W3','W4'].map(w=>`<div style="width:${mw/4}%;border-right:1px solid #ccc;font-size:7px;font-weight:700;color:#888;display:flex;align-items:center;justify-content:center;">${w}</div>`).join('')).join('');
      const maxR=16;
      const tRows=vt.slice(0,maxR).map((t,i)=>{
        const pL=_pct(t.StartDate,tl),pW=Math.max(.5,_pct(t.EndDate,tl)-pL);
        let aL=null,aW=null;
        if(t.ActualStartDate){aL=_pct(t.ActualStartDate,tl);aW=Math.max(.5,_pct(t.ActualEndDate||new Date(),tl)-aL);}
        const aC=_acolor(t.Status||'');
        const pd=`${fmtDate(t.StartDate)}${t.EndDate!==t.StartDate?' - '+fmtDate(t.EndDate):''}`;
        const ad=t.ActualStartDate?`${fmtDate(t.ActualStartDate)}${t.ActualEndDate?' - '+fmtDate(t.ActualEndDate):''}`:'-';
        return `<div style="display:flex;align-items:stretch;flex:1;min-height:20px;border-bottom:1px dotted #ccc;">
          <div style="width:40%;flex-shrink:0;display:flex;border-right:2px solid #000;background:#fff;">
            <div style="width:50%;border-right:1px solid #ddd;padding:2px 4px;font-size:9px;font-weight:700;display:flex;align-items:flex-start;gap:2px;"><span style="color:#999;">${i+1}.</span><span>${escapeHTML(t.TaskName||'')}</span></div>
            <div style="width:20%;border-right:1px solid #ddd;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;text-align:center;">${escapeHTML(t.Assignee||'-')}</div>
            <div style="width:30%;font-size:8px;font-weight:700;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2px;">
              <span style="color:#1e40af;">${escapeHTML(pd)}</span><span style="color:#065f46;">${escapeHTML(ad)}</span>
            </div>
          </div>
          <div style="flex:1;position:relative;">
            <div style="position:absolute;height:6px;background:#cbd5e1;border:1px solid #94a3b8;border-radius:1px;top:50%;transform:translateY(-4px);left:${pL}%;width:${pW}%;"></div>
            ${aL!==null?`<div style="position:absolute;height:5px;border-radius:1px;top:50%;transform:translateY(2px);left:${aL}%;width:${aW}%;background:${aC};"></div>`:''}
          </div>
        </div>`;
      }).join('');
      const eRows=Array.from({length:Math.max(0,maxR-vt.length)}).map(()=>`<div style="display:flex;align-items:stretch;flex:1;min-height:20px;border-bottom:1px dotted #ccc;"><div style="width:40%;flex-shrink:0;border-right:2px solid #000;display:flex;"><div style="width:50%;border-right:1px solid #ddd;"></div><div style="width:20%;border-right:1px solid #ddd;"></div><div style="width:30%;"></div></div><div style="flex:1;"></div></div>`).join('');
      ganttInner=`
        <div style="display:flex;height:40px;border-bottom:2px solid #000;background:#f4f7fa;flex-shrink:0;">
          <div style="width:40%;border-right:2px solid #000;display:flex;flex-shrink:0;">
            <div style="width:50%;border-right:1px solid #999;font-size:10px;font-weight:800;text-transform:uppercase;display:flex;align-items:center;justify-content:center;text-align:center;padding:2px 4px;">รายละเอียดขั้นตอน</div>
            <div style="width:20%;border-right:1px solid #999;font-size:9px;font-weight:800;text-transform:uppercase;display:flex;align-items:center;justify-content:center;">ผู้รับผิดชอบ</div>
            <div style="width:30%;font-size:9px;font-weight:800;text-transform:uppercase;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.3;text-align:center;">
              <span style="color:#1e40af;">แผนงาน (PLAN)</span><span style="color:#065f46;font-size:8px;">ทำจริง (ACTUAL)</span>
            </div>
          </div>
          <div style="flex:1;display:flex;flex-direction:column;">
            <div style="display:flex;height:50%;border-bottom:1px solid #999;">${mH}</div>
            <div style="display:flex;height:50%;">${wH}</div>
          </div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;">${tRows}${eRows}</div>`;
    }
    const dn=_docNoOf(job);
    const html=`<div class="sm-povl" id="smPO">
      <div class="sm-ptbar">
        <span style="font-size:14px;font-weight:700;">👁 ตัวอย่างแผนงาน — A4 แนวนอน</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" id="smPDFBtn">⬇ โหลด PDF</button>
          <button class="btn" onclick="window.print()">🖨 Print</button>
          <button class="btn btn-ghost" id="smPCls">✕ ปิด</button>
        </div>
      </div>
      <div id="schedule-print-area" class="sm-ppaper">
        <div class="sm-phd">
          <div style="width:70px;">${logo}</div>
          <div style="flex:1;text-align:center;padding:0 12px;">
            <div style="font-size:19px;font-weight:900;text-transform:uppercase;letter-spacing:1px;">Project Schedule Plan</div>
            <div style="font-size:11px;margin-top:2px;font-weight:700;">บริษัท สยามแมค เอ็นจิเนียริ่ง แอนด์ คอนสตรัคชั่น จำกัด</div>
          </div>
          <div style="width:140px;border:2px solid #000;padding:6px 8px;background:#f4f7fa;font-size:12px;font-weight:900;text-align:right;">
            JOB: ${escapeHTML(dn)}${job['เลขที่โครงการ']?`<br/><span style="font-size:10px;color:#475569;font-weight:700;">PROJ: ${escapeHTML(job['เลขที่โครงการ']||'')}</span>`:''}
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:6px;font-size:11px;">
          <tr><td style="border:1px solid #000;background:#f4f7fa;padding:3px 7px;font-weight:800;width:15%;">บริษัท / ลูกค้า:</td><td style="border:1px solid #000;padding:3px 7px;width:35%;">${escapeHTML(job['บริษัท']||'-')}</td><td style="border:1px solid #000;background:#f4f7fa;padding:3px 7px;font-weight:800;width:15%;">ผู้แจ้งงาน:</td><td style="border:1px solid #000;padding:3px 7px;width:35%;">${escapeHTML(job['ผู้แจ้ง']||job['ผู้รับผิดชอบ']||'-')}</td></tr>
          <tr><td style="border:1px solid #000;background:#f4f7fa;padding:3px 7px;font-weight:800;">ชื่องาน:</td><td style="border:1px solid #000;padding:3px 7px;font-weight:700;color:#1e3a8a;" colspan="3">${escapeHTML(job['รายละเอียด']||'-')}</td></tr>
          <tr><td style="border:1px solid #000;background:#f4f7fa;padding:3px 7px;font-weight:800;">วันที่รับแจ้ง:</td><td style="border:1px solid #000;padding:3px 7px;">${fmtDate(job['วันที่'])}</td><td style="border:1px solid #000;background:#f4f7fa;padding:3px 7px;font-weight:800;">ผู้รับผิดชอบ:</td><td style="border:1px solid #000;padding:3px 7px;">${escapeHTML(job['ผู้รับผิดชอบ']||'-')}</td></tr>
        </table>
        <div style="display:flex;justify-content:flex-end;margin-bottom:4px;">
          <div style="display:flex;gap:12px;font-size:9px;font-weight:800;border:1px solid #000;padding:3px 8px;background:#fff;">
            <span style="display:flex;align-items:center;gap:3px;"><div style="width:12px;height:5px;background:#cbd5e1;border:1px solid #94a3b8;"></div> แผนงาน (Plan)</span>
            <span style="display:flex;align-items:center;gap:3px;"><div style="width:12px;height:5px;background:#10b981;"></div> เสร็จแล้ว</span>
            <span style="display:flex;align-items:center;gap:3px;"><div style="width:12px;height:5px;background:#f59e0b;"></div> กำลังทำ</span>
            <span style="display:flex;align-items:center;gap:3px;"><div style="width:12px;height:5px;background:#f43f5e;"></div> ล่าช้า</span>
          </div>
        </div>
        <div style="flex:1;border:2px solid #000;display:flex;flex-direction:column;overflow:hidden;">${ganttInner}</div>
        <div class="sm-psigs">
          ${['ผู้จัดทำแผนงาน (Planner)','ผู้ตรวจ (Checker)','ผู้อนุมัติ (Manager)'].map(r=>`<div><div style="border-bottom:1px solid #000;margin:0 auto 5px;width:140px;height:32px;"></div><div style="font-size:11px;font-weight:800;">${r}</div><div style="font-size:10px;color:#475569;">วันที่ ...../...../.....</div></div>`).join('')}
        </div>
      </div>
    </div>`;
    const wrap=document.createElement('div'); wrap.innerHTML=html;
    document.body.appendChild(wrap.firstElementChild);
    document.getElementById('smPCls').onclick=()=>document.getElementById('smPO').remove();
    document.getElementById('smPDFBtn').onclick=async()=>{
      const btn=document.getElementById('smPDFBtn');
      btn.disabled=true; btn.textContent='⏳ กำลังสร้าง...';
      try {
        if(!window.htmlToImage) await new Promise((r,j)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js';s.onload=r;s.onerror=j;document.head.appendChild(s);});
        if(!window.jspdf) await new Promise((r,j)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';s.onload=r;s.onerror=j;document.head.appendChild(s);});
        await new Promise(r=>setTimeout(r,300));
        const el=document.getElementById('schedule-print-area');
        const du=await window.htmlToImage.toPng(el,{quality:1,pixelRatio:2,backgroundColor:'#ffffff',width:1123,height:794});
        const {jsPDF}=window.jspdf;
        const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
        const ip=pdf.getImageProperties(du); const pw=pdf.internal.pageSize.getWidth();
        pdf.addImage(du,'PNG',0,0,pw,(ip.height*pw)/ip.width);
        pdf.save(`Schedule_${dn}.pdf`);
      } catch(e){alert('สร้าง PDF ไม่สำเร็จ: '+e.message);}
      finally{btn.disabled=false;btn.textContent='⬇ โหลด PDF';}
    };
    // lazy load logo for print
    if(typeof LOGO_DATA_URL==='undefined'&&typeof Print!=='undefined'){
      Print.loadLogoIfNeeded&&Print.loadLogoIfNeeded();
    }
  }

  // ---- Save ----
  async function _save() {
    if (!state.signedIn) { App.toast('กรุณาเข้าสู่ระบบ','error'); return; }
    const other = state.data.schedule.filter(t=>String(t.DocNo||'').trim()!==_sel);
    const mine  = _tasks.map(t=>({...t, DocNo:_sel, LastUpdated:new Date().toISOString().split('T')[0]}));
    state.data.schedule = [...other, ...mine];
    const ok = await App.saveAll();
    if (ok) { _dirty=false; _refreshFooter(); App.toast('บันทึกแผนงานสำเร็จ','success'); }
  }

  // ---- Footer refresh ----
  function _refreshFooter() {
    const fs=document.getElementById('smFS'); const sb=document.getElementById('smSB');
    if(fs) fs.innerHTML = _dirty
      ? '<span style="color:#d97706;background:#fef3c7;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:700;border:1px solid #fde68a;">⚠️ ยังไม่ได้บันทึก</span>'
      : '<span style="color:#64748b;font-size:12px;">ข้อมูลล่าสุดปลอดภัย ✓</span>';
    if(sb) sb.disabled=!_dirty;
  }

  // ---- Refresh task table ----
  function _refreshTable() {
    const tbody=document.getElementById('smTB');
    if(!tbody){_render();return;}
    tbody.innerHTML=_tasks.map((t,i)=>_taskRowHtml(t,i)).join('');
    // refresh gantt
    const eb=document.getElementById('smEB');
    if(eb){
      const old=eb.querySelector('.sm-gantt');
      const ng=document.createElement('div'); ng.innerHTML=_ganttHtml(_tasks);
      const newG=ng.firstElementChild;
      if(newG){if(old)old.replaceWith(newG);else eb.appendChild(newG);}
    }
    _wireInputs();
    _refreshFooter();
  }

  // ---- Wire inputs ----
  function _wireInputs() {
    const R=document.getElementById('viewRoot');
    if(!R)return;
    R.querySelectorAll('.smt-n').forEach(el=>el.oninput=e=>{_tasks[+e.target.dataset.i].TaskName=e.target.value;_dirty=true;_refreshFooter();});
    R.querySelectorAll('.smt-a').forEach(el=>el.oninput=e=>{_tasks[+e.target.dataset.i].Assignee=e.target.value;_dirty=true;_refreshFooter();});
    R.querySelectorAll('.smt-s').forEach(el=>el.onchange=e=>{_tasks[+e.target.dataset.i].StartDate=e.target.value;_dirty=true;});
    R.querySelectorAll('.smt-e').forEach(el=>el.onchange=e=>{_tasks[+e.target.dataset.i].EndDate=e.target.value;_dirty=true;});
    R.querySelectorAll('.smt-as').forEach(el=>el.onchange=e=>{_tasks[+e.target.dataset.i].ActualStartDate=e.target.value;_dirty=true;});
    R.querySelectorAll('.smt-ae').forEach(el=>el.onchange=e=>{_tasks[+e.target.dataset.i].ActualEndDate=e.target.value;_dirty=true;});
    R.querySelectorAll('.smt-st').forEach(el=>el.onchange=e=>{
      const i=+e.target.dataset.i; _tasks[i].Status=e.target.value;
      e.target.className='smt-st '+_scls(e.target.value); _dirty=true; _refreshFooter();
    });
    R.querySelectorAll('.smt-del').forEach(el=>el.onclick=async e=>{
      const i=+e.target.dataset.i;
      if(await App.confirmDialog(`ลบขั้นตอน "${_tasks[i].TaskName||''}" ?`,{danger:true,confirmText:'ลบ'})){
        _tasks.splice(i,1); _dirty=true; _refreshTable();
      }
    });
  }

  // ---- Sidebar refresh ----
  function _refreshSidebar() {
    const jl=document.getElementById('smJL'); if(!jl)return;
    const jobs=_jobList();
    jl.innerHTML=jobs.length===0
      ? '<div style="text-align:center;padding:28px;color:#94a3b8;font-weight:700;font-size:12px;">ไม่พบงาน</div>'
      : jobs.map(j=>{
          const dn=_docNoOf(j);
          const jt=_tasksOf(dn);
          const allD=jt.length>0&&jt.every(t=>/เสร็จ/i.test(t.Status||''));
          const bc=jt.length===0?'none':(allD?'done':'has');
          const bt=jt.length===0?'ยังไม่มีแผน':`${jt.length} ขั้นตอน`;
          return `<div class="sm-jcard ${dn===_sel?'sel':''}" data-dn="${escapeHTML(dn)}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <div><div class="sm-jdoc">${escapeHTML(dn)}</div>${j['เลขที่โครงการ']?`<div style="font-size:9px;color:#64748b;font-weight:700;margin-top:1px;">โครงการ: ${escapeHTML(j['เลขที่โครงการ']||'')}</div>`:''}</div>
              <div style="font-size:10px;color:#94a3b8;font-weight:600;flex-shrink:0;margin-left:5px;">${fmtDate(j['วันที่'])}</div>
            </div>
            <div class="sm-jtitle">${escapeHTML((j['รายละเอียด']||'').toString())}</div>
            <div class="sm-jmeta"><span class="sm-jco">${escapeHTML(j['บริษัท']||'-')}</span><span class="sm-jbadge ${bc}">📋 ${bt}</span></div>
          </div>`;
        }).join('');
    jl.querySelectorAll('.sm-jcard').forEach(c=>c.onclick=()=>{
      if(_dirty&&!confirm('มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการเปลี่ยนงานใช่หรือไม่?'))return;
      _sel=c.dataset.dn; _tasks=JSON.parse(JSON.stringify(_tasksOf(_sel))); _dirty=false; _render();
    });
    document.querySelectorAll('.sm-ftab').forEach(b=>{
      b.classList.toggle('active',b.dataset.f===_filter);
      b.onclick=()=>{_filter=b.dataset.f;_refreshSidebar();};
    });
  }

  // ---- Main render ----
  function _render() {
    const tb=document.getElementById('topbar'); const root=document.getElementById('viewRoot');
    _css();

    tb.innerHTML=`<div class="title">Schedule Manager</div>
      <div class="sub">แผนงานรายใบงาน (Job-centric)</div>
      <div class="toolbar"><button class="btn btn-primary" onclick="App.saveAll()">💾 บันทึก</button></div>`;

    const job = _sel ? state.data.jobs.find(j=>_docNoOf(j)===_sel) : null;
    const jobs = _jobList();

    const sidebarHtml=`
      <aside class="sm-sidebar">
        <div class="sm-sidebar-hd"><h2>📅 Schedule</h2><p>Manager System</p></div>
        <div class="sm-sf">
          <button class="sm-dash-btn ${!job?'active':''}" id="smDB">🏠 ภาพรวม (Dashboard)</button>
          <input class="sm-search" type="search" placeholder="ค้นหาเลขใบงาน..." value="${escapeHTML(_search)}" id="smSR"/>
          <div class="sm-ftabs">
            <button class="sm-ftab ${_filter==='active'?'active':''}" data-f="active">งานที่กำลังทำ</button>
            <button class="sm-ftab ${_filter==='all'?'active':''}" data-f="all">งานทั้งหมด</button>
          </div>
        </div>
        <div class="sm-jlist" id="smJL">
          ${jobs.map(j=>{
            const dn=_docNoOf(j); const jt=_tasksOf(dn);
            const allD=jt.length>0&&jt.every(t=>/เสร็จ/i.test(t.Status||''));
            const bc=jt.length===0?'none':(allD?'done':'has');
            const bt=jt.length===0?'ยังไม่มีแผน':`${jt.length} ขั้นตอน`;
            return `<div class="sm-jcard ${dn===_sel?'sel':''}" data-dn="${escapeHTML(dn)}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div><div class="sm-jdoc">${escapeHTML(dn)}</div>${j['เลขที่โครงการ']?`<div style="font-size:9px;color:#64748b;font-weight:700;margin-top:1px;">โครงการ: ${escapeHTML(j['เลขที่โครงการ']||'')}</div>`:''}</div>
                <div style="font-size:10px;color:#94a3b8;font-weight:600;flex-shrink:0;margin-left:5px;">${fmtDate(j['วันที่'])}</div>
              </div>
              <div class="sm-jtitle">${escapeHTML((j['รายละเอียด']||'').toString())}</div>
              <div class="sm-jmeta"><span class="sm-jco">${escapeHTML(j['บริษัท']||'-')}</span><span class="sm-jbadge ${bc}">📋 ${bt}</span></div>
            </div>`;
          }).join('')||'<div style="text-align:center;padding:28px;color:#94a3b8;font-weight:700;font-size:12px;">ไม่พบงาน</div>'}
        </div>
        <div class="sm-sfooter"><button class="btn btn-sm btn-ghost" onclick="App.loadAll()">🔄 โหลดข้อมูลใหม่</button></div>
      </aside>`;

    let mainHtml='';
    if (!job) {
      mainHtml=`<div class="sm-main">${_dashHtml()}</div>`;
    } else {
      const tn=_tasks.length;
      mainHtml=`<div class="sm-main">
        <div class="sm-ehd">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <span class="sm-ejno">${escapeHTML(_docNoOf(job))}</span>
                ${job['เลขที่โครงการ']?`<span class="sm-echip" style="background:#e0f2fe;border-color:#bae6fd;color:#0369a1;">โครงการ: ${escapeHTML(job['เลขที่โครงการ']||'')}</span>`:''}
              </div>
              <div class="sm-etitle">${escapeHTML(job['รายละเอียด']||'-')}</div>
              <div class="sm-emeta">
                ${job['บริษัท']?`<span class="sm-echip">🏢 ${escapeHTML(job['บริษัท'])}</span>`:''}
                ${job['สถานะ']?`<span class="sm-echip" style="background:#fef3c7;border-color:#fde68a;color:#92400e;">สถานะ: ${escapeHTML(job['สถานะ'])}</span>`:''}
                ${job['ผู้รับผิดชอบ']?`<span class="sm-echip">👤 ${escapeHTML(job['ผู้รับผิดชอบ'])}</span>`:''}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
              <button class="btn btn-sm" id="smPR" ${tn?'':'disabled'}>🖨 พิมพ์แผนงาน</button>
            </div>
          </div>
        </div>
        <div class="sm-ebody" id="smEB">
          <div class="sm-ttbar">
            <div class="sm-ttbar-title">📋 ตารางแผนงาน (Plan vs Actual)</div>
            <div class="sm-ttbar-btns">
              <button class="btn btn-sm btn-danger" id="smCL">🗑 ล้างทั้งหมด</button>
              <button class="btn btn-sm" id="smSORT">⇅ เรียงวันที่</button>
              <button class="btn btn-success" id="smADD">+ เพิ่มขั้นตอน</button>
            </div>
          </div>
          ${tn===0?`<div style="text-align:center;padding:48px;background:#fff;border-radius:10px;border:2px dashed #e5e7eb;color:#94a3b8;"><div style="font-size:32px;margin-bottom:8px;">📅</div><div style="font-size:15px;font-weight:700;">ยังไม่มีแผนงาน</div><div style="font-size:12px;margin-top:4px;">คลิก "+ เพิ่มขั้นตอน" เพื่อเริ่ม</div></div>`:`
          <div style="overflow-x:auto;border-radius:10px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.05);">
            <table class="sm-tt">
              <thead>
                <tr>
                  <th rowspan="2">#</th>
                  <th rowspan="2" style="text-align:left;min-width:180px;">ชื่อขั้นตอน</th>
                  <th rowspan="2" style="min-width:90px;">ผู้รับผิดชอบ</th>
                  <th colspan="2" class="plan">📅 แผนงาน (Plan)</th>
                  <th colspan="2" class="actual">✅ ทำจริง (Actual)</th>
                  <th rowspan="2">สถานะ</th>
                  <th rowspan="2">ลบ</th>
                </tr>
                <tr>
                  <th class="plan" style="min-width:110px;">วันที่เริ่ม</th>
                  <th class="plan" style="min-width:110px;">กำหนดเสร็จ</th>
                  <th class="actual" style="min-width:110px;">เริ่มจริง</th>
                  <th class="actual" style="min-width:110px;">เสร็จจริง</th>
                </tr>
              </thead>
              <tbody id="smTB">${_tasks.map((t,i)=>_taskRowHtml(t,i)).join('')}</tbody>
            </table>
          </div>
          ${_ganttHtml(_tasks)}`}
        </div>
        <div class="sm-foot"><div id="smFS"></div><button class="btn btn-primary" id="smSB" ${_dirty?'':'disabled'} style="padding:9px 24px;">💾 บันทึกแผนงาน</button></div>
      </div>`;
    }

    root.innerHTML=`<div class="sm-root">${sidebarHtml}${mainHtml}</div>`;
    _refreshFooter();
    _wireEvents();
    if(!job) _loadCharts().catch(()=>{});
  }

  function _wireEvents() {
    const R=document.getElementById('viewRoot'); if(!R)return;
    // job cards
    R.querySelectorAll('.sm-jcard').forEach(c=>c.onclick=()=>{
      if(_dirty&&!confirm('มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการเปลี่ยนงานใช่หรือไม่?'))return;
      _sel=c.dataset.dn; _tasks=JSON.parse(JSON.stringify(_tasksOf(_sel))); _dirty=false; _render();
    });
    // dashboard
    const db=document.getElementById('smDB');
    if(db)db.onclick=()=>{if(_dirty&&!confirm('ยังไม่ได้บันทึก ต้องการออก?'))return;_sel=null;_dirty=false;_render();};
    // search
    const sr=document.getElementById('smSR');
    if(sr)sr.oninput=e=>{_search=e.target.value;_refreshSidebar();};
    // filter tabs
    R.querySelectorAll('.sm-ftab').forEach(b=>b.onclick=()=>{_filter=b.dataset.f;_refreshSidebar();});
    // add task
    const add=document.getElementById('smADD');
    if(add)add.onclick=()=>{
      const last=_tasks[_tasks.length-1];
      const dd=last?.EndDate?_dateVal(last.EndDate):new Date().toISOString().split('T')[0];
      _tasks.push({Task_ID:`sdb_${Date.now()}`,DocNo:_sel,TaskName:'',Assignee:'',StartDate:dd,EndDate:dd,ActualStartDate:'',ActualEndDate:'',Status:'รอดำเนินการ',LastUpdated:''});
      _dirty=true; _refreshTable();
    };
    // clear
    const cl=document.getElementById('smCL');
    if(cl)cl.onclick=async()=>{if(await App.confirmDialog('ล้างขั้นตอนทั้งหมด?',{danger:true,confirmText:'ล้าง'})){_tasks=[];_dirty=true;_render();}};
    // sort
    const so=document.getElementById('smSORT');
    if(so)so.onclick=()=>{_tasks.sort((a,b)=>new Date(a.StartDate||0)-new Date(b.StartDate||0));_dirty=true;_refreshTable();};
    // save
    const sb=document.getElementById('smSB');
    if(sb)sb.onclick=()=>_save();
    // print
    const pr=document.getElementById('smPR');
    if(pr)pr.onclick=()=>_openPrint();
    _wireInputs();
  }

  return {
    render: _render,
    // Navigate to schedule page with a specific job pre-selected in sidebar
    openForJob(docNo) {
      document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === 'schedule'));
      _sel = docNo || null;
      _tasks = _sel ? JSON.parse(JSON.stringify(_tasksOf(_sel))) : [];
      _dirty = false;
      _render();
    }
  };
})();
