/**
 * Bug #2559: Stale document references in Research phase
 *
 * The gsd-phase-researcher and gsd-project-researcher agents instruct
 * WebSearch queries to always include "current year" (or a hardcoded
 * year). This biases results toward stale dated content as time passes
 * (e.g., a 2024 query run in 2026 returns stale results).
 *
 * Fix: Remove year-injection instructions from research agent
 * WebSearch guidance so searches return current results.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PHASE_RESEARCHER = path.join(
  __dirname,
  '..',
  'agents',
  'gsd-phase-researcher.md'
);
const PROJECT_RESEARCHER = path.join(
  __dirname,
  '..',
  'agents',
  'gsd-project-researcher.md'
);

const FILES = [
  { label: 'gsd-phase-researcher.md', path: PHASE_RESEARCHER },
  { label: 'gsd-project-researcher.md', path: PROJECT_RESEARCHER },
];

describe('research agents do not inject year into web searches (#2559)', () => {
  for (const { label, path: filePath } of FILES) {
    test(`${label} contains no CURRENT_YEAR placeholder`, () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      assert.ok(
        !/CURRENT_YEAR/.test(content),
        `${label} must not contain CURRENT_YEAR placeholder (causes stale-year injection)`
      );
    });

    test(`${label} contains no hardcoded year in web search instructions`, () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const match = content.match(/\b20(2[3-9]|[3-9]\d)\b/);
      assert.ok(
        !match,
        `${label} must not contain hardcoded year (found "${match && match[0]}") — biases searches toward stale content`
      );
    });

    test(`${label} does not instruct searches to include year or current year`, () => {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Match phrases like "include current year", "year in searches",
      // "[current year]", "with year", etc.
      const patterns = [
        /include\s+(?:the\s+)?current\s+year/i,
        /current\s+year/i,
        /year\s+in\s+(?:searches|queries)/i,
        /\[current year\]/i,
      ];
      for (const pat of patterns) {
        assert.ok(
          !pat.test(content),
          `${label} must not instruct year injection (matched /${pat.source}/)`
        );
      }
    });
  }
});
