#!/usr/bin/env node
/**
 * sync-upstream.js — Fetch upstream GSD changes, transform through GMSD pipeline, apply to review branch.
 *
 * Usage: node scripts/sync-upstream.js <from>..<to>
 * Example: node scripts/sync-upstream.js v1.21.0..v1.22.0
 *
 * This is a dev-only tool (not published). It performs whole-file transformation:
 * for each file changed upstream, fetch its content at the target commit, run it
 * through the GMSD conversion pipeline, and write it to the mapped path.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Section 1: Constants ────────────────────────────────────────────────────

const UPSTREAM_URL = 'https://github.com/glittercowboy/get-shit-done.git';

// File category identifiers
const CATEGORY = {
  CJS_LIB: 'CJS_LIB',
  MD_PROMPT: 'MD_PROMPT',
  TEMPLATE: 'TEMPLATE',
  ORG_DOC: 'ORG_DOC',
  PASSTHROUGH: 'PASSTHROUGH',
};

// Category detection regexes (applied after path mapping)
const CATEGORY_PATTERNS = [
  { re: /\.cjs$/, cat: CATEGORY.CJS_LIB },
  { re: /\.js$/, cat: CATEGORY.CJS_LIB },
  { re: /templates\//, cat: CATEGORY.TEMPLATE },
  { re: /\.(md|org)$/, cat: CATEGORY.MD_PROMPT },
];

// Files to skip entirely (manual-merge or irrelevant to GMSD)
const SKIP_PATTERNS = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^\.github\//,
  /^README\.md$/,
  /^CHANGELOG\.md$/,
  /^\.gitignore$/,
  /^LICENSE$/,
  /^node_modules\//,
];

// Files that need manual merge — written as .upstream-sync sidecar
const MANUAL_MERGE_GMSD_PATHS = ['README.org', 'CHANGELOG.org'];

// ─── Section 2: Path Mapping ─────────────────────────────────────────────────

/**
 * Map an upstream GSD path to its GMSD equivalent.
 *
 * Returns { gmsdPath, category } or null if the file should be skipped.
 * Rules are applied in order (longest/most-specific match first).
 */
function mapUpstreamPath(upstreamPath) {
  // Skip list check
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(upstreamPath)) return null;
  }

  let gmsdPath = upstreamPath;
  let category = null;

  // Rule 1: Exact binary path
  if (upstreamPath === 'get-shit-done/bin/gsd-tools.cjs') {
    return { gmsdPath: 'get-my-shit-done/bin/gmsd-tools.cjs', category: CATEGORY.CJS_LIB };
  }

  // Rule 2: Templates under get-shit-done/ (.md → .org)
  if (/^get-shit-done\/templates\/.*\.md$/.test(upstreamPath)) {
    gmsdPath = upstreamPath
      .replace(/^get-shit-done\//, 'get-my-shit-done/')
      .replace(/\.md$/, '.org');
    return { gmsdPath, category: CATEGORY.TEMPLATE };
  }

  // Rule 3: Everything else under get-shit-done/ → get-my-shit-done/
  if (/^get-shit-done\//.test(upstreamPath)) {
    gmsdPath = upstreamPath.replace(/^get-shit-done\//, 'get-my-shit-done/');
    // Inherit category from extension
    category = detectCategory(gmsdPath);
    return { gmsdPath, category };
  }

  // Rule 4: Commands directory
  if (/^commands\/gsd\//.test(upstreamPath)) {
    gmsdPath = upstreamPath.replace(/^commands\/gsd\//, 'commands/gmsd/');
    return { gmsdPath, category: CATEGORY.MD_PROMPT };
  }

  // Rule 5: Agent files
  if (/^agents\/gsd-/.test(upstreamPath)) {
    gmsdPath = upstreamPath.replace(/^agents\/gsd-/, 'agents/gmsd-');
    return { gmsdPath, category: CATEGORY.MD_PROMPT };
  }

  // Rule 6: Hook files
  if (/^hooks\/gsd-/.test(upstreamPath)) {
    gmsdPath = upstreamPath.replace(/^hooks\/gsd-/, 'hooks/gmsd-');
    return { gmsdPath, category: CATEGORY.CJS_LIB };
  }

  // Rule 7: Root-level templates (.md → .org)
  if (/^templates\/.*\.md$/.test(upstreamPath)) {
    gmsdPath = upstreamPath.replace(/\.md$/, '.org');
    return { gmsdPath, category: CATEGORY.TEMPLATE };
  }

  // Rule 8: Docs (.md → .org)
  if (/^docs\/.*\.md$/.test(upstreamPath)) {
    gmsdPath = upstreamPath.replace(/\.md$/, '.org');
    return { gmsdPath, category: CATEGORY.ORG_DOC };
  }

  // Rule 9: Pass-through files
  if (upstreamPath === 'SECURITY.md' || upstreamPath === 'CLAUDE.md') {
    return { gmsdPath: upstreamPath, category: CATEGORY.PASSTHROUGH };
  }

  // Default: map with detected category
  category = detectCategory(gmsdPath);
  return { gmsdPath, category };
}

function detectCategory(filePath) {
  for (const { re, cat } of CATEGORY_PATTERNS) {
    if (re.test(filePath)) return cat;
  }
  return CATEGORY.PASSTHROUGH;
}

// ─── Section 3: Content Transformation ───────────────────────────────────────

/**
 * Text substitutions applied in order (longest match first to avoid partial replacements).
 */
const SUBSTITUTIONS = [
  // Longest compound names first
  { find: /get-shit-done/g, replace: 'get-my-shit-done' },
  { find: /gsd-tools\.cjs/g, replace: 'gmsd-tools.cjs' },
  { find: /\/gsd:/g, replace: '/gmsd:' },
  { find: /~\/\.gsd\//g, replace: '~/.gmsd/' },
  { find: /gsd_state_version/g, replace: 'gmsd_state_version' },
  { find: /gsd\/phase-/g, replace: 'gmsd/phase-' },
  { find: /gsd\/milestone-/g, replace: 'gmsd/milestone-' },
  // Word-boundary patterns last
  { find: /\bgsd-/g, replace: 'gmsd-' },
  { find: /\bGSD\b/g, replace: 'GMSD' },
];

/**
 * Apply GMSD text substitutions to content.
 *
 * @param {string} content - File content
 * @param {string} upstreamPath - Original upstream path (for diagnostics)
 * @param {string|null} category - File category
 * @returns {{ transformed: string, warnings: string[] }}
 */
function transformContent(content, upstreamPath, category) {
  const warnings = [];

  if (category === CATEGORY.PASSTHROUGH) {
    return { transformed: content, warnings };
  }

  let transformed = content;
  for (const { find, replace } of SUBSTITUTIONS) {
    transformed = transformed.replace(find, replace);
  }

  return { transformed, warnings };
}

// ─── Section 4: Template Structural Conversion ───────────────────────────────

/**
 * Convert markdown structure to org-mode structure.
 * Only applied to TEMPLATE category files that are new (not already .org in GMSD).
 *
 * @param {string} content - Content (already text-substituted)
 * @returns {string} Org-mode converted content
 */
function convertMarkdownToOrg(content) {
  const lines = content.split('\n');
  const result = [];
  let inCodeBlock = false;
  let codeBlockLang = '';

  for (const line of lines) {
    // Code fence handling
    if (/^```(\w*)/.test(line)) {
      if (!inCodeBlock) {
        codeBlockLang = line.match(/^```(\w*)/)[1] || '';
        result.push(`#+begin_src ${codeBlockLang}`.trimEnd());
        inCodeBlock = true;
      } else {
        result.push('#+end_src');
        inCodeBlock = false;
        codeBlockLang = '';
      }
      continue;
    }

    if (inCodeBlock) {
      result.push(line);
      continue;
    }

    // Heading conversion: ## → **, ### → ***, etc.
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      result.push('*'.repeat(level) + ' ' + text);
      continue;
    }

    // Bold: **text** → *text* (but not inside code blocks, already handled above)
    let converted = line;
    converted = converted.replace(/\*\*([^*]+)\*\*/g, '*$1*');

    result.push(converted);
  }

  return result.join('\n');
}

/**
 * Add org-mode file header if not already present.
 *
 * @param {string} content - Content to add header to
 * @param {string} filePath - File path (used to derive title)
 * @returns {string} Content with org header
 */
function addOrgHeader(content, filePath) {
  if (content.startsWith('#+title:')) {
    return content;
  }

  const basename = path.basename(filePath, '.org');
  // Convert kebab-case to Title Case
  const title = basename.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const header = `#+title: ${title}\n#+startup: indent\n#+options: toc:2 num:nil ^:{}\n\n`;
  return header + content;
}

// ─── Section 5: Frontmatter Conversion ───────────────────────────────────────

/**
 * Convert YAML frontmatter (--- delimited) to Org property drawers.
 * Only applied when content starts with '---' on line 1.
 *
 * @param {string} content - File content
 * @returns {{ converted: string, hadFrontmatter: boolean }}
 */
function convertYamlFrontmatter(content) {
  if (!content.startsWith('---\n')) {
    return { converted: content, hadFrontmatter: false };
  }

  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) {
    return { converted: content, hadFrontmatter: false };
  }

  const yamlBlock = content.slice(4, endIndex);
  const rest = content.slice(endIndex + 4); // skip past closing ---

  const properties = parseYamlToProperties(yamlBlock);
  const drawer = `:PROPERTIES:\n${properties}\n:END:`;

  return { converted: drawer + rest, hadFrontmatter: true };
}

/**
 * Parse simple YAML key-value pairs into Org property drawer lines.
 * Handles: simple values, arrays (inline []), nested objects (dot-notation).
 *
 * @param {string} yaml - YAML content (without --- delimiters)
 * @returns {string} Property drawer lines
 */
function parseYamlToProperties(yaml) {
  const lines = yaml.split('\n');
  const result = [];
  // lastKey tracks the most recent key at any level (for array items that follow)
  let lastKey = null;
  let lastKeyFullPath = null;
  let currentIndent = 0;
  const keyStack = [];

  for (const line of lines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    // Array item (- value)
    if (trimmed.startsWith('- ')) {
      const value = trimmed.slice(2).trim();
      if (lastKeyFullPath) {
        // Collect array items under the most recent key
        const existingIdx = result.findIndex(r => r.key === lastKeyFullPath);
        if (existingIdx >= 0) {
          result[existingIdx].values.push(value);
        } else {
          result.push({ key: lastKeyFullPath, values: [value] });
        }
      }
      continue;
    }

    // Key-value pair
    const kvMatch = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.*)/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    const value = kvMatch[2].trim();

    // Adjust key stack based on indentation
    while (keyStack.length > 0 && indent <= currentIndent - 2) {
      keyStack.pop();
      currentIndent -= 2;
    }

    const fullKey = keyStack.length > 0 ? [...keyStack, key].join('.') : key;

    if (value === '' || value === '{}') {
      // Could be a nested object or an array parent — track as lastKey
      // so subsequent `- item` lines can attach to it
      keyStack.push(key);
      lastKey = key;
      lastKeyFullPath = fullKey;
      currentIndent = indent + 2;
    } else if (value.startsWith('[') && value.endsWith(']')) {
      // Inline array
      result.push({ key: fullKey, inline: value });
      lastKey = key;
      lastKeyFullPath = fullKey;
    } else {
      // Simple value
      result.push({ key: fullKey, value });
      lastKey = key;
      lastKeyFullPath = fullKey;
    }
  }

  // Serialize to property drawer lines
  return result.map(entry => {
    if (entry.inline) {
      return `:${entry.key}: ${entry.inline}`;
    } else if (entry.values) {
      return `:${entry.key}: [${entry.values.join(', ')}]`;
    } else {
      return `:${entry.key}: ${entry.value}`;
    }
  }).join('\n');
}

// ─── Section 6: Hardcoded .md Detection ──────────────────────────────────────

// Known-acceptable .md references (not warnings)
const ACCEPTABLE_MD_REFS = [
  'CLAUDE.md',
  /agents\/gmsd-.*\.md/,
  /commands\/gmsd\/.*\.md/,
  /workflows\/.*\.md/,
  /references\/.*\.md/,
  /\.github\/.*\.md/,
];

/**
 * Scan for hardcoded .md references in CJS/JS files that should have been
 * converted to .org.
 *
 * @param {string} content - Transformed content
 * @param {string} filePath - GMSD file path
 * @returns {Array<{ line: number, match: string, suggestion: string }>}
 */
function detectHardcodedMd(content, filePath) {
  // Only scan code files
  if (!/\.(cjs|js)$/.test(filePath)) return [];

  const warnings = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    // Find quoted strings containing .md
    const matches = lines[i].matchAll(/['"`]([^'"`]*\.md)['"`]/g);
    for (const m of matches) {
      const ref = m[1];

      // Check if acceptable
      const acceptable = ACCEPTABLE_MD_REFS.some(pattern =>
        typeof pattern === 'string' ? ref.includes(pattern) : pattern.test(ref)
      );
      if (acceptable) continue;

      warnings.push({
        line: i + 1,
        match: ref,
        suggestion: ref.replace(/\.md$/, '.org'),
      });
    }
  }

  return warnings;
}

// ─── Section 7: Git Operations + Main Orchestrator ───────────────────────────

function git(cmd, opts = {}) {
  try {
    return execSync(`git ${cmd}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...opts,
    }).trim();
  } catch (err) {
    if (opts.allowFailure) return null;
    console.error(`git ${cmd} failed: ${err.stderr || err.message}`);
    process.exit(1);
  }
}

function ensureCleanWorkingTree() {
  const status = git('status --porcelain');
  if (status) {
    console.error('Error: Working tree is dirty. Commit or stash changes first.');
    console.error(status);
    process.exit(1);
  }
}

function ensureUpstreamRemote() {
  const remotes = git('remote');
  if (!remotes.split('\n').includes('upstream')) {
    console.log(`Adding upstream remote: ${UPSTREAM_URL}`);
    git(`remote add upstream ${UPSTREAM_URL}`);
  }
}

function resolveRange(rangeStr) {
  const match = rangeStr.match(/^(.+)\.\.(.+)$/);
  if (!match) {
    console.error(`Invalid range format: ${rangeStr}. Expected: <from>..<to>`);
    process.exit(1);
  }
  const [, from, to] = match;
  const fromSHA = git(`rev-parse ${from}`);
  const toSHA = git(`rev-parse ${to}`);
  return { from, to, fromSHA, toSHA };
}

function getChangedFiles(fromSHA, toSHA) {
  const output = git(`diff --name-status ${fromSHA}..${toSHA}`);
  if (!output) return [];

  return output.split('\n').map(line => {
    const [status, ...pathParts] = line.split('\t');
    const filePath = pathParts.join('\t');
    return { status: status.charAt(0), path: filePath };
  });
}

function getFileContent(sha, filePath) {
  return git(`show ${sha}:${filePath}`, { allowFailure: true });
}

function processFile(filePath, status, toSHA, repoRoot) {
  const mapping = mapUpstreamPath(filePath);

  if (!mapping) {
    return { action: 'skipped', upstreamPath: filePath, reason: 'skip list' };
  }

  const { gmsdPath, category } = mapping;
  const fullGmsdPath = path.join(repoRoot, gmsdPath);
  const isManualMerge = MANUAL_MERGE_GMSD_PATHS.includes(gmsdPath);

  // Handle deletions
  if (status === 'D') {
    if (fs.existsSync(fullGmsdPath)) {
      return { action: 'delete', upstreamPath: filePath, gmsdPath };
    }
    return { action: 'skipped', upstreamPath: filePath, gmsdPath, reason: 'already absent' };
  }

  // Fetch upstream content at target commit
  const content = getFileContent(toSHA, filePath);
  if (content === null) {
    return { action: 'skipped', upstreamPath: filePath, gmsdPath, reason: 'fetch failed' };
  }

  // Apply transformations
  const { transformed, warnings: transformWarnings } = transformContent(content, filePath, category);
  let finalContent = transformed;

  // Template structural conversion (only for new .org files from .md templates)
  if (category === CATEGORY.TEMPLATE && filePath.endsWith('.md')) {
    const { converted } = convertYamlFrontmatter(finalContent);
    finalContent = converted;
    finalContent = convertMarkdownToOrg(finalContent);
    finalContent = addOrgHeader(finalContent, gmsdPath);
  }

  // Frontmatter conversion for other categories that might have YAML frontmatter
  if (category !== CATEGORY.TEMPLATE && category !== CATEGORY.PASSTHROUGH) {
    const { converted } = convertYamlFrontmatter(finalContent);
    finalContent = converted;
  }

  // Detect hardcoded .md references
  const mdWarnings = detectHardcodedMd(finalContent, gmsdPath);

  const allWarnings = [
    ...transformWarnings,
    ...mdWarnings.map(w => `${gmsdPath}:${w.line}: '${w.match}' → '${w.suggestion}'`),
  ];

  if (isManualMerge) {
    return {
      action: 'manual-merge',
      upstreamPath: filePath,
      gmsdPath,
      sidecarPath: gmsdPath + '.upstream-sync',
      content: finalContent,
      warnings: allWarnings,
    };
  }

  return {
    action: 'write',
    upstreamPath: filePath,
    gmsdPath,
    content: finalContent,
    warnings: allWarnings,
  };
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: node scripts/sync-upstream.js <from>..<to>
Example: node scripts/sync-upstream.js v1.21.0..v1.22.0

Options:
  --dry-run    Show what would be done without making changes
  --help, -h   Show this help`);
    process.exit(0);
  }

  const dryRun = args.includes('--dry-run');
  const rangeStr = args.find(a => a.includes('..') && !a.startsWith('-'));

  if (!rangeStr) {
    console.error('Error: No commit range specified. Expected: <from>..<to>');
    process.exit(1);
  }

  const repoRoot = git('rev-parse --show-toplevel');

  console.log('=== GMSD Upstream Sync ===\n');

  // Step 1: Clean working tree
  ensureCleanWorkingTree();
  console.log('[✓] Working tree is clean');

  // Step 2: Ensure upstream remote
  ensureUpstreamRemote();
  console.log('[✓] Upstream remote configured');

  // Step 3: Fetch upstream
  console.log('Fetching upstream...');
  git('fetch upstream --tags');
  console.log('[✓] Upstream fetched');

  // Step 4: Resolve range
  const { from, to, fromSHA, toSHA } = resolveRange(rangeStr);
  console.log(`\nRange: ${from} (${fromSHA.slice(0, 8)}) → ${to} (${toSHA.slice(0, 8)})\n`);

  // Step 5: Get changed files
  const changedFiles = getChangedFiles(fromSHA, toSHA);
  console.log(`Files changed upstream: ${changedFiles.length}`);

  // Step 6: Process each file
  const results = changedFiles.map(({ status, path: filePath }) =>
    processFile(filePath, status, toSHA, repoRoot)
  );

  // Summary
  const writes = results.filter(r => r.action === 'write');
  const deletes = results.filter(r => r.action === 'delete');
  const manualMerges = results.filter(r => r.action === 'manual-merge');
  const skipped = results.filter(r => r.action === 'skipped');
  const allWarnings = results.flatMap(r => r.warnings || []);

  console.log(`\n--- Summary ---`);
  console.log(`  Write:        ${writes.length}`);
  console.log(`  Delete:       ${deletes.length}`);
  console.log(`  Manual merge: ${manualMerges.length}`);
  console.log(`  Skipped:      ${skipped.length}`);
  if (allWarnings.length > 0) {
    console.log(`  Warnings:     ${allWarnings.length}`);
  }

  if (dryRun) {
    console.log('\n--- Dry Run Details ---');
    for (const r of writes) {
      console.log(`  WRITE  ${r.upstreamPath} → ${r.gmsdPath}`);
    }
    for (const r of deletes) {
      console.log(`  DELETE ${r.gmsdPath}`);
    }
    for (const r of manualMerges) {
      console.log(`  MANUAL ${r.upstreamPath} → ${r.sidecarPath}`);
    }
    for (const r of skipped) {
      console.log(`  SKIP   ${r.upstreamPath} (${r.reason})`);
    }
    if (allWarnings.length > 0) {
      console.log('\n--- Warnings ---');
      allWarnings.forEach(w => console.log(`  ⚠ ${w}`));
    }
    console.log('\nDry run complete. No changes made.');
    process.exit(0);
  }

  if (writes.length === 0 && deletes.length === 0 && manualMerges.length === 0) {
    console.log('\nNothing to sync.');
    process.exit(0);
  }

  // Step 7: Create sync branch
  const date = new Date().toISOString().slice(0, 10);
  const branchName = `gmsd/upstream-sync-${date}`;
  git(`checkout -b ${branchName}`);
  console.log(`\n[✓] Created branch: ${branchName}`);

  // Step 8: Apply writes
  for (const r of writes) {
    const fullPath = path.join(repoRoot, r.gmsdPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, r.content, 'utf-8');
    git(`add "${r.gmsdPath}"`);
    console.log(`  ✓ ${r.upstreamPath} → ${r.gmsdPath}`);
  }

  // Step 9: Apply deletes
  for (const r of deletes) {
    git(`rm "${r.gmsdPath}"`, { allowFailure: true });
    console.log(`  ✗ ${r.gmsdPath} (deleted)`);
  }

  // Step 10: Write manual-merge sidecars
  for (const r of manualMerges) {
    const fullPath = path.join(repoRoot, r.sidecarPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, r.content, 'utf-8');
    git(`add "${r.sidecarPath}"`);
    console.log(`  ⇄ ${r.upstreamPath} → ${r.sidecarPath} (manual merge needed)`);
  }

  // Step 11: Commit
  const commitMsg = `chore: sync upstream ${from}..${to}\n\nUpstream range: ${from} (${fromSHA.slice(0, 8)}) → ${to} (${toSHA.slice(0, 8)})\nFiles: ${writes.length} written, ${deletes.length} deleted, ${manualMerges.length} manual-merge`;
  git(`commit -m "${commitMsg}"`);
  console.log(`\n[✓] Committed`);

  // Print warnings and next steps
  if (allWarnings.length > 0) {
    console.log('\n--- Warnings (review these) ---');
    allWarnings.forEach(w => console.log(`  ⚠ ${w}`));
  }

  console.log(`
--- Next Steps ---
1. Review the sync branch:
   git diff main...${branchName}

2. Run the test suite:
   node --test tests/*.test.cjs

3. Handle manual-merge sidecars (if any):
   ${manualMerges.length > 0
     ? manualMerges.map(r => `diff ${r.gmsdPath.replace('.upstream-sync', '')} ${r.sidecarPath}`).join('\n   ')
     : '(none)'}

4. Address any warnings above

5. Merge when ready:
   git checkout main && git merge ${branchName}
`);
}

// ─── Exports (for testing) ───────────────────────────────────────────────────

module.exports = {
  CATEGORY,
  SKIP_PATTERNS,
  UPSTREAM_URL,
  mapUpstreamPath,
  transformContent,
  convertMarkdownToOrg,
  addOrgHeader,
  convertYamlFrontmatter,
  parseYamlToProperties,
  detectHardcodedMd,
};

// Run main if invoked directly
if (require.main === module) {
  main();
}
