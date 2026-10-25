// ============================================================
// prediksi-manual.js
// Satu komentar → FastAPI → Simpan riwayat manual ke MySQL
// ============================================================

const MANUAL_API_BASE = 'http://127.0.0.1:8000';
const MANUAL_SAVE_URL = 'backend/prediksi_manual.php';

document.addEventListener('DOMContentLoaded', async () => {
  if (window.authReady) {
    await window.authReady;
  }
  const nama =
    window.currentUser?.nama ||
    localStorage.getItem('nama') ||
    'Pengguna';

  const sidebarName = document.getElementById('sidebarUserName');

  if (sidebarName) {
    sidebarName.textContent = nama;
  }

  setupManualPrediction();
});


function setupManualPrediction() {
  const textarea = document.getElementById('manualText');
  const counter = document.getElementById('characterCounter');
  const predictButton = document.getElementById('predictManualBtn');
  const clearButton = document.getElementById('clearManualBtn');
  const anotherButton = document.getElementById('predictAnotherBtn');

  if (
    !textarea ||
    !counter ||
    !predictButton ||
    !clearButton
  ) {
    return;
  }

  updateCounter();

  textarea.addEventListener('input', updateCounter);

  predictButton.addEventListener('click', () => {
    processManualPrediction();
  });

  clearButton.addEventListener('click', () => {
    resetManualForm();
  });

  anotherButton?.addEventListener('click', () => {
    resetManualForm();
    textarea.focus();
  });

  textarea.addEventListener('keydown', event => {
    if (
      event.ctrlKey &&
      event.key === 'Enter'
    ) {
      processManualPrediction();
    }
  });

  function updateCounter() {
    counter.textContent = `${textarea.value.length} / 500`;
  }
}


async function processManualPrediction() {
  const textarea = document.getElementById('manualText');
  const button = document.getElementById('predictManualBtn');
  const text = textarea.value.trim();

  hideManualMessage();

  if (!text) {
    showManualMessage(
      'error',
      'Komentar tidak boleh kosong.'
    );

    textarea.focus();
    return;
  }

  if (text.length > 500) {
    showManualMessage(
      'error',
      'Komentar maksimal 500 karakter.'
    );

    return;
  }

  const originalButtonText = button.innerHTML;

  try {
    setManualLoading(true);

    const response = await fetch(
      `${MANUAL_API_BASE}/predict`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text
        })
      }
    );

    const contentType =
      response.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      throw new Error(
        'FastAPI tidak memberikan respons JSON.'
      );
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.detail ||
        'Prediksi tidak berhasil diproses.'
      );
    }

    const sentiment = normalizeSentiment(
      result.sentiment
    );

    if (!sentiment) {
      throw new Error(
        `Label model tidak dikenali: ${result.sentiment}`
      );
    }

    const displayedAt = new Date();

    renderManualResult({
      text,
      sentiment,
      displayedAt,
      saveStatus: 'Menyimpan riwayat...'
    });

    let saved = false;

    try {
      await saveManualHistory({
        text,
        sentiment
      });

      saved = true;

      setManualSaveStatus(
        'Tersimpan di Riwayat Analisis'
      );

    } catch (saveError) {
      console.error(
        'Prediksi berhasil, tetapi riwayat gagal disimpan:',
        saveError
      );

      setManualSaveStatus(
        'Prediksi berhasil, riwayat gagal disimpan'
      );

      kirimNotifikasiManual(
        'Riwayat manual gagal disimpan',
        saveError.message,
        'error'
      );
    }

    kirimNotifikasiManual(
      'Prediksi manual selesai',
      `Komentar diprediksi sebagai ${sentiment}.` +
      (saved ? ' Hasil tersimpan di Riwayat Analisis.' : ''),
      'success'
    );

  } catch (error) {
    console.error(
      'Prediksi manual gagal:',
      error
    );

    showManualMessage(
      'error',
      `Prediksi gagal: ${error.message}`
    );

    kirimNotifikasiManual(
      'Prediksi manual gagal',
      error.message ||
      'Komentar tidak berhasil diproses.',
      'error'
    );

  } finally {
    setManualLoading(false);
    button.innerHTML = originalButtonText;
  }
}


async function saveManualHistory({
  text,
  sentiment
}) {
  const body = new URLSearchParams({
    username:
      localStorage.getItem('username') ||
      localStorage.getItem('nama') ||
      'Adinda',
    teks: text,
    sentimen: sentiment
  });

  const response = await fetch(
    MANUAL_SAVE_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body
    }
  );

  const contentType =
    response.headers.get('content-type') || '';

  const rawText = await response.text();

  if (!contentType.includes('application/json')) {
    console.error(
      'Respons simpan riwayat bukan JSON:',
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
      'Riwayat manual tidak berhasil disimpan.'
    );
  }

  return data;
}


function normalizeSentiment(value) {
  const normalized =
    String(value ?? '').trim().toLowerCase();

  if (
    normalized === 'positif' ||
    normalized === 'positive' ||
    normalized === '1'
  ) {
    return 'Positif';
  }

  if (
    normalized === 'negatif' ||
    normalized === 'negative' ||
    normalized === '0'
  ) {
    return 'Negatif';
  }

  return '';
}


function renderManualResult({
  text,
  sentiment,
  displayedAt,
  saveStatus
}) {
  const emptyState =
    document.getElementById('manualEmptyState');

  const resultContent =
    document.getElementById('manualResultContent');

  const badge =
    document.getElementById('manualSentimentBadge');

  const resultText =
    document.getElementById('manualResultText');

  const resultTime =
    document.getElementById('manualResultTime');

  emptyState.hidden = true;
  emptyState.setAttribute('hidden', '');

  resultContent.hidden = false;
  resultContent.removeAttribute('hidden');

  badge.textContent = sentiment;
  badge.classList.toggle(
    'negative',
    sentiment === 'Negatif'
  );

  resultText.textContent = text;

  resultTime.textContent =
    displayedAt.toLocaleString(
      'id-ID',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    );

  setManualSaveStatus(saveStatus);
}


function setManualSaveStatus(value) {
  const element =
    document.getElementById('manualSaveStatus');

  if (element) {
    element.textContent = value;
  }
}


function resetManualForm() {
  const textarea =
    document.getElementById('manualText');

  const counter =
    document.getElementById('characterCounter');

  const emptyState =
    document.getElementById('manualEmptyState');

  const resultContent =
    document.getElementById('manualResultContent');

  textarea.value = '';
  counter.textContent = '0 / 500';

  emptyState.hidden = false;
  emptyState.removeAttribute('hidden');

  resultContent.hidden = true;
  resultContent.setAttribute('hidden', '');

  hideManualMessage();
}


function setManualLoading(state) {
  const predictButton =
    document.getElementById('predictManualBtn');

  const clearButton =
    document.getElementById('clearManualBtn');

  const textarea =
    document.getElementById('manualText');

  predictButton.disabled = state;
  clearButton.disabled = state;
  textarea.disabled = state;

  predictButton.innerHTML = state
    ? '⏳ Memproses...'
    : '🧠 Prediksi Sentimen';
}


function showManualMessage(type, message) {
  const element =
    document.getElementById('manualFormMessage');

  element.className =
    `manual-message ${type}`;

  element.textContent = message;
  element.hidden = false;
}


function hideManualMessage() {
  const element =
    document.getElementById('manualFormMessage');

  element.hidden = true;
  element.textContent = '';
}


function kirimNotifikasiManual(
  title,
  message,
  type = 'success'
) {
  if (
    typeof window.addAppNotification === 'function'
  ) {
    window.addAppNotification(
      title,
      message,
      type
    );
  }
}
