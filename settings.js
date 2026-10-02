const AUTH_API = "api/auth.php";
const USERS_API = "api/users.php";

let me = null;
let users = [];
let drivers = [];
let editingUserId = null;
let resetUserId = null;

const $ = id => document.getElementById(id);

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
}[char]));

const fmtDateTime = value => {
    if (!value) return "Never";
    const date = new Date(String(value).replace(" ", "T"));
    return isNaN(date) ? value : date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
};

async function api(url, options = {}) {
    const response = await fetch(url, options);
    let data;

    try {
        data = await response.json();
    } catch {
        throw new Error("Server error. Please try again.");
    }

    if (data?.ok === false) {
        throw new Error(data.error || "Request failed.");
    }

    return data;
}

const send = (url, body, method = "POST") => api(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
});

const openDialog = id => {
    document.getElementById(id).style.display = "flex";
};

const closeDialog = id => {
    document.getElementById(id).style.display = "none";
};
document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => closeDialog(button.dataset.close));
});

["profileModal", "passwordModal", "userModal", "resetModal"].forEach(id => {
    const modal = $(id);

    if (modal) {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                closeDialog(id);
            }
        });
    }
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        ["profileModal", "passwordModal", "userModal", "resetModal"].forEach(closeDialog);
    }
});

const RIDER_ROLES = ["Driver", "Rider"];

async function loadDrivers() {
    try {
        const data = await api("api/drivers.php");
        drivers = Array.isArray(data) ? data : [];
    } catch (error) {
        drivers = [];
    }
}

function toggleDriverField() {
    $("uDriverGroup").style.display = RIDER_ROLES.includes($("uRole").value) ? "block" : "none";
}

const ICONS = {
    edit: `<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>`,
    key: `<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L21 2"/><path d="M17 6l3 3"/></svg>`,
    delete: `<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>`
};

async function loadProfile() {
    const data = await api(`${AUTH_API}?action=me`);
    me = data.user;

    $("pName").textContent = me.full_name;
    $("pUsername").textContent = me.username;
    $("pEmail").textContent = me.email || "-";
    $("pRole").textContent = me.role;
    $("pLastLogin").textContent = fmtDateTime(me.last_login);
}

$("editProfileBtn").addEventListener("click", () => {
    $("profName").value = me.full_name ?? "";
    $("profEmail").value = me.email ?? "";
    openDialog("profileModal");
});

$("profileForm").addEventListener("submit", async event => {
    event.preventDefault();

    try {
        await send(`${AUTH_API}?action=update_profile`, {
            full_name: $("profName").value.trim(),
            email: $("profEmail").value.trim()
        });

        closeDialog("profileModal");
        await loadProfile();
        if (me.role === "Admin") await loadUsers();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

$("changePwBtn").addEventListener("click", () => {
    $("passwordForm").reset();
    openDialog("passwordModal");
});

$("passwordForm").addEventListener("submit", async event => {
    event.preventDefault();

    if ($("newPw").value !== $("confPw").value) {
        alert("The new passwords do not match.");
        return;
    }

    try {
        await send(`${AUTH_API}?action=change_password`, {
            current: $("curPw").value,
            new: $("newPw").value
        });

        closeDialog("passwordModal");
        alert("Password updated.");
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

async function loadUsers() {
    const body = $("userRows");

    try {
        users = await api(USERS_API);

        if (!Array.isArray(users)) {
            throw new Error("Invalid response.");
        }

        body.innerHTML = users.map(user => `
            <tr data-id="${user.id}">
                <td>${esc(user.full_name)}</td>
                <td>${esc(user.username)}</td>
                <td>${esc(user.role)}${user.driver_name ? ` (${esc(user.driver_name)})` : ""}</td>
                <td>${esc(user.contact_number) || "-"}</td>
                <td>
                    <span class="statusBadge ${user.is_active ? "deliveredBadge" : "pendingBadge"}">
                        ${user.is_active ? "Active" : "Disabled"}
                    </span>
                </td>
                <td>
                    <div class="actionBtns">
                        <button type="button" class="iconBtn" data-action="edit" title="Edit">${ICONS.edit}</button>
                        <button type="button" class="iconBtn" data-action="reset" title="Reset password">${ICONS.key}</button>
                        <button type="button" class="iconBtn danger" data-action="delete" title="Delete">${ICONS.delete}</button>
                    </div>
                </td>
            </tr>
        `).join("") || `<tr><td colspan="6">No users yet.</td></tr>`;
    } catch (error) {
        body.innerHTML = `<tr><td colspan="6">Failed to load: ${esc(error.message)}</td></tr>`;
    }
}

async function openUserModal(user = null) {
    await loadDrivers();
    editingUserId = user?.id ?? null;

    $("userModalTitle").textContent = user ? "Edit User" : "Add User";
    $("userForm").reset();
    $("uUsername").readOnly = !!user;
    $("uPasswordGroup").style.display = user ? "none" : "block";
    $("uActiveGroup").style.display = user ? "block" : "none";
    $("uPassword").required = !user;

    $("uDriver").innerHTML = `<option value="">Select driver</option>` +
        drivers.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join("");

    if (user) {
        $("uUsername").value = user.username;
        $("uName").value = user.full_name;
        $("uEmail").value = user.email ?? "";
        $("uRole").value = user.role;
        $("uContact").value = user.contact_number ?? "";
        $("uDriver").value = user.driver_id ?? "";
        $("uActive").value = user.is_active ? "1" : "0";
    } else {
        $("uRole").value = "Employee";
    }

    toggleDriverField();

    openDialog("userModal");
}
$("uRole").addEventListener("change", toggleDriverField);

const openAddUser = document.getElementById("openAddUser");

if (openAddUser) {
    openAddUser.addEventListener("click", () => {
        openUserModal();
    });
}

$("userForm").addEventListener("submit", async event => {
    event.preventDefault();

    const body = {
        full_name: $("uName").value.trim(),
        email: $("uEmail").value.trim(),
        role: $("uRole").value,
        contact_number: $("uContact").value.trim(),
        driver_id: RIDER_ROLES.includes($("uRole").value) ? $("uDriver").value : ""
    };

    try {
        if (editingUserId) {
            body.is_active = $("uActive").value === "1";
            await send(`${USERS_API}?id=${editingUserId}`, body, "PUT");
        } else {
            body.username = $("uUsername").value.trim();
            body.password = $("uPassword").value;
            await send(USERS_API, body);
        }

        closeDialog("userModal");
        await loadUsers();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

$("resetForm").addEventListener("submit", async event => {
    event.preventDefault();

    try {
        await send(`${USERS_API}?id=${resetUserId}`, {
            password: $("resetPw").value
        }, "PUT");

        closeDialog("resetModal");
        alert("Password has been reset.");
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
});

$("userRows").addEventListener("click", async event => {
    const button = event.target.closest(".iconBtn");
    if (!button) return;

    const id = button.closest("tr").dataset.id;
    const user = users.find(item => String(item.id) === id);
    if (!user) return;

    const action = button.dataset.action;

    if (action === "edit") {
        openUserModal(user);
        return;
    }

    if (action === "reset") {
        resetUserId = user.id;
        $("resetTitle").textContent = `Reset password: ${user.username}`;
        $("resetForm").reset();
        openDialog("resetModal");
        return;
    }

    if (action === "delete") {
        if (!confirm(`Delete the account "${user.username}"?`)) return;

        try {
            await api(`${USERS_API}?id=${id}`, { method: "DELETE" });
            await loadUsers();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }
});

loadProfile().then(() => {
    if (me.role === "Admin") {
        return loadUsers();
    }

    // Employee: itago ang bahagi ng user accounts
    $("userRows").closest(".panel").style.display = "none";
    $("openAddUser").closest(".panel").style.display = "none";
}).catch(error => console.error(error));