(function () {
  "use strict";

  try {
    var navigation = performance.getEntriesByType("navigation")[0];
    var direction = window.sessionStorage.getItem("transition-direction");
    var sharedTransition = window.sessionStorage.getItem("shared-transition");
    if (navigation && navigation.type === "back_forward") direction = "back";
    if (direction) document.documentElement.dataset.transitionDirection = direction;
    if (sharedTransition) document.documentElement.dataset.sharedTransition = sharedTransition;
    window.sessionStorage.removeItem("transition-direction");
    window.sessionStorage.removeItem("shared-transition");
  } catch (_error) {
    // Directional transitions are an enhancement only.
  }

  try {
    var stored = window.localStorage.getItem("theme");
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored || (systemDark ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_error) {
    document.documentElement.dataset.theme = "light";
  }
})();
