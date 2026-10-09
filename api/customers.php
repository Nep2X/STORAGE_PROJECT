<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';
require_login(ROLES_STAFF);
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$input  = json_decode(file_get_contents('php://input'), true) ?? [];

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

try {
    switch ($method) {
        case 'GET':
            $rows = $pdo->query(
                "SELECT c.*,
                        (SELECT COUNT(*) FROM deliveries x WHERE x.customer_name = c.name) AS deliveries
                 FROM customers c
                 ORDER BY c.name"
            )->fetchAll();
            echo json_encode($rows);
            break;

        case 'POST':
            if (empty(trim($input['name'] ?? ''))) fail(400, 'Missing field: name');
            $stmt = $pdo->prepare("INSERT INTO customers (name, contact, address) VALUES (?,?,?)");
            $stmt->execute([trim($input['name']), $input['contact'] ?? null, $input['address'] ?? null]);
            echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'PUT':
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) fail(400, 'Missing id');
            if (empty(trim($input['name'] ?? ''))) fail(400, 'Missing field: name');
            $stmt = $pdo->prepare("UPDATE customers SET name=?, contact=?, address=? WHERE id=?");
            $stmt->execute([trim($input['name']), $input['contact'] ?? null, $input['address'] ?? null, $id]);
            echo json_encode(['ok' => true]);
            break;

        case 'DELETE':
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) fail(400, 'Missing id');
            $pdo->prepare("DELETE FROM customers WHERE id = ?")->execute([$id]);
            echo json_encode(['ok' => true]);
            break;
    }
} catch (PDOException $e) {
    if ($e->getCode() == '23000') fail(409, 'Customer name already exists.');
    fail(500, safe_error($e));
}