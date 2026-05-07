/* ==========================================================================
 * Sheets API wrapper — อ่าน/เขียน Google Sheets ทุกชีต
 * ========================================================================== */

const SheetsAPI = (() => {
  // Read all sheets in one call. Returns: { sheetName: [[row1...], [row2...]] }
  async function batchGet(sheetNames) {
    await GAuth.ensureSignedIn();
    const ranges = sheetNames.map(n => `'${escapeSheetName(n)}'`);
    const resp = await gapi.client.sheets.spreadsheets.values.batchGet({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      ranges,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING'
    });
    const out = {};
    const ranges_resp = (resp.result && resp.result.valueRanges) || [];
    sheetNames.forEach((name, i) => {
      out[name] = (ranges_resp[i] && ranges_resp[i].values) || [];
    });
    return out;
  }

  // Replace entire sheet content (clear → write).
  // aoa is array-of-arrays. First row should be the header.
  async function replaceSheet(sheetName, aoa) {
    await GAuth.ensureSignedIn();
    const escName = escapeSheetName(sheetName);
    // Clear first
    await gapi.client.sheets.spreadsheets.values.clear({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `'${escName}'`
    });
    if (!aoa || aoa.length === 0) return;
    // Then write
    await gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `'${escName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: aoa }
    });
  }

  // Replace multiple sheets — does each in sequence (rate-limit friendly)
  async function replaceMany(updates) {
    // updates: [{sheetName, aoa}, ...]
    for (const u of updates) {
      await replaceSheet(u.sheetName, u.aoa);
    }
  }

  // Append rows to a sheet (without clearing)
  async function appendRows(sheetName, rows) {
    await GAuth.ensureSignedIn();
    const escName = escapeSheetName(sheetName);
    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `'${escName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: rows }
    });
  }

  // Ensure all required sheets exist; create missing ones with header row
  async function ensureSheetsExist(sheetSpec) {
    // sheetSpec: { sheetName: [headerRow] }
    await GAuth.ensureSignedIn();
    const meta = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      fields: 'sheets.properties'
    });
    const existing = new Set((meta.result.sheets || []).map(s => s.properties.title));
    const requests = [];
    const toAddHeader = [];
    for (const [name, header] of Object.entries(sheetSpec)) {
      if (!existing.has(name)) {
        requests.push({ addSheet: { properties: { title: name } } });
        toAddHeader.push({ name, header });
      }
    }
    if (requests.length) {
      await gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId: CONFIG.SPREADSHEET_ID,
        resource: { requests }
      });
      // write header rows
      for (const {name, header} of toAddHeader) {
        if (header && header.length) {
          await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: CONFIG.SPREADSHEET_ID,
            range: `'${escapeSheetName(name)}'!A1`,
            valueInputOption: 'RAW',
            resource: { values: [header] }
          });
        }
      }
    }
  }

  function escapeSheetName(n) {
    return String(n).replace(/'/g, "''");
  }

  return { batchGet, replaceSheet, replaceMany, appendRows, ensureSheetsExist };
})();
