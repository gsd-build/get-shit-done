'use strict';

/**
 * Post-install path audit for workflow-invoked scripts (#2995).
 *
 * Walks workflowsDir, extracts every `${GSD_HOME[...]}/<path>.<cjs|js|sh>`
 * token, and asserts:
 *   1. the file exists in the repo at that <path> (catches typos)
 *   2. <path>'s first segment is in installedPrefixes (catches the
 *      #2994 class: source-vs-deployed-path mismatches)
 *
 * Pure function over (workflowsDir, repoRoot, installedPrefixes); no
 * filesystem mutation. Tests assert on the typed AUDIT_FINDING enum.
 */

const fs = require('node:fs');
const path = require('node:path');

const AUDIT_FINDING = Object.freeze({
  MISSING_FROM_REPO: 'missing_from_repo',
  NOT_INSTALLED: 'not_installed',
});

// Match `${GSD_HOME}` or `${GSD_HOME:-...}` followed by a /-rooted path
// ending in .cjs/.js/.sh. The path is captured verbatim (relative to
// the install root).
const REF_RE = /\$\{GSD_HOME(?::-[^}]*)?\}\/([A-Za-z0-9_./-]+\.(?:cjs|js|sh))/g;

function listWorkflowFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => path.join(dir, e.name));
}

function extractReferences(content) {
  const out = [];
  let m;
  // RegExp objects with /g state must be reset per call.
  const re = new RegExp(REF_RE.source, 'g');
  while ((m = re.exec(content)) !== null) {
    out.push(m[1]);
  }
  return out;
}

function auditWorkflowScriptPaths({ workflowsDir, repoRoot, installedPrefixes }) {
  const findings = [];
  const installedSet = new Set(installedPrefixes);
  for (const file of listWorkflowFiles(workflowsDir)) {
    const content = fs.readFileSync(file, 'utf8');
    const workflow = path.basename(file);
    for (const ref of extractReferences(content)) {
      const firstSegment = ref.split('/')[0];
      // #2996 CR: emit BOTH findings simultaneously when a reference is
      // both outside an installed prefix AND missing from the repo. The
      // earlier `continue` short-circuited MISSING_FROM_REPO, so a
      // developer who moved a missing reference to an installed prefix
      // would only discover the second issue on a subsequent CI run.
      if (!installedSet.has(firstSegment)) {
        findings.push({ workflow, path: ref, kind: AUDIT_FINDING.NOT_INSTALLED });
      }
      const sourceFile = path.join(repoRoot, ref);
      if (!fs.existsSync(sourceFile)) {
        findings.push({ workflow, path: ref, kind: AUDIT_FINDING.MISSING_FROM_REPO });
      }
    }
  }
  return { ok: findings.length === 0, findings };
}

module.exports = { auditWorkflowScriptPaths, AUDIT_FINDING, extractReferences };
