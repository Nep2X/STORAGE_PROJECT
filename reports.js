// =========================
//   REPORTS PAGE SCRIPT
// =========================

const REP_API = "api/reports.php";

const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");

let report = null;

// ---------- INLINE MESSAGE ----------
const msgBox = document.getElementById("repMessage");
let msgTimer;

function clearMsg() {
    msgBox.hidden = true;
    msgBox.textContent = "";
}

function showMsg(text) {
    msgBox.textContent = text;
    msgBox.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(clearMsg, 6000);
}

// ---------- HELPERS ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmtMonth = (ym) => {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

function renderRows(tbodyId, list, labelFn = (r) => r.name) {
    const tbody = document.getElementById(tbodyId);
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="4">No data for this period.</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map((r) => `
        <tr>
            <td>${esc(labelFn(r))}</td>
            <td>${r.total}</td>
            <td>${r.delivered}</td>
            <td>${r.cancelled}</td>
        </tr>`).join("");
}

const thumbUrl = (p) => "api/thumb.php?f=" + encodeURIComponent(String(p).split("/").pop());

const fmtDateTime = (s) => {
    if (!s) return "—";
    const d = new Date(String(s).replace(" ", "T"));
    return isNaN(d) ? s : d.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
};

function renderRider(list) {
    const tbody = document.getElementById("riderRows");
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="7">No rider reports for this period.</td></tr>`;
        return;
    }
    tbody.innerHTML = list.map((r) => `
        <tr>
            <td>${esc(r.del_number)}</td>
            <td>${esc(r.customer_name || "—")}</td>
            <td>${esc(r.del_date || "—")}</td>
            <td>${esc(fmtDateTime(r.delivered_at))}</td>
            <td>${esc(r.driver_name || "—")}</td>
            <td>
                <a href="${esc(r.proof_image)}" class="proofLink">
                    <img class="proofThumb" loading="lazy" src="${esc(thumbUrl(r.proof_image))}" data-full="${esc(r.proof_image)}" alt="Proof for ${esc(r.del_number)}">
                </a>
            </td>
            <td class="notesCell">${r.rider_notes ? `<div class="notesClamp" title="${esc(r.rider_notes)}">${esc(r.rider_notes)}</div>` : "—"}</td>
        </tr>`).join("");
}

// ---------- EXPAND / COLLAPSE NOTES ----------
document.getElementById("riderRows").addEventListener("click", (e) => {
    const note = e.target.closest(".notesClamp");
    if (note) note.classList.toggle("expanded");
});

// ---------- RIDER FILTER ----------
const riderFilter = document.getElementById("riderFilter");
let riderList = [];

function applyRiderFilter() {
    const name = riderFilter.value;
    renderRider(name ? riderList.filter((r) => r.driver_name === name) : riderList);
}

function setRiderData(list) {
    riderList = list;
    const current = riderFilter.value;
    const names = [...new Set(list.map((r) => r.driver_name).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));

    riderFilter.innerHTML = `<option value="">All riders</option>` +
        names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");

    // Panatilihin ang napiling rider kung nasa bagong listahan pa rin siya
    riderFilter.value = names.includes(current) ? current : "";
    applyRiderFilter();
}

riderFilter.addEventListener("change", applyRiderFilter);

// ---------- PROOF PHOTO VIEWER ----------
const photoViewer = document.createElement("div");
photoViewer.className = "photoViewer";
photoViewer.innerHTML = `
    <div class="photoViewerBar">
        <button type="button" class="photoViewerClose" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="5" y1="5" x2="19" y2="19"/>
                <line x1="19" y1="5" x2="5" y2="19"/>
            </svg>
        </button>
    </div>
    <img class="photoViewerImg" alt="Proof of delivery">`;
document.body.appendChild(photoViewer);

const viewerImg = photoViewer.querySelector(".photoViewerImg");
const closeViewer = () => {
    photoViewer.classList.remove("open");
    viewerImg.src = "";
};

document.getElementById("riderRows").addEventListener("click", (e) => {
    const link = e.target.closest(".proofLink");
    if (!link) return;
    e.preventDefault();
    viewerImg.src = link.href;
    photoViewer.classList.add("open");
});

photoViewer.querySelector(".photoViewerClose").addEventListener("click", closeViewer);
photoViewer.addEventListener("click", (e) => { if (e.target === photoViewer) closeViewer(); });

// Kapag nawala o sira ang litrato, papalitan ng text
document.getElementById("riderRows").addEventListener("error", (e) => {
    if (!e.target.classList.contains("proofThumb")) return;
    const full = e.target.dataset.full;
    if (full && !e.target.dataset.fellBack) {
        e.target.dataset.fellBack = "1";
        e.target.src = full;
        return;
    }
    const span = document.createElement("span");
    span.className = "proofMissing";
    span.textContent = "Photo unavailable";
    e.target.closest("a").replaceWith(span);
}, true);document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeViewer(); });

// ---------- LOAD ----------
async function loadReport() {
    clearMsg();
    const params = new URLSearchParams();
    if (fromDate.value) params.set("from", fromDate.value);
    if (toDate.value) params.set("to", toDate.value);

    if (fromDate.value && toDate.value && fromDate.value > toDate.value) {
        return showMsg("The 'From' date must not be later than the 'To' date.");
    }

    try {
        const res = await fetch(`${REP_API}?${params}`);
        const data = await res.json();
        if (!data.ok) throw new Error(data.error || "Invalid response");
        report = data;

        const delivered = data.counts["Delivered"];
        document.getElementById("repTotal").textContent = data.total;
        document.getElementById("repDelivered").textContent = delivered;
        document.getElementById("repCancelled").textContent = data.counts["Cancelled"];
        document.getElementById("repRate").textContent =
            data.total ? Math.round((delivered / data.total) * 100) + "%" : "0%";

        setRiderData(data.rider_reports);
        renderRows("driverRows", data.by_driver);
        renderRows("customerRows", data.by_customer);
        renderRows("monthRows", data.by_month, (r) => fmtMonth(r.ym));
    } catch (err) {
        console.error(err);
        showMsg("Failed to load report: " + err.message);
    }
}

document.getElementById("genBtn").addEventListener("click", loadReport);
document.getElementById("resetBtn").addEventListener("click", () => {
    fromDate.value = "";
    toDate.value = "";
    riderFilter.value = "";
    loadReport();
});

// ---------- EXPORT CSV (bubukas sa Excel) ----------
const csvCell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
};

// Para hindi mawala ng Excel ang unang "0" ng contact number
const csvText = (v) => (v ? `="${String(v).replace(/"/g, '""')}"` : "");

const csvLink = (path) => {
    if (!path) return "";
    const url = new URL(path, window.location.href).href;
    return `"=HYPERLINK(""${url}"",""View photo"")"`;
};

document.getElementById("exportBtn").addEventListener("click", () => {
    if (!report || !report.deliveries.length) return showMsg("No deliveries to export.");

    const header = ["Delivery No", "Customer", "Address", "Contact", "Date",
                    "Driver", "Vehicle", "Item", "Quantity", "Status", "Remarks",
                    "Delivered At", "Rider Notes", "Proof Photo"];

    const lines = [header.map(csvCell).join(",")];
    report.deliveries.forEach((d) => {
        lines.push([
            csvCell(d.del_number), csvCell(d.customer_name), csvCell(d.address),
            csvText(d.contact), csvCell(d.del_date), csvCell(d.driver_name),
            csvCell(d.vehicle), csvCell(d.item_desc), csvCell(d.quantity),
            csvCell(d.status), csvCell(d.remarks),
            csvCell(d.delivered_at), csvCell(d.rider_notes), csvLink(d.proof_image),
        ].join(","));
    });

    // \uFEFF = BOM para tama ang pagbasa ng Excel sa UTF-8
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `deliveries_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
});

document.getElementById("printBtn").addEventListener("click", () => window.print());

loadReport();