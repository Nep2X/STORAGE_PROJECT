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
        'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
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
// Proteksyon laban sa CSRF: tanggihan ang POST/PUT/DELETE na galing
// sa ibang website (ang Origin ay hindi tugma sa host ng server).
// Dagdag ito sa SameSite=Lax na cookie.
// ------------------------------------------------------------
function csrf_guard() {
    if (in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD', 'OPTIONS'], true)) return;

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return;   // walang Origin = hindi galing sa ibang site na browser request

    $originHost = strtolower((string)parse_url($origin, PHP_URL_HOST));
    // Tinatanggap din ang X-Forwarded-Host (kung gumagamit ng ngrok / reverse proxy)
    $hosts = [$_SERVER['HTTP_HOST'] ?? '', explode(',', $_SERVER['HTTP_X_FORWARDED_HOST'] ?? '')[0]];
    $hosts = array_map(fn($h) => strtolower(preg_replace('/:\d+$/', '', trim($h))), $hosts);

    if ($originHost === '' || !in_array($originHost, $hosts, true)) {
        auth_fail(403, 'Request blocked (invalid origin).');
    }
}
csrf_guard();

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
