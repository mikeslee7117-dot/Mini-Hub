const ARMIES_KEY = "mini-tracker-armies-v1";
const ENTRIES_KEY = "mini-tracker-entries-v1";
const LEGACY_ENTRIES_KEY = "mini-tracker-entries";
const ENTRY_BACKUP_KEY = "mini-tracker-entries-backup-v1";
const ARMY_BACKUP_KEY = "mini-tracker-armies-backup-v1";
const STATUS_VALUES = ["Unpainted", "Primed", "Painted", "Based", "Completed"];

const createForm = document.getElementById("create-army-form");
const armiesList = document.getElementById("armies-list");
const armyGameSelect = document.getElementById("army-game");
const openCreateArmyBtn = document.getElementById("open-create-army-btn");
const createArmyDialog = document.getElementById("create-army-dialog");
const armyPickerDialog = document.getElementById("army-picker-dialog");
const armyPickerDialogSelect = document.getElementById("army-picker-dialog-select");
const armyPickerDialogAddBtn = document.getElementById("army-picker-dialog-add-btn");
const editArmyDialog = document.getElementById("edit-army-dialog");
const editArmyDialogName = document.getElementById("edit-army-dialog-name");
const editArmyDialogGame = document.getElementById("edit-army-dialog-game");
const editArmyDialogSaveBtn = document.getElementById("edit-army-dialog-save-btn");

let armies = loadArmies();
let entries = loadEntries();
const expandedArmyIds = new Set();

populateArmyGameOptions();
render();

if (openCreateArmyBtn instanceof HTMLButtonElement) {
  openCreateArmyBtn.addEventListener("click", () => {
    if (createArmyDialog instanceof HTMLDialogElement) createArmyDialog.showModal();
  });
}

if (armyPickerDialogAddBtn instanceof HTMLButtonElement) {
  armyPickerDialogAddBtn.addEventListener("click", () => {
    if (!(armyPickerDialog instanceof HTMLDialogElement) || !(armyPickerDialogSelect instanceof HTMLSelectElement)) return;
    const armyId = armyPickerDialog.dataset.armyId;
    const unitId = armyPickerDialogSelect.value;
    if (!armyId || !unitId) return;
    addUnitToArmy(armyId, unitId);
    refreshArmyPickerDialog(armyId);
  });
}

if (editArmyDialogSaveBtn instanceof HTMLButtonElement) {
  editArmyDialogSaveBtn.addEventListener("click", () => {
    if (!(editArmyDialog instanceof HTMLDialogElement) || !(editArmyDialogName instanceof HTMLInputElement) || !(editArmyDialogGame instanceof HTMLSelectElement)) return;
    const armyId = editArmyDialog.dataset.armyId;
    if (!armyId) return;
    const name = editArmyDialogName.value.trim();
    const game = editArmyDialogGame.value.trim();
    if (!name || !game) return;
    const army = armies.find((a) => a.id === armyId);
    if (army) {
      army.name = name;
      army.game = game;
      persistArmies();
      render();
    }
    editArmyDialog.close();
    if (window.appToast) window.appToast("Army saved");
  });
}

createForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const game = String(document.getElementById("army-game").value || "").trim();
  const name = String(document.getElementById("army-name").value || "").trim();
  if (!game || !name) {
    return;
  }

  armies.unshift({ id: createId(), game, name, assignments: [] });
  persistArmies();
  render();
  createForm.reset();
  if (createArmyDialog instanceof HTMLDialogElement) createArmyDialog.close();
});

armiesList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const armyId = target.dataset.armyId;
  const unitId = target.dataset.unitId;

  if (!armyId) {
    return;
  }

  if (target.dataset.action === "delete-army") {
    deleteArmy(armyId);
  } else if (target.dataset.action === "toggle-collapse") {
    toggleArmyCollapse(armyId);
  } else if (target.dataset.action === "edit-army" && armyId) {
    openEditArmyDialog(armyId);
  } else if (target.dataset.action === "toggle-picker") {
    expandedArmyIds.add(armyId);
    render();
    openArmyPickerDialog(armyId);
  } else if (target.dataset.action === "remove-unit" && unitId) {
    removeUnitFromArmy(armyId, unitId);
  }
});

armiesList.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  if (target.dataset.action !== "set-quantity") {
    return;
  }

  const armyId = target.dataset.armyId;
  const unitId = target.dataset.unitId;
  if (!armyId || !unitId) {
    return;
  }

  setAssignmentQuantity(armyId, unitId, Number(target.value));
});

function render() {
  entries = loadEntries();
  armies = loadArmies();
  populateArmyGameOptions();
  armiesList.innerHTML = "";

  if (armies.length === 0) {
    armiesList.innerHTML = '<p class="empty-msg">No armies yet. Click "Add Army" to create one.</p>';
    return;
  }

  const sortedArmies = [...armies].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  for (const army of sortedArmies) {
    const card = document.createElement("section");

    const units = army.assignments
      .map((assignment) => {
        const entry = entries.find((item) => item.id === assignment.entryId);
        if (!entry) return null;
        return { assignment, entry, maxQuantity: entry.number };
      })
      .filter(Boolean);

    const isExpanded = expandedArmyIds.has(army.id);
    card.className = `panel army-card${isExpanded ? "" : " is-collapsed"}`;

    card.innerHTML = `
      <div class="army-header">
        <h3 class="army-name">
          <div class="entity-title-row">
            <button class="collapse-arrow" type="button" data-action="toggle-collapse" data-army-id="${army.id}"
              aria-expanded="${isExpanded ? "true" : "false"}"
              aria-label="${isExpanded ? "Collapse" : "Expand"} army ${escapeHtml(army.name)}">
              <span aria-hidden="true">${isExpanded ? "▾" : "▸"}</span>
            </button>
            <span>${escapeHtml(army.name)}</span>
            <span class="requirement-inline">${escapeHtml(army.game)}</span>
          </div>
        </h3>
        <div class="row-actions">
          <button class="btn-small" data-action="toggle-picker" data-army-id="${army.id}" title="Add Units" aria-label="Add Units">Add Units</button>
          <button class="icon-btn" data-action="edit-army" data-army-id="${army.id}" title="Edit" aria-label="Edit">&#9998;</button>
          <button class="icon-btn delete" data-action="delete-army" data-army-id="${army.id}" title="Delete Army" aria-label="Delete Army">&times;</button>
        </div>
      </div>
      <div class="collapsible-body" ${isExpanded ? "" : "hidden"}>
        <div class="army-units">
          ${units.length === 0
            ? '<p class="empty-msg">No units yet. Use "Add Units" to add.</p>'
            : buildUnitsTable(army.id, units)}
        </div>
      </div>
    `;

    armiesList.appendChild(card);
  }
}

function openArmyPickerDialog(armyId) {
  if (!(armyPickerDialog instanceof HTMLDialogElement) || !(armyPickerDialogSelect instanceof HTMLSelectElement)) return;
  armyPickerDialog.dataset.armyId = armyId;
  refreshArmyPickerDialog(armyId);
  armyPickerDialog.showModal();
}

function refreshArmyPickerDialog(armyId) {
  if (!(armyPickerDialogSelect instanceof HTMLSelectElement)) return;
  entries = loadEntries();
  armies = loadArmies();
  const army = armies.find((a) => a.id === armyId);
  if (!army) return;
  const available = entries.filter((entry) => {
    const notAssigned = !army.assignments.some((a) => a.entryId === entry.id);
    return notAssigned && sameText(entry.game, army.game);
  });

  if (available.length === 0) {
    armyPickerDialogSelect.innerHTML = '<option value="">No available units for this army</option>';
    if (armyPickerDialogAddBtn instanceof HTMLButtonElement) armyPickerDialogAddBtn.disabled = true;
  } else {
    armyPickerDialogSelect.innerHTML = available
      .sort((a, b) => a.unit.localeCompare(b.unit, undefined, { sensitivity: "base" }))
      .map((e) => `<option value="${e.id}">${escapeHtml(e.unit)} (${e.number} available)</option>`)
      .join("");
    if (armyPickerDialogAddBtn instanceof HTMLButtonElement) armyPickerDialogAddBtn.disabled = false;
  }
  render();
}

function openEditArmyDialog(armyId) {
  if (!(editArmyDialog instanceof HTMLDialogElement) || !(editArmyDialogName instanceof HTMLInputElement) || !(editArmyDialogGame instanceof HTMLSelectElement)) return;
  const army = armies.find((a) => a.id === armyId);
  if (!army) return;
  editArmyDialog.dataset.armyId = armyId;
  editArmyDialogName.value = army.name;
  const games = [...new Set(entries.map((entry) => entry.game).filter((game) => game))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  editArmyDialogGame.innerHTML = `${games.length > 0 ? '<option value="">Select a game</option>' : '<option value="">No games in tracker yet</option>'}${games
    .map((game) => `<option value="${escapeHtml(game)}">${escapeHtml(game)}</option>`)
    .join("")}`;
  editArmyDialogGame.value = games.includes(army.game) ? army.game : "";
  editArmyDialog.showModal();
}

function buildUnitsTable(armyId, units) {
  const sortedUnits = [...units].sort((a, b) =>
    a.entry.unit.localeCompare(b.entry.unit, undefined, { sensitivity: "base" })
  );

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Faction</th><th>Unit</th>
            <th>Owned</th><th>In Army</th><th>Type</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${sortedUnits.map(({ assignment, entry, maxQuantity }) => `
            <tr>
              <td>${escapeHtml(entry.faction)}</td>
              <td>${escapeHtml(entry.unit)}</td>
              <td>${entry.number}</td>
              <td>${buildQuantityControl(armyId, entry.id, assignment.quantity, maxQuantity)}</td>
              <td>${escapeHtml(entry.type)}</td>
              <td><span class="badge s-${escapeHtml(entry.status)}">${escapeHtml(entry.status)}</span></td>
              <td>
                <div class="row-actions">
                  <button class="icon-btn delete" data-action="remove-unit" data-army-id="${armyId}" data-unit-id="${entry.id}" title="Remove" aria-label="Remove">&times;</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function buildQuantityControl(armyId, unitId, currentQuantity, maxQuantity) {
  if (maxQuantity <= 1) {
    return "1";
  }

  const options = Array.from({ length: maxQuantity }, (_, index) => index + 1)
    .map((count) => `<option value="${count}" ${count === currentQuantity ? "selected" : ""}>${count}</option>`)
    .join("");

  return `<select class="quantity-select" data-action="set-quantity" data-army-id="${armyId}" data-unit-id="${unitId}">${options}</select>`;
}

function deleteArmy(id) {
  const army = armies.find((item) => item.id === id);
  if (!army) {
    return;
  }
  const ask = typeof window.appConfirmDelete === "function"
    ? window.appConfirmDelete
    : (label) => window.confirm(`Delete ${label}?`);
  if (!ask(army.name || "army")) {
    return;
  }

  armies = armies.filter((army) => army.id !== id);
  expandedArmyIds.delete(id);
  persistArmies();
  render();
}

function toggleArmyCollapse(armyId) {
  if (expandedArmyIds.has(armyId)) {
    expandedArmyIds.delete(armyId);
  } else {
    expandedArmyIds.add(armyId);
  }
  render();
}

function addUnitToArmy(armyId, unitId) {
  const army = armies.find((item) => item.id === armyId);
  if (!army || army.assignments.some((assignment) => assignment.entryId === unitId)) {
    return;
  }

  army.assignments.push({ entryId: unitId, quantity: 1 });
  persistArmies();
  render();
}

function removeUnitFromArmy(armyId, unitId) {
  const army = armies.find((item) => item.id === armyId);
  if (!army) {
    return;
  }

  const entry = entries.find((item) => item.id === unitId);
  const ask = typeof window.appConfirmDelete === "function"
    ? window.appConfirmDelete
    : (label) => window.confirm(`Delete ${label}?`);
  if (!ask(entry && entry.unit ? entry.unit : "unit")) {
    return;
  }

  army.assignments = army.assignments.filter((assignment) => assignment.entryId !== unitId);
  persistArmies();
  render();
}

function setAssignmentQuantity(armyId, unitId, quantity) {
  const army = armies.find((item) => item.id === armyId);
  const entry = entries.find((item) => item.id === unitId);
  if (!army || !entry || !Number.isInteger(quantity)) {
    return;
  }

  const assignment = army.assignments.find((item) => item.entryId === unitId);
  if (!assignment) {
    return;
  }

  assignment.quantity = Math.min(Math.max(quantity, 1), entry.number);
  persistArmies();
  render();
}

function loadArmies() {
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

function loadEntries() {
  const stored = selectBestStoredArray(
    [ENTRIES_KEY, LEGACY_ENTRIES_KEY, ENTRY_BACKUP_KEY],
    normalizeEntry
  );
  return stored ? stored.entries : [];
}

function persistArmies() {
  persistStoredArray(ARMIES_KEY, ARMY_BACKUP_KEY, armies);
}

function normalizeArmy(army) {
  if (!army || typeof army !== "object") {
    return null;
  }

  const assignments = normalizeAssignments(army);
  const normalized = {
    id: typeof army.id === "string" && army.id.trim() ? army.id : createId(),
    game: String(army.game || "").trim(),
    name: String(army.name || "").trim(),
    assignments
  };

  return normalized.name ? normalized : null;
}

function normalizeAssignments(army) {
  if (Array.isArray(army.assignments)) {
    return army.assignments
      .map(normalizeAssignment)
      .filter((assignment) => assignment !== null);
  }

  if (Array.isArray(army.unitIds)) {
    return [...new Set(army.unitIds.filter((id) => typeof id === "string" && id.trim().length > 0))]
      .map((entryId) => ({ entryId, quantity: 1 }));
  }

  return [];
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
    // Ignore storage quota errors.
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

function populateArmyGameOptions() {
  if (!(armyGameSelect instanceof HTMLSelectElement)) {
    return;
  }

  const previous = armyGameSelect.value;
  const games = [...new Set(entries.map((entry) => entry.game).filter((game) => game))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const placeholder = games.length > 0
    ? '<option value="">Select a game</option>'
    : '<option value="">No games in tracker yet</option>';

  armyGameSelect.innerHTML = `${placeholder}${games
    .map((game) => `<option value="${escapeHtml(game)}">${escapeHtml(game)}</option>`)
    .join("")}`;

  if (games.includes(previous)) {
    armyGameSelect.value = previous;
  } else {
    armyGameSelect.value = "";
  }
}

function sameText(left, right) {
  return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
