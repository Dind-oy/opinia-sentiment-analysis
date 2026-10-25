<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: application/json');

// daftar.php ada di folder backend/ → koneksi.php ada di folder parent (satu tingkat di atas)
require_once __DIR__ . '/../koneksi.php';

$nama       = trim($_POST['nama'] ?? '');
$username   = trim($_POST['username'] ?? '');
$password   = $_POST['password'] ?? '';
$konfirmasi = $_POST['konfirmasi_password'] ?? '';

if ($nama === '' || $username === '' || $password === '' || $konfirmasi === '') {
    echo json_encode(['status' => 'error', 'pesan' => 'Semua data wajib diisi.']);
    exit;
}

if (strlen($password) < 4) {
    echo json_encode(["status" => "error", "pesan" => "Password minimal 4 karakter."]);
    exit;
}

if ($password !== $konfirmasi) {
    echo json_encode(['status' => 'error', 'pesan' => 'Konfirmasi password tidak sama.']);
    exit;
}

// Cek username sudah dipakai
$cek = mysqli_prepare($conn, "SELECT id FROM users WHERE username = ?");
mysqli_stmt_bind_param($cek, "s", $username);
mysqli_stmt_execute($cek);
mysqli_stmt_store_result($cek);
if (mysqli_stmt_num_rows($cek) > 0) {
    echo json_encode(['status' => 'error', 'pesan' => 'Username sudah digunakan, pilih yang lain.']);
    exit;
}
mysqli_stmt_close($cek);

// Simpan password as-is (plain) agar kompatibel dengan login lama
// Ganti password_hash jika login.php sudah pakai password_verify
$stmt = mysqli_prepare($conn, "INSERT INTO users (nama, username, password, created_at) VALUES (?, ?, ?, NOW())");
mysqli_stmt_bind_param($stmt, "sss", $nama, $username, $password);

if (mysqli_stmt_execute($stmt)) {
    echo json_encode(['status' => 'success', 'pesan' => 'Pendaftaran berhasil.']);
} else {
    echo json_encode(['status' => 'error', 'pesan' => 'Gagal simpan: ' . mysqli_error($conn)]);
}

mysqli_stmt_close($stmt);
mysqli_close($conn);
?>