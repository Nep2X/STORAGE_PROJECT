<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';
require_login(ROLES_STAFF);
header('Content-Type: application/json');
date_default_timezone_set('Asia/Manila');

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
    ensure_delivery_events($pdo);

    switch ($method) {
        case 'GET':
            // Mga customer (stops) ng isang delivery: api/deliveries.php?action=stops&id=123
            if (($_GET['action'] ?? '') === 'stops') {
                $stopId = (int)($_GET['id'] ?? 0);
                if (!$stopId) fail(400, 'Missing id');

                $stmt = $pdo->prepare(
                    "SELECT stop_order, customer_name, address, contact, item_desc, quantity, status, delivered_at, rider_notes
                     FROM delivery_stops
                     WHERE delivery_id = ?
                     ORDER BY stop_order"
                );
                $stmt->execute([$stopId]);
                echo json_encode(['ok' => true, 'stops' => $stmt->fetchAll()]);
                break;
            }

            // History ng isang delivery: api/deliveries.php?action=events&id=123
            if (($_GET['action'] ?? '') === 'events') {
                $eventId = (int)($_GET['id'] ?? 0);
                if (!$eventId) fail(400, 'Missing id');

                $stmt = $pdo->prepare(
                    "SELECT status, note, username, created_at
                     FROM delivery_events
                     WHERE delivery_id = ?
                     ORDER BY id DESC"
                );
                $stmt->execute([$eventId]);
                echo json_encode(['ok' => true, 'events' => $stmt->fetchAll()]);
                break;
            }

            $rows = $pdo->query(
                "SELECT deliveries.*,
                        (SELECT COUNT(*) FROM delivery_stops s WHERE s.delivery_id = deliveries.id) AS stop_count,
                        (SELECT GROUP_CONCAT(s.customer_name ORDER BY s.stop_order SEPARATOR '||')
                           FROM delivery_stops s WHERE s.delivery_id = deliveries.id) AS customer_list
                 FROM deliveries
                 ORDER BY del_date DESC, id DESC"
            )->fetchAll();
            echo json_encode($rows);
            break;

            case 'POST':
                // Ang Delivery Number at Address ay laging galing sa server (hindi sa browser)
                $maxNum = (int)$pdo->query("SELECT COALESCE(MAX(CAST(SUBSTRING(del_number, 5) AS UNSIGNED)), 0) FROM deliveries")->fetchColumn();
                $input['delNumber'] = 'DEL-' . str_pad((string)($maxNum + 1), 3, '0', STR_PAD_LEFT);
                $cs = $pdo->prepare("SELECT address FROM customers WHERE name = ?");
                $cs->execute([trim($input['customerName'] ?? '')]);
                $custAddress = $cs->fetchColumn();
                if ($custAddress === false) fail(400, 'Customer not found.');
                $input['delAddress'] = $custAddress;

                foreach (['delNumber', 'customerName', 'delAddress', 'contactNumber', 'delDate', 'driverAssign', 'vehicle', 'itemDesc', 'quantity', 'status'] as $f) {
                    if (trim((string)($input[$f] ?? '')) === '') fail(400, "Please fill in all required fields (missing: $f).");
                }
                if ((int)$input['quantity'] < 1) fail(400, 'Quantity must be at least 1.');
                $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Pending';
                $driver = trim($input['driverAssign'] ?? '') ?: null;
    
                $pdo->beginTransaction();
    
                // Isang active delivery lang bawat driver
                                // ---- Dagdag na customer (isang batch, parehong area lang) ----
                                $extras = [];
                                foreach ((array)($input['extraCustomers'] ?? []) as $e) {
                                    $extras[] = [
                                        'name' => trim((string)($e['customerName'] ?? '')),
                                        'item' => trim((string)($e['itemDesc'] ?? '')),
                                        'qty'  => (int)($e['quantity'] ?? 0),
                                    ];
                                }
                                $stopRows = [];
                                if ($extras) {
                                    if (count($extras) > MAX_BATCH_STOPS - 1) fail(400, 'A delivery can have at most ' . MAX_BATCH_STOPS . ' customers.');
                
                                    $names = [trim($input['customerName'])];
                                    foreach ($extras as $e) {
                                        if ($e['name'] === '' || $e['item'] === '' || $e['qty'] < 1) {
                                            fail(400, 'Please complete the customer, item, and quantity of every additional customer.');
                                        }
                                        $names[] = $e['name'];
                                    }
                                    if (count(array_unique($names)) !== count($names)) fail(400, 'The same customer was added more than once.');
                
                                    $cq   = $pdo->prepare("SELECT name, contact, address, lat, lng FROM customers WHERE name = ?");
                                    $zone = null;
                                    foreach ($names as $i => $n) {
                                        $cq->execute([$n]);
                                        $c = $cq->fetch();
                                        if (!$c) fail(400, "Customer not found: $n");
                                        if ($c['lat'] === null || $c['lng'] === null) {
                                            fail(409, "$n has no map location yet. Open this customer in the Customers page, press Save, then try again.");
                                        }
                                        $z = customer_zone($c['lat']);
                                        if ($zone === null) {
                                            $zone = $z;
                                        } elseif ($z !== $zone) {
                                            fail(409, "$n is in the $z area, but this delivery is for the $zone area. Only customers in the same area can share one delivery.");
                                        }
                                        $stopRows[] = [
                                            'name'    => $c['name'],
                                            'contact' => $c['contact'],
                                            'address' => $c['address'],
                                            'lat'     => $c['lat'],
                                            'lng'     => $c['lng'],
                                            'item'    => $i === 0 ? ($input['itemDesc'] ?? null) : $extras[$i - 1]['item'],
                                            'qty'     => $i === 0 ? (int)(($input['quantity'] ?? 1) ?: 1) : $extras[$i - 1]['qty'],
                                        ];
                                    }
                                }
                
                if ($status === 'Delivered') {
                    fail(400, 'A new delivery cannot start as Delivered. Use Pending or Out for Delivery.');
                }

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
                log_delivery_event($pdo, (int)$newId, $status, $stopRows ? 'Delivery created with ' . count($stopRows) . ' customers' : 'Delivery created');

                $insStop = $pdo->prepare(
                    "INSERT INTO delivery_stops
                     (delivery_id, stop_order, customer_name, address, contact, item_desc, quantity, dest_lat, dest_lng)
                     VALUES (?,?,?,?,?,?,?,?,?)"
                );
                foreach ($stopRows as $i => $s) {
                    $insStop->execute([$newId, $i + 1, $s['name'], $s['address'], $s['contact'], $s['item'], $s['qty'], $s['lat'], $s['lng']]);
                }
    
                sync_driver_status($pdo, $driver);   // may na-assign = On Route
                $pdo->commit();
    
                echo json_encode(['ok' => true, 'id' => $newId]);
                break;

                case 'PUT':
                    $id = (int)($_GET['id'] ?? 0);
                    if (!$id) fail(400, 'Missing id');
        
                    $stmt = $pdo->prepare("SELECT driver_name, status, proof_image FROM deliveries WHERE id = ?");
                    $stmt->execute([$id]);
                    $old = $stmt->fetch();
                    if (!$old) fail(404, 'Delivery not found.');
        
                    $pdo->beginTransaction();
        
                    if (isset($input['customerName'])) {
                        // Buong edit (galing sa modal)
                        if (empty(trim($input['delNumber'] ?? ''))) fail(400, 'Missing field: delNumber');

                        // Batch (maraming customer): hindi pa puwedeng palitan ang main customer
                        $sc = $pdo->prepare("SELECT COUNT(*) FROM delivery_stops WHERE delivery_id = ?");
                        $sc->execute([$id]);
                        if ((int)$sc->fetchColumn() > 0) {
                            $oc = $pdo->prepare("SELECT customer_name FROM deliveries WHERE id = ?");
                            $oc->execute([$id]);
                            if ($oc->fetchColumn() !== trim($input['customerName'])) {
                                fail(409, 'This delivery has multiple customers, so the main customer cannot be changed yet.');
                            }
                        }
                        $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Pending';
                        $driver = trim($input['driverAssign'] ?? '') ?: null;

                        // Bawal i-mark na Delivered kung walang proof photo (rider upload)
                        if ($status === 'Delivered' && empty($old['proof_image'])) {
                            fail(409, 'Cannot mark as Delivered without a proof photo. The rider must upload it from the Rider page.');
                        }
        
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

                        if ($status === 'Delivered' && empty($old['proof_image'])) {
                            fail(409, 'Cannot mark as Delivered without a proof photo. The rider must upload it from the Rider page.');
                        }
        
                        $busy = driver_conflict($pdo, $driver, $status, $id);
                        if ($busy) {
                            fail(409, "Driver $driver already has an active delivery ({$busy['del_number']}). A driver can only handle one delivery at a time.");
                        }
        
                        $pdo->prepare("UPDATE deliveries SET status=? WHERE id=?")->execute([$status, $id]);
                    } else {
                        fail(400, 'Nothing to update');
                    }

                    // Itala ang oras ng pagka-Delivered; burahin kapag binuksan ulit
                    $pdo->prepare(
                        "UPDATE deliveries SET delivered_at = IF(? = 'Delivered', COALESCE(delivered_at, ?), NULL) WHERE id = ?"
                    )->execute([$status, date('Y-m-d H:i:s'), $id]);

                    // Binuksan ulit ang batch: gawing Pending muli ang mga stop
                    if ($status !== 'Delivered') {
                        $pdo->prepare(
                            "UPDATE delivery_stops SET status = 'Pending', delivered_at = NULL, proof_image = NULL, rider_notes = NULL
                             WHERE delivery_id = ? AND status = 'Delivered'"
                        )->execute([$id]);
                    }
        
                    // Itala sa history kung nagbago ang status
                    if ($status !== $old['status']) {
                        log_delivery_event($pdo, $id, $status, 'Status changed from ' . $old['status'] . ' to ' . $status);
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
                        $pdo->prepare("DELETE FROM delivery_events WHERE delivery_id = ?")->execute([$id]);
                        $pdo->prepare("DELETE FROM delivery_stops WHERE delivery_id = ?")->execute([$id]);
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