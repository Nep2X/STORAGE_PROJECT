<?php
require_once __DIR__ . '/auth1.php';
require_login(ROLES_STAFF);

const THUMB_MAX = 160;   // pinakamalaking sukat ng thumbnail (px)

// Pangalan lang ng file ang tinatanggap, kaya hindi pwedeng tumakas sa folder
$name = $_GET['f'] ?? '';
if (!preg_match('/^proof_\d+_[a-f0-9]{12}\.(jpg|png|webp)$/', $name)) {
    http_response_code(400);
    exit;
}

$dir      = __DIR__ . '/../uploads/proofs';
$src      = $dir . '/' . $name;
$thumbDir = $dir . '/thumbs';
$thumb    = $thumbDir . '/' . pathinfo($name, PATHINFO_FILENAME) . '.jpg';

if (!is_file($src)) {
    http_response_code(404);
    exit;
}

function send_image($file) {
    header('Content-Type: image/jpeg');
    header('Content-Length: ' . filesize($file));
    header('Cache-Control: private, max-age=2592000');
    readfile($file);
    exit;
}

// Kapag hindi makagawa ng thumbnail, ibigay na lang ang orihinal
function fall_back($name) {
    header('Location: ../uploads/proofs/' . rawurlencode($name));
    exit;
}

// May thumbnail na, ibigay agad
if (is_file($thumb)) send_image($thumb);

if (!function_exists('imagecreatetruecolor')) fall_back($name);   // walang GD

$info = @getimagesize($src);
if (!$info) fall_back($name);
[$w, $h] = $info;
if ($w * $h > 40000000) fall_back($name);   // masyadong malaki, baka maubusan ng memory

switch ($info[2]) {
    case IMAGETYPE_JPEG: $img = @imagecreatefromjpeg($src); break;
    case IMAGETYPE_PNG:  $img = @imagecreatefrompng($src);  break;
    case IMAGETYPE_WEBP: $img = function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($src) : false; break;
    default:             $img = false;
}
if (!$img) fall_back($name);

// Ayusin ang pagkakaikot ng litrato mula sa cellphone (EXIF)
if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
    $exif  = @exif_read_data($src);
    $angle = [3 => 180, 6 => -90, 8 => 90][$exif['Orientation'] ?? 1] ?? 0;
    if ($angle) {
        $rot = imagerotate($img, $angle, 0);
        if ($rot) $img = $rot;
    }
}

$w = imagesx($img);
$h = imagesy($img);
$scale = min(1, THUMB_MAX / max($w, $h));
$tw = max(1, (int) round($w * $scale));
$th = max(1, (int) round($h * $scale));

$out = imagecreatetruecolor($tw, $th);
imagefill($out, 0, 0, imagecolorallocate($out, 255, 255, 255));   // puting background para sa PNG/WEBP
imagecopyresampled($out, $img, 0, 0, 0, 0, $tw, $th, $w, $h);

if (!is_dir($thumbDir)) @mkdir($thumbDir, 0755, true);
$tmp = $thumb . '.tmp' . bin2hex(random_bytes(3));
if (!@imagejpeg($out, $tmp, 80)) fall_back($name);
rename($tmp, $thumb);

send_image($thumb);