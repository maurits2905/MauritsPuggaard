/* ------------------------------
   script.js
------------------------------ */

/* ------------------------------
   Theme
------------------------------ */
let vantaEffect = null;


function preloadImages(urls, limit = 6) {
  const list = (urls || []).filter(Boolean).slice(0, Math.max(0, limit));
  if (!list.length) return Promise.resolve();

  return Promise.all(
    list.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.loading = "eager";

          const finish = () => {
            // decode helps avoid jank when the image is first painted
            if (img.decode) {
              img
                .decode()
                .catch(() => {})
                .finally(resolve);
            } else {
              resolve();
            }
          };

          img.onload = finish;
          img.onerror = resolve;
          img.src = src;
        }),
    ),
  ).then(() => undefined);
}

function setTheme(next) {
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);

  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = next === "light" ? "☀" : "☾";

  applyThemeToBackground(next);
  window.dispatchEvent(new Event("themechange"));
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) return setTheme(saved);

  // First visit = always dark
  setTheme("dark");
}

function applyThemeToBackground(theme) {
  const isLight = theme === "light";

  // ✅ SAME line color in both modes
  // ✅ Only the background changes
  const options = {
    color: 0x9b8cff, // purple lines always
    backgroundColor: isLight ? 0xf5f6fb : 0x060711,
  };

  // If Vanta exists, try updating it
  if (vantaEffect && typeof vantaEffect.setOptions === "function") {
    vantaEffect.setOptions(options);
    return;
  }

  // Otherwise rebuild
  if (vantaEffect && typeof vantaEffect.destroy === "function") {
    vantaEffect.destroy();
  }
}

/* ------------------------------
   Background (Vanta NET)
------------------------------ */
function initBackground() {
  // If we use the "stars" design, skip Vanta completely
  const bgMode = document.body.getAttribute("data-bg");
  if (bgMode === "stars") return;

  const reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  const theme = document.documentElement.getAttribute("data-theme") || "dark";
  applyThemeToBackground(theme);
}

/* ------------------------------
   Background Fade
------------------------------ */

function initDeepFade() {
  // Start blending as we approach the FIRST content section
  const triggerEl =
    document.getElementById("projects") ||
    document.getElementById("skills") ||
    document.getElementById("career");
  if (!triggerEl) return;

  let raf = 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function update() {
    raf = 0;

    const r = triggerEl.getBoundingClientRect();

    // Start the fade while the trigger is still below the viewport,
    // so the hero -> content transition feels continuous.
    const start = window.innerHeight * 1.15; // earlier than before
    const end = window.innerHeight * 0.35; // finish sooner
    const t = (start - r.top) / (start - end);

    const progress = clamp(t, 0, 1);
    document.documentElement.style.setProperty("--deep", progress.toFixed(3));
  }

  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  window.addEventListener("themechange", update);

  update();
}

/* ------------------------------
   Header pill nav (active bubble)
------------------------------ */
function initHeaderPillNav() {
  const nav = document.getElementById("pillNav");
  const active = document.getElementById("pillActive");
  if (!nav || !active) return;

  const track = nav.querySelector(".pillTrack");
  const links = Array.from(nav.querySelectorAll(".pillLink"));
  if (!track || !links.length) return;

  const getNavOffset = () => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--navH")
      .trim();
    const n = Number.parseFloat(raw || "92");
    return Number.isFinite(n) ? n : 92;
  };

  function setActiveLink(link, immediate = false) {
    if (!link) return;

    links.forEach((a) => a.classList.toggle("isActive", a === link));

    const r = link.getBoundingClientRect();
    const tr = track.getBoundingClientRect();
    const x = r.left - tr.left;
    const w = r.width;

    nav.style.setProperty("--pill-x", `${x}px`);
    nav.style.setProperty("--pill-w", `${w}px`);

    if (immediate) {
      active.style.transition = "none";
      active.offsetHeight; // reflow
      active.style.transition = "";
    }

    nav.dataset.ready = "1";
  }

  // Map links -> target elements (must match ids)
  const targets = links
    .map((a) => {
      const id = a.dataset.target || (a.getAttribute("href") || "").slice(1);
      const el = id ? document.getElementById(id) : null;
      return { link: a, id, el };
    })
    .filter((x) => x.el);

  if (!targets.length) return;

  let lockUntil = 0;
  let lockId = "";

  // Pick active section based on a "scan line" just under the fixed header
  function pickActiveFromScroll() {
    // Prevent tiny back-and-forth changes while our smooth scroll is running
    if (performance.now() < lockUntil) return;

    const line = getNavOffset() + 22; // px from top of viewport
    let best = targets[0];

    for (const t of targets) {
      const r = t.el.getBoundingClientRect();
      if (r.top <= line) best = t;
    }

    if (best) setActiveLink(best.link);
  }

  // Smooth-scroll with header offset
  function scrollToTarget(id) {
    const el = document.getElementById(id);
    if (!el) return;

    // Target the first heading/content child so we land at visible content,
    // not in the blank padding-top that precedes it.
    const heading = el.querySelector(
      'h1, h2, .workHead, .techHead, .askHead, .careerTitle, .abtInner, .heroContent'
    );
    const anchor = heading || el;

    const y = anchor.getBoundingClientRect().top + window.scrollY - getNavOffset() - 24;

    window.scrollTo({
      top: Math.max(0, Math.round(y)),
      behavior: "smooth",
    });
  }

  // Click handling: prevent default jump and do offset scroll
  links.forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.dataset.target || (a.getAttribute("href") || "").slice(1);
      const el = id ? document.getElementById(id) : null;
      if (!id || !el) return;

      e.preventDefault();

      // Lock scroll-based updates briefly so the bubble doesn't "correct" mid-scroll
      lockId = id;
      lockUntil = performance.now() + 700;

      // Move bubble smoothly (no instant snap)
      setActiveLink(a, false);

      // Update URL hash (without jumping)
      history.pushState(null, "", `#${id}`);

      // Offset scroll
      scrollToTarget(id);

      // Re-check after scroll starts (after lock expires it will settle correctly)
      requestAnimationFrame(() => requestAnimationFrame(pickActiveFromScroll));
    });
  });

  // Handle manual hash changes / back-forward
  window.addEventListener("hashchange", () => {
    const id = (location.hash || "").slice(1);
    const match = targets.find((t) => t.id === id);
    if (match) setActiveLink(match.link, true);
  });

  let raf = 0;
  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      pickActiveFromScroll();
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", pickActiveFromScroll, { passive: true });
  window.addEventListener("load", () => {
    // If page loads with a hash, align it nicely
    const id = (location.hash || "").slice(1);
    if (id && document.getElementById(id)) {
      // Don’t “smooth” on initial load; just jump correctly once
      const secEl = document.getElementById(id);
      const secHeading = secEl.querySelector(
        "h1, h2, .workHead, .techHead, .askHead, .careerTitle, .abtInner, .heroContent"
      );
      const secAnchor = secHeading || secEl;
      const y = secAnchor.getBoundingClientRect().top + window.scrollY - getNavOffset() - 24;
      window.scrollTo(0, Math.max(0, Math.round(y)));
    }
    pickActiveFromScroll();
  });

  requestAnimationFrame(pickActiveFromScroll);
}

/* ------------------------------
   Scroll story (pinned)
------------------------------ */
function initStory() {
  const reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  const isMobile =
    window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
  const storyEl = document.getElementById("story");

  if (!storyEl) return;

  if (isMobile) {
    storyEl.classList.add("storyStatic");
    return;
  } else {
    storyEl.classList.remove("storyStatic");
  }

  gsap.registerPlugin(ScrollTrigger);

  // Scene start states
  gsap.set("#sceneWhat", { autoAlpha: 0, y: 20 });
  gsap.set("#sceneDoCards", { autoAlpha: 0, y: 20 });

  gsap.set("#sceneHero", { autoAlpha: 1, y: 0 });
  gsap.set("#sceneRole", { autoAlpha: 1, y: 0 });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: "#story",
      start: "top top",
      end: "+=2200",
      scrub: true,
      pin: true,
      anticipatePin: 1,
    },
  });

  // --- Start the pinned story "already past" the intro ---
  const INTRO_SKIP_PX = 420; // try 350-650

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const st = tl.scrollTrigger;
      if (!st) return;

      window.scrollTo(0, st.start + INTRO_SKIP_PX);
      st.update();
    });
  });

  // Phase B: avatar moves center -> left, about appears
  tl.to(
    "#avatarStage",
    { xPercent: -55, scale: 0.92, duration: 0.35, ease: "none" },
    0.28,
  )
    .to("#sceneRole", { autoAlpha: 0, y: -10, duration: 0.18 }, 0.3)
    .to("#about", { autoAlpha: 1, y: 0, duration: 0.28 }, 0.34)
    .to("#sceneHero", { autoAlpha: 0.85, duration: 0.2 }, 0.36);

  // Phase C: transition to WHAT I DO + cards
  tl.to("#about", { autoAlpha: 0, y: -10, duration: 0.2 }, 0.58)
    .to("#sceneHero", { autoAlpha: 0, y: -10, duration: 0.22 }, 0.58)
    .to("#sceneWhat", { autoAlpha: 1, y: 0, duration: 0.24 }, 0.62)
    .to("#sceneDoCards", { autoAlpha: 1, y: 0, duration: 0.24 }, 0.64)
    .to(
      "#avatarStage",
      { xPercent: -62, scale: 0.88, duration: 0.25, ease: "none" },
      0.64,
    );
}

/* ------------------------------
   Projects rendering
------------------------------ */
const WORK_PREVIEW = 3; // cards shown before "Show more"

const state = {
  projects: [],
  tags: [],
  query: "",
  workEntered: false,
  workExpanded: false,
  activeTag: "All",
};

function prefersReducedMotion() {
  return (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* Signal Bridges — animate the section dividers on scroll */
function initSecBridges() {
  const bridges = document.querySelectorAll(".secBridge");
  if (!bridges.length) return;

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("sb-live");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );

  bridges.forEach((b) => obs.observe(b));
}


function initReveals() {
  const isMobile = window.matchMedia("(max-width: 900px)").matches;

  // On mobile Safari, scroll/reveal triggers can fail and leave sections invisible.
  // So: disable reveal animations on mobile and force everything visible.
  if (isMobile) {
    document
      .querySelectorAll(".r")
      .forEach((el) => el.classList.add("noReveal"));
    return;
  }

  const els = Array.from(
    document.querySelectorAll(".section .r, .ask-reveal .r, .careerHead.r, .workHead .r"),
  );
  if (!els.length) return;

  // If reduced motion OR GSAP not available: show everything immediately
  if (prefersReducedMotion() || !window.gsap || !window.ScrollTrigger) {
    document.documentElement.classList.add("noReveal");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Reveal on scroll
  els.forEach((el) => {
    gsap.to(el, {
      autoAlpha: 1,
      y: 0,
      duration: 0.75,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 85%" },
    });
  });
}

/* ── About section: scroll-driven card reveal ────────────────────────────
   Scroll range tuning:
     start  "top bottom+=120"  — fires ~120 px before the about section
                                  enters the viewport, i.e. while the user
                                  is still scrolling through the hero.
                                  On a full-height hero this clamps to
                                  scrollY ≈ 0, so the card is already in
                                  its initial state on page load and begins
                                  rising the instant the user scrolls.
     end    "top 60%"          — card fully settled when about's top is
                                  60 % down from the viewport top — roughly
                                  half the previous range → ~40 % faster.
     scrub  0.65               — lighter lag for a more immediate,
                                  responsive feel without losing smoothness.

   Transform range:
     from  translateY(140px) scale(0.87) opacity(0.45)  ← more dramatic
     to    translateY(0)     scale(1.00) opacity(1.00)
─────────────────────────────────────────────────────────────────────── */
function initAboutReveal() {
  // No-op: about section uses CSS entry animation only
}

/* ── Expertise showcase — canvas particle morphing ───────────────────────
   Three states (Professional / SAP / Fullstack) with smooth spring-based
   morphing between distinct particle formations.

   Shapes
   ──────
   Professional  4 concentric orbital rings + centre cluster
   SAP           "S" letterform rasterised from offscreen canvas
   Fullstack     5 stacked trapezoid layers (narrow→wide, like a tech stack)

   Physics
   ───────
   Each particle springs toward its target position with slight ambient drift.
   Spring k = 0.048 / damp = 0.884 → ~1.4 s settling, no overshoot.

   Auto-advance every 4 s; pauses 10 s after user click.
─────────────────────────────────────────────────────────────────────── */
function initShowcase() {
  const canvas = document.getElementById('showcaseCanvas');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const DPR    = Math.min(window.devicePixelRatio || 1, 2);
  const TWO_PI = Math.PI * 2;

  /* ── Sizing ── */
  let CW, CH;
  function resize() {
    const r = canvas.getBoundingClientRect();
    CW = r.width; CH = r.height;
    canvas.width  = Math.round(CW * DPR);
    canvas.height = Math.round(CH * DPR);
  }
  resize();

  const isMob  = CW < 680;
  const N_TOT  = isMob ? 1200 : 2400;
  const N_FORM = isMob ?  960 : 1920;  // 80 % form the icon

  /* ── State metadata ── */
  const STATES = [
    { title: 'Trusted to deliver',
      desc:  'Enterprise precision, modern instincts. The full picture unfolds below.' },
    { title: 'Enterprise ready',
      desc:  'Deep expertise across S/4HANA, BTP, ABAP, and the full SAP stack.' },
    { title: 'Built end-to-end',
      desc:  'From database to UI — one developer, complete ownership.' },
  ];

  /* ══════════════════════════════════════════════════════════════════
     Shape generators — return Float32Array[n * 2]
     Shapes match the reference icons (layers / SAP logo / circles)
  ══════════════════════════════════════════════════════════════════ */

  /* Fullstack (idx 2): stacked-layers icon — three 3-D disc plates.
     Each plate = top-face ellipse rim + sparse fill + visible front bottom-edge arc.
     The flat perspective ellipses (rx >> ry) make the depth immediately readable. */
  function genProfessional(W, H, n) {
    const cx      = W * 0.50;
    const cy      = H * 0.50;
    // Cap rx so plates keep a ~3.5:1 aspect ratio on any screen width.
    const rx      = Math.min(W * 0.285, H * 0.252);
    const ryTop   = H * 0.068;     // top-face vertical radius (flat = 3-D look)
    const thick   = H * 0.032;     // plate thickness (thin edge below top face)
    // spacing must be > thick + 2*ryTop (= ~0.168H) to leave whitespace.
    // 0.230H gives a clean ~0.030H gap between the bottom arc and the next rim.
    const spacing = H * 0.230;

    const plateCy = [cy - spacing, cy, cy + spacing]; // top → middle → bottom

    const RIM_FRAC  = 0.58;  // top-ellipse perimeter
    const FILL_FRAC = 0.20;  // top-ellipse fill
    // remainder → bottom-edge front arc

    const out      = [];
    const perPlate = Math.floor(n / 3);

    for (let p = 0; p < 3; p++) {
      const pcy = plateCy[p];
      const cnt = p < 2 ? perPlate : n - 2 * perPlate;

      const rimCnt  = Math.floor(cnt * RIM_FRAC);
      const fillCnt = Math.floor(cnt * FILL_FRAC);
      const edgeCnt = cnt - rimCnt - fillCnt;

      /* ── Top-face rim (full ellipse perimeter, slight thickness scatter) ── */
      for (let i = 0; i < rimCnt; i++) {
        const a  = Math.random() * TWO_PI;
        const th = 1 + (Math.random() - 0.5) * 0.07;
        out.push(cx + Math.cos(a) * rx * th, pcy + Math.sin(a) * ryTop * th);
      }

      /* ── Top-face fill (sparse, uniform in ellipse) ── */
      for (let i = 0; i < fillCnt; i++) {
        const r = Math.sqrt(Math.random()) * 0.90;
        const a = Math.random() * TWO_PI;
        out.push(cx + Math.cos(a) * rx * r, pcy + Math.sin(a) * ryTop * r);
      }

      /* ── Bottom-edge arc — front/lower half only (angles 0…π = positive sin)
            offset down by `thick` so it peeks below the top face             ── */
      for (let i = 0; i < edgeCnt; i++) {
        const a  = Math.random() * Math.PI;          // 0..π → lower semi-ellipse
        const th = 1 + (Math.random() - 0.5) * 0.07;
        out.push(
          cx + Math.cos(a) * rx * th,
          pcy + thick + Math.sin(a) * ryTop * 0.85 * th
        );
      }
    }

    const arr = new Float32Array(n * 2);
    arr.set(out.slice(0, n * 2));
    return arr;
  }

  /* SAP logo — renders the actual "SAP" wordmark onto an offscreen canvas
     and samples the filled pixels as particle targets.  This is literally
     the SAP logo text, so it cannot be wrong.                              */
  function genSAP(W, H, n) {
    const cx = W * 0.5, cy = H * 0.5;

    /* offscreen canvas sized to ~60 % of the showcase area */
    const offW = Math.round(Math.min(W * 0.62, H * 1.6));
    const offH = Math.round(offW * 0.38);   // ~2.6:1 aspect — matches SAP wordmark

    const off  = document.createElement('canvas');
    off.width  = offW;
    off.height = offH;
    const oc   = off.getContext('2d');

    const fs = Math.round(offH * 0.82);
    oc.font         = `900 ${fs}px Arial Black, Arial, sans-serif`;
    oc.textBaseline = 'middle';
    oc.textAlign    = 'center';
    oc.fillStyle    = '#ffffff';
    oc.fillText('SAP', offW * 0.5, offH * 0.5);

    /* collect lit pixels — subsample for performance */
    const imgd = oc.getImageData(0, 0, offW, offH).data;
    const pool = [];
    const step = 2;   // check every 2nd pixel — still plenty of density
    for (let y = 0; y < offH; y += step) {
      for (let x = 0; x < offW; x += step) {
        if (imgd[(y * offW + x) * 4 + 3] > 64) pool.push([x, y]);
      }
    }

    /* offset so the text is centred on the canvas */
    const ox = cx - offW * 0.5;
    const oy = cy - offH * 0.5;

    const out = [];
    for (let i = 0; i < n; i++) {
      const p = pool[Math.floor(Math.random() * pool.length)];
      out.push(
        ox + p[0] + (Math.random() - 0.5) * 1.6,
        oy + p[1] + (Math.random() - 0.5) * 1.6
      );
    }

    const arr = new Float32Array(n * 2);
    arr.set(out.slice(0, n * 2));
    return arr;
  }

  /* Fullstack: 3 overlapping solid circles matching the connected-nodes reference icon.
     Circles are slightly overlapping (dist = 1.75 × radius) for a tight cluster feel. */
  function genFullstack(W, H, n) {
    const cx = W * 0.5, cy = H * 0.5;
    const cr   = Math.min(W * 0.135, H * 0.155);  // circle radius — ~23 % larger
    const dist = cr * 2.50;                         // centres — clear gap between circles
    const h3   = dist * Math.sqrt(3) * 0.5;
    const nodes = [
      [cx,            cy - h3 * (2 / 3)],   // top
      [cx - dist*0.5, cy + h3 * (1 / 3)],   // bottom-left
      [cx + dist*0.5, cy + h3 * (1 / 3)],   // bottom-right
    ];
    const out    = [];
    const perNode = Math.floor(n / 3);
    for (let v = 0; v < 3; v++) {
      const [nx, ny] = nodes[v];
      const cnt = v < 2 ? perNode : n - 2 * perNode;
      for (let i = 0; i < cnt; i++) {
        const r = cr * Math.sqrt(Math.random());
        const a = Math.random() * TWO_PI;
        out.push(nx + Math.cos(a) * r, ny + Math.sin(a) * r);
      }
    }
    const arr = new Float32Array(n * 2);
    arr.set(out.slice(0, n * 2));
    return arr;
  }

  function buildTargets() {
    return [
      genFullstack(CW, CH, N_FORM),
      genSAP(CW, CH, N_FORM),
      genProfessional(CW, CH, N_FORM),
    ];
  }
  let allTargets = buildTargets();
  let currentIdx  = 0;
  /* Magnetic pull radius — only particles within this distance of their
     assigned target point feel the pull. Particles outside drift freely. */
  const PULL_R = 420;
  const REP_R  = 140;   // CSS px — mouse repulsion radius
  const REP_F  = 180;   // goal-displacement push strength (CSS px)

  /* ══════════════════════════════════════════════════════════════════
     ONE unified particle pool — no separate formation / ambient arrays.
     All particles share the same base visual properties. Formation
     particles (0…N_FORM-1) are pulled toward shape targets; the rest
     drift freely. Brightness/size increases only as a particle nears
     its target (condensation), so the icon literally emerges from the
     ambient field rather than appearing as a separate blob.
  ══════════════════════════════════════════════════════════════════ */
  const px   = new Float32Array(N_TOT);
  const py   = new Float32Array(N_TOT);
  const ftx  = new Float32Array(N_FORM);  // shape targets (formation only)
  const fty  = new Float32Array(N_FORM);
  const hx   = new Float32Array(N_TOT);   // home / ambient anchor (all)
  const hy   = new Float32Array(N_TOT);

  /* Per-particle constants */
  const pSz  = new Float32Array(N_TOT);
  const pOp  = new Float32Array(N_TOT);
  const pDRx = new Float32Array(N_TOT);
  const pDRy = new Float32Array(N_TOT);
  const pDFx = new Float32Array(N_TOT);
  const pDFy = new Float32Array(N_TOT);
  const pDPx = new Float32Array(N_TOT);
  const pDPy = new Float32Array(N_TOT);
  const pLr    = new Float32Array(N_TOT);
  const pBoost = new Float32Array(N_FORM);  // smoothed condensation boost 0–1
  const pCS  = [];
  const pR   = new Uint8Array(N_TOT);   // base colour channels (for mouse tint)
  const pG   = new Uint8Array(N_TOT);
  const pB   = new Uint8Array(N_TOT);

  const initT = allTargets[0];
  for (let i = 0; i < N_TOT; i++) {
    const isForm = i < N_FORM;

    /* Formation particles home near the icon centre so they continuously
       wander in and out of the magnetic pull zone.
       Ambient particles are spread across the full section. */
    if (isForm) {
      /* Homes spread across most of the canvas so particles use the full
         space when drifting, but still funnel into the pull zone to form shapes. */
      hx[i] = CW * 0.5 + (Math.random() - 0.5) * CW * 1.10;
      hy[i] = CH * 0.5 + (Math.random() - 0.5) * CH * 0.90;
    } else {
      hx[i] = Math.random() * CW;
      hy[i] = Math.random() * CH;
    }
    px[i] = hx[i];
    py[i] = hy[i];

    if (isForm) {
      ftx[i] = initT[i * 2];
      fty[i] = initT[i * 2 + 1];
    }

    /* ── Base appearance ── */
    pSz[i]  = 0.80 + Math.random() * 0.90;   // 0.80–1.70 px
    pOp[i]  = 0.28 + Math.random() * 0.22;   // 0.28–0.50

    /* Formation particles drift with medium amplitude — large enough to sweep
       through the pull zone, small enough to settle once captured.
       Ambient particles move calmly across the full section. */
    /* Formation particles drift wider so they sweep through the pull zone more
       frequently → more continuous inward flow.
       Ambient particles stay calm across the full section. */
    pDRx[i] = isForm ? 40 + Math.random() * 65 : 20 + Math.random() * 40;
    pDRy[i] = isForm ? 40 + Math.random() * 65 : 20 + Math.random() * 40;
    pDFx[i] = isForm
      ? 0.030 + Math.random() * 0.050  // 0.030–0.080 Hz (13–33 s) — faster orbiting
      : 0.018 + Math.random() * 0.030; // 0.018–0.048 Hz — calm ambient
    pDFy[i] = isForm
      ? 0.030 + Math.random() * 0.050
      : 0.018 + Math.random() * 0.030;
    pDPx[i] = Math.random() * TWO_PI;
    pDPy[i] = Math.random() * TWO_PI;

    /* Formation snaps to magnetic goal; ambient drifts with gentle inertia */
    pLr[i] = isForm
      ? 0.055 + Math.random() * 0.025   // 0.055–0.080: snappier pull
      : 0.015 + Math.random() * 0.012;  // 0.015–0.027: smooth ambient glide

    /* Color palette aligned with site accent colours:
       --accent: #8899ff (136,153,255)  --accent2: #6b85ff (107,133,255)
       Four tiers centred on that blue-indigo hue family. */
    const tier = Math.random();
    let r, g, b;
    if (tier < 0.34) {
      /* Core accent — close to #8899ff */
      r = 122 + Math.round(Math.random() * 48);  // 122–170
      g = 140 + Math.round(Math.random() * 42);  // 140–182
      b = 248 + Math.round(Math.random() * 7);   // 248–255
    } else if (tier < 0.62) {
      /* Deep accent — close to #6b85ff */
      r =  85 + Math.round(Math.random() * 42);  // 85–127
      g = 105 + Math.round(Math.random() * 40);  // 105–145
      b = 238 + Math.round(Math.random() * 17);  // 238–255
    } else if (tier < 0.82) {
      /* Near-white lavender sparkle */
      r = 190 + Math.round(Math.random() * 55);  // 190–245
      g = 198 + Math.round(Math.random() * 50);  // 198–248
      b = 255;
    } else {
      /* Deep indigo */
      r =  48 + Math.round(Math.random() * 42);  // 48–90
      g =  65 + Math.round(Math.random() * 42);  // 65–107
      b = 208 + Math.round(Math.random() * 38);  // 208–246
    }
    pCS.push(`rgb(${r},${g},${b})`);
    pR[i] = r; pG[i] = g; pB[i] = b;
  }

  /* ── State switching ── */
  const titleEl = document.getElementById('showcaseTitle');
  const descEl  = document.getElementById('showcaseDesc');

  /* Each lens leaves its fingerprint on the About section's eye label —
     the chosen identity carries forward as the frame for the person. */
  const ABT_EYE_LABELS = [
    'THE PROFESSIONAL',
    'THE SAP ENGINEER',
    'THE BUILDER',
  ];
  const abtEyeEl = document.querySelector('.abtEye');

  function setState(idx) {
    if (idx === currentIdx) return;
    currentIdx = idx;

    titleEl && titleEl.classList.add('scTrans');
    descEl  && descEl .classList.add('scTrans');
    setTimeout(() => {
      if (titleEl) { titleEl.textContent = STATES[idx].title; titleEl.classList.remove('scTrans'); }
      if (descEl)  { descEl .textContent = STATES[idx].desc;  descEl .classList.remove('scTrans'); }
    }, 230);

    /* Echo the active lens into the About header with a quick blink-in */
    if (abtEyeEl) {
      abtEyeEl.classList.add('abt-eye-flash');
      setTimeout(() => {
        abtEyeEl.textContent = ABT_EYE_LABELS[idx];
        abtEyeEl.classList.remove('abt-eye-flash');
      }, 210);
    }

    document.querySelectorAll('.showcasePill').forEach((btn, i) => {
      const on = i === idx;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    /* Move the magnetic targets — particles currently inside PULL_R of the
       new targets will be drawn in; particles outside just keep drifting. */
    const t = allTargets[idx];
    for (let i = 0; i < N_FORM; i++) { ftx[i] = t[i * 2]; fty[i] = t[i * 2 + 1]; }
  }

  /* ── Mouse repulsion tracking ── */
  let mx = -99999, my = -99999;
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mx = e.clientX - rect.left;
    my = e.clientY - rect.top;
  });
  canvas.addEventListener('mouseleave', () => { mx = -99999; my = -99999; });

  /* ── Render loop ──
     Magnetic pull model: the active icon shape acts as an invisible magnet.
     Formation particles (0…N_FORM-1) drift freely across the section at all
     times. When one drifts within PULL_R of its assigned target point the pull
     kicks in — bending its path toward the icon. Particles outside PULL_R feel
     nothing and just drift. This creates a continuous, organic "condensation"
     as nearby particles are drawn in and settle, while far ones keep wandering. */
  let t_a = 0, prev = performance.now(), raf, rafStarted = false;

  function frame(now) {
    const dt = Math.min((now - prev) * 0.001, 0.05);
    prev  = now;
    t_a  += dt;

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.scale(DPR, DPR);

    for (let i = 0; i < N_TOT; i++) {
      const lf = 1 - Math.pow(1 - pLr[i], dt * 60);

      /* Ambient drift goal — the lazy looping path every particle follows */
      const ambGx = hx[i] + Math.sin(t_a * pDFx[i] + pDPx[i]) * pDRx[i];
      const ambGy = hy[i] + Math.cos(t_a * pDFy[i] + pDPy[i]) * pDRy[i];

      let gx, gy;

      if (i < N_FORM) {
        /* Magnetic pull: blend ambient drift with target pull based on distance */
        const dx   = px[i] - ftx[i], dy = py[i] - fty[i];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < PULL_R) {
          const t    = 1 - dist / PULL_R;
          const pull = t * t * (3 - 2 * t);  // smoothstep: strong at edge, full at centre
          gx = ambGx + (ftx[i] - ambGx) * pull;
          gy = ambGy + (fty[i] - ambGy) * pull;
        } else {
          gx = ambGx;  // outside pull zone — pure ambient drift
          gy = ambGy;
        }
      } else {
        /* Ambient particles: always pure drift, no pull */
        gx = ambGx;
        gy = ambGy;
      }

      /* Mouse repulsion — push goal position away from cursor */
      let repF = 0;
      if (mx > -9999) {
        const rdx = px[i] - mx;
        const rdy = py[i] - my;
        const rd  = Math.sqrt(rdx * rdx + rdy * rdy);
        if (rd < REP_R && rd > 0.5) {
          const t  = 1 - rd / REP_R;
          repF     = t * t;           // 0 → 1 as particle nears cursor
          const st = repF * REP_F;
          gx += (rdx / rd) * st;
          gy += (rdy / rd) * st;
        }
      }

      px[i] += (gx - px[i]) * lf;
      py[i] += (gy - py[i]) * lf;

      /* Formation particles brighten as they settle onto their target.
         pBoost[i] smoothly lerps toward the raw condensation value so particles
         stay bright while traveling between formations on state-switch — no
         jarring pop back to dim.  They fade in ~0.6 s, fade out ~1.4 s.
         Condensation radius extended to 80 px so particles start glowing earlier
         as they approach, giving a clear "drawn in" pull-glow effect. */
      let op = pOp[i], sz = pSz[i];
      if (i < N_FORM) {
        const dx = px[i] - ftx[i], dy = py[i] - fty[i];
        const d2 = dx*dx + dy*dy;
        const COND_R2 = 6400; // 80 px radius
        let rawBoost = 0;
        if (d2 < COND_R2) {
          const t = 1 - d2 / COND_R2;
          rawBoost = t * t * (3 - 2 * t);  // smoothstep
        }
        /* Asymmetric lerp: rise fast, decay slowly so glow persists during transit */
        const bRise = 1 - Math.pow(1 - 0.10, dt * 60);  // ~0.6 s to full
        const bFall = 1 - Math.pow(1 - 0.04, dt * 60);  // ~1.4 s to zero
        pBoost[i] += (rawBoost - pBoost[i]) * (rawBoost > pBoost[i] ? bRise : bFall);
        op += pBoost[i] * 0.52;
        sz += pBoost[i] * 1.60;
      }
      /* Mouse proximity — shift colour toward bright cyan-white and enlarge */
      if (repF > 0.01) {
        const cr = Math.round(pR[i] + (210 - pR[i]) * repF);
        const cg = Math.round(pG[i] + (230 - pG[i]) * repF);
        const cb = 255;
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        op += repF * 0.40;
        sz += repF * 1.20;
      } else {
        ctx.fillStyle = pCS[i];
      }
      ctx.globalAlpha = Math.min(1, op);
      ctx.beginPath();
      ctx.arc(px[i], py[i], sz, 0, TWO_PI);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
    raf = requestAnimationFrame(frame);
  }

  /* Only start RAF immediately if canvas already has valid dimensions.
     If the canvas is inside an opacity:0 wrapper at page-load, getBoundingClientRect
     may return 0x0 — the ResizeObserver will start the RAF on first valid layout. */
  if (CW > 0) { rafStarted = true; raf = requestAnimationFrame(frame); }

  /* ── Pills interaction ──
     First click on any pill: activate showcase mode and form that icon.
     Second click on the already-active pill: return to the ambient hero. */
  function deactivateShowcase() {
    const hero = document.getElementById('hero');
    if (hero) hero.classList.remove('hero--showcase');
    document.querySelectorAll('.showcasePill').forEach(b => {
      b.classList.remove('is-active');
      b.setAttribute('aria-pressed', 'false');
    });
    currentIdx = -1;
  }

  document.querySelectorAll('.showcasePill').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const hero = document.getElementById('hero');
      if (currentIdx === i && hero && hero.classList.contains('hero--showcase')) {
        /* Re-clicking the active pill → back to overview */
        deactivateShowcase();
      } else {
        /* Activate showcase mode with this pill's formation */
        if (hero && !hero.classList.contains('hero--showcase')) {
          hero.classList.add('hero--showcase');
        }
        setState(i);
      }
    });
  });

  /* ── Resize ── */
  new ResizeObserver(() => {
    const prevCW = CW;
    resize();
    allTargets = buildTargets();
    const idx = currentIdx >= 0 ? currentIdx : 0;
    const t = allTargets[idx];
    for (let i = 0; i < N_FORM; i++) { ftx[i] = t[i * 2]; fty[i] = t[i * 2 + 1]; }
    for (let i = 0; i < N_TOT; i++) {
      if (i < N_FORM) {
        hx[i] = CW * 0.5 + (Math.random() - 0.5) * CW * 0.80;
        hy[i] = CH * 0.5 + (Math.random() - 0.5) * CH * 0.65;
      } else {
        hx[i] = Math.random() * CW;
        hy[i] = Math.random() * CH;
      }
      /* Scatter particles to home when getting first valid layout */
      if (prevCW < 1) { px[i] = hx[i]; py[i] = hy[i]; }
    }
    /* Start RAF if canvas was 0-sized at init time */
    if (!rafStarted && CW > 0) {
      rafStarted = true;
      prev = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }).observe(canvas);
}

function animateWorkCards() {
  if (!window.gsap || prefersReducedMotion()) return;

  const cards = Array.from(document.querySelectorAll("#workGrid .projectCard"));
  if (!cards.length) return;

  gsap.killTweensOf(cards);

  gsap.fromTo(
    cards,
    {
      opacity: 0,
      x: 72,
      y: 6,
    },
    {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 0.85, // ⬅ slower entrance
      ease: "power3.out", // ⬅ smoother, less snappy
      stagger: 0.12, // ⬅ cards arrive one-by-one
      clearProps: "transform",
    },
  );
}

function escapeHtml(str) {
  return (str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function uniqueTags(projects) {
  const set = new Set();
  projects.forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
  return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function filteredProjects() {
  let list = [...state.projects];

  if (state.activeTag !== "All") {
    list = list.filter((p) => (p.tags || []).includes(state.activeTag));
  }

  const q = state.query.trim().toLowerCase();
  if (q) {
    list = list.filter((p) => {
      const hay = `${p.name} ${p.description} ${(p.tags || []).join(" ")} ${(
        p.highlights || []
      ).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }

  list.sort(
    (a, b) =>
      (b.featured === true) - (a.featured === true) ||
      (b.date || "").localeCompare(a.date || ""),
  );

  return list;
}

function renderTags() {
  const bar = document.getElementById("tagsBar");
  if (!bar) return;
  bar.innerHTML = "";

  state.tags.forEach((t) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = t;
    if (t === state.activeTag) btn.classList.add("active");
    btn.addEventListener("click", () => {
      state.activeTag = t;
      renderWork();
    });
    bar.appendChild(btn);
  });
}

function makeProjectCard(p, index) {
  const el = document.createElement("article");
  el.className = "projectCard r" + (p.featured ? " featured" : "");
  el.tabIndex = 0;

  // Per-card accent palette — cycles through a set of dark-toned backgrounds
  const palettes = [
    { bg: "linear-gradient(135deg,#1a0406 0%,#2d0810 100%)", accent: "#ff3352" },
    { bg: "linear-gradient(135deg,#03081e 0%,#081028 100%)", accent: "#3a80ff" },
    { bg: "linear-gradient(135deg,#0a0318 0%,#130528 100%)", accent: "#9b5cf6" },
    { bg: "linear-gradient(135deg,#021808 0%,#032010 100%)", accent: "#22c55e" },
    { bg: "linear-gradient(135deg,#1a0c02 0%,#241404 100%)", accent: "#f97316" },
    { bg: "linear-gradient(135deg,#001a18 0%,#022420 100%)", accent: "#2dd4bf" },
    { bg: "linear-gradient(135deg,#1a1002 0%,#241802 100%)", accent: "#facc15" },
    { bg: "linear-gradient(135deg,#02101a 0%,#041824 100%)", accent: "#38bdf8" },
    { bg: "linear-gradient(135deg,#180204 0%,#200408 100%)", accent: "#e11d48" },
  ];
  const pal = palettes[index % palettes.length];

  const imgHtml = p.imageUrl
    ? `<img class="cardImg" src="${p.imageUrl}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'">`
    : "";

  // Circular spinning badge
  const circleId = `cp${index}`;
  const visitBadge =
    p.demoUrl && p.demoUrl !== "x"
      ? `<a class="visitBadge" href="${p.demoUrl}" target="_blank" rel="noopener" aria-label="Visit project">
           <svg class="visitRing" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
             <path id="${circleId}" fill="none" d="M50,50 m-32,0 a32,32 0 1,1 64,0 a32,32 0 1,1 -64,0"/>
             <text class="visitText"><textPath href="#${circleId}">VISIT PROJECT · VISIT PROJECT · </textPath></text>
           </svg>
           <span class="visitArrow" style="color:${pal.accent}">↗</span>
         </a>`
      : "";

  // Highlights bullet list (max 3)
  const highlights = (p.highlights || [])
    .filter((h) => h && h !== "x")
    .slice(0, 3)
    .map(
      (h) =>
        `<li class="cardHighlightItem"><span class="highlightPlus" style="color:${pal.accent}">+</span>${escapeHtml(h)}</li>`,
    )
    .join("");

  const tags = (p.tags || [])
    .slice(0, 5)
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");

  el.innerHTML = `
    <div class="cardLeft" style="background:${pal.bg}">
      <div class="cardImgWrap">${imgHtml}</div>
      <div class="cardOverlay"><span class="overlayLabel">View Project</span></div>
      ${visitBadge}
    </div>

    <div class="cardRight">
      <div class="cardRightTop">
        <div class="cardNumRow">
          <span class="cardNum" style="color:${pal.accent}">${String(index + 1).padStart(2, "0")}</span>
          ${p.featured ? `<span class="pBadge">Featured</span>` : ""}
        </div>
        <div class="cardAccentLine" style="background:${pal.accent}"></div>
      </div>

      <h3 class="cardTitle">${escapeHtml(p.name)}</h3>
      <p class="cardDesc">${escapeHtml(p.description || "")}</p>

      ${highlights ? `<ul class="cardHighlights">${highlights}</ul>` : ""}

      <div class="cardBottom">
        <div class="tagRow">${tags}</div>
        <div class="cardLinks">
          ${p.demoUrl && p.demoUrl !== "x" ? `<a class="cardLink live" href="${p.demoUrl}" target="_blank" rel="noopener">↗ Live</a>` : ""}
          ${p.repoUrl && p.repoUrl !== "x" ? `<a class="cardLink" href="${p.repoUrl}" target="_blank" rel="noopener">{ } Code</a>` : ""}
        </div>
      </div>
    </div>
  `;

  // Subtle lift on hover (no tilt — horizontal card doesn't benefit from tilt)
  if (window.matchMedia("(hover: hover)").matches) {
    el.addEventListener("mouseleave", () => {
      el.style.transform = "";
    });
  }

  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (p.demoUrl && p.demoUrl !== "x")
        window.open(p.demoUrl, "_blank", "noopener");
      else if (p.repoUrl && p.repoUrl !== "x")
        window.open(p.repoUrl, "_blank", "noopener");
    }
  });

  return el;
}

function renderFeatured() {
  const featured = state.projects.find((p) => p.featured) || state.projects[0];
  if (!featured) return;

  const meta = document.getElementById("featuredMeta");
  const title = document.getElementById("featuredTitle");
  const desc = document.getElementById("featuredDesc");
  const tags = document.getElementById("featuredTags");
  const btns = document.getElementById("featuredBtns");

  if (!meta || !title || !desc || !tags || !btns) return;

  title.textContent = featured.name;
  desc.textContent = featured.description || "";
  meta.textContent = `Updated ${formatDate(featured.date)}`;

  tags.innerHTML = (featured.tags || [])
    .slice(0, 5)
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join("");

  const out = [];
  if (featured.demoUrl)
    out.push(
      `<a class="btn primary" href="${featured.demoUrl}" target="_blank" rel="noopener">Live demo</a>`,
    );
  if (featured.repoUrl)
    out.push(
      `<a class="btn" href="${featured.repoUrl}" target="_blank" rel="noopener">Code</a>`,
    );
  btns.innerHTML = out.join("");
}

function renderWork() {
  renderTags();

  const list = filteredProjects();
  const grid = document.getElementById("workGrid");
  const empty = document.getElementById("emptyState");
  const showMoreWrap = document.getElementById("workShowMoreWrap");
  const showMoreLabel = document.getElementById("workShowMoreLabel");
  const totalBadge = document.getElementById("workTotalCount");
  if (!grid || !empty) return;

  // When search/tag filter is active show everything; otherwise respect preview
  const isFiltered =
    state.activeTag !== "All" || state.query.trim() !== "";
  const visibleList =
    isFiltered || state.workExpanded ? list : list.slice(0, WORK_PREVIEW);

  grid.innerHTML = "";
  visibleList.forEach((p, i) => grid.appendChild(makeProjectCard(p, i)));
  empty.hidden = list.length !== 0;

  // Total count badge in subtitle
  if (totalBadge) {
    totalBadge.textContent =
      state.projects.length > 0 ? `${state.projects.length} projects` : "";
  }

  // Show More / Show Less button
  const hasHidden = !isFiltered && list.length > WORK_PREVIEW;
  if (showMoreWrap) {
    showMoreWrap.hidden = !hasHidden;
  }
  if (showMoreLabel && hasHidden) {
    if (state.workExpanded) {
      showMoreLabel.textContent = "Show less";
      const svg = showMoreLabel.nextElementSibling;
      if (svg) svg.style.transform = "rotate(180deg)";
    } else {
      showMoreLabel.textContent = `Show all ${list.length} projects`;
      const svg = showMoreLabel.nextElementSibling;
      if (svg) svg.style.transform = "";
    }
  }

  // Always update pinned story stats
  const proj = document.getElementById("statProjects");
  const tags = document.getElementById("statTags");
  if (proj) proj.textContent = String(state.projects.length);
  if (tags) tags.textContent = String(Math.max(0, state.tags.length - 1));

  // Hide rail arrows (not needed)
  const prev = document.getElementById("railPrev");
  const next = document.getElementById("railNext");
  if (prev) prev.hidden = true;
  if (next) next.hidden = true;

  if (list.length === 0) return;

  // Animate cards only when section has been entered
  if (state.workEntered) {
    requestAnimationFrame(() => animateWorkCards());
  }
}

/* ------------------------------
   Stack rendering
------------------------------ */
function renderStack() {
  const stack = [
    { name: "JavaScript", icon: "devicon-javascript-plain" },
    { name: "TypeScript", icon: "devicon-typescript-plain" },
    { name: "HTML", icon: "devicon-html5-plain" },
    { name: "CSS", icon: "devicon-css3-plain" },
    { name: "React", icon: "devicon-react-original" },
    { name: "Node.js", icon: "devicon-nodejs-plain" },
    { name: "Python", icon: "devicon-python-plain" },
    { name: "Git", icon: "devicon-git-plain" },
    { name: "GitHub", icon: "devicon-github-original" },
    { name: "Docker", icon: "devicon-docker-plain" },
    { name: "PostgreSQL", icon: "devicon-postgresql-plain" },
    { name: "SAP", icon: "devicon-sap-plain" },
  ];

  const grid = document.getElementById("stackGrid");
  if (!grid) return;
  grid.innerHTML = "";

  stack.forEach((s, i) => {
    const item = document.createElement("div");
    item.className = "stackItem";
    item.style.transform = `translateY(${(i % 3) * 2}px)`;
    item.innerHTML = `
      <div class="stackIcon"><i class="${s.icon}"></i></div>
      <div class="stackName">${escapeHtml(s.name)}</div>
    `;
    grid.appendChild(item);
  });

  // subtle float
  const reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced && window.gsap) {
    gsap.utils.toArray(".stackItem").forEach((el, i) => {
      gsap.to(el, {
        y: i % 2 === 0 ? -6 : 6,
        duration: 2.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: i * 0.05,
      });
    });
  }
}

/* ------------------------------
   Career — Sticky Scroll Section
------------------------------ */
const careerData = [
  {
    role: "SOA People Nordic",
    sub: "Building enterprise solutions in practice",
    year: "Now",
    category: "Consulting",
    location: "Livjægergade 17, 2100 København",
    skills: ["SAP BTP", "SAPUI5", "OData", "CDS Views", "SAP Gateway", "REST APIs", "SAP Integration", "JavaScript"],
    desc: "Currently working at SOA People, where I develop and contribute to SAP-based digital solutions in a professional consulting environment. This chapter reflects how I combine technical development with business understanding to build solutions that are practical, scalable, and aligned with real user and process needs.",
    img:   "assets/SOA1.jpg",
    bgImg: "assets/SOA2.jpg",
  },
  {
    role: "SOA People Academy",
    sub: "Strengthening business and consulting perspective",
    year: "November 2025",
    category: "Training",
    location: "Meentwal 9, 3432 GL Nieuwegein, Nederlandene",
    skills: ["SAP S/4HANA", "SAP MM", "SAP SD", "Consulting Skills", "Supply Chain Management", "Business Process Understanding", "Analytical Thinking", "Communication"],
    desc: "The academy experience strengthened my understanding of business processes, consulting, and how SAP supports real organisational needs. It added a broader commercial and practical perspective to my technical background and helped sharpen the way I communicate, analyse, and work with business-oriented problem solving.",
    img:   "assets/ACA1.jpg",
    bgImg: "assets/ACA2.jpg",
  },
  {
    role: "Master's Degree in Computer Science",
    sub: "Turning technology into tested systems",
    year: "July 2025",
    category: "Education",
    location: "Universitetsvej 1, 4000 Roskilde",
    skills: ["Python", "JavaScript", "SQL", "React.js", "Cloud Computing", "Internet of Things", "Software Development", "Data Analysis"],
    desc: "My master's degree in computer science built a strong technical foundation across software, systems, and applied development. It was a period shaped by experimentation, prototyping, and interdisciplinary work, where I developed solutions that had to function beyond theory and perform in real environments.",
    img:   "assets/UNI1.jpg",
    bgImg: "assets/UNI2.jpg",
  },
  {
    role: "Jam Together",
    sub: "Designing interactive experiences in public space",
    year: "2024",
    category: "Project",
    location: "Roskilde Festival, Denmark",
    skills: ["Interactive Design", "Prototyping", "Internet of Things", "User Experience", "Teamwork", "Problem Solving"],
    desc: "This project focused on developing an interactive installation for Roskilde Festival, where technology, design, and physical interaction had to work together in a live public setting. It strengthened my interest in creating solutions that are not only functional, but also intuitive, engaging, and memorable to the people using them.",
    img:   "assets/JAM1.jpg",
    bgImg: "assets/JAM2.jpg",
  },
  {
    role: "Light News",
    sub: "Exploring digital interaction through live technology",
    year: "2023",
    category: "Project",
    location: "Roskilde Festival, Denmark",
    skills: ["Interface Design", "Concept Development", "Prototyping", "Digital Interaction", "Communication", "Experience Design"],
    desc: "This earlier Roskilde Festival project explored how digital interaction can shape live experiences in subtle but meaningful ways. Working with interface, concept, and implementation helped deepen my understanding of how technology can connect people, environment, and interaction in a more human-centered way.",
    img:   "assets/NEW1.jpg",
    bgImg: "assets/NEW2.jpg",
  },
];

function initMpCareer() {
  // Preload all images immediately so transitions don't wait on network
  careerData.forEach(item => {
    [item.img, item.bgImg].forEach(src => { if (src) { new Image().src = src; } });
  });

  const wrap    = document.getElementById("career");
  const track   = document.getElementById("mpCareerTrack");
  const descEl  = document.getElementById("mpCareerDesc");
  const counter = document.getElementById("mpCareerSidebarCounter");
  const progBar = document.getElementById("mpCareerProgressBar");
  const bgEl    = wrap ? wrap.querySelector(".mpCareerBg") : null;
  if (!wrap || !track || !bgEl) return;

  const N = careerData.length;

  // ── Set wrapper height: N scrollable cards + 0.5 exit buffer ──
  function setHeight() {
    wrap.style.height = `${(N + 0.5) * window.innerHeight}px`;
  }
  setHeight();
  window.addEventListener("resize", setHeight);

  // ── Build background slides (bgImg = full-bleed background photo) ──
  careerData.forEach((item) => {
    const slide = document.createElement("div");
    slide.className = "mpCareerBgSlide";
    slide.style.backgroundImage = `url('${item.bgImg || item.img}')`;
    bgEl.appendChild(slide);
  });
  const bgSlides = Array.from(bgEl.querySelectorAll(".mpCareerBgSlide"));

  // ── Build description items ──
  if (descEl) {
    careerData.forEach((item) => {
      const p = document.createElement("p");
      p.className = "mpCareerDescItem";
      p.textContent = item.desc;
      descEl.appendChild(p);
    });
  }
  const descItems = descEl ? Array.from(descEl.querySelectorAll(".mpCareerDescItem")) : [];

  // ── Build portrait cards ──
  careerData.forEach((item) => {
    const card = document.createElement("article");
    card.className = "mpCareerCard";
    card.setAttribute("aria-label", `${item.year} — ${item.role}`);
    const skills     = item.skills || [];
    const skillsHtml = skills.length
      ? `<div class="mpCareerCardSkills">` +
          skills.map(s => `<span class="mpCareerCardSkill">${escapeHtml(s)}</span>`).join("") +
        `</div>`
      : "";

    card.innerHTML =
      `<div class="mpCareerCardPhoto" style="background-image:url('${item.img}')"></div>` +
      `<div class="mpCareerCardBody">` +
        `<div class="mpCareerCardTop">` +
          `<h3 class="mpCareerCardRole">${escapeHtml(item.role)}</h3>` +
          skillsHtml +
        `</div>` +
        `<div class="mpCareerCardMeta">` +
          `<span class="mpCareerCardCategory">${escapeHtml(item.category)}</span>` +
          `<span class="mpCareerCardLocation">${escapeHtml(item.location)}</span>` +
          `<span class="mpCareerCardYear">${escapeHtml(item.year)}</span>` +
        `</div>` +
      `</div>`;
    track.appendChild(card);
  });
  const cards = Array.from(track.querySelectorAll(".mpCareerCard"));

  let activeIdx = -1;

  function setActive(idx) {
    if (idx === activeIdx) return;

    bgSlides[activeIdx]?.classList.remove("mp-active");
    bgSlides[idx]?.classList.add("mp-active");

    descItems[activeIdx]?.classList.remove("mp-active");
    descItems[idx]?.classList.add("mp-active");

    cards[activeIdx]?.classList.remove("mp-active");
    cards[idx]?.classList.add("mp-active");

    if (counter) {
      counter.textContent =
        `${String(idx + 1).padStart(2, "0")} / ${String(N).padStart(2, "0")}`;
    }

    activeIdx = idx;
  }

  // ── Scroll driver ──
  let rafId = 0;
  let lastProgress = -1;

  function onScroll() {
    if (rafId) return;
    rafId = requestAnimationFrame(update);
  }

  function update() {
    rafId = 0;
    const wrapTop    = wrap.getBoundingClientRect().top;
    const wrapH      = wrap.offsetHeight;
    const viewH      = window.innerHeight;
    const scrolled   = -wrapTop;                          // px scrolled into wrapper
    const scrollRange = Math.max(1, wrapH - viewH);       // total scroll travel
    const progress   = Math.max(0, Math.min(1, scrolled / scrollRange));

    if (Math.abs(progress - lastProgress) < 0.00005) return;
    lastProgress = progress;

    // Fractional card index: 0 → card 0, 1 → card N-1
    const cardFrac = progress * (N - 1);
    const newIdx   = Math.min(N - 1, Math.max(0, Math.round(cardFrac)));
    if (newIdx !== activeIdx) setActive(newIdx);

    // Translate track so active card stays centred in the *usable* area
    // (right of the left-panel overlay, left of the sidebar).
    // Stage now starts at left:0, so we offset by the left-panel width.
    const cardW       = cards[0]?.offsetWidth || 360;
    const gap         = 200;  // matches CSS gap — one card visible at centre
    const stageW      = (track.parentElement || wrap).offsetWidth;
    const leftPanelEl = wrap.querySelector(".mpCareerLeft");
    const leftPanelW  = (leftPanelEl && window.innerWidth > 700)
      ? leftPanelEl.offsetWidth : 0;
    const usableW = stageW - leftPanelW;
    const baseX   = leftPanelW + usableW / 2 - cardW / 2;  // centres card-0
    const trackX  = baseX - cardFrac * (cardW + gap);
    track.style.transform = `translateX(${Math.round(trackX)}px)`;

    // Progress bar
    if (progBar) progBar.style.width = `${progress * 100}%`;
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  // Initial draw
  requestAnimationFrame(update);
}

// Always start at top on refresh (prevents browser restoring old scroll position)
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

function forceTopAndRefresh() {
  window.scrollTo(0, 0);
  if (window.ScrollTrigger) ScrollTrigger.refresh();
}



/* ── Ask Me — flowing-curves + heartbeat canvas ────────────────────────────
   Smooth cubic-bezier streams flow from the full top edge down to the panel.
   A lub-dub heartbeat pulses the glow and line brightness on every beat.
──────────────────────────────────────────────────────────────────────────── */
function initAskBg() {
  const section = document.getElementById('ask');
  const canvas  = document.getElementById('askBgCanvas');
  if (!canvas || !section) return;
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;
  let pX = 0, pY = 300, pW = 800, pH = 480;
  let animId = null;
  let curves  = [];

  /* ── Measure ── */
  function measure() {
    cancelAnimationFrame(animId);
    const sr = section.getBoundingClientRect();
    W = Math.round(sr.width);
    H = Math.round(sr.height);
    canvas.width  = W;
    canvas.height = H;

    const panel = section.querySelector('.askPanel');
    if (panel) {
      const pr = panel.getBoundingClientRect();
      pX = pr.left - sr.left;
      pY = pr.top  - sr.top;
      pW = pr.width;
      pH = pr.height;
    } else {
      pX = Math.max(0, (W - Math.min(960, W - 40)) / 2);
      pW = Math.min(960, W - 40);
      pY = H * 0.38;
      pH = H * 0.50;
    }

    buildCurves();
    animId = requestAnimationFrame(draw);
  }

  /* ── Build smooth bezier streams ── */
  function buildCurves() {
    curves = [];
    const N = 13;
    const entryL = pX + 16;
    const entryR = pX + pW - 16;

    for (let i = 0; i < N; i++) {
      const frac = i / (N - 1);

      // Start spread across full section width
      const sx = W * 0.03 + frac * (W * 0.94);

      // End distributed along panel top edge
      const ex = entryL + frac * (entryR - entryL);

      // Cubic bezier: first CP drops straight down, second CP approaches panel x
      const cp1 = { x: sx,       y: pY * 0.28 };
      const cp2 = { x: ex,       y: pY * 0.72 };

      const nPulse = 1 + (i % 4 === 0 ? 1 : 0);
      const pulses = [];
      for (let p = 0; p < nPulse; p++) {
        pulses.push({
          t:     (p / nPulse + Math.random() * 0.3) % 1,
          speed: 0.0028 + Math.random() * 0.0024,
          size:  1.5 + Math.random() * 1.1,
        });
      }

      curves.push({
        p0: { x: sx, y: 0 },
        p1: cp1,
        p2: cp2,
        p3: { x: ex, y: pY },
        baseAlpha: 0.07 + Math.random() * 0.06,
        pulses,
      });
    }
  }

  /* ── Cubic bezier point at t ── */
  function cbPt(c, t) {
    const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt, t2 = t * t, t3 = t2 * t;
    return {
      x: mt3*c.p0.x + 3*mt2*t*c.p1.x + 3*mt*t2*c.p2.x + t3*c.p3.x,
      y: mt3*c.p0.y + 3*mt2*t*c.p1.y + 3*mt*t2*c.p2.y + t3*c.p3.y,
    };
  }

  /* ── Heartbeat shape: lub-dub then rest (65 bpm) ── */
  const BEAT = 60 / 65;   // seconds per beat
  function heartbeat(sec) {
    const ph = (sec % BEAT) / BEAT;   // 0..1 within one beat
    if (ph < 0.07)  return ph / 0.07;
    if (ph < 0.14)  return 1 - (ph - 0.07) / 0.07;
    if (ph < 0.20)  return (ph - 0.14) / 0.06 * 0.55;
    if (ph < 0.26)  return 0.55 - (ph - 0.20) / 0.06 * 0.55;
    return 0;
  }

  /* ── Render ── */
  function draw() {
    if (!W || !H) { animId = requestAnimationFrame(draw); return; }
    ctx.clearRect(0, 0, W, H);

    const now = performance.now() * 0.001;
    const hb  = heartbeat(now);          // 0..1 pulse value

    const cx = pX + pW * 0.5;
    const cy = pY + pH * 0.5;

    /* Wide atmospheric bleed upward into Tech section */
    const bleedA = 0.038 + 0.012 * Math.sin(now * 0.38) + hb * 0.07;
    const bg = ctx.createRadialGradient(cx, pY, 0, cx, pY, Math.max(W, H) * 0.85);
    bg.addColorStop(0,   'rgba(75,105,255,' + bleedA.toFixed(3) + ')');
    bg.addColorStop(0.55,'rgba(75,105,255,' + (bleedA * 0.28).toFixed(3) + ')');
    bg.addColorStop(1,   'rgba(75,105,255,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* Panel core heartbeat flash */
    const coreA = 0.10 + hb * 0.28;
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(pW, pH) * 0.55);
    cg.addColorStop(0, 'rgba(140,170,255,' + coreA.toFixed(3) + ')');
    cg.addColorStop(1, 'rgba(75,105,255,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, W, H);

    /* Bezier stream lines */
    ctx.lineWidth = 1;
    curves.forEach(c => {
      const lineA = c.baseAlpha + hb * 0.07;
      ctx.beginPath();
      ctx.moveTo(c.p0.x, c.p0.y);
      ctx.bezierCurveTo(c.p1.x, c.p1.y, c.p2.x, c.p2.y, c.p3.x, c.p3.y);
      ctx.strokeStyle = 'rgba(75,105,255,' + lineA.toFixed(3) + ')';
      ctx.shadowBlur = 0;
      ctx.stroke();

      /* Moving pulse dots */
      c.pulses.forEach(pulse => {
        pulse.t += pulse.speed;
        if (pulse.t > 1) pulse.t -= 1;
        const pt = cbPt(c, pulse.t);

        ctx.save();
        ctx.shadowColor = 'rgba(160,200,255,0.95)';
        ctx.shadowBlur  = 14;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pulse.size + hb * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(160,200,255,' + (0.75 + hb * 0.25).toFixed(3) + ')';
        ctx.fill();
        ctx.restore();
      });
    });

    animId = requestAnimationFrame(draw);
  }

  requestAnimationFrame(() => requestAnimationFrame(measure));

  const ro = new ResizeObserver(() => measure());
  ro.observe(section);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(animId);
    else animId = requestAnimationFrame(draw);
  });
}

function initAskMe() {
  const form = document.getElementById("askForm");
  const input = document.getElementById("askInput");
  const chat = document.getElementById("askChat");
  const meta = document.getElementById("askMeta");

  if (!form || !input || !chat || !meta) return;

  // ✅ Put your real Cloudflare Worker endpoint here:
  // Example: https://maurits-askme.workers.dev/api/ask
  const API_URL = "https://maurits-askme.maurits-pug.workers.dev/api/ask";

  let history = []; // { role: "user"|"assistant", content: string }

  const addMsg = (text, who) => {
    const el = document.createElement("div");
    el.className = `askMsg ${who}`;
    el.textContent = text;
    chat.appendChild(el);
    // Scroll only the chat container — never the page
    chat.scrollTop = chat.scrollHeight;
  };

  const setMeta = (text, show = true) => {
    meta.textContent = text;
    meta.hidden = !show;
  };

  // Topic chip quick-sends
  document.querySelectorAll(".askChip").forEach((chip) => {
    chip.addEventListener("click", () => {
      input.value = chip.dataset.q || "";
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const q = (input.value || "").trim();
    if (!q) return;

    addMsg(q, "user");
    history.push({ role: "user", content: q });
    history = history.slice(-8);

    input.value = "";
    input.focus();

    setMeta("Thinking…", true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMeta("", false);
        addMsg(
          data?.message ||
            (res.status === 429
              ? "AI is busy right now. Try again later."
              : "Something went wrong. Try again."),
          "bot",
        );
        console.warn("AskMe error:", res.status, data);
        return;
      }

      const reply = (data.reply || "No response.").toString();
      setMeta("", false);

      addMsg(reply, "bot");
      history.push({ role: "assistant", content: reply });
      history = history.slice(-8);
    } catch (err) {
      setMeta("", false);
      addMsg("Could not reach the AI right now. Try again later.", "bot");
      console.warn(err);
    }
  });
}

function initCustomScrollbar() {
  // Removed — replaced by crFill inside initChapterRail
}

function _initCustomScrollbar_unused() {
  const wrap = document.getElementById("cScroll");
  const thumb = document.getElementById("cScrollThumb");
  if (!wrap || !thumb) return;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // Match scrollbar height to chapter rail so they span the same range
  const crRailEl = document.getElementById('crRail');
  if (crRailEl) {
    const syncHeight = () => { wrap.style.height = crRailEl.offsetHeight + 'px'; };
    syncHeight();
    new ResizeObserver(syncHeight).observe(crRailEl);
  }

  function getDocHeight() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
    );
  }

  function getMaxScroll() {
    return Math.max(0, getDocHeight() - window.innerHeight);
  }

  function layoutThumb() {
    thumb.style.height = "9px"; // circle dot
  }

  function syncThumb() {
    const maxScroll = getMaxScroll();
    const trackH = wrap.clientHeight;
    const thumbH = thumb.offsetHeight || 9;

    const fillEl = document.getElementById("cScrollFill");

    if (maxScroll <= 0) {
      if (fillEl) fillEl.style.height = "0%";
      thumb.style.top = `${thumbH / 2}px`;
      return;
    }

    const progress = Math.max(0, Math.min(1, window.scrollY / maxScroll));

    // fill grows DOWN from top
    if (fillEl) fillEl.style.height = `${(progress * 100).toFixed(3)}%`;

    // dot center tracks the fill end — clamped to stay within the track
    const y = clamp(progress * trackH, thumbH / 2, trackH - thumbH / 2);
    thumb.style.top = `${y}px`;

    // ── Water-tension merge: dots near the thumb swell toward it ──
    const wrapTop = wrap.getBoundingClientRect().top;
    const thumbCY = wrapTop + y;
    const MERGE_R = 24; // px radius
    document.querySelectorAll('.crDot').forEach(dot => {
      const r = dot.getBoundingClientRect();
      const dotCY = r.top + r.height / 2;
      const dist = Math.abs(thumbCY - dotCY);
      if (dist < MERGE_R) {
        const t = 1 - dist / MERGE_R;           // 0 → 1 as thumb approaches
        const scale = 1 + t * 1.8;              // swells up to 2.8×
        const glow  = (0.55 + t * 0.4).toFixed(2);
        dot.style.transform = `scale(${scale.toFixed(3)})`;
        dot.style.boxShadow = `0 0 ${8 + t * 10}px rgba(155,140,255,${glow})`;
      } else {
        dot.style.transform = '';
        dot.style.boxShadow = '';
      }
    });
  }

  function scrollToPosition(clientY) {
    const rect = wrap.getBoundingClientRect();
    const trackH = rect.height;
    const thumbH = thumb.offsetHeight || 28;

    const y = clamp(clientY - rect.top - thumbH / 2, 0, trackH - thumbH);

    // ✅ normal direction: top=0%, bottom=100%
    const progress = y / Math.max(1, trackH - thumbH);

    const maxScroll = getMaxScroll();
    window.scrollTo({ top: progress * maxScroll, behavior: "auto" });
  }

  // Click on track
  wrap.addEventListener("pointerdown", (e) => {
    if (e.target === thumb) return;
    scrollToPosition(e.clientY);
  });

  // Dragging
  let dragging = false;
  let startY = 0;
  let startScroll = 0;

  thumb.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    dragging = true;
    startY = e.clientY;
    startScroll = window.scrollY;
    thumb.setPointerCapture(e.pointerId);
  });

  thumb.addEventListener("pointermove", (e) => {
    if (!dragging) return;

    const maxScroll = getMaxScroll();
    const rect = wrap.getBoundingClientRect();
    const trackH = wrap.clientHeight;
    const thumbH = thumb.offsetHeight || 28;

    const y = clamp(e.clientY - rect.top - thumbH / 2, 0, trackH - thumbH);

    const progress = y / Math.max(1, trackH - thumbH);
    const p = Math.max(0, Math.min(1, progress));

    window.scrollTo({ top: p * maxScroll, behavior: "auto" });
  });

  thumb.addEventListener("pointerup", () => {
    dragging = false;
  });

  thumb.addEventListener("pointercancel", () => {
    dragging = false;
  });

  window.addEventListener("scroll", syncThumb, { passive: true });
  window.addEventListener("resize", () => {
    layoutThumb();
    syncThumb();
  });

  window.addEventListener("load", () => {
    layoutThumb();
    syncThumb();
  });

  layoutThumb();
  syncThumb();
} // end _initCustomScrollbar_unused

/* ------------------------------
   Hero stars (canvas)
   - Only runs for #hero
------------------------------ */
/* ------------------------------
   Global stars canvas (whole site)
------------------------------ */
function initBgStars() {
  const canvas = document.getElementById("bgStars");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let w = 0;
  let h = 0;
  let dpr = 1;

  const stars = [];
  const STAR_COUNT = 260; // a bit more since it's global
  let vignette = null;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.floor(window.innerWidth * dpr);
    h = Math.floor(window.innerHeight * dpr);

    canvas.width = w;
    canvas.height = h;

    // precompute vignette
    const g = ctx.createRadialGradient(
      w * 0.5,
      h * 0.45,
      Math.min(w, h) * 0.1,
      w * 0.5,
      h * 0.5,
      Math.min(w, h) * 0.85,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    vignette = g;

    // rebuild stars
    stars.length = 0;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.2,
        a: Math.random() * 0.65 + 0.08,
        v: Math.random() * 0.55 + 0.18,
        tw: Math.random() * 0.02 + 0.006,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // hoist theme check — one DOM read per frame, not per star
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const starColor = isLight ? "20,15,10" : "255,255,255";

    // stars drift (subtle, but visible)
    for (const s of stars) {
      s.y += s.v;
      s.x += s.v * 0.12;

      if (s.y > h + 6) {
        s.y = -6;
        s.x = Math.random() * w;
      }
      if (s.x < -6) s.x = w + 6;
      if (s.x > w + 6) s.x = -6;

      // twinkle
      s.a += (Math.random() - 0.5) * s.tw;
      s.a = Math.max(0.08, Math.min(0.8, s.a));

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${starColor},${s.a})`;
      ctx.fill();
    }

    // vignette only in dark mode
    if (!isLight) {
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
    }
  }

  let raf = 0;
  let last = 0;
  const FRAME_MS = 1000 / 30;

  function loop(ts) {
    if (!last || ts - last >= FRAME_MS) {
      last = ts;
      draw();
    }
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  }

  // pause when tab is hidden
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (!reduced && !raf) loop(0);
  });

  resize();
  window.addEventListener("resize", resize, { passive: true });

  if (!reduced) loop(0);
  else draw();
}

/* ── Hero — Mouse-reactive particle field ──────────────────────────────
   A soft interactive particle field where the mouse creates a living
   circular energy field around it.  Particles are spread across the
   canvas and smoothly gather into a diffuse orbital formation around
   the cursor — organic, atmospheric, alive.

   Physics (all in device px):
     • Spring toward orbital target around cursor when in influence zone
     • Spring back to home position when cursor absent
     • Heavy damping  (0.938) → calm, non-oscillatory motion
     • Gentle Brownian jitter keeps ambient field alive

   Visual:
     • Gaussian-distributed orbit radii (μ=82px·DPR, σ=22px·DPR)
       → soft diffuse cloud, NOT a hard ring
     • Opacity boost (+0.38) when near cursor, with slow pulse
     • Blue-purple-white colour palette
     • Soft shadowBlur glow on all particles
─────────────────────────────────────────────────────────────────────── */
function initHeroThree() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const DPR    = Math.min(window.devicePixelRatio || 1, 2);
  const TWO_PI = Math.PI * 2;

  /* ── Physics constants (device px) ── */
  const SPRING   = 0.038;          // spring force toward orbital target
  const DAMP     = 0.938;          // velocity damping — heavy, keeps motion calm
  const HOME_K   = 0.007;          // gentle pull back to home when cursor absent
  const NOISE    = 0.024 * DPR;    // Brownian jitter amplitude
  const INF_R    = 240 * DPR;      // mouse influence radius
  const OP_BOOST = 0.38;           // opacity lift at full influence
  const PULSE_F  = 2.2;            // pulse frequency  (rad/s)
  const ORBIT_MU = 82  * DPR;      // mean orbit radius
  const ORBIT_SG = 22  * DPR;      // orbit radius σ
  const ORBIT_FL = 28  * DPR;      // orbit radius floor

  /* ── Layout (device px) ── */
  let W, H;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    W = canvas.width  = Math.round(rect.width  * DPR);
    H = canvas.height = Math.round(rect.height * DPR);
  }
  resize();

  /* ── Particle count ── */
  const isMob = (W / DPR) < 680;
  const N     = Math.round(isMob ? 550 : 920);

  /* ── Gaussian sampler (Box-Muller) ── */
  function gauss(mu, sg) {
    let u, v;
    do { u = Math.random(); } while (u === 0);
    do { v = Math.random(); } while (v === 0);
    return mu + sg * Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * v);
  }

  /* ── Smoothstep: maps [0,1] to smooth [0,1] ── */
  function smoothstep(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x * x * (3 - 2 * x);
  }

  /* ── Build particle pool ── */
  const MARGIN = isMob ? 8 * DPR : 40 * DPR; // tighter on mobile so stars reach the edges
  const particles = [];

  for (let i = 0; i < N; i++) {
    const hx = MARGIN + Math.random() * (W - MARGIN * 2);
    const hy = MARGIN + Math.random() * (H - MARGIN * 2);

    /* Per-particle orbit radius — Gaussian, floored for safety */
    const orbitR = Math.max(ORBIT_FL, gauss(ORBIT_MU, ORBIT_SG));

    /* Angular speed: 0.60–1.40 rad/s, CW/CCW mixed */
    const angSpeed = (0.60 + Math.random() * 0.80) * (Math.random() < 0.5 ? 1 : -1);

    /* Size: 0.7–2.0 CSS px (scaled by DPR) */
    const sz = (0.7 + Math.random() * 1.3) * DPR;

    /* Base opacity: 0.10–0.52 */
    const baseOp = 0.10 + Math.random() * 0.42;

    /* Colour — blue-purple-white palette */
    const tc = Math.random();
    let cr, cg, cb;
    if (tc < 0.38) {
      /* Blue-white */
      cr = 180 + Math.round(Math.random() * 75);
      cg = 200 + Math.round(Math.random() * 55);
      cb = 255;
    } else if (tc < 0.68) {
      /* Blue-purple */
      cr = 115 + Math.round(Math.random() * 85);
      cg = 135 + Math.round(Math.random() * 65);
      cb = 238 + Math.round(Math.random() * 17);
    } else {
      /* Soft near-white */
      const v = 205 + Math.round(Math.random() * 50);
      cr = v; cg = v; cb = 255;
    }

    particles.push({
      px: hx, py: hy,   // current position
      vx: 0,  vy: 0,    // velocity
      hx, hy,            // home position
      orbitR,
      angle:    Math.random() * TWO_PI,
      angSpeed,
      sz,
      baseOp,
      cs:      `rgb(${cr},${cg},${cb})`,
      opAmp:   0.04 + Math.random() * 0.08,
      opFreq:  0.04 + Math.random() * 0.14,
      opPhase: Math.random() * TWO_PI,
      inf:     0,        // cached influence (physics → draw)
    });
  }

  /* ── Mouse tracking (device px) ── */
  let mx = -99999, my = -99999;
  const hero = document.getElementById('hero');
  if (hero) {
    const onMove = (ex, ey) => {
      const rect = canvas.getBoundingClientRect();
      mx = (ex - rect.left) * DPR;
      my = (ey - rect.top)  * DPR;
    };
    hero.addEventListener('mousemove',  e => onMove(e.clientX, e.clientY));
    hero.addEventListener('mouseleave', () => { mx = -99999; my = -99999; });
    hero.addEventListener('touchmove',
      e => onMove(e.touches[0].clientX, e.touches[0].clientY),
      { passive: true }
    );
    hero.addEventListener('touchend', () => { mx = -99999; my = -99999; });
  }

  /* ── Animation state ── */
  let t    = 0;
  let prev = performance.now();
  let raf;
  const WRAP = 55 * DPR;

  /* ── Render loop ── */
  function frame(now) {
    const dt = Math.min((now - prev) * 0.001, 0.05);
    prev = now;
    t   += dt;

    const pulse       = 1.0 + 0.09 * Math.sin(t * PULSE_F);
    const mouseActive = mx > -9000;

    ctx.clearRect(0, 0, W, H);

    /* ── Physics update ── */
    for (const p of particles) {
      /* Influence: how strongly cursor affects this particle */
      const ddx = p.px - mx;
      const ddy = p.py - my;
      const d   = Math.sqrt(ddx * ddx + ddy * ddy);
      const raw = mouseActive ? Math.max(0, 1 - d / INF_R) : 0;
      p.inf     = smoothstep(raw);
      const inf = p.inf;

      /* Advance this particle's orbital angle */
      p.angle += p.angSpeed * dt;

      /* Orbital target position around cursor */
      const r    = p.orbitR * pulse;
      const tx_o = mx + Math.cos(p.angle) * r;
      const ty_o = my + Math.sin(p.angle) * r;

      /* Blend: orbit when influenced, home when not */
      const ftx = tx_o * inf + p.hx * (1 - inf);
      const fty = ty_o * inf + p.hy * (1 - inf);

      /* Spring force — combines orbital pull and home pull */
      const keff = SPRING * inf + HOME_K * (1 - inf);
      p.vx += (ftx - p.px) * keff;
      p.vy += (fty - p.py) * keff;

      /* Brownian ambient motion */
      p.vx += (Math.random() - 0.5) * NOISE;
      p.vy += (Math.random() - 0.5) * NOISE;

      /* Damp velocity */
      p.vx *= DAMP;
      p.vy *= DAMP;

      /* Integrate */
      p.px += p.vx;
      p.py += p.vy;

      /* Soft boundary wrap */
      if (p.px < -WRAP)    p.px += W + WRAP * 2;
      if (p.px > W + WRAP) p.px -= W + WRAP * 2;
      if (p.py < -WRAP)    p.py += H + WRAP * 2;
      if (p.py > H + WRAP) p.py -= H + WRAP * 2;
    }

    /* ── Draw ── */
    if (!isMob) {
      ctx.shadowBlur  = 9 * DPR;
      ctx.shadowColor = 'rgba(105, 145, 255, 0.55)';
    }

    for (const p of particles) {
      const op = Math.max(0, Math.min(1,
        p.baseOp
        + p.opAmp * Math.sin(t * p.opFreq + p.opPhase)
        + p.inf * OP_BOOST
      ));

      ctx.globalAlpha = op;
      ctx.fillStyle   = p.cs;
      ctx.beginPath();
      ctx.arc(p.px, p.py, p.sz, 0, TWO_PI);
      ctx.fill();
    }

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    raf = requestAnimationFrame(frame);
  }

  function startRaf() {
    if (!raf) { prev = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function stopRaf() {
    if (raf) { cancelAnimationFrame(raf); raf = undefined; }
  }

  // Pause when tab is hidden, resume when visible
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopRaf(); else startRaf();
  });

  // Pause when hero scrolls out of view — biggest win after tab-hide
  new IntersectionObserver((entries) => {
    entries[0].isIntersecting ? startRaf() : stopRaf();
  }, { threshold: 0 }).observe(canvas);

  startRaf();

  new ResizeObserver(() => {
    const oldW = W, oldH = H;
    resize();
    /* Scale all particle positions proportionally to the new canvas size.
       This handles both shrink (particles clamp to new bounds) and
       grow (particles spread out to fill the expanded canvas). */
    if (oldW > 0 && oldH > 0) {
      const sx = W / oldW;
      const sy = H / oldH;
      for (const p of particles) {
        p.hx *= sx;  p.px *= sx;  p.vx *= sx;
        p.hy *= sy;  p.py *= sy;  p.vy *= sy;
      }
    }
  }).observe(canvas);
}


function initHeroEarthFX() {
  const hero = document.getElementById("hero");
  const earth = document.querySelector(".heroEarth");
  if (!hero || !earth) return;

  const reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let raf = 0;
  let targetX = 0;
  let targetY = 0;
  let curX = 0;
  let curY = 0;

  function onMove(e) {
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / Math.max(1, r.width);
    const y = (e.clientY - r.top) / Math.max(1, r.height);

    // -1..1, then clamped so it stays subtle
    targetX = clamp((x - 0.5) * 2, -0.65, 0.65);
    targetY = clamp((y - 0.5) * 2, -0.55, 0.55);

    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick() {
    raf = 0;

    // smoother + slower
    curX += (targetX - curX) * 0.04;
    curY += (targetY - curY) * 0.04;

    earth.style.setProperty("--hx", curX.toFixed(3));
    earth.style.setProperty("--hy", curY.toFixed(3));

    // keep easing if we're not close yet
    if (Math.abs(targetX - curX) > 0.002 || Math.abs(targetY - curY) > 0.002) {
      raf = requestAnimationFrame(tick);
    }
  }

  hero.addEventListener("pointermove", onMove, { passive: true });
  hero.addEventListener(
    "pointerleave",
    () => {
      targetX = 0;
      targetY = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    },
    { passive: true },
  );
}

/* ------------------------------
   Hero skill ticker (red pill)
------------------------------ */
function initHeroSkillTicker() {
  const pill = document.getElementById("skillPill");
  if (!pill) return;

  const skills = [
    "SAP Consulting",
    "ABAP Development",
    "Fiori / UI5",
    "CDS & OData",
    "Integrations",
    "Automation",
    "Applied AI",
  ];

  let i = 0;

  function swap() {
    pill.classList.add("isOut");
    window.setTimeout(() => {
      i = (i + 1) % skills.length;
      pill.textContent = skills[i];
      pill.classList.remove("isOut");
    }, 260);
  }

  // start from whatever is in HTML, then rotate
  window.setInterval(swap, 2000);
}

function initMoreDropdown() {
  const btn = document.getElementById("moreBtn");
  const menu = document.getElementById("moreMenu");
  if (!btn || !menu) return;

  const close = () => {
    menu.setAttribute("hidden", "");
    btn.setAttribute("aria-expanded", "false");
  };

  const open = () => {
    menu.removeAttribute("hidden");
    btn.setAttribute("aria-expanded", "true");
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !menu.hasAttribute("hidden");
    if (isOpen) close();
    else open();
  });

  menu.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    close();
  });

  document.addEventListener("click", close);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

function initAboutTabs() {
  const bar    = document.querySelector('.abtTabBar');
  const tabs   = document.querySelectorAll('.abtTab');
  const panels = document.querySelectorAll('.abtPanel');
  const ink    = document.querySelector('.abtTabInk');
  if (!bar || !tabs.length) return;

  function moveInk(tab) {
    if (!ink) return;
    ink.style.left  = tab.offsetLeft + 'px';
    ink.style.width = tab.offsetWidth + 'px';
  }

  function activate(idx) {
    tabs.forEach((t, i) => {
      const on = i === idx;
      t.classList.toggle('is-on', on);
      t.setAttribute('aria-selected', String(on));
    });
    panels.forEach((p, i) => p.classList.toggle('is-on', i === idx));
    moveInk(tabs[idx]);
  }

  tabs.forEach((tab, idx) => {
    tab.addEventListener('click', () => activate(idx));
  });

  // Set initial ink position after layout
  requestAnimationFrame(() => moveInk(tabs[0]));
}

function initAboutStats() {
  // Auto-compute years for any stat with data-since="YYYY-MM"
  document.querySelectorAll('.abtStatN[data-since]').forEach(el => {
    const [y, m] = el.dataset.since.split('-').map(Number);
    const yrs = Math.max(1, Math.floor(
      (Date.now() - new Date(y, m - 1, 1)) / (365.25 * 24 * 3600 * 1e3)
    ));
    el.dataset.to = yrs;
  });

  const nums = document.querySelectorAll('.abtStatN');
  if (!nums.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      obs.unobserve(entry.target);
      const el  = entry.target;
      const to  = parseInt(el.dataset.to || '0', 10);
      const dur = 1200;
      const start = performance.now();
      (function tick(now) {
        const t = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(ease * to);
        if (t < 1) requestAnimationFrame(tick);
      })(start);
    });
  }, { threshold: 0.6 });

  nums.forEach(n => obs.observe(n));
}

/* ------------------------------
   Init
------------------------------ */
async function init() {
  initTheme();
  initBackground();
  //initDeepFade();
  initHeaderPillNav();

  // Fonts can be one of the slowest first-paint items (Google Fonts)
  try {
    if (document.fonts && document.fonts.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((r) => setTimeout(r, 800)),
      ]);
    }
  } catch {
    // ignore
  }

  initBgStars();
  initHeroThree();
  initHeroSkillTicker();
  initMpHero();
  /* Defer showcase init by one frame so the hero section is fully laid out
     before the canvas reads its dimensions via getBoundingClientRect(). */
  requestAnimationFrame(initShowcase);


  forceTopAndRefresh();
  window.addEventListener("load", forceTopAndRefresh, { once: true });

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Update these:
  const emailWork = "mpu@2bm.dk";
  const emailPrivate = "maurits.pug@gmail.com";
  const githubProfile = "https://github.com/maurits2905";
  const linkedinProfile =
    "https://www.linkedin.com/in/maurits-puggaard-4095351b0/";
  const xProfile = "https://x.com/maurits2905";
  const igProfile = "https://www.instagram.com/maurits2905/";

  initContactSheet({
    emailPrivate,
    githubProfile,
    linkedinProfile,
    xProfile,
    igProfile,
  });

  initStatsModal({ githubUsername: "maurits2905" });

  // Header email (private only)
  const topEmail = document.getElementById("topEmail");
  if (topEmail) {
    topEmail.textContent = emailPrivate;
    topEmail.href = `mailto:${emailPrivate}`;
  }

  const ghIcon = document.getElementById("ghIcon");
  const liIcon = document.getElementById("liIcon");
  const xIcon = document.getElementById("xIcon");
  const igIcon = document.getElementById("igIcon");

  if (ghIcon) ghIcon.href = githubProfile;
  if (liIcon) liIcon.href = linkedinProfile;
  if (xIcon) xIcon.href = xProfile;
  if (igIcon) igIcon.href = igProfile;

  // Contact cards
  const ghText = document.getElementById("githubText");
  const ghLink = document.getElementById("githubLink");
  if (ghText)
    ghText.textContent = "@" + (githubProfile.split("/").pop() || "YOURNAME");
  if (ghLink) ghLink.href = githubProfile;

  // Contact cards - emails
  const workEmailText = document.getElementById("workEmailText");
  const workEmailLink = document.getElementById("workEmailLink");
  if (workEmailText) workEmailText.textContent = emailPrivate;
  if (workEmailLink) workEmailLink.href = `mailto:${emailPrivate}`;

  const privateEmailText = document.getElementById("privateEmailText");
  const privateEmailLink = document.getElementById("privateEmailLink");
  if (privateEmailText) privateEmailText.textContent = emailPrivate;
  if (privateEmailLink) privateEmailLink.href = `mailto:${emailPrivate}`;

  const liLink = document.getElementById("linkedinLink");
  if (liLink) liLink.href = linkedinProfile;

  const xLink = document.getElementById("xLink");
  const igLink = document.getElementById("igLink");

  if (xLink) xLink.href = xProfile;
  if (igLink) igLink.href = igProfile;

  function initContactSheet({
    emailPrivate,
    githubProfile,
    linkedinProfile,
    xProfile,
    igProfile,
  }) {
    const openBtn = document.getElementById("statsBtn");
    const overlay = document.getElementById("contactOverlay");
    const sheet = document.getElementById("contactSheet");
    const closeBtn = document.getElementById("contactClose");
    const copyBtn = document.getElementById("contactCopyBtn");
    const copyValue = document.getElementById("contactCopyValue");

    const emailLink = document.getElementById("contactEmailLink");
    const callLink = document.getElementById("contactCallLink");

    const ghMini = document.getElementById("contactGhMini");
    const liMini = document.getElementById("contactLiMini");
    const xMini = document.getElementById("contactXMini");
    const igMini = document.getElementById("contactIgMini");

    if (!openBtn || !overlay || !sheet || !closeBtn) return;

    // Wire links
    if (emailLink) emailLink.href = `mailto:${emailPrivate}`;
    if (callLink)
      callLink.href = `mailto:${emailPrivate}?subject=Call%20request&body=Hey%20Maurits%2C%0A%0AI'd%20love%20to%20book%20a%2030%20min%20call.%20Here%20are%20a%20few%20times%20that%20work%20for%20me%3A%0A-%20%0A-%20%0A%0AThanks!`;

    if (ghMini) ghMini.href = githubProfile;
    if (liMini) liMini.href = linkedinProfile;
    if (xMini) xMini.href = xProfile;
    if (igMini) igMini.href = igProfile;

    if (copyValue) copyValue.textContent = emailPrivate;

    let lastFocus = null;

    const open = () => {
      lastFocus = document.activeElement;
      document.body.classList.add("contactOpen");
      overlay.hidden = false;
      sheet.setAttribute("aria-hidden", "false");

      // focus close for accessibility
      closeBtn.focus({ preventScroll: true });
    };

    const close = () => {
      document.body.classList.remove("contactOpen");
      sheet.setAttribute("aria-hidden", "true");

      // let the animation finish, then hide overlay so it doesn't block clicks
      window.setTimeout(() => {
        overlay.hidden = true;
      }, 240);

      if (lastFocus && typeof lastFocus.focus === "function") {
        lastFocus.focus({ preventScroll: true });
      }
    };

    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      open();
    });

    // Footer "Contact" button opens the same sheet
    const footerContactBtn = document.getElementById("footerContactBtn");
    if (footerContactBtn) {
      footerContactBtn.addEventListener("click", (e) => {
        e.preventDefault();
        open();
      });
    }

    closeBtn.addEventListener("click", close);

    overlay.addEventListener("click", close);

    window.addEventListener("keydown", (e) => {
      if (!document.body.classList.contains("contactOpen")) return;
      if (e.key === "Escape") close();
    });

    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(emailPrivate);
          copyBtn.classList.add("copied");
          const label = copyBtn.querySelector(".copyText");
          if (label) {
            const old = label.textContent;
            label.textContent = "Copied!";
            window.setTimeout(() => (label.textContent = old), 900);
          }
        } catch {
          // fallback: open mail client if clipboard blocked
          window.location.href = `mailto:${emailPrivate}`;
        }
      });
    }
  }

  // Resume placeholder (put resume.pdf in repo root)
  const resumeBtn = document.getElementById("resumeBtn");
  if (resumeBtn) resumeBtn.href = "#";

  const themeBtn = document.getElementById("themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme") || "dark";
      setTheme(cur === "dark" ? "light" : "dark");
    });
  }

  const backTop = document.getElementById("backTop");
  if (backTop) {
    backTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  initReveals();
  initSecBridges();
  initAboutReveal();
  initAboutStats();
  initStory();
  initChapterRail();

  // Career
  initMpCareer();


  // Projects
  try {
    const res = await fetch("projects.json", { cache: "default" });
    state.projects = await res.json();
    state.tags = uniqueTags(state.projects);
    // Update pinned story stats
    const proj = document.getElementById("statProjects");
    const tags = document.getElementById("statTags");
    if (proj) proj.textContent = String(state.projects.length);
    if (tags) tags.textContent = String(Math.max(0, state.tags.length - 1));

    state.activeTag = "All";

    // NOTE: featured is now part of the rail (no separate featured card)
    renderWork();

    // Warm up a few project images so the projects section feels instant
    try {
      const imgs = state.projects
        .filter((p) => p && p.imageUrl)
        .sort(
          (a, b) =>
            (b.featured === true) - (a.featured === true) ||
            (b.date || "").localeCompare(a.date || ""),
        )
        .map((p) => p.imageUrl);

      await preloadImages(imgs, 8);
    } catch {
      // ignore
    }
    } catch (e) {
    console.warn("projects.json not found or invalid", e);
  }

  renderStack();

  // Projects expanded the layout — recalculate all ScrollTrigger positions
  // so the reveal curtains on #tech and #ask fire at the correct scroll position.
  requestAnimationFrame(() => {
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  });

  // Search
  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("clearSearch");

  const syncClearBtn = () => {
    if (!clearBtn || !searchInput) return;
    clearBtn.hidden = !(searchInput.value || "").trim().length;
  };

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.query = e.target.value || "";
      syncClearBtn();
      renderWork();
    });
  }

  if (clearBtn && searchInput) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      state.query = "";
      syncClearBtn();
      renderWork();
      searchInput.focus();
    });
  }

  // set initial state (important so it doesn't show on load)
  syncClearBtn();

  // Filters (tags) drawer
  const tagsToggle = document.getElementById("tagsToggle");
  const tagsDrawer = document.getElementById("tagsDrawer");
  if (tagsToggle && tagsDrawer) {
    tagsToggle.addEventListener("click", () => {
      const isOpen = !tagsDrawer.hasAttribute("hidden");
      if (isOpen) {
        tagsDrawer.setAttribute("hidden", "");
        tagsToggle.setAttribute("aria-expanded", "false");
      } else {
        tagsDrawer.removeAttribute("hidden");
        tagsToggle.setAttribute("aria-expanded", "true");
      }
    });
  }

  // Show More / Show Less
  const showMoreBtn = document.getElementById("workShowMore");
  if (showMoreBtn) {
    showMoreBtn.addEventListener("click", () => {
      state.workExpanded = !state.workExpanded;
      renderWork();
      // Scroll back to section top when collapsing
      if (!state.workExpanded) {
        document
          .getElementById("work")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  // Rail arrows + initial no-flash
  const rail = document.querySelector(".railViewport");
  const next = document.getElementById("railNext");
  const prev = document.getElementById("railPrev");

  if (prev) prev.hidden = true;
  if (next) next.hidden = true;

  const updateRailArrows = () => {
    if (!rail || !next || !prev) return;

    const empty = document.getElementById("emptyState");
    const grid = document.getElementById("workGrid");
    const hasCards = grid && grid.children && grid.children.length > 0;

    // If no results are visible, hide both arrows no matter what
    if ((empty && !empty.hidden) || !hasCards) {
      prev.hidden = true;
      next.hidden = true;
      return;
    }

    const max = rail.scrollWidth - rail.clientWidth;
    const x = rail.scrollLeft;

    prev.hidden = x < 10;
    next.hidden = max - x < 10;
  };

  if (rail && next) {
    next.addEventListener("click", () => {
      rail.scrollBy({ left: rail.clientWidth * 0.9, behavior: "smooth" });
    });
  }
  if (rail && prev) {
    prev.addEventListener("click", () => {
      rail.scrollBy({ left: -rail.clientWidth * 0.9, behavior: "smooth" });
    });
  }
  if (rail) {
    rail.addEventListener("scroll", () =>
      requestAnimationFrame(updateRailArrows),
    );
    window.addEventListener("resize", () =>
      requestAnimationFrame(updateRailArrows),
    );

    // Two RAFs helps ensure layout/fonts have settled before measuring widths
    requestAnimationFrame(() => requestAnimationFrame(updateRailArrows));
  }

  // Animate projects on first enter
  const workSection = document.getElementById("work");
  if (workSection && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        const ent = entries[0];
        if (!ent || !ent.isIntersecting) return;

        // ✅ first time only
        if (!state.workEntered) {
          state.workEntered = true;
          animateWorkCards();
        }

        io.disconnect();
      },
      { threshold: 0.2 },
    );

    io.observe(workSection);
  } else {
    state.workEntered = true;
  }

  initAskMe();
  initAskBg();

  /* ── Signal title scroll-reveal ── */
  const sigTitles = document.querySelectorAll('.sectionTitle, .techTitle, .careerTitle');
  if (sigTitles.length) {
    const sigObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.remove('sig-hidden');
          e.target.classList.add('sig-visible');
          sigObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.15 });
    sigTitles.forEach(el => {
      el.classList.add('sig-hidden');
      sigObs.observe(el);
    });
  }

  /* ── Ask Me narrative bridge reveal ── */
  const anbEl = document.querySelector('.askNarrBridge');
  if (anbEl) {
    const anbObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          anbEl.classList.add('anb-visible');
          anbObs.disconnect();
        }
      });
    }, { threshold: 0.5 });
    anbObs.observe(anbEl);
  }

}

init().catch((e) => {
  console.error(e);
});

/* ─────────────────────────────────────────────────────────────────
   Chapter Rail — scroll-driven narrative progress indicator
   Maps 8 narrative stages (Field → Contact) to their section IDs
   and highlights the current stage as the user scrolls.
───────────────────────────────────────────────────────────────── */
function initChapterRail() {
  const rail = document.getElementById("crRail");
  if (!rail) return;

  // Sections in order — must match the crItem order in HTML
  const STOPS = ["hero", "about", "career", "work", "tech", "ask", "contact"];

  const items      = Array.from(rail.querySelectorAll(".crItem"));
  const fill       = document.getElementById("crFill");
  const trackEl    = rail.querySelector(".crTrack");
  const sectionEls = STOPS.map((id) => document.getElementById(id));

  let activeIdx = -1;
  let raf = 0;
  let dotX = null; // cached dot X offset from track left

  // Measure and cache the dot center's X position relative to the track.
  // This drives both the fill's left and the spine ::before via a CSS var.
  function alignSpine() {
    const firstDot = items[0]?.querySelector(".crDot");
    if (!firstDot || !trackEl) return;
    const dr = firstDot.getBoundingClientRect();
    const tr = trackEl.getBoundingClientRect();
    dotX = dr.left + dr.width / 2 - tr.left; // dot centre from track left
    fill.style.left = dotX + "px";
    trackEl.style.setProperty("--cr-dot-x", dotX + "px");
  }

  function setActive(idx) {
    if (idx === activeIdx) return;
    activeIdx = idx;
    items.forEach((el, i) => el.classList.toggle("cr-active", i === idx));
    // Re-measure after the class change so spine and fill stay aligned
    requestAnimationFrame(() => {
      alignSpine();
      updateFill(idx);
    });
  }

  function updateFill(idx) {
    if (!fill || !items[idx] || !trackEl) return;
    alignSpine(); // always re-measure — never use stale dotX
    const dot       = items[idx].querySelector(".crDot");
    if (!dot) return;
    const dotRect   = dot.getBoundingClientRect();
    const trackRect = trackEl.getBoundingClientRect();
    // Grow fill from track top (0) to active dot centre
    const dotCenterInTrack = dotRect.top + dotRect.height / 2 - trackRect.top;
    fill.style.height = Math.max(0, dotCenterInTrack) + "px";
  }

  function update() {
    raf = 0;
    const threshold = window.innerHeight * 0.40;
    let best = 0;
    sectionEls.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= threshold) best = i;
    });
    setActive(best);
  }

  window.addEventListener("scroll", () => {
    if (!raf) raf = requestAnimationFrame(update);
  }, { passive: true });

  window.addEventListener("resize", () => {
    dotX = null;        // re-measure on resize
    alignSpine();
    if (!raf) raf = requestAnimationFrame(update);
  }, { passive: true });

  // Align after layout is stable
  requestAnimationFrame(() => {
    alignSpine();
    update();
  });
}

/* ---------------------------
   Tech Stack tiles (grouped)
--------------------------- */
const TECH_GROUPS = [
  {
    title: "Languages",
    items: [
      { name: "Python", slug: "python", url: "https://www.python.org/" },
      {
        name: "JavaScript",
        slug: "javascript",
        url: "https://www.javascript.com/",
      },
      {
        name: ".NET / C#",
        slug: "dotnet",
        url: "https://learn.microsoft.com/en-us/dotnet/csharp/",
      },
      {
        name: "ABAP",
        slug: "sap",
        url: "https://learning.sap.com/products/business-technology-platform/development/abap",
      },
      {
        name: "SQL",
        slug: "postgresql",
        url: "https://www.w3schools.com/sql/",
      },
      {
        name: "HTML",
        slug: "html5",
        url: "https://developer.mozilla.org/en-US/docs/Web/HTML",
      },
      {
        name: "CSS",
        slug: "css3",
        url: "https://developer.mozilla.org/en-US/docs/Web/CSS",
      },
    ],
  },
  {
    title: "SAP & Enterprise",
    items: [
      {
        name: "SAP S/4HANA",
        slug: "sap",
        url: "https://www.sap.com/products/erp/s4hana.html",
      },
      {
        name: "SAP ERP",
        slug: "sap",
        url: "https://www.sap.com/products/erp.html",
      },
      {
        name: "SAP Fiori",
        slug: "sap",
        url: "https://www.sap.com/products/technology-platform/fiori.html",
      },
      {
        name: "SAP UI5",
        slug: "sap",
        url: "https://ui5.sap.com/",
      },
      {
        name: "SAP BTP",
        slug: "sap",
        url: "https://www.sap.com/products/technology-platform.html",
      },
      {
        name: "SAP MM",
        slug: "sap",
        url: "https://help.sap.com/docs/SAP_ERP",
      },
      {
        name: "SAP SD",
        slug: "sap",
        url: "https://help.sap.com/docs/SAP_ERP",
      },
    ],
  },
  {
    title: "Frameworks & Machine Learning",
    items: [
      {
        name: "React",
        slug: "react",
        url: "https://react.dev/",
      },
      {
        name: "PyTorch",
        slug: "pytorch",
        url: "https://pytorch.org/",
      },
      {
        name: "TensorFlow",
        slug: "tensorflow",
        url: "https://www.tensorflow.org/",
      },
      {
        name: "scikit-learn",
        slug: "scikitlearn",
        url: "https://scikit-learn.org/",
      },
      {
        name: "OpenCV",
        slug: "opencv",
        url: "https://opencv.org/",
      },
    ],
  },
  {
    title: "Data & Databases",
    items: [
      {
        name: "PostgreSQL",
        slug: "postgresql",
        url: "https://www.postgresql.org/",
      },
      {
        name: "MySQL",
        slug: "mysql",
        url: "https://www.mysql.com/",
      },

      {
        name: "MongoDB",
        slug: "mongodb",
        url: "https://www.mongodb.com/",
      },
      {
        name: "Pandas",
        slug: "pandas",
        url: "https://pandas.pydata.org/",
      },
      {
        name: "NumPy",
        slug: "numpy",
        url: "https://numpy.org/",
      },
    ],
  },
  {
    title: "DevOps & Infrastructure",
    items: [
      {
        name: "Docker",
        slug: "docker",
        url: "https://www.docker.com/",
      },
      {
        name: "Azure",
        slug: "microsoftazure",
        url: "https://azure.microsoft.com/",
      },
      {
        name: "Git",
        slug: "git",
        url: "https://git-scm.com/",
      },
      {
        name: "GitHub",
        slug: "github",
        url: "https://github.com/",
      },
    ],
  },
  {
    title: "Development Tools",
    items: [
      {
        name: "VS Code",
        slug: "visualstudiocode",
        url: "https://code.visualstudio.com/",
      },
      {
        name: "IntelliJ",
        slug: "intellijidea",
        url: "https://www.jetbrains.com/idea/",
      },
      {
        name: "Jupyter",
        slug: "jupyter",
        url: "https://jupyter.org/",
      },
      {
        name: "Postman",
        slug: "postman",
        url: "https://www.postman.com/",
      },
    ],
  },
  {
    title: "AI & Platforms",
    items: [
      {
        name: "Claude",
        slug: "claude",
        url: "https://claude.ai/",
      },
      {
        name: "Claude Code",
        slug: "claudecode",
        url: "https://claude.ai/code",
      },
      {
        name: "Hugging Face",
        slug: "huggingface",
        url: "https://huggingface.co/",
      },
      {
        name: "OpenAI",
        slug: "openai",
        url: "https://openai.com/",
      },
    ],
  },
];

// Fallback to Devicon
const DEVICON_FALLBACK = {
  css3: "devicon-css3-plain",
  microsoftazure: "devicon-azure-plain",
  visualstudiocode: "devicon-vscode-plain",
};

async function fetchSvg(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.text();
}

async function getIconMarkup(slug) {
  // 1) Simple Icons CDN
  const si1 = await fetchSvg(`https://cdn.simpleicons.org/${slug}`);
  if (si1) return si1;

  // 2) jsDelivr Simple Icons fallback
  const si2 = await fetchSvg(
    `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`,
  );
  if (si2) return si2;

  // 3) Special fallbacks
  if (slug === "openai") {
    return `
      <svg viewBox="0 0 24 24" role="img" aria-label="OpenAI">
        <rect x="2.5" y="2.5" width="19" height="19" rx="6"
              fill="none" stroke="currentColor" stroke-width="1.6"/>
        <text x="12" y="14.2" text-anchor="middle"
              font-size="7.5"
              font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial"
              fill="currentColor">AI</text>
      </svg>
    `;
  }
  if (slug === "claude") {
    /* Anthropic / Claude — simplified diamond logo */
    return `
      <svg viewBox="0 0 24 24" role="img" aria-label="Claude" fill="currentColor">
        <path d="M12 2.5 L19 8 L19 16 L12 21.5 L5 16 L5 8 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M9 12 L11.2 7 L13.4 12 L11.2 17 Z" opacity="0.8"/>
      </svg>
    `;
  }
  if (slug === "claudecode") {
    /* Claude Code — terminal prompt icon */
    return `
      <svg viewBox="0 0 24 24" role="img" aria-label="Claude Code" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="16" rx="2"/>
        <path d="M7 9 L10 12 L7 15"/>
        <path d="M13 15 L17 15"/>
      </svg>
    `;
  }

  // 4) Devicon fallback
  const devClass = DEVICON_FALLBACK[slug];
  if (devClass) return `<i class="${devClass}"></i>`;

  // 5) Final fallback
  return `
    <svg viewBox="0 0 24 24" role="img" aria-label="${slug}">
      <circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.35"></circle>
    </svg>
  `;
}

/* ----------------------------------------------------------
   Tech Stack — Heatmap canvas background
   Grid of code glyphs whose brightness flows with sine-wave
   heat patterns, creating a live heat-map of symbols.
   ---------------------------------------------------------- */
function initTechHeatmap() {
  const canvas  = document.getElementById("techHeatCanvas");
  const section = document.getElementById("tech");
  if (!canvas || !section) return;

  const ctx = canvas.getContext("2d");

  // Code-symbol charset
  const CHARS = "01{}[]<>/\\|;:.#@!$%^&*()=+-_~`";

  const CELL = 18;   // px per glyph cell
  let cols, rows, grid;
  let t = 0;
  let rafId = null;
  let running = false;

  // ── Build / rebuild glyph grid ──
  function resize() {
    canvas.width  = section.offsetWidth;
    canvas.height = section.offsetHeight;
    cols = Math.ceil(canvas.width  / CELL) + 1;
    rows = Math.ceil(canvas.height / CELL) + 1;
    grid = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        grid[r][c] = {
          ch:    CHARS[Math.floor(Math.random() * CHARS.length)],
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 0.8,
          tick:  Math.random() * 3,
        };
      }
    }
  }

  // ── Heat value for a cell: multi-frequency sine sum → −1..1 ──
  function heat(c, r, time) {
    const nx = c / cols;
    const ny = r / rows;
    return (
      Math.sin(nx * 3.2 + time * 0.38 + Math.sin(ny * 2.5 + time * 0.22)) * 0.5 +
      Math.cos(ny * 2.8 + time * 0.28 + Math.cos(nx * 4.2 - time * 0.18)) * 0.5 +
      Math.sin((nx + ny) * 1.9 + time * 0.52) * 0.25
    ) / 1.25;
  }

  // ── Map heat (−1..1) to a CSS colour string ──
  function colour(h) {
    const v = (h + 1) * 0.5;          // 0..1
    if (v < 0.18) return null;         // invisible — skip draw
    if (v < 0.42) {
      // cool: very dim purple
      return `rgba(155,140,255,${((v - 0.18) / 0.24 * 0.13).toFixed(3)})`;
    }
    if (v < 0.68) {
      // warm: dim → mid purple
      const f = (v - 0.42) / 0.26;
      return `rgba(155,140,255,${(0.13 + f * 0.38).toFixed(3)})`;
    }
    if (v < 0.88) {
      // hot: purple → teal blend
      const f = (v - 0.68) / 0.20;
      const r = Math.round(155 + (68  - 155) * f);
      const g = Math.round(140 + (240 - 140) * f);
      const b = Math.round(255 + (177 - 255) * f);
      return `rgba(${r},${g},${b},${(0.51 + f * 0.32).toFixed(3)})`;
    }
    // very hot: near-white teal
    const f = (v - 0.88) / 0.12;
    return `rgba(${Math.round(68 + f * 187)},${Math.round(240 + f * 15)},${Math.round(177 + f * 78)},${(0.83 + f * 0.17).toFixed(3)})`;
  }

  // ── Draw one frame ──
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${CELL - 4}px "JetBrains Mono", ui-monospace, "Courier New", monospace`;
    ctx.textBaseline = "top";

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const h    = heat(c, r, t + cell.phase * 0.25);
        const col  = colour(h);
        if (!col) continue;

        // Hotter cells cycle glyphs faster
        const v = (h + 1) * 0.5;
        cell.tick += 0.016 * cell.speed;
        if (v > 0.55 && cell.tick > (2.4 - v * 1.6)) {
          cell.ch   = CHARS[Math.floor(Math.random() * CHARS.length)];
          cell.tick = 0;
        }

        ctx.fillStyle = col;
        ctx.fillText(cell.ch, c * CELL, r * CELL);
      }
    }

    t += 0.013;
  }

  function loop() { draw(); rafId = requestAnimationFrame(loop); }

  function start() {
    if (running) return;
    running = true;
    resize();
    loop();
  }
  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Start / stop with visibility
  const obs = new IntersectionObserver(
    (entries) => entries.forEach(e => e.isIntersecting ? start() : stop()),
    { threshold: 0.05 }
  );
  obs.observe(section);

  window.addEventListener("resize", () => { if (running) resize(); });
}

// Kick off heatmap immediately (canvas is cheap until visible)
initTechHeatmap();

/* ----------------------------------------------------------
   Tech Stack — Terminal editor renderer
   ---------------------------------------------------------- */
async function renderTechStack() {
  const mount = document.getElementById("techGrid");
  if (!mount || mount.dataset.rendered) return;
  mount.dataset.rendered = "1";

  const CAT_META = {
    "Languages":                     { color: "#7eb4ff", rgb: "126,180,255" },
    "SAP & Enterprise":              { color: "#f0c060", rgb: "240,192,96"  },
    "Frameworks & Machine Learning": { color: "#44f0b1", rgb: "68,240,177"  },
    "Data & Databases":              { color: "#b08dff", rgb: "176,141,255" },
    "DevOps & Infrastructure":       { color: "#ff8c42", rgb: "255,140,66"  },
    "Development Tools":             { color: "#6ef3c5", rgb: "110,243,197" },
    "AI & Platforms":                { color: "#e060ff", rgb: "224,96,255"  },
  };

  const totalItems = TECH_GROUPS.reduce((s, g) => s + g.items.length, 0);

  // Assign comment line numbers (each block = comment + blank + chips rows + blank)
  let ln = 1;
  const blockLn = TECH_GROUPS.map(g => {
    const n = ln;
    ln += 2 + Math.ceil(g.items.length / 5) + 2;
    return n;
  });

  // ── Sidebar HTML ──
  const sidebarHtml = TECH_GROUPS.map((g, i) => {
    const m = CAT_META[g.title] || {};
    return `<div class="tsSideItem${i === 0 ? " ts-active" : ""}"
      data-cat="${escapeHtml(g.title)}"
      style="--cat-color:${m.color};--cat-rgb:${m.rgb}"
      role="button" tabindex="0" aria-label="${escapeHtml(g.title)}">
      <span class="tsSideDot"></span>
      <span class="tsSideName">${escapeHtml(g.title)}</span>
      <span class="tsSideCount">${g.items.length}</span>
    </div>`;
  }).join("");

  // ── Content blocks HTML ──
  const blocksHtml = TECH_GROUPS.map((g, i) => {
    const m = CAT_META[g.title] || { color: "#9b8cff", rgb: "155,140,255" };
    const dashes = "─".repeat(Math.max(2, 28 - g.title.length));
    const commentText = `/* ─── ${g.title.toUpperCase()} ${dashes} */`;

    const chipsHtml = g.items.map(item =>
      `<a class="tsChip"
          href="${escapeHtml(item.url || "#")}"
          target="_blank" rel="noopener noreferrer"
          aria-label="${escapeHtml(item.name)}"
          style="--cat-color:${m.color};--cat-rgb:${m.rgb}">
        <span class="tsChipIcon" data-icon="${escapeHtml(item.slug || "")}" aria-hidden="true"></span>
        <span class="tsChipName">${escapeHtml(item.name)}</span>
      </a>`
    ).join("");

    return `<div class="tsBlock" data-cat="${escapeHtml(g.title)}" style="--cat-color:${m.color};--cat-rgb:${m.rgb}">
      <div class="tsLine tsLine--comment">
        <span class="tsLn" aria-hidden="true">${blockLn[i]}</span>
        <span class="tsCommentText" aria-hidden="true">${commentText}</span>
      </div>
      <div class="tsLine tsLine--chips">
        <span class="tsLn" aria-hidden="true"></span>
        <div class="tsChips" role="list" aria-label="${escapeHtml(g.title)} tools">${chipsHtml}</div>
      </div>
      <div class="tsLine tsLine--blank" aria-hidden="true">
        <span class="tsLn">${blockLn[i] + 1}</span>
      </div>
    </div>`;
  }).join("");

  // ── Full editor HTML ──
  mount.innerHTML = `<div class="tsWrap">
    <div class="tsEditor" role="region" aria-label="Tech stack">

      <!-- Title bar -->
      <div class="tsBar" aria-hidden="true">
        <div class="tsDots">
          <span class="tsDot tsDot--close"></span>
          <span class="tsDot tsDot--min"></span>
          <span class="tsDot tsDot--max"></span>
        </div>
        <span class="tsBarFile">stack.config.js</span>
      </div>

      <!-- Body: sidebar + main pane -->
      <div class="tsBody">
        <div class="tsSidebar" aria-label="Categories">
          <div class="tsSideHead">Explorer</div>
          <div class="tsSideTree">
            <span class="tsSideTreeCaret">▾</span>
            <span class="tsSideTreeName">stack.config.js</span>
          </div>
          <div class="tsSideItems" id="tsSideItems">${sidebarHtml}</div>
        </div>

        <div class="tsMain" id="tsMain" tabindex="0" aria-label="Tech stack items">
          <div class="tsContent" id="tsContent">${blocksHtml}</div>
        </div>
      </div>

      <!-- Status bar -->
      <div class="tsStatusBar" aria-hidden="true">
        <span class="tsStatusIcon">⎇</span>
        <span>main</span>
        <span class="tsStatusSep">·</span>
        <span>JavaScript</span>
        <span class="tsStatusSep">·</span>
        <span>${totalItems} items · ${TECH_GROUPS.length} categories</span>
        <span class="tsStatusRight">UTF-8</span>
      </div>

    </div>
  </div>`;

  // ── Load icons async ──
  const iconEls = [...mount.querySelectorAll(".tsChipIcon[data-icon]")];
  await Promise.all(iconEls.map(async (el) => {
    const slug = el.getAttribute("data-icon");
    try { el.innerHTML = await getIconMarkup(slug); }
    catch (_) { el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.35"/></svg>`; }
  }));

  // ── Staggered chip entrance when section scrolls into view ──
  const chips = [...mount.querySelectorAll(".tsChip")];
  const triggerEntrance = () => {
    chips.forEach((c, i) => setTimeout(() => c.classList.add("ts-in"), i * 22));
  };
  const sectionEl = document.getElementById("tech");
  const entryIO = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { triggerEntrance(); entryIO.disconnect(); }
  }, { threshold: 0.06 });
  if (sectionEl) entryIO.observe(sectionEl); else triggerEntrance();

  // ── Sidebar: click → scroll main pane to block ──
  const sideItems = [...mount.querySelectorAll(".tsSideItem")];
  const blocks    = [...mount.querySelectorAll(".tsBlock")];
  const mainEl    = mount.querySelector(".tsMain");

  function setActiveSide(catName) {
    sideItems.forEach(el => el.classList.toggle("ts-active", el.dataset.cat === catName));
  }

  sideItems.forEach(el => {
    const go = () => {
      const block = blocks.find(b => b.dataset.cat === el.dataset.cat);
      if (block && mainEl) {
        mainEl.scrollTo({ top: block.offsetTop - 10, behavior: "smooth" });
      }
      setActiveSide(el.dataset.cat);
    };
    el.addEventListener("click", go);
    el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });

  // ── Scroll → update active sidebar item ──
  if (mainEl && blocks.length) {
    const scrollIO = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActiveSide(e.target.dataset.cat); });
    }, { root: mainEl, threshold: 0.35 });
    blocks.forEach(b => scrollIO.observe(b));
  }
}

// Run when ready (single guard — mount.dataset.rendered prevents double run)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderTechStack);
} else {
  renderTechStack();
}

function initContactSheetUI() {
  const openBtn = document.getElementById("statsBtn"); // your header Contact button
  const overlay = document.getElementById("contactOverlay");
  const sheet = document.getElementById("contactSheet");
  const closeBtn = document.getElementById("contactClose");
  const copyBtn = document.getElementById("contactCopyBtn");

  if (!openBtn || !overlay || !sheet || !closeBtn) return;

  // Profiles (keep in ONE place)
  const emailPrivate = "maurits.pug@gmail.com";
  const linkedinProfile =
    "https://www.linkedin.com/in/maurits-puggaard-4095351b0/";
  const githubProfile = "https://github.com/maurits2905";
  const xProfile = "https://x.com/maurits2905";
  const igProfile = "https://www.instagram.com/maurits2905/";

  // Wire sheet links
  const emailLink = document.getElementById("contactEmailLink");
  if (emailLink) emailLink.href = `mailto:${emailPrivate}`;

  const liLink = document.getElementById("contactLinkedInLink");
  if (liLink) liLink.href = linkedinProfile;

  // Wire mini links (optional but nice)
  const ghMini = document.getElementById("contactGhMini");
  const liMini = document.getElementById("contactLiMini");
  const xMini = document.getElementById("contactXMini");
  const igMini = document.getElementById("contactIgMini");

  if (ghMini) ghMini.href = githubProfile;
  if (liMini) liMini.href = linkedinProfile;
  if (xMini) xMini.href = xProfile;
  if (igMini) igMini.href = igProfile;

  let isOpen = false;
  let scrollY = 0;

  const open = () => {
    if (isOpen) return;
    isOpen = true;

    scrollY = window.scrollY || 0;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    overlay.hidden = false;
    overlay.classList.add("isOpen");
    sheet.classList.add("isOpen");
    sheet.setAttribute("aria-hidden", "false");

    // focus close for accessibility
    setTimeout(() => closeBtn.focus(), 50);
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;

    overlay.classList.remove("isOpen");
    sheet.classList.remove("isOpen");
    sheet.setAttribute("aria-hidden", "true");

    // wait for slide-down to finish then hide overlay
    setTimeout(() => {
      overlay.hidden = true;

      document.body.style.position = "";
      const top = document.body.style.top;
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";

      const restore = Math.abs(parseInt(top || "0", 10)) || scrollY;
      window.scrollTo(0, restore);
    }, 280);
  };

  openBtn.addEventListener("click", (e) => {
    e.preventDefault();
    open();
  });

  closeBtn.addEventListener("click", close);

  overlay.addEventListener("click", close);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(emailPrivate);
        copyBtn.classList.add("isCopied");
        const old = copyBtn.querySelector(".copyText")?.textContent;
        const label = copyBtn.querySelector(".copyText");
        if (label) label.textContent = "Copied!";
        setTimeout(() => {
          if (label && old) label.textContent = old;
          copyBtn.classList.remove("isCopied");
        }, 1100);
      } catch {
        // fallback
        const ta = document.createElement("textarea");
        ta.value = emailPrivate;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
    });
  }
}

function initStatsModal({ githubUsername }) {
  const openBtn = document.getElementById("footerStatsBtn");
  const overlay = document.getElementById("statsOverlay");
  const modal = document.getElementById("statsModal");
  const closeBtn = document.getElementById("statsClose");

  const viewsEl = document.getElementById("statsViews");
  const likesEl = document.getElementById("statsLikes");
  const likeBtn = document.getElementById("statsLikeBtn");

  const heatImg = document.getElementById("statsHeatImg");
  const heatFoot = document.getElementById("statsHeatFoot");

  const hireableEl = document.getElementById("ghHireable");
  const reposEl = document.getElementById("ghRepos");
  const followersEl = document.getElementById("ghFollowers");
  const followingEl = document.getElementById("ghFollowing");
  const companyEl = document.getElementById("ghCompany");
  const locationEl = document.getElementById("ghLocation");

  if (!openBtn || !overlay || !modal || !closeBtn) return;

  // ---- Counters: localStorage-first, API-synced in background ----
  // localStorage is the source of truth so values persist across reloads
  // even when the external API is unavailable (CORS / rate-limit / downtime).
  const LS_VIEWS   = "pv_views";
  const LS_LIKES   = "pv_likes";
  const LS_LIKED   = "portfolioLiked";
  const LS_SESSION = "pvCounted";

  // API sync (best-effort, fire-and-forget)
  const COUNT_NS  = "maurits2905-portfolio";
  const API_BASE  = "https://api.counterapi.dev/v1";
  async function apiHit(key) {
    try {
      const r = await fetch(`${API_BASE}/${COUNT_NS}/${key}/up`);
      if (!r.ok) return null;
      const j = await r.json();
      return Number(j.value) || null;
    } catch { return null; }
  }
  async function apiGet(key) {
    try {
      const r = await fetch(`${API_BASE}/${COUNT_NS}/${key}`);
      if (!r.ok) return null;
      const j = await r.json();
      return Number(j.value) || null;
    } catch { return null; }
  }

  function markLiked() {
    if (!likeBtn) return;
    likeBtn.disabled = true;
    likeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> Loved ✓`;
  }

  function lsNum(key, fallback = 0) {
    return Math.max(parseInt(localStorage.getItem(key) ?? "") || 0, fallback);
  }

  async function loadCounts() {
    // ── Views ──────────────────────────────────────────────────────────────
    let views = lsNum(LS_VIEWS);
    const counted = sessionStorage.getItem(LS_SESSION) === "1";
    if (!counted) {
      views += 1;                                      // one increment per tab session
      localStorage.setItem(LS_VIEWS, String(views));
      sessionStorage.setItem(LS_SESSION, "1");
      apiHit("views").then(n => {                      // sync to API (background)
        if (n !== null && n > views) {
          localStorage.setItem(LS_VIEWS, String(n));
          if (viewsEl) viewsEl.textContent = String(n);
        }
      });
    } else {
      // Already counted this session — try API for the real cross-user total
      apiGet("views").then(n => {
        if (n !== null) {
          const best = Math.max(n, lsNum(LS_VIEWS));
          localStorage.setItem(LS_VIEWS, String(best));
          if (viewsEl) viewsEl.textContent = String(best);
        }
      });
    }
    if (viewsEl) viewsEl.textContent = String(views);

    // ── Likes ──────────────────────────────────────────────────────────────
    const localLikes = lsNum(LS_LIKES);
    if (likesEl) likesEl.textContent = String(localLikes);
    apiGet("likes").then(n => {                        // try to get real cross-user total
      if (n !== null) {
        const best = Math.max(n, lsNum(LS_LIKES));
        localStorage.setItem(LS_LIKES, String(best));
        if (likesEl) likesEl.textContent = String(best);
      }
    });

    // ── Like button state ──────────────────────────────────────────────────
    if (localStorage.getItem(LS_LIKED) === "1") {
      // Reconcile: if user already liked but count wasn't saved, ensure ≥ 1
      if (lsNum(LS_LIKES) === 0) {
        localStorage.setItem(LS_LIKES, "1");
        if (likesEl) likesEl.textContent = "1";
      }
      markLiked();
    } else if (likeBtn) likeBtn.disabled = false;
  }

  function onLike() {
    if (!likeBtn || likeBtn.disabled) return;

    // Update localStorage immediately — persists across reloads
    const next = lsNum(LS_LIKES) + 1;
    localStorage.setItem(LS_LIKES,  String(next));
    localStorage.setItem(LS_LIKED,  "1");
    if (likesEl) likesEl.textContent = String(next);
    markLiked();

    // Best-effort API sync — take the higher of API vs local
    apiHit("likes").then(n => {
      if (n !== null) {
        const best = Math.max(n, lsNum(LS_LIKES));
        localStorage.setItem(LS_LIKES, String(best));
        if (likesEl) likesEl.textContent = String(best);
      }
    });
  }

  if (likeBtn) likeBtn.addEventListener("click", onLike);

  // ---- GitHub user stats ----
  async function loadGitHub() {
    try {
      const r = await fetch(`https://api.github.com/users/${githubUsername}`);
      if (!r.ok) throw new Error("GitHub user fetch failed");
      const u = await r.json();

      if (hireableEl) {
        hireableEl.textContent = u.hireable ? "Yes" : "No";
        const tile = hireableEl.closest(".statsTile");
        if (tile) {
          tile.classList.toggle("statsTile--hireable", !!u.hireable);
          tile.classList.toggle("statsTile--nohire",   !u.hireable);
        }
      }
      if (reposEl) reposEl.textContent = String(u.public_repos ?? "—");
      if (followersEl) followersEl.textContent = String(u.followers ?? "—");
      if (followingEl) followingEl.textContent = String(u.following ?? "—");
      if (companyEl)
        companyEl.textContent = u.company ? String(u.company) : "—";
      if (locationEl)
        locationEl.textContent = u.location ? String(u.location) : "—";

      // Heatmap image (no token needed)
      // If you want a different style/provider, tell me and I’ll swap it.
      if (heatImg) heatImg.src = `https://ghchart.rshah.org/${githubUsername}`;
      if (heatFoot)
        heatFoot.textContent = `${u.public_repos ?? "—"} public repos · ${u.followers ?? "—"} followers`;
    } catch (e) {
      console.error(e);
      if (heatFoot)
        heatFoot.textContent = "Could not load GitHub stats right now.";
    }
  }

  // ---- Open/close (lock scroll like your contact sheet) ----
  let isOpen = false;
  let scrollY = 0;

  const open = async () => {
    if (isOpen) return;
    isOpen = true;

    scrollY = window.scrollY || 0;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    overlay.hidden = false;
    overlay.classList.add("isOpen");
    modal.classList.add("isOpen");
    modal.setAttribute("aria-hidden", "false");

    // load data once opened (feels faster)
    await Promise.allSettled([loadCounts(), loadGitHub()]);

    setTimeout(() => closeBtn.focus(), 40);
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;

    overlay.classList.remove("isOpen");
    modal.classList.remove("isOpen");
    modal.setAttribute("aria-hidden", "true");

    setTimeout(() => {
      overlay.hidden = true;

      document.body.style.position = "";
      const top = document.body.style.top;
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";

      const y = top ? Math.abs(parseInt(top, 10)) : scrollY;
      window.scrollTo(0, y);

      openBtn.focus();
    }, 220);
  };

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  overlay.addEventListener("click", close);
  window.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") close();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initContactSheetUI);
} else {
  initContactSheetUI();
}

/* ── Privacy Policy modal ── */
function initPrivacyModal() {
  const openBtn  = document.getElementById("privOpenBtn");
  const overlay  = document.getElementById("privOverlay");
  const modal    = document.getElementById("privModal");
  const closeBtn = document.getElementById("privClose");
  if (!openBtn || !overlay || !modal || !closeBtn) return;

  let isOpen = false;
  let scrollY = 0;

  const open = () => {
    if (isOpen) return;
    isOpen = true;
    scrollY = window.scrollY || 0;
    document.body.style.position = "fixed";
    document.body.style.top      = `-${scrollY}px`;
    document.body.style.left     = "0";
    document.body.style.right    = "0";
    document.body.style.width    = "100%";
    overlay.hidden = false;
    overlay.classList.add("isOpen");
    modal.classList.add("isOpen");
    modal.setAttribute("aria-hidden", "false");
    setTimeout(() => closeBtn.focus(), 40);
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove("isOpen");
    modal.classList.remove("isOpen");
    modal.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      overlay.hidden = true;
      document.body.style.position = "";
      const top = document.body.style.top;
      document.body.style.top   = "";
      document.body.style.left  = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, top ? Math.abs(parseInt(top, 10)) : scrollY);
      openBtn.focus();
    }, 260);
  };

  openBtn.addEventListener("click", (e) => { e.preventDefault(); open(); });
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", close);
  window.addEventListener("keydown", (e) => { if (isOpen && e.key === "Escape") close(); });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPrivacyModal);
} else {
  initPrivacyModal();
}

/* ── Terms of Use modal ── */
function initTermsModal() {
  const openBtn  = document.getElementById("termsOpenBtn");
  const overlay  = document.getElementById("termsOverlay");
  const modal    = document.getElementById("termsModal");
  const closeBtn = document.getElementById("termsClose");
  if (!openBtn || !overlay || !modal || !closeBtn) return;

  let isOpen = false;
  let scrollY = 0;

  const open = () => {
    if (isOpen) return;
    isOpen = true;
    scrollY = window.scrollY || 0;
    document.body.style.position = "fixed";
    document.body.style.top      = `-${scrollY}px`;
    document.body.style.left     = "0";
    document.body.style.right    = "0";
    document.body.style.width    = "100%";
    overlay.hidden = false;
    overlay.classList.add("isOpen");
    modal.classList.add("isOpen");
    modal.setAttribute("aria-hidden", "false");
    setTimeout(() => closeBtn.focus(), 40);
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove("isOpen");
    modal.classList.remove("isOpen");
    modal.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      overlay.hidden = true;
      document.body.style.position = "";
      const top = document.body.style.top;
      document.body.style.top   = "";
      document.body.style.left  = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, top ? Math.abs(parseInt(top, 10)) : scrollY);
      openBtn.focus();
    }, 260);
  };

  openBtn.addEventListener("click", (e) => { e.preventDefault(); open(); });
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", close);
  window.addEventListener("keydown", (e) => { if (isOpen && e.key === "Escape") close(); });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTermsModal);
} else {
  initTermsModal();
}

/* ══════════════════════════════════════════════════════════════
   runSlotMachine
   Replaces text in `containerEl` with per-letter slot reels.
   Each column cycles through random characters then snaps to the
   correct letter, left → right with `staggerMs` between columns.
   ══════════════════════════════════════════════════════════════ */
function runSlotMachine(containerEl, word, staggerMs) {
  const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const REEL_RANDOMS = 10;   // random chars above the target
  const COL_STAGGER  = 110;  // ms between each column starting
  const DURATION     = 1400; // ms for each column to reach target

  containerEl.innerHTML = "";

  const cols = [];

  // Build DOM for every letter
  for (let i = 0; i < word.length; i++) {
    const char = word[i];

    const slotEl = document.createElement("span");
    slotEl.className = "mpLetterSlot";

    // Ghost: invisible target char that locks the slot's width so
    // cycling characters can't cause layout reflow.
    const ghostEl = document.createElement("span");
    ghostEl.className = "mpLetterGhost";
    ghostEl.setAttribute("aria-hidden", "true");
    ghostEl.textContent = char;
    slotEl.appendChild(ghostEl);

    // Reel: absolutely positioned column of chars
    const reelEl = document.createElement("span");
    reelEl.className = "mpLetterReel";

    // Random chars that scroll past before the target
    for (let r = 0; r < REEL_RANDOMS; r++) {
      const c = document.createElement("span");
      c.className = "mpLetterChar";
      c.textContent = CHARSET[Math.floor(Math.random() * CHARSET.length)];
      reelEl.appendChild(c);
    }
    // The target character sits at the bottom of the reel
    const target = document.createElement("span");
    target.className = "mpLetterChar";
    target.textContent = char;
    reelEl.appendChild(target);

    slotEl.appendChild(reelEl);
    containerEl.appendChild(slotEl);
    cols.push({ reel: reelEl, slot: slotEl });
  }

  // Measure after layout so we get real pixel heights
  requestAnimationFrame(() => {
    const charH = cols[0] ? cols[0].slot.offsetHeight : 0;
    if (!charH) return;
    const travelPx = REEL_RANDOMS * charH; // distance to final char

    cols.forEach(({ reel }, i) => {
      const delay = staggerMs + i * COL_STAGGER;
      setTimeout(() => {
        reel.style.transition =
          `transform ${DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`;
        reel.style.transform = `translateY(-${travelPx}px)`;
      }, delay);
    });

    // Once every column has finished animating, swap the slot DOM for
    // plain text. The pixel translateY becomes stale on resize (the font
    // is clamp-based so charHeight changes), which makes the text vanish.
    // Plain text is always resize-safe.
    const settleDuration =
      staggerMs + (cols.length - 1) * COL_STAGGER + DURATION + 80;
    setTimeout(() => {
      containerEl.textContent = word;
    }, settleDuration);
  });
}

/* ══════════════════════════════════════════════════════════════
   initMpHero
   Full hero redesign:
   1. 8 small portrait photos cycle at center
   2. Last photo zooms to full screen
   3. Full-screen carousel + title reveal
   4. Scroll → 6 vertical blinds close (staggered left→right)
   5. Rolling text section rises on scroll
   ══════════════════════════════════════════════════════════════ */
function initMpHero() {
  const introWrap = document.getElementById("mpIntroWrap");
  if (!introWrap) return; // guard: not on this page

  const titleWrap  = document.getElementById("mpTitleWrap");
  const heroSub    = document.getElementById("mpHeroSub");
  const scrollCue  = document.getElementById("mpScrollCue");
  const heroWrap   = document.getElementById("hero");
  const rollSection = null; // marquee is now CSS-animated, no JS needed
  const rollTrack   = null;

  const introPhotos = Array.from(introWrap.querySelectorAll(".mpIntroPhoto"));
  const vidA = document.getElementById("mpVidA");
  const vidB = document.getElementById("mpVidB");
  const blinds = Array.from(document.querySelectorAll(".mpBlind"));

  // Position blinds at exact integer-pixel boundaries with 2px right overhang.
  // CSS percentages can't guarantee subpixel-gap-free coverage; integer pixels can.
  // Each blind overlaps the next by 2px (all black → invisible). The container's
  // overflow:hidden clips the cumulative overhang on the right.
  function positionBlinds() {
    const container = document.getElementById("mpBlinds");
    if (!container || !blinds.length) return;
    const W = container.offsetWidth;
    const n = blinds.length;
    blinds.forEach((blind, i) => {
      const left  = Math.floor(i * W / n);
      const right = i === n - 1 ? W : Math.floor((i + 1) * W / n);
      blind.style.left  = left + "px";
      blind.style.width = (right - left + 2) + "px"; // +2px overlap into next
    });
  }
  positionBlinds();
  window.addEventListener("resize", positionBlinds);

  // Ordered list of intro videos — Intro_1 is the zoom target,
  // rest cycle after the zoom completes, looping back to Intro_1.
  const VIDEO_LIST = [
    "videos/Intro_1.mp4",
    "videos/Intro_2.mp4",
    "videos/Intro_3.mp4",
    "videos/Intro_4.mp4",
    "videos/Intro_5.mp4",
    "videos/Intro_6.mp4",
    "videos/Intro_7.mp4",
    "videos/Intro_8.mp4",
    "videos/Intro_9.mp4",
    "videos/Intro_10.mp4",
    "videos/Intro_11.mp4",
  ];

  // Preload Intro_1 and Intro_2 immediately so they are buffered
  // well before the last photo slot fires (~3 s from now).
  if (vidA) { vidA.src = VIDEO_LIST[0]; vidA.preload = "auto"; vidA.load(); }
  if (vidB) { vidB.src = VIDEO_LIST[1]; vidB.preload = "auto"; vidB.load(); }

  // ── Blind close timings: [scrollStart, scrollEnd] fractions 0–1 ──
  // Leftmost closes fastest, rightmost closes slowest (subtle stagger)
  const BLIND_TIMINGS = [
    [0.00, 0.52],
    [0.06, 0.60],
    [0.12, 0.70],
    [0.20, 0.80],
    [0.28, 0.90],
    [0.36, 1.00],
  ];

  function smoothStep(t) {
    return t * t * (3 - 2 * t);
  }

  // ── Phase 1: Cycle intro portraits ──
  let introIdx = 0;
  const INTRO_INTERVAL = 370; // ms per portrait

  function showIntroPhoto(i) {
    introPhotos.forEach((p, j) => p.classList.toggle("mp-active", j === i));
  }

  const introTimer = setInterval(() => {
    introIdx = (introIdx + 1) % introPhotos.length;
    showIntroPhoto(introIdx);

    if (introIdx === introPhotos.length - 1) {
      // Reached last portrait slot — switch to Intro_1 video instantly.
      // vidA is already buffered (preloaded at init), so the first frame
      // is available immediately with no black flash.
      clearInterval(introTimer);
      if (vidA) {
        vidA.play().catch(() => {});
        // Show instantly (no CSS transition) so the cut is sharp
        vidA.style.transition = "none";
        vidA.style.opacity    = "1";
        // Re-enable CSS transition after one paint so future fades work
        requestAnimationFrame(() => requestAnimationFrame(() => {
          vidA.style.transition = "";
          vidA.style.opacity    = "";
          vidA.classList.add("mp-visible");
        }));
      }
      // Let the visitor clearly see the video in the portrait window
      // before zoom begins — 800 ms gives a definite "landing" feel.
      setTimeout(startZoom, 800);
    }
  }, INTRO_INTERVAL);

  // ── Phase 2: Zoom + simultaneous letter-slot reveal ──
  function startZoom() {
    // vidA is already playing Intro_1 through the portrait window —
    // just expand the clip-path to reveal it full-screen.
    introWrap.classList.add("mp-zoomed");

    // Show title container immediately so slot reels are visible
    // during the clip-path expansion (same as the reference site)
    if (titleWrap) titleWrap.classList.add("mp-visible");

    // Start both words' slot machines — staggered so MAURITS
    // resolves first, PUGGAARD follows ~120 ms later.
    // 200 ms head-start lets the zoom begin before characters appear.
    setTimeout(() => {
      const lines = titleWrap
        ? titleWrap.querySelectorAll(".mpTitleInner")
        : [];
      const words = ["MAURITS", "PUGGAARD"];
      lines.forEach((line, idx) => {
        runSlotMachine(line, words[idx], idx * 120);
      });
    }, 200);

    // After zoom completes: reveal all chrome + start video sequence
    // (introWrap stays fully visible — the video IS the background now)
    setTimeout(() => {
      if (heroSub) heroSub.classList.add("mp-visible");
      if (scrollCue) scrollCue.classList.add("mp-visible");
      // Fade in header and resume button now that the intro is done
      document.querySelector(".topbar")?.classList.add("mp-chrome-ready");
      document.querySelector(".resumeBtn")?.classList.add("mp-chrome-ready");
      if (vidA) startVideoSequence(0, vidA, vidB);
    }, 2900);
  }

  // ── Phase 3: Video sequence — ping-pong cross-fade through all clips ──
  // currentIdx  : index of the video currently playing in activeEl
  // activeEl    : the <video> currently faded in
  // inactiveEl  : the <video> preloaded with the NEXT clip (hidden)
  function startVideoSequence(currentIdx, activeEl, inactiveEl) {
    function scheduleNext() {
      const nextIdx   = (currentIdx + 1) % VIDEO_LIST.length;
      const afterNext = (nextIdx   + 1) % VIDEO_LIST.length;

      // inactiveEl already has the next src preloaded — just play & cross-fade
      inactiveEl.play().catch(() => {});
      inactiveEl.classList.add("mp-visible");
      activeEl.classList.remove("mp-visible");

      // *** Capture the OLD active BEFORE swapping references so the
      //     timeout below doesn't accidentally target the new active. ***
      const oldActive = activeEl;

      // Swap roles for the next iteration
      currentIdx = nextIdx;
      activeEl   = inactiveEl;
      inactiveEl = oldActive;

      // After old active has faded out, pause it and preload the one-after-next
      setTimeout(() => {
        oldActive.pause();
        oldActive.src = VIDEO_LIST[afterNext];
        oldActive.load();
      }, 950); // slightly longer than the 0.9s opacity transition

      // Wait for the new active to finish, then do it all again
      activeEl.addEventListener("ended", scheduleNext, { once: true });
    }

    // Attach ended handler to the currently-playing Intro_1
    activeEl.addEventListener("ended", scheduleNext, { once: true });
  }

  // ── Phase 4 & 5: Scroll handler — blinds + rolling text ──
  function onMpScroll() {
    // Blinds (driven by scroll through mpHeroWrap)
    if (heroWrap && blinds.length) {
      const scrollable = heroWrap.offsetHeight - window.innerHeight;
      const progress   = Math.max(0, Math.min(1,
        -heroWrap.getBoundingClientRect().top / scrollable
      ));

      blinds.forEach((blind, i) => {
        const [s, e] = BLIND_TIMINGS[i];
        let t = (progress - s) / (e - s);
        t = smoothStep(Math.max(0, Math.min(1, t)));
        blind.style.transform = `scaleX(${t})`;
      });
    }

    // Rolling text (driven by scroll through mpRollSection)
    if (rollSection && rollTrack) {
      const rollScrollable = rollSection.offsetHeight - window.innerHeight;
      const rollProgress   = Math.max(0, Math.min(1,
        -rollSection.getBoundingClientRect().top / rollScrollable
      ));
      // Track travels from +115svh (below) to –115svh (above).
      // Use px so it stays consistent with svh-based layout on mobile.
      const yPx = (115 - rollProgress * 230) / 100 * window.innerHeight;
      rollTrack.style.transform = `translateY(${yPx}px)`;
    }
  }

  window.addEventListener("scroll", onMpScroll, { passive: true });
  onMpScroll(); // set initial state
}
