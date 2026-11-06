# Form Character Limits Implementation Plan

> **For the project owner:** Apply this plan one task at a time using Find/Replace. The assistant must not edit website files. After each task, run the listed local test and confirm before moving to the next task. Do not commit, push, or upload without explicit permission.

**Goal:** Every fillable text field has a character limit, and values over the limit cannot be saved to the database.

**Architecture:** A shared `api/limits.php` defines the limits once. Each API rejects over-limit values with `mb_strlen()` before insert/update, and each form uses `maxlength` (or `min`/`max` for quantity) so the user cannot normally type past the limit. Server checks are the real protection; client attributes are convenience.

**Tech Stack:** PHP 8.2 (XAMPP), MySQL, vanilla HTML/CSS/JS.

**Spec:** Approved in this session on 2026-11-06 (standard limits table + client-and-server enforcement). No separate spec file.

## Global Constraints

- Limits: name **80**, contact **20**, street **100**, city **60**, province **60**, vehicle **50**, item description **120**, remarks/rider notes **500**, username **30** (3–30), email **120**, password **8–72**, search boxes **60**, quantity **1–999**.
- Enforce on **add and edit**, for the main record and for dynamic extra-customer rows.
- Trim before checking and before saving. Do not silently truncate.
- Text checks use `mb_strlen()`; password max uses `strlen()` because bcrypt's 72 limit is bytes.
- No database schema changes. No changes to `config.php`, `uploads/`, geocode/map logic, image upload, or design.
- Customer address components must total at most 224 characters, below the existing `VARCHAR(255)`.
- Existing records longer than a new limit are not auto-shortened. Editing one requires shortening the field first. This is intentional.
- Search boxes are not saved; client `maxlength="60"` is enough. No server limit for search-only values.
- Use `D:\PROGRAMS\XAMP\php\php.exe` for PHP lint. Local site: `http://localhost/DELIVERY_PROJECT_MAP/`.
- After HTML/JS edits, hard refresh with `Ctrl+Shift+R`.
- Do not commit or push. The working agreement is Find/Replace instructions only.

## Review Focus

These are the failure modes most likely to break the feature. Each has a test in the task that owns the code.

1. **Multi-byte text** (ñ, emoji): HTML counts UTF-16 units, PHP `mb_strlen()` counts characters, MySQL counts characters. Test at the boundary.
2. **Trailing spaces**: a value at the limit plus trailing spaces must not slip past validation and then overflow the column. Trim before checking and saving.
3. **Dynamic extra-customer rows**: they are created by `deliveries.js`, so HTML edits alone do not cover them. Test after pressing “+ Add another customer”.
4. **Quantity is a number input**: `maxlength` does not apply. It needs `min`/`max` plus the server 1–999 check.
5. **Existing over-limit records**: editing must show a clear error, not truncate or crash.
6. **Password is bytes, not characters**: bcrypt only uses the first 72 bytes. Creation and password change enforce `strlen() > 72`; login does not, so legacy long passwords still work.
7. **API bypass**: removing `maxlength` in DevTools must still be rejected by the server.

## Limits Reference

| Field | Limit | Database column |
|---|---:|---|
| Customer / driver / full name | 80 | `VARCHAR(100)` |
| Contact number | 20 | `VARCHAR(20)` |
| Address — street / building | 100 | part of `VARCHAR(255)` |
| Address — town / city | 60 | part of `VARCHAR(255)` |
| Address — province | 60 | part of `VARCHAR(255)` |
| Vehicle | 50 | `VARCHAR(50)` |
| Item / description | 120 | `VARCHAR(255)` |
| Remarks / rider notes | 500 | `TEXT` |
| Username | 30 (3–30) | `VARCHAR(50)` |
| Email | 120 | `VARCHAR(150)` |
| Password | 8–72 | hash in `VARCHAR(255)` |
| Search box | 60 | not saved |
| Quantity | 1–999 | `INT` |

---

## Task 1: Shared limits module

**Files:**
- Create: `api/limits.php`

**Interfaces:**
- Produces: constants `LIMIT_NAME`, `LIMIT_CONTACT`, `LIMIT_STREET`, `LIMIT_CITY`, `LIMIT_PROVINCE`, `LIMIT_VEHICLE`, `LIMIT_ITEM`, `LIMIT_NOTES`, `LIMIT_USERNAME`, `LIMIT_EMAIL`, `LIMIT_PASSWORD_MIN`, `LIMIT_PASSWORD_MAX`, `LIMIT_SEARCH`, `LIMIT_QTY_MIN`, `LIMIT_QTY_MAX`.
- Produces: `limit_error(string $label, string $value, int $max): ?string` and `qty_error(int $qty): ?string`.

- [ ] **Step 1: Create `api/limits.php` with this exact content**

```php
<?php
// ============================================================
// LIMITS.PHP
// Isang lugar para sa haba ng mga fillable field.
// Ginagamit ito ng API (server-side); tinutugma ng
// maxlength / minlength / min / max sa HTML.
// ============================================================

const LIMIT_NAME          = 80;   // customer / driver / full name
const LIMIT_CONTACT       = 20;   // contact number
const LIMIT_STREET        = 100;  // address: street / building
const LIMIT_CITY          = 60;   // address: town / city
const LIMIT_PROVINCE      = 60;   // address: province
const LIMIT_VEHICLE       = 50;
const LIMIT_ITEM          = 120;  // item / description
const LIMIT_NOTES         = 500;  // remarks / rider notes
const LIMIT_USERNAME      = 30;
const LIMIT_EMAIL         = 120;
const LIMIT_PASSWORD_MIN  = 8;
const LIMIT_PASSWORD_MAX  = 72;   // bcrypt: bytes, not characters
const LIMIT_SEARCH        = 60;
const LIMIT_QTY_MIN       = 1;
const LIMIT_QTY_MAX       = 999;

// Return the error message, or null kapag kasya ang value.
// Trimmed value ang ipasa para hindi mabilang ang spaces sa dulo.
function limit_error(string $label, string $value, int $max): ?string {
    return mb_strlen($value) > $max
        ? "$label is too long (max $max characters)."
        : null;
}

// Return the error message kapag labas sa 1..999 ang quantity.
function qty_error(int $qty): ?string {
    if ($qty < LIMIT_QTY_MIN) return 'Quantity must be at least ' . LIMIT_QTY_MIN . '.';
    if ($qty > LIMIT_QTY_MAX) return 'Quantity must be at most ' . LIMIT_QTY_MAX . '.';
    return null;
}
```

- [ ] **Step 2: Lint the new file**

Run:

```powershell
& "D:\PROGRAMS\XAMP\php\php.exe" -l "D:\PROGRAMS\XAMP\htdocs\DELIVERY_PROJECT_MAP\api\limits.php"
```

Expected: `No syntax errors detected in ...\api\limits.php`

- [ ] **Step 3: Check the helper behavior from the command line**

Run:

```powershell
& "D:\PROGRAMS\XAMP\php\php.exe" -r "require 'D:/PROGRAMS/XAMP/htdocs/DELIVERY_PROJECT_MAP/api/limits.php'; echo limit_error('Vehicle', str_repeat('a', 51), LIMIT_VEHICLE), PHP_EOL; echo qty_error(1000), PHP_EOL;"
```

Expected output:

```text
Vehicle is too long (max 50 characters).
Quantity must be at most 999.
```

---

## Task 2: Customers API validation

**Files:**
- Modify: `api/customers.php`

**Interfaces:**
- Consumes: `LIMIT_NAME`, `LIMIT_CONTACT`, `LIMIT_STREET`, `LIMIT_CITY`, `LIMIT_PROVINCE`, `limit_error()` from Task 1.
- Produces: `read_address()` now returns `name` and `contact` together with the address parts.

- [ ] **Step 1: Load the limits file (1 match)**

Find:

```php
require_once __DIR__ . '/auth1.php';
require_login(ROLES_STAFF);
```

Replace:

```php
require_once __DIR__ . '/auth1.php';
require_once __DIR__ . '/limits.php';
require_login(ROLES_STAFF);
```

- [ ] **Step 2: Validate name and contact inside `read_address()` (1 match)**

Find:

```php
    $clean = fn($v) => trim(preg_replace('/\s+/', ' ', (string)$v));
    if (trim((string)($input['name'] ?? '')) === '' || trim((string)($input['contact'] ?? '')) === '') {
        fail(422, 'Please fill in all required fields (customer name and contact number).');
    }
    $street   = $clean($input['street'] ?? '');
```

Replace:

```php
    $clean = fn($v) => trim(preg_replace('/\s+/', ' ', (string)$v));
    $name    = trim((string)($input['name'] ?? ''));
    $contact = trim((string)($input['contact'] ?? ''));

    if ($name === '' || $contact === '') {
        fail(422, 'Please fill in all required fields (customer name and contact number).');
    }
    if ($msg = limit_error('Customer name', $name, LIMIT_NAME)) fail_fields(422, $msg, ['name']);
    if ($msg = limit_error('Contact number', $contact, LIMIT_CONTACT)) fail_fields(422, $msg, ['contact']);

    $street   = $clean($input['street'] ?? '');
```

- [ ] **Step 3: Validate the three address parts (1 match)**

Find:

```php
    $province = $clean(str_replace(',', ' ', (string)($input['province'] ?? '')));

    $missing = [];
```

Replace:

```php
    $province = $clean(str_replace(',', ' ', (string)($input['province'] ?? '')));

    if ($msg = limit_error('Street / building', $street, LIMIT_STREET)) fail_fields(422, $msg, ['street']);
    if ($msg = limit_error('Town / city', $city, LIMIT_CITY)) fail_fields(422, $msg, ['city']);
    if ($msg = limit_error('Province', $province, LIMIT_PROVINCE)) fail_fields(422, $msg, ['province']);

    $missing = [];
```

- [ ] **Step 4: Return the cleaned name and contact (1 match)**

Find:

```php
    return ['street' => $street, 'city' => $city, 'province' => $province, 'full' => $full];
```

Replace:

```php
    return [
        'name'     => $name,
        'contact'  => $contact !== '' ? $contact : null,
        'street'   => $street,
        'city'     => $city,
        'province' => $province,
        'full'     => $full,
    ];
```

- [ ] **Step 5: Remove the old POST-only name check (1 match)**

Find:

```php
        case 'POST':
            if (empty(trim($input['name'] ?? ''))) fail(400, 'Missing field: name');

            $addr = read_address($input);
```

Replace:

```php
        case 'POST':
            $addr = read_address($input);
```

- [ ] **Step 6: Save the cleaned values on POST (1 match)**

Find:

```php
            $stmt->execute([trim($input['name']), $input['contact'] ?? null, $addr['full'], $pt['lat'], $pt['lng']]);
```

Replace:

```php
            $stmt->execute([$addr['name'], $addr['contact'], $addr['full'], $pt['lat'], $pt['lng']]);
```

- [ ] **Step 7: Remove the old PUT-only name check (1 match)**

Find:

```php
            if (!$id) fail(400, 'Missing id');
            if (empty(trim($input['name'] ?? ''))) fail(400, 'Missing field: name');
```

Replace:

```php
            if (!$id) fail(400, 'Missing id');
```

- [ ] **Step 8: Save the cleaned values on PUT (1 match)**

Find:

```php
            $stmt->execute([trim($input['name']), $input['contact'] ?? null, $addr['full'], $lat, $lng, $id]);
```

Replace:

```php
            $stmt->execute([$addr['name'], $addr['contact'], $addr['full'], $lat, $lng, $id]);
```

- [ ] **Step 9: Lint**

Run:

```powershell
& "D:\PROGRAMS\XAMP\php\php.exe" -l "D:\PROGRAMS\XAMP\htdocs\DELIVERY_PROJECT_MAP\api\customers.php"
```

Expected: no syntax errors.

- [ ] **Step 10: Test server rejection**

1. Open `http://localhost/DELIVERY_PROJECT_MAP/customers.html`.
2. Press **Add Customer**.
3. Type a name made of 81 characters.
4. Fill contact `09171234567`, street `123 Shaw Blvd`, city `Pasig`, province `Metro Manila`.
5. Press **Save**.

Expected: red error **“Customer name is too long (max 80 characters).”**, the name field is highlighted, and no row is added.

Repeat with contact 21 characters, street 101, city 61, and province 61. Expected messages name the field and the max.

- [ ] **Step 11: Test the valid boundary**

1. Open **Add Customer** again.
2. Use a name of exactly 80 characters.
3. Use contact `09171234567` (11), street `123 Shaw Blvd`, city `Pasig`, province `Metro Manila`.
4. Click the pin map to set a location (this skips geocoding, so padding the address is safe).
5. Press **Save**.

Expected: saves successfully and the new row appears. No database error.

---

## Task 3: Customers form limits

**Files:**
- Modify: `customers.html`

- [ ] **Step 1: Add `maxlength` to the customer form fields**

Find each exact line below and add the attribute shown. Each line occurs exactly once.

| Find | Replace | Limit |
|---|---|---:|
| `<input type="text" id="customerSearch" placeholder="Search customer..." aria-label="Search customers">` | `<input type="text" id="customerSearch" placeholder="Search customer..." aria-label="Search customers" maxlength="60">` | 60 |
| `<input type="text" id="cusName" name="name" required>` | `<input type="text" id="cusName" name="name" maxlength="80" required>` | 80 |
| `<input type="text" id="cusContact" name="contact" placeholder="09XXXXXXXXX" required>` | `<input type="text" id="cusContact" name="contact" placeholder="09XXXXXXXXX" maxlength="20" required>` | 20 |
| `<input type="text" id="cusAddressSearch" placeholder="Type a street, building, or city..." autocomplete="off">` | `<input type="text" id="cusAddressSearch" placeholder="Type a street, building, or city..." autocomplete="off" maxlength="60">` | 60 |
| `<input type="text" id="cusStreet" name="street" placeholder="e.g. 123 Shaw Blvd, Unit 4B" autocomplete="off" required>` | `<input type="text" id="cusStreet" name="street" placeholder="e.g. 123 Shaw Blvd, Unit 4B" autocomplete="off" maxlength="100" required>` | 100 |
| `<input type="text" id="cusCity" name="city" placeholder="e.g. Pasig City" autocomplete="off" required>` | `<input type="text" id="cusCity" name="city" placeholder="e.g. Pasig City" autocomplete="off" maxlength="60" required>` | 60 |
| `<input type="text" id="cusProvince" name="province" placeholder="e.g. Metro Manila" autocomplete="off" required>` | `<input type="text" id="cusProvince" name="province" placeholder="e.g. Metro Manila" autocomplete="off" maxlength="60" required>` | 60 |

- [ ] **Step 2: Test the client limit**

1. Hard refresh `customers.html` (`Ctrl+Shift+R`).
2. Open **Add Customer**.
3. Paste 81 characters into **Customer Name**.

Expected: the field stops at 80 characters; the 81st is not accepted.

4. Paste 21 characters into **Contact**. Expected: stops at 20.
5. Paste 101 into **Street**. Expected: stops at 100.
6. Paste 61 into **City** and **Province**. Expected: stops at 60.
7. Check the search box: paste 61 characters. Expected: stops at 60.

- [ ] **Step 3: Test the server still rejects a bypass**

1. In DevTools → Elements, remove `maxlength="80"` from `#cusName`.
2. Type 81 characters and submit.

Expected: the server rejects with the same “max 80 characters” message and no row is added.

---

## Task 4: Drivers validation and form limits

**Files:**
- Modify: `api/drivers.php`
- Modify: `drivers.html`

**Interfaces:**
- Consumes: `LIMIT_NAME`, `LIMIT_CONTACT`, `limit_error()` from Task 1.

Driver creation happens through Settings, not this API (`POST` intentionally returns 405 and its code below is unreachable). Only the full edit path needs validation here.

- [ ] **Step 1: Load the limits file (1 match)**

Find:

```php
require_once __DIR__ . '/auth1.php';
require_login(ROLES_STAFF);
```

Replace:

```php
require_once __DIR__ . '/auth1.php';
require_once __DIR__ . '/limits.php';
require_login(ROLES_STAFF);
```

- [ ] **Step 2: Validate name and contact in the full edit path (1 match)**

Find:

```php
                $newName = trim($input['name']);
                if ($newName === '') fail(400, 'Missing field: name');
                $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Available';
```

Replace:

```php
                $newName = trim($input['name']);
                if ($newName === '') fail(400, 'Missing field: name');
                $newContact = trim((string)($input['contact'] ?? ''));
                if ($msg = limit_error('Driver name', $newName, LIMIT_NAME)) fail(400, $msg);
                if ($msg = limit_error('Contact number', $newContact, LIMIT_CONTACT)) fail(400, $msg);
                $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Available';
```

- [ ] **Step 3: Save the trimmed contact (1 match)**

Find:

```php
                $stmt->execute([$newName, $input['contact'] ?? null, $status, $id]);
```

Replace:

```php
                $stmt->execute([$newName, $newContact !== '' ? $newContact : null, $status, $id]);
```

- [ ] **Step 4: Lint**

Run:

```powershell
& "D:\PROGRAMS\XAMP\php\php.exe" -l "D:\PROGRAMS\XAMP\htdocs\DELIVERY_PROJECT_MAP\api\drivers.php"
```

- [ ] **Step 5: Test server rejection before adding the client limit**

1. Open `drivers.html` and edit any driver.
2. Type 81 characters in **Driver Name**.
3. Press **Save**.

Expected: alert **“Driver name is too long (max 80 characters).”** and no change.

4. Type 21 characters in **Contact** and save.

Expected: alert **“Contact number is too long (max 20 characters).”**

- [ ] **Step 6: Add `maxlength` to the drivers page**

Find each exact line and add the attribute shown. Each line occurs once.

| Find | Replace | Limit |
|---|---|---:|
| `<input type="text" id="driverSearch" placeholder="Search driver...">` | `<input type="text" id="driverSearch" placeholder="Search driver..." maxlength="60">` | 60 |
| `<input type="text" id="drvName" name="name" required>` | `<input type="text" id="drvName" name="name" maxlength="80" required>` | 80 |
| `<input type="text" id="drvContact" name="contact" placeholder="09XXXXXXXXX">` | `<input type="text" id="drvContact" name="contact" placeholder="09XXXXXXXXX" maxlength="20">` | 20 |

- [ ] **Step 7: Test the client limits**

1. Hard refresh `drivers.html`.
2. Edit a driver and paste 81 characters into the name. Expected: stops at 80.
3. Paste 21 into contact. Expected: stops at 20.
4. Search box: paste 61. Expected: stops at 60.
5. Save a normal edit. Expected: still works and the delivery/user name sync is unaffected.

---

## Task 5: Deliveries API validation

**Files:**
- Modify: `api/deliveries.php`

**Interfaces:**
- Consumes: `LIMIT_CONTACT`, `LIMIT_VEHICLE`, `LIMIT_ITEM`, `LIMIT_NOTES`, `limit_error()`, `qty_error()` from Task 1.
- Produces: `check_delivery_limits(array $input): void`.

- [ ] **Step 1: Load the limits file (1 match)**

Find:

```php
require_once __DIR__ . '/auth1.php';
require_login(ROLES_STAFF);
```

Replace:

```php
require_once __DIR__ . '/auth1.php';
require_once __DIR__ . '/limits.php';
require_login(ROLES_STAFF);
```

- [ ] **Step 2: Add the shared delivery validator after `fail()` (1 match)**

Find:

```php
function fail($code, $msg) {
    global $pdo;
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}
```

Replace:

```php
function fail($code, $msg) {
    global $pdo;
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    http_response_code($code);
    echo json_encode(['ok' => false, 'error' => $msg]);
    exit;
}

// Suriin ang haba ng mga fillable na text bago mag-save.
// Tinatawag ito sa POST at sa buong edit (PUT) ng delivery.
function check_delivery_limits(array $input): void {
    foreach ([
        ['Contact number', 'contactNumber', LIMIT_CONTACT],
        ['Vehicle', 'vehicle', LIMIT_VEHICLE],
        ['Item / description', 'itemDesc', LIMIT_ITEM],
        ['Remarks', 'remarks', LIMIT_NOTES],
    ] as [$label, $field, $max]) {
        $value = trim((string)($input[$field] ?? ''));
        if ($msg = limit_error($label, $value, $max)) {
            fail(422, $msg);
        }
    }

    if ($msg = qty_error((int)($input['quantity'] ?? 1))) {
        fail(422, $msg);
    }
}
```

- [ ] **Step 3: Use the validator on POST and replace the old quantity check (1 match)**

Find:

```php
                if ((int)$input['quantity'] < 1) fail(400, 'Quantity must be at least 1.');
                $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Pending';
```

Replace:

```php
                check_delivery_limits($input);
                $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Pending';
```

- [ ] **Step 4: Use the validator on the full edit path (1 match)**

Find:

```php
                        $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Pending';
                        $driver = trim($input['driverAssign'] ?? '') ?: null;

                        // Bawal i-mark na Delivered kung walang proof photo (rider upload)
```

Replace:

```php
                        $status = in_array($input['status'] ?? '', $STATUSES) ? $input['status'] : 'Pending';
                        $driver = trim($input['driverAssign'] ?? '') ?: null;

                        check_delivery_limits($input);

                        // Bawal i-mark na Delivered kung walang proof photo (rider upload)
```

- [ ] **Step 5: Validate each extra-customer row (1 match)**

Find:

```php
                                foreach ((array)($input['extraCustomers'] ?? []) as $e) {
                                    $extras[] = [
                                        'name' => trim((string)($e['customerName'] ?? '')),
                                        'item' => trim((string)($e['itemDesc'] ?? '')),
                                        'qty'  => (int)($e['quantity'] ?? 0),
                                    ];
                                }
```

Replace:

```php
                                foreach ((array)($input['extraCustomers'] ?? []) as $e) {
                                    $extra = [
                                        'name' => trim((string)($e['customerName'] ?? '')),
                                        'item' => trim((string)($e['itemDesc'] ?? '')),
                                        'qty'  => (int)($e['quantity'] ?? 0),
                                    ];
                                    if ($msg = limit_error('Item / description', $extra['item'], LIMIT_ITEM)) fail(422, $msg);
                                    if ($msg = qty_error($extra['qty'])) fail(422, $msg);
                                    $extras[] = $extra;
                                }
```

- [ ] **Step 6: Trim values before the POST insert (1 match)**

Find:

```php
                $stmt->execute([
                    trim($input['delNumber']), trim($input['customerName']),
                    $input['delAddress'] ?? null, $input['contactNumber'] ?? null,
                    ($input['delDate'] ?? '') ?: null,
                    $driver, $input['vehicle'] ?? null,
                    $input['itemDesc'] ?? null, (int)(($input['quantity'] ?? 1) ?: 1),
                    $input['remarks'] ?? null, $status,
                ]);
```

Replace:

```php
                $stmt->execute([
                    trim($input['delNumber']), trim($input['customerName']),
                    $input['delAddress'] ?? null, trim((string)($input['contactNumber'] ?? '')) ?: null,
                    ($input['delDate'] ?? '') ?: null,
                    $driver, trim((string)($input['vehicle'] ?? '')) ?: null,
                    trim((string)($input['itemDesc'] ?? '')) ?: null, (int)(($input['quantity'] ?? 1) ?: 1),
                    trim((string)($input['remarks'] ?? '')) ?: null, $status,
                ]);
```

- [ ] **Step 7: Trim values before the PUT update (1 match)**

Find:

```php
                        $stmt->execute([
                            trim($input['delNumber']), trim($input['customerName']),
                            $input['delAddress'] ?? null, $input['contactNumber'] ?? null,
                            ($input['delDate'] ?? '') ?: null,
                            $driver, $input['vehicle'] ?? null,
                            $input['itemDesc'] ?? null, (int)(($input['quantity'] ?? 1) ?: 1),
                            $input['remarks'] ?? null, $status, $id,
                        ]);
```

Replace:

```php
                        $stmt->execute([
                            trim($input['delNumber']), trim($input['customerName']),
                            $input['delAddress'] ?? null, trim((string)($input['contactNumber'] ?? '')) ?: null,
                            ($input['delDate'] ?? '') ?: null,
                            $driver, trim((string)($input['vehicle'] ?? '')) ?: null,
                            trim((string)($input['itemDesc'] ?? '')) ?: null, (int)(($input['quantity'] ?? 1) ?: 1),
                            trim((string)($input['remarks'] ?? '')) ?: null, $status, $id,
                        ]);
```

- [ ] **Step 8: Trim the main stop row item (1 match)**

Find:

```php
                                            'item'    => $i === 0 ? ($input['itemDesc'] ?? null) : $extras[$i - 1]['item'],
                                            'qty'     => $i === 0 ? (int)(($input['quantity'] ?? 1) ?: 1) : $extras[$i - 1]['qty'],
```

Replace:

```php
                                            'item'    => $i === 0 ? (trim((string)($input['itemDesc'] ?? '')) ?: null) : $extras[$i - 1]['item'],
                                            'qty'     => $i === 0 ? (int)(($input['quantity'] ?? 1) ?: 1) : $extras[$i - 1]['qty'],
```

- [ ] **Step 9: Lint**

Run:

```powershell
& "D:\PROGRAMS\XAMP\php\php.exe" -l "D:\PROGRAMS\XAMP\htdocs\DELIVERY_PROJECT_MAP\api\deliveries.php"
```

- [ ] **Step 10: Test server rejection on an existing delivery**

1. Open `deliveries.html` and edit an existing delivery.
2. Set **Vehicle** to 51 characters and save.

Expected: alert **“Vehicle is too long (max 50 characters).”**

3. Set **Item / Description** to 121 characters and save. Expected: **“Item / description is too long (max 120 characters).”**
4. Set **Remarks** to 501 characters and save. Expected: **“Remarks is too long (max 500 characters).”**
5. Set **Quantity** to `1000` and save. Expected: **“Quantity must be at most 999.”**
6. Close and reopen the delivery. Expected: the old values are intact; no partial update.

- [ ] **Step 11: Test extra-customer rejection**

1. Edit a delivery and press **+ Add another customer**.
2. Choose a customer, then type 121 characters in the extra **Item description**.
3. Fill quantity and save.

Expected: **“Item / description is too long (max 120 characters).”** and no rows change.

4. Set the extra quantity to `1000` and save. Expected: **“Quantity must be at most 999.”**

- [ ] **Step 12: Test a valid boundary save**

1. Edit a delivery and set vehicle to exactly 50 characters, item to exactly 120, remarks to exactly 500, and quantity to `999`.
2. Save.

Expected: saves successfully. Quantity `999` is displayed correctly.

---

## Task 6: Deliveries form and dynamic extra rows

**Files:**
- Modify: `deliveries.html`
- Modify: `deliveries.js`

- [ ] **Step 1: Add limits to the delivery form**

Find each exact line and add the attribute shown. Each line occurs once.

| Find | Replace | Limit |
|---|---|---:|
| `<input type="text" id="searchDelivery" placeholder="Search delivery..." aria-label="Search deliveries">` | `<input type="text" id="searchDelivery" placeholder="Search delivery..." aria-label="Search deliveries" maxlength="60">` | 60 |
| `<input type="text" id="vehicle" name="vehicle" placeholder="Vehicle plate / model" required>` | `<input type="text" id="vehicle" name="vehicle" placeholder="Vehicle plate / model" maxlength="50" required>` | 50 |
| `<input type="text" id="contactNumber" name="contactNumber" placeholder="09XXXXXXXXX" required>` | `<input type="text" id="contactNumber" name="contactNumber" placeholder="09XXXXXXXXX" maxlength="20" required>` | 20 |
| `<input type="text" id="itemDesc" name="itemDesc" placeholder="Item description" required>` | `<input type="text" id="itemDesc" name="itemDesc" placeholder="Item description" maxlength="120" required>` | 120 |
| `<input type="number" id="quantity" name="quantity" min="1" placeholder="0" required>` | `<input type="number" id="quantity" name="quantity" min="1" max="999" placeholder="0" required>` | 1–999 |
| `<textarea id="remarks" name="remarks" rows="3" placeholder="Optional notes"></textarea>` | `<textarea id="remarks" name="remarks" rows="3" placeholder="Optional notes" maxlength="500"></textarea>` | 500 |

- [ ] **Step 2: Add limits to dynamically created extra rows (1 match)**

Find:

```js
        <input type="text" class="xsItem" placeholder="Item description" required>
        <input type="number" class="xsQty" min="1" placeholder="Quantity" required>
```

Replace:

```js
        <input type="text" class="xsItem" maxlength="120" placeholder="Item description" required>
        <input type="number" class="xsQty" min="1" max="999" placeholder="Quantity" required>
```

- [ ] **Step 3: Test the main form**

1. Hard refresh `deliveries.html`.
2. Create or edit a delivery.
3. Paste 51 characters into **Vehicle**. Expected: stops at 50.
4. Paste 21 into **Contact Number**. Expected: stops at 20.
5. Paste 121 into **Item / Description**. Expected: stops at 120.
6. Paste 501 into **Remarks**. Expected: stops at 500.
7. Type `1000` in **Quantity**. Expected: the browser blocks submit and asks for a value no greater than 999.
8. Search box: paste 61. Expected: stops at 60.

- [ ] **Step 4: Test the dynamic row**

1. Press **+ Add another customer**.
2. Paste 121 characters into the new **Item description**. Expected: stops at 120.
3. Type `1000` into the new **Quantity**. Expected: submit is blocked; max is 999.
4. Remove the extra row and save a normal delivery. Expected: still works.

---

## Task 7: Users, profile, password, and login API validation

**Files:**
- Modify: `api/users.php`
- Modify: `api/auth.php`

**Interfaces:**
- Consumes: `LIMIT_NAME`, `LIMIT_CONTACT`, `LIMIT_EMAIL`, `LIMIT_USERNAME`, `LIMIT_PASSWORD_MIN`, `LIMIT_PASSWORD_MAX`, `limit_error()` from Task 1.

- [ ] **Step 1: Load the limits file in `users.php` (1 match)**

Find:

```php
require_once __DIR__ . '/auth1.php';

$me = require_login(['Admin']);
```

Replace:

```php
require_once __DIR__ . '/auth1.php';
require_once __DIR__ . '/limits.php';

$me = require_login(['Admin']);
```

- [ ] **Step 2: Enforce the password maximum in `checkPassword()` (1 match)**

Find:

```php
function checkPassword($password) {
    if (strlen((string)$password) < 8) {
        fail(400, 'Password must be at least 8 characters.');
    }
}
```

Replace:

```php
function checkPassword($password) {
    $length = strlen((string)$password);
    if ($length < LIMIT_PASSWORD_MIN) {
        fail(400, 'Password must be at least ' . LIMIT_PASSWORD_MIN . ' characters.');
    }
    if ($length > LIMIT_PASSWORD_MAX) {
        fail(400, 'Password must be at most ' . LIMIT_PASSWORD_MAX . ' characters.');
    }
}
```

- [ ] **Step 3: Validate user creation and use the username constant (1 match)**

Find:

```php
            if (!preg_match('/^[A-Za-z0-9_.-]{3,30}$/', $username)) {
                fail(400, 'Username must be 3-30 characters (letters, numbers, . _ -).');
            }

            checkPassword($password);
```

Replace:

```php
            if (!preg_match('/^[A-Za-z0-9_.-]{3,' . LIMIT_USERNAME . '}$/', $username)) {
                fail(400, 'Username must be 3-' . LIMIT_USERNAME . ' characters (letters, numbers, . _ -).');
            }

            if ($msg = limit_error('Full name', $name, LIMIT_NAME)) fail(400, $msg);
            if ($msg = limit_error('Email', $email, LIMIT_EMAIL)) fail(400, $msg);
            if ($msg = limit_error('Contact number', $contact, LIMIT_CONTACT)) fail(400, $msg);

            checkPassword($password);
```

- [ ] **Step 4: Validate user edits (1 match)**

Find:

```php
            $contact = trim($input['contact_number'] ?? ($target['contact_number'] ?? ''));
            $role = $input['role'] ?? $target['role'];
```

Replace:

```php
            $contact = trim($input['contact_number'] ?? ($target['contact_number'] ?? ''));
            $role = $input['role'] ?? $target['role'];

            if ($msg = limit_error('Full name', $name, LIMIT_NAME)) fail(400, $msg);
            if ($msg = limit_error('Email', $email, LIMIT_EMAIL)) fail(400, $msg);
            if ($msg = limit_error('Contact number', $contact, LIMIT_CONTACT)) fail(400, $msg);
```

- [ ] **Step 5: Load the limits file in `auth.php` (1 match)**

Find:

```php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';

header('Content-Type: application/json; charset=utf-8');
```

Replace:

```php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';
require_once __DIR__ . '/limits.php';

header('Content-Type: application/json; charset=utf-8');
```

- [ ] **Step 6: Reject over-limit login input without leaking which field failed (1 match)**

Find:

```php
        if ($username === '' || $password === '') {
            auth_fail(
                400,
                'Enter your username and password.'
            );
        }
```

Replace:

```php
        if ($username === '' || $password === '') {
            auth_fail(
                400,
                'Enter your username and password.'
            );
        }

        // Sobrang habang username: hindi na kailangang mag-query sa database.
        // Huwag limitahan ang password dito: ang lumang password na mas mahaba
        // sa 72 bytes ay dapat pa ring makapasok (bcrypt ang bahala sa verify).
        if (mb_strlen($username) > LIMIT_USERNAME) {
            auth_fail(
                401,
                'Incorrect username or password.'
            );
        }
```

- [ ] **Step 7: Validate the profile update (1 match)**

Find:

```php
        if ($name === '') {

            auth_fail(
                400,
                'Name is required.'
            );
        }
```

Replace:

```php
        if ($name === '') {

            auth_fail(
                400,
                'Name is required.'
            );
        }


        if ($msg = limit_error('Full name', $name, LIMIT_NAME)) {

            auth_fail(400, $msg);
        }


        if ($msg = limit_error('Email', $email, LIMIT_EMAIL)) {

            auth_fail(400, $msg);
        }
```

- [ ] **Step 8: Enforce the password maximum on change password (1 match)**

Find:

```php
        if (strlen($new) < 8) {

            auth_fail(
                400,
                'New password must be at least 8 characters.'
            );
        }
```

Replace:

```php
        $newLength = strlen($new);

        if ($newLength < LIMIT_PASSWORD_MIN) {

            auth_fail(
                400,
                'New password must be at least ' . LIMIT_PASSWORD_MIN . ' characters.'
            );
        }


        if ($newLength > LIMIT_PASSWORD_MAX) {

            auth_fail(
                400,
                'New password must be at most ' . LIMIT_PASSWORD_MAX . ' characters.'
            );
        }
```

- [ ] **Step 9: Lint both files**

Run:

```powershell
& "D:\PROGRAMS\XAMP\php\php.exe" -l "D:\PROGRAMS\XAMP\htdocs\DELIVERY_PROJECT_MAP\api\users.php"
& "D:\PROGRAMS\XAMP\php\php.exe" -l "D:\PROGRAMS\XAMP\htdocs\DELIVERY_PROJECT_MAP\api\auth.php"
```

Expected: no syntax errors.

- [ ] **Step 10: Test user creation rejection**

1. Open `settings.html` and press **Add User**.
2. Type 81 characters in **Full Name**; fill the rest with valid values and save.

Expected: alert **“Full name is too long (max 80 characters).”**

3. Email 121 characters → **“Email is too long (max 120 characters).”**
4. Contact 21 characters → **“Contact number is too long (max 20 characters).”**
5. Password 73 characters → **“Password must be at most 72 characters.”**
6. Username 31 characters → **“Username must be 3-30 characters (letters, numbers, . _ -).”**

- [ ] **Step 11: Test profile and password rejection**

1. Open **Profile**, type 81 characters in **Full Name**, save.
   Expected: **“Full name is too long (max 80 characters).”**
2. Set email to 121 characters and save. Expected: **“Email is too long (max 120 characters).”**
3. Open **Change Password**, enter the current password and a 73-character new password.
   Expected: **“New password must be at most 72 characters.”**
4. Verify the current password still works.

- [ ] **Step 12: Test login with over-limit input**

1. Log out.
2. Type a 31-character username and any password.
3. Press **Log In**.

Expected: **“Incorrect username or password.”** — not a PHP error and not a database error.

4. Log back in normally.

---

## Task 8: Settings and login form limits

**Files:**
- Modify: `settings.html`
- Modify: `login.html`

- [ ] **Step 1: Add limits to the profile and password forms**

Find each exact line and add the attribute shown. Each line occurs once.

| Find | Replace | Limit |
|---|---|---:|
| `<input type="text" id="profName" name="full_name" required>` | `<input type="text" id="profName" name="full_name" maxlength="80" required>` | 80 |
| `<input type="email" id="profEmail" name="email">` | `<input type="email" id="profEmail" name="email" maxlength="120">` | 120 |
| `<input type="password" id="curPw" autocomplete="current-password" required>` | `<input type="password" id="curPw" autocomplete="current-password" maxlength="72" required>` | 72 |
| `<input type="password" id="newPw" autocomplete="new-password" required>` | `<input type="password" id="newPw" autocomplete="new-password" minlength="8" maxlength="72" required>` | 8–72 |
| `<input type="password" id="confPw" autocomplete="new-password" required>` | `<input type="password" id="confPw" autocomplete="new-password" maxlength="72" required>` | 72 |

- [ ] **Step 2: Add limits to the user form**

Find each exact line and add the attribute shown. Each line occurs once.

| Find | Replace | Limit |
|---|---|---:|
| `<input type="text" id="uUsername" name="username" autocomplete="off" required>` | `<input type="text" id="uUsername" name="username" autocomplete="off" minlength="3" maxlength="30" required>` | 3–30 |
| `<input type="password" id="uPassword" name="password" minlength="8" autocomplete="new-password">` | `<input type="password" id="uPassword" name="password" minlength="8" maxlength="72" autocomplete="new-password">` | 8–72 |
| `<input type="text" id="uName" name="full_name" required>` | `<input type="text" id="uName" name="full_name" maxlength="80" required>` | 80 |
| `<input type="email" id="uEmail" name="email">` | `<input type="email" id="uEmail" name="email" maxlength="120">` | 120 |

`#uContact` already has `maxlength="20"`; no change.

- [ ] **Step 3: Add the reset-password limit**

Find:

```html
                        <input type="password" id="resetPw" autocomplete="new-password" required>
```

Replace:

```html
                        <input type="password" id="resetPw" autocomplete="new-password" minlength="8" maxlength="72" required>
```

- [ ] **Step 4: Make the password labels match the rule**

Find each exact line and replace.

| Find | Replace |
|---|---|
| `<label for="newPw">New Password (min. 8 characters)</label>` | `<label for="newPw">New Password (8-72 characters)</label>` |
| `<label for="resetPw">New Password (min. 8 characters)</label>` | `<label for="resetPw">New Password (8-72 characters)</label>` |
| `<small>Minimum of 8 characters</small>` | `<small>8-72 characters</small>` |

- [ ] **Step 5: Add limits to the login form**

Find each exact line and add the attribute shown. Each line occurs once.

| Find | Replace | Limit |
|---|---|---:|
| `<input type="text" id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" autofocus required>` | `<input type="text" id="username" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" autofocus maxlength="30" required>` | 30 |
| `<input type="password" id="password" name="password" autocomplete="current-password" required>` | `<input type="password" id="password" name="password" autocomplete="current-password" maxlength="72" required>` | 72 |

- [ ] **Step 6: Test settings limits**

1. Hard refresh `settings.html`.
2. Profile: paste 81 characters into **Full Name**. Expected: stops at 80.
3. Paste 121 into **Email**. Expected: stops at 120.
4. Change Password: paste 73 into **New Password** and **Confirm New Password**. Expected: stops at 72.
5. Add User: paste 31 into **Username**. Expected: stops at 30.
6. Paste 73 into **Password**. Expected: stops at 72.
7. Paste 81 into **Full Name**. Expected: stops at 80.
8. Paste 121 into **Email**. Expected: stops at 120.
9. Reset Password: paste 73. Expected: stops at 72.

- [ ] **Step 7: Test login limits**

1. Hard refresh `login.html`.
2. Paste 31 characters into **Username**. Expected: stops at 30.
3. Paste 73 characters into **Password**. Expected: stops at 72.
4. Log in normally. Expected: still works.

---

## Task 9: Rider notes and place search

**Files:**
- Modify: `api/rider.php`
- Modify: `rider.html`

**Interfaces:**
- Consumes: `LIMIT_NOTES`, `LIMIT_SEARCH`, `limit_error()` from Task 1.

- [ ] **Step 1: Load the limits file in `rider.php` (1 match)**

Find:

```php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';
$user = require_login(array_merge(ROLES_RIDER, ['Admin']));
```

Replace:

```php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/auth1.php';
require_once __DIR__ . '/limits.php';
$user = require_login(array_merge(ROLES_RIDER, ['Admin']));
```

- [ ] **Step 2: Validate the notes length (1 match)**

Find:

```php
        $notes  = trim($_POST['notes'] ?? '');
        if (!$id || $driver === '') fail(400, 'Missing delivery or driver.');
```

Replace:

```php
        $notes  = trim($_POST['notes'] ?? '');
        if ($msg = limit_error('Notes', $notes, LIMIT_NOTES)) fail(422, $msg);
        if (!$id || $driver === '') fail(400, 'Missing delivery or driver.');
```

- [ ] **Step 3: Add `maxlength` to the rider notes and place search**

Find each exact line and add the attribute shown. Each line occurs once.

| Find | Replace | Limit |
|---|---|---:|
| `<input type="text" id="placeInput" placeholder="e.g. Pasig Palengke, Pasig" autocomplete="off">` | `<input type="text" id="placeInput" placeholder="e.g. Pasig Palengke, Pasig" autocomplete="off" maxlength="60">` | 60 |
| `<textarea id="notes" rows="3" placeholder="e.g. Received by the guard"></textarea>` | `<textarea id="notes" rows="3" placeholder="e.g. Received by the guard" maxlength="500"></textarea>` | 500 |

- [ ] **Step 4: Lint**

Run:

```powershell
& "D:\PROGRAMS\XAMP\php\php.exe" -l "D:\PROGRAMS\XAMP\htdocs\DELIVERY_PROJECT_MAP\api\rider.php"
```

- [ ] **Step 5: Test server rejection**

1. Log in as a rider with an active delivery.
2. Open `rider.html`.
3. In DevTools → Console, run this (replace nothing; it reads the selected delivery):

```js
const fd = new FormData();
fd.append('id', document.getElementById('deliverySelect').value);
fd.append('notes', 'a'.repeat(501));
fetch('api/rider.php', { method: 'POST', body: fd })
  .then(async (r) => console.log(r.status, await r.json()));
```

Expected: `422` and `{ok: false, error: "Notes is too long (max 500 characters)."}`

Notes are checked before the photo, so no photo is needed for this rejection test.

- [ ] **Step 6: Test the client limits**

1. Hard refresh `rider.html`.
2. Paste 501 characters into **Notes**. Expected: stops at 500.
3. Paste 61 characters into the place search. Expected: stops at 60.
4. Submit a normal report with a photo and short notes. Expected: still works.

---

## Task 10: Employees search and whole-app audit

**Files:**
- Modify: `employees.html`

- [ ] **Step 1: Add the search limit**

Find:

```html
                <input type="text" id="employeeSearch" placeholder="Search employee..." aria-label="Search employees">
```

Replace:

```html
                <input type="text" id="employeeSearch" placeholder="Search employee..." aria-label="Search employees" maxlength="60">
```

- [ ] **Step 2: Test the search limit**

1. Hard refresh `employees.html`.
2. Paste 61 characters into the search box. Expected: stops at 60.
3. Type a normal name. Expected: filtering still works.

- [ ] **Step 3: Audit all forms**

Check each item and fix only if something is missing:

- [ ] Every free-text `input` in `customers.html`, `deliveries.html`, `drivers.html`, `settings.html`, `login.html`, `employees.html`, and `rider.html` has `maxlength` (or is `readonly`, `date`, `hidden`, `number`, `checkbox`, or `file`).
- [ ] Every `textarea` has `maxlength`.
- [ ] Every quantity input has `min="1"` and `max="999"`.
- [ ] Search boxes are limited to 60.
- [ ] Password inputs have `maxlength="72"`; new/reset password inputs also have `minlength="8"`.
- [ ] Dynamic extra-customer inputs in `deliveries.js` have `maxlength="120"` and `max="999"`.

- [ ] **Step 4: Final boundary test**

Use disposable test records and delete them afterward. For each module, test one value at the limit and one over the limit:

| Module | At limit | Over limit |
|---|---|---|
| Customers | 80-char name, 20 contact, 100 street, 60 city, 60 province | 81 / 21 / 101 / 61 / 61 |
| Drivers | 80 name, 20 contact | 81 / 21 |
| Deliveries | 50 vehicle, 20 contact, 120 item, 500 remarks, 999 qty | 51 / 21 / 121 / 501 / 1000 |
| Settings | 80 name, 120 email, 30 username, 72 password | 81 / 121 / 31 / 73 |
| Rider | 500 notes | 501 |

Expected: at-limit values save; over-limit values are blocked by the browser, and also rejected by the server when `maxlength` is removed in DevTools.

- [ ] **Step 5: Edge-case tests**

1. **Multi-byte:** add a disposable customer whose name is exactly 80 `ñ` characters, with a map pin set. Expected: saves. Try 81. Expected: server rejects. Delete the test customer.
2. **Trailing spaces:** edit a delivery, remove `maxlength` from the vehicle field in DevTools, and set the value to 50 characters plus 10 trailing spaces. Save. Expected: the server trims it and saves exactly 50 characters; no database error.
3. **Existing over-limit record:** if an existing customer, driver, or user has a value longer than its new limit (check with phpMyAdmin), open it and save without shortening. Expected: a clear “too long” error and no truncation. If none exists, skip this check.
4. **Server bypass:** for Customers, Drivers, Deliveries, Settings, and Rider, remove the relevant `maxlength` in DevTools and submit an over-limit value. Expected: the same clear server error every time.

- [ ] **Step 6: Mobile table check**

1. Open DevTools device mode at 390px width.
2. Check Customers, Drivers, Employees, Deliveries, and Settings.
3. Confirm no horizontal table scrolling and no column stretching caused by the new limits.

Expected: card layout stays intact; long values wrap or truncate visually without widening the page.

---

## Plan Verification

Checked before handoff:

- All **64 Find blocks** (PHP/JS code blocks and HTML table rows) match the current files exactly.
- The plan was applied to temporary copies outside the project; every modified PHP file passed `php -l`.
- The extracted `api/limits.php` passed `php -l`, and the helper test returned the expected messages for text and quantity limits.
- No project website file was edited while preparing this plan.

## Rollback

If a task causes a problem, undo only that task's edits. The limits are independent per file, so reverting `api/limits.php` alone will break the APIs that require it; revert the requiring API edits first, then delete `api/limits.php`.

## Out of Scope

- No automatic shortening of existing over-limit records.
- No character counters or live remaining-character hints.
- No database schema changes.
- No server-side limit for search-only values (they are not saved).
- No changes to `api/setupAdmin.php`: it is a first-time setup page that must be deleted after creating the first admin.
- No changes to numeric latitude/longitude inputs: they already have range validation.
- No commit, push, or upload without explicit permission.
