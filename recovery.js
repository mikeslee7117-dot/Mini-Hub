const RECOVERY_KEYS = [
  "mini-tracker-entries-v1",
  "mini-tracker-entries",
  "mini-tracker-entries-backup-v1",
  "mini-tracker-armies-v1",
  "mini-tracker-armies-backup-v1",
  "mini-tracker-scenarios-v1",
  "mini-tracker-scenarios-backup-v1",
  "mini-tracker-paints-v1",
  "mini-tracker-paints-backup-v1",
  "mini-tracker-paint-plans-v1",
  "mini-tracker-paint-plans-backup-v1"
];

const originNode = document.getElementById("recovery-origin");
const summaryNode = document.getElementById("recovery-summary");
const refreshButton = document.getElementById("refresh-recovery");
const exportButton = document.getElementById("export-recovery");
const importButton = document.getElementById("import-recovery");
const importInput = document.getElementById("recovery-import-input");
const messageNode = document.getElementById("recovery-message");

refreshButton?.addEventListener("click", renderRecovery);
exportButton?.addEventListener("click", exportSnapshot);
importButton?.addEventListener("click", importSnapshot);

renderRecovery();

function renderRecovery() {
  if (originNode) {
    originNode.textContent = window.location.origin || "file://";
  }

  if (!(summaryNode instanceof HTMLElement)) {
    return;
  }

  const snapshot = getSnapshot();
  summaryNode.innerHTML = RECOVERY_KEYS.map((key) => {
    const raw = snapshot[key];
    const parsed = tryParseArray(raw);
    const countLabel = parsed ? `${parsed.length} item${parsed.length === 1 ? "" : "s"}` : raw ? "raw value present" : "missing";

    return `
      <article class="dashboard-list-item">
        <div class="dashboard-item-top">
          <span class="dashboard-item-name">${escapeHtml(key)}</span>
          <span class="dashboard-item-pill">${escapeHtml(countLabel)}</span>
        </div>
        <div class="dashboard-item-note">${raw ? `${raw.length} characters stored` : "No value stored for this key"}</div>
      </article>
    `;
  }).join("");

  setMessage("");
}

function getSnapshot() {
  const snapshot = {};
  for (const key of RECOVERY_KEYS) {
    try {
      snapshot[key] = localStorage.getItem(key);
    } catch {
      snapshot[key] = null;
    }
  }
  return snapshot;
}

function exportSnapshot() {
  const payload = {
    origin: window.location.origin || "file://",
    exportedAt: new Date().toISOString(),
    storage: getSnapshot()
  };

  const json = JSON.stringify(payload, null, 2);
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    navigator.clipboard.writeText(json)
      .then(() => setMessage("Snapshot copied to clipboard."))
      .catch(() => fallbackExport(json));
    return;
  }

  fallbackExport(json);
}

function fallbackExport(json) {
  if (importInput instanceof HTMLTextAreaElement) {
    importInput.value = json;
    importInput.focus();
    importInput.select();
  }
  setMessage("Snapshot written into the text box. Copy it from there.");
}

function importSnapshot() {
  if (!(importInput instanceof HTMLTextAreaElement)) {
    return;
  }

  const raw = importInput.value.trim();
  if (!raw) {
    setMessage("Paste a snapshot first.", true);
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.storage || typeof parsed.storage !== "object") {
      setMessage("Snapshot format is invalid.", true);
      return;
    }

    for (const key of RECOVERY_KEYS) {
      const value = Object.prototype.hasOwnProperty.call(parsed.storage, key)
        ? parsed.storage[key]
        : null;
      if (typeof value === "string") {
        localStorage.setItem(key, value);
      } else {
        localStorage.removeItem(key);
      }
    }

    renderRecovery();
    setMessage(`Imported snapshot from ${parsed.origin || "unknown origin"}.`);
  } catch {
    setMessage("Snapshot JSON could not be parsed.", true);
  }
}

function tryParseArray(raw) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function setMessage(message, isError = false) {
  if (!(messageNode instanceof HTMLElement)) {
    return;
  }

  messageNode.textContent = message;
  messageNode.style.color = isError ? "var(--warn)" : "var(--muted)";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}