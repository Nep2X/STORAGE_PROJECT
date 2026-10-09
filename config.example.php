<?php
// Kopyahin ang file na ito bilang config.php, tapos ilagay ang totoong settings.
// Ang config.php ay HINDI ina-upload sa GitHub (nasa .gitignore).
return [
    'host' => 'localhost',
    'name' => 'delivery_db',
    'user' => 'delivery_app',     // gumawa ng hiwalay na MySQL user, huwag root
    'pass' => 'CHANGE_ME',

    // true = ipakita sa browser ang detalye ng error (sa local lang).
    // false = generic na mensahe lang; ang detalye ay nasa error.log.
    'debug' => false,

    // Ilang araw itatago ang lumang rider location records
    // (laging itinatago ang pinakahuling location ng bawat rider).
    'location_keep_days' => 7,
];
