const API = "api/deliveries.php";
const tbody = document.querySelector(".dataTable tbody");

const BADGE = {
    "Pending": "pendingBadge",
    "Processing": "processingBadge",
    "Out for Delivery": "outBadge",
    "Delivered": "deliveredBadge",
    "Cancelled": "cancelledBadge",
};

// Iwas XSS: i-escape ang text galing database
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function loadDeliveries() {
    const res = await fetch(API);
    const data = await res.json();

    tbody.innerHTML = data.map((d) => `
        <tr data-id="${d.id}">
            <td>${esc(d.del_number)}</td>
            <td>${esc(d.customer_name)}</td>
            <td>${esc(d.driver_name)}</td>
            <td>${esc(d.del_date)}</td>
            <td><span class="statusBadge ${BADGE[d.status]}">${esc(d.status)}</span></td>
            <td>
                <select class="rowAction" aria-label="Actions">
                    <option value="">Actions</option>
                    <option value="view">View</option>
                    <option value="edit">Edit</option>
                    <option value="updateStatus">Update Status</option>
                    <option value="delete">Delete</option>
                </select>
            </td>
        </tr>`).join("");
}

// ADD
document.getElementById("deliveryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const out = await res.json();
    if (!out.ok) return alert("Error: " + out.error);
    e.target.reset();
    closeModal();          // galing sa app.js
    loadDeliveries();
});

// ACTIONS (delete / update status)
tbody.addEventListener("change", async (e) => {
    if (!e.target.classList.contains("rowAction")) return;
    const id = e.target.closest("tr").dataset.id;
    const action = e.target.value;
    e.target.value = "";

    if (action === "delete" && confirm("Delete this delivery?")) {
        await fetch(`${API}?id=${id}`, { method: "DELETE" });
        loadDeliveries();
    }
    if (action === "updateStatus") {
        const status = prompt(
            "New status:\nPending / Processing / Out for Delivery / Delivered / Cancelled"
        );
        if (!status) return;
        await fetch(`${API}?id=${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        loadDeliveries();
    }
});

loadDeliveries();