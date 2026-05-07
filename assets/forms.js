/* ==========================================================================
 * Forms — Add/Edit modals for each sheet
 * ========================================================================== */

const Forms = (() => {
  const { state, fmtDate, fmtDateTime, escapeHTML } = App;

  // Generic form builder: returns DOM container with given fields, and getter()
  function buildForm(fields, values) {
    const form = document.createElement('div');
    form.className = 'form-grid';
    const refs = {};

    for (const f of fields) {
      const wrap = document.createElement('div');
      wrap.className = 'field' + (f.full ? ' full' : '');
      const labelEl = document.createElement('label');
      labelEl.innerHTML = `${escapeHTML(f.label)}${f.required ? ' <span class="req">*</span>' : ''}`;
      wrap.appendChild(labelEl);

      let inputEl;
      const v = values ? values[f.key] : (f.default == null ? '' : f.default);

      if (f.type === 'select') {
        inputEl = document.createElement('select');
        inputEl.innerHTML = '<option value="">-- เลือก --</option>' +
          (f.options || []).map(o => `<option value="${escapeHTML(o)}">${escapeHTML(o)}</option>`).join('');
        if (v != null) inputEl.value = String(v);
      } else if (f.type === 'textarea') {
        inputEl = document.createElement('textarea');
        inputEl.rows = f.rows || 3;
        inputEl.value = v == null ? '' : String(v);
      } else if (f.type === 'date') {
        inputEl = document.createElement('input');
        inputEl.type = 'date';
        inputEl.value = fmtDate(v);
      } else if (f.type === 'datetime') {
        inputEl = document.createElement('input');
        inputEl.type = 'datetime-local';
        if (v) {
          const d = v instanceof Date ? v : new Date(v);
          if (!isNaN(d.getTime())) {
            const pad = n => String(n).padStart(2, '0');
            inputEl.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          }
        }
      } else if (f.type === 'number') {
        inputEl = document.createElement('input');
        inputEl.type = 'number';
        if (f.step) inputEl.step = f.step;
        if (v != null && v !== '') inputEl.value = String(v);
      } else if (f.type === 'file') {
        // File upload widget: shows existing path + file picker
        inputEl = buildFileField(f, v);
      } else {
        inputEl = document.createElement('input');
        inputEl.type = 'text';
        if (v != null) inputEl.value = String(v);
      }

      if (f.placeholder && inputEl.tagName !== 'DIV') inputEl.placeholder = f.placeholder;
      if (f.readonly) inputEl.readOnly = true;
      if (f.disabled) inputEl.disabled = true;

      wrap.appendChild(inputEl);
      form.appendChild(wrap);
      refs[f.key] = { field: f, el: inputEl };

      if (f.onChange) {
        const evt = (inputEl.tagName === 'SELECT' || inputEl.type === 'date' || inputEl.type === 'datetime-local') ? 'change' : 'input';
        inputEl.addEventListener(evt, () => f.onChange(refs, getValues));
      }
    }

    function getValues() {
      const out = {};
      for (const [k, ref] of Object.entries(refs)) {
        const f = ref.field;
        const el = ref.el;
        let val;
        if (f.type === 'file') {
          val = el._getValue ? el._getValue() : '';
        } else if (f.type === 'date') {
          val = el.value ? el.value : null;
        } else if (f.type === 'datetime') {
          val = el.value ? new Date(el.value).toISOString() : null;
        } else if (f.type === 'number') {
          val = el.value === '' ? null : Number(el.value);
        } else if (f.type === 'select') {
          val = el.value || null;
        } else if (f.type === 'textarea') {
          val = el.value || '';
        } else {
          val = el.value || '';
        }
        out[k] = val;
      }
      return out;
    }

    async function commitFiles(prefix) {
      // Upload pending files (from file fields) and update path
      const out = {};
      for (const [k, ref] of Object.entries(refs)) {
        if (ref.field.type === 'file' && ref.el._commit) {
          out[k] = await ref.el._commit(prefix);
        }
      }
      return out;
    }

    return { el: form, getValues, commitFiles, refs };
  }

  function buildFileField(field, currentValue) {
    const container = document.createElement('div');
    container.className = 'file-field';
    let pendingFile = null;
    let currentPath = currentValue || '';

    const display = document.createElement('div');
    display.className = 'file-list';
    container.appendChild(display);

    const upArea = document.createElement('label');
    upArea.className = 'upload-area';
    upArea.innerHTML = `📎 คลิกเพื่อเลือกไฟล์${field.accept ? ` (${field.accept})` : ''}`;
    const inp = document.createElement('input');
    inp.type = 'file';
    if (field.accept) inp.accept = field.accept;
    inp.style.display = 'none';
    upArea.appendChild(inp);
    container.appendChild(upArea);

    inp.onchange = () => {
      const f = inp.files[0];
      if (!f) return;
      pendingFile = f;
      renderDisplay();
    };

    function renderDisplay() {
      display.innerHTML = '';
      if (currentPath) {
        const item = document.createElement('div');
        item.className = 'file-item';
        let name;
        if (currentPath.startsWith('drive:')) {
          const m = currentPath.substring(6).split('|');
          name = m[1] || m[0];
        } else {
          name = currentPath.split('/').pop();
        }
        if (/^https?:/i.test(currentPath)) {
          item.innerHTML = `<span>🔗</span><span class="name"><a href="${escapeHTML(currentPath)}" target="_blank">${escapeHTML(currentPath)}</a></span>
            <span class="remove" data-act="remove">ลบ</span>`;
        } else {
          item.innerHTML = `<span>📎</span><span class="name"><a href="#" data-attach="${escapeHTML(currentPath)}">${escapeHTML(name)}</a></span>
            <span class="remove" data-act="remove">ลบ</span>`;
        }
        item.querySelector('[data-act="remove"]').onclick = () => {
          currentPath = '';
          pendingFile = null;
          renderDisplay();
        };
        display.appendChild(item);
      }
      if (pendingFile) {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.style.background = '#fef3c7';
        item.innerHTML = `<span>⏳</span><span class="name">${escapeHTML(pendingFile.name)} (${Math.round(pendingFile.size/1024)} KB) — จะอัปโหลดเมื่อบันทึก</span>
          <span class="remove" data-act="cancel">ยกเลิก</span>`;
        item.querySelector('[data-act="cancel"]').onclick = () => { pendingFile = null; renderDisplay(); };
        display.appendChild(item);
      }
    }
    renderDisplay();

    container._getValue = () => currentPath;
    container._commit = async (prefix) => {
      if (pendingFile && state.folderHandle) {
        const relPath = await App.uploadAttachment(field.dir || 'misc', pendingFile, prefix);
        currentPath = relPath;
        pendingFile = null;
        renderDisplay();
      }
      return currentPath;
    };
    return container;
  }

  // -------------------- JOB FORM --------------------
  function openJob(idx) {
    const editing = idx != null;
    const row = editing ? { ...state.data.jobs[idx] } : {};
    if (!editing) {
      row['วันที่'] = new Date();
      row['เลขที่'] = App.nextDocNo('SM', 'jobs') + '-PC';
      row['สถานะ'] = 'รอดำเนินการ';
    }

    const fields = [
      { key: 'วันที่', label: 'วันที่', type: 'date', required: true },
      { key: 'เลขที่', label: 'เลขที่ใบงาน', required: true, placeholder: 'เช่น SM-2605001-PC' },
      { key: 'เลขที่โครงการ', label: 'เลขที่โครงการ' },
      { key: 'ชื่อโครงการ', label: 'ชื่อโครงการ' },
      { key: 'PO', label: 'PO' },
      { key: 'บริษัท', label: 'บริษัท', type: 'select', options: uniqueWith('jobs', 'บริษัท', ['BFLPC','BFL','SMEC']) },
      { key: 'ผู้แจ้ง', label: 'ผู้แจ้ง/แผนก' },
      { key: 'ประเภท', label: 'ประเภท', type: 'select', options: uniqueWith('jobs', 'ประเภท', ['งาน DIE','สร้าง','ซ่อม','ผลิต','ออกแบบ','อื่นๆ']) },
      { key: 'รายละเอียด', label: 'รายละเอียด', type: 'textarea', full: true, rows: 4 },
      { key: 'รายการย่อย', label: 'รายการย่อย', type: 'textarea', full: true, rows: 3 },
      { key: 'สถานะ', label: 'สถานะ', type: 'select', options: ['รอดำเนินการ','กำลังดำเนินการ','เสร็จแล้ว','ส่งงานแล้ว','ยกเลิก','รออะไหล่'] },
      { key: 'วันที่สถานะ', label: 'วันที่อัปเดตสถานะ', type: 'date' },
      { key: 'ผู้รับผิดชอบ', label: 'ผู้รับผิดชอบ', type: 'select', options: uniqueWith('jobs', 'ผู้รับผิดชอบ', []) },
      { key: 'จำนวน', label: 'จำนวน', type: 'number' },
      { key: 'จำนวนที่ส่ง', label: 'จำนวนที่ส่ง', type: 'number' },
      { key: 'จำนวนค้างส่ง', label: 'จำนวนค้างส่ง', type: 'number' },
      { key: 'เลขที่ใบส่งของ', label: 'เลขที่ใบส่งของ' },
      { key: 'เอกสาร', label: 'เอกสารแนบ', type: 'file', dir: 'jobs' },
      { key: 'เอกสารแนบใบส่งของชั่วคราว', label: 'แนบใบส่งของชั่วคราว', type: 'file', dir: 'delivery' },
      { key: 'รูปปิดงาน', label: 'รูปปิดงาน', type: 'file', dir: 'jobs', accept: 'image/*' },
      { key: 'วันที่เริ่ม', label: 'วันที่เริ่ม', type: 'date' },
      { key: 'วันที่เสร็จ', label: 'วันที่เสร็จ', type: 'date' },
      { key: 'ระยะเวลา', label: 'ระยะเวลา (วัน)', type: 'number' },
      { key: 'รายละเอียดการดำเนินการ', label: 'รายละเอียดการดำเนินการ', type: 'textarea', full: true, rows: 3 },
      { key: 'ผู้ดำเนินการ', label: 'ผู้ดำเนินการ' },
      { key: 'ผู้บันทึก', label: 'ผู้บันทึก' },
      { key: 'วันที่ลงบันทึก', label: 'วันที่ลงบันทึก', type: 'date' },
      { key: 'หมายเหตุ', label: 'หมายเหตุ', type: 'textarea', full: true, rows: 2 },
      { key: 'ส่งงาน', label: 'วันที่ส่งงาน', type: 'date' },
      { key: 'docNo', label: 'DocNo (ระบบ)' },
      { key: 'Schedule', label: 'Schedule ID' },
      { key: 'แผนงาน', label: 'แผนงาน' },
    ];

    const formObj = buildForm(fields, row);

    const footer = document.createElement('div');
    footer.style.display = 'flex'; footer.style.gap = '8px'; footer.style.width = '100%';
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-ghost'; btnCancel.textContent = 'ยกเลิก';
    btnCancel.onclick = () => App.closeModal();

    // Print Work Request button (visible when editing or after first save)
    const btnPrint = document.createElement('button');
    btnPrint.className = 'btn btn-primary';
    btnPrint.innerHTML = '🖨 พิมพ์ใบแจ้งงาน';
    btnPrint.style.marginRight = 'auto';
    btnPrint.title = 'บันทึกข้อมูลแล้วเปิดหน้าพิมพ์ใบแจ้งงาน';
    btnPrint.onclick = async () => {
      // Save first, then open print
      btnPrint.disabled = true;
      try {
        const vals = formObj.getValues();
        if (!vals['เลขที่']) { App.toast('กรุณากรอกเลขที่ใบงานก่อน', 'error'); btnPrint.disabled = false; return; }
        const fileVals = await formObj.commitFiles(vals['เลขที่']);
        Object.assign(vals, fileVals);
        if (vals['จำนวน'] != null && vals['จำนวนที่ส่ง'] != null) {
          vals['จำนวนค้างส่ง'] = (vals['จำนวน'] || 0) - (vals['จำนวนที่ส่ง'] || 0);
        }
        if (!vals['ผู้บันทึก']) vals['ผู้บันทึก'] = 'ระบบ';
        if (!vals['วันที่ลงบันทึก']) vals['วันที่ลงบันทึก'] = new Date().toISOString().slice(0,10);
        let targetIdx = idx;
        if (editing) state.data.jobs[idx] = { ...state.data.jobs[idx], ...vals };
        else { state.data.jobs.unshift(vals); targetIdx = 0; }
        const ok = await App.saveAll();
        if (ok) {
          App.toast('บันทึกแล้ว — กำลังเปิดหน้าพิมพ์', 'success');
          Print.printWorkRequest(targetIdx);
          App.closeModal();
          Views.render(state.currentView);
        }
      } catch (e) {
        console.error(e);
        App.toast('ผิดพลาด: ' + e.message, 'error');
      } finally {
        btnPrint.disabled = false;
      }
    };

    const btnOk = document.createElement('button');
    btnOk.className = 'btn btn-primary'; btnOk.textContent = editing ? 'อัปเดต' : 'บันทึก';
    btnOk.onclick = async () => {
      const vals = formObj.getValues();
      if (!vals['เลขที่']) { App.toast('กรุณากรอกเลขที่ใบงาน', 'error'); return; }
      btnOk.disabled = true; btnOk.textContent = 'กำลังบันทึก...';
      try {
        const fileVals = await formObj.commitFiles(vals['เลขที่']);
        Object.assign(vals, fileVals);
        // auto จำนวนค้างส่ง = จำนวน − จำนวนที่ส่ง
        if (vals['จำนวน'] != null && vals['จำนวนที่ส่ง'] != null) {
          vals['จำนวนค้างส่ง'] = (vals['จำนวน'] || 0) - (vals['จำนวนที่ส่ง'] || 0);
        }
        if (!vals['ผู้บันทึก']) vals['ผู้บันทึก'] = 'ระบบ';
        if (!vals['วันที่ลงบันทึก']) vals['วันที่ลงบันทึก'] = new Date().toISOString().slice(0,10);

        if (editing) state.data.jobs[idx] = { ...state.data.jobs[idx], ...vals };
        else state.data.jobs.unshift(vals);
        const ok = await App.saveAll();
        if (ok) {
          App.toast(editing ? 'อัปเดตเรียบร้อย' : 'บันทึกเรียบร้อย', 'success');
          App.closeModal();
          Views.render('jobs');
        } else {
          btnOk.disabled = false; btnOk.textContent = editing ? 'อัปเดต' : 'บันทึก';
        }
      } catch (e) {
        console.error(e);
        App.toast('บันทึกล้มเหลว: ' + e.message, 'error');
        btnOk.disabled = false; btnOk.textContent = editing ? 'อัปเดต' : 'บันทึก';
      }
    };
    footer.appendChild(btnPrint);
    footer.appendChild(btnCancel);
    footer.appendChild(btnOk);

    App.openModal({
      title: editing ? `แก้ไขใบงาน: ${row['เลขที่'] || ''}` : 'เพิ่มใบงานใหม่',
      body: formObj.el,
      footer,
      large: true
    });
  }

  // -------------------- DELIVERY FORM --------------------
  function openDelivery(idx) {
    const editing = idx != null;
    const row = editing ? { ...state.data.delivery[idx] } : {};
    if (!editing) {
      row['Timestamp'] = new Date();
      row['วันที่'] = new Date();
      row['เลขที่ใบส่งของ'] = App.nextDocNo('DO', 'delivery', 'เลขที่ใบส่งของ');
      row['ประเภท'] = 'ใบส่งของชั่วคราว (อิสระ)';
    }

    const fields = [
      { key: 'วันที่', label: 'วันที่', type: 'date', required: true },
      { key: 'เลขที่ใบส่งของ', label: 'เลขที่ใบส่งของ', required: true },
      { key: 'ประเภท', label: 'ประเภท', type: 'select', options: ['ใบส่งของชั่วคราว (อิสระ)','ใบส่งของ (อ้างอิงงานระบบ)','ใบส่งคืน','ใบโอน'] },
      { key: 'บริษัท', label: 'บริษัท', type: 'select', options: uniqueWith('delivery','บริษัท',['BFLPC','BFL','SMEC']) },
      { key: 'ผู้จัดทำ/ผู้แจ้ง', label: 'ผู้จัดทำ/ผู้แจ้ง' },
      { key: 'แผนก', label: 'แผนก', type: 'select', options: uniqueWith('delivery','แผนก',['วิศวกรรม','ผลิต','ซ่อมบำรุง','คลังสินค้า','อื่นๆ']) },
      { key: 'PO', label: 'PO', placeholder: 'PO/2026/...' },
      { key: 'รายละเอียด/อ้างอิง', label: 'รายละเอียด/อ้างอิงเลขที่ใบงาน', type: 'textarea', full: true, rows: 2,
        placeholder: 'เช่น อ้างอิงใบงานระบบเลขที่: SM-2601076-PC' },
      { key: 'รายการสินค้า', label: 'รายการสินค้า', type: 'textarea', full: true, rows: 4,
        placeholder: '- ชื่อสินค้า (จำนวน รายการ)\n- ...' },
      { key: 'ไฟล์เอกสาร', label: 'ไฟล์เอกสาร (รูป/PDF)', type: 'file', dir: 'delivery', full: true }
    ];

    const formObj = buildForm(fields, row);
    const footer = makeFooter(async () => {
      const vals = formObj.getValues();
      if (!vals['เลขที่ใบส่งของ']) { App.toast('กรุณากรอกเลขที่ใบส่งของ', 'error'); return false; }
      const fileVals = await formObj.commitFiles(vals['เลขที่ใบส่งของ']);
      Object.assign(vals, fileVals);
      vals['Timestamp'] = editing && row['Timestamp'] ? row['Timestamp'] : new Date();
      if (editing) state.data.delivery[idx] = { ...state.data.delivery[idx], ...vals };
      else state.data.delivery.unshift(vals);
      const ok = await App.saveAll();
      if (ok) { App.toast('บันทึกแล้ว', 'success'); App.closeModal(); Views.render('delivery'); }
      return ok;
    }, editing);

    App.openModal({
      title: editing ? `แก้ไข: ${row['เลขที่ใบส่งของ']}` : 'เพิ่มใบส่งของใหม่',
      body: formObj.el, footer, large: true
    });
  }

  // -------------------- GATEPASS FORM --------------------
  function openGatepass(idx) {
    const editing = idx != null;
    const row = editing ? { ...state.data.gatepass[idx] } : {};
    if (!editing) {
      row['Timestamp'] = new Date();
      row['วันที่'] = new Date();
      row['เลขที่'] = App.nextDocNo('GP', 'gatepass');
    }

    const fields = [
      { key: 'วันที่', label: 'วันที่', type: 'date', required: true },
      { key: 'เลขที่', label: 'เลขที่', required: true },
      { key: 'บริษัท', label: 'บริษัท', type: 'select', options: uniqueWith('gatepass','บริษัท',['BFLPC','BFL','SMEC']) },
      { key: 'ผู้ขออนุญาต', label: 'ผู้ขออนุญาต', required: true },
      { key: 'ตำแหน่ง', label: 'ตำแหน่ง' },
      { key: 'แผนก', label: 'แผนก', type: 'select', options: uniqueWith('gatepass','แผนก',['ผลิต','วิศวกรรม','ซ่อมบำรุง','คลังสินค้า','อื่นๆ']) },
      { key: 'เหตุผล', label: 'เหตุผลการนำของออก', placeholder: 'เช่น นำส่ง BFLPC' },
      { key: 'รายการ', label: 'รายการของที่นำออก', type: 'textarea', full: true, rows: 4 },
      { key: 'ยานพาหนะ', label: 'ยานพาหนะ', placeholder: 'เช่น กระบะ อีซุซุ ทะเบียน:' },
      { key: 'สี', label: 'สี' },
      { key: 'แผนงาน', label: 'แผนงาน/อ้างอิง' },
      { key: 'เอกสารอ้างอิง', label: 'เอกสารแนบ (รูป/PDF)', type: 'file', dir: 'gatepass', full: true }
    ];

    const formObj = buildForm(fields, row);
    const footer = makeFooter(async () => {
      const vals = formObj.getValues();
      if (!vals['เลขที่']) { App.toast('กรุณากรอกเลขที่ GatePass', 'error'); return false; }
      const fileVals = await formObj.commitFiles(vals['เลขที่']);
      Object.assign(vals, fileVals);
      vals['Timestamp'] = editing && row['Timestamp'] ? row['Timestamp'] : new Date();
      if (editing) state.data.gatepass[idx] = { ...state.data.gatepass[idx], ...vals };
      else state.data.gatepass.unshift(vals);
      const ok = await App.saveAll();
      if (ok) { App.toast('บันทึกแล้ว', 'success'); App.closeModal(); Views.render('gatepass'); }
      return ok;
    }, editing);

    App.openModal({
      title: editing ? `แก้ไข GatePass: ${row['เลขที่']}` : 'เพิ่ม GatePass ใหม่',
      body: formObj.el, footer, large: true
    });
  }

  // -------------------- SCHEDULE FORM --------------------
  function openSchedule(idx) {
    const editing = idx != null;
    const row = editing ? { ...state.data.schedule[idx] } : {};
    if (!editing) {
      row['Task_ID'] = App.nextTaskId();
      row['Status'] = 'รอดำเนินการ';
      row['LastUpdated'] = new Date();
    }

    // DocNo options from jobs
    const docOpts = [...new Set(state.data.jobs.map(j => j['เลขที่']).filter(Boolean))].sort();

    const fields = [
      { key: 'Task_ID', label: 'Task ID', readonly: true },
      { key: 'DocNo', label: 'DocNo (เลขที่ใบงาน)', type: 'select', options: docOpts },
      { key: 'TaskName', label: 'ชื่องาน', required: true, full: true },
      { key: 'Assignee', label: 'ผู้รับผิดชอบ', type: 'select', options: uniqueWith('schedule','Assignee',[]) },
      { key: 'Status', label: 'สถานะ', type: 'select', options: ['รอดำเนินการ','กำลังดำเนินการ','เสร็จแล้ว','ยกเลิก','ติดปัญหา'] },
      { key: 'StartDate', label: 'วันที่เริ่ม (แผน)', type: 'date' },
      { key: 'EndDate', label: 'วันที่เสร็จ (แผน)', type: 'date' },
      { key: 'ActualStartDate', label: 'วันที่เริ่มจริง', type: 'date' },
      { key: 'ActualEndDate', label: 'วันที่เสร็จจริง', type: 'date' },
    ];

    const formObj = buildForm(fields, row);
    const footer = makeFooter(async () => {
      const vals = formObj.getValues();
      if (!vals['TaskName']) { App.toast('กรุณากรอกชื่องาน', 'error'); return false; }
      vals['LastUpdated'] = new Date();
      vals['Task_ID'] = row['Task_ID'] || App.nextTaskId();
      if (editing) state.data.schedule[idx] = { ...state.data.schedule[idx], ...vals };
      else state.data.schedule.push(vals);
      const ok = await App.saveAll();
      if (ok) { App.toast('บันทึกแล้ว', 'success'); App.closeModal(); Views.render('schedule'); }
      return ok;
    }, editing);

    App.openModal({
      title: editing ? `แก้ไขงาน: ${row['TaskName']||row['Task_ID']}` : 'เพิ่มงานใหม่',
      body: formObj.el, footer, large: true
    });
  }

  // -------------------- COSTS FORM --------------------
  function openCost(idx) {
    const editing = idx != null;
    const row = editing ? { ...state.data.costs[idx] } : {};
    if (!editing) {
      row['Code'] = App.nextCostCode();
      row['วันที่'] = new Date();
      row['VAT'] = 7;
      row['วันที่ บันทึก'] = new Date();
    }

    const jobOpts = [...new Set(state.data.jobs.map(j => j['เลขที่']).filter(Boolean))].sort();
    const projOpts = [...new Set(state.data.jobs.map(j => j['เลขที่โครงการ']).filter(Boolean))].sort();
    const supOpts = uniqueWith('costs','ผู้ขาย / Sup',[]);

    const recompute = (refs) => {
      const qty = Number(refs['จำนวน']?.el.value) || 0;
      const unit = Number(refs['ราคา / หน่วย']?.el.value) || 0;
      const sub = qty * unit;
      const vatPct = Number(refs['VAT']?.el.value);
      const useVat = !isNaN(vatPct) ? vatPct : 7;
      const vatAmt = sub * (useVat / 100);
      const grand = sub + vatAmt;
      if (refs['จำนวนเงินรวม']) refs['จำนวนเงินรวม'].el.value = sub.toFixed(2);
      if (refs['จำนวนเงินรวม Vat']) refs['จำนวนเงินรวม Vat'].el.value = grand.toFixed(2);
    };

    const fields = [
      { key: 'Code', label: 'Code', readonly: true },
      { key: 'วันที่', label: 'วันที่', type: 'date', required: true },
      { key: 'เลขที่งาน', label: 'เลขที่งาน', type: 'select', options: jobOpts },
      { key: 'เลขที่โครงการ', label: 'เลขที่โครงการ', type: 'select', options: projOpts },
      { key: 'ประเภท', label: 'ประเภท', type: 'select', options: uniqueWith('costs','ประเภท',['วัสดุอุปกรณ์','ค่าแรง','ค่าขนส่ง','ค่าบริการ','อื่นๆ']) },
      { key: 'ผู้ขาย / Sup', label: 'ผู้ขาย/Sup', type: 'select', options: supOpts },
      { key: 'รายละเอียด', label: 'รายละเอียด', type: 'textarea', full: true, rows: 2 },
      { key: 'จำนวน', label: 'จำนวน', type: 'number', step: '0.01',
        onChange: (refs) => recompute(refs) },
      { key: 'ราคา / หน่วย', label: 'ราคา/หน่วย', type: 'number', step: '0.01',
        onChange: (refs) => recompute(refs) },
      { key: 'จำนวนเงินรวม', label: 'จำนวนเงินรวม', type: 'number', readonly: true },
      { key: 'VAT', label: 'VAT (%)', type: 'number', step: '0.01',
        onChange: (refs) => recompute(refs) },
      { key: 'จำนวนเงินรวม Vat', label: 'จำนวนเงินรวม VAT', type: 'number', readonly: true },
      { key: 'ผู้บันทึก', label: 'ผู้บันทึก' },
      { key: 'หมายเหตุ', label: 'หมายเหตุ', type: 'textarea', full: true, rows: 2 }
    ];

    const formObj = buildForm(fields, row);
    // initial recompute
    setTimeout(() => recompute(formObj.refs), 50);

    const footer = makeFooter(async () => {
      const vals = formObj.getValues();
      if (!vals['วันที่']) { App.toast('กรุณากรอกวันที่', 'error'); return false; }
      vals['Code'] = row['Code'] || App.nextCostCode();
      vals['วันที่ บันทึก'] = new Date();
      // compute final
      const qty = Number(vals['จำนวน'])||0, unit = Number(vals['ราคา / หน่วย'])||0;
      const sub = qty*unit;
      const vat = Number(vals['VAT']);
      const useVat = !isNaN(vat) ? vat : 7;
      vals['จำนวนเงินรวม'] = sub;
      vals['จำนวนเงินรวม Vat'] = sub * (1 + useVat/100);
      if (editing) state.data.costs[idx] = { ...state.data.costs[idx], ...vals };
      else state.data.costs.unshift(vals);
      const ok = await App.saveAll();
      if (ok) { App.toast('บันทึกแล้ว', 'success'); App.closeModal(); Views.render('costs'); }
      return ok;
    }, editing);

    App.openModal({
      title: editing ? `แก้ไข: ${row['Code']}` : 'เพิ่มรายการค่าใช้จ่าย',
      body: formObj.el, footer, large: true
    });
  }

  // -------------------- helpers --------------------
  function makeFooter(onSubmit, editing) {
    const footer = document.createElement('div');
    footer.style.display = 'flex'; footer.style.gap = '8px';
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-ghost'; btnCancel.textContent = 'ยกเลิก';
    btnCancel.onclick = () => App.closeModal();
    const btnOk = document.createElement('button');
    btnOk.className = 'btn btn-primary'; btnOk.textContent = editing ? 'อัปเดต' : 'บันทึก';
    btnOk.onclick = async () => {
      btnOk.disabled = true; btnOk.textContent = 'กำลังบันทึก...';
      try {
        await onSubmit();
      } catch (e) {
        console.error(e);
        App.toast('บันทึกล้มเหลว: ' + e.message, 'error');
      } finally {
        btnOk.disabled = false;
        btnOk.textContent = editing ? 'อัปเดต' : 'บันทึก';
      }
    };
    footer.appendChild(btnCancel);
    footer.appendChild(btnOk);
    return footer;
  }

  function uniqueWith(view, key, defaults) {
    const set = new Set(defaults || []);
    for (const r of state.data[view] || []) {
      const v = r[key];
      if (v != null && v !== '') set.add(String(v).trim());
    }
    return [...set].sort((a,b) => a.localeCompare(b, 'th'));
  }

  return { openJob, openDelivery, openGatepass, openSchedule, openCost };
})();
