<?php
$pdo = new PDO(
    "mysql:host=localhost;dbname=delivery_db;charset=utf8mb4",
    "root", "",   // default ng XAMPP
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]
);