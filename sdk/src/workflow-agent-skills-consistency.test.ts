/**
 * Contract test: every `gsd-sdk query agent-skills <slug>` invocation in
 * `get-shit-done/workflows/**\/*.md` must reference a slug that exists as
 * `agents/<slug>.md` at the repository root.
 *
 * A mismatch produces a silent no-op at runtime — the SDK returns `""` for an
 * unknown key, and the workflow interpolates the empty string into the spawn
 * prompt, so any `agent_skills.<correct-slug>` configuration in
 * `.planning/config.json` is silently ignored. This test prevents regression.
 *
 * Related: https://github.com/gsd-build/get-shit-done/issues/2615
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');
const workflowsDir = join(repoRoot, 'get-shit-done', 'workflows');
const agentsDir = join(repoRoot, 'agents');

const QUERY_KEY_PATTERN = /agent-skills\s+([a-z][a-z0-9-]*)/g;

interface QueryUsage {
  readonly file: string;
  readonly line: number;
  readonly slug: string;
}

function walkMarkdown(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkMarkdown(full));
    } else if (entry.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function collectAgentSlugs(dir: string): Set<string> {
  return new Set(
    readdirSync(dir)
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.replace(/\.md$/, '')),
  );
}

function collectQueryUsages(files: readonly string[]): QueryUsage[] {
  const usages: QueryUsage[] = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, idx) => {
      for (const match of line.matchAll(QUERY_KEY_PATTERN)) {
        usages.push({ file, line: idx + 1, slug: match[1]! });
      }
    });
  }
  return usages;
}

describe('workflow agent-skills query consistency', () => {
  it('every `agent-skills <slug>` query refers to an existing `agents/<slug>.md`', () => {
    const validSlugs = collectAgentSlugs(agentsDir);
    const workflowFiles = walkMarkdown(workflowsDir);
    const usages = collectQueryUsages(workflowFiles);
    const invalid = usages.filter((u) => !validSlugs.has(u.slug));

    const report = invalid
      .map((u) => `  ${relative(repoRoot, u.file)}:${u.line} — unknown slug '${u.slug}'`)
      .join('\n');

    expect(
      invalid,
      invalid.length
        ? `Found ${invalid.length} agent-skills query keys with no matching agents/<slug>.md:\n${report}`
        : '',
    ).toHaveLength(0);
  });
});
