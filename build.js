const fs = require("fs");
const path = require("path");
const { execSync, exec } = require("child_process");

const DIST = path.join(__dirname, "dist");
const SRC = path.join(__dirname, "src");
const PUBLIC = path.join(__dirname, "public");
const ASSETS = path.join(__dirname, "assets");

const isWatch = process.argv.includes("--watch");

/**
 * Recursively copy a directory.
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.name === ".gitkeep") continue;
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Run the build: clean dist, copy public, assets, and src into dist.
 */
function build() {
  const start = Date.now();

  // Clean
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // Copy public files to dist root (robots.txt, sitemap.xml, etc.)
  if (fs.existsSync(PUBLIC)) {
    copyDir(PUBLIC, DIST);
  }

  // Copy assets to dist/assets
  if (fs.existsSync(ASSETS)) {
    copyDir(ASSETS, path.join(DIST, "assets"));
  }

  // Copy src files to dist (HTML, CSS, JS)
  if (fs.existsSync(SRC)) {
    copyDir(SRC, DIST);
  }

  const elapsed = Date.now() - start;
  console.log(`Build completed in ${elapsed}ms → dist/`);
}

// Initial build
build();

// Watch mode
if (isWatch) {
  console.log("Watching for changes...\n");

  // Start live-server on the dist folder
  const server = exec("npx live-server dist --port=3000 --no-browser", {
    cwd: __dirname,
  });
  server.stdout.pipe(process.stdout);
  server.stderr.pipe(process.stderr);

  // Watch src, public, and assets for changes
  const watchDirs = [SRC, PUBLIC, ASSETS].filter(fs.existsSync);
  for (const dir of watchDirs) {
    fs.watch(dir, { recursive: true }, (event, filename) => {
      if (!filename) return;
      console.log(`\nChange detected: ${filename}`);
      build();
    });
  }
}
