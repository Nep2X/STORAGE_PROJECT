<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

$method   = $_SERVER['REQUEST_METHOD'];
$input    = json_decode(file_get_contents('php://input'), true) ?? [];
$STATUSES = ['Available', 'On Route', 'Offline'];

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

try {
    switch ($method) {
        case 'GET':
            $rows = $pdo->query(
                "SELECT d.*,
                        (SELECT COUNT(*) FROM deliveries x WHERE x.driver_name = d.name) AS deliveries
                 FROM drivers d
                 ORDER BY d.name"
            )->fetchAll();
            echo json_encode($rows);
            break;

        case 'POST':
            if (empty(trim($input['name'] ?? ''))) fail(400, 'Missing field: name');
            $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Available';

            $stmt = $pdo->prepare("INSERT INTO drivers (name, contact, status) VALUES (?,?,?)");
            $stmt->execute([trim($input['name']), $input['contact'] ?? null, $status]);
            echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'PUT':
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) fail(400, 'Missing id');

            if (isset($input['name'])) {
                // Buong edit (galing sa modal)
                $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Available';
                $stmt = $pdo->prepare("UPDATE drivers SET name=?, contact=?, status=? WHERE id=?");
                $stmt->execute([trim($input['name']), $input['contact'] ?? null, $status, $id]);
            } elseif (isset($input['status']) && in_array($input['status'], $STATUSES)) {
                // Status lang (galing sa dropdown sa row)
                $pdo->prepare("UPDATE drivers SET status=? WHERE id=?")->execute([$input['status'], $id]);
            } else {
                fail(400, 'Nothing to update');
            }
            echo json_encode(['ok' => true]);
            break;

        case 'DELETE':
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) fail(400, 'Missing id');
            $pdo->prepare("DELETE FROM drivers WHERE id = ?")->execute([$id]);
            echo json_encode(['ok' => true]);
            break;
    }
} catch (PDOException $e) {
    if ($e->getCode() == '23000') fail(409, 'Driver name already exists.');
    fail(500, $e->getMessage());
}