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

function fail_fields($code, $msg, array $fields) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg, 'fields' => $fields]);
    exit;
}

// Kunin at i-validate ang address: Street / Building, Town / City, Province
function read_address(array $input): array {
    $clean = fn($v) => trim(preg_replace('/\s+/', ' ', (string)$v));
    if (trim((string)($input['name'] ?? '')) === '' || trim((string)($input['contact'] ?? '')) === '') {
        fail(422, 'Please fill in all required fields (customer name and contact number).');
    }
    $street   = $clean($input['street'] ?? '');
    $city     = $clean(str_replace(',', ' ', (string)($input['city'] ?? '')));       // kuwit ang naghihiwalay sa mga bahagi
    $province = $clean(str_replace(',', ' ', (string)($input['province'] ?? '')));

    $missing = [];
    if (mb_strlen($street) < 3)   $missing[] = 'street';
    if (mb_strlen($city) < 2)     $missing[] = 'city';
    if (mb_strlen($province) < 2) $missing[] = 'province';
    if ($missing) {
        fail_fields(422, 'Please complete the address: street / building, town / city, and province.', $missing);
    }

    $full = "$street, $city, $province";
    if (mb_strlen($full) > 255) {
        fail_fields(422, 'The address is too long (max 255 characters).', ['street']);
    }

    return ['street' => $street, 'city' => $city, 'province' => $province, 'full' => $full];
}

// Hanapin sa mapa (Pilipinas lang): buong address muna, tapos street + city lang.
// Return: [lat,lng] kung nakita, null kung hindi makita, false kung hindi ma-check ngayon.
function address_on_map(array $a) {
    $tries = [
        "{$a['street']}, {$a['city']}, {$a['province']}, Philippines",
        "{$a['street']}, {$a['city']}, Philippines",
    ];
    foreach ($tries as $i => $q) {
        if ($i > 0) sleep(1);                    // Nominatim: hindi hihigit sa 1 request kada segundo
        $pt = geocode_ph($q);
        if ($pt === false) return false;
        if (is_array($pt)) return $pt;
    }
    return null;
}

function check_address_or_fail(array $a): array {
    $found = address_on_map($a);
    if ($found === false) {
        fail(503, 'Could not check the address on the map right now. Please check the internet connection and try again.');
    }
    if ($found === null) {
        fail_fields(422, 'We could not find this address on the map (Philippines only). Check the street / building, town / city, and province.', ['street', 'city', 'province']);
    }
    return $found;   // ['lat' => .., 'lng' => ..]
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

            $addr = read_address($input);
            $pt = check_address_or_fail($addr);    // hanapin sa mapa bago i-save

            $stmt = $pdo->prepare("INSERT INTO customers (name, contact, address, lat, lng) VALUES (?,?,?,?,?)");
            $stmt->execute([trim($input['name']), $input['contact'] ?? null, $addr['full'], $pt['lat'], $pt['lng']]);
            echo json_encode(['ok' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'PUT':
            $id = (int)($_GET['id'] ?? 0);
            if (!$id) fail(400, 'Missing id');
            if (empty(trim($input['name'] ?? ''))) fail(400, 'Missing field: name');

            $addr = read_address($input);

            $stmt = $pdo->prepare("SELECT address, lat, lng FROM customers WHERE id = ?");
            $stmt->execute([$id]);
            $current = $stmt->fetch();
            if (!$current) fail(404, 'Customer not found.');

            $lat = $current['lat'];
            $lng = $current['lng'];
            // i-check sa mapa kung nagbago ang address o wala pang coordinates
            if ($current['address'] !== $addr['full'] || $lat === null || $lng === null) {
                $pt = check_address_or_fail($addr);
                $lat = $pt['lat'];
                $lng = $pt['lng'];
            }

            $stmt = $pdo->prepare("UPDATE customers SET name=?, contact=?, address=?, lat=?, lng=? WHERE id=?");
            $stmt->execute([trim($input['name']), $input['contact'] ?? null, $addr['full'], $lat, $lng, $id]);
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