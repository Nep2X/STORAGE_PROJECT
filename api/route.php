<?php
// Active deliveries per rider + GPS trail ngayong araw (Admin/Employee lang)
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';
if (!function_exists('ensure_location_schema')) {
    function ensure_location_schema(PDO $pdo): void {
        try {
            $pdo->exec(
                "CREATE TABLE IF NOT EXISTS rider_locations (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    driver_id INT NOT NULL,
                    latitude DECIMAL(10,7) NOT NULL,
                    longitude DECIMAL(10,7) NOT NULL,
                    accuracy FLOAT NULL,
                    reported_at DATETIME NOT NULL,
                    INDEX idx_driver_time (driver_id, reported_at)
                )"
            );
            $need = [
                ['users',      'driver_id', 'INT UNSIGNED NULL'],
                ['deliveries', 'dest_lat',  'DECIMAL(10,7) NULL'],
                ['deliveries', 'dest_lng',  'DECIMAL(10,7) NULL'],
                ['deliveries', 'geo_tried', 'TINYINT(1) NOT NULL DEFAULT 0'],
            ];
            foreach ($need as [$table, $col, $def]) {
                $has = $pdo->query("SHOW COLUMNS FROM `$table` LIKE '$col'")->fetch();
                if (!$has) $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$col` $def");
            }
        } catch (Throwable $e) {
            error_log('ensure_location_schema: ' . $e->getMessage());
        }
    }
}
header('Content-Type: application/json');
date_default_timezone_set('Asia/Manila');
require_login(ROLES_STAFF);

// Return: [lat,lng] kung may nakita, null kung walang match, false kung walang internet
function geocode(string $q) {
    $json = http_get('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=' . urlencode($q));
    if ($json === false || $json === '') return false;   // walang internet
    $r = json_decode($json, true);
    if (!is_array($r)) return false;                     // hindi JSON (hal. na-block), subukan ulit mamaya
    if (!empty($r[0]['lat']) && !empty($r[0]['lon'])) return [(float)$r[0]['lat'], (float)$r[0]['lon']];
    return null;                                         // walang nakitang match
}

try {
    ensure_location_schema($pdo);
    $rows = $pdo->query(
        "SELECT dl.id, dl.del_number, dl.customer_name, dl.address,
                dl.dest_lat, dl.dest_lng, dl.geo_tried,
                d.id AS driver_id, d.name AS driver_name
         FROM deliveries dl
         JOIN drivers d ON d.name = dl.driver_name
         WHERE dl.status = 'Out for Delivery'
         ORDER BY dl.id"
    )->fetchAll();

    // I-geocode ang mga bagong address (max 3 kada request para hindi ma-block ng Nominatim)
    $budget = 3;
    foreach ($rows as &$r) {
        if ($budget <= 0) break;
        if ($r['dest_lat'] !== null || $r['geo_tried'] || trim((string)$r['address']) === '') continue;
        $budget--;
        $addr = trim($r['address']);
        $pt = geocode($addr . ', Philippines');
        if ($pt === false) break;                       // walang internet, subukan ulit mamaya
        if ($pt === null) {                             // subukan nang wala ang unang bahagi (house/unit no.)
            $parts = array_map('trim', explode(',', $addr));
            if (count($parts) > 2) {
                sleep(1);
                $pt = geocode(implode(', ', array_slice($parts, 1)) . ', Philippines');
                if ($pt === false) break;
            }
        }
        $pdo->prepare("UPDATE deliveries SET dest_lat=?, dest_lng=?, geo_tried=1 WHERE id=?")
            ->execute([$pt[0] ?? null, $pt[1] ?? null, $r['id']]);
        $r['dest_lat'] = $pt[0] ?? null;
        $r['dest_lng'] = $pt[1] ?? null;
        sleep(1);
    }
    unset($r);

    $routes = [];
    $trailStmt = $pdo->prepare(
        "SELECT latitude, longitude FROM rider_locations
         WHERE driver_id = ? AND reported_at >= ?
         ORDER BY reported_at, id LIMIT 2000"
    );
    foreach ($rows as $r) {
        $did = (int)$r['driver_id'];
        if (!isset($routes[$did])) {
            $trailStmt->execute([$did, date('Y-m-d 00:00:00')]);
            $trail = array_map(
                fn($p) => [(float)$p['latitude'], (float)$p['longitude']],
                $trailStmt->fetchAll()
            );
            $routes[$did] = ['driver_id' => $did, 'driver_name' => $r['driver_name'], 'trail' => $trail, 'stops' => []];
        }
        $routes[$did]['stops'][] = [
            'del_number'    => $r['del_number'],
            'customer_name' => $r['customer_name'],
            'address'       => $r['address'],
            'lat'           => $r['dest_lat'] !== null ? (float)$r['dest_lat'] : null,
            'lng'           => $r['dest_lng'] !== null ? (float)$r['dest_lng'] : null,
        ];
    }
    echo json_encode(['ok' => true, 'routes' => array_values($routes)]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => safe_error($e)]);
}