<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../koneksi.php';
require_once __DIR__ . '/session_auth.php';

$username = trim($_POST['username'] ?? '');
$password = $_POST['password'] ?? '';

if ($username === '' || $password === '') {
    http_response_code(422);

    echo json_encode([
        'status' => 'error',
        'pesan' => 'Username dan password wajib diisi.',
    ]);

    exit;
}

$stmt = mysqli_prepare(
    $conn,
    'SELECT id, nama, username, password
     FROM users
     WHERE username = ?
     LIMIT 1'
);

if (!$stmt) {
    http_response_code(500);

    echo json_encode([
        'status' => 'error',
        'pesan' => 'Query login gagal disiapkan.',
    ]);

    exit;
}

mysqli_stmt_bind_param($stmt, 's', $username);
mysqli_stmt_execute($stmt);

$result = mysqli_stmt_get_result($stmt);
$user = $result ? mysqli_fetch_assoc($result) : null;

mysqli_stmt_close($stmt);

if (!$user) {
    http_response_code(401);

    echo json_encode([
        'status' => 'error',
        'pesan' => 'Username tidak ditemukan.',
    ]);

    exit;
}

/*
 * Tetap mendukung password lama yang masih plain text,
 * sambil menerima password hash jika nanti tabelmu dirapikan.
 */
$passwordValid =
    hash_equals((string)$user['password'], (string)$password) ||
    password_verify($password, (string)$user['password']);

if (!$passwordValid) {
    http_response_code(401);

    echo json_encode([
        'status' => 'error',
        'pesan' => 'Password salah.',
    ]);

    exit;
}

session_regenerate_id(true);

$_SESSION['auth_user'] = [
    'id' => (int)$user['id'],
    'nama' => (string)$user['nama'],
    'username' => (string)$user['username'],
];

echo json_encode([
    'status' => 'success',
    'pesan' => 'Login berhasil.',
    'user' => $_SESSION['auth_user'],
]);

mysqli_close($conn);
