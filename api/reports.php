<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';
require_login(ROLES_STAFF);
header('Content-Type: application/json');

$STATUSES = ['Pending', 'Processing', 'Out for Delivery', 'Delivered', 'Cancelled'];

$from = $_GET['from'] ?? '';
$to   = $_GET['to'] ?? '';
$isDate = fn($d) => preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) === 1;

$where  = [];
$params = [];
if ($isDate($from)) { $where[] = 'del_date >= ?'; $params[] = $from; }
if ($isDate($to))   { $where[] = 'del_date <= ?'; $params[] = $to; }
$w = $where ? 'WHERE ' . implode(' AND ', $where) : '';

function rows($pdo, $sql, $params) {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function toInts($list, $keys) {
    return array_map(function ($r) use ($keys) {
        foreach ($keys as $k) $r[$k] = (int)$r[$k];
        return $r;
    }, $list);
}

try {
    // ---------- Summary ----------
    $counts = array_fill_keys($STATUSES, 0);
    foreach (rows($pdo, "SELECT status, COUNT(*) AS c FROM deliveries $w GROUP BY status", $params) as $r) {
        $counts[$r['status']] = (int)$r['c'];
    }
    $total = array_sum($counts);

    // ---------- Bawat driver ----------
    $byDriver = toInts(rows($pdo,
        "SELECT COALESCE(NULLIF(driver_name,''), 'Unassigned') AS name,
                COUNT(*) AS total,
                SUM(status = 'Delivered') AS delivered,
                SUM(status = 'Cancelled') AS cancelled
         FROM deliveries $w
         GROUP BY name ORDER BY total DESC, name", $params),
        ['total', 'delivered', 'cancelled']);

    // ---------- Bawat customer ----------
    $byCustomer = toInts(rows($pdo,
        "SELECT customer_name AS name,
                COUNT(*) AS total,
                SUM(status = 'Delivered') AS delivered,
                SUM(status = 'Cancelled') AS cancelled
         FROM deliveries $w
         GROUP BY customer_name ORDER BY total DESC, name", $params),
        ['total', 'delivered', 'cancelled']);

    // ---------- Bawat buwan (may petsa lang) ----------
    $w2 = $where ? $w . ' AND del_date IS NOT NULL' : 'WHERE del_date IS NOT NULL';
    $byMonth = toInts(rows($pdo,
        "SELECT DATE_FORMAT(del_date, '%Y-%m') AS ym,
                COUNT(*) AS total,
                SUM(status = 'Delivered') AS delivered,
                SUM(status = 'Cancelled') AS cancelled
         FROM deliveries $w2
         GROUP BY ym ORDER BY ym DESC", $params),
        ['total', 'delivered', 'cancelled']);

    // ---------- Buong listahan (para sa CSV export) ----------
    $deliveries = rows($pdo,
        "SELECT del_number, customer_name, address, contact, del_date, driver_name,
                vehicle, item_desc, quantity, status, remarks
         FROM deliveries $w
         ORDER BY del_date DESC, id DESC", $params);

    echo json_encode([
        'ok'          => true,
        'total'       => $total,
        'counts'      => $counts,
        'by_driver'   => $byDriver,
        'by_customer' => $byCustomer,
        'by_month'    => $byMonth,
        'deliveries'  => $deliveries,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}