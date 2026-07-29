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
      var label = link.querySelector(".nav-label") || link;
      var labelBounds = label.getBoundingClientRect();
      var targetRight = link.matches('[aria-current="page"]')
        ? linkBounds.right
        : labelBounds.right;
      nav.classList.toggle("indicator-immediate", Boolean(immediate));
      nav.style.setProperty("--nav-indicator-x", (labelBounds.left - navBounds.left) + "px");
      nav.style.setProperty("--nav-indicator-width", (targetRight - labelBounds.left) + "px");
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

  function setHighlightedAuthorText(element, text) {
    if (!element) return;
    var highlightedAuthor = "Seung Wook Kim";
    var chunks = String(text || "").split(highlightedAuthor);
    element.textContent = "";

    chunks.forEach(function (chunk, index) {
      if (index) {
        var highlight = document.createElement("span");
        highlight.className = "me";
        highlight.textContent = highlightedAuthor;
        element.appendChild(highlight);
      }
      element.appendChild(document.createTextNode(chunk));
    });
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
    authors.textContent = "";
    authorList.slice(0, 2).forEach(function (author, index) {
      if (index) authors.appendChild(document.createTextNode(", "));
      var surname = authorSurname(author);
      if (author.replace(/\*/g, "").trim() === "Seung Wook Kim") {
        var highlight = document.createElement("span");
        highlight.className = "me";
        highlight.textContent = surname;
        authors.appendChild(highlight);
      } else {
        authors.appendChild(document.createTextNode(surname));
      }
    });

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
    article.className = "card publication-card selected-publication-card";
    var visual = document.createElement("div");
    visual.className = "visual";
    visual.dataset.visual = String(index % 5);
    visual.setAttribute("aria-hidden", "true");
    var copy = document.createElement("div");
    copy.className = "card-copy";
    var previewTitle = document.createElement("h3");
    previewTitle.textContent = title ? (title.dataset.fullTitle || title.textContent.trim()) : "Publication";
    var previewAuthors = document.createElement("p");
    previewAuthors.className = "card-authors";
    setHighlightedAuthorText(
      previewAuthors,
      authors ? (authors.dataset.fullAuthors || authors.textContent.trim()) : "",
    );
    var meta = document.createElement("p");
    meta.className = "card-meta";
    var fullVenue = venue ? (venue.dataset.fullVenue || venue.textContent.trim()) : "";
    var venueMatch = fullVenue.match(/^(.*?)(?:\s+((?:19|20)\d{2}))$/);
    var venueName = venueMatch ? venueMatch[1] : fullVenue;
    var publicationYear = venueMatch ? venueMatch[2] : publication.dataset.year;
    if (venueName) {
      var venuePill = document.createElement("span");
      venuePill.className = "pill";
      venuePill.textContent = venueName;
      meta.appendChild(venuePill);
    }
    if (publicationYear) {
      var year = document.createElement("span");
      year.className = "publication-year";
      year.textContent = publicationYear;
      meta.appendChild(year);
    }
    if (award) {
      var awardCopy = document.createElement("span");
      awardCopy.className = "card-distinction";
      awardCopy.textContent = award.textContent.trim();
      meta.appendChild(awardCopy);
    }
    copy.append(previewTitle);
    if (previewAuthors.textContent) copy.append(previewAuthors);
    copy.append(meta);
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

  var memberStackRenderId = 0;
  var memberStackLimit = 16;
  var memberStackRowSize = 9;
  var memberHexHeight = 2 / Math.sqrt(3);
  var memberHexRowOffset = memberHexHeight * 0.75;

  function memberRecordsFromPeoplePage(scope) {
    return Array.from(scope.querySelectorAll("[data-member-record]")).map(function (card) {
      var avatar = card.querySelector(".person-avatar[data-member-transition]");
      var heading = card.querySelector("h3");
      var image = avatar && avatar.querySelector("img");
      if (!avatar || !heading) return null;
      return {
        slug: avatar.dataset.memberTransition,
        name: heading.textContent.trim(),
        image: image ? image.getAttribute("src") : "",
      };
    }).filter(Boolean);
  }

  function memberRecordsFromFallback(stack) {
    return Array.from(stack.querySelectorAll(".member-cell[data-member-transition]")).map(
      function (cell) {
        var image = cell.querySelector("img");
        return {
          slug: cell.dataset.memberTransition,
          name: cell.getAttribute("title") || cell.dataset.memberTransition,
          image: image ? image.getAttribute("src") : "",
        };
      },
    );
  }

  function memberHexPoints(left, top) {
    var half = 0.5;
    var quarterHeight = memberHexHeight * 0.25;
    return [
      [left + half, top],
      [left + 1, top + quarterHeight],
      [left + 1, top + memberHexHeight - quarterHeight],
      [left + half, top + memberHexHeight],
      [left, top + memberHexHeight - quarterHeight],
      [left, top + quarterHeight],
    ];
  }

  function memberOutlinePath(positions) {
    var edges = new Map();
    var pointsByKey = new Map();
    var adjacency = new Map();

    function edgeKey(firstKey, secondKey) {
      return firstKey < secondKey
        ? firstKey + "|" + secondKey
        : secondKey + "|" + firstKey;
    }

    function connect(firstKey, secondKey) {
      if (!adjacency.has(firstKey)) adjacency.set(firstKey, new Set());
      if (!adjacency.has(secondKey)) adjacency.set(secondKey, new Set());
      adjacency.get(firstKey).add(secondKey);
      adjacency.get(secondKey).add(firstKey);
    }

    positions.forEach(function (position) {
      var points = memberHexPoints(position.x, position.y);
      points.forEach(function (point, index) {
        var next = points[(index + 1) % points.length];
        var first = point.map(function (value) {
          return Math.round(value * 1000) / 10;
        });
        var second = next.map(function (value) {
          return Math.round(value * 1000) / 10;
        });
        var firstKey = first.join(",");
        var secondKey = second.join(",");
        var key = edgeKey(firstKey, secondKey);
        pointsByKey.set(firstKey, first);
        pointsByKey.set(secondKey, second);
        if (!edges.has(key)) {
          edges.set(key, [firstKey, secondKey]);
          connect(firstKey, secondKey);
        }
      });
    });

    var visited = new Set();
    var polylines = [];

    function walk(firstKey, secondKey) {
      var line = [firstKey];
      var previous = firstKey;
      var current = secondKey;
      visited.add(edgeKey(firstKey, secondKey));

      while (true) {
        line.push(current);
        var neighbors = Array.from(adjacency.get(current) || []);
        if (neighbors.length !== 2) break;
        var next = neighbors.find(function (candidate) {
          return candidate !== previous && !visited.has(edgeKey(current, candidate));
        });
        if (!next) break;
        visited.add(edgeKey(current, next));
        previous = current;
        current = next;
      }
      return line;
    }

    adjacency.forEach(function (neighbors, pointKey) {
      if (neighbors.size === 2) return;
      neighbors.forEach(function (neighborKey) {
        if (visited.has(edgeKey(pointKey, neighborKey))) return;
        polylines.push(walk(pointKey, neighborKey));
      });
    });

    edges.forEach(function (edge) {
      if (visited.has(edgeKey(edge[0], edge[1]))) return;
      polylines.push(walk(edge[0], edge[1]));
    });

    return polylines.map(function (line) {
      var closed = line.length > 2 && line[0] === line[line.length - 1];
      var pointKeys = closed ? line.slice(0, -1) : line;
      var commands = pointKeys.map(function (pointKey, index) {
        var point = pointsByKey.get(pointKey);
        return (index ? "L" : "M") + point.join(" ");
      });
      return commands.join("") + (closed ? "Z" : "");
    }).join("");
  }

  function renderMemberStack(stack, records, totalCount) {
    var members = records.slice(0, memberStackLimit);
    if (!members.length) {
      stack.hidden = true;
      return;
    }

    var visualCount = members.length + 1;
    var positions = Array.from({ length: visualCount }, function (_item, index) {
      var row = index >= memberStackRowSize ? 1 : 0;
      var column = row ? index - memberStackRowSize : index;
      return {
        x: column + (row ? 0.5 : 0),
        y: row ? memberHexRowOffset : 0,
      };
    });
    var joinPosition = positions[positions.length - 1];
    var topCount = Math.min(visualCount, memberStackRowSize);
    var bottomCount = Math.max(0, visualCount - memberStackRowSize);
    var width = Math.max(topCount, bottomCount ? bottomCount + 0.5 : 0);
    var height = bottomCount ? memberHexHeight + memberHexRowOffset : memberHexHeight;
    var svgNamespace = "http://www.w3.org/2000/svg";
    var gradientId = "member-stack-gradient-" + (++memberStackRenderId);
    var peopleLink = document.createElement("a");
    var joinLink = document.createElement("a");
    var joinArrow = document.createElement("span");
    var cells = document.createElement("span");
    var outline = document.createElementNS(svgNamespace, "svg");
    var definitions = document.createElementNS(svgNamespace, "defs");
    var gradient = document.createElementNS(svgNamespace, "linearGradient");
    var gradientStart = document.createElementNS(svgNamespace, "stop");
    var gradientEnd = document.createElementNS(svgNamespace, "stop");
    var path = document.createElementNS(svgNamespace, "path");

    stack.hidden = false;
    stack.style.setProperty("--member-stack-width", String(width));
    stack.style.setProperty("--member-stack-height", String(height));
    stack.dataset.memberCount = String(members.length);
    peopleLink.className = "member-stack-people";
    peopleLink.href = "people.html";
    peopleLink.setAttribute(
      "aria-label",
      "Meet " + totalCount + " " + (totalCount === 1 ? "member" : "members") + " of GLOW Lab",
    );

    cells.className = "member-stack-cells";
    cells.setAttribute("aria-hidden", "true");
    members.forEach(function (member, index) {
      var cell = document.createElement("span");
      var position = positions[index];
      cell.className = "member-avatar member-cell" + (member.image ? " member-photo" : "");
      cell.dataset.memberTransition = member.slug;
      cell.title = member.name;
      cell.style.setProperty("--member-x", String(position.x));
      cell.style.setProperty("--member-y", String(position.y));
      cell.style.left = (position.x / width * 100) + "%";
      cell.style.top = (position.y / height * 100) + "%";
      cell.style.width = (1 / width * 100) + "%";
      cell.style.height = (memberHexHeight / height * 100) + "%";
      cell.style.viewTransitionName = "member-img-" + member.slug;

      if (member.image) {
        var image = document.createElement("img");
        image.src = member.image;
        image.alt = "";
        image.loading = "eager";
        image.decoding = "async";
        cell.appendChild(image);
      }
      cells.appendChild(cell);
    });

    joinLink.className = "member-stack-join";
    joinLink.dataset.axisArrowTrigger = "";
    joinLink.href = "join.html";
    joinLink.setAttribute("aria-label", "Join GLOW Lab");
    joinLink.style.left = (joinPosition.x / width * 100) + "%";
    joinLink.style.top = (joinPosition.y / height * 100) + "%";
    joinLink.style.width = (1 / width * 100) + "%";
    joinLink.style.height = (memberHexHeight / height * 100) + "%";
    joinArrow.className = "axis-arrow-icon";
    joinArrow.setAttribute("aria-hidden", "true");
    joinLink.appendChild(joinArrow);

    outline.classList.add("member-stack-outline");
    outline.setAttribute("viewBox", "0 0 " + width * 100 + " " + height * 100);
    outline.setAttribute("preserveAspectRatio", "none");
    outline.setAttribute("aria-hidden", "true");
    gradient.id = gradientId;
    gradient.setAttribute("gradientUnits", "userSpaceOnUse");
    gradient.setAttribute("x1", "0");
    gradient.setAttribute("y1", "0");
    gradient.setAttribute("x2", String(width * 100));
    gradient.setAttribute("y2", String(height * 100));
    gradientStart.setAttribute("offset", "0");
    gradientStart.classList.add("member-stack-gradient-start");
    gradientEnd.setAttribute("offset", "1");
    gradientEnd.classList.add("member-stack-gradient-end");
    gradient.append(gradientStart, gradientEnd);
    definitions.appendChild(gradient);
    path.setAttribute("d", memberOutlinePath(positions));
    path.setAttribute("pathLength", String(Math.max(1, positions.length * 6)));
    path.setAttribute("stroke", "url(#" + gradientId + ")");
    outline.append(definitions, path);

    stack.replaceChildren(peopleLink, cells, outline, joinLink);
    stack.classList.add("is-member-stack-ready");
  }

  function initMemberStack() {
    var stack = document.querySelector("[data-member-stack]");
    if (!stack || stack.dataset.memberStackReady === "true") return;
    stack.dataset.memberStackReady = "true";

    var fallbackMembers = memberRecordsFromFallback(stack);
    renderMemberStack(stack, fallbackMembers, fallbackMembers.length);

    var peopleUrl = new URL("people.html", window.location.href);
    fetchPage(peopleUrl).then(function (peopleDocument) {
      if (!stack.isConnected) return;
      var records = memberRecordsFromPeoplePage(peopleDocument);
      if (records.length) renderMemberStack(stack, records, records.length);
    }).catch(function () {
      // The seven current members in index.html remain as a no-network fallback.
    });
  }

  var destroyHomeWheel = function () {};

  function initHomeWheel() {
    destroyHomeWheel();

    var wheel = document.querySelector("[data-home-wheel]");
    if (!wheel) {
      destroyHomeWheel = function () {};
      return;
    }

    var logicalPanels = Array.from(
      wheel.querySelectorAll("[data-home-wheel-panel]"),
    );
    var researchIndex = logicalPanels.findIndex(function (panel) {
      return panel.dataset.homeWheelPanel === "research";
    });
    var researchLinks = Array.from(document.querySelectorAll(".research-term[href^='#research-']"));
    var desktopWheel = window.matchMedia("(min-width: 1288px)");
    var frame = 0;
    var scrollStopTimer = 0;
    var programmaticStopTimer = 0;
    var wheelTargetIndex = 0;
    var wheelGestureDistance = 0;
    var wheelGestureStartIndex = 0;
    var lastWheelDirection = 1;
    var loopJumping = false;
    var updatingMetrics = false;
    var resizeObserver = null;

    if (logicalPanels.length < 2 || researchIndex < 0) {
      destroyHomeWheel = function () {};
      return;
    }

    logicalPanels.forEach(function (panel, index) {
      panel.dataset.wheelIndex = String(index);
    });

    function panelIndex(panel) {
      var index = Number(panel && panel.dataset.wheelIndex);
      return Number.isInteger(index) ? index : 0;
    }

    function createLoopClone(panel, position, index) {
      var clone = panel.cloneNode(true);
      clone.classList.add("home-wheel-clone");
      clone.dataset.wheelClone = position;
      clone.dataset.wheelIndex = String(index);
      clone.removeAttribute("data-home-wheel-panel");
      clone.removeAttribute("aria-labelledby");
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("inert", "");
      clone.style.viewTransitionName = "none";

      clone.querySelectorAll("[id]").forEach(function (node) {
        node.removeAttribute("id");
      });
      clone.querySelectorAll("[style]").forEach(function (node) {
        node.style.viewTransitionName = "none";
      });
      clone.querySelectorAll(".section-heading h2").forEach(function (node) {
        node.style.viewTransitionName = "none";
      });
      clone.querySelectorAll("a, button, input, select, textarea, [tabindex]").forEach(function (node) {
        node.setAttribute("tabindex", "-1");
      });
      return clone;
    }

    var leadingClones = logicalPanels.map(function (panel, index) {
      return createLoopClone(panel, "before", index);
    });
    var trailingClones = logicalPanels.map(function (panel, index) {
      return createLoopClone(panel, "after", index);
    });
    var leadingFragment = document.createDocumentFragment();
    leadingClones.forEach(function (clone) {
      leadingFragment.appendChild(clone);
    });
    wheel.insertBefore(leadingFragment, logicalPanels[0]);
    trailingClones.forEach(function (clone) {
      wheel.appendChild(clone);
    });

    function createDepthLayer(position) {
      var layer = document.createElement("div");
      layer.className = "home-wheel-depth home-wheel-depth-" + position;
      layer.setAttribute("aria-hidden", "true");
      layer.setAttribute("inert", "");
      return layer;
    }

    var topDepthLayer = createDepthLayer("top");
    var bottomDepthLayer = createDepthLayer("bottom");
    wheel.prepend(topDepthLayer);
    wheel.append(bottomDepthLayer);

    var physicalPanels = leadingClones.concat(logicalPanels, trailingClones);

    function resetPanelMotion() {
      physicalPanels.forEach(function (panel) {
        [
          "--wheel-panel-y",
          "--wheel-panel-tilt",
          "--wheel-panel-scale",
          "--wheel-panel-opacity",
          "--wheel-panel-blur",
        ].forEach(function (property) {
          panel.style.removeProperty(property);
        });
      });
    }

    function renderWheel() {
      frame = 0;
      if (!desktopWheel.matches || !wheel.classList.contains("is-wheel-ready")) {
        resetPanelMotion();
        delete wheel.dataset.wheelPosition;
        return;
      }

      var closestPanel = physicalPanels.reduce(function (closest, panel) {
        return Math.abs(panelScrollTop(panel) - wheel.scrollTop) <
          Math.abs(panelScrollTop(closest) - wheel.scrollTop)
          ? panel
          : closest;
      }, physicalPanels[0]);
      wheelTargetIndex = panelIndex(closestPanel);
      wheel.dataset.wheelPosition =
        logicalPanels[wheelTargetIndex].dataset.homeWheelPanel ||
        String(wheelTargetIndex);

      if (reduceMotion.matches) {
        resetPanelMotion();
        return;
      }

      var panelSpan = Math.max(1, logicalPanels[0].offsetHeight);
      physicalPanels.forEach(function (panel) {
        var distance = (panelScrollTop(panel) - wheel.scrollTop) / panelSpan;
        var absoluteDistance = Math.abs(distance);
        var boundedDistance = Math.max(-1, Math.min(1, distance));
        var magnitude = Math.abs(boundedDistance);
        var incoming = boundedDistance >= 0;
        var panelY = incoming
          ? 20 * boundedDistance
          : 26 * boundedDistance;
        var panelTilt = incoming
          ? 6 * boundedDistance
          : 4.5 * boundedDistance;
        var panelScale = 1 - (incoming ? 0.045 : 0.035) * magnitude;
        var focusFalloff = Math.pow(magnitude, 1.35);
        var panelOpacity =
          absoluteDistance > 1.12
            ? 0
            : 1 - (incoming ? 0.64 : 0.58) * focusFalloff;
        var panelBlur =
          absoluteDistance > 1.12
            ? 0
            : 5.5 * Math.pow(Math.max(0, magnitude - 0.08) / 0.92, 1.2);

        panel.style.setProperty("--wheel-panel-y", panelY.toFixed(2) + "px");
        panel.style.setProperty("--wheel-panel-tilt", panelTilt.toFixed(2) + "deg");
        panel.style.setProperty("--wheel-panel-scale", panelScale.toFixed(4));
        panel.style.setProperty("--wheel-panel-opacity", panelOpacity.toFixed(3));
        panel.style.setProperty("--wheel-panel-blur", panelBlur.toFixed(2) + "px");
      });
    }

    function requestWheelRender() {
      if (frame) return;
      frame = window.requestAnimationFrame(renderWheel);
    }

    function panelContentHeight(panel) {
      var children = Array.from(panel.children).filter(function (child) {
        return child.offsetHeight > 0;
      });
      if (!children.length) return 0;
      var top = Math.min.apply(
        null,
        children.map(function (child) {
          return child.offsetTop;
        }),
      );
      var bottom = Math.max.apply(
        null,
        children.map(function (child) {
          return child.offsetTop + child.offsetHeight;
        }),
      );
      return bottom - top;
    }

    function syncPublicationCardHeight() {
      wheel.style.removeProperty("--home-publication-card-height");
      var cards = logicalPanels.flatMap(function (panel) {
        return Array.from(
          panel.querySelectorAll(".home-publication-grid > .card-link .card"),
        );
      });
      if (!cards.length) return;
      var cardHeight = Math.ceil(
        Math.max.apply(
          null,
          cards.map(function (card) {
            return card.offsetHeight;
          }),
        ),
      );
      wheel.style.setProperty(
        "--home-publication-card-height",
        cardHeight + "px",
      );
    }

    function updateMetrics() {
      if (updatingMetrics) return;
      if (!desktopWheel.matches) {
        wheel.classList.remove(
          "is-wheel-ready",
          "is-wheel-moving",
          "is-wheel-programmatic",
          "is-wheel-resetting",
        );
        wheel.style.removeProperty("--home-wheel-height");
        wheel.style.removeProperty("--home-wheel-step-height");
        wheel.style.removeProperty("--home-publication-card-height");
        wheel.removeAttribute("tabindex");
        wheel.scrollTop = 0;
        wheelTargetIndex = 0;
        wheelGestureDistance = 0;
        resetPanelMotion();
        delete wheel.dataset.wheelPosition;
        return;
      }

      updatingMetrics = true;
      wheel.classList.add("is-wheel-ready");
      syncPublicationCardHeight();
      var contentHeight = Math.max.apply(
        null,
        logicalPanels.map(panelContentHeight),
      );
      var stepHeight = Math.max(260, Math.ceil(contentHeight + 28));
      wheel.style.setProperty(
        "--home-wheel-step-height",
        stepHeight + "px",
      );
      var availableHeight = Math.max(
        520,
        Math.floor(window.innerHeight - wheel.getBoundingClientRect().top),
      );
      var wheelHeight = Math.min(
        availableHeight,
        Math.max(560, Math.round(stepHeight * 2.05)),
      );
      wheel.style.setProperty(
        "--home-wheel-height",
        wheelHeight + "px",
      );
      wheel.setAttribute("tabindex", "0");

      jumpToPanel(logicalPanels[wheelTargetIndex]);
      requestWheelRender();
      updatingMetrics = false;
    }

    function jumpToScrollPosition(top) {
      if (!wheel.isConnected) return;
      loopJumping = true;
      wheel.classList.add("is-wheel-resetting");
      wheel.scrollTop = top;
      wheel.getBoundingClientRect();
      wheel.classList.remove("is-wheel-resetting");
      loopJumping = false;
      requestWheelRender();
    }

    function jumpToPanel(panel) {
      if (!panel) return;
      jumpToScrollPosition(panelScrollTop(panel));
    }

    function panelScrollTop(panel) {
      return (
        panel.offsetTop -
        (wheel.clientHeight - panel.offsetHeight) / 2
      );
    }

    function loopCycleHeight() {
      return (
        panelScrollTop(trailingClones[0]) -
        panelScrollTop(logicalPanels[0])
      );
    }

    function normalizedLoopTop(top) {
      var cycleStart = panelScrollTop(logicalPanels[0]);
      var cycleHeight = loopCycleHeight();
      if (cycleHeight <= 0) return top;

      return (
        cycleStart +
        ((top - cycleStart) % cycleHeight + cycleHeight) % cycleHeight
      );
    }

    function recenterLoopContinuously() {
      if (
        loopJumping ||
        !desktopWheel.matches ||
        !wheel.classList.contains("is-wheel-ready")
      ) {
        return;
      }

      var cycleHeight = loopCycleHeight();
      if (cycleHeight <= 0) return;

      var normalizedTop = normalizedLoopTop(wheel.scrollTop);
      if (Math.abs(normalizedTop - wheel.scrollTop) > 0.5) {
        jumpToScrollPosition(normalizedTop);
      }
    }

    function recenterLoopAtRest() {
      recenterLoopContinuously();
    }

    function scrollToPanel(panel, targetIndex) {
      if (!panel) return;
      wheelTargetIndex =
        typeof targetIndex === "number"
          ? targetIndex
          : panelIndex(panel);
      wheel.classList.add("is-wheel-programmatic");
      window.clearTimeout(programmaticStopTimer);
      wheel.scrollTo({
        top: panelScrollTop(panel),
        behavior: reduceMotion.matches ? "auto" : "smooth",
      });
      if (reduceMotion.matches) {
        window.requestAnimationFrame(function () {
          finishProgrammaticScroll();
        });
      } else {
        programmaticStopTimer = window.setTimeout(
          finishProgrammaticScroll,
          700,
        );
      }
    }

    function moveWheel(targetIndex) {
      var normalizedIndex =
        ((targetIndex % logicalPanels.length) + logicalPanels.length) %
        logicalPanels.length;
      scrollToPanel(logicalPanels[normalizedIndex], normalizedIndex);
    }

    function stepWheel(direction) {
      if (direction > 0) {
        if (wheelTargetIndex === logicalPanels.length - 1) {
          scrollToPanel(trailingClones[0], 0);
        } else {
          scrollToPanel(
            logicalPanels[wheelTargetIndex + 1],
            wheelTargetIndex + 1,
          );
        }
      } else {
        if (wheelTargetIndex === 0) {
          scrollToPanel(
            leadingClones[logicalPanels.length - 1],
            logicalPanels.length - 1,
          );
        } else {
          scrollToPanel(
            logicalPanels[wheelTargetIndex - 1],
            wheelTargetIndex - 1,
          );
        }
      }
    }

    function nearestRestPanel() {
      var candidates = logicalPanels.concat(trailingClones[0]);
      var closestDistance = Infinity;
      var closestPanels = [];

      candidates.forEach(function (panel) {
        var distance = Math.abs(panelScrollTop(panel) - wheel.scrollTop);
        if (distance < closestDistance - 0.5) {
          closestDistance = distance;
          closestPanels = [panel];
        } else if (Math.abs(distance - closestDistance) <= 0.5) {
          closestPanels.push(panel);
        }
      });

      if (closestPanels.length === 1) return closestPanels[0];
      return lastWheelDirection > 0
        ? closestPanels[closestPanels.length - 1]
        : closestPanels[0];
    }

    function settleWheel() {
      if (!desktopWheel.matches || !wheel.classList.contains("is-wheel-ready")) {
        return;
      }

      recenterLoopContinuously();
      var target = nearestRestPanel();
      var panelSpan = Math.max(1, logicalPanels[0].offsetHeight);
      if (
        panelIndex(target) === wheelGestureStartIndex &&
        Math.abs(wheelGestureDistance) >= 44 &&
        Math.abs(wheelGestureDistance) < panelSpan * 0.5
      ) {
        if (wheelGestureDistance > 0) {
          target =
            wheelGestureStartIndex === logicalPanels.length - 1
              ? trailingClones[0]
              : logicalPanels[wheelGestureStartIndex + 1];
        } else {
          target =
            wheelGestureStartIndex === 0
              ? leadingClones[logicalPanels.length - 1]
              : logicalPanels[wheelGestureStartIndex - 1];
        }
      }
      wheelGestureDistance = 0;
      wheel.classList.remove("is-wheel-moving");
      scrollToPanel(target, panelIndex(target));
    }

    function handleWheel(event) {
      if (
        !desktopWheel.matches ||
        !wheel.classList.contains("is-wheel-ready") ||
        event.ctrlKey
      ) {
        return;
      }

      var delta = event.deltaY;
      if (event.deltaMode === 1) {
        delta *= 16;
      } else if (event.deltaMode === 2) {
        delta *= wheel.clientHeight;
      }
      if (!Number.isFinite(delta) || Math.abs(delta) < 0.1) return;

      event.preventDefault();
      lastWheelDirection = delta > 0 ? 1 : -1;
      wheel.classList.remove("is-wheel-programmatic");
      if (!wheel.classList.contains("is-wheel-moving")) {
        wheelGestureDistance = 0;
        wheelGestureStartIndex = wheelTargetIndex;
      }
      wheelGestureDistance += delta;
      wheel.classList.add("is-wheel-moving");

      jumpToScrollPosition(
        normalizedLoopTop(wheel.scrollTop + delta),
      );

      window.clearTimeout(scrollStopTimer);
      scrollStopTimer = window.setTimeout(settleWheel, 80);
    }

    function handleScroll() {
      requestWheelRender();
    }

    function finishProgrammaticScroll() {
      if (wheel.classList.contains("is-wheel-moving")) return;
      window.clearTimeout(programmaticStopTimer);
      wheel.classList.remove("is-wheel-programmatic");
      jumpToPanel(logicalPanels[wheelTargetIndex]);
    }

    function handleScrollEnd() {
      if (wheel.classList.contains("is-wheel-moving")) return;
      window.requestAnimationFrame(finishProgrammaticScroll);
    }

    function handleKeydown(event) {
      if (event.target !== wheel) return;
      if (["ArrowDown", "PageDown"].includes(event.key)) {
        event.preventDefault();
        stepWheel(1);
      } else if (["ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        stepWheel(-1);
      } else if (event.key === "End") {
        event.preventDefault();
        moveWheel(logicalPanels.length - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        moveWheel(0);
      }
    }

    function handleResearchLink(event) {
      if (!desktopWheel.matches) return;
      event.preventDefault();
      moveWheel(researchIndex);
      var target = document.querySelector(event.currentTarget.hash);
      if (target) {
        window.history.replaceState(window.history.state, "", event.currentTarget.hash);
      }
    }

    wheel.addEventListener("wheel", handleWheel, { passive: false });
    wheel.addEventListener("scroll", handleScroll, { passive: true });
    wheel.addEventListener("scrollend", handleScrollEnd);
    wheel.addEventListener("keydown", handleKeydown);
    desktopWheel.addEventListener("change", updateMetrics);
    reduceMotion.addEventListener("change", requestWheelRender);
    researchLinks.forEach(function (link) {
      link.addEventListener("click", handleResearchLink);
    });

    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(updateMetrics);
      logicalPanels.forEach(function (panel) {
        Array.from(panel.children).forEach(function (child) {
          resizeObserver.observe(child);
        });
      });
    }
    window.addEventListener("resize", updateMetrics, { passive: true });

    updateMetrics();
    if (window.location.hash.indexOf("#research-") === 0 && desktopWheel.matches) {
      window.requestAnimationFrame(function () {
        moveWheel(researchIndex);
      });
    }

    destroyHomeWheel = function () {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(scrollStopTimer);
      window.clearTimeout(programmaticStopTimer);
      wheel.removeEventListener("wheel", handleWheel);
      wheel.removeEventListener("scroll", handleScroll);
      wheel.removeEventListener("scrollend", handleScrollEnd);
      wheel.removeEventListener("keydown", handleKeydown);
      wheel.classList.remove(
        "is-wheel-moving",
        "is-wheel-programmatic",
        "is-wheel-resetting",
      );
      desktopWheel.removeEventListener("change", updateMetrics);
      reduceMotion.removeEventListener("change", requestWheelRender);
      researchLinks.forEach(function (link) {
        link.removeEventListener("click", handleResearchLink);
      });
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener("resize", updateMetrics);
      leadingClones.forEach(function (clone) {
        clone.remove();
      });
      trailingClones.forEach(function (clone) {
        clone.remove();
      });
      topDepthLayer.remove();
      bottomDepthLayer.remove();
      logicalPanels.forEach(function (panel) {
        delete panel.dataset.wheelIndex;
      });
    };
  }

  function enhancePage() {
    var publicationList = document.querySelector("[data-publication-list]");
    enhancePublicationList(publicationList);
    document.querySelectorAll(".publication-card .card-authors").forEach(function (authors) {
      setHighlightedAuthorText(authors, authors.textContent);
    });
    initVisualParallax(document.querySelector("main") || document);
    initFeaturedScroller();
    initSectionJumps();
    initMemberStack();
    initHomeWheel();

    if (document.querySelector("[data-publication-previews]")) {
      if (window.matchMedia("(max-width: 767px)").matches) {
        buildPublicationPreviews();
      } else if ("requestIdleCallback" in window) {
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
      if (event.pointerType) logo.dataset.pendingPointerType = event.pointerType;
      if (Number.isFinite(event.pointerId)) {
        logo.dataset.pendingPointerId = String(event.pointerId);
      }
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
    function rememberMagneticPointer(event) {
      if (magneticLogo.querySelector("canvas")) return;

      if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        magneticLogo.dataset.pendingPointerX = String(event.clientX);
        magneticLogo.dataset.pendingPointerY = String(event.clientY);
      }
      if (event.pointerType) {
        magneticLogo.dataset.pendingPointerType = event.pointerType;
      }
      if (Number.isFinite(event.pointerId)) {
        magneticLogo.dataset.pendingPointerId = String(event.pointerId);
      }

      if (event.type === "pointerdown") {
        if (event.button !== 0) return;
        magneticLogo.dataset.pendingPointerDown = "true";
        loadMagneticLogo(event);
      } else if (
        (event.type === "pointerup" || event.type === "pointercancel") &&
        magneticLogo.dataset.pendingPointerId === String(event.pointerId)
      ) {
        magneticLogo.dataset.pendingPointerDown = "false";
      }
    }

    magneticLogo.addEventListener("pointerenter", loadMagneticLogo, {
      once: true,
      passive: true,
    });
    magneticLogo.addEventListener("pointerdown", rememberMagneticPointer, {
      passive: true,
    });
    magneticLogo.addEventListener("pointermove", rememberMagneticPointer, {
      passive: true,
    });
    magneticLogo.addEventListener("pointerup", rememberMagneticPointer, {
      passive: true,
    });
    magneticLogo.addEventListener("pointercancel", rememberMagneticPointer, {
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
        if (magneticLogo.dataset.pendingPointerDown === "true") return;
        delete magneticLogo.dataset.pendingPointerX;
        delete magneticLogo.dataset.pendingPointerY;
        delete magneticLogo.dataset.pendingPointerType;
        delete magneticLogo.dataset.pendingPointerId;
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
