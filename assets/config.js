/* ==========================================================================
 * CONFIG — แก้ไขค่าทั้ง 3 ตัวด้านล่างให้ตรงกับโปรเจกต์ของคุณ
 *
 *   1. CLIENT_ID            → จาก Google Cloud Console (OAuth 2.0 Client ID)
 *   2. SPREADSHEET_ID       → จาก URL ของ Google Spreadsheet
 *   3. ATTACHMENTS_FOLDER_ID→ จาก URL ของ Google Drive Folder ที่จะเก็บไฟล์แนบ
 *
 *   อ่านวิธีการตั้งค่าทีละขั้นได้ที่ setup-guide.html
 * ========================================================================== */

const CONFIG = {
  // OAuth 2.0 Web client ID
  // ตัวอย่าง: '1234567890-abcdefghijklmnop.apps.googleusercontent.com'
  CLIENT_ID: '723261097312-8ttghjm217u8fn2cr2jl5vfvlgvl7m2h.apps.googleusercontent.com',

  // ID ของ Spreadsheet (ดึงมาจาก URL ระหว่าง /d/ กับ /edit)
  SPREADSHEET_ID: '1EbqGINspJxefogfT54niWPbqtWlcYc1CGIPc5398_bc',

  // ID ของ Drive Folder ที่จะเก็บเอกสารแนบทั้งหมด
  ATTACHMENTS_FOLDER_ID: '1DUEQWW0JWnytM6OhyD4KypkozDK6QPbC',

  // (ไม่บังคับ) ID ของไฟล์ logo.jpg ที่อยู่ใน Drive — ใช้ในใบแจ้งงาน
  // ถ้าไม่ตั้ง ระบบจะใช้ text badge แทน
  LOGO_FILE_ID: '15zzzhxCYvs68uEWnZ6tSg14TsxdhQlz0',

  // ----- ค่าที่ปกติไม่ต้องแก้ -----
  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ].join(' '),

  // ชื่อแต่ละชีตใน Spreadsheet (ต้องตรงกับชีตจริง)
  SHEETS: {
    jobs: 'ชีต1',
    delivery: 'ใบส่งของชั่วคราว',
    gatepass: 'GatePass',
    schedule: 'Schedule_DB',
    costs: 'Costs'
  },

  // ชื่อ Sub-folder ที่จะสร้างใน Drive ATTACHMENTS_FOLDER สำหรับเก็บไฟล์
  ATTACH_DIRS: {
    jobs: 'jobs',
    delivery: 'delivery',
    gatepass: 'gatepass',
    schedule: 'schedule',
    costs: 'costs'
  }
};
