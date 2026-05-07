/* ==========================================================================
 * Main entry — wires UI events and bootstraps the ONLINE app
 * ========================================================================== */

(function () {
  // Sidebar nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => {
      const view = el.dataset.view;
      if (!App.state.signedIn) {
        App.toast('กรุณาเข้าสู่ระบบ Google ก่อน', 'warning');
        return;
      }
      Views.render(view);
    });
  });

  // Sign in / out toggle
  document.getElementById('btnPickFolder').addEventListener('click', () => {
    if (App.state.signedIn) App.signOut();
    else App.signIn();
  });
  document.getElementById('btnReload').addEventListener('click', () => App.loadAll());

  // Modal close
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.dataset.close) App.closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') App.closeModal();
  });

  // Boot
  (async () => {
    Views.render('dashboard');
    document.getElementById('welcome').classList.remove('hidden');
    if (!CONFIG.CLIENT_ID || CONFIG.CLIENT_ID.startsWith('YOUR_')) {
      document.getElementById('folderName').textContent = '⚠️ ยังไม่ได้ตั้งค่า config.js';
      App.toast('โปรดเปิด setup-guide.html เพื่อตั้งค่า OAuth ก่อน', 'warning');
    }
  })();
})();
