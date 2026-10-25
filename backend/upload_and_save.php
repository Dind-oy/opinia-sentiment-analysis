<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/session_auth.php';

$user = require_auth_user();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);

    echo json_encode([
        'error' => true,
        'message' => 'Metode request harus POST.',
    ]);

    exit;
}

if (
    !isset($_FILES['file']) ||
    $_FILES['file']['error'] !== UPLOAD_ERR_OK
) {
    http_response_code(422);

    echo json_encode([
        'error' => true,
        'message' =>
            'File CSV tidak ditemukan atau gagal diunggah.',
    ]);

    exit;
}

if (!function_exists('curl_init')) {
    http_response_code(500);

    echo json_encode([
        'error' => true,
        'message' => 'Ekstensi cURL PHP belum aktif.',
    ]);

    exit;
}

$filename = basename(
    $_FILES['file']['name']
);

$extension = strtolower(
    pathinfo(
        $filename,
        PATHINFO_EXTENSION
    )
);

if ($extension !== 'csv') {
    http_response_code(422);

    echo json_encode([
        'error' => true,
        'message' => 'File harus berformat CSV.',
    ]);

    exit;
}

/*
 * Username tidak diterima dari JavaScript.
 * Username selalu diambil dari session login agar data tidak
 * salah masuk ke akun lain.
 */
$url =
    'http://127.0.0.1:8000/upload-and-save?username=' .
    rawurlencode($user['username']);

$file = new CURLFile(
    $_FILES['file']['tmp_name'],
    $_FILES['file']['type'] ?: 'text/csv',
    $filename
);

$curl = curl_init($url);

curl_setopt_array(
    $curl,
    [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => [
            'file' => $file,
        ],
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 300,
    ]
);

$response = curl_exec($curl);

$httpCode = (int)curl_getinfo(
    $curl,
    CURLINFO_HTTP_CODE
);

$curlError = curl_error($curl);

curl_close($curl);

if ($curlError !== '') {
    http_response_code(502);

    echo json_encode([
        'error' => true,
        'message' =>
            'Gagal terhubung ke FastAPI: ' .
            $curlError,
    ]);

    exit;
}

http_response_code(
    $httpCode >= 100
        ? $httpCode
        : 500
);

echo $response ?: json_encode([
    'error' => true,
    'message' =>
        'FastAPI tidak memberikan respons.',
]);
