from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import os
import csv
import io
import pymysql
import pymysql.cursors
from datetime import datetime

# ============================================================
# KONFIGURASI DATABASE 
# ============================================================
DB_CONFIG = {
    'host': '127.0.0.1',
    'user': 'root',
    'password': '',           # isi password MySQL kamu
    'database': 'db_sentimen_mlbb',
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor,
}

def get_db():
    """Buka koneksi ke MySQL."""
    return pymysql.connect(**DB_CONFIG)

# ============================================================
# INISIALISASI FASTAPI
# ============================================================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# SCHEMA
# ============================================================
class TextRequest(BaseModel):
    text: str

class LoginRequest(BaseModel):
    username: str
    password: str
# ============================================================
# LOAD MODEL & VECTORIZER
# ============================================================
model = None
vectorizer = None

def load_ml_assets():
    global model, vectorizer
    base_dir = os.path.dirname(__file__)
    model_path = os.path.join(base_dir, 'model', 'model.pkl')
    vectorizer_path = os.path.join(base_dir, 'model', 'tfidf_vectorizer.pkl')

    try:
        if os.path.exists(model_path):
            model = joblib.load(model_path)
            print("Jumlah fitur model:", model.n_features_in_)
        else:
            print("Peringatan: model.pkl tidak ditemukan.")

        if os.path.exists(vectorizer_path):
            vectorizer = joblib.load(vectorizer_path)
            print(
                "Jumlah fitur vectorizer:",
                len(vectorizer.get_feature_names_out())
            )
        else:
            print("Peringatan: tfidf_vectorizer.pkl tidak ditemukan.")

    except Exception as e:
        print(f'Error memuat aset ML: {e}')

load_ml_assets()

# ============================================================
# HELPER FUNCTIONS
# ============================================================
def predict_text(text: str):
    """
    Mengembalikan tuple (label, confidence).

    - label       : 'Positif' atau 'Negatif'
    - confidence  : probabilitas model terhadap TEKS INI SAJA (0-1),
                    diambil dari predict_proba(). Ini BEDA dengan
                    'akurasi model' di tabel `model_metrics`, yang
                    merupakan angka statis hasil evaluasi model saat
                    training/testing dulu (tidak berubah per teks).
                    confidence bisa None kalau model tidak mendukung
                    predict_proba.
    """
    if model is None:
        raise ValueError(
            "Model Random Forest gagal dimuat. "
            "Periksa file python/model/model.pkl."
        )

    if vectorizer is None:
        raise ValueError(
            "TF-IDF Vectorizer gagal dimuat. "
            "Periksa file python/model/tfidf_vectorizer.pkl."
        )

    text = text.strip()

    if not text:
        raise ValueError("Teks ulasan tidak boleh kosong.")

    try:
        text_vectorized = vectorizer.transform([text])
        prediction = model.predict(text_vectorized)[0]

        hasil = str(prediction).strip().lower()

        if hasil in ['positif', 'positive', '1']:
            label = 'Positif'
        elif hasil in ['negatif', 'negative', '0']:
            label = 'Negatif'
        else:
            raise ValueError(
                f"Label model tidak dikenali: {prediction}. "
                "Model seharusnya hanya menghasilkan Positif atau Negatif."
            )

        confidence = None
        if hasattr(model, 'predict_proba'):
            proba = model.predict_proba(text_vectorized)[0]
            confidence = float(max(proba))

        return label, confidence

    except ValueError:
        raise

    except Exception as e:
        print(f"Error saat prediksi: {e}")
        raise ValueError(f"Gagal memproses prediksi: {e}")


def detect_text_column(fieldnames):
    candidates = ['text', 'review', 'ulasan', 'komentar', 'content', 'kalimat']
    normalized = {name.lower().strip(): name for name in fieldnames or []}
    for candidate in candidates:
        if candidate in normalized:
            return normalized[candidate]
    return fieldnames[0] if fieldnames else None

def normalize_label(value):
    """Ubah berbagai bentuk label menjadi Positif atau Negatif."""
    value = str(value or '').strip().lower()

    if value in ['positif', 'positive', '1']:
        return 'Positif'

    if value in ['negatif', 'negative', '0']:
        return 'Negatif'

    return ''


def get_original_label(row):
    """
    Ambil label asli dari CSV.

    Prioritas:
    1. Kolom label/sentimen
    2. Kolom score/rating
    """

    normalized_row = {
        str(key).strip().lower(): value
        for key, value in row.items()
    }

    # Coba baca kolom label
    raw_label = (
        normalized_row.get('label')
        or normalized_row.get('sentimen')
        or normalized_row.get('sentiment')
        or ''
    )

    label = normalize_label(raw_label)

    if label:
        return label

    # Kalau tidak ada label, baca rating Google Play
    raw_score = (
        normalized_row.get('score')
        or normalized_row.get('rating')
        or normalized_row.get('bintang')
        or ''
    )

    try:
        score = float(str(raw_score).replace(',', '.'))

        if score >= 4:
            return 'Positif'

        if score <= 2:
            return 'Negatif'

        # Rating 3 tidak dipakai karena penelitian hanya dua kelas
        return ''

    except (ValueError, TypeError):
        return ''

def save_to_database(username: str, rows: list, filename: str = None) -> dict:
    """
    Simpan dataset + hasil klasifikasi ke tabel `dataset` & `hasil_klasifikasi`.
    Kemudian insert ringkasan ke `riwayat_analisis`.

    Struktur tabel (setelah migrasi):
      dataset          : id, username, content, label, created_at, nama_file, upload_group, riwayat_id
      hasil_klasifikasi: id, dataset_id, prediksi, confidence, created_at
      riwayat_analisis : id, user_id, nama_file, total_data, positif, negatif, netral, akurasi, tanggal
      users            : id, nama, username, password, created_at

    PENTING: riwayat_analisis di-insert DULUAN (sebelum baris dataset)
    supaya kita punya riwayat_id untuk dipasang ke setiap baris dataset.
    Dengan begitu, saat 1 baris riwayat_analisis dihapus, semua baris
    dataset (dan hasil_klasifikasi turunannya) ikut terhapus otomatis
    lewat ON DELETE CASCADE.
    """
    conn = get_db()
    saved_ids = []
    positif = negatif = netral = 0
    correct = 0   # jumlah prediksi yang cocok dengan label asli
    labeled = 0   # jumlah baris yang punya label asli (ground truth)
    akurasi = None

    try:
        with conn.cursor() as cur:
            # --- Ambil user_id berdasarkan username ---
            cur.execute("SELECT id FROM users WHERE username = %s", (username,))
            user_row = cur.fetchone()
            user_id = user_row['id'] if user_row else None

            # 1. Hitung dulu ringkasan (positif/negatif/akurasi) dari
            #    seluruh baris SEBELUM insert apa pun ke database.
            for item in rows:
                prediksi_val = item['sentiment']
                label_val = item.get('label', '')

                prediksi_clean = normalize_label(prediksi_val)
                label_clean = normalize_label(label_val)

                if prediksi_clean == 'Positif':
                    positif += 1
                elif prediksi_clean == 'Negatif':
                    negatif += 1

                if label_clean:
                    labeled += 1
                    if label_clean == prediksi_clean:
                        correct += 1

            total = len(rows)
            akurasi = round(correct / labeled, 4) if labeled > 0 else None

            # 2. Insert ringkasan ke `riwayat_analisis` LEBIH DULU,
            #    supaya dapat riwayat_id untuk dipasang ke tabel dataset.
            cur.execute(
                """INSERT INTO riwayat_analisis
                   (user_id, nama_file, total_data, positif, negatif, netral, akurasi, tanggal)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())""",
                (user_id, filename, total, positif, negatif, netral, akurasi)
            )
            riwayat_id = conn.insert_id()

            # 3. Baru insert setiap baris ke `dataset` (+ hasil_klasifikasi),
            #    dengan riwayat_id yang sudah didapat di atas.
            for item in rows:
                content_val  = item['text']           # teks ulasan dari CSV
                prediksi_val = item['sentiment']       # hasil prediksi ML
                label_val    = item.get('label', '')   # label asli dari CSV (opsional)

                # Insert ke tabel `dataset`, termasuk nama_file & riwayat_id
                cur.execute(
                    """INSERT INTO dataset
                       (username, content, label, created_at, nama_file, riwayat_id)
                       VALUES (%s, %s, %s, NOW(), %s, %s)""",
                    (username, content_val, label_val, filename, riwayat_id)
                )
                dataset_id = conn.insert_id()
                saved_ids.append(dataset_id)

                # Insert ke tabel `hasil_klasifikasi`
                confidence_val = item.get('confidence', None)
                cur.execute(
                    """INSERT INTO hasil_klasifikasi (dataset_id, prediksi, confidence, created_at)
                       VALUES (%s, %s, %s, NOW())""",
                    (dataset_id, prediksi_val, confidence_val)
                )

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

    return {
        'saved': len(saved_ids),
        'riwayat_id': riwayat_id,
        'positif': positif,
        'negatif': negatif,
        'akurasi': akurasi,
        'jumlah_data_berlabel': labeled,
    }

# ============================================================
# ENDPOINTS
# ============================================================
@app.get('/health')
async def health_check():
    return {
        'status': 'success' if model is not None and vectorizer is not None else 'error',
        'model_loaded': model is not None,
        'vectorizer_loaded': vectorizer is not None,
    }

@app.post('/predict')
async def predict_sentiment(request: TextRequest):
    if not request.text:
        raise HTTPException(status_code=400, detail="Teks tidak boleh kosong")
    try:
        label, confidence = predict_text(request.text)
        return {"sentiment": label, "confidence": confidence}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/predict-csv')
async def predict_csv(file: UploadFile = File(...)):
    """Prediksi tanpa simpan ke DB (preview saja)."""
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail='File harus berformat CSV')

    try:
        content = await file.read()
        decoded = content.decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(decoded))

        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail='CSV tidak memiliki header')

        text_column = detect_text_column(reader.fieldnames)
        if not text_column:
            raise HTTPException(status_code=400, detail='Kolom teks tidak ditemukan')

        results = []
        for index, row in enumerate(reader, start=1):
            text_value = (row.get(text_column) or '').strip()
            label_value = get_original_label(row)
            if not text_value:
                results.append({'row': index, 'text': '', 'label': label_value, 'sentiment': 'Kosong', 'confidence': None})
                continue
            sentiment_value, confidence_value = predict_text(text_value)
            results.append({
                'row': index,
                'text': text_value,
                'label': label_value,
                'sentiment': sentiment_value,
                'confidence': confidence_value,
            })

        return {
            'filename': file.filename,
            'text_column': text_column,
            'total_rows': len(results),
            'results': results,
        }
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail='Encoding CSV tidak didukung. Gunakan UTF-8.')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/upload-and-save')
async def upload_and_save(
    file: UploadFile = File(...),
    username: str = 'Adinda'     # default, bisa dikirim sebagai form field
):
    """
    Upload CSV → prediksi ML → simpan ke database.
    Endpoint utama yang dipakai upload-dataset.html
    """
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail='File harus berformat CSV')

    try:
        content = await file.read()
        decoded = content.decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(decoded))

        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail='CSV tidak memiliki header')

        text_column = detect_text_column(reader.fieldnames)
        if not text_column:
            raise HTTPException(status_code=400, detail='Kolom teks tidak ditemukan')

        rows = []
        for index, row in enumerate(reader, start=1):
            text_value = (row.get(text_column) or '').strip()
            label_value = get_original_label(row)
            if not text_value:
                continue
            sentiment_value, confidence_value = predict_text(text_value)
            rows.append({
                'row': index,
                'text': text_value,
                'label': label_value,
                'sentiment': sentiment_value,
                'confidence': confidence_value,
            })

        # Simpan ke database (termasuk nama file untuk riwayat)
        db_result = save_to_database(username, rows, filename=file.filename)

        return {
            'status': 'success',
            'filename': file.filename,
            'total_rows': len(rows),
            **db_result,
            'preview': rows[:10],   # kirim 10 baris pertama sebagai preview
        }

    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail='Encoding CSV tidak didukung. Gunakan UTF-8.')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/hasil-klasifikasi')
async def get_hasil_klasifikasi(limit: int = 50, offset: int = 0):
    """
    Ambil data hasil klasifikasi dari DB untuk ditampilkan di klasifikasi.html
    """
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT d.id, d.content, d.label, h.prediksi, h.confidence, h.created_at
                   FROM dataset d
                   JOIN hasil_klasifikasi h ON h.dataset_id = d.id
                   ORDER BY h.created_at DESC
                   LIMIT %s OFFSET %s""",
                (limit, offset)
            )
            rows = cur.fetchall()

            cur.execute("SELECT COUNT(*) as total FROM hasil_klasifikasi")
            total = cur.fetchone()['total']

        return {'total': total, 'data': rows}
    finally:
        conn.close()

@app.post('/login')
async def login(request: LoginRequest):
    if not request.username or not request.password:
        raise HTTPException(status_code=400, detail="Username dan password harus diisi")
    
    conn = get_db()
    try:
        with conn.cursor() as cur:
            query = "SELECT id, nama, username FROM users WHERE username = %s AND password = %s"
            cur.execute(query, (request.username, request.password))
            user = cur.fetchone()
            
            if not user:
                raise HTTPException(status_code=401, detail="Username atau password salah")
            
            return {
                "status": "success",
                "message": "Login berhasil",
                "user": {
                    "id": user['id'],
                    "nama": user['nama'],
                    "username": user['username']
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        conn.close()

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8000)