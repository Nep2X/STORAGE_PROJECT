-- =====================================================
-- Delivery Monitoring (NEPNEP_PROJECT) - database setup
-- I-run sa phpMyAdmin > SQL tab (isang beses sa bagong computer)
-- =====================================================
CREATE DATABASE IF NOT EXISTS delivery_db CHARACTER SET utf8mb4;
USE delivery_db;

CREATE TABLE IF NOT EXISTS drivers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    contact VARCHAR(20),
    status ENUM('Available','On Route','Offline') NOT NULL DEFAULT 'Available'
);

CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    contact VARCHAR(20),
    address VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    del_number VARCHAR(20) NOT NULL UNIQUE,
    customer_name VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    contact VARCHAR(20),
    del_date DATE,
    driver_name VARCHAR(100),
    vehicle VARCHAR(50),
    item_desc VARCHAR(255),
    quantity INT DEFAULT 1,
    remarks TEXT,
    status ENUM('Pending','Processing','Out for Delivery','Delivered','Cancelled')
        NOT NULL DEFAULT 'Pending',
    proof_image VARCHAR(255) NULL,
    delivered_at DATETIME NULL,
    rider_notes TEXT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NULL,
    contact_number VARCHAR(20) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('Admin','Employee','Driver','Rider') NOT NULL DEFAULT 'Employee',
    driver_id INT UNSIGNED NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until DATETIME NULL,
    last_login DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
