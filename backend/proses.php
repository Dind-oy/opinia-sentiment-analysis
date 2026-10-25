<?php
// Mengatur header agar response berupa JSON
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $teksInput = $_POST['teks'] ?? '';

    if (empty($teksInput)) {
        echo json_encode([
            'status' => 'error',
            'pesan' => 'Teks tidak boleh kosong.'
        ]);
        exit;
    }

    // URL API Python (FastAPI)
    $pythonApiUrl = 'http://127.0.0.1:8000/predict';

    // Data yang akan dikirim ke Python
    $postData = json_encode(['text' => $teksInput]);

    // Inisialisasi cURL
    $ch = curl_init($pythonApiUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Content-Length: ' . strlen($postData)
    ]);

    // Eksekusi cURL
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // Memeriksa response dari Python
    if ($httpCode === 200 && $response) {
        $responseData = json_decode($response, true);
        echo json_encode([
            'status' => 'success',
            'sentimen' => $responseData['sentiment'] ?? 'Tidak diketahui'
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'pesan' => 'Gagal terhubung ke service Python.'
        ]);
    }
} else {
    echo json_encode([
        'status' => 'error',
        'pesan' => 'Metode request tidak diizinkan.'
    ]);
}
