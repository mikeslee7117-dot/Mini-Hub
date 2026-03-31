(function initMiniHubCloudSync() {
  const API_BASE = "/api/storage";
  const PREFIX = "mini-tracker-";
  const TOKEN_STORAGE_KEY = "mini-hub-token";

  const token = sessionStorage.getItem(TOKEN_STORAGE_KEY) || "";
  const requestHeaders = token ? { "x-mini-hub-token": token } : {};
  const isHttp = window.location.protocol === "http:" || window.location.protocol === "https:";

  if (!isHttp) {
    return;
  }

  hydrateFromServer();
  patchStorageWrites();

  function hydrateFromServer() {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", API_BASE, false);
      for (const [name, value] of Object.entries(requestHeaders)) {
        xhr.setRequestHeader(name, value);
      }
      xhr.send(null);

      if (xhr.status !== 200 || !xhr.responseText) {
        return;
      }

      const payload = JSON.parse(xhr.responseText);
      if (!payload || typeof payload !== "object" || !payload.storage || typeof payload.storage !== "object") {
        return;
      }

      for (const [key, value] of Object.entries(payload.storage)) {
        if (!isTrackedKey(key) || typeof value !== "string") {
          continue;
        }
        localStorage.setItem(key, value);
      }
    } catch {
      // Ignore sync bootstrap errors and continue with local storage only.
    }
  }

  function patchStorageWrites() {
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    Storage.prototype.setItem = function patchedSetItem(key, value) {
      originalSetItem.call(this, key, value);
      if (this === localStorage && isTrackedKey(key)) {
        pushSet(key, String(value));
      }
    };

    Storage.prototype.removeItem = function patchedRemoveItem(key) {
      originalRemoveItem.call(this, key);
      if (this === localStorage && isTrackedKey(key)) {
        pushDelete(key);
      }
    };
  }

  function isTrackedKey(key) {
    return typeof key === "string" && key.startsWith(PREFIX);
  }

  function pushSet(key, value) {
    const headers = {
      "Content-Type": "application/json",
      ...requestHeaders
    };

    fetch(`${API_BASE}/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ value }),
      keepalive: true
    }).catch(() => {
      // Ignore network errors so normal local usage still works.
    });
  }

  function pushDelete(key) {
    fetch(`${API_BASE}/${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: requestHeaders,
      keepalive: true
    }).catch(() => {
      // Ignore network errors so normal local usage still works.
    });
  }
})();