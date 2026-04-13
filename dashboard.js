const STORAGE_KEY = "mini-tracker-entries-v1";
const LEGACY_STORAGE_KEY = "mini-tracker-entries";
const ARMIES_KEY = "mini-tracker-armies-v1";
const ARMY_BACKUP_KEY = "mini-tracker-armies-backup-v1";
const SCENARIOS_KEY = "mini-tracker-scenarios-v1";
const SCENARIO_BACKUP_KEY = "mini-tracker-scenarios-backup-v1";
const PAINTS_KEY = "mini-tracker-paints-v1";
const PAINTS_BACKUP_KEY = "mini-tracker-paints-backup-v1";
const PAINT_PLANS_KEY = "mini-tracker-paint-plans-v1";
const PAINT_PLANS_BACKUP_KEY = "mini-tracker-paint-plans-backup-v1";
const ENTRY_BACKUP_KEY = "mini-tracker-entries-backup-v1";
const STATUS_VALUES = ["Unpainted", "Primed", "Painted", "Based", "Completed"];

window.addEventListener("focus", renderDashboard);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    renderDashboard();
  }
});

renderDashboard();

function renderDashboard() {
  const entries = loadEntries();
  const armies = loadArmies();
  const scenarios = loadScenarios();
  const paints = loadPaints();
  const paintPlans = loadPaintPlans();

  const totalUnits = entries.length;
  const totalMinis = entries.reduce((sum, entry) => sum + entry.number, 0);
  const completedMinis = entries
    .filter((entry) => entry.status === "Completed")
    .reduce((sum, entry) => sum + entry.number, 0);
  const unpaintedMinis = entries
    .filter((entry) => entry.status === "Unpainted")
    .reduce((sum, entry) => sum + entry.number, 0);
  const activeWorkMinis = entries
    .filter((entry) => ["Primed", "Painted", "Based"].includes(entry.status))
    .reduce((sum, entry) => sum + entry.number, 0);
  const completionPct = percent(completedMinis, totalMinis);

  const armyMetrics = buildArmyMetrics(entries, armies);
  const scenarioMetrics = buildScenarioMetrics(entries, scenarios);
  const paintingMetrics = buildPaintingMetrics(entries, paints, paintPlans);
  const gameMetrics = buildGameMetrics(entries, armies, scenarios);
  const focusQueue = buildFocusQueue(entries, paintPlans);

  setText("metric-total-minis", totalMinis);
  setText("metric-completion", `${completionPct}%`);
  setText("metric-armies", armies.length);
  setText("metric-scenario-coverage", `${scenarioMetrics.coveragePct}%`);
  setText("metric-paints", paints.length);
  setText("metric-units", totalUnits);

  setText("metric-paints-owned", paintingMetrics.paintsOwned);
  setText("metric-planned-units", paintingMetrics.plannedUnits);
  setText("metric-most-used-paint", paintingMetrics.mostUsedPaint);
  setText("metric-paint-plan-pct", `${paintingMetrics.planCoveragePct}%`);

  renderStatusBreakdown({ unpaintedMinis, activeWorkMinis, completedMinis }, totalMinis);
  renderGameBreakdown(gameMetrics);
  renderArmyBreakdown(armyMetrics.armies);
  renderScenarioBreakdown(scenarioMetrics.scenarios);
  renderPaintingBreakdown(paintingMetrics);
  renderFocusQueue(focusQueue);
}

function buildArmyMetrics(entries, armies) {
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const metrics = armies.map((army) => {
    const minis = army.assignments.reduce((sum, assignment) => sum + assignment.quantity, 0);
    const unitCount = army.assignments.length;
    const completed = army.assignments.reduce((sum, assignment) => {
      const entry = entryMap.get(assignment.entryId);
      if (!entry || entry.status !== "Completed") {
        return sum;
      }
      return sum + assignment.quantity;
    }, 0);

    return {
      name: army.name,
      game: army.game,
      unitCount,
      minis,
      completionPct: percent(completed, minis)
    };
  }).sort((left, right) => right.minis - left.minis || compareText(left.name, right.name));

  const assignedMinis = metrics.reduce((sum, army) => sum + army.minis, 0);
  const largestArmySize = metrics.length > 0 ? metrics[0].minis : 0;
  const averageArmySize = metrics.length > 0 ? Math.round(assignedMinis / metrics.length) : 0;

  return {
    armies: metrics,
    assignedMinis,
    largestArmySize,
    averageArmySize
  };
}

function buildScenarioMetrics(entries, scenarios) {
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const scenarioItems = scenarios.map((scenario) => {
    const totalRequirements = scenario.requirements.length;
    const coveredRequirements = scenario.requirements.filter((requirement) => {
      return getAssignedTotal(requirement) >= requirement.requiredCount;
    }).length;
    const shortfallMinis = scenario.requirements.reduce((sum, requirement) => {
      return sum + Math.max(requirement.requiredCount - getAssignedTotal(requirement), 0);
    }, 0);
    const assignedMinis = scenario.requirements.reduce((sum, requirement) => {
      return sum + requirement.assignments.reduce((assignmentSum, assignment) => assignmentSum + assignment.quantity, 0);
    }, 0);
    const exactMatches = scenario.requirements.reduce((sum, requirement) => {
      return sum + requirement.assignments.reduce((assignmentSum, assignment) => {
        const entry = entryMap.get(assignment.entryId);
        if (!entry) {
          return assignmentSum;
        }
        const exact = sameText(requirement.game, entry.game)
          && sameText(requirement.faction, entry.faction)
          && sameText(requirement.unit, entry.unit)
          && sameText(requirement.type, entry.type);
        return assignmentSum + (exact ? assignment.quantity : 0);
      }, 0);
    }, 0);

    return {
      name: scenario.name,
      game: scenario.game,
      totalRequirements,
      coveredRequirements,
      shortfallMinis,
      assignedMinis,
      exactMatches
    };
  }).sort((left, right) => right.totalRequirements - left.totalRequirements || compareText(left.name, right.name));

  const totalRequirements = scenarioItems.reduce((sum, scenario) => sum + scenario.totalRequirements, 0);
  const coveredRequirements = scenarioItems.reduce((sum, scenario) => sum + scenario.coveredRequirements, 0);
  const shortfallMinis = scenarioItems.reduce((sum, scenario) => sum + scenario.shortfallMinis, 0);

  return {
    scenarios: scenarioItems,
    totalRequirements,
    coveredRequirements,
    shortfallMinis,
    coveragePct: percent(coveredRequirements, totalRequirements)
  };
}

function buildPaintingMetrics(entries, paints, paintPlans) {
  const paintUsage = new Map();

  const plansWithEntries = paintPlans
    .map((plan) => {
      const entry = entries.find((item) => item.id === plan.entryId);
      if (!entry) {
        return null;
      }

      return {
        unit: entry.unit,
        game: entry.game,
        faction: entry.faction,
        assignmentCount: plan.assignments.length
      };
    })
    .filter((plan) => plan !== null)
    .sort((left, right) => right.assignmentCount - left.assignmentCount || compareText(left.unit, right.unit));

  for (const plan of paintPlans) {
    for (const assignment of plan.assignments) {
      paintUsage.set(assignment.paintId, (paintUsage.get(assignment.paintId) || 0) + 1);
    }
  }

  const mostUsedPaint = [...paintUsage.entries()]
    .map(([paintId, uses]) => {
      const paint = paints.find((item) => item.id === paintId);
      if (!paint) {
        return null;
      }
      return { name: paint.name, uses };
    })
    .filter((item) => item !== null)
    .sort((left, right) => right.uses - left.uses || compareText(left.name, right.name))[0];

  const brands = new Set(paints.map((paint) => paint.brand.trim()).filter(Boolean));
  const brandBreakdown = Array.from(brands).map((brand) => {
    const count = paints.filter((paint) => sameText(paint.brand, brand)).length;
    return { brand, count };
  }).sort((left, right) => right.count - left.count || compareText(left.brand, right.brand));

  return {
    paintsOwned: paints.length,
    plannedUnits: plansWithEntries.length,
    assignmentCount: paintPlans.reduce((sum, plan) => sum + plan.assignments.length, 0),
    brandCount: brands.size,
    mostUsedPaint: mostUsedPaint ? `${mostUsedPaint.name} (${mostUsedPaint.uses})` : "None",
    planCoveragePct: percent(plansWithEntries.length, entries.length),
    plans: plansWithEntries,
    brands: brandBreakdown
  };
}

function buildGameMetrics(entries, armies, scenarios) {
  const grouped = new Map();

  for (const entry of entries) {
    const key = entry.game;
    const item = getOrCreateGameMetric(grouped, key);
    item.units += 1;
    item.minis += entry.number;
    if (entry.status === "Completed") {
      item.completed += entry.number;
    }
  }

  for (const army of armies) {
    const item = getOrCreateGameMetric(grouped, army.game);
    item.armies += 1;
  }

  for (const scenario of scenarios) {
    const item = getOrCreateGameMetric(grouped, scenario.game);
    item.scenarios += 1;
  }

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      completionPct: percent(item.completed, item.minis)
    }))
    .sort((left, right) => right.minis - left.minis || right.armies - left.armies || compareText(left.game, right.game));
}

function getOrCreateGameMetric(grouped, game) {
  const key = String(game || "Unassigned").trim() || "Unassigned";
  if (!grouped.has(key)) {
    grouped.set(key, {
      game: key,
      units: 0,
      minis: 0,
      completed: 0,
      armies: 0,
      scenarios: 0
    });
  }
  return grouped.get(key);
}

function buildFocusQueue(entries, paintPlans) {
  const planMap = new Map(paintPlans.map((plan) => [plan.entryId, plan]));
  return [...entries]
    .filter((entry) => entry.status !== "Completed")
    .map((entry) => {
      const plan = planMap.get(entry.id);
      const stageIndex = STATUS_VALUES.indexOf(entry.status);
      return {
        unit: entry.unit,
        game: entry.game,
        faction: entry.faction,
        status: entry.status,
        minis: entry.number,
        stageIndex,
        paintAssignments: plan ? plan.assignments.length : 0
      };
    })
    .sort((left, right) => left.stageIndex - right.stageIndex || right.minis - left.minis || left.paintAssignments - right.paintAssignments || compareText(left.unit, right.unit))
    .slice(0, 3);
}

function renderStatusBreakdown(statusTotals, totalMinis) {
  const root = document.getElementById("status-breakdown");
  if (!(root instanceof HTMLElement)) {
    return;
  }

  const statusRows = [
    { label: "Unpainted", count: statusTotals.unpaintedMinis || 0 },
    { label: "In Progress", count: statusTotals.activeWorkMinis || 0 },
    { label: "Completed", count: statusTotals.completedMinis || 0 }
  ];

  root.innerHTML = statusRows.map((status) => {
    const count = status.count;
    const width = totalMinis > 0 ? Math.max((count / totalMinis) * 100, count > 0 ? 4 : 0) : 0;
    return `
      <article class="dashboard-status-row">
        <div class="dashboard-item-top">
          <span class="dashboard-item-name">${escapeHtml(status.label)}</span>
          <span class="dashboard-item-pill">${count} minis</span>
        </div>
        <div class="dashboard-meter"><div class="dashboard-meter-fill" style="width: ${width}%"></div></div>
      </article>
    `;
  }).join("");
}

function renderGameBreakdown(items) {
  const root = document.getElementById("games-breakdown");
  if (!(root instanceof HTMLElement)) {
    return;
  }

  if (items.length === 0) {
    root.innerHTML = '<p class="dashboard-empty">No tracked games yet.</p>';
    return;
  }

  root.innerHTML = items.slice(0, 5).map((item) => {
    return `
      <article class="dashboard-list-item">
        <div class="dashboard-item-top">
          <span class="dashboard-item-name">${escapeHtml(item.game)}</span>
          <span class="dashboard-item-pill">${item.completionPct}% complete</span>
        </div>
        <div class="dashboard-item-meta">${item.minis} minis across ${item.units} unit entries</div>
        <div class="dashboard-item-note">${item.armies} armies and ${item.scenarios} scenarios linked to this game</div>
        <div class="dashboard-meter"><div class="dashboard-meter-fill" style="width: ${Math.max(item.completionPct, item.minis > 0 ? 4 : 0)}%"></div></div>
      </article>
    `;
  }).join("");
}

function renderArmyBreakdown(items) {
  const root = document.getElementById("army-breakdown");
  if (!(root instanceof HTMLElement)) {
    return;
  }

  if (items.length === 0) {
    root.innerHTML = '<p class="dashboard-empty">No armies created yet.</p>';
    return;
  }

  const leastCovered = [...items].sort((left, right) =>
    left.completionPct - right.completionPct || right.minis - left.minis || compareText(left.name, right.name)
  );

  root.innerHTML = leastCovered.slice(0, 3).map((item) => {
    return `
      <article class="dashboard-list-item">
        <div class="dashboard-item-top">
          <span class="dashboard-item-name">${escapeHtml(item.name)}</span>
          <span class="dashboard-item-pill">${item.completionPct}% covered</span>
        </div>
        <div class="dashboard-item-meta">${escapeHtml(item.game || "Unassigned game")} · ${item.unitCount} units assigned</div>
        <div class="dashboard-item-note">${item.minis} minis assigned</div>
        <div class="dashboard-meter"><div class="dashboard-meter-fill" style="width: ${Math.max(item.completionPct, item.minis > 0 ? 4 : 0)}%"></div></div>
      </article>
    `;
  }).join("");
}

function renderScenarioBreakdown(items) {
  const root = document.getElementById("scenario-breakdown");
  if (!(root instanceof HTMLElement)) {
    return;
  }

  if (items.length === 0) {
    root.innerHTML = '<p class="dashboard-empty">No scenarios created yet.</p>';
    return;
  }

  const leastCovered = [...items].sort((left, right) => {
    const leftCoverage = percent(left.coveredRequirements, left.totalRequirements);
    const rightCoverage = percent(right.coveredRequirements, right.totalRequirements);
    return leftCoverage - rightCoverage || right.totalRequirements - left.totalRequirements || compareText(left.name, right.name);
  });

  root.innerHTML = leastCovered.slice(0, 3).map((item) => {
    const coveragePct = percent(item.coveredRequirements, item.totalRequirements);
    return `
      <article class="dashboard-list-item">
        <div class="dashboard-item-top">
          <span class="dashboard-item-name">${escapeHtml(item.name)}</span>
          <span class="dashboard-item-pill">${coveragePct}% covered</span>
        </div>
        <div class="dashboard-item-meta">${escapeHtml(item.game || "Unassigned game")} · ${item.coveredRequirements}/${item.totalRequirements} requirements covered</div>
        <div class="dashboard-item-note">${item.shortfallMinis} minis shortfall, ${item.assignedMinis} minis assigned</div>
        <div class="dashboard-meter"><div class="dashboard-meter-fill" style="width: ${Math.max(coveragePct, item.totalRequirements > 0 ? 4 : 0)}%"></div></div>
      </article>
    `;
  }).join("");
}

function renderPaintingBreakdown(metrics) {
  const root = document.getElementById("painting-breakdown");
  if (!(root instanceof HTMLElement)) {
    return;
  }

  if (metrics.plans.length === 0 && metrics.brands.length === 0) {
    root.innerHTML = '<p class="dashboard-empty">No painting data yet.</p>';
    return;
  }

  const planCards = metrics.plans.slice(0, 3).map((plan) => {
    return `
      <article class="dashboard-list-item">
        <div class="dashboard-item-top">
          <span class="dashboard-item-name">${escapeHtml(plan.unit)}</span>
          <span class="dashboard-item-pill">${plan.assignmentCount} paints</span>
        </div>
        <div class="dashboard-item-meta">${escapeHtml(plan.game)} / ${escapeHtml(plan.faction)}</div>
      </article>
    `;
  }).join("");

  const brandCards = metrics.brands.slice(0, 2).map((brand) => {
    return `
      <article class="dashboard-list-item">
        <div class="dashboard-item-top">
          <span class="dashboard-item-name">${escapeHtml(brand.brand)}</span>
          <span class="dashboard-item-pill">${brand.count} paints</span>
        </div>
        <div class="dashboard-item-note">${metrics.planCoveragePct}% of tracked units have paint plans</div>
      </article>
    `;
  }).join("");

  root.innerHTML = `${planCards}${brandCards}` || '<p class="dashboard-empty">No painting data yet.</p>';
}

function renderFocusQueue(items) {
  const root = document.getElementById("focus-queue");
  if (!(root instanceof HTMLElement)) {
    return;
  }

  if (items.length === 0) {
    root.innerHTML = '<p class="dashboard-empty">All tracked units are completed.</p>';
    return;
  }

  root.innerHTML = items.map((item) => {
    return `
      <article class="dashboard-focus-item">
        <div class="dashboard-focus-top">
          <span class="dashboard-focus-name">${escapeHtml(item.unit)}</span>
          <span class="badge s-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span>
        </div>
        <div class="dashboard-focus-meta">${escapeHtml(item.game)} / ${escapeHtml(item.faction)} · ${item.minis} minis</div>
        <div class="dashboard-item-note">${item.paintAssignments > 0 ? `${item.paintAssignments} paint assignments ready` : "No paint assignments planned yet"}</div>
      </article>
    `;
  }).join("");
}

function getAssignedTotal(requirement) {
  return requirement.assignments.reduce((sum, assignment) => sum + assignment.quantity, 0);
}

function percent(value, total) {
  if (!total) {
    return 0;
  }
  return Math.round((value / total) * 100);
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = String(value);
  }
}

function sameText(left, right) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), undefined, { sensitivity: "base" });
}

function loadEntries() {
  const stored = selectBestStoredArray([STORAGE_KEY, LEGACY_STORAGE_KEY, ENTRY_BACKUP_KEY], normalizeEntry);
  return stored ? stored.entries : [];
}

function loadArmies() {
  const stored = selectBestStoredArray([ARMIES_KEY, ARMY_BACKUP_KEY], normalizeArmy);
  return stored ? stored.entries : [];
}

function loadScenarios() {
  const stored = selectBestStoredArray([SCENARIOS_KEY, SCENARIO_BACKUP_KEY], normalizeScenario);
  return stored ? stored.entries : [];
}

function loadPaints() {
  const stored = selectBestStoredArray([PAINTS_KEY, PAINTS_BACKUP_KEY], normalizePaint);
  return stored ? stored.entries : [];
}

function loadPaintPlans() {
  const stored = selectBestStoredArray([PAINT_PLANS_KEY, PAINT_PLANS_BACKUP_KEY], normalizePaintPlan);
  return stored ? stored.entries : [];
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
    status: STATUS_VALUES.includes(String(entry.status || "")) ? String(entry.status) : "Unpainted"
  };

  return isValidEntry(normalized) ? normalized : null;
}

function normalizeArmy(army) {
  if (!army || typeof army !== "object") {
    return null;
  }

  const assignments = Array.isArray(army.assignments)
    ? army.assignments.map(normalizeAssignment).filter((assignment) => assignment !== null)
    : Array.isArray(army.unitIds)
      ? [...new Set(army.unitIds.filter((id) => typeof id === "string" && id.trim()))]
          .map((entryId) => ({ entryId, quantity: 1 }))
      : [];

  const normalized = {
    id: typeof army.id === "string" && army.id.trim() ? army.id : createId(),
    game: String(army.game || "").trim(),
    name: String(army.name || "").trim(),
    assignments
  };

  return normalized.name ? normalized : null;
}

function normalizeScenario(scenario) {
  if (!scenario || typeof scenario !== "object") {
    return null;
  }

  const game = String(
    scenario.game
    || (Array.isArray(scenario.requirements) && scenario.requirements.length > 0
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

  return normalized.name && normalized.type && normalized.brand ? normalized : null;
}

function normalizePaintPlan(plan) {
  if (!plan || typeof plan !== "object") {
    return null;
  }

  const entryId = typeof plan.entryId === "string" && plan.entryId.trim() ? plan.entryId : null;
  if (!entryId) {
    return null;
  }

  const assignments = Array.isArray(plan.assignments)
    ? plan.assignments.map(normalizePaintAssignment).filter((assignment) => assignment !== null)
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

  const paintId = typeof assignment.paintId === "string" && assignment.paintId.trim() ? assignment.paintId : null;
  const areas = String(assignment.areas || "").trim();
  if (!paintId || !areas) {
    return null;
  }

  return {
    id: typeof assignment.id === "string" && assignment.id.trim() ? assignment.id : createId(),
    paintId,
    areas
  };
}

function isValidEntry(entry) {
  return (
    typeof entry.id === "string"
    && entry.game.length > 0
    && entry.faction.length > 0
    && entry.unit.length > 0
    && Number.isInteger(entry.number)
    && entry.number > 0
    && entry.type.length > 0
    && STATUS_VALUES.includes(entry.status)
  );
}

function isValidRequirement(requirement) {
  return (
    typeof requirement.id === "string"
    && requirement.game.length > 0
    && requirement.faction.length > 0
    && requirement.unit.length > 0
    && requirement.type.length > 0
    && Number.isInteger(requirement.requiredCount)
    && requirement.requiredCount > 0
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

      const normalized = parsed.map((item) => normalizer(item)).filter((item) => item !== null);
      if (key === primaryKey) {
        primary = { entries: normalized };
      } else if (!fallback || normalized.length > fallback.entries.length) {
        fallback = { entries: normalized };
      }
    } catch {
      // Ignore malformed JSON and keep looking.
    }
  }

  return primary || fallback;
}

function safeGetStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
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