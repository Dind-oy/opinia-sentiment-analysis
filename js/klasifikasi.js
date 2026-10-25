// ============================================================
// klasifikasi.js
// Hasil klasifikasi per akun + filter Semua / Positif / Negatif
// ============================================================

const LIMIT = 20;

let offset = 0;
let isLoading = false;
let accountHasDataset = false;
let activeSentimentFilter = 'semua';

const tbody = document.querySelector('#datasetTable tbody');
const badgeCount = document.querySelector('.badge-count');
const processButton = document.getElementById('btnProsesKlasifikasi');
const loadMoreButton = document.querySelector('.btn-load-more');
const accountNotice = document.getElementById('accountDatasetNotice');
const filterSummary = document.getElementById('classificationFilterSummary');
const filterButtons = document.querySelectorAll('[data-sentiment-filter]');

const BADGE_STYLE = {
  positif: 'background:#d4edda;color:#155724;border:1px solid #c3e6cb;',
  negatif: 'background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;',
  default: 'background:#e2e3e5;color:#383d41;border:1px solid #d6d8db;'
};

function normalizeSentiment(value) {
  const text = String(value || '').trim().toLowerCase();

  if (text.includes('positif') || text.includes('positive')) {
    return 'positif';
  }

  if (text.includes('negatif') || text.includes('negative')) {
    return 'negatif';
  }

  return 'default';
}

function getBadgeStyle(sentiment) {
  return BADGE_STYLE[normalizeSentiment(sentiment)] || BADGE_STYLE.default;
}

function getFilterLabel(filter = activeSentimentFilter) {
  const labels = {
    semua: 'Semua',
    positif: 'Positif',
    negatif: 'Negatif'
  };

  return labels[filter] || labels.semua;
}

function setFilterSummary(filteredTotal = 0, totalAll = 0) {
  if (!filterSummary) return;

  if (activeSentimentFilter === 'semua') {
    filterSummary.textContent = `Menampilkan semua ${totalAll.toLocaleString('id-ID')} hasil sentimen.`;
    return;
  }

  filterSummary.textContent =
    `Menampilkan ${filteredTotal.toLocaleString('id-ID')} komentar ` +
    `dengan sentimen ${getFilterLabel().toLowerCase()} dari ` +
    `${totalAll.toLocaleString('id-ID')} data.`;
}

function updateFilterButtons() {
  filterButtons.forEach(button => {
    const isActive = button.dataset.sentimentFilter === activeSentimentFilter;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function renderEmptyAccount() {
  accountHasDataset = false;
  offset = 0;

  badgeCount.textContent = '0 Baris';
  loadMoreButton.style.display = 'none';
  setFilterSummary(0, 0);

  tbody.innerHTML = `
    <tr>
      <td colspan="3" class="classification-empty-state">
        <div class="classification-empty-icon">📂</div>
        <strong>Belum ada dataset pada akun ini</strong>
        <div style="margin-top:7px;font-size:12px;">
          Upload file CSV terlebih dahulu untuk menampilkan hasil klasifikasi.
        </div>
      </td>
    </tr>
  `;

  accountNotice.style.display = 'block';
  accountNotice.innerHTML = `
    Akun <strong>${escapeHtml(window.currentUser?.nama || 'ini')}</strong>
    belum memiliki dataset.
  `;
}

function renderNoFilterResult(totalAll) {
  const label = getFilterLabel().toLowerCase();

  badgeCount.textContent = `0 ${getFilterLabel()}`;
  loadMoreButton.style.display = 'none';
  setFilterSummary(0, totalAll);

  tbody.innerHTML = `
    <tr>
      <td colspan="3" class="classification-empty-state">
        <div class="classification-empty-icon">⌕</div>
        <strong>Tidak ada komentar ${escapeHtml(label)}</strong>
        <div style="margin-top:7px;font-size:12px;">
          Pilih filter lain untuk melihat hasil klasifikasi yang tersedia.
        </div>
      </td>
    </tr>
  `;
}

function renderLoading() {
  tbody.innerHTML = `
    <tr>
      <td colspan="3" style="text-align:center;padding:30px;color:#999;">
        ⏳ Memuat data ${getFilterLabel().toLowerCase()}...
      </td>
    </tr>
  `;
}

function renderRows(rows) {
  rows.forEach((item, index) => {
    const row = document.createElement('tr');
    row.className = 'filter-row-enter';
    row.style.animationDelay = `${Math.min(index * 28, 280)}ms`;

    row.innerHTML = `
      <td>#${item.id}</td>
      <td style="max-width:620px;word-break:break-word;">
        ${escapeHtml(item.content)}
      </td>
      <td>
        <span style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;${getBadgeStyle(item.prediksi)}">
          ${escapeHtml(item.prediksi)}
        </span>
      </td>
    `;

    tbody.appendChild(row);
  });
}

async function checkAccountDataset() {
  const response = await fetch('backend/status_klasifikasi.php', {
    cache: 'no-store',
    credentials: 'same-origin'
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.message || 'Status dataset akun gagal diperiksa.');
  }

  accountHasDataset = Number(data.total_dataset || 0) > 0;
  return data;
}

async function fetchClassification(reset = false) {
  if (isLoading) return;

  isLoading = true;

  if (reset) {
    offset = 0;
    renderLoading();
  }

  try {
    await checkAccountDataset();

    if (!accountHasDataset) {
      renderEmptyAccount();
      return;
    }

    accountNotice.style.display = 'block';
    accountNotice.innerHTML = `
      Data yang ditampilkan hanya milik akun
      <strong>${escapeHtml(window.currentUser?.nama || window.currentUser?.username || 'aktif')}</strong>.
    `;

    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String(offset),
      sentimen: activeSentimentFilter
    });

    const response = await fetch(`backend/hasil_klasifikasi.php?${params.toString()}`, {
      cache: 'no-store',
      credentials: 'same-origin'
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.message || 'Hasil klasifikasi gagal dimuat.');
    }

    if (offset === 0) {
      tbody.innerHTML = '';
    }

    if (data.data.length === 0 && offset === 0) {
      if (Number(data.total_all || 0) === 0) {
        renderEmptyAccount();
      } else {
        renderNoFilterResult(Number(data.total_all || 0));
      }
      return;
    }

    renderRows(data.data);

    const filterLabel = getFilterLabel();
    badgeCount.textContent = activeSentimentFilter === 'semua'
      ? `${Number(data.total).toLocaleString('id-ID')} Baris`
      : `${Number(data.total).toLocaleString('id-ID')} ${filterLabel}`;

    setFilterSummary(Number(data.total), Number(data.total_all));

    offset += data.data.length;
    loadMoreButton.style.display = offset >= Number(data.total) ? 'none' : 'block';

  } catch (error) {
    console.error('Klasifikasi gagal dimuat:', error);

    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align:center;padding:30px;color:#c62828;">
          ❌ ${escapeHtml(error.message)}
        </td>
      </tr>
    `;

    badgeCount.textContent = '0 Baris';
    loadMoreButton.style.display = 'none';
  } finally {
    isLoading = false;
  }
}

filterButtons.forEach(button => {
  button.addEventListener('click', async () => {
    const nextFilter = button.dataset.sentimentFilter || 'semua';

    if (nextFilter === activeSentimentFilter || isLoading) return;

    activeSentimentFilter = nextFilter;
    updateFilterButtons();
    await fetchClassification(true);
  });
});

processButton?.addEventListener('click', async () => {
  if (!accountHasDataset) {
    const goToUpload = confirm(
      'Akun ini belum memiliki dataset. Pergi ke halaman Upload Dataset?'
    );

    if (goToUpload) {
      window.location.href = 'upload-dataset.html';
    }

    return;
  }

  processButton.disabled = true;
  processButton.textContent = '⏳ Memuat ulang...';

  await fetchClassification(true);

  processButton.disabled = false;
  processButton.textContent = '🌐 Proses Klasifikasi';
});

loadMoreButton?.addEventListener('click', () => fetchClassification(false));

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', async () => {
  renderLoading();
  updateFilterButtons();

  if (window.authReady) {
    await window.authReady;
  }

  await fetchClassification(true);
});
