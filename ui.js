const TOAST_DURATION_MS = 2200;

const FORM_TOASTS = {
  "entry-form": "Entry added",
  "create-army-form": "Army created",
  "create-scenario-form": "Scenario created",
  "paint-form": "Paint added",
  "paint-unit-form": "Unit added to painting plan"
};

const ACTION_TOASTS = {
  next: "Status advanced",
  copy: "Copied to form",
  save: "Changes saved",
  "save-army": "Army saved",
  "save-scenario": "Scenario saved",
  "save-requirement": "Requirement saved",
  "save-paint": "Paint saved",
  delete: "Entry deleted",
  "delete-army": "Army deleted",
  "delete-scenario": "Scenario deleted",
  "delete-requirement": "Requirement deleted",
  "delete-paint": "Paint deleted",
  "delete-plan": "Unit removed",
  "delete-assignment": "Paint removed",
  "remove-unit": "Unit removed",
  "remove-assignment": "Assignment removed",
  "assign-selected": "Assignment added",
  "assign-unit": "Assignment added",
  "add-assignment": "Assignment added",
  "add-unit": "Unit assigned"
};

const CHANGE_TOASTS = {
  "set-quantity": "Quantity updated",
  "set-assignment-quantity": "Quantity updated"
};

initUiHelpers();

function initUiHelpers() {
  applyCompactDensity();
  ensureToastRoot();
  bindGlobalToasts();
  wireGlobalDialogCloses();

  window.appToast = showToast;
  window.appConfirmDelete = confirmDelete;
}

function bindGlobalToasts() {
  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.id) {
      return;
    }

    const message = FORM_TOASTS[form.id];
    if (!message) {
      return;
    }

    window.setTimeout(() => {
      showToast(message);
    }, 0);
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest("button[data-action]");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const action = String(button.dataset.action || "").trim();
    const message = ACTION_TOASTS[action];
    if (!message) {
      return;
    }

    window.setTimeout(() => {
      showToast(message);
    }, 0);
  });

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }

    const action = String(target.dataset.action || "").trim();
    const message = CHANGE_TOASTS[action];
    if (!message) {
      return;
    }

    showToast(message);
  });
}

function applyCompactDensity() {
  document.body.classList.add("density-compact");
}

function ensureToastRoot() {
  if (document.getElementById("toast-root")) {
    return;
  }

  const root = document.createElement("div");
  root.id = "toast-root";
  root.className = "toast-root";
  document.body.appendChild(root);
}

function showToast(message) {
  const root = document.getElementById("toast-root");
  if (!(root instanceof HTMLDivElement)) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = String(message || "Saved");
  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("toast--show");
  });

  window.setTimeout(() => {
    toast.classList.remove("toast--show");
    window.setTimeout(() => {
      toast.remove();
    }, 180);
  }, TOAST_DURATION_MS);
}

function confirmDelete(label) {
  const target = String(label || "item").trim() || "item";
  return window.confirm(`Delete ${target}?`);
}

function wireGlobalDialogCloses() {
  document.addEventListener("click", (event) => {
    const closeBtn = event.target.closest("[data-close-dialog]");
    if (closeBtn instanceof HTMLElement) {
      const targetId = closeBtn.dataset.closeDialog;
      if (targetId) {
        const dialog = document.getElementById(targetId);
        if (dialog instanceof HTMLDialogElement) {
          dialog.close();
        }
      }
    }
  });
  
  // Close dialog when clicking backdrop
  document.addEventListener("click", (event) => {
    if (event.target instanceof HTMLDialogElement) {
      const rect = event.target.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX >= rect.right ||
          event.clientY < rect.top || event.clientY >= rect.bottom) {
        event.target.close();
      }
    }
  });
}
