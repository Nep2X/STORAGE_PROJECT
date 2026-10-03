<?php
// ============================================================
// AUTH1.PHP
// Shared session at authentication helper
// ============================================================

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    session_start();
}

// ------------------------------------------------------------
// Mga grupo ng role (isang lugar lang para baguhin)
//   STAFF : pwedeng gumamit ng mga admin page
//   RIDER : rider page lang
// ------------------------------------------------------------
const ROLES_STAFF = ['Admin', 'Employee'];
const ROLES_RIDER = ['Rider', 'Driver'];

// ------------------------------------------------------------
// Kunin ang kasalukuyang naka-login na user
// ------------------------------------------------------------
function current_user() {
    return $_SESSION['user'] ?? null;
}

// ------------------------------------------------------------
// Magbalik ng JSON error response
// ------------------------------------------------------------
function auth_fail($code, $msg) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');

    echo json_encode([
        'ok'    => false,
        'error' => $msg
    ]);

    exit;
}

// ------------------------------------------------------------
// Require login
// Halimbawa: require_login(['Admin']);  o  require_login(ROLES_STAFF);
// ------------------------------------------------------------
function require_login(array $roles = []) {

    $user = current_user();

    // Binabasa lang natin ang session, kaya isara agad para hindi
    // magbanggaan ang sabay-sabay na requests. Ang auth.php (login/logout)
    // ay nagde-define ng AUTH_WRITE para makapagsulat pa.
    if (!defined('AUTH_WRITE') && session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }

    if (!$user) {
        auth_fail(401, 'Please log in.');
    }

    if ($roles && !in_array($user['role'], $roles, true)) {
        auth_fail(403, 'You do not have permission to do this.');
    }

    return $user;
}
