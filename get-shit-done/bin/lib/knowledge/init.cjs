/**
 * Knowledge Layer — Initialization
 * Creates the .planning/knowledge/ directory structure with schema-compliant
 * JSON and Markdown files. Safe to call repeatedly — never overwrites.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { VERSION } = require('./constants.cjs');
const { knowledgeDir, safeJsonWrite, ensureDir, isoNow } = require('./utils.cjs');

function initKnowledge(cwd) {
  const kd = knowledgeDir(cwd);
  const now = isoNow();
  const created = [];

  const dirs = [
    '', 'modules', 'decisions', 'bugs', 'patterns', 'testing',
    'performance', 'observations', 'assumptions',
  ];
  for (const d of dirs) ensureDir(path.join(kd, d));

  const jsonFiles = {
    'INDEX.json': {
      version: VERSION, last_mapped_commit: '0000000', last_updated: now,
      stats: { total_files: 0, total_modules: 0, total_patterns: 0, total_exports: 0, total_dependencies: 0 },
      modules: {}, files: {}, patterns: {},
    },
    'DEPENDENCIES.json': {
      version: VERSION, last_updated: now,
      forward: {}, reverse: {}, module_deps: {}, circular: [],
    },
    'decisions/REGISTRY.json': {
      version: VERSION, last_updated: now,
      stats: { total: 0, active: 0, superseded: 0, deprecated: 0 },
      decisions: [],
    },
    'bugs/REGISTRY.json': {
      version: VERSION, last_updated: now,
      stats: { total: 0, open: 0, resolved: 0, critical_open: 0 },
      bugs: [],
    },
    'bugs/HOT-SPOTS.json': {
      version: VERSION, last_updated: now,
      threshold: 2, spots: [],
    },
    'patterns/CATALOG.json': {
      version: VERSION, last_updated: now,
      stats: { total: 0, structural: 0, behavioral: 0, other: 0 },
      patterns: [],
    },
    'testing/COVERAGE-MAP.json': {
      version: VERSION, last_updated: now,
      target_coverage: 80,
      overall: { statements: 0, branches: 0, functions: 0, lines: 0 },
      coverage: [],
    },
    'testing/MISSING-TESTS.json': {
      version: VERSION, last_updated: now, gaps: [],
    },
    'performance/BASELINES.json': {
      version: VERSION, last_updated: now, metrics: [],
    },
    'assumptions/REGISTRY.json': {
      version: VERSION, last_updated: now,
      stats: { total: 0, established: 0, working: 0, open: 0 },
      assumptions: [],
    },
  };

  for (const [rel, data] of Object.entries(jsonFiles)) {
    const fp = path.join(kd, rel);
    ensureDir(path.dirname(fp));
    if (!fs.existsSync(fp)) {
      safeJsonWrite(fp, data);
      created.push(rel);
    }
  }

  const mdFiles = {
    'CONVENTIONS.md': `# Project Conventions\n\n> Auto-maintained by GSD Knowledge Engine | Last updated: ${now}\n\n## Coding Conventions\n\n_No conventions recorded yet._\n\n## Naming Conventions\n\n_No conventions recorded yet._\n\n## File Organization\n\n_No conventions recorded yet._\n\n## Testing Conventions\n\n_No conventions recorded yet._\n`,
  };

  for (const [rel, content] of Object.entries(mdFiles)) {
    const fp = path.join(kd, rel);
    ensureDir(path.dirname(fp));
    if (!fs.existsSync(fp)) {
      fs.writeFileSync(fp, content, 'utf-8');
      created.push(rel);
    }
  }

  return {
    ok: true,
    knowledge_dir: kd,
    created,
    message: created.length ? 'Knowledge layer initialized' : 'Already initialized',
  };
}

module.exports = { initKnowledge };
