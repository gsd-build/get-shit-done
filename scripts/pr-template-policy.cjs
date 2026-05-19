#!/usr/bin/env node

const { matchesGlob } = require('path');

const TRUSTED_AUTHOR_ASSOCIATIONS = new Set([
  'CONTRIBUTOR',
  'COLLABORATOR',
  'MEMBER',
  'OWNER',
]);

const DEFAULT_TEMPLATE_MARKERS = [
  'Wrong template',
  'Every PR must use a typed template',
  'Select the template that matches your PR',
];

/**
 * Glob patterns for files that are considered CI/tooling/docs scope.
 * If ALL changed files in a PR match at least one of these patterns,
 * template enforcement is skipped automatically.
 */
const TOOLING_PATH_ALLOWLIST = [
  '.github/**',
  'scripts/**',
  'docs/**',
  '*.md',
  '.changeset/**',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'Pipfile',
  'Pipfile.lock',
  'requirements.txt',
  'requirements*.txt',
  'poetry.lock',
  'Gemfile',
  'Gemfile.lock',
  'go.sum',
  'go.mod',
];

/**
 * Matches an explicit PR-template exemption marker of the form:
 *   <!-- pr-template-exempt: <non-empty reason> -->
 *
 * Capture group 1 is the reason (trimmed). Empty/whitespace-only reasons
 * do NOT match because the pattern requires at least one non-whitespace
 * character in the captured body.
 */
const EXEMPT_MARKER_REGEX = /<!--\s*pr-template-exempt:\s*([\s\S]*?\S)\s*-->/;

const TEMPLATES = [
  {
    name: 'fix',
    heading: 'Fix PR',
    requiredHeadings: [
      'Fix PR',
      'Linked Issue',
      'What was broken',
      'What this fix does',
      'Testing',
      'Checklist',
    ],
  },
  {
    name: 'enhancement',
    heading: 'Enhancement PR',
    requiredHeadings: [
      'Enhancement PR',
      'Linked Issue',
      'What this enhancement improves',
      'Before / After',
      'How it was implemented',
      'Testing',
      'Scope confirmation',
      'Checklist',
    ],
  },
  {
    name: 'feature',
    heading: 'Feature PR',
    requiredHeadings: [
      'Feature PR',
      'Linked Issue',
      'Feature summary',
      'What changed',
      'Implementation notes',
      'Spec compliance',
      'Testing',
      'Scope confirmation',
      'Checklist',
    ],
  },
];

function stripMarkdownDecoration(value) {
  return value
    .replace(/^\s*#+\s*/, '')
    .replace(/\s*#+\s*$/, '')
    .replace(/\*\*/g, '')
    .trim()
    .toLowerCase();
}

function extractHeadings(body) {
  const headings = new Set();
  for (const line of String(body || '').split(/\r?\n/)) {
    if (/^\s*#{1,6}\s+\S/.test(line)) {
      headings.add(stripMarkdownDecoration(line));
    }
  }
  return headings;
}

function includesDefaultTemplate(body) {
  const text = String(body || '').toLowerCase();
  return DEFAULT_TEMPLATE_MARKERS.some((marker) => text.includes(marker.toLowerCase()));
}

function matchingTemplate(body) {
  const headings = extractHeadings(body);
  for (const template of TEMPLATES) {
    if (!headings.has(stripMarkdownDecoration(template.heading))) continue;
    const missingHeadings = template.requiredHeadings.filter((heading) => {
      return !headings.has(stripMarkdownDecoration(heading));
    });
    return {
      template: template.name,
      missingHeadings,
    };
  }
  return {
    template: null,
    missingHeadings: [],
  };
}

/**
 * Returns true iff every path in changedFiles matches at least one glob
 * pattern in the allowlist. Returns false for an empty file list (no
 * files means we cannot confirm it is a tooling-only PR).
 */
function allPathsAreTooling(changedFiles, allowlist) {
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) return false;
  return changedFiles.every((file) =>
    allowlist.some((pattern) => matchesGlob(file, pattern)),
  );
}

/**
 * Returns true iff the body contains an explicit exemption marker with a
 * non-empty (non-whitespace) reason.
 */
function hasExemptMarker(body, regex) {
  const match = regex.exec(String(body || ''));
  if (!match) return false;
  return match[1].trim().length > 0;
}

function evaluatePrTemplate(body, authorAssociation, changedFiles) {
  const association = String(authorAssociation || '').toUpperCase();
  const trusted = TRUSTED_AUTHOR_ASSOCIATIONS.has(association);
  const normalizedBody = String(body || '').trim();

  // --- Carve-out 1: all changed files are in the tooling allowlist ---
  if (allPathsAreTooling(changedFiles, TOOLING_PATH_ALLOWLIST)) {
    return {
      valid: true,
      action: 'pass',
      trusted,
      authorAssociation: association || 'UNKNOWN',
      template: null,
      reason: null,
      missingHeadings: [],
      skipped: 'tooling-paths',
    };
  }

  // --- Carve-out 2: explicit exemption marker in the PR body ---
  if (hasExemptMarker(normalizedBody, EXEMPT_MARKER_REGEX)) {
    return {
      valid: true,
      action: 'pass',
      trusted,
      authorAssociation: association || 'UNKNOWN',
      template: null,
      reason: null,
      missingHeadings: [],
      skipped: 'exempt-marker',
    };
  }

  let valid = true;
  let reason = 'PR body uses a typed pull request template.';
  let template = null;
  let missingHeadings = [];

  if (!normalizedBody) {
    valid = false;
    reason = 'PR body is empty; a typed pull request template is required.';
  } else {
    const match = matchingTemplate(normalizedBody);
    template = match.template;
    missingHeadings = match.missingHeadings;
    if (template && missingHeadings.length === 0) {
      valid = true;
    } else if (template && missingHeadings.length > 0) {
      valid = false;
      reason = `PR body appears to use the ${template} template but is missing required headings.`;
    } else if (includesDefaultTemplate(normalizedBody)) {
      valid = false;
      reason = 'PR body still contains the default wrong-template guidance.';
    } else {
      valid = false;
      reason = 'PR body does not match the fix, enhancement, or feature template.';
    }
  }

  let action = 'pass';
  if (!valid) {
    action = trusted ? 'warn' : 'close';
  }

  return {
    valid,
    action,
    trusted,
    authorAssociation: association || 'UNKNOWN',
    template,
    reason,
    missingHeadings,
  };
}

function main() {
  const changedFiles = process.env.CHANGED_FILES
    ? process.env.CHANGED_FILES.split('\n').map((f) => f.trim()).filter(Boolean)
    : undefined;
  const result = evaluatePrTemplate(
    process.env.PR_BODY || '',
    process.env.AUTHOR_ASSOCIATION || '',
    changedFiles,
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (process.env.GITHUB_OUTPUT) {
    const fs = require('fs');
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `result=${JSON.stringify(result)}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `action=${result.action}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `valid=${result.valid ? 'true' : 'false'}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  evaluatePrTemplate,
  extractHeadings,
  includesDefaultTemplate,
  matchingTemplate,
  allPathsAreTooling,
  hasExemptMarker,
  TOOLING_PATH_ALLOWLIST,
  EXEMPT_MARKER_REGEX,
};
