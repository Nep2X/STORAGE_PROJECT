<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$input  = json_decode(file_get_contents('php://input'), true) ?? [];

try {
    switch ($method) {
        case 'GET':
            $rows = $pdo->query(
                "SELECT * FROM deliveries ORDER BY del_date DESC, id DESC"
            )->fetchAll();
            echo json_encode($rows);
            break;

        case 'POST':
            $stmt = $pdo->prepare(
                "INSERT INTO deliveries
                 (del_number, customer_name, address, contact, del_date,
                  driver_name, vehicle, item_desc, quantity, remarks)
                 VALUES (?,?,?,?,?,?,?,?,?,?)"
            );
            $stmt->execute([
                $input['delNumber'], $input['customerName'], $input['delAddress'],
                $input['contactNumber'], $input['delDate'] ?: null,
                $input['driverAssign'], $input['vehicle'], $input['itemDesc'],
                (int)($input['quantity'] ?: 1), $input['remarks'],
            ]);
            echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'PUT':   // update status
            $stmt = $pdo->prepare("UPDATE deliveries SET status = ? WHERE id = ?");
            $stmt->execute([$input['status'], (int)$_GET['id']]);
            echo json_encode(['ok' => true]);
            break;

        case 'DELETE':
            $stmt = $pdo->prepare("DELETE FROM deliveries WHERE id = ?");
            $stmt->execute([(int)$_GET['id']]);
            echo json_encode(['ok' => true]);
            break;
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}