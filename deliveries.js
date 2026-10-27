// =========================
//   DELIVERIES PAGE SCRIPT
// =========================

const DEL_API = "api/deliveries.php";
const CUS_API = "api/customers.php";
const DRV_API = "api/drivers.php";

const STATUS_LIST = ["Pending", "Processing", "Out for Delivery", "Delivered", "Cancelled"];
const ACTIVE_STATUSES = ["Pending", "Processing", "Out for Delivery"];
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

// Overdue: active pa ang delivery pero nakalipas na ang delivery date
const todayKey = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};
const isOverdue = (d) =>
    ACTIVE_STATUSES.includes(d.status) && !!d.del_date && d.del_date < todayKey();

// Punuin ang <select> ng mga pangalan; panatilihin ang current kahit wala na sa listahan
function fillSelect(select, names, placeholder, current = "") {
    const list = [...names];
    if (current && !list.includes(current)) list.unshift(current);
    select.innerHTML =
        `<option value="">${placeholder}</option>` +
        list.map((n) => `<option value="${esc(n)}" ${n === current ? "selected" : ""}>${esc(n)}</option>`).join("");
}

const fmtDateTime = (s) => {
    if (!s) return "-";
    const d = new Date(String(s).replace(" ", "T"));
    return isNaN(d) ? s : d.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
};

// ---------- ICONS ----------
const ICONS = {
    view: `<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>`,
        status: `<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>`,
    history: `<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 7v5l3 2"/></svg>`,
    delete: `<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
};

const actionButtons = () => `
    <div class="actionBtns">
        <button type="button" class="iconBtn" data-action="view" title="View" aria-label="View">${ICONS.view}</button>
        <button type="button" class="iconBtn" data-action="edit" title="Edit" aria-label="Edit">${ICONS.edit}</button>
        <button type="button" class="iconBtn" data-action="status" title="Update Status" aria-label="Update Status">${ICONS.status}</button>
        <button type="button" class="iconBtn" data-action="history" title="History" aria-label="History">${ICONS.history}</button>
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
        delBody.innerHTML = `<tr><td colspan="6">Could not load deliveries. Please refresh the page.</td></tr>`;
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
            <td>${esc(d.customer_name)}${Number(d.stop_count) > 1 ? ` <span class="statusBadge">+${Number(d.stop_count) - 1} more</span>` : ""}</td>
            <td>${esc(d.driver_name)}</td>
            <td>${esc(fmtDate(d.del_date))}${isOverdue(d) ? ' <span class="statusBadge lateBadge">Overdue</span>' : ""}</td>
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
    // Naka-lock ang Delivery Number at Address kapag nagdadagdag (automatic ang laman)
    delForm.elements.delNumber.readOnly = !del;
    delForm.elements.delAddress.readOnly = !del;
    const ok = await refreshLists();
    editingDelId = del ? del.id : null;
    document.getElementById("delModalTitle").textContent = del ? "Edit Delivery" : "Add Delivery";
    document.getElementById("delSubmitBtn").textContent = del ? "Save Changes" : "Add Delivery";
    delForm.reset();
    extraStops.innerHTML = "";
    extraStopsBox.style.display = del ? "none" : "";

    fillSelect(delForm.elements.customerName, customers.map((c) => c.name),
        ok.customersOk ? (customers.length ? "Select customer" : "No customers yet - add one in Customers page") : "Failed to load customers",
        del?.customer_name ?? "");
    fillSelect(delForm.elements.driverAssign, drivers.map((r) => r.name),
    ok.driversOk ? (drivers.length ? "Select driver" : "No drivers yet - create a Driver account in Settings") : "Failed to load drivers",
    del?.driver_name ?? "");

// Isang delivery lang bawat driver: naka-disable ang driver na may active delivery na
const busy = new Set(
    deliveries
        .filter((d) => ACTIVE_STATUSES.includes(d.status) && d.driver_name && (!del || d.id !== del.id))
        .map((d) => d.driver_name)
);
[...delForm.elements.driverAssign.options].forEach((o) => {
    if (o.value && busy.has(o.value) && o.value !== (del?.driver_name ?? "")) {
        o.disabled = true;
        o.textContent = `${o.value} (has active delivery)`;
    }
});

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
    body.extraCustomers = [...extraStops.querySelectorAll(".extraStopRow")].map((row) => ({
        customerName: row.querySelector(".xsCustomer").value,
        itemDesc: row.querySelector(".xsItem").value.trim(),
        quantity: row.querySelector(".xsQty").value,
    }));
    const url = editingDelId ? `${DEL_API}?id=${editingDelId}` : DEL_API;

    const res = await fetch(url, {
        method: editingDelId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const out = await res.json();
    if (!out.ok) return   alert(
  "Error: " + out.error);

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
    if (!out.ok) return   alert(
  "Error: " + out.error);
    closeStatusModal();
    reloadDeliveries();
});

// ---------- HISTORY ----------
const historyModal = document.getElementById("historyModal");
const historyList = document.getElementById("historyList");

function closeHistory() {
    historyModal.style.display = "none";
}

async function openHistory(del) {
    document.getElementById("historyTitle").textContent = "History — " + del.del_number;
    historyList.innerHTML = `<p class="historyEmpty">Loading...</p>`;
    historyModal.style.display = "flex";

    try {
        const res = await fetch(`${DEL_API}?action=events&id=${del.id}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Invalid response");

        if (!data.events.length) {
            historyList.innerHTML = `<p class="historyEmpty">No history yet. Changes will appear here.</p>`;
            return;
        }

        historyList.innerHTML = data.events.map((e) => `
            <div class="historyItem">
                <span class="statusBadge ${BADGE[e.status] ?? ""}">${esc(e.status)}</span>
                <div class="historyMeta">
                    <b>${esc(e.username || "System")}</b>
                    <span>${esc(fmtDateTime(e.created_at))}</span>
                </div>
                ${e.note ? `<p>${esc(e.note)}</p>` : ""}
            </div>`).join("");
    } catch (err) {
        historyList.innerHTML = `<p class="historyEmpty">Failed to load: ${esc(err.message)}</p>`;
    }
}

document.getElementById("closeHistoryModal")?.addEventListener("click", closeHistory);
document.getElementById("closeHistoryBtn")?.addEventListener("click", closeHistory);
historyModal?.addEventListener("click", (e) => { if (e.target === historyModal) closeHistory(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeHistory(); });

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
    } else if (action === "edit") {
        await prepareForm(del);
        openModal(); // galing sa app.js
    } else if (action === "status") {
        openStatusModal(del);
    } else if (action === "history") {
        openHistory(del);
    } else if (action === "delete") {
        if (await confirmBox(`Delete delivery ${del.del_number}?`)) {
            await fetch(`${DEL_API}?id=${id}`, { method: "DELETE" });
            reloadDeliveries();
        }
    }
});

loadAll();

// Auto-refresh tuwing 30s para makita agad ang update ng rider.
// Naka-pause habang bukas ang modal para hindi mawala ang ginagawa.
setInterval(() => {
    if (document.hidden) return;
            if (delModal.style.display === "flex" || statusModal.style.display === "flex" || historyModal?.style.display === "flex") return;
    reloadDeliveries().catch(() => {});
}, 30000);
// ---------- DAGDAG NA CUSTOMER (isang batch) ----------
const MAX_STOPS = 5;
const extraStopsBox = document.getElementById("extraStopsBox");
const extraStops = document.getElementById("extraStops");

function refreshStopChoices() {
    extraStops.querySelectorAll(".xsTitle").forEach((t, i) => (t.textContent = "Customer " + (i + 2)));
    const selects = [...extraStops.querySelectorAll(".xsCustomer")];
    const chosen = [delForm.elements.customerName.value, ...selects.map((s) => s.value)].filter(Boolean);
    selects.forEach((sel) => {
        [...sel.options].forEach((o) => {
            o.disabled = !!o.value && o.value !== sel.value && chosen.includes(o.value);
        });
    });
}

function addStopRow() {
    if (extraStops.children.length >= MAX_STOPS - 1) {
        alert("A delivery can have at most " + MAX_STOPS + " customers.");
        return;
    }
    const row = document.createElement("div");
    row.className = "extraStopRow";
    row.style.cssText = "display:grid;gap:8px;margin:10px 0;padding:10px;border:1px solid var(--border);border-radius:8px;";
    row.innerHTML = `
    <b class="xsTitle"></b>
    <select class="xsCustomer" required></select>
    <small class="xsAddress"></small>
        <input type="text" class="xsItem" placeholder="Item description" required>
        <input type="number" class="xsQty" min="1" placeholder="Quantity" required>
        <button type="button" class="btnOutline xsRemove">Remove</button>`;
    fillSelect(row.querySelector(".xsCustomer"), customers.map((c) => c.name), "Select customer");
    extraStops.appendChild(row);
    refreshStopChoices();
}

document.getElementById("addStopBtn").addEventListener("click", addStopRow);
extraStops.addEventListener("change", (e) => {
    if (!e.target.classList.contains("xsCustomer")) return;
    const c = customers.find((x) => x.name === e.target.value);
    e.target.closest(".extraStopRow").querySelector(".xsAddress").textContent = c ? (c.address ?? "") : "";
    refreshStopChoices();
});
extraStops.addEventListener("click", (e) => {
    if (!e.target.classList.contains("xsRemove")) return;
    e.target.closest(".extraStopRow").remove();
    refreshStopChoices();
});
delForm.elements.customerName.addEventListener("change", refreshStopChoices);