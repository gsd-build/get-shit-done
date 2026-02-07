#!/usr/bin/env node
/**
 * Generate Docusaurus documentation site from .planning/ artifacts.
 *
 * Transforms markdown files into MDX-safe content, generates Docusaurus scaffold,
 * and implements hash-based incremental regeneration.
 *
 * Usage:
 *   node scripts/generate-docs.js [--force] [--planning-dir <path>] [--output-dir <path>]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Parse CLI arguments
const args = process.argv.slice(2);
const flags = {
  force: args.includes('--force'),
  planningDir: null,
  outputDir: null
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--planning-dir' && args[i + 1]) {
    flags.planningDir = path.resolve(args[i + 1]);
    i++;
  } else if (args[i] === '--output-dir' && args[i + 1]) {
    flags.outputDir = path.resolve(args[i + 1]);
    i++;
  }
}

const PLANNING_DIR = flags.planningDir || path.join(process.cwd(), '.planning');
const OUTPUT_DIR = flags.outputDir || path.join(process.cwd(), 'docs');
const DOCS_DIR = path.join(OUTPUT_DIR, 'docs');
const HASH_CACHE_PATH = path.join(PLANNING_DIR, '.doc-hashes.json');

// Statistics tracking
const stats = {
  transformed: 0,
  skipped: 0,
  scaffoldCreated: 0
};

/**
 * Compute SHA256 hash of file contents
 */
function computeHash(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Load hash cache from disk
 */
function loadHashCache() {
  if (!fs.existsSync(HASH_CACHE_PATH)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(HASH_CACHE_PATH, 'utf8'));
  } catch (err) {
    console.warn(`Warning: Failed to load hash cache: ${err.message}`);
    return {};
  }
}

/**
 * Save hash cache to disk
 */
function saveHashCache(cache) {
  try {
    fs.writeFileSync(HASH_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.warn(`Warning: Failed to save hash cache: ${err.message}`);
  }
}

/**
 * Escape MDX special characters outside code blocks
 */
function escapeMDX(content) {
  const lines = content.split('\n');
  let inCodeBlock = false;
  const escaped = [];

  for (const line of lines) {
    // Detect code block boundaries (lines starting with triple backticks)
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      escaped.push(line);
      continue;
    }

    if (inCodeBlock) {
      // Inside code block - don't escape
      escaped.push(line);
    } else {
      // Outside code block - escape < and {
      // Note: We don't escape inside inline code (backtick-wrapped) as it's rare
      // in planning docs and escaped entities render correctly in prose
      escaped.push(
        line.replace(/</g, '&lt;').replace(/\{/g, '&#123;')
      );
    }
  }

  return escaped.join('\n');
}

/**
 * Extract first H1 heading from content
 */
function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Parse and transform front matter using gray-matter (if available)
 * Falls back to regex-based approach if gray-matter not installed
 */
function transformFrontMatter(content, title, sidebarPosition) {
  let hasFrontMatter = false;
  let bodyContent = content;

  // Try to use gray-matter if available (will be after docs/package.json installed)
  try {
    const matter = require('gray-matter');
    const parsed = matter(content);
    hasFrontMatter = Object.keys(parsed.data).length > 0;
    bodyContent = parsed.content;
  } catch (err) {
    // gray-matter not available - use regex fallback
    const frontMatterMatch = content.match(/^---\r?\n([\s\S]*?)\n---\r?\n/);
    if (frontMatterMatch) {
      hasFrontMatter = true;
      bodyContent = content.slice(frontMatterMatch[0].length);
    }
  }

  // Generate Docusaurus-compatible front matter
  const newFrontMatter = [
    '---',
    `title: ${title}`,
    `sidebar_position: ${sidebarPosition}`,
    '---',
    ''
  ].join('\n');

  return newFrontMatter + bodyContent;
}

/**
 * Transform a markdown file to MDX-safe content with Docusaurus front matter
 */
function transformFile(sourcePath, destPath, title, sidebarPosition) {
  let content = fs.readFileSync(sourcePath, 'utf8');

  // Extract title from first H1 if not provided
  if (!title) {
    title = extractTitle(content) || path.basename(sourcePath, '.md');
  }

  // Transform front matter
  content = transformFrontMatter(content, title, sidebarPosition);

  // Escape MDX special characters
  content = escapeMDX(content);

  // Write to destination
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.writeFileSync(destPath, content, 'utf8');
}

/**
 * Check if file needs regeneration (hash changed or dest missing)
 */
function needsRegeneration(sourcePath, destPath, hashCache) {
  if (flags.force) {
    return true;
  }

  if (!fs.existsSync(destPath)) {
    return true;
  }

  const currentHash = computeHash(sourcePath);
  const cachedHash = hashCache[sourcePath];

  return currentHash !== cachedHash;
}

/**
 * Process a single source file
 */
function processFile(sourcePath, destPath, title, sidebarPosition, hashCache, newCache) {
  if (needsRegeneration(sourcePath, destPath, hashCache)) {
    transformFile(sourcePath, destPath, title, sidebarPosition);
    newCache[sourcePath] = computeHash(sourcePath);
    stats.transformed++;
    console.log(`  ✓ Transformed: ${path.relative(process.cwd(), sourcePath)}`);
  } else {
    newCache[sourcePath] = hashCache[sourcePath];
    stats.skipped++;
    console.log(`  → Skipped (unchanged): ${path.relative(process.cwd(), sourcePath)}`);
  }
}

/**
 * Create _category_.json file for a directory
 */
function createCategoryFile(dirPath, label, position) {
  const categoryPath = path.join(dirPath, '_category_.json');
  const category = {
    label: label,
    position: position,
    collapsible: true,
    collapsed: false
  };
  fs.writeFileSync(categoryPath, JSON.stringify(category, null, 2), 'utf8');
}

/**
 * Process directory mapping from .planning/ to docs/docs/
 */
function processDirectory(hashCache, newCache) {
  console.log('\nProcessing .planning/ files...\n');

  // Top-level docs
  const topLevelDocs = [
    { source: 'PROJECT.md', dest: 'intro.md', title: 'Project Overview', position: 1 },
    { source: 'ROADMAP.md', dest: 'roadmap.md', title: null, position: 2 },
    { source: 'REQUIREMENTS.md', dest: 'requirements.md', title: null, position: 3 },
    { source: 'STATE.md', dest: 'state.md', title: null, position: 4 }
  ];

  for (const doc of topLevelDocs) {
    const sourcePath = path.join(PLANNING_DIR, doc.source);
    if (fs.existsSync(sourcePath)) {
      const destPath = path.join(DOCS_DIR, doc.dest);
      processFile(sourcePath, destPath, doc.title, doc.position, hashCache, newCache);
    }
  }

  // Architecture (from .planning/codebase/)
  const codebasePath = path.join(PLANNING_DIR, 'codebase');
  if (fs.existsSync(codebasePath)) {
    const archDir = path.join(DOCS_DIR, 'architecture');
    fs.mkdirSync(archDir, { recursive: true });
    createCategoryFile(archDir, 'Architecture', 5);

    const codebaseFiles = fs.readdirSync(codebasePath)
      .filter(f => f.endsWith('.md'))
      .sort();

    codebaseFiles.forEach((file, index) => {
      const sourcePath = path.join(codebasePath, file);
      const destPath = path.join(archDir, file);
      processFile(sourcePath, destPath, null, index + 1, hashCache, newCache);
    });
  }

  // Phase History (from .planning/phases/)
  const phasesPath = path.join(PLANNING_DIR, 'phases');
  if (fs.existsSync(phasesPath)) {
    const phasesDir = path.join(DOCS_DIR, 'phases');
    fs.mkdirSync(phasesDir, { recursive: true });
    createCategoryFile(phasesDir, 'Phase History', 6);

    const phaseDirectories = fs.readdirSync(phasesPath)
      .filter(f => fs.statSync(path.join(phasesPath, f)).isDirectory())
      .sort();

    phaseDirectories.forEach((phaseDir, phaseIndex) => {
      const sourcePhaseDir = path.join(phasesPath, phaseDir);
      const destPhaseDir = path.join(phasesDir, phaseDir);
      fs.mkdirSync(destPhaseDir, { recursive: true });

      // Extract phase name from directory (e.g., "01-infrastructure" -> "Infrastructure")
      const phaseName = phaseDir.replace(/^\d+-/, '').split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      createCategoryFile(destPhaseDir, phaseName, phaseIndex + 1);

      // Process markdown files in phase directory
      const phaseFiles = fs.readdirSync(sourcePhaseDir)
        .filter(f => f.endsWith('.md'))
        .sort();

      phaseFiles.forEach((file, fileIndex) => {
        const sourcePath = path.join(sourcePhaseDir, file);
        const destPath = path.join(destPhaseDir, file);
        processFile(sourcePath, destPath, null, fileIndex + 1, hashCache, newCache);
      });
    });
  }
}

/**
 * Create Docusaurus scaffold files if they don't exist
 */
function createScaffold() {
  console.log('\nChecking Docusaurus scaffold...\n');

  // docusaurus.config.js
  const configPath = path.join(OUTPUT_DIR, 'docusaurus.config.js');
  if (!fs.existsSync(configPath)) {
    const configContent = `// @ts-check
// Docusaurus configuration file
// https://docusaurus.io/docs/api/docusaurus-config

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Project Documentation',
  tagline: 'Auto-generated from .planning/ artifacts',
  favicon: 'img/favicon.ico',

  url: 'https://example.com',
  baseUrl: '/',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Project Docs',
        items: [],
      },
      footer: {
        style: 'dark',
        copyright: \`Copyright © \${new Date().getFullYear()} Project Documentation\`,
      },
    }),
};

module.exports = config;
`;
    fs.writeFileSync(configPath, configContent, 'utf8');
    stats.scaffoldCreated++;
    console.log('  ✓ Created: docusaurus.config.js');
  } else {
    console.log('  → Exists: docusaurus.config.js');
  }

  // sidebars.js
  const sidebarsPath = path.join(OUTPUT_DIR, 'sidebars.js');
  if (!fs.existsSync(sidebarsPath)) {
    const sidebarsContent = `// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docsSidebar: [
    {
      type: 'autogenerated',
      dirName: '.',
    },
  ],
};

module.exports = sidebars;
`;
    fs.writeFileSync(sidebarsPath, sidebarsContent, 'utf8');
    stats.scaffoldCreated++;
    console.log('  ✓ Created: sidebars.js');
  } else {
    console.log('  → Exists: sidebars.js');
  }

  // package.json
  const packagePath = path.join(OUTPUT_DIR, 'package.json');
  if (!fs.existsSync(packagePath)) {
    const packageContent = {
      name: 'project-docs',
      version: '0.0.0',
      private: true,
      scripts: {
        docusaurus: 'docusaurus',
        start: 'docusaurus start',
        build: 'docusaurus build',
        serve: 'docusaurus serve',
        clear: 'docusaurus clear'
      },
      dependencies: {
        '@docusaurus/core': '^3.7.0',
        '@docusaurus/preset-classic': '^3.7.0',
        'prism-react-renderer': '^2.3.0',
        'react': '^18.0.0',
        'react-dom': '^18.0.0',
        'gray-matter': '^4.0.3'
      },
      devDependencies: {
        '@docusaurus/module-type-aliases': '^3.7.0'
      },
      engines: {
        node: '>=20.0.0'
      }
    };
    fs.writeFileSync(packagePath, JSON.stringify(packageContent, null, 2) + '\n', 'utf8');
    stats.scaffoldCreated++;
    console.log('  ✓ Created: package.json');
  } else {
    console.log('  → Exists: package.json');
  }

  // src/css/custom.css
  const cssDir = path.join(OUTPUT_DIR, 'src', 'css');
  const cssPath = path.join(cssDir, 'custom.css');
  if (!fs.existsSync(cssPath)) {
    fs.mkdirSync(cssDir, { recursive: true });
    const cssContent = `/**
 * Custom CSS for project documentation
 */

:root {
  --ifm-color-primary: #2e8555;
  --ifm-color-primary-dark: #29784c;
  --ifm-color-primary-darker: #277148;
  --ifm-color-primary-darkest: #205d3b;
  --ifm-color-primary-light: #33925d;
  --ifm-color-primary-lighter: #359962;
  --ifm-color-primary-lightest: #3cad6e;
  --ifm-code-font-size: 95%;
}

[data-theme='dark'] {
  --ifm-color-primary: #25c2a0;
  --ifm-color-primary-dark: #21af90;
  --ifm-color-primary-darker: #1fa588;
  --ifm-color-primary-darkest: #1a8870;
  --ifm-color-primary-light: #29d5b0;
  --ifm-color-primary-lighter: #32d8b4;
  --ifm-color-primary-lightest: #4fddbf;
}
`;
    fs.writeFileSync(cssPath, cssContent, 'utf8');
    stats.scaffoldCreated++;
    console.log('  ✓ Created: src/css/custom.css');
  } else {
    console.log('  → Exists: src/css/custom.css');
  }

  // static/img/.gitkeep
  const imgDir = path.join(OUTPUT_DIR, 'static', 'img');
  const gitkeepPath = path.join(imgDir, '.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    fs.mkdirSync(imgDir, { recursive: true });
    fs.writeFileSync(gitkeepPath, '', 'utf8');
    stats.scaffoldCreated++;
    console.log('  ✓ Created: static/img/.gitkeep');
  } else {
    console.log('  → Exists: static/img/.gitkeep');
  }

  // .gitignore
  const gitignorePath = path.join(OUTPUT_DIR, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    const gitignoreContent = `# Dependencies
node_modules/

# Production
build/

# Generated files
.docusaurus/
.cache-loader/

# Misc
.DS_Store
`;
    fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
    stats.scaffoldCreated++;
    console.log('  ✓ Created: .gitignore');
  } else {
    console.log('  → Exists: .gitignore');
  }
}

/**
 * Main execution
 */
function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  GSD Documentation Generator                             ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`Planning directory: ${PLANNING_DIR}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Force regenerate: ${flags.force ? 'yes' : 'no'}`);

  // Check .planning/ exists
  if (!fs.existsSync(PLANNING_DIR)) {
    console.error();
    console.error(`Error: Planning directory not found: ${PLANNING_DIR}`);
    console.error('This command must be run from a project root with .planning/ directory.');
    process.exit(1);
  }

  // Load hash cache
  const hashCache = loadHashCache();
  const newCache = {};

  // Create output directories
  fs.mkdirSync(DOCS_DIR, { recursive: true });

  // Create scaffold
  createScaffold();

  // Process directory mapping
  processDirectory(hashCache, newCache);

  // Save updated hash cache
  saveHashCache(newCache);

  // Print summary
  console.log();
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  Generation Complete                                     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`  Files transformed: ${stats.transformed}`);
  console.log(`  Files skipped (unchanged): ${stats.skipped}`);
  console.log(`  Scaffold files created: ${stats.scaffoldCreated}`);
  console.log();
  console.log('Next steps:');
  console.log('  1. cd docs && npm install');
  console.log('  2. npm run start (for development)');
  console.log('  3. npm run build (for production)');
  console.log();
}

// Error handling wrapper
try {
  main();
} catch (err) {
  console.error();
  console.error('Error during documentation generation:');
  console.error(err.message);
  if (process.env.DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
}
