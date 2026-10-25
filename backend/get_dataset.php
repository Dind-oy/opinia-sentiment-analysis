<?php
header('Content-Type: application/json; charset=utf-8');

$kpath = __DIR__ . '/../koneksi.php';
if (!file_exists($kpath)) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'pesan' => 'koneksi.php tidak ditemukan']);
    exit;
}
require_once $kpath;

$query = "SELECT id, teks, label, prediksi, status FROM dataset ORDER BY id DESC LIMIT 200";
$result = mysqli_query($conn, $query);
if (!$result) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'pesan' => mysqli_error($conn)]);
    exit;
}

$data = [];
while ($row = mysqli_fetch_assoc($result)) {
    $data[] = $row;
}

echo json_encode(['status' => 'success', 'data' => $data]);
?>