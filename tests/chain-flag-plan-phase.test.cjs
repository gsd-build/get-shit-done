/**
 * GSD Tools Tests - chain flag preservation in plan-phase
 *
 * Validates that plan-phase.md correctly handles the --chain flag
 * so that discuss→plan→execute auto-advance works without manual
 * intervention.
 *
 * Closes: #1620
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('plan-phase chain flag preservation (#1620)', () => {
  const planPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'plan-phase.md');
  const discussPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'discuss-phase.md');

  test('plan-phase sync-flag guard checks both --auto AND --chain', () => {
    const content = fs.readFileSync(planPath, 'utf8');
    // The guard that clears _auto_chain_active must require BOTH flags to be absent
    assert.ok(
      content.includes('if [[ ! "$ARGUMENTS" =~ --auto ]] && [[ ! "$ARGUMENTS" =~ --chain ]]; then'),
      'plan-phase should check for both --auto and --chain before clearing chain flag'
    );
  });

  test('plan-phase persists chain flag to config before auto-advancing', () => {
    const content = fs.readFileSync(planPath, 'utf8');
    // Plan-phase must persist the chain flag (config-set workflow._auto_chain_active true)
    assert.ok(
      content.includes('config-set workflow._auto_chain_active true'),
      'plan-phase should persist chain flag via config-set workflow._auto_chain_active true'
    );
  });

  test('plan-phase and discuss-phase use the same guard pattern for clearing _auto_chain_active', () => {
    const planContent = fs.readFileSync(planPath, 'utf8');
    const discussContent = fs.readFileSync(discussPath, 'utf8');

    const guardPattern = 'if [[ ! "$ARGUMENTS" =~ --auto ]] && [[ ! "$ARGUMENTS" =~ --chain ]]; then';

    assert.ok(
      planContent.includes(guardPattern),
      'plan-phase should use the dual-flag guard pattern'
    );
    assert.ok(
      discussContent.includes(guardPattern),
      'discuss-phase should use the dual-flag guard pattern'
    );
  });

  test('plan-phase auto-advance trigger includes --chain flag', () => {
    const content = fs.readFileSync(planPath, 'utf8');
    // The trigger condition should mention --chain alongside --auto
    assert.ok(
      content.includes('`--auto` or `--chain` flag present OR `AUTO_CHAIN` is true OR `AUTO_CFG` is true'),
      'plan-phase auto-advance trigger should check for --chain flag'
    );
  });

  test('plan-phase parses both --auto and --chain flags', () => {
    const content = fs.readFileSync(planPath, 'utf8');
    assert.ok(
      content.includes('Parse `--auto` and `--chain` flags from $ARGUMENTS'),
      'plan-phase step 15 should parse both --auto and --chain flags'
    );
  });
});
