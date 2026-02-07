/* ------------------------------
   Theme
------------------------------ */
function setTheme(next) {
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  const btn = document.getElementById("themeBtn");
  if (btn) btn.textContent = next === "light" ? "☀" : "☾";
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) return setTheme(saved);
  const prefersLight =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: light)").matches;
  setTheme(prefersLight ? "light" : "dark");
}

/* ------------------------------
   Background (Vanta NET)
------------------------------ */
let vantaEffect = null;

function initBackground() {
  const reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  vantaEffect = window.VANTA.NET({
    el: "#bg",
    mouseControls: true,
    touchControls: true,
    gyroControls: false,
    minHeight: 200,
    minWidth: 200,
    scale: 1.0,
    scaleMobile: 1.0,

    // Subtle premium motion
    color: 0x9b8cff,
    backgroundColor: 0x060711,
    points: 7.0,
    maxDistance: 24.0,
    spacing: 18.0
  });
}

/* ------------------------------
   Scroll story (pinned)
------------------------------ */
function initStory() {
  const reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  gsap.registerPlugin(ScrollTrigger);

  // Scene start states
  gsap.set("#sceneWhat", { autoAlpha: 0, y: 20 });
  gsap.set("#sceneDoCards", { autoAlpha: 0, y: 20 });
  gsap.set("#about", { autoAlpha: 0, y: 20 });

  gsap.set("#sceneHero", { autoAlpha: 1, y: 0 });
  gsap.set("#sceneRole", { autoAlpha: 1, y: 0 });

  // Reveal animation baseline for other sections
  gsap.utils.toArray(".section .r").forEach((el) => {
    gsap.to(el, {
      autoAlpha: 1,
      y: 0,
      duration: 0.75,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 85%" }
    });
  });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: "#story",
      start: "top top",
      end: "+=2200",
      scrub: true,
      pin: true,
      anticipatePin: 1
    }
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
    0.28
  )
    .to("#sceneRole", { autoAlpha: 0, y: -10, duration: 0.18 }, 0.30)
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
      0.64
    );
}

/* ------------------------------
   Projects rendering
------------------------------ */
const state = {
  projects: [],
  tags: [],
  activeTag: "All",
  query: ""
};

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
      (b.date || "").localeCompare(a.date || "")
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
      2
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
      `<a class="btn primary" href="${featured.demoUrl}" target="_blank" rel="noopener">Live demo</a>`
    );
  if (featured.repoUrl)
    out.push(
      `<a class="btn" href="${featured.repoUrl}" target="_blank" rel="noopener">Code</a>`
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

  // update stats used in pinned story
  const proj = document.getElementById("statProjects");
  const tags = document.getElementById("statTags");
  if (proj) proj.textContent = String(state.projects.length);
  if (tags) tags.textContent = String(Math.max(0, state.tags.length - 1));

  // reveal injected cards (if user scrolls to them)
  if (window.gsap && window.ScrollTrigger) {
    gsap.utils.toArray("#workGrid .r").forEach((el) => {
      gsap.set(el, { opacity: 0, y: 18 });
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%" }
      });
    });
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
    { name: "SAP", icon: "devicon-sap-plain" }
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
        delay: i * 0.05
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
    desc: "Working with ABAP, CDS, OData, and SAP Fiori/UI5. Building clean, maintainable SAP solutions close to real business needs. Contributing to internal AI initiatives, SAP Public Cloud setup, and quality assurance."
  },
  {
    role: "AI & Automation",
    sub: "Internal projects",
    year: "2025",
    desc: "Developing AI-driven tools to support consulting work. Hands-on with LLM-based assistants, multi-agent systems, and practical automation. MSc in Computer Science Completed summer 2025"
  },
  {
    role: "Full-Stack Development",
    sub: "Projects & tools",
    year: "2024",
    desc: "Built complete web applications from frontend to backend. Focused on usability, performance, and clear system design."
  },
  {
    role: "Python & Machine Learning",
    sub: "Self-driven projects",
    year: "2023",
    desc: "Worked with Python, data analysis, and machine learning. Built automation, prototypes, and early ML-based solutions."
  },
  {
    role: "Technical & Visual Foundations",
    sub: "Design & development crossover",
    year: "2022",
    desc: "Combined technical thinking with visual design. Developed a strong sense for UX, structure, and clarity."
  },
  {
    role: "Digital Foundations",
    sub: "Getting started",
    year: "2021",
    desc: "First exposure to structured digital tools and software. Sparked a long-term interest in technology and problem-solving."
  }
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
      if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "center" });
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

    leftBtns.forEach(b => {
      const on = Number(b.dataset.index) === idx;
      b.classList.toggle("active", on);
      b.classList.toggle("dim", !on);
    });

    yearEls.forEach(y => {
      const on = Number(y.dataset.index) === idx;
      y.classList.toggle("active", on);
      y.classList.toggle("dim", !on);
    });

    rightEls.forEach(r => {
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
  const centerInWrap = (window.innerHeight * 0.5) - wrapRect.top;

  // Midtpunkter for hver YEAR i wrap-koordinater
  const mids = yearEls.map((y) => {
    const r = y.getBoundingClientRect();
    return (r.top + r.height * 0.5) - wrapRect.top;
  });

  // 1) Progress baseret på viewport-center mellem første og sidste YEAR
  const first = mids[0];
  const last = mids[mids.length - 1];
  const t = (centerInWrap - first) / Math.max(1, (last - first));
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

/* ------------------------------
   Init
------------------------------ */
async function init() {
  initTheme();

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

  // Header email toggle (Work/Private) + click to mail + click toggle to copy
  let emailMode = "work";
  const topEmail = document.getElementById("topEmail");
  const emailToggle = document.getElementById("emailToggle");

  function setTopEmail(mode) {
    emailMode = mode;
    const email = mode === "work" ? emailWork : emailPrivate;

    if (topEmail) {
      topEmail.textContent = email;
      topEmail.href = `mailto:${email}`;
    }

    if (emailToggle) {
      emailToggle.textContent = mode === "work" ? "Work" : "Private";
    }
  }

  setTopEmail("work");

  if (emailToggle) {
    emailToggle.addEventListener("click", async () => {
      setTopEmail(emailMode === "work" ? "private" : "work");

      const email = emailMode === "work" ? emailWork : emailPrivate;
      try {
        await navigator.clipboard.writeText(email);
        emailToggle.textContent =
          (emailMode === "work" ? "Work" : "Private") + " ✓";
        setTimeout(() => setTopEmail(emailMode), 900);
      } catch {
        // ignore if clipboard blocked
      }
    });
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
  if (ghText) ghText.textContent = "@" + (githubProfile.split("/").pop() || "YOURNAME");
  if (ghLink) ghLink.href = githubProfile;

  // Contact cards - emails
  const workEmailText = document.getElementById("workEmailText");
  const workEmailLink = document.getElementById("workEmailLink");
  if (workEmailText) workEmailText.textContent = emailWork;
  if (workEmailLink) workEmailLink.href = `mailto:${emailWork}`;

  const privateEmailText = document.getElementById("privateEmailText");
  const privateEmailLink = document.getElementById("privateEmailLink");
  if (privateEmailText) privateEmailText.textContent = emailPrivate;
  if (privateEmailLink) privateEmailLink.href = `mailto:${emailPrivate}`;

  const liLink = document.getElementById("linkedinLink");
  if (liLink) liLink.href = linkedinProfile;

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

  initBackground();
  initStory();

  // Career
  renderCareer();

  // Projects
  try {
    const res = await fetch("projects.json", { cache: "no-store" });
    state.projects = await res.json();
    state.tags = uniqueTags(state.projects);
    renderFeatured();
    renderWork();
  } catch (e) {
    console.warn("projects.json not found or invalid", e);
  }

  renderStack();

  // Search
  const searchInput = document.getElementById("searchInput");
  const clearBtn = document.getElementById("clearSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.query = e.target.value || "";
      renderWork();
    });
  }
  if (clearBtn && searchInput) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      state.query = "";
      renderWork();
      searchInput.focus();
    });
  }
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
      { name: "JavaScript", slug: "javascript", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript" },
      { name: ".NET / C#", slug: "dotnet", url: "https://learn.microsoft.com/en-us/dotnet/csharp/" },
      { name: "ABAP", slug: "sap", url: "https://help.sap.com/docs/abap-platform" },
      { name: "SQL", slug: "postgresql", url: "https://en.wikipedia.org/wiki/SQL" },
      { name: "HTML", slug: "html5", url: "https://developer.mozilla.org/en-US/docs/Web/HTML" },
      { name: "CSS", slug: "css3", url: "https://developer.mozilla.org/en-US/docs/Web/CSS" }
    ]
  },
  {
    title: "SAP & Enterprise",
    items: [
      { name: "SAP S/4HANA", slug: "sap", url: "https://www.sap.com/products/erp/s4hana.html" },
      { name: "SAP ERP", slug: "sap", url: "https://www.sap.com/products/erp.html" },
      { name: "SAP Fiori", slug: "sap", url: "https://www.sap.com/products/technology-platform/fiori.html" },
      { name: "SAP UI5", slug: "sap", url: "https://ui5.sap.com/" },
      { name: "SAP BTP", slug: "sap", url: "https://www.sap.com/products/technology-platform.html" },
      { name: "SAP MM", slug: "sap", url: "https://help.sap.com/docs/SAP_ERP" },
      { name: "SAP SD", slug: "sap", url: "https://help.sap.com/docs/SAP_ERP" }
    ]
  },
  {
    title: "Frameworks & Machine Learning",
    items: [
      { name: "React", slug: "react", url: "https://react.dev/" },
      { name: "PyTorch", slug: "pytorch", url: "https://pytorch.org/" },
      { name: "TensorFlow", slug: "tensorflow", url: "https://www.tensorflow.org/" },
      { name: "scikit-learn", slug: "scikitlearn", url: "https://scikit-learn.org/" },
      { name: "OpenCV", slug: "opencv", url: "https://opencv.org/" }
    ]
  },
  {
    title: "Data & Databases",
    items: [
      { name: "PostgreSQL", slug: "postgresql", url: "https://www.postgresql.org/" },
      { name: "MySQL", slug: "mysql", url: "https://www.mysql.com/" },
      { name: "MongoDB", slug: "mongodb", url: "https://www.mongodb.com/" },
      { name: "Pandas", slug: "pandas", url: "https://pandas.pydata.org/" },
      { name: "NumPy", slug: "numpy", url: "https://numpy.org/" }
    ]
  },
  {
    title: "DevOps & Infrastructure",
    items: [
      { name: "Docker", slug: "docker", url: "https://www.docker.com/" },
      { name: "Azure", slug: "microsoftazure", url: "https://azure.microsoft.com/" },
      { name: "Linux", slug: "linux", url: "https://www.linux.org/" },
      { name: "Git", slug: "git", url: "https://git-scm.com/" },
      { name: "GitHub", slug: "github", url: "https://github.com/" }
    ]
  },
  {
    title: "Development Tools",
    items: [
      { name: "VS Code", slug: "visualstudiocode", url: "https://code.visualstudio.com/" },
      { name: "IntelliJ", slug: "intellijidea", url: "https://www.jetbrains.com/idea/" },
      { name: "Jupyter", slug: "jupyter", url: "https://jupyter.org/" },
      { name: "Postman", slug: "postman", url: "https://www.postman.com/" }
    ]
  },
  {
    title: "AI & Platforms",
    items: [
      { name: "Hugging Face", slug: "huggingface", url: "https://huggingface.co/" },
      { name: "OpenAI", slug: "openai", url: "https://openai.com/" }
    ]
  }
];

// Fallback to Devicon
const DEVICON_FALLBACK = {
  css3: "devicon-css3-plain",
  microsoftazure: "devicon-azure-plain",
  visualstudiocode: "devicon-vscode-plain"
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
    `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`
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
  `
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
    })
  );
}

// run when ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderTechStack);
} else {
  renderTechStack();
}
