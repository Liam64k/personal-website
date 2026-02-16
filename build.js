const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// ── Paths ──────────────────────────────────────────────────────────────────────
const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const DIST = path.join(ROOT, "dist");
const TEMPLATE_DIR = path.join(SRC, "templates");

// ── Template definitions ───────────────────────────────────────────────────────
// Each entry maps a section name to a template file.
//
// In your HTML, add paired boundary comments:
//   <!-- begin:nav --><!-- end:nav -->
//   <!-- begin:footer --><!-- end:footer -->
//
// The build replaces everything BETWEEN the boundaries with the template
// content, but keeps the boundary comments themselves. This means the
// build is idempotent — you can run it on source files OR on already-built
// output and it will always produce the correct result.
const TEMPLATES = [
  { name: "nav",    file: path.join(TEMPLATE_DIR, "nav.html") },
  { name: "footer", file: path.join(TEMPLATE_DIR, "footer.html") },
];

// ── Load templates ─────────────────────────────────────────────────────────────
function loadTemplates() {
  const loaded = [];
  for (const tpl of TEMPLATES) {
    if (!fs.existsSync(tpl.file)) {
      console.warn(`  ⚠  Template missing: ${path.relative(ROOT, tpl.file)} (<!-- begin:${tpl.name} --> will be left as-is)`);
      continue;
    }
    const content = fs.readFileSync(tpl.file, "utf8").trim();
    if (!content) {
      console.warn(`  ⚠  Template empty: ${path.relative(ROOT, tpl.file)}`);
      continue;
    }
    // Matches <!-- begin:name --> ... anything ... <!-- end:name -->
    // across multiple lines, non-greedy
    const regex = new RegExp(
      `(<!--\\s*begin:${tpl.name}\\s*-->)[\\s\\S]*?(<!--\\s*end:${tpl.name}\\s*-->)`,
      "gi"
    );
    loaded.push({ name: tpl.name, regex, content });
  }
  if (loaded.length === 0) {
    console.error("  ✖  No templates loaded — HTML files will not be processed.");
  }
  return loaded;
}

// ── Inject templates into an HTML string ───────────────────────────────────────
function injectTemplates(html, templates) {
  let result = html;
  const injected = [];

  for (const { name, regex, content } of templates) {
    // Reset regex state before use
    regex.lastIndex = 0;
    if (regex.test(result)) {
      regex.lastIndex = 0;
      // Replace everything between boundaries, keeping the boundary comments
      result = result.replace(regex, `$1\n${content}\n  $2`);
      injected.push(name);
    }
  }

  // Warn about any unmatched <!-- begin:… --> without a corresponding end
  const opens = result.match(/<!--\s*begin:(\w+)\s*-->/gi) || [];
  for (const open of opens) {
    const nameMatch = open.match(/begin:(\w+)/i);
    if (nameMatch) {
      const endRe = new RegExp(`<!--\\s*end:${nameMatch[1]}\\s*-->`, "i");
      if (!endRe.test(result)) {
        console.warn(`      ⚠  Found ${open} but no matching <!-- end:${nameMatch[1]} -->`);
      }
    }
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
