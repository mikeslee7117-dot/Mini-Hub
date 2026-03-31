(function initSidebarMenu() {
  const toggleButton = document.querySelector("[data-menu-toggle]");
  const nav = document.getElementById("primary-nav");
  if (!(toggleButton instanceof HTMLButtonElement) || !(nav instanceof HTMLElement)) {
    return;
  }

  const storageKey = "mini-hub-menu-expanded";
  const expanded = localStorage.getItem(storageKey) === "true";
  setExpanded(expanded);

  toggleButton.addEventListener("click", () => {
    const next = nav.hasAttribute("hidden");
    setExpanded(next);
    localStorage.setItem(storageKey, next ? "true" : "false");
  });

  function setExpanded(value) {
    if (value) {
      nav.removeAttribute("hidden");
      toggleButton.textContent = "Hide Menu";
      toggleButton.setAttribute("aria-expanded", "true");
      return;
    }

    nav.setAttribute("hidden", "");
    toggleButton.textContent = "Show Menu";
    toggleButton.setAttribute("aria-expanded", "false");
  }
})();