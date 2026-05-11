// allow-test-rule: source-text-is-the-product — verify-work.md is a runtime workflow contract.

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('bug #3381: verify-work forwards workstream context', () => {
  test('workflow forwards ${GSD_WS} to workstream-sensitive SDK queries', () => {
    const workflow = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'verify-work.md'),
      'utf8',
    );

    assert.match(workflow, /GSD_WS=""/, 'verify-work must initialize GSD_WS');
    assert.match(
      workflow,
      /grep -qE -- '--ws\[\[:space:\]\]\+\[\^\[:space:\]\]\+'/,
      'verify-work must detect --ws in $ARGUMENTS',
    );
    assert.match(
      workflow,
      /grep -oE -- '--ws\[\[:space:\]\]\+\[\^\[:space:\]\]\+'/,
      'verify-work must extract the --ws flag pair from $ARGUMENTS',
    );
    assert.match(
      workflow,
      /PHASE_ARG=\$\(echo "\$ARGUMENTS" \| sed -E 's\/--ws\[\[:space:\]\]\+\[\^\[:space:\]\]\+\/\/g' \| xargs\)/,
      'verify-work must derive PHASE_ARG after removing --ws',
    );
    assert.match(
      workflow,
      /gsd-sdk query init\.verify-work "\$\{PHASE_ARG\}" \$\{GSD_WS\}/,
      'init.verify-work must receive GSD_WS so phase_dir resolves in workstreams',
    );
    assert.match(
      workflow,
      /gsd-sdk query phase\.mvp-mode "\$\{phase_number\}" \$\{GSD_WS\} --pick active/,
      'phase.mvp-mode must receive GSD_WS so roadmap mode is workstream-scoped',
    );
    assert.match(
      workflow,
      /gsd-sdk query roadmap\.get-phase "\$\{phase_number\}" \$\{GSD_WS\} --pick goal/,
      'roadmap.get-phase must receive GSD_WS so goals are workstream-scoped',
    );
  });
});
