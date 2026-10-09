<?php
// Rider location reports.
//   POST (Rider/Driver): save my current location  {lat, lng, accuracy}  o  {address}
//   GET  (Admin/Employee): last reported location of every driver (kahit anong status ng delivery)
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
ini_set('display_errors', '0');   // para hindi masira ng PHP warning ang JSON; nasa error.log pa rin
date_default_timezone_set('Asia/Manila');

// HTTP GET gamit ang cURL (kung meron) o file_get_contents. Return string o false.
function http_get(string $url) {
    $ua = 'DeliveryProject/1.0 (XAMPP)';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 8,
            CURLOPT_USERAGENT      => $ua,
            CURLOPT_SSL_VERIFYPEER => false,   // luma ang CA bundle ng ibang XAMPP
        ]);
        $out = curl_exec($ch);
        curl_close($ch);
        return $out;
    }
    $ctx = stream_context_create(['http' => ['timeout' => 8, 'header' => "User-Agent: $ua\r\n"]]);
    return @file_get_contents($url, false, $ctx);
}

// Return: [lat,lng] kung may nakita, null kung walang match, false kung walang internet
function geocode_place(string $q) {
    $tries = [$q];
    if (stripos($q, 'philippines') === false && stripos($q, 'manila') === false) {
        $tries[] = $q . ', Metro Manila';
    }
    foreach ($tries as $t) {
        $json = http_get('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ph&q=' . urlencode($t));
        if ($json === false || $json === '') return false;
        $r = json_decode($json, true);
        if (!empty($r[0]['lat']) && !empty($r[0]['lon'])) return [(float)$r[0]['lat'], (float)$r[0]['lon']];
    }
    return null;
}

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

try {
    ensure_location_schema($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $user = require_login(ROLES_RIDER);
        $in  = json_decode(file_get_contents('php://input'), true) ?? [];
        $lat = filter_var($in['lat'] ?? null, FILTER_VALIDATE_FLOAT);
        $lng = filter_var($in['lng'] ?? null, FILTER_VALIDATE_FLOAT);
        $acc = filter_var($in['accuracy'] ?? null, FILTER_VALIDATE_FLOAT);

        // Fallback: lugar/address imbes na coordinates (hinahanap ng server)
        $place = trim((string)($in['address'] ?? ''));
        if ($place !== '' && ($lat === false || $lng === false)) {
            $pt = geocode_place($place);
            if ($pt === false) fail(502, 'Hindi maabot ng server ang map search (walang internet?). Subukan ulit mamaya, o gamitin ang GPS button.');
            if (!$pt)          fail(404, 'Hindi makita ang lugar na iyon. Subukan ang mas kumpletong pangalan, hal. "Pasig City Public Market, Pasig".');
            [$lat, $lng] = $pt;
            $acc = null;
        }
        if ($lat === false || $lng === false || $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
            fail(400, 'Invalid coordinates.');
        }
        $stmt = $pdo->prepare("SELECT driver_id FROM users WHERE id = ?");
        $stmt->execute([$user['id']]);
        $driverId = (int)$stmt->fetchColumn();
        if (!$driverId) fail(403, 'Your account is not linked to a driver. Please contact the admin.');

        // Naka-share lang ang location kapag may active delivery na naka-assign sa rider
        $stmt = $pdo->prepare("SELECT name FROM drivers WHERE id = ?");
        $stmt->execute([$driverId]);
        if (!active_delivery_of($pdo, (string)$stmt->fetchColumn())) {
            fail(409, 'You have no active delivery, so your location is not shared.');
        }
        $stmt = $pdo->prepare(
            "INSERT INTO rider_locations (driver_id, latitude, longitude, accuracy, reported_at)
             VALUES (?,?,?,?,?)"
        );
        $stmt->execute([$driverId, $lat, $lng, $acc === false ? null : $acc, date('Y-m-d H:i:s')]);

        // Paminsan-minsan (1 sa 100 save), burahin ang lumang records para hindi bumigat ang table.
        // Laging itinatago ang pinakahuling location ng bawat rider.
        if (random_int(1, 100) === 1) {
            $pdo->prepare(
                "DELETE FROM rider_locations
                 WHERE reported_at < ?
                   AND id NOT IN (SELECT keep_id FROM (SELECT MAX(id) AS keep_id FROM rider_locations GROUP BY driver_id) k)"
            )->execute([date('Y-m-d H:i:s', time() - LOCATION_KEEP_DAYS * 86400)]);
        }

        echo json_encode(['ok' => true, 'lat' => $lat, 'lng' => $lng]);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        require_login(ROLES_STAFF);
        // Huling report ng bawat driver, kahit anong status ng delivery nila
        $rows = $pdo->query(
            "SELECT d.id AS driver_id, d.name, d.contact, d.status,
                    l.latitude, l.longitude, l.accuracy, l.reported_at
             FROM drivers d
             JOIN rider_locations l ON l.id = (
                 SELECT id FROM rider_locations x
                 WHERE x.driver_id = d.id
                 ORDER BY x.reported_at DESC, x.id DESC LIMIT 1
             )
             ORDER BY d.name"
        )->fetchAll();
        // Kompyutin sa PHP (parehong timezone ng pag-save) para hindi mali kapag iba ang timezone ng MySQL
        $now = time();
        foreach ($rows as &$r) {
            $r['seconds_ago'] = max(0, $now - strtotime($r['reported_at']));
        }
        unset($r);
        echo json_encode(['ok' => true, 'riders' => $rows]);
        exit;
    }

    fail(405, 'Method not allowed.');
} catch (Throwable $e) {
    fail(500, safe_error($e));   // sa debug mode (config.php) makikita ang tunay na error
}
