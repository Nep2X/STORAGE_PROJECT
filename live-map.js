// Live Map: mga rider na may kasalukuyang delivery.
// I-click ang rider para makita ang huling location niya at ang ruta mula sa company.
const LOCATION_API = "api/location.php";
const ROUTE_API = "api/route.php";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving/";
const LOCATION_REFRESH_MS = 10000;
const DELIVERY_REFRESH_MS = 60000;
const STALE_SECONDS = 5 * 60;      // mas luma rito = grey
const MOVE_REDRAW_METERS = 100;     // saka lang iguguhit ulit ang ruta
const REMAINING_COLOR = "#2f6df6"; // kulay ng natitirang ruta papunta sa customer
const MAX_ROUTED_STOPS = 5;        // para hindi ma-overload ang libreng OSRM server

// PALITAN ng totoong company ninyo 
const COMPANY = { name: "Company", address: "Campanilla, Quezon City, 1112 Metro Manila", lat: 14.624556610241402, lng: 121.03696233024351 };

const map = L.map("map", { zoomControl: false }).setView([COMPANY.lat, COMPANY.lng], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);
L.control.zoom({ position: "topright" }).addTo(map);

const roadLayer = L.layerGroup().addTo(map);
const selectionLayer = L.layerGroup().addTo(map);

const listEl = document.getElementById("list");
const countEl = document.getElementById("riderCount");
const updatedEl = document.getElementById("updated");
const infoEl = document.getElementById("routeInfo");

let activeRiders = [];   // mga rider na "Out for Delivery"
let locations = {};      // driver_id -> huling location
let selectedId = null;
let riderMarker = null;
let currentRoute = null;
let drawToken = 0;

const escH = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function ago(sec) {
    sec = Number(sec);
    if (sec < 60) return `${sec}s ago`;
    if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
    return `${Math.floor(sec / 86400)} days ago`;
}

function pin(bg, label) {
    return L.divIcon({
        className: "",
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${bg};color:#fff;font:700 13px/22px sans-serif;text-align:center;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${label}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14],
    });
}
function icon(fresh) {
    return L.divIcon({
        className: "",
        html: `<div class="location-marker ${fresh ? "fresh" : "stale"}"></div>`,
        iconSize: [18, 18], iconAnchor: [9, 9],
    });
}

// Pin ng customer address (walang bilog at walang delivery ID)
function destPin(color) {
    return L.divIcon({
        className: "",
        html: `<svg width="30" height="40" viewBox="0 0 30 40" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">` +
              `<path d="M15 39C15 39 2 24.5 2 14.5C2 7.04 7.82 1 15 1s13 6.04 13 13.5C28 24.5 15 39 15 39z" fill="${color}" stroke="#fff" stroke-width="2"/>` +
              `<circle cx="15" cy="14.5" r="4.5" fill="#fff"/></svg>`,
        iconSize: [30, 40], iconAnchor: [15, 39], popupAnchor: [0, -36], tooltipAnchor: [16, -22],
    });
}

L.marker([COMPANY.lat, COMPANY.lng], { icon: pin("#161616", "&#127970;"), zIndexOffset: 500 })
    .addTo(map).bindPopup(`<b>${escH(COMPANY.name)}</b><br>${escH(COMPANY.address)}`);

// ---------- DATA ----------
async function loadDeliveries() {
    const res = await fetch(ROUTE_API);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
        activeRiders = data.routes;
}

// Lahat ng rider: may active delivery O may naka-report na location
function allRiders() {
    const m = new Map();
    activeRiders.forEach((r) => m.set(String(r.driver_id), { driver_id: r.driver_id, name: r.driver_name, stops: r.stops }));
    Object.values(locations).forEach((l) => {
        const id = String(l.driver_id);
        if (!m.has(id)) m.set(id, { driver_id: l.driver_id, name: l.name, stops: [] });
    });
    return [...m.values()].sort((a, b) => (b.stops.length > 0) - (a.stops.length > 0) || a.name.localeCompare(b.name));
}

async function loadLocations() {
    const res = await fetch(LOCATION_API);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    locations = {};
    data.riders.forEach((r) => { locations[String(r.driver_id)] = r; });
}

// ---------- LIST ----------
function renderList() {
        const riders = allRiders();
    countEl.textContent = riders.length;
    listEl.innerHTML = "";
    if (!riders.length) {
        listEl.innerHTML = '<div class="rider">No rider has reported a location yet.</div>';
        return;
    }
    riders.forEach((r) => {
        const id = String(r.driver_id);
        const loc = locations[id];
        const fresh = loc && Number(loc.seconds_ago) <= STALE_SECONDS;
        const n = r.stops.length;
        const row = document.createElement("button");
        row.type = "button";
        row.className = "rider";
        row.disabled = !loc;
        row.setAttribute("aria-pressed", id === selectedId ? "true" : "false");
        row.innerHTML = `<span class="dot ${fresh ? "fresh" : "stale"}"></span><b>${escH(r.name)}</b>` +
            `<small>${n ? n + " active " + (n === 1 ? "delivery" : "deliveries") : "No active delivery"} · ${loc ? "Updated " + ago(loc.seconds_ago) : "No location yet"}</small>`;
        row.onclick = () => selectRider(id);
        listEl.appendChild(row);
    });
}

// ---------- SELECTION + ROUTE ----------
function clearSelection() {
    drawToken++;
    selectionLayer.clearLayers();
    roadLayer.clearLayers();
    riderMarker = null;
    currentRoute = null;
    infoEl.hidden = true;
}

function renderInfo() {
    const loc = locations[selectedId];
    if (!loc || !currentRoute) { infoEl.hidden = true; return; }
    infoEl.hidden = false;

    let html = `<b>${escH(loc.name)}</b> · ${currentRoute.km.toFixed(1)} km from company` +
        `${currentRoute.road ? "" : " (straight line)"} · updated ${ago(loc.seconds_ago)}`;

    (currentRoute.stops || []).forEach(({ s, km, road }) => {
        html += `<br><span style="color:${REMAINING_COLOR}">&#9679;</span> ${escH(s.customer_name)} · ` +
            `${km.toFixed(1)} km remaining${road ? "" : " (straight line)"}`;
    });
    if ((currentRoute.missing || []).length) {
        html += `<br>&#9888; Address not on the map yet: ${currentRoute.missing.map((s) => escH(s.customer_name)).join(", ")}`;
    }
    infoEl.innerHTML = html;
}

// Ruta sa kalsada (OSRM). Kung walang sagot, straight line na lang.
async function getRoadRoute(from, to) {
    const straight = { points: [from, to], km: from.distanceTo(to) / 1000, road: false };
    try {
        const res = await fetch(`${OSRM_URL}${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (data.code !== "Ok" || !data.routes.length) return straight;
        const r = data.routes[0];
        return { points: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]), km: r.distance / 1000, road: true };
    } catch (_) {
        return straight;
    }
}

async function showSelected(fit) {
    clearSelection();
    const token = drawToken;
    const loc = locations[selectedId];
    const rider = allRiders().find((r) => String(r.driver_id) === selectedId);
    if (!loc || !rider) return;

    const here = L.latLng(Number(loc.latitude), Number(loc.longitude));
    const company = L.latLng(COMPANY.lat, COMPANY.lng);
    const fresh = Number(loc.seconds_ago) <= STALE_SECONDS;

    riderMarker = L.marker(here, { icon: icon(fresh), zIndexOffset: 1000 }).addTo(selectionLayer)
        .bindPopup(`<b>${escH(loc.name)}</b><br>Last report: ${escH(loc.reported_at)} (${ago(loc.seconds_ago)})`);

    // Mga customer address na nakita sa mapa (may coordinates)
    const stops = rider.stops.filter((s) => s.lat != null && s.lng != null).slice(0, MAX_ROUTED_STOPS);
    const missing = rider.stops.filter((s) => s.lat == null || s.lng == null);
    const bounds = [company, here];

    stops.forEach((s) => {
        const dest = L.latLng(s.lat, s.lng);
        bounds.push(dest);
        L.marker(dest, { icon: destPin(REMAINING_COLOR) }).addTo(selectionLayer)
            .bindTooltip(
                `<div style="white-space:normal;max-width:200px"><b>${escH(s.customer_name)}</b><br>${escH(s.address)}</div>`,
                { permanent: true, direction: "right" }
            )
            .bindPopup(`<b>${escH(s.customer_name)}</b><br>${escH(s.address)}<br>Delivery ${escH(s.del_number)}`);
    });
    if (fit) map.fitBounds(L.latLngBounds(bounds).pad(0.2), { maxZoom: 16 });

    // Sabay na hinahanap: company -> rider (itim) at rider -> bawat customer (asul, natitirang daraanan)
    const [route, ...remaining] = await Promise.all([
        getRoadRoute(company, here),
        ...stops.map((s) => getRoadRoute(here, L.latLng(s.lat, s.lng))),
    ]);
    if (token !== drawToken) return;   // ibang rider na ang napili

    L.polyline(route.points, route.road
        ? { color: "#161616", weight: 5, opacity: 0.9 }
        : { color: "#161616", weight: 4, dashArray: "6 8" }).addTo(roadLayer);

    remaining.forEach((r) => {
        L.polyline(r.points, r.road
            ? { color: REMAINING_COLOR, weight: 5, opacity: 0.9 }
            : { color: REMAINING_COLOR, weight: 4, dashArray: "6 8" }).addTo(roadLayer);
    });

    currentRoute = {
        ...route,
        stops: stops.map((s, i) => ({ s, km: remaining[i].km, road: remaining[i].road })),
        missing,
    };
    renderInfo();
}

function selectRider(id) {
    selectedId = id;
    renderList();
    showSelected(true);
}

// ---------- REFRESH ----------
async function refreshLocations() {
    try {
        await loadLocations();
        renderList();
        if (selectedId) {
            const loc = locations[selectedId];
            const moved = loc && (!riderMarker ||
                L.latLng(Number(loc.latitude), Number(loc.longitude)).distanceTo(riderMarker.getLatLng()) >= MOVE_REDRAW_METERS);
            if (!loc) clearSelection();
            else if (moved) showSelected(false);
            else renderInfo();
        }
        updatedEl.textContent = "Updated " + new Date().toLocaleTimeString();
    } catch (err) {
        updatedEl.textContent = "Error: " + err.message;
    }
}

async function refreshDeliveries() {
    try {
        await loadDeliveries();
        if (selectedId) showSelected(false);
        renderList();
    } catch (err) {
        updatedEl.textContent = "Error: " + err.message;
    }
}

(async () => {
    await refreshDeliveries();
    await refreshLocations();
})();
setInterval(refreshLocations, LOCATION_REFRESH_MS);
setInterval(refreshDeliveries, DELIVERY_REFRESH_MS);
document.addEventListener("userready", () => map.invalidateSize());