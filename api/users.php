<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';

$me = require_login(['Admin']);
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true) ?? [];
$roles = ['Admin', 'Employee', 'Driver', 'Rider'];
$driverRoles = ['Driver', 'Rider']; // ang account na ito ay may sariling driver record

function fail($code, $msg) {
    global $pdo;
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

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

// Hanapin o gumawa ng driver record para sa account na ito.
// - Kung may driver na may parehong pangalan at wala pang account, iyon ang gagamitin.
// - Kung wala, gagawa ng bago (Driver ID).
function ensureDriver($pdo, $userId, $name, $contact) {
    $stmt = $pdo->prepare("SELECT id FROM drivers WHERE name = ?");
    $stmt->execute([$name]);
    $driverId = $stmt->fetchColumn();

    if ($driverId) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE driver_id = ? AND id <> ?");
        $stmt->execute([$driverId, $userId]);

        if ((int)$stmt->fetchColumn() > 0) {
            fail(409, 'A driver named "' . $name . '" is already linked to another account.');
        }

        $stmt = $pdo->prepare("UPDATE drivers SET contact = ? WHERE id = ?");
        $stmt->execute([$contact !== '' ? $contact : null, $driverId]);

        return (int)$driverId;
    }

    $stmt = $pdo->prepare("INSERT INTO drivers (name, contact) VALUES (?, ?)");
    $stmt->execute([$name, $contact !== '' ? $contact : null]);

    return (int)$pdo->lastInsertId();
}

// Ihanay ang driver record sa account (pangalan at contact),
// at isama ang mga lumang delivery para hindi sila mawala sa driver.
function syncDriver($pdo, $driverId, $name, $contact) {
    $stmt = $pdo->prepare("SELECT name FROM drivers WHERE id = ?");
    $stmt->execute([$driverId]);
    $oldName = $stmt->fetchColumn();

    if ($oldName === false) {
        return false; // nawala ang driver record
    }

    if ($oldName !== $name) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM drivers WHERE name = ? AND id <> ?");
        $stmt->execute([$name, $driverId]);

        if ((int)$stmt->fetchColumn() > 0) {
            fail(409, 'Another driver already uses the name "' . $name . '".');
        }

        $pdo->prepare("UPDATE deliveries SET driver_name = ? WHERE driver_name = ?")
            ->execute([$name, $oldName]);
    }

    $pdo->prepare("UPDATE drivers SET name = ?, contact = ? WHERE id = ?")
        ->execute([$name, $contact !== '' ? $contact : null, $driverId]);

    return true;
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

            $pdo->beginTransaction();

            $stmt = $pdo->prepare(
                "INSERT INTO users
                (username, password_hash, full_name, email, contact_number, role)
                VALUES (?, ?, ?, ?, ?, ?)"
            );

            $stmt->execute([
                $username,
                password_hash($password, PASSWORD_DEFAULT),
                $name,
                $email !== '' ? $email : null,
                $contact !== '' ? $contact : null,
                $role
            ]);

            $newId = (int)$pdo->lastInsertId();
            $driverId = null;

            // Driver / Rider: awtomatikong magkakaroon ng Driver ID sa Drivers page
            if (in_array($role, $driverRoles, true)) {
                $driverId = ensureDriver($pdo, $newId, $name, $contact);

                $pdo->prepare("UPDATE users SET driver_id = ? WHERE id = ?")
                    ->execute([$driverId, $newId]);
            }

            $pdo->commit();

            echo json_encode([
                'ok' => true,
                'id' => $newId,
                'driver_id' => $driverId
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

            $pdo->beginTransaction();

            $driverId = $target['driver_id'] ? (int)$target['driver_id'] : null;

            if (in_array($role, $driverRoles, true)) {
                // Naka-link na: ihanay ang pangalan at contact. Wala pa: gumawa o mag-link.
                if (!$driverId || !syncDriver($pdo, $driverId, $name, $contact)) {
                    $driverId = ensureDriver($pdo, $id, $name, $contact);
                }
            } else {
                // Hindi na driver ang account. Mananatili ang driver record para sa history.
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
                $driverId,
                $active,
                $id
            ]);

            $pdo->commit();

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
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    if ($e->getCode() === '23000') {
        fail(409, 'That username is already taken.');
    }

    fail(500, safe_error($e));
}