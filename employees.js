// =========================
//   EMPLOYEES PAGE SCRIPT
// =========================

const EMP_API = "api/employees.php";
const ROLE_LIST = ["Employee", "Admin", "Driver"];
const STATUS_LIST = ["Active", "Inactive"];

const empBody = document.querySelector(".dataTable tbody");
const empModal = document.getElementById("employeeModal");
const empForm = document.getElementById("employeeForm");
const empSearch = document.getElementById("employeeSearch");
const empRoleFilter = document.querySelector('[name="employeeRole"]');
const empStatusFilter = document.querySelector('[name="employeeStatus"]');

let employees = [];
let editingId = null;

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
async function loadEmployees() {
    try {
        const res = await fetch(EMP_API);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error(data.error || "Invalid response");
        employees = data;
        renderEmployees();
    } catch (err) {
        console.error(err);
        empBody.innerHTML = `<tr><td colspan="5">Failed to load: ${esc(err.message)}</td></tr>`;
    }
}

function renderEmployees() {
    const q = empSearch.value.trim().toLowerCase();
    const role = empRoleFilter.value;
    const status = empStatusFilter.value;

    const list = employees.filter((e) => {
        const text = `${e.first_name} ${e.last_name} ${e.position ?? ""} ${e.emp_code}`.toLowerCase();
        return (!q || text.includes(q)) &&
               (!role || e.role === role) &&
               (!status || e.status === status);
    });

    if (!list.length) {
        empBody.innerHTML = `<tr><td colspan="5">No employees found.</td></tr>`;
        return;
    }

    empBody.innerHTML = list.map((e) => `
        <tr data-id="${e.id}">
            <td>${esc(e.first_name)} ${esc(e.last_name)}</td>
            <td>${esc(e.position)}</td>
            <td>
                <select class="inlineSel" data-field="role" aria-label="Employee role">
                    ${opts(ROLE_LIST, e.role)}
                </select>
            </td>
            <td>
                <select class="inlineSel" data-field="status" aria-label="Employee status">
                    ${opts(STATUS_LIST, e.status)}
                </select>
            </td>
            <td>${actionButtons()}</td>
        </tr>`).join("");
}

// ---------- SEARCH / FILTER ----------
[empSearch, empRoleFilter, empStatusFilter].forEach((el) => {
    el.addEventListener("input", renderEmployees);
    el.addEventListener("change", renderEmployees);
});

// ---------- MODAL ----------
function openEmpModal(emp = null) {
    editingId = emp ? emp.id : null;
    document.getElementById("empModalTitle").textContent = emp ? "Edit Employee" : "Add Employee";
    empForm.reset();
    if (emp) {
        Object.keys(emp).forEach((key) => {
            if (empForm.elements[key]) empForm.elements[key].value = emp[key] ?? "";
        });
    }
    empModal.style.display = "flex";
}

function closeEmpModal() {
    empModal.style.display = "none";
    editingId = null;
}

document.getElementById("openAddEmp").addEventListener("click", () => openEmpModal());
document.getElementById("closeEmpModal").addEventListener("click", closeEmpModal);
document.getElementById("cancelEmpModal").addEventListener("click", closeEmpModal);
empModal.addEventListener("click", (e) => { if (e.target === empModal) closeEmpModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeEmpModal(); });

// ---------- ADD / EDIT (form submit) ----------
empForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(empForm));
    const url = editingId ? `${EMP_API}?id=${editingId}` : EMP_API;

    const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const out = await res.json();
    if (!out.ok) return alert("Error: " + out.error);

    closeEmpModal();
    loadEmployees();
});

// ---------- ROLE / STATUS dropdown sa row ----------
empBody.addEventListener("change", async (e) => {
    if (!e.target.classList.contains("inlineSel")) return;

    const id = e.target.closest("tr").dataset.id;
    const field = e.target.dataset.field;

    const res = await fetch(`${EMP_API}?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: e.target.value }),
    });
    const out = await res.json();
    if (!out.ok) alert("Error: " + out.error);
    loadEmployees();
});

// ---------- VIEW / EDIT / DELETE buttons ----------
empBody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".iconBtn");
    if (!btn) return;

    const id = btn.closest("tr").dataset.id;
    const emp = employees.find((x) => String(x.id) === id);
    if (!emp) return;

    const action = btn.dataset.action;

    if (action === "view") {
        alert(
            `${emp.first_name} ${emp.last_name}\n` +
            `Code: ${emp.emp_code}\nPosition: ${emp.position ?? "-"}\n` +
            `Department: ${emp.department ?? "-"}\nContact: ${emp.contact ?? "-"}\n` +
            `Email: ${emp.email ?? "-"}\nDate Hired: ${emp.date_hired ?? "-"}\n` +
            `Role: ${emp.role}\nStatus: ${emp.status}`
        );
    } else if (action === "edit") {
        openEmpModal(emp);
    } else if (action === "delete") {
        if (confirm(`Delete ${emp.first_name} ${emp.last_name}?`)) {
            await fetch(`${EMP_API}?id=${id}`, { method: "DELETE" });
            loadEmployees();
        }
    }
});

loadEmployees();