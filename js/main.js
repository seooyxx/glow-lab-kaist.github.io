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

  function pageName(pathname) {
    return pathname.split("/").pop() || "index.html";
  }

  function sharedTransitionFor(currentPath, nextPath) {
    var current = pageName(currentPath);
    var next = pageName(nextPath);
    if (
      (current === "index.html" && next === "publications.html") ||
      (current === "publications.html" && next === "index.html")
    ) {
      return "publications";
    }
    return "";
  }

  var refreshNavigationIndicator = function () {};

  function initNavigationIndicator() {
    var nav = document.querySelector(".main-nav");
    if (!nav) return;
    var links = Array.from(nav.querySelectorAll("a[href]"));
    var current = nav.querySelector('[aria-current="page"]') || links[0];
    if (!current) return;

    function moveTo(link, immediate) {
      if (!link) return;
      var navBounds = nav.getBoundingClientRect();
      var linkBounds = link.getBoundingClientRect();
      nav.classList.toggle("indicator-immediate", Boolean(immediate));
      nav.style.setProperty("--nav-indicator-x", (linkBounds.left - navBounds.left) + "px");
      nav.style.setProperty("--nav-indicator-width", linkBounds.width + "px");
      nav.classList.add("indicator-ready");
      if (immediate) {
        window.requestAnimationFrame(function () {
          nav.classList.remove("indicator-immediate");
        });
      }
    }

    links.forEach(function (link) {
      link.addEventListener("pointerenter", function (event) {
        if (event.pointerType === "touch") return;
        moveTo(link, false);
      });
      link.addEventListener("focus", function () {
        moveTo(link, false);
      });
      link.addEventListener("click", function () {
        moveTo(link, false);
      });
    });

    nav.addEventListener("pointerleave", function () {
      moveTo(current, false);
    });
    nav.addEventListener("focusout", function (event) {
      if (nav.contains(event.relatedTarget)) return;
      moveTo(current, false);
    });

    refreshNavigationIndicator = function (immediate) {
      current = nav.querySelector('[aria-current="page"]') || links[0];
      window.requestAnimationFrame(function () {
        moveTo(current, immediate !== false);
      });
    };
    refreshNavigationIndicator(true);
    window.addEventListener("resize", function () {
      refreshNavigationIndicator(true);
    }, { passive: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        refreshNavigationIndicator(true);
      });
    }
  }

  initNavigationIndicator();

  var pageCache = new Map();
  var renderedUrl = new URL(window.location.href);
  var navigationSequence = 0;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function cacheKey(url) {
    return url.pathname + url.search;
  }

  function fetchPage(url) {
    var key = cacheKey(url);
    if (!pageCache.has(key)) {
      pageCache.set(
        key,
        window.fetch(url.href, {
          credentials: "same-origin",
          headers: { "X-Requested-With": "GLOW-Navigation" },
        }).then(function (response) {
          if (!response.ok) throw new Error("Page request failed with " + response.status);
          return response.text();
        }).catch(function (error) {
          pageCache.delete(key);
          throw error;
        }),
      );
    }
    return pageCache.get(key).then(function (html) {
      return new window.DOMParser().parseFromString(html, "text/html");
    });
  }

  function prefetch(url) {
    if (!url || cacheKey(url) === cacheKey(renderedUrl)) return;
    fetchPage(url).catch(function () {
      // A normal browser navigation remains available if prefetching fails.
    });
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

  function primaryLink(publication) {
    return publication.querySelector(".pub-title a[href]") || publication.querySelector(".pub-links a[href]");
  }

  function authorSurname(author) {
    var parts = author.replace(/\*/g, "").trim().split(/\s+/);
    return parts[parts.length - 1] || author.trim();
  }

  function formatListAuthors(authors) {
    if (!authors || authors.dataset.listFormatted === "true") return;
    var fullAuthors = authors.textContent.replace(/\s+/g, " ").trim();
    var authorList = fullAuthors.split(",").map(function (author) {
      return author.trim();
    }).filter(Boolean);

    authors.dataset.listFormatted = "true";
    authors.dataset.fullAuthors = fullAuthors;
    authors.setAttribute("aria-label", fullAuthors);
    authors.title = fullAuthors;
    authors.textContent = authorList.slice(0, 2).map(authorSurname).join(", ");

    if (authorList.length > 2) {
      var etAl = document.createElement("span");
      etAl.className = "et-al";
      etAl.setAttribute("aria-hidden", "true");
      authors.appendChild(etAl);
    }
  }

  function formatListVenue(venue) {
    if (!venue || venue.dataset.listFormatted === "true") return;
    var fullVenue = venue.textContent.replace(/\s+/g, " ").trim();
    venue.dataset.listFormatted = "true";
    venue.dataset.fullVenue = fullVenue;
    venue.title = fullVenue;
    venue.textContent = fullVenue.replace(/\s+(?:19|20)\d{2}$/, "");
  }

  function formatListTitle(title) {
    if (!title || title.dataset.listFormatted === "true") return;
    var link = title.querySelector("a[href]");
    if (!link) return;

    var fullTitle = link.textContent.replace(/\s+/g, " ").trim();
    var separator = fullTitle.indexOf(":");
    var hasSubtitle = separator > 0 && separator < fullTitle.length - 1;

    title.dataset.listFormatted = "true";
    title.dataset.fullTitle = fullTitle;
    link.setAttribute("aria-label", fullTitle);
    link.title = fullTitle;
    link.textContent = hasSubtitle ? fullTitle.slice(0, separator).trim() : fullTitle;

    var leader = document.createElement("span");
    leader.className = "pub-leader";
    leader.setAttribute("aria-hidden", "true");
    title.appendChild(leader);

    if (hasSubtitle) {
      var subtitle = document.createElement("span");
      subtitle.className = "pub-subtitle";
      subtitle.textContent = fullTitle.slice(separator + 1).trim();
      subtitle.title = subtitle.textContent;
      title.appendChild(subtitle);
    }
  }

  function enhancePublicationList(publicationList) {
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
        formatListTitle(publication.querySelector(".pub-title"));
        formatListAuthors(publication.querySelector(".pub-authors"));
        formatListVenue(publication.querySelector(".venue"));
      });
    });
  }

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
    previewTitle.textContent = title ? (title.dataset.fullTitle || title.textContent.trim()) : "Publication";
    var meta = document.createElement("p");
    meta.className = "card-meta";
    var metaParts = [];
    if (venue) metaParts.push(venue.dataset.fullVenue || venue.textContent.trim());
    if (authors) metaParts.push(authors.dataset.fullAuthors || authors.textContent.trim());
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
    var publicationList = document.querySelector("[data-publication-list]");
    var previewGrid = document.querySelector("[data-publication-previews]");
    if (!publicationList || !previewGrid || previewGrid.children.length || !previewGrid.isConnected) return;
    var fragment = document.createDocumentFragment();
    publicationList.querySelectorAll(".pub").forEach(function (publication, index) {
      fragment.appendChild(buildPreview(publication, index));
    });
    previewGrid.appendChild(fragment);
    initVisualParallax(previewGrid);
  }

  function initFeaturedScroller() {
    var scroller = document.querySelector(".featured-scroller");
    if (!scroller || scroller.dataset.scrollerReady === "true") return;
    scroller.dataset.scrollerReady = "true";
    scroller.tabIndex = 0;
    scroller.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      var card = scroller.querySelector(".card-link");
      var distance = card ? card.getBoundingClientRect().width + 16 : scroller.clientWidth * 0.8;
      scroller.scrollBy({
        left: event.key === "ArrowLeft" ? -distance : distance,
        behavior: reduceMotion.matches ? "auto" : "smooth",
      });
    });

    if (reduceMotion.matches) return;
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

  function enhancePage() {
    var publicationList = document.querySelector("[data-publication-list]");
    enhancePublicationList(publicationList);
    initVisualParallax(document.querySelector("main") || document);
    initFeaturedScroller();
    initSectionJumps();

    if (document.querySelector("[data-publication-previews]")) {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(buildPublicationPreviews, { timeout: 700 });
      } else {
        window.setTimeout(buildPublicationPreviews, 120);
      }
    }
  }

  function setNavigationState(fromUrl, toUrl) {
    var currentIndex = pageIndex(fromUrl.pathname);
    var nextIndex = pageIndex(toUrl.pathname);
    var direction = currentIndex >= 0 && nextIndex >= 0 && nextIndex < currentIndex ? "back" : "forward";
    var sharedTransition = sharedTransitionFor(fromUrl.pathname, toUrl.pathname);

    document.documentElement.dataset.transitionDirection = direction;
    if (sharedTransition) {
      document.documentElement.dataset.sharedTransition = sharedTransition;
    } else {
      delete document.documentElement.dataset.sharedTransition;
    }

    try {
      window.sessionStorage.setItem("transition-direction", direction);
      if (sharedTransition) {
        window.sessionStorage.setItem("shared-transition", sharedTransition);
      } else {
        window.sessionStorage.removeItem("shared-transition");
      }
    } catch (_error) {
      // Navigation remains fully functional without storage.
    }
  }

  function clearNavigationState() {
    delete document.documentElement.dataset.transitionDirection;
    delete document.documentElement.dataset.sharedTransition;
    try {
      window.sessionStorage.removeItem("transition-direction");
      window.sessionStorage.removeItem("shared-transition");
    } catch (_error) {
      // Nothing else is required when storage is unavailable.
    }
  }

  function updateNavigation(url) {
    var destination = pageName(url.pathname);
    document.querySelectorAll(".main-nav a[href]").forEach(function (link) {
      var active = pageName(new URL(link.href, url).pathname) === destination;
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    refreshNavigationIndicator(false);
  }

  function updateDocumentMetadata(nextDocument) {
    document.title = nextDocument.title;
    var nextDescription = nextDocument.querySelector('meta[name="description"]');
    var currentDescription = document.querySelector('meta[name="description"]');
    if (nextDescription && currentDescription) {
      currentDescription.content = nextDescription.content;
    }
  }

  var routeStatus = document.createElement("span");
  routeStatus.className = "route-status";
  routeStatus.setAttribute("role", "status");
  routeStatus.setAttribute("aria-live", "polite");
  document.body.appendChild(routeStatus);

  function swapPage(nextDocument, url, historyMode) {
    var nextMain = nextDocument.querySelector("main");
    var currentMain = document.querySelector("main");
    if (!nextMain || !currentMain) throw new Error("The requested page has no main content.");

    if (historyMode === "push") {
      window.history.pushState({ glowPage: true }, "", url.href);
    } else if (historyMode === "replace") {
      window.history.replaceState({ glowPage: true }, "", url.href);
    }

    document.body.className = nextDocument.body.className;
    document.documentElement.lang = nextDocument.documentElement.lang || "en";
    updateDocumentMetadata(nextDocument);
    currentMain.replaceWith(document.importNode(nextMain, true));
    updateNavigation(url);
    enhancePage();
    renderedUrl = new URL(url.href);

    if (url.hash) {
      var target = document.querySelector(url.hash);
      if (target) target.scrollIntoView();
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }

    routeStatus.textContent = "";
    window.requestAnimationFrame(function () {
      var heading = document.querySelector("main h1");
      routeStatus.textContent = heading ? heading.textContent.trim() + " page loaded" : "Page loaded";
    });
  }

  var activeTransition = null;

  function navigateTo(url, options) {
    var sequence = ++navigationSequence;
    var fromUrl = options.fromUrl || renderedUrl;
    setNavigationState(fromUrl, url);

    return fetchPage(url).then(function (nextDocument) {
      if (sequence !== navigationSequence) return;

      var swap = function () {
        swapPage(nextDocument, url, options.historyMode);
      };

      if (
        document.startViewTransition &&
        !reduceMotion.matches
      ) {
        if (activeTransition && activeTransition.skipTransition) {
          activeTransition.skipTransition();
        }
        activeTransition = document.startViewTransition(swap);
        activeTransition.finished.catch(function () {
          // The new content is already in place when an animation is interrupted.
        }).then(function () {
          if (sequence === navigationSequence) clearNavigationState();
          activeTransition = null;
        });
      } else {
        swap();
        clearNavigationState();
      }
    }).catch(function () {
      if (sequence !== navigationSequence) return;
      window.location.assign(url.href);
    });
  }

  document.addEventListener("click", function (event) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !(event.target instanceof Element)
    ) return;

    var url = getInternalPage(event.target.closest("a[href]"));
    if (!url) return;
    if (url.pathname === renderedUrl.pathname && url.search === renderedUrl.search) return;

    event.preventDefault();
    navigateTo(url, { historyMode: "push", fromUrl: renderedUrl });
  });

  window.addEventListener("popstate", function () {
    var nextUrl = new URL(window.location.href);
    navigateTo(nextUrl, { historyMode: "none", fromUrl: renderedUrl });
  });

  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) return;
    renderedUrl = new URL(window.location.href);
    updateNavigation(renderedUrl);
    enhancePage();
  });

  window.setTimeout(clearNavigationState, 600);
  enhancePage();

  var magneticLogoStarted = false;

  function loadMagneticLogo(event) {
    var logo = document.querySelector("[data-magnetic-glow]");
    if (logo && event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      logo.dataset.pendingPointerX = String(event.clientX);
      logo.dataset.pendingPointerY = String(event.clientY);
    }
    if (
      magneticLogoStarted ||
      !logo ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;
    magneticLogoStarted = true;

    var threeScript = document.createElement("script");
    threeScript.src = "assets/vendor/three.min.js";
    threeScript.async = true;
    threeScript.onload = function () {
      var logoScript = document.createElement("script");
      logoScript.src = "js/magnetic-glow.js";
      logoScript.async = true;
      document.head.appendChild(logoScript);
    };
    threeScript.onerror = function () {
      magneticLogoStarted = false;
    };
    document.head.appendChild(threeScript);
  }

  var magneticLogo = document.querySelector("[data-magnetic-glow]");
  var magneticBrand = magneticLogo && magneticLogo.closest("[data-brand-link]");
  if (magneticLogo) {
    magneticLogo.addEventListener("pointerenter", loadMagneticLogo, {
      once: true,
      passive: true,
    });
    magneticLogo.addEventListener("touchstart", loadMagneticLogo, {
      once: true,
      passive: true,
    });
  }
  if (magneticBrand) {
    magneticBrand.addEventListener("pointerenter", loadMagneticLogo, {
      once: true,
      passive: true,
    });
    magneticBrand.addEventListener(
      "pointerleave",
      function () {
        if (!magneticLogo || magneticLogo.classList.contains("is-enhanced")) return;
        delete magneticLogo.dataset.pendingPointerX;
        delete magneticLogo.dataset.pendingPointerY;
      },
      { passive: true },
    );
    magneticBrand.addEventListener("focusin", loadMagneticLogo, { once: true });
  }

  function prefetchMagneticLogo() {
    var connection =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (
      magneticLogoStarted ||
      (connection && connection.saveData) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;

    ["assets/vendor/three.min.js", "js/magnetic-glow.js"].forEach(function (href) {
      var link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "script";
      link.href = href;
      document.head.appendChild(link);
    });
  }

  function scheduleMagneticLogoPrefetch() {
    window.setTimeout(prefetchMagneticLogo, 1500);
  }

  if (document.readyState === "complete") {
    scheduleMagneticLogoPrefetch();
  } else {
    window.addEventListener("load", scheduleMagneticLogoPrefetch, { once: true });
  }
})();
