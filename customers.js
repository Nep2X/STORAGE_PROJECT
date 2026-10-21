// =========================
//   CUSTOMERS PAGE SCRIPT
// =========================

const CUS_API = "api/customers.php";

const cusBody = document.querySelector(".dataTable tbody");
const cusModal = document.getElementById("customerModal");
const cusForm = document.getElementById("customerForm");
const cusSearch = document.getElementById("customerSearch");

let customers = [];
let editingCusId = null;

// ---------- HELPERS ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- ICONS ----------
const ICONS = {
    view: `<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>`,
    delete: `<svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>`,
};

const actionButtons = () => `
    <div class="actionBtns">
        <button type="button" class="iconBtn" data-action="view" title="View" aria-label="View">${ICONS.view}</button>
        <button type="button" class="iconBtn" data-action="edit" title="Edit" aria-label="Edit">${ICONS.edit}</button>
        <button type="button" class="iconBtn danger" data-action="delete" title="Delete" aria-label="Delete">${ICONS.delete}</button>
    </div>`;

// ---------- LOAD + RENDER ----------
async function loadCustomers() {
    try {
        const res = await fetch(CUS_API);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error(data.error || "Invalid response");
        customers = data;
        renderCustomers();
    } catch (err) {
        console.error(err);
        cusBody.innerHTML = `<tr><td colspan="5">Failed to load: ${esc(err.message)}</td></tr>`;
    }
}

function renderCustomers() {
    const q = cusSearch.value.trim().toLowerCase();

    const list = customers.filter((c) =>
        !q || `${c.name} ${c.contact ?? ""} ${c.address ?? ""}`.toLowerCase().includes(q)
    );

    if (!list.length) {
        cusBody.innerHTML = `<tr><td colspan="5">No customers found.</td></tr>`;
        return;
    }

    cusBody.innerHTML = list.map((c) => `
        <tr data-id="${c.id}">
            <td>${esc(c.name)}</td>
            <td>${esc(c.contact)}</td>
            <td>${esc(c.address)}</td>
            <td>${esc(c.deliveries)}</td>
            <td>${actionButtons()}</td>
        </tr>`).join("");
}

cusSearch.addEventListener("input", renderCustomers);

// ---------- ADDRESS HELPERS ----------
const ADDR_FIELDS = ["street", "city", "province"];
const cusFormError = document.getElementById("cusFormError");

// Ang naka-save na address ay "Street, Town/City, Province". Hatiin ito pabalik para sa Edit.
function splitAddress(address) {
    const parts = String(address ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
        return { street: parts.slice(0, -2).join(", "), city: parts[parts.length - 2], province: parts[parts.length - 1] };
    }
    return { street: parts.join(", "), city: "", province: "" };   // lumang address na hindi kumpleto
}

function clearFormError() {
    cusFormError.hidden = true;
    cusFormError.textContent = "";
    ADDR_FIELDS.forEach((f) => cusForm.elements[f].classList.remove("fieldInvalid"));
}

function showFormError(message, fields = []) {
    cusFormError.textContent = message;
    cusFormError.hidden = false;
    fields.forEach((f) => cusForm.elements[f] && cusForm.elements[f].classList.add("fieldInvalid"));
    if (fields.length && cusForm.elements[fields[0]]) cusForm.elements[fields[0]].focus();
}

// Kapag binago ang laman ng field, alisin ang pula
ADDR_FIELDS.forEach((f) => cusForm.elements[f].addEventListener("input", () => {
    cusForm.elements[f].classList.remove("fieldInvalid");
}));

// ---------- MODAL ----------
function openCusModal(cus = null) {
    editingCusId = cus ? cus.id : null;
    document.getElementById("cusModalTitle").textContent = cus ? "Edit Customer" : "Add Customer";
    cusForm.reset();
    clearFormError();
    if (cus) {
        cusForm.elements.name.value = cus.name ?? "";
        cusForm.elements.contact.value = cus.contact ?? "";

        const a = splitAddress(cus.address);
        cusForm.elements.street.value = a.street;
        cusForm.elements.city.value = a.city;
        cusForm.elements.province.value = a.province;
    }
    cusModal.style.display = "flex";
}

function closeCusModal() {
    cusModal.style.display = "none";
    editingCusId = null;
}

document.getElementById("openAddCus").addEventListener("click", () => openCusModal());
document.getElementById("closeCusModal").addEventListener("click", closeCusModal);
document.getElementById("cancelCusModal").addEventListener("click", closeCusModal);
cusModal.addEventListener("click", (e) => { if (e.target === cusModal) closeCusModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCusModal(); });

// ---------- ADD / EDIT ----------
cusForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFormError();

    const body = Object.fromEntries(new FormData(cusForm));
    const url = editingCusId ? `${CUS_API}?id=${editingCusId}` : CUS_API;
    const saveBtn = cusForm.querySelector('button[type="submit"]');

    // Mabilis na check sa browser: kumpleto ba ang address?
    const missing = ADDR_FIELDS.filter((f) => !String(body[f] ?? "").trim());
    if (missing.length) {
        return showFormError("Please complete the address: street / building, town / city, and province.", missing);
    }

    saveBtn.disabled = true;
    const label = saveBtn.textContent;
    saveBtn.textContent = "Checking address...";

    try {
        const res = await fetch(url, {
            method: editingCusId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const out = await res.json();
        if (!out.ok) return showFormError(out.error || "Could not save the customer.", out.fields || []);

        closeCusModal();
        loadCustomers();
    } catch (err) {
        showFormError("Could not reach the server. Please try again.");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = label;
    }
});

// ---------- VIEW / EDIT / DELETE ----------
cusBody.addEventListener("click", async (e) => {
    const btn = e.target.closest(".iconBtn");
    if (!btn) return;

    const id = btn.closest("tr").dataset.id;
    const cus = customers.find((x) => String(x.id) === id);
    if (!cus) return;

    const action = btn.dataset.action;

    if (action === "view") {
          alert(
  
            `${cus.name}\nContact: ${cus.contact ?? "-"}\n` +
            `Address: ${cus.address ?? "-"}\nDeliveries: ${cus.deliveries}`
        );
    } else if (action === "edit") {
        openCusModal(cus);
    } else if (action === "delete") {
        if (await confirmBox(`Delete customer ${cus.name}?`)) {
            await fetch(`${CUS_API}?id=${id}`, { method: "DELETE" });
            loadCustomers();
        }
    }
});

loadCustomers();