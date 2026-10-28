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

// Mga tile ng mapa na tugma sa theme (CARTO Positron = light gray, Dark Matter = dark gray)
const CARTO_KEY = "cb1_4why_1_52b2a94ec9af8613fa26c98b";   // free key from carto.com/basemaps/apikey

function mapTileUrl() {
    const dark = document.documentElement.getAttribute("data-theme") === "midnight";
    return "https://{s}.basemaps.cartocdn.com/rastertiles/" + (dark ? "dark_all" : "light_all") + "/{z}/{x}/{y}.png?key=" + CARTO_KEY;
}
const MAP_ATTRIBUTION = "&copy; OpenStreetMap contributors &copy; CARTO";