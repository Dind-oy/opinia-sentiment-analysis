<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_start();
}


function current_auth_user(): ?array
{
    $user = $_SESSION['auth_user'] ?? null;

    if (!is_array($user) || empty($user['id']) || empty($user['username'])) {
        return null;
    }

    return [
        'id' => (int)$user['id'],
        'nama' => (string)($user['nama'] ?? $user['username']),
        'username' => (string)$user['username'],
    ];
}


function require_auth_user(): array
{
    $user = current_auth_user();

    if ($user === null) {
        http_response_code(401);

        echo json_encode([
            'error' => true,
            'message' => 'Sesi login tidak ditemukan. Silakan login kembali.',
        ]);

        exit;
    }

    return $user;
}
