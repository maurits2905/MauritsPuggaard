/* ------------------------------
   script.js
------------------------------ */

/* ------------------------------
   Theme
------------------------------ */
let vantaEffect = null;

/* ------------------------------
   Preloader
   - Shows name + progress (0-100)
   - Progress is tied to real milestones (fonts, projects.json, image warmup)
------------------------------ */

function svgRasterizeElementToDataURL(el, width, height) {
  return new Promise((resolve) => {
    try {
      const clone = el.cloneNode(true);

      // Freeze state: no animations in the snapshot
      clone.querySelectorAll("*").forEach((n) => {
        n.style.animation = "none";
        n.style.transition = "none";
      });

      const wrap = document.createElement("div");
      wrap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      wrap.style.width = width + "px";
      wrap.style.height = height + "px";
      wrap.style.overflow = "hidden";
      wrap.appendChild(clone);

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            ${new XMLSerializer().serializeToString(wrap)}
          </foreignObject>
        </svg>
      `.trim();

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null);
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    } catch (e) {
      resolve(null);
    }
  });
}

async function applySnapshotToSlices(preloaderEl, slicesEl) {
  const r = preloaderEl.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width));
  const h = Math.max(1, Math.round(r.height));

  const dataUrl = await svgRasterizeElementToDataURL(preloaderEl, w, h);
  if (!dataUrl) return false;

  const cols = Array.from(slicesEl.querySelectorAll(".preSlice"));
  const n = Math.max(1, cols.length);
  const sliceW = w / n;

  cols.forEach((col, i) => {
    col.style.backgroundImage = `url("${dataUrl}")`;
    col.style.backgroundSize = `${w}px ${h}px`;
    col.style.backgroundPosition = `${-i * sliceW}px 0px`;
  });

  return true;
}

function createPreloader() {
  const el = document.getElementById("preloader");
  if (!el) return null;

  const fill = document.getElementById("preBarFill");
  const pct = document.getElementById("prePct");
  const bottomLine = document.getElementById("preBottomLine");
  const nameWrap = document.getElementById("preName");

  const reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced) {
    el.remove();
    return null;
  }

  document.body.classList.add("isLoading");

  // ---- fixed duration (always) ----
  // total ≈ 4.5s (like your reference)
  const startedAt = performance.now();
  const LOAD_MS = 3200; // progress time
  const HOLD_MS = 400; // small pause at 100
  const OUTRO_MS = 900; // slide up
  const TOTAL_MS = LOAD_MS + HOLD_MS + OUTRO_MS;

  let current = 0;
  let doneOnce = false;

  // ---- build animated letters once ----
  const NAME = "MAURITS PUGGAARD";

  if (nameWrap && !nameWrap.dataset.built) {
    nameWrap.textContent = "";
    const frag = document.createDocumentFragment();

    [...NAME].forEach((ch, i) => {
      const s = document.createElement("span");
      s.className = "letter";
      s.textContent = ch === " " ? "\u00A0" : ch;

      // stagger timing (matches the React example vibe)
      s.style.transitionDelay = `${i * 0.08}s`;
      frag.appendChild(s);
    });

    nameWrap.appendChild(frag);
    nameWrap.dataset.built = "1";

    // start the letter reveal shortly after load starts
    setTimeout(() => {
      nameWrap.querySelectorAll(".letter").forEach((span) => {
        span.classList.add("visible");
      });
    }, 200);
  }

  function paint(p) {
    const clamped = Math.max(0, Math.min(100, p));
    const pctText = String(Math.floor(clamped)).padStart(2, "0");

    if (pct) pct.textContent = pctText;
    if (fill) fill.style.width = `${clamped}%`;
    if (bottomLine) bottomLine.style.width = `${clamped}%`;
  }

  // --- smooth cinematic progress (slow -> faster -> 100%) ---
  paint(0);
  current = 0;

  const easeInCubic = (t) => t * t * t;

  function tick() {
    const elapsed = performance.now() - startedAt;

    // 0..1 over LOAD_MS
    const t = Math.max(0, Math.min(1, elapsed / LOAD_MS));

    // slow start, faster finish
    const eased = easeInCubic(t);

    current = eased * 100;
    paint(current);

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      // hold at 100 for a moment, then exit
      setTimeout(() => {
        done();
      }, HOLD_MS);
    }
  }

  requestAnimationFrame(tick);

  function done() {
    if (doneOnce) return;
    doneOnce = true;

    // ensure the loader stays up for TOTAL_MS minimum
    const elapsed = performance.now() - startedAt;
    const wait = Math.max(0, TOTAL_MS - elapsed - OUTRO_MS);

    setTimeout(() => {
      el.classList.add("exit");
      setTimeout(() => {
        el.remove();
        document.body.classList.remove("isLoading");
      }, OUTRO_MS);
    }, wait);
  }

  // Keep compatibility with the rest of your script (if it calls loader.set/done)
  function set(p) {
    // If other parts of your script try to push progress:
    // never decrease it, and never skip past the simulated feel.
    current = Math.max(current, p);
    paint(current);
  }

  return { set, done };
}

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
  window.addEventListener("resize", onScroll);
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

    const y =
      el.getBoundingClientRect().top + window.scrollY - getNavOffset() - 14;

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
  window.addEventListener("resize", pickActiveFromScroll);
  window.addEventListener("load", () => {
    // If page loads with a hash, align it nicely
    const id = (location.hash || "").slice(1);
    if (id && document.getElementById(id)) {
      // Don’t “smooth” on initial load; just jump correctly once
      const y =
        document.getElementById(id).getBoundingClientRect().top +
        window.scrollY -
        getNavOffset() -
        14;
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

  const imgHtml = p.imageUrl
    ? `<img src="${p.imageUrl}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'">`
    : "";

  const liveBtn =
    p.demoUrl && p.demoUrl !== "x"
      ? `<a class="overlayBtn live" href="${p.demoUrl}" target="_blank" rel="noopener" tabindex="-1">↗ Live</a>`
      : "";
  const codeBtn =
    p.repoUrl && p.repoUrl !== "x"
      ? `<a class="overlayBtn" href="${p.repoUrl}" target="_blank" rel="noopener" tabindex="-1">{ } Code</a>`
      : "";

  el.innerHTML = `
    <div class="cardMedia">
      ${imgHtml}
      <div class="cardOverlay" aria-hidden="true">
        <div class="overlayLinks">${liveBtn}${codeBtn}</div>
      </div>
      <div class="cardNum">${String(index + 1).padStart(2, "0")}</div>
      ${p.featured ? `<div class="pBadge">Featured</div>` : ""}
    </div>
    <div class="cardBody">
      <div class="tagRow">
        ${(p.tags || [])
          .slice(0, 4)
          .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
          .join("")}
      </div>
      <div class="cardTitle">${escapeHtml(p.name)}</div>
      <div class="cardDesc">${escapeHtml(p.description || "")}</div>
      <div class="cardMeta">${formatDate(p.date)}</div>
    </div>
  `;

  // 3D tilt on hover (desktop only)
  if (window.matchMedia("(hover: hover)").matches) {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1000px) rotateX(${(-y * 3.5).toFixed(2)}deg) rotateY(${(x * 4.5).toFixed(2)}deg) translateY(-3px)`;
    });
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
  if (!grid || !empty) return;

  grid.innerHTML = "";
  list.forEach((p, i) => grid.appendChild(makeProjectCard(p, i)));
  empty.hidden = list.length !== 0;

  // Always update pinned story stats
  const proj = document.getElementById("statProjects");
  const tags = document.getElementById("statTags");
  if (proj) proj.textContent = String(state.projects.length);
  if (tags) tags.textContent = String(Math.max(0, state.tags.length - 1));

  // Grid layout — no arrows needed
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

  function updateLineWrap() {
    if (!lineWrap || !rowsRoot) return;

    // Stretch lineWrap to cover the full height of the rows container.
    // (grid-row: 1/-1 only covers explicit rows; display:contents creates
    //  implicit rows, so we must set height manually.)
    lineWrap.style.height = rowsRoot.offsetHeight + "px";

    // Position horizontally:
    //  - desktop (>1040px): centre in the gap between year col and desc col
    //  - tablet/mobile    : left edge of the grid (column 1 space)
    if (window.innerWidth > 1040 && yearEls.length && rightEls.length) {
      const rowsRect = rowsRoot.getBoundingClientRect();
      const yearRect = yearEls[0].getBoundingClientRect();
      const rightRect = rightEls[0].getBoundingClientRect();
      const midX = (yearRect.right + rightRect.left) / 2;
      const leftPx = midX - rowsRect.left - lineWrap.offsetWidth / 2;
      lineWrap.style.left = Math.max(0, leftPx) + "px";
    } else {
      lineWrap.style.left = "0px";
    }

    updateFromScroll();
  }

  // Add top margin between entries on compact layouts for readability
  leftBtns.forEach((btn, i) => {
    if (i > 0 && window.innerWidth <= 1040) btn.style.marginTop = "20px";
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    leftBtns.forEach((btn, i) => {
      btn.style.marginTop =
        i > 0 && window.innerWidth <= 1040 ? "20px" : "";
    });
    updateLineWrap();
  });

  requestAnimationFrame(() => {
    setActive(0, true);
    updateLineWrap();
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
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      ctx.fillStyle = isLight ? `rgba(20,15,10,${s.a})` : `rgba(255,255,255,${s.a})`;
      ctx.fill();
    }

    // vignette only in dark mode
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
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
  window.addEventListener("resize", resize);

  if (!reduced) loop(0);
  else draw();
}

/* ------------------------------
   Hero earth FX (aurora + subtle parallax)
   - drives CSS vars --hx/--hy used by .heroEarth
------------------------------ */
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

function initAboutHoverDeck() {
  const reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cards = document.querySelectorAll(".aboutCard--info.aboutHover");
  if (!cards.length) return;

  cards.forEach((card) => {
    const tiles = Array.from(card.querySelectorAll(".aboutHoverTile"));
    if (!tiles.length) return;

    // Start clean (no active card)
    card.setAttribute("data-active", "-1");

    const setActive = (idx) => {
      const v = typeof idx === "number" ? idx : -1;
      card.setAttribute("data-active", String(v));
    };

    tiles.forEach((tile) => {
      const idx = Number(tile.getAttribute("data-idx") || "-1");

      tile.addEventListener("mouseenter", () => {
        if (reduced) return;
        setActive(idx);
      });

      tile.addEventListener("focusin", () => {
        setActive(idx);
      });

      // Click/tap toggles (useful on touch)
      tile.addEventListener("click", () => {
        const cur = Number(card.getAttribute("data-active") || "-1");
        setActive(cur === idx ? -1 : idx);
      });
    });

    card.addEventListener("mouseleave", () => {
      if (reduced) return;
      setActive(-1);
    });

    card.addEventListener("focusout", (e) => {
      const next = e.relatedTarget;
      if (!next || !card.contains(next)) setActive(-1);
    });
  });
}

/* ------------------------------
   Init
------------------------------ */
async function init() {
  const loader = createPreloader();

  // Disable milestone jumps so the loader can do a smooth cinematic progress
  const loadTo = () => {};

  loadTo(6);

  initTheme();
  loadTo(14);
  initBackground();
  //initDeepFade();
  initHeaderPillNav();
  initAboutHoverDeck();

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
  loadTo(28);

  initBgStars();
  initHeroEarthFX();
  initHeroSkillTicker();

  loadTo(40);

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
  initStory();

  // Career
  renderCareer();

  loadTo(52);

  // Projects
  try {
    loadTo(62);
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

      loadTo(78);
      await preloadImages(imgs, 8);
    } catch {
      // ignore
    }
    loadTo(92);
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

  loadTo(100);
  if (loader) loader.done();
}

init().catch((e) => {
  console.error(e);
  // Never leave the user stuck behind the loader
  const el = document.getElementById("preloader");
  if (el) {
    el.classList.add("isDone");
    document.body.classList.remove("isLoading");
    window.setTimeout(() => el.remove(), 650);
  }
});

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
  const mount = document.getElementById("techGrid");
  if (!mount) return;

  // Flatten your existing groups into one list (keeps your data source)
  const items = (TECH_GROUPS || []).flatMap((g) =>
    (g.items || []).map((it) => ({ ...it, group: g.title })),
  );

  // Build stage (sphere)
  mount.innerHTML = `
    <div class="techSphereStage" id="techSphereStage">
      <div class="techSphereBackdrop" aria-hidden="true"></div>
      <div class="techSphereBall" id="techSphereBall" aria-hidden="true"></div>
      <svg class="techNetSvg" id="techNetSvg" aria-hidden="true"></svg>

      <div class="techSphere" id="techSphere"></div>
      <div class="techSphereHint" aria-hidden="true">Drag to rotate • Hover to highlight</div>
    </div>
  `;

  const stage = document.getElementById("techSphereStage");
  const ball = document.getElementById("techSphereBall");
  const net = document.getElementById("techSphereNet");
  const sphere = document.getElementById("techSphere");
  if (!stage || !sphere || !ball) return;

  const reduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Create orbs
  const orbs = items.map((it) => {
    const a = document.createElement("a");
    a.className = "techOrb";
    a.draggable = false;
    a.setAttribute("draggable", "false");
    a.addEventListener("dragstart", (e) => e.preventDefault());
    a.href = it.url || "#";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", `${it.name} (opens official site)`);

    a.innerHTML = `
      <span class="techOrbIcon" data-icon="${it.slug || ""}" aria-hidden="true"></span>
      <span class="techOrbLabel">${escapeHtml(it.name || "")}</span>
    `;

    a.addEventListener("mouseenter", () => a.classList.add("isHot"));
    a.addEventListener("mouseleave", () => a.classList.remove("isHot"));
    a.addEventListener("focus", () => a.classList.add("isHot"));
    a.addEventListener("blur", () => a.classList.remove("isHot"));

    sphere.appendChild(a);
    return a;
  });

  // Load icons using your existing icon pipeline
  const iconHolders = [...sphere.querySelectorAll(".techOrbIcon[data-icon]")];

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

  // --- Sphere math / animation ---
  const N = orbs.length;
  const points = [];
  const golden = Math.PI * (3 - Math.sqrt(5)); // ~2.399.

  for (let i = 0; i < N; i++) {
    // Fibonacci sphere distribution
    const y = 1 - (i / Math.max(1, N - 1)) * 2; // 1..-1
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    points.push({ x, y, z });
  }

  // Use the BALL element as the true center/radius so icons never drift off the sphere
  let cx = 0;
  let cy = 0;
  let radius = 240;

  const measure = () => {
    const sr = stage.getBoundingClientRect();
    const br = ball.getBoundingClientRect();

    cx = br.left - sr.left + br.width / 2;
    cy = br.top - sr.top + br.height / 2;
    radius = (br.width / 2) * 0.96; // keep icons slightly “inside” the edge
  };
  measure();
  window.addEventListener("resize", () => requestAnimationFrame(measure));

  const netSvg = document.getElementById("techNetSvg");

  const NET_LAT = 8; // rings
  const NET_LON = 10; // longitudes
  const NET_STEPS = 72;

  const netPaths = [];
  function buildNet() {
    if (!netSvg) return;
    netSvg.innerHTML = "";
    netPaths.length = 0;

    // Set a viewBox so we can draw in "ball-space" pixels
    netSvg.setAttribute("viewBox", "0 0 1000 1000");
    netSvg.setAttribute("preserveAspectRatio", "none");

    const makePath = (cls) => {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      if (cls) p.setAttribute("class", cls);
      netSvg.appendChild(p);
      return p;
    };

    // latitude rings: front + back
    for (let i = 1; i <= NET_LAT; i++) {
      const front = makePath("front");
      const back = makePath("back");
      netPaths.push({ kind: "lat", idx: i, front, back });
    }

    // longitude lines: front + back
    for (let i = 0; i < NET_LON; i++) {
      const front = makePath("front");
      const back = makePath("back");
      netPaths.push({ kind: "lon", idx: i, front, back });
    }
  }
  buildNet();

  // --- Intro "fly in" when section becomes visible ---
  let introActive = false;
  let introStart = 0;
  const introPos = points.map(() => ({ x: 0, y: 0 }));

  const startIntro = () => {
    if (introActive || reduced) return;
    introActive = true;
    introStart = performance.now();

    const sr = stage.getBoundingClientRect();
    for (let i = 0; i < N; i++) {
      const fromLeft = Math.random() < 0.5;
      introPos[i].x = fromLeft
        ? -sr.width * (0.25 + Math.random() * 0.35)
        : sr.width * (1.25 + Math.random() * 0.35);
      introPos[i].y = sr.height * (0.2 + Math.random() * 0.6);
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((en) => en.isIntersecting)) {
        startIntro();
        io.disconnect();
      }
    },
    { threshold: 0.35 },
  );
  io.observe(stage);

  requestAnimationFrame(() => {
    const r = stage.getBoundingClientRect();
    const inView =
      r.top < window.innerHeight * 0.8 && r.bottom > window.innerHeight * 0.2;
    if (inView) startIntro();
  });

  // Rotation state
  let rotX = -0.25;
  let rotY = 0.55;
  let velX = 0.0;
  let velY = 0.0;

  // Drag
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  let dragDist = 0;
  let didDrag = false;
  let justDragged = false;

  const onDown = (e) => {
    dragging = true;
    stage.classList.add("isDragging");
    stage.setPointerCapture?.(e.pointerId);

    lastX = e.clientX;
    lastY = e.clientY;

    dragDist = 0;
    didDrag = false;
  };

  const onMove = (e) => {
    if (!dragging) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    dragDist += Math.abs(dx) + Math.abs(dy);
    if (dragDist > 6) {
      didDrag = true;
    }

    // free rotation anywhere (no borders/constraints)
    velY = dx * 0.0042;
    velX = -dy * 0.0032;
  };

  const onUp = () => {
    if (didDrag) {
      justDragged = true;
      setTimeout(() => (justDragged = false), 0);
    }

    dragging = false;
    stage.classList.remove("isDragging");
  };

  stage.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });

  sphere.addEventListener(
    "click",
    (e) => {
      if (!justDragged) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );

  let raf = 0;

  const tick = () => {
    // Idle drift
    if (!dragging) {
      velY += 0.00022;
      velX += 0.00008;
    }

    // Apply velocity (damping)
    rotX += velX;
    rotY += velY;
    velX *= 0.92;
    velY *= 0.92;

    const sx = Math.sin(rotX);
    const cxr = Math.cos(rotX);
    const sy = Math.sin(rotY);
    const cyr = Math.cos(rotY);

    // ===== 3D Wireframe Update (front/back split) =====
    if (netSvg && netPaths.length) {
      const R = 500;
      const C = 500;

      // simple perspective factor (makes it feel more spherical)
      const persp = 0.28;

      const project = (px, py, pz) => {
        // rotate Y
        const x1 = px * cyr + pz * sy;
        const z1 = -px * sy + pz * cyr;

        // rotate X
        const y2 = py * cxr - z1 * sx;
        const z2 = py * sx + z1 * cxr;

        // depth 0..1
        const depth = (z2 + 1) / 2;

        // subtle perspective
        const k = 1 + (depth - 0.5) * persp;

        return { x: C + x1 * R * k, y: C + y2 * R * k, depth };
      };

      const buildPath = (pts) => {
        let d = "";
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          d +=
            (i === 0 ? "M" : "L") + p.x.toFixed(2) + " " + p.y.toFixed(2) + " ";
        }
        return d.trim();
      };

      const H = 0.5; // hemisphere split
      const EPS = 0.02; // small hysteresis band to avoid flicker on the edge

      const pushD = (d, p, move) =>
        d + (move ? "M" : "L") + p.x.toFixed(2) + " " + p.y.toFixed(2) + " ";

      for (const seg of netPaths) {
        let dFront = "";
        let dBack = "";

        let prevSide = null; // "front" | "back"
        let frontMove = true;
        let backMove = true;

        const addPoint = (pr) => {
          const side =
            pr.depth > H + EPS
              ? "front"
              : pr.depth < H - EPS
                ? "back"
                : prevSide || "front";

          // When side changes, break the path so SVG doesn’t draw a straight line across
          if (side !== prevSide) {
            if (side === "front") frontMove = true;
            else backMove = true;
          }

          if (side === "front") {
            dFront = pushD(dFront, pr, frontMove);
            frontMove = false;
          } else {
            dBack = pushD(dBack, pr, backMove);
            backMove = false;
          }

          prevSide = side;
        };

        if (seg.kind === "lat") {
          const t = seg.idx / (NET_LAT + 1);
          const y = 1 - t * 2;
          const rr = Math.sqrt(Math.max(0, 1 - y * y));

          for (let s = 0; s <= NET_STEPS; s++) {
            const a = (s / NET_STEPS) * Math.PI * 2;
            const px = Math.cos(a) * rr;
            const pz = Math.sin(a) * rr;
            addPoint(project(px, y, pz));
          }
        } else {
          const a0 = (seg.idx / NET_LON) * Math.PI * 2;

          for (let s = 0; s <= NET_STEPS; s++) {
            const t = s / NET_STEPS;
            const y = 1 - t * 2;
            const rr = Math.sqrt(Math.max(0, 1 - y * y));
            const px = Math.cos(a0) * rr;
            const pz = Math.sin(a0) * rr;
            addPoint(project(px, y, pz));
          }
        }

        seg.front.setAttribute("d", dFront.trim());
        seg.back.setAttribute("d", dBack.trim());

        seg.front.style.opacity = "0.55";
        seg.back.style.opacity = "0.22";
      }
    }

    for (let i = 0; i < N; i++) {
      const p = points[i];

      // Rotate around Y
      const x1 = p.x * cyr + p.z * sy;
      const z1 = -p.x * sy + p.z * cyr;

      // Rotate around X
      const y2 = p.y * cxr - z1 * sx;
      const z2 = p.y * sx + z1 * cxr;

      // Depth: 0..1 (back..front)
      const depth = (z2 + 1) / 2;
      const front = Math.max(0, Math.min(1, (depth - 0.25) / 0.75));

      // Project to 2D (always anchored to the ball center/radius)
      const x = cx + x1 * radius;
      const y = cy + y2 * radius;

      // Larger in front, smaller at edge/back
      const s = 0.55 + front * 0.78;

      const el = orbs[i];
      el.style.setProperty("--front", front.toFixed(3));

      // Intro lerp: icons fly in from left/right, then fully dynamic
      let px = x;
      let py = y;
      if (introActive) {
        const t = Math.min(1, (performance.now() - introStart) / 900);
        const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
        px = introPos[i].x + (x - introPos[i].x) * ease;
        py = introPos[i].y + (y - introPos[i].y) * ease;
        if (t >= 1) introActive = false;
      }

      el.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%) scale(${s})`;
      el.style.zIndex = String(10 + Math.floor(front * 200));
      el.style.opacity = String(0.22 + front * 0.78);
      el.style.filter = `blur(${(1 - front) * 0.75}px)`;
      el.style.pointerEvents = front < 0.08 ? "none" : "auto";
    }

    raf = requestAnimationFrame(tick);
  };

  if (!reduced) tick();
}

// run when ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderTechStack);
} else {
  renderTechStack();
}

// run when ready
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

  // ---- Simple global counters (CountAPI) ----
  // Change namespace if you want a different "bucket"
  const COUNT_NS = "maurits-portfolio";
  const VIEWS_KEY = "views";
  const LIKES_KEY = "likes";

  async function countGet(key) {
    const r = await fetch(`https://api.countapi.xyz/get/${COUNT_NS}/${key}`);
    const j = await r.json();
    return Number(j.value || 0);
  }

  async function countHit(key) {
    const r = await fetch(`https://api.countapi.xyz/hit/${COUNT_NS}/${key}`);
    const j = await r.json();
    return Number(j.value || 0);
  }

  async function loadCounts() {
    try {
      // Count 1 view per session (per browser tab session)
      const counted = sessionStorage.getItem("pvCounted") === "1";
      const v = counted ? await countGet(VIEWS_KEY) : await countHit(VIEWS_KEY);
      sessionStorage.setItem("pvCounted", "1");
      if (viewsEl) viewsEl.textContent = String(v);

      const likes = await countGet(LIKES_KEY);
      if (likesEl) likesEl.textContent = String(likes);

      const alreadyLiked = localStorage.getItem("portfolioLiked") === "1";
      if (likeBtn) {
        likeBtn.disabled = alreadyLiked;
        if (alreadyLiked) likeBtn.textContent = "Loved ✓";
      }
    } catch (e) {
      console.error(e);
      if (viewsEl) viewsEl.textContent = "0";
      if (likesEl) likesEl.textContent = "0";
    }
  }

  async function onLike() {
    try {
      if (!likeBtn || likeBtn.disabled) return;
      const next = await countHit(LIKES_KEY);
      if (likesEl) likesEl.textContent = String(next);
      localStorage.setItem("portfolioLiked", "1");
      likeBtn.disabled = true;
      likeBtn.textContent = "Loved ✓";
    } catch (e) {
      console.error(e);
    }
  }

  if (likeBtn) likeBtn.addEventListener("click", onLike);

  // ---- GitHub user stats ----
  async function loadGitHub() {
    try {
      const r = await fetch(`https://api.github.com/users/${githubUsername}`);
      if (!r.ok) throw new Error("GitHub user fetch failed");
      const u = await r.json();

      if (hireableEl) hireableEl.textContent = u.hireable ? "Yes" : "No";
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
