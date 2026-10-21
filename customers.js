// =========================
//   CUSTOMERS PAGE SCRIPT
// =========================

const CUS_API = "api/customers.php";

const cusBody = document.querySelector(".dataTable tbody");
const cusModal = document.getElementById("customerModal");
const cusForm = document.getElementById("customerForm");
const cusSearch = document.getElementById("customerSearch");

let customers = [];
let editingCusId = null;

// ---------- HELPERS ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- ICONS ----------
const ICONS = {
    view: `<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>`,
    delete: `<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
};

const actionButtons = () => `
    <div class="actionBtns">
        <button type="button" class="iconBtn" data-action="view" title="View" aria-label="View">${ICONS.view}</button>
        <button type="button" class="iconBtn" data-action="edit" title="Edit" aria-label="Edit">${ICONS.edit}</button>
        <button type="button" class="iconBtn danger" data-action="delete" title="Delete" aria-label="Delete">${ICONS.delete}</button>
    </div>`;

// ---------- LOAD + RENDER ----------
async function loadCustomers() {
    try {
        const res = await fetch(CUS_API);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error(data.error || "Invalid response");
        customers = data;
        renderCustomers();
    } catch (err) {
        console.error(err);
        cusBody.innerHTML = `<tr><td colspan="5">Failed to load: ${esc(err.message)}</td></tr>`;
    }
}

function renderCustomers() {
    const q = cusSearch.value.trim().toLowerCase();

    const list = customers.filter((c) =>
        !q || `${c.name} ${c.contact ?? ""} ${c.address ?? ""}`.toLowerCase().includes(q)
    );

    if (!list.length) {
        cusBody.innerHTML = `<tr><td colspan="5">No customers found.</td></tr>`;
        return;
    }

    cusBody.innerHTML = list.map((c) => `
        <tr data-id="${c.id}">
            <td>${esc(c.name)}</td>
            <td>${esc(c.contact)}</td>
            <td>${esc(c.address)}</td>
            <td>${esc(c.deliveries)}</td>
            <td>${actionButtons()}</td>
        </tr>`).join("");
}

cusSearch.addEventListener("input", renderCustomers);

// ---------- ADDRESS HELPERS ----------
const ADDR_FIELDS = ["street", "city", "province"];
const cusFormError = document.getElementById("cusFormError");

// Ang naka-save na address ay "Street, Town/City, Province". Hatiin ito pabalik para sa Edit.
function splitAddress(address) {
    const parts = String(address ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
        return { street: parts.slice(0, -2).join(", "), city: parts[parts.length - 2], province: parts[parts.length - 1] };
    }
    return { street: parts.join(", "), city: "", province: "" };   // lumang address na hindi kumpleto
}

function clearFormError() {
    cusFormError.hidden = true;
    cusFormError.textContent = "";
    ADDR_FIELDS.forEach((f) => cusForm.elements[f].classList.remove("fieldInvalid"));
}

function showFormError(message, fields = []) {
    cusFormError.textContent = message;
    cusFormError.hidden = false;
    fields.forEach((f) => cusForm.elements[f] && cusForm.elements[f].classList.add("fieldInvalid"));
    if (fields.length && cusForm.elements[fields[0]]) cusForm.elements[fields[0]].focus();
}

// ---------- MAP + ADDRESS PICKER ----------
const searchInput = document.getElementById("cusAddressSearch");
const suggestBox = document.getElementById("cusSuggestions");
const MAP_CENTER = [12.8797, 121.7740];

let cusMap = null;
let pinMarker = null;
let suggestions = [];
let searchTimer = null;
let searchToken = 0;

const themeVar = (name, fallback) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function pinIcon() {
    const accent = themeVar("--accent", "#BFF100");
    return L.divIcon({
        className: "",
        html: `<svg width="30" height="40" viewBox="0 0 30 40" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">` +
              `<path d="M15 39C15 39 2 24.5 2 14.5C2 7.04 7.82 1 15 1s13 6.04 13 13.5C28 24.5 15 39 15 39z" fill="${accent}" stroke="#fff" stroke-width="2"/>` +
              `<circle cx="15" cy="14.5" r="4.5" fill="#fff"/></svg>`,
        iconSize: [30, 40],
        iconAnchor: [15, 39],
    });
}

function ensureMap() {
    if (cusMap) return true;
    if (typeof L === "undefined") return false;
    cusMap = L.map("cusMap", { scrollWheelZoom: false }).setView(MAP_CENTER, 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
    }).addTo(cusMap);
    return true;
}

function setPin(lat, lng, pan = false) {
    lat = Number(lat);
    lng = Number(lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !ensureMap()) return;

    cusForm.elements.lat.value = lat.toFixed(7);
    cusForm.elements.lng.value = lng.toFixed(7);

    const at = [lat, lng];
    if (!pinMarker) {
        pinMarker = L.marker(at, { icon: pinIcon(), draggable: true }).addTo(cusMap);
        pinMarker.on("dragend", onPinDrag);
    } else {
        pinMarker.setLatLng(at);
        pinMarker.setIcon(pinIcon());
    }
    if (pan) cusMap.setView(at, Math.max(cusMap.getZoom(), 15));
}

function clearPin() {
    if (pinMarker && cusMap) cusMap.removeLayer(pinMarker);
    pinMarker = null;
    cusForm.elements.lat.value = "";
    cusForm.elements.lng.value = "";
}

async function onPinDrag() {
    if (!pinMarker) return;
    const { lat, lng } = pinMarker.getLatLng();
    cusForm.elements.lat.value = lat.toFixed(7);
    cusForm.elements.lng.value = lng.toFixed(7);

    // Punan lang ang blangkong address fields; huwag i-overwrite ang tinype.
    try {
        const res = await fetch(`api/geocode.php?reverse=1&lat=${lat}&lng=${lng}`);
        const out = await res.json();
        if (!out.ok || !out.result) return;
        const a = out.result.address || {};
        if (!cusForm.elements.street.value.trim() && a.street) cusForm.elements.street.value = a.street;
        if (!cusForm.elements.city.value.trim() && a.city) cusForm.elements.city.value = a.city;
        if (!cusForm.elements.province.value.trim() && a.province) cusForm.elements.province.value = a.province;
        if (!searchInput.value.trim() && out.result.label) searchInput.value = out.result.label;
    } catch (_) {
        // okay lang; naka-save pa rin ang coordinates
    }
}

function hideSuggestions() {
    suggestions = [];
    suggestBox.hidden = true;
    suggestBox.innerHTML = "";
}

function localSuggestions(q) {
    const t = q.toLowerCase();
    return customers
        .filter((c) => c.lat != null && c.lng != null)
        .filter((c) => `${c.name} ${c.contact ?? ""} ${c.address ?? ""}`.toLowerCase().includes(t))
        .slice(0, 5)
        .map((c) => ({
            label: c.name,
            sub: c.address || "",
            lat: Number(c.lat),
            lng: Number(c.lng),
            address: splitAddress(c.address),
            kind: "Saved customer",
        }));
}

function renderSuggestions(items, message = "") {
    suggestions = items;
    if (!items.length) {
        suggestBox.innerHTML = `<div class="addressSuggestion empty">${esc(message || "No matching address found.")}</div>`;
    } else {
        suggestBox.innerHTML = items.map((it, i) =>
            `<button type="button" class="addressSuggestion" data-idx="${i}">` +
            `<b>${esc(it.label)}</b>` +
            `<small>${esc(it.kind)}${it.sub ? " · " + esc(it.sub) : ""}</small>` +
            `</button>`
        ).join("") + (message ? `<div class="addressSuggestion empty">${esc(message)}</div>` : "");
    }
    suggestBox.hidden = false;
}

async function searchRemote(q, local) {
    const token = ++searchToken;
    try {
        const res = await fetch(`api/geocode.php?q=${encodeURIComponent(q)}`);
        const out = await res.json();
        if (token !== searchToken) return;

        if (!out.ok) {
            renderSuggestions(local, out.error || "Map search is unavailable. You can still drag the pin.");
            return;
        }

        const remote = (out.results || []).map((r) => ({
            label: r.address?.street || (r.label || "").split(",")[0],
            sub: r.label || "",
            lat: Number(r.lat),
            lng: Number(r.lng),
            address: r.address || {},
            kind: "OpenStreetMap",
        }));

        const seen = new Set();
        const merged = [...local, ...remote].filter((x) => {
            const k = `${Number(x.lat).toFixed(4)},${Number(x.lng).toFixed(4)}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        }).slice(0, 8);

        renderSuggestions(merged, merged.length ? "" : "No matching address found.");
    } catch (_) {
        if (token === searchToken) {
            renderSuggestions(local, "Map search is unavailable. You can still drag the pin.");
        }
    }
}

searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchToken++;

    const q = searchInput.value.trim();
    if (q.length < 2) {
        hideSuggestions();
        return;
    }

    const local = localSuggestions(q);
    renderSuggestions(local);

    if (q.length < 3) return;
    searchTimer = setTimeout(() => searchRemote(q, local), 600);
});

searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        e.stopPropagation();
        hideSuggestions();
    }
});

suggestBox.addEventListener("click", (e) => {
    const btn = e.target.closest(".addressSuggestion[data-idx]");
    if (!btn) return;

    const it = suggestions[Number(btn.dataset.idx)];
    if (!it) return;

    if (it.address?.street) cusForm.elements.street.value = it.address.street;
    if (it.address?.city) cusForm.elements.city.value = it.address.city;
    if (it.address?.province) cusForm.elements.province.value = it.address.province;

    searchInput.value = it.sub || it.label;
    if (Number.isFinite(it.lat) && Number.isFinite(it.lng)) setPin(it.lat, it.lng, true);
    hideSuggestions();
});

document.addEventListener("click", (e) => {
    if (!e.target.closest(".addressSearchWrap")) hideSuggestions();
});

// Kapag ginamit muli ang street/city/province, huwag nang gamitin ang lumang pin.
ADDR_FIELDS.forEach((f) => cusForm.elements[f].addEventListener("input", clearPin));

new MutationObserver(() => {
    if (pinMarker) pinMarker.setIcon(pinIcon());
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

// ---------- MODAL ----------
function openCusModal(cus = null) {
    editingCusId = cus ? cus.id : null;
    document.getElementById("cusModalTitle").textContent = cus ? "Edit Customer" : "Add Customer";
    cusForm.reset();
    clearFormError();
    hideSuggestions();
    searchInput.value = "";

    if (cus) {
        cusForm.elements.name.value = cus.name ?? "";
        cusForm.elements.contact.value = cus.contact ?? "";

        const a = splitAddress(cus.address);
        cusForm.elements.street.value = a.street;
        cusForm.elements.city.value = a.city;
        cusForm.elements.province.value = a.province;
    }

    cusModal.style.display = "flex";

    if (ensureMap()) {
        setTimeout(() => cusMap.invalidateSize(), 100);

        if (cus && cus.lat != null && cus.lng != null) {
            setPin(cus.lat, cus.lng, true);
        } else {
            clearPin();
            cusMap.setView(MAP_CENTER, 6);
        }
    }
}

function closeCusModal() {
    searchToken++;
    hideSuggestions();
    searchInput.value = "";
    cusModal.style.display = "none";
    editingCusId = null;
}

document.getElementById("openAddCus").addEventListener("click", () => openCusModal());
document.getElementById("closeCusModal").addEventListener("click", closeCusModal);
document.getElementById("cancelCusModal").addEventListener("click", closeCusModal);
cusModal.addEventListener("click", (e) => { if (e.target === cusModal) closeCusModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCusModal(); });

// ---------- ADD / EDIT ----------
cusForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormError();

    const body = Object.fromEntries(new FormData(cusForm));
    const url = editingCusId ? `${CUS_API}?id=${editingCusId}` : CUS_API;
    const saveBtn = cusForm.querySelector('button[type="submit"]');

    // Mabilis na check sa browser: kumpleto ba ang address?
    const missing = ADDR_FIELDS.filter((f) => !String(body[f] ?? "").trim());
    if (missing.length) {
        return showFormError("Please complete the address: street / building, town / city, and province.", missing);
    }

    saveBtn.disabled = true;
    const label = saveBtn.textContent;
    saveBtn.textContent = "Checking address...";

    try {
        const res = await fetch(url, {
            method: editingCusId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const out = await res.json();
        if (!out.ok) return showFormError(out.error || "Could not save the customer.", out.fields || []);

        closeCusModal();
        loadCustomers();
    } catch (err) {
        showFormError("Could not reach the server. Please try again.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = label;
    }
});

// ---------- VIEW / EDIT / DELETE ----------
cusBody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".iconBtn");
    if (!btn) return;

    const id = btn.closest("tr").dataset.id;
    const cus = customers.find((x) => String(x.id) === id);
    if (!cus) return;

    const action = btn.dataset.action;

    if (action === "view") {
          alert(
  
            `${cus.name}\nContact: ${cus.contact ?? "-"}\n` +
            `Address: ${cus.address ?? "-"}\nDeliveries: ${cus.deliveries}`
        );
    } else if (action === "edit") {
        openCusModal(cus);
    } else if (action === "delete") {
        if (await confirmBox(`Delete customer ${cus.name}?`)) {
            await fetch(`${CUS_API}?id=${id}`, { method: "DELETE" });
            loadCustomers();
        }
    }
});

loadCustomers();