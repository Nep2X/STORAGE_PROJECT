// =========================
//   DASHBOARD PAGE SCRIPT
// =========================

const DASH_API = "api/dashboard.php";
const ACTIVE_STATUSES = ["Pending", "Processing", "Out for Delivery"];

const BADGE = {
    "Pending": "pendingBadge",
    "Processing": "processingBadge",
    "Out for Delivery": "outBadge",
    "Delivered": "deliveredBadge",
    "Cancelled": "cancelledBadge",
};

const STATUS_ROWS = [
    { key: "Pending", cls: "pending" },
    { key: "Processing", cls: "processing" },
    { key: "Out for Delivery", cls: "out" },
    { key: "Delivered", cls: "delivered" },
    { key: "Cancelled", cls: "cancelled" },
];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmtDate = (d) => {
    if (!d) return "";
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-US",
        { month: "short", day: "numeric", year: "numeric" });
};

const num = (n) => Number(n || 0).toLocaleString("en-PH");
const $id = (id) => document.getElementById(id);

let hasRenderedStats = false;

const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ---------- NUMBER ANIMATION ----------
function countUp(el, value, suffix = "") {
    if (!el) return;

    const target = Number(value) || 0;
    const reduce = window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || !target) {
        el.textContent = num(target) + suffix;
        return;
    }

    const started = performance.now();
    const duration = 550;

    const tick = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = num(Math.round(target * eased)) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
}

// ---------- WELCOME ----------
function welcome(user) {
    if (!user) return;

    const name = String(user.full_name || user.username || "").trim().split(/\s+/)[0];
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    const heading = $id("dashGreeting");
    if (heading) heading.textContent = `${greeting}, ${name || "there"}`;
}

// ---------- KPI CARDS ----------
function renderStats(data) {
    const c = data.counts || {};
    const total = Number(data.total) || 0;
    const delivered = Number(c["Delivered"]) || 0;
    const rate = total ? Math.round((delivered / total) * 100) : 0;
    const overdue = Number(data.overdue) || 0;

    const setValue = (el, value, suffix = "") => {
        if (!el) return;
        if (hasRenderedStats) {
            el.textContent = num(value) + suffix;
        } else {
            countUp(el, value, suffix);
        }
    };

    setValue($id("kpiTotal"), total);
    setValue($id("kpiActive"), data.active);
    setValue($id("kpiRate"), rate, "%");
    setValue($id("kpiOverdue"), overdue);
    hasRenderedStats = true;

    const totalFoot = $id("kpiTotalFoot");
    if (totalFoot) totalFoot.textContent = `${num(data.today_total)} scheduled today`;

    const activeFoot = $id("kpiActiveFoot");
    if (activeFoot) {
        const out = Number(c["Out for Delivery"]) || 0;
        activeFoot.textContent = `${num(out)} out for delivery right now`;
    }

    const rateFoot = $id("kpiRateFoot");
    if (rateFoot) {
        rateFoot.textContent = total
            ? `${num(delivered)} of ${num(total)} deliveries completed`
            : "No deliveries yet";
    }

    const overdueCard = $id("kpiOverdue")?.closest(".kpiCard");
    if (overdueCard) {
        overdueCard.classList.toggle("is-overdue", overdue > 0);
        overdueCard.classList.toggle("is-clear", overdue === 0);
    }

    const overdueFoot = $id("kpiOverdueFoot");
    if (overdueFoot) {
        overdueFoot.textContent = overdue > 0
            ? "Needs attention today"
            : "All active deliveries on time";
    }
}

// ---------- STATUS BREAKDOWN ----------
function renderBreakdown(data) {
    const c = data.counts || {};
    const total = Number(data.total) || 0;
    const list = $id("statusList");
    if (!list) return;

    list.innerHTML = STATUS_ROWS.map(({ key, cls }) => {
        const count = Number(c[key]) || 0;
        const percent = total ? Math.round((count / total) * 100) : 0;

        return `<div class="breakdownRow">
            <div class="breakdownTop">
                <span class="breakdownName"><i class="statusDot ${cls}"></i>${esc(key)}</span>
                <strong>${num(count)}</strong>
            </div>
            <div class="breakdownTrack">
                <span class="breakdownFill ${cls}" style="width:${percent}%"></span>
            </div>
            <span class="breakdownPct">${percent}%</span>
        </div>`;
    }).join("");

    const drivers = data.drivers || {};
    const onRoute = Number(drivers["On Route"]) || 0;
    const available = Number(drivers["Available"]) || 0;
    const driverFoot = $id("driverFoot");
    if (driverFoot) {
        driverFoot.textContent =
            `${num(onRoute)} ${onRoute === 1 ? "driver" : "drivers"} on route · ` +
            `${num(available)} available`;
    }
}

// ---------- RECENT DELIVERIES ----------
function renderRecent(list) {
    const tbody = $id("recentRows");
    if (!tbody) return;

    if (!list || !list.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="emptyRow">No deliveries yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((d) => {
        const overdue = ACTIVE_STATUSES.includes(d.status) &&
            d.del_date && d.del_date < todayKey();

        return `<tr>
            <td><b>${esc(d.del_number)}</b></td>
            <td>${esc(d.customer_name)}</td>
            <td>${esc(d.driver_name) || '<span class="mutedText">Unassigned</span>'}</td>
            <td>${esc(fmtDate(d.del_date)) || "—"}${overdue ? ' <span class="statusBadge lateBadge">Overdue</span>' : ""}</td>
            <td><span class="statusBadge ${BADGE[d.status] ?? ""}">${esc(d.status)}</span></td>
        </tr>`;
    }).join("");
}

// ---------- CHART ----------
function renderChart(chart) {
    const bars = $id("chartBars");
    const days = $id("chartDays");
    if (!bars || !days) return;

    const labels = chart.labels || [];
    const values = chart.values || [];
    const max = Math.max(...values, 1);
    const sum = values.reduce((a, b) => a + Number(b || 0), 0);

    const chartTotal = $id("chartTotal");
    if (chartTotal) chartTotal.textContent = num(sum);

    bars.innerHTML = values.map((v, i) => {
        const value = Number(v) || 0;
        const height = value === 0 ? 2 : Math.max(6, Math.round((value / max) * 100));

        return `<div class="activityCol" title="${esc(labels[i])}: ${num(value)}">
            <span class="activityValue">${value ? num(value) : ""}</span>
            <span class="activityBar" style="height:${height}%"></span>
        </div>`;
    }).join("");

    days.innerHTML = labels.map((l) => `<span>${esc(l)}</span>`).join("");
}

// ---------- LOAD ----------
async function loadDashboard() {
    const select = $id("periodSelect");
    const period = select ? select.value : "7";

    try {
        const res = await fetch(`${DASH_API}?period=${encodeURIComponent(period)}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Invalid response");

        renderStats(data);
        renderBreakdown(data);
        renderRecent(data.recent);
        renderChart(data.chart || {});

        const sub = $id("chartSub");
        if (sub) {
            sub.textContent = period === "30"
                ? "Last 30 days"
                : period === "year"
                    ? "This year"
                    : "Last 7 days";
        }

        const updated = $id("dashUpdated");
        if (updated) {
            updated.textContent = "Updated " + new Date().toLocaleTimeString("en-PH", {
                hour: "numeric",
                minute: "2-digit",
            });
        }
    } catch (err) {
        console.error(err);

        const tbody = $id("recentRows");
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="emptyRow">Failed to load: ${esc(err.message)}</td></tr>`;
        }

        const updated = $id("dashUpdated");
        if (updated) updated.textContent = "Update failed";
    }
}

// ---------- BUTTONS ----------
$id("newDeliveryBtn")?.addEventListener("click", () => {
    window.location.href = "deliveries.html";
});

$id("viewAllBtn")?.addEventListener("click", () => {
    window.location.href = "deliveries.html";
});

$id("openMapBtn")?.addEventListener("click", () => {
    window.location.href = "live-map.html";
});

$id("periodSelect")?.addEventListener("change", loadDashboard);

// ---------- START ----------
const dateLabel = $id("dashDate");
if (dateLabel) {
    dateLabel.textContent = new Intl.DateTimeFormat("en-PH", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    }).format(new Date());
}

welcome(window.currentUser);
document.addEventListener("userready", (e) => welcome(e.detail));

loadDashboard();

// Refresh quietly while the tab is visible.
setInterval(() => {
    if (!document.hidden) loadDashboard();
}, 60000);
