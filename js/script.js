// Mendapatkan elemen formulir dan hasil
const sentimentForm = document.getElementById('sentimentForm');
const inputText = document.getElementById('inputText');
const resultDiv = document.getElementById('result');

// Menambahkan event listener untuk pengiriman formulir
sentimentForm.addEventListener('submit', async function(event) {
  event.preventDefault();

  const textValue = inputText.value;
  resultDiv.innerHTML = 'Memproses...';

  try {
    // Mengirim data ke backend menggunakan Fetch API
    const response = await fetch('backend/proses.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'teks': textValue
      })
    });

    const data = await response.json();

    if (data.status === 'success') {
      resultDiv.innerHTML = 'Hasil Sentimen: ' + data.sentimen;
    } else {
      resultDiv.innerHTML = 'Terjadi kesalahan: ' + data.pesan;
    }
  } catch (error) {
    console.error('Error:', error);
    resultDiv.innerHTML = 'Gagal menghubungi server.';
  }
});