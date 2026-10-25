(() => {
  'use strict';

  const svg = (paths, viewBox = '0 0 24 24') => `<svg viewBox="${viewBox}" aria-hidden="true">${paths}</svg>`;
  const icons = {
    menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    bell: svg('<path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>'),
    dashboard: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    upload: svg('<path d="M12 16V4m0 0L7 9m5-5l5 5"/><path d="M5 14v5h14v-5"/>'),
    classify: svg('<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0114 0v2M3 8h2m14 0h2M12 3V1"/>'),
    manual: svg('<path d="M4 19l4.5-1 9-9a2.1 2.1 0 00-3-3l-9 9L4 19z"/><path d="M13.5 7.5l3 3"/>'),
    visual: svg('<path d="M4 20V10m6 10V4m6 16v-7m4 7V7"/>'),
    history: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M3 4v5h5"/>'),
    report: svg('<path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/>'),
    logout: svg('<path d="M10 4H5a2 2 0 00-2 2v12a2 2 0 002 2h5"/><path d="M14 8l4 4-4 4M8 12h10"/>'),
  };

  function iconForHref(href = '') {
    if (href.includes('dashboard')) return icons.dashboard;
    if (href.includes('upload')) return icons.upload;
    if (href.includes('klasifikasi')) return icons.classify;
    if (href.includes('prediksi')) return icons.manual;
    if (href.includes('visualisasi')) return icons.visual;
    if (href.includes('riwayat')) return icons.history;
    if (href.includes('laporan')) return icons.report;
    return icons.dashboard;
  }

  function titleFromPage() {
    const greeting = document.querySelector('.greeting-section h1');

    if (greeting) {
      const displayName = String(
        window.currentUser?.nama ||
        window.currentUser?.username ||
        localStorage.getItem('nama') ||
        localStorage.getItem('username') ||
        'Pengguna'
      ).trim();

      return `Hello, ${displayName || 'Pengguna'}`;
    }

    return document.querySelector('.page-header h1')?.textContent?.trim()
      || document.querySelector('.sidebar-menu li.active a')?.textContent?.trim()
      || 'Opinia';
  }

  function setupShell() {
    const sidebar = document.querySelector('.sidebar');
    const topbar = document.querySelector('.topbar');

    if (!sidebar || !topbar) return;

    // Hindari topbar ganda jika script tidak sengaja dimuat dua kali.
    if (topbar.querySelector('.opinia-topbar-left')) return;

    const oldHeader = sidebar.querySelector('.sidebar-header');
    if (oldHeader) {
      oldHeader.innerHTML = `<div class="opinia-side-brand"><span class="opinia-brand-mark">op</span><span><strong>Opinia</strong><small>Sentiment Intelligence</small></span></div>`;
    }

    sidebar.querySelectorAll('.logout').forEach(link => {
      link.href = 'backend/logout_redirect.php';
      link.setAttribute('aria-label', 'Keluar dari akun');
      link.innerHTML = `${icons.logout}<span>Logout</span>`;
    });

    sidebar.querySelectorAll('.sidebar-menu a').forEach(link => {
      const holder = link.querySelector('.menu-icon');
      if (holder) holder.innerHTML = iconForHref(link.getAttribute('href') || '');
      link.addEventListener('click', () => closeSidebar());
    });

    const left = document.createElement('div');
    left.className = 'opinia-topbar-left';
    left.innerHTML = `<button class="app-menu-toggle" type="button" aria-label="Buka menu" aria-expanded="false">${icons.menu}</button><div class="opinia-topbar-title"><strong>${escapeHtml(titleFromPage())}</strong><small>Opinia Academic Analysis</small></div>`;
    topbar.insertBefore(left, topbar.firstChild);

    const backdrop = document.createElement('div');
    backdrop.className = 'opinia-sidebar-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);

    left.querySelector('.app-menu-toggle').addEventListener('click', toggleSidebar);
    backdrop.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

    document.querySelectorAll('.notification-btn').forEach(button => {
      const badge = button.querySelector('.notification-badge');
      button.childNodes.forEach(node => { if (node.nodeType === Node.TEXT_NODE) node.textContent = ''; });
      if (!button.querySelector('svg')) button.insertAdjacentHTML('afterbegin', icons.bell);
      if (badge) button.appendChild(badge);
    });
  }

  function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
    const open = document.body.classList.contains('sidebar-open');
    document.querySelector('.app-menu-toggle')?.setAttribute('aria-expanded', String(open));
  }
  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
    document.querySelector('.app-menu-toggle')?.setAttribute('aria-expanded', 'false');
  }

  function setupReveal() {
    const selectors = [
      '.page-header', '.greeting-section', '.stat-card', '.card', '.manual-card',
      '.manual-info-card', '.laporan-summary-card', '.laporan-detail-card',
      '.annotation-card', '.info-box', '.info-card', '.history-tabs', '.manual-history-toolbar'
    ];
    const elements = [...document.querySelectorAll(selectors.join(','))];
    elements.forEach((el, i) => {
      el.classList.add('opinia-reveal');
      el.style.transitionDelay = `${Math.min(i % 6, 5) * 55}ms`;
    });
    if (!('IntersectionObserver' in window)) {
      elements.forEach(el => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .08 });
    elements.forEach(el => observer.observe(el));
  }

  function animateDynamicCharts() {
    const apply = root => {
      root.querySelectorAll?.('.chart-container rect, .eval-chart rect').forEach((el, i) => {
        el.style.animationDelay = `${i * 90}ms`;
      });
      root.querySelectorAll?.('table tbody tr').forEach((el, i) => {
        el.style.animationDelay = `${Math.min(i, 10) * 35}ms`;
      });
    };
    apply(document);
    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === 1) apply(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    /*
     * Tunggu session selesai dibaca. Tanpa ini, topbar mengambil teks
     * statis dari HTML lebih dulu dan dapat menampilkan akun lama.
     */
    try {
      if (window.authReady) {
        await window.authReady;
      }
    } catch (_) {
      return;
    }

    setupShell();
    setupReveal();
    animateDynamicCharts();
  });
})();
