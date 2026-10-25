<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../koneksi.php';
require_once __DIR__ . '/session_auth.php';

$user = require_auth_user();
$username = $user['username'];

$body = json_decode(file_get_contents('php://input'), true);
$id = (int)($body['id'] ?? 0);

if ($id <= 0) {
    http_response_code(400);
    echo json_encode(['error' => true, 'message' => 'ID tidak valid.']);
    exit;
}

// Ambil user_id dari username
$stmtUser = mysqli_prepare($conn, "SELECT id FROM users WHERE username = ?");
mysqli_stmt_bind_param($stmtUser, 's', $username);
mysqli_stmt_execute($stmtUser);
$resultUser = mysqli_stmt_get_result($stmtUser);
$userData = mysqli_fetch_assoc($resultUser);
mysqli_stmt_close($stmtUser);

if (!$userData) {
    http_response_code(403);
    echo json_encode(['error' => true, 'message' => 'User tidak ditemukan.']);
    exit;
}

$userId = (int)$userData['id'];

// Cek riwayat_analisis milik user ini
$stmtCek = mysqli_prepare($conn, "SELECT id FROM riwayat_analisis WHERE id = ? AND user_id = ?");
mysqli_stmt_bind_param($stmtCek, 'ii', $id, $userId);
mysqli_stmt_execute($stmtCek);
$resultCek = mysqli_stmt_get_result($stmtCek);

if (!mysqli_fetch_assoc($resultCek)) {
    http_response_code(403);
    echo json_encode(['error' => true, 'message' => 'Dataset tidak ditemukan atau bukan milik Anda.']);
    exit;
}
mysqli_stmt_close($stmtCek);

// Hapus hasil_klasifikasi yang terhubung
$stmtHk = mysqli_prepare($conn, "DELETE FROM hasil_klasifikasi WHERE dataset_id = ?");
mysqli_stmt_bind_param($stmtHk, 'i', $id);
mysqli_stmt_execute($stmtHk);
mysqli_stmt_close($stmtHk);

// Hapus riwayat_analisis
$stmtRa = mysqli_prepare($conn, "DELETE FROM riwayat_analisis WHERE id = ? AND user_id = ?");
mysqli_stmt_bind_param($stmtRa, 'ii', $id, $userId);
mysqli_stmt_execute($stmtRa);
mysqli_stmt_close($stmtRa);

echo json_encode(['success' => true]);
mysqli_close($conn);