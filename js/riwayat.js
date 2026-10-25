// ============================================================
// riwayat.js - Riwayat, pagination, export CSV, dan export PDF
// ============================================================

const LIMIT = 10;
const EXPORT_LIMIT = 100000;
const RESEARCHER_ID = '#2904-ADS';
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI_FULL = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];
const BULAN_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

async function loadRiwayat(page = 1) {
  const tbody = document.querySelector('#riwayatTable tbody');

  try {
    const data = await requestRiwayat(page, LIMIT);
    renderTable(data.data);
    renderPagination(data.total, data.total_pages, data.page);
  } catch (err) {
    console.error('Gagal memuat riwayat:', err);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:24px;color:#dc3545;">
          Gagal memuat data riwayat.<br>
          <small style="color:#999;">${escHtml(err.message)}</small>
        </td>
      </tr>`;
  }
}

async function requestRiwayat(page, limit) {
  const res = await fetch(`backend/riwayat.php?page=${page}&limit=${limit}`);
  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();

  if (!contentType.includes('application/json')) {
    console.error('Response bukan JSON:', rawText);
    throw new Error(`Server mengembalikan ${res.status} dan bukan JSON.`);
  }

  const data = JSON.parse(rawText);

  if (!res.ok || data.error) {
    throw new Error(data.message || 'Terjadi kesalahan di server.');
  }

  return data;
}

function renderTable(rows) {
  const tbody = document.querySelector('#riwayatTable tbody');

  if (!rows || rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:24px;color:#999;">
          Belum ada riwayat analisis. Silakan upload dataset terlebih dahulu.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const { tanggalStr, jamStr } = formatTanggal(r.tanggal);
    const namaDataset = r.nama_file || `Dataset #${r.id}`;
    const akurasiPct = formatAkurasi(r.akurasi);

    return `
      <tr>
        <td class="date-cell">${tanggalStr}<br>${jamStr}</td>
        <td>${escHtml(namaDataset)}</td>
        <td>${formatAngka(r.total_data)}</td>
        <td><span class="badge positive">${formatAngka(r.positif)}</span></td>
        <td><span class="badge negative">${formatAngka(r.negatif)}</span></td>
        <td><button class ="delete-dataset-btn" data-id="${r.id}" data-nama="${escHtml(namaDataset)}" title="Hapus dataset"><i class="bi bi-trash3-fill"></i>
        </td>
      </tr>`;
  }).join(''); 
}

let pendingDeleteId = null;
let pendingDeleteNama = null;

document.querySelector('#riwayatTable tbody').addEventListener('click', (e) => {
  const btn = e.target.closest('.delete-dataset-btn');
  if (!btn) return;

  pendingDeleteId = btn.dataset.id;
  pendingDeleteNama = btn.dataset.nama;

  document.getElementById('deleteModalText').textContent =
    `Dataset "${pendingDeleteNama}" dan semua hasil klasifikasinya akan terhapus permanen.`;
  document.getElementById('deleteConfirmModal').hidden = false;
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('closeDeleteModalBtn')?.addEventListener('click', () => {
    document.getElementById('deleteConfirmModal').hidden = true;
  });

  document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
    document.getElementById('deleteConfirmModal').hidden = true;
  });

  document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
    const modal = document.getElementById('deleteConfirmModal');
    const confirmBtn = document.getElementById('confirmDeleteBtn');

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Menghapus...';

    try {
      const res = await fetch('backend/hapus-dataset.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: pendingDeleteId })
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.message || 'Gagal menghapus.');

      modal.hidden = true;
      kirimNotifikasi('Dataset dihapus', `${pendingDeleteNama} berhasil dihapus.`, 'success');
      loadRiwayat();
    } catch (err) {
      kirimNotifikasi('Gagal hapus', err.message, 'error');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Ya, Hapus';
    }
  });
});

function formatTanggal(tanggal) {
  const d = new Date(String(tanggal).replace(' ', 'T'));

  if (Number.isNaN(d.getTime())) {
    return { tanggalStr: '-', jamStr: '-' };
  }

  const tanggalStr = `${String(d.getDate()).padStart(2, '0')} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  const jamStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return { tanggalStr, jamStr };
}

function formatTanggalPanjang(date = new Date()) {
  const hari = HARI_FULL[date.getDay()];
  const tanggal = date.getDate();
  const bulan = BULAN_FULL[date.getMonth()];
  const tahun = date.getFullYear();
  const jam = String(date.getHours()).padStart(2, '0');
  const menit = String(date.getMinutes()).padStart(2, '0');
  return `${hari}, ${tanggal} ${bulan} ${tahun}, ${jam}:${menit}`;
}

function formatAngka(value) {
  return Number(value || 0).toLocaleString('id-ID');
}

function formatAkurasi(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return `${(Number(value) * 100).toFixed(1)}%`;
}

function renderPagination(total, totalPages, page) {
  const info = document.querySelector('.pagination-info');
  const buttons = document.querySelector('.pagination-buttons');

  const start = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const end = Math.min(page * LIMIT, total);
  info.textContent = `Menampilkan ${start}-${end} dari ${total} riwayat`;

  let html = `<button class="page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button>`;

  const maxButton = 5;
  let startPage = Math.max(1, page - 2);
  let endPage = Math.min(totalPages, startPage + maxButton - 1);

  if (endPage - startPage < maxButton - 1) {
    startPage = Math.max(1, endPage - maxButton + 1);
  }

  if (startPage > 1) {
    html += '<button class="page-btn" data-page="1">1</button>';
    if (startPage > 2) html += '<span class="page-dots">...</span>';
  }

  for (let i = startPage; i <= endPage; i += 1) {
    html += `<button class="page-btn ${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += '<span class="page-dots">...</span>';
    html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  html += `<button class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>›</button>`;
  buttons.innerHTML = html;

  buttons.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = Number.parseInt(btn.dataset.page, 10);

      if (!Number.isNaN(target) && target >= 1 && target <= totalPages && target !== page && !btn.disabled) {
        loadRiwayat(target);
      }
    });
  });
}

// ============================================================
// EXPORT MENU
// ============================================================

function setupExportMenu() {
  const exportBtn = document.getElementById('exportBtn');
  const exportMenu = document.getElementById('exportMenu');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');

  exportBtn.addEventListener('click', event => {
    event.stopPropagation();
    const akanDibuka = exportMenu.hidden;
    exportMenu.hidden = !akanDibuka;
    exportBtn.setAttribute('aria-expanded', String(akanDibuka));
  });

  exportMenu.addEventListener('click', event => event.stopPropagation());

  document.addEventListener('click', () => {
    exportMenu.hidden = true;
    exportBtn.setAttribute('aria-expanded', 'false');
  });

  exportCsvBtn.addEventListener('click', async () => {
    await jalankanExport(exportCsvBtn, exportCsv);
    exportMenu.hidden = true;
    exportBtn.setAttribute('aria-expanded', 'false');
  });

  exportPdfBtn.addEventListener('click', async () => {
    await jalankanExport(exportPdfBtn, exportPdf);
    exportMenu.hidden = true;
    exportBtn.setAttribute('aria-expanded', 'false');
  });
}

async function jalankanExport(button, callback) {
  const teksAwal = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="export-format">...</span><span><strong>Menyiapkan file</strong><small>Mohon tunggu sebentar</small></span>';

  try {
    await callback();

    const format = callback === exportCsv ? 'CSV' : 'PDF';
    kirimNotifikasi(
      `Export ${format} berhasil`,
      `File riwayat klasifikasi format ${format} berhasil diunduh.`,
      'success'
    );
  } catch (err) {
    console.error(err);

    kirimNotifikasi(
      'Export gagal',
      err.message || 'File tidak berhasil dibuat.',
      'error'
    );

    alert(`Export gagal: ${err.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = teksAwal;
  }
}

async function ambilSemuaRiwayat() {
  const result = await requestRiwayat(1, EXPORT_LIMIT);
  return result.data || [];
}

// ============================================================
// EXPORT CSV
// ============================================================

async function exportCsv() {
  const rows = await ambilSemuaRiwayat();

  if (rows.length === 0) {
    throw new Error('Belum ada data riwayat untuk diekspor.');
  }

  const csvRows = [
    ['Tanggal', 'Waktu', 'Nama Dataset', 'Jumlah Data', 'Positif', 'Negatif']
  ];

  rows.forEach(row => {
    const { tanggalStr, jamStr } = formatTanggal(row.tanggal);

    csvRows.push([
      tanggalStr,
      jamStr,
      row.nama_file || `Dataset #${row.id}`,
      Number(row.total_data || 0),
      Number(row.positif || 0),
      Number(row.negatif || 0),

    ]);
  });

  const csvText = '\uFEFF' + csvRows
    .map(row => row.map(csvEscape).join(','))
    .join('\n');

  downloadBlob(
    new Blob([csvText], { type: 'text/csv;charset=utf-8;' }),
    `riwayat-klasifikasi-${tanggalFile()}.csv`
  );
}

function csvEscape(value) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ============================================================
// EXPORT PDF A4
// Semua dataset dimasukkan. Data dibagi ke beberapa halaman agar
// tidak terpotong dan tidak menghasilkan halaman kosong.
// ============================================================

async function exportPdf() {
  if (
    typeof html2canvas === 'undefined' ||
    !window.jspdf ||
    !window.jspdf.jsPDF
  ) {
    throw new Error(
      'Library PDF belum termuat. Pastikan internet aktif lalu refresh halaman.'
    );
  }

  const rows = await ambilSemuaRiwayat();

  if (rows.length === 0) {
    throw new Error('Belum ada data riwayat untuk dibuat menjadi PDF.');
  }

  const report = document.getElementById('pdfReport');
  report.innerHTML = buatTemplatePdf(rows);

  if (document.fonts) {
    await Promise.all([
      document.fonts.load('400 12px Poppins'),
      document.fonts.load('500 12px Poppins'),
      document.fonts.load('600 12px Poppins'),
      document.fonts.load('700 12px Poppins'),
      document.fonts.ready
    ]);
  }

  await new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const pages = Array.from(
    report.querySelectorAll('.pdf-page')
  );

  // Tema Opinia memberi animasi bertahap pada baris tabel. Animasi itu
  // harus dimatikan sebelum html2canvas, agar baris bawah tidak terlihat
  // transparan atau seperti blur di PDF.
  pages.forEach(page => {
    page.querySelectorAll('*').forEach(element => {
      element.style.setProperty('animation', 'none', 'important');
      element.style.setProperty('transition', 'none', 'important');
      element.style.setProperty('opacity', '1', 'important');
      element.style.setProperty('filter', 'none', 'important');
      element.style.setProperty('visibility', 'visible', 'important');
    });
  });

  await new Promise(resolve => setTimeout(resolve, 80));

  if (pages.length === 0) {
    report.innerHTML = '';
    throw new Error('Template PDF gagal dibuat.');
  }

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];

    const canvas = await html2canvas(page, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      logging: false,
      width: 794,
      height: 1123,
      windowWidth: 794,
      windowHeight: 1123,
      scrollX: 0,
      scrollY: 0
    });

    if (index > 0) {
      pdf.addPage('a4', 'portrait');
    }

    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      0,
      0,
      210,
      297,
      undefined,
      'FAST'
    );
  }

  pdf.save(
    `riwayat-klasifikasi-${tanggalFile()}.pdf`
  );

  report.innerHTML = '';
}


function buatTemplatePdf(rows) {
  const statistik = hitungStatistik(rows);
  const namaUser =
    window.currentUser?.nama ||
    localStorage.getItem('nama') ||
    document.querySelector('.user-name')?.textContent?.trim() ||
    localStorage.getItem('username') ||
    'Pengguna';

  const tanggalSekarang =
    formatTanggalPanjang(new Date());

  /*
   * Halaman pertama memuat kartu statistik sehingga tabel dibuat
   * lebih pendek. Halaman selanjutnya dapat memuat lebih banyak baris.
   */
  const halamanRows = [];
  const jumlahBarisHalamanPertama = 12;
  const jumlahBarisHalamanLanjutan = 16;

  halamanRows.push(
    rows.slice(0, jumlahBarisHalamanPertama)
  );

  let posisi = jumlahBarisHalamanPertama;

  while (posisi < rows.length) {
    halamanRows.push(
      rows.slice(
        posisi,
        posisi + jumlahBarisHalamanLanjutan
      )
    );

    posisi += jumlahBarisHalamanLanjutan;
  }

  const totalHalaman = halamanRows.length;

  return halamanRows.map((pageRows, pageIndex) => {
    return buatHalamanPdf({
      rows: pageRows,
      statistik,
      namaUser,
      tanggalSekarang,
      nomorHalaman: pageIndex + 1,
      totalHalaman,
      halamanPertama: pageIndex === 0
    });
  }).join('');
}


function buatHalamanPdf({
  rows,
  statistik,
  namaUser,
  tanggalSekarang,
  nomorHalaman,
  totalHalaman,
  halamanPertama
}) {
  const tableRows = rows.map(row => {
    const { tanggalStr, jamStr } =
      formatTanggal(row.tanggal);

    const namaDataset =
      row.nama_file || `Dataset #${row.id}`;

    return `
      <tr>
        <td>
          ${tanggalStr}
          <span class="pdf-time">${jamStr} WIB</span>
        </td>

        <td>${escHtml(namaDataset)}</td>

        <td>${formatAngka(row.total_data)}</td>

        <td>
          <span class="pdf-badge pdf-badge-positive">
            ${formatAngka(row.positif)}
          </span>
        </td>

        <td>
          <span class="pdf-badge pdf-badge-negative">
            ${formatAngka(row.negatif)}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  const cards = halamanPertama
    ? `
      <div class="pdf-metrics">
        <article class="pdf-metric-card">
          <div class="pdf-metric-label">
            Total Analisis
          </div>

          <div class="pdf-metric-value">
            ${formatAngka(statistik.totalData)}
          </div>

          <div class="pdf-metric-note">
            Total ulasan yang telah diklasifikasikan
          </div>
        </article>

        <article class="pdf-metric-card">
          <div class="pdf-metric-label">
            Sentimen Negatif
          </div>

          <div class="pdf-metric-value">
            ${statistik.persenNegatif}
          </div>

          <div class="pdf-metric-bar">
            <span
              style="width:${statistik.persenNegatifAngka}%"
            ></span>
          </div>
        </article>

        <article class="pdf-metric-card">
          <div class="pdf-metric-label">
            Sentimen Positif
          </div>

          <div class="pdf-metric-value">
            ${statistik.persenPositif}
          </div>

          <div class="pdf-metric-bar">
            <span
              style="width:${statistik.persenPositifAngka}%"
            ></span>
          </div>
        </article>

        <article class="pdf-metric-card">
          <div class="pdf-metric-label">
            Dataset<br>Terproses
          </div>

          <div class="pdf-metric-value">
            ${formatAngka(statistik.totalDataset)}
          </div>

          <div class="pdf-metric-note">
            Format utama: .csv
          </div>
        </article>
      </div>
    `
    : '';

  return `
    <section class="pdf-page ${halamanPertama ? '' : 'pdf-page-continuation'}">
      <header class="pdf-header pdf-header-unified">
        <div class="pdf-brand">
          <span class="pdf-brand-icon pdf-opinia-mark">op</span>

          <div>
            <div class="pdf-brand-name">OPINIA</div>
            <div class="pdf-brand-subtitle">
              Academic Sentiment Analysis
            </div>
          </div>
        </div>

        <div class="pdf-header-meta">
          <div>
            <span style="font-weight: 400; color: #4d4447;">
            Tanggal: ${tanggalSekarang}
            </span>
          </div>
          <div>
            <span style="font-weight: 600; color: #1c1b1b;">
             Peneliti: ${escHtml(namaUser)}
            </span>
          </div>
        </div>
      </header>

      <div class="pdf-title-block pdf-title-centered">
        <h1>
          ${halamanPertama
            ? 'Riwayat Klasifikasi'
            : 'Riwayat Klasifikasi - Lanjutan'
          }
        </h1>

        <p>
          ${halamanPertama
            ? 'Tinjau kembali log analisis sentimen sebelumnya untuk keperluan audit dan validasi metodologi.'
            : 'Lanjutan daftar seluruh dataset yang telah diproses oleh sistem.'
          }
        </p>
      </div>

      ${cards}

      <h2 class="pdf-section-title">
        ${halamanPertama
          ? 'Log Analisis'
          : 'Log Analisis Lanjutan'
        }
      </h2>

      <table class="pdf-table">
        <thead>
          <tr>
            <th>Tanggal &amp; Waktu</th>
            <th>Nama Dataset</th>
            <th>Jumlah</th>
            <th>Positif</th>
            <th>Negatif</th>
          </tr>
        </thead>

        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <footer class="pdf-footer">
        <div>
          © ${new Date().getFullYear()}
          Opinia Sentiment Analysis System
          • Halaman ${nomorHalaman} dari ${totalHalaman}
        </div>

        <div class="pdf-footer-right">
          <span>Confidential</span>
          <span>
            Research Purposes Only
          </span>
        </div>
      </footer>
    </section>
  `;
}


function hitungStatistik(rows) {
  const totalData = rows.reduce(
    (sum, row) => sum + Number(row.total_data || 0),
    0
  );

  const totalPositif = rows.reduce(
    (sum, row) => sum + Number(row.positif || 0),
    0
  );

  const totalNegatif = rows.reduce(
    (sum, row) => sum + Number(row.negatif || 0),
    0
  );

  const totalSentimen = totalPositif + totalNegatif;

  /*
   * Akurasi rata-rata dihitung secara tertimbang.
   *
   * Contoh:
   * dataset 1 = 100 data, akurasi 82%
   * dataset 2 = 1.000 data, akurasi 90%
   *
   * Dataset kedua diberi bobot lebih besar karena jumlah datanya
   * lebih banyak. Dataset tanpa nilai akurasi tidak ikut dihitung.
   */
  const dataAkurasi = rows
    .map(row => {
      const jumlahData = Number(row.total_data || 0);
      let akurasi = Number(row.akurasi);

      if (!Number.isFinite(akurasi) || jumlahData <= 0) {
        return null;
      }

      // Mendukung nilai database 0.825 maupun 82.5.
      if (akurasi > 1) {
        akurasi = akurasi / 100;
      }

      akurasi = Math.max(0, Math.min(1, akurasi));

      return {
        jumlahData,
        akurasiPersen: akurasi * 100
      };
    })
    .filter(Boolean);

  const totalBobot = dataAkurasi.reduce(
    (sum, item) => sum + item.jumlahData,
    0
  );

  const rataAkurasiAngka = totalBobot > 0
    ? dataAkurasi.reduce(
        (sum, item) =>
          sum + (item.akurasiPersen * item.jumlahData),
        0
      ) / totalBobot
    : null;

  const varians = (
    rataAkurasiAngka !== null &&
    totalBobot > 0
  )
    ? dataAkurasi.reduce(
        (sum, item) =>
          sum +
          (
            item.jumlahData *
            ((item.akurasiPersen - rataAkurasiAngka) ** 2)
          ),
        0
      ) / totalBobot
    : null;

  const deviasi = varians === null
    ? null
    : Math.sqrt(varians);

  const persenPositifAngka = totalSentimen > 0
    ? (totalPositif / totalSentimen) * 100
    : 0;

  const persenNegatifAngka = Math.max(0, Math.min(100, 100 - persenPositifAngka));

  return {
    totalData,
    totalDataset: rows.length,

    rataAkurasi:
      rataAkurasiAngka === null
        ? '-'
        : `${rataAkurasiAngka.toFixed(1)}%`,

    deviasiAkurasi:
      deviasi === null
        ? '-'
        : `${deviasi.toFixed(1)}%`,

    persenPositif:
      `${persenPositifAngka.toFixed(0)}%`,

    persenPositifAngka:
      Math.max(
        0,
        Math.min(100, persenPositifAngka)
      ),

    persenNegatifAngka:
      Math.max(
        0,
        Math.min(100, 100 - persenPositifAngka)
      ),

    persenNegatif:
      `${Math.max(0, Math.min(100, 100 - persenPositifAngka)).toFixed(0)}%`,
    
  };
}

function tanggalFile() {
  return new Date().toISOString().slice(0, 10);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function kirimNotifikasi(title, message, type = 'success') {
  if (typeof window.addAppNotification === 'function') {
    window.addAppNotification(
      title,
      message,
      type
    );
  }
}


// ============================================================
// INIT
// ============================================================


// ============================================================
// RIWAYAT PREDIKSI MANUAL
// ============================================================

const MANUAL_HISTORY_LIMIT = 10;
const MANUAL_HISTORY_EXPORT_LIMIT = 100000;

let manualHistoryLoaded = false;
let manualHistoryPage = 1;
let manualHistoryRows = [];


function setupHistoryTabs() {
  const tabs = document.querySelectorAll(
    '[data-history-tab]'
  );

  const datasetPanel =
    document.getElementById('datasetHistoryPanel');

  const manualPanel =
    document.getElementById('manualHistoryPanel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.historyTab;

      tabs.forEach(item => {
        item.classList.toggle(
          'active',
          item === tab
        );
      });

      datasetPanel.hidden = target !== 'dataset';
      manualPanel.hidden = target !== 'manual';

      if (
        target === 'manual' &&
        !manualHistoryLoaded
      ) {
        loadManualHistory(1);
      }
    });
  });
}


function setupManualHistory() {
  const dateFilter =
    document.getElementById('manualDateFilter');

  const sentimentFilter =
    document.getElementById('manualSentimentFilter');

  const resetButton =
    document.getElementById('manualResetFilterBtn');

  const exportButton =
    document.getElementById('manualExportCsvBtn');

  const closeButton =
    document.getElementById('closeManualDetailBtn');

  const modal =
    document.getElementById('manualDetailModal');

  dateFilter?.addEventListener('change', () => {
    loadManualHistory(1);
  });

  sentimentFilter?.addEventListener('change', () => {
    loadManualHistory(1);
  });

  resetButton?.addEventListener('click', () => {
    dateFilter.value = '';
    sentimentFilter.value = '';
    loadManualHistory(1);
  });

  exportButton?.addEventListener('click', async () => {
    const originalText = exportButton.innerHTML;

    try {
      exportButton.disabled = true;
      exportButton.innerHTML = '⏳ Menyiapkan CSV...';

      await exportManualHistoryCsv();

      kirimNotifikasi(
        'Export CSV berhasil',
        'Riwayat prediksi manual berhasil diunduh.',
        'success'
      );

    } catch (error) {
      console.error(
        'Export riwayat manual gagal:',
        error
      );

      alert(
        `Export gagal: ${error.message}`
      );

      kirimNotifikasi(
        'Export CSV gagal',
        error.message,
        'error'
      );

    } finally {
      exportButton.disabled = false;
      exportButton.innerHTML = originalText;
    }
  });

  closeButton?.addEventListener(
    'click',
    closeManualDetail
  );

  modal?.addEventListener('click', event => {
    if (event.target === modal) {
      closeManualDetail();
    }
  });

  document.addEventListener('keydown', event => {
    if (
      event.key === 'Escape' &&
      modal &&
      !modal.hidden
    ) {
      closeManualDetail();
    }
  });
}


async function loadManualHistory(page = 1) {
  const tbody =
    document.querySelector(
      '#manualHistoryTable tbody'
    );

  manualHistoryPage = page;

  tbody.innerHTML = `
    <tr>
      <td
        colspan="4"
        class="history-loading-cell"
      >
        Memuat riwayat prediksi manual...
      </td>
    </tr>
  `;

  try {
    const data = await requestManualHistory(
      page,
      MANUAL_HISTORY_LIMIT
    );

    manualHistoryLoaded = true;
    manualHistoryRows = data.data || [];

    renderManualHistoryTable(
      manualHistoryRows
    );

    renderManualHistoryPagination(
      data.total,
      data.total_pages,
      data.page
    );

  } catch (error) {
    console.error(
      'Gagal memuat riwayat manual:',
      error
    );

    tbody.innerHTML = `
      <tr>
        <td
          colspan="4"
          class="history-loading-cell"
          style="color:#c62828;"
        >
          Gagal memuat riwayat manual.
          <br>
          <small>${escHtml(error.message)}</small>
        </td>
      </tr>
    `;
  }
}


async function requestManualHistory(
  page,
  limit
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit)
  });

  const dateValue =
    document.getElementById(
      'manualDateFilter'
    )?.value || '';

  const sentimentValue =
    document.getElementById(
      'manualSentimentFilter'
    )?.value || '';

  if (dateValue) {
    params.set('tanggal', dateValue);
  }

  if (sentimentValue) {
    params.set('sentimen', sentimentValue);
  }

  const response = await fetch(
    `backend/prediksi_manual.php?${params.toString()}`,
    {
      cache: 'no-store'
    }
  );

  const contentType =
    response.headers.get('content-type') || '';

  const rawText = await response.text();

  if (!contentType.includes('application/json')) {
    console.error(
      'Respons riwayat manual bukan JSON:',
      rawText
    );

    throw new Error(
      'Backend riwayat manual tidak memberikan JSON.'
    );
  }

  const data = JSON.parse(rawText);

  if (!response.ok || data.error) {
    throw new Error(
      data.message ||
      'Riwayat manual tidak berhasil dimuat.'
    );
  }

  return data;
}


function renderManualHistoryTable(rows) {
  const tbody =
    document.querySelector(
      '#manualHistoryTable tbody'
    );

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="4"
          class="history-loading-cell"
        >
          Belum ada prediksi manual yang sesuai filter.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = rows.map((row, index) => {
    const {
      tanggalStr,
      jamStr
    } = formatTanggal(row.created_at);

    const sentimentClass =
      row.sentimen === 'Negatif'
        ? 'negative'
        : 'positive';

    return `
      <tr>
        <td class="date-cell">
          ${tanggalStr}
          <br>
          ${jamStr}
        </td>

        <td>
          <span
            class="manual-comment-preview"
            title="${escHtml(row.teks)}"
          >
            ${escHtml(row.teks)}
          </span>
        </td>

        <td>
          <span
            class="manual-sentiment-badge ${sentimentClass}"
          >
            ${escHtml(row.sentimen)}
          </span>
        </td>

        <td>
          <button
            type="button"
            class="manual-view-button"
            data-manual-index="${index}"
            aria-label="Lihat detail komentar"
          >
            <i class="fa-regular fa-eye"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody
    .querySelectorAll('[data-manual-index]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(
          button.dataset.manualIndex
        );

        const row = manualHistoryRows[index];

        if (row) {
          openManualDetail(row);
        }
      });
    });
}


function renderManualHistoryPagination(
  total,
  totalPages,
  page
) {
  const info =
    document.querySelector(
      '.manual-pagination-info'
    );

  const buttons =
    document.querySelector(
      '.manual-pagination-buttons'
    );

  const start = total === 0
    ? 0
    : (page - 1) *
      MANUAL_HISTORY_LIMIT + 1;

  const end = Math.min(
    page * MANUAL_HISTORY_LIMIT,
    total
  );

  info.textContent =
    `Menampilkan ${start}-${end} dari ${total} riwayat manual`;

  let html = `
    <button
      class="page-btn"
      data-manual-page="${page - 1}"
      ${page <= 1 ? 'disabled' : ''}
    >
      ‹
    </button>
  `;

  for (
    let current = 1;
    current <= totalPages;
    current += 1
  ) {
    if (
      totalPages > 7 &&
      current > 3 &&
      current < totalPages - 2 &&
      Math.abs(current - page) > 1
    ) {
      if (
        !html.endsWith(
          '<span class="page-dots">...</span>'
        )
      ) {
        html +=
          '<span class="page-dots">...</span>';
      }

      continue;
    }

    html += `
      <button
        class="page-btn ${current === page ? 'active' : ''}"
        data-manual-page="${current}"
      >
        ${current}
      </button>
    `;
  }

  html += `
    <button
      class="page-btn"
      data-manual-page="${page + 1}"
      ${page >= totalPages ? 'disabled' : ''}
    >
      ›
    </button>
  `;

  buttons.innerHTML = html;

  buttons
    .querySelectorAll('[data-manual-page]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const target = Number(
          button.dataset.manualPage
        );

        if (
          !button.disabled &&
          target >= 1 &&
          target <= totalPages &&
          target !== page
        ) {
          loadManualHistory(target);
        }
      });
    });
}


function openManualDetail(row) {
  const modal =
    document.getElementById(
      'manualDetailModal'
    );

  const text =
    document.getElementById(
      'manualDetailText'
    );

  const sentiment =
    document.getElementById(
      'manualDetailSentiment'
    );

  const time =
    document.getElementById(
      'manualDetailTime'
    );

  const {
    tanggalStr,
    jamStr
  } = formatTanggal(row.created_at);

  const sentimentClass =
    row.sentimen === 'Negatif'
      ? 'negative'
      : 'positive';

  text.textContent = row.teks;

  sentiment.className =
    `manual-sentiment-badge ${sentimentClass}`;

  sentiment.textContent = row.sentimen;

  time.textContent =
    `${tanggalStr}, ${jamStr}`;

  modal.hidden = false;
}


function closeManualDetail() {
  const modal =
    document.getElementById(
      'manualDetailModal'
    );

  if (modal) {
    modal.hidden = true;
  }
}


async function exportManualHistoryCsv() {
  const data = await requestManualHistory(
    1,
    MANUAL_HISTORY_EXPORT_LIMIT
  );

  const rows = data.data || [];

  if (!rows.length) {
    throw new Error(
      'Belum ada riwayat manual untuk diekspor.'
    );
  }

  const csvRows = [
    [
      'Tanggal',
      'Waktu',
      'Komentar',
      'Hasil Sentimen'
    ]
  ];

  rows.forEach(row => {
    const {
      tanggalStr,
      jamStr
    } = formatTanggal(row.created_at);

    csvRows.push([
      tanggalStr,
      jamStr,
      row.teks,
      row.sentimen
    ]);
  });

  const csvText =
    '\uFEFF' +
    csvRows
      .map(row =>
        row
          .map(csvEscape)
          .join(',')
      )
      .join('\n');

  downloadBlob(
    new Blob(
      [csvText],
      {
        type:
          'text/csv;charset=utf-8;'
      }
    ),
    `riwayat-prediksi-manual-${tanggalFile()}.csv`
  );
}


// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  if (window.authReady) {
    await window.authReady;
  }

  loadRiwayat(1);
  setupExportMenu();
  setupHistoryTabs();
  setupManualHistory();
});
