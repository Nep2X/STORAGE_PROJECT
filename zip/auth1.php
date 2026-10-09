<?php
define('AUTH_WRITE', true);
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/_auth.php';
header('Content-Type: application/json');
date_default_timezone_set('Asia/Manila');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$input  = json_decode(file_get_contents('php://input'), true) ?? [];

const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 300;

function public_user($u) {
    return [
        'id'         => (int)$u['id'],
        'username'   => $u['username'],
        'full_name'  => $u['full_name'],
        'email'      => $u['email'],
        'role'       => $u['role'],
        'driver_id'  => $u['driver_id'] !== null ? (int)$u['driver_id'] : null,
        'last_login' => $u['last_login'] ?? null,
    ];
}

function redirect_for($role) {
    return $role === 'Admin' ? 'dashboard.html' : 'rider.html';
}

try {
    // ---------- LOGIN ----------
    if ($method === 'POST' && $action === 'login') {
        $username = trim($input['username'] ?? '');
        $password = (string)($input['password'] ?? '');
        if ($username === '' || $password === '') auth_fail(400, 'Enter your username and password.');

        $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if ($user && $user['locked_until'] && strtotime($user['locked_until']) > time()) {
            auth_fail(429, 'Too many failed attempts. Please try again in a few minutes.');
        }

        $valid = $user && password_verify($password, $user['password_hash']);

        if (!$valid) {
            if ($user) {
                $attempts = (int)$user['failed_attempts'] + 1;
                if ($attempts >= MAX_ATTEMPTS) {
                    $pdo->prepare("UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?")
                        ->execute([date('Y-m-d H:i:s', time() + LOCK_SECONDS), $user['id']]);
                } else {
                    $pdo->prepare("UPDATE users SET failed_attempts = ? WHERE id = ?")
                        ->execute([$attempts, $user['id']]);
                }
            }
            usleep(400000); // bahagyang antala laban sa panghuhula
            auth_fail(401, 'Incorrect username or password.');
        }

        if (!(int)$user['is_active']) {
            auth_fail(403, 'This account is disabled. Please contact the admin.');
        }

        session_regenerate_id(true);
        $_SESSION['user'] = [
            'id'        => (int)$user['id'],
            'username'  => $user['username'],
            'full_name' => $user['full_name'],
            'role'      => $user['role'],
        ];

        $pdo->prepare("UPDATE users SET last_login = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?")
            ->execute([date('Y-m-d H:i:s'), $user['id']]);

        echo json_encode(['ok' => true, 'role' => $user['role'], 'redirect' => redirect_for($user['role'])]);
        exit;
    }

    // ---------- LOGOUT ----------
    if ($method === 'POST' && $action === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 3600, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
        echo json_encode(['ok' => true]);
        exit;
    }

    // ---------- Ang mga susunod ay kailangan ng login ----------
    $sess = current_user();
    if (!$sess) auth_fail(401, 'Please log in.');

    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$sess['id']]);
    $user = $stmt->fetch();

    // Kapag binura o na-disable ang account, tanggalin agad ang session
    if (!$user || !(int)$user['is_active']) {
        $_SESSION = [];
        session_destroy();
        auth_fail(401, 'Your session has ended. Please log in again.');
    }

    // ---------- ME ----------
    if ($method === 'GET' && $action === 'me') {
        echo json_encode(['ok' => true, 'user' => public_user($user)]);
        exit;
    }

    // ---------- UPDATE PROFILE ----------
    if ($method === 'POST' && $action === 'update_profile') {
        $name  = trim($input['full_name'] ?? '');
        $email = trim($input['email'] ?? '');
        if ($name === '') auth_fail(400, 'Name is required.');
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) auth_fail(400, 'Enter a valid email.');

        $pdo->prepare("UPDATE users SET full_name = ?, email = ? WHERE id = ?")
            ->execute([$name, $email ?: null, $user['id']]);
        $_SESSION['user']['full_name'] = $name;
        echo json_encode(['ok' => true]);
        exit;
    }

    // ---------- CHANGE PASSWORD ----------
    if ($method === 'POST' && $action === 'change_password') {
        $current = (string)($input['current'] ?? '');
        $new     = (string)($input['new'] ?? '');

        if (!password_verify($current, $user['password_hash'])) auth_fail(400, 'Current password is incorrect.');
        if (strlen($new) < 8) auth_fail(400, 'New password must be at least 8 characters.');
        if ($new === $current) auth_fail(400, 'New password must be different from the current one.');

        $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?")
            ->execute([password_hash($new, PASSWORD_DEFAULT), $user['id']]);
        session_regenerate_id(true);
        echo json_encode(['ok' => true]);
        exit;
    }

    auth_fail(400, 'Invalid request.');
} catch (PDOException $e) {
    auth_fail(500, $e->getMessage());
}