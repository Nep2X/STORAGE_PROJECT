// Color theme ng buong website. Naka-save sa browser ng user.
(function () {
    const THEMES = { lime: "Lime", ocean: "Ocean", sunset: "Sunset", midnight: "Midnight" };
    const KEY = "theme";

    function saved() {
        try { return localStorage.getItem(KEY); } catch (_) { return null; }
    }

    function apply(name) {
        if (!THEMES[name] || name === "lime") document.documentElement.removeAttribute("data-theme");
        else document.documentElement.setAttribute("data-theme", name);
    }

    apply(saved());   // agad, bago pa lumabas ang page (walang kisap)

    document.addEventListener("DOMContentLoaded", () => {
        const slot = document.getElementById("themeSlot");   // nasa Settings page lang
        if (!slot || slot.querySelector(".themePicker")) return;   // wala sa ibang page, o nandiyan na ang picker
        const select = document.createElement("select");
        select.className = "themePicker";
        select.setAttribute("aria-label", "Color theme");
        select.innerHTML = Object.entries(THEMES)
            .map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
        select.value = THEMES[saved()] ? saved() : "lime";
        select.addEventListener("change", () => {
            apply(select.value);
            try { localStorage.setItem(KEY, select.value); } catch (_) { /* ok lang */ }
        });
        slot.appendChild(select);
    });
})();