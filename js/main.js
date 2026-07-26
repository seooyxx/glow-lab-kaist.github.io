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
      var applyTheme = function () {
        setTheme(currentTheme() === "dark" ? "light" : "dark", true);
      };
      if (
        document.startViewTransition &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        document.startViewTransition(applyTheme);
      } else {
        applyTheme();
      }
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

  var pageOrder = ["index.html", "people.html", "publications.html", "join.html"];

  function pageIndex(pathname) {
    var page = pathname.split("/").pop() || "index.html";
    return pageOrder.indexOf(page);
  }

  document.addEventListener(
    "click",
    function (event) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;
      var url = getInternalPage(event.target.closest("a[href]"));
      if (!url || url.pathname === window.location.pathname) return;
      var currentIndex = pageIndex(window.location.pathname);
      var nextIndex = pageIndex(url.pathname);
      var direction = currentIndex >= 0 && nextIndex >= 0 && nextIndex < currentIndex ? "back" : "forward";
      document.documentElement.dataset.transitionDirection = direction;
      try {
        window.sessionStorage.setItem("transition-direction", direction);
      } catch (_error) {
        // Navigation remains fully functional without storage.
      }
    },
    true,
  );

  window.setTimeout(function () {
    delete document.documentElement.dataset.transitionDirection;
  }, 500);

  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    document.documentElement.dataset.transitionDirection = "back";
    window.setTimeout(function () {
      delete document.documentElement.dataset.transitionDirection;
    }, 500);
  });

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
        if (!publication.querySelector(".pub-thumb")) {
          var thumb = document.createElement("span");
          thumb.className = "visual pub-thumb";
          thumb.dataset.visual = String(
            Array.prototype.indexOf.call(publicationList.querySelectorAll(".pub"), publication) % 5,
          );
          thumb.setAttribute("aria-hidden", "true");
          publication.prepend(thumb);
        }
        var title = publication.querySelector(".pub-title");
        if (title && !title.querySelector(".pub-leader")) {
          var leader = document.createElement("span");
          leader.className = "pub-leader";
          leader.setAttribute("aria-hidden", "true");
          title.appendChild(leader);
        }
      });
    });
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function initVisualParallax(scope) {
    if (reduceMotion.matches) return;
    (scope || document).querySelectorAll(".visual:not(.pub-thumb)").forEach(function (visual) {
      if (visual.dataset.pointerReady === "true") return;
      visual.dataset.pointerReady = "true";

      visual.addEventListener("pointermove", function (event) {
        if (event.pointerType === "touch") return;
        var bounds = visual.getBoundingClientRect();
        var x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2));
        var y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2));
        visual.style.setProperty("--pointer-x-4", (x * 4).toFixed(2) + "px");
        visual.style.setProperty("--pointer-y-4", (y * 4).toFixed(2) + "px");
        visual.style.setProperty("--pointer-x-neg-5", (x * -5).toFixed(2) + "px");
        visual.style.setProperty("--pointer-y-neg-5", (y * -5).toFixed(2) + "px");
        visual.style.setProperty("--pointer-x-8", (x * 8).toFixed(2) + "px");
        visual.style.setProperty("--pointer-y-8", (y * 8).toFixed(2) + "px");
        visual.style.setProperty("--pointer-x-angle", (x * 2.5).toFixed(2) + "deg");
        visual.style.setProperty("--pointer-y-angle", (y * -2.5).toFixed(2) + "deg");
      });

      visual.addEventListener("pointerleave", function () {
        [
          "--pointer-x-4",
          "--pointer-y-4",
          "--pointer-x-neg-5",
          "--pointer-y-neg-5",
          "--pointer-x-8",
          "--pointer-y-8",
        ].forEach(function (property) {
          visual.style.setProperty(property, "0px");
        });
        visual.style.setProperty("--pointer-x-angle", "0deg");
        visual.style.setProperty("--pointer-y-angle", "0deg");
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
    initVisualParallax(previewGrid);
  }

  enhancePublicationList();
  initVisualParallax(document);

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(buildPublicationPreviews, { timeout: 700 });
  } else {
    window.setTimeout(buildPublicationPreviews, 120);
  }

  function initFeaturedScroller() {
    var scroller = document.querySelector(".featured-scroller");
    if (!scroller || reduceMotion.matches) return;
    var pointerId = null;
    var startX = 0;
    var startScroll = 0;
    var moved = false;

    scroller.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || event.pointerType === "touch") return;
      event.preventDefault();
      pointerId = event.pointerId;
      startX = event.clientX;
      startScroll = scroller.scrollLeft;
      moved = false;
      scroller.setPointerCapture(pointerId);
    });

    scroller.addEventListener("pointermove", function (event) {
      if (event.pointerId !== pointerId) return;
      var distance = event.clientX - startX;
      if (Math.abs(distance) > 4) {
        moved = true;
        scroller.classList.add("is-dragging");
        scroller.scrollLeft = startScroll - distance;
        event.preventDefault();
      }
    });

    function finishDrag(event) {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      scroller.classList.remove("is-dragging");
      window.setTimeout(function () {
        moved = false;
      }, 80);
    }

    scroller.addEventListener("pointerup", finishDrag);
    scroller.addEventListener("pointercancel", finishDrag);
    scroller.addEventListener(
      "click",
      function (event) {
        if (!moved) return;
        event.preventDefault();
        event.stopPropagation();
        moved = false;
      },
      true,
    );
  }

  function initSectionJumps() {
    var links = Array.from(document.querySelectorAll(".section-jumps a[href^='#']"));
    if (!links.length || !("IntersectionObserver" in window)) return;
    var pairs = links
      .map(function (link) {
        return { link: link, section: document.querySelector(link.hash) };
      })
      .filter(function (pair) {
        return pair.section;
      });
    if (!pairs.length) return;

    function activate(link) {
      links.forEach(function (candidate) {
        var active = candidate === link;
        candidate.classList.toggle("active", active);
        if (active) candidate.setAttribute("aria-current", "location");
        else candidate.removeAttribute("aria-current");
      });
    }

    var observer = new IntersectionObserver(
      function (entries) {
        var visible = entries
          .filter(function (entry) {
            return entry.isIntersecting;
          })
          .sort(function (a, b) {
            return Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top);
          });
        if (!visible.length) return;
        var match = pairs.find(function (pair) {
          return pair.section === visible[0].target;
        });
        if (match) activate(match.link);
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0, 0.01] },
    );

    pairs.forEach(function (pair) {
      observer.observe(pair.section);
    });
    activate(pairs[0].link);
  }

  initFeaturedScroller();
  initSectionJumps();

  function loadMagneticLogo() {
    var logo = document.querySelector("[data-magnetic-glow]");
    if (!logo || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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
