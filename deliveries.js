// =========================
//   DELIVERIES PAGE SCRIPT
// =========================

console.log("deliveries.js v2 loaded");

const DEL_API = "api/deliveries.php";
const CUS_API = "api/customers.php";
const DRV_API = "api/drivers.php";

const STATUS_LIST = ["Pending", "Processing", "Out for Delivery", "Delivered", "Cancelled"];
const BADGE = {
    "Pending": "pendingBadge",
    "Processing": "processingBadge",
    "Out for Delivery": "outBadge",
    "Delivered": "deliveredBadge",
    "Cancelled": "cancelledBadge",
};

const delBody = document.querySelector(".dataTable tbody");
const delModal = document.getElementById("deliveryModal");
const delForm = document.getElementById("deliveryForm");
const statusModal = document.getElementById("statusModal");
const statusForm = document.getElementById("statusForm");

// Toolbar filters
const fSearch = document.getElementById("searchDelivery");
const fStatus = document.querySelector('[name="delStatus"]');
const fDriver = document.querySelector('[name="driverName"]');
const fDate = document.querySelector('[name="filterDate"]');

let deliveries = [];
let customers = [];
let drivers = [];
let editingDelId = null;
let statusDelId = null;

// ---------- HELPERS ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmtDate = (d) => {
    if (!d) return "";
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-US",
        { month: "short", day: "numeric", year: "numeric" });
};

// Punuin ang <select> ng mga pangalan; panatilihin ang current kahit wala na sa listahan
function fillSelect(select, names, placeholder, current = "") {
    const list = [...names];
    if (current && !list.includes(current)) list.unshift(current);
    select.innerHTML =
        `<option value="">${placeholder}</option>` +
        list.map((n) => `<option value="${esc(n)}" ${n === current ? "selected" : ""}>${esc(n)}</option>`).join("");
}

// ---------- ICONS ----------
const ICONS = {
    view: `<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>`,
    status: `<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>`,
    delete: `<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
};

const actionButtons = () => `
    <div class="actionBtns">
        <button type="button" class="iconBtn" data-action="view" title="View" aria-label="View">${ICONS.view}</button>
        <button type="button" class="iconBtn" data-action="edit" title="Edit" aria-label="Edit">${ICONS.edit}</button>
        <button type="button" class="iconBtn" data-action="status" title="Update Status" aria-label="Update Status">${ICONS.status}</button>
        <button type="button" class="iconBtn danger" data-action="delete" title="Delete" aria-label="Delete">${ICONS.delete}</button>
    </div>`;

// ---------- LOAD ----------
// Hiwa-hiwalay ang pagkuha para hindi masira ang isa kapag pumalya ang isa pa
async function fetchList(url) {
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error(data.error || "Invalid response");
        return data;
    } catch (err) {
        console.error("Failed to load " + url, err);
        return null;
    }
}

async function refreshLists() {
    const [c, r] = await Promise.all([fetchList(CUS_API), fetchList(DRV_API)]);
    if (c) customers = c;
    if (r) drivers = r;
    return { customersOk: !!c, driversOk: !!r };
}

async function loadAll() {
    const [d] = await Promise.all([fetchList(DEL_API), refreshLists()]);

    if (!d) {
        delBody.innerHTML = `<tr><td colspan="6">Failed to load deliveries. Check api/deliveries.php</td></tr>`;
    } else {
        deliveries = d;
    }

    // Driver filter sa toolbar galing sa Drivers table
    fillSelect(fDriver, drivers.map((x) => x.name), "Driver", fDriver.value);

    if (d) renderDeliveries();
}

async function reloadDeliveries() {
    const res = await fetch(DEL_API);
    deliveries = await res.json();
    renderDeliveries();
}

// ---------- RENDER + FILTER ----------
function renderDeliveries() {
    const q = fSearch.value.trim().toLowerCase();
    const status = fStatus.value;
    const driver = fDriver.value;
    const date = fDate.value;

    const list = deliveries.filter((d) =>
        (!q || `${d.del_number} ${d.customer_name} ${d.driver_name ?? ""} ${d.item_desc ?? ""}`.toLowerCase().includes(q)) &&
        (!status || d.status === status) &&
        (!driver || d.driver_name === driver) &&
        (!date || d.del_date === date)
    );

    if (!list.length) {
        delBody.innerHTML = `<tr><td colspan="6">No deliveries found.</td></tr>`;
        return;
    }

    delBody.innerHTML = list.map((d) => `
        <tr data-id="${d.id}">
            <td>${esc(d.del_number)}</td>
            <td>${esc(d.customer_name)}</td>
            <td>${esc(d.driver_name)}</td>
            <td>${esc(fmtDate(d.del_date))}</td>
            <td><span class="statusBadge ${BADGE[d.status] ?? ""}">${esc(d.status) || "No status"}</span></td>
            <td>${actionButtons()}</td>
        </tr>`).join("");
}

[fSearch, fStatus, fDriver, fDate].forEach((el) => {
    el.addEventListener("input", renderDeliveries);
    el.addEventListener("change", renderDeliveries);
});

document.getElementById("filterBtn").addEventListener("click", renderDeliveries);
document.getElementById("resetBtn").addEventListener("click", () => {
    fSearch.value = "";
    fStatus.value = "";
    fDriver.value = "";
    fDate.value = "";
    renderDeliveries();
});

// ---------- ADD / EDIT MODAL ----------
function nextDeliveryNumber() {
    const nums = deliveries
        .map((d) => parseInt(String(d.del_number).replace(/\D/g, ""), 10))
        .filter((n) => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return "DEL-" + String(next).padStart(3, "0");
}

async function prepareForm(del = null) {
    const ok = await refreshLists();
    editingDelId = del ? del.id : null;
    document.getElementById("delModalTitle").textContent = del ? "Edit Delivery" : "Add Delivery";
    document.getElementById("delSubmitBtn").textContent = del ? "Save Changes" : "Add Delivery";
    delForm.reset();

    fillSelect(delForm.elements.customerName, customers.map((c) => c.name),
        ok.customersOk ? (customers.length ? "Select customer" : "No customers yet - add one in Customers page") : "Failed to load customers",
        del?.customer_name ?? "");
    fillSelect(delForm.elements.driverAssign, drivers.map((r) => r.name),
        ok.driversOk ? (drivers.length ? "Select driver" : "No drivers yet - add one in Drivers page") : "Failed to load drivers",
        del?.driver_name ?? "");

    if (del) {
        delForm.elements.delNumber.value = del.del_number ?? "";
        delForm.elements.delAddress.value = del.address ?? "";
        delForm.elements.contactNumber.value = del.contact ?? "";
        delForm.elements.delDate.value = del.del_date ?? "";
        delForm.elements.vehicle.value = del.vehicle ?? "";
        delForm.elements.itemDesc.value = del.item_desc ?? "";
        delForm.elements.quantity.value = del.quantity ?? "";
        delForm.elements.remarks.value = del.remarks ?? "";
        delForm.elements.status.value = del.status;
    } else {
        delForm.elements.delNumber.value = nextDeliveryNumber();
        delForm.elements.status.value = "Pending";
    }
}

// Ang app.js ang nagbubukas ng modal sa "+ New Delivery"; ihahanda lang natin ang form
document.getElementById("openAddDel").addEventListener("click", () => prepareForm());

// Kapag pumili ng customer, awtomatikong ilagay ang address at contact
delForm.elements.customerName.addEventListener("change", (e) => {
    const c = customers.find((x) => x.name === e.target.value);
    if (!c) return;
    delForm.elements.delAddress.value = c.address ?? "";
    delForm.elements.contactNumber.value = c.contact ?? "";
});

delForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(delForm));
    const url = editingDelId ? `${DEL_API}?id=${editingDelId}` : DEL_API;

    const res = await fetch(url, {
        method: editingDelId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const out = await res.json();
    if (!out.ok) return alert("Error: " + out.error);

    closeModal(); // galing sa app.js
    editingDelId = null;
    reloadDeliveries();
});

// ---------- STATUS MODAL ----------
function openStatusModal(del) {
    statusDelId = del.id;
    statusForm.elements.status.value = del.status;
    statusModal.style.display = "flex";
}

function closeStatusModal() {
    statusModal.style.display = "none";
    statusDelId = null;
}

document.getElementById("closeStatusModal").addEventListener("click", closeStatusModal);
document.getElementById("cancelStatusModal").addEventListener("click", closeStatusModal);
statusModal.addEventListener("click", (e) => { if (e.target === statusModal) closeStatusModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeStatusModal(); });

statusForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const res = await fetch(`${DEL_API}?id=${statusDelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusForm.elements.status.value }),
    });
    const out = await res.json();
    if (!out.ok) return alert("Error: " + out.error);
    closeStatusModal();
    reloadDeliveries();
});

// ---------- VIEW / EDIT / STATUS / DELETE ----------
delBody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".iconBtn");
    if (!btn) return;

    const id = btn.closest("tr").dataset.id;
    const del = deliveries.find((x) => String(x.id) === id);
    if (!del) return;

    const action = btn.dataset.action;

    if (action === "view") {
        alert(
            `${del.del_number}\n` +
            `Customer: ${del.customer_name}\nAddress: ${del.address ?? "-"}\n` +
            `Contact: ${del.contact ?? "-"}\nDate: ${fmtDate(del.del_date) || "-"}\n` +
            `Driver: ${del.driver_name ?? "-"}\nVehicle: ${del.vehicle ?? "-"}\n` +
            `Item: ${del.item_desc ?? "-"} (Qty: ${del.quantity})\n` +
            `Status: ${del.status}\nRemarks: ${del.remarks ?? "-"}` +
            (del.delivered_at ? `\nDelivered at: ${del.delivered_at}` : "") +
            (del.rider_notes ? `\nRider notes: ${del.rider_notes}` : "")
        );
        if (del.proof_image && confirm("Open the proof of delivery photo?")) {
            window.open(del.proof_image, "_blank");
        }
    } else if (action === "edit") {
        await prepareForm(del);
        openModal(); // galing sa app.js
    } else if (action === "status") {
        openStatusModal(del);
    } else if (action === "delete") {
        if (confirm(`Delete delivery ${del.del_number}?`)) {
            await fetch(`${DEL_API}?id=${id}`, { method: "DELETE" });
            reloadDeliveries();
        }
    }
});

loadAll();