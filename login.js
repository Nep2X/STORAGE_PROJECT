// =========================
//   LOGIN PAGE SCRIPT
// =========================

const form = document.getElementById("loginForm");
const errBox = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");
const pwInput = document.getElementById("password");

const goTo = (role) => window.location.replace(
    role === "Admin" || role === "Employee" ? "dashboard.html" : "rider.html"
);

// Kung naka-login na, diretso na sa tamang page
(async () => {
    try {
        const res = await fetch("api/auth.php?action=me");
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok) goTo(data.user.role);
    } catch (e) { /* hayaan, ipakita ang login form */ }
})();

document.getElementById("showPw").addEventListener("change", (e) => {
    pwInput.type = e.target.checked ? "text" : "password";
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errBox.style.display = "none";
    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";

    try {
        const res = await fetch("api/auth.php?action=login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: document.getElementById("username").value.trim(),
                password: pwInput.value,
            }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Login failed.");
        window.location.replace(data.redirect);
    } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = "block";
        pwInput.value = "";
        pwInput.focus();
        loginBtn.disabled = false;
        loginBtn.textContent = "Log In";
    }
});