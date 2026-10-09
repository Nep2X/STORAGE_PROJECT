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
