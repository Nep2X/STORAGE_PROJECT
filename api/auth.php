<?php

// ============================================================
// AUTH.PHP
// Login / Logout / Profile / Change Password API
// ============================================================

define('AUTH_WRITE', true);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';

header('Content-Type: application/json; charset=utf-8');

date_default_timezone_set('Asia/Manila');


// ------------------------------------------------------------
// Request information
// ------------------------------------------------------------
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';


// ------------------------------------------------------------
// Read JSON request body
// ------------------------------------------------------------
$rawInput = file_get_contents('php://input');

$input = json_decode($rawInput, true);

if (!is_array($input)) {
    $input = [];
}


// ------------------------------------------------------------
// Login security settings
// ------------------------------------------------------------
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 300;


// ============================================================
// Helper: public user information
// ============================================================
function public_user($user) {
    return [
        'id' => (int)$user['id'],
        'username' => $user['username'],
        'full_name' => $user['full_name'],
        'email' => $user['email'],
        'contact_number' => $user['contact_number'] ?? null,
        'role' => $user['role'],
        'driver_id' => $user['driver_id'] !== null
            ? (int)$user['driver_id']
            : null,
        'last_login' => $user['last_login'] ?? null
    ];
}


// ============================================================
// Helper: redirect based on role
// ============================================================
function redirect_for($role) {
    if (in_array($role, ROLES_STAFF, true)) {
        return 'dashboard.html';
    }

    return 'rider.html';
}


// ============================================================
// MAIN
// ============================================================

try {

    // ========================================================
    // LOGIN
    // POST api/auth.php?action=login
    // ========================================================
    if ($method === 'POST' && $action === 'login') {

        $username = trim($input['username'] ?? '');
        $password = (string)($input['password'] ?? '');

        if ($username === '' || $password === '') {
            auth_fail(
                400,
                'Enter your username and password.'
            );
        }


        // ----------------------------------------------------
        // Find user
        // ----------------------------------------------------
        $stmt = $pdo->prepare(
            "SELECT * FROM users WHERE username = ? LIMIT 1"
        );

        $stmt->execute([$username]);

        $user = $stmt->fetch();


        // ----------------------------------------------------
        // Check account lock
        // ----------------------------------------------------
        if (
            $user &&
            !empty($user['locked_until']) &&
            strtotime($user['locked_until']) > time()
        ) {

            auth_fail(
                429,
                'Too many failed attempts. Please try again in a few minutes.'
            );
        }


        // ----------------------------------------------------
        // Verify password
        // ----------------------------------------------------
        $valid = (
            $user &&
            password_verify(
                $password,
                $user['password_hash']
            )
        );


        // ----------------------------------------------------
        // Incorrect username/password
        // ----------------------------------------------------
        if (!$valid) {

            if ($user) {

                $attempts =
                    (int)$user['failed_attempts'] + 1;


                if ($attempts >= MAX_ATTEMPTS) {

                    $lockedUntil = date(
                        'Y-m-d H:i:s',
                        time() + LOCK_SECONDS
                    );

                    $stmt = $pdo->prepare(
                        "UPDATE users
                         SET failed_attempts = 0,
                             locked_until = ?
                         WHERE id = ?"
                    );

                    $stmt->execute([
                        $lockedUntil,
                        $user['id']
                    ]);

                } else {

                    $stmt = $pdo->prepare(
                        "UPDATE users
                         SET failed_attempts = ?
                         WHERE id = ?"
                    );

                    $stmt->execute([
                        $attempts,
                        $user['id']
                    ]);
                }
            }


            // Small delay against password guessing
            usleep(400000);


            auth_fail(
                401,
                'Incorrect username or password.'
            );
        }


        // ----------------------------------------------------
        // Check if account is active
        // ----------------------------------------------------
        if (!(int)$user['is_active']) {

            auth_fail(
                403,
                'This account is disabled. Please contact the admin.'
            );
        }


        // ----------------------------------------------------
        // Regenerate session ID
        // ----------------------------------------------------
        session_regenerate_id(true);


        // ----------------------------------------------------
        // Save user to session
        // ----------------------------------------------------
        $_SESSION['user'] = [

            'id'        => (int)$user['id'],

            'username'  => $user['username'],

            'full_name' => $user['full_name'],

            'role'      => $user['role'],
        ];


        // ----------------------------------------------------
        // Update last login and reset failed attempts
        // ----------------------------------------------------
        $stmt = $pdo->prepare(
            "UPDATE users
             SET last_login = ?,
                 failed_attempts = 0,
                 locked_until = NULL
             WHERE id = ?"
        );

        $stmt->execute([
            date('Y-m-d H:i:s'),
            $user['id']
        ]);


        // ----------------------------------------------------
        // Successful login
        // ----------------------------------------------------
        echo json_encode([

            'ok' => true,

            'role' => $user['role'],

            'redirect' => redirect_for(
                $user['role']
            )

        ]);

        exit;
    }


    // ========================================================
    // LOGOUT
    // POST api/auth.php?action=logout
    // ========================================================
    if ($method === 'POST' && $action === 'logout') {

        // Remove session data
        $_SESSION = [];


        // Remove session cookie
        if (ini_get('session.use_cookies')) {

            $params = session_get_cookie_params();

            setcookie(
                session_name(),
                '',
                time() - 3600,
                $params['path'],
                $params['domain'],
                $params['secure'],
                $params['httponly']
            );
        }


        // Destroy session
        session_destroy();


        echo json_encode([
            'ok' => true
        ]);

        exit;
    }


    // ========================================================
    // From here, login is required
    // ========================================================
    $sessionUser = current_user();

    if (!$sessionUser) {

        auth_fail(
            401,
            'Please log in.'
        );
    }


    // --------------------------------------------------------
    // Get current user from database
    // --------------------------------------------------------
    $stmt = $pdo->prepare(
        "SELECT * FROM users WHERE id = ? LIMIT 1"
    );

    $stmt->execute([
        $sessionUser['id']
    ]);

    $user = $stmt->fetch();


    // --------------------------------------------------------
    // Account deleted or disabled
    // --------------------------------------------------------
    if (!$user || !(int)$user['is_active']) {

        $_SESSION = [];

        session_destroy();

        auth_fail(
            401,
            'Your session has ended. Please log in again.'
        );
    }


    // ========================================================
    // ME
    // GET api/auth.php?action=me
    // ========================================================
    if ($method === 'GET' && $action === 'me') {

        echo json_encode([

            'ok' => true,

            'user' => public_user($user)

        ]);

        exit;
    }


    // ========================================================
    // UPDATE PROFILE
    // POST api/auth.php?action=update_profile
    // ========================================================
    if (
        $method === 'POST' &&
        $action === 'update_profile'
    ) {

        $name = trim(
            $input['full_name'] ?? ''
        );

        $email = trim(
            $input['email'] ?? ''
        );


        if ($name === '') {

            auth_fail(
                400,
                'Name is required.'
            );
        }


        if (
            $email !== '' &&
            !filter_var(
                $email,
                FILTER_VALIDATE_EMAIL
            )
        ) {

            auth_fail(
                400,
                'Enter a valid email.'
            );
        }


        // Update database
        $stmt = $pdo->prepare(
            "UPDATE users
             SET full_name = ?,
                 email = ?
             WHERE id = ?"
        );

        $stmt->execute([

            $name,

            $email !== ''
                ? $email
                : null,

            $user['id']
        ]);


        // Update session
        $_SESSION['user']['full_name'] = $name;


        echo json_encode([
            'ok' => true
        ]);

        exit;
    }


    // ========================================================
    // CHANGE PASSWORD
    // POST api/auth.php?action=change_password
    // ========================================================
    if (
        $method === 'POST' &&
        $action === 'change_password'
    ) {

        $current = (string)(
            $input['current'] ?? ''
        );

        $new = (string)(
            $input['new'] ?? ''
        );


        // ----------------------------------------------------
        // Check current password
        // ----------------------------------------------------
        if (
            !password_verify(
                $current,
                $user['password_hash']
            )
        ) {

            auth_fail(
                400,
                'Current password is incorrect.'
            );
        }


        // ----------------------------------------------------
        // Minimum password length
        // ----------------------------------------------------
        if (strlen($new) < 8) {

            auth_fail(
                400,
                'New password must be at least 8 characters.'
            );
        }


        // ----------------------------------------------------
        // New password must be different
        // ----------------------------------------------------
        if ($new === $current) {

            auth_fail(
                400,
                'New password must be different from the current one.'
            );
        }


        // ----------------------------------------------------
        // Hash new password
        // ----------------------------------------------------
        $newHash = password_hash(
            $new,
            PASSWORD_DEFAULT
        );


        // ----------------------------------------------------
        // Save password
        // ----------------------------------------------------
        $stmt = $pdo->prepare(
            "UPDATE users
             SET password_hash = ?
             WHERE id = ?"
        );

        $stmt->execute([
            $newHash,
            $user['id']
        ]);


        // Regenerate session
        session_regenerate_id(true);


        echo json_encode([
            'ok' => true
        ]);

        exit;
    }


    // ========================================================
    // INVALID ACTION
    // ========================================================
    auth_fail(
        400,
        'Invalid request.'
    );


} catch (PDOException $e) {

    // Database error
    auth_fail(
        500,
        $e->getMessage()
    );
}