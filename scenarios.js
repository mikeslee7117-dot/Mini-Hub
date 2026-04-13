const SCENARIOS_KEY = "mini-tracker-scenarios-v1";
const SCENARIO_BACKUP_KEY = "mini-tracker-scenarios-backup-v1";
const ENTRIES_KEY = "mini-tracker-entries-v1";
const LEGACY_ENTRIES_KEY = "mini-tracker-entries";
const ENTRY_BACKUP_KEY = "mini-tracker-entries-backup-v1";
const STATUS_VALUES = ["Unpainted", "Primed", "Painted", "Based", "Completed"];

const createScenarioForm = document.getElementById("create-scenario-form");
const scenariosList = document.getElementById("scenarios-list");
const scenarioGameSelect = document.getElementById("scenario-game");
const openCreateScenarioBtn = document.getElementById("open-create-scenario-btn");
const createScenarioDialog = document.getElementById("create-scenario-dialog");
const addRequirementDialog = document.getElementById("add-requirement-dialog");
const addRequirementForm = document.getElementById("add-requirement-form");
const requirementPickerDialog = document.getElementById("requirement-picker-dialog");
const requirementPickerSelect = document.getElementById("requirement-picker-select");
const requirementPickerQuantity = document.getElementById("requirement-picker-quantity");
const requirementPickerAddBtn = document.getElementById("requirement-picker-add-btn");
const editScenarioDialog = document.getElementById("edit-scenario-dialog");
const editScenarioDialogName = document.getElementById("edit-scenario-dialog-name");
const editScenarioDialogSaveBtn = document.getElementById("edit-scenario-dialog-save-btn");
const editRequirementDialog = document.getElementById("edit-requirement-dialog");
const editRequirementForm = document.getElementById("edit-requirement-form");

let scenarios = loadScenarios();
let entries = loadEntries();
const expandedScenarioIds = new Set();

populateScenarioGameOptions();
render();

if (openCreateScenarioBtn instanceof HTMLButtonElement) {
  openCreateScenarioBtn.addEventListener("click", () => {
    if (createScenarioDialog instanceof HTMLDialogElement) createScenarioDialog.showModal();
  });
}

if (addRequirementForm instanceof HTMLFormElement) {
  addRequirementForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const scenarioId = addRequirementDialog instanceof HTMLDialogElement ? addRequirementDialog.dataset.scenarioId : null;
    if (!scenarioId) return;
    const scenario = scenarios.find((s) => s.id === scenarioId);
    if (!scenario) return;
    const formData = new FormData(addRequirementForm);
    const requirement = normalizeRequirement({
      id: createId(),
      game: String(scenario.game || "").trim(),
      faction: String(formData.get("faction") || "").trim(),
      unit: String(formData.get("unit") || "").trim(),
      type: String(formData.get("type") || "").trim(),
      requiredCount: Number(formData.get("requiredCount") || 0),
      assignments: []
    });
    if (!requirement) return;
    scenario.requirements.push(requirement);
    persistScenarios();
    render();
    addRequirementForm.reset();
    const countInput = addRequirementForm.elements.namedItem("requiredCount");
    if (countInput instanceof HTMLInputElement) countInput.value = "1";
    if (addRequirementDialog instanceof HTMLDialogElement) addRequirementDialog.close();
    if (window.appToast) window.appToast("Requirement added");
  });
}

if (requirementPickerAddBtn instanceof HTMLButtonElement) {
  requirementPickerAddBtn.addEventListener("click", () => {
    if (!(requirementPickerDialog instanceof HTMLDialogElement)
      || !(requirementPickerSelect instanceof HTMLSelectElement)
      || !(requirementPickerQuantity instanceof HTMLSelectElement)) {
      return;
    }

    const scenarioId = requirementPickerDialog.dataset.scenarioId;
    const requirementId = requirementPickerDialog.dataset.requirementId;
    const unitId = requirementPickerSelect.value;
    const quantity = Number(requirementPickerQuantity.value || 1);
    if (!scenarioId || !requirementId || !unitId || !Number.isInteger(quantity) || quantity < 1) return;

    const mode = requirementPickerDialog.dataset.mode || "add";
    const originalUnitId = requirementPickerDialog.dataset.originalUnitId || "";
    if (mode === "edit" && originalUnitId) {
      updateAssignment(scenarioId, requirementId, originalUnitId, unitId, quantity);
    } else {
      assignUnit(scenarioId, requirementId, unitId, quantity);
    }

    requirementPickerDialog.dataset.mode = "add";
    requirementPickerDialog.dataset.originalUnitId = "";
    requirementPickerAddBtn.textContent = "Add";
    refreshRequirementPickerDialog(scenarioId, requirementId);
    if (window.appToast) window.appToast(mode === "edit" ? "Requirement saved" : "Assignment added");
  });
}

if (requirementPickerSelect instanceof HTMLSelectElement) {
  requirementPickerSelect.addEventListener("change", () => {
    if (!(requirementPickerDialog instanceof HTMLDialogElement)) {
      return;
    }

    const scenarioId = requirementPickerDialog.dataset.scenarioId;
    const requirementId = requirementPickerDialog.dataset.requirementId;
    if (!scenarioId || !requirementId) {
      return;
    }

    refreshRequirementQuantityOptions(scenarioId, requirementId);
  });
}

if (editScenarioDialogSaveBtn instanceof HTMLButtonElement) {
  editScenarioDialogSaveBtn.addEventListener("click", () => {
    if (!(editScenarioDialog instanceof HTMLDialogElement) || !(editScenarioDialogName instanceof HTMLInputElement)) return;
    const scenarioId = editScenarioDialog.dataset.scenarioId;
    if (!scenarioId) return;
    const name = editScenarioDialogName.value.trim();
    if (!name) return;
    const scenario = scenarios.find((s) => s.id === scenarioId);
    if (scenario) {
      scenario.name = name;
      persistScenarios();
      render();
    }
    editScenarioDialog.close();
    if (window.appToast) window.appToast("Scenario saved");
  });
}

if (editRequirementForm instanceof HTMLFormElement) {
  editRequirementForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!(editRequirementDialog instanceof HTMLDialogElement)) return;
    const scenarioId = editRequirementDialog.dataset.scenarioId;
    const requirementId = editRequirementDialog.dataset.requirementId;
    const requirement = getRequirement(scenarioId, requirementId);
    if (!requirement) return;
    const formData = new FormData(editRequirementForm);
    const updated = normalizeRequirement({
      id: requirement.id,
      game: requirement.game,
      faction: String(formData.get("faction") || "").trim(),
      unit: String(formData.get("unit") || "").trim(),
      type: String(formData.get("type") || "").trim(),
      requiredCount: Number(formData.get("requiredCount") || 0),
      assignments: requirement.assignments
    });
    if (!updated) return;
    requirement.faction = updated.faction;
    requirement.unit = updated.unit;
    requirement.type = updated.type;
    requirement.requiredCount = updated.requiredCount;
    persistScenarios();
    render();
    editRequirementDialog.close();
    if (window.appToast) window.appToast("Requirement saved");
  });
}

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
  if (createScenarioDialog instanceof HTMLDialogElement) createScenarioDialog.close();
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
    openEditScenarioDialog(scenarioId);
  } else if (target.dataset.action === "add-requirement" && scenarioId) {
    openAddRequirementDialog(scenarioId);
  } else if (target.dataset.action === "delete-requirement" && scenarioId && requirementId) {
    deleteRequirement(scenarioId, requirementId);
  } else if (target.dataset.action === "edit-requirement" && scenarioId && requirementId) {
    openEditRequirementDialog(scenarioId, requirementId);
  } else if (target.dataset.action === "open-picker" && scenarioId && requirementId) {
    openRequirementPickerDialog(scenarioId, requirementId);
  } else if (target.dataset.action === "edit-assignment" && scenarioId && requirementId && unitId) {
    openEditAssignmentDialog(scenarioId, requirementId, unitId);
  } else if (target.dataset.action === "remove-assignment" && scenarioId && requirementId && unitId) {
    removeAssignment(scenarioId, requirementId, unitId);
  }
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
    card.className = `panel scenario-card${isExpanded ? "" : " is-collapsed"}`;

    const isExpanded = expandedScenarioIds.has(scenario.id);

    card.innerHTML = `
      <div class="scenario-header">
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
        <div class="row-actions">
          <button class="icon-btn" data-action="edit-scenario" data-scenario-id="${scenario.id}" title="Edit" aria-label="Edit">&#9998;</button>
          <button class="icon-btn delete" data-action="delete-scenario" data-scenario-id="${scenario.id}" title="Delete Scenario" aria-label="Delete Scenario">&times;</button>
        </div>
      </div>
      <div class="collapsible-body" ${isExpanded ? "" : "hidden"}>
        <div class="section-toolbar">
          <h4>Requirements</h4>
          <button class="btn-small" data-action="add-requirement" data-scenario-id="${scenario.id}" title="Add Requirement">Add Requirement</button>
        </div>
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
  const assignedTotal = getAssignedTotal(requirement);
  const shortfall = Math.max(requirement.requiredCount - assignedTotal, 0);

  return `
    <tr>
      <td>
        <div class="requirement-summary">
          <span class="requirement-title">${escapeHtml(requirement.unit)}</span>
          <span class="requirement-inline">${assignedTotal}/${requirement.requiredCount}</span>
        </div>
        <div class="requirement-summary">
          <span class="requirement-inline">${escapeHtml(requirement.faction)} / ${escapeHtml(requirement.type)}</span>
        </div>
      </td>
      <td>${shortfall === 0 ? '<span class="fit-badge fit-exact">Covered</span>' : `<span class="fit-badge fit-short">Short ${shortfall}</span>`}</td>
      <td><div class="assignment-list">${buildAssignmentList(scenario, requirement)}</div></td>
      <td>
        <div class="row-actions">
          <button class="btn-small" data-action="open-picker" data-scenario-id="${scenario.id}" data-requirement-id="${requirement.id}">Assign</button>
          <button class="icon-btn" data-action="edit-requirement" data-scenario-id="${scenario.id}" data-requirement-id="${requirement.id}" title="Edit" aria-label="Edit">&#9998;</button>
          <button class="icon-btn delete" data-action="delete-requirement" data-scenario-id="${scenario.id}" data-requirement-id="${requirement.id}" title="Delete" aria-label="Delete">&times;</button>
        </div>
      </td>
    </tr>
  `;
}

function openEditScenarioDialog(scenarioId) {
  const scenario = getScenario(scenarioId);
  if (!scenario || !(editScenarioDialog instanceof HTMLDialogElement) || !(editScenarioDialogName instanceof HTMLInputElement)) {
    return;
  }
  editScenarioDialog.dataset.scenarioId = scenarioId;
  editScenarioDialogName.value = scenario.name;
  editScenarioDialog.showModal();
}

function openAddRequirementDialog(scenarioId) {
  if (!(addRequirementDialog instanceof HTMLDialogElement) || !(addRequirementForm instanceof HTMLFormElement)) {
    return;
  }
  addRequirementDialog.dataset.scenarioId = scenarioId;
  addRequirementForm.reset();
  const countInput = addRequirementForm.elements.namedItem("requiredCount");
  if (countInput instanceof HTMLInputElement) countInput.value = "1";
  addRequirementDialog.showModal();
}

function openEditRequirementDialog(scenarioId, requirementId) {
  const requirement = getRequirement(scenarioId, requirementId);
  if (!requirement || !(editRequirementDialog instanceof HTMLDialogElement) || !(editRequirementForm instanceof HTMLFormElement)) {
    return;
  }
  editRequirementDialog.dataset.scenarioId = scenarioId;
  editRequirementDialog.dataset.requirementId = requirementId;
  
  const factionInput = editRequirementForm.elements.namedItem("faction");
  const unitInput = editRequirementForm.elements.namedItem("unit");
  const typeInput = editRequirementForm.elements.namedItem("type");
  const countInput = editRequirementForm.elements.namedItem("requiredCount");
  
  if (factionInput instanceof HTMLInputElement) factionInput.value = requirement.faction;
  if (unitInput instanceof HTMLInputElement) unitInput.value = requirement.unit;
  if (typeInput instanceof HTMLInputElement) typeInput.value = requirement.type;
  if (countInput instanceof HTMLInputElement) countInput.value = String(requirement.requiredCount);
  
  editRequirementDialog.showModal();
}

function openRequirementPickerDialog(scenarioId, requirementId) {
  if (!(requirementPickerDialog instanceof HTMLDialogElement)
    || !(requirementPickerAddBtn instanceof HTMLButtonElement)) {
    return;
  }

  requirementPickerDialog.dataset.scenarioId = scenarioId;
  requirementPickerDialog.dataset.requirementId = requirementId;
  requirementPickerDialog.dataset.mode = "add";
  requirementPickerDialog.dataset.originalUnitId = "";
  requirementPickerAddBtn.textContent = "Add";
  refreshRequirementPickerDialog(scenarioId, requirementId);
  requirementPickerDialog.showModal();
}

function openEditAssignmentDialog(scenarioId, requirementId, unitId) {
  const requirement = getRequirement(scenarioId, requirementId);
  if (!(requirementPickerDialog instanceof HTMLDialogElement)
    || !(requirementPickerAddBtn instanceof HTMLButtonElement)
    || !requirement) {
    return;
  }

  const assignment = requirement.assignments.find((item) => item.entryId === unitId);
  if (!assignment) {
    return;
  }

  requirementPickerDialog.dataset.scenarioId = scenarioId;
  requirementPickerDialog.dataset.requirementId = requirementId;
  requirementPickerDialog.dataset.mode = "edit";
  requirementPickerDialog.dataset.originalUnitId = unitId;
  requirementPickerAddBtn.textContent = "Save";
  refreshRequirementPickerDialog(scenarioId, requirementId, {
    selectedUnitId: unitId,
    selectedQuantity: assignment.quantity
  });
  requirementPickerDialog.showModal();
}

function refreshRequirementPickerDialog(scenarioId, requirementId, pickerOptions = {}) {
  const scenario = getScenario(scenarioId);
  const requirement = getRequirement(scenarioId, requirementId);
  if (!scenario || !requirement
    || !(requirementPickerSelect instanceof HTMLSelectElement)
    || !(requirementPickerQuantity instanceof HTMLSelectElement)) {
    return;
  }

  if (entries.length === 0) {
    requirementPickerSelect.innerHTML = '<option disabled>No tracked minis available</option>';
    requirementPickerQuantity.innerHTML = '<option value="">-</option>';
    if (requirementPickerAddBtn instanceof HTMLButtonElement) {
      requirementPickerAddBtn.disabled = true;
    }
    return;
  }

  const units = entries
    .map((entry) => {
      if (!sameText(requirement.game, entry.game)) {
        return null;
      }

      const available = getAvailableForRequirement(scenario, requirement, entry.id);
      const alreadyAssigned = requirement.assignments.some((assignment) => assignment.entryId === entry.id);
      const isSelectedInEdit = pickerOptions.selectedUnitId === entry.id;
      if (available <= 0 || (alreadyAssigned && !isSelectedInEdit)) {
        return null;
      }

      const fit = getFitLabel(requirement, entry);
      return {
        id: entry.id,
        unit: entry.unit,
        type: entry.type,
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
    });

  if (units.length === 0) {
    requirementPickerSelect.innerHTML = '<option disabled>No unassigned units available</option>';
    requirementPickerQuantity.innerHTML = '<option value="">-</option>';
    if (requirementPickerAddBtn instanceof HTMLButtonElement) {
      requirementPickerAddBtn.disabled = true;
    }
    return;
  }

  requirementPickerSelect.innerHTML = units
    .map((item) => `<option value="${item.id}">${escapeHtml(item.unit)} (${item.available} available) - ${escapeHtml(item.type)}</option>`)
    .join("");

  const selectedUnitId = units.some((item) => item.id === pickerOptions.selectedUnitId)
    ? pickerOptions.selectedUnitId
    : requirementPickerSelect.value;
  requirementPickerSelect.value = selectedUnitId;

  refreshRequirementQuantityOptions(scenarioId, requirementId, pickerOptions.selectedQuantity);

  if (requirementPickerAddBtn instanceof HTMLButtonElement) {
    requirementPickerAddBtn.disabled = false;
  }
}

function refreshRequirementQuantityOptions(scenarioId, requirementId, preferredQuantity) {
  const scenario = getScenario(scenarioId);
  const requirement = getRequirement(scenarioId, requirementId);
  if (!scenario || !requirement
    || !(requirementPickerSelect instanceof HTMLSelectElement)
    || !(requirementPickerQuantity instanceof HTMLSelectElement)) {
    return;
  }

  const unitId = requirementPickerSelect.value;
  if (!unitId) {
    requirementPickerQuantity.innerHTML = '<option value="">-</option>';
    return;
  }

  const maxQuantity = getAvailableForRequirement(scenario, requirement, unitId);
  const options = Array.from({ length: Math.max(maxQuantity, 1) }, (_, index) => index + 1)
    .map((count) => `<option value="${count}">${count}</option>`)
    .join("");

  requirementPickerQuantity.innerHTML = options;
  const desired = Number.isInteger(preferredQuantity) ? preferredQuantity : 1;
  requirementPickerQuantity.value = String(Math.min(Math.max(desired, 1), Math.max(maxQuantity, 1)));
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

    return `
      <div class="assignment-row">
        <div>
          <span class="assignment-unit">${escapeHtml(entry.unit)} (${assignment.quantity})</span>
          <div class="requirement-inline">${escapeHtml(entry.type)}</div>
        </div>
        <button class="icon-btn" data-action="edit-assignment" data-scenario-id="${scenario.id}" data-requirement-id="${requirement.id}" data-unit-id="${entry.id}" title="Edit" aria-label="Edit">&#9998;</button>
        <button class="icon-btn delete" data-action="remove-assignment" data-scenario-id="${scenario.id}" data-requirement-id="${requirement.id}" data-unit-id="${entry.id}" title="Remove" aria-label="Remove">&times;</button>
      </div>
    `;
  }).join("");
}

function deleteScenario(scenarioId) {
  const scenario = getScenario(scenarioId);
  if (!scenario) {
    return;
  }
  const ask = typeof window.appConfirmDelete === "function"
    ? window.appConfirmDelete
    : (label) => window.confirm(`Delete ${label}?`);
  if (!ask(scenario.name || "scenario")) {
    return;
  }

  scenarios = scenarios.filter((scenario) => scenario.id !== scenarioId);
  expandedScenarioIds.delete(scenarioId);
  persistScenarios();
  render();
}

function toggleScenarioCollapse(scenarioId) {
  if (expandedScenarioIds.has(scenarioId)) {
    expandedScenarioIds.delete(scenarioId);
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

  const requirement = scenario.requirements.find((item) => item.id === requirementId);
  const ask = typeof window.appConfirmDelete === "function"
    ? window.appConfirmDelete
    : (label) => window.confirm(`Delete ${label}?`);
  if (!ask(requirement && requirement.unit ? requirement.unit : "requirement")) {
    return;
  }

  scenario.requirements = scenario.requirements.filter((requirement) => requirement.id !== requirementId);
  persistScenarios();
  render();
}

function assignUnit(scenarioId, requirementId, unitId, quantity = 1) {
  const requirement = getRequirement(scenarioId, requirementId);
  const scenario = getScenario(scenarioId);
  if (!requirement) {
    return;
  }

  if (requirement.assignments.some((assignment) => assignment.entryId === unitId)) {
    return;
  }

  const maxQuantity = getAvailableForRequirement(scenario, requirement, unitId);
  if (maxQuantity <= 0) {
    return;
  }

  requirement.assignments.push({
    entryId: unitId,
    quantity: Math.min(Math.max(Number(quantity) || 1, 1), maxQuantity)
  });
  persistScenarios();
  render();
}

function updateAssignment(scenarioId, requirementId, originalUnitId, nextUnitId, nextQuantity) {
  const scenario = getScenario(scenarioId);
  const requirement = getRequirement(scenarioId, requirementId);
  if (!scenario || !requirement) {
    return;
  }

  const assignment = requirement.assignments.find((item) => item.entryId === originalUnitId);
  if (!assignment) {
    return;
  }

  if (originalUnitId !== nextUnitId && requirement.assignments.some((item) => item.entryId === nextUnitId)) {
    return;
  }

  const maxQuantity = getAvailableForRequirement(scenario, requirement, nextUnitId);
  if (maxQuantity <= 0) {
    return;
  }

  assignment.entryId = nextUnitId;
  assignment.quantity = Math.min(Math.max(Number(nextQuantity) || 1, 1), maxQuantity);
  persistScenarios();
  render();
}

function removeAssignment(scenarioId, requirementId, unitId) {
  const requirement = getRequirement(scenarioId, requirementId);
  if (!requirement) {
    return;
  }

  const entry = entries.find((item) => item.id === unitId);
  const ask = typeof window.appConfirmDelete === "function"
    ? window.appConfirmDelete
    : (label) => window.confirm(`Delete ${label}?`);
  if (!ask(entry && entry.unit ? entry.unit : "assignment")) {
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
