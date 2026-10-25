<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/../koneksi.php';
    require_once __DIR__ . '/session_auth.php';

    $user = require_auth_user();
    $userId = (int)$user['id'];

    $method = $_SERVER['REQUEST_METHOD'];

    // =====================================================
    // HAPUS RIWAYAT (+ dataset & hasil_klasifikasi terkait)
    // =====================================================
    if ($method === 'DELETE') {
        $riwayatId = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        if ($riwayatId <= 0) {
            http_response_code(400);
            echo json_encode([
                'error' => true,
                'message' => 'id riwayat tidak valid.',
            ]);
            exit;
        }

        // Pastikan riwayat ini benar milik user yang login
        $checkStmt = mysqli_prepare(
            $conn,
            'SELECT id FROM riwayat_analisis WHERE id = ? AND user_id = ?'
        );
        mysqli_stmt_bind_param($checkStmt, 'ii', $riwayatId, $userId);
        mysqli_stmt_execute($checkStmt);
        $checkResult = mysqli_stmt_get_result($checkStmt);
        $found = $checkResult && mysqli_num_rows($checkResult) > 0;
        mysqli_stmt_close($checkStmt);

        if (!$found) {
            http_response_code(404);
            echo json_encode([
                'error' => true,
                'message' => 'Riwayat tidak ditemukan atau bukan milik Anda.',
            ]);
            exit;
        }

        // Cukup hapus baris riwayat_analisis ini.
        // dataset (via riwayat_id) dan hasil_klasifikasi (via
        // dataset_id) akan ikut terhapus otomatis lewat
        // FOREIGN KEY ... ON DELETE CASCADE.
        $deleteStmt = mysqli_prepare(
            $conn,
            'DELETE FROM riwayat_analisis WHERE id = ? AND user_id = ?'
        );
        mysqli_stmt_bind_param($deleteStmt, 'ii', $riwayatId, $userId);
        mysqli_stmt_execute($deleteStmt);
        $affected = mysqli_stmt_affected_rows($deleteStmt);
        mysqli_stmt_close($deleteStmt);
        mysqli_close($conn);

        echo json_encode([
            'success' => $affected > 0,
            'message' => $affected > 0
                ? 'Riwayat, dataset, dan hasil klasifikasi terkait berhasil dihapus.'
                : 'Tidak ada data yang dihapus.',
        ]);
        exit;
    }

    // =====================================================
    // LIST RIWAYAT (default, method GET)
    // =====================================================
    $page = isset($_GET['page'])
        ? max(1, (int)$_GET['page'])
        : 1;

    $limit = isset($_GET['limit'])
        ? max(1, min(100000, (int)$_GET['limit']))
        : 10;

    $offset = ($page - 1) * $limit;

    $countStmt = mysqli_prepare(
        $conn,
        'SELECT COUNT(*) AS total
         FROM riwayat_analisis
         WHERE user_id = ?'
    );

    mysqli_stmt_bind_param($countStmt, 'i', $userId);
    mysqli_stmt_execute($countStmt);

    $countResult = mysqli_stmt_get_result($countStmt);
    $countRow = $countResult
        ? mysqli_fetch_assoc($countResult)
        : [];

    $total = (int)($countRow['total'] ?? 0);
    $totalPages = $total > 0
        ? (int)ceil($total / $limit)
        : 1;

    mysqli_stmt_close($countStmt);

    $hasNamaFile = false;

    $columnResult = mysqli_query(
        $conn,
        "SHOW COLUMNS
         FROM riwayat_analisis
         LIKE 'nama_file'"
    );

    if ($columnResult && mysqli_num_rows($columnResult) > 0) {
        $hasNamaFile = true;
    }

    $selectColumns = $hasNamaFile
        ? 'id, nama_file, total_data, positif, negatif, akurasi, tanggal'
        : 'id, total_data, positif, negatif, akurasi, tanggal';

    $stmt = mysqli_prepare(
        $conn,
        "SELECT {$selectColumns}
         FROM riwayat_analisis
         WHERE user_id = ?
         ORDER BY tanggal DESC, id DESC
         LIMIT ? OFFSET ?"
    );

    if (!$stmt) {
        throw new Exception(
            'Prepare gagal: ' . mysqli_error($conn)
        );
    }

    mysqli_stmt_bind_param(
        $stmt,
        'iii',
        $userId,
        $limit,
        $offset
    );

    mysqli_stmt_execute($stmt);

    $result = mysqli_stmt_get_result($stmt);
    $rows = [];

    while ($result && ($row = mysqli_fetch_assoc($result))) {
        if (!$hasNamaFile) {
            $row['nama_file'] = null;
        }

        $rows[] = $row;
    }

    mysqli_stmt_close($stmt);
    mysqli_close($conn);

    echo json_encode([
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'total_pages' => $totalPages,
        'data' => $rows,
    ]);

} catch (Throwable $error) {
    http_response_code(500);

    echo json_encode([
        'error' => true,
        'message' => $error->getMessage(),
    ]);
}