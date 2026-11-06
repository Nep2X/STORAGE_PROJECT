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