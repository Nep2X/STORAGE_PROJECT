// =========================
//   DASHBOARD SCRIPT
// =========================

// --- Sidebar navigation (active state toggle) ---
const sidebarButtons = document.querySelectorAll(".optionSec button");

sidebarButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        // Skip logout buttons sa active toggle
        if (btn.id === "sidebarLogoutButton") return;

        sidebarButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        // Kapag may separate pages ka na, redirect dito:
        // window.location.href = btn.id.replace("Button", "") + ".html";
    });
});

// --- Logout buttons ---
function handleLogout() {
    const confirmed = confirm("Are you sure you want to log out?");
    if (confirmed) {
        // Palitan ng actual logout logic (e.g. clear session, redirect)
        window.location.href = "login.html";
    }
}

document.getElementById("logoutButton").addEventListener("click", handleLogout);
document.getElementById("sidebarLogoutButton").addEventListener("click", handleLogout);

// --- Header buttons ---
document.getElementById("aboutButton").addEventListener("click", () => {
    window.location.href = "index.html"; // home page
});

document.getElementById("profileButton").addEventListener("click", () => {
    window.location.href = "profile.html";
});

// --- New Delivery button ---
document.getElementById("newDeliveryBtn").addEventListener("click", () => {
    // Palitan ng redirect sa delivery form page
    alert("Redirect to New Delivery form...");
    // window.location.href = "new-delivery.html";
});

// --- View All button ---
document.getElementById("viewAllBtn").addEventListener("click", () => {
    // Palitan ng redirect sa full deliveries page
    alert("Redirect to all deliveries...");
    // window.location.href = "deliveries.html";
});

// --- Period selector ---
document.getElementById("periodSelect").addEventListener("change", (e) => {
    console.log("Selected period:", e.target.value);
    // Dito mo i-update yung chart/data based sa selected period
});