/* ------------------------------
   Theme
------------------------------ */
let vantaEffect = null;

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
  const career = document.getElementById("career");
  if (!career) return;

  let raf = 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function update() {
    raf = 0;

    const r = career.getBoundingClientRect();

    const start = window.innerHeight * 0.95;
    const end = window.innerHeight * 0.25;
    const t = (start - r.top) / (start - end);

    const progress = clamp(t, 0, 1);
    document.documentElement.style.setProperty("--deep", progress.toFixed(3));
  }

  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  // Also update when theme toggles (so it switches instantly)
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
    const x = Math.round(r.left - tr.left);
    const w = Math.round(r.width);

    nav.style.setProperty("--pill-x", `${x}px`);
    nav.style.setProperty("--pill-w", `${w}px`);

    if (immediate) {
      active.style.transition = "none";
      active.offsetHeight; // reflow
      active.style.transition = "";
    }

    nav.dataset.ready = "1";
  }

  // Map links -> target elements
  const targets = links
    .map((a) => {
      const id = a.dataset.target || (a.getAttribute("href") || "").slice(1);
      const el = id ? document.getElementById(id) : null;
      return { link: a, id, el };
    })
    .filter((x) => x.el);

  function pickActiveFromScroll() {
    const y = window.scrollY + getNavOffset() + 18;
    let best = targets[0];
    for (const t of targets) {
      if (t.el.offsetTop <= y) best = t;
    }
    if (best) setActiveLink(best.link);
  }

  // Click: update immediately so it feels snappy
  links.forEach((a) => {
    a.addEventListener("click", () => {
      setActiveLink(a, true);
      requestAnimationFrame(() => requestAnimationFrame(pickActiveFromScroll));
    });
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
  window.addEventListener("resize", pickActiveFromScroll);
  window.addEventListener("load", pickActiveFromScroll);

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
  if (isMobile) {
    if (storyEl) storyEl.classList.add("storyStatic");
    return;
  } else {
    if (storyEl) storyEl.classList.remove("storyStatic");
  }

  gsap.registerPlugin(ScrollTrigger);

  // Scene start states
  gsap.set("#sceneWhat", { autoAlpha: 0, y: 20 });
  gsap.set("#sceneDoCards", { autoAlpha: 0, y: 20 });
  gsap.set("#about", { autoAlpha: 0, y: 20 });

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
const state = {
  projects: [],
  tags: [],
  query: "",
  workEntered: false,
  activeTag: "All",
};

function prefersReducedMotion() {
  return (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
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
    document.querySelectorAll(".section .r, .careerHead.r, .workHead .r"),
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

  const img = p.imageUrl
    ? `
    <img src="${p.imageUrl}" alt="" onerror="this.style.display='none'">
    <div class="mediaGlow" aria-hidden="true"></div>
  `
    : `
    <div class="mediaGlow" aria-hidden="true"></div>
  `;

  el.innerHTML = `
    <div class="projectTop">
      <div class="pNum">${String(index + 1).padStart(2, "0")}</div>
      ${p.featured ? `<div class="pBadge">Featured</div>` : ``}
    </div>

    <div class="projectMedia">
      ${img}
    </div>

    <div class="projectBody">
      <div class="pTitle">${escapeHtml(p.name)}</div>
      <div class="pDesc">${escapeHtml(p.description || "")}</div>

      <div class="tagRow">
        ${(p.tags || [])
          .slice(0, 4)
          .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
          .join("")}
      </div>

      <div class="pMeta">
        <div>${formatDate(p.date)}</div>
        <div class="pLinks">
          ${
            p.demoUrl
              ? `<a class="btn tiny primary" href="${p.demoUrl}" target="_blank" rel="noopener">Live</a>`
              : ``
          }
          ${
            p.repoUrl
              ? `<a class="btn tiny" href="${p.repoUrl}" target="_blank" rel="noopener">Code</a>`
              : ``
          }
        </div>
      </div>
    </div>
  `;

  // hover tilt
  const reset = () => {
    el.style.transform = "";
  };
  el.addEventListener("mousemove", (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateX(${(-y * 5).toFixed(
      2,
    )}deg) rotateY(${(x * 6).toFixed(2)}deg) translateY(-2px)`;
  });
  el.addEventListener("mouseleave", reset);

  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (p.demoUrl) window.open(p.demoUrl, "_blank", "noopener");
      else if (p.repoUrl) window.open(p.repoUrl, "_blank", "noopener");
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
  if (!grid || !empty) return;

  grid.innerHTML = "";
  list.forEach((p, i) => grid.appendChild(makeProjectCard(p, i)));
  empty.hidden = list.length !== 0;

  // Always update pinned story stats
  const proj = document.getElementById("statProjects");
  const tags = document.getElementById("statTags");
  if (proj) proj.textContent = String(state.projects.length);
  if (tags) tags.textContent = String(Math.max(0, state.tags.length - 1));

  const prev = document.getElementById("railPrev");
  const next = document.getElementById("railNext");

  // If no cards, hide arrows completely
  if (list.length === 0) {
    if (prev) prev.hidden = true;
    if (next) next.hidden = true;
    return;
  }

  const viewport = document.querySelector(".railViewport");
  if (viewport) viewport.scrollLeft = 0;

  // Force arrow refresh after render + scroll reset
  requestAnimationFrame(() => {
    grid.dispatchEvent(new Event("scroll"));
  });

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
   Career (data-driven)
   - Fixed: dot movement
   - Fixed: fill height
   - Fixed: ScrollTrigger wiring (no more conflicting scroll logic)
------------------------------ */
const careerData = [
  {
    role: "SAP Technical Consultant",
    sub: "2BM · Client & internal projects",
    year: "NOW",
    desc: "Working with ABAP, CDS, OData, and SAP Fiori/UI5. Building clean, maintainable SAP solutions close to real business needs. Contributing to internal AI initiatives, SAP Public Cloud setup, and quality assurance.",
  },
  {
    role: "AI & Automation",
    sub: "Internal projects",
    year: "2025",
    desc: "Developing AI-driven tools to support consulting work. Hands-on with LLM-based assistants, multi-agent systems, and practical automation. MSc in Computer Science Completed summer 2025",
  },
  {
    role: "Full-Stack Development",
    sub: "Projects & tools",
    year: "2024",
    desc: "Built complete web applications from frontend to backend. Focused on usability, performance, and clear system design.",
  },
  {
    role: "Python & Machine Learning",
    sub: "Self-driven projects",
    year: "2023",
    desc: "Worked with Python, data analysis, and machine learning. Built automation, prototypes, and early ML-based solutions.",
  },
  {
    role: "Technical & Visual Foundations",
    sub: "Design & development crossover",
    year: "2022",
    desc: "Combined technical thinking with visual design. Developed a strong sense for UX, structure, and clarity.",
  },
  {
    role: "Digital Foundations",
    sub: "Getting started",
    year: "2021",
    desc: "First exposure to structured digital tools and software. Sparked a long-term interest in technology and problem-solving.",
  },
];

function renderCareer() {
  const grid = document.getElementById("careerGrid");
  const rowsRoot = document.getElementById("careerRows");
  if (!grid || !rowsRoot) return;

  // Hvis du clear’er #careerRows, sletter du også .careerLineWrap (dot + fill).
  // Så vi detacher den først, rydder rækkerne, og sætter den tilbage.
  const keptLineWrap = rowsRoot.querySelector(".careerLineWrap");
  if (keptLineWrap) keptLineWrap.remove();

  rowsRoot.innerHTML = "";

  if (keptLineWrap) rowsRoot.appendChild(keptLineWrap);

  // Re-grab dot/fill efter lineWrap er tilbage i DOM
  const dot = document.getElementById("careerDot");
  const fill = document.getElementById("careerFill");
  if (!dot || !fill) return;

  // Build rows: left | years | right (same row-gap via grid)
  careerData.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "careerRow";
    row.dataset.index = String(i);

    row.innerHTML = `
      <button type="button" class="careerItemBtn dim careerRowLeft" data-index="${i}">
        <div class="careerRole">${escapeHtml(item.role)}</div>
        <div class="careerSub">${escapeHtml(item.sub)}</div>
      </button>

      <div class="careerYear dim careerRowYear" data-index="${i}">
        ${escapeHtml(item.year)}
      </div>

      <div class="careerRightItem dim careerRowRight" id="careerRow-${i}" data-index="${i}">
        <div class="careerDesc">${escapeHtml(item.desc)}</div>
      </div>
    `;

    rowsRoot.appendChild(row);
  });

  const leftBtns = Array.from(rowsRoot.querySelectorAll(".careerItemBtn"));
  const yearEls = Array.from(rowsRoot.querySelectorAll(".careerYear"));
  const rightEls = Array.from(rowsRoot.querySelectorAll(".careerRightItem"));
  const lineWrap = grid.querySelector(".careerLineWrap");

  // Click left -> scroll corresponding right item
  leftBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      const anchor = document.getElementById(`careerRow-${idx}`);
      if (anchor)
        anchor.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  let currentIdx = 0;
  let raf = 0;
  let pulseTimeout = 0;

  function pulseDot() {
    dot.classList.remove("pulse");
    void dot.offsetWidth;
    dot.classList.add("pulse");
  }

  function setActive(idx, doPulse = false) {
    currentIdx = idx;

    leftBtns.forEach((b) => {
      const on = Number(b.dataset.index) === idx;
      b.classList.toggle("active", on);
      b.classList.toggle("dim", !on);
    });

    yearEls.forEach((y) => {
      const on = Number(y.dataset.index) === idx;
      y.classList.toggle("active", on);
      y.classList.toggle("dim", !on);
    });

    rightEls.forEach((r) => {
      const on = Number(r.dataset.index) === idx;
      r.classList.toggle("active", on);
      r.classList.toggle("dim", !on);
    });

    if (doPulse) pulseDot();
  }

  function updateFromScroll() {
    raf = 0;
    if (!lineWrap || !yearEls.length) return;

    const wrapRect = lineWrap.getBoundingClientRect();

    // Viewport center i wrap-koordinater
    const centerInWrap = window.innerHeight * 0.5 - wrapRect.top;

    // Midtpunkter for hver YEAR i wrap-koordinater
    const mids = yearEls.map((y) => {
      const r = y.getBoundingClientRect();
      return r.top + r.height * 0.5 - wrapRect.top;
    });

    // 1) Progress baseret på viewport-center mellem første og sidste YEAR
    const first = mids[0];
    const last = mids[mids.length - 1];
    const t = (centerInWrap - first) / Math.max(1, last - first);
    const progress = Math.min(1, Math.max(0, t));

    // 2) Map progress til HELE lineWrap (så den kan nå bunden)
    const dotH = dot.offsetHeight || 10;
    const minY = dotH / 2;
    const maxY = Math.max(minY, wrapRect.height - dotH / 2);
    const dotY = minY + progress * (maxY - minY);

    dot.style.top = `${dotY}px`;
    fill.style.height = `${dotY}px`;

    // 3) Active row: find YEAR der er tættest på viewport-center (ikke dotY)
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < yearEls.length; i++) {
      const y = yearEls[i];
      const dist = Math.abs(mids[i] - centerInWrap);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = Number(y.dataset.index);
      }
    }

    const changed = bestIdx !== currentIdx;
    setActive(bestIdx, changed);

    clearTimeout(pulseTimeout);
    dot.classList.add("scrolling");
    pulseTimeout = setTimeout(() => dot.classList.remove("scrolling"), 120);
  }

  function onScroll() {
    if (raf) return;
    raf = requestAnimationFrame(updateFromScroll);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => updateFromScroll());

  requestAnimationFrame(() => {
    setActive(0, true);
    updateFromScroll();
  });
}

// Always start at top on refresh (prevents browser restoring old scroll position)
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

function forceTopAndRefresh() {
  window.scrollTo(0, 0);
  if (window.ScrollTrigger) ScrollTrigger.refresh();
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
    el.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const setMeta = (text, show = true) => {
    meta.textContent = text;
    meta.hidden = !show;
  };

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
  const wrap = document.getElementById("cScroll");
  const thumb = document.getElementById("cScrollThumb");
  if (!wrap || !thumb) return;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

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
    // fixed cap size (matches CSS)
    thumb.style.height = "28px";
  }

  function syncThumb() {
    const maxScroll = getMaxScroll();
    const trackH = wrap.clientHeight;
    const thumbH = thumb.offsetHeight || 28;

    const fillEl = document.getElementById("cScrollFill");

    if (maxScroll <= 0) {
      if (fillEl) fillEl.style.height = "0%";
      thumb.style.top = `0px`;
      return;
    }

    const progress = Math.max(0, Math.min(1, window.scrollY / maxScroll));

    // fill grows DOWN from top
    if (fillEl) fillEl.style.height = `${(progress * 100).toFixed(3)}%`;

    // cap sits at the bottom of the fill
    const y = progress * (trackH - thumbH);
    thumb.style.top = `${y}px`;
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
}

/* ------------------------------
   Hero stars (canvas)
   - Only runs for #hero
------------------------------ */
function initHeroStars() {
  const canvas = document.getElementById("heroStars");
  const hero = document.getElementById("hero");
  if (!canvas || !hero) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let w = 0;
  let h = 0;
  let dpr = 1;

  const stars = [];
  const STAR_COUNT = 220; // slightly fewer = smoother
  let vignette = null;

  function rebuild() {
    stars.length = 0;
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.1 + 0.2,
        a: Math.random() * 0.65 + 0.08,
        v: Math.random() * 0.55 + 0.18, // much faster fall
        vx: (Math.random() - 0.5) * 0.06, // tiny sideways drift
        tw: Math.random() * 0.025 + 0.006,
      });
    }
  }

  function resize() {
    dpr = Math.max(1, Math.min(1.6, window.devicePixelRatio || 1));
    const rect = hero.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    vignette = ctx.createRadialGradient(
      w * 0.5,
      h * 0.45,
      50,
      w * 0.5,
      h * 0.45,
      Math.max(w, h),
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.55)");

    rebuild();
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // stars
    for (const s of stars) {
      s.y += s.v;
      s.x += s.vx;

      if (s.y > h + 6) {
        s.y = -6;
        s.x = Math.random() * w;
      }
      if (s.x < -6) s.x = w + 6;
      if (s.x > w + 6) s.x = -6;

      s.a += (Math.random() - 0.5) * s.tw;
      s.a = Math.max(0.08, Math.min(0.8, s.a));

      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.a})`;
      ctx.fill();
    }

    // vignette (precomputed)
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  let raf = 0;
  let last = 0;
  const FRAME_MS = 1000 / 30; // cap to 30fps

  function loop(ts) {
    if (!last || ts - last >= FRAME_MS) {
      last = ts;
      draw();
    }
    raf = requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener("resize", resize);

  if (!reduced) loop(0);
  else draw();

  const io = new IntersectionObserver(
    (entries) => {
      const vis = entries.some((e) => e.isIntersecting);
      if (vis && !reduced && !raf) loop(0);
      if (!vis && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      }
    },
    { root: null, threshold: 0.01 },
  );

  io.observe(hero);
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

/* ------------------------------
   Init
------------------------------ */
async function init() {
  initTheme();
  initBackground();
  initDeepFade();
  initHeaderPillNav();

  initHeroStars();
  initHeroSkillTicker();

  initCustomScrollbar();

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

  const statsBtn = document.getElementById("statsBtn");
  if (statsBtn) {
    statsBtn.addEventListener("click", () => {
      const contact = document.getElementById("contact");
      if (contact)
        contact.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
  initStory();

  // Career
  renderCareer();

  // Projects
  try {
    const res = await fetch("projects.json", { cache: "no-store" });
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
  } catch (e) {
    console.warn("projects.json not found or invalid", e);
  }

  renderStack();

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
}

init().catch(console.error);

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

  // 3) OpenAI special fallback
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

function tileHTML(item) {
  return `
    <a class="tech-tile" href="${item.url}" target="_blank" rel="noopener noreferrer"
       aria-label="${item.name} (opens official site)">
      <div class="tech-tile-inner">
        <div class="tech-icon" data-icon="${item.slug}" aria-hidden="true"></div>
        <div class="tech-label">${item.name}</div>
      </div>
    </a>
  `;
}

async function renderTechStack() {
  const root = document.getElementById("techGrid");
  if (!root) return;

  root.innerHTML = TECH_GROUPS.map(
    (group) => `
    <div class="tech-group">
      <div class="tech-group-title">${group.title}</div>
      <div class="tech-grid">
        ${group.items.map(tileHTML).join("")}
      </div>
    </div>
  `,
  ).join("");

  const iconHolders = [...root.querySelectorAll(".tech-icon[data-icon]")];

  await Promise.all(
    iconHolders.map(async (el) => {
      const slug = el.getAttribute("data-icon");
      try {
        const markup = await getIconMarkup(slug);
        el.innerHTML = markup;
      } catch (e) {
        console.warn("Icon failed:", slug, e);
        el.innerHTML = `
          <svg viewBox="0 0 24 24" role="img" aria-label="${slug}">
            <circle cx="12" cy="12" r="8" fill="currentColor" opacity="0.35"></circle>
          </svg>`;
      }
    }),
  );
}

// run when ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderTechStack);
} else {
  renderTechStack();
}
