'use strict';

/**
 * For every `agents/gsd-*.md`, assert its agent name appears as a row
 * in docs/INVENTORY.md's Agents table. AGENTS.md card presence is NOT
 * enforced — that file is allowed to be a curated subset (primary
 * cards + advanced stubs).
 *
 * Related: docs readiness refresh, lane-12 recommendation.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const AGENTS_DIR = path.join(ROOT, 'agents');
const INVENTORY_MD = fs.readFileSync(path.join(ROOT, 'docs', 'INVENTORY.md'), 'utf8');

const agentFiles = fs
  .readdirSync(AGENTS_DIR)
  .filter((f) => /^gsd-.*\.md$/.test(f));

function mentionedInInventoryAgents(name) {
  // Row form in the Agents table: `| agent-name | role | ... |`
  // The Agents table uses the raw name (no code fence) in column 1.
  const rowRe = new RegExp(`^\\|\\s*${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*\\|`, 'm');
  return rowRe.test(INVENTORY_MD);
}

describe('every shipped agent has a row in INVENTORY.md', () => {
  for (const file of agentFiles) {
    const name = file.replace(/\.md$/, '');
    test(name, () => {
      assert.ok(
        mentionedInInventoryAgents(name),
        `agents/${file} has no row in docs/INVENTORY.md Agents table — add one`,
      );
    });
  }
});
