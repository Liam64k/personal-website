const fs = require("fs");
const path = require("path");
const { execSync, exec } = require("child_process");

const DIST = path.join(__dirname, "dist");
const SRC = path.join(__dirname, "src");

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
 * Run the build: clean dist and copy src into dist.
 */
function build() {
  const start = Date.now();

  // Clean
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  // Copy all source files to dist
  copyDir(SRC, DIST);

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

  // Watch src for changes
  fs.watch(SRC, { recursive: true }, (event, filename) => {
    if (!filename) return;
    console.log(`\nChange detected: ${filename}`);
    build();
  });
}
