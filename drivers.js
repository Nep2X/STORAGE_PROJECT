// =========================
//   DRIVERS PAGE SCRIPT
// =========================

const DRV_API = "api/drivers.php";
const DRV_STATUS_LIST = ["Available", "On Route", "Offline"];

const drvBody = document.querySelector(".dataTable tbody");
const drvModal = document.getElementById("driverModal");
const drvForm = document.getElementById("driverForm");
const drvSearch = document.getElementById("driverSearch");
const drvStatusFilter = document.getElementById("driverStatusFilter");

let drivers = [];
let editingDrvId = null;

// ---------- HELPERS ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const opts = (list, current) =>
    list.map((v) => `<option value="${v}" ${v === current ? "selected" : ""}>${v}</option>`).join("");

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
async function loadDrivers() {
    try {
        const res = await fetch(DRV_API);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error(data.error || "Invalid response");
        drivers = data;
        renderDrivers();
    } catch (err) {
        console.error(err);
        drvBody.innerHTML = `<tr><td colspan="5">Failed to load: ${esc(err.message)}</td></tr>`;
    }
}

function renderDrivers() {
    const q = drvSearch.value.trim().toLowerCase();
    const status = drvStatusFilter.value;

    const list = drivers.filter((d) =>
        (!q || `${d.name} ${d.contact ?? ""}`.toLowerCase().includes(q)) &&
        (!status || d.status === status)
    );

    if (!list.length) {
        drvBody.innerHTML = `<tr><td colspan="5">No drivers found.</td></tr>`;
        return;
    }

    drvBody.innerHTML = list.map((d) => `
        <tr data-id="${d.id}">
            <td>${esc(d.name)}</td>
            <td>${esc(d.contact)}</td>
            <td>${esc(d.deliveries)}</td>
            <td>
                <select class="inlineSel" aria-label="Driver status">
                    ${opts(DRV_STATUS_LIST, d.status)}
                </select>
            </td>
            <td>${actionButtons()}</td>
        </tr>`).join("");
}

// ---------- SEARCH / FILTER ----------
drvSearch.addEventListener("input", renderDrivers);
drvStatusFilter.addEventListener("change", renderDrivers);

// ---------- MODAL ----------
function openDrvModal(drv = null) {
    editingDrvId = drv ? drv.id : null;
    document.getElementById("drvModalTitle").textContent = drv ? "Edit Driver" : "Add Driver";
    drvForm.reset();
    if (drv) {
        drvForm.elements.name.value = drv.name ?? "";
        drvForm.elements.contact.value = drv.contact ?? "";
        drvForm.elements.status.value = drv.status;
    }
    drvModal.style.display = "flex";
}

function closeDrvModal() {
    drvModal.style.display = "none";
    editingDrvId = null;
}

document.getElementById("openAddDrv").addEventListener("click", () => openDrvModal());
document.getElementById("closeDrvModal").addEventListener("click", closeDrvModal);
document.getElementById("cancelDrvModal").addEventListener("click", closeDrvModal);
drvModal.addEventListener("click", (e) => { if (e.target === drvModal) closeDrvModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrvModal(); });

// ---------- ADD / EDIT (form submit) ----------
drvForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(drvForm));
    const url = editingDrvId ? `${DRV_API}?id=${editingDrvId}` : DRV_API;

    const res = await fetch(url, {
        method: editingDrvId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const out = await res.json();
    if (!out.ok) return alert("Error: " + out.error);

    closeDrvModal();
    loadDrivers();
});

// ---------- STATUS dropdown sa row ----------
drvBody.addEventListener("change", async (e) => {
    if (!e.target.classList.contains("inlineSel")) return;

    const id = e.target.closest("tr").dataset.id;
    const res = await fetch(`${DRV_API}?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: e.target.value }),
    });
    const out = await res.json();
    if (!out.ok) alert("Error: " + out.error);
    loadDrivers();
});

// ---------- VIEW / EDIT / DELETE buttons ----------
drvBody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".iconBtn");
    if (!btn) return;

    const id = btn.closest("tr").dataset.id;
    const drv = drivers.find((x) => String(x.id) === id);
    if (!drv) return;

    const action = btn.dataset.action;

    if (action === "view") {
        alert(
            `${drv.name}\nContact: ${drv.contact ?? "-"}\n` +
            `Deliveries: ${drv.deliveries}\nStatus: ${drv.status}`
        );
    } else if (action === "edit") {
        openDrvModal(drv);
    } else if (action === "delete") {
        if (confirm(`Delete driver ${drv.name}?`)) {
            await fetch(`${DRV_API}?id=${id}`, { method: "DELETE" });
            loadDrivers();
        }
    }
});

loadDrivers();