// ============================================================
// logout-confirm.js
// Konfirmasi logout Opinia 
// ============================================================

(() => {
  'use strict';

  const MODAL_ID = 'opiniaLogoutConfirm';
  const STYLE_ID = 'opiniaLogoutConfirmStyle';

  let logoutUrl = 'backend/logout_redirect.php';
  let lastFocusedElement = null;
  let isLoggingOut = false;

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${MODAL_ID}[hidden] {
        display: none !important;
      }

      #${MODAL_ID} {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: grid;
        place-items: center;
        padding: 24px;
        background: rgba(24, 18, 21, 0.52);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        animation: opiniaLogoutOverlayIn 180ms ease-out;
      }

      .opinia-logout-dialog {
        width: min(420px, 100%);
        border: 1px solid #eadde1;
        border-radius: 20px;
        background: #fffdfd;
        box-shadow: 0 24px 70px rgba(43, 28, 34, 0.24);
        overflow: hidden;
        animation: opiniaLogoutDialogIn 220ms ease-out;
      }

      .opinia-logout-body {
        padding: 30px 30px 22px;
        text-align: center;
      }

      .opinia-logout-icon {
        display: grid;
        place-items: center;
        width: 62px;
        height: 62px;
        margin: 0 auto 18px;
        border: 1px solid #f1cbd6;
        border-radius: 18px;
        background: #fff0f4;
        color: #3d3336;
      }

      .opinia-logout-icon svg {
        width: 28px;
        height: 28px;
      }

      .opinia-logout-title {
        margin: 0;
        color: #1d181a;
        font-family: "Poppins", Arial, sans-serif;
        font-size: 22px;
        font-weight: 700;
        line-height: 1.3;
      }

      .opinia-logout-text {
        max-width: 320px;
        margin: 10px auto 0;
        color: #756b6f;
        font-family: "Poppins", Arial, sans-serif;
        font-size: 13px;
        line-height: 1.7;
      }

      .opinia-logout-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding: 0 30px 30px;
      }

      .opinia-logout-button {
        min-height: 46px;
        border-radius: 12px;
        font-family: "Poppins", Arial, sans-serif;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition:
          transform 160ms ease,
          background 160ms ease,
          border-color 160ms ease,
          opacity 160ms ease;
      }

      .opinia-logout-button:hover:not(:disabled) {
        transform: translateY(-1px);
      }

      .opinia-logout-button:disabled {
        cursor: not-allowed;
        opacity: 0.72;
      }

      .opinia-logout-cancel {
        border: 1px solid #dfd4d7;
        background: #ffffff;
        color: #4e4448;
      }

      .opinia-logout-cancel:hover {
        background: #faf5f7;
      }

      .opinia-logout-confirm {
        border: 1px solid #6e6366;
        background: #6b5b60;
        color: #ffffff;
        box-shadow: 0 10px 24px rgba(216, 47, 97, 0.22);
      }

      .opinia-logout-confirm:hover {
        background: #775962;
        border-color: #795862;
      }

      body.opinia-logout-open {
        overflow: hidden;
      }

      @keyframes opiniaLogoutOverlayIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes opiniaLogoutDialogIn {
        from {
          opacity: 0;
          transform: translateY(10px) scale(0.96);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @media (max-width: 520px) {
        .opinia-logout-body {
          padding: 26px 22px 20px;
        }

        .opinia-logout-actions {
          grid-template-columns: 1fr;
          padding: 0 22px 24px;
        }

        .opinia-logout-confirm {
          order: -1;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createModal() {
    if (document.getElementById(MODAL_ID)) return;

    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.hidden = true;

    modal.innerHTML = `
      <div
        class="opinia-logout-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="opiniaLogoutTitle"
        aria-describedby="opiniaLogoutText"
      >
        <div class="opinia-logout-body">
          <div class="opinia-logout-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M10 17l5-5-5-5"></path>
              <path d="M15 12H3"></path>
              <path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"></path>
            </svg>
          </div>

          <h2
            id="opiniaLogoutTitle"
            class="opinia-logout-title"
          >
            Yakin mau keluar?
          </h2>

          <p
            id="opiniaLogoutText"
            class="opinia-logout-text"
          >
            Sesi akun akan diakhiri dan kamu akan kembali ke halaman utama Opinia.
          </p>
        </div>

        <div class="opinia-logout-actions">
          <button
            type="button"
            class="opinia-logout-button opinia-logout-cancel"
            data-opinia-logout-cancel
          >
            Tidak
          </button>

          <button
            type="button"
            class="opinia-logout-button opinia-logout-confirm"
            data-opinia-logout-confirm
          >
            Ya, Keluar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal
      .querySelector('[data-opinia-logout-cancel]')
      .addEventListener('click', closeModal);

    modal
      .querySelector('[data-opinia-logout-confirm]')
      .addEventListener('click', confirmLogout);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (!modal.hidden && event.key === 'Escape') {
        closeModal();
      }
    });
  }

  function openModal(url) {
    if (isLoggingOut) return;

    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;

    logoutUrl =
      url && url !== '#'
        ? url
        : 'backend/logout_redirect.php';

    lastFocusedElement = document.activeElement;

    modal.hidden = false;
    document.body.classList.add('opinia-logout-open');

    requestAnimationFrame(() => {
      modal
        .querySelector('[data-opinia-logout-confirm]')
        ?.focus();
    });
  }

  function closeModal() {
    if (isLoggingOut) return;

    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;

    modal.hidden = true;
    document.body.classList.remove('opinia-logout-open');

    if (
      lastFocusedElement &&
      typeof lastFocusedElement.focus === 'function'
    ) {
      lastFocusedElement.focus();
    }
  }

  function confirmLogout() {
    if (isLoggingOut) return;

    isLoggingOut = true;

    const confirmButton = document.querySelector(
      '[data-opinia-logout-confirm]'
    );

    const cancelButton = document.querySelector(
      '[data-opinia-logout-cancel]'
    );

    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.textContent = 'Keluar...';
    }

    if (cancelButton) {
      cancelButton.disabled = true;
    }

    window.location.assign(logoutUrl);
  }

  function interceptLogout(event) {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const logoutLink = target.closest(
      'a.logout, a[href*="logout_redirect.php"], [data-logout]'
    );

    if (!logoutLink) return;

    /*
     * Dipasang pada WINDOW fase capture.
     * Jadi kode ini berjalan sebelum listener logout lama di document/body.
     */
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const url =
      logoutLink.getAttribute('href') ||
      logoutLink.getAttribute('data-logout-url') ||
      'backend/logout_redirect.php';

    openModal(url);
  }

  function init() {
    injectStyle();
    createModal();

    /*
     * Jangan ubah ke document.addEventListener.
     * WINDOW + capture=true diperlukan agar logout lama tidak keburu jalan.
     */
    window.addEventListener(
      'click',
      interceptLogout,
      true
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      { once: true }
    );
  } else {
    init();
  }
})();
