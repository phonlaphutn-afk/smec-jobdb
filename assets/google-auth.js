/* ==========================================================================
 * Google Auth — wrapper ของ Google Identity Services (GIS) + gapi.client
 * ใช้ Implicit OAuth flow (ไม่มี client secret) — เหมาะกับ web app ฝั่ง browser
 * ========================================================================== */

const GAuth = (() => {
  let tokenClient = null;
  let accessToken = null;
  let tokenExpiry = 0;
  let userEmail = null;
  let initialized = false;
  let pendingResolve = null;

  // โหลด gapi.client + discovery docs (Sheets, Drive)
  async function initGapi() {
    return new Promise((resolve, reject) => {
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            discoveryDocs: [
              'https://sheets.googleapis.com/$discovery/rest?version=v4',
              'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
            ]
          });
          resolve();
        } catch (e) { reject(e); }
      });
    });
  }

  function initTokenClient() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: (resp) => {
        if (resp.error) {
          console.error('Auth error:', resp);
          if (pendingResolve) { pendingResolve(false); pendingResolve = null; }
          return;
        }
        accessToken = resp.access_token;
        tokenExpiry = Date.now() + ((resp.expires_in || 3600) - 60) * 1000;
        gapi.client.setToken({ access_token: accessToken });
        // also fetch user email for display
        fetchUserInfo().catch(() => {});
        if (pendingResolve) { pendingResolve(true); pendingResolve = null; }
      },
      error_callback: (err) => {
        console.error('Auth flow error:', err);
        if (pendingResolve) { pendingResolve(false); pendingResolve = null; }
      }
    });
  }

  async function fetchUserInfo() {
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (r.ok) {
        const data = await r.json();
        userEmail = data.email || null;
      }
    } catch (e) { /* non-critical */ }
  }

  async function init() {
    if (initialized) return;
    if (!CONFIG.CLIENT_ID || CONFIG.CLIENT_ID.startsWith('YOUR_')) {
      throw new Error('ยังไม่ได้ตั้งค่า CLIENT_ID ใน config.js');
    }
    await initGapi();
    initTokenClient();
    initialized = true;
  }

  function signIn(promptType = 'consent') {
    return new Promise(async (resolve) => {
      try {
        await init();
      } catch (e) { App.toast(e.message, 'error'); resolve(false); return; }
      pendingResolve = resolve;
      try {
        tokenClient.requestAccessToken({ prompt: promptType });
      } catch (e) {
        console.error(e);
        if (pendingResolve) { pendingResolve(false); pendingResolve = null; }
      }
    });
  }

  function signOut() {
    if (accessToken) {
      try { google.accounts.oauth2.revoke(accessToken, () => {}); } catch (e) {}
    }
    accessToken = null;
    tokenExpiry = 0;
    userEmail = null;
    if (gapi && gapi.client) gapi.client.setToken(null);
  }

  async function ensureSignedIn() {
    if (accessToken && Date.now() < tokenExpiry) return true;
    // Try silent refresh first
    if (initialized && tokenClient) {
      const ok = await new Promise((resolve) => {
        pendingResolve = resolve;
        try {
          tokenClient.requestAccessToken({ prompt: '' });
        } catch (e) {
          if (pendingResolve) { pendingResolve(false); pendingResolve = null; }
        }
      });
      if (ok) return true;
    }
    return signIn('consent');
  }

  function isSignedIn() {
    return !!accessToken && Date.now() < tokenExpiry;
  }

  function getEmail() { return userEmail; }
  function getAccessToken() { return accessToken; }

  return { init, signIn, signOut, ensureSignedIn, isSignedIn, getEmail, getAccessToken };
})();
