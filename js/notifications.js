function getNotificationKey() {
  const userId =
    window.currentUser?.id ||
    localStorage.getItem('user_id') ||
    'guest';

  return `appNotifications_${userId}`;
}

function getNotifications() {
  try {
    return JSON.parse(localStorage.getItem(getNotificationKey())) || [];
  } catch {
    return [];
  }
}

function saveNotifications(data) {
  localStorage.setItem(
    getNotificationKey(),
    JSON.stringify(data.slice(0, 20))
  );
}

function addAppNotification(title, message, type = 'success') {
  const notifications = getNotifications();

  notifications.unshift({
    id: Date.now(),
    title,
    message,
    type,
    time: new Date().toISOString(),
    read: false
  });

  saveNotifications(notifications);
  renderNotification();
}

function formatNotificationTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderNotification() {
  const button = document.querySelector('.notification-btn');
  const panel = document.getElementById('notificationPanel');
  const badge = document.getElementById('notificationBadge');

  if (!button || !panel || !badge) {
    return;
  }

  const notifications = getNotifications();
  const unread = notifications.filter(item => !item.read).length;

  badge.textContent = unread > 9 ? '9+' : unread;
  badge.hidden = unread === 0;

  if (notifications.length === 0) {
    panel.innerHTML = `
      <div class="notification-header">
        <strong>Notifikasi</strong>
      </div>

      <div class="notification-empty">
        Belum ada notifikasi.
      </div>
    `;
    return;
  }

  panel.innerHTML = `
    <div class="notification-header">
      <strong>Notifikasi</strong>

      <button type="button" id="markNotificationRead">
        Tandai dibaca
      </button>
    </div>

    <div class="notification-list">
      ${notifications.map(item => `
        <div class="notification-item ${item.read ? '' : 'unread'}">
          <span class="notification-icon ${item.type}">
            ${item.type === 'error' ? '✕' : '✓'}
          </span>

          <div>
            <strong>${escapeNotification(item.title)}</strong>
            <p>${escapeNotification(item.message)}</p>
            <small>${formatNotificationTime(item.time)}</small>
          </div>
        </div>
      `).join('')}
    </div>

    <button type="button" class="notification-clear" id="clearNotification">
      Hapus semua notifikasi
    </button>
  `;

  document
    .getElementById('markNotificationRead')
    ?.addEventListener('click', event => {
      event.stopPropagation();

      const updated = getNotifications().map(item => ({
        ...item,
        read: true
      }));

      saveNotifications(updated);
      renderNotification();
    });

  document
    .getElementById('clearNotification')
    ?.addEventListener('click', event => {
      event.stopPropagation();
      localStorage.removeItem(getNotificationKey());
      renderNotification();
    });
}

function setupNotification() {
  const button = document.querySelector('.notification-btn');
  const topbarRight = document.querySelector('.topbar-right');

  if (!button || !topbarRight) {
    return;
  }

  button.type = 'button';
  button.setAttribute('aria-label', 'Buka notifikasi');

  topbarRight.classList.add('notification-wrapper');

  button.innerHTML = `
    🔔
    <span id="notificationBadge" class="notification-badge" hidden></span>
  `;

  const panel = document.createElement('div');
  panel.id = 'notificationPanel';
  panel.className = 'notification-panel';
  panel.hidden = true;

  topbarRight.appendChild(panel);

  button.addEventListener('click', event => {
    event.stopPropagation();
    panel.hidden = !panel.hidden;

    if (!panel.hidden) {
      const updated = getNotifications().map(item => ({
        ...item,
        read: true
      }));

      saveNotifications(updated);
      renderNotification();
    }
  });

  panel.addEventListener('click', event => {
    event.stopPropagation();
  });

  document.addEventListener('click', () => {
    panel.hidden = true;
  });

  renderNotification();
}

function escapeNotification(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

window.addAppNotification = addAppNotification;

document.addEventListener('DOMContentLoaded', setupNotification);