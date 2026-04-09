#!/usr/bin/env node
/**
 * Copy GSD hooks to dist for installation.
 * Validates JavaScript syntax before copying to prevent shipping broken hooks.
 * See #1107, #1109, #1125, #1161 — a duplicate const declaration shipped
 * in dist and caused PostToolUse hook errors for all users.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HOOKS_DIR = path.join(__dirname, '..', 'hooks');
const DIST_DIR = path.join(HOOKS_DIR, 'dist');

// Hooks to copy (pure Node.js, no bundling needed)
const HOOKS_TO_COPY = [
  'gsd-check-update.js',
  'gsd-context-monitor.js',
  'gsd-prompt-guard.js',
  'gsd-read-guard.js',
  'gsd-statusline.js',
  'gsd-workflow-guard.js',
  // Community hooks (bash, opt-in via .planning/config.json hooks.community)
  'gsd-session-state.sh',
  'gsd-validate-commit.sh',
  'gsd-phase-boundary.sh'
];

/**
 * Validate JavaScript syntax without executing the file.
 * Catches SyntaxError (duplicate const, missing brackets, etc.)
 * before the hook gets shipped to users.
 */
function validateSyntax(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  try {
    // Use vm.compileFunction to check syntax without executing
    new vm.Script(content, { filename: path.basename(filePath) });
    return null; // No error
  } catch (e) {
    if (e instanceof SyntaxError) {
      return e.message;
    }
    throw e;
  }
}

function build() {
  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  let hasErrors = false;

  // Copy hooks to dist with syntax validation
  for (const hook of HOOKS_TO_COPY) {
    const src = path.join(HOOKS_DIR, hook);
    const dest = path.join(DIST_DIR, hook);

    if (!fs.existsSync(src)) {
      console.warn(`Warning: ${hook} not found, skipping`);
      continue;
    }

    // Validate JS syntax before copying (.sh files skip — not Node.js)
    if (hook.endsWith('.js')) {
      const syntaxError = validateSyntax(src);
      if (syntaxError) {
        console.error(`\x1b[31m✗ ${hook}: SyntaxError — ${syntaxError}\x1b[0m`);
        hasErrors = true;
        continue;
      }
    }

    console.log(`\x1b[32m✓\x1b[0m Copying ${hook}...`);
    fs.copyFileSync(src, dest);
    // Preserve executable bit for shell scripts
    if (hook.endsWith('.sh')) {
      try { fs.chmodSync(dest, 0o755); } catch (e) { /* Windows */ }
    }
  }

  if (hasErrors) {
    console.error('\n\x1b[31mBuild failed: fix syntax errors above before publishing.\x1b[0m');
    process.exit(1);
  }

  console.log('\nBuild complete.');
}

build();
