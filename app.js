const STORAGE_KEY = "mini-tracker-entries-v1";
const LEGACY_STORAGE_KEY = "mini-tracker-entries";
const ARMIES_KEY = "mini-tracker-armies-v1";
const SCENARIOS_KEY = "mini-tracker-scenarios-v1";
const ENTRY_BACKUP_KEY = "mini-tracker-entries-backup-v1";
const ARMY_BACKUP_KEY = "mini-tracker-armies-backup-v1";
const SCENARIO_BACKUP_KEY = "mini-tracker-scenarios-backup-v1";
const STATUS_VALUES = ["Unpainted", "Primed", "Painted", "Based", "Completed"];

const form = document.getElementById("entry-form");
const entriesBody = document.getElementById("entries-body");
const tableHead = document.querySelector("thead");
const searchInput = document.getElementById("search");
const statusFilterInput = document.getElementById("status-filter");
const sortByInput = document.getElementById("sort-by");
const sortDirInput = document.getElementById("sort-dir");
const clearFiltersButton = document.getElementById("clear-filters");
const statUnits = document.getElementById("stat-units");
const statTotal = document.getElementById("stat-total");
const statCompleted = document.getElementById("stat-completed");
const statPercent = document.getElementById("stat-percent");
const addEntryDialog = document.getElementById("add-entry-dialog");
const editEntryDialog = document.getElementById("edit-entry-dialog");
const editEntryForm = document.getElementById("edit-entry-form");
const openAddEntryBtn = document.getElementById("open-add-entry-btn");

let entries = loadEntries();
let armies = loadArmiesData();
let scenarios = loadScenariosData();
let filters = {
  search: "",
  status: "All",
  sortBy: "none",
  sortDir: "asc"
};
let editingId = null;

render();

if (openAddEntryBtn instanceof HTMLButtonElement) {
  openAddEntryBtn.addEventListener("click", () => {
    if (addEntryDialog instanceof HTMLDialogElement) addEntryDialog.showModal();
  });
}

if (editEntryForm instanceof HTMLFormElement) {
  editEntryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!editingId) return;
    const updated = {
      id: editingId,
      game: getDialogValue("dialog-edit-game"),
      faction: getDialogValue("dialog-edit-faction"),
      unit: getDialogValue("dialog-edit-unit"),
      number: Number(getDialogValue("dialog-edit-number")),
      type: getDialogValue("dialog-edit-type"),
      status: getDialogValue("dialog-edit-status")
    };
    if (!isValidEntry(updated)) return;
    const index = entries.findIndex((e) => e.id === editingId);
    if (index === -1) return;
    entries[index] = updated;
    editingId = null;
    persistEntries();
    render();
    if (editEntryDialog instanceof HTMLDialogElement) editEntryDialog.close();
    if (window.appToast) window.appToast("Changes saved");
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const entry = {
    id: createId(),
    game: String(formData.get("game") || "").trim(),
    faction: String(formData.get("faction") || "").trim(),
    unit: String(formData.get("unit") || "").trim(),
    number: Number(formData.get("number") || 0),
    type: String(formData.get("type") || "").trim(),
    status: String(formData.get("status") || "Unpainted")
  };

  if (!isValidEntry(entry)) {
    return;
  }

  entries.unshift(entry);
  persistEntries();
  render();
  form.reset();

  const statusInput = form.elements.namedItem("status");
  if (statusInput instanceof HTMLSelectElement) {
    statusInput.value = "Unpainted";
  }

  if (addEntryDialog instanceof HTMLDialogElement) {
    addEntryDialog.close();
  }
});

entriesBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const id = target.dataset.id;
  if (!id) {
    return;
  }

  if (target.dataset.action === "delete") {
    removeEntry(id);
  } else if (target.dataset.action === "copy") {
    copyToForm(id);
  } else if (target.dataset.action === "edit") {
    editEntry(id);
  }
});

if (tableHead instanceof HTMLTableSectionElement) {
  tableHead.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest(".sort-btn");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const field = button.dataset.sort;
    if (!field) {
      return;
    }

    if (filters.sortBy === field) {
      filters.sortDir = filters.sortDir === "asc" ? "desc" : "asc";
    } else {
      filters.sortBy = field;
      filters.sortDir = "asc";
    }

    syncSortControls();
    render();
  });
}

if (searchInput instanceof HTMLInputElement) {
  searchInput.addEventListener("input", () => {
    filters.search = searchInput.value.trim().toLowerCase();
    render();
  });
}

if (statusFilterInput instanceof HTMLSelectElement) {
  statusFilterInput.addEventListener("change", () => {
    filters.status = statusFilterInput.value;
    render();
  });
}

if (sortByInput instanceof HTMLSelectElement) {
  sortByInput.addEventListener("change", () => {
    filters.sortBy = sortByInput.value;
    syncSortControls();
    render();
  });
}

if (sortDirInput instanceof HTMLSelectElement) {
  sortDirInput.addEventListener("change", () => {
    filters.sortDir = sortDirInput.value;
    syncSortControls();
    render();
  });
}

if (clearFiltersButton instanceof HTMLButtonElement) {
  clearFiltersButton.addEventListener("click", () => {
    filters = {
      search: "",
      status: "All",
      sortBy: "none",
      sortDir: "asc"
    };

    if (searchInput instanceof HTMLInputElement) {
      searchInput.value = "";
    }
    if (statusFilterInput instanceof HTMLSelectElement) {
      statusFilterInput.value = "All";
    }

    syncSortControls();
    render();
  });
}

window.addEventListener("focus", () => {
  armies = loadArmiesData();
  scenarios = loadScenariosData();
  render();
});

function render() {
  entriesBody.innerHTML = "";
  armies = loadArmiesData();
  scenarios = loadScenariosData();
  renderSummary();
  renderSortHeaders();

  const visibleEntries = getVisibleEntries();

  if (entries.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="8">No entries yet. Add your first unit above.</td>';
    entriesBody.appendChild(row);
    return;
  }

  if (visibleEntries.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="8">No entries match your current filters.</td>';
    entriesBody.appendChild(row);
    return;
  }

  for (const entry of visibleEntries) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${escapeHtml(entry.game)}</td>
      <td>${escapeHtml(entry.faction)}</td>
      <td>${escapeHtml(entry.unit)}</td>
      <td>${entry.number}</td>
      <td>${escapeHtml(entry.type)}</td>
      <td><span class="badge s-${escapeHtml(entry.status)}">${escapeHtml(entry.status)}</span></td>
      <td class="armies-cell">${getUnitCollectionsHtml(entry.id)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-action="edit" data-id="${entry.id}" title="Edit" aria-label="Edit">&#9998;</button>
          <button class="icon-btn" data-action="copy" data-id="${entry.id}" title="Copy" aria-label="Copy">&#128203;</button>
          <button class="icon-btn delete" data-action="delete" data-id="${entry.id}" title="Delete" aria-label="Delete">&times;</button>
        </div>
      </td>
    `;
    entriesBody.appendChild(row);
  }
}

function syncSortControls() {
  if (sortByInput instanceof HTMLSelectElement) {
    sortByInput.value = filters.sortBy;
  }
  if (sortDirInput instanceof HTMLSelectElement) {
    sortDirInput.value = filters.sortDir;
  }
}

function renderSortHeaders() {
  const buttons = document.querySelectorAll(".sort-btn");
  for (const button of buttons) {
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }

    const field = button.dataset.sort;
    const indicator = button.querySelector(".sort-indicator");
    const active = field === filters.sortBy && filters.sortBy !== "none";
    button.classList.toggle("active", active);

    if (indicator instanceof HTMLElement) {
      indicator.textContent = active ? (filters.sortDir === "asc" ? "↑" : "↓") : "";
    }
  }
}

function removeEntry(id) {
  if (editingId === id) {
    editingId = null;
  }

  entries = entries.filter((entry) => entry.id !== id);
  persistEntries();
  pruneArmies(id);
  render();
}

function copyToForm(id) {
  const item = entries.find((entry) => entry.id === id);
  if (!item) {
    return;
  }

  setFormField("game", item.game);
  setFormField("faction", item.faction);
  setFormField("unit", item.unit);
  setFormField("number", String(item.number));
  setFormField("type", item.type);
  setFormField("status", item.status);

  if (addEntryDialog instanceof HTMLDialogElement) {
    addEntryDialog.showModal();
  }
}

function setFormField(name, value) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
    field.value = value;
  }
}

function saveEdit(id) {
  // legacy – editing now handled via dialog form submit
}

function valueFromEditInput(prefix, id) {
  return getDialogValue(`${prefix}-${id}`);
}

function editEntry(id) {
  const entry = entries.find((e) => e.id === id);
  if (!entry) return;
  editingId = id;
  setDialogValue("dialog-edit-game", entry.game);
  setDialogValue("dialog-edit-faction", entry.faction);
  setDialogValue("dialog-edit-unit", entry.unit);
  setDialogValue("dialog-edit-number", String(entry.number));
  setDialogValue("dialog-edit-type", entry.type);
  setDialogValue("dialog-edit-status", entry.status);
  if (editEntryDialog instanceof HTMLDialogElement) editEntryDialog.showModal();
}

function setDialogValue(id, value) {
  const el = document.getElementById(id);
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
    el.value = value;
  }
}

function getDialogValue(id) {
  const el = document.getElementById(id);
  return (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) ? el.value.trim() : "";
}

function getVisibleEntries() {
  const filtered = entries.filter((entry) => {
    const statusMatch = filters.status === "All" || entry.status === filters.status;
    if (!statusMatch) {
      return false;
    }

    if (!filters.search) {
      return true;
    }

    const haystack = [entry.game, entry.faction, entry.unit, entry.type]
      .join(" ")
      .toLowerCase();

    return haystack.includes(filters.search);
  });

  if (filters.sortBy === "none") {
    return filtered;
  }

  return [...filtered].sort((a, b) => compareEntries(a, b, filters.sortBy, filters.sortDir));
}

function compareEntries(a, b, sortBy, sortDir) {
  const direction = sortDir === "desc" ? -1 : 1;

  if (sortBy === "number") {
    return direction * (a.number - b.number);
  }

  if (sortBy === "status") {
    return direction * (STATUS_VALUES.indexOf(a.status) - STATUS_VALUES.indexOf(b.status));
  }

  const av = String(a[sortBy] || "").toLowerCase();
  const bv = String(b[sortBy] || "").toLowerCase();
  return direction * av.localeCompare(bv);
}

function renderSummary() {
  const unitEntries = entries.length;
  const totalMinis = entries.reduce((sum, entry) => sum + entry.number, 0);
  const completedMinis = entries
    .filter((entry) => entry.status === "Completed")
    .reduce((sum, entry) => sum + entry.number, 0);
  const completionPct = totalMinis > 0 ? Math.round((completedMinis / totalMinis) * 100) : 0;

  if (statUnits) {
    statUnits.textContent = String(unitEntries);
  }
  if (statTotal) {
    statTotal.textContent = String(totalMinis);
  }
  if (statCompleted) {
    statCompleted.textContent = String(completedMinis);
  }
  if (statPercent) {
    statPercent.textContent = `${completionPct}%`;
  }
}

function loadEntries() {
  const stored = selectBestStoredArray(
    [STORAGE_KEY, LEGACY_STORAGE_KEY, ENTRY_BACKUP_KEY],
    normalizeEntry
  );

  if (!stored) {
    return [];
  }

  if (stored.entries.length > 0) {
    hydratePrimaryFromSource(STORAGE_KEY, stored.sourceKey, stored.entries);
    ensureBackupSnapshot(ENTRY_BACKUP_KEY, stored.entries);
  }

  return stored.entries;
}

function persistEntries() {
  persistStoredArray(STORAGE_KEY, ENTRY_BACKUP_KEY, entries);
}

function loadArmiesData() {
  const stored = selectBestStoredArray([ARMIES_KEY, ARMY_BACKUP_KEY], normalizeArmy);
  if (!stored) {
    return [];
  }

  if (stored.entries.length > 0) {
    hydratePrimaryFromSource(ARMIES_KEY, stored.sourceKey, stored.entries);
    ensureBackupSnapshot(ARMY_BACKUP_KEY, stored.entries);
  }

  return stored.entries;
}

function loadScenariosData() {
  const stored = selectBestStoredArray([SCENARIOS_KEY, SCENARIO_BACKUP_KEY], normalizeScenario);
  if (!stored) {
    return [];
  }

  if (stored.entries.length > 0) {
    hydratePrimaryFromSource(SCENARIOS_KEY, stored.sourceKey, stored.entries);
    ensureBackupSnapshot(SCENARIO_BACKUP_KEY, stored.entries);
  }

  return stored.entries;
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

function normalizeArmy(army) {
  if (!army || typeof army !== "object") {
    return null;
  }

  const assignments = Array.isArray(army.assignments)
    ? army.assignments
        .map(normalizeAssignment)
        .filter((assignment) => assignment !== null)
    : Array.isArray(army.unitIds)
      ? [...new Set(army.unitIds.filter((id) => typeof id === "string" && id.trim().length > 0))]
          .map((entryId) => ({ entryId, quantity: 1 }))
      : [];

  const normalized = {
    id: typeof army.id === "string" && army.id.trim() ? army.id : createId(),
    name: String(army.name || "").trim(),
    assignments
  };

  return normalized.name ? normalized : null;
}

function normalizeScenario(scenario) {
  if (!scenario || typeof scenario !== "object") {
    return null;
  }

  const requirements = Array.isArray(scenario.requirements)
    ? scenario.requirements
        .map(normalizeScenarioRequirement)
        .filter((item) => item !== null)
    : [];

  const normalized = {
    id: typeof scenario.id === "string" && scenario.id.trim() ? scenario.id : createId(),
    name: String(scenario.name || "").trim(),
    requirements
  };

  return normalized.name ? normalized : null;
}

function normalizeScenarioRequirement(requirement) {
  if (!requirement || typeof requirement !== "object") {
    return null;
  }

  const assignments = Array.isArray(requirement.assignments)
    ? requirement.assignments
        .map(normalizeScenarioAssignment)
        .filter((item) => item !== null)
    : [];

  return {
    id: typeof requirement.id === "string" && requirement.id.trim() ? requirement.id : createId(),
    assignments
  };
}

function normalizeScenarioAssignment(assignment) {
  if (!assignment || typeof assignment !== "object") {
    return null;
  }

  const entryId = typeof assignment.entryId === "string" && assignment.entryId.trim()
    ? assignment.entryId
    : null;
  if (!entryId) {
    return null;
  }

  const quantity = Number.isInteger(assignment.quantity) && assignment.quantity > 0
    ? assignment.quantity
    : 1;

  return { entryId, quantity };
}

function normalizeAssignment(assignment) {
  if (!assignment || typeof assignment !== "object") {
    return null;
  }

  const entryId = typeof assignment.entryId === "string" && assignment.entryId.trim()
    ? assignment.entryId
    : null;
  if (!entryId) {
    return null;
  }

  const quantity = Number.isInteger(assignment.quantity) && assignment.quantity > 0
    ? assignment.quantity
    : 1;

  return { entryId, quantity };
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

function getUnitCollectionsHtml(unitId) {
  const armyChips = armies
    .filter((army) => army.assignments.some((assignment) => assignment.entryId === unitId))
    .map((army) => {
      const assignment = army.assignments.find((item) => item.entryId === unitId);
      const suffix = assignment && assignment.quantity > 1 ? ` x${assignment.quantity}` : "";
      return `<span class="army-chip">A: ${escapeHtml(army.name)}${suffix}</span>`;
    });

  const scenarioChips = scenarios
    .flatMap((scenario) => scenario.requirements.map((requirement) => ({ scenario, requirement })))
    .map(({ scenario, requirement }) => {
      const assignment = requirement.assignments.find((item) => item.entryId === unitId);
      if (!assignment) {
        return "";
      }

      const suffix = assignment.quantity > 1 ? ` x${assignment.quantity}` : "";
      return `<span class="scenario-chip">S: ${escapeHtml(scenario.name)}${suffix}</span>`;
    })
    .filter(Boolean);

  const chips = [...armyChips, ...scenarioChips];

  return chips.length > 0 ? chips.join("") : '<span class="armies-none">-</span>';
}

function pruneArmies(deletedUnitId) {
  armies = armies.map((army) => ({
    ...army,
    assignments: army.assignments.filter((assignment) => assignment.entryId !== deletedUnitId)
  }));

  persistStoredArray(ARMIES_KEY, ARMY_BACKUP_KEY, armies);
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
        continue;
      }

      if (!fallback || normalized.length > fallback.entries.length) {
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
