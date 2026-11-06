# InfinityFree Deployment Checklist

Status: **preparation only**. Wala pang file na ina-upload at walang live command na na-run.

## 0.1 Na-decide na

- [x] **Migrate ang local data**, hindi fresh database.
- [x] Live site: `https://delcomtracking.wuaze.com/`
- [x] I-fix muna ang `db.php` SSL verify bago upload.
- [x] I-migrate ang `users` table, kaya **hindi na kailangan** ang `api/setupAdmin.php` kung may existing admin account.
- [x] **Proof photos: i-upload ang 2 referenced photos lang.** Hindi kasama ang buong `uploads/` at ang unused photos.

## 0. Rules bago magsimula

- [ ] Huwag i-upload o i-commit ang `config.php`, `config - Copy.php`, at `uploads/`.
- [ ] Huwag i-print o i-paste sa chat ang DB password, FTP password, o laman ng `config.php`.
- [ ] Huwag mag-commit, push, upload, o mag-run ng live command nang walang explicit na go-ahead.
- [ ] Gawin ang deployment sa isang final window; i-freeze ang local code habang nag-a-upload.

## 1. Local backup at pre-flight

- [ ] I-export ang local database sa phpMyAdmin: **Export → Quick → SQL**.
- [ ] I-backup ang buong project folder, kasama ang `uploads/` (local proof photos).
- [ ] I-note ang current branch at commit hash:
  - branch: `BEFORE_PRESENTATION`
  - commit: `________________`
- [ ] I-run ang PHP lint sa lahat ng PHP files na i-upload.
- [ ] I-confirm na `debug => false` ang live config.
- [ ] I-confirm na wala sa package ang local secrets at local uploads.

Local lint command (huwag i-run sa live):

```powershell
Get-ChildItem -Recurse -Filter *.php | ForEach-Object { & "D:\PROGRAMS\XAMP\php\php.exe" -l $_.FullName }
```

## 2. InfinityFree account facts to collect

Ilagay sa password manager, **huwag sa chat**:

- [ ] Control Panel URL
- [ ] Live domain / free subdomain
- [ ] MySQL host (hindi `localhost`)
- [ ] MySQL database name (may prefix, hal. `if0_xxxx_delivery_db`)
- [ ] MySQL username (may prefix)
- [ ] MySQL password
- [ ] FTP host, username, password
- [ ] PHP version na naka-set sa control panel
- [ ] Naka-enable ba ang: `pdo_mysql`, `mbstring`, `curl`, `fileinfo`, `openssl`
- [ ] Naka-enable ba ang free SSL
- [ ] May outbound HTTPS ba papuntang `nominatim.openstreetmap.org`

Note: kung walang `curl`, dapat payagan ang `allow_url_fopen` para gumana ang `http_get()` fallback.

## 3. Upload package

### Handa nang local package

Lokasyon: `C:\Users\NEP\AppData\Local\Temp\opencode\delivery_deployment\`

```text
delcomtracking-site.zip
delcomtracking-database.zip
delcomtracking-proof-photos.zip
```

SHA256:

```text
63246D2554BC82AABF12D6726B8F359EBBF8189F71D79D8671E1B19F89171574  delcomtracking-site.zip
6982A2F037E9AEA2149344D1BF7E38EAFFDBA920D70F6F3821EFEF240B7C10E1  delcomtracking-database.zip
762D12B1AEC7F8DBD8E457613C4DDF7E1CF745D6AE8794994DD4EEDA7CD09072  delcomtracking-proof-photos.zip
```

Ang `delcomtracking-database.zip` ay may personal data at password hashes. Huwag itong i-commit, i-upload sa public folder, o i-share.

### Isama

Root files:

```text
.htaccess
app.js
theme.js
style.css
favicon.ico
index.html
login.html
login.js
dashboard.html
dashboard.js
dashScript.js
customers.html
customers.js
drivers.html
drivers.js
deliveries.html
deliveries.js
employees.html
employees.js
reports.html
reports.js
live-map.html
live-map.js
rider.html
rider.js
settings.html
settings.js
db.php
```

Directories:

```text
api/
assets/
```

`api/` files:

```text
api/auth.php
api/auth1.php
api/customers.php
api/dashboard.php
api/deliveries.php
api/drivers.php
api/geocode.php
api/limits.php
api/location.php
api/reports.php
api/rider.php
api/route.php
api/users.php
```

Temporary setup file lang:

```text
api/setupAdmin.php
```

### Huwag isama

```text
.git/
.opencode/
.qodo/
docs/
PRODUCT.md
README.md
README.txt
schema.sql
location_update.sql
config.php
config - Copy.php
config.example.php
ensure_schema.php
setup_admin.php
uploads/
```

Bakit:

- `config.php` — live credentials lang; gagawin sa File Manager.
- `config.example.php` — hindi kailangan sa live; baka ma-fallback kung mawala ang `config.php`.
- `uploads/` — personal proof photos; dapat walang local photos sa live.
- `schema.sql` — may `CREATE DATABASE` / `USE`; gamitin ang `infinityfree-schema.sql`.
- `setup_admin.php` — blocked ng `.htaccess`; `api/setupAdmin.php` ang gagamitin.
- `ensure_schema.php` — hindi kailangan; kaya nang gawin ng schema at ng `route.php` / `location.php`.
- `docs/`, `README*`, `PRODUCT.md` — docs lang, hindi website asset.

## 4. Live config

- [ ] Sa InfinityFree File Manager, gumawa ng `config.php` sa web root.
- [ ] Kopyahin ang structure ng `config.example.php`, pero gamitin ang live DB values.
- [ ] `debug` dapat `false`.
- [ ] Huwag i-upload ang local `config.php`.
- [ ] Huwag i-paste ang config contents sa chat o screenshot.

Live config shape:

```php
<?php
return [
    'host' => 'LIVE_DB_HOST',
    'name' => 'LIVE_DB_NAME',
    'user' => 'LIVE_DB_USER',
    'pass' => 'LIVE_DB_PASS',
    'debug' => false,
    'location_keep_days' => 7,
];
```

## 5. Database import

- [ ] Buksan ang phpMyAdmin ng InfinityFree.
- [ ] Piliin ang live database (may prefix), hindi ang `information_schema`.
- [ ] **Import** → `docs/deployment/infinityfree-schema.sql`.
- [ ] I-confirm na 7 tables ang na-import:

```text
drivers
customers
deliveries
delivery_stops
users
rider_locations
delivery_events
```

- [ ] I-confirm na walang `CREATE DATABASE` o `USE` error.

### Migration ng local data

Local data na ililipat:

```text
users:             5
drivers:           4
customers:         5
deliveries:        3
delivery_stops:    4
rider_locations:   2
delivery_events:   6
```

- [x] Data-only SQL generated locally via `mysqldump`, validated sa temporary DB, at walang `CREATE DATABASE`, `USE`, o `DROP TABLE`.
- [x] I-import ang data-only SQL sa live DB pagkatapos ng schema.
- [x] I-verify ang row counts laban sa listahan sa itaas — tugma lahat.
- [ ] Dahil kasama ang `users`, **huwag nang i-upload/i-run ang `api/setupAdmin.php`**. Gamitin ang existing local admin login.
- [ ] Kung gusto ng bagong live admin password, palitan pagkatapos ng login sa Settings.

### Proof photos

May 2 unique proof photos na naka-reference sa local `deliveries` / `delivery_stops`, at existing ang files sa local `uploads/proofs/`.

**Decided:** i-upload ang 2 referenced photos lang.

```text
uploads/proofs/proof_12_14611a3aec57.jpg
uploads/proofs/proof_12_2d13c5444bc3.jpg
```

- [x] I-upload ang 2 referenced proof photos.
- [ ] **Huwag** i-upload ang iba pang unused photos at ang buong `uploads/`.
- [ ] I-confirm na 403/404 ang PHP execution sa `uploads/proofs/`.
- [ ] I-confirm na `uploads/proofs/.htaccess` ay existing at tama ang contents.

## 6. Upload at folders

- [ ] I-upload ang package sa web root (`htdocs`).
- [ ] I-confirm na existing ang `api/` at `assets/`.
- [ ] Gumawa ng `uploads/` at `uploads/proofs/` sa web root.
- [ ] Set folder permission sa `uploads/proofs/` para makapag-save ang PHP (karaniwang `755`).
- [ ] I-upload ang `api/setupAdmin.php` pansamantala.
- [ ] Pagkatapos gumawa ng admin, i-delete agad ang `api/setupAdmin.php`.

Ang `uploads/proofs/` ay dapat may `.htaccess` na pumipigil sa PHP execution. Awtomatiko itong ginagawa ng `api/rider.php` sa unang proof upload. Kung hindi ito magawa, gumawa manually ng `uploads/proofs/.htaccess`:

```apache
Options -Indexes
<FilesMatch "\.(php|phtml|php[0-9]|phar)$">
    Require all denied
</FilesMatch>
```

## 7. Admin setup

- [ ] Buksan: `https://DOMAIN/api/setupAdmin.php`
- [ ] Gumawa ng unang Admin account.
- [ ] I-confirm na `users` table may 1 Admin.
- [ ] I-delete agad ang `api/setupAdmin.php`.
- [ ] I-test na 403 o 404 na ang setup URL pagkatapos.

Huwag gamitin ang root `setup_admin.php`; blocked ito ng `.htaccess`.

## 8. HTTPS at access rules

- [ ] I-enable ang free SSL sa InfinityFree.
- [ ] I-test ang `https://DOMAIN/`.
- [ ] I-confirm na HTTPS ang session cookie pag naka-SSL.
- [ ] I-test na denied ang mga ito:

```text
/config.php
/config - Copy.php
/db.php
/schema.sql
/setup_admin.php
/.git/
/.htaccess
```

Expected: `403` o `404`, hindi ang file contents.

- [ ] I-test na walang directory listing sa `/uploads/` at `/uploads/proofs/`.

## 9. Live smoke tests

### Login at basic pages

- [ ] Admin login
- [ ] Dashboard load at walang duplicate request error
- [ ] Customers list at add/edit
- [ ] Drivers list at add/edit
- [ ] Deliveries list at add/edit
- [ ] Employees page
- [ ] Settings page
- [ ] Reports page
- [ ] Live Map page

### Delivery flow

- [ ] Gumawa ng delivery na `Pending`.
- [ ] Mag-assign ng driver.
- [ ] Multi-customer delivery: **+ Add another customer**.
- [ ] I-save at i-reopen; dapat tama ang values at status.
- [ ] I-mark na `Delivered`; dapat may proof photo bago payagan.

### Rider flow

- [ ] Rider/Driver login.
- [ ] Location update.
- [ ] Proof photo upload (JPG/PNG/WEBP).
- [ ] Rider notes.
- [ ] I-confirm na lumalabas ang rider sa Live Map.

### Geocode at map

- [ ] I-test ang address search.
- [ ] I-test ang pin/reverse geocode.
- [ ] I-test ang route/trail kung may active delivery.
- [ ] Kung `503 Could not reach the map service`: blocked ang outbound HTTPS sa Nominatim. Kailangan ng fallback o ibang hosting.

### Character limits

- [ ] Name 81 chars → hindi dapat ma-save.
- [ ] Contact 21 → hindi dapat ma-save.
- [ ] Vehicle 51 → hindi dapat ma-save.
- [ ] Item 121 → hindi dapat ma-save.
- [ ] Remarks/Rider notes 501 → hindi dapat ma-save.
- [ ] Quantity 1000 → hindi dapat ma-save.
- [ ] Search 61 → dapat huminto sa 60.
- [ ] Bypass test: alisin ang `maxlength` sa isang field, mag-save ng sobra → server error pa rin.

### Mobile

- [ ] 390px width: walang horizontal table scroll.
- [ ] Touch targets ≥44px.
- [ ] Test sa real phone, Wi-Fi at mobile data.
- [ ] Test ang proof photo upload sa phone.

## 10. Rollback

- [ ] I-keep ang local backup ng files at DB hanggang makumpirma na stable ang live.
- [ ] Kung may sira: i-restore ang previous files at DB dump.
- [ ] Kung schema import ang problema: i-drop ang mga bagong tables at i-import ulit.
- [ ] Huwag i-delete ang live `uploads/` sa rollback kung may bagong proof photos.

## 11. Open risks

- [ ] Hindi pa confirmed ang live PHP version at extensions.
- [ ] Hindi pa confirmed ang outbound HTTPS sa Nominatim.
- [ ] Hindi pa confirmed ang write access sa `uploads/proofs/`.
- [ ] Hindi pa confirmed ang `ALTER TABLE` privilege para sa `ensure_location_schema()`.
- [x] May live subdomain na: `https://delcomtracking.wuaze.com/`. I-test pa rin sa mobile data dahil may carrier na hindi ma-resolve ang free subdomain.
- [ ] `db.php` may `CURLOPT_SSL_VERIFYPEER => false` na nakalagay para sa local XAMPP. Kailangang gawing `!APP_DEBUG` bago mag-upload (exact edit nasa task list).
- [ ] Ang root `README` ay tumutukoy sa `setup_admin.php` na blocked ng `.htaccess`; `api/setupAdmin.php` ang tamang setup path.

## 12. Final go-live gate

Bago ang unang upload, kailangan ng explicit na sagot sa:

1. Fresh database ba o migrate ang local data?
2. Saan ilalagay ang live config — File Manager o FTP?
3. May final domain/subdomain na ba?
4. Payag ba ang user na i-delete ang `api/setupAdmin.php` agad pagkatapos ng admin setup?

Kapag pasado lahat, saka lang gagawin ang upload at live commands.
