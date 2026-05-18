let dashboard = null;

const $ = (selector) => document.querySelector(selector);
const normal = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const moneylessNumber = (value) => Number(value || 0).toLocaleString("es-MX");
const THEME_KEY = "dashboard-vias-theme";
const REPORT_COLUMNS = {
  movements: [
    { key: "codigo", label: "Codigo" },
    { key: "descripcion", label: "Descripcion" },
    { key: "cantidad", label: "PZ" },
    { key: "ticket", label: "Ticket o factura" },
    { key: "fecha", label: "Fecha" },
    { key: "tipo", label: "Tipo" },
    { key: "razon", label: "Razon" },
  ],
  providers: [
    { key: "codigo", label: "Codigo" },
    { key: "descripcion", label: "Descripcion" },
    { key: "piezas", label: "PZ" },
    { key: "orden", label: "Ticket o factura" },
    { key: "fecha", label: "Fecha" },
    { key: "proveedor", label: "Proveedor" },
    { key: "origen", label: "Origen" },
  ],
};

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  $("#themeBtn").textContent = isDark ? "Modo claro" : "Modo oscuro";
  $("#themeBtn").setAttribute("aria-pressed", String(isDark));
}

function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
  const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
}

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

function displayDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function table(columns, rows) {
  if (!rows.length) return '<div class="empty">Sin resultados.</div>';
  return `<table><thead><tr>${columns.map((col) => `<th>${col.label}</th>`).join("")}</tr></thead><tbody>${
    rows.map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(row[col.key] ?? "")}</td>`).join("")}</tr>`).join("")
  }</tbody></table>`;
}

function reportTable(columns, rows) {
  return table(columns, rows);
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
  renderProviders();
  renderDuplicates();
  renderReports();
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
  $("#reportProvider").innerHTML = '<option value="">Todos los proveedores</option>' +
    dashboard.providers.map((provider) => `<option value="${escapeHtml(provider)}">${escapeHtml(provider)}</option>`).join("");
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

function ensureReportDefaults() {
  if (!$("#reportFrom").value) $("#reportFrom").value = monthStartIso();
  if (!$("#reportTo").value) $("#reportTo").value = todayIso();
}

function currentReportConfig() {
  ensureReportDefaults();
  const type = $("#reportType").value;
  return {
    type,
    from: $("#reportFrom").value,
    to: $("#reportTo").value,
    provider: $("#reportProvider").value,
    search: normal($("#reportSearch").value),
    title: type === "providers" ? "Reporte de movimientos de proveedores" : "Reporte de movimientos generales",
  };
}

function filterReportRows() {
  const config = currentReportConfig();
  const source = config.type === "providers" ? dashboard.providerEntries : dashboard.movements;
  return source.filter((row) => {
    if (config.from && row.fecha < config.from) return false;
    if (config.to && row.fecha > config.to) return false;
    if (config.type === "providers" && config.provider && normal(row.proveedor) !== normal(config.provider)) return false;
    if (config.search) {
      const searchText = config.type === "providers"
        ? `${row.codigo} ${row.descripcion} ${row.orden} ${row.proveedor}`
        : `${row.codigo} ${row.descripcion} ${row.ticket} ${row.razon} ${row.tipo}`;
      if (!normal(searchText).includes(config.search)) return false;
    }
    return true;
  });
}

function reportRangeLabel(config) {
  if (config.from && config.to && config.from === config.to) return `Fecha: ${displayDate(config.from)}`;
  if (config.from && config.to) return `Rango: ${displayDate(config.from)} al ${displayDate(config.to)}`;
  if (config.from) return `Desde: ${displayDate(config.from)}`;
  if (config.to) return `Hasta: ${displayDate(config.to)}`;
  return "Todas las fechas";
}

function reportFileDate(config) {
  const from = config.from || "inicio";
  const to = config.to || "fin";
  return from === to ? from : `${from}_a_${to}`;
}

function reportMetrics(rows, config) {
  if (config.type === "providers") {
    const pieces = rows.reduce((sum, row) => sum + Number(row.piezas || 0), 0);
    const providers = new Set(rows.map((row) => String(row.proveedor || "").trim()).filter(Boolean));
    const orders = new Set(rows.map((row) => String(row.orden || "").trim()).filter(Boolean));
    return [
      ["Total movimientos", rows.length],
      ["Total piezas", pieces],
      ["Proveedores", providers.size],
      ["Tickets/facturas", orders.size],
    ];
  }
  const pieces = rows.reduce((sum, row) => sum + Number(row.cantidad || 0), 0);
  const tickets = new Set(rows.map((row) => String(row.ticket || "").trim()).filter(Boolean));
  const codes = new Set(rows.map((row) => String(row.codigo || "").trim()).filter(Boolean));
  return [
    ["Total movimientos", rows.length],
    ["Total piezas", pieces],
    ["Codigos", codes.size],
    ["Tickets/facturas", tickets.size],
  ];
}

function renderReports() {
  if (!dashboard) return;
  const config = currentReportConfig();
  $("#reportProvider").disabled = config.type !== "providers";
  const rows = filterReportRows();
  const metrics = reportMetrics(rows, config);
  $("#reportSummary").innerHTML = metrics
    .map(([label, value]) => `<div class="metric"><span>${label}</span><strong>${moneylessNumber(value)}</strong></div>`)
    .join("");
  $("#reportPreview").innerHTML = `<article class="report-document">
    <div class="report-cover">
      <div>
        <p class="eyebrow">Dashboard Vias</p>
        <h3>${escapeHtml(config.title)}</h3>
        <p>${escapeHtml(reportRangeLabel(config))}</p>
      </div>
      <div class="report-meta">
        <div>Generado: ${new Date().toLocaleString("es-MX")}</div>
        <div>Vista previa: ${moneylessNumber(Math.min(rows.length, 500))} de ${moneylessNumber(rows.length)} registros</div>
      </div>
    </div>
    <div class="table-wrap report-table">${reportTable(REPORT_COLUMNS[config.type], rows.slice(0, 500))}</div>
  </article>`;
}

function excelCell(value) {
  return `<td>${escapeHtml(value ?? "")}</td>`;
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadExcelReport() {
  const config = currentReportConfig();
  const rows = filterReportRows();
  const columns = REPORT_COLUMNS[config.type];
  const metrics = reportMetrics(rows, config);
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #1c2420; }
    h1 { margin-bottom: 4px; }
    .meta { color: #63706a; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #0f766e; color: #fff; text-align: left; }
    th, td { border: 1px solid #cfd8d3; padding: 8px; }
    .metrics td:first-child { font-weight: bold; background: #edf3f1; }
  </style>
</head>
<body>
  <h1>${escapeHtml(config.title)}</h1>
  <div class="meta">${escapeHtml(reportRangeLabel(config))} | Generado: ${new Date().toLocaleString("es-MX")}</div>
  <table class="metrics">${metrics.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${moneylessNumber(value)}</td></tr>`).join("")}</table>
  <br>
  <table>
    <thead><tr>${columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${columns.map((col) => excelCell(row[col.key])).join("")}</tr>`).join("")}</tbody>
  </table>
</body>
</html>`;
  downloadBlob(html, "application/vnd.ms-excel;charset=utf-8", `reporte_${config.type}_${reportFileDate(config)}.xls`);
}

function printPdfReport() {
  const config = currentReportConfig();
  const rows = filterReportRows();
  const columns = REPORT_COLUMNS[config.type];
  const metrics = reportMetrics(rows, config);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    $("#status").textContent = "Permite ventanas emergentes para generar el PDF.";
    return;
  }
  printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(config.title)}</title>
  <style>
    @page { margin: 14mm; }
    body { color: #1c2420; font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; }
    header { border-bottom: 3px solid #0f766e; margin-bottom: 18px; padding-bottom: 12px; }
    .eyebrow { color: #0f766e; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
    h1 { margin: 4px 0; font-size: 22px; }
    .meta { color: #63706a; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 16px 0; }
    .metric { border: 1px solid #cfd8d3; border-radius: 6px; padding: 9px; }
    .metric span { display: block; color: #63706a; font-size: 10px; }
    .metric strong { display: block; margin-top: 4px; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #0f766e; color: #fff; text-align: left; }
    th, td { border: 1px solid #cfd8d3; padding: 6px; vertical-align: top; }
    tr { break-inside: avoid; }
  </style>
</head>
<body>
  <header>
    <div class="eyebrow">Dashboard Vias</div>
    <h1>${escapeHtml(config.title)}</h1>
    <div class="meta">${escapeHtml(reportRangeLabel(config))} | Generado: ${new Date().toLocaleString("es-MX")}</div>
  </header>
  <section class="metrics">${metrics.map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${moneylessNumber(value)}</strong></div>`).join("")}</section>
  <table>
    <thead><tr>${columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(row[col.key] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>
  <script>window.addEventListener("load", () => { window.print(); });<\/script>
</body>
</html>`);
  printWindow.document.close();
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab, .panel").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    $(`#${button.dataset.tab}`).classList.add("active");
  });
});

$("#refreshBtn").addEventListener("click", loadData);
$("#themeBtn").addEventListener("click", toggleTheme);
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
$("#reportType").addEventListener("change", renderReports);
$("#reportFrom").addEventListener("input", renderReports);
$("#reportTo").addEventListener("input", renderReports);
$("#reportProvider").addEventListener("change", renderReports);
$("#reportSearch").addEventListener("input", renderReports);
$("#reportPdfBtn").addEventListener("click", printPdfReport);
$("#reportExcelBtn").addEventListener("click", downloadExcelReport);

loadTheme();
loadData().catch((error) => {
  $("#status").textContent = `Error: ${error.message}`;
});
