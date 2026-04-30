/**
 * Structural validation tests for Phase 4 create-sme command and workflow.
 *
 * Tests verify static structure of markdown files -- not runtime behavior.
 * All tests read files from the repo root using absolute paths.
 *
 * Requirements covered:
 *   CMD-01 -- Command file exists with correct name and workflow reference
 *   CMD-02 -- Workflow queries sme.list and uses AskUserQuestion for process selection
 *   CMD-03 -- Workflow checks for existing SME and presents update/create choice
 *   CMD-04 -- Workflow displays progress banners and spawns gsd-sme-creator
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── File paths (absolute from repo root) ────────────────────────────────────

// The SDK lives at <repo>/sdk; the command/workflow definitions are at <repo>/commands/ and <repo>/get-shit-done/
// import.meta.dirname = <repo>/sdk/src/agents → up 3 levels = <repo>
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');
const COMMAND_PATH = resolve(REPO_ROOT, 'commands', 'gsd', 'create-sme.md');
const WORKFLOW_PATH = resolve(REPO_ROOT, 'get-shit-done', 'workflows', 'create-sme.md');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readAgent(path: string): string {
  return readFileSync(path, 'utf-8');
}

function countOccurrences(content: string, needle: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = content.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

// ─── CMD-01: Command file structure ──────────────────────────────────────────

describe('CMD-01: command file structure', () => {
  let command: string;

  // Load once, share across tests in this describe block
  beforeAll(() => {
    command = readAgent(COMMAND_PATH);
  });

  it('command has name: gsd:create-sme in frontmatter', () => {
    const nameLine = command
      .split('\n')
      .find((line) => line.startsWith('name:'));
    expect(nameLine).toBeDefined();
    expect(nameLine!.trim()).toBe('name: gsd:create-sme');
  });

  it('command references create-sme.md workflow', () => {
    expect(command).toContain('workflows/create-sme.md');
  });

  it('command has AskUserQuestion in allowed-tools', () => {
    expect(command).toContain('AskUserQuestion');
  });

  it('command has Task in allowed-tools', () => {
    expect(command).toContain('Task');
  });

  it('command passes $ARGUMENTS to workflow context', () => {
    expect(command).toContain('$ARGUMENTS');
  });
});

// ─── CMD-02: Workflow interactive menu ───────────────────────────────────────

describe('CMD-02: workflow interactive menu', () => {
  let workflow: string;

  beforeAll(() => {
    workflow = readAgent(WORKFLOW_PATH);
  });

  it('workflow queries sme.list for process discovery', () => {
    expect(workflow).toContain('sme.list');
  });

  it('workflow uses AskUserQuestion for process selection', () => {
    expect(workflow).toContain('AskUserQuestion');
  });

  it('workflow has text-mode fallback', () => {
    expect(workflow).toContain('TEXT_MODE');
  });

  it('workflow checks text_mode from init or --text flag', () => {
    expect(workflow).toContain('--text');
  });
});

// ─── CMD-03: Existing SME detection ──────────────────────────────────────────

describe('CMD-03: existing SME detection', () => {
  let workflow: string;

  beforeAll(() => {
    workflow = readAgent(WORKFLOW_PATH);
  });

  it('workflow checks for existing SME file before creation', () => {
    expect(workflow).toMatch(/-SME\.md/);
  });

  it('workflow presents update choice when SME exists', () => {
    expect(workflow).toMatch(/[Uu]pdate/);
    expect(workflow).toMatch(/[Cc]reate/);
  });

  it('workflow includes cancel option', () => {
    expect(workflow).toMatch(/[Cc]ancel/);
  });
});

// ─── CMD-04: Progress indicators and creator spawning ────────────────────────

describe('CMD-04: progress indicators and creator spawning', () => {
  let workflow: string;

  beforeAll(() => {
    workflow = readAgent(WORKFLOW_PATH);
  });

  it('workflow displays ASCII banner before spawning', () => {
    expect(workflow).toContain('━━━');
  });

  it('workflow uses gsd-sme-creator as subagent_type', () => {
    expect(workflow).toContain('subagent_type="gsd-sme-creator"');
  });

  it('workflow shows progress text before Task call', () => {
    expect(workflow).toMatch(/◆ Spawning/);
  });

  it('workflow handles SME Creation Complete return marker', () => {
    expect(workflow).toContain('SME Creation Complete');
  });

  it('workflow validates process name against safe regex', () => {
    expect(workflow).toMatch(/\[a-zA-Z0-9_-\]/);
  });

  it('workflow creates .planning/smes directory', () => {
    expect(workflow).toContain('mkdir -p .planning/smes');
  });
});
