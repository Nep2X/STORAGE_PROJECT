<?php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';
require_login(ROLES_STAFF);
header('Content-Type: application/json');
date_default_timezone_set('Asia/Manila');

$STATUSES = ['Pending', 'Processing', 'Out for Delivery', 'Delivered', 'Cancelled'];
$period   = $_GET['period'] ?? '7';

try {
    // ---------- Bilang bawat status (lahat ng panahon) ----------
    $counts = array_fill_keys($STATUSES, 0);
    foreach ($pdo->query("SELECT status, COUNT(*) AS c FROM deliveries GROUP BY status") as $row) {
        $counts[$row['status']] = (int)$row['c'];
    }
    $total = array_sum($counts);

    // ---------- Pinakabagong deliveries ----------
    $recent = $pdo->query(
        "SELECT del_number, customer_name, driver_name, del_date, status
         FROM deliveries
         ORDER BY del_date DESC, id DESC
         LIMIT 5"
    )->fetchAll();

    // ---------- Chart ----------
    $labels = [];
    $values = [];
    $today  = new DateTime('today');

    if ($period === 'year') {
        $year = (int)$today->format('Y');
        $stmt = $pdo->prepare(
            "SELECT MONTH(del_date) AS m, COUNT(*) AS c
             FROM deliveries WHERE YEAR(del_date) = ? GROUP BY m"
        );
        $stmt->execute([$year]);
        $byMonth = [];
        foreach ($stmt as $r) $byMonth[(int)$r['m']] = (int)$r['c'];

        $names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        for ($m = 1; $m <= 12; $m++) {
            $labels[] = $names[$m - 1];
            $values[] = $byMonth[$m] ?? 0;
        }
    } else {
        $days  = ($period === '30') ? 30 : 7;
        $start = (clone $today)->modify('-' . ($days - 1) . ' days');

        $stmt = $pdo->prepare(
            "SELECT del_date, COUNT(*) AS c FROM deliveries
             WHERE del_date BETWEEN ? AND ? GROUP BY del_date"
        );
        $stmt->execute([$start->format('Y-m-d'), $today->format('Y-m-d')]);
        $byDay = [];
        foreach ($stmt as $r) $byDay[$r['del_date']] = (int)$r['c'];

        if ($days === 7) {
            // Isang bar bawat araw
            for ($i = 0; $i < 7; $i++) {
                $d = (clone $start)->modify("+$i days");
                $labels[] = $d->format('D');
                $values[] = $byDay[$d->format('Y-m-d')] ?? 0;
            }
        } else {
            // 30 araw = 6 bars na tig-5 araw
            for ($b = 0; $b < 6; $b++) {
                $bucketStart = (clone $start)->modify('+' . ($b * 5) . ' days');
                $sum = 0;
                for ($i = 0; $i < 5; $i++) {
                    $d = (clone $bucketStart)->modify("+$i days");
                    $sum += $byDay[$d->format('Y-m-d')] ?? 0;
                }
                $labels[] = $bucketStart->format('M j');
                $values[] = $sum;
            }
        }
    }

    echo json_encode([
        'ok'     => true,
        'total'  => $total,
        'counts' => $counts,
        'recent' => $recent,
        'chart'  => ['labels' => $labels, 'values' => $values],
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => safe_error($e)]);
}