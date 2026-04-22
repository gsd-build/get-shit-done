/**
 * Read-only subprocess golden rows: SDK `registry.dispatch` vs `gsd-tools.cjs` JSON on stdout.
 * Imported by `read-only-parity.integration.test.ts` and `golden-policy.ts` coverage accounting.
 */

export type JsonParityRow = {
  canonical: string;
  sdkArgs: string[];
  cjs: string;
  cjsArgs: string[];
};

/** Repo-relative fixtures (cwd = get-shit-done repo root). */
export const GOLDEN_PLAN = '.planning/phases/09-foundation-and-test-infrastructure/09-01-PLAN.md';

/**
 * Strict `toEqual` JSON parity rows verified on this repository.
 * (Expand as more handlers are aligned with `gsd-tools.cjs`.)
 */
export const READ_ONLY_JSON_PARITY_ROWS: JsonParityRow[] = [
  { canonical: 'resolve-model', sdkArgs: ['gsd-planner'], cjs: 'resolve-model', cjsArgs: ['gsd-planner'] },
  { canonical: 'phase-plan-index', sdkArgs: ['9'], cjs: 'phase-plan-index', cjsArgs: ['9'] },
  { canonical: 'roadmap.get-phase', sdkArgs: ['9'], cjs: 'roadmap', cjsArgs: ['get-phase', '9'] },
  { canonical: 'list.todos', sdkArgs: [], cjs: 'list-todos', cjsArgs: [] },
  { canonical: 'phase.next-decimal', sdkArgs: ['9'], cjs: 'phase', cjsArgs: ['next-decimal', '9'] },
  { canonical: 'phases.list', sdkArgs: [], cjs: 'phases', cjsArgs: ['list'] },
  { canonical: 'verify.summary', sdkArgs: [GOLDEN_PLAN], cjs: 'verify-summary', cjsArgs: [GOLDEN_PLAN] },
  { canonical: 'verify.path-exists', sdkArgs: ['.planning/STATE.md'], cjs: 'verify-path-exists', cjsArgs: ['.planning/STATE.md'] },
  { canonical: 'verify.artifacts', sdkArgs: [GOLDEN_PLAN], cjs: 'verify', cjsArgs: ['artifacts', GOLDEN_PLAN] },
  { canonical: 'websearch', sdkArgs: ['typescript', '--limit', '1'], cjs: 'websearch', cjsArgs: ['typescript', '--limit', '1'] },
  { canonical: 'workstream.get', sdkArgs: ['default'], cjs: 'workstream', cjsArgs: ['get', 'default'] },
  { canonical: 'workstream.list', sdkArgs: [], cjs: 'workstream', cjsArgs: ['list'] },
  { canonical: 'workstream.status', sdkArgs: ['default'], cjs: 'workstream', cjsArgs: ['status', 'default'] },
  { canonical: 'learnings.list', sdkArgs: [], cjs: 'learnings', cjsArgs: ['list'] },
  { canonical: 'intel.status', sdkArgs: [], cjs: 'intel', cjsArgs: ['status'] },
  { canonical: 'intel.diff', sdkArgs: [], cjs: 'intel', cjsArgs: ['diff'] },
  { canonical: 'intel.validate', sdkArgs: [], cjs: 'intel', cjsArgs: ['validate'] },
  { canonical: 'intel.query', sdkArgs: ['gsd'], cjs: 'intel', cjsArgs: ['query', 'gsd'] },
  {
    canonical: 'intel.extract-exports',
    sdkArgs: ['sdk/src/query/utils.ts'],
    cjs: 'intel',
    cjsArgs: ['extract-exports', 'sdk/src/query/utils.ts'],
  },
  { canonical: 'init.list-workspaces', sdkArgs: [], cjs: 'init', cjsArgs: ['list-workspaces'] },
  { canonical: 'agent-skills', sdkArgs: [], cjs: 'agent-skills', cjsArgs: [] },
  { canonical: 'scan-sessions', sdkArgs: ['--json'], cjs: 'scan-sessions', cjsArgs: ['--json'] },
  { canonical: 'stats.json', sdkArgs: [], cjs: 'stats', cjsArgs: ['json'] },
  { canonical: 'todo.match-phase', sdkArgs: ['9'], cjs: 'todo', cjsArgs: ['match-phase', '9'] },
  { canonical: 'verify.key-links', sdkArgs: [GOLDEN_PLAN], cjs: 'verify', cjsArgs: ['key-links', GOLDEN_PLAN] },
  { canonical: 'verify.schema-drift', sdkArgs: ['9'], cjs: 'verify', cjsArgs: ['schema-drift', '9'] },
  { canonical: 'state-snapshot', sdkArgs: [], cjs: 'state-snapshot', cjsArgs: [] },

  { canonical: 'history.digest', sdkArgs: [], cjs: 'history-digest', cjsArgs: [] },
  { canonical: 'audit-uat', sdkArgs: [], cjs: 'audit-uat', cjsArgs: [] },
  { canonical: 'skill-manifest', sdkArgs: [], cjs: 'skill-manifest', cjsArgs: [] },
  { canonical: 'validate.agents', sdkArgs: [], cjs: 'validate', cjsArgs: ['agents'] },
  {
    canonical: 'uat.render-checkpoint',
    sdkArgs: ['--file', 'sdk/src/golden/fixtures/uat-render-checkpoint-sample.md'],
    cjs: 'uat',
    cjsArgs: ['render-checkpoint', '--file', 'sdk/src/golden/fixtures/uat-render-checkpoint-sample.md'],
  },
];

/** Canonicals from JSON rows plus special-case subprocess tests in read-only-parity integration. */
export function readOnlyGoldenCanonicals(): Set<string> {
  const s = new Set<string>(READ_ONLY_JSON_PARITY_ROWS.map((r) => r.canonical));
  s.add('verify.commits');
  s.add('config-path');
  s.add('state.json');
  s.add('state.load');
  s.add('audit-open');
  s.add('state.get');
  s.add('summary.extract');
  return s;
}
