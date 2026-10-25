// ============================================================
// dashboard.js
// Statistik milik akun yang sedang login.
// ============================================================

async function loadDashboard() {
  try {
    if (window.authReady) {
      await window.authReady;
    }

    const response = await fetch(
      'backend/dashboard.php',
      {
        cache: 'no-store',
        credentials: 'same-origin'
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(
        data.message ||
        'Dashboard gagal dimuat.'
      );
    }

    const total = Number(data.total || 0);
    const positif = Number(data.positif || 0);
    const negatif = Number(data.negatif || 0);
    const pctPositif = Number(data.pct_positif || 0);
    const pctNegatif = Number(data.pct_negatif || 0);
    const trend = Number(data.trend_dataset || 0);

    const cards = document.querySelectorAll('.stat-card');

    // Card 0: Total Dataset
    cards[0]
      ?.querySelector('.stat-value')
      ?.replaceChildren(
        document.createTextNode(
          total.toLocaleString('id-ID')
        )
      );

    const trendEl = cards[0]?.querySelector('.stat-change');
    if (trendEl) {
      if (trend > 0) {
        trendEl.className = 'stat-change positive';
        trendEl.innerHTML =
          '<i class="bi bi-graph-up-arrow"></i> +' + trend + '% this week';
      } else if (trend < 0) {
        trendEl.className = 'stat-change negative';
        trendEl.innerHTML =
          '<i class="bi bi-graph-down-arrow"></i> ' + trend + '% this week';
      } else {
        trendEl.className = 'stat-change';
        trendEl.innerHTML =
          '<i class="bi bi-dash"></i> 0% this week';
      }
    }

    // Card 1: Sentimen Positif
    cards[1]
      ?.querySelector('.stat-value')
      ?.replaceChildren(
        document.createTextNode(
          positif.toLocaleString('id-ID')
        )
      );

    cards[1]
      ?.querySelector('.stat-badge')
      ?.replaceChildren(
        document.createTextNode(
          `${pctPositif}% of total`
        )
      );

    // Card 2: Sentimen Negatif
    cards[2]
      ?.querySelector('.stat-value')
      ?.replaceChildren(
        document.createTextNode(
          negatif.toLocaleString('id-ID')
        )
      );

    cards[2]
      ?.querySelector('.stat-badge')
      ?.replaceChildren(
        document.createTextNode(
          `${pctNegatif}% of total`
        )
      );

    // Card 3: Akurasi Model
    const accuracyValue = normalizeMetric(data.akurasi_model);

    if (cards[3] && accuracyValue !== null) {
      cards[3]
        .querySelector('.stat-value')
        .textContent = `${(accuracyValue * 100).toFixed(1)}%`;

      const progress = cards[3].querySelector('.progress-bar');
      if (progress) {
        progress.style.width = `${Math.min(100, accuracyValue * 100)}%`;
      }
    }

    renderChart(positif, negatif, total);

  } catch (error) {
    console.error('Gagal load dashboard:', error);
  }
}


function normalizeMetric(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number > 1
    ? number / 100
    : number;
}


function renderChart(positif, negatif, total) {
  const container = document.querySelector('.chart-container');

  if (!container) {
    return;
  }

  const viewWidth = 500;
  const viewHeight = 320;
  const topPadding = 40;
  const bottomPadding = 40;
  const barWidth = 100;
  const maximum = Math.max(positif, negatif, 1);

  const maximumBarHeight = viewHeight - topPadding - bottomPadding;
  const baseY = viewHeight - bottomPadding;

  const positiveHeight = Math.round((positif / maximum) * maximumBarHeight);
  const negativeHeight = Math.round((negatif / maximum) * maximumBarHeight);

  const positiveX = 120;
  const negativeX = 290;

  const positivePercentage = total > 0
    ? Math.round((positif / total) * 100)
    : 0;

  const negativePercentage = total > 0
    ? Math.round((negatif / total) * 100)
    : 0;

  container.innerHTML = `
    <svg
      viewBox="0 0 ${viewWidth} ${viewHeight}"
      xmlns="http://www.w3.org/2000/svg"
      style="width:100%;max-width:500px;display:block;margin:0 auto;"
    >
      <line x1="60" y1="${topPadding}" x2="60" y2="${baseY}" stroke="#e0e0e0" />
      <line x1="60" y1="${baseY}" x2="${viewWidth - 20}" y2="${baseY}" stroke="#e0e0e0" />

      <rect
        x="${positiveX}" y="${baseY - positiveHeight}"
        width="${barWidth}" height="${positiveHeight}"
        fill="#4caf50" opacity="0.85" rx="5"
      />
      <text
        x="${positiveX + barWidth / 2}" y="${baseY - positiveHeight - 10}"
        text-anchor="middle" font-size="14" fill="#388e3c" font-weight="700"
      >
        ${positif.toLocaleString('id-ID')}
      </text>
      <text
        x="${positiveX + barWidth / 2}" y="${baseY + 26}"
        text-anchor="middle" font-size="13" fill="#555"
      >
        Positif (${positivePercentage}%)
      </text>

      <rect
        x="${negativeX}" y="${baseY - negativeHeight}"
        width="${barWidth}" height="${negativeHeight}"
        fill="#f44336" opacity="0.85" rx="5"
      />
      <text
        x="${negativeX + barWidth / 2}" y="${baseY - negativeHeight - 10}"
        text-anchor="middle" font-size="14" fill="#c62828" font-weight="700"
      >
        ${negatif.toLocaleString('id-ID')}
      </text>
      <text
        x="${negativeX + barWidth / 2}" y="${baseY + 26}"
        text-anchor="middle" font-size="13" fill="#555"
      >
        Negatif (${negativePercentage}%)
      </text>
    </svg>
  `;
}


document.addEventListener('DOMContentLoaded', loadDashboard);
