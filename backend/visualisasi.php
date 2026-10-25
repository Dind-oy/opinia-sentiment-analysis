<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../koneksi.php';
require_once __DIR__ . '/session_auth.php';

$user = require_auth_user();
$username = $user['username'];
$userId = (int)$user['id'];

// Gabungkan hasil klasifikasi dataset (hasil_klasifikasi) dan hasil
// prediksi manual (prediksi_manual), supaya donut chart Visualisasi
// konsisten dengan total data di halaman Laporan.
$stmt = mysqli_prepare(
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

mysqli_stmt_bind_param($stmt, 'ss', $username, $username);
mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);
$dist = $result ? mysqli_fetch_assoc($result) : [];

mysqli_stmt_close($stmt);

$total = (int)($dist['total'] ?? 0);
$positif = (int)($dist['positif'] ?? 0);
$negatif = (int)($dist['negatif'] ?? 0);

$akurasi = 0;
$precision = 0;
$recall = 0;
$f1 = 0;

$resultMetric = @mysqli_query(
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

if ($resultMetric && ($metric = mysqli_fetch_assoc($resultMetric))) {
    $akurasi = (float)($metric['akurasi'] ?? 0);
    $precision = (float)($metric['precision_score'] ?? 0);
    $recall = (float)($metric['recall_score'] ?? 0);
    $f1 = (float)($metric['f1_score'] ?? 0);
} else {
    $fallbackStmt = mysqli_prepare(
        $conn,
        'SELECT akurasi
         FROM riwayat_analisis
         WHERE user_id = ?
           AND akurasi IS NOT NULL
         ORDER BY tanggal DESC
         LIMIT 1'
    );

    mysqli_stmt_bind_param($fallbackStmt, 'i', $userId);
    mysqli_stmt_execute($fallbackStmt);

    $fallbackResult = mysqli_stmt_get_result($fallbackStmt);
    $fallback = $fallbackResult
        ? mysqli_fetch_assoc($fallbackResult)
        : null;

    if ($fallback) {
        $akurasi = (float)$fallback['akurasi'];
    }

    mysqli_stmt_close($fallbackStmt);
}

echo json_encode([
    'total' => $total,
    'positif' => $positif,
    'negatif' => $negatif,
    'netral' => 0,
    'akurasi' => $akurasi,
    'precision' => $precision,
    'recall' => $recall,
    'f1_score' => $f1,
]);

mysqli_close($conn);
