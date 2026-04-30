/**
 * Structural validation tests for Phase 5 SME auditor agent definition.
 *
 * Tests verify static structure of the agent markdown file and agent-contracts.md —
 * not runtime behavior. All tests read files from the repo root using absolute paths.
 *
 * Requirements covered:
 *   AUDIT-01 — Adversarial stance block with FORCE stance and "risks ARE present" language
 *   AUDIT-02 — Read-only mode: no Write/Edit in tools frontmatter, critical_rules states
 *              read-only constraint
 *   AUDIT-03 — Structured return markers ## SME_APPROVED and ## SME_CONCERNS with
 *              BLOCKER/WARNING/WATCH classification labels
 *   AUDIT-04 — Concrete mitigations requiring file paths and function calls in BLOCKER
 *              evidence; ADDRESSED defined as requiring specific file and function
 *   AUDIT-05 — Both markers registered in agent-contracts.md with gsd-sme-auditor entry
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── File paths (absolute from repo root) ────────────────────────────────────

// The SDK lives at <repo>/sdk; the agent definitions are at <repo>/agents/
// import.meta.dirname = <repo>/sdk/src/agents → up 3 levels = <repo>
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..');

const AUDITOR_PATH = resolve(REPO_ROOT, 'agents', 'gsd-sme-auditor.md');
const CONTRACTS_PATH = resolve(REPO_ROOT, 'get-shit-done', 'references', 'agent-contracts.md');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readAgent(path: string): string {
  return readFileSync(path, 'utf-8');
}

// ─── Top-level variables (loaded in beforeAll) ────────────────────────────────

let auditor: string;
let contracts: string;

beforeAll(() => {
  auditor = readAgent(AUDITOR_PATH);
  contracts = readAgent(CONTRACTS_PATH);
});

// ─── AUDIT-01: Adversarial stance ────────────────────────────────────────────

describe('AUDIT-01: adversarial stance', () => {
  it('has <adversarial_stance> block', () => {
    expect(auditor).toContain('<adversarial_stance>');
  });

  it('adversarial stance uses FORCE stance language', () => {
    expect(auditor).toContain('FORCE stance');
  });

  it('adversarial stance assumes risks are present', () => {
    expect(auditor).toMatch(/risks ARE present/);
  });
});

// ─── AUDIT-02: Read-only mode ─────────────────────────────────────────────────

describe('AUDIT-02: read-only mode', () => {
  it('tools frontmatter does not include Write', () => {
    const frontmatterMatch = auditor.match(/^---\n([\s\S]*?)\n---/);
    expect(frontmatterMatch).not.toBeNull();
    const frontmatter = frontmatterMatch![1];
    expect(frontmatter).not.toContain('Write');
  });

  it('tools frontmatter does not include Edit', () => {
    const frontmatterMatch = auditor.match(/^---\n([\s\S]*?)\n---/);
    expect(frontmatterMatch).not.toBeNull();
    const frontmatter = frontmatterMatch![1];
    expect(frontmatter).not.toContain('Edit');
  });

  it('critical_rules block states read-only constraint', () => {
    expect(auditor).toContain('<critical_rules>');
    expect(auditor).toMatch(/READ-ONLY|read-only|produce no file/i);
  });
});

// ─── AUDIT-03: Structured return markers ─────────────────────────────────────

describe('AUDIT-03: structured return markers', () => {
  it('defines ## SME_APPROVED marker', () => {
    expect(auditor).toContain('## SME_APPROVED');
  });

  it('defines ## SME_CONCERNS marker', () => {
    expect(auditor).toContain('## SME_CONCERNS');
  });

  it('output uses BLOCKER classification label', () => {
    expect(auditor).toContain('BLOCKER');
  });

  it('output uses WARNING classification label', () => {
    expect(auditor).toContain('WARNING');
  });

  it('output uses WATCH classification label', () => {
    expect(auditor).toContain('WATCH');
  });
});

// ─── AUDIT-04: Concrete mitigations with file paths and function calls ────────

describe('AUDIT-04: concrete mitigations with file paths and function calls', () => {
  it('requires file paths in BLOCKER evidence', () => {
    expect(auditor).toMatch(/file path|function call/i);
  });

  it('defines ADDRESSED as requiring specific file and function', () => {
    expect(auditor).toMatch(/ADDRESSED.*file path|file path.*ADDRESSED/is);
  });
});

// ─── AUDIT-05: Markers registered in agent-contracts.md ──────────────────────

describe('AUDIT-05: markers registered in agent-contracts.md', () => {
  it('agent-contracts.md contains gsd-sme-auditor entry', () => {
    expect(contracts).toContain('gsd-sme-auditor');
  });

  it('agent-contracts.md contains SME_APPROVED marker', () => {
    expect(contracts).toContain('SME_APPROVED');
  });

  it('agent-contracts.md contains SME_CONCERNS marker', () => {
    expect(contracts).toContain('SME_CONCERNS');
  });
});
