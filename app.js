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