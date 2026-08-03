/* GLOW Lab — site interactions + generative hero */

(function () {
  "use strict";

  /* ---------- Header: solid background after scrolling ---------- */

  const header = document.querySelector(".site-header");
  const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile navigation ---------- */

  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    links.addEventListener("click", (e) => {
      if (e.target.closest("a")) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Reveal on scroll ---------- */

  const revealed = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealed.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealed.forEach((el) => io.observe(el));
  } else {
    revealed.forEach((el) => el.classList.add("visible"));
  }

  /* ---------- Home member stack ---------- */

  const MEMBER_LIMIT = 16;
  const MEMBER_ROW_SIZE = 9;
  const MEMBER_HEX_HEIGHT = 2 / Math.sqrt(3);
  const MEMBER_ROW_OFFSET = MEMBER_HEX_HEIGHT * 0.75;
  let memberStackRenderId = 0;

  function memberRecordsFromPage(scope) {
    return Array.from(scope.querySelectorAll("[data-member-record]"))
      .map((card) => {
        const avatar = card.querySelector("[data-member-transition]");
        const heading = card.querySelector("h2, h3");
        const image = avatar?.querySelector("img");
        if (!avatar || !heading) return null;
        return {
          slug: avatar.dataset.memberTransition,
          name: heading.textContent.trim(),
          image: image?.getAttribute("src") || "",
        };
      })
      .filter(Boolean);
  }

  function memberRecordsFromFallback(stack) {
    return Array.from(stack.querySelectorAll(".member-cell[data-member-transition]")).map((cell) => ({
      slug: cell.dataset.memberTransition,
      name: cell.title || cell.dataset.memberTransition,
      image: cell.querySelector("img")?.getAttribute("src") || "",
    }));
  }

  function memberHexPoints(left, top) {
    const quarterHeight = MEMBER_HEX_HEIGHT * 0.25;
    return [
      [left + 0.5, top],
      [left + 1, top + quarterHeight],
      [left + 1, top + MEMBER_HEX_HEIGHT - quarterHeight],
      [left + 0.5, top + MEMBER_HEX_HEIGHT],
      [left, top + MEMBER_HEX_HEIGHT - quarterHeight],
      [left, top + quarterHeight],
    ];
  }

  function memberOutlinePath(positions) {
    const edges = new Map();
    const pointsByKey = new Map();
    const adjacency = new Map();
    const edgeKey = (first, second) => (first < second ? `${first}|${second}` : `${second}|${first}`);

    function connect(first, second) {
      if (!adjacency.has(first)) adjacency.set(first, new Set());
      if (!adjacency.has(second)) adjacency.set(second, new Set());
      adjacency.get(first).add(second);
      adjacency.get(second).add(first);
    }

    positions.forEach((position) => {
      const points = memberHexPoints(position.x, position.y);
      points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        const first = point.map((value) => Math.round(value * 1000) / 10);
        const second = next.map((value) => Math.round(value * 1000) / 10);
        const firstKey = first.join(",");
        const secondKey = second.join(",");
        const key = edgeKey(firstKey, secondKey);
        pointsByKey.set(firstKey, first);
        pointsByKey.set(secondKey, second);
        if (!edges.has(key)) {
          edges.set(key, [firstKey, secondKey]);
          connect(firstKey, secondKey);
        }
      });
    });

    const visited = new Set();
    const polylines = [];

    function walk(firstKey, secondKey) {
      const line = [firstKey];
      let previous = firstKey;
      let current = secondKey;
      visited.add(edgeKey(firstKey, secondKey));

      while (true) {
        line.push(current);
        const neighbors = Array.from(adjacency.get(current) || []);
        if (neighbors.length !== 2) break;
        const next = neighbors.find(
          (candidate) => candidate !== previous && !visited.has(edgeKey(current, candidate)),
        );
        if (!next) break;
        visited.add(edgeKey(current, next));
        previous = current;
        current = next;
      }
      return line;
    }

    adjacency.forEach((neighbors, pointKey) => {
      if (neighbors.size === 2) return;
      neighbors.forEach((neighborKey) => {
        if (!visited.has(edgeKey(pointKey, neighborKey))) {
          polylines.push(walk(pointKey, neighborKey));
        }
      });
    });

    edges.forEach((edge) => {
      if (!visited.has(edgeKey(edge[0], edge[1]))) {
        polylines.push(walk(edge[0], edge[1]));
      }
    });

    return polylines
      .map((line) => {
        const closed = line.length > 2 && line[0] === line[line.length - 1];
        const pointKeys = closed ? line.slice(0, -1) : line;
        const commands = pointKeys.map((pointKey, index) => {
          const point = pointsByKey.get(pointKey);
          return `${index ? "L" : "M"}${point.join(" ")}`;
        });
        return commands.join("") + (closed ? "Z" : "");
      })
      .join("");
  }

  function renderMemberStack(stack, records, totalCount) {
    const members = records.slice(0, MEMBER_LIMIT);
    if (!members.length) {
      stack.hidden = true;
      return;
    }

    const visualCount = members.length + 1;
    const positions = Array.from({ length: visualCount }, (_item, index) => {
      const row = index >= MEMBER_ROW_SIZE ? 1 : 0;
      const column = row ? index - MEMBER_ROW_SIZE : index;
      return { x: column + (row ? 0.5 : 0), y: row ? MEMBER_ROW_OFFSET : 0 };
    });
    const joinPosition = positions.at(-1);
    const topCount = Math.min(visualCount, MEMBER_ROW_SIZE);
    const bottomCount = Math.max(0, visualCount - MEMBER_ROW_SIZE);
    const width = Math.max(topCount, bottomCount ? bottomCount + 0.5 : 0);
    const height = bottomCount ? MEMBER_HEX_HEIGHT + MEMBER_ROW_OFFSET : MEMBER_HEX_HEIGHT;
    const svgNamespace = "http://www.w3.org/2000/svg";
    const gradientId = `member-stack-gradient-${++memberStackRenderId}`;

    const peopleLink = document.createElement("a");
    peopleLink.className = "member-stack-people";
    peopleLink.href = "people.html";
    peopleLink.setAttribute(
      "aria-label",
      `Meet ${totalCount} ${totalCount === 1 ? "member" : "members"} of GLOW Lab`,
    );

    const cells = document.createElement("span");
    cells.className = "member-stack-cells";
    cells.setAttribute("aria-hidden", "true");
    members.forEach((member, index) => {
      const cell = document.createElement("span");
      const position = positions[index];
      cell.className = `member-avatar member-cell${member.image ? " member-photo" : ""}`;
      cell.dataset.memberTransition = member.slug;
      cell.title = member.name;
      cell.style.left = `${(position.x / width) * 100}%`;
      cell.style.top = `${(position.y / height) * 100}%`;
      cell.style.width = `${(1 / width) * 100}%`;
      cell.style.height = `${(MEMBER_HEX_HEIGHT / height) * 100}%`;

      if (member.image) {
        const image = document.createElement("img");
        image.src = member.image;
        image.alt = "";
        image.decoding = "async";
        cell.appendChild(image);
      }
      cells.appendChild(cell);
    });

    const joinLink = document.createElement("a");
    joinLink.className = "member-stack-join";
    joinLink.dataset.axisArrowTrigger = "";
    joinLink.href = "join.html";
    joinLink.setAttribute("aria-label", "Join GLOW Lab");
    joinLink.style.left = `${(joinPosition.x / width) * 100}%`;
    joinLink.style.top = `${(joinPosition.y / height) * 100}%`;
    joinLink.style.width = `${(1 / width) * 100}%`;
    joinLink.style.height = `${(MEMBER_HEX_HEIGHT / height) * 100}%`;
    const joinArrow = document.createElement("span");
    joinArrow.className = "axis-arrow-icon";
    joinArrow.setAttribute("aria-hidden", "true");
    joinLink.appendChild(joinArrow);

    const outline = document.createElementNS(svgNamespace, "svg");
    outline.classList.add("member-stack-outline");
    outline.setAttribute("viewBox", `0 0 ${width * 100} ${height * 100}`);
    outline.setAttribute("preserveAspectRatio", "none");
    outline.setAttribute("aria-hidden", "true");
    const definitions = document.createElementNS(svgNamespace, "defs");
    const gradient = document.createElementNS(svgNamespace, "linearGradient");
    gradient.id = gradientId;
    gradient.setAttribute("gradientUnits", "userSpaceOnUse");
    gradient.setAttribute("x1", "0");
    gradient.setAttribute("y1", "0");
    gradient.setAttribute("x2", String(width * 100));
    gradient.setAttribute("y2", String(height * 100));
    const gradientStart = document.createElementNS(svgNamespace, "stop");
    gradientStart.setAttribute("offset", "0");
    gradientStart.classList.add("member-stack-gradient-start");
    const gradientEnd = document.createElementNS(svgNamespace, "stop");
    gradientEnd.setAttribute("offset", "1");
    gradientEnd.classList.add("member-stack-gradient-end");
    gradient.append(gradientStart, gradientEnd);
    definitions.appendChild(gradient);
    const path = document.createElementNS(svgNamespace, "path");
    path.setAttribute("d", memberOutlinePath(positions));
    path.setAttribute("stroke", `url(#${gradientId})`);
    outline.append(definitions, path);

    stack.hidden = false;
    stack.style.setProperty("--member-stack-width", String(width));
    stack.style.setProperty("--member-stack-height", String(height));
    stack.replaceChildren(peopleLink, cells, outline, joinLink);
    stack.classList.add("is-member-stack-ready");
  }

  function initMemberStack() {
    const stack = document.querySelector("[data-member-stack]");
    if (!stack) return;
    const fallbackMembers = memberRecordsFromFallback(stack);
    renderMemberStack(stack, fallbackMembers, fallbackMembers.length);

    fetch("people.html")
      .then((response) => {
        if (!response.ok) throw new Error(`People page returned ${response.status}`);
        return response.text();
      })
      .then((html) => {
        if (!stack.isConnected) return;
        const peopleDocument = new DOMParser().parseFromString(html, "text/html");
        const records = memberRecordsFromPage(peopleDocument);
        if (records.length) renderMemberStack(stack, records, records.length);
      })
      .catch(() => {
        // Keep the inline fallback so the stack also works offline.
      });
  }

  initMemberStack();

  /* ---------- Hero: a slowly turning generative world ----------
     A fibonacci-lattice point sphere with gentle noise displacement,
     rendered with pre-baked glow sprites. Static frame if the user
     prefers reduced motion. */

  const canvas = document.getElementById("world-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const COLORS = ["#0d9488", "#4f46e5", "#9333ea"];
  const N_POINTS = 520;
  const N_DUST = 90;

  // Pre-render one soft-dot sprite per color: solid core fading out, so the
  // points stay saturated on the light background.
  const sprites = COLORS.map((color) => {
    const s = document.createElement("canvas");
    s.width = s.height = 64;
    const sc = s.getContext("2d");
    const g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color);
    g.addColorStop(0.45, color);
    g.addColorStop(1, "rgba(255,255,255,0)");
    sc.fillStyle = g;
    sc.fillRect(0, 0, 64, 64);
    return s;
  });

  // Points on a unit sphere via fibonacci lattice.
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  const points = [];
  for (let i = 0; i < N_POINTS; i++) {
    const y = 1 - (i / (N_POINTS - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = GOLDEN * i;
    points.push({
      x: Math.cos(theta) * r,
      y,
      z: Math.sin(theta) * r,
      color: (Math.random() * 3) | 0,
      phase: Math.random() * Math.PI * 2,
      amp: 0.02 + Math.random() * 0.05,
    });
  }

  // Ambient dust drifting around the sphere.
  const dust = [];
  for (let i = 0; i < N_DUST; i++) {
    dust.push({
      a: Math.random() * Math.PI * 2,
      d: 1.25 + Math.random() * 1.4,
      y: (Math.random() - 0.5) * 2.2,
      speed: (0.02 + Math.random() * 0.05) * (Math.random() < 0.5 ? -1 : 1),
      size: 1 + Math.random() * 2.2,
      color: (Math.random() * 3) | 0,
    });
  }

  let w = 0, h = 0, dpr = 1, cx = 0, cy = 0, R = 0, dim = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const wide = w > 900;
    // On wide screens the world sits right-of-center behind the copy;
    // on small screens it floats above, behind the text.
    cx = wide ? w * 0.76 : w * 0.5;
    cy = wide ? h * 0.5 : h * 0.3;
    R = Math.min(w, h) * (wide ? 0.3 : 0.22);
    // On small screens the globe sits behind the headline — keep it subtle.
    dim = wide ? 1 : 0.45;
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);

    // Soft ambient halo behind the sphere.
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.4);
    halo.addColorStop(0, "rgba(99, 102, 241, 0.07)");
    halo.addColorStop(0.5, "rgba(147, 51, 234, 0.03)");
    halo.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    const rotY = t * 0.00008;
    const rotX = 0.42 + Math.sin(t * 0.00003) * 0.05;
    const sinY = Math.sin(rotY), cosY = Math.cos(rotY);
    const sinX = Math.sin(rotX), cosX = Math.cos(rotX);

    // Dust ring.
    for (const p of dust) {
      const a = p.a + t * 0.00004 * p.speed * 60;
      let x = Math.cos(a) * p.d;
      let z = Math.sin(a) * p.d;
      let y = p.y;
      let y2 = y * cosX - z * sinX;
      let z2 = y * sinX + z * cosX;
      const persp = 1 / (1 + z2 * 0.28);
      const px = cx + x * R * persp;
      const py = cy + y2 * R * persp;
      const size = p.size * persp * 2.6;
      ctx.globalAlpha = 0.14 * persp * dim;
      ctx.drawImage(sprites[p.color], px - size / 2, py - size / 2, size, size);
    }

    // Faint graticule rings so the point cloud reads as a globe.
    ctx.lineWidth = 1;
    for (let ring = 0; ring < 4; ring++) {
      const lat = -0.6 + ring * 0.4; // ring heights on the unit sphere
      const rr = Math.sqrt(Math.max(0, 1 - lat * lat));
      ctx.beginPath();
      let started = false;
      for (let s = 0; s <= 72; s++) {
        const a = (s / 72) * Math.PI * 2;
        let x = Math.cos(a) * rr, y = lat, z = Math.sin(a) * rr;
        let x2 = x * cosY - z * sinY;
        let z1 = x * sinY + z * cosY;
        let y2 = y * cosX - z1 * sinX;
        let z2 = y * sinX + z1 * cosX;
        const persp = 1 / (1 + z2 * 0.32);
        const px = cx + x2 * R * persp;
        const py = cy + y2 * R * persp;
        if (started) ctx.lineTo(px, py);
        else { ctx.moveTo(px, py); started = true; }
      }
      ctx.closePath();
      ctx.strokeStyle = "rgba(79, 70, 229, 0.09)";
      ctx.stroke();
    }

    // Sphere points.
    for (const p of points) {
      const wobble = 1 + Math.sin(t * 0.0011 + p.phase) * p.amp;
      let x = p.x * wobble, y = p.y * wobble, z = p.z * wobble;

      let x2 = x * cosY - z * sinY;
      let z1 = x * sinY + z * cosY;
      let y2 = y * cosX - z1 * sinX;
      let z2 = y * sinX + z1 * cosX;

      const persp = 1 / (1 + z2 * 0.32);
      const px = cx + x2 * R * persp;
      const py = cy + y2 * R * persp;

      const depth = (1 - z2) * 0.5; // 0 (far) → 1 (near)
      const size = (1.3 + depth * 4) * persp;
      ctx.globalAlpha = (0.14 + depth * 0.62) * dim;
      ctx.drawImage(sprites[p.color], px - size, py - size, size * 2, size * 2);
    }

    ctx.globalAlpha = 1;
  }

  let raf = null;
  function loop(t) {
    draw(t);
    raf = requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener("resize", () => {
    resize();
    if (reduceMotion) draw(12000);
  });

  if (reduceMotion) {
    draw(12000);
  } else {
    raf = requestAnimationFrame(loop);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = null;
      } else if (!raf) {
        raf = requestAnimationFrame(loop);
      }
    });
  }
})();
