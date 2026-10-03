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
                <span class="statusBadge ${Number(employee.is_active) ? "deliveredBadge" : "pendingBadge"}">
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

    alert(
        `Employee ID: EMP-${String(employee.id).padStart(4, "0")}\n` +
        `Full Name: ${employee.full_name}\n` +
        `Username: ${employee.username}\n` +
        `Email: ${employee.email || "-"}\n` +
        `Contact Number: ${employee.contact_number || "-"}\n` +
        `Role: ${employee.role}\n` +
        `Status: ${Number(employee.is_active) ? "Active" : "Disabled"}\n` +
        `Last Login: ${employee.last_login || "Never"}`
    );
});

loadEmployees();