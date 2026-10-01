// =========================
//   SHARED APP SCRIPT
//   Delivery Management System
// =========================

// --- Page navigation map ---
const PAGE_MAP = {
    dashboardButton: "dashboard.html",
    deliveriesButton: "deliveries.html",
    driversButton: "drivers.html",
    customersButton: "customers.html",
    employeeButton: "employees.html",
    reportsButton: "reports.html",
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
function handleLogout() {
    const confirmed = confirm("Are you sure you want to log out?");
    if (confirmed) {
        // Kapag may backend ka na: i-clear ang session dito
        window.location.href = "login.html";
    }
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

// Submit ng Add Delivery form (placeholder hanggang may backend)
