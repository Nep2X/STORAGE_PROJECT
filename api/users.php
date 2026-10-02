<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';

$me = require_login(['Admin']);
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$roles = ['Admin', 'Employee', 'Driver', 'Rider'];
$riderRoles = ['Driver', 'Rider']; // kailangan ng naka-link na driver

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

function checkPassword($password) {
    if (strlen((string)$password) < 8) {
        fail(400, 'Password must be at least 8 characters.');
    }
}

function validContact($contact) {
    return $contact === '' || preg_match('/^[0-9+\-\s()]{7,20}$/', $contact);
}

function validDriver($pdo, $driverId) {
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM drivers WHERE id = ?");
    $stmt->execute([$driverId]);
    return (int)$stmt->fetchColumn() > 0;
}

function otherActiveAdmins($pdo, $excludeId) {
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM users
         WHERE role = 'Admin' AND is_active = 1 AND id <> ?"
    );
    $stmt->execute([$excludeId]);
    return (int)$stmt->fetchColumn();
}

try {
    switch ($method) {
        case 'GET':
            $stmt = $pdo->query(
                "SELECT u.id, u.username, u.full_name, u.email, u.contact_number,
                        u.role, u.driver_id, d.name AS driver_name,
                        u.is_active, u.last_login, u.created_at
                 FROM users u
                 LEFT JOIN drivers d ON d.id = u.driver_id
                 ORDER BY u.full_name ASC"
            );

            $rows = $stmt->fetchAll();

            foreach ($rows as &$row) {
                $row['id'] = (int)$row['id'];
                $row['is_active'] = (int)$row['is_active'];
            }

            echo json_encode($rows);
            break;

        case 'POST':
            $username = trim($input['username'] ?? '');
            $password = (string)($input['password'] ?? '');
            $name = trim($input['full_name'] ?? '');
            $email = trim($input['email'] ?? '');
            $role = $input['role'] ?? '';
            $contact = trim($input['contact_number'] ?? '');
            $driverId = (int)($input['driver_id'] ?? 0);

            if (!preg_match('/^[A-Za-z0-9_.-]{3,30}$/', $username)) {
                fail(400, 'Username must be 3-30 characters (letters, numbers, . _ -).');
            }

            checkPassword($password);

            if ($name === '') {
                fail(400, 'Full name is required.');
            }

            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                fail(400, 'Enter a valid email.');
            }

            if (!in_array($role, $roles, true)) {
                fail(400, 'Invalid role.');
            }

            if (!validContact($contact)) {
                fail(400, 'Enter a valid contact number.');
            }

            if (in_array($role, $riderRoles, true)) {
                if (!$driverId || !validDriver($pdo, $driverId)) {
                    fail(400, 'Select the driver this account belongs to.');
                }
            } else {
                $driverId = null;
            }

            $stmt = $pdo->prepare(
                "INSERT INTO users
                (username, password_hash, full_name, email, contact_number, role, driver_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)"
            );

            $stmt->execute([
                $username,
                password_hash($password, PASSWORD_DEFAULT),
                $name,
                $email !== '' ? $email : null,
                $contact !== '' ? $contact : null,
                $role,
                $driverId ?: null
            ]);

            echo json_encode([
                'ok' => true,
                'id' => (int)$pdo->lastInsertId()
            ]);
            break;

        case 'PUT':
            $id = (int)($_GET['id'] ?? 0);

            if (!$id) {
                fail(400, 'Missing id.');
            }

            $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$id]);
            $target = $stmt->fetch();

            if (!$target) {
                fail(404, 'User not found.');
            }

            if (isset($input['password'])) {
                checkPassword($input['password']);

                $stmt = $pdo->prepare(
                    "UPDATE users
                     SET password_hash = ?, failed_attempts = 0, locked_until = NULL
                     WHERE id = ?"
                );

                $stmt->execute([
                    password_hash((string)$input['password'], PASSWORD_DEFAULT),
                    $id
                ]);

                echo json_encode(['ok' => true]);
                break;
            }

            $name = trim($input['full_name'] ?? $target['full_name']);
            $email = trim($input['email'] ?? ($target['email'] ?? ''));
            $contact = trim($input['contact_number'] ?? ($target['contact_number'] ?? ''));
            $role = $input['role'] ?? $target['role'];
            $active = isset($input['is_active'])
                ? (int)(bool)$input['is_active']
                : (int)$target['is_active'];
            $driverId = array_key_exists('driver_id', $input)
                ? (int)$input['driver_id']
                : (int)($target['driver_id'] ?? 0);

            if ($name === '') {
                fail(400, 'Full name is required.');
            }

            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                fail(400, 'Enter a valid email.');
            }

            if (!in_array($role, $roles, true)) {
                fail(400, 'Invalid role.');
            }

            if (!validContact($contact)) {
                fail(400, 'Enter a valid contact number.');
            }

            if ($id === (int)$me['id'] && !$active) {
                fail(409, 'You cannot disable your own account.');
            }

            if (
                $target['role'] === 'Admin' &&
                ($role !== 'Admin' || !$active) &&
                otherActiveAdmins($pdo, $id) === 0
            ) {
                fail(409, 'At least one active admin account is required.');
            }

            if (in_array($role, $riderRoles, true)) {
                if (!$driverId || !validDriver($pdo, $driverId)) {
                    fail(400, 'Select the driver this account belongs to.');
                }
            } else {
                $driverId = null;
            }

            $stmt = $pdo->prepare(
                "UPDATE users
                 SET full_name = ?, email = ?, contact_number = ?,
                     role = ?, driver_id = ?, is_active = ?
                 WHERE id = ?"
            );

            $stmt->execute([
                $name,
                $email !== '' ? $email : null,
                $contact !== '' ? $contact : null,
                $role,
                $driverId ?: null,
                $active,
                $id
            ]);

            echo json_encode(['ok' => true]);
            break;

        case 'DELETE':
            $id = (int)($_GET['id'] ?? 0);

            if (!$id) {
                fail(400, 'Missing id.');
            }

            if ($id === (int)$me['id']) {
                fail(409, 'You cannot delete your own account.');
            }

            $stmt = $pdo->prepare("SELECT role FROM users WHERE id = ?");
            $stmt->execute([$id]);
            $role = $stmt->fetchColumn();

            if (!$role) {
                fail(404, 'User not found.');
            }

            if ($role === 'Admin' && otherActiveAdmins($pdo, $id) === 0) {
                fail(409, 'At least one active admin account is required.');
            }

            $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
            $stmt->execute([$id]);

            echo json_encode(['ok' => true]);
            break;

        default:
            fail(405, 'Method not allowed.');
    }
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        fail(409, 'That username is already taken.');
    }

    fail(500, $e->getMessage());
}