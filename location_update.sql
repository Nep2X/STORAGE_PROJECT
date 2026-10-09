-- Run once in phpMyAdmin > delivery_db > SQL tab
USE delivery_db;
CREATE TABLE IF NOT EXISTS rider_locations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    driver_id INT NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    accuracy FLOAT NULL,
    reported_at DATETIME NOT NULL,
    INDEX idx_driver_time (driver_id, reported_at)
);
