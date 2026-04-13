const PAINTS_KEY = "mini-tracker-paints-v1";
const PAINTS_BACKUP_KEY = "mini-tracker-paints-backup-v1";
const PAINT_PLANS_KEY = "mini-tracker-paint-plans-v1";
const PAINT_PLANS_BACKUP_KEY = "mini-tracker-paint-plans-backup-v1";
const ENTRIES_KEY = "mini-tracker-entries-v1";
const LEGACY_ENTRIES_KEY = "mini-tracker-entries";
const ENTRY_BACKUP_KEY = "mini-tracker-entries-backup-v1";
const STATUS_VALUES = ["Unpainted", "Primed", "Painted", "Based", "Completed"];

// New dialog-based element references
const paintFiltersForm = document.getElementById("paint-filters-form");
const paintFilterSearch = document.getElementById("paint-filter-search");
const paintFilterType = document.getElementById("paint-filter-type");
const paintFilterBrand = document.getElementById("paint-filter-brand");
const paintFilterClear = document.getElementById("paint-filter-clear");

const openAddPaintBtn = document.getElementById("open-add-paint-btn");
const addPaintDialog = document.getElementById("add-paint-dialog");
const addPaintForm = document.getElementById("paint-form");

const openAddUnitBtn = document.getElementById("open-add-unit-btn");
const addUnitDialog = document.getElementById("add-unit-dialog");
const addUnitForm = document.getElementById("paint-unit-form");
const addUnitSelect = document.getElementById("paint-unit-select");

const editPaintDialog = document.getElementById("edit-paint-dialog");
const editPaintForm = document.getElementById("edit-paint-form");

const editPlanDialog = document.getElementById("edit-plan-dialog");
const editPlanDialogTitle = document.getElementById("edit-plan-dialog-title");
const editPlanDialogBody = document.getElementById("edit-plan-dialog-body");

const paintsBody = document.getElementById("paints-body");
const paintPlansRoot = document.getElementById("paint-plans");

let paints = loadPaints();
let entries = loadEntries();
let paintPlans = loadPaintPlans();

// Filter state
let paintFilterState = {
  search: "",
  type: "all",
  brand: "all"
};

render();

// Wire filter inputs
if (paintFilterSearch instanceof HTMLInputElement) {
  paintFilterSearch.addEventListener("input", () => {
    paintFilterState.search = paintFilterSearch.value;
    renderPaintsTable();
  });
}

if (paintFilterType instanceof HTMLSelectElement) {
  paintFilterType.addEventListener("change", () => {
    paintFilterState.type = paintFilterType.value;
    renderPaintsTable();
  });
}

if (paintFilterBrand instanceof HTMLSelectElement) {
  paintFilterBrand.addEventListener("change", () => {
    paintFilterState.brand = paintFilterBrand.value;
    renderPaintsTable();
  });
}

if (paintFilterClear instanceof HTMLButtonElement) {
  paintFilterClear.addEventListener("click", () => {
    paintFilterState = { search: "", type: "all", brand: "all" };
    if (paintFilterSearch instanceof HTMLInputElement) paintFilterSearch.value = "";
    if (paintFilterType instanceof HTMLSelectElement) paintFilterType.value = "all";
    if (paintFilterBrand instanceof HTMLSelectElement) paintFilterBrand.value = "all";
    renderPaintsTable();
  });
}

// Add Paint dialog
if (openAddPaintBtn instanceof HTMLButtonElement) {
  openAddPaintBtn.addEventListener("click", () => {
    if (addPaintDialog instanceof HTMLDialogElement) addPaintDialog.showModal();
  });
}

if (addPaintForm instanceof HTMLFormElement) {
  addPaintForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(addPaintForm);
    const paint = normalizePaint({
      id: createId(),
      name: String(formData.get("name") || "").trim(),
      type: String(formData.get("type") || "").trim(),
      brand: String(formData.get("brand") || "").trim()
    });
    if (!paint) return;
    paints.unshift(paint);
    persistPaints();
    render();
    addPaintForm.reset();
    if (addPaintDialog instanceof HTMLDialogElement) addPaintDialog.close();
    if (window.appToast) window.appToast("Paint added");
  });
}

// Add Unit dialog
if (openAddUnitBtn instanceof HTMLButtonElement) {
  openAddUnitBtn.addEventListener("click", () => {
    if (addUnitDialog instanceof HTMLDialogElement) {
      refreshAddUnitDialog();
      addUnitDialog.showModal();
    }
  });
}

if (addUnitForm instanceof HTMLFormElement) {
  addUnitForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!(addUnitSelect instanceof HTMLSelectElement)) return;
    const entryId = addUnitSelect.value;
    if (!entryId || paintPlans.some((plan) => plan.entryId === entryId)) return;
    paintPlans.unshift({ id: createId(), entryId, assignments: [] });
    persistPaintPlans();
    render();
    addUnitForm.reset();
    addUnitSelect.value = "";
    if (addUnitDialog instanceof HTMLDialogElement) addUnitDialog.close();
    if (window.appToast) window.appToast("Unit added");
  });
}

// Wire edit paint dialog submit
if (editPaintForm instanceof HTMLFormElement) {
  editPaintForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!(editPaintDialog instanceof HTMLDialogElement)) return;
    const paintId = editPaintDialog.dataset.paintId;
    if (!paintId) return;
    const paint = paints.find(p => p.id === paintId);
    if (!paint) return;
    
    const formData = new FormData(editPaintForm);
    const updated = normalizePaint({
      id: paint.id,
      name: String(formData.get("name") || "").trim(),
      type: String(formData.get("type") || "").trim(),
      brand: String(formData.get("brand") || "").trim()
    });
    
    if (!updated) return;
    paint.name = updated.name;
    paint.type = updated.type;
    paint.brand = updated.brand;
    persistPaints();
    render();
    editPaintForm.reset();
    editPaintDialog.close();
    if (window.appToast) window.appToast("Paint saved");
  });
}

// Wire add assignment handler (delegated from dialog)
document.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-action='add-assignment']");
  if (!btn || !(editPlanDialog instanceof HTMLDialogElement)) return;
  
  const planId = btn.dataset.planId;
  if (!planId) return;
  
  const plan = paintPlans.find(p => p.id === planId);
  if (!plan) return;
  
  const paintSelect = editPlanDialog.querySelector(`#paint-select-${planId}`);
  const areasInput = editPlanDialog.querySelector(`#areas-input-${planId}`);
  if (!(paintSelect instanceof HTMLSelectElement) || !(areasInput instanceof HTMLInputElement)) return;
  
  const paintId = paintSelect.value;
  const areas = areasInput.value.trim();
  if (!paintId || !areas) return;

  const editingAssignmentId = editPlanDialog.dataset.editingAssignmentId;
  if (editingAssignmentId) {
    const assignment = plan.assignments.find((item) => item.id === editingAssignmentId);
    if (!assignment) return;
    assignment.paintId = paintId;
    assignment.areas = areas;
    delete editPlanDialog.dataset.editingAssignmentId;
  } else {
    plan.assignments.push({
      id: createId(),
      paintId,
      areas
    });
  }
  
  persistPaintPlans();
  if (editPlanDialogBody instanceof HTMLDivElement) {
    editPlanDialogBody.innerHTML = buildPlanEditorContent(plan);
  }
  if (window.appToast) window.appToast(editingAssignmentId ? "Paint saved" : "Paint assigned");
});

document.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn || !(editPlanDialog instanceof HTMLDialogElement) || !(editPlanDialogBody instanceof HTMLDivElement)) {
    return;
  }

  if (!editPlanDialog.open || !btn.closest("#edit-plan-dialog")) {
    return;
  }

  const action = btn.dataset.action;
  const planId = btn.dataset.planId;
  const assignmentId = btn.dataset.assignmentId;
  if (!planId) {
    return;
  }

  const plan = paintPlans.find((item) => item.id === planId);
  if (!plan) {
    return;
  }

  if (action === "edit-assignment" && assignmentId) {
    const assignment = plan.assignments.find((item) => item.id === assignmentId);
    if (!assignment) {
      return;
    }

    editPlanDialog.dataset.editingAssignmentId = assignmentId;
    editPlanDialogBody.innerHTML = buildPlanEditorContent(plan);
    const paintSelect = editPlanDialog.querySelector(`#paint-select-${planId}`);
    const areasInput = editPlanDialog.querySelector(`#areas-input-${planId}`);
    if (paintSelect instanceof HTMLSelectElement) {
      paintSelect.value = assignment.paintId;
    }
    if (areasInput instanceof HTMLInputElement) {
      areasInput.value = assignment.areas;
      areasInput.focus();
    }
    return;
  }

  if (action === "cancel-assignment-edit") {
    delete editPlanDialog.dataset.editingAssignmentId;
    editPlanDialogBody.innerHTML = buildPlanEditorContent(plan);
    return;
  }

  if (action === "delete-assignment" && assignmentId) {
    deleteAssignment(planId, assignmentId);
    const refreshedPlan = paintPlans.find((item) => item.id === planId);
    if (refreshedPlan) {
      delete editPlanDialog.dataset.editingAssignmentId;
      editPlanDialogBody.innerHTML = buildPlanEditorContent(refreshedPlan);
    }
  }
});

if (paintsBody instanceof HTMLTableSectionElement) {
  paintsBody.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    const paintId = target.dataset.paintId;
    if (!paintId) return;
    if (target.dataset.action === "edit-paint") {
      openEditPaintDialog(paintId);
    } else if (target.dataset.action === "delete-paint") {
      deletePaint(paintId);
    }
  });
}

if (paintPlansRoot instanceof HTMLDivElement) {
  paintPlansRoot.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    const planId = target.dataset.planId;
    const assignmentId = target.dataset.assignmentId;
    if (target.dataset.action === "delete-plan" && planId) {
      deletePlan(planId);
    } else if (target.dataset.action === "edit-plan" && planId) {
      openEditPlanDialog(planId);
    } else if (target.dataset.action === "delete-assignment" && planId && assignmentId) {
      deleteAssignment(planId, assignmentId);
    }
  });
}

function render() {
  entries = loadEntries();
  paints = loadPaints();
  paintPlans = loadPaintPlans();
  cleanupPaintPlans();
  updateFilterOptions();
  renderPaintsTable();
  refreshAddUnitDialog();
  renderPaintPlans();
}

function renderPaintsTable() {
  paintsBody.innerHTML = "";

  const filteredPaints = getFilteredPaints();

  if (filteredPaints.length === 0) {
    const msg = paints.length === 0 
      ? "No paints yet. Add your first paint above." 
      : "No paints match your filters.";
    paintsBody.innerHTML = `<tr><td colspan="2">${msg}</td></tr>`;
    return;
  }

  for (const paint of filteredPaints) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <div class="unit-label-strong">${escapeHtml(paint.name)}</div>
        <div class="requirement-inline">${escapeHtml(paint.type)} / ${escapeHtml(paint.brand)}</div>
      </td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-action="edit-paint" data-paint-id="${paint.id}" title="Edit" aria-label="Edit">&#9998;</button>
          <button class="icon-btn delete" data-action="delete-paint" data-paint-id="${paint.id}" title="Delete" aria-label="Delete">&times;</button>
        </div>
      </td>
    `;
    paintsBody.appendChild(row);
  }
}

function getFilteredPaints() {
  return getSortedPaints().filter((paint) => {
    const searchLower = paintFilterState.search.toLowerCase();
    const matchesSearch = !searchLower || 
      paint.name.toLowerCase().includes(searchLower) ||
      paint.type.toLowerCase().includes(searchLower) ||
      paint.brand.toLowerCase().includes(searchLower);
    
    const matchesType = paintFilterState.type === "all" || paint.type === paintFilterState.type;
    const matchesBrand = paintFilterState.brand === "all" || paint.brand === paintFilterState.brand;
    
    return matchesSearch && matchesType && matchesBrand;
  });
}

function updateFilterOptions() {
  const types = [...new Set(paints.map(p => p.type).filter(t => t))].sort();
  const brands = [...new Set(paints.map(p => p.brand).filter(b => b))].sort();
  
  if (paintFilterType instanceof HTMLSelectElement) {
    const currentValue = paintFilterType.value;
    paintFilterType.innerHTML = '<option value="all">All Types</option>' + 
      types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
    paintFilterType.value = currentValue;
  }
  
  if (paintFilterBrand instanceof HTMLSelectElement) {
    const currentValue = paintFilterBrand.value;
    paintFilterBrand.innerHTML = '<option value="all">All Brands</option>' + 
      brands.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join("");
    paintFilterBrand.value = currentValue;
  }
}

function refreshAddUnitDialog() {
  if (!(addUnitSelect instanceof HTMLSelectElement)) {
    return;
  }

  const selected = addUnitSelect.value;
  const assignedEntryIds = new Set(paintPlans.map(p => p.entryId));
  const options = entries
    .filter(entry => !assignedEntryIds.has(entry.id))
    .map((entry) => {
      const label = `${entry.unit} (${entry.game} / ${entry.faction})`;
      return { id: entry.id, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
    .map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`)
    .join("");

  addUnitSelect.innerHTML = `<option value="">Select a unit</option>${options}`;
  if (selected && entries.some((entry) => entry.id === selected)) {
    addUnitSelect.value = selected;
  }
}

function renderPaintPlans() {
  paintPlansRoot.innerHTML = "";
  const plans = getSortedPaintPlans();
  
  if (plans.length === 0) {
    paintPlansRoot.innerHTML = '<p class="empty-msg">No units added yet. Select a unit above to start assigning paints.</p>';
    return;
  }

  paintPlansRoot.innerHTML = `
    <div class="table-wrap">
      <table class="painting-plan-table">
        <thead>
          <tr>
            <th>Unit</th>
            <th>Assigned Paints</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${plans.map((plan) => buildPlanRow(plan)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function buildPlanRow(plan) {
  const entry = getEntryById(plan.entryId);
  if (!entry) {
    return "";
  }

  return `
    <tr>
      <td>
        <div class="unit-label-strong">${escapeHtml(entry.unit)}</div>
        <div class="requirement-inline">${escapeHtml(entry.game)} / ${escapeHtml(entry.faction)}</div>
      </td>
      <td>${buildAssignmentSummary(plan)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-action="edit-plan" data-plan-id="${plan.id}" title="Edit" aria-label="Edit">&#9998;</button>
          <button class="icon-btn delete" data-action="delete-plan" data-plan-id="${plan.id}" title="Remove Unit" aria-label="Remove Unit">&times;</button>
        </div>
      </td>
    </tr>
  `;
}

function buildAssignmentSummary(plan) {
  const sortedAssignments = getSortedAssignments(plan);
  if (sortedAssignments.length === 0) {
    return '<span class="empty-msg">No paints assigned.</span>';
  }

  return `
    <div class="paint-summary-list">
      ${sortedAssignments.map((assignment) => buildSummaryChip(assignment)).join("")}
    </div>
  `;
}

function buildSummaryChip(assignment) {
  const paint = getPaintById(assignment.paintId);
  if (!paint) {
    return "";
  }

  return `<span class="assignment-chip">${escapeHtml(paint.name)}: ${escapeHtml(assignment.areas)}</span>`;
}

function openEditPaintDialog(paintId) {
  const paint = paints.find(p => p.id === paintId);
  if (!paint || !(editPaintDialog instanceof HTMLDialogElement) || !(editPaintForm instanceof HTMLFormElement)) {
    return;
  }
  
  editPaintDialog.dataset.paintId = paintId;
  const nameInput = editPaintForm.elements.namedItem("name");
  const typeInput = editPaintForm.elements.namedItem("type");
  const brandInput = editPaintForm.elements.namedItem("brand");
  
  if (nameInput instanceof HTMLInputElement) nameInput.value = paint.name;
  if (typeInput instanceof HTMLInputElement) typeInput.value = paint.type;
  if (brandInput instanceof HTMLInputElement) brandInput.value = paint.brand;
  
  editPaintDialog.showModal();
}

function openEditPlanDialog(planId) {
  const plan = paintPlans.find(p => p.id === planId);
  if (!plan || !(editPlanDialog instanceof HTMLDialogElement) || !(editPlanDialogBody instanceof HTMLDivElement)) {
    return;
  }

  const entry = getEntryById(plan.entryId);
  if (editPlanDialogTitle instanceof HTMLElement) {
    editPlanDialogTitle.textContent = entry ? `Edit Unit Paints: ${entry.unit}` : "Edit Unit Paints";
  }
  editPlanDialog.dataset.planId = planId;
  delete editPlanDialog.dataset.editingAssignmentId;
  editPlanDialogBody.innerHTML = buildPlanEditorContent(plan);
  editPlanDialog.showModal();
}

function buildPlanEditorContent(plan) {
  return `
    <div class="requirement-picker">
      <p class="picker-label">Assign Paints</p>
      ${buildAssignmentAddRow(plan)}
      ${buildAssignmentsTable(plan)}
    </div>
  `;
}

function buildAssignmentsTable(plan) {
  const sortedAssignments = getSortedAssignments(plan);
  if (sortedAssignments.length === 0) {
    return '<p class="empty-msg">No paints assigned yet.</p>';
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Paint</th>
            <th>Type</th>
            <th>Brand</th>
            <th>Area(s)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${sortedAssignments.map((assignment) => buildAssignmentRow(plan.id, assignment)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function buildAssignmentRow(planId, assignment) {
  const paint = paints.find((item) => item.id === assignment.paintId);
  if (!paint) {
    return "";
  }

  return `
    <tr>
      <td>${escapeHtml(paint.name)}</td>
      <td>${escapeHtml(paint.type)}</td>
      <td>${escapeHtml(paint.brand)}</td>
      <td>${escapeHtml(assignment.areas)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-action="edit-assignment" data-plan-id="${planId}" data-assignment-id="${assignment.id}" title="Edit" aria-label="Edit">&#9998;</button>
          <button class="icon-btn delete" data-action="delete-assignment" data-plan-id="${planId}" data-assignment-id="${assignment.id}" title="Remove" aria-label="Remove">&times;</button>
        </div>
      </td>
    </tr>
  `;
}

function deletePaint(paintId) {
  const paint = paints.find((item) => item.id === paintId);
  if (!paint) {
    return;
  }
  const ask = typeof window.appConfirmDelete === "function"
    ? window.appConfirmDelete
    : (label) => window.confirm(`Delete ${label}?`);
  if (!ask(paint.name || "paint")) {
    return;
  }

  paints = paints.filter((paint) => paint.id !== paintId);
  for (const plan of paintPlans) {
    plan.assignments = plan.assignments.filter((assignment) => assignment.paintId !== paintId);
  }
  persistPaints();
  persistPaintPlans();
  render();
  if (window.appToast) window.appToast("Paint deleted");
}

function deletePlan(planId) {
  const plan = paintPlans.find((item) => item.id === planId);
  if (!plan) {
    return;
  }
  const entry = entries.find((item) => item.id === plan.entryId);
  const ask = typeof window.appConfirmDelete === "function"
    ? window.appConfirmDelete
    : (label) => window.confirm(`Delete ${label}?`);
  if (!ask(entry && entry.unit ? entry.unit : "unit")) {
    return;
  }

  paintPlans = paintPlans.filter((plan) => plan.id !== planId);
  persistPaintPlans();
  render();
  if (window.appToast) window.appToast("Unit removed");
}

function buildAssignmentAddRow(plan) {
  const sortedPaints = getSortedPaints();
  if (sortedPaints.length === 0) {
    return '<p class="picker-empty">No paints available yet. Add paints in the Paint Inventory section first.</p>';
  }

  const editingAssignmentId = editPlanDialog instanceof HTMLDialogElement
    ? editPlanDialog.dataset.editingAssignmentId
    : "";
  const editingAssignment = editingAssignmentId
    ? plan.assignments.find((assignment) => assignment.id === editingAssignmentId)
    : null;

  const options = sortedPaints
    .map((paint) => ({
      id: paint.id,
      label: `${paint.name} (${paint.brand} / ${paint.type})`
    }))
    .map((item) => `<option value="${item.id}" ${editingAssignment && editingAssignment.paintId === item.id ? "selected" : ""}>${escapeHtml(item.label)}</option>`)
    .join("");

  return `
    <div class="paint-assignment-form">
      <label>
        Paint
        <select id="paint-select-${plan.id}" class="assignment-select">
          ${options}
        </select>
      </label>
      <label>
        Area(s)
        <input id="areas-input-${plan.id}" class="inline-input" value="${escapeHtml(editingAssignment ? editingAssignment.areas : "")}" placeholder="e.g. Head, Legs, Armor" />
      </label>
      <button type="button" class="btn-small" data-action="add-assignment" data-plan-id="${plan.id}" title="${editingAssignment ? "Save Paint" : "Add Paint"}">${editingAssignment ? "Save" : "Add"}</button>
      ${editingAssignment ? `<button type="button" class="btn-small btn-secondary" data-action="cancel-assignment-edit" data-plan-id="${plan.id}" title="Cancel Edit">Cancel</button>` : ""}
    </div>
  `;
}

function deleteAssignment(planId, assignmentId) {
  const plan = paintPlans.find((item) => item.id === planId);
  if (!plan) {
    return;
  }

  const assignment = plan.assignments.find((item) => item.id === assignmentId);
  const paint = assignment ? paints.find((item) => item.id === assignment.paintId) : null;
  const ask = typeof window.appConfirmDelete === "function"
    ? window.appConfirmDelete
    : (label) => window.confirm(`Delete ${label}?`);
  if (!ask(paint && paint.name ? paint.name : "assignment")) {
    return;
  }

  plan.assignments = plan.assignments.filter((assignment) => assignment.id !== assignmentId);
  persistPaintPlans();
  render();
}

function getSortedPaints() {
  return [...paints].sort((a, b) => compareText(a.name, b.name) || compareText(a.brand, b.brand));
}

function getSortedPaintPlans() {
  return [...paintPlans].sort((a, b) => {
    const aEntry = getEntryById(a.entryId);
    const bEntry = getEntryById(b.entryId);
    const unitCompare = compareText(aEntry ? aEntry.unit : "", bEntry ? bEntry.unit : "");
    if (unitCompare !== 0) {
      return unitCompare;
    }

    const gameCompare = compareText(aEntry ? aEntry.game : "", bEntry ? bEntry.game : "");
    if (gameCompare !== 0) {
      return gameCompare;
    }

    return compareText(aEntry ? aEntry.faction : "", bEntry ? bEntry.faction : "");
  });
}

function getSortedAssignments(plan) {
  return [...plan.assignments].sort((a, b) => {
    const aPaint = getPaintById(a.paintId);
    const bPaint = getPaintById(b.paintId);
    const paintCompare = compareText(aPaint ? aPaint.name : "", bPaint ? bPaint.name : "");
    if (paintCompare !== 0) {
      return paintCompare;
    }
    return compareText(a.areas, b.areas);
  });
}

function getEntryById(entryId) {
  return entries.find((item) => item.id === entryId) || null;
}

function getPaintById(paintId) {
  return paints.find((item) => item.id === paintId) || null;
}

function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, { sensitivity: "base" });
}

function cleanupPaintPlans() {
  let changed = false;
  const entryIds = new Set(entries.map((entry) => entry.id));
  const paintIds = new Set(paints.map((paint) => paint.id));

  paintPlans = paintPlans
    .filter((plan) => {
      const keep = entryIds.has(plan.entryId);
      if (!keep) {
        changed = true;
      }
      return keep;
    })
    .map((plan) => {
      const assignments = plan.assignments.filter((assignment) => paintIds.has(assignment.paintId));
      if (assignments.length !== plan.assignments.length) {
        changed = true;
      }
      return { ...plan, assignments };
    });

  if (changed) {
    persistPaintPlans();
  }
}

function valueFromInput(id) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return "";
  }
  return input.value.trim();
}

function loadPaints() {
  const stored = selectBestStoredArray([PAINTS_KEY, PAINTS_BACKUP_KEY], normalizePaint);
  if (!stored) {
    return [];
  }

  if (stored.entries.length > 0) {
    hydratePrimaryFromSource(PAINTS_KEY, stored.sourceKey, stored.entries);
    ensureBackupSnapshot(PAINTS_BACKUP_KEY, stored.entries);
  }

  return stored.entries;
}

function loadPaintPlans() {
  const stored = selectBestStoredArray([PAINT_PLANS_KEY, PAINT_PLANS_BACKUP_KEY], normalizePaintPlan);
  if (!stored) {
    return [];
  }

  if (stored.entries.length > 0) {
    hydratePrimaryFromSource(PAINT_PLANS_KEY, stored.sourceKey, stored.entries);
    ensureBackupSnapshot(PAINT_PLANS_BACKUP_KEY, stored.entries);
  }

  return stored.entries;
}

function loadEntries() {
  const stored = selectBestStoredArray(
    [ENTRIES_KEY, LEGACY_ENTRIES_KEY, ENTRY_BACKUP_KEY],
    normalizeEntry
  );
  return stored ? stored.entries : [];
}

function persistPaints() {
  persistStoredArray(PAINTS_KEY, PAINTS_BACKUP_KEY, paints);
}

function persistPaintPlans() {
  persistStoredArray(PAINT_PLANS_KEY, PAINT_PLANS_BACKUP_KEY, paintPlans);
}

function normalizePaint(paint) {
  if (!paint || typeof paint !== "object") {
    return null;
  }

  const normalized = {
    id: typeof paint.id === "string" && paint.id.trim() ? paint.id : createId(),
    name: String(paint.name || "").trim(),
    type: String(paint.type || "").trim(),
    brand: String(paint.brand || "").trim()
  };

  if (!normalized.name || !normalized.type || !normalized.brand) {
    return null;
  }

  return normalized;
}

function normalizePaintPlan(plan) {
  if (!plan || typeof plan !== "object") {
    return null;
  }

  const entryId = typeof plan.entryId === "string" && plan.entryId.trim()
    ? plan.entryId
    : null;
  if (!entryId) {
    return null;
  }

  const assignments = Array.isArray(plan.assignments)
    ? plan.assignments
        .map(normalizePaintAssignment)
        .filter((assignment) => assignment !== null)
    : [];

  return {
    id: typeof plan.id === "string" && plan.id.trim() ? plan.id : createId(),
    entryId,
    assignments
  };
}

function normalizePaintAssignment(assignment) {
  if (!assignment || typeof assignment !== "object") {
    return null;
  }

  const paintId = typeof assignment.paintId === "string" && assignment.paintId.trim()
    ? assignment.paintId
    : null;
  if (!paintId) {
    return null;
  }

  const areas = String(assignment.areas || "").trim();
  if (!areas) {
    return null;
  }

  return {
    id: typeof assignment.id === "string" && assignment.id.trim() ? assignment.id : createId(),
    paintId,
    areas
  };
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const normalized = {
    id: typeof entry.id === "string" && entry.id.trim() ? entry.id : createId(),
    game: String(entry.game || "").trim(),
    faction: String(entry.faction || "").trim(),
    unit: String(entry.unit || "").trim(),
    number: Number(entry.number || 0),
    type: String(entry.type || "").trim(),
    status: STATUS_VALUES.includes(String(entry.status || ""))
      ? String(entry.status)
      : "Unpainted"
  };

  return isValidEntry(normalized) ? normalized : null;
}

function isValidEntry(entry) {
  return (
    typeof entry.id === "string" &&
    typeof entry.game === "string" &&
    entry.game.length > 0 &&
    typeof entry.faction === "string" &&
    entry.faction.length > 0 &&
    typeof entry.unit === "string" &&
    entry.unit.length > 0 &&
    Number.isInteger(entry.number) &&
    entry.number > 0 &&
    typeof entry.type === "string" &&
    entry.type.length > 0 &&
    STATUS_VALUES.includes(entry.status)
  );
}

function selectBestStoredArray(keys, normalizer) {
  let primary = null;
  let fallback = null;
  const primaryKey = keys[0];

  for (const key of keys) {
    const raw = safeGetStorage(key);
    if (!raw) {
      continue;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        continue;
      }

      const normalized = parsed
        .map((item) => normalizer(item))
        .filter((item) => item !== null);

      if (key === primaryKey) {
        primary = { sourceKey: key, entries: normalized };
      } else if (!fallback || normalized.length > fallback.entries.length) {
        fallback = { sourceKey: key, entries: normalized };
      }
    } catch {
      // Ignore malformed JSON and keep looking at other keys.
    }
  }

  return primary || fallback;
}

function hydratePrimaryFromSource(primaryKey, sourceKey, data) {
  if (sourceKey === primaryKey || data.length === 0) {
    return;
  }

  if (!safeGetStorage(primaryKey)) {
    safeSetStorage(primaryKey, JSON.stringify(data));
  }
}

function ensureBackupSnapshot(backupKey, data) {
  if (data.length === 0 || safeGetStorage(backupKey)) {
    return;
  }

  safeSetStorage(backupKey, JSON.stringify(data));
}

function persistStoredArray(primaryKey, backupKey, data) {
  try {
    const nextRaw = JSON.stringify(data);
    const existingRaw = safeGetStorage(primaryKey);

    if (existingRaw && existingRaw !== nextRaw) {
      safeSetStorage(backupKey, existingRaw);
    } else if (!existingRaw) {
      safeSetStorage(backupKey, nextRaw);
    }

    safeSetStorage(primaryKey, nextRaw);
  } catch {
    // Ignore storage write errors.
  }
}

function safeGetStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage write errors.
  }
}

function createId() {
  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
