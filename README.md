# NEPNEP_PROJECT - Delivery Monitoring System

PHP + MySQL (XAMPP) + HTML/CSS/JS.

## Setup sa bagong computer
1. I-install ang XAMPP, i-Start ang **Apache** at **MySQL**.
2. Ilagay ang project sa `C:\xampp\htdocs\NEPNEP_PROJECT\`.
3. Sa `http://localhost/phpmyadmin`, buksan ang **SQL** tab at i-run ang laman ng `schema.sql`.
4. Buksan ang `http://localhost/NEPNEP_PROJECT/setup_admin.php` at gumawa ng unang Admin account.
5. **Burahin ang `setup_admin.php`** pagkatapos.
6. Mag-login sa `http://localhost/NEPNEP_PROJECT/login.html`.

## Paalala
- Ang **database** at ang folder na `uploads/` (mga litrato) ay HINDI kasama sa GitHub.
- Kung papalitan ang password ng MySQL, i-edit ang `db.php`. Huwag i-commit ang totoong password.

## Setup ng database settings

1. Kopyahin ang `config.example.php` bilang `config.php`.
2. Ilagay ang tamang `host`, `name`, `user`, `pass`. Gumawa ng hiwalay na MySQL user (huwag `root`) para sa totoong server.
3. Sa totoong server, gawing `'debug' => false` para hindi makita ng browser ang detalye ng error.
4. Ang `config.php` ay nasa `.gitignore`, kaya hindi ito mapupunta sa GitHub.
