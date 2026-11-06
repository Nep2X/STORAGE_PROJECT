# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

No dominant daily user is established yet; the product is built for the internal roles the app already defines:

- **Admin / Employee (office, desktop):** maintain deliveries, customers, drivers, employees, and users; generate reports.
- **Driver / Rider (field, phone):** view assigned deliveries, update status, share live location, and upload proof-of-delivery photos.

Adoption is undecided. Do not design around an assumed high-volume operation or a public customer audience; there is no customer-facing tracking surface.

## Product Purpose

A self-hosted delivery monitoring and management system for a small delivery operation. It keeps delivery records, rider assignments, live location, proof of delivery, and reports in one place instead of separate spreadsheets or chat threads.

Success means every workflow works end to end: create and assign a delivery, see the rider on the map, capture proof, and produce a clean report.

## Positioning

One internal tool that combines delivery records, live rider tracking, proof capture, and printable/CSV reports on a plain PHP + MySQL stack, with no paid third-party service required. The value is operational completeness on a free/self-hosted stack, not a novel consumer product.

## Operating Context

- Local development on XAMPP (Apache + MySQL) at `http://localhost/DELIVERY_PROJECT_MAP/`.
- Production attempt on free hosting (InfinityFree), including mobile-data use.
- Admin work happens on desktop; rider work happens on a phone in the field, often on weak mobile data.
- Deliveries move through statuses; riders share location updates; proof photos are stored under `uploads/`.
- Company location is configured in `live-map.js` (currently Campanilla, Quezon City).

## Capabilities and Constraints

Confirmed from the implementation:

- Roles: Admin, Employee, Driver, Rider.
- Pages: login, dashboard, deliveries, customers, drivers, employees, reports, live map, settings, rider.
- Deliveries: create/edit, assign driver, status, notes, search/filter, 30s refresh.
- Live map: Leaflet with Street/Satellite raster tiles and a custom vector Topo style for the main map; company and rider markers, route from company.
- Rider: assigned deliveries, status updates, location updates, proof-photo upload.
- Reports: by driver, customer, and month; CSV export; print layout.
- Themes: light and midnight; company logo via `assets/company-logo.svg`.
- Stack: PHP, MySQL, vanilla HTML/CSS/JS, no build step, no framework.
- Deployment constraints: free hosting, no paid services, `config.php` and `uploads/` excluded from version control.
- Mobile requirement: touch targets at least 44px and no horizontal table scrolling.

Undecided: real business name, production domain, and whether the system will be used by an active operation.

## Brand Commitments

- Working name: **Delivery Project** (placeholder; the user may replace it with the real business name later).
- Logo: single monochrome SVG truck/wordmark (`assets/company-logo.svg`), rendered with CSS masks so it inherits the theme color.
- Current map address: Campanilla, Quezon City, 1112 Metro Manila (configured in `live-map.js`).

## Evidence on Hand

- Working application code and MySQL schema in this repository.
- Real role/permission structure and sample delivery data in the local database.
- Logo asset and theme tokens.
- No customer testimonials, benchmarks, press, or production usage metrics exist. Do not fabricate them.

## Product Principles

1. **Functional first.** A workflow is done only when it works end to end on the real stack.
2. **One tool, no paid dependencies.** Keep the PHP/MySQL/vanilla stack and free-hosting constraint.
3. **Phone-safe for riders.** One-hand use, large touch targets, no horizontal scrolling.
4. **Trustworthy records.** Status changes, locations, and proof photos should be easy to trace.
5. **Small-operation simplicity.** Prefer clear, familiar UI over enterprise complexity.

## Accessibility & Inclusion

- Mobile targets at least 44px; avoid hover-only actions.
- Keyboard-accessible modals and focus trapping are part of the current UI.
- Readable contrast across light and midnight themes.
- No formal WCAG audit has been done.
