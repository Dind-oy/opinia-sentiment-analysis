<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/../koneksi.php';
    require_once __DIR__ . '/session_auth.php';

    $user = require_auth_user();

    mysqli_set_charset($conn, 'utf8mb4');

    ensurePrediksiManualTable($conn);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        simpanPrediksiManual(
            $conn,
            $user['username']
        );

        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        ambilRiwayatManual(
            $conn,
            $user['username']
        );

        exit;
    }

    http_response_code(405);

    echo json_encode([
        'error' => true,
        'message' => 'Metode request tidak diizinkan.',
    ]);

} catch (Throwable $error) {
    http_response_code(500);

    echo json_encode([
        'error' => true,
        'message' => $error->getMessage(),
    ]);
}


function ensurePrediksiManualTable(mysqli $conn): void
{
    $sql = "
        CREATE TABLE IF NOT EXISTS prediksi_manual (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NOT NULL,
            teks TEXT NOT NULL,
            sentimen VARCHAR(20) NOT NULL,
            tanggal DATETIME DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_prediksi_manual_user (username),
            INDEX idx_prediksi_manual_sentimen (sentimen),
            INDEX idx_prediksi_manual_tanggal (tanggal)
        ) ENGINE=InnoDB
          DEFAULT CHARSET=utf8mb4
          COLLATE=utf8mb4_unicode_ci
    ";

    if (!mysqli_query($conn, $sql)) {
        throw new Exception(
            'Gagal menyiapkan tabel prediksi_manual: ' .
            mysqli_error($conn)
        );
    }
}


function simpanPrediksiManual(
    mysqli $conn,
    string $username
): void {
    $input = $_POST;

    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';

    if (stripos($contentType, 'application/json') !== false) {
        $decoded = json_decode(
            file_get_contents('php://input'),
            true
        );

        if (is_array($decoded)) {
            $input = $decoded;
        }
    }

    $teks = trim(
        (string)($input['teks'] ?? '')
    );

    $sentimen = normalisasiSentimen(
        $input['sentimen'] ?? ''
    );

    if ($teks === '') {
        http_response_code(422);

        echo json_encode([
            'error' => true,
            'message' => 'Teks komentar tidak boleh kosong.',
        ]);

        return;
    }

    if (mb_strlen($teks) > 500) {
        http_response_code(422);

        echo json_encode([
            'error' => true,
            'message' => 'Teks komentar maksimal 500 karakter.',
        ]);

        return;
    }

    if ($sentimen === '') {
        http_response_code(422);

        echo json_encode([
            'error' => true,
            'message' => 'Sentimen harus Positif atau Negatif.',
        ]);

        return;
    }

    $stmt = mysqli_prepare(
        $conn,
        'INSERT INTO prediksi_manual
         (username, teks, sentimen, tanggal)
         VALUES (?, ?, ?, NOW())'
    );

    if (!$stmt) {
        throw new Exception(
            'Prepare insert gagal: ' .
            mysqli_error($conn)
        );
    }

    mysqli_stmt_bind_param(
        $stmt,
        'sss',
        $username,
        $teks,
        $sentimen
    );

    if (!mysqli_stmt_execute($stmt)) {
        throw new Exception(
            'Prediksi manual gagal disimpan: ' .
            mysqli_stmt_error($stmt)
        );
    }

    $id = mysqli_insert_id($conn);

    mysqli_stmt_close($stmt);

    echo json_encode([
        'status' => 'success',
        'id' => $id,
        'username' => $username,
        'teks' => $teks,
        'sentimen' => $sentimen,
        'tanggal' => date('Y-m-d H:i:s'),
    ]);
}


function ambilRiwayatManual(
    mysqli $conn,
    string $username
): void {
    $page = isset($_GET['page'])
        ? max(1, (int)$_GET['page'])
        : 1;

    $limit = isset($_GET['limit'])
        ? max(1, min(100000, (int)$_GET['limit']))
        : 10;

    $offset = ($page - 1) * $limit;

    $sentimen = normalisasiSentimen(
        $_GET['sentimen'] ?? ''
    );

    $tanggal = trim(
        (string)($_GET['tanggal'] ?? '')
    );

    $where = ['username = ?'];
    $types = 's';
    $params = [$username];

    if ($sentimen !== '') {
        $where[] = 'sentimen = ?';
        $types .= 's';
        $params[] = $sentimen;
    }

    if ($tanggal !== '') {
        $date = DateTime::createFromFormat(
            'Y-m-d',
            $tanggal
        );

        if (
            !$date ||
            $date->format('Y-m-d') !== $tanggal
        ) {
            http_response_code(422);

            echo json_encode([
                'error' => true,
                'message' => 'Format tanggal harus YYYY-MM-DD.',
            ]);

            return;
        }

        $where[] = 'DATE(tanggal) = ?';
        $types .= 's';
        $params[] = $tanggal;
    }

    $whereSql =
        ' WHERE ' .
        implode(' AND ', $where);

    $countSql = "
        SELECT
            COUNT(*) AS total,
            SUM(sentimen = 'Positif') AS positif,
            SUM(sentimen = 'Negatif') AS negatif
        FROM prediksi_manual
        {$whereSql}
    ";

    $countStmt = mysqli_prepare(
        $conn,
        $countSql
    );

    bindDynamicParams(
        $countStmt,
        $types,
        $params
    );

    mysqli_stmt_execute($countStmt);

    $countResult = mysqli_stmt_get_result($countStmt);
    $countRow = $countResult
        ? mysqli_fetch_assoc($countResult)
        : [];

    mysqli_stmt_close($countStmt);

    $total = (int)($countRow['total'] ?? 0);
    $totalPages = $total > 0
        ? (int)ceil($total / $limit)
        : 1;

    $dataSql = "
        SELECT
            id,
            username,
            teks,
            sentimen,
            tanggal AS created_at
        FROM prediksi_manual
        {$whereSql}
        ORDER BY tanggal DESC, id DESC
        LIMIT ? OFFSET ?
    ";

    $dataStmt = mysqli_prepare(
        $conn,
        $dataSql
    );

    $dataTypes = $types . 'ii';
    $dataParams = array_merge(
        $params,
        [$limit, $offset]
    );

    bindDynamicParams(
        $dataStmt,
        $dataTypes,
        $dataParams
    );

    mysqli_stmt_execute($dataStmt);

    $result = mysqli_stmt_get_result($dataStmt);
    $rows = [];

    while ($result && ($row = mysqli_fetch_assoc($result))) {
        $rows[] = $row;
    }

    mysqli_stmt_close($dataStmt);

    echo json_encode([
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'total_pages' => $totalPages,
        'stats' => [
            'total' => $total,
            'positif' => (int)($countRow['positif'] ?? 0),
            'negatif' => (int)($countRow['negatif'] ?? 0),
        ],
        'data' => $rows,
    ]);
}


function normalisasiSentimen($value): string
{
    $normalized = strtolower(
        trim((string)$value)
    );

    if (
        in_array(
            $normalized,
            ['positif', 'positive', '1'],
            true
        )
    ) {
        return 'Positif';
    }

    if (
        in_array(
            $normalized,
            ['negatif', 'negative', '0'],
            true
        )
    ) {
        return 'Negatif';
    }

    return '';
}


function bindDynamicParams(
    mysqli_stmt $stmt,
    string $types,
    array $params
): void {
    if ($types === '') {
        return;
    }

    $references = [$types];

    foreach ($params as $index => $value) {
        $references[] = &$params[$index];
    }

    call_user_func_array(
        [$stmt, 'bind_param'],
        $references
    );
}
