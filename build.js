const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// ── Paths ──────────────────────────────────────────────────────────────────────
const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const TEMPLATE_DIR = path.join(SRC, "templates");

// ── Template definitions ───────────────────────────────────────────────────────
// Add new templates here — each entry maps a {{PLACEHOLDER}} to a file.
const TEMPLATES = {
  "{{NAV}}": path.join(TEMPLATE_DIR, "nav.html"),
  "{{FOOTER}}": path.join(TEMPLATE_DIR, "footer.html"),
};

// ── Load templates ─────────────────────────────────────────────────────────────
function loadTemplates() {
  const loaded = {};
  for (const [placeholder, filePath] of Object.entries(TEMPLATES)) {
    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠  Template missing: ${path.relative(ROOT, filePath)} (placeholder ${placeholder} will be left as-is)`);
      continue;
    }
    const content = fs.readFileSync(filePath, "utf8").trim();
    if (!content) {
      console.warn(`  ⚠  Template empty: ${path.relative(ROOT, filePath)}`);
      continue;
    }
    loaded[placeholder] = content;
  }
  if (Object.keys(loaded).length === 0) {
    console.error("  ✖  No templates loaded — HTML files will not be processed.");
  }
  return loaded;
}

// ── Inject templates into an HTML string ───────────────────────────────────────
function injectTemplates(html, templates) {
  let result = html;
  const injected = [];

  for (const [placeholder, content] of Object.entries(templates)) {
    if (result.includes(placeholder)) {
      result = result.split(placeholder).join(content);
      injected.push(placeholder);
    }
  }

  // Warn about any remaining unresolved {{…}} placeholders
  const unresolved = result.match(/\{\{[A-Z_]+\}\}/g);
  if (unresolved) {
    const unique = [...new Set(unresolved)];
    console.warn(`      ⚠  Unresolved placeholders: ${unique.join(", ")}`);
  }

  return { html: result, injected };
}

// ── Copy a directory tree, processing HTML and copying everything else ──────
function copyTree(src, dest, templates) {
  fs.mkdirSync(dest, { recursive: true });
  const stats = { html: 0, copied: 0 };

  function walk(currentSrc, currentDest) {
    if (path.resolve(currentSrc) === path.resolve(TEMPLATE_DIR)) return;

    fs.mkdirSync(currentDest, { recursive: true });

    for (const entry of fs.readdirSync(currentSrc, { withFileTypes: true })) {
      if (entry.name === ".gitkeep") continue;

      const srcPath = path.join(currentSrc, entry.name);
      const destPath = path.join(currentDest, entry.name);

      if (entry.isDirectory()) {
        walk(srcPath, destPath);
      } else if (entry.name.toLowerCase().endsWith(".html")) {
        processHtml(srcPath, destPath, templates);
        stats.html++;
      } else {
        fs.copyFileSync(srcPath, destPath);
        stats.copied++;
      }
    }
  }

  walk(src, dest);
  return stats;
}

// ── Process a single HTML file ─────────────────────────────────────────────────
function processHtml(srcPath, destPath, templates) {
  const raw = fs.readFileSync(srcPath, "utf8");
  const relPath = path.relative(SRC, srcPath);
  const { html, injected } = injectTemplates(raw, templates);

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, html, "utf8");

  if (injected.length > 0) {
    console.log(`  ✔  ${relPath}  ←  ${injected.join(", ")}`);
  } else {
    console.log(`  ·  ${relPath}  (no placeholders found)`);
  }
}

// ── Main build ─────────────────────────────────────────────────────────────────
function build() {
  const start = Date.now();
  console.log("\n── Building ──────────────────────────────────────────");

  // 1. Load templates
  const templates = loadTemplates();

  // 2. Clean dist
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // 3. Copy + inject
  const stats = copyTree(SRC, DIST, templates);

  const elapsed = Date.now() - start;
  console.log(`\n  Done in ${elapsed}ms — ${stats.html} HTML page(s), ${stats.copied} asset(s) → dist/\n`);
}

// ── Run ────────────────────────────────────────────────────────────────────────
const isWatch = process.argv.includes("--watch");

build();

if (isWatch) {
  console.log("Watching for changes…\n");

  const server = exec("npx live-server dist --port=3000 --no-browser", {
    cwd: ROOT,
  });
  server.stdout.pipe(process.stdout);
  server.stderr.pipe(process.stderr);

  let debounce = null;
  fs.watch(SRC, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log(`Change detected: ${filename}`);
      build();
    }, 100);
  });
}
