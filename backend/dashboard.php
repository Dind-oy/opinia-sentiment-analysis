<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../koneksi.php';
require_once __DIR__ . '/session_auth.php';

$user = require_auth_user();
$username = $user['username'];

$sql = "
    SELECT
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
    ) gabungan
";

$stmt = mysqli_prepare($conn, $sql);

if (!$stmt) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => mysqli_error($conn),
    ]);
    exit;
}

mysqli_stmt_bind_param($stmt, 'ss', $username, $username);
mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);
$data = $result ? mysqli_fetch_assoc($result) : [];

mysqli_stmt_close($stmt);

$total = (int)($data['total'] ?? 0);
$positif = (int)($data['positif'] ?? 0);
$negatif = (int)($data['negatif'] ?? 0);

$pctPositif = $total > 0
    ? round(($positif / $total) * 100, 1)
    : 0;

$pctNegatif = $total > 0
    ? round(($negatif / $total) * 100, 1)
    : 0;

// Hitung trend dataset minggu ini vs minggu lalu
$sqlTrend = "
    SELECT
        SUM(CASE WHEN d.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS minggu_ini,
        SUM(CASE WHEN d.created_at BETWEEN DATE_SUB(NOW(), INTERVAL 14 DAY) AND DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS minggu_lalu
    FROM dataset d
    WHERE d.username = ?
";

$stmtTrend = mysqli_prepare($conn, $sqlTrend);
$trendPersen = 0;

if ($stmtTrend) {
    mysqli_stmt_bind_param($stmtTrend, 's', $username);
    mysqli_stmt_execute($stmtTrend);
    $resultTrend = mysqli_stmt_get_result($stmtTrend);
    $dataTrend = $resultTrend ? mysqli_fetch_assoc($resultTrend) : [];
    mysqli_stmt_close($stmtTrend);

    $mingguIni = (int)($dataTrend['minggu_ini'] ?? 0);
    $mingguLalu = (int)($dataTrend['minggu_lalu'] ?? 0);

    if ($mingguLalu === 0) {
        $trendPersen = $mingguIni > 0 ? 100 : 0;
    } else {
        $trendPersen = round((($mingguIni - $mingguLalu) / $mingguLalu) * 100);
    }
}

// Akurasi model
$akurasiModel = 0;

$resultMetric = @mysqli_query(
    $conn,
    'SELECT akurasi
     FROM model_metrics
     ORDER BY updated_at DESC
     LIMIT 1'
);

if ($resultMetric && ($metric = mysqli_fetch_assoc($resultMetric))) {
    $akurasiModel = (float)($metric['akurasi'] ?? 0);
}

echo json_encode([
    'total' => $total,
    'positif' => $positif,
    'negatif' => $negatif,
    'pct_positif' => $pctPositif,
    'pct_negatif' => $pctNegatif,
    'akurasi_model' => $akurasiModel,
    'trend_dataset' => $trendPersen,
    'user' => $user,
]);

mysqli_close($conn);
