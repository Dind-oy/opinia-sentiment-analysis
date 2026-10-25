# Tugas Akhir: Sistem Analisis Sentimen

Repository ini berisi kode sumber untuk proyek Tugas Akhir Analisis Sentimen. Aplikasi ini dibangun menggunakan arsitektur _hybrid_ yang memisahkan antara pengelolaan web (PHP) dan pemrosesan model _Machine Learning_ (Python).

---

# Aturan Penulisan Kode

- Gunakan bahasa Indonesia untuk semua komentar.
- Terapkan camelCase untuk penamaan variabel.
- Gunakan tanda kutip tunggal (' ') untuk string.
- Selalu gunakan titik koma (;) di akhir setiap pernyataan.
- Gunakan spasi dua (2) untuk indentasi.

---

## 📌 Ketentuan & Arsitektur Sistem

1. **Front-End (HTML, CSS, JS):** \* Antarmuka pengguna harus dibangun secara presisi menggunakan HTML asli, CSS, dan JavaScript vanilla/modern.
   - Desain, tata letak (_layout_), dan komponen _user interface_ wajib mengikuti aset gambar referensi yang telah disediakan di dalam direktori `ui/`.
   - JavaScript digunakan untuk menangani interaksi dinamis, seperti validasi input dan pengiriman data secara _asynchronous_ (AJAX/Fetch API).

2. **Backend Utama (PHP):**
   - Bertanggung jawab penuh atas logika aplikasi web, manajemen sesi, dan penjembatan (_bridge_) antara halaman depan dan model prediksi.

3. **Machine Learning Service (Python):**
   - Python digunakan secara khusus dan terbatas hanya untuk memuat (_load_) file model `.pkl` (Pickle) dan melakukan inferensi/prediksi sentimen berdasarkan teks yang dikirim oleh PHP.

---

## 📂 Struktur Direktori

```text
├── css/                 # File styling (.css)
├── js/                  # File interaktivitas client-side (.js)
├── ui/                  # Panduan/Aset gambar visual untuk Front-End
├── backend/             # Logika pemrosesan server-side (PHP)
│   └── proses.php       # Script PHP untuk menerima input UI & komunikasi ke Python
├── python/              # Environment pemrosesan model ML
│   ├── model/           # Tempat menyimpan file model .pkl
│   │   └── model.pkl    # File binary model analisis sentimen
│   └── app.py           # Micro-service Python (FastAPI) untuk load model
├── index.html           # Halaman utama aplikasi (Front-End)
└── github-instruction.md
```
