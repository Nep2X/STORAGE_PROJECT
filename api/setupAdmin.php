<?php
// ISANG BESES LANG GAMITIN: gumagawa ng unang Admin account.
// Pagkatapos, BURAHIN ANG FILE NA ITO.

require_once __DIR__ . '/../db.php';

function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

$message = '';
$error   = '';
$done    = false;

try {
    $count = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
} catch (PDOException $e) {
    $count = -1;
    $error = 'The "users" table does not exist yet. Run the CREATE TABLE users SQL in phpMyAdmin first.';
}

if ($count > 0) {
    http_response_code(403);
    $error = 'Setup is already done. Please delete setup_admin.php from the project folder.';
} elseif ($count === 0 && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $name     = trim($_POST['full_name'] ?? '');
    $email    = trim($_POST['email'] ?? '');
    $password = (string)($_POST['password'] ?? '');
    $confirm  = (string)($_POST['confirm'] ?? '');

    if (!preg_match('/^[A-Za-z0-9_.-]{3,30}$/', $username)) {
        $error = 'Username must be 3-30 characters (letters, numbers, . _ -).';
    } elseif ($name === '') {
        $error = 'Full name is required.';
    } elseif ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Enter a valid email.';
    } elseif (strlen($password) < 8) {
        $error = 'Password must be at least 8 characters.';
    } elseif ($password !== $confirm) {
        $error = 'Passwords do not match.';
    } else {
        $stmt = $pdo->prepare(
            "INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?,?,?,?, 'Admin')"
        );
        $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT), $name, $email ?: null]);
        $done = true;
        $message = 'Admin account created. DELETE setup_admin.php now, then log in.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>First-time Setup</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f4f7fa; display: flex; justify-content: center; padding: 40px 16px; }
        .box { width: 400px; max-width: 100%; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 28px; }
        h1 { margin: 0 0 6px; font-size: 20px; }
        p { color: #6b7280; font-size: 14px; }
        label { display: block; margin: 14px 0 6px; font-weight: 600; font-size: 14px; }
        input { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; font: inherit; }
        button { width: 100%; margin-top: 20px; padding: 12px; border: 0; border-radius: 8px; background: #1f3a5f; color: #fff; font: inherit; cursor: pointer; }
        .err { background: #fbe9e7; color: #c0392b; padding: 10px 12px; border-radius: 8px; margin-top: 14px; font-size: 14px; }
        .ok  { background: #e4f5ec; color: #1b6b43; padding: 10px 12px; border-radius: 8px; margin-top: 14px; font-size: 14px; }
    </style>
</head>
<body>
    <div class="box">
        <h1>First-time Setup</h1>
        <p>Create the first Admin account.</p>

        <?php if ($error): ?><div class="err"><?= h($error) ?></div><?php endif; ?>
        <?php if ($message): ?><div class="ok"><?= h($message) ?> <a href="login.html">Go to login</a></div><?php endif; ?>

        <?php if ($count === 0 && !$done): ?>
        <form method="post" autocomplete="off">
            <label for="username">Username</label>
            <input id="username" name="username" value="<?= h($_POST['username'] ?? 'admin') ?>" required>

            <label for="full_name">Full name</label>
            <input id="full_name" name="full_name" value="<?= h($_POST['full_name'] ?? '') ?>" required>

            <label for="email">Email (optional)</label>
            <input id="email" name="email" type="email" value="<?= h($_POST['email'] ?? '') ?>">

            <label for="password">Password (min. 8 characters)</label>
            <input id="password" name="password" type="password" required>

            <label for="confirm">Confirm password</label>
            <input id="confirm" name="confirm" type="password" required>

            <button type="submit">Create Admin</button>
        </form>
        <?php endif; ?>
    </div>
</body>
</html>