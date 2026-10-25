// ============================================================
// upload.js
// Upload memakai username dari PHP session, bukan username default.
// Semua ikon memakai Font Awesome (bukan emoji).
// ============================================================

const fileInput =
  document.getElementById('fileInput');

const chooseButton =
  document.getElementById('btnPilihFile');

const fileNameElement =
  document.getElementById('fileName');

const uploadButton =
  document.querySelector('.btn-unggah');

const uploadStatus =
  document.getElementById('uploadStatus');

const uploadArea =
  document.querySelector('.upload-area');

let selectedFile = null;

// ------------------------------------------------------------
// Konfigurasi tampilan notifikasi (ikon + warna per tipe)
// Dipusatkan di sini supaya semua notifikasi (upload, sukses,
// gagal, warning, info) konsisten & mudah diubah di satu tempat.
// ------------------------------------------------------------
const STATUS_CONFIG = {
  info: {
    background: 'var(--op-surface)',
    border: 'var(--op-primary)',
    icon: 'fa-solid fa-circle-info',
    iconColor: 'var(--op-primary)'
  },

  success: {
    background: 'var(--op-surface)',
    border: 'var(--op-primary)',
    icon: 'fa-solid fa-circle-check',
    iconColor: '#22a06b'
  },

  error: {
    background: 'var(--op-surface)',
    border: 'var(--op-primary)',
    icon: 'fa-solid fa-circle-xmark',
    iconColor: '#dc3545'
  }
};


function getLastUploadKey() {
  if (
    typeof window.userScopedKey === 'function'
  ) {
    return window.userScopedKey(
      'lastUpload'
    );
  }

  const userId =
    window.currentUser?.id ||
    localStorage.getItem('user_id') ||
    'guest';

  return `lastUpload_${userId}`;
}


chooseButton?.addEventListener(
  'click',
  () => fileInput.click()
);


fileInput?.addEventListener(
  'change',
  event => {
    const file =
      event.target.files[0];

    if (!file) {
      return;
    }

    setSelectedFile(file);
  }
);


uploadArea?.addEventListener(
  'dragover',
  event => {
    event.preventDefault();

    uploadArea.style.borderColor =
      '#6c63ff';

    uploadArea.style.background =
      '#f0eeff';
  }
);


uploadArea?.addEventListener(
  'dragleave',
  () => {
    uploadArea.style.borderColor = '';
    uploadArea.style.background = '';
  }
);


uploadArea?.addEventListener(
  'drop',
  event => {
    event.preventDefault();

    uploadArea.style.borderColor = '';
    uploadArea.style.background = '';

    const file =
      event.dataTransfer.files[0];

    if (
      !file ||
      !file.name.toLowerCase().endsWith('.csv')
    ) {
      showStatus(
        'error',
        'Hanya file CSV yang diterima.'
      );

      return;
    }

    setSelectedFile(file);
  }
);


uploadButton?.addEventListener(
  'click',
  async () => {
    if (!selectedFile) {
      showStatus(
        'warning',
        'Pilih file CSV terlebih dahulu.'
      );

      return;
    }

    setLoading(true);

    showStatus(
      'info',
      'Sedang mengunggah dan memproses dataset akun ini...'
    );

    try {
      if (window.authReady) {
        await window.authReady;
      }

      const formData =
        new FormData();

      formData.append(
        'file',
        selectedFile
      );

      const response = await fetch(
        'backend/upload_and_save.php',
        {
          method: 'POST',
          body: formData,
          credentials: 'same-origin'
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
          data.message ||
          'File gagal diproses.'
        );
      }

      localStorage.setItem(
        getLastUploadKey(),
        JSON.stringify({
          filename: data.filename,
          total: data.total_rows,
          positif: data.positif,
          negatif: data.negatif,
          timestamp:
            new Date().toISOString()
        })
      );

      showStatus(
        'success',
        `
          <strong>Berhasil!</strong>
          ${data.total_rows} baris disimpan untuk akun
          <strong>
            ${escapeHtml(
              window.currentUser?.nama ||
              window.currentUser?.username ||
              'aktif'
            )}
          </strong>.
          <br>

          <i class="fa-solid fa-chart-simple" style="color:#28a745;"></i>
          Positif:
          <strong>${data.positif}</strong>
          &nbsp;|&nbsp;
          <i class="fa-solid fa-chart-simple" style="color:#dc3545;"></i>
          Negatif:
          <strong>${data.negatif}</strong>
          <br>

          <a
            href="klasifikasi.html"
            style="
              color:#6c63ff;
              font-weight:600;
            "
          >
            <i class="fa-solid fa-arrow-right"></i>
            Lihat hasil klasifikasi
          </a>
        `
      );

      renderPreview(data.preview);

    } catch (error) {
      showStatus(
        'error',
        `Error: ${escapeHtml(error.message)}`
      );

    } finally {
      setLoading(false);
    }
  }
);


function setSelectedFile(file) {
  selectedFile = file;

  fileNameElement.innerHTML =
    `<i class="fa-solid fa-file-csv"></i> ${escapeHtml(file.name)} (${(file.size / 1024).toFixed(1)} KB)`;

  showStatus('', '');
}


// ------------------------------------------------------------
// Menampilkan notifikasi dengan ikon Font Awesome yang konsisten
// sesuai tipe: success, error, warning, info.
// Kosongkan type/html untuk menyembunyikan notifikasi.
// ------------------------------------------------------------
function showStatus(type, html) {
  const config = STATUS_CONFIG[type];

  if (!type || !html || !config) {
    uploadStatus.style.background = 'transparent';
    uploadStatus.style.border = 'none';
    uploadStatus.style.borderRadius = '8px';
    uploadStatus.style.padding = '0';
    uploadStatus.innerHTML = '';
    return;
  }

  uploadStatus.style.background = config.background;
  uploadStatus.style.border = `1px solid ${config.border}`;
  uploadStatus.style.borderRadius = '8px';
  uploadStatus.style.padding = '12px 16px';

  uploadStatus.innerHTML = `
    <span style="display:flex; align-items:flex-start; gap:10px;">
      <i class="${config.icon}" style="color:${config.iconColor}; margin-top:2px;"></i>
      <span style="flex:1;">${html}</span>
    </span>
  `;
}


function setLoading(state) {
  uploadButton.disabled = state;
  chooseButton.disabled = state;

  uploadButton.innerHTML = state
    ? '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...'
    : '<i class="fa-solid fa-cloud-arrow-up"></i> Unggah Dataset';
}


function renderPreview(rows) {
  if (
    !rows ||
    rows.length === 0
  ) {
    return;
  }

  document
    .getElementById('previewSection')
    ?.remove();

  const section =
    document.createElement('div');

  section.id = 'previewSection';
  section.style.cssText =
    'margin-top:24px;';

  const badgeIcons = {
    Positif: { icon: 'fa-solid fa-thumbs-up', background: '#28a745' },
    Negatif: { icon: 'fa-solid fa-thumbs-down', background: '#dc3545' }
  };

  const rowsHtml = rows
    .map(row => {
      const badge =
        badgeIcons[row.sentiment] ||
        { icon: 'fa-solid fa-circle-question', background: '#6c757d' };

      return `
      <tr>
        <td>#${row.row}</td>

        <td
          style="
            max-width:400px;
            word-break:break-word;
          "
        >
          ${escapeHtml(row.text)}
        </td>

        <td>
          <span
            style="
              display:inline-flex;
              align-items:center;
              gap:6px;
              padding:3px 10px;
              border-radius:12px;
              font-size:12px;
              font-weight:600;
              background:${badge.background};
              color:#fff;
            "
          >
            <i class="${badge.icon}"></i>
            ${escapeHtml(row.sentiment)}
          </span>
        </td>
      </tr>
    `;
    })
    .join('');

  section.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>
          <i class="fa-solid fa-table-list"></i>
          Preview Hasil (10 baris pertama)
        </h3>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Teks Ulasan</th>
            <th>Prediksi Sentimen</th>
          </tr>
        </thead>

        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;

  document
    .querySelector('.content')
    ?.appendChild(section);
}


function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
