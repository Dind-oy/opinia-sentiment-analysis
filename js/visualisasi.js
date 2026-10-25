// ============================================================
// visualisasi.js
// Database → Visualisasi → PDF A4
// ============================================================

const VISUALISASI_URL = 'backend/visualisasi.php';

const HARI_FULL = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];
const BULAN_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const COLORS = {
  positif: '#4caf50',
  negatif: '#f44336',
};

let latestVisualisasiData = null;


// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadVisualisasi();

  const exportButton =
    document.getElementById('btnExportVisualisasiPdf') ||
    document.querySelector('.export-btn');

  if (exportButton) {
    exportButton.id = 'btnExportVisualisasiPdf';
    exportButton.type = 'button';
    exportButton.addEventListener('click', exportVisualisasiPdf);
  }
});


// ============================================================
// AMBIL DATA DARI DATABASE
// ============================================================

async function loadVisualisasi() {
  try {
    const response = await fetch(VISUALISASI_URL, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Server mengembalikan status ${response.status}.`);
    }

    const rawData = await response.json();
    const data = normalizeVisualisasiData(rawData);

    latestVisualisasiData = data;

    renderDonut(data);
    renderEvalChart(data);
    renderInsight(data);

  } catch (error) {
    console.error('Gagal memuat data visualisasi:', error);
    renderVisualisasiError();

    kirimNotifikasi(
      'Visualisasi gagal dimuat',
      error.message || 'Data visualisasi tidak berhasil diambil.',
      'error'
    );
  }
}


// ============================================================
// NORMALISASI DATA
// ============================================================

function normalizeVisualisasiData(rawData = {}) {
  const positif = parseCount(rawData.positif);
  const negatif = parseCount(rawData.negatif);

  return {
    total: positif + negatif,
    positif,
    negatif,
    akurasi: parseMetric(rawData.akurasi),
    precision: parseMetric(rawData.precision),
    recall: parseMetric(rawData.recall),
    f1_score: parseMetric(rawData.f1_score),
  };
}


function parseCount(value) {
  const cleaned = String(value ?? '0')
    .trim()
    .replace(/[^\d,.-]/g, '');

  if (!cleaned) {
    return 0;
  }

  // Hitungan dari database biasanya bilangan bulat.
  const number = Number(
    cleaned
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.')
  );

  return Number.isFinite(number) ? number : 0;
}


function parseMetric(value) {
  const cleaned = String(value ?? '0')
    .trim()
    .replace('%', '')
    .replace(',', '.');

  const number = parseFloat(cleaned);

  if (!Number.isFinite(number)) {
    return 0;
  }

  // 82.1 menjadi 0.821, sedangkan 0.821 tetap 0.821.
  return clamp(number > 1 ? number / 100 : number, 0, 1);
}


// ============================================================
// DONUT CHART
// ============================================================

function renderDonut(data) {
  const svg = document.querySelector('.pie-container svg');
  const pieCenter = document.querySelector('.pie-center');
  const legend = document.querySelector('.pie-legend');

  if (!svg || !pieCenter || !legend) {
    return;
  }

  if (data.total <= 0) {
    svg.innerHTML = `
      <circle
        cx="100"
        cy="100"
        r="80"
        fill="none"
        stroke="#e0e0e0"
        stroke-width="40"
      />
    `;

    pieCenter.innerHTML = '0<br><small>Total Data</small>';
    legend.innerHTML = `
      <div class="legend-item">
        Belum ada data hasil klasifikasi.
      </div>
    `;
    return;
  }

  const circumference = 2 * Math.PI * 80;

  const segments = [
    {
      value: data.positif,
      color: COLORS.positif,
      label: '🟢 Positif',
    },
    {
      value: data.negatif,
      color: COLORS.negatif,
      label: '🔴 Negatif',
    },
  ].filter(segment => segment.value > 0);

  let offset = 0;
  let circles = '';
  let legendHTML = '';

  segments.forEach(segment => {
    const fraction = segment.value / data.total;
    const segmentLength = fraction * circumference;
    const percentage = Math.round(fraction * 100);

    circles += `
      <circle
        cx="100"
        cy="100"
        r="80"
        fill="none"
        stroke="${segment.color}"
        stroke-width="40"
        stroke-dasharray="${segmentLength} ${circumference - segmentLength}"
        stroke-dashoffset="${-offset}"
        transform="rotate(-90 100 100)"
      />
    `;

    legendHTML += `
      <div class="legend-item">
        ${segment.label}
        ${percentage}%
        (${segment.value.toLocaleString('id-ID')})
      </div>
    `;

    offset += segmentLength;
  });

  svg.innerHTML = circles;
  pieCenter.innerHTML = `
    ${data.total.toLocaleString('id-ID')}
    <br>
    <small>Total Data</small>
  `;
  legend.innerHTML = legendHTML;
}


// ============================================================
// BAR CHART EVALUASI MODEL
// ============================================================

function renderEvalChart(data) {
  const svg = document.querySelector('.eval-chart svg');

  if (!svg) {
    return;
  }

  const metrics = [
    { label: 'Akurasi', value: data.akurasi, color: '#3498db' },
    { label: 'Presisi', value: data.precision, color: '#2ecc71' },
    { label: 'Recall', value: data.recall, color: '#f39c12' },
    { label: 'F1-Score', value: data.f1_score, color: '#9b59b6' },
  ];

  const baseY = 170;
  const topY = 20;
  const maxHeight = baseY - topY;
  const barWidth = 30;
  const xPositions = [80, 140, 200, 260];

  let bars = '';

  metrics.forEach((metric, index) => {
    const safeValue = clamp(metric.value, 0, 1);
    const height = Math.round(safeValue * maxHeight);
    const x = xPositions[index];
    const centerX = x + barWidth / 2;

    bars += `
      <rect
        x="${x}"
        y="${baseY - height}"
        width="${barWidth}"
        height="${height}"
        fill="${metric.color}"
        rx="3"
      />

      <text
        class="metric-value-label"
        data-metric="${metric.label}"
        x="${centerX}"
        y="${baseY - height - 8}"
        font-size="11"
        text-anchor="middle"
        fill="${metric.color}"
        font-weight="700"
      >
        ${(safeValue * 100).toFixed(1)}%
      </text>

      <text
        x="${centerX}"
        y="190"
        font-size="12"
        text-anchor="middle"
        fill="#666"
      >
        ${metric.label}
      </text>
    `;
  });

  svg.innerHTML = `
    <line
      x1="40"
      y1="${baseY}"
      x2="380"
      y2="${baseY}"
      stroke="#ddd"
      stroke-width="1"
    />
    <line
      x1="40"
      y1="${topY}"
      x2="40"
      y2="${baseY}"
      stroke="#ddd"
      stroke-width="1"
    />
    ${bars}
  `;

  updateModelBadge(data.akurasi);
}


function updateModelBadge(accuracy) {
  const badge = document.querySelector('.badge-model');

  if (!badge) {
    return;
  }

  if (accuracy >= 0.80) {
    badge.textContent = '✓ Model Stabil';
    badge.style.background = '#d4edda';
    badge.style.color = '#155724';
  } else if (accuracy >= 0.65) {
    badge.textContent = '⚠ Perlu Peningkatan';
    badge.style.background = '#fff3cd';
    badge.style.color = '#856404';
  } else {
    badge.textContent = '✕ Model Kurang Akurat';
    badge.style.background = '#f8d7da';
    badge.style.color = '#721c24';
  }
}


// ============================================================
// INSIGHT DINAMIS
// ============================================================

function renderInsight(data) {
  const insightElement = document.querySelector('.insight-card p');

  if (!insightElement) {
    return;
  }

  if (data.total <= 0) {
    insightElement.textContent =
      'Belum ada data hasil klasifikasi. Silakan upload dataset terlebih dahulu pada halaman Upload Dataset.';
    return;
  }

  const positiveDominant = data.positif >= data.negatif;
  const dominantLabel = positiveDominant ? 'positif' : 'negatif';
  const dominantValue = positiveDominant ? data.positif : data.negatif;
  const dominantPercentage = Math.round(
    (dominantValue / data.total) * 100
  );

  const otherValue = data.total - dominantValue;
  const ratio = otherValue > 0
    ? (dominantValue / otherValue).toFixed(1)
    : '∞';

  const accuracyPercentage =
    (data.akurasi * 100).toFixed(1);

  let performanceText;

  if (data.akurasi >= 0.85) {
    performanceText =
      'menunjukkan kemampuan klasifikasi yang sangat baik';
  } else if (data.akurasi >= 0.75) {
    performanceText =
      'menunjukkan performa yang cukup baik, namun masih ada ruang untuk peningkatan';
  } else {
    performanceText =
      'mengindikasikan model masih perlu ditingkatkan lebih lanjut';
  }

  insightElement.textContent =
    `Sentimen ${dominantLabel} mendominasi dataset dengan rasio sekitar ${ratio}:1 ` +
    `(${dominantPercentage}% dari total ${data.total.toLocaleString('id-ID')} data). ` +
    `Model Random Forest yang digunakan memiliki tingkat akurasi ` +
    `${accuracyPercentage}%, ${performanceText}.`;
}


// ============================================================
// EXPORT PDF
// PDF dirender ke canvas memakai font Poppins, lalu dimasukkan ke jsPDF.
// ============================================================

async function exportVisualisasiPdf() {
  const button =
    document.getElementById('btnExportVisualisasiPdf') ||
    document.querySelector('.export-btn');

  if (!button) {
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert(
      'Library PDF belum berhasil dimuat. Pastikan internet aktif, lalu muat ulang halaman.'
    );
    return;
  }

  if (!latestVisualisasiData) {
    alert('Data visualisasi belum selesai dimuat.');
    return;
  }

  const originalText = button.innerHTML;

  try {
    button.disabled = true;
    button.innerHTML = '⏳ Membuat PDF...';

    // Pastikan font Poppins benar-benar siap sebelum menggambar PDF.
    if (document.fonts) {
      await Promise.all([
        document.fonts.load('400 16px Poppins'),
        document.fonts.load('500 16px Poppins'),
        document.fonts.load('600 16px Poppins'),
        document.fonts.load('700 16px Poppins'),
        document.fonts.ready,
      ]);
    }

    const pdfData = {
      ...latestVisualisasiData,
      ...readDisplayedMetrics(),
    };

    const reportCanvas = createReportCanvas(pdfData);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    pdf.addImage(
      reportCanvas.toDataURL('image/jpeg', 0.98),
      'JPEG',
      0,
      0,
      210,
      297,
      undefined,
      'FAST'
    );

    const fileDate = new Date()
      .toISOString()
      .slice(0, 10);

    pdf.save(
      `laporan-distribusi-sentimen-${fileDate}.pdf`
    );

    kirimNotifikasi(
      'Export PDF berhasil',
      'Laporan visualisasi sentimen berhasil diunduh.',
      'success'
    );

  } catch (error) {
    console.error('Export PDF gagal:', error);

    kirimNotifikasi(
      'Export PDF gagal',
      error.message || 'Laporan tidak berhasil dibuat.',
      'error'
    );

    alert(`Export PDF gagal: ${error.message}`);

  } finally {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}


// Membaca angka yang benar-benar tampil di chart.
// Jadi nilai PDF selalu sama dengan halaman Visualisasi.
function readDisplayedMetrics() {
  const labels = Array.from(
    document.querySelectorAll('.metric-value-label')
  );

  const values = labels.map(label => {
    const parsed = parseFloat(
      label.textContent.replace('%', '').replace(',', '.')
    );

    return Number.isFinite(parsed) ? parsed / 100 : 0;
  });

  if (values.length !== 4) {
    return {};
  }

  return {
    akurasi: values[0],
    precision: values[1],
    recall: values[2],
    f1_score: values[3],
  };
}


// ============================================================
// CANVAS LAPORAN A4 — FONT 12 + BAR CHART SESUAI WEB
// ============================================================

function createReportCanvas(data) {
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
    surface: '#ffffff',
    pageBackground: '#ffffff',
    cardBackground: '#f0f4f8',
    text: '#2C3947',
    textMuted: '#5a6e7f',
    outline: '#c8d4de',
    primary: '#547A95',
    primarySoft: '#dde8f0',
    positive: '#22c55e',
    negative: '#ef4444',
    track: '#c8d4de',
  } : {
    surface: '#ffffff',
    pageBackground: '#ffffff',
    cardBackground: '#f8f5f4',
    text: '#1c1b1b',
    textMuted: '#4d4447',
    outline: '#d0c3c7',
    primary: '#6b5a60',
    primarySoft: '#fff9fb',
    positive: '#22c55e',
    negative: '#ef4444',
    track: '#e5e2e1',
  };

  ctx.fillStyle = theme.pageBackground;
  ctx.fillRect(0, 0, width, height);

  const createdAt = new Date();
  const researcher = getPdfResearcherName();

  const insight =
    document.querySelector('.insight-card p')?.textContent.trim() ||
    'Belum tersedia insight hasil analisis.';

  drawUnifiedPdfHeader(ctx, {
    width,
    theme,
    title: 'Laporan Distribusi Sentimen',
    subtitle:
      'Tinjauan komprehensif distribusi sentimen dan metrik evaluasi model Random Forest untuk evaluasi hasil klasifikasi.',
    date: createdAt,
    researcher
  });

  // Cards
  const cardY = 230;
  const cardW = 329;
  const cardH = 330;
  const gap = 24;
  const leftX = 48;
  const rightX = leftX + cardW + gap;

  drawRoundedRect(
    ctx,
    leftX,
    cardY,
    cardW,
    cardH,
    8,
    theme.cardBackground,
    '#e5e2e1'
  );

  drawRoundedRect(
    ctx,
    rightX,
    cardY,
    cardW,
    cardH,
    8,
    theme.cardBackground,
    '#e5e2e1'
  );

  // Judul card
  setCanvasFont(ctx, 600, 11);
  ctx.fillStyle = theme.textMuted;
  ctx.textAlign = 'center';
  ctx.fillText(
    'DISTRIBUSI SENTIMEN',
    leftX + cardW / 2,
    cardY + 38
  );

  ctx.fillText(
    'EVALUASI MODEL',
    rightX + cardW / 2,
    cardY + 38
  );

  // Donut
  drawDonutCanvas(
    ctx,
    leftX + cardW / 2,
    cardY + 150,
    76,
    28,
    data,
    theme
  );

  // Legend
  drawLegendCanvas(
    ctx,
    leftX + 28,
    cardY + 267,
    cardW - 56,
    theme.positive,
    `Positif (${formatNumber(data.positif)})`,
    formatPercentage(data.total > 0 ? data.positif / data.total : 0),
    theme
  );

  drawLegendCanvas(
    ctx,
    leftX + 28,
    cardY + 300,
    cardW - 56,
    theme.negative,
    `Negatif (${formatNumber(data.negatif)})`,
    formatPercentage(data.total > 0 ? data.negatif / data.total : 0),
    theme
  );

  // Evaluasi model dibuat sama seperti grafik batang pada halaman web.
  drawEvaluationBarsCanvas(
    ctx,
    rightX,
    cardY,
    cardW,
    cardH,
    data,
    theme
  );

  // Insight
  const insightY = 628;
  const insightH = 184;

  drawRoundedRect(
    ctx,
    48,
    insightY,
    width - 96,
    insightH,
    8,
    theme.primarySoft,
    null
  );

  ctx.fillStyle = theme.primary;
  ctx.fillRect(48, insightY, 4, insightH);

  ctx.textAlign = 'left';
  setCanvasFont(ctx, 600, 16);
  ctx.fillStyle = theme.primary;
  ctx.fillText('Insight Utama', 76, insightY + 45);

  setCanvasFont(ctx, 400, 12);
  ctx.fillStyle = theme.text;

  wrapCanvasText(
    ctx,
    insight,
    76,
    insightY + 82,
    width - 152,
    20,
    6
  );

  // Footer
  drawCanvasLine(
    ctx,
    48,
    height - 105,
    width - 48,
    height - 105,
    theme.outline,
    1
  );

  ctx.textAlign = 'left';
  setCanvasFont(ctx, 600, 9);
  ctx.fillStyle = theme.text;
  ctx.fillText(
    'Opinia Sentiment Analysis System',
    48,
    height - 64
  );

  setCanvasFont(ctx, 400, 9);
  ctx.fillStyle = theme.textMuted;
  ctx.fillText(
    'Confidential - Academic Research Use Only',
    48,
    height - 45
  );

  ctx.textAlign = 'right';
  ctx.fillText(
    'Halaman 1 dari 1',
    width - 110,
    height - 55
  );

  ctx.fillText(
    `© ${createdAt.getFullYear()}`,
    width - 48,
    height - 55
  );

  return canvas;
}



function getPdfResearcherName() {
  return (
    window.currentUser?.nama ||
    localStorage.getItem('nama') ||
    document.querySelector('.user-name')?.textContent?.trim() ||
    localStorage.getItem('username') ||
    'Pengguna'
  );
}


function drawUnifiedPdfHeader(ctx, options) {
  const {
    width,
    theme,
    title,
    subtitle,
    date,
    researcher
  } = options;

  // Logo Opinia
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

  ctx.fillStyle = theme.textMuted;
  setCanvasFont(ctx, 500, 8);
  ctx.fillText(
    'ACADEMIC SENTIMENT ANALYSIS',
    98,
    69
  );

  // Gunakan formatTanggalIndo agar menyertakan nama hari
  const dateText = formatTanggalIndo(date);

  const timeText = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  });

  ctx.textAlign = 'right';
  ctx.fillStyle = theme.textMuted;
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

  drawCanvasLine(
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

  ctx.fillStyle = theme.textMuted;
  setCanvasFont(ctx, 400, 11);
  wrapCanvasText(
    ctx,
    subtitle,
    width / 2,
    158,
    width - 170,
    18,
    3
  );
}

function setCanvasFont(ctx, weight, size, italic = false) {
  ctx.font =
    `${italic ? 'italic ' : ''}${weight} ${size}px Poppins, Arial, sans-serif`;
}


function drawDonutCanvas(
  ctx,
  centerX,
  centerY,
  radius,
  lineWidth,
  data,
  theme
) {
  const positiveFraction =
    data.total > 0 ? data.positif / data.total : 0;

  const negativeFraction =
    data.total > 0 ? data.negatif / data.total : 0;

  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'butt';

  ctx.strokeStyle = theme.track;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  const startAngle = -Math.PI / 2;

  ctx.strokeStyle = theme.positive;
  ctx.beginPath();
  ctx.arc(
    centerX,
    centerY,
    radius,
    startAngle,
    startAngle + (Math.PI * 2 * positiveFraction)
  );
  ctx.stroke();

  ctx.strokeStyle = theme.negative;
  ctx.beginPath();
  ctx.arc(
    centerX,
    centerY,
    radius,
    startAngle + (Math.PI * 2 * positiveFraction),
    startAngle + (
      Math.PI * 2 *
      (positiveFraction + negativeFraction)
    )
  );
  ctx.stroke();

  ctx.textAlign = 'center';
  setCanvasFont(ctx, 600, 28);
  ctx.fillStyle = theme.text;
  ctx.fillText(
    formatNumber(data.total),
    centerX,
    centerY + 4
  );

  setCanvasFont(ctx, 400, 10);
  ctx.fillStyle = theme.textMuted;
  ctx.fillText(
    'Total Data',
    centerX,
    centerY + 27
  );
}


function drawLegendCanvas(
  ctx,
  x,
  y,
  width,
  color,
  label,
  value,
  theme
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + 6, y - 4, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'left';
  setCanvasFont(ctx, 400, 12);
  ctx.fillStyle = theme.text;
  ctx.fillText(label, x + 20, y);

  ctx.textAlign = 'right';
  setCanvasFont(ctx, 600, 12);
  ctx.fillText(value, x + width, y);
}


function drawEvaluationBarsCanvas(
  ctx,
  cardX,
  cardY,
  cardWidth,
  cardHeight,
  data,
  theme
) {
  const metrics = [
    {
      label: 'Akurasi',
      value: clamp(data.akurasi, 0, 1),
      color: '#3498db',
    },
    {
      label: 'Presisi',
      value: clamp(data.precision, 0, 1),
      color: '#2ecc71',
    },
    {
      label: 'Recall',
      value: clamp(data.recall, 0, 1),
      color: '#f39c12',
    },
    {
      label: 'F1-Score',
      value: clamp(data.f1_score, 0, 1),
      color: '#9b59b6',
    },
  ];

  const plotLeft = cardX + 36;
  const plotRight = cardX + cardWidth - 24;
  const plotTop = cardY + 78;
  const plotBottom = cardY + 254;
  const plotHeight = plotBottom - plotTop;

  // Garis sumbu seperti grafik pada halaman web.
  drawCanvasLine(
    ctx,
    plotLeft,
    plotBottom,
    plotRight,
    plotBottom,
    '#d9d9d9',
    1
  );

  drawCanvasLine(
    ctx,
    plotLeft,
    plotTop,
    plotLeft,
    plotBottom,
    '#d9d9d9',
    1
  );

  const barWidth = 36;
  const usableWidth = plotRight - plotLeft;
  const spacing = (usableWidth - (barWidth * metrics.length)) /
    (metrics.length + 1);

  metrics.forEach((metric, index) => {
    const x =
      plotLeft +
      spacing +
      index * (barWidth + spacing);

    const barHeight = metric.value * (plotHeight - 20);
    const y = plotBottom - barHeight;

    // Nilai persen di atas batang.
    ctx.textAlign = 'center';
    setCanvasFont(ctx, 700, 12);
    ctx.fillStyle = metric.color;
    ctx.fillText(
      formatPercentage(metric.value),
      x + barWidth / 2,
      y - 9
    );

    // Batang berwarna, sama seperti halaman Visualisasi.
    drawRoundedRect(
      ctx,
      x,
      y,
      barWidth,
      barHeight,
      4,
      metric.color,
      null
    );

    // Nama metrik di bawah batang.
    setCanvasFont(ctx, 400, 11);
    ctx.fillStyle = theme.textMuted;
    ctx.fillText(
      metric.label,
      x + barWidth / 2,
      plotBottom + 24
    );
  });

  setCanvasFont(ctx, 400, 9, true);
  ctx.fillStyle = theme.textMuted;
  ctx.textAlign = 'center';
  ctx.fillText(
    'Model: Random Forest Classifier',
    cardX + cardWidth / 2,
    cardY + cardHeight - 18
  );
}


function drawMetricCanvas(
  ctx,
  x,
  y,
  width,
  label,
  value,
  theme
) {
  const safeValue = clamp(value, 0, 1);

  ctx.textAlign = 'left';
  setCanvasFont(ctx, 400, 10);
  ctx.fillStyle = theme.textMuted;
  ctx.fillText(label, x, y);

  ctx.textAlign = 'right';
  setCanvasFont(ctx, 600, 10);
  ctx.fillStyle = theme.text;
  ctx.fillText(
    formatPercentage(safeValue),
    x + width,
    y
  );

  drawRoundedRect(
    ctx,
    x,
    y + 13,
    width,
    8,
    4,
    theme.track,
    null
  );

  drawRoundedRect(
    ctx,
    x,
    y + 13,
    width * safeValue,
    8,
    4,
    theme.primary,
    null
  );
}


function drawRoundedRect(
  ctx,
  x,
  y,
  width,
  height,
  radius,
  fillColor,
  strokeColor
) {
  const safeRadius = Math.min(
    radius,
    width / 2,
    height / 2
  );

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(
    x + width,
    y,
    x + width,
    y + safeRadius
  );
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height
  );
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(
    x,
    y + height,
    x,
    y + height - safeRadius
  );
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(
    x,
    y,
    x + safeRadius,
    y
  );
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


function drawCanvasLine(
  ctx,
  x1,
  y1,
  x2,
  y2,
  color,
  width
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}


function wrapCanvasText(
  ctx,
  text,
  x,
  y,
  maxWidth,
  lineHeight,
  maxLines
) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine
      ? `${currentLine} ${word}`
      : word;

    if (
      ctx.measureText(testLine).width <= maxWidth ||
      !currentLine
    ) {
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
    let lastLine =
      visibleLines[visibleLines.length - 1];

    while (
      ctx.measureText(`${lastLine}...`).width > maxWidth &&
      lastLine.length > 0
    ) {
      lastLine = lastLine.slice(0, -1);
    }

    visibleLines[visibleLines.length - 1] =
      `${lastLine.trim()}...`;
  }

  visibleLines.forEach((line, index) => {
    ctx.fillText(
      line,
      x,
      y + (index * lineHeight)
    );
  });

  return y + (visibleLines.length * lineHeight);
}


// ============================================================
// HELPER UMUM
// ============================================================

function formatNumber(value) {
  return new Intl.NumberFormat('id-ID').format(
    Number(value) || 0
  );
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
  return Math.min(
    maximum,
    Math.max(minimum, Number(value) || 0)
  );
}


function kirimNotifikasi(title, message, type = 'success') {
  if (typeof window.addAppNotification === 'function') {
    window.addAppNotification(title, message, type);
  }
}


function renderVisualisasiError() {
  const pieCenter = document.querySelector('.pie-center');
  const legend = document.querySelector('.pie-legend');
  const insight = document.querySelector('.insight-card p');

  if (pieCenter) {
    pieCenter.innerHTML = '0<br><small>Total Data</small>';
  }

  if (legend) {
    legend.innerHTML = `
      <div class="legend-item">
        Data visualisasi gagal dimuat.
      </div>
    `;
  }

  if (insight) {
    insight.textContent =
      'Data visualisasi tidak dapat dimuat. Pastikan Apache dan database sedang berjalan.';
  }
}
