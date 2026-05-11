'use strict';

const fs = require('fs');
const path = require('path');

const BASELINE_MIGRATION_ID = '2026-05-11-first-time-baseline-scan';

// Runtime install surfaces must stay aligned with:
// - docs/installer-migrations.md#runtime-configuration-contract-registry
// - docs/ARCHITECTURE.md#runtime-install-contract-matrix
//
// The registry rows are based on each runtime's upstream loader docs where
// available. Source-limited rows are intentionally conservative: scan generated
// files GSD materializes, but do not infer ownership of undocumented host config.
const RUNTIME_SURFACES = {
  claude: ['get-shit-done', 'commands/gsd', 'skills', 'agents', 'hooks', 'settings.json'],
  codex: ['get-shit-done', 'skills', 'agents', 'hooks', 'config.toml', 'hooks.json'],
  gemini: ['get-shit-done', 'commands/gsd', 'hooks'],
  opencode: ['get-shit-done', 'command', 'skills', 'agents'],
  kilo: ['get-shit-done', 'command', 'skills', 'agents'],
  copilot: ['get-shit-done', 'skills', 'agents'],
  antigravity: ['get-shit-done', 'skills', 'agents'],
  cursor: ['get-shit-done', 'skills', 'agents'],
  windsurf: ['get-shit-done', 'skills', 'agents', 'rules'],
  augment: ['get-shit-done', 'skills', 'agents'],
  trae: ['get-shit-done', 'skills', 'agents', 'rules'],
  qwen: ['get-shit-done', 'skills', 'agents'],
  hermes: ['get-shit-done', 'skills/gsd', 'agents'],
  cline: ['get-shit-done', 'skills', 'agents'],
  codebuddy: ['get-shit-done', 'skills', 'agents'],
};

const COMMON_SURFACES = ['get-shit-done', 'skills', 'agents', 'hooks'];
const INTERNAL_TOP_LEVEL_NAMES = new Set([
  'gsd-file-manifest.json',
  'gsd-install-state.json',
  'gsd-migration-backups',
  'gsd-migration-journal',
]);
const USER_OWNED_PATHS = new Set([
  'get-shit-done/USER-PROFILE.md',
  'commands/gsd/dev-preferences.md',
  'skills/gsd-dev-preferences/SKILL.md',
]);
let knownGeneratedAgentNames = null;

function normalizeRelPath(relPath) {
  return relPath.replace(/\\/g, '/').replace(/^\/+/, '');
}

function baselineInstallSurfaces(runtime) {
  if (runtime && RUNTIME_SURFACES[runtime]) return RUNTIME_SURFACES[runtime];
  return COMMON_SURFACES;
}

function walkFiles(root, relDir, files) {
  const dir = path.join(root, relDir);
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = path.posix.join(relDir, entry.name);
    if (relDir === '' && INTERNAL_TOP_LEVEL_NAMES.has(entry.name)) continue;
    const fullPath = path.join(root, relPath);
    if (entry.isDirectory()) {
      walkFiles(root, relPath, files);
    } else if (entry.isFile()) {
      files.add(normalizeRelPath(relPath));
    }
  }
}

function scanBaselineFiles(configDir, runtime) {
  const relPaths = new Set();
  for (const surface of baselineInstallSurfaces(runtime)) {
    const normalized = normalizeRelPath(surface);
    const fullPath = path.join(configDir, normalized);
    if (!fs.existsSync(fullPath)) continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkFiles(configDir, normalized, relPaths);
    } else if (stat.isFile() && !INTERNAL_TOP_LEVEL_NAMES.has(normalized)) {
      relPaths.add(normalized);
    }
  }
  return [...relPaths];
}

function isUserOwnedBaselinePath(relPath) {
  if (USER_OWNED_PATHS.has(relPath)) return true;
  const parts = relPath.split('/');
  if (parts[0] === 'skills' && parts[1] && !parts[1].startsWith('gsd-')) return true;
  if (parts[0] === 'agents' && parts[1] && !parts[1].startsWith('gsd-')) return true;
  return false;
}

function listKnownGeneratedAgentNames() {
  if (knownGeneratedAgentNames) return knownGeneratedAgentNames;

  knownGeneratedAgentNames = new Set();
  const agentsDir = path.resolve(__dirname, '..', '..', '..', '..', 'agents');
  try {
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.startsWith('gsd-') && entry.name.endsWith('.md')) {
        knownGeneratedAgentNames.add(entry.name.replace(/\.md$/, ''));
      }
    }
  } catch {
    // If the source agent directory is unavailable, fail closed and treat
    // GSD-looking agent files as user-choice artifacts.
  }

  return knownGeneratedAgentNames;
}

function isKnownGeneratedAgentPath(relPath, runtime) {
  const parts = relPath.split('/');
  if (parts.length !== 2 || parts[0] !== 'agents') return false;
  const fileName = parts[1];
  const extension = path.posix.extname(fileName);
  if (extension !== '.md' && !(runtime === 'codex' && extension === '.toml')) return false;

  const agentName = fileName.slice(0, -extension.length);
  return listKnownGeneratedAgentNames().has(agentName);
}

function isStaleGsdLookingPath(relPath) {
  const baseName = path.posix.basename(relPath);
  if (/^gsd[-_]/.test(baseName)) return true;
  const parts = relPath.split('/');
  if ((parts[0] === 'skills' || parts[0] === 'agents') && parts[1] && parts[1].startsWith('gsd-')) {
    return true;
  }
  return false;
}

function baselineActionRank(action) {
  if (action.type === 'record-baseline') return 0;
  if (action.type === 'baseline-preserve-user') return 1;
  return 2;
}

module.exports = {
  id: BASELINE_MIGRATION_ID,
  title: 'Record first-time installer migration baseline',
  description: 'Classify existing install surfaces before destructive installer migrations run.',
  introducedIn: '1.50.0',
  scopes: ['global', 'local'],
  destructive: false,
  plan: ({ configDir, runtime, baselineScan, classifyArtifact }) => {
    if (!baselineScan) return [];

    const actions = [];
    for (const relPath of scanBaselineFiles(configDir, runtime)) {
      // docs/installer-migrations.md#baseline-preserve-user keeps user-owned
      // artifacts out of destructive migration flow; classify later only when
      // ownership is not already known.
      if (isUserOwnedBaselinePath(relPath)) {
        actions.push({
          type: 'baseline-preserve-user',
          relPath,
          reason: 'known user-owned artifact preserved by first-time migration baseline',
          classification: 'user-owned',
          originalHash: null,
          currentHash: null,
        });
        continue;
      }

      const artifact = classifyArtifact(relPath);
      if (artifact.classification === 'managed-pristine' || artifact.classification === 'managed-modified') {
        actions.push({
          type: 'record-baseline',
          relPath,
          reason: 'existing manifest-managed file included in first-time migration baseline',
        });
        continue;
      }

      const currentHash = artifact.currentHash;
      if (isKnownGeneratedAgentPath(relPath, runtime)) {
        actions.push({
          type: 'record-baseline',
          relPath,
          reason: 'known installer-generated agent included in first-time migration baseline',
          classification: artifact.classification,
          originalHash: artifact.originalHash,
          currentHash,
        });
        continue;
      }

      if (isStaleGsdLookingPath(relPath)) {
        actions.push({
          type: 'prompt-user',
          relPath,
          reason: 'GSD-looking file is not proven manifest-managed and needs explicit user choice',
          classification: 'stale-gsd-looking',
          originalHash: artifact.originalHash,
          currentHash,
          prompt: 'Choose whether to remove this stale-looking GSD artifact or keep it as user-owned.',
          choices: ['keep', 'remove'],
        });
        continue;
      }

      actions.push({
        type: 'baseline-preserve-user',
        relPath,
        reason: 'unknown install-surface file preserved by first-time migration baseline',
        classification: artifact.classification,
        originalHash: artifact.originalHash,
        currentHash,
      });
    }

    return actions.sort((left, right) =>
      baselineActionRank(left) - baselineActionRank(right) || left.relPath.localeCompare(right.relPath)
    );
  },
};
