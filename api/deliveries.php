<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';
require_login(ROLES_STAFF);
header('Content-Type: application/json');

$method   = $_SERVER['REQUEST_METHOD'];
$input    = json_decode(file_get_contents('php://input'), true) ?? [];
$STATUSES = ['Pending', 'Processing', 'Out for Delivery', 'Delivered', 'Cancelled'];

function fail($code, $msg) {
    global $pdo;
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

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
                $driver = trim($input['driverAssign'] ?? '') ?: null;
    
                $pdo->beginTransaction();
    
                // Isang active delivery lang bawat driver
                $busy = driver_conflict($pdo, $driver, $status);
                if ($busy) {
                    fail(409, "Driver $driver already has an active delivery ({$busy['del_number']}). A driver can only handle one delivery at a time.");
                }
    
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
                    $driver, $input['vehicle'] ?? null,
                    $input['itemDesc'] ?? null, (int)(($input['quantity'] ?? 1) ?: 1),
                    $input['remarks'] ?? null, $status,
                ]);
                $newId = $pdo->lastInsertId();
    
                sync_driver_status($pdo, $driver);   // may na-assign = On Route
                $pdo->commit();
    
                echo json_encode(['ok' => true, 'id' => $newId]);
                break;

                case 'PUT':
                    $id = (int)($_GET['id'] ?? 0);
                    if (!$id) fail(400, 'Missing id');
        
                    $stmt = $pdo->prepare("SELECT driver_name, status FROM deliveries WHERE id = ?");
                    $stmt->execute([$id]);
                    $old = $stmt->fetch();
                    if (!$old) fail(404, 'Delivery not found.');
        
                    $pdo->beginTransaction();
        
                    if (isset($input['customerName'])) {
                        // Buong edit (galing sa modal)
                        if (empty(trim($input['delNumber'] ?? ''))) fail(400, 'Missing field: delNumber');
                        $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Pending';
                        $driver = trim($input['driverAssign'] ?? '') ?: null;
        
                        // Isang active delivery lang bawat driver
                        $busy = driver_conflict($pdo, $driver, $status, $id);
                        if ($busy) {
                            fail(409, "Driver $driver already has an active delivery ({$busy['del_number']}). A driver can only handle one delivery at a time.");
                        }
        
                        $stmt = $pdo->prepare(
                            "UPDATE deliveries SET dest_lat=NULL, dest_lng=NULL, geo_tried=0, del_number=?, customer_name=?, address=?, contact=?,
                             del_date=?, driver_name=?, vehicle=?, item_desc=?, quantity=?, remarks=?, status=?
                             WHERE id=?"
                        );
                        $stmt->execute([
                            trim($input['delNumber']), trim($input['customerName']),
                            $input['delAddress'] ?? null, $input['contactNumber'] ?? null,
                            ($input['delDate'] ?? '') ?: null,
                            $driver, $input['vehicle'] ?? null,
                            $input['itemDesc'] ?? null, (int)(($input['quantity'] ?? 1) ?: 1),
                            $input['remarks'] ?? null, $status, $id,
                        ]);
                    } elseif (isset($input['status']) && in_array($input['status'], $STATUSES)) {
                        // Status lang
                        $status = $input['status'];
                        $driver = $old['driver_name'];
        
                        $busy = driver_conflict($pdo, $driver, $status, $id);
                        if ($busy) {
                            fail(409, "Driver $driver already has an active delivery ({$busy['del_number']}). A driver can only handle one delivery at a time.");
                        }
        
                        $pdo->prepare("UPDATE deliveries SET status=? WHERE id=?")->execute([$status, $id]);
                    } else {
                        fail(400, 'Nothing to update');
                    }
        
                    // Ihanay ang status ng dating driver at ng bagong driver
                    sync_driver_status($pdo, $old['driver_name']);
                    sync_driver_status($pdo, $driver);
        
                    $pdo->commit();
                    echo json_encode(['ok' => true]);
                    break;

                    case 'DELETE':
                        $id = (int)($_GET['id'] ?? 0);
                        if (!$id) fail(400, 'Missing id');
            
                        $stmt = $pdo->prepare("SELECT driver_name, status FROM deliveries WHERE id = ?");
                        $stmt->execute([$id]);
                        $old = $stmt->fetch();
                        if (!$old) fail(404, 'Delivery not found.');
            
                        $pdo->beginTransaction();
                        $pdo->prepare("DELETE FROM deliveries WHERE id = ?")->execute([$id]);
            
                        $driver = $old['driver_name'];
                        if ($driver) {
                            sync_driver_status($pdo, $driver);   // wala nang delivery = Available
            
                            // Active ang binura at wala nang ibang active delivery ang driver:
                            // burahin ang location niya para mawala siya sa Live Map
                            if (in_array($old['status'], ACTIVE_DELIVERY_STATUSES, true) && !active_delivery_of($pdo, $driver)) {
                                clear_driver_locations($pdo, $driver);
                            }
                        }
                        $pdo->commit();
            
                        echo json_encode(['ok' => true]);
                        break;
    }
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($e->getCode() == '23000') fail(409, 'Delivery number already exists.');
    fail(500, safe_error($e));
}