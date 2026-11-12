// Everything about the page that is not 3D: reading scroll into a chapter
// value, showing the right chapter's text, the rail, the dialog and copy button.

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function createPage() {
  const root = document.documentElement;
  const chapters = [...document.querySelectorAll(".chapter")];
  const rail = [...document.querySelectorAll(".rail a")];
  const whiteout = document.querySelector(".whiteout");
  const loader = document.getElementById("loader");
  const loaderStep = document.getElementById("loader-step");
  const loaderBar = document.getElementById("loader-bar");

  // ── split headings into masked words (the full text stays as the label) ──
  for (const h of document.querySelectorAll(".split")) {
    const text = h.textContent.trim();
    h.setAttribute("aria-label", text);
    h.textContent = "";
    text.split(/\s+/).forEach((word, i, all) => {
      const w = document.createElement("span");
      w.className = "w";
      w.setAttribute("aria-hidden", "true");
      const wi = document.createElement("span");
      wi.className = "wi";
      wi.style.setProperty("--i", i);
      wi.textContent = word;
      w.append(wi);
      h.append(w);
      if (i < all.length - 1) h.append(" ");
    });
  }

  // ── content the 3D world also needs, read from the HTML ──────────────────
  const projectLinks = [...document.querySelectorAll("#projects a")];
  const projects = projectLinks.map((a) => ({
    name: a.querySelector("strong").textContent,
    screen: a.dataset.screen,
    kind: a.dataset.kind,
    hue: Number(a.dataset.hue),
    href: a.href,
  }));
  const signalLinks = [...document.querySelectorAll("#signals a")];
  const socials = signalLinks.map((a) => ({
    label: a.querySelector("strong").textContent,
    handle: a.querySelector("span").textContent,
    color: a.dataset.color,
    href: a.href,
    external: a.target === "_blank",
  }));

  // floating labels for the tower tips
  const beaconLayer = document.getElementById("beacons");
  const beacons = socials.map((s) => {
    const a = document.createElement("a");
    a.className = "beacon";
    a.href = s.href;
    a.tabIndex = -1;
    if (s.external) { a.target = "_blank"; a.rel = "noopener"; }
    a.style.setProperty("--c", s.color);
    a.append(s.label);
    const small = document.createElement("span");
    small.textContent = s.handle;
    small.style.fontWeight = "400";
    small.style.opacity = "0.75";
    a.append(small);
    a.style.opacity = "0";
    a.style.visibility = "hidden";
    beaconLayer.append(a);
    return a;
  });

  // ── scroll → fractional chapter ──────────────────────────────────────────
  let tops = [], heights = [];
  function measure() {
    const y = window.scrollY;
    tops = chapters.map((c) => c.getBoundingClientRect().top + y);
    heights = chapters.map((c) => c.offsetHeight);
  }
  measure();
  window.addEventListener("resize", measure);
  window.addEventListener("load", measure);
  if (document.fonts?.ready) document.fonts.ready.then(measure);

  /** 0 at the hero, 5 at the landing. Whole numbers are the composed stops. */
  function progress() {
    const y = window.scrollY;
    const last = chapters.length - 1;
    for (let i = last; i >= 0; i--) {
      if (y >= tops[i] - 1 || i === 0) {
        if (i === last) return last;
        const local = clamp01((y - tops[i]) / heights[i]);
        return i + clamp01((local - 0.42) / 0.58);
      }
    }
    return 0;
  }

  let shown = -2, current = -1, ready = false;
  function update(c) {
    const near = Math.round(c);
    const active = ready && Math.abs(c - near) < 0.17 ? near : -1;
    if (active !== shown) {
      chapters.forEach((el, i) => el.classList.toggle("is-active", i === active));
      shown = active;
    }
    if (near !== current) {
      rail.forEach((a, i) => {
        a.classList.toggle("is-current", i === near);
        if (i === near) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
      current = near;
    }
    root.classList.toggle("past-hero", c > 0.5);
  }

  // ── dialog, copy button ──────────────────────────────────────────────────
  const dialog = document.getElementById("photo");
  document.getElementById("open-photo")?.addEventListener("click", () => dialog.showModal());
  dialog?.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  const copy = document.getElementById("copy-email");
  copy?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copy.dataset.email);
      copy.textContent = "Address copied";
    } catch {
      copy.textContent = copy.dataset.email;
    }
    setTimeout(() => (copy.textContent = "Copy address"), 2400);
  });

  return {
    chapters, projects, socials, projectLinks, signalLinks, beacons,
    measure, progress, update,
    setWhiteout(v) { whiteout.style.opacity = v.toFixed(3); },
    setLoader(fraction, label) {
      if (label) loaderStep.textContent = label;
      loaderBar.style.transform = `scaleX(${fraction})`;
    },
    start() {
      ready = true;
      loader.classList.add("is-done");
      update(progress());
    },
  };
}
