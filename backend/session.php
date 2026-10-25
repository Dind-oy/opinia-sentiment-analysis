<?php
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/session_auth.php';

$user = current_auth_user();

echo json_encode([
    'logged_in' => $user !== null,
    'user' => $user,
]);
