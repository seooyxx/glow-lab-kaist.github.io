(function () {
  "use strict";

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
