const SCENARIOS_KEY = "mini-tracker-scenarios-v1";
const SCENARIO_BACKUP_KEY = "mini-tracker-scenarios-backup-v1";
const ENTRIES_KEY = "mini-tracker-entries-v1";
const LEGACY_ENTRIES_KEY = "mini-tracker-entries";
const ENTRY_BACKUP_KEY = "mini-tracker-entries-backup-v1";
const STATUS_VALUES = ["Unpainted", "Primed", "Painted", "Based", "Completed"];

const createScenarioForm = document.getElementById("create-scenario-form");
const scenariosList = document.getElementById("scenarios-list");
const scenarioGameSelect = document.getElementById("scenario-game");

let scenarios = loadScenarios();
let entries = loadEntries();
let openPickerRequirementId = null;
let editingRequirementId = null;
let editingScenarioId = null;
const expandedScenarioIds = new Set();

populateScenarioGameOptions();
render();

createScenarioForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const game = String(document.getElementById("scenario-game").value || "").trim();
  const name = String(document.getElementById("scenario-name").value || "").trim();
  if (!game || !name) {
    return;
  }

  scenarios.unshift({ id: createId(), game, name, requirements: [] });
  persistScenarios();
  render();
  createScenarioForm.reset();
  populateScenarioGameOptions();
});

scenariosList.addEventListener("submit", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) {
    return;
  }

  if (!target.matches(".requirement-form")) {
    return;
  }

  event.preventDefault();
  addRequirement(target);
});

scenariosList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const scenarioId = target.dataset.scenarioId;
  const requirementId = target.dataset.requirementId;
  const unitId = target.dataset.unitId;

  if (target.dataset.action === "delete-scenario" && scenarioId) {
    deleteScenario(scenarioId);
  } else if (target.dataset.action === "toggle-scenario-collapse" && scenarioId) {
    toggleScenarioCollapse(scenarioId);
  } else if (target.dataset.action === "edit-scenario" && scenarioId) {
    editingScenarioId = scenarioId;
    expandedScenarioIds.add(scenarioId);
    openPickerRequirementId = null;
    render();
  } else if (target.dataset.action === "cancel-edit-scenario" && scenarioId) {
    editingScenarioId = null;
    render();
  } else if (target.dataset.action === "save-scenario" && scenarioId) {
    saveScenario(scenarioId);
  } else if (target.dataset.action === "delete-requirement" && scenarioId && requirementId) {
    deleteRequirement(scenarioId, requirementId);
  } else if (target.dataset.action === "edit-requirement" && requirementId) {
    editingRequirementId = requirementId;
    openPickerRequirementId = null;
    render();
  } else if (target.dataset.action === "cancel-edit" && requirementId) {
    editingRequirementId = null;
    render();
  } else if (target.dataset.action === "save-requirement" && scenarioId && requirementId) {
    saveRequirementEdit(scenarioId, requirementId);
  } else if (target.dataset.action === "toggle-picker" && requirementId) {
    openPickerRequirementId = openPickerRequirementId === requirementId ? null : requirementId;
    render();
  } else if (target.dataset.action === "assign-selected" && scenarioId && requirementId) {
    assignSelectedUnit(scenarioId, requirementId);
  } else if (target.dataset.action === "assign-unit" && scenarioId && requirementId && unitId) {
    assignUnit(scenarioId, requirementId, unitId);
  } else if (target.dataset.action === "remove-assignment" && scenarioId && requirementId && unitId) {
    removeAssignment(scenarioId, requirementId, unitId);
  }
});

scenariosList.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }

  if (target.dataset.action !== "set-assignment-quantity") {
    return;
  }

  const scenarioId = target.dataset.scenarioId;
  const requirementId = target.dataset.requirementId;
  const unitId = target.dataset.unitId;
  if (!scenarioId || !requirementId || !unitId) {
    return;
  }

  setAssignmentQuantity(scenarioId, requirementId, unitId, Number(target.value));
});

function render() {
  entries = loadEntries();
  scenarios = loadScenarios();
  populateScenarioGameOptions();
  scenariosList.innerHTML = "";

  if (scenarios.length === 0) {
    scenariosList.innerHTML = '<p class="empty-msg">No scenarios yet. Create one above.</p>';
    return;
  }

  for (const scenario of scenarios) {
    const card = document.createElement("section");
    card.className = "panel scenario-card";

    const isEditingScenario = editingScenarioId === scenario.id;
    const isExpanded = expandedScenarioIds.has(scenario.id) || isEditingScenario;
    const headerName = isEditingScenario
      ? `
          <div class="entity-title-row">
            <button
              class="collapse-arrow"
              type="button"
              data-action="toggle-scenario-collapse"
              data-scenario-id="${scenario.id}"
              aria-expanded="true"
              aria-label="Collapse scenario ${escapeHtml(scenario.name)}"
            >
              <span aria-hidden="true">▾</span>
            </button>
            <input class="inline-input" id="edit-scenario-name-${scenario.id}" value="${escapeHtml(scenario.name)}" />
          </div>
        `
      : `
          <div class="entity-title-row">
            <button
              class="collapse-arrow"
              type="button"
              data-action="toggle-scenario-collapse"
              data-scenario-id="${scenario.id}"
              aria-expanded="${isExpanded ? "true" : "false"}"
              aria-label="${isExpanded ? "Collapse" : "Expand"} scenario ${escapeHtml(scenario.name)}"
            >
              <span aria-hidden="true">${isExpanded ? "▾" : "▸"}</span>
            </button>
            <span>${escapeHtml(scenario.name)}</span>
            <span class="requirement-inline">${escapeHtml(scenario.game || "")}</span>
          </div>
        `;
    const headerActions = isEditingScenario
      ? `
          <button class="icon-btn save" data-action="save-scenario" data-scenario-id="${scenario.id}" title="Save" aria-label="Save">&#10003;</button>
          <button class="icon-btn cancel" data-action="cancel-edit-scenario" data-scenario-id="${scenario.id}" title="Cancel" aria-label="Cancel">&times;</button>
          <button class="icon-btn delete" data-action="delete-scenario" data-scenario-id="${scenario.id}" title="Delete Scenario" aria-label="Delete Scenario">&times;</button>
        `
      : `
          <button class="icon-btn" data-action="edit-scenario" data-scenario-id="${scenario.id}" title="Edit" aria-label="Edit">&#9998;</button>
          <button class="icon-btn delete" data-action="delete-scenario" data-scenario-id="${scenario.id}" title="Delete Scenario" aria-label="Delete Scenario">&times;</button>
        `;

    card.innerHTML = `
      <div class="scenario-header">
        <h3 class="scenario-name">${headerName}</h3>
        <div class="row-actions">
          ${headerActions}
        </div>
      </div>
      <div class="collapsible-body" ${isExpanded ? "" : "hidden"}>
        ${isEditingScenario ? `
          <form class="requirement-form" data-scenario-id="${scenario.id}">
            <label>
              Faction
              <input name="faction" required />
            </label>
            <label>
              Unit
              <input name="unit" required />
            </label>
            <label>
              Type
              <input name="type" required />
            </label>
            <label>
              Needed
              <input name="requiredCount" type="number" min="1" value="1" required />
            </label>
            <button type="submit" title="Add Requirement">+</button>
          </form>
        ` : ""}
        ${buildRequirementsTable(scenario)}
      </div>
    `;

    scenariosList.appendChild(card);
  }
}

function buildRequirementsTable(scenario) {
  if (scenario.requirements.length === 0) {
    return '<p class="empty-msg">No requirements yet. Add one above.</p>';
  }

  return `
    <div class="table-wrap">
      <table class="scenario-requirements-table">
        <thead>
          <tr>
            <th>Requirement</th>
            <th>Needed</th>
            <th>Assigned</th>
            <th>Coverage</th>
            <th>Assigned Minis</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${scenario.requirements.map((requirement) => buildRequirementRow(scenario, requirement)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function buildRequirementRow(scenario, requirement) {
  if (editingRequirementId === requirement.id) {
    return buildRequirementEditRow(scenario, requirement);
  }

  const assignedTotal = getAssignedTotal(requirement);
  const shortfall = Math.max(requirement.requiredCount - assignedTotal, 0);
  const open = openPickerRequirementId === requirement.id;

  return `
    <tr>
      <td>
        <div class="requirement-summary">
          <span class="requirement-title">${escapeHtml(requirement.unit)}</span>
          <span class="requirement-inline">${escapeHtml(requirement.faction)} / ${escapeHtml(requirement.type)}</span>
        </div>
      </td>
      <td>${requirement.requiredCount}</td>
      <td>${assignedTotal}</td>
      <td>${shortfall === 0 ? '<span class="fit-badge fit-exact">Covered</span>' : `<span class="fit-badge fit-short">Short ${shortfall}</span>`}</td>
      <td class="assignment-list">${buildAssignmentList(scenario, requirement)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-action="edit-requirement" data-requirement-id="${requirement.id}" title="Edit" aria-label="Edit">&#9998;</button>
          <button data-action="toggle-picker" data-requirement-id="${requirement.id}">${open ? "Close" : "Assign"}</button>
          <button class="icon-btn delete" data-action="delete-requirement" data-scenario-id="${scenario.id}" data-requirement-id="${requirement.id}" title="Delete" aria-label="Delete">&times;</button>
        </div>
      </td>
    </tr>
    ${open ? `<tr class="requirement-picker-expand"><td colspan="6">${buildRequirementPicker(scenario, requirement)}</td></tr>` : ""}
  `;
}

function buildRequirementEditRow(scenario, requirement) {
  const assignedTotal = getAssignedTotal(requirement);
  const shortfall = Math.max(requirement.requiredCount - assignedTotal, 0);

  return `
    <tr>
      <td>
        <div class="requirement-edit-grid">
          <input class="inline-input" id="edit-game-${requirement.id}" value="${escapeHtml(requirement.game)}" placeholder="Game" />
          <input class="inline-input" id="edit-faction-${requirement.id}" value="${escapeHtml(requirement.faction)}" placeholder="Faction" />
          <input class="inline-input" id="edit-unit-${requirement.id}" value="${escapeHtml(requirement.unit)}" placeholder="Unit" />
          <input class="inline-input" id="edit-type-${requirement.id}" value="${escapeHtml(requirement.type)}" placeholder="Type" />
        </div>
      </td>
      <td><input class="inline-input" id="edit-needed-${requirement.id}" type="number" min="1" value="${requirement.requiredCount}" /></td>
      <td>${assignedTotal}</td>
      <td>${shortfall === 0 ? '<span class="fit-badge fit-exact">Covered</span>' : `<span class="fit-badge fit-short">Short ${shortfall}</span>`}</td>
      <td class="assignment-list">${buildAssignmentList(scenario, requirement)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn save" data-action="save-requirement" data-scenario-id="${scenario.id}" data-requirement-id="${requirement.id}" title="Save" aria-label="Save">&#10003;</button>
          <button class="icon-btn cancel" data-action="cancel-edit" data-requirement-id="${requirement.id}" title="Cancel" aria-label="Cancel">&times;</button>
        </div>
      </td>
    </tr>
  `;
}

function buildAssignmentList(scenario, requirement) {
  if (requirement.assignments.length === 0) {
    return '<span class="armies-none">-</span>';
  }

  return requirement.assignments.map((assignment) => {
    const entry = entries.find((item) => item.id === assignment.entryId);
    if (!entry) {
      return "";
    }

    const maxQuantity = getAvailableForRequirement(scenario, requirement, entry.id);
    const options = Array.from({ length: maxQuantity }, (_, index) => index + 1)
      .map((count) => `<option value="${count}" ${count === assignment.quantity ? "selected" : ""}>${count}</option>`)
      .join("");

    return `
      <div class="assignment-row">
        <span class="assignment-unit">${escapeHtml(entry.unit)}</span>
        <select class="assignment-select" data-action="set-assignment-quantity" data-scenario-id="${scenario.id}" data-requirement-id="${requirement.id}" data-unit-id="${entry.id}">${options}</select>
        <button class="icon-btn delete" data-action="remove-assignment" data-scenario-id="${scenario.id}" data-requirement-id="${requirement.id}" data-unit-id="${entry.id}" title="Remove" aria-label="Remove">&times;</button>
      </div>
    `;
  }).join("");
}

function buildRequirementPicker(scenario, requirement) {
  if (entries.length === 0) {
    return '<p class="picker-empty">No tracked minis available yet.</p>';
  }

  const options = entries
    .map((entry) => {
      if (!sameText(requirement.game, entry.game)) {
        return null;
      }

      const available = getAvailableForRequirement(scenario, requirement, entry.id);
      const alreadyAssigned = requirement.assignments.some((assignment) => assignment.entryId === entry.id);
      if (available <= 0 || alreadyAssigned) {
        return null;
      }

      const fit = getFitLabel(requirement, entry);
      return {
        id: entry.id,
        unit: entry.unit,
        available,
        isClose: fit.label === "Close"
      };
    })
    .filter((item) => item !== null)
    .sort((a, b) => {
      if (a.isClose !== b.isClose) {
        return a.isClose ? -1 : 1;
      }

      return a.unit.localeCompare(b.unit, undefined, { sensitivity: "base" });
    })
    .map((item) => {
      return `<option value="${item.id}">${escapeHtml(item.unit)} (${item.available} available)</option>`;
    })
    .join("");

  if (!options) {
    return '<p class="picker-empty">No unassigned owned minis are available for this requirement.</p>';
  }

  return `
    <div class="requirement-picker">
      <p class="picker-label">Assign owned units</p>
      <div class="requirement-picker-row">
        <select id="picker-select-${requirement.id}" class="assignment-select">
          ${options}
        </select>
        <button data-action="assign-selected" data-scenario-id="${scenario.id}" data-requirement-id="${requirement.id}" title="Add Assignment">+</button>
      </div>
    </div>
  `;
}

function assignSelectedUnit(scenarioId, requirementId) {
  const select = document.getElementById(`picker-select-${requirementId}`);
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const unitId = select.value;
  if (!unitId) {
    return;
  }

  assignUnit(scenarioId, requirementId, unitId);
}

function addRequirement(form) {
  const scenarioId = form.dataset.scenarioId;
  const scenario = scenarios.find((item) => item.id === scenarioId);
  if (!scenario || editingScenarioId !== scenarioId) {
    return;
  }

  const formData = new FormData(form);
  const requirement = normalizeRequirement({
    id: createId(),
    game: String(scenario.game || "").trim(),
    faction: String(formData.get("faction") || "").trim(),
    unit: String(formData.get("unit") || "").trim(),
    type: String(formData.get("type") || "").trim(),
    requiredCount: Number(formData.get("requiredCount") || 0),
    assignments: []
  });

  if (!requirement) {
    return;
  }

  scenario.requirements.push(requirement);
  persistScenarios();
  render();
  form.reset();

  const countInput = form.elements.namedItem("requiredCount");
  if (countInput instanceof HTMLInputElement) {
    countInput.value = "1";
  }
}

function deleteScenario(scenarioId) {
  scenarios = scenarios.filter((scenario) => scenario.id !== scenarioId);
  expandedScenarioIds.delete(scenarioId);
  if (editingScenarioId === scenarioId) {
    editingScenarioId = null;
  }
  persistScenarios();
  render();
}

function saveScenario(scenarioId) {
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    return;
  }

  const input = document.getElementById(`edit-scenario-name-${scenarioId}`);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  const name = input.value.trim();
  if (!name) {
    return;
  }

  scenario.name = name;
  editingScenarioId = null;
  persistScenarios();
  render();
}

function toggleScenarioCollapse(scenarioId) {
  if (expandedScenarioIds.has(scenarioId)) {
    expandedScenarioIds.delete(scenarioId);
    if (editingScenarioId === scenarioId) {
      editingScenarioId = null;
    }

    const scenario = getScenario(scenarioId);
    if (scenario) {
      const requirementIds = new Set(scenario.requirements.map((requirement) => requirement.id));
      if (editingRequirementId && requirementIds.has(editingRequirementId)) {
        editingRequirementId = null;
      }
      if (openPickerRequirementId && requirementIds.has(openPickerRequirementId)) {
        openPickerRequirementId = null;
      }
    }
  } else {
    expandedScenarioIds.add(scenarioId);
  }

  render();
}

function deleteRequirement(scenarioId, requirementId) {
  const scenario = scenarios.find((item) => item.id === scenarioId);
  if (!scenario) {
    return;
  }

  scenario.requirements = scenario.requirements.filter((requirement) => requirement.id !== requirementId);
  if (openPickerRequirementId === requirementId) {
    openPickerRequirementId = null;
  }
  if (editingRequirementId === requirementId) {
    editingRequirementId = null;
  }
  persistScenarios();
  render();
}

function saveRequirementEdit(scenarioId, requirementId) {
  const requirement = getRequirement(scenarioId, requirementId);
  if (!requirement) {
    return;
  }

  const updated = normalizeRequirement({
    id: requirement.id,
    game: valueFromEditInput(`edit-game-${requirementId}`),
    faction: valueFromEditInput(`edit-faction-${requirementId}`),
    unit: valueFromEditInput(`edit-unit-${requirementId}`),
    type: valueFromEditInput(`edit-type-${requirementId}`),
    requiredCount: Number(valueFromEditInput(`edit-needed-${requirementId}`)),
    assignments: requirement.assignments
  });

  if (!updated) {
    return;
  }

  requirement.game = updated.game;
  requirement.faction = updated.faction;
  requirement.unit = updated.unit;
  requirement.type = updated.type;
  requirement.requiredCount = updated.requiredCount;
  editingRequirementId = null;
  persistScenarios();
  render();
}

function valueFromEditInput(id) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return "";
  }
  return input.value.trim();
}

function assignUnit(scenarioId, requirementId, unitId) {
  const requirement = getRequirement(scenarioId, requirementId);
  if (!requirement) {
    return;
  }

  if (requirement.assignments.some((assignment) => assignment.entryId === unitId)) {
    return;
  }

  if (getAvailableForRequirement(getScenario(scenarioId), requirement, unitId) <= 0) {
    return;
  }

  requirement.assignments.push({ entryId: unitId, quantity: 1 });
  persistScenarios();
  render();
}

function removeAssignment(scenarioId, requirementId, unitId) {
  const requirement = getRequirement(scenarioId, requirementId);
  if (!requirement) {
    return;
  }

  requirement.assignments = requirement.assignments.filter((assignment) => assignment.entryId !== unitId);
  persistScenarios();
  render();
}

function setAssignmentQuantity(scenarioId, requirementId, unitId, quantity) {
  const scenario = getScenario(scenarioId);
  const requirement = getRequirement(scenarioId, requirementId);
  if (!scenario || !requirement || !Number.isInteger(quantity)) {
    return;
  }

  const assignment = requirement.assignments.find((item) => item.entryId === unitId);
  if (!assignment) {
    return;
  }

  const maxQuantity = getAvailableForRequirement(scenario, requirement, unitId);
  assignment.quantity = Math.min(Math.max(quantity, 1), maxQuantity);
  persistScenarios();
  render();
}

function getScenario(scenarioId) {
  return scenarios.find((scenario) => scenario.id === scenarioId) || null;
}

function getRequirement(scenarioId, requirementId) {
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    return null;
  }

  return scenario.requirements.find((requirement) => requirement.id === requirementId) || null;
}

function getAssignedTotal(requirement) {
  return requirement.assignments.reduce((sum, assignment) => sum + assignment.quantity, 0);
}

function getAvailableForRequirement(scenario, requirement, unitId) {
  const entry = entries.find((item) => item.id === unitId);
  if (!entry) {
    return 0;
  }

  const assignedElsewhere = scenario.requirements
    .filter((item) => item.id !== requirement.id)
    .flatMap((item) => item.assignments)
    .filter((assignment) => assignment.entryId === unitId)
    .reduce((sum, assignment) => sum + assignment.quantity, 0);

  const currentAssignment = requirement.assignments.find((assignment) => assignment.entryId === unitId);
  const currentQuantity = currentAssignment ? currentAssignment.quantity : 0;

  return Math.max(entry.number - assignedElsewhere, currentQuantity || 0);
}

function getFitLabel(requirement, entry) {
  const gameMatch = sameText(requirement.game, entry.game);
  const factionMatch = sameText(requirement.faction, entry.faction);
  const unitMatch = sameText(requirement.unit, entry.unit);
  const typeMatch = sameText(requirement.type, entry.type);

  if (gameMatch && factionMatch && unitMatch && typeMatch) {
    return { className: "fit-exact", label: "Exact" };
  }

  if ((gameMatch && factionMatch && typeMatch) || (gameMatch && unitMatch)) {
    return { className: "fit-close", label: "Close" };
  }

  return { className: "fit-other", label: "Other" };
}

function sameText(left, right) {
  return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
}

function loadScenarios() {
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

function loadEntries() {
  const stored = selectBestStoredArray(
    [ENTRIES_KEY, LEGACY_ENTRIES_KEY, ENTRY_BACKUP_KEY],
    normalizeEntry
  );
  return stored ? stored.entries : [];
}

function persistScenarios() {
  persistStoredArray(SCENARIOS_KEY, SCENARIO_BACKUP_KEY, scenarios);
}

function normalizeScenario(scenario) {
  if (!scenario || typeof scenario !== "object") {
    return null;
  }

  const game = String(
    scenario.game ||
    (Array.isArray(scenario.requirements) && scenario.requirements.length > 0
      ? String(scenario.requirements[0].game || "")
      : "")
  ).trim();

  const normalized = {
    id: typeof scenario.id === "string" && scenario.id.trim() ? scenario.id : createId(),
    game,
    name: String(scenario.name || "").trim(),
    requirements: Array.isArray(scenario.requirements)
      ? scenario.requirements.map(normalizeRequirement).filter((item) => item !== null)
      : []
  };

  return normalized.name ? normalized : null;
}

function normalizeRequirement(requirement) {
  if (!requirement || typeof requirement !== "object") {
    return null;
  }

  const normalized = {
    id: typeof requirement.id === "string" && requirement.id.trim() ? requirement.id : createId(),
    game: String(requirement.game || "").trim(),
    faction: String(requirement.faction || "").trim(),
    unit: String(requirement.unit || "").trim(),
    type: String(requirement.type || "").trim(),
    requiredCount: Number(requirement.requiredCount || 0),
    assignments: Array.isArray(requirement.assignments)
      ? requirement.assignments.map(normalizeAssignment).filter((item) => item !== null)
      : []
  };

  return isValidRequirement(normalized) ? normalized : null;
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

function isValidRequirement(requirement) {
  return (
    typeof requirement.id === "string" &&
    requirement.game.length > 0 &&
    requirement.faction.length > 0 &&
    requirement.unit.length > 0 &&
    requirement.type.length > 0 &&
    Number.isInteger(requirement.requiredCount) &&
    requirement.requiredCount > 0
  );
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

function populateScenarioGameOptions() {
  if (!(scenarioGameSelect instanceof HTMLSelectElement)) {
    return;
  }

  const previous = scenarioGameSelect.value;
  const games = [...new Set(entries.map((entry) => entry.game).filter((game) => game))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  const placeholder = games.length > 0
    ? '<option value="">Select a game</option>'
    : '<option value="">No games in tracker yet</option>';

  scenarioGameSelect.innerHTML = `${placeholder}${games
    .map((game) => `<option value="${escapeHtml(game)}">${escapeHtml(game)}</option>`)
    .join("")}`;

  if (games.includes(previous)) {
    scenarioGameSelect.value = previous;
  } else {
    scenarioGameSelect.value = "";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
