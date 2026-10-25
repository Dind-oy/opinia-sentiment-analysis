/* ============================================================
   theme-toggle.js
   Simpan dan terapkan tema pilihan user (pink / blue)
   ============================================================ */

(function () {
  const STORAGE_KEY = 'opinia-theme';

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'blue' ? 'blue' : '');
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }

  function saveTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
    applyTheme(theme);
  }

  function getSavedTheme() {
    try { return localStorage.getItem(STORAGE_KEY) || 'pink'; } catch (_) { return 'pink'; }
  }

  // Terapkan tema segera saat script dimuat (cegah flash)
  applyTheme(getSavedTheme());

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(getSavedTheme());

    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.theme-toggle-btn');
      if (!btn) return;
      saveTheme(btn.dataset.theme);
    });
  });
})();
