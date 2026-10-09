DELIVERY PROJECT — XAMPP + MySQL, REFERENCE UI EDITION

Extract this folder into your XAMPP htdocs project folder. Keep all files together.
Use your existing delivery_db database and db.php connection settings.
If the live-map migration has not been applied yet, run location_update.sql once in phpMyAdmin. Do not re-import schema.sql over your existing database.
Open your project URL in the browser. Sign in using your existing account.

The uploaded UI design is applied to the live map and existing management screens.
The live map uses real OpenStreetMap tiles; locations come from api/location.php.
It refreshes every 10 seconds. Lime dots are reports no older than 5 minutes;
grey dots are older reports. No illustrative routes or fake locations are shown.
Rider GPS reporting, authentication, PHP APIs, forms and MySQL logic are preserved.
Phone GPS requires HTTPS or localhost and works only while the rider page is open.
The original script.js/styles.css static prototype files are retained but index.html
now opens the authenticated live map instead of the static sample tracking screen.

Checked with simulated API responses, not a running XAMPP database or physical phone.
Test sign-in, reports and actual GPS on your XAMPP installation before deployment.
Map data: copyright OpenStreetMap contributors.
