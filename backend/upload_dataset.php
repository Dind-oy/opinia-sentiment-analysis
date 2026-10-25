<?php
// Suppress HTML errors, return only JSON
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

$logFile = __DIR__ . '/upload_error.log';
set_error_handler(function($errno, $errstr, $errfile, $errline) use ($logFile) {
    file_put_contents($logFile, "[" . date('c') . "] $errstr (Line $errline)\n", FILE_APPEND);
});

try {
    $kpath = __DIR__ . '/../koneksi.php';
    if (!file_exists($kpath)) {
        throw new Exception("koneksi.php tidak ditemukan di $kpath");
    }
    require_once $kpath;
    
    if (!isset($conn) || $conn === null) {
        throw new Exception("Database connection gagal atau belum terinisialisasi");
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception("Metode request harus POST");
    }

    if (!isset($_FILES['csvfile'])) {
        throw new Exception("Parameter 'csvfile' tidak ditemukan");
    }
    
    if ($_FILES['csvfile']['error'] !== UPLOAD_ERR_OK) {
        throw new Exception("Upload error code: " . $_FILES['csvfile']['error']);
    }

    $tmp = $_FILES['csvfile']['tmp_name'];
    $name = basename($_FILES['csvfile']['name']);
    
    if (!file_exists($tmp)) {
        throw new Exception("File temp tidak ditemukan");
    }

    if (strtolower(pathinfo($name, PATHINFO_EXTENSION)) !== 'csv') {
        throw new Exception("File harus CSV, diperoleh: " . pathinfo($name, PATHINFO_EXTENSION));
    }

    $createSQL = "CREATE TABLE IF NOT EXISTS dataset (
      id INT AUTO_INCREMENT PRIMARY KEY,
      teks TEXT NOT NULL,
      label VARCHAR(100),
      prediksi VARCHAR(100) DEFAULT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Menunggu',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
    
    if (!mysqli_query($conn, $createSQL)) {
        throw new Exception("CREATE TABLE gagal: " . mysqli_error($conn));
    }

    $handle = fopen($tmp, 'r');
    if (!$handle) {
        throw new Exception("Gagal membuka file CSV");
    }

    $inserted = 0;
    $failed = 0;

    $insertSQL = "INSERT INTO dataset (teks, label, status) VALUES (?, ?, 'Menunggu')";
    $stmt = mysqli_prepare($conn, $insertSQL);
    
    if (!$stmt) {
        throw new Exception("Prepare statement gagal: " . mysqli_error($conn));
    }

    $rowNumber = 0;
    while (($row = fgetcsv($handle, 0, ',')) !== false) {
        $rowNumber++;
        if ($rowNumber === 1 && preg_match('/(review|teks|text)/i', implode(' ', $row)) && preg_match('/(label|sentimen)/i', implode(' ', $row))) {
            continue;
        }
        if (count($row) < 1) continue;
        
        $teks = isset($row[0]) ? trim($row[0]) : '';
        $label = isset($row[1]) ? trim($row[1]) : null;
        
        if ($teks === '') {
            $failed++;
            continue;
        }

        if ($label === '' || $label === null) $label = null;

        mysqli_stmt_bind_param($stmt, 'ss', $teks, $label);
        
        if (mysqli_stmt_execute($stmt)) {
            $inserted++;
        } else {
            $failed++;
            file_put_contents($logFile, "[" . date('c') . "] Insert gagal untuk: $teks - " . mysqli_error($conn) . "\n", FILE_APPEND);
        }
    }

    fclose($handle);
    mysqli_stmt_close($stmt);

    echo json_encode([
        'status' => 'success',
        'inserted' => $inserted,
        'failed' => $failed,
        'pesan' => "Berhasil memasukkan $inserted baris, gagal $failed baris"
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'pesan' => $e->getMessage()
    ]);
    file_put_contents($logFile, "[" . date('c') . "] Exception: " . $e->getMessage() . "\n", FILE_APPEND);
} finally {
    restore_error_handler();
}
?>