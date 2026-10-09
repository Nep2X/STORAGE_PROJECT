<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/_auth.php';
$me = require_login(['Admin']);
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$input  = json_decode(file_get_contents('php://input'), true) ?? [];
$ROLES  = ['Admin', 'Rider'];

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

function check_password($p) {
    if (strlen((string)$p) < 8) fail(400, 'Password must be at least 8 characters.');
}

function other_active_admins($pdo, $excludeId) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE role = 'Admin' AND is_active = 1 AND id <> ?");
    $stmt->execute([$excludeId]);
    return (int)$stmt->fetchColumn();
}

function valid_driver($pdo, $driverId) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM drivers WHERE id = ?");
    $stmt->execute([$driverId]);
    return (int)$stmt->fetchColumn() > 0;
}

try {
    switch ($method) {
        case 'GET':
            $rows = $pdo->query(
                "SELECT u.id, u.username, u.full_name, u.email, u.role, u.driver_id,
                        u.is_active, u.last_login, d.name AS driver_name
                 FROM users u
                 LEFT JOIN drivers d ON d.id = u.driver_id
                 ORDER BY u.role, u.full_name"
            )->fetchAll();
            foreach ($rows as &$r) $r['is_active'] = (int)$r['is_active'];
            echo json_encode($rows);
            break;

        case 'POST':
            $username = trim($input['username'] ?? '');
            $name     = trim($input['full_name'] ?? '');
            $email    = trim($input['email'] ?? '');
            $role     = $input['role'] ?? 'Rider';
            $driverId = (int)($input['driver_id'] ?? 0);
            $password = (string)($input['password'] ?? '');

            if (!preg_match('/^[A-Za-z0-9_.-]{3,30}$/', $username)) {
                fail(400, 'Username must be 3-30 characters (letters, numbers, . _ -).');
            }
            if ($name === '') fail(400, 'Full name is required.');
            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'Enter a valid email.');
            if (!in_array($role, $ROLES, true)) fail(400, 'Invalid role.');
            check_password($password);

            if ($role === 'Rider') {
                if (!$driverId || !valid_driver($pdo, $driverId)) fail(400, 'Select the driver this rider account belongs to.');
            } else {
                $driverId = null;
            }

            $stmt = $pdo->prepare(
                "INSERT INTO users (username, password_hash, full_name, email, role, driver_id)
                 VALUES (?,?,?,?,?,?)"
            );
            $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT),
                            $name, $email ?: null, $role, $driverId]);
            echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'PUT':
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) fail(400, 'Missing id');

            $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$id]);
            $target = $stmt->fetch();
            if (!$target) fail(404, 'User not found.');

            // ----- I-reset ang password -----
            if (isset($input['password'])) {
                check_password($input['password']);
                $pdo->prepare("UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?")
                    ->execute([password_hash((string)$input['password'], PASSWORD_DEFAULT), $id]);
                echo json_encode(['ok' => true]);
                break;
            }

            // ----- Baguhin ang detalye -----
            $name     = trim($input['full_name'] ?? '');
            $email    = trim($input['email'] ?? '');
            $role     = $input['role'] ?? $target['role'];
            $active   = isset($input['is_active']) ? (int)(bool)$input['is_active'] : (int)$target['is_active'];
            $driverId = (int)($input['driver_id'] ?? 0);

            if ($name === '') fail(400, 'Full name is required.');
            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'Enter a valid email.');
            if (!in_array($role, $ROLES, true)) fail(400, 'Invalid role.');

            if ($id === (int)$me['id'] && !$active) fail(409, 'You cannot disable your own account.');
            if ($target['role'] === 'Admin' && ($role !== 'Admin' || !$active)
                && other_active_admins($pdo, $id) === 0) {
                fail(409, 'At least one active admin account is required.');
            }

            if ($role === 'Rider') {
                if (!$driverId || !valid_driver($pdo, $driverId)) fail(400, 'Select the driver this rider account belongs to.');
            } else {
                $driverId = null;
            }

            $pdo->prepare("UPDATE users SET full_name=?, email=?, role=?, driver_id=?, is_active=? WHERE id=?")
                ->execute([$name, $email ?: null, $role, $driverId, $active, $id]);
            echo json_encode(['ok' => true]);
            break;

        case 'DELETE':
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) fail(400, 'Missing id');
            if ($id === (int)$me['id']) fail(409, 'You cannot delete your own account.');

            $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
            $stmt->execute([$id]);
            $role = $stmt->fetchColumn();
            if ($role === 'Admin' && other_active_admins($pdo, $id) === 0) {
                fail(409, 'At least one active admin account is required.');
            }

            $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$id]);
            echo json_encode(['ok' => true]);
            break;
    }
} catch (PDOException $e) {
    if ($e->getCode() == '23000') fail(409, 'That username is already taken.');
    fail(500, $e->getMessage());
}