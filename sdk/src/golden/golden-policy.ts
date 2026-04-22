/**
 * Golden parity policy — every canonical registry command must be either:
 * - Listed in `GOLDEN_PARITY_INTEGRATION_COVERED` (subprocess CJS check under `sdk/src/golden/*integration*.test.ts`), or
 * - Documented in `GOLDEN_PARITY_EXCEPTIONS` with a stable rationale (mirrored in QUERY-HANDLERS.md § Golden registry coverage matrix).
 */
import { QUERY_MUTATION_COMMANDS } from '../query/index.js';
import { getCanonicalRegistryCommands } from './registry-canonical-commands.js';
import { GOLDEN_INTEGRATION_MAIN_FILE_CANONICALS } from './golden-integration-covered.js';
import { GOLDEN_MUTATION_SUBPROCESS_COVERED } from './golden-mutation-covered.js';
import { readOnlyGoldenCanonicals } from './read-only-golden-rows.js';

/** True if this canonical command participates in mutation event wiring (see QUERY_MUTATION_COMMANDS). */
export function isMutationCanonicalCmd(canonical: string): boolean {
  const spaced = canonical.replace(/\./g, ' ');
  for (const m of QUERY_MUTATION_COMMANDS) {
    if (m === canonical || m === spaced) return true;
  }
  return false;
}

const MUTATION_DEFERRED_REASON =
  'Listed in QUERY_MUTATION_COMMANDS — mutates `.planning/`, git, or profile files. Subprocess golden vs gsd-tools.cjs is covered where a tmp fixture or `--dry-run` exists in golden.integration.test.ts; otherwise handler parity lives in sdk/src/query/*-mutation.test.ts, commit.test.ts, phase-lifecycle.test.ts, workstream.test.ts, intel.test.ts, profile.test.ts, template.test.ts, docs-init.ts, or uat.test.ts as applicable.';

/** Registry commands with no `gsd-tools.cjs` analogue — cannot have subprocess JSON parity. */
const NO_CJS_SUBPROCESS_REASON: Record<string, string> = {
  'phases.archive':
    'No `gsd-tools.cjs` command for `phases archive` (SDK-only). Covered in sdk/src/query/phase-lifecycle.test.ts.',
  'check.config-gates':
    'SDK-only decision-routing query (`.planning/research/decision-routing-audit.md` §3.3). Covered in sdk/src/query/config-gates.test.ts.',
  'check.phase-ready':
    'SDK-only decision-routing query (audit §3.4). Covered in sdk/src/query/phase-ready.test.ts.',
  'route.next-action':
    'SDK-only decision-routing query (audit §3.1). Covered in sdk/src/query/route-next-action.test.ts.',
  'check.auto-mode':
    'SDK-only decision-routing query (audit §3.5). Covered in sdk/src/query/check-auto-mode.test.ts.',
  'detect.phase-type':
    'SDK-only decision-routing query (audit §3.6). Covered in sdk/src/query/detect-phase-type.test.ts.',
  'check.completion':
    'SDK-only decision-routing query (audit §3.7). Covered in sdk/src/query/check-completion.test.ts.',
  'check.gates':
    'SDK-only decision-routing query (audit §3.2). Covered in sdk/src/query/check-gates.test.ts.',
  'check.verification-status':
    'SDK-only decision-routing query (audit §3.8). Covered in sdk/src/query/check-verification-status.test.ts.',
  'check.ship-ready':
    'SDK-only decision-routing query (audit §3.9). Covered in sdk/src/query/check-ship-ready.test.ts.',
  'phase.list-plans':
    'SDK-only listing helper for agents (no `gsd-tools.cjs` mirror). Covered in sdk/src/query/phase-list-queries.test.ts.',
  'phase.list-artifacts':
    'SDK-only artifact enumeration (no CJS mirror). Covered in sdk/src/query/phase-list-queries.test.ts.',
  'plan.task-structure':
    'SDK-only structured plan parse (no CJS mirror). Covered in sdk/src/query/plan-task-structure.test.ts.',
  'requirements.extract-from-plans':
    'SDK-only requirements aggregation (no CJS mirror). Covered in sdk/src/query/requirements-extract-from-plans.test.ts.',
};

const READ_HANDLER_ONLY_REASON = (cmd: string) =>
  `No ` +
  '`toEqual` subprocess row yet for this read-only command — handler parity is covered in sdk/src/query/*.test.ts / decomposed-handlers.test.ts; add `captureGsdToolsOutput` + `registry.dispatch` in sdk/src/golden/ when JSON shapes are aligned (see QUERY-HANDLERS.md § Golden registry coverage matrix). Command: `' +
  cmd +
  '`.';

function buildIntegrationCoveredSet(): Set<string> {
  return new Set<string>([
    ...GOLDEN_INTEGRATION_MAIN_FILE_CANONICALS,
    ...readOnlyGoldenCanonicals(),
    ...GOLDEN_MUTATION_SUBPROCESS_COVERED,
  ]);
}

/**
 * Canonical commands with an explicit subprocess JSON check vs gsd-tools.cjs
 * (golden.integration.test.ts + read-only-parity.integration.test.ts).
 */
export const GOLDEN_PARITY_INTEGRATION_COVERED = buildIntegrationCoveredSet();

export const GOLDEN_PARITY_EXCEPTIONS: Record<string, string> = buildGoldenParityExceptions();

function buildGoldenParityExceptions(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of getCanonicalRegistryCommands()) {
    if (GOLDEN_PARITY_INTEGRATION_COVERED.has(c)) continue;
    if (Object.prototype.hasOwnProperty.call(NO_CJS_SUBPROCESS_REASON, c)) {
      out[c] = NO_CJS_SUBPROCESS_REASON[c]!;
      continue;
    }
    if (isMutationCanonicalCmd(c)) {
      out[c] = MUTATION_DEFERRED_REASON;
    } else {
      out[c] = READ_HANDLER_ONLY_REASON(c);
    }
  }
  return out;
}

export function verifyGoldenPolicyComplete(): void {
  const canon = getCanonicalRegistryCommands();
  const missingException: string[] = [];
  for (const c of canon) {
    if (GOLDEN_PARITY_INTEGRATION_COVERED.has(c)) continue;
    if (!Object.prototype.hasOwnProperty.call(GOLDEN_PARITY_EXCEPTIONS, c)) missingException.push(c);
  }
  if (missingException.length) {
    throw new Error(`Missing GOLDEN_PARITY_EXCEPTIONS entry for:\n${missingException.join('\n')}`);
  }
  const stale: string[] = [];
  for (const c of GOLDEN_PARITY_INTEGRATION_COVERED) {
    if (!canon.includes(c)) stale.push(c);
  }
  if (stale.length) {
    throw new Error(`Stale GOLDEN_PARITY_INTEGRATION_COVERED entries:\n${stale.join('\n')}`);
  }
}
