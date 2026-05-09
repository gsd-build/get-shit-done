// allow-test-rule: source-text-is-the-product
'use strict';

/**
 * For every `commands/gsd/*.md`, assert its `/gsd-<name>` slash command
 * appears either (a) as a `### /gsd-...` heading in docs/COMMANDS.md or
 * (b) as a row in docs/INVENTORY.md's Commands table. At least one of
 * these must be true so every shipped command is reachable from docs.
 *
 * The slug is derived from the `name:` frontmatter field (e.g. `gsd-workflow`)
 * rather than the filename (e.g. `ns-workflow.md`), so the test stays aligned
 * with the actual deployed command token even when the file has a legacy name.
 *
 * Related: docs readiness refresh, lane-12 recommendation.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(ROOT, 'commands', 'gsd');
const COMMANDS_MD = fs.readFileSync(path.join(ROOT, 'docs', 'COMMANDS.md'), 'utf8');
const INVENTORY_MD = fs.readFileSync(path.join(ROOT, 'docs', 'INVENTORY.md'), 'utf8');

const commandFiles = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith('.md'));

/**
 * Extract the slug from the `name:` frontmatter field.
 * Accepts both `gsd:slug` and `gsd-slug` forms.
 * Returns the slug portion only (e.g. `workflow`, `plan-phase`).
 * Throws if frontmatter is missing or malformed.
 */
function parseSlugFromFrontmatter(content, filePath) {
  // allow-test-rule: validating YAML frontmatter delimiter structure, not application source
  if (!content.startsWith('---')) {
    throw new Error('commands-doc-parity: missing YAML frontmatter in ' + filePath);
  }
  const closingIdx = content.indexOf('\n---', 3);
  if (closingIdx < 0) {
    throw new Error('commands-doc-parity: unclosed YAML frontmatter in ' + filePath);
  }
  const frontmatter = content.slice(0, closingIdx);
  const nameMatch = frontmatter.match(/^name:\s*"?(gsd[:-])([a-z0-9][a-z0-9-]*)"?\s*$/m);
  if (!nameMatch) {
    throw new Error('commands-doc-parity: could not extract slug from name: field in ' + filePath);
  }
  return nameMatch[2];
}

function mentionedInCommandsDoc(slug) {
  // Match a heading like: ### /gsd-<slug>  or  ## /gsd-<slug>
  const headingRe = new RegExp(`^#{2,4}\\s+\\\`?/gsd-${slug}\\\`?(?:[\\s(]|$)`, 'm');
  return headingRe.test(COMMANDS_MD);
}

function mentionedInInventory(slug) {
  // Match a row like: | `/gsd-<slug>` | ... |
  const rowRe = new RegExp(`\\|\\s*\\\`/gsd-${slug}\\\`\\s*\\|`, 'm');
  return rowRe.test(INVENTORY_MD);
}

describe('every shipped command is documented somewhere', () => {
  for (const file of commandFiles) {
    const filePath = path.join(COMMANDS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const slug = parseSlugFromFrontmatter(content, filePath);
    test(`/gsd-${slug}`, () => {
      const inCommandsDoc = mentionedInCommandsDoc(slug);
      const inInventory = mentionedInInventory(slug);
      assert.ok(
        inCommandsDoc || inInventory,
        `commands/gsd/${file} (name: gsd-${slug}) is not mentioned in docs/COMMANDS.md (as a heading) or docs/INVENTORY.md (as a Commands row) — add a one-line entry to at least one`,
      );
    });
  }
});
