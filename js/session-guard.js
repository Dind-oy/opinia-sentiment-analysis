// ============================================================
// session-guard.js
// Melindungi halaman, menyamakan identitas akun, dan logout aman.
// ============================================================

document.documentElement.style.visibility = 'hidden';

window.authReady = (async () => {
  try {
    const response = await fetch(
      'backend/session.php',
      {
        cache: 'no-store',
        credentials: 'same-origin'
      }
    );

    const data = await response.json();

    if (!response.ok || !data.logged_in || !data.user) {
      throw new Error('UNAUTHENTICATED');
    }

    const user = normalizeAuthUser(data.user);

    window.currentUser = user;

    localStorage.setItem('user_id', String(user.id));
    localStorage.setItem('username', user.username);
    localStorage.setItem('nama', user.nama);

    window.userScopedKey = function userScopedKey(base) {
      return `${base}_${user.id}`;
    };

    applyAuthenticatedUser(user);
    document.documentElement.style.visibility = '';

    return user;

  } catch (error) {
    clearBaseIdentity();

    const currentPage =
      window.location.pathname.split('/').pop() || '';

    window.location.replace(
      `login.html?next=${encodeURIComponent(currentPage)}`
    );

    throw error;
  }
})();


function normalizeAuthUser(user) {
  const username = String(user?.username || '').trim();
  const nama = String(user?.nama || username || 'Pengguna').trim();

  return {
    id: Number(user?.id || 0),
    username,
    nama: nama || username || 'Pengguna'
  };
}


function applyAuthenticatedUser(user) {
  const apply = () => {
    const displayName =
      String(user?.nama || user?.username || 'Pengguna').trim() ||
      'Pengguna';

    document
      .querySelectorAll('.user-name')
      .forEach(element => {
        element.textContent = displayName;
      });

    const greeting =
      document.querySelector('.greeting-section h1');

    if (greeting) {
      greeting.textContent = `Hello, ${displayName}`;
    }

    /*
     * Topbar dibuat oleh opinia-ui.js. Kadang elemen tersebut sudah
     * terbentuk sebelum session selesai dibaca. Karena itu judulnya
     * ikut disinkronkan di sini agar tidak tertinggal "Hello, Adinda".
     */
    const topbarTitle =
      document.querySelector('.opinia-topbar-title strong');

    if (topbarTitle && greeting) {
      topbarTitle.textContent = `Hello, ${displayName}`;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      apply,
      { once: true }
    );
  } else {
    apply();
  }
}


function clearBaseIdentity() {
  localStorage.removeItem('user_id');
  localStorage.removeItem('username');
  localStorage.removeItem('nama');
}


function clearUserBrowserData(userId) {
  clearBaseIdentity();

  if (userId) {
    localStorage.removeItem(`lastUpload_${userId}`);
    localStorage.removeItem(`appNotifications_${userId}`);
  }

  localStorage.removeItem('lastUpload');
  localStorage.removeItem('appNotifications');
}


document.addEventListener(
  'click',
  async event => {
    const logoutLink = event.target.closest('.logout');

    if (!logoutLink) {
      return;
    }

    event.preventDefault();

    if (logoutLink.dataset.loggingOut === 'true') {
      return;
    }

    logoutLink.dataset.loggingOut = 'true';
    logoutLink.setAttribute('aria-busy', 'true');

    const currentUserId = localStorage.getItem('user_id');

    try {
      const response = await fetch(
        'backend/logout.php',
        {
          method: 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Logout gagal: HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'success') {
        throw new Error(data.message || 'Logout gagal.');
      }

      clearUserBrowserData(currentUserId);
      window.location.replace('index.html?logout=success');

    } catch (error) {
      console.error('Logout melalui JavaScript gagal:', error);

      clearUserBrowserData(currentUserId);
      window.location.href = 'backend/logout_redirect.php';
    }
  },
  true
);
