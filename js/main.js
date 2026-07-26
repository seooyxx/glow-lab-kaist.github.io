(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
  var themeToggle = document.querySelector("[data-theme-toggle]");

  function currentTheme() {
    return document.documentElement.dataset.theme || (themeMedia.matches ? "dark" : "light");
  }

  function setTheme(theme, persist) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    if (themeToggle) {
      themeToggle.textContent = theme === "dark" ? "Light Theme" : "Dark Theme";
      themeToggle.setAttribute("aria-label", "Switch to " + (theme === "dark" ? "light" : "dark") + " theme");
    }
    if (persist) {
      try {
        window.localStorage.setItem("theme", theme);
      } catch (_error) {
        // The theme still works for the current page when storage is unavailable.
      }
    }
  }

  setTheme(currentTheme(), false);

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      setTheme(currentTheme() === "dark" ? "light" : "dark", true);
    });
  }

  window.addEventListener("storage", function (event) {
    if (event.key !== "theme") return;
    setTheme(event.newValue || (themeMedia.matches ? "dark" : "light"), false);
  });

  themeMedia.addEventListener("change", function (event) {
    try {
      if (window.localStorage.getItem("theme")) return;
    } catch (_error) {
      // Fall through to the system theme.
    }
    setTheme(event.matches ? "dark" : "light", false);
  });

  function getInternalPage(anchor) {
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
    var url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    if (!url.pathname.endsWith(".html") && !url.pathname.endsWith("/")) return null;
    return url;
  }

  var prefetched = new Set();

  function prefetch(url) {
    if (!url || url.pathname === window.location.pathname || prefetched.has(url.pathname)) return;
    prefetched.add(url.pathname);
    var hint = document.createElement("link");
    hint.rel = "prefetch";
    hint.href = url.pathname;
    hint.as = "document";
    document.head.appendChild(hint);
  }

  document.addEventListener(
    "pointerover",
    function (event) {
      prefetch(getInternalPage(event.target.closest("a[href]")));
    },
    { passive: true },
  );

  document.addEventListener(
    "touchstart",
    function (event) {
      prefetch(getInternalPage(event.target.closest("a[href]")));
    },
    { passive: true },
  );

  function prefetchNavigation() {
    document.querySelectorAll(".main-nav a[href]").forEach(function (anchor) {
      prefetch(getInternalPage(anchor));
    });
  }

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(prefetchNavigation, { timeout: 900 });
  } else {
    window.setTimeout(prefetchNavigation, 450);
  }

  var publicationList = document.querySelector("[data-publication-list]");

  function primaryLink(publication) {
    return publication.querySelector(".pub-title a[href]") || publication.querySelector(".pub-links a[href]");
  }

  function enhancePublicationList() {
    if (!publicationList) return;
    publicationList.querySelectorAll(".pub-year").forEach(function (yearHeading) {
      var year = yearHeading.textContent.trim();
      var list = yearHeading.nextElementSibling;
      if (!list || !list.classList.contains("pub-list")) return;
      list.querySelectorAll(":scope > .pub").forEach(function (publication) {
        publication.dataset.year = year.replace(" & earlier", "≤");
      });
    });
  }

  function buildPreview(publication, index) {
    var title = publication.querySelector(".pub-title");
    var authors = publication.querySelector(".pub-authors");
    var venue = publication.querySelector(".venue");
    var award = publication.querySelector(".award");
    var link = primaryLink(publication);
    var wrapper = link ? document.createElement("a") : document.createElement("div");
    wrapper.className = "card-link";

    if (link) {
      wrapper.href = link.href;
      wrapper.target = "_blank";
      wrapper.rel = "noopener";
    }

    var article = document.createElement("article");
    article.className = "card publication-card";
    var visual = document.createElement("div");
    visual.className = "visual";
    visual.dataset.visual = String(index % 5);
    visual.setAttribute("aria-hidden", "true");
    var copy = document.createElement("div");
    copy.className = "card-copy";
    var previewTitle = document.createElement("h3");
    previewTitle.textContent = title ? title.textContent.trim() : "Publication";
    var meta = document.createElement("p");
    meta.className = "card-meta";
    var metaParts = [];
    if (venue) metaParts.push(venue.textContent.trim());
    if (authors) metaParts.push(authors.textContent.trim());
    meta.textContent = metaParts.join(" · ");
    if (award) {
      var awardCopy = document.createElement("span");
      awardCopy.className = "award";
      awardCopy.textContent = award.textContent.trim();
      meta.prepend(awardCopy, " ");
    }
    copy.append(previewTitle, meta);
    article.append(visual, copy);
    wrapper.append(article);
    return wrapper;
  }

  function buildPublicationPreviews() {
    var previewGrid = document.querySelector("[data-publication-previews]");
    if (!publicationList || !previewGrid) return;
    var fragment = document.createDocumentFragment();
    publicationList.querySelectorAll(".pub").forEach(function (publication, index) {
      fragment.appendChild(buildPreview(publication, index));
    });
    previewGrid.appendChild(fragment);
  }

  enhancePublicationList();
  buildPublicationPreviews();

  function loadMagneticLogo() {
    var logo = document.querySelector("[data-magnetic-glow]");
    if (!logo || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    var threeScript = document.createElement("script");
    threeScript.src = "assets/vendor/three.min.js";
    threeScript.onload = function () {
      var logoScript = document.createElement("script");
      logoScript.src = "js/magnetic-glow.js";
      document.head.appendChild(logoScript);
    };
    document.head.appendChild(threeScript);
  }

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadMagneticLogo, { timeout: 1000 });
  } else {
    window.setTimeout(loadMagneticLogo, 500);
  }
})();
