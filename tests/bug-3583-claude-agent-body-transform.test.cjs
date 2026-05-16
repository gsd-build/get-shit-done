'use strict';

// allow-test-rule: structural-regression-guard

/**
 * Claude/Qwen/Hermes agent-body slash-namespace transform (#3583, agent surface).
 *
 * Companion to the SKILL.md body fix tracked in #3583. The source repo authors
 * agent prose with the canonical colon form `/gsd:<cmd>` (enforced by the
 * #3443 invariant), but since #2808 all GSD agents/skills register under the
 * hyphen `name:` form, so the colon namespace is unroutable on those installs.
 * The Claude/default (and Qwen/Hermes) branch of the agent write loop in
 * bin/install.js previously copied agent bodies verbatim, leaking the dead
 * colon form into ~/.claude/agents/gsd-*.md.
 *
 * Invariants enforced here:
 *   1. transformColonToHyphen rewrites known colon commands, with the same
 *      word-boundary / roster discipline as the forward transform, and is a
 *      no-op on already-hyphenated input and unknown identifiers.
 *   2. Applied to real agent source, no roster `/gsd:<cmd>` survives.
 *   3. bin/install.js wires the transform into the agent write loop, gated so
 *      Gemini (intentionally colon-namespaced) is never rewritten.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const {
  transformColonToHyphen,
  readCmdNames,
} = require(path.join(ROOT, 'scripts', 'fix-slash-commands.cjs'));

const cmdNames = readCmdNames();

describe('transformColonToHyphen — agent-body inverse (#3583)', () => {
  test('roster is non-empty and includes the symptom commands', () => {
    assert.ok(cmdNames.length > 0, 'command roster must be populated');
    assert.ok(cmdNames.includes('execute-phase'));
    assert.ok(cmdNames.includes('plan-phase'));
  });

  test('rewrites /gsd:<cmd> to /gsd-<cmd> (slash preserved)', () => {
    const out = transformColonToHyphen('re-run /gsd:plan-phase --research-phase 3', cmdNames);
    assert.equal(out, 're-run /gsd-plan-phase --research-phase 3');
  });

  test('rewrites the bare gsd:<cmd> shorthand too', () => {
    const out = transformColonToHyphen('Spawned by the gsd:execute-phase orchestrator.', cmdNames);
    assert.equal(out, 'Spawned by the gsd-execute-phase orchestrator.');
  });

  test('rewrites backtick-wrapped references (real agent prose shape)', () => {
    const out = transformColonToHyphen('Spawned by `/gsd:plan-phase` orchestrator', cmdNames);
    assert.equal(out, 'Spawned by `/gsd-plan-phase` orchestrator');
  });

  test('multiple occurrences in one pass', () => {
    const out = transformColonToHyphen('/gsd:discuss-phase then /gsd:plan-phase then /gsd:execute-phase', cmdNames);
    assert.ok(!/\/gsd:[a-z]/.test(out), `no colon form may remain: ${out}`);
    assert.ok(out.includes('/gsd-discuss-phase') && out.includes('/gsd-execute-phase'));
  });

  test('idempotent on already-hyphenated input', () => {
    const input = 'use /gsd-plan-phase next';
    assert.equal(transformColonToHyphen(input, cmdNames), input);
  });

  test('word boundary — does not rewrite /gsd:plan-phase-extra', () => {
    assert.equal(transformColonToHyphen('/gsd:plan-phase-extra', cmdNames), '/gsd:plan-phase-extra');
  });

  test('word-char lookbehind leaves identifier-embedded mygsd:plan-phase untouched', () => {
    const input = 'the mygsd:plan-phase token is not a command';
    assert.equal(transformColonToHyphen(input, cmdNames), input);
  });

  test('unknown identifier left untouched (roster-checked)', () => {
    const input = 'the gsd:not-a-real-command token';
    assert.equal(transformColonToHyphen(input, cmdNames), input);
  });

  test('empty roster short-circuits (no stray rewrite)', () => {
    const input = 'run /gsd:plan-phase';
    assert.equal(transformColonToHyphen(input, []), input);
  });
});

describe('real agent source efficacy (#3583)', () => {
  test('no roster /gsd:<cmd> survives transform of agents/gsd-executor.md', () => {
    const src = fs.readFileSync(path.join(ROOT, 'agents', 'gsd-executor.md'), 'utf-8');
    assert.ok(/\/gsd:plan-phase|gsd:execute-phase/.test(src),
      'fixture precondition: source agent must contain colon references to be meaningful');
    const out = transformColonToHyphen(src, cmdNames);
    const roster = new RegExp(`(?<![a-zA-Z0-9_-])gsd:(${[...cmdNames].sort((a, b) => b.length - a.length).join('|')})(?=[^a-zA-Z0-9_-]|$)`);
    assert.ok(!roster.test(out),
      'no known-command colon reference may remain after the install-time transform');
  });

  test('every gsd-*.md agent transforms clean (roster colon refs fully eliminated)', () => {
    const agentsDir = path.join(ROOT, 'agents');
    const roster = new RegExp(`(?<![a-zA-Z0-9_-])gsd:(${[...cmdNames].sort((a, b) => b.length - a.length).join('|')})(?=[^a-zA-Z0-9_-]|$)`);
    const offenders = [];
    for (const f of fs.readdirSync(agentsDir)) {
      if (!f.startsWith('gsd-') || !f.endsWith('.md')) continue;
      const out = transformColonToHyphen(fs.readFileSync(path.join(agentsDir, f), 'utf-8'), cmdNames);
      if (roster.test(out)) offenders.push(f);
    }
    assert.deepEqual(offenders, [],
      `agents still carrying roster colon refs post-transform: ${offenders.join(', ')}`);
  });
});

describe('bin/install.js wires the agent-loop transform (#3583)', () => {
  const installSrc = fs.readFileSync(path.join(ROOT, 'bin', 'install.js'), 'utf-8');

  test('imports transformColonToHyphen from the shared module', () => {
    assert.ok(
      /transformColonToHyphen,?\s*\n?\s*}\s*=\s*require\(['"]\.\.\/scripts\/fix-slash-commands\.cjs['"]\)/.test(installSrc) ||
      /require\(['"]\.\.\/scripts\/fix-slash-commands\.cjs['"]\)/.test(installSrc) && installSrc.includes('transformColonToHyphen'),
      'install.js must import transformColonToHyphen from scripts/fix-slash-commands.cjs',
    );
  });

  test('agent write loop applies the transform before writing the agent file', () => {
    const writeIdx = installSrc.indexOf("fs.writeFileSync(path.join(agentsDest, destName)");
    assert.ok(writeIdx > 0, 'agent write site must exist');
    const window = installSrc.slice(Math.max(0, writeIdx - 1200), writeIdx);
    assert.ok(
      window.includes('transformColonToHyphen(content'),
      'transformColonToHyphen must be applied to agent content just before the agent file is written',
    );
    assert.ok(
      window.includes('isHyphenNameAgentRuntime'),
      'the agent-loop transform must be gated by the hyphen-name-runtime predicate',
    );
  });

  test('gate excludes Gemini (its slash commands are intentionally colon-namespaced)', () => {
    const gateMatch = installSrc.match(/const isHyphenNameAgentRuntime\s*=\s*([\s\S]*?);/);
    assert.ok(gateMatch, 'isHyphenNameAgentRuntime predicate must be defined');
    assert.ok(
      /!isGemini\b/.test(gateMatch[1]),
      'Gemini must be excluded from the hyphen rewrite — regression guard against breaking its colon namespace',
    );
    assert.ok(
      /!isCopilot\b/.test(gateMatch[1]) && /!isCodex\b/.test(gateMatch[1]),
      'runtimes with their own command-namespace adapters must be excluded to avoid double conversion',
    );
  });
});
