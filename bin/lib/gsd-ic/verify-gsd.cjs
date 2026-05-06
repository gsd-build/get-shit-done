'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Detect a stock GSD install in the target directory.
 *
 * Heuristics in priority order:
 *   1. Modern install: .claude/skills/gsd-* (Claude Code 2.1.88+)
 *   2. Modern install (Codex): .codex/skills/gsd-*
 *   3. Legacy install: commands/gsd/*.md
 *   4. .clinerules with gsd content (Cline runtime)
 *
 * Future: parse a recorded GSD version from the target and compare against
 * gsdPinned for compatibility. v1 doesn't enforce version bounds — only
 * checks presence — because GSD doesn't write a discoverable version marker
 * into target directories at install time. Compatibility is checked at
 * publish time via package.json peerDependencies.
 */
function verifyGsd({ target, gsdPinned }) {
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    return { ok: false, reason: `target directory does not exist: ${target}` };
  }

  const probes = [
    { path: '.claude/skills', glob: /^gsd-/, label: 'modern-skills' },
    { path: '.codex/skills', glob: /^gsd-/, label: 'modern-skills-codex' },
    { path: 'commands/gsd', glob: /\.md$/, label: 'legacy-commands' },
  ];

  for (const p of probes) {
    const dir = path.join(target, p.path);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      const entries = fs.readdirSync(dir);
      if (entries.some((e) => p.glob.test(e))) {
        return { ok: true, detected: p.label, gsdPinned };
      }
    }
  }

  // Cline: .clinerules file containing gsd reference.
  const clinerules = path.join(target, '.clinerules');
  if (fs.existsSync(clinerules) && fs.readFileSync(clinerules, 'utf8').includes('gsd')) {
    return { ok: true, detected: 'cline', gsdPinned };
  }

  return {
    ok: false,
    reason:
      `GSD not detected in ${target}. Run \`npx get-shit-done-cc@latest\` to install GSD first, ` +
      'then re-run the IC pack install.',
  };
}

module.exports = { verifyGsd };
