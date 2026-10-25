// ============================================================
// laporan.js
// Database -> Tampilan Web -> PDF A4 satu halaman
// ============================================================

const LAPORAN_URL = 'backend/laporan.php';
const HARI_FULL = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];
const BULAN_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

let latestLaporanData = null;


document.addEventListener('DOMContentLoaded', () => {
  loadLaporan();

  const button = document.getElementById('btnCetakLaporan');

  if (button) {
    button.addEventListener('click', exportLaporanPdf);
  }
});


// ============================================================
// AMBIL DATA
// ============================================================

async function loadLaporan() {
  try {
    const response = await fetch(LAPORAN_URL, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Server mengembalikan status ${response.status}.`);
    }

    const rawData = await response.json();

    if (rawData.error) {
      throw new Error(rawData.message || 'Data laporan gagal dimuat.');
    }

    const data = normalizeLaporanData(rawData);
    latestLaporanData = data;

    renderMainPage(data);

  } catch (error) {
    console.error('Gagal memuat laporan:', error);
    renderLoadError(error);

    kirimNotifikasi(
      'Laporan gagal dimuat',
      error.message || 'Data laporan tidak berhasil diambil.',
      'error'
    );
  }
}


function normalizeLaporanData(rawData = {}) {
  const positif = parseCount(rawData.positif);
  const negatif = parseCount(rawData.negatif);
  const totalDuaKelas = positif + negatif;
  const totalBackend = parseCount(rawData.total);

  // confidence_rata2 bisa null (kalau belum ada data upload dengan
  // confidence tersimpan). Beda dengan akurasi (metrik model statis).
  const hasConfidence = rawData.confidence_rata2 !== null &&
    rawData.confidence_rata2 !== undefined;

  return {
    total: totalDuaKelas > 0 ? totalDuaKelas : totalBackend,
    positif,
    negatif,
    akurasi: parseMetric(rawData.akurasi),
    precision: parseMetric(rawData.precision),
    recall: parseMetric(rawData.recall),
    f1Score: parseMetric(rawData.f1_score),
    confidenceRataRata: hasConfidence ? parseMetric(rawData.confidence_rata2) : null,
    totalPrediksiManual: parseCount(rawData.total_prediksi_manual),
    namaDatasetTerbaru: rawData.nama_dataset || '-',
    totalDataset: parseCount(rawData.total_dataset),
    tanggalAnalisis: rawData.tanggal_analisis || null
  };
}


function getCakupanDataset(data) {
  const jumlah = Number(data.totalDataset || 0);
  const jumlahManual = Number(data.totalPrediksiManual || 0);

  let teks;

  if (jumlah > 1) {
    teks = `Gabungan ${formatNumber(jumlah)} dataset`;
  } else if (jumlah === 1) {
    teks = data.namaDatasetTerbaru &&
      data.namaDatasetTerbaru !== '-'
      ? data.namaDatasetTerbaru
      : '1 dataset terproses';
  } else {
    teks = 'Belum ada dataset';
  }

  if (jumlahManual > 0) {
    teks += ` + ${formatNumber(jumlahManual)} prediksi manual`;
  }

  return teks;
}


function parseCount(value) {
  const number = Number(
    String(value ?? 0)
      .trim()
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.')
  );

  return Number.isFinite(number) ? number : 0;
}


function parseMetric(value) {
  const number = parseFloat(
    String(value ?? 0)
      .replace('%', '')
      .replace(',', '.')
  );

  if (!Number.isFinite(number)) {
    return 0;
  }

  return clamp(number > 1 ? number / 100 : number, 0, 1);
}


// ============================================================
// TAMPILAN WEB
// ============================================================

function renderMainPage(data) {
  const pctPositif = getPercentage(data.positif, data.total);
  const pctNegatif = getPercentage(data.negatif, data.total);
  const insight = buildInsight(data);
  const recommendation = buildRecommendation(data);

  setText('webTotal', formatNumber(data.total));
  setText('webPositif', formatNumber(data.positif));
  setText('webNegatif', formatNumber(data.negatif));
  setText('webAkurasi', formatPercentage(data.akurasi));
  setText(
    'webConfidence',
    data.confidenceRataRata !== null
      ? formatPercentage(data.confidenceRataRata)
      : 'Belum ada data'
  );
  setText('webNamaDataset', getCakupanDataset(data));
  setText('webTanggal', formatTanggalIndo(data.tanggalAnalisis));
  setText('webRingkasan', insight);
  setText('webRekomendasi', recommendation);
  setText(
    'webStatus',
    data.total > 0
      ? `${formatNumber(data.total)} data telah diklasifikasikan dan siap dibuat menjadi PDF.`
      : 'Belum ada data hasil klasifikasi.'
  );
}


function renderLoadError(error) {
  setText('webRingkasan', 'Data laporan tidak dapat dimuat.');
  setText(
    'webRekomendasi',
    'Pastikan Apache, MySQL, dan koneksi database sedang berjalan.'
  );
  setText('webStatus', error.message || 'Terjadi kesalahan.');
}


// ============================================================
// EXPORT PDF A4 SATU HALAMAN
// ============================================================

async function exportLaporanPdf() {
  const button = document.getElementById('btnCetakLaporan');

  if (!button) {
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert(
      'Library PDF belum berhasil dimuat. Pastikan internet aktif lalu refresh halaman.'
    );
    return;
  }

  if (!latestLaporanData) {
    alert('Data laporan belum selesai dimuat.');
    return;
  }

  const originalText = button.innerHTML;

  try {
    button.disabled = true;
    button.innerHTML = '⏳ Membuat PDF...';

    if (document.fonts) {
      await Promise.all([
        document.fonts.load('400 12px Poppins'),
        document.fonts.load('500 12px Poppins'),
        document.fonts.load('600 12px Poppins'),
        document.fonts.load('700 12px Poppins'),
        document.fonts.ready
      ]);
    }

    const canvas = createLaporanCanvas(latestLaporanData);
    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.98),
      'JPEG',
      0,
      0,
      210,
      297,
      undefined,
      'FAST'
    );

    const fileDate = new Date().toISOString().slice(0, 10);

    pdf.save(`laporan-hasil-analisis-${fileDate}.pdf`);

    kirimNotifikasi(
      'Laporan PDF berhasil',
      'Laporan hasil analisis satu halaman berhasil diunduh.',
      'success'
    );

  } catch (error) {
    console.error('Export PDF gagal:', error);

    kirimNotifikasi(
      'Laporan PDF gagal',
      error.message || 'Laporan tidak berhasil dibuat.',
      'error'
    );

    alert(`Export PDF gagal: ${error.message}`);

  } finally {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}


// ============================================================
// DESAIN PDF
// Ukuran A4 794 x 1123 px, body Poppins 12 px.
// ============================================================

function createLaporanCanvas(data) {
  const scale = 2;
  const width = 794;
  const height = 1123;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  const isBlueTheme = document.documentElement.getAttribute('data-theme') === 'blue';
  const theme = isBlueTheme ? {
    page: '#ffffff',
    text: '#2C3947',
    muted: '#5a6e7f',
    outline: '#c8d4de',
    card: '#f0f4f8',
    positiveCard: '#e8f4ee',
    negativeCard: '#fff1f2',
    accuracyCard: '#f5edde',
    positive: '#7aab8a',
    negative: '#e9b7c0',
    primary: '#547A95',
    secondary: '#C2A56D',
    softPink: '#dde8f0',
    track: '#c8d4de'
  }: {
    page: '#ffffff',
    text: '#1c1b1b',
    muted: '#4d4447',
    outline: '#d0c3c7',
    card: '#fcf9f8',
    positiveCard: '#f4f8f1',
    negativeCard: '#fff1f2',
    accuracyCard: '#fbf8e9',
    positive: '#9eb58d',
    negative: '#e9b7c0',
    primary: '#6b5a60',
    secondary: '#c9c18a',
    softPink: '#fce4ec',
    track: '#e5e2e1'
  };

  const createdAt = new Date();
  const userName =
    window.currentUser?.nama ||
    localStorage.getItem('nama') ||
    document.querySelector('.user-name')?.textContent?.trim() ||
    localStorage.getItem('username') ||
    'Pengguna';

  const pctPositif = getPercentage(data.positif, data.total);
  const pctNegatif = getPercentage(data.negatif, data.total);
  const insight = buildInsight(data);

  ctx.fillStyle = theme.page;
  ctx.fillRect(0, 0, width, height);

  drawUnifiedLaporanHeader(ctx, {
    width,
    theme,
    title: 'Laporan Hasil Analisis Sentimen',
    subtitle:
      'Analisis sentimen ulasan Mobile Legends: Bang Bang menggunakan metode Random Forest.',
    dateValue: data.tanggalAnalisis || createdAt,
    researcher: userName
  });

  // Kartu statistik
  const cardY = 200;
  const cardGap = 14;
  const cardWidth = (width - 96 - (cardGap * 3)) / 4;
  const cardHeight = 128;

  drawStatCard(ctx, {
    x: 48,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    background: theme.card,
    iconType: 'layers',
    iconColor: '#596153',
    label: 'TOTAL DATA',
    value: formatNumber(data.total),
    theme
  });

  drawStatCard(ctx, {
    x: 48 + cardWidth + cardGap,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    background: theme.positiveCard,
    iconType: 'thumbUp',
    iconColor: '#596153',
    label: 'SENTIMEN\nPOSITIF',
    value: formatNumber(data.positif),
    theme
  });

  drawStatCard(ctx, {
    x: 48 + ((cardWidth + cardGap) * 2),
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    background: theme.negativeCard,
    iconType: 'thumbDown',
    iconColor: '#ba1a1a',
    label: 'SENTIMEN\nNEGATIF',
    value: formatNumber(data.negatif),
    theme
  });

  drawStatCard(ctx, {
    x: 48 + ((cardWidth + cardGap) * 3),
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    background: theme.accuracyCard,
    iconType: 'check',
    iconColor: '#636037',
    label: 'AKURASI\nMODEL',
    value: formatPercentage(data.akurasi),
    theme
  });

  // Dua kartu utama
  const contentY = 350;
  const panelGap = 24;
  const panelWidth = (width - 96 - panelGap) / 2;
  const panelHeight = 300;

  drawRoundedRect(
    ctx,
    48,
    contentY,
    panelWidth,
    panelHeight,
    7,
    theme.card,
    '#e5e2e1'
  );

  drawRoundedRect(
    ctx,
    48 + panelWidth + panelGap,
    contentY,
    panelWidth,
    panelHeight,
    7,
    theme.card,
    '#e5e2e1'
  );

  ctx.textAlign = 'left';
  ctx.fillStyle = theme.text;
  setCanvasFont(ctx, 600, 16);
  ctx.fillText('Distribusi Sentimen', 68, contentY + 34);
  ctx.fillText(
    'Evaluasi Model',
    68 + panelWidth + panelGap,
    contentY + 34
  );

  drawDonut(
    ctx,
    48 + panelWidth / 2,
    contentY + 145,
    67,
    28,
    data,
    theme
  );

  drawLegend(
    ctx,
    70,
    contentY + 260,
    panelWidth - 44,
    theme,
    data,
    pctPositif,
    pctNegatif
  );

  drawMetricPanel(
    ctx,
    48 + panelWidth + panelGap + 20,
    contentY + 83,
    panelWidth - 40,
    data,
    theme
  );

  // Insight
  const insightY = 676;
  const insightHeight = 122;

  drawRoundedRect(
    ctx,
    48,
    insightY,
    width - 96,
    insightHeight,
    7,
    theme.softPink,
    '#dfb9c3'
  );

  ctx.textAlign = 'left';
  ctx.fillStyle = theme.primary;
  setCanvasFont(ctx, 600, 16);
  ctx.fillText('Insight Utama', 66, insightY + 34);

  ctx.fillStyle = theme.text;
  setCanvasFont(ctx, 400, 12);
  wrapCanvasText(
    ctx,
    insight,
    66,
    insightY + 63,
    width - 132,
    19,
    4
  );

  // Metadata
  const metaY = 824;
  const metaHeight = 150;

  drawRoundedRect(
    ctx,
    48,
    metaY,
    width - 96,
    metaHeight,
    7,
    '#ffffff',
    '#e5e2e1'
  );

  drawMetaRow(
    ctx,
    66,
    metaY + 34,
    302,
    'Cakupan Dataset:',
    getCakupanDataset(data),
    theme
  );

  drawMetaRow(
    ctx,
    426,
    metaY + 34,
    302,
    'Metode Klasifikasi:',
    'Random Forest',
    theme
  );

  drawMetaDivider(ctx, 66, 426, metaY + 54, theme);

  drawMetaRow(
    ctx,
    66,
    metaY + 77,
    302,
    'Jumlah Data:',
    formatNumber(data.total),
    theme
  );

  drawMetaRow(
    ctx,
    426,
    metaY + 77,
    302,
    'Ekstraksi Fitur:',
    'TF-IDF',
    theme
  );

  drawMetaDivider(ctx, 66, 426, metaY + 97, theme);

  drawMetaRow(
    ctx,
    66,
    metaY + 120,
    302,
    'Tanggal Analisis:',
    formatTanggalIndo(data.tanggalAnalisis || createdAt),
    theme
  );

  drawMetaRow(
    ctx,
    426,
    metaY + 120,
    302,
    'Nama Pengguna:',
    userName,
    theme
  );

  // Footer
  drawLine(ctx, 48, 1037, width - 48, 1037, theme.outline, 1);

  ctx.textAlign = 'left';
  ctx.fillStyle = theme.muted;
  setCanvasFont(ctx, 400, 10);
  ctx.fillText(
    `© ${createdAt.getFullYear()} Opinia Sentiment Analysis System`,
    48,
    1068
  );

  ctx.textAlign = 'right';
  ctx.fillText('Halaman 1 dari 1', width - 48, 1068);

  return canvas;
}


// ============================================================
// HELPER GAMBAR PDF
// ============================================================


function drawUnifiedLaporanHeader(ctx, options) {
  const {
    width,
    theme,
    title,
    subtitle,
    dateValue,
    researcher
  } = options;

  drawRoundedRect(
    ctx,
    48,
    34,
    38,
    38,
    8,
    theme.text,
    null
  );

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  setCanvasFont(ctx, 700, 13);
  ctx.fillText('op', 67, 58);

  ctx.textAlign = 'left';
  ctx.fillStyle = theme.text;
  setCanvasFont(ctx, 700, 16);
  ctx.fillText('OPINIA', 98, 51);

  ctx.fillStyle = theme.muted;
  setCanvasFont(ctx, 500, 8);
  ctx.fillText(
    'ACADEMIC SENTIMENT ANALYSIS',
    98,
    69
  );

  const parsedDate = dateValue instanceof Date
    ? dateValue
    : new Date(String(dateValue).replace(' ', 'T'));

  const safeDate = Number.isNaN(parsedDate.getTime())
    ? new Date()
    : parsedDate;

  // Gunakan formatTanggalIndo agar menyertakan nama hari
  const dateText = formatTanggalIndo(safeDate);
  
  const timeText = safeDate.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  ctx.textAlign = 'right';
  ctx.fillStyle = theme.muted;
  setCanvasFont(ctx, 400, 9);
  ctx.fillText(
    `Tanggal: ${dateText}, ${timeText}`,
    width - 48,
    49
  );

  ctx.fillStyle = theme.text;
  setCanvasFont(ctx, 600, 9);
  ctx.fillText(
    `Peneliti: ${researcher}`,
    width - 48,
    68
  );

  drawLine(
    ctx,
    48,
    92,
    width - 48,
    92,
    theme.outline,
    1
  );

  ctx.textAlign = 'center';
  ctx.fillStyle = theme.text;
  setCanvasFont(ctx, 700, 24);
  ctx.fillText(title, width / 2, 132);

  ctx.fillStyle = theme.muted;
  setCanvasFont(ctx, 400, 11);
  wrapCanvasText(
    ctx,
    subtitle,
    width / 2,
    158,
    width - 170,
    18,
    2
  );
}

function drawReportIcon(ctx, x, y, size, theme) {
  drawRoundedRect(ctx, x, y, size, size, 4, '#f0eded', null);

  ctx.strokeStyle = theme.primary;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 17, y + 13, 19, 24);

  ctx.beginPath();
  ctx.moveTo(x + 22, y + 31);
  ctx.lineTo(x + 22, y + 25);
  ctx.moveTo(x + 27, y + 31);
  ctx.lineTo(x + 27, y + 20);
  ctx.moveTo(x + 32, y + 31);
  ctx.lineTo(x + 32, y + 17);
  ctx.stroke();
}


function drawStatCard(ctx, options) {
  const {
    x, y, width, height, background,
    iconType, iconColor, label, value, theme
  } = options;

  drawRoundedRect(
    ctx,
    x,
    y,
    width,
    height,
    6,
    background,
    '#e5e2e1'
  );

  drawSmallIcon(ctx, x + 20, y + 25, iconType, iconColor);

  ctx.textAlign = 'left';
  ctx.fillStyle = theme.text;
  setCanvasFont(ctx, 500, 10);

  const labelLines = String(label).split('\n');
  labelLines.forEach((line, index) => {
    ctx.fillText(line, x + 48, y + 28 + (index * 14));
  });

  setCanvasFont(ctx, 700, 28);
  ctx.fillText(value, x + 18, y + 101);
}


function drawSmallIcon(ctx, x, y, type, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'layers') {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 8, y - 6);
    ctx.lineTo(x + 16, y);
    ctx.lineTo(x + 8, y + 6);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 5);
    ctx.lineTo(x + 8, y + 10);
    ctx.lineTo(x + 14, y + 5);
    ctx.stroke();
    return;
  }

  if (type === 'check') {
    ctx.beginPath();
    ctx.arc(x + 8, y + 2, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 2);
    ctx.lineTo(x + 7, y + 5);
    ctx.lineTo(x + 12, y - 2);
    ctx.stroke();
    return;
  }

  if (type === 'thumbUp') {
    // Manset
    ctx.strokeRect(x, y - 1, 4, 12);

    // Bentuk tangan dan ibu jari ke atas
    ctx.beginPath();
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x + 10, y - 7);
    ctx.quadraticCurveTo(x + 11, y - 10, x + 14, y - 8);
    ctx.quadraticCurveTo(x + 15, y - 7, x + 14, y - 4);
    ctx.lineTo(x + 13, y);
    ctx.lineTo(x + 18, y);
    ctx.quadraticCurveTo(x + 20, y, x + 19, y + 3);
    ctx.lineTo(x + 17, y + 9);
    ctx.quadraticCurveTo(x + 16, y + 11, x + 13, y + 11);
    ctx.lineTo(x + 8, y + 11);
    ctx.lineTo(x + 4, y + 8);
    ctx.closePath();
    ctx.stroke();
    return;
  }

  if (type === 'thumbDown') {
    // Manset
    ctx.strokeRect(x, y - 10, 4, 12);

    // Bentuk tangan dan ibu jari ke bawah
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 1);
    ctx.lineTo(x + 8, y + 1);
    ctx.lineTo(x + 10, y + 8);
    ctx.quadraticCurveTo(x + 11, y + 11, x + 14, y + 9);
    ctx.quadraticCurveTo(x + 15, y + 8, x + 14, y + 5);
    ctx.lineTo(x + 13, y + 1);
    ctx.lineTo(x + 18, y + 1);
    ctx.quadraticCurveTo(x + 20, y + 1, x + 19, y - 2);
    ctx.lineTo(x + 17, y - 8);
    ctx.quadraticCurveTo(x + 16, y - 10, x + 13, y - 10);
    ctx.lineTo(x + 8, y - 10);
    ctx.lineTo(x + 4, y - 7);
    ctx.closePath();
    ctx.stroke();
    return;
  }
}


function drawDonut(ctx, centerX, centerY, radius, lineWidth, data, theme) {
  const posFraction = data.total > 0 ? data.positif / data.total : 0;
  const negFraction = data.total > 0 ? data.negatif / data.total : 0;
  const start = -Math.PI / 2;

  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'butt';

  ctx.strokeStyle = theme.track;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = theme.positive;
  ctx.beginPath();
  ctx.arc(
    centerX,
    centerY,
    radius,
    start,
    start + (Math.PI * 2 * posFraction)
  );
  ctx.stroke();

  ctx.strokeStyle = theme.negative;
  ctx.beginPath();
  ctx.arc(
    centerX,
    centerY,
    radius,
    start + (Math.PI * 2 * posFraction),
    start + (Math.PI * 2 * (posFraction + negFraction))
  );
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = theme.text;
  setCanvasFont(ctx, 700, 25);
  ctx.fillText(formatNumber(data.total), centerX, centerY + 7);
}


function drawLegend(ctx, x, y, width, theme, data, pctPositif, pctNegatif) {
  const half = width / 2;

  ctx.textAlign = 'left';
  setCanvasFont(ctx, 400, 12);

  ctx.fillStyle = theme.positive;
  ctx.beginPath();
  ctx.arc(x + 5, y - 4, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = theme.text;
  ctx.fillText(
    `Positif: ${formatNumber(data.positif)} data`,
    x + 18,
    y
  );
  ctx.fillText(`(${pctPositif.toFixed(0)}%)`, x + 18, y + 18);

  ctx.fillStyle = theme.negative;
  ctx.beginPath();
  ctx.arc(x + half + 5, y - 4, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = theme.text;
  ctx.fillText(
    `Negatif: ${formatNumber(data.negatif)} data`,
    x + half + 18,
    y
  );
  ctx.fillText(`(${pctNegatif.toFixed(0)}%)`, x + half + 18, y + 18);
}


function drawMetricPanel(ctx, x, y, width, data, theme) {
  const metrics = [
    ['Accuracy', data.akurasi, theme.primary],
    ['Precision', data.precision, theme.secondary],
    ['Recall', data.recall, '#d9b9c2'],
    ['F1-Score', data.f1Score, theme.primary]
  ];

  // Confidence rata-rata cuma ditampilkan kalau datanya ada
  // (butuh minimal 1 dataset yang sudah pernah diupload & diprediksi).
  if (data.confidenceRataRata !== null && data.confidenceRataRata !== undefined) {
    metrics.push(['Confidence Rata-rata', data.confidenceRataRata, '#8aa1b1']);
  }

  // Rapatkan jarak antar baris kalau jumlah metrik bertambah (5),
  // supaya tetap muat di tinggi panel yang sama.
  const rowSpacing = metrics.length > 4 ? 42 : 55;

  metrics.forEach(([label, value, color], index) => {
    const rowY = y + (index * rowSpacing);
    const safeValue = clamp(value, 0, 1);

    ctx.textAlign = 'left';
    ctx.fillStyle = theme.text;
    setCanvasFont(ctx, 400, 12);
    ctx.fillText(label, x, rowY);

    ctx.textAlign = 'right';
    ctx.fillText(formatPercentage(safeValue), x + width, rowY);

    drawRoundedRect(
      ctx,
      x,
      rowY + 13,
      width,
      7,
      4,
      theme.track,
      null
    );

    drawRoundedRect(
      ctx,
      x,
      rowY + 13,
      width * safeValue,
      7,
      4,
      color,
      null
    );
  });
}


function drawMetaRow(ctx, x, y, width, label, value, theme) {
  ctx.textAlign = 'left';
  ctx.fillStyle = theme.text;
  setCanvasFont(ctx, 500, 12);
  ctx.fillText(label, x, y);

  ctx.fillStyle = theme.muted;
  setCanvasFont(ctx, 400, 12);

  const valueX = x + 145;
  const maxWidth = width - 145;
  const safeValue = truncateCanvasText(ctx, String(value ?? '-'), maxWidth);
  ctx.fillText(safeValue, valueX, y);
}


function drawMetaDivider(ctx, leftX, rightX, y, theme) {
  drawLine(ctx, leftX, y, leftX + 302, y, '#eeeeee', 1);
  drawLine(ctx, rightX, y, rightX + 302, y, '#eeeeee', 1);
}


function drawRoundedRect(ctx, x, y, width, height, radius, fillColor, strokeColor) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height
  );
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}


function drawLine(ctx, x1, y1, x2, y2, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}


function setCanvasFont(ctx, weight, size, italic = false) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px Poppins, Arial, sans-serif`;
}


function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text ?? '').split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (ctx.measureText(testLine).width <= maxWidth || !currentLine) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  const visibleLines = lines.slice(0, maxLines);

  if (lines.length > maxLines && visibleLines.length) {
    let last = visibleLines[visibleLines.length - 1];

    while (
      ctx.measureText(`${last}...`).width > maxWidth &&
      last.length > 0
    ) {
      last = last.slice(0, -1);
    }

    visibleLines[visibleLines.length - 1] = `${last.trim()}...`;
  }

  visibleLines.forEach((line, index) => {
    ctx.fillText(line, x, y + (index * lineHeight));
  });
}


function truncateCanvasText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let result = text;

  while (
    result.length > 0 &&
    ctx.measureText(`${result}...`).width > maxWidth
  ) {
    result = result.slice(0, -1);
  }

  return `${result.trim()}...`;
}


// ============================================================
// HELPER DATA DAN TEKS
// ============================================================

function buildInsight(data) {
  if (data.total <= 0) {
    return 'Belum ada data hasil klasifikasi untuk dianalisis.';
  }

  const positiveDominant = data.positif >= data.negatif;
  const dominantLabel = positiveDominant ? 'positif' : 'negatif';
  const dominantValue = positiveDominant ? data.positif : data.negatif;
  const dominantPct = getPercentage(dominantValue, data.total);

  let performanceText;

  if (data.akurasi >= 0.85) {
    performanceText = 'sangat baik';
  } else if (data.akurasi >= 0.75) {
    performanceText = 'cukup baik';
  } else {
    performanceText = 'masih memerlukan peningkatan';
  }

  return (
    `Sentimen ${dominantLabel} mendominasi ulasan pengguna sebesar ` +
    `${dominantPct.toFixed(0)}%. Model Random Forest menunjukkan performa ` +
    `${performanceText} dengan akurasi ${formatPercentage(data.akurasi)}, ` +
    `sehingga hasil klasifikasi dapat digunakan sebagai ringkasan kecenderungan opini pengguna.`
  );
}


function buildRecommendation(data) {
  if (data.total <= 0) {
    return 'Upload dataset untuk memperoleh rekomendasi berdasarkan hasil analisis.';
  }

  const pctNegatif = getPercentage(data.negatif, data.total);

  if (pctNegatif >= 50) {
    return (
      'Sentimen negatif mendominasi. Prioritaskan peninjauan ulasan negatif ' +
      'untuk mengidentifikasi gangguan permainan, performa aplikasi, dan keluhan pengguna yang paling sering muncul.'
    );
  }

  if (pctNegatif >= 30) {
    return (
      'Sentimen negatif masih cukup tinggi. Lakukan pemantauan berkala dan kelompokkan ulasan negatif berdasarkan topik utama.'
    );
  }

  return (
    'Sentimen positif mendominasi. Pertahankan kualitas layanan dan tetap pantau ulasan baru agar perubahan opini dapat diketahui lebih awal.'
  );
}


function getPercentage(value, total) {
  return total > 0 ? (Number(value || 0) / total) * 100 : 0;
}


function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value) || 0);
}


function formatPercentage(value) {
  return `${(clamp(value, 0, 1) * 100).toFixed(1)}%`;
}


function formatTanggalIndo(value) {
  const date = value instanceof Date
    ? value
    : value
      ? new Date(String(value).replace(' ', 'T'))
      : new Date();

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const hari = HARI_FULL[date.getDay()];
  const tanggal = date.getDate();
  const bulan = BULAN_FULL[date.getMonth()];
  const tahun = date.getFullYear();

  return `${hari}, ${tanggal} ${bulan} ${tahun}`;
}


function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value) || 0));
}


function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}


function kirimNotifikasi(title, message, type = 'success') {
  if (typeof window.addAppNotification === 'function') {
    window.addAppNotification(title, message, type);
  }
}
