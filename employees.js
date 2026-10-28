const EMP_API = "api/users.php";

const empBody = document.getElementById("employeeRows");
const empSearch = document.getElementById("employeeSearch");
const empRoleFilter = document.getElementById("employeeRole");
const empStatusFilter = document.getElementById("employeeStatus");

let employees = [];

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
}[char]));

const ICONS = {
    view: `<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`
};

async function loadEmployees() {
    try {
        const response = await fetch(EMP_API);
        const data = await response.json();

        if (data?.ok === false) {
            throw new Error(data.error);
        }

        if (!Array.isArray(data)) {
            throw new Error("Invalid response.");
        }

        employees = data;
        renderEmployees();
    } catch (error) {
        console.error(error);
        empBody.innerHTML = `
            <tr>
                <td colspan="8">Failed to load: ${esc(error.message)}</td>
            </tr>
        `;
    }
}

function renderEmployees() {
    const search = empSearch.value.trim().toLowerCase();
    const role = empRoleFilter.value;
    const status = empStatusFilter.value;

    const list = employees.filter(employee => {
        const text = [
            employee.id,
            employee.full_name,
            employee.username,
            employee.email,
            employee.contact_number,
            employee.role
        ].join(" ").toLowerCase();

        const matchesSearch = !search || text.includes(search);
        const matchesRole = !role || employee.role === role;
        const matchesStatus = !status ||
            (status === "Active"
                ? Number(employee.is_active) === 1
                : Number(employee.is_active) === 0);

        return matchesSearch && matchesRole && matchesStatus;
    });

    if (!list.length) {
        empBody.innerHTML = `
            <tr>
                <td colspan="8">No employees found.</td>
            </tr>
        `;
        return;
    }

    empBody.innerHTML = list.map(employee => `
        <tr data-id="${employee.id}">
            <td>EMP-${String(employee.id).padStart(4, "0")}</td>
            <td>${esc(employee.full_name)}</td>
            <td>${esc(employee.username)}</td>
            <td>${esc(employee.email) || "-"}</td>
            <td>${esc(employee.contact_number) || "-"}</td>
            <td><span class="statusBadge">${esc(employee.role)}</span></td>
            <td>
                <span class="statusBadge ${Number(employee.is_active) ? "activeBadge" : "disabledBadge"}">
                    ${Number(employee.is_active) ? "Active" : "Disabled"}
                </span>
            </td>
            <td>
                <div class="actionBtns">
                    <button type="button" class="iconBtn" data-action="view" title="View">
                        ${ICONS.view}
                    </button>
                </div>
            </td>
        </tr>
    `).join("");
}

[empSearch, empRoleFilter, empStatusFilter].forEach(element => {
    element.addEventListener(
        element.tagName === "INPUT" ? "input" : "change",
        renderEmployees
    );
});

empBody.addEventListener("click", event => {
    const button = event.target.closest(".iconBtn");
    if (!button) return;

    const id = button.closest("tr").dataset.id;
    const employee = employees.find(item => String(item.id) === id);
    if (!employee) return;

    if (button.dataset.action === "view") openEmpView(employee);
});

// ---------- VIEW MODAL (kagaya sa Deliveries) ----------
const empViewModal = document.getElementById("empViewModal");
const empViewBody = document.getElementById("empViewBody");
let empViewingId = null;
let empViewLastFocused = null;

const empViewRow = (label, value) =>
    `<div class="viewRow"><dt>${label}</dt><dd>${value}</dd></div>`;

const empCode = (id) => "EMP-" + String(id).padStart(4, "0");

const empStatusBadge = (active) =>
    `<span class="statusBadge ${Number(active) ? "activeBadge" : "disabledBadge"}">${Number(active) ? "Active" : "Disabled"}</span>`;

function closeEmpView() {
    if (empViewModal.style.display !== "flex") return;
    empViewModal.style.display = "none";
    empViewingId = null;
    if (empViewLastFocused && typeof empViewLastFocused.focus === "function") empViewLastFocused.focus();
    empViewLastFocused = null;
}

function openEmpView(employee) {
    // Klik ulit sa View ng parehong employee = isara
    if (empViewModal.style.display === "flex" && empViewingId === employee.id) {
        closeEmpView();
        return;
    }

    empViewingId = employee.id;
    empViewLastFocused = document.activeElement;
    document.getElementById("empViewTitle").textContent = empCode(employee.id);
    empViewBody.innerHTML = `<dl class="viewList">
        ${empViewRow("Full Name", esc(employee.full_name))}
        ${empViewRow("Username", esc(employee.username))}
        ${empViewRow("Email", esc(employee.email || "-"))}
        ${empViewRow("Contact", esc(employee.contact_number || "-"))}
        ${empViewRow("Role", esc(employee.role))}
        ${empViewRow("Status", empStatusBadge(employee.is_active))}
        ${empViewRow("Last Login", esc(employee.last_login || "Never"))}
    </dl>`;
    empViewModal.style.display = "flex";
    document.getElementById("closeEmpView").focus();
}

document.getElementById("closeEmpView").addEventListener("click", closeEmpView);
empViewModal.addEventListener("click", (e) => { if (e.target === empViewModal) closeEmpView(); });   // click sa labas
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeEmpView(); });

loadEmployees();