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

/**
 * Matches a full `gsd-sdk query agent-skills <slug>` invocation and captures
 * the slug. Requires a token boundary before `gsd-sdk` and a word boundary
 * after the slug so that prose references (e.g. documentation mentioning the
 * string "agent-skills") do not produce false positives. The `\s+` between
 * tokens accepts newlines, so commands wrapped across lines still match.
 */
const QUERY_KEY_PATTERN = /\bgsd-sdk\s+query\s+agent-skills\s+([a-z][a-z0-9-]*)\b/g;

interface QueryUsage {
  readonly file: string;
  readonly line: number;
  readonly slug: string;
}

/** Recursively collects all `.md` file paths under `dir`. */
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

/** Returns the set of agent slugs defined by `<slug>.md` files in `dir`. */
function collectAgentSlugs(dir: string): Set<string> {
  return new Set(
    readdirSync(dir)
      .filter((name) => name.endsWith('.md'))
      .map((name) => name.replace(/\.md$/, '')),
  );
}

/**
 * Extracts every `gsd-sdk query agent-skills <slug>` usage from the given
 * markdown files. Runs the regex over each file's full content (not line by
 * line) so wrapped commands still match, then resolves the 1-based line number
 * from the match index.
 */
function collectQueryUsages(files: readonly string[]): QueryUsage[] {
  const usages: QueryUsage[] = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const match of content.matchAll(QUERY_KEY_PATTERN)) {
      const index = match.index ?? 0;
      const line = content.slice(0, index).split('\n').length;
      usages.push({ file, line, slug: match[1]! });
    }
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
