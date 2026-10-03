// =========================
//   DASHBOARD PAGE SCRIPT
// =========================

const DASH_API = "api/dashboard.php";
const PERIODS = ["7", "30", "year"]; // kapareho ng pagkakasunod ng options sa #periodSelect

const BADGE = {
    "Pending": "pendingBadge",
    "Processing": "processingBadge",
    "Out for Delivery": "outBadge",
    "Delivered": "deliveredBadge",
    "Cancelled": "cancelledBadge",
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmtDate = (d) => {
    if (!d) return "";
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-US",
        { month: "short", day: "numeric", year: "numeric" });
};

const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
};

// ---------- CARDS + STATUS SUMMARY ----------
function renderCounts(data) {
    const c = data.counts;

    setText(".totalCard .cardValue", data.total);
    setText(".pendingCard .cardValue", c["Pending"]);
    setText(".processingCard .cardValue", c["Processing"]);
    setText(".outCard .cardValue", c["Out for Delivery"]);
    setText(".deliveredCard .cardValue", c["Delivered"]);
    setText(".cancelledCard .cardValue", c["Cancelled"]);

    const summary = {
        pending: c["Pending"],
        processing: c["Processing"],
        out: c["Out for Delivery"],
        delivered: c["Delivered"],
        cancelled: c["Cancelled"],
    };
    Object.entries(summary).forEach(([cls, value]) => {
        const dot = document.querySelector(`.statusDot.${cls}`);
        const strong = dot?.closest(".statusRow")?.querySelector("strong");
        if (strong) strong.textContent = value;
    });
}

// ---------- RECENT DELIVERIES ----------
function renderRecent(list) {
    const tbody = document.querySelector(".recentDeliveryTable tbody");
    if (!tbody) return;

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="5">No deliveries yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((d) => `
        <tr>
            <td>${esc(d.del_number)}</td>
            <td>${esc(d.customer_name)}</td>
            <td>${esc(d.driver_name) || "-"}</td>
            <td>${esc(fmtDate(d.del_date))}</td>
            <td><span class="statusBadge ${BADGE[d.status] ?? ""}">${esc(d.status)}</span></td>
        </tr>`).join("");
}

// ---------- CHART ----------
function renderChart(chart) {
    const bars = document.querySelector(".chartBars");
    const days = document.querySelector(".chartDays");
    if (!bars || !days) return;

    const max = Math.max(...chart.values, 1);

    bars.innerHTML = chart.values.map((v, i) => {
        const h = v === 0 ? 2 : Math.max(8, Math.round((v / max) * 100));
        return `<span style="height:${h}%" title="${esc(chart.labels[i])}: ${v}"></span>`;
    }).join("");

    days.innerHTML = chart.labels.map((l) => `<span>${esc(l)}</span>`).join("");
}

// ---------- LOAD ----------
async function loadDashboard() {
    const select = document.getElementById("periodSelect");
    const period = PERIODS[select ? select.selectedIndex : 0] ?? "7";

    try {
        const res = await fetch(`${DASH_API}?period=${period}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Invalid response");

        renderCounts(data);
        renderRecent(data.recent);
        renderChart(data.chart);
    } catch (err) {
        console.error(err);
        const tbody = document.querySelector(".recentDeliveryTable tbody");
        if (tbody) tbody.innerHTML = `<tr><td colspan="5">Failed to load: ${esc(err.message)}</td></tr>`;
    }
}

// ---------- BUTTONS ----------
document.getElementById("newDeliveryBtn")?.addEventListener("click", () => {
    window.location.href = "deliveries.html";
});

document.getElementById("viewAllBtn")?.addEventListener("click", () => {
    window.location.href = "deliveries.html";
});

document.getElementById("periodSelect")?.addEventListener("change", loadDashboard);

loadDashboard();