<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../koneksi.php';
require_once __DIR__ . '/session_auth.php';

$user = require_auth_user();
$username = $user['username'];

$limit = isset($_GET['limit'])
    ? max(1, min(200, (int)$_GET['limit']))
    : 20;

$offset = isset($_GET['offset'])
    ? max(0, (int)$_GET['offset'])
    : 0;

$sentimen = strtolower(trim((string)($_GET['sentimen'] ?? 'semua')));

if (!in_array($sentimen, ['semua', 'positif', 'negatif'], true)) {
    $sentimen = 'semua';
}

$sentimentCondition = '';

if ($sentimen === 'positif') {
    $sentimentCondition = "
        AND (
            LOWER(h.prediksi) LIKE '%positif%'
            OR LOWER(h.prediksi) LIKE '%positive%'
        )
    ";
} elseif ($sentimen === 'negatif') {
    $sentimentCondition = "
        AND (
            LOWER(h.prediksi) LIKE '%negatif%'
            OR LOWER(h.prediksi) LIKE '%negative%'
        )
    ";
}

/* Total semua hasil milik akun aktif. */
$totalAllStmt = mysqli_prepare(
    $conn,
    'SELECT COUNT(*) AS total_all
     FROM hasil_klasifikasi h
     INNER JOIN dataset d
        ON d.id = h.dataset_id
     WHERE d.username = ?'
);

if (!$totalAllStmt) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => mysqli_error($conn),
    ]);
    exit;
}

mysqli_stmt_bind_param($totalAllStmt, 's', $username);
mysqli_stmt_execute($totalAllStmt);
$totalAllResult = mysqli_stmt_get_result($totalAllStmt);
$totalAllRow = $totalAllResult ? mysqli_fetch_assoc($totalAllResult) : [];
$totalAll = (int)($totalAllRow['total_all'] ?? 0);
mysqli_stmt_close($totalAllStmt);

/* Total setelah filter sentimen diterapkan. */
$countSql = "
    SELECT COUNT(*) AS total
    FROM hasil_klasifikasi h
    INNER JOIN dataset d
        ON d.id = h.dataset_id
    WHERE d.username = ?
    {$sentimentCondition}
";

$countStmt = mysqli_prepare($conn, $countSql);

if (!$countStmt) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => mysqli_error($conn),
    ]);
    exit;
}

mysqli_stmt_bind_param($countStmt, 's', $username);
mysqli_stmt_execute($countStmt);
$countResult = mysqli_stmt_get_result($countStmt);
$countRow = $countResult ? mysqli_fetch_assoc($countResult) : [];
$total = (int)($countRow['total'] ?? 0);
mysqli_stmt_close($countStmt);

/* Data hasil klasifikasi sesuai akun dan filter aktif. */
$dataSql = "
    SELECT
        d.id,
        d.content,
        d.label,
        h.prediksi,
        h.confidence,
        h.created_at
    FROM dataset d
    INNER JOIN hasil_klasifikasi h
        ON h.dataset_id = d.id
    WHERE d.username = ?
    {$sentimentCondition}
    ORDER BY h.created_at DESC, h.id DESC
    LIMIT ? OFFSET ?
";

$stmt = mysqli_prepare($conn, $dataSql);

if (!$stmt) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => mysqli_error($conn),
    ]);
    exit;
}

mysqli_stmt_bind_param($stmt, 'sii', $username, $limit, $offset);
mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);

$rows = [];

while ($result && ($row = mysqli_fetch_assoc($result))) {
    $rows[] = $row;
}

mysqli_stmt_close($stmt);
mysqli_close($conn);

echo json_encode([
    'filter' => $sentimen,
    'total' => $total,
    'total_all' => $totalAll,
    'data' => $rows,
]);
