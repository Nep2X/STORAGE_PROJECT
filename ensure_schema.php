<?php
// Awtomatikong gumagawa ng mga kulang na table/column para sa location feature.
// Ito ang pumipigil sa "Server error" kapag hindi pa na-run ang location_update.sql.
function ensure_location_schema(PDO $pdo): void {
    try {
        $pdo->exec(
            "CREATE TABLE IF NOT EXISTS rider_locations (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                driver_id INT NOT NULL,
                latitude DECIMAL(10,7) NOT NULL,
                longitude DECIMAL(10,7) NOT NULL,
                accuracy FLOAT NULL,
                reported_at DATETIME NOT NULL,
                INDEX idx_driver_time (driver_id, reported_at)
            )"
        );

        $need = [
            ['users',      'driver_id',  'INT UNSIGNED NULL'],
            ['deliveries', 'dest_lat',   'DECIMAL(10,7) NULL'],
            ['deliveries', 'dest_lng',   'DECIMAL(10,7) NULL'],
            ['deliveries', 'geo_tried',  'TINYINT(1) NOT NULL DEFAULT 0'],
        ];
        foreach ($need as [$table, $col, $def]) {
            $has = $pdo->query("SHOW COLUMNS FROM `$table` LIKE '$col'")->fetch();
            if (!$has) $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$col` $def");
        }
    } catch (Throwable $e) {
        error_log('ensure_location_schema: ' . $e->getMessage());
    }
}