/* ==========================================================================
 * Drive API wrapper — อัปโหลดไฟล์ + จัดการโฟลเดอร์ใน Google Drive
 *
 * รูปแบบเก็บค่าในเซลล์ (ไฟล์เอกสารแนบ):
 *   "drive:FILE_ID|ชื่อไฟล์.pdf"
 * ระบบจะแปลงเป็นลิงก์ Drive อัตโนมัติเมื่อแสดง
 * ========================================================================== */

const DriveAPI = (() => {
  const folderCache = {}; // { 'parentId/childName': folderId }

  // หา หรือ สร้าง subfolder ใต้ parent
  async function ensureFolder(name, parentFolderId) {
    const cacheKey = `${parentFolderId}/${name}`;
    if (folderCache[cacheKey]) return folderCache[cacheKey];
    await GAuth.ensureSignedIn();
    // Search first
    const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`;
    const resp = await gapi.client.drive.files.list({
      q, fields: 'files(id,name)', spaces: 'drive', pageSize: 5
    });
    const files = resp.result.files || [];
    if (files.length > 0) {
      folderCache[cacheKey] = files[0].id;
      return files[0].id;
    }
    // Create
    const create = await gapi.client.drive.files.create({
      resource: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      },
      fields: 'id'
    });
    folderCache[cacheKey] = create.result.id;
    return create.result.id;
  }

  // อัปโหลดไฟล์ผ่าน multipart upload (ใช้ fetch โดยตรง)
  async function uploadFile(file, parentFolderId, customName) {
    await GAuth.ensureSignedIn();
    const metadata = {
      name: customName || file.name,
      parents: [parentFolderId]
    };
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);
    const resp = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${GAuth.getAccessToken()}` },
        body: formData
      }
    );
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error('Drive upload failed: ' + resp.status + ' ' + err);
    }
    return resp.json();
  }

  // โหลดไฟล์เป็น Blob (สำหรับ logo)
  async function downloadFile(fileId) {
    await GAuth.ensureSignedIn();
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${GAuth.getAccessToken()}` } }
    );
    if (!resp.ok) throw new Error('Drive download failed: ' + resp.status);
    return resp.blob();
  }

  // โหลดไฟล์เป็น Data URL
  async function downloadAsDataURL(fileId) {
    const blob = await downloadFile(fileId);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // คืน URL สำหรับเปิดในแท็บใหม่ (ใช้ webViewLink ของ Drive)
  function viewURL(fileId) {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  // ดึง file metadata
  async function getFileInfo(fileId) {
    await GAuth.ensureSignedIn();
    const resp = await gapi.client.drive.files.get({
      fileId,
      fields: 'id,name,webViewLink,webContentLink,mimeType'
    });
    return resp.result;
  }

  // Parse cell value: "drive:FILE_ID|name" → { id, name }
  // Or http(s) URL → { url }
  function parseCellValue(v) {
    if (!v) return null;
    const s = String(v);
    if (s.startsWith('drive:')) {
      const rest = s.substring(6);
      const [id, ...nameParts] = rest.split('|');
      return { id, name: nameParts.join('|') || id };
    }
    if (/^https?:/i.test(s)) return { url: s };
    return { name: s };
  }

  function makeCellValue(fileId, fileName) {
    return `drive:${fileId}|${fileName}`;
  }

  return {
    ensureFolder, uploadFile, downloadFile, downloadAsDataURL,
    viewURL, getFileInfo, parseCellValue, makeCellValue
  };
})();
