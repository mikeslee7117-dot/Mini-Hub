const PAINTS_KEY = "mini-tracker-paints-v1";
const PAINTS_BACKUP_KEY = "mini-tracker-paints-backup-v1";
const PAINT_PLANS_KEY = "mini-tracker-paint-plans-v1";
const PAINT_PLANS_BACKUP_KEY = "mini-tracker-paint-plans-backup-v1";
const ENTRIES_KEY = "mini-tracker-entries-v1";
const LEGACY_ENTRIES_KEY = "mini-tracker-entries";
const ENTRY_BACKUP_KEY = "mini-tracker-entries-backup-v1";
const STATUS_VALUES = ["Unpainted", "Primed", "Painted", "Based", "Completed"];

const paintForm = document.getElementById("paint-form");
const paintsBody = document.getElementById("paints-body");
const paintUnitForm = document.getElementById("paint-unit-form");
const paintUnitSelect = document.getElementById("paint-unit-select");
const paintPlansRoot = document.getElementById("paint-plans");

let paints = loadPaints();
let entries = loadEntries();
let paintPlans = loadPaintPlans();
let editingPaintId = null;
let editingPlanId = null;

render();

paintForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(paintForm);
  const paint = normalizePaint({
    id: createId(),
    name: String(formData.get("name") || "").trim(),
    type: String(formData.get("type") || "").trim(),
    brand: String(formData.get("brand") || "").trim()
  });

  if (!paint) {
    return;
  }

  paints.unshift(paint);
  persistPaints();
  render();
  paintForm.reset();
});

paintsBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const paintId = target.dataset.paintId;
  if (!paintId) {
    return;
  }

  if (target.dataset.action === "edit-paint") {
    editingPaintId = paintId;
    renderPaintsTable();
  } else if (target.dataset.action === "cancel-edit-paint") {
    editingPaintId = null;
    renderPaintsTable();
  } else if (target.dataset.action === "save-paint") {
    savePaintEdit(paintId);
  } else if (target.dataset.action === "delete-paint") {
    deletePaint(paintId);
  }
});

paintUnitForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!(paintUnitSelect instanceof HTMLSelectElement)) {
    return;
  }

  const entryId = paintUnitSelect.value;
  if (!entryId || paintPlans.some((plan) => plan.entryId === entryId)) {
    return;
  }

  paintPlans.unshift({ id: createId(), entryId, assignments: [] });
  persistPaintPlans();
  render();
  paintUnitSelect.value = "";
});

paintPlansRoot.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const planId = target.dataset.planId;
  const assignmentId = target.dataset.assignmentId;

  if (target.dataset.action === "delete-plan" && planId) {
    deletePlan(planId);
  } else if (target.dataset.action === "toggle-edit-plan" && planId) {
    editingPlanId = editingPlanId === planId ? null : planId;
    renderPaintPlans();
  } else if (target.dataset.action === "add-assignment" && planId) {
    addAssignment(planId);
  } else if (target.dataset.action === "delete-assignment" && planId && assignmentId) {
    deleteAssignment(planId, assignmentId);
  }
});

function render() {
  entries = loadEntries();
  paints = loadPaints();
  paintPlans = loadPaintPlans();
  cleanupPaintPlans();
  renderPaintsTable();
  renderUnitSelect();
  renderPaintPlans();
}

function renderPaintsTable() {
  paintsBody.innerHTML = "";

  const sortedPaints = getSortedPaints();

  if (sortedPaints.length === 0) {
    paintsBody.innerHTML = '<tr><td colspan="4">No paints yet. Add your first paint above.</td></tr>';
    return;
  }

  for (const paint of sortedPaints) {
    const row = document.createElement("tr");

    if (editingPaintId === paint.id) {
      row.innerHTML = `
        <td><input class="inline-input" id="edit-paint-name-${paint.id}" value="${escapeHtml(paint.name)}" /></td>
        <td><input class="inline-input" id="edit-paint-type-${paint.id}" value="${escapeHtml(paint.type)}" /></td>
        <td><input class="inline-input" id="edit-paint-brand-${paint.id}" value="${escapeHtml(paint.brand)}" /></td>
        <td>
          <div class="row-actions">
            <button class="save" data-action="save-paint" data-paint-id="${paint.id}">Save</button>
            <button class="cancel" data-action="cancel-edit-paint" data-paint-id="${paint.id}">Cancel</button>
          </div>
        </td>
      `;
    } else {
      row.innerHTML = `
        <td>${escapeHtml(paint.name)}</td>
        <td>${escapeHtml(paint.type)}</td>
        <td>${escapeHtml(paint.brand)}</td>
        <td>
          <div class="row-actions">
            <button data-action="edit-paint" data-paint-id="${paint.id}">Edit</button>
            <button class="delete" data-action="delete-paint" data-paint-id="${paint.id}">Delete</button>
          </div>
        </td>
      `;
    }

    paintsBody.appendChild(row);
  }
}

function renderUnitSelect() {
  if (!(paintUnitSelect instanceof HTMLSelectElement)) {
    return;
  }

  const selected = paintUnitSelect.value;
  const options = entries
    .map((entry) => {
      const label = `${entry.unit} (${entry.game} / ${entry.faction})`;
      return { id: entry.id, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
    .map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`)
    .join("");

  paintUnitSelect.innerHTML = `<option value="">Select a unit</option>${options}`;
  if (selected && entries.some((entry) => entry.id === selected)) {
    paintUnitSelect.value = selected;
  }
}

function renderPaintPlans() {
  paintPlansRoot.innerHTML = "";
  if (editingPlanId && !paintPlans.some((plan) => plan.id === editingPlanId)) {
    editingPlanId = null;
  }

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

  const canEdit = editingPlanId === plan.id;
  return `
    <tr>
      <td>
        <div class="unit-label-strong">${escapeHtml(entry.unit)}</div>
        <div class="requirement-inline">${escapeHtml(entry.game)} / ${escapeHtml(entry.faction)}</div>
      </td>
      <td>${buildAssignmentSummary(plan)}</td>
      <td>
        <div class="row-actions">
          <button data-action="toggle-edit-plan" data-plan-id="${plan.id}">${canEdit ? "Done" : "Edit"}</button>
          <button class="delete" data-action="delete-plan" data-plan-id="${plan.id}">Remove Unit</button>
        </div>
      </td>
    </tr>
    ${canEdit ? buildPlanEditorRow(plan) : ""}
  `;
}

function buildPlanEditorRow(plan) {
  return `
    <tr class="requirement-picker-expand">
      <td colspan="3">
        <div class="requirement-picker">
          <p class="picker-label">Edit Unit Paints</p>
          ${buildAssignmentAddRow(plan)}
          ${buildAssignmentsTable(plan)}
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

function buildAssignmentAddRow(plan) {
  const sortedPaints = getSortedPaints();
  if (sortedPaints.length === 0) {
    return '<p class="picker-empty">No paints available yet. Add paints in the Paint Inventory section first.</p>';
  }

  const options = sortedPaints
    .map((paint) => ({
      id: paint.id,
      label: `${paint.name} (${paint.brand} / ${paint.type})`
    }))
    .map((item) => `<option value="${item.id}">${escapeHtml(item.label)}</option>`)
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
        <input id="areas-input-${plan.id}" class="inline-input" placeholder="e.g. Head, Legs, Armor" />
      </label>
      <button data-action="add-assignment" data-plan-id="${plan.id}">Add Paint</button>
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
          <button class="delete" data-action="delete-assignment" data-plan-id="${planId}" data-assignment-id="${assignment.id}">Remove</button>
        </div>
      </td>
    </tr>
  `;
}

function savePaintEdit(paintId) {
  const paint = paints.find((item) => item.id === paintId);
  if (!paint) {
    return;
  }

  const updated = normalizePaint({
    id: paint.id,
    name: valueFromInput(`edit-paint-name-${paintId}`),
    type: valueFromInput(`edit-paint-type-${paintId}`),
    brand: valueFromInput(`edit-paint-brand-${paintId}`)
  });

  if (!updated) {
    return;
  }

  paint.name = updated.name;
  paint.type = updated.type;
  paint.brand = updated.brand;
  editingPaintId = null;
  persistPaints();
  render();
}

function deletePaint(paintId) {
  paints = paints.filter((paint) => paint.id !== paintId);
  if (editingPaintId === paintId) {
    editingPaintId = null;
  }

  for (const plan of paintPlans) {
    plan.assignments = plan.assignments.filter((assignment) => assignment.paintId !== paintId);
  }

  persistPaints();
  persistPaintPlans();
  render();
}

function deletePlan(planId) {
  paintPlans = paintPlans.filter((plan) => plan.id !== planId);
  if (editingPlanId === planId) {
    editingPlanId = null;
  }
  persistPaintPlans();
  render();
}

function addAssignment(planId) {
  const plan = paintPlans.find((item) => item.id === planId);
  if (!plan) {
    return;
  }

  const paintSelect = document.getElementById(`paint-select-${planId}`);
  const areasInput = document.getElementById(`areas-input-${planId}`);
  if (!(paintSelect instanceof HTMLSelectElement) || !(areasInput instanceof HTMLInputElement)) {
    return;
  }

  const paintId = paintSelect.value;
  const areas = areasInput.value.trim();
  if (!paintId || !areas) {
    return;
  }

  plan.assignments.push({
    id: createId(),
    paintId,
    areas
  });

  persistPaintPlans();
  render();
}

function deleteAssignment(planId, assignmentId) {
  const plan = paintPlans.find((item) => item.id === planId);
  if (!plan) {
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
