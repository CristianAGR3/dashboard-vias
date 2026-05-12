let dashboard = null;

const $ = (selector) => document.querySelector(selector);
const normal = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const moneylessNumber = (value) => Number(value || 0).toLocaleString("es-MX");

function todayIso(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return toIsoDate(date);
}

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthStartIso() {
  const date = new Date();
  return toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
}

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
  renderAdvancedSearch();
  renderAlerts();
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
  $("#advancedReason").innerHTML = '<option value="">Todas las razones</option>' +
    dashboard.reasons.map((row) => `<option value="${escapeHtml(row.razon)}">${escapeHtml(row.razon)}</option>`).join("");
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

function currentAdvancedRange() {
  const preset = $("#advancedPreset").value;
  if (preset === "today") return { from: todayIso(), to: todayIso() };
  if (preset === "yesterday") return { from: todayIso(-1), to: todayIso(-1) };
  if (preset === "last7") return { from: todayIso(-6), to: todayIso() };
  if (preset === "thisMonth") return { from: monthStartIso(), to: todayIso() };
  if (preset === "all") return { from: "", to: "" };
  return { from: $("#advancedFrom").value, to: $("#advancedTo").value };
}

function syncAdvancedDateInputs() {
  const preset = $("#advancedPreset").value;
  const range = currentAdvancedRange();
  if (preset !== "custom") {
    $("#advancedFrom").value = range.from;
    $("#advancedTo").value = range.to;
  }
  $("#advancedFrom").disabled = preset !== "custom";
  $("#advancedTo").disabled = preset !== "custom";
}

function filterAdvancedMovements() {
  const ticket = normal($("#advancedTicket").value);
  const text = normal($("#advancedText").value);
  const type = normal($("#advancedType").value);
  const reason = normal($("#advancedReason").value);
  const range = currentAdvancedRange();
  return dashboard.movements.filter((row) => {
    if (ticket && !normal(row.ticket).includes(ticket)) return false;
    if (text && !normal(`${row.codigo} ${row.descripcion} ${row.razon}`).includes(text)) return false;
    if (type && normal(row.tipo) !== type) return false;
    if (reason && normal(row.razon) !== reason) return false;
    if (range.from && row.fecha < range.from) return false;
    if (range.to && row.fecha > range.to) return false;
    return true;
  });
}

function renderAdvancedSearch() {
  syncAdvancedDateInputs();
  const rows = filterAdvancedMovements();
  const entradas = rows.filter((row) => normal(row.tipo) === "ENTRADA").reduce((sum, row) => sum + Number(row.cantidad || 0), 0);
  const salidas = rows.filter((row) => normal(row.tipo) === "SALIDA").reduce((sum, row) => sum + Number(row.cantidad || 0), 0);
  const tickets = new Set(rows.map((row) => String(row.ticket || "").trim()).filter(Boolean));
  $("#advancedSummary").innerHTML = [
    ["Movimientos", rows.length],
    ["Entradas", entradas],
    ["Salidas", salidas],
    ["Tickets", tickets.size],
  ].map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${moneylessNumber(value)}</strong></div>`).join("");
  $("#advancedResults").innerHTML = table([
    { key: "fecha", label: "Fecha" },
    { key: "ticket", label: "Ticket" },
    { key: "codigo", label: "Codigo" },
    { key: "descripcion", label: "Descripcion" },
    { key: "tipo", label: "Tipo" },
    { key: "cantidad", label: "Cantidad" },
    { key: "razon", label: "Razon" },
  ], rows.slice(0, 800));
}

function movementDuplicateAlerts() {
  const groups = new Map();
  for (const row of dashboard.movements) {
    const ticket = String(row.ticket || "").trim();
    if (!ticket || normal(ticket) === "N/A") continue;
    const id = `${normal(ticket)}|${normal(row.codigo)}|${Math.abs(Number(row.cantidad || 0))}`;
    const current = groups.get(id) || [];
    current.push(row);
    groups.set(id, current);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      ticket: group[0].ticket,
      codigo: group[0].codigo,
      descripcion: group[0].descripcion,
      cantidad: Math.abs(Number(group[0].cantidad || 0)),
      fecha: group.map((row) => row.fecha).sort().at(-1),
      razones: [...new Set(group.map((row) => row.razon).filter(Boolean))].join(", "),
      tipos: [...new Set(group.map((row) => row.tipo).filter(Boolean))].join(", "),
      repeticiones: group.length,
    }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.repeticiones - a.repeticiones);
}

function stockRiskAlerts() {
  const inventory = new Map(dashboard.inventory.map((row) => [normal(row.codigo), row]));
  const movementMap = new Map();
  const allowedReasons = new Set(["PD", "LG", "RT"]);
  for (const row of dashboard.movements) {
    if (normal(row.tipo) !== "SALIDA") continue;
    if (!allowedReasons.has(normal(row.razon))) continue;
    const id = normal(row.codigo);
    if (!id) continue;
    const current = movementMap.get(id) || {
      codigo: row.codigo,
      descripcion: row.descripcion,
      movimientos: 0,
      cantidad: 0,
    };
    current.movimientos += 1;
    current.cantidad += Math.abs(Number(row.cantidad || 0));
    movementMap.set(id, current);
  }
  const movers = [...movementMap.values()].sort((a, b) => b.cantidad - a.cantidad);
  const highLimit = Math.max(1, Math.ceil(movers.length * 0.2));
  const mediumLimit = Math.max(highLimit + 1, Math.ceil(movers.length * 0.5));
  return movers.map((row, index) => {
    const item = inventory.get(normal(row.codigo));
    if (!item) return null;
    const nivel = index < highLimit ? "Alta" : index < mediumLimit ? "Media" : "Baja";
    if (nivel === "Baja") return null;
    const stock = Number(item.stock || 0);
    const threshold = nivel === "Alta" ? Math.max(5, Math.ceil(row.cantidad * 0.08)) : Math.max(3, Math.ceil(row.cantidad * 0.04));
    if (stock > threshold) return null;
    return {
      ...row,
      stock,
      nivel,
      threshold,
      severity: stock <= 0 ? "danger" : "warning",
    };
  }).filter(Boolean).sort((a, b) => a.stock - b.stock || b.cantidad - a.cantidad).slice(0, 30);
}

function renderAlerts() {
  const duplicates = movementDuplicateAlerts().slice(0, 30);
  $("#movementDuplicateAlerts").innerHTML = duplicates.length
    ? duplicates.map((row) => `<article class="alert-card danger">
        <strong>Ticket ${escapeHtml(row.ticket)} repetido con ${escapeHtml(row.codigo)}</strong>
        <div>${escapeHtml(row.descripcion)}</div>
        <div class="alert-meta">Fecha: ${escapeHtml(row.fecha)} | Cantidad: ${moneylessNumber(row.cantidad)} | Repeticiones: ${row.repeticiones} | Tipo: ${escapeHtml(row.tipos)} | Razon: ${escapeHtml(row.razones)}</div>
      </article>`).join("")
    : '<div class="empty">No hay duplicados nuevos detectados desde Movimientos.</div>';

  const stockAlerts = stockRiskAlerts();
  $("#stockAlerts").innerHTML = stockAlerts.length
    ? stockAlerts.map((row) => `<article class="alert-card ${row.severity}">
        <strong>${escapeHtml(row.codigo)}: stock bajo para rotacion ${escapeHtml(row.nivel)}</strong>
        <div>${escapeHtml(row.descripcion)}</div>
        <div class="alert-meta">Stock actual: ${moneylessNumber(row.stock)} | Salidas PD/LG/RT: ${moneylessNumber(row.cantidad)} | Movimientos: ${row.movimientos} | Punto de alerta: ${moneylessNumber(row.threshold)}</div>
      </article>`).join("")
    : '<div class="empty">No hay materiales de alta o media rotacion por debajo del punto de alerta.</div>';
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
$("#advancedTicket").addEventListener("input", renderAdvancedSearch);
$("#advancedText").addEventListener("input", renderAdvancedSearch);
$("#advancedPreset").addEventListener("change", renderAdvancedSearch);
$("#advancedFrom").addEventListener("input", renderAdvancedSearch);
$("#advancedTo").addEventListener("input", renderAdvancedSearch);
$("#advancedType").addEventListener("change", renderAdvancedSearch);
$("#advancedReason").addEventListener("change", renderAdvancedSearch);
$("#providerSelect").addEventListener("change", renderProviders);
$("#duplicateSearch").addEventListener("input", renderDuplicates);

loadData().catch((error) => {
  $("#status").textContent = `Error: ${error.message}`;
});
