<?php
// Database connection. Ang settings ay nasa config.php (hindi ina-upload sa GitHub).
// Kapag wala pang config.php, config.example.php ang gagamitin.

$__cfgFile = is_file(__DIR__ . '/config.php') ? __DIR__ . '/config.php' : __DIR__ . '/config.example.php';
$config = require $__cfgFile;
unset($__cfgFile);

if (!defined('APP_DEBUG'))          define('APP_DEBUG', (bool)($config['debug'] ?? false));
if (!defined('LOCATION_KEEP_DAYS')) define('LOCATION_KEEP_DAYS', max(1, (int)($config['location_keep_days'] ?? 7)));

// Mensaheng ligtas ipakita sa browser. Ang totoong error ay napupunta sa error.log.
if (!function_exists('safe_error')) {
    function safe_error(Throwable $e): string {
        error_log(get_class($e) . ': ' . $e->getMessage());
        return APP_DEBUG ? $e->getMessage() : 'Server error. Please try again later.';
    }
}

try {
    $pdo = new PDO(
        'mysql:host=' . $config['host'] . ';dbname=' . $config['name'] . ';charset=utf8mb4',
        $config['user'],
        $config['pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Cannot connect to the database. ' . safe_error($e)]);
    exit;
}

// =====================================================
// Mga helper para sa driver at delivery
// (isang driver = isang active delivery lang)
// =====================================================
const ACTIVE_DELIVERY_STATUSES = ['Pending', 'Processing', 'Out for Delivery'];

const COMPANY_LAT = 14.624556610241402;   // dapat kapareho ng COMPANY.lat sa live-map.js
const MAX_BATCH_STOPS = 5;                // pinakamaraming customer sa isang delivery

function customer_zone($lat): ?string {
    if ($lat === null || $lat === '') return null;
    return ((float)$lat >= COMPANY_LAT) ? 'North' : 'South';
}

function active_status_sql(): string {
    return "'" . implode("','", ACTIVE_DELIVERY_STATUSES) . "'";
}

// Ang active delivery ng driver (o null). Puwedeng i-exclude ang isang delivery id.
function active_delivery_of(PDO $pdo, ?string $driverName, int $excludeId = 0) {
    if ($driverName === null || $driverName === '') return null;

    $stmt = $pdo->prepare(
        "SELECT id, del_number FROM deliveries
         WHERE driver_name = ? AND status IN (" . active_status_sql() . ") AND id <> ?
         LIMIT 1"
    );
    $stmt->execute([$driverName, $excludeId]);

    return $stmt->fetch() ?: null;
}

// Para sa pag-assign: i-lock ang driver, tapos ibalik ang ibang active delivery niya (kung meron).
// Tawagin ito sa loob ng transaction.
function driver_conflict(PDO $pdo, ?string $driverName, string $newStatus, int $excludeId = 0) {
    if ($driverName === null || $driverName === '') return null;
    if (!in_array($newStatus, ACTIVE_DELIVERY_STATUSES, true)) return null;   // Delivered / Cancelled ay hindi binibilang

    $stmt = $pdo->prepare("SELECT id FROM drivers WHERE name = ? FOR UPDATE");
    $stmt->execute([$driverName]);
    $stmt->fetchAll();

    return active_delivery_of($pdo, $driverName, $excludeId);
}

// May active delivery = "On Route". Wala na = "Available" (kung On Route dati). Ang "Offline" ay hindi ginagalaw.
function sync_driver_status(PDO $pdo, ?string $driverName): void {
    if ($driverName === null || $driverName === '') return;

    if (active_delivery_of($pdo, $driverName) !== null) {
        $pdo->prepare("UPDATE drivers SET status = 'On Route' WHERE name = ?")->execute([$driverName]);
    } else {
        $pdo->prepare("UPDATE drivers SET status = 'Available' WHERE name = ? AND status = 'On Route'")->execute([$driverName]);
        clear_driver_locations($pdo, $driverName);   // tapos na ang delivery: alisin sa Live Map
    }
}

// Burahin ang mga naka-save na location ng driver (para mawala siya sa Live Map)
function clear_driver_locations(PDO $pdo, string $driverName): void {
    try {
        $pdo->prepare(
            "DELETE l FROM rider_locations l JOIN drivers d ON d.id = l.driver_id WHERE d.name = ?"
        )->execute([$driverName]);
    } catch (Throwable $e) {
        error_log('clear_driver_locations: ' . $e->getMessage());
    }
}

// Panuntunan sa status ng driver: "On Route" ay awtomatiko lang (kapag may active delivery)
function driver_status_error(PDO $pdo, string $driverName, string $newStatus): ?string {
    $busy = active_delivery_of($pdo, $driverName) !== null;

    if ($busy && $newStatus !== 'On Route') {
        return 'This driver has an active delivery, so the status stays "On Route".';
    }
    if (!$busy && $newStatus === 'On Route') {
        return '"On Route" is set automatically when the driver has an active delivery.';
    }
    return null;
}

// HTTP GET gamit ang cURL (kung meron) o file_get_contents. Return string o false.
if (!function_exists('http_get')) {
    function http_get(string $url) {
        $ua = 'DeliveryProject/1.0 (XAMPP)';
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 8,
                CURLOPT_USERAGENT      => $ua,
                CURLOPT_SSL_VERIFYPEER => false,   // luma ang CA bundle ng ibang XAMPP (para sa local lang)
            ]);
            $out = curl_exec($ch);
            curl_close($ch);
            return $out;
        }
        $ctx = stream_context_create(['http' => ['timeout' => 8, 'header' => "User-Agent: $ua\r\n"]]);
        return @file_get_contents($url, false, $ctx);
    }
}

// =====================================================
// DELIVERY HISTORY (log ng pagbabago ng status)
// =====================================================
date_default_timezone_set('Asia/Manila');

if (!function_exists('ensure_delivery_events')) {
    function ensure_delivery_events(PDO $pdo): void {
        try {
            $pdo->exec(
                "CREATE TABLE IF NOT EXISTS delivery_events (
                    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                    delivery_id INT NOT NULL,
                    status VARCHAR(30) NOT NULL,
                    note VARCHAR(500) NULL,
                    user_id INT UNSIGNED NULL,
                    username VARCHAR(50) NULL,
                    created_at DATETIME NOT NULL,
                    INDEX idx_delivery (delivery_id, id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
        } catch (Throwable $e) {
            error_log('ensure_delivery_events: ' . $e->getMessage());
        }
    }
}

if (!function_exists('log_delivery_event')) {
    function log_delivery_event(PDO $pdo, int $deliveryId, string $status, ?string $note = null): void {
        try {
            $user = function_exists('current_user') ? current_user() : null;

            if ($note !== null) {
                $note = function_exists('mb_substr')
                    ? mb_substr($note, 0, 480)
                    : substr($note, 0, 480);
            }

            $stmt = $pdo->prepare(
                "INSERT INTO delivery_events (delivery_id, status, note, user_id, username, created_at)
                 VALUES (?,?,?,?,?,?)"
            );
            $stmt->execute([
                $deliveryId,
                $status,
                $note,
                $user['id'] ?? null,
                $user['username'] ?? 'System',
                date('Y-m-d H:i:s'),
            ]);
        } catch (Throwable $e) {
            // Huwag ipa-crash ang pangunahing request kung nabigo ang logging.
            error_log('log_delivery_event: ' . $e->getMessage());
        }
    }
}

// =====================================================
// GEOCODING: PILIPINAS LANG
// Return: ['lat' => .., 'lng' => ..] kung may nakita, null kung walang match,
//         false kung walang internet o na-block ang request.
// =====================================================
if (!function_exists('geocode_ph')) {
    function geocode_ph(string $query) {
        $url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1'
             . '&countrycodes=ph&accept-language=en&q=' . urlencode($query);

        $json = http_get($url);
        if ($json === false || $json === '') return false;

        $r = json_decode($json, true);
        if (!is_array($r)) return false;                                   // hindi JSON (hal. na-block)

        if (empty($r[0]['lat']) || empty($r[0]['lon'])) return null;       // walang nakitang match

        // Tiyakin na nasa Pilipinas talaga ang resulta
        if (strtolower($r[0]['address']['country_code'] ?? '') !== 'ph') return null;

        return ['lat' => (float)$r[0]['lat'], 'lng' => (float)$r[0]['lon']];
    }
}