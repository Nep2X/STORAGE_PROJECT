// =========================
//   SHARED APP SCRIPT
//   Delivery Management System
// =========================

const LOGIN_PAGE = "login.html";

// --- Hawakan ang orihinal na fetch, at i-redirect sa login kapag 401 ang sagot ng kahit anong API ---
const _fetch = window.fetch.bind(window);
window.fetch = async (...args) => {
    const res = await _fetch(...args);
    if (res.status === 401) window.location.href = LOGIN_PAGE;
    return res;
};

// --- Itago ang page hanggang makumpirmang naka-login ---
document.documentElement.style.visibility = "hidden";

(async function authGuard() {
    try {
        const res = await _fetch("api/auth.php?action=me");
        const data = await res.json();

        if (!res.ok || !data.ok) {
            window.location.replace(LOGIN_PAGE);
            return;
        }

        const role = data.user.role;

        // Rider / Driver: rider page lang
        if (role !== "Admin" && role !== "Employee") {
            window.location.replace("rider.html");
            return;
        }

        // Employee: walang access sa Employees (user accounts) at Rider Report page
        if (role === "Employee") {
            const page = window.location.pathname.split("/").pop();
            if (page === "employees.html" || page === "rider.html") {
                window.location.replace("dashboard.html");
                return;
            }
            ["employeeButton", "riderButton"].forEach((id) => {
                const btn = document.getElementById(id);
                if (btn) btn.style.display = "none";
            });
        }

        window.currentUser = data.user;
        document.documentElement.style.visibility = "";
        document.dispatchEvent(new CustomEvent("userready", { detail: data.user }));
    } catch (err) {
        window.location.replace(LOGIN_PAGE);
    }
})();

const PAGE_MAP = {
    dashboardButton: "dashboard.html",
    deliveriesButton: "deliveries.html",
    driversButton: "drivers.html",
    mapButton: "live-map.html",
    customersButton: "customers.html",
    employeeButton: "employees.html",
    reportsButton: "reports.html",
    riderButton: "rider.html",
    settingsButton: "settings.html",
};

// Sidebar navigation -> redirect to page
Object.entries(PAGE_MAP).forEach(([id, file]) => {
    const btn = document.getElementById(id);
    if (btn) {
        btn.addEventListener("click", () => {
            window.location.href = file;
        });
    }
});

// --- Logout ---
async function handleLogout() {
    if (!confirm("Are you sure you want to log out?")) return;
    try {
        await _fetch("api/auth.php?action=logout", { method: "POST" });
    } catch (err) { /* magla-logout pa rin sa screen */ }
    window.location.href = LOGIN_PAGE;
}

["logoutButton", "sidebarLogoutButton"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", handleLogout);
});

// --- Header buttons ---
const aboutBtn = document.getElementById("aboutButton");
if (aboutBtn) aboutBtn.addEventListener("click", () => (window.location.href = "dashboard.html"));

const profileBtn = document.getElementById("profileButton");
if (profileBtn) profileBtn.addEventListener("click", () => (window.location.href = "settings.html"));

// =========================
//   DELIVERIES MODAL
// =========================
const deliveryModal = document.getElementById("deliveryModal");
const openAddDel = document.getElementById("openAddDel");
const closeModalBtn = document.getElementById("closeModal");
const cancelModalBtn = document.getElementById("cancelModal");

function openModal() {
    if (deliveryModal) deliveryModal.style.display = "flex";
}

function closeModal() {
    if (deliveryModal) deliveryModal.style.display = "none";
}

if (openAddDel) openAddDel.addEventListener("click", openModal);
if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
if (cancelModalBtn) cancelModalBtn.addEventListener("click", closeModal);

// Close kapag nag-click sa labas ng modal box
if (deliveryModal) {
    deliveryModal.addEventListener("click", (e) => {
        if (e.target === deliveryModal) closeModal();
    });
}

// Close sa Escape key
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});
// Reference UI: icon rail; preserve original button IDs and handlers.
const uiNavIcons = {"dashboardButton": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\"/>", "deliveriesButton": "<path d=\"m3 8 9-5 9 5v10l-9 5-9-5Zm0 0 9 5 9-5m-9 5v10\"/>", "driversButton": "<path d=\"M2 5h12v12H2Zm12 5h5l3 4v3h-8\"/><circle cx=\"6\" cy=\"19\" r=\"2\"/><circle cx=\"18\" cy=\"19\" r=\"2\"/>", "mapButton": "<path d=\"m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Zm6-3v15m6-12v15\"/>", "customersButton": "<circle cx=\"12\" cy=\"7\" r=\"4\"/><path d=\"M4 21v-3a8 8 0 0 1 16 0v3\"/>", "employeeButton": "<circle cx=\"9\" cy=\"8\" r=\"3\"/><path d=\"M2 21v-3a7 7 0 0 1 14 0v3m1-17a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 7\"/>", "reportsButton": "<path d=\"M5 3h10l4 4v14H5Zm4 14v-4m4 4V9\"/>", "riderButton": "<path d=\"M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4\"/>", "settingsButton": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2\"/>", "sidebarLogoutButton": "<path d=\"M9 3H3v18h6m5-15 6 6-6 6m-6-6h12\"/>"};
Object.entries(uiNavIcons).forEach(([id, paths]) => {
 const button = document.getElementById(id);
 if (!button) return;
 const label = button.textContent.trim();
 button.title = label;
 button.setAttribute('aria-label', label);
 button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
});
