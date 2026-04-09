/**
 * Docs — Commands for the docs-update workflow
 *
 * Provides `cmdDocsInit` which returns project signals, existing doc inventory
 * with GSD marker detection, doc tooling detection, monorepo awareness, and
 * model resolution. Used by Phase 2 to route doc generation appropriately.
 */

const fs = require('fs');
const path = require('path');
const { output, loadConfig, resolveModelInternal, pathExistsInternal, toPosixPath, checkAgentsInstalled } = require('./core.cjs');

// ─── Constants ────────────────────────────────────────────────────────────────

const GSD_MARKER = '<!-- generated-by: gsd-doc-writer -->';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.planning', '.claude', '__pycache__',
  'target', 'dist', 'build', '.next', '.nuxt', 'coverage',
  '.vscode', '.idea',
]);

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Check whether a file begins with the GSD doc writer marker.
 * Reads the first 500 bytes only — avoids loading large files.
 *
 * @param {string} filePath - Absolute path to the file
 * @returns {boolean}
 */
function hasGsdMarker(filePath) {
  try {
    const buf = Buffer.alloc(500);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buf, 0, 500, 0);
    fs.closeSync(fd);
    return buf.slice(0, bytesRead).toString('utf-8').includes(GSD_MARKER);
  } catch {
    return false;
  }
}

/**
 * Recursively scan the project root (immediate .md files) and docs/ directory
 * (up to 4 levels deep) for Markdown files, excluding dirs in SKIP_DIRS.
 *
 * @param {string} cwd - Project root
 * @returns {Array<{path: string, has_gsd_marker: boolean}>}
 */
function scanExistingDocs(cwd) {
  const MAX_DEPTH = 4;
  const results = [];

  /**
   * Recursively walk a directory for .md files up to MAX_DEPTH levels.
   * @param {string} dir - Directory to scan
   * @param {number} depth - Current depth (1-based)
   */
  function walkDir(dir, depth) {
    if (depth > MAX_DEPTH) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(abs, depth + 1);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
          const rel = toPosixPath(path.relative(cwd, abs));
          results.push({ path: rel, has_gsd_marker: hasGsdMarker(abs) });
        }
      }
    } catch { /* directory may not exist — best-effort */ }
  }

  // Scan root-level .md files (non-recursive)
  try {
    const entries = fs.readdirSync(cwd, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        const abs = path.join(cwd, entry.name);
        const rel = toPosixPath(path.relative(cwd, abs));
        results.push({ path: rel, has_gsd_marker: hasGsdMarker(abs) });
      }
    }
  } catch { /* best-effort */ }

  // Recursively scan docs/ directory
  const docsDir = path.join(cwd, 'docs');
  walkDir(docsDir, 1);

  // Fallback: if docs/ does not exist, try documentation/ or doc/
  try {
    fs.statSync(docsDir);
  } catch {
    const alternatives = ['documentation', 'doc'];
    for (const alt of alternatives) {
      const altDir = path.join(cwd, alt);
      try {
        const stat = fs.statSync(altDir);
        if (stat.isDirectory()) {
          walkDir(altDir, 1);
          break;
        }
      } catch { /* not present */ }
    }
  }

  return results.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Detect project type signals from the filesystem and package.json.
 * All checks are best-effort and never throw.
 *
 * @param {string} cwd - Project root
 * @returns {Object} Boolean signal fields
 */
function detectProjectType(cwd) {
  const exists = (rel) => {
    try { return pathExistsInternal(cwd, rel); } catch { return false; }
  };

  // has_cli_bin: package.json has a `bin` field
  let has_cli_bin = false;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
    has_cli_bin = !!(pkg.bin && (typeof pkg.bin === 'string' || Object.keys(pkg.bin).length > 0));
  } catch { /* no package.json or invalid JSON */ }

  // is_monorepo: pnpm-workspace.yaml, lerna.json, or package.json workspaces
  let is_monorepo = exists('pnpm-workspace.yaml') || exists('lerna.json');
  if (!is_monorepo) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
      is_monorepo = Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0;
    } catch { /* ignore */ }
  }

  // has_tests: common test directories or test frameworks in devDependencies
  let has_tests = exists('test') || exists('tests') || exists('__tests__') || exists('spec');
  if (!has_tests) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
      const devDeps = Object.keys(pkg.devDependencies || {});
      has_tests = devDeps.some(d => ['vitest', 'jest', 'mocha', 'jasmine', 'ava'].includes(d));
    } catch { /* ignore */ }
  }

  // has_deploy_config: various deployment config files
  const deployFiles = [
    'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
    'fly.toml', 'render.yaml', 'vercel.json', 'netlify.toml', 'railway.json',
    '.github/workflows/deploy.yml', '.github/workflows/deploy.yaml',
  ];
  const has_deploy_config = deployFiles.some(f => exists(f));

  return {
    has_package_json: exists('package.json'),
    has_api_routes: (
      exists('src/app/api') || exists('routes') || exists('src/routes') ||
      exists('api') || exists('server')
    ),
    has_cli_bin,
    is_open_source: exists('LICENSE') || exists('LICENSE.md'),
    has_deploy_config,
    is_monorepo,
    has_tests,
  };
}

/**
 * Detect known documentation tooling in the project.
 *
 * @param {string} cwd - Project root
 * @returns {Object} Boolean detection fields
 */
function detectDocTooling(cwd) {
  const exists = (rel) => {
    try { return pathExistsInternal(cwd, rel); } catch { return false; }
  };

  return {
    docusaurus: exists('docusaurus.config.js') || exists('docusaurus.config.ts'),
    vitepress: (
      exists('.vitepress/config.js') ||
      exists('.vitepress/config.ts') ||
      exists('.vitepress/config.mts')
    ),
    mkdocs: exists('mkdocs.yml'),
    storybook: exists('.storybook'),
  };
}

/**
 * Extract monorepo workspace globs from pnpm-workspace.yaml, package.json
 * workspaces, or lerna.json.
 *
 * @param {string} cwd - Project root
 * @returns {string[]} Array of workspace glob patterns, or [] if not a monorepo
 */
function detectMonorepoWorkspaces(cwd) {
  // pnpm-workspace.yaml
  try {
    const content = fs.readFileSync(path.join(cwd, 'pnpm-workspace.yaml'), 'utf-8');
    const lines = content.split('\n');
    const workspaces = [];
    for (const line of lines) {
      const m = line.match(/^\s*-\s+['"]?(.+?)['"]?\s*$/);
      if (m) workspaces.push(m[1].trim());
    }
    if (workspaces.length > 0) return workspaces;
  } catch { /* not present */ }

  // package.json workspaces
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
    if (Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0) {
      return pkg.workspaces;
    }
  } catch { /* not present or invalid */ }

  // lerna.json
  try {
    const lerna = JSON.parse(fs.readFileSync(path.join(cwd, 'lerna.json'), 'utf-8'));
    if (Array.isArray(lerna.packages) && lerna.packages.length > 0) {
      return lerna.packages;
    }
  } catch { /* not present or invalid */ }

  return [];
}

// ─── Public commands ──────────────────────────────────────────────────────────

/**
 * Return JSON context for the docs-update workflow: project signals, existing
 * doc inventory, doc tooling detection, monorepo workspaces, and model
 * resolution. Follows the cmdInitMapCodebase pattern.
 *
 * @example
 * node gsd-tools.cjs docs-init --raw
 *
 * @param {string} cwd - Project root directory
 * @param {boolean} raw - Pass raw JSON flag through to output()
 */
function cmdDocsInit(cwd, raw) {
  const config = loadConfig(cwd);
  const result = {
    doc_writer_model: resolveModelInternal(cwd, 'gsd-doc-writer'),
    commit_docs: config.commit_docs,
    existing_docs: scanExistingDocs(cwd),
    project_type: detectProjectType(cwd),
    doc_tooling: detectDocTooling(cwd),
    monorepo_workspaces: detectMonorepoWorkspaces(cwd),
    planning_exists: pathExistsInternal(cwd, '.planning'),
  };
  // Inject project_root and agent installation status (mirrors withProjectRoot in init.cjs)
  result.project_root = cwd;
  const agentStatus = checkAgentsInstalled();
  result.agents_installed = agentStatus.agents_installed;
  result.missing_agents = agentStatus.missing_agents;
  output(result, raw);
}

module.exports = { cmdDocsInit };
