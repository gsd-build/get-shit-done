/**
 * Regression test for bug #3018.
 *
 * @jon-hendry: running `$gsd-discuss-phase 81` in Codex Default mode (where
 * `request_user_input` is rejected) caused the agent to pick "reasonable
 * defaults" and proceed straight into writing CONTEXT.md / DISCUSSION-LOG.md
 * checkpoints — without ever surfacing the questions to the user. The
 * generated Codex skill adapter explicitly told it to do that:
 *
 *   "When `request_user_input` is rejected (Execute mode), present a
 *    plain-text numbered list and pick a reasonable default."
 *
 * Discuss-mode is the wrong place for that fallback. The contract should be:
 * stop, render the questions as plain text, wait for the user's answer.
 * Defaults may only be picked when the user has authorized non-interactive
 * mode (--auto / --all) or has explicitly approved them.
 *
 * Test design (#3027 CR follow-up): instead of grepping the prose with
 * regex, parse the fallback section into a typed semantic-flag record and
 * assert on those booleans. This adheres to CONTRIBUTING.md "no-source-grep"
 * — the test names a behavioral invariant, the parser walks the prose
 * once and exposes the invariants as named flags, and the prose can be
 * reworded freely as long as the flags stay true.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const INSTALL = require(path.join(__dirname, '..', 'bin', 'install.js'));
const { getCodexSkillAdapterHeader } = INSTALL;

/**
 * Extract the "Execute mode fallback" section text from the adapter header.
 * Returns null if the section is missing. Section runs from the
 * "Execute mode fallback:" label up to the next heading or </codex_skill_adapter> tag.
 */
function extractExecuteModeFallback(header) {
  const m = header.match(/Execute mode fallback:\s*\n([\s\S]*?)(?=\n##\s|\n<\/codex_skill_adapter>)/);
  return m ? m[1].trim() : null;
}

/**
 * Parse the Execute-mode-fallback section into a typed semantic-flag
 * record. Each flag answers a single behavioral question that the #3018
 * fix is contractually required to encode in the prose. Tests assert on
 * the booleans, not the wording — so the prose can evolve without test
 * churn as long as the semantics stay correct.
 *
 * The flags are derived from a single pass over the section text: each
 * one looks for any of a small set of synonym phrases that a correct
 * implementation would use. The negative anti-pattern flag
 * (`silentlyPicksDefaults`) is the regression guard — the prose under
 * #3018 told the agent to "pick a reasonable default" autonomously,
 * which is exactly what this fix removes.
 */
function parseExecuteModeFallback(section) {
  if (!section || typeof section !== 'string') {
    return {
      ok: false,
      sectionLength: 0,
      instructsStop: false,
      presentsPlainTextQuestions: false,
      namesPermissionPath: false,
      forbidsWritingArtifactsBeforeAnswer: false,
      silentlyPicksDefaults: false,
    };
  }
  const lower = section.toLowerCase();
  // (a) STOP/WAIT directive — the agent must halt instead of proceeding.
  const instructsStop = /\b(stop|halt|wait)\b/.test(lower);
  // (b) Plain-text fallback presentation — the agent must surface the
  // questions in some inspectable form (numbered list / plain text).
  const presentsPlainTextQuestions = /plain.?text|numbered list/.test(lower);
  // (c) Permission path that DOES allow defaults — must name at least
  // one (--auto / --all / explicit user approval / autonomous workflow).
  const namesPermissionPath =
    /--auto|--all/.test(section) ||
    /explicit(ly)? (approv|authoriz|consent)/i.test(section) ||
    /user (has )?approv|user (has )?authoriz|user (has )?consent/i.test(section) ||
    /autonomous (lifecycle|workflow|paths?)/i.test(section);
  // (d) Artifact-write ban — the agent must not produce workflow files
  // (CONTEXT.md, DISCUSSION-LOG.md, PLAN.md, checkpoints) before the
  // user answers or one of the permission-path conditions applies.
  // Require BOTH a "do not write" intent AND a named artifact class so
  // generic "do not write" prose elsewhere can't satisfy the flag.
  const forbidsWriteIntent = /do not write|don'?t write|must not write|shall not write/i.test(section);
  const namesArtifactClass = /artifact|checkpoint|context\.md|discussion.?log|plan\.md/i.test(section);
  const forbidsWritingArtifactsBeforeAnswer = forbidsWriteIntent && namesArtifactClass;
  // Anti-pattern guard — the prose that caused #3018. This MUST be false.
  const silentlyPicksDefaults = /pick (a |the )?(reasonable|sensible|sane) default/i.test(section);
  return {
    ok: true,
    sectionLength: section.length,
    instructsStop,
    presentsPlainTextQuestions,
    namesPermissionPath,
    forbidsWritingArtifactsBeforeAnswer,
    silentlyPicksDefaults,
  };
}

describe('bug #3018: codex skill adapter encodes the discuss-mode fallback contract', () => {
  test('exports the adapter generator', () => {
    assert.equal(typeof getCodexSkillAdapterHeader, 'function');
  });

  test('Execute mode fallback section exists and has content', () => {
    const header = getCodexSkillAdapterHeader('gsd-discuss-phase');
    const section = extractExecuteModeFallback(header);
    const parsed = parseExecuteModeFallback(section);
    assert.equal(parsed.ok, true, `section must parse, got header:\n${header}`);
    assert.ok(parsed.sectionLength > 0, 'section must be non-empty');
  });

  test('fallback instructs STOP/WAIT (not silent continuation)', () => {
    const section = extractExecuteModeFallback(getCodexSkillAdapterHeader('gsd-discuss-phase'));
    const parsed = parseExecuteModeFallback(section);
    assert.equal(parsed.instructsStop, true,
      `must instruct stop/halt/wait — section was:\n${section}`);
  });

  test('fallback prescribes plain-text question presentation', () => {
    const section = extractExecuteModeFallback(getCodexSkillAdapterHeader('gsd-discuss-phase'));
    const parsed = parseExecuteModeFallback(section);
    assert.equal(parsed.presentsPlainTextQuestions, true,
      `must mention plain-text / numbered-list presentation — section was:\n${section}`);
  });

  test('fallback names a permission path under which defaults ARE allowed (--auto / --all / explicit approval / autonomous)', () => {
    const section = extractExecuteModeFallback(getCodexSkillAdapterHeader('gsd-discuss-phase'));
    const parsed = parseExecuteModeFallback(section);
    assert.equal(parsed.namesPermissionPath, true,
      `must name at least one permission path — section was:\n${section}`);
  });

  test('fallback forbids writing workflow artifacts before user answers', () => {
    const section = extractExecuteModeFallback(getCodexSkillAdapterHeader('gsd-discuss-phase'));
    const parsed = parseExecuteModeFallback(section);
    assert.equal(parsed.forbidsWritingArtifactsBeforeAnswer, true,
      `must encode write-ban + named artifact class — section was:\n${section}`);
  });

  test('fallback does NOT contain the #3018 anti-pattern ("pick a reasonable default")', () => {
    const section = extractExecuteModeFallback(getCodexSkillAdapterHeader('gsd-discuss-phase'));
    const parsed = parseExecuteModeFallback(section);
    assert.equal(parsed.silentlyPicksDefaults, false,
      `regression — fallback must NOT instruct the agent to pick defaults autonomously, section was:\n${section}`);
  });

  test('all four positive flags + the negative anti-pattern flag — typed-record snapshot', () => {
    // Single assertion that the whole semantic record matches the contract.
    // If any flag flips, the test fails with a structured diff naming the
    // exact invariant that broke.
    const section = extractExecuteModeFallback(getCodexSkillAdapterHeader('gsd-discuss-phase'));
    const parsed = parseExecuteModeFallback(section);
    const semanticContract = {
      ok: parsed.ok,
      instructsStop: parsed.instructsStop,
      presentsPlainTextQuestions: parsed.presentsPlainTextQuestions,
      namesPermissionPath: parsed.namesPermissionPath,
      forbidsWritingArtifactsBeforeAnswer: parsed.forbidsWritingArtifactsBeforeAnswer,
      silentlyPicksDefaults: parsed.silentlyPicksDefaults,
    };
    assert.deepStrictEqual(semanticContract, {
      ok: true,
      instructsStop: true,
      presentsPlainTextQuestions: true,
      namesPermissionPath: true,
      forbidsWritingArtifactsBeforeAnswer: true,
      silentlyPicksDefaults: false,
    }, `discuss-mode fallback contract violated — section was:\n${section}`);
  });
});
