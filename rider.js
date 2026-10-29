// =========================
//   RIDER REPORT PAGE SCRIPT
// =========================

const RIDER_API = "api/rider.php";
const LOGIN_PAGE = "login.html";

// Kapag nag-expire ang session (401), ibalik sa login
const _fetch = window.fetch.bind(window);
window.fetch = async (...args) => {
    const res = await _fetch(...args);
    if (res.status === 401) window.location.replace(LOGIN_PAGE);
    return res;
};

const riderSelect = document.getElementById("riderSelect");
const deliverySelect = document.getElementById("deliverySelect");
const deliveryHint = document.getElementById("deliveryHint");
const stopWrap = document.getElementById("stopWrap");
const stopSelect = document.getElementById("stopSelect");
const stopHint = document.getElementById("stopHint");
const detailsBox = document.getElementById("details");
const reportForm = document.getElementById("reportForm");
const proofInput = document.getElementById("proofInput");
const proofPreview = document.getElementById("proofPreview");
const submitBtn = document.getElementById("submitBtn");
const msg = document.getElementById("msg");

let myDeliveries = [];
let photoBlob = null;

// ---------- HELPERS ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmtDate = (d) => {
    if (!d) return "-";
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-US",
        { month: "short", day: "numeric", year: "numeric" });
};

function showMsg(text, type) {
    msg.textContent = text;
    msg.className = type;
}

function clearMsg() {
    msg.textContent = "";
    msg.className = "";
}

function updateSubmit() {
    const d = myDeliveries.find((x) => String(x.id) === deliverySelect.value);
    const needStop = !!(d && d.stops && d.stops.length > 0);
    submitBtn.disabled = !(deliverySelect.value && photoBlob && (!needStop || stopSelect.value));
}

// Paliitin ang litrato bago i-upload (mabilis sa mobile data)
function resizeImage(file, maxSize = 1280, quality = 0.8) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(url);
                resolve(blob || file);
            }, "image/jpeg", quality);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file); // hayaan ang server na magsabi kung hindi suportado
        };
        img.src = url;
    });
}

// ---------- DRIVERS ----------
async function loadRiders() {
    try {
        const res = await fetch(`${RIDER_API}?action=drivers`);
        const names = await res.json();
        if (!Array.isArray(names)) throw new Error(names.error || "Invalid response");

        riderSelect.innerHTML = `<option value="">Select your name</option>` +
            names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
    } catch (err) {
        console.error(err);
        riderSelect.innerHTML = `<option value="">Failed to load drivers</option>`;
    }
}

// ---------- DELIVERIES NG DRIVER ----------
async function loadMyDeliveries() {
    const driver = riderSelect.value;
    detailsBox.style.display = "none";
    deliveryHint.textContent = "";
    stopWrap.style.display = "none";
    myDeliveries = [];

    if (!driver) {
        deliverySelect.disabled = true;
        deliverySelect.innerHTML = `<option value="">Select your name first</option>`;
        updateSubmit();
        return;
    }

    try {
        const res = await fetch(`${RIDER_API}?action=deliveries&driver=${encodeURIComponent(driver)}`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error(data.error || "Invalid response");
        myDeliveries = data;

        if (!data.length) {
            deliverySelect.disabled = true;
            deliverySelect.innerHTML = `<option value="">No pending deliveries</option>`;
            deliveryHint.textContent = "You have no deliveries waiting to be reported.";
        } else {
            deliverySelect.disabled = false;
            deliverySelect.innerHTML = `<option value="">Select delivery</option>` +
                data.map((d) =>
                `<option value="${d.id}">${esc(d.del_number)} - ${d.stops && d.stops.length > 1 ? d.stops.length + " customers" : esc(d.customer_name)}</option>`
                ).join("");
        }
    } catch (err) {
        console.error(err);
        deliverySelect.disabled = true;
        deliverySelect.innerHTML = `<option value="">Failed to load deliveries</option>`;
    }
    updateSubmit();
}

// ---------- DETAILS ----------
function showDetails() {
    const d = myDeliveries.find((x) => String(x.id) === deliverySelect.value);
    if (!d) {
        detailsBox.style.display = "none";
        stopWrap.style.display = "none";
        updateSubmit();
        return;
    }

    // Batch: pumili muna ng customer na na-deliver-an
    const allStops = d.stops || [];
    const pending = allStops.filter((s) => s.status === "Pending");
    const isBatch = allStops.length > 0;

    stopWrap.style.display = isBatch ? "block" : "none";
    if (isBatch) {
        const prev = stopSelect.value;
        stopSelect.innerHTML = `<option value="">Select customer</option>` +
            pending.map((s) => `<option value="${s.id}">${s.stop_order}. ${esc(s.customer_name)}</option>`).join("");
        stopSelect.value = pending.some((s) => String(s.id) === prev) ? prev : "";
        stopHint.textContent = `${allStops.length - pending.length} of ${allStops.length} customers delivered`;
    }
    const stop = isBatch ? pending.find((s) => String(s.id) === stopSelect.value) : null;
    const c = isBatch ? stop : d;   // detalye ng customer

    const set = (id, v) => (document.getElementById(id).textContent = v || "-");
    set("dID", d.del_number);
    set("dCustomer", c && c.customer_name);
    set("dAddress", c && c.address);
    set("dContact", c && c.contact);
    set("dDate", fmtDate(d.del_date));
    set("dVehicle", d.vehicle);
    set("dItem", c && c.item_desc);
    set("dQty", c && c.quantity);
    set("dStatus", d.status);
    set("dRemarks", d.remarks);

    detailsBox.style.display = "block";
    clearMsg();
    updateSubmit();
}

riderSelect.addEventListener("change", loadMyDeliveries);
deliverySelect.addEventListener("change", showDetails);
stopSelect.addEventListener("change", showDetails);

// ---------- PHOTO ----------
proofInput.addEventListener("change", async () => {
    clearMsg();
    const file = proofInput.files[0];
    if (!file) {
        photoBlob = null;
        proofPreview.style.display = "none";
        updateSubmit();
        return;
    }

    photoBlob = await resizeImage(file);
    proofPreview.src = URL.createObjectURL(photoBlob);
    proofPreview.style.display = "block";
    updateSubmit();
});

// ---------- SUBMIT ----------
reportForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!deliverySelect.value || !photoBlob) return;

    const d = myDeliveries.find((x) => String(x.id) === deliverySelect.value);
    const stopLabel = stopSelect.value ? stopSelect.selectedOptions[0].textContent : "";
    if (!confirm(stopLabel ? `Report ${stopLabel} (${d.del_number}) as delivered?` : `Report ${d.del_number} as delivered?`)) return;

    const fd = new FormData();
    fd.append("id", deliverySelect.value);
    fd.append("driver", riderSelect.value);
    if (stopSelect.value) fd.append("stop_id", stopSelect.value);
    fd.append("notes", document.getElementById("notes").value);
    fd.append("photo", photoBlob, "proof.jpg");

    submitBtn.disabled = true;
    submitBtn.textContent = "Uploading...";
    clearMsg();

    try {
        const res = await fetch(RIDER_API, { method: "POST", body: fd });
        const out = await res.json();
        if (!out.ok) throw new Error(out.error || "Something went wrong.");

        const keepId = deliverySelect.value;
        reportForm.reset();
        photoBlob = null;
        proofPreview.style.display = "none";
        detailsBox.style.display = "none";
        await loadMyDeliveries();

        if (out.remaining > 0 && [...deliverySelect.options].some((o) => o.value === keepId)) {
            // Batch: may natitira pang customer, ibalik ang parehong delivery
            deliverySelect.value = keepId;
            showDetails();
            showMsg(`${out.customer} delivered. ${out.remaining} customer(s) left for ${d.del_number}.`, "ok");
        } else {
            showMsg(`${d.del_number} has been reported as delivered. Thank you!`, "ok");
        }
    } catch (err) {
        showMsg("Error: " + err.message, "err");
    } finally {
        submitBtn.textContent = "Submit Report";
        updateSubmit();
    }
});

// ---------- BACK BUTTON ----------
// Lalabas lang para sa Admin/Employee na galing sa ibang page ng website.
// Hindi ito ipinapakita sa Rider/Driver account.
const backBtn = document.getElementById("backBtn");

function setupBackButton(canShow) {
    if (!canShow) return;
    try {
        if (!document.referrer || new URL(document.referrer).origin !== window.location.origin) return;
    } catch (_) {
        return;
    }
    backBtn.style.display = "inline-block";
    document.body.classList.add("hasBack");
    backBtn.addEventListener("click", () => {
        if (history.length > 1) history.back();
        else window.location.href = "dashboard.html";
    });
}

// ---------- LOGOUT ----------
document.getElementById("logoutBtn").addEventListener("click", async () => {
    if (!confirm("Are you sure you want to log out?")) return;
    try {
        await _fetch("api/auth.php?action=logout", { method: "POST" });
    } catch (err) { /* mag-logout pa rin sa screen */ }
    window.location.replace(LOGIN_PAGE);
});

// ---------- START ----------
// Rider / Driver: ang driver ay galing sa account nila (hindi mapapalitan).
// Admin: pwedeng pumili ng driver (para sa pagsubok o pag-report para sa iba).
async function init() {
    let me;
    try {
        const res = await fetch(`${RIDER_API}?action=me`);
        me = await res.json();
        if (!me.ok) throw new Error(me.error || "Could not load your account.");
    } catch (err) {
        riderSelect.innerHTML = `<option value="">${esc(err.message)}</option>`;
        return;
    }

    document.getElementById("whoami").textContent = me.full_name;
    setupBackButton(!["Rider", "Driver"].includes(me.role));
    await loadRiders();

    if (me.driver) {
        riderSelect.value = me.driver;
        riderSelect.disabled = true;
        await loadMyDeliveries();
    }
}

init();

// ---------- MY LOCATION ----------
const LOCATION_API = "api/location.php";
const AUTO_REPORT_MS = 15000;
const locMsg = document.getElementById("locMsg");
const autoShare = document.getElementById("autoShare");
const updateNowBtn = document.getElementById("updateNowBtn");
const placeForm = document.getElementById("placeForm");
const placeInput = document.getElementById("placeInput");
const placeBtn = document.getElementById("placeBtn");
const lastSent = document.getElementById("lastSent");

const coordForm = document.getElementById("coordForm");
const latInput = document.getElementById("latInput");
const lngInput = document.getElementById("lngInput");
const locSubmitBtn = document.getElementById("locSubmitBtn");

const MANUAL_HOLD_MS = 10 * 60 * 1000;   // pagkatapos mag-save nang mano-mano, i-pause ang auto GPS
let watchId = null;
let lastAutoSent = 0;
let manualUntil = 0;

function showLocMsg(text, type) {
    locMsg.textContent = text;
    locMsg.className = type;
}

async function sendLocation(payload) {
    const res = await fetch(LOCATION_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const raw = await res.text();
    let out;
    try { out = JSON.parse(raw); } catch (_) {
        console.error("Hindi JSON ang sagot ng server (HTTP " + res.status + "):", raw);
        throw new Error("Server error (HTTP " + res.status + "). Buksan ang F12 > Console para makita ang detalye.");
    }
    if (!out.ok) throw new Error(out.error || "Something went wrong.");
    lastSent.textContent = "Last sent: " + new Date().toLocaleTimeString();
}

function gpsErrorText(err) {
    if (err.code === 1) return "Naka-block ang Location permission. I-allow ito sa browser settings, o i-type na lang ang lugar mo sa ibaba.";
    if (err.code === 2) return "Hindi makuha ang GPS signal. Subukan sa labas ng building, o i-type ang lugar mo.";
    return "Natagalan ang GPS. Subukan ulit, o i-type ang lugar mo.";
}

// Isang tap: kunin ang GPS at i-send agad
updateNowBtn.addEventListener("click", () => {
    if (!("geolocation" in navigator)) {
        showLocMsg("Hindi suportado ng browser ang GPS. I-type na lang ang lugar mo sa ibaba.", "err");
        return;
    }
    const resetBtn = () => { updateNowBtn.disabled = false; updateNowBtn.textContent = "Update my location (GPS)"; };
    manualUntil = 0;
    updateNowBtn.disabled = true;
    updateNowBtn.textContent = "Getting location...";
    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            try {
                await sendLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
                showLocMsg("Na-update ang location mo.", "ok");
            } catch (err) {
                showLocMsg("Error: " + err.message, "err");
            } finally {
                resetBtn();
            }
        },
        (err) => { showLocMsg(gpsErrorText(err), "err"); resetBtn(); },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
});

// Hanapin ang lugar sa map (OpenStreetMap Nominatim) at kunin ang Latitude/Longitude
async function geocodePlace(q) {
    const tries = [q];
    if (!/philippines|manila/i.test(q)) tries.push(q + ", Metro Manila");
    for (const t of tries) {
        const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ph&q=" + encodeURIComponent(t);
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("Map search failed.");
        const r = await res.json();
        if (r.length) return { lat: parseFloat(r[0].lat), lng: parseFloat(r[0].lon), name: r[0].display_name };
    }
    return null;
}
// ---------- PLACE SUGGESTIONS ----------
const placeSuggestions = document.getElementById("placeSuggestions");
let placeSuggestionsList = [];
let placeSearchTimer = null;
let placeSearchToken = 0;
let placeSearchAt = 0;
let selectedPlace = null;

function hidePlaceSuggestions() {
    clearTimeout(placeSearchTimer);
    placeSearchToken++;
    placeSuggestionsList = [];
    placeSuggestions.hidden = true;
    placeSuggestions.innerHTML = "";
}
// ---------- PLACE PREVIEW MAP ----------
const placePreviewMapEl = document.getElementById("placePreviewMap");
let placePreviewMap = null;
let placePreviewMarker = null;

function placePreviewIcon() {
    return L.divIcon({
        className: "",
        html: `<span class="customerPin placePreviewPin" aria-hidden="true"></span>`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
    });
}

function ensurePlacePreview() {
    if (placePreviewMap) return true;
    if (typeof L === "undefined") return false;

    placePreviewMap = L.map(placePreviewMapEl, {
        zoomControl: false,
        scrollWheelZoom: false,
        dragging: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
    }).setView([12.8797, 121.7740], 6);

    L.tileLayer(mapTileUrl(), {
        maxZoom: 19,
        maxNativeZoom: mapMaxNativeZoom(),
        attribution: mapAttribution(),
        subdomains: "abcd",
    }).addTo(placePreviewMap);

    return true;
}

function showPlacePreview(lat, lng) {
    if (!placePreviewMapEl) return;

    lat = Number(lat);
    lng = Number(lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    placePreviewMapEl.hidden = false;
    if (!ensurePlacePreview()) {
        placePreviewMapEl.hidden = true;
        return;
    }

    const at = [lat, lng];
    if (!placePreviewMarker) {
        placePreviewMarker = L.marker(at, { icon: placePreviewIcon(), interactive: false })
            .addTo(placePreviewMap);
    } else {
        placePreviewMarker.setLatLng(at);
    }

    placePreviewMap.setView(at, 16, { animate: false });
    setTimeout(() => {
        if (placePreviewMap && !placePreviewMapEl.hidden) placePreviewMap.invalidateSize();
    }, 60);
}

function hidePlacePreview() {
    if (placePreviewMapEl) placePreviewMapEl.hidden = true;
}

function previewSuggestion(e) {
    const btn = e.target.closest(".addressSuggestion[data-idx]");
    if (!btn) return;

    const it = placeSuggestionsList[Number(btn.dataset.idx)];
    if (it) showPlacePreview(it.lat, it.lng);
}
function renderPlaceSuggestions(items, message = "") {
    placeSuggestionsList = items;
    if (!items.length) {
        placeSuggestions.innerHTML = `<div class="addressSuggestion empty">${esc(message || "No matching place found.")}</div>`;
    } else {
        placeSuggestions.innerHTML = items.map((it, i) =>
            `<button type="button" class="addressSuggestion" data-idx="${i}">` +
            `<b>${esc(it.label)}</b>` +
            `<small>${esc(it.kind)}${it.sub ? " - " + esc(it.sub) : ""}</small>` +
            `</button>`
        ).join("") + (message ? `<div class="addressSuggestion empty">${esc(message)}</div>` : "");
    }
    placeSuggestions.hidden = false;
}

async function searchPlaces(q) {
    const token = ++placeSearchToken;
    try {
        const res = await fetch(`api/geocode.php?q=${encodeURIComponent(q)}`, {
            headers: { Accept: "application/json" },
        });
        const out = await res.json();
        if (token !== placeSearchToken) return;

        if (!out.ok) {
            renderPlaceSuggestions([], out.error || "Map search is unavailable.");
            return;
        }

        const items = (out.results || []).map((r) => ({
            label: r.address?.street || (r.label || "").split(",")[0],
            sub: r.label || "",
            lat: Number(r.lat),
            lng: Number(r.lng),
            kind: "OpenStreetMap",
        })).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lng));

        renderPlaceSuggestions(items, items.length ? "" : "No matching place found.");
        if (items.length) showPlacePreview(items[0].lat, items[0].lng);
    } catch (_) {
        if (token === placeSearchToken) {
            renderPlaceSuggestions([], "Map search is unavailable. I-type ang buong lugar at pindutin ang Search & save.");
        }
    }
}

placeInput.addEventListener("input", () => {
    selectedPlace = null;
    hidePlaceSuggestions();
    hidePlacePreview();

    const q = placeInput.value.trim();
    if (q.length < 3) return;

    // Debounce + 1.1s gap para hindi mag-spam sa Nominatim.
    const wait = Math.max(0, 1100 - (Date.now() - placeSearchAt));
    placeSearchTimer = setTimeout(() => {
        placeSearchAt = Date.now();
        searchPlaces(q);
    }, 800 + wait);
});

placeInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        e.stopPropagation();
        hidePlaceSuggestions();
    }
});

placeSuggestions.addEventListener("click", (e) => {
    const btn = e.target.closest(".addressSuggestion[data-idx]");
    if (!btn) return;

    const it = placeSuggestionsList[Number(btn.dataset.idx)];
    if (!it) return;

    selectedPlace = it;
    placeInput.value = it.sub || it.label;
    hidePlaceSuggestions();
    showPlacePreview(it.lat, it.lng);
    showLocMsg("Napili na ang lugar. Tingnan ang preview sa ibaba, tapos pindutin ang Search & save.", "ok");
});

placeSuggestions.addEventListener("mouseover", previewSuggestion);
placeSuggestions.addEventListener("focusin", previewSuggestion);

document.addEventListener("click", (e) => {
    if (!e.target.closest("#placeForm .addressSearchWrap")) hidePlaceSuggestions();
});
function afterManualSave(lat, lng) {
    manualUntil = Date.now() + MANUAL_HOLD_MS;
    latInput.value = lat;
    lngInput.value = lng;
}

// Kung ayaw gumana ang GPS: i-type ang lugar
placeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const address = placeInput.value.trim();
    if (!address) return;

    hidePlaceSuggestions();
    placeBtn.disabled = true;
    placeBtn.textContent = "Searching...";

    try {
        let pt = selectedPlace;

        if (!pt) {
            try {
                pt = await geocodePlace(address);          // sa browser muna (mas maaasahan)
            } catch (_) {
                await sendLocation({ address });           // kung hindi gumana, ang server ang maghahanap
                selectedPlace = null;
                showLocMsg("Na-save ang lugar mo: " + address, "ok");
                return;
            }
        }

        if (!pt) throw new Error('Hindi makita ang lugar na iyon. Subukan ang mas kumpletong pangalan, hal. "Pasig City Public Market, Pasig".');

        showPlacePreview(pt.lat, pt.lng);
        await sendLocation({ lat: pt.lat, lng: pt.lng });
        afterManualSave(pt.lat, pt.lng);
        selectedPlace = null;
        showLocMsg(`Na-save: ${pt.name || pt.sub || pt.label || address} (${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)})`, "ok");
    } catch (err) {
        showLocMsg(err.message, "err");
    } finally {
        placeBtn.disabled = false;
        placeBtn.textContent = "Search & save this place";
    }
});

// Manual na Latitude / Longitude
coordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);
    if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        showLocMsg("Invalid Latitude/Longitude.", "err");
        return;
    }
    locSubmitBtn.disabled = true;
    locSubmitBtn.textContent = "Saving...";
    try {
        await sendLocation({ lat, lng });
        afterManualSave(lat, lng);
        showLocMsg(`Na-save ang location (${lat}, ${lng}). Makikita na ito sa Live Map.`, "ok");
    } catch (err) {
        showLocMsg(err.message, "err");
    } finally {
        locSubmitBtn.disabled = false;
        locSubmitBtn.textContent = "Save Location";
    }
});

// Awtomatikong pag-share habang bukas ang page
function startAutoShare() {
    if (watchId !== null || !("geolocation" in navigator)) return;
    watchId = navigator.geolocation.watchPosition(
        async (pos) => {
            const now = Date.now();
            if (now < manualUntil) return;   // kaka-save lang ng manual na location
            if (now - lastAutoSent < AUTO_REPORT_MS) return;
            lastAutoSent = now;
            try {
                await sendLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
                showLocMsg("Auto-shared ang location mo.", "ok");
            } catch (err) {
                const idle = /no active delivery/i.test(err.message);
                showLocMsg(idle ? "Walang active delivery, kaya hindi muna ibinabahagi ang location mo." : "Auto-share failed: " + err.message, idle ? "ok" : "err");
            }
        },
        (err) => showLocMsg(gpsErrorText(err), "err"),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
}

function stopAutoShare() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

autoShare.addEventListener("change", () => {
    try { localStorage.setItem("autoShareLocation", autoShare.checked ? "1" : "0"); } catch (_) { /* ok lang */ }
    if (autoShare.checked) startAutoShare(); else stopAutoShare();
});

fetch("api/auth.php?action=me").then((r) => r.json()).then((d) => {
    if (!d.ok || !["Rider", "Driver"].includes(d.user.role)) return;
    let saved = null;
    try { saved = localStorage.getItem("autoShareLocation"); } catch (_) { /* ok lang */ }
    autoShare.checked = saved !== "0";
    if (autoShare.checked) startAutoShare();
});