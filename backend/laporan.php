<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/../koneksi.php';
    require_once __DIR__ . '/session_auth.php';

    $user = require_auth_user();
    $username = $user['username'];
    $userId = (int)$user['id'];

    // Gabungkan 2 sumber data: hasil klasifikasi dataset (hasil_klasifikasi)
    // dan hasil prediksi manual (prediksi_manual), supaya laporan mencakup
    // SELURUH riwayat, bukan cuma yang berasal dari upload dataset.
    $distStmt = mysqli_prepare(
        $conn,
        "SELECT
            COUNT(*) AS total,
            SUM(
                CASE
                    WHEN LOWER(label) LIKE '%positif%'
                      OR LOWER(label) LIKE '%positive%'
                    THEN 1 ELSE 0
                END
            ) AS positif,
            SUM(
                CASE
                    WHEN LOWER(label) LIKE '%negatif%'
                      OR LOWER(label) LIKE '%negative%'
                    THEN 1 ELSE 0
                END
            ) AS negatif
         FROM (
            SELECT h.prediksi AS label
            FROM hasil_klasifikasi h
            INNER JOIN dataset d ON d.id = h.dataset_id
            WHERE d.username = ?

            UNION ALL

            SELECT sentimen AS label
            FROM prediksi_manual
            WHERE username = ?
         ) gabungan"
    );

    mysqli_stmt_bind_param($distStmt, 'ss', $username, $username);
    mysqli_stmt_execute($distStmt);

    $distResult = mysqli_stmt_get_result($distStmt);
    $dist = $distResult
        ? mysqli_fetch_assoc($distResult)
        : [];

    mysqli_stmt_close($distStmt);

    $total = (int)($dist['total'] ?? 0);
    $positif = (int)($dist['positif'] ?? 0);
    $negatif = (int)($dist['negatif'] ?? 0);

    // Hitung juga jumlah prediksi manual saja, dipakai untuk keterangan
    // tambahan di "Cakupan Dataset" (biar transparan asal datanya dari mana).
    $manualCountStmt = mysqli_prepare(
        $conn,
        'SELECT COUNT(*) AS total_manual FROM prediksi_manual WHERE username = ?'
    );
    mysqli_stmt_bind_param($manualCountStmt, 's', $username);
    mysqli_stmt_execute($manualCountStmt);
    $manualCountResult = mysqli_stmt_get_result($manualCountStmt);
    $manualCountRow = $manualCountResult ? mysqli_fetch_assoc($manualCountResult) : [];
    $totalPrediksiManual = (int)($manualCountRow['total_manual'] ?? 0);
    mysqli_stmt_close($manualCountStmt);

    // Confidence rata-rata: BEDA dengan akurasi model.
    // Akurasi model (di bawah, dari tabel model_metrics) itu angka statis
    // hasil evaluasi training/testing sekali di awal.
    // Confidence ini rata-rata seberapa yakin model terhadap SETIAP teks
    // yang sudah pernah diklasifikasikan (dari kolom hasil_klasifikasi.confidence).
    // Catatan: prediksi_manual belum punya kolom confidence, jadi baru
    // menghitung dari hasil upload dataset saja.
    $confStmt = mysqli_prepare(
        $conn,
        'SELECT AVG(h.confidence) AS confidence_rata2
         FROM hasil_klasifikasi h
         INNER JOIN dataset d ON d.id = h.dataset_id
         WHERE d.username = ? AND h.confidence IS NOT NULL'
    );
    mysqli_stmt_bind_param($confStmt, 's', $username);
    mysqli_stmt_execute($confStmt);
    $confResult = mysqli_stmt_get_result($confStmt);
    $confRow = $confResult ? mysqli_fetch_assoc($confResult) : [];
    $confidenceRataRata = $confRow && $confRow['confidence_rata2'] !== null
        ? (float)$confRow['confidence_rata2']
        : null;
    mysqli_stmt_close($confStmt);

    $akurasi = 0;
    $precision = 0;
    $recall = 0;
    $f1 = 0;

    $metricResult = @mysqli_query(
        $conn,
        'SELECT
            akurasi,
            precision_score,
            recall_score,
            f1_score
         FROM model_metrics
         ORDER BY updated_at DESC
         LIMIT 1'
    );

    if ($metricResult && ($metric = mysqli_fetch_assoc($metricResult))) {
        $akurasi = (float)($metric['akurasi'] ?? 0);
        $precision = (float)($metric['precision_score'] ?? 0);
        $recall = (float)($metric['recall_score'] ?? 0);
        $f1 = (float)($metric['f1_score'] ?? 0);
    }

    $hasNamaFile = false;

    $columnResult = mysqli_query(
        $conn,
        "SHOW COLUMNS
         FROM riwayat_analisis
         LIKE 'nama_file'"
    );

    if ($columnResult && mysqli_num_rows($columnResult) > 0) {
        $hasNamaFile = true;
    }

    $summaryStmt = mysqli_prepare(
        $conn,
        'SELECT
            COUNT(*) AS total_dataset,
            MAX(tanggal) AS tanggal_analisis
         FROM riwayat_analisis
         WHERE user_id = ?'
    );

    mysqli_stmt_bind_param($summaryStmt, 'i', $userId);
    mysqli_stmt_execute($summaryStmt);

    $summaryResult = mysqli_stmt_get_result($summaryStmt);
    $summary = $summaryResult
        ? mysqli_fetch_assoc($summaryResult)
        : [];

    mysqli_stmt_close($summaryStmt);

    $totalDataset = (int)($summary['total_dataset'] ?? 0);
    $tanggalAnalisis = $summary['tanggal_analisis'] ?? null;
    $namaDatasetTerbaru = null;

    if ($hasNamaFile) {
        $latestStmt = mysqli_prepare(
            $conn,
            'SELECT nama_file
             FROM riwayat_analisis
             WHERE user_id = ?
             ORDER BY tanggal DESC, id DESC
             LIMIT 1'
        );

        mysqli_stmt_bind_param($latestStmt, 'i', $userId);
        mysqli_stmt_execute($latestStmt);

        $latestResult = mysqli_stmt_get_result($latestStmt);
        $latest = $latestResult
            ? mysqli_fetch_assoc($latestResult)
            : null;

        if ($latest) {
            $namaDatasetTerbaru = $latest['nama_file'] ?? null;
        }

        mysqli_stmt_close($latestStmt);
    }

    echo json_encode([
        'total' => $total,
        'positif' => $positif,
        'negatif' => $negatif,
        'akurasi' => $akurasi,
        'precision' => $precision,
        'recall' => $recall,
        'f1_score' => $f1,
        'confidence_rata2' => $confidenceRataRata,
        'total_prediksi_manual' => $totalPrediksiManual,
        'nama_dataset' => $namaDatasetTerbaru,
        'total_dataset' => $totalDataset,
        'tanggal_analisis' => $tanggalAnalisis,
        'user' => $user,
    ]);

    mysqli_close($conn);

} catch (Throwable $error) {
    http_response_code(500);

    echo json_encode([
        'error' => true,
        'message' => $error->getMessage(),
    ]);
}
