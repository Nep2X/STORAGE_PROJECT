<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/_auth.php';
require_login(['Admin']);
header('Content-Type: application/json');

$method   = $_SERVER['REQUEST_METHOD'];
$input    = json_decode(file_get_contents('php://input'), true) ?? [];
$ROLES    = ['Admin', 'Employee', 'Driver'];
$STATUSES = ['Active', 'Inactive'];

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

try {
    switch ($method) {
        case 'GET':
            $rows = $pdo->query(
                "SELECT * FROM employees ORDER BY last_name, first_name"
            )->fetchAll();
            echo json_encode($rows);
            break;

        case 'POST':
            foreach (['emp_code', 'first_name', 'last_name'] as $f) {
                if (empty(trim($input[$f] ?? ''))) fail(400, "Missing field: $f");
            }
            $role   = in_array($input['role'] ?? '', $ROLES) ? $input['role'] : 'Employee';
            $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Active';

            $stmt = $pdo->prepare(
                "INSERT INTO employees
                 (emp_code, first_name, last_name, position, department,
                  contact, email, status, date_hired, role)
                 VALUES (?,?,?,?,?,?,?,?,?,?)"
            );
            $stmt->execute([
                trim($input['emp_code']), trim($input['first_name']), trim($input['last_name']),
                $input['position'] ?? null, $input['department'] ?? null,
                $input['contact'] ?? null, $input['email'] ?? null,
                $status, ($input['date_hired'] ?? '') ?: null, $role,
            ]);
            echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'PUT':
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) fail(400, 'Missing id');

            if (isset($input['first_name'])) {
                // Buong edit (galing sa modal)
                $role   = in_array($input['role'] ?? '', $ROLES) ? $input['role'] : 'Employee';
                $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Active';
                $stmt = $pdo->prepare(
                    "UPDATE employees SET emp_code=?, first_name=?, last_name=?, position=?,
                     department=?, contact=?, email=?, status=?, date_hired=?, role=?
                     WHERE id=?"
                );
                $stmt->execute([
                    trim($input['emp_code']), trim($input['first_name']), trim($input['last_name']),
                    $input['position'] ?? null, $input['department'] ?? null,
                    $input['contact'] ?? null, $input['email'] ?? null,
                    $status, ($input['date_hired'] ?? '') ?: null, $role, $id,
                ]);
            } elseif (isset($input['role']) && in_array($input['role'], $ROLES)) {
                $pdo->prepare("UPDATE employees SET role=? WHERE id=?")->execute([$input['role'], $id]);
            } elseif (isset($input['status']) && in_array($input['status'], $STATUSES)) {
                $pdo->prepare("UPDATE employees SET status=? WHERE id=?")->execute([$input['status'], $id]);
            } else {
                fail(400, 'Nothing to update');
            }
            echo json_encode(['ok' => true]);
            break;

        case 'DELETE':
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) fail(400, 'Missing id');
            $pdo->prepare("DELETE FROM employees WHERE id = ?")->execute([$id]);
            echo json_encode(['ok' => true]);
            break;
    }
} catch (PDOException $e) {
    if ($e->getCode() == '23000') fail(409, 'Employee code already exists.');
    fail(500, $e->getMessage());
}