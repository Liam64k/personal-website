const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'src');
const TEMPLATE_DIR = path.join(SRC_DIR, 'templates');

// Read the nav template content
const navContent = fs.readFileSync(path.join(TEMPLATE_DIR, 'nav.html'), 'utf-8');

// Regex: match <section class="nav"> ... </section> (including any existing inner content)
const navSectionRegex = /(<section\s+class="nav">)([\s\S]*?)(<\/section>)/g;

// Recursively find all .html files in src/ (excluding templates/)
function getHtmlFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'templates') continue; // skip templates folder
      results = results.concat(getHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

const htmlFiles = getHtmlFiles(SRC_DIR);
let totalInjections = 0;

for (const filePath of htmlFiles) {
  let html = fs.readFileSync(filePath, 'utf-8');

  if (navSectionRegex.test(html)) {
    // Reset regex lastIndex after test()
    navSectionRegex.lastIndex = 0;

    const updated = html.replace(navSectionRegex, `$1\n${navContent}$3`);
    fs.writeFileSync(filePath, updated, 'utf-8');

    const relativePath = path.relative(__dirname, filePath);
    console.log(`Injected nav into: ${relativePath}`);
    totalInjections++;
  }
}

console.log(`\nDone. Nav injected into ${totalInjections} file(s).`);
