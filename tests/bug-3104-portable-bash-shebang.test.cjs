'use strict';

/**
 * Regression test for bug #3104
 *
 * Root cause: three bash hooks (gsd-phase-boundary.sh, gsd-session-state.sh,
 * gsd-validate-commit.sh) shipped with #!/bin/bash as their shebang. On NixOS
 * and minimal Alpine container images, /bin/bash does not exist (bash is at
 * /usr/bin/bash instead). Direct invocation of the hook files fails with
 * "bad interpreter: /bin/bash: no such file or directory".
 *
 * Fix: use #!/usr/bin/env bash (PATH lookup), matching the convention used by
 * scripts/*.sh in this repo. The default install path (bash "<hook-path>" in
 * settings.json) is unaffected by this change — only direct invocation is
 * broken by the non-portable shebang.
 *
 * This test asserts:
 *   1. Each .sh hook file has #!/usr/bin/env bash as line 1.
 *   2. Line 2 is still the gsd-hook-version header (no regression on placement).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HOOKS_DIR = path.join(__dirname, '..', 'hooks');

const SH_HOOKS = [
  'gsd-phase-boundary.sh',
  'gsd-session-state.sh',
  'gsd-validate-commit.sh',
];

describe('bug #3104: bash hook files use portable #!/usr/bin/env bash shebang', () => {
  for (const sh of SH_HOOKS) {
    test(`${sh} line 1 is #!/usr/bin/env bash`, () => {
      const lines = fs.readFileSync(path.join(HOOKS_DIR, sh), 'utf8').split('\n');
      assert.strictEqual(
        lines[0],
        '#!/usr/bin/env bash',
        `${sh} must use #!/usr/bin/env bash (not #!/bin/bash) for NixOS/Alpine portability (#3104). Got: "${lines[0]}"`,
      );
    });

    test(`${sh} line 2 is still the gsd-hook-version header`, () => {
      const lines = fs.readFileSync(path.join(HOOKS_DIR, sh), 'utf8').split('\n');
      assert.ok(
        lines[1].startsWith('# gsd-hook-version:'),
        `${sh} line 2 must still be the gsd-hook-version header after shebang change. Got: "${lines[1]}"`,
      );
    });
  }
});
