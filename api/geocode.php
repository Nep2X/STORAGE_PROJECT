<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';
require_login(ROLES_STAFF);
header('Content-Type: application/json');

function geo_fail(int $code, string $msg): void {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

function address_parts(array $a): array {
    $street = trim(($a['house_number'] ?? '') . ' ' . ($a['road'] ?? ''));
    if ($street === '') {
        $street = $a['name'] ?? $a['suburb'] ?? $a['neighbourhood'] ?? '';
    }
    $city = $a['city'] ?? $a['town'] ?? $a['municipality'] ?? $a['village'] ?? $a['county'] ?? '';
    $province = $a['state'] ?? $a['province'] ?? $a['region'] ?? '';

    return [
        'street' => $street,
        'city' => $city,
        'province' => $province,
    ];
}

// Nominatim policy: max 1 request per second.
$now = microtime(true);
if (isset($_SESSION['geocode_last']) && $now - (float)$_SESSION['geocode_last'] < 1.0) {
    usleep((int)((1.0 - ($now - (float)$_SESSION['geocode_last'])) * 1000000));
}
$_SESSION['geocode_last'] = microtime(true);

$reverse = ($_GET['reverse'] ?? '') === '1';
$q = trim((string)($_GET['q'] ?? ''));

if ($reverse) {
    $lat = $_GET['lat'] ?? '';
    $lng = $_GET['lng'] ?? '';

    if (!is_numeric($lat) || !is_numeric($lng)) {
        geo_fail(422, 'Missing coordinates.');
    }

    $lat = (float)$lat;
    $lng = (float)$lng;

    if ($lat < 4 || $lat > 22 || $lng < 116 || $lng > 127) {
        geo_fail(422, 'The pin must be inside the Philippines.');
    }

    $url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=en'
         . '&lat=' . rawurlencode((string)$lat)
         . '&lon=' . rawurlencode((string)$lng);

    $json = http_get($url);
    if ($json === false || $json === '') {
        geo_fail(503, 'Could not reach the map service.');
    }

    $r = json_decode($json, true);
    if (!is_array($r) || empty($r['lat']) || empty($r['lon'])) {
        geo_fail(404, 'No address found for this pin.');
    }

    $cc = strtolower($r['address']['country_code'] ?? 'ph');
    if ($cc !== 'ph') {
        geo_fail(422, 'The pin must be inside the Philippines.');
    }

    echo json_encode([
        'ok' => true,
        'result' => [
            'lat' => (float)$r['lat'],
            'lng' => (float)$r['lon'],
            'label' => $r['display_name'] ?? '',
            'address' => address_parts($r['address'] ?? []),
        ],
    ]);
    exit;
}

if (mb_strlen($q) < 3) {
    geo_fail(422, 'Type at least 3 characters.');
}

$url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ph&accept-language=en&q=' . urlencode($q);

$json = http_get($url);
if ($json === false || $json === '') {
    geo_fail(503, 'Could not reach the map service.');
}

$rows = json_decode($json, true);
if (!is_array($rows)) {
    geo_fail(503, 'The map service returned an invalid response.');
}

$results = [];
foreach ($rows as $r) {
    $cc = strtolower($r['address']['country_code'] ?? 'ph');
    if ($cc !== 'ph') continue;
    if (empty($r['lat']) || empty($r['lon'])) continue;

    $results[] = [
        'lat' => (float)$r['lat'],
        'lng' => (float)$r['lon'],
        'label' => $r['display_name'] ?? '',
        'address' => address_parts($r['address'] ?? []),
    ];
}

echo json_encode(['ok' => true, 'results' => $results]);