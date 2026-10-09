<?php
// Shared na session at proteksyon para sa lahat ng API.
// I-require ito sa bawat API, tapos tawagin ang require_login([...]).

if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,          // mawawala kapag isinara ang browser
        'path'     => '/',
        'httponly' => true,       // hindi mababasa ng JavaScript
        'samesite' => 'Lax',      // hindi ipapadala sa ibang website
    ]);
    session_start();
}

function current_user() {
    return $_SESSION['user'] ?? null;
}

function auth_fail($code, $msg) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

function require_login(array $roles = []) {
    $u = current_user();

    // Binabasa lang natin ang session; isara agad para hindi magbanggaan ang sabay-sabay na requests.
    // (Ang login/logout ay magde-define ng AUTH_WRITE para makapagsulat.)
    if (!defined('AUTH_WRITE') && session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }

    if (!$u) auth_fail(401, 'Please log in.');
    if ($roles && !in_array($u['role'], $roles, true)) {
        auth_fail(403, 'You do not have permission to do this.');
    }
    return $u;
}