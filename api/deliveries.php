<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';
require_login(ROLES_STAFF);
header('Content-Type: application/json');

$method   = $_SERVER['REQUEST_METHOD'];
$input    = json_decode(file_get_contents('php://input'), true) ?? [];
$STATUSES = ['Pending', 'Processing', 'Out for Delivery', 'Delivered', 'Cancelled'];

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

try {
    switch ($method) {
        case 'GET':
            $rows = $pdo->query(
                "SELECT * FROM deliveries ORDER BY del_date DESC, id DESC"
            )->fetchAll();
            echo json_encode($rows);
            break;

        case 'POST':
            foreach (['delNumber', 'customerName'] as $f) {
                if (empty(trim($input[$f] ?? ''))) fail(400, "Missing field: $f");
            }
            $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Pending';

            $stmt = $pdo->prepare(
                "INSERT INTO deliveries
                 (del_number, customer_name, address, contact, del_date,
                  driver_name, vehicle, item_desc, quantity, remarks, status)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)"
            );
            $stmt->execute([
                trim($input['delNumber']), trim($input['customerName']),
                $input['delAddress'] ?? null, $input['contactNumber'] ?? null,
                ($input['delDate'] ?? '') ?: null,
                ($input['driverAssign'] ?? '') ?: null, $input['vehicle'] ?? null,
                $input['itemDesc'] ?? null, (int)(($input['quantity'] ?? 1) ?: 1),
                $input['remarks'] ?? null, $status,
            ]);
            echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'PUT':
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) fail(400, 'Missing id');

            if (isset($input['customerName'])) {
                // Buong edit (galing sa modal)
                if (empty(trim($input['delNumber'] ?? ''))) fail(400, 'Missing field: delNumber');
                $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Pending';
                $stmt = $pdo->prepare(
                    "UPDATE deliveries SET dest_lat=NULL, dest_lng=NULL, geo_tried=0, del_number=?, customer_name=?, address=?, contact=?,
                     del_date=?, driver_name=?, vehicle=?, item_desc=?, quantity=?, remarks=?, status=?
                     WHERE id=?"
                );
                $stmt->execute([
                    trim($input['delNumber']), trim($input['customerName']),
                    $input['delAddress'] ?? null, $input['contactNumber'] ?? null,
                    ($input['delDate'] ?? '') ?: null,
                    ($input['driverAssign'] ?? '') ?: null, $input['vehicle'] ?? null,
                    $input['itemDesc'] ?? null, (int)(($input['quantity'] ?? 1) ?: 1),
                    $input['remarks'] ?? null, $status, $id,
                ]);
            } elseif (isset($input['status']) && in_array($input['status'], $STATUSES)) {
                // Status lang
                $pdo->prepare("UPDATE deliveries SET status=? WHERE id=?")->execute([$input['status'], $id]);
            } else {
                fail(400, 'Nothing to update');
            }
            echo json_encode(['ok' => true]);
            break;

        case 'DELETE':
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) fail(400, 'Missing id');
            $pdo->prepare("DELETE FROM deliveries WHERE id = ?")->execute([$id]);
            echo json_encode(['ok' => true]);
            break;
    }
} catch (PDOException $e) {
    if ($e->getCode() == '23000') fail(409, 'Delivery number already exists.');
    fail(500, safe_error($e));
}