'use strict';

/**
 * Tests for bug #3706: UI safety gate false-positives on phases whose ROADMAP
 * entry contains 'Requirements', 'overview', 'performance', etc.
 *
 * Root cause: grep -iE "UI|..." has no word-boundary anchoring.
 * 'UI' substring-matches 'Req**ui**rements'; 'view' matches 'overview';
 * 'form' matches 'performance', 'platform', 'transform'.
 *
 * Fix: replace unanchored alternation with:
 *   (^|[^[:alnum:]])(UI|...tokens...)([^[:alnum:]]|$)
 * This is portable POSIX ERE (works on BSD grep/macOS and GNU grep).
 *
 * Strategy: extract the grep pattern from the workflow files and re-implement
 * the same match logic in JS for fast, portable, shell-free testing.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PLAN_PHASE_PATH = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'plan-phase.md'
);
const AUTONOMOUS_PATH = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'autonomous.md'
);

/**
 * Parse the UI gate grep pattern out of a workflow markdown file.
 *
 * Looks for the line:
 *   echo "$PHASE_SECTION" | grep -iE "PATTERN" > /dev/null 2>&1
 *
 * Returns the raw pattern string (contents of the double-quoted grep argument),
 * or null if not found.
 */
function extractUiGateRegexPattern(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Match: grep -iE "..." (capturing the quoted pattern)
  const match = content.match(/grep\s+-iE\s+"([^"]+)"\s+>/);
  return match ? match[1] : null;
}

/**
 * Convert a POSIX ERE pattern string (as used in grep -iE) into a JS RegExp.
 *
 * POSIX ERE alternation and character classes translate directly.
 * The key transformation: POSIX [^[:alnum:]] → JS [^a-zA-Z0-9]
 * The anchors ^ and $ are the same in both.
 *
 * Returns a case-insensitive JS RegExp, or null if pattern is null.
 */
function posixEreToJsRegex(erePattern) {
  if (!erePattern) return null;
  // Translate POSIX character class [:alnum:] to JS equivalent
  const jsPattern = erePattern.replace(/\[:alnum:\]/g, 'a-zA-Z0-9');
  return new RegExp(jsPattern, 'i');
}

/**
 * Simulate the HAS_UI shell gate: returns 0 (match found) or 1 (no match),
 * mirroring grep exit code semantics.
 *
 * Works line-by-line to replicate grep's per-line matching behaviour.
 */
function hasUiGate(regex, phaseSection) {
  if (!regex) return 1;
  const lines = phaseSection.split('\n');
  return lines.some(line => regex.test(line)) ? 0 : 1;
}

// ─── Shared test matrix ──────────────────────────────────────────────────────

/**
 * Run the full behavioral test matrix against a given workflow file.
 * Called once for plan-phase.md and once for autonomous.md.
 */
function runBehavioralTests(workflowPath, workflowLabel) {
  describe(`${workflowLabel} — UI gate regex`, () => {
    test(`${workflowLabel} exists`, () => {
      assert.ok(fs.existsSync(workflowPath), `${workflowLabel} must exist at ${workflowPath}`);
    });

    // allow-test-rule: source-text-is-the-product
    // The UI safety gate is a grep command embedded in a markdown workflow file.
    // The workflow files are prose-as-code: the grep command IS the production artifact.
    // This test guards the structural contract that the gate uses word-boundary anchoring.
    // A behavioral test alone cannot catch a regression where the correct gate is deleted
    // and replaced with an unanchored one that happens to produce correct results on the
    // test corpus. The structural check and behavioral checks are complementary here.
    test('UI gate must use word-boundary anchoring — NOT plain -iE alternation', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      // Assert the extracted pattern contains the boundary anchors, not just any pattern.
      // This verifies the structural contract of the fix without grepping for absence of the
      // old pattern (which would be pure source-grep theatre on the negative space).
      assert.ok(
        raw !== null,
        `${workflowLabel}: must contain a UI gate grep pattern`
      );
      assert.ok(
        raw.includes('[^[:alnum:]]'),
        `${workflowLabel}: UI gate pattern must use [^[:alnum:]] word-boundary anchors. ` +
        `Got: ${raw}. Unanchored "UI|..." causes false-positives (bug #3706).`
      );
    });

    // ── False-positive tests (must NOT match) ──────────────────────────────

    test('"Requirements" standard roadmap field must NOT trigger UI gate (bug #3706)', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      // Pure backend prose: contains "Requirements" (triggering false-positive via "ui" substring)
      // but zero genuine frontend tokens as standalone words.
      const phaseSection =
        '**Requirements**: The service must expose REST endpoints for authentication.\n' +
        'All work is server-side. Database migrations and API contract only.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 1,
        `"Requirements" must not match the UI gate in ${workflowLabel}. ` +
        `Pattern in use: ${raw}`
      );
    });

    test('"overview" in prose must NOT trigger UI gate ("view" is a substring)', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      const phaseSection = 'Overview of the data pipeline architecture and backend services.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 1,
        `"overview" must not match the UI gate in ${workflowLabel}.`
      );
    });

    test('"performance" must NOT trigger UI gate ("form" is a substring)', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      const phaseSection = 'Performance testing and benchmark analysis for the API layer.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 1,
        `"performance" must not match the UI gate in ${workflowLabel}.`
      );
    });

    test('"platform" must NOT trigger UI gate ("form" is a substring)', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      const phaseSection = 'Deploy to the cloud platform and configure CI/CD.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 1,
        `"platform" must not match the UI gate in ${workflowLabel}.`
      );
    });

    test('"transform" must NOT trigger UI gate ("form" is a substring)', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      const phaseSection = 'Transform raw event data and write to the warehouse.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 1,
        `"transform" must not match the UI gate in ${workflowLabel}.`
      );
    });

    test('"review" must NOT trigger UI gate ("view" is a substring)', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      const phaseSection = 'Code review checklist and PR approval workflow for the API.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 1,
        `"review" must not match the UI gate in ${workflowLabel}.`
      );
    });

    test('"build" must NOT trigger UI gate ("ui" at positions 2-3 of "build")', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      const phaseSection = 'Build the backend service and run integration tests.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 1,
        `"build" must not match the UI gate in ${workflowLabel}.`
      );
    });

    // ── True-positive tests (must match) ──────────────────────────────────

    test('phase with standalone "UI" token DOES trigger UI gate', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      const phaseSection = 'UI Refactor: migrate all screens to the new design system.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 0,
        `standalone "UI" must match the UI gate in ${workflowLabel}.`
      );
    });

    test('phase with standalone "view" token DOES trigger UI gate', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      const phaseSection = 'Implement the user profile view controller and associated screen.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 0,
        `standalone "view" must match the UI gate in ${workflowLabel}.`
      );
    });

    test('phase with standalone "form" token DOES trigger UI gate', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      const phaseSection = 'Build a sign-up form with client-side validation.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 0,
        `standalone "form" must match the UI gate in ${workflowLabel}.`
      );
    });

    test('phase with "dashboard" DOES trigger UI gate', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      const phaseSection = 'Build the analytics dashboard and navigation component.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 0,
        `"dashboard" and "component" must match the UI gate in ${workflowLabel}.`
      );
    });

    test('case-insensitive: lowercase "ui" token DOES trigger UI gate', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      const phaseSection = 'Redesign the ui for mobile responsiveness.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 0,
        `lowercase "ui" must match the UI gate in ${workflowLabel} (case-insensitive).`
      );
    });

    test('hyphenated "non-UI" DOES trigger UI gate (hyphen is a word boundary)', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      // Phase section contains ONLY the hyphenated form; no standalone "UI" token.
      // Verifies the boundary detection fires on hyphen, not on a trivially-bounded bare word.
      const phaseSection = 'This is a non-UI backend service with no visual elements.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 0,
        `"non-UI" hyphenated form must match the UI gate in ${workflowLabel} ` +
        '(hyphen is [^[:alnum:]], so "UI" is word-bounded).'
      );
    });

    test('phase with standalone "screen" token DOES trigger UI gate', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      const phaseSection = 'Implement the loading screen and splash animation.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 0,
        `standalone "screen" must match the UI gate in ${workflowLabel}.`
      );
    });

    test('"screening" must NOT trigger UI gate ("screen" is a substring)', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      const phaseSection = 'Implement candidate screening criteria for the hiring pipeline.';
      assert.strictEqual(
        hasUiGate(regex, phaseSection), 1,
        `"screening" must not match the UI gate in ${workflowLabel} — "screen" is a substring.`
      );
    });

    test('empty input does NOT trigger UI gate', () => {
      const raw = extractUiGateRegexPattern(workflowPath);
      const regex = posixEreToJsRegex(raw);
      assert.strictEqual(
        hasUiGate(regex, ''), 1,
        `empty phase section must not trigger the UI gate in ${workflowLabel}.`
      );
    });
  });
}

// Run behavioral tests for both workflow files
runBehavioralTests(PLAN_PHASE_PATH, 'plan-phase.md');
runBehavioralTests(AUTONOMOUS_PATH, 'autonomous.md');
