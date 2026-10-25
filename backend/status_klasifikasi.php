<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../koneksi.php';
require_once __DIR__ . '/session_auth.php';

$user = require_auth_user();
$username = $user['username'];

$stmt = mysqli_prepare(
    $conn,
    'SELECT
        COUNT(*) AS total_dataset,
        MAX(created_at) AS upload_terakhir
     FROM dataset
     WHERE username = ?'
);

if (!$stmt) {
    http_response_code(500);

    echo json_encode([
        'error' => true,
        'message' => mysqli_error($conn),
    ]);

    exit;
}

mysqli_stmt_bind_param(
    $stmt,
    's',
    $username
);

mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);

$row = $result
    ? mysqli_fetch_assoc($result)
    : [];

mysqli_stmt_close($stmt);
mysqli_close($conn);

echo json_encode([
    'total_dataset' =>
        (int)($row['total_dataset'] ?? 0),

    'upload_terakhir' =>
        $row['upload_terakhir'] ?? null,

    'user' => $user,
]);
