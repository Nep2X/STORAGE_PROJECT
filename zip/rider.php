<?php
require_once __DIR__ . '/../db.php';
header('Content-Type: application/json');
date_default_timezone_set('Asia/Manila');

const ACTIVE = ['Pending', 'Processing', 'Out for Delivery'];

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$activeSql = "'" . implode("','", ACTIVE) . "'";

try {
    // ---------- Listahan ng drivers (pangalan lang) ----------
    if ($method === 'GET' && $action === 'drivers') {
        $names = $pdo->query("SELECT name FROM drivers ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
        echo json_encode($names);
        exit;
    }

    // ---------- Mga delivery ng driver na hindi pa tapos ----------
    if ($method === 'GET' && $action === 'deliveries') {
        $driver = trim($_GET['driver'] ?? '');
        if ($driver === '') fail(400, 'Missing driver');

        $stmt = $pdo->prepare(
            "SELECT id, del_number, customer_name, address, contact, del_date,
                    vehicle, item_desc, quantity, remarks, status
             FROM deliveries
             WHERE driver_name = ? AND status IN ($activeSql)
             ORDER BY del_date, id"
        );
        $stmt->execute([$driver]);
        echo json_encode($stmt->fetchAll());
        exit;
    }

    // ---------- Mag-report ng successful delivery (may litrato) ----------
    if ($method === 'POST') {
        $id     = (int)($_POST['id'] ?? 0);
        $driver = trim($_POST['driver'] ?? '');
        $notes  = trim($_POST['notes'] ?? '');
        if (!$id || $driver === '') fail(400, 'Missing delivery or driver.');

        if (!isset($_FILES['photo'])) fail(400, 'Proof of delivery photo is required.');
        $f = $_FILES['photo'];

        if ($f['error'] !== UPLOAD_ERR_OK) {
            if ($f['error'] === UPLOAD_ERR_INI_SIZE || $f['error'] === UPLOAD_ERR_FORM_SIZE) {
                fail(413, 'Photo is too large.');
            }
            fail(400, 'Photo upload failed. Please try again.');
        }
        if ($f['size'] > 8 * 1024 * 1024) fail(413, 'Photo is too large (max 8 MB).');

        // Tingnan ang tunay na uri ng file (hindi ang extension)
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!isset($allowed[$mime]) || @getimagesize($f['tmp_name']) === false) {
            fail(415, 'Only JPG, PNG, or WEBP photos are allowed.');
        }

        // Tiyakin na sa driver ito at hindi pa tapos
        $stmt = $pdo->prepare("SELECT driver_name, status FROM deliveries WHERE id = ?");
        $stmt->execute([$id]);
        $del = $stmt->fetch();
        if (!$del) fail(404, 'Delivery not found.');
        if ($del['driver_name'] !== $driver) fail(403, 'This delivery is not assigned to you.');
        if (!in_array($del['status'], ACTIVE)) fail(409, 'This delivery is already ' . $del['status'] . '.');

        // Folder ng mga litrato
        $dir = __DIR__ . '/../uploads/proofs';
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        // Bawal patakbuhin ang kahit anong script sa folder na ito
        $ht = $dir . '/.htaccess';
        if (!file_exists($ht)) {
            file_put_contents($ht,
                "Options -Indexes\n" .
                "<FilesMatch \"\\.(php|phtml|php[0-9]|phar)$\">\n    Require all denied\n</FilesMatch>\n");
        }

        $filename = 'proof_' . $id . '_' . bin2hex(random_bytes(6)) . '.' . $allowed[$mime];
        if (!move_uploaded_file($f['tmp_name'], $dir . '/' . $filename)) {
            fail(500, 'Could not save the photo.');
        }

        $path = 'uploads/proofs/' . $filename;
        $stmt = $pdo->prepare(
            "UPDATE deliveries
             SET status = 'Delivered', proof_image = ?, delivered_at = ?, rider_notes = ?
             WHERE id = ? AND status IN ($activeSql)"
        );
        $stmt->execute([$path, date('Y-m-d H:i:s'), $notes ?: null, $id]);

        if ($stmt->rowCount() === 0) {
            @unlink($dir . '/' . $filename);
            fail(409, 'This delivery was already updated.');
        }

        echo json_encode(['ok' => true, 'proof' => $path]);
        exit;
    }

    fail(400, 'Invalid request.');
} catch (PDOException $e) {
    fail(500, $e->getMessage());
}