<?php
header('Content-Type: application/json; charset=utf-8');
set_time_limit(300); // 5 menit untuk proses besar

$kpath = __DIR__ . '/../koneksi.php';
if (!file_exists($kpath)) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'pesan' => 'koneksi.php tidak ditemukan']);
    exit;
}
require_once $kpath;

// Ambil semua baris yang belum diklasifikasi
$query = "SELECT id, teks FROM dataset WHERE status = 'Menunggu' ORDER BY id ASC LIMIT 200";
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

if (empty($data)) {
    echo json_encode([
        'status' => 'success', 
        'message' => 'Tidak ada data baru untuk diklasifikasi',
        'processed' => 0,
        'failed' => 0,
        'details' => []
    ]);
    exit;
}

// Panggil Python API untuk klasifikasi
$pythonApiUrl = 'http://127.0.0.1:8000/predict';
$results = [];
$processed = 0;
$failed = 0;

foreach ($data as $item) {
    try {
        $postData = json_encode(['text' => $item['teks']]);

        $ch = curl_init($pythonApiUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($postData)
        ]);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($curlError) {
            throw new Exception("cURL Error: $curlError");
        }

        if ($httpCode !== 200 || !$response) {
            throw new Exception("HTTP $httpCode - Response: " . substr($response, 0, 200));
        }

        $responseData = json_decode($response, true);
        if (!isset($responseData['sentiment'])) {
            throw new Exception("Invalid response format: " . json_encode($responseData));
        }

        $sentiment = $responseData['sentiment'] ?? 'Tidak diketahui';
        $status = 'Selesai';

        $updateSQL = "UPDATE dataset SET prediksi = ?, status = ?, updated_at = NOW() WHERE id = ?";
        $stmt = mysqli_prepare($conn, $updateSQL);
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 'ssi', $sentiment, $status, $item['id']);
            if (mysqli_stmt_execute($stmt)) {
                mysqli_stmt_close($stmt);
                $results[] = [
                    'id' => $item['id'], 
                    'status' => 'success', 
                    'prediksi' => $sentiment
                ];
                $processed++;
            } else {
                throw new Exception("DB Update gagal: " . mysqli_error($conn));
            }
        } else {
            throw new Exception("Prepare statement gagal: " . mysqli_error($conn));
        }
    } catch (Exception $e) {
        $results[] = [
            'id' => $item['id'], 
            'status' => 'error', 
            'pesan' => $e->getMessage()
        ];
        $failed++;
    }
}

echo json_encode([
    'status' => 'success', 
    'processed' => $processed,
    'failed' => $failed,
    'total' => count($data),
    'details' => $results
]);
?>