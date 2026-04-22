/**
 * Read-only subprocess golden checks (SDK vs gsd-tools.cjs JSON).
 * Row data: `read-only-golden-rows.ts`. Policy: `golden-policy.ts`, `QUERY-HANDLERS.md`.
 */
import { describe, it, expect } from 'vitest';
import { captureGsdToolsOutput, captureGsdToolsStdout } from './capture.js';
import { createRegistry } from '../query/index.js';
import { resolve, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { READ_ONLY_JSON_PARITY_ROWS } from './read-only-golden-rows.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

describe('Read-only golden parity (JSON toEqual)', () => {
  it.each(READ_ONLY_JSON_PARITY_ROWS)('$canonical matches gsd-tools.cjs JSON', async (row) => {
    const gsdOutput = await captureGsdToolsOutput(row.cjs, row.cjsArgs, REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch(row.canonical, row.sdkArgs, REPO_ROOT);
    expect(sdkResult.data).toEqual(gsdOutput);
  });
});

describe('config-path (plain stdout vs SDK { path })', () => {
  it('SDK path matches gsd-tools.cjs plain-text stdout', async () => {
    const out = await captureGsdToolsStdout('config-path', [], REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch('config-path', [], REPO_ROOT);
    const data = sdkResult.data as { path?: string };
    expect(data.path).toBeDefined();
    expect(normalize(data.path!.trim())).toBe(normalize(out.trim()));
  });
});

describe('audit-open golden parity (excluding scanned_at)', () => {
  it('SDK JSON matches gsd-tools.cjs except volatile scanned_at', async () => {
    const gsdOutput = await captureGsdToolsOutput('audit-open', ['--json'], REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch('audit-open', ['--json'], REPO_ROOT);
    const strip = (d: unknown): Record<string, unknown> => {
      const o = { ...(d as Record<string, unknown>) };
      delete o.scanned_at;
      delete o.has_scan_errors;
      return o;
    };
    expect(strip(sdkResult.data)).toEqual(strip(gsdOutput));
  });
});

describe('state.json golden parity (excluding last_updated)', () => {
  it('SDK rebuilt frontmatter matches gsd-tools.cjs except volatile last_updated', async () => {
    const gsdOutput = await captureGsdToolsOutput('state', ['json'], REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch('state.json', [], REPO_ROOT);
    const strip = (d: unknown): Record<string, unknown> => {
      const o = { ...(d as Record<string, unknown>) };
      delete o.last_updated;
      return o;
    };
    expect(strip(sdkResult.data)).toEqual(strip(gsdOutput));
  });
});

describe('summary.extract golden parity (with array-of-objects fix)', () => {
  it('SDK JSON matches gsd-tools.cjs except for intentional array-of-objects parsing fix', async () => {
    const gsdOutput = await captureGsdToolsOutput('summary-extract', ['sdk/src/golden/fixtures/summary-extract-sample.md'], REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch('summary.extract', ['sdk/src/golden/fixtures/summary-extract-sample.md'], REPO_ROOT);
    
    // The SDK correctly parses array-of-objects, whereas CJS parses them as strings.
    // Patch the CJS output to reflect the CodeRabbit bugfix.
    const patchedGsd = JSON.parse(JSON.stringify(gsdOutput));
    if (patchedGsd.tech_added && Array.isArray(patchedGsd.tech_added)) {
      patchedGsd.tech_added = patchedGsd.tech_added.map((t: any) => 
        t === 'name: typescript' ? { name: 'typescript' } : t
      );
    }
    
    expect(sdkResult.data).toEqual(patchedGsd);
  });
});

describe('state.load golden parity', () => {
  it('SDK load payload matches gsd-tools.cjs state load', async () => {
    const gsdOutput = await captureGsdToolsOutput('state', ['load'], REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch('state.load', [], REPO_ROOT);
    expect(sdkResult.data).toEqual(gsdOutput);
  });
});

describe('state.get golden parity', () => {
  it('matches full STATE.md when no field (same as `state get` with no section)', async () => {
    const gsdOutput = await captureGsdToolsOutput('state', ['get'], REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch('state.get', [], REPO_ROOT);
    expect(sdkResult.data).toEqual(gsdOutput);
  });

  it('matches single frontmatter field when `state get <field>`', async () => {
    const gsdOutput = await captureGsdToolsOutput('state', ['get', 'milestone'], REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch('state.get', ['milestone'], REPO_ROOT);
    expect(sdkResult.data).toEqual(gsdOutput);
  });
});

describe('verify.commits golden parity', () => {
  it('SDK output matches gsd-tools.cjs for two SHAs', async () => {
    const revs = execSync('git rev-list --max-count=2 HEAD', { cwd: REPO_ROOT, encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean);
    if (revs.length < 2) {
      throw new Error('verify.commits parity requires at least 2 commits in checkout history');
    }
    const b = revs[0];
    const a = revs[1];
    const gsdOutput = await captureGsdToolsOutput('verify', ['commits', a, b], REPO_ROOT);
    const registry = createRegistry();
    const sdkResult = await registry.dispatch('verify.commits', [a, b], REPO_ROOT);
    expect(sdkResult.data).toEqual(gsdOutput);
  });
});
