/* ==========================================================================
 * Logistics Manager — Delivery Note (DO) + Gate Pass (GP)
 * Port จาก React SMECLogisticsHub → vanilla JS
 * ใช้ SheetsAPI + DriveAPI (OAuth) แทน Google Script URL
 * ========================================================================== */

const LogisticsManager = (() => {
  const { state, escapeHTML, fmtDate, toast, confirmDialog, nextDocNo } = App;

  /* ---- Constants ---- */
  const SIGNATURE_DB = {
    '1234': { url: 'https://upload.wikimedia.org/wikipedia/commons/f/f8/John_Hancock_signature.svg', name: 'นาย สมชาย รักงาน (ช่าง)' },
    '5678': { url: 'https://upload.wikimedia.org/wikipedia/commons/c/c5/George_Washington_signature.svg', name: 'นาย สมเกียรติ ขยัน (ช่าง)' },
    '0000': { url: 'https://upload.wikimedia.org/wikipedia/commons/8/84/Thomas_Edison_Signature.svg', name: 'แอดมิน ระบบ' },
    '2463659': { url: 'https://lh3.googleusercontent.com/d/1SjjZueK-_f2I30vEfW_97bXxP02AIbq7', name: 'พลภัทร นิลสกุล' }
  };
  const SMEC_LOGO = 'https://lh3.googleusercontent.com/d/1M2t7dFe5AskW8Zc1hiANYwUeaow6Km5_';
  const BFL_LOGO  = 'https://lh3.googleusercontent.com/d/1pxgrHNjUwNUpjSN31_uvxIcsGcD8XfoX';

  /* ---- State ---- */
  let _do   = _initDO();
  let _doItems = [];
  let _doRef = null;          // selected job reference
  let _gp   = _initGP();
  let _hTab = 'delivery';     // history tab
  let _hSearch = '';
  let _hFilters = { start:'', end:'', company:'' };
  let _hSort  = { field:'date', dir:'desc' };
  let _jSearch = '';          // job search modal
  let _saving = false;
  let _styleOK = false;

  function _initDO() {
    return {
      doNo: '', date: _today(), customerType: 'OTHER', otherName: '', dept: '',
      refPo: '', images: [], sigUrl: null, sigName: '', pin: ''
    };
  }
  function _initGP() {
    return {
      gpNo: '', company: 'SMEC', otherCompany: '', requesterName: '', position: '',
      dept: '', date: _today(), purpose: '',
      items: ['','','','','',''],
      outDate: _today(), outTime: '', vehType: '', vehBrand: '', vehColor: '',
      vehPlate: '', notes: '', images: [], sigUrl: null, sigName: '', pin: ''
    };
  }
  function _today() { return new Date().toISOString().split('T')[0]; }

  /* ---- CSS ---- */
  function _css() {
    if (_styleOK) return; _styleOK = true;
    const s = document.createElement('style');
    s.textContent = `
      .lg-root{padding:20px 24px;max-width:960px;margin:0 auto;}
      .lg-section{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:18px 20px;margin-bottom:18px;box-shadow:0 1px 3px rgba(0,0,0,.06);}
      .lg-section h3{margin:0 0 14px;font-size:14px;font-weight:700;color:#374151;display:flex;align-items:center;gap:8px;padding-bottom:10px;border-bottom:1px solid #f3f4f6;}
      .lg-grid{display:grid;gap:12px;}
      .lg-grid.cols2{grid-template-columns:1fr 1fr;}
      .lg-grid.cols3{grid-template-columns:1fr 1fr 1fr;}
      .lg-field{display:flex;flex-direction:column;gap:4px;}
      .lg-field label{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;}
      .lg-field input,.lg-field select,.lg-field textarea{width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;box-sizing:border-box;}
      .lg-field input:focus,.lg-field select:focus,.lg-field textarea:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12);}
      .lg-radio-group{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
      .lg-radio-opt{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:6px;background:#f9fafb;cursor:pointer;font-size:13px;}
      .lg-radio-opt input[type=radio]{width:16px;height:16px;cursor:pointer;}
      .lg-radio-opt.active{background:#dbeafe;border-color:#93c5fd;color:#1d4ed8;font-weight:600;}
      .lg-img-grid{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;}
      .lg-img-thumb{position:relative;width:72px;height:72px;border:2px solid #e5e7eb;border-radius:6px;overflow:hidden;background:#f9fafb;}
      .lg-img-thumb img{width:100%;height:100%;object-fit:cover;}
      .lg-img-thumb .rm{position:absolute;top:2px;right:2px;background:rgba(220,38,38,.85);color:#fff;border:none;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;line-height:1;}
      .lg-sig-box{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
      .lg-sig-badge{display:flex;align-items:center;gap:8px;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:6px 12px;}
      .lg-sig-badge img{height:28px;object-fit:contain;mix-blend-mode:multiply;}
      .lg-items-table{width:100%;border-collapse:collapse;font-size:13px;}
      .lg-items-table th{background:#f9fafb;padding:7px 8px;border-bottom:2px solid #e5e7eb;font-weight:700;font-size:12px;text-align:left;}
      .lg-items-table td{padding:5px 6px;border-bottom:1px solid #f3f4f6;vertical-align:middle;}
      .lg-items-table input{width:100%;border:1px solid #e5e7eb;border-radius:4px;padding:4px 6px;font-size:12px;font-family:inherit;box-sizing:border-box;}
      .lg-items-table input:focus{outline:none;border-color:#2563eb;}
      .lg-history-table{width:100%;border-collapse:collapse;font-size:13px;}
      .lg-history-table th{background:#f9fafb;padding:9px 12px;border-bottom:2px solid #e5e7eb;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap;}
      .lg-history-table th:hover{background:#f3f4f6;}
      .lg-history-table td{padding:8px 12px;border-bottom:1px solid #f3f4f6;vertical-align:top;}
      .lg-history-table tbody tr:hover{background:#f9fafb;}
      .lg-tab-bar{display:flex;gap:4px;background:#f3f4f6;border-radius:8px;padding:4px;}
      .lg-tab{padding:8px 16px;border:none;background:transparent;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;color:#6b7280;}
      .lg-tab.active{background:#fff;color:#1d4ed8;box-shadow:0 1px 3px rgba(0,0,0,.1);}
      .lg-print-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;}
      .lg-print-wrap{background:#fff;border-radius:12px;width:min(860px,96vw);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px rgba(0,0,0,.25);}
      .lg-print-hd{background:#1f2937;color:#fff;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;}
      .lg-print-hd h3{margin:0;font-size:15px;}
      .lg-print-body{flex:1;overflow:auto;background:#e5e7eb;padding:20px;display:flex;justify-content:center;}
      .lg-print-ft{padding:12px 18px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:10px;background:#fff;flex-shrink:0;}
      .a4{background:#fff;width:794px;font-family:"Sarabun","Tahoma",sans-serif;color:#000;position:relative;box-shadow:0 4px 16px rgba(0,0,0,.15);}
      @media print{.no-print{display:none!important;}.lg-print-overlay{position:static;background:transparent;padding:0;}.lg-print-wrap{box-shadow:none;max-height:none;border-radius:0;}.lg-print-hd,.lg-print-ft{display:none;}.lg-print-body{background:#fff;padding:0;overflow:visible;}.a4{box-shadow:none;}}
    `;
    document.head.appendChild(s);
  }

  /* ---- Helpers ---- */
  function _fmtDateThai(s) {
    if (!s) return '';
    const months=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const d = new Date(s);
    if (isNaN(d)) return s;
    return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
  }
  function _fmtDateDisplay(s) {
    if (!s) return '-';
    const months=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    try {
      const d = _parseDate(s);
      if (!d) return s;
      return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getFullYear()+543).slice(-2)}`;
    } catch { return s; }
  }
  function _parseDate(s) {
    if (!s) return null;
    const str = String(s).trim();
    if (str.includes('/')) {
      const p = str.split(' ')[0].split('/');
      if (p.length===3) {
        let y=p[2]; if(y.length===2) y='20'+y;
        const iso = p[0].length===4 ? `${p[0]}-${p[1].padStart(2,'0')}-${p[2].padStart(2,'0')}` : `${y}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
        const d=new Date(iso); return isNaN(d)?null:d;
      }
    }
    const d=new Date(str); return isNaN(d)?null:d;
  }
  function _sortDate(s) { const d=_parseDate(s); return d?d.getTime():0; }
  function _readFile(file) {
    return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsDataURL(file); });
  }
  function _imgUrl(url) {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    if (url.includes('drive.google.com')) {
      let id='';
      try { if(url.includes('/d/')) id=url.split('/d/')[1].split('/')[0]; else if(url.includes('id=')) id=url.split('id=')[1].split('&')[0]; } catch(e){}
      if (id) return `https://lh3.googleusercontent.com/d/${id}`;
    }
    return url;
  }
  function _cellToViewUrl(v) {
    if (!v) return null;
    const p = App.DriveAPI ? App.DriveAPI.parseCellValue(v) : DriveAPI.parseCellValue(v);
    if (!p) return null;
    if (p.url) return p.url;
    if (p.id) return `https://drive.google.com/file/d/${p.id}/view`;
    return null;
  }
  function _getAtts(val) {
    if (!val) return [];
    return String(val).split(',').map(s=>s.trim()).filter(Boolean);
  }
  function _genDO() { return App.nextDocNo('DO','delivery','เลขที่ใบส่งของ'); }
  function _genGP() { return App.nextDocNo('GP','gatepass','เลขที่'); }
  function _custName(info) {
    if (['BFL','BFLFP','BFLPC'].includes(info.customerType)) return info.customerType;
    return info.otherName || 'OTHER';
  }

  /* ---- Autocomplete from gatepass history ---- */
  function _buildProfiles() {
    const profiles = {};
    [...state.data.gatepass].reverse().forEach(item => {
      const req = String(item['ผู้ขออนุญาต']||'').trim();
      if (!req || req==='-') return;
      if (!profiles[req]) profiles[req] = { company:'', dept:'', pos:'', veh:'', color:'' };
      const p = profiles[req];
      const c = String(item['บริษัท']||'').trim();
      const d = String(item['แผนก']||'').trim();
      const pos = String(item['ตำแหน่ง']||'').trim();
      const veh = String(item['ยานพาหนะ']||'').trim();
      const col = String(item['สี']||'').trim();
      if (!p.company && c && c!=='-' && c.length<30) p.company=c;
      if (!p.dept && d && d!=='-' && d.length<30) p.dept=d;
      if (!p.pos && pos && pos!=='-' && pos.length<30) p.pos=pos;
      if (!p.veh && veh && veh!=='-') p.veh=veh;
      if (!p.color && col && col!=='-') p.color=col;
    });
    return profiles;
  }

  /* ================================================================
     DELIVERY NOTE — render
     ================================================================ */
  function renderDelivery() {
    _css();
    if (!_do.doNo) _do.doNo = _genDO();

    const topbar = document.getElementById('topbar');
    const root = document.getElementById('viewRoot');
    topbar.innerHTML = `
      <div class="title">ใบส่งของ (Delivery Note)</div>
      <div class="sub">สร้างและพิมพ์ใบส่งของชั่วคราว</div>
      <div class="toolbar">
        <div class="lg-tab-bar" style="margin-right:8px;">
          <button class="lg-tab active" id="lgDelivTabNew">🆕 สร้างใหม่</button>
          <button class="lg-tab" id="lgDelivTabHistory">📋 ประวัติ</button>
        </div>
        <button class="btn" id="lgBtnSearchJob">🔍 ค้นหาจากใบงาน</button>
        <button class="btn btn-primary" id="lgBtnPreviewDO">👁 พรีวิว / พิมพ์</button>
      </div>`;

    const refBanner = _doRef ? `
      <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:11px;color:#3b82f6;font-weight:700;text-transform:uppercase;">อ้างอิงจากใบงาน</div>
          <div style="font-weight:700;font-size:15px;">${escapeHTML(_doRef.docNo||'')} <span style="font-size:12px;color:#6b7280;">${escapeHTML(_doRef.company||'')}</span></div>
          <div style="font-size:12px;color:#374151;">${escapeHTML((_doRef.details||'').substring(0,80))}</div>
        </div>
        <button class="btn btn-sm btn-ghost" id="lgClearRef">✕ ยกเลิก</button>
      </div>` : '';

    const itemsHTML = _doItems.map((it,i) => {
      const remain = Math.max(0,(parseFloat(it.qty)||0)-(parseFloat(it.deliveredQty)||0)-(parseFloat(it.deliverQty)||0));
      return `<tr>
        <td style="text-align:center;padding:4px 6px;">
          <input type="checkbox" ${it.selected?'checked':''} ${it.disabled?'disabled':''} data-idx="${i}" class="do-chk" style="width:16px;height:16px;">
        </td>
        <td><input type="text" value="${escapeHTML(it.name)}" data-idx="${i}" data-fld="name" class="do-inp" ${it.disabled?'disabled':''}></td>
        <td><input type="number" value="${it.qty}" data-idx="${i}" data-fld="qty" class="do-inp" style="width:60px;" ${_doRef&&it.originalId!=='temp_1'?'disabled':''}></td>
        <td><input type="number" value="${it.deliveredQty||0}" data-idx="${i}" data-fld="deliveredQty" class="do-inp" style="width:55px;" ${it.disabled?'disabled':''}></td>
        <td style="display:flex;gap:4px;">
          <input type="number" value="${it.deliverQty}" data-idx="${i}" data-fld="deliverQty" class="do-inp" style="width:55px;" ${!it.selected||it.disabled?'disabled':''}>
          <input type="text" value="${escapeHTML(it.unit)}" data-idx="${i}" data-fld="unit" class="do-inp" style="width:45px;" ${_doRef&&it.originalId!=='temp_1'?'disabled':''}>
        </td>
        <td style="text-align:center;color:#dc2626;font-weight:700;">${remain}</td>
        ${!_doRef?`<td><button class="btn btn-sm btn-ghost" data-idx="${i}" class="do-rm" style="color:#dc2626;">🗑</button></td>`:'<td></td>'}
      </tr>`;
    }).join('');

    const imgsHTML = _do.images.map((url,i)=>`
      <div class="lg-img-thumb">
        <img src="${url}" alt="img${i}" crossorigin="anonymous">
        <button class="rm" data-idx="${i}" data-type="do">✕</button>
      </div>`).join('');

    const sigHTML = _do.sigUrl ? `
      <div class="lg-sig-badge">
        <span style="font-size:11px;font-weight:700;color:#059669;">✓ ยืนยันแล้ว</span>
        <span style="font-size:12px;font-weight:700;">${escapeHTML(_do.sigName)}</span>
        <img src="${_imgUrl(_do.sigUrl)}" alt="sig" crossorigin="anonymous">
        <button class="btn btn-sm btn-ghost" id="lgClearSigDO">✕</button>
      </div>` : `
      <div class="lg-sig-box">
        <input type="password" id="lgDOPin" placeholder="PIN" style="width:80px;text-align:center;padding:7px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;">
        <button class="btn btn-sm" id="lgSignDO">ลงลายเซ็น</button>
      </div>`;

    root.innerHTML = `<div class="lg-root">
      ${refBanner}
      <div class="lg-grid cols2">
        <div class="lg-section">
          <h3>🏢 ส่งถึงบริษัท / ลูกค้า</h3>
          <div class="lg-radio-group" id="lgCustRadio">
            ${['BFL','BFLFP','BFLPC'].map(c=>`
              <label class="lg-radio-opt${_do.customerType===c?' active':''}">
                <input type="radio" name="lgCust" value="${c}" ${_do.customerType===c?'checked':''}>
                ${c==='BFL'?'บจก. บลูฟาโล่':c==='BFLFP'?'บ. บลูฟาโล่ ฟู้ดฯ':'บ. บลูฟาโล่ เพ็ทแคร์ฯ'}
              </label>`).join('')}
            <label class="lg-radio-opt${_do.customerType==='OTHER'?' active':''}">
              <input type="radio" name="lgCust" value="OTHER" ${_do.customerType==='OTHER'?'checked':''}> อื่นๆ
              <input type="text" id="lgOtherName" value="${escapeHTML(_do.otherName)}" placeholder="ระบุ..." style="border:none;border-bottom:1px solid #d1d5db;outline:none;font-size:12px;flex:1;background:transparent;">
            </label>
          </div>
          <div class="lg-field" style="margin-top:12px;">
            <label>แผนก (Department)</label>
            <input type="text" id="lgDODept" value="${escapeHTML(_do.dept)}" placeholder="เช่น ซ่อมบำรุง...">
          </div>
        </div>
        <div class="lg-section">
          <h3>📋 ข้อมูลเอกสาร</h3>
          <div class="lg-grid cols2">
            <div class="lg-field">
              <label>เลขที่ใบส่งของ</label>
              <input type="text" id="lgDONo" value="${escapeHTML(_do.doNo)}" readonly style="background:#f9fafb;font-weight:700;color:#1d4ed8;">
            </div>
            <div class="lg-field">
              <label>วันที่ส่ง</label>
              <input type="date" id="lgDODate" value="${_do.date}">
            </div>
            <div class="lg-field" style="grid-column:1/-1;">
              <label>อ้างอิง PO / เอกสาร</label>
              <input type="text" id="lgDORefPo" value="${escapeHTML(_do.refPo)}" placeholder="ระบุเลข PO...">
            </div>
          </div>
        </div>
      </div>

      <div class="lg-section">
        <h3>✍️ ลายเซ็นผู้ส่ง</h3>
        ${sigHTML}
      </div>

      <div class="lg-section">
        <h3>📋 รายการจัดส่ง
          ${!_doRef?`<button class="btn btn-sm btn-success" id="lgAddItem" style="margin-left:auto;">+ เพิ่มรายการ</button>`:''}
        </h3>
        <div style="overflow-x:auto;">
        <table class="lg-items-table">
          <thead><tr>
            <th style="width:36px;text-align:center;">✓</th>
            <th>รายการ</th><th style="width:70px;">ยอดเต็ม</th>
            <th style="width:70px;">ส่งแล้ว</th><th style="width:110px;">ส่งรอบนี้</th>
            <th style="width:50px;text-align:center;">ค้าง</th>
            <th style="width:36px;"></th>
          </tr></thead>
          <tbody id="lgDOTableBody">${itemsHTML}</tbody>
        </table>
        </div>
      </div>

      <div class="lg-section">
        <h3>📷 แนบรูป (ต้องมีอย่างน้อย 1 รูป) <span style="font-size:11px;color:#6b7280;font-weight:400;">${_do.images.length}/10</span></h3>
        <div class="lg-img-grid" id="lgDOImgs">${imgsHTML}</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <label class="btn btn-sm" style="cursor:pointer;">📁 เลือกรูป <input type="file" multiple accept="image/*" id="lgDOFileInput" style="display:none;"></label>
          <div style="display:flex;gap:4px;flex:1;min-width:180px;">
            <input type="text" id="lgDOLinkInput" placeholder="หรือวางลิงก์รูป..." style="flex:1;padding:6px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;">
            <button class="btn btn-sm" id="lgDOAddLink">เพิ่ม</button>
          </div>
        </div>
      </div>
    </div>`;

    _wireDO();
  }

  function _wireDO() {
    // tab bar
    const tabNew = document.getElementById('lgDelivTabNew');
    const tabHist = document.getElementById('lgDelivTabHistory');
    if (tabNew) tabNew.onclick = () => renderDelivery();
    if (tabHist) tabHist.onclick = () => { _hTab = 'delivery'; renderHistory(); };

    // topbar buttons
    const btnSearch = document.getElementById('lgBtnSearchJob');
    if (btnSearch) btnSearch.onclick = () => _openJobSearch();
    const btnPreview = document.getElementById('lgBtnPreviewDO');
    if (btnPreview) btnPreview.onclick = () => _openPrintDO();

    const clrRef = document.getElementById('lgClearRef');
    if (clrRef) clrRef.onclick = () => { _doRef=null; _doItems=_defaultItems(); renderDelivery(); };

    // form fields
    const bind = (id, key, obj=_do) => {
      const el=document.getElementById(id); if(el) el.oninput=()=>obj[key]=el.value;
    };
    bind('lgDODate','date'); bind('lgDORefPo','refPo'); bind('lgDODept','dept'); bind('lgDONo','doNo');
    const otherName = document.getElementById('lgOtherName');
    if (otherName) otherName.oninput = () => { _do.otherName=otherName.value; _do.customerType='OTHER'; };

    // radio buttons
    document.querySelectorAll('input[name="lgCust"]').forEach(r=>{
      r.onchange=()=>{
        _do.customerType=r.value;
        document.querySelectorAll('.lg-radio-opt').forEach(o=>o.classList.remove('active'));
        r.closest('.lg-radio-opt').classList.add('active');
      };
    });

    // signature
    const signBtn = document.getElementById('lgSignDO');
    if (signBtn) signBtn.onclick = () => {
      const pin = document.getElementById('lgDOPin').value;
      const sig = SIGNATURE_DB[pin];
      if (sig) { _do.sigUrl=sig.url; _do.sigName=sig.name; renderDelivery(); }
      else toast('รหัส PIN ไม่ถูกต้อง','error');
    };
    const lgDOPin = document.getElementById('lgDOPin');
    if (lgDOPin) lgDOPin.onkeydown = e => { if(e.key==='Enter') document.getElementById('lgSignDO')?.click(); };
    const clearSig = document.getElementById('lgClearSigDO');
    if (clearSig) clearSig.onclick=()=>{ _do.sigUrl=null; _do.sigName=''; renderDelivery(); };

    // items table: checkboxes, inputs, remove
    document.querySelectorAll('.do-chk').forEach(el=>{
      el.onchange=()=>{ const i=+el.dataset.idx; _doItems[i].selected=el.checked; _refreshDOTable(); };
    });
    document.querySelectorAll('.do-inp').forEach(el=>{
      el.oninput=()=>{ const i=+el.dataset.idx; _doItems[i][el.dataset.fld]=el.value; _refreshDOTable(); };
    });
    document.querySelectorAll('[class="do-rm"],.do-rm').forEach(el=>{
      el.onclick=()=>{ const i=+el.dataset.idx; _doItems.splice(i,1); _refreshDOTable(); };
    });

    // add item
    const addItem = document.getElementById('lgAddItem');
    if (addItem) addItem.onclick=()=>{
      _doItems.push({id:`t_${Date.now()}`,originalId:'temp_'+Date.now(),name:'',qty:'1',deliveredQty:0,deliverQty:'1',unit:'EA',selected:true,disabled:false});
      _refreshDOTable();
    };

    // images
    const fileIn = document.getElementById('lgDOFileInput');
    if (fileIn) fileIn.onchange = async e => {
      const files=Array.from(e.target.files).slice(0,10-_do.images.length);
      for(const f of files){ const url=await _readFile(f); _do.images.push(url); }
      _refreshDOImgs(); e.target.value='';
    };
    const addLink = document.getElementById('lgDOAddLink');
    if (addLink) addLink.onclick=()=>{
      const v=document.getElementById('lgDOLinkInput').value.trim();
      if(v){ _do.images.push(v); _refreshDOImgs(); document.getElementById('lgDOLinkInput').value=''; }
    };
    document.querySelectorAll('.rm[data-type="do"]').forEach(b=>{
      b.onclick=()=>{ _do.images.splice(+b.dataset.idx,1); _refreshDOImgs(); };
    });
  }

  function _refreshDOTable() {
    const tbody=document.getElementById('lgDOTableBody'); if(!tbody) return;
    tbody.innerHTML=_doItems.map((it,i)=>{
      const remain=Math.max(0,(parseFloat(it.qty)||0)-(parseFloat(it.deliveredQty)||0)-(parseFloat(it.deliverQty)||0));
      return `<tr>
        <td style="text-align:center;padding:4px 6px;">
          <input type="checkbox" ${it.selected?'checked':''} ${it.disabled?'disabled':''} data-idx="${i}" style="width:16px;height:16px;" onchange="(()=>{window.__lgDoItems[${i}].selected=this.checked;window.__lgRefreshDOTable();})()" >
        </td>
        <td><input type="text" value="${escapeHTML(it.name)}" class="do-inp" style="width:100%;border:1px solid #e5e7eb;border-radius:4px;padding:4px 6px;font-size:12px;font-family:inherit;" ${it.disabled?'disabled':''} oninput="window.__lgDoItems[${i}].name=this.value"></td>
        <td><input type="number" value="${it.qty}" style="width:55px;border:1px solid #e5e7eb;border-radius:4px;padding:4px;text-align:center;" ${_doRef&&it.originalId!=='temp_1'?'disabled':''} oninput="window.__lgDoItems[${i}].qty=this.value;window.__lgRefreshDOTable()"></td>
        <td><input type="number" value="${it.deliveredQty||0}" style="width:50px;border:1px solid #e5e7eb;border-radius:4px;padding:4px;text-align:center;" ${it.disabled?'disabled':''} oninput="window.__lgDoItems[${i}].deliveredQty=this.value;window.__lgRefreshDOTable()"></td>
        <td style="display:flex;gap:3px;">
          <input type="number" value="${it.deliverQty}" style="width:50px;border:1px solid #e5e7eb;border-radius:4px;padding:4px;text-align:center;font-weight:700;" ${!it.selected||it.disabled?'disabled':''} oninput="window.__lgDoItems[${i}].deliverQty=this.value;window.__lgRefreshDOTable()">
          <input type="text" value="${escapeHTML(it.unit)}" style="width:40px;border:1px solid #e5e7eb;border-radius:4px;padding:4px;text-align:center;" ${_doRef&&it.originalId!=='temp_1'?'disabled':''} oninput="window.__lgDoItems[${i}].unit=this.value">
        </td>
        <td style="text-align:center;color:#dc2626;font-weight:700;">${remain}</td>
        ${!_doRef?`<td><button onclick="window.__lgDoItems.splice(${i},1);window.__lgRefreshDOTable()" style="border:none;background:transparent;color:#dc2626;cursor:pointer;font-size:16px;">🗑</button></td>`:'<td></td>'}
      </tr>`;
    }).join('');
    // bind global helpers
    window.__lgDoItems = _doItems;
    window.__lgRefreshDOTable = _refreshDOTable;
  }

  function _refreshDOImgs() {
    const c=document.getElementById('lgDOImgs'); if(!c) return;
    c.innerHTML=_do.images.map((url,i)=>`
      <div class="lg-img-thumb">
        <img src="${url}" alt="img${i}" crossorigin="anonymous">
        <button class="rm" onclick="window.__lgDOImages.splice(${i},1);window.__lgRefreshDOImgs()" style="position:absolute;top:2px;right:2px;background:rgba(220,38,38,.85);color:#fff;border:none;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:11px;">✕</button>
      </div>`).join('');
    window.__lgDOImages = _do.images;
    window.__lgRefreshDOImgs = _refreshDOImgs;
  }

  function _defaultItems() {
    return [{ id:'t1', originalId:'temp_1', name:'', qty:'1', deliveredQty:0, deliverQty:'1', unit:'EA', selected:true, disabled:false }];
  }

  /* ---- Job search modal ---- */
  function _openJobSearch() {
    _jSearch='';
    const overlay=document.createElement('div');
    overlay.className='lg-print-overlay'; overlay.id='lgJobSearchOverlay';
    overlay.innerHTML=`
      <div class="lg-print-wrap" style="max-width:700px;max-height:80vh;">
        <div class="lg-print-hd"><h3>🔍 ค้นหาใบงาน</h3><button class="btn btn-ghost" id="lgCloseJobSearch" style="color:#fff;">✕</button></div>
        <div style="padding:12px 16px;border-bottom:1px solid #e5e7eb;background:#fff;">
          <input type="text" id="lgJobQ" placeholder="พิมพ์เลขที่, บริษัท, หรือรายละเอียด..." style="width:100%;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;box-sizing:border-box;">
        </div>
        <div style="flex:1;overflow-y:auto;background:#fff;" id="lgJobList"></div>
      </div>`;
    document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.querySelector('#lgCloseJobSearch').onclick=close;
    overlay.onclick=e=>{if(e.target===overlay)close();};
    const jobQ=overlay.querySelector('#lgJobQ');
    const list=overlay.querySelector('#lgJobList');
    const renderList=()=>{
      const q=jobQ.value.toLowerCase();
      const jobs=state.data.jobs.filter(j=>{
        const ok = !/ปิดงาน/i.test((j['สถานะ']||'').trim());
        return ok && JSON.stringify(j).toLowerCase().includes(q);
      }).slice(0,40);
      list.innerHTML=jobs.length ? jobs.map(j=>`
        <div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;cursor:pointer;display:flex;justify-content:space-between;align-items:center;" class="job-row" data-id="${escapeHTML(j['เลขที่']||'')}">
          <div>
            <div style="font-weight:700;color:#1d4ed8;">${escapeHTML(j['เลขที่']||'')} <span style="font-size:11px;background:#f3f4f6;padding:2px 6px;border-radius:4px;color:#374151;">${escapeHTML(j['บริษัท']||'')}</span></div>
            <div style="font-size:12px;color:#6b7280;">${escapeHTML((j['รายละเอียด']||'').substring(0,80))}</div>
          </div>
          <span style="color:#d1d5db;font-size:18px;">›</span>
        </div>`).join('')
        : '<div style="padding:32px;text-align:center;color:#9ca3af;">ไม่พบใบงาน</div>';
      list.querySelectorAll('.job-row').forEach(row=>{
        row.onmouseenter=()=>row.style.background='#eff6ff';
        row.onmouseleave=()=>row.style.background='';
        row.onclick=()=>{ _selectJob(jobs.find(j=>j['เลขที่']===row.dataset.id)); close(); };
      });
    };
    jobQ.oninput=renderList; renderList(); jobQ.focus();
  }

  function _selectJob(job) {
    if (!job) return;
    _doRef=job;
    let items=[];
    const subText=job['รายการย่อย']||'';
    if (subText) {
      const lines=String(subText).split('\n');
      lines.forEach((line,i)=>{
        const m=line.trim().match(/^-\s+(.+?)\s+\((.*?)\s+([^)\s]+)\)\s+\[(.+?)\]/);
        if(m){
          let qty=m[2].trim(); let dQty='0';
          if(qty.includes('/')){ const p=qty.split('/'); qty=p[0].trim(); dQty=p[1].trim(); }
          const parsedQty=parseFloat(qty)||0; const parsedDQ=parseFloat(dQty)||0;
          const remain=Math.max(0,parsedQty-parsedDQ);
          const eligible=['เสร็จแล้ว','กำลังดำเนินการ'].includes(m[4].trim());
          items.push({ id:`s_${i}`, originalId:`sub_${i}`, name:m[1].trim(), qty:parsedQty, deliveredQty:parsedDQ, deliverQty:remain>0?remain:0, unit:m[3].trim(), selected:eligible&&remain>0, disabled:!eligible||remain<=0 });
        }
      });
    }
    if (!items.length) {
      items=[{ id:'t1', originalId:'temp_1', name:job['รายละเอียด']||'รายการซ่อม/สร้าง', qty:1, deliveredQty:parseFloat(job['จำนวนที่ส่ง']||0)||0, deliverQty:1, unit:'รายการ', selected:true, disabled:false }];
    }
    _doItems=items;
    let custType='OTHER'; let otherName=job['บริษัท']||'';
    if (['BFL','BFLFP','BFLPC'].some(c=>otherName.toUpperCase().includes(c))) {
      if(otherName.toUpperCase().includes('BFLPC')){ custType='BFLPC'; otherName=''; }
      else if(otherName.toUpperCase().includes('BFLFP')){ custType='BFLFP'; otherName=''; }
      else if(otherName.toUpperCase().includes('BFL')){ custType='BFL'; otherName=''; }
    }
    _do.customerType=custType; _do.otherName=otherName;
    _do.refPo=job['PO']||'';
    renderDelivery();
  }

  /* ================================================================
     GATE PASS — render
     ================================================================ */
  function renderGatePass() {
    _css();
    if (!_gp.gpNo) _gp.gpNo=_genGP();
    const profiles=_buildProfiles();
    const requesters=Object.keys(profiles).sort((a,b)=>a.localeCompare(b,'th'));

    const topbar=document.getElementById('topbar');
    const root=document.getElementById('viewRoot');
    topbar.innerHTML=`
      <div class="title">ใบนำของออก (Gate Pass) <span style="font-size:14px;color:#2563eb;">#${escapeHTML(_gp.gpNo)}</span></div>
      <div class="sub">ฟอร์มขออนุญาตนำของออกนอกเครือข่าย</div>
      <div class="toolbar">
        <div class="lg-tab-bar" style="margin-right:8px;">
          <button class="lg-tab active" id="lgGPTabNew">🆕 สร้างใหม่</button>
          <button class="lg-tab" id="lgGPTabHistory">📋 ประวัติ</button>
        </div>
        <button class="btn btn-primary" id="lgBtnPreviewGP">👁 พรีวิว / พิมพ์</button>
      </div>`;

    const itemsHTML=_gp.items.map((it,i)=>`
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="color:#9ca3af;font-size:12px;width:16px;">${i+1}.</span>
        <input type="text" value="${escapeHTML(it)}" data-gpidx="${i}" class="gp-item-inp" style="flex:1;padding:7px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;" placeholder="รายการที่ ${i+1}...">
      </div>`).join('');

    const gpImgsHTML=_gp.images.map((url,i)=>`
      <div class="lg-img-thumb">
        <img src="${url}" alt="img${i}" crossorigin="anonymous">
        <button class="rm" data-idx="${i}" data-type="gp" style="position:absolute;top:2px;right:2px;background:rgba(220,38,38,.85);color:#fff;border:none;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:11px;">✕</button>
      </div>`).join('');

    const gpSigHTML=_gp.sigUrl?`
      <div class="lg-sig-badge">
        <span style="font-size:11px;font-weight:700;color:#059669;">✓</span>
        <span style="font-size:12px;font-weight:700;">${escapeHTML(_gp.sigName)}</span>
        <img src="${_imgUrl(_gp.sigUrl)}" alt="sig" crossorigin="anonymous">
        <button class="btn btn-sm btn-ghost" id="lgClearSigGP">✕</button>
      </div>`:`
      <div class="lg-sig-box">
        <input type="password" id="lgGPPin" placeholder="PIN" style="width:80px;text-align:center;padding:7px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;font-family:inherit;">
        <button class="btn btn-sm" id="lgSignGP">ดึงลายเซ็น</button>
      </div>`;

    root.innerHTML=`<div class="lg-root">
      <datalist id="lgReqList">${requesters.map(r=>`<option value="${escapeHTML(r)}">`).join('')}</datalist>

      <div class="lg-grid cols2">
        <div class="lg-section">
          <h3>👤 ข้อมูลผู้ขอ</h3>
          <div style="margin-bottom:14px;">${gpSigHTML}</div>
          <div class="lg-grid">
            <div class="lg-field">
              <label>ชื่อ-สกุล ผู้ขออนุญาต</label>
              <input type="text" id="lgGPReq" list="lgReqList" value="${escapeHTML(_gp.requesterName)}" placeholder="ระบุชื่อ...">
            </div>
            <div class="lg-grid cols2">
              <div class="lg-field"><label>ตำแหน่ง</label><input type="text" id="lgGPPos" value="${escapeHTML(_gp.position)}"></div>
              <div class="lg-field"><label>แผนก</label><input type="text" id="lgGPDept" value="${escapeHTML(_gp.dept)}"></div>
            </div>
            <div class="lg-field"><label>วันที่สร้างเอกสาร</label><input type="date" id="lgGPDate" value="${_gp.date}"></div>
          </div>
        </div>
        <div class="lg-section">
          <h3>🏢 บริษัท / จุดประสงค์</h3>
          <div class="lg-field" style="margin-bottom:10px;">
            <label>ระบุบริษัท</label>
            <div class="lg-radio-group" style="grid-template-columns:1fr 1fr;">
              ${['SMEC','BFL','BFLFP','BFLPC'].map(c=>`
                <label class="lg-radio-opt${_gp.company===c?' active':''}">
                  <input type="radio" name="lgGPCo" value="${c}" ${_gp.company===c?'checked':''}>
                  ${c}
                </label>`).join('')}
              <label class="lg-radio-opt${_gp.company==='อื่นๆ'?' active':''}" style="grid-column:1/-1;">
                <input type="radio" name="lgGPCo" value="อื่นๆ" ${_gp.company==='อื่นๆ'?'checked':''}> อื่นๆ
                <input type="text" id="lgGPOtherCo" value="${escapeHTML(_gp.otherCompany)}" placeholder="ระบุ..." style="border:none;border-bottom:1px solid #d1d5db;outline:none;font-size:12px;flex:1;background:transparent;">
              </label>
            </div>
          </div>
          <div class="lg-field">
            <label>จุดประสงค์ที่นำออก</label>
            <textarea id="lgGPPurpose" rows="3" style="resize:vertical;">${escapeHTML(_gp.purpose)}</textarea>
          </div>
        </div>
      </div>

      <div class="lg-grid cols2">
        <div class="lg-section">
          <h3>🚗 ข้อมูลยานพาหนะ</h3>
          <div class="lg-grid cols2">
            <div class="lg-field"><label>วันที่นำออก</label><input type="date" id="lgGPOutDate" value="${_gp.outDate}"></div>
            <div class="lg-field"><label>เวลา</label><input type="time" id="lgGPOutTime" value="${_gp.outTime}"></div>
            <div class="lg-field"><label>ประเภท</label><input type="text" id="lgGPVehType" value="${escapeHTML(_gp.vehType)}" placeholder="รถกระบะ..."></div>
            <div class="lg-field"><label>ยี่ห้อ</label><input type="text" id="lgGPVehBrand" value="${escapeHTML(_gp.vehBrand)}" placeholder="Isuzu..."></div>
            <div class="lg-field"><label>สี</label><input type="text" id="lgGPVehColor" value="${escapeHTML(_gp.vehColor)}" placeholder="ขาว..."></div>
            <div class="lg-field"><label>ทะเบียน</label><input type="text" id="lgGPVehPlate" value="${escapeHTML(_gp.vehPlate)}" placeholder="1กข 1234"></div>
            <div class="lg-field" style="grid-column:1/-1;"><label>อื่นๆ</label><input type="text" id="lgGPNotes" value="${escapeHTML(_gp.notes)}"></div>
          </div>
        </div>
        <div>
          <div class="lg-section" style="margin-bottom:14px;">
            <h3>📦 รายการสิ่งของ (สูงสุด 6 รายการ)</h3>
            <div style="display:flex;flex-direction:column;gap:6px;" id="lgGPItems">${itemsHTML}</div>
          </div>
          <div class="lg-section">
            <h3>📷 รูปประกอบ <span style="font-size:11px;color:#6b7280;font-weight:400;">${_gp.images.length}/6</span></h3>
            <div class="lg-img-grid" id="lgGPImgs">${gpImgsHTML}</div>
            <label class="btn btn-sm" style="cursor:pointer;">📁 เลือกรูป <input type="file" multiple accept="image/*" id="lgGPFileInput" style="display:none;"></label>
          </div>
        </div>
      </div>
    </div>`;

    _wireGP(profiles);
  }

  function _wireGP(profiles) {
    // tab bar
    const tabGPNew = document.getElementById('lgGPTabNew');
    const tabGPHist = document.getElementById('lgGPTabHistory');
    if (tabGPNew) tabGPNew.onclick = () => renderGatePass();
    if (tabGPHist) tabGPHist.onclick = () => { _hTab = 'gatepass'; renderHistory(); };

    const btn=document.getElementById('lgBtnPreviewGP');
    if(btn) btn.onclick=()=>_openPrintGP();

    // signature
    const signBtn=document.getElementById('lgSignGP');
    if(signBtn) signBtn.onclick=()=>{
      const pin=document.getElementById('lgGPPin').value;
      const sig=SIGNATURE_DB[pin];
      if(sig){ _gp.sigUrl=sig.url; _gp.sigName=sig.name; renderGatePass(); }
      else toast('รหัส PIN ไม่ถูกต้อง','error');
    };
    const lgGPPin=document.getElementById('lgGPPin');
    if(lgGPPin) lgGPPin.onkeydown=e=>{if(e.key==='Enter') document.getElementById('lgSignGP')?.click();};
    const clrSig=document.getElementById('lgClearSigGP');
    if(clrSig) clrSig.onclick=()=>{ _gp.sigUrl=null; _gp.sigName=''; renderGatePass(); };

    // requester autocomplete
    const reqInp=document.getElementById('lgGPReq');
    if(reqInp) reqInp.oninput=()=>{
      _gp.requesterName=reqInp.value;
      const p=profiles[reqInp.value];
      if(p){
        if(p.company){ _gp.company=p.company; document.querySelectorAll('input[name="lgGPCo"]').forEach(r=>{ r.checked=r.value===p.company; r.closest('.lg-radio-opt').classList.toggle('active',r.value===p.company); }); }
        if(p.dept){ _gp.dept=p.dept; const el=document.getElementById('lgGPDept'); if(el) el.value=p.dept; }
        if(p.pos){ _gp.position=p.pos; const el=document.getElementById('lgGPPos'); if(el) el.value=p.pos; }
        if(p.color){ _gp.vehColor=p.color; const el=document.getElementById('lgGPVehColor'); if(el) el.value=p.color; }
        if(p.veh){ const el=document.getElementById('lgGPVehType'); if(el) el.value=p.veh; _gp.vehType=p.veh; }
      }
    };

    // fields
    const bindGP=(id,key)=>{ const el=document.getElementById(id); if(el) el.oninput=()=>_gp[key]=el.value; };
    bindGP('lgGPPos','position'); bindGP('lgGPDept','dept'); bindGP('lgGPDate','date');
    bindGP('lgGPOutDate','outDate'); bindGP('lgGPOutTime','outTime');
    bindGP('lgGPVehType','vehType'); bindGP('lgGPVehBrand','vehBrand');
    bindGP('lgGPVehColor','vehColor'); bindGP('lgGPVehPlate','vehPlate');
    bindGP('lgGPNotes','notes'); bindGP('lgGPPurpose','purpose');
    const otherCo=document.getElementById('lgGPOtherCo');
    if(otherCo) otherCo.oninput=()=>{ _gp.otherCompany=otherCo.value; _gp.company='อื่นๆ'; };

    document.querySelectorAll('input[name="lgGPCo"]').forEach(r=>{
      r.onchange=()=>{
        _gp.company=r.value;
        document.querySelectorAll('.lg-radio-opt').forEach(o=>o.classList.remove('active'));
        r.closest('.lg-radio-opt').classList.add('active');
      };
    });

    // items
    document.querySelectorAll('.gp-item-inp').forEach(el=>{
      el.oninput=()=>{ _gp.items[+el.dataset.gpidx]=el.value; };
    });

    // images
    const fileIn=document.getElementById('lgGPFileInput');
    if(fileIn) fileIn.onchange=async e=>{
      const files=Array.from(e.target.files).slice(0,6-_gp.images.length);
      for(const f of files){ const url=await _readFile(f); _gp.images.push(url); }
      _refreshGPImgs(); e.target.value='';
    };
    document.querySelectorAll('.rm[data-type="gp"]').forEach(b=>{
      b.onclick=()=>{ _gp.images.splice(+b.dataset.idx,1); _refreshGPImgs(); };
    });
  }

  function _refreshGPImgs() {
    const c=document.getElementById('lgGPImgs'); if(!c) return;
    c.innerHTML=_gp.images.map((url,i)=>`
      <div class="lg-img-thumb">
        <img src="${url}" alt="img${i}" crossorigin="anonymous">
        <button onclick="window.__lgGPImages.splice(${i},1);window.__lgRefreshGPImgs()" style="position:absolute;top:2px;right:2px;background:rgba(220,38,38,.85);color:#fff;border:none;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:11px;">✕</button>
      </div>`).join('');
    window.__lgGPImages=_gp.images; window.__lgRefreshGPImgs=_refreshGPImgs;
  }

  /* ================================================================
     HISTORY — render
     ================================================================ */
  function renderHistory() {
    _css();
    const topbar=document.getElementById('topbar');
    const root=document.getElementById('viewRoot');
    topbar.innerHTML=`
      <div class="title">ประวัติเอกสาร</div>
      <div class="sub">ค้นหา ตรวจสอบ และดูเอกสารย้อนหลัง</div>
      <div class="toolbar">
        <div class="lg-tab-bar" style="margin-right:8px;">
          <button class="lg-tab${_hTab==='delivery'?' active':''}" id="lgHistBackDeliv">🆕 สร้างใหม่</button>
          <button class="lg-tab active" id="lgHistTabActive">📋 ประวัติ</button>
        </div>
        <input type="text" id="lgHSearch" placeholder="ค้นหา..." value="${escapeHTML(_hSearch)}" style="width:200px;padding:7px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:inherit;">
      </div>`;

    const data=_getHistData();
    const cols = _hTab==='delivery'
      ? [{f:'วันที่',l:'วันที่'},{f:'เลขที่ใบส่งของ',l:'เลขที่ DO'},{f:'บริษัท',l:'บริษัท'},{f:'ผู้จัดทำ/ผู้แจ้ง',l:'ผู้จัดทำ'},{f:'รายละเอียด/อ้างอิง',l:'รายละเอียด'},{f:'ไฟล์เอกสาร',l:'ไฟล์'}]
      : [{f:'วันที่',l:'วันที่'},{f:'เลขที่',l:'เลขที่ GP'},{f:'บริษัท',l:'บริษัท'},{f:'ผู้ขออนุญาต',l:'ผู้ขอ'},{f:'เหตุผล',l:'จุดประสงค์'},{f:'เอกสารอ้างอิง',l:'ไฟล์'}];
    const fileKey = _hTab==='delivery'?'ไฟล์เอกสาร':'เอกสารอ้างอิง';

    const rowsHTML=data.slice(0,200).map(row=>{
      const atts=_getAtts(row[fileKey]);
      const attLinks=atts.map((v,i)=>{
        const url=_cellToViewUrl(v)||v;
        return `<a href="${escapeHTML(url)}" target="_blank" rel="noreferrer" style="display:inline-block;padding:2px 8px;background:#dbeafe;color:#1d4ed8;border-radius:4px;font-size:11px;text-decoration:none;font-weight:600;margin:1px;">📄 ไฟล์ ${i+1}</a>`;
      }).join('');
      return `<tr>
        <td>${_fmtDateDisplay(row['วันที่'])}</td>
        <td style="font-weight:700;color:${_hTab==='delivery'?'#1d4ed8':'#0d9488'};font-family:monospace;">${escapeHTML(row[_hTab==='delivery'?'เลขที่ใบส่งของ':'เลขที่']||'-')}</td>
        <td>${escapeHTML(row['บริษัท']||'-')}</td>
        <td>${escapeHTML(row[_hTab==='delivery'?'ผู้จัดทำ/ผู้แจ้ง':'ผู้ขออนุญาต']||'-')}</td>
        <td style="max-width:250px;white-space:pre-wrap;word-break:break-word;font-size:12px;color:#374151;">${escapeHTML((row[_hTab==='delivery'?'รายละเอียด/อ้างอิง':'เหตุผล']||'').substring(0,120))}</td>
        <td>${attLinks||'-'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" style="text-align:center;padding:32px;color:#9ca3af;">ไม่พบข้อมูล</td></tr>';

    root.innerHTML=`<div class="lg-root">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
        <div class="lg-tab-bar">
          <button class="lg-tab${_hTab==='delivery'?' active':''}" id="lgTabDO">📋 ใบส่งของ (${state.data.delivery.length})</button>
          <button class="lg-tab${_hTab==='gatepass'?' active':''}" id="lgTabGP">🚚 ใบนำของออก (${state.data.gatepass.length})</button>
        </div>
        <div style="display:flex;gap:6px;margin-left:auto;flex-wrap:wrap;">
          <input type="date" id="lgHStart" value="${_hFilters.start}" style="padding:6px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;">
          <input type="date" id="lgHEnd" value="${_hFilters.end}" style="padding:6px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;">
          <select id="lgHCo" style="padding:6px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;">
            <option value="">ทุกบริษัท</option>
            <option value="SMEC" ${_hFilters.company==='SMEC'?'selected':''}>SMEC</option>
            <option value="BFL" ${_hFilters.company==='BFL'?'selected':''}>BFL</option>
            <option value="BFLFP" ${_hFilters.company==='BFLFP'?'selected':''}>BFLFP</option>
            <option value="BFLPC" ${_hFilters.company==='BFLPC'?'selected':''}>BFLPC</option>
          </select>
          <button class="btn btn-sm btn-ghost" id="lgHClear">ล้าง</button>
        </div>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:auto;">
        <table class="lg-history-table">
          <thead><tr>${cols.map(c=>`<th onclick="window.__lgHSort('${c.f}')" style="cursor:pointer;">${c.l} ${_hSort.field===c.f?(_hSort.dir==='asc'?'↑':'↓'):''}</th>`).join('')}</tr></thead>
          <tbody>${rowsHTML}</tbody>
        </table>
      </div>
      <div style="font-size:12px;color:#9ca3af;margin-top:8px;">แสดง ${Math.min(data.length,200)} จาก ${data.length} รายการ</div>
    </div>`;

    // topbar back button
    const histBack = document.getElementById('lgHistBackDeliv');
    if (histBack) histBack.onclick = () => { if (_hTab==='gatepass') renderGatePass(); else renderDelivery(); };

    document.getElementById('lgTabDO').onclick=()=>{ _hTab='delivery'; renderHistory(); };
    document.getElementById('lgTabGP').onclick=()=>{ _hTab='gatepass'; renderHistory(); };
    const hs=document.getElementById('lgHSearch');
    if(hs) hs.oninput=()=>{ _hSearch=hs.value; renderHistory(); };
    document.getElementById('lgHStart').onchange=e=>{ _hFilters.start=e.target.value; renderHistory(); };
    document.getElementById('lgHEnd').onchange=e=>{ _hFilters.end=e.target.value; renderHistory(); };
    document.getElementById('lgHCo').onchange=e=>{ _hFilters.company=e.target.value; renderHistory(); };
    document.getElementById('lgHClear').onclick=()=>{ _hFilters={start:'',end:'',company:''}; _hSearch=''; renderHistory(); };
    window.__lgHSort=(field)=>{ if(_hSort.field===field){ _hSort.dir=_hSort.dir==='asc'?'desc':'asc'; } else { _hSort.field=field; _hSort.dir='desc'; } renderHistory(); };
  }

  function _getHistData() {
    let data=_hTab==='delivery' ? [...state.data.delivery] : [...state.data.gatepass];
    if(_hSearch){
      const q=_hSearch.toLowerCase();
      data=data.filter(r=>Object.values(r).some(v=>v&&String(v).toLowerCase().includes(q)));
    }
    if(_hFilters.start){
      const s=new Date(_hFilters.start); s.setHours(0,0,0,0);
      data=data.filter(r=>{ const d=_parseDate(r['วันที่']); return d&&d>=s; });
    }
    if(_hFilters.end){
      const e=new Date(_hFilters.end); e.setHours(23,59,59,999);
      data=data.filter(r=>{ const d=_parseDate(r['วันที่']); return d&&d<=e; });
    }
    if(_hFilters.company){
      const q=_hFilters.company.toLowerCase();
      data=data.filter(r=>String(r['บริษัท']||'').toLowerCase().includes(q));
    }
    return [...data].sort((a,b)=>{
      let va,vb;
      if(_hSort.field==='วันที่'){ va=_sortDate(a['วันที่']); vb=_sortDate(b['วันที่']); }
      else { va=String(a[_hSort.field]||'').toLowerCase(); vb=String(b[_hSort.field]||'').toLowerCase(); }
      if(va<vb) return _hSort.dir==='asc'?-1:1;
      if(va>vb) return _hSort.dir==='asc'?1:-1;
      return 0;
    });
  }

  /* ================================================================
     PRINT — A4 Delivery Note
     ================================================================ */
  function _openPrintDO() {
    const sel=_doItems.filter(i=>i.selected);
    if(!sel.length){ toast('กรุณาเลือกรายการอย่างน้อย 1 รายการ','error'); return; }
    if(!_do.images.length){ toast('กรุณาแนบรูปถ่ายอย่างน้อย 1 รูป','error'); return; }
    if(!_do.sigUrl){ toast('กรุณาลงลายเซ็นก่อนพรีวิว','error'); return; }

    const overlay=document.createElement('div');
    overlay.className='lg-print-overlay'; overlay.id='lgDOPrintOverlay';
    overlay.innerHTML=`
      <div class="lg-print-wrap">
        <div class="lg-print-hd">
          <h3>📄 พรีวิว: ใบส่งของชั่วคราว</h3>
          <button class="btn btn-ghost" id="lgDOPrintClose" style="color:#fff;">✕</button>
        </div>
        <div class="lg-print-body" id="lgDOPrintBody">
          ${_doPrintPages()}
        </div>
        <div class="lg-print-ft no-print">
          <button class="btn btn-ghost" id="lgDOPrintBack">← กลับแก้ไข</button>
          <button class="btn btn-primary" id="lgDOPrintSave">💾 บันทึกและสร้าง PDF</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#lgDOPrintClose').onclick=()=>overlay.remove();
    overlay.querySelector('#lgDOPrintBack').onclick=()=>overlay.remove();
    overlay.querySelector('#lgDOPrintSave').onclick=()=>_saveDO(overlay);
  }

  function _doPrintPages() {
    return ['ต้นฉบับ','สำเนา'].map(copy=>_doPrintPage(copy)).join('<div style="height:20px;"></div>');
  }

  function _doPrintPage(copyType) {
    const sel=_doItems.filter(i=>i.selected);
    const rows=Array.from({length:10},(_,i)=>{
      const it=sel[i];
      let remark='';
      if(it){ remark=_do.refPo||''; if(_doRef){ const r=Math.max(0,(parseFloat(it.qty)||0)-(parseFloat(it.deliveredQty)||0)-(parseFloat(it.deliverQty)||0)); if(r>0) remark=remark?`${remark} (ค้างส่ง ${r} ${it.unit})`:`(ค้างส่ง ${r} ${it.unit})`; } }
      return `<tr style="height:26px;border-bottom:1px solid #5b9bd5;">
        <td style="border-right:1px solid #5b9bd5;text-align:center;font-size:13px;">${i+1}</td>
        <td style="border-right:1px solid #5b9bd5;padding:2px 8px;font-size:13px;font-weight:500;">${it?escapeHTML(it.name):''}</td>
        <td style="border-right:1px solid #5b9bd5;text-align:center;font-size:13px;font-style:italic;">${it?`${it.deliverQty} ${escapeHTML(it.unit)}`:''}</td>
        <td style="text-align:center;font-size:11px;color:#c55a11;font-weight:600;">${remark}</td>
      </tr>`;
    }).join('');

    const imgCount=_do.images.length;
    let imgGrid='';
    if(imgCount>0){
      const cols=imgCount===1?1:imgCount<=3?imgCount:imgCount<=6?3:3;
      const h=imgCount===1?'240px':imgCount<=2?'200px':'160px';
      const imgs=_do.images.slice(0,6);
      imgGrid=`<div style="margin-top:12px;display:grid;grid-template-columns:repeat(${cols},1fr);gap:12px;">
        ${imgs.map((url,i)=>`<div style="border:1px solid #5b9bd5;padding:6px;text-align:center;height:${h};display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <img src="${url}" style="max-width:100%;max-height:${parseInt(h)-30}px;object-fit:contain;" crossorigin="anonymous">
          <div style="font-size:11px;font-weight:700;color:#004b93;margin-top:4px;">รูปที่ ${i+1}</div>
        </div>`).join('')}
      </div>`;
    }

    const chk=(cond)=>cond?'✓':'';
    const custCo=_custName(_do);

    return `<div class="a4" style="padding:32px 40px 24px;min-height:1120px;box-sizing:border-box;">
      <!-- Header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;">
        <div style="width:80px;">
          <img src="${SMEC_LOGO}" alt="SMEC" style="height:42px;object-fit:contain;" crossorigin="anonymous">
        </div>
        <div style="text-align:center;flex:1;">
          <div style="color:#004b93;font-weight:700;font-size:14px;">บริษัท สยามแมค เอ็นจิเนียริ่ง แอนด์ คอนสตรัคชั่น จำกัด</div>
          <div style="color:#004b93;font-size:9px;font-weight:600;text-transform:uppercase;margin-bottom:8px;">SIAMMAC ENGINEERING &amp; CONSTRUCTION CO.,LTD</div>
          <div style="font-size:26px;font-weight:700;">ใบส่งของชั่วคราว</div>
        </div>
        <div style="width:80px;display:flex;justify-content:flex-end;padding-top:16px;">
          <span style="border:1.5px solid #c55a11;color:#c55a11;padding:4px 12px;border-radius:8px;font-weight:700;font-size:13px;">${copyType}</span>
        </div>
      </div>

      <!-- Company checkboxes -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;margin-bottom:10px;padding-left:8px;">
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
          <span style="width:16px;height:16px;border:1px solid #000;display:inline-flex;align-items:center;justify-content:center;font-weight:700;">${chk(_do.customerType==='BFL')}</span>
          บริษัท บลูฟาโล่ จำกัด
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
          <span style="width:16px;height:16px;border:1px solid #000;display:inline-flex;align-items:center;justify-content:center;font-weight:700;">${chk(_do.customerType==='BFLFP')}</span>
          บริษัท บลูฟาโล่ ฟู้ด โปรดักส์ จำกัด
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
          <span style="width:16px;height:16px;border:1px solid #000;display:inline-flex;align-items:center;justify-content:center;font-weight:700;">${chk(_do.customerType==='BFLPC')}</span>
          บริษัท บลูฟาโล่ เพ็ทแคร์ จำกัด
        </label>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;">
          <span style="width:16px;height:16px;border:1px solid #000;display:inline-flex;align-items:center;justify-content:center;font-weight:700;">${chk(_do.customerType==='OTHER')}</span>
          อื่นๆ ..${_do.customerType==='OTHER'?`<strong>${escapeHTML(_do.otherName)}</strong>`:'........................'}...
        </label>
      </div>

      <!-- Dept -->
      <div style="margin-bottom:10px;padding-left:8px;font-size:13px;position:relative;">
        แผนก ....................................................................
        <strong style="position:absolute;left:46px;">${escapeHTML(_do.dept)}</strong>
      </div>

      <!-- Items table -->
      <table style="width:100%;border-collapse:collapse;border:1px solid #5b9bd5;margin-bottom:14px;">
        <thead>
          <tr style="border-bottom:1px solid #5b9bd5;">
            <th style="border-right:1px solid #5b9bd5;padding:6px 4px;width:9%;text-align:center;font-size:13px;">ลำดับที่</th>
            <th style="border-right:1px solid #5b9bd5;padding:6px;width:49%;text-align:center;font-size:13px;">รายการ</th>
            <th style="border-right:1px solid #5b9bd5;padding:6px;width:16%;text-align:center;font-size:13px;">จำนวน</th>
            <th style="padding:6px;width:26%;text-align:center;font-size:13px;">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <!-- Signatures -->
      <div style="display:flex;justify-content:space-between;padding:0 40px;margin-bottom:14px;">
        <div style="width:220px;text-align:center;">
          <div style="display:flex;align-items:flex-end;gap:4px;height:50px;justify-content:center;position:relative;">
            ${_do.sigUrl?`<img src="${_imgUrl(_do.sigUrl)}" style="position:absolute;bottom:2px;height:52px;object-fit:contain;mix-blend-mode:multiply;" crossorigin="anonymous">`:''}
            <span style="font-size:18px;line-height:1;">X</span>
            <div style="border-bottom:1.5px solid #000;flex:1;"></div>
          </div>
          <div style="font-size:12px;margin-top:4px;"><strong>(${escapeHTML(_do.sigName||'............................................')})</strong><br>ผู้ส่งสินค้า / วันที่ ${_fmtDateThai(_do.date)}</div>
        </div>
        <div style="width:220px;text-align:center;">
          <div style="display:flex;align-items:flex-end;gap:4px;height:50px;justify-content:center;">
            <span style="font-size:18px;line-height:1;">X</span>
            <div style="border-bottom:1.5px solid #000;flex:1;"></div>
          </div>
          <div style="font-size:12px;margin-top:4px;"><strong>(............................................)</strong><br>ผู้รับสินค้า / วันที่ ........................</div>
        </div>
      </div>

      ${imgGrid}
    </div>`;
  }

  /* ================================================================
     PRINT — A4 Gate Pass
     ================================================================ */
  function _openPrintGP() {
    if(!_gp.sigUrl){ toast('กรุณาลงลายเซ็นก่อนพรีวิว','error'); return; }

    const overlay=document.createElement('div');
    overlay.className='lg-print-overlay'; overlay.id='lgGPPrintOverlay';
    overlay.innerHTML=`
      <div class="lg-print-wrap">
        <div class="lg-print-hd">
          <h3>🚚 พรีวิว: ใบขออนุญาตนำของออก</h3>
          <button class="btn btn-ghost" id="lgGPPrintClose" style="color:#fff;">✕</button>
        </div>
        <div class="lg-print-body">
          ${_gpPrintPage()}
        </div>
        <div class="lg-print-ft no-print">
          <button class="btn btn-ghost" id="lgGPPrintBack">← กลับแก้ไข</button>
          <button class="btn btn-primary" id="lgGPPrintSave">💾 บันทึกและสร้าง PDF</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#lgGPPrintClose').onclick=()=>overlay.remove();
    overlay.querySelector('#lgGPPrintBack').onclick=()=>overlay.remove();
    overlay.querySelector('#lgGPPrintSave').onclick=()=>_saveGP(overlay);
  }

  function _gpPrintPage() {
    const chkCircle=(cond)=>`<span style="width:18px;height:18px;border-radius:50%;border:2px solid #000;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">${cond?'✓':''}</span>`;
    const field=(label,value,flex='1')=>`
      <div style="display:flex;align-items:flex-end;gap:4px;flex:${flex};font-size:14px;">
        <span style="white-space:nowrap;padding-right:2px;">${label}</span>
        <div style="flex:1;border-bottom:1.5px dotted #000;min-height:18px;color:#1d4ed8;font-weight:700;padding:0 4px;text-align:center;font-size:14px;">${escapeHTML(value||'')}</div>
      </div>`;

    const companies=['BFL','BFLFP','BFLPC','SMEC'];
    const coHTML=companies.map(c=>`<div style="display:flex;align-items:center;gap:4px;">${chkCircle(_gp.company===c)}<span style="font-size:14px;">${c}</span></div>`).join('');
    const otherCo=_gp.company==='อื่นๆ'?_gp.otherCompany:'';

    const itemPairs=[[0,1],[2,3],[4,5]];
    const itemsGrid=itemPairs.map(([a,b])=>`
      <div style="display:contents;">
        <div style="display:flex;align-items:flex-end;gap:4px;font-size:14px;"><span>${a+1}.</span><div style="flex:1;border-bottom:1.5px dotted #000;min-height:18px;color:#1d4ed8;font-weight:700;padding:0 4px;">${escapeHTML(_gp.items[a]||'')}</div></div>
        <div style="display:flex;align-items:flex-end;gap:4px;font-size:14px;"><span>${b+1}.</span><div style="flex:1;border-bottom:1.5px dotted #000;min-height:18px;color:#1d4ed8;font-weight:700;padding:0 4px;">${escapeHTML(_gp.items[b]||'')}</div></div>
      </div>`).join('');

    const sigBlock=(label,name,showSig=false)=>`
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;min-width:150px;">
        <div style="display:flex;align-items:flex-end;width:100%;gap:4px;height:44px;position:relative;justify-content:center;">
          ${showSig&&_gp.sigUrl?`<img src="${_imgUrl(_gp.sigUrl)}" style="position:absolute;bottom:0;height:44px;object-fit:contain;mix-blend-mode:multiply;" crossorigin="anonymous">`:''}
          <span style="font-size:13px;">ลงชื่อ</span>
          <div style="flex:1;border-bottom:1.5px dotted #000;"></div>
          <span style="font-size:13px;">(${label})</span>
        </div>
        <div style="display:flex;align-items:flex-end;width:80%;gap:2px;font-size:13px;">
          <span>(</span><div style="flex:1;border-bottom:1.5px dotted #000;text-align:center;color:#1d4ed8;font-weight:700;font-size:12px;padding:0 2px;">${escapeHTML(name||'')}</div><span>)</span>
        </div>
      </div>`;

    const imgsHTML=_gp.images.length>0
      ? `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
          ${_gp.images.map((url,i)=>`<div style="border:1px dashed #9ca3af;padding:8px;text-align:center;height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <img src="${url}" style="max-width:100%;max-height:148px;object-fit:contain;" crossorigin="anonymous">
            <span style="font-size:11px;font-weight:700;color:#374151;margin-top:4px;">รูปภาพที่ ${i+1}</span>
          </div>`).join('')}
        </div>`
      : `<div style="border:2px dashed #d1d5db;border-radius:8px;height:200px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:14px;">พื้นที่สำหรับรูปภาพ / เอกสารเพิ่มเติม</div>`;

    return `<div class="a4" style="box-sizing:border-box;display:flex;flex-direction:column;min-height:1120px;font-family:'Sarabun','Tahoma',sans-serif;">
      <!-- Top section -->
      <div style="padding:24px 48px 12px;flex-shrink:0;">
        <!-- Title -->
        <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:10px;">
          <img src="${BFL_LOGO}" alt="Bluefalo" style="height:40px;object-fit:contain;" crossorigin="anonymous">
          <h2 style="font-size:18px;font-weight:700;margin:0;">แบบฟอร์มขออนุญาตนำของออกนอก เครือบลูฟาโล่</h2>
        </div>

        <!-- Company row -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;font-size:14px;">
          <strong>สำหรับเจ้าหน้าที่</strong>
          ${coHTML}
          <div style="display:flex;align-items:center;gap:4px;">${chkCircle(_gp.company==='อื่นๆ')}<span>อื่นๆ</span>
            <div style="border-bottom:1.5px dotted #000;min-width:80px;min-height:18px;color:#1d4ed8;font-weight:700;padding:0 4px;text-align:center;font-size:13px;">${escapeHTML(otherCo)}</div>
          </div>
        </div>

        <!-- Fields -->
        <div style="display:flex;flex-direction:column;gap:7px;font-size:14px;">
          <div style="display:flex;gap:12px;">
            ${field('ข้าพเจ้า (นาย/นาง/น.ส.)',_gp.requesterName,'1.5')}
            ${field('ตำแหน่ง',_gp.position,'1')}
          </div>
          <div style="display:flex;gap:12px;">
            ${field('ฝ่าย',_gp.dept,'1.5')}
            ${field('วันที่',_fmtDateThai(_gp.date),'1')}
          </div>
          <div style="display:flex;gap:4px;">
            ${field('มีความประสงค์นำสิ่งของออกนอกบริษัทเพื่อ',_gp.purpose,'1')}
          </div>
          <div style="border-bottom:1.5px dotted #000;min-height:16px;"></div>

          <div style="font-weight:700;margin-top:2px;">ดังรายการต่อไปนี้</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 32px;padding:0 8px;">
            ${itemsGrid}
          </div>

          <div style="display:flex;gap:12px;margin-top:4px;">
            ${field('ขอนำสิ่งของออกจากบริษัท ในวันที่',_fmtDateThai(_gp.outDate),'1.2')}
            ${field('เวลา',_gp.outTime,'0.6')}
          </div>
          <div style="display:flex;gap:12px;">
            ${field('โดยใช้ยานพาหนะประเภท',_gp.vehType,'1')}
            ${field('ยี่ห้อ',_gp.vehBrand,'0.8')}
            ${field('สี',_gp.vehColor,'0.6')}
          </div>
          <div style="display:flex;gap:12px;">
            ${field('หมายเลขทะเบียน',_gp.vehPlate,'0.8')}
            ${field('อื่นๆ',_gp.notes,'1')}
          </div>
        </div>

        <!-- Signatures -->
        <div style="display:flex;justify-content:space-between;margin-top:18px;padding:0 20px;gap:8px;flex-wrap:wrap;">
          <div style="display:flex;flex-direction:column;gap:14px;">
            ${sigBlock('ผู้ขออนุญาต',_gp.sigName||_gp.requesterName,true)}
            <div style="text-align:center;font-weight:700;font-size:14px;margin-top:8px;">ได้ตรวจสอบถูกต้องแล้ว</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:14px;">
            ${sigBlock('ผู้รับรอง',_gp.sigName||_gp.requesterName,true)}
            ${sigBlock('รปภ.','',false)}
            ${sigBlock('ผู้นำออก',_gp.requesterName,false)}
          </div>
        </div>

        <!-- Doc number -->
        <div style="font-size:13px;font-weight:700;font-family:monospace;margin-top:12px;">เลขที่: ${escapeHTML(_gp.gpNo)}</div>
      </div>

      <!-- Divider -->
      <div style="border-top:2px solid #000;margin:0 24px;flex-shrink:0;"></div>

      <!-- Images section -->
      <div style="padding:16px 48px;flex:1;">
        ${imgsHTML}
      </div>
    </div>`;
  }

  /* ================================================================
     SAVE — Delivery Note
     ================================================================ */
  async function _saveDO(overlay) {
    if(_saving){ toast('กำลังบันทึก กรุณารอ...','warning'); return; }
    _saving=true;
    const saveBtn=overlay.querySelector('#lgDOPrintSave');
    if(saveBtn){ saveBtn.disabled=true; saveBtn.textContent='⏳ กำลังสร้าง PDF...'; }
    try {
      toast('กำลังสร้าง PDF...','');
      const pdfBlob=await _genPdf('lgDOPrintBody');
      toast('กำลังอัปโหลด...','');
      const refStr=_doRef?_doRef['เลขที่']:'Standalone';
      const filename=`DO_${_do.doNo}_${refStr}.pdf`;
      const pdfFile=new File([pdfBlob],filename,{type:'application/pdf'});
      const cellVal=await App.uploadAttachment('delivery',pdfFile,_do.doNo);

      // Build items text
      const itemsList=_doItems.filter(i=>i.selected).map(i=>`- ${i.name} (${i.deliverQty} ${i.unit})`).join('\n')||'-';
      const custName=_custName(_do);
      const now=new Date(); const ts=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

      // Append to delivery sheet
      const row=[ts, _do.date, _do.doNo, _doRef?'ใบส่งของ (อ้างอิงใบงาน)':'ใบส่งของชั่วคราว', custName, _do.sigName||'-', _do.dept||'-', _doRef?`อ้างอิงใบงาน: ${_doRef['เลขที่']}`:'ออกใบส่งของชั่วคราว', _do.refPo||'-', itemsList, cellVal];
      await SheetsAPI.appendRows(CONFIG.SHEETS.delivery, [row]);

      // Update job record if reference
      if(_doRef){
        const idx=state.data.jobs.findIndex(j=>j['เลขที่']===_doRef['เลขที่']);
        if(idx>=0){
          const j=state.data.jobs[idx];
          const existDO=j['เลขที่ใบส่งของ']?`${j['เลขที่ใบส่งของ']}, ${_do.doNo}`:_do.doNo;
          const existAtt=j['เอกสารแนบใบส่งของชั่วคราว']?`${j['เอกสารแนบใบส่งของชั่วคราว']}, ${cellVal}`:cellVal;
          state.data.jobs[idx]={...j,'เลขที่ใบส่งของ':existDO,'เอกสารแนบใบส่งของชั่วคราว':existAtt};
          await App.saveAll();
        }
      }

      // Append to local state
      const keys=App.SHEETS.delivery.cols;
      const obj={}; keys.forEach((k,i)=>{ obj[k]=row[i]||null; });
      state.data.delivery.unshift(obj);

      toast('บันทึกเรียบร้อย!','success');
      overlay.remove();

      // Reset form
      _do=_initDO(); _doItems=_defaultItems(); _doRef=null;
      Views.render('delivery');

      // Open file
      const viewUrl=DriveAPI.parseCellValue(cellVal);
      if(viewUrl&&viewUrl.id){
        const ok=await confirmDialog('บันทึกสำเร็จ! ต้องการเปิดไฟล์ PDF เพื่อปริ้นหรือไม่?',{confirmText:'เปิดไฟล์'});
        if(ok) window.open(DriveAPI.viewURL(viewUrl.id),'_blank');
      }
    } catch(err){
      toast('บันทึกล้มเหลว: '+err.message,'error');
    } finally {
      _saving=false;
      if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent='💾 บันทึกและสร้าง PDF'; }
    }
  }

  /* ================================================================
     SAVE — Gate Pass
     ================================================================ */
  async function _saveGP(overlay) {
    if(_saving){ toast('กำลังบันทึก กรุณารอ...','warning'); return; }
    _saving=true;
    const saveBtn=overlay.querySelector('#lgGPPrintSave');
    if(saveBtn){ saveBtn.disabled=true; saveBtn.textContent='⏳ กำลังสร้าง PDF...'; }
    try {
      toast('กำลังสร้าง PDF...','');
      const pdfBlob=await _genPdf(overlay.querySelector('.a4'));
      toast('กำลังอัปโหลด...','');
      const filename=`GP_${_gp.gpNo}_${(_gp.requesterName||'Unknown').replace(/[^\w]/g,'_')}.pdf`;
      const pdfFile=new File([pdfBlob],filename,{type:'application/pdf'});
      const cellVal=await App.uploadAttachment('gatepass',pdfFile,_gp.gpNo);

      const itemsList=_gp.items.filter(i=>i.trim()).map((it,i)=>`${i+1}. ${it}`).join('\n')||'-';
      let vehText=[_gp.vehType,_gp.vehBrand].filter(Boolean).join(' ');
      if(_gp.vehPlate) vehText+=` ทะเบียน: ${_gp.vehPlate}`;
      const co=_gp.company==='อื่นๆ'?_gp.otherCompany:_gp.company;
      const now=new Date(); const ts=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

      const row=[ts, _gp.gpNo, _gp.date, co, _gp.requesterName||'-', _gp.position||'-', _gp.dept||'-', _gp.purpose||'-', itemsList, vehText.trim()||'-', _gp.vehColor||'-', cellVal, ''];
      await SheetsAPI.appendRows(CONFIG.SHEETS.gatepass,[row]);

      const keys=App.SHEETS.gatepass.cols;
      const obj={}; keys.forEach((k,i)=>{ obj[k]=row[i]||null; });
      state.data.gatepass.unshift(obj);

      toast('บันทึกเรียบร้อย!','success');
      overlay.remove();
      _gp=_initGP(); Views.render('gatepass');

      const viewUrl=DriveAPI.parseCellValue(cellVal);
      if(viewUrl&&viewUrl.id){
        const ok=await confirmDialog('บันทึกสำเร็จ! ต้องการเปิดไฟล์ PDF เพื่อปริ้นหรือไม่?',{confirmText:'เปิดไฟล์'});
        if(ok) window.open(DriveAPI.viewURL(viewUrl.id),'_blank');
      }
    } catch(err){
      toast('บันทึกล้มเหลว: '+err.message,'error');
    } finally {
      _saving=false;
      if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent='💾 บันทึกและสร้าง PDF'; }
    }
  }

  /* ---- PDF generation ---- */
  let _html2pdfLoaded=false;
  async function _loadHtml2pdf(){
    if(_html2pdfLoaded||window.html2pdf) { _html2pdfLoaded=true; return; }
    await new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload=res; s.onerror=rej; document.head.appendChild(s);
    });
    _html2pdfLoaded=true;
  }

  async function _genPdf(elOrId){
    await _loadHtml2pdf();
    const el=typeof elOrId==='string'?document.getElementById(elOrId):elOrId;
    if(!el) throw new Error('ไม่พบ element สำหรับสร้าง PDF');
    const opt={
      margin:0, image:{type:'jpeg',quality:0.95},
      html2canvas:{scale:2,useCORS:true,scrollY:0,scrollX:0},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
    };
    return window.html2pdf().set(opt).from(el).outputPdf('blob');
  }

  /* ================================================================
     PUBLIC API
     ================================================================ */
  return {
    renderDelivery,
    renderGatePass,
    renderHistory,
    initDelivery: ()=>{ _do=_initDO(); _doItems=_defaultItems(); _doRef=null; },
    initGatePass: ()=>{ _gp=_initGP(); },
    // Navigate to delivery page with job pre-selected
    deliveryFromJob(job) {
      _do = _initDO(); _do.doNo = _genDO(); _doRef = null; _doItems = _defaultItems();
      document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === 'delivery'));
      _selectJob(job); // _selectJob calls renderDelivery() internally
    }
  };
})();
