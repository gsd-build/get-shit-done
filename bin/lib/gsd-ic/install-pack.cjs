'use strict';

const fs = require('fs');
const path = require('path');

// Paths under target/ that the IC pack manages (idempotent overwrite ok).
// Anything NOT in this list is program-owned and must not be touched.
const MANAGED_PATHS = [
  '.claude/agents',          // only IC pack agents (gsd-* with ic_pack: true)
  '.claude/hooks',           // only IC pack hooks (gsd-*)
  '.claude/skills',          // only IC pack skills (4 named in spec §7)
  '.claude/intel-refs',
  '.claude/config-overlays', // only the selected customer's directory
  '.claude/references/agent-contracts.ic-pack.md',
];

const IC_PACK_SKILL_NAMES = [
  'intel-coding-conventions',
  'prototyping-discipline',
  'classification-conventions',
  'adelphi-house-style',
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest, filter = () => true) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.gitkeep') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, filter);
    } else if (entry.isFile() && filter(srcPath)) {
      copyFile(srcPath, destPath);
    }
  }
}

function readFrontmatter(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}

function isIcPackAgent(filePath) {
  if (!filePath.endsWith('.md')) return false;
  const fm = readFrontmatter(filePath);
  return /\bic_pack:\s*true\b/.test(fm);
}

// IC pack hooks must declare themselves with a `// ic_pack: true` comment in
// the first 10 lines. Without this marker, the file is treated as upstream
// stock and skipped — necessary because upstream hooks share the gsd-* prefix.
function isIcPackHook(filePath) {
  if (!filePath.endsWith('.js')) return false;
  let head;
  try {
    head = fs.readFileSync(filePath, 'utf8').split('\n', 10).join('\n');
  } catch {
    return false;
  }
  return /\/\/\s*ic_pack:\s*true\b/.test(head);
}

function copyAgents(srcRoot, target) {
  const srcDir = path.join(srcRoot, 'agents');
  const destDir = path.join(target, '.claude/agents');
  if (!fs.existsSync(srcDir)) return;
  ensureDir(destDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const srcPath = path.join(srcDir, entry.name);
    if (!isIcPackAgent(srcPath)) continue;
    copyFile(srcPath, path.join(destDir, entry.name));
  }
}

function copyHooks(srcRoot, target) {
  const srcDir = path.join(srcRoot, 'hooks');
  const destDir = path.join(target, '.claude/hooks');
  if (!fs.existsSync(srcDir)) return;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const srcPath = path.join(srcDir, entry.name);
    if (!isIcPackHook(srcPath)) continue;
    copyFile(srcPath, path.join(destDir, entry.name));
  }
  // Note: hooks/patterns/ is intentionally NOT copied — it belongs to upstream.
}

function copySkills(srcRoot, target) {
  const srcDir = path.join(srcRoot, 'skills');
  const destDir = path.join(target, '.claude/skills');
  if (!fs.existsSync(srcDir)) return;
  for (const skillName of IC_PACK_SKILL_NAMES) {
    const srcSkill = path.join(srcDir, skillName);
    if (!fs.existsSync(srcSkill)) continue;
    copyDir(srcSkill, path.join(destDir, skillName));
  }
}

function copyIntelRefs(srcRoot, target) {
  copyDir(path.join(srcRoot, 'intel-refs'), path.join(target, '.claude/intel-refs'));
}

function copyOverlay(srcRoot, target, customer) {
  const srcOverlay = path.join(srcRoot, 'config-overlays', customer);
  if (!fs.existsSync(srcOverlay)) {
    throw new Error(`customer overlay not found in pack source: ${srcOverlay}`);
  }
  copyDir(srcOverlay, path.join(target, '.claude/config-overlays', customer));
}

function copyContractRegistry(srcRoot, target) {
  const src = path.join(srcRoot, 'references/agent-contracts.ic-pack.md');
  if (fs.existsSync(src)) {
    copyFile(src, path.join(target, '.claude/references/agent-contracts.ic-pack.md'));
  }
}

function installPack({ packSource, target, customer }) {
  if (!fs.existsSync(target)) ensureDir(target);
  copyAgents(packSource, target);
  copyHooks(packSource, target);
  copySkills(packSource, target);
  copyIntelRefs(packSource, target);
  copyOverlay(packSource, target, customer);
  copyContractRegistry(packSource, target);
}

module.exports = {
  installPack,
  MANAGED_PATHS,
  IC_PACK_SKILL_NAMES,
  // exposed for unit tests:
  isIcPackAgent,
  isIcPackHook,
};
