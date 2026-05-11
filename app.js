let dashboard = null;

const $ = (selector) => document.querySelector(selector);
const normal = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

function table(columns, rows) {
  if (!rows.length) return '<div class="empty">Sin resultados.</div>';
  return `<table><thead><tr>${columns.map((col) => `<th>${col.label}</th>`).join("")}</tr></thead><tbody>${
    rows.map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(row[col.key] ?? "")}</td>`).join("")}</tr>`).join("")
  }</tbody></table>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bars(target, rows, labelKey, valueKey) {
  const max = Math.max(...rows.map((row) => Number(row[valueKey]) || 0), 1);
  $(target).innerHTML = rows.length
    ? rows.map((row) => {
        const value = Number(row[valueKey]) || 0;
        return `<div class="bar-row">
          <div class="bar-label">${escapeHtml(row[labelKey])}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, (value / max) * 100)}%"></div></div>
          <div>${value.toLocaleString("es-MX")}</div>
        </div>`;
      }).join("")
    : '<div class="empty">Sin datos para graficar.</div>';
}

async function loadData() {
  $("#status").textContent = "Actualizando datos...";
  const response = await fetch(`dashboard-data.json?t=${Date.now()}`);
  dashboard = await response.json();
  if (dashboard.error) throw new Error(dashboard.error);
  renderStatic();
  renderInventory();
  renderMovements();
  renderProviders();
  renderDuplicates();
  $("#status").textContent = `Actualizado: ${new Date(dashboard.generatedAt).toLocaleString("es-MX")}`;
}

function renderStatic() {
  $("#topMaterials").innerHTML = table([
    { key: "codigo", label: "Codigo" },
    { key: "descripcion", label: "Descripcion" },
    { key: "movimientos", label: "Mov." },
    { key: "cantidad", label: "Cantidad" },
  ], dashboard.topMovementMaterials);
  bars("#reasonBars", dashboard.reasons.slice(0, 14), "razon", "movimientos");
  bars("#providerBars", dashboard.providerSummary, "proveedor", "piezas");
  $("#providerSelect").innerHTML = dashboard.providers.map((provider) => `<option value="${escapeHtml(provider)}">${escapeHtml(provider)}</option>`).join("");
}

function renderInventory() {
  const term = normal($("#inventorySearch").value);
  const rows = dashboard.inventory
    .filter((row) => !term || normal(`${row.codigo} ${row.descripcion}`).includes(term))
    .slice(0, 30);
  $("#inventoryResults").innerHTML = rows.length
    ? rows.map((row) => `<article class="result-card">
        <strong>${escapeHtml(row.codigo)}</strong>
        <div>${escapeHtml(row.descripcion)}</div>
        <span class="stock">Stock: ${Number(row.stock).toLocaleString("es-MX")}</span>
      </article>`).join("")
    : '<div class="empty">Escribe un codigo o descripcion para buscar.</div>';
}

function renderMovements() {
  const term = normal($("#movementSearch").value);
  const rows = dashboard.movements
    .filter((row) => term && normal(row.codigo) === term)
    .slice(0, 300);
  $("#movementResults").innerHTML = table([
    { key: "fecha", label: "Fecha" },
    { key: "codigo", label: "Codigo" },
    { key: "tipo", label: "Tipo" },
    { key: "cantidad", label: "Cantidad" },
    { key: "ticket", label: "Ticket" },
    { key: "razon", label: "Razon" },
  ], rows);
}

function renderProviders() {
  const provider = $("#providerSelect").value || dashboard.providers[0];
  const rows = dashboard.providerEntries
    .filter((row) => normal(row.proveedor) === normal(provider))
    .slice(0, 500);
  $("#providerEntries").innerHTML = table([
    { key: "fecha", label: "Fecha" },
    { key: "codigo", label: "Codigo" },
    { key: "descripcion", label: "Descripcion" },
    { key: "piezas", label: "Pz" },
    { key: "orden", label: "Orden" },
    { key: "origen", label: "Origen" },
  ], rows);
}

function renderDuplicates() {
  const term = normal($("#duplicateSearch").value);
  const rows = dashboard.duplicates
    .filter((row) => !term || normal(`${row.codigo} ${row.ticket} ${row.razon} ${row.descripcion}`).includes(term))
    .slice(0, 600);
  $("#duplicatesTable").innerHTML = table([
    { key: "fecha", label: "Fecha" },
    { key: "codigo", label: "Codigo" },
    { key: "descripcion", label: "Descripcion" },
    { key: "cantidad", label: "Cant." },
    { key: "ticket", label: "Ticket" },
    { key: "razon", label: "Razon" },
    { key: "tipo", label: "Tipo" },
    { key: "grupo", label: "Grupo" },
  ], rows);
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab, .panel").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    $(`#${button.dataset.tab}`).classList.add("active");
  });
});

$("#refreshBtn").addEventListener("click", loadData);
$("#inventorySearch").addEventListener("input", renderInventory);
$("#movementSearch").addEventListener("input", renderMovements);
$("#providerSelect").addEventListener("change", renderProviders);
$("#duplicateSearch").addEventListener("input", renderDuplicates);

loadData().catch((error) => {
  $("#status").textContent = `Error: ${error.message}`;
});
