'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const VERIFIER_AGENT = path.join(REPO_ROOT, 'agents', 'gsd-verifier.md');

function verifierProbeContract(content) {
  const sectionStart = content.indexOf('## Step 7c: Probe Execution');
  const sectionEnd = content.indexOf('## Step 8:', sectionStart);
  assert.notEqual(sectionStart, -1, 'verifier must define Step 7c');
  assert.notEqual(sectionEnd, -1, 'verifier must close Step 7c before Step 8');

  const section = content.slice(sectionStart, sectionEnd);
  const codeBlocks = [...section.matchAll(/```bash\r?\n([\s\S]*?)\r?\n```/g)].map((match) => match[1].split(/\r?\n/).join('\n'));
  const executionSteps = [...section.matchAll(/^\d+\.\s+(.+)$/gm)].map((match) => match[1]);
  return {
    title: 'Step 7c: Probe Execution',
    conventionalDiscoveryCommand: codeBlocks[0]?.split('\n').find((line) => line.startsWith('find scripts')) || null,
    declaredDiscoveryCommand: codeBlocks[0]?.split('\n').find((line) => line.startsWith('grep -R')) || null,
    executionCommand: codeBlocks[1] || '',
    executionSteps,
    statusRows: [...section.matchAll(/^\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|[^|]+\|\s*([^|]+)\|$/gm)]
      .map((match) => ({ probe: match[1], command: match[2], statuses: match[3].trim() })),
    summaryClaimsRejected: section.includes('SUMMARY.md probe pass claims are not evidence'),
  };
}

describe('bug #3321: gsd-verifier runs probes instead of trusting SUMMARY claims', () => {
  test('verifier prompt requires direct probe discovery and execution', () => {
    const content = fs.readFileSync(VERIFIER_AGENT, 'utf8');
    const contract = verifierProbeContract(content);

    assert.equal(contract.title, 'Step 7c: Probe Execution');
    assert.equal(contract.conventionalDiscoveryCommand, "find scripts -path '*/tests/probe-*.sh' -type f 2>/dev/null | sort");
    assert.equal(
      contract.declaredDiscoveryCommand,
      "grep -R -n -E 'probe-[^[:space:]]+\\.sh|scripts/.*/tests/probe-.*\\.sh' \"$PHASE_DIR\"/*-PLAN.md \"$PHASE_DIR\"/*-SUMMARY.md 2>/dev/null",
    );
    assert.deepEqual(contract.executionSteps, [
      'Build the `PROBES` list from explicit PLAN declarations first; include conventional `scripts/*/tests/probe-*.sh` when the phase is a migration/tooling phase or the success criteria mention probes.',
      'For every documented probe path, if the file is missing or unreadable, mark `MISSING_PROBE` and set `status: gaps_found`. Do not require the executable bit because probes run through `bash "$probe"`.',
      'Run each probe from the built `PROBES` list (declared + conventional) from the repository root:',
      'Exit code 0 is PASS. Any non-zero exit is FAILED and must include stdout/stderr evidence in VERIFICATION.md.',
      'Do not substitute executor narration, SUMMARY.md PASS-marker counts, or a different dry-run driver command for the probe result.',
    ]);
    assert.equal(contract.executionCommand, 'for probe in "${PROBES[@]}"; do\n  timeout 30s bash "$probe"\ndone');
    assert.deepEqual(contract.statusRows, [{
      probe: 'scripts/.../probe-name.sh',
      command: 'bash "$probe"',
      statuses: 'PASS / FAILED / MISSING_PROBE',
    }]);
    assert.equal(contract.summaryClaimsRejected, true);
  });
});
