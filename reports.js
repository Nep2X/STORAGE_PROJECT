// =========================
//   REPORTS PAGE SCRIPT
// =========================

const REP_API = "api/reports.php";

const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");

let report = null;

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

// ---------- LOAD ----------
async function loadReport() {
    const params = new URLSearchParams();
    if (fromDate.value) params.set("from", fromDate.value);
    if (toDate.value) params.set("to", toDate.value);

    if (fromDate.value && toDate.value && fromDate.value > toDate.value) {
        return alert("The 'From' date must not be later than the 'To' date.");
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

        renderRows("driverRows", data.by_driver);
        renderRows("customerRows", data.by_customer);
        renderRows("monthRows", data.by_month, (r) => fmtMonth(r.ym));
    } catch (err) {
        console.error(err);
        alert("Failed to load report: " + err.message);
    }
}

document.getElementById("genBtn").addEventListener("click", loadReport);
document.getElementById("resetBtn").addEventListener("click", () => {
    fromDate.value = "";
    toDate.value = "";
    loadReport();
});

// ---------- EXPORT CSV (bubukas sa Excel) ----------
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

// Para hindi mawala ng Excel ang unang "0" ng contact number
const csvText = (v) => (v ? `="${String(v).replace(/"/g, '""')}"` : "");

document.getElementById("exportBtn").addEventListener("click", () => {
    if (!report || !report.deliveries.length) return alert("No deliveries to export.");

    const header = ["Delivery No", "Customer", "Address", "Contact", "Date",
                    "Driver", "Vehicle", "Item", "Quantity", "Status", "Remarks"];

    const lines = [header.map(csvCell).join(",")];
    report.deliveries.forEach((d) => {
        lines.push([
            csvCell(d.del_number), csvCell(d.customer_name), csvCell(d.address),
            csvText(d.contact), csvCell(d.del_date), csvCell(d.driver_name),
            csvCell(d.vehicle), csvCell(d.item_desc), csvCell(d.quantity),
            csvCell(d.status), csvCell(d.remarks),
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