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

// Tatlong style ng mapa: Street (CARTO), Terrain (Esri Topo), Satellite (Esri Imagery).
// Naka-save ang pinili sa localStorage, kaya pareho sa lahat ng mapa.
const CARTO_KEY = "cb1_4why_1_52b2a94ec9af8613fa26c98b";
const MAP_STYLE_KEY = "mapStyle";
const DEFAULT_MAP_STYLE = "topo";   // "street" kung Voyager ang gusto mong default

const MAP_STYLES = {
    street:    { label: "Street",    attribution: "&copy; OpenStreetMap contributors &copy; CARTO" },
    topo:      { label: "Topo",      attribution: "Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS, &copy; OpenStreetMap contributors" },
    imagery:   { label: "Satellite", attribution: "Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics" },
};

function mapStyleName() {
    try {
        const v = localStorage.getItem(MAP_STYLE_KEY);
        if (v && MAP_STYLES[v]) return v;
    } catch (_) {}
    return DEFAULT_MAP_STYLE;
}

function mapTileUrl(style = mapStyleName()) {
    if (style === "topo")    return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}";
    if (style === "imagery") return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    const dark = document.documentElement.getAttribute("data-theme") === "midnight";
    return "https://{s}.basemaps.cartocdn.com/rastertiles/" + (dark ? "dark_all" : "voyager") + "/{z}/{x}/{y}.png?key=" + CARTO_KEY;
}

function mapAttribution(style = mapStyleName()) {
    return (MAP_STYLES[style] || MAP_STYLES.street).attribution;
}

function mapMaxNativeZoom(style = mapStyleName()) {
    return style === "imagery" ? 18 : 19;   // upscaled na lang ang z19 sa imagery
}

const MAP_ATTRIBUTION = MAP_STYLES.street.attribution;

// Para sa CSS: walang filter ang Topo/Imagery, dilim lang sa Midnight.
document.documentElement.setAttribute("data-map-style", mapStyleName());