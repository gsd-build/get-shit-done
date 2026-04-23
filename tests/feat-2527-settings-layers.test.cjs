'use strict';

/**
 * Feature test for #2527 — /gsd-settings expands to 22 settings grouped into
 * six visual sections. Adds 8 new fields (pattern_mapper, tdd_mode, code_review,
 * code_review_depth, ui_review, commit_docs, intel.enabled, graphify.enabled)
 * and verifies each is present in the AskUserQuestion block, the update_config
 * step, the confirmation table, the ~/.gsd/defaults.json save step, and
 * VALID_CONFIG_KEYS.
 *
 * Closes: #2527
 */

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const SETTINGS_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'settings.md');
const { VALID_CONFIG_KEYS } = require('../get-shit-done/bin/lib/config-schema.cjs');

const NEW_FIELDS = [
  'workflow.pattern_mapper',
  'workflow.tdd_mode',
  'workflow.code_review',
  'workflow.code_review_depth',
  'workflow.ui_review',
  'commit_docs',
  'intel.enabled',
  'graphify.enabled',
];

const SECTION_HEADERS = ['Planning', 'Execution', 'Docs & Output', 'Features', 'Model & Pipeline', 'Misc'];

/**
 * Match a dotted config-key path inside a block of text. Falls back to a
 * simple substring check for single-segment keys; for nested keys, requires
 * each segment to appear in order within a bounded window so distinct fields
 * (e.g., intel.enabled vs graphify.enabled) cannot collapse to the same leaf.
 */
function hasPathLike(block, field) {
  const parts = field.split('.');
  if (parts.length === 1) return block.includes(parts[0]);
  const escaped = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(escaped.join('[\\s\\S]{0,600}'), 'i');
  return pattern.test(block);
}

describe('#2527: settings.md adds grouped settings layers', () => {
  let content;

  before(() => {
    content = fs.readFileSync(SETTINGS_PATH, 'utf-8');
  });

  describe('Acceptance: all 8 new fields present in AskUserQuestion block', () => {
    for (const field of NEW_FIELDS) {
      test(`settings.md mentions ${field}`, () => {
        assert.ok(
          content.includes(field),
          `settings.md must reference the config key "${field}" in its AskUserQuestion/update_config step`
        );
      });
    }
  });

  describe('Acceptance: section headers applied', () => {
    for (const section of SECTION_HEADERS) {
      test(`settings.md declares a "${section}" section header`, () => {
        // The convention for grouping AskUserQuestion items is a markdown section heading
        // of the form "### <Section>" inside the present_settings step.
        const heading = new RegExp(`^#{2,4}\\s+${section.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'm');
        assert.ok(
          heading.test(content),
          `settings.md must declare a "${section}" section header to group questions`
        );
      });
    }
  });

  describe('Acceptance: update_config step includes all new fields', () => {
    test('update_config step references every new field', () => {
      const updateMatch = content.match(/<step name="update_config">[\s\S]*?<\/step>/);
      assert.ok(updateMatch, 'settings.md must have an update_config step');
      const updateBlock = updateMatch[0];
      for (const field of NEW_FIELDS) {
        // Keys may appear as nested JSON (e.g., "pattern_mapper" under workflow).
        // Use hasPathLike so distinct dotted keys (e.g., intel.enabled,
        // graphify.enabled) cannot share a single "enabled" occurrence.
        assert.ok(
          hasPathLike(updateBlock, field),
          `update_config step must write "${field}"`
        );
      }
    });
  });

  describe('Acceptance: save_as_defaults step includes all new fields', () => {
    test('save_as_defaults step references every new field', () => {
      const defaultsMatch = content.match(/<step name="save_as_defaults">[\s\S]*?<\/step>/);
      assert.ok(defaultsMatch, 'settings.md must have a save_as_defaults step');
      const block = defaultsMatch[0];
      for (const field of NEW_FIELDS) {
        assert.ok(
          hasPathLike(block, field),
          `save_as_defaults step must persist "${field}" into ~/.gsd/defaults.json`
        );
      }
    });
  });

  describe('Acceptance: confirmation display includes all new fields', () => {
    test('confirm step table lists every new setting by name', () => {
      const confirmMatch = content.match(/<step name="confirm">[\s\S]*?<\/step>/);
      assert.ok(confirmMatch, 'settings.md must have a confirm step');
      const block = confirmMatch[0];
      const expectedLabels = [
        'Pattern Mapper',
        'TDD Mode',
        'Code Review',
        'Code Review Depth',
        'UI Review',
        'Commit Docs',
        'Intel',
        'Graphify',
      ];
      for (const label of expectedLabels) {
        assert.ok(
          block.includes(label),
          `confirm step table must display "${label}"`
        );
      }
    });
  });

  describe('Acceptance: all 8 new fields registered in VALID_CONFIG_KEYS', () => {
    for (const field of NEW_FIELDS) {
      test(`VALID_CONFIG_KEYS contains ${field}`, () => {
        assert.ok(
          VALID_CONFIG_KEYS.has(field),
          `${field} must be in VALID_CONFIG_KEYS so config-set accepts it`
        );
      });
    }
  });

  describe('Acceptance: code_review_depth is conditional on code_review=on', () => {
    test('settings.md documents conditional visibility for code_review_depth', () => {
      // Must explicitly note that code_review_depth only appears when code_review is on.
      const conditionalRegex = /code_review_depth[\s\S]{0,400}(only|conditional|when|if)[\s\S]{0,80}code_review/i;
      assert.ok(
        conditionalRegex.test(content) ||
          /code_review\s*=\s*on[\s\S]{0,400}code_[…]*depth/i.test(content),
        'settings.md must document that code_review_depth is only shown when code_review is on'
      );
    });
  });

  describe('Negative: settings.md constrains code_review_depth options', () => {
    test('settings.md restricts code_review_depth to a known option set', () => {
      // Depth accepts string values (quick|standard|deep). config-set does not
      // block arbitrary strings at the value level today; instead settings.md
      // constrains the AskUserQuestion options to the valid set so users
      // cannot pick "bogus" via the interactive flow.
      const depthOptionsRegex =
        /code_review_depth[\s\S]{0,800}(quick|standard|deep|surface)/i;
      assert.ok(
        depthOptionsRegex.test(content),
        'settings.md must constrain code_review_depth options to a known set'
      );
    });
  });

  describe('Negative: config-set rejects an unknown key path', () => {
    test('config-set workflow.code_review_bogus_key fails', (t) => {
      const tmpDir = createTempProject();
      t.after(() => cleanup(tmpDir));

      const bad = runGsdTools(['config-set', 'workflow.code_review_bogus_key', 'x'], tmpDir);
      assert.ok(!bad.success, 'config-set on an unknown key must fail');
    });
  });

  describe('Acceptance: all 6 section headers are used as header: field on first question in each section', () => {
    test('the header field appears for each section in the AskUserQuestion block', () => {
      // Map user-visible section names to the short `header:` strings used in AskUserQuestion.
      // settings.md uses abbreviated headers (max 12 chars). Verify at least one header
      // per section-intent appears on a question.
      const requiredHeaders = [
        /header:\s*"Model"/,           // Model & Pipeline opener
        /header:\s*"Research"/,        // Planning opener (first Planning-section question)
        /header:\s*"Pattern Mapper"|header:\s*"Patterns"/, // new Planning addition
        /header:\s*"Verifier"/,        // Execution existing
        /header:\s*"TDD"/,             // new Execution
        /header:\s*"Code Review"/,     // new Execution
        /header:\s*"UI Review"/,       // new Execution
        /header:\s*"Commit Docs"/,     // new Docs & Output
        /header:\s*"Intel"/,           // new Features
        /header:\s*"Graphify"/,        // new Features
      ];
      for (const re of requiredHeaders) {
        assert.ok(re.test(content), `settings.md must include an AskUserQuestion header matching ${re}`);
      }
    });
  });
});
