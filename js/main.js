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
