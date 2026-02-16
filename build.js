const fs = require("fs");
const path = require("path");
const { execSync, exec } = require("child_process");

const DIST = path.join(__dirname, "dist");
const SRC = path.join(__dirname, "src");
const TEMPLATE_DIR = path.join(SRC, "templates");
const NAV_TEMPLATE_PATH = path.join(TEMPLATE_DIR, "nav.html");
const FOOTER_TEMPLATE_PATH = path.join(TEMPLATE_DIR, "footer.html");

const navTemplate = fs.existsSync(NAV_TEMPLATE_PATH)
  ? fs.readFileSync(NAV_TEMPLATE_PATH, "utf8")
  : "";
const footerTemplate = fs.existsSync(FOOTER_TEMPLATE_PATH)
  ? fs.readFileSync(FOOTER_TEMPLATE_PATH, "utf8")
  : "";

const isWatch = process.argv.includes("--watch");

function processHtml(srcPath, destPath) {
  let html = fs.readFileSync(srcPath, "utf8");
  if (navTemplate) html = html.replace(/{{NAV}}/g, navTemplate);
  if (footerTemplate) html = html.replace(/{{FOOTER}}/g, footerTemplate);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, html);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name === ".gitkeep") continue;
    if (srcPath === TEMPLATE_DIR) continue;
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      if (entry.name.toLowerCase().endsWith(".html")) {
        processHtml(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

function build() {
  const start = Date.now();
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  copyDir(SRC, DIST);

  const elapsed = Date.now() - start;
  console.log(`Build completed in ${elapsed}ms → dist/`);
}

build();
if (isWatch) {
  console.log("Watching for changes...\n");
  const server = exec("npx live-server dist --port=3000 --no-browser", {
    cwd: __dirname,
  });
  server.stdout.pipe(process.stdout);
  server.stderr.pipe(process.stderr);
  fs.watch(SRC, { recursive: true }, (event, filename) => {
    if (!filename) return;
    console.log(`\nChange detected: ${filename}`);
    build();
  });
}
