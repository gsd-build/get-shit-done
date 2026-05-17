'use strict';

// allow-test-rule: structural-regression-guard

/**
 * Claude/Qwen/Hermes agent-body slash-namespace transform (#3677).
 *
 * Agent-surface analogue of the SKILL.md body fix (#3583, merged via #3629)
 * and the user-facing emission fix (#3584, merged via #3606). The source repo
 * authors agent prose with the canonical colon form `/gsd:<cmd>` (enforced by
 * the #3443 invariant), but since #2808 all GSD agents/skills register under
 * the hyphen `name:` form, so the colon namespace is unroutable on those
 * installs. The Claude-default (and Qwen/Hermes) branch of the agent write
 * loop in bin/install.js copied agent bodies verbatim, leaking the dead colon
 * form into ~/.claude/agents/gsd-*.md.
 *
 * Invariants enforced here:
 *   1. transformContentToHyphen rewrites known colon commands with
 *      word-boundary / roster discipline, and is a no-op on already-hyphenated
 *      input and unknown identifiers.
 *   2. Applied to real agent source, no roster `/gsd:<cmd>` survives.
 *   3. bin/install.js wires the transform into the agent write loop, gated so
 *      Gemini (intentionally colon-namespaced) and the self-converting
 *      runtimes are never rewritten.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const {
  transformContentToHyphen,
  readCmdNames,
} = require(path.join(ROOT, 'scripts', 'fix-slash-commands.cjs'));

const cmdNames = readCmdNames();

describe('transformContentToHyphen — agent-body inverse (#3677)', () => {
  test('roster is non-empty and includes the symptom commands', () => {
    assert.ok(cmdNames.length > 0, 'command roster must be populated');
    assert.ok(cmdNames.includes('execute-phase'));
    assert.ok(cmdNames.includes('plan-phase'));
  });

  test('rewrites /gsd:<cmd> to /gsd-<cmd> (slash preserved)', () => {
    const out = transformContentToHyphen('re-run /gsd:plan-phase --research-phase 3', cmdNames);
    assert.equal(out, 're-run /gsd-plan-phase --research-phase 3');
  });

  test('rewrites the bare gsd:<cmd> shorthand too', () => {
    const out = transformContentToHyphen('Spawned by the gsd:execute-phase orchestrator.', cmdNames);
    assert.equal(out, 'Spawned by the gsd-execute-phase orchestrator.');
  });

  test('rewrites backtick-wrapped references (real agent prose shape)', () => {
    const out = transformContentToHyphen('Spawned by `/gsd:plan-phase` orchestrator', cmdNames);
    assert.equal(out, 'Spawned by `/gsd-plan-phase` orchestrator');
  });

  test('multiple occurrences in one pass', () => {
    const out = transformContentToHyphen('/gsd:discuss-phase then /gsd:plan-phase then /gsd:execute-phase', cmdNames);
    assert.ok(!/\/gsd:[a-z]/.test(out), `no colon form may remain: ${out}`);
    assert.ok(out.includes('/gsd-discuss-phase') && out.includes('/gsd-execute-phase'));
  });

  test('idempotent on already-hyphenated input', () => {
    const input = 'use /gsd-plan-phase next';
    assert.equal(transformContentToHyphen(input, cmdNames), input);
  });

  test('word boundary — does not rewrite /gsd:plan-phase-extra', () => {
    assert.equal(transformContentToHyphen('/gsd:plan-phase-extra', cmdNames), '/gsd:plan-phase-extra');
  });

  test('word-char lookbehind leaves identifier-embedded mygsd:plan-phase untouched', () => {
    const input = 'the mygsd:plan-phase token is not a command';
    assert.equal(transformContentToHyphen(input, cmdNames), input);
  });

  test('unknown identifier left untouched (roster-checked)', () => {
    const input = 'the gsd:not-a-real-command token';
    assert.equal(transformContentToHyphen(input, cmdNames), input);
  });

  test('empty roster short-circuits (no stray rewrite)', () => {
    const input = 'run /gsd:plan-phase';
    assert.equal(transformContentToHyphen(input, []), input);
  });
});

describe('real agent source efficacy (#3677)', () => {
  const roster = () => new RegExp(
    `(?<![a-zA-Z0-9_-])gsd:(${[...cmdNames].sort((a, b) => b.length - a.length).join('|')})(?=[^a-zA-Z0-9_-]|$)`,
  );

  test('no roster /gsd:<cmd> survives transform of agents/gsd-executor.md', () => {
    const src = fs.readFileSync(path.join(ROOT, 'agents', 'gsd-executor.md'), 'utf-8');
    assert.ok(/\/gsd:plan-phase|gsd:execute-phase/.test(src),
      'fixture precondition: source agent must contain colon references to be meaningful');
    const out = transformContentToHyphen(src, cmdNames);
    assert.ok(!roster().test(out),
      'no known-command colon reference may remain after the install-time transform');
  });

  test('every gsd-*.md agent transforms clean (roster colon refs fully eliminated)', () => {
    const agentsDir = path.join(ROOT, 'agents');
    const offenders = [];
    for (const f of fs.readdirSync(agentsDir)) {
      if (!f.startsWith('gsd-') || !f.endsWith('.md')) continue;
      const out = transformContentToHyphen(fs.readFileSync(path.join(agentsDir, f), 'utf-8'), cmdNames);
      if (roster().test(out)) offenders.push(f);
    }
    assert.deepEqual(offenders, [],
      `agents still carrying roster colon refs post-transform: ${offenders.join(', ')}`);
  });
});

describe('bin/install.js wires the agent-loop transform (#3677)', () => {
  const installSrc = fs.readFileSync(path.join(ROOT, 'bin', 'install.js'), 'utf-8');

  test('imports transformContentToHyphen from the shared module', () => {
    // Tolerate both require styles: a string-literal path
    // (require('../scripts/fix-slash-commands.cjs')) and the path.join form
    // (require(path.join(__dirname, '..', 'scripts', 'fix-slash-commands.cjs'))).
    const importMatch = installSrc.match(
      /const\s*\{[\s\S]*?\}\s*=\s*require\([\s\S]*?fix-slash-commands\.cjs[\s\S]*?\)/,
    );
    assert.ok(importMatch, 'install.js must require scripts/fix-slash-commands.cjs');
    assert.ok(
      /\btransformContentToHyphen\b/.test(importMatch[0]),
      'install.js must import transformContentToHyphen from the shared transformer module',
    );
  });

  test('agent write loop applies the transform before writing the agent file', () => {
    const writeIdx = installSrc.indexOf("fs.writeFileSync(path.join(agentsDest, destName)");
    assert.ok(writeIdx > 0, 'agent write site must exist');
    const window = installSrc.slice(Math.max(0, writeIdx - 1400), writeIdx);
    assert.ok(
      window.includes('transformContentToHyphen(content'),
      'transformContentToHyphen must be applied to agent content just before the agent file is written',
    );
    assert.ok(
      window.includes('isHyphenNameAgentRuntime'),
      'the agent-loop transform must be gated by the hyphen-name-runtime predicate',
    );
  });

  test('gate excludes Gemini and the self-converting runtimes', () => {
    const gateMatch = installSrc.match(/const isHyphenNameAgentRuntime\s*=\s*([\s\S]*?);/);
    assert.ok(gateMatch, 'isHyphenNameAgentRuntime predicate must be defined');
    assert.ok(
      /!isGemini\b/.test(gateMatch[1]),
      'Gemini must be excluded — regression guard against breaking its intentional colon namespace',
    );
    assert.ok(
      /!isCopilot\b/.test(gateMatch[1]) && /!isCodex\b/.test(gateMatch[1]),
      'runtimes with their own command-namespace adapters must be excluded to avoid double conversion',
    );
  });
});
