# Testing Suites

This project's `tests/` directory uses **filename suffix markers** to group tests into named suites. The harness `scripts/run-tests.cjs` filters by suite when given `--suite <name>`. Without a flag it runs every `*.test.cjs` file (the historical default — unchanged).

> Tracked by issue [#3597](https://github.com/gsd-build/get-shit-done/issues/3597).

## Suites

| Suite | Filename pattern | What goes here |
|---|---|---|
| `unit` | `*.test.cjs` (no other marker) | Default fast lane. Pure logic, no network, no external processes beyond `gsd-tools`. Most tests live here. |
| `integration` | `*.integration.test.cjs` | Cross-module flows: full installer end-to-end, multi-tool orchestration, anything that crosses two or more bin entry points. |
| `install` | `*.install.test.cjs` | Tests that perform a real install/uninstall against a sandbox project. Slower; PR CI skips these on PRs and runs them on `main` push only. |
| `security` | `*.security.test.cjs` | Adversarial input, prompt-injection guards, fixture-driven hostile-payload sweeps. |
| `slow` | `*.slow.test.cjs` | Anything that routinely takes >5s wall-clock or holds significant memory. |
| `all` | (any) | Explicit alias for "no filter". Equivalent to running with no `--suite` flag. |

## How to place a new test

1. Pick the most specific bucket above.
2. Name the file with the matching suffix: `tests/<feature>.<suite>.test.cjs`.
3. If unsure, leave the suffix off — the file lands in `unit`, the default fast lane.

Examples:
- `tests/agent-frontmatter.test.cjs` — `unit`
- `tests/prompt-injection-guards.security.test.cjs` — `security`
- `tests/installer-end-to-end.install.test.cjs` — `install`
- `tests/sdk-mutation-stress.slow.test.cjs` — `slow`

The suite-suffix convention was chosen over a directory layout (`tests/security/`) so the 545+ existing test files don't need to move. Existing files all classify as `unit` until someone explicitly retags them.

## Running suites locally

```bash
npm test                    # everything (backcompat — same as before)
npm run test:unit           # only unit
npm run test:integration    # only integration
npm run test:install        # only install
npm run test:security       # only security
npm run test:slow           # only slow

npm run test:coverage       # backcompat — coverage over EVERY test
npm run test:coverage:unit  # fast coverage signal — only unit suite
npm run test:coverage:all   # alias for test:coverage
```

Direct harness invocation also works:

```bash
node scripts/run-tests.cjs --suite security
node scripts/run-tests.cjs --suite=security
```

Unknown suites exit non-zero with the list of valid suites. Empty suites (e.g. `--suite security` before any security-tagged file exists) exit `0` with a `no tests in suite "..."` notice on stderr so CI lanes don't go red while a suite is being populated.

## CI matrix

The `Tests` workflow runs on:

| OS | Node 22 | Node 24 | Node 26 |
|---|---|---|---|
| `ubuntu-latest` | gate | gate | forward-compat (`continue-on-error`) |
| `macos-latest` | gate | gate | forward-compat (`continue-on-error`) |
| `windows-latest` | gate | gate | forward-compat (`continue-on-error`) |

- **Node 22** is the `engines.node` floor (`>=22.0.0`) — must stay green.
- **Node 24** is the default development lane.
- **Node 26** is forward-compat. The lane reports status but does not gate the workflow — `actions/setup-node` may not yet have a stable Node 26 image at any given moment. When it stabilises, flip `continue-on-error` off.

Each matrix cell runs `unit`, `integration`, and `security` on every PR. `install` and `slow` only run on `main`-branch push to keep PR CI fast. Coverage runs in a dedicated `coverage` job on `ubuntu-latest` / Node 24 — running coverage across the full matrix would 9x the cost for no extra coverage data.

## Best practices for forward-compat (Node 24/26)

- Use `process.execPath` when spawning Node in tests so each matrix lane exercises the lane's Node version.
- Avoid stack-trace or error-message prose assertions. Assert `err.code`, structured JSON fields, or enums — Node minor releases routinely tweak error wording.
- Prefer `node:test`, `node:assert/strict`, and `node:test` mocks. No external test frameworks.
- Coverage uses `c8` and propagates `NODE_V8_COVERAGE` through the harness's child process.
