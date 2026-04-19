# Design: Capability-based stale-SDK probe in installer (#2414)

**Date:** 2026-04-18
**Status:** Approved — ready for implementation
**Fixes:** [#2414](https://github.com/gsd-build/get-shit-done/issues/2414)
**Builds on:** PR #2386 (already merged — builds gsd-sdk from in-repo source)

---

## Summary

Fix the upgrade-path gap in `installSdkIfNeeded()` at `bin/install.js:6658`. The current "is `gsd-sdk` on PATH?" probe is fooled by the stale `@gsd-build/sdk@0.1.0` left behind by v1.37.1 installs, causing the installer to skip the source rebuild — so upgraders stay broken. Replace it with a capability probe that runs `gsd-sdk --help` and rebuilds if the output does not mention `query`.

---

## Background

Every `/gsd-*` skill shells out to `gsd-sdk query <subcommand>`. The published `@gsd-build/sdk@0.1.0` on npm does not implement `query`; the logic lives in `sdk/src/cli.ts` and `sdk/src/query/*` but has never been republished. `get-shit-done-cc@1.37.1` ran `npm install -g @gsd-build/sdk`, installing the stale binary globally and breaking every skill on a fresh install.

**PR #2386 (merged 2026-04-17)** fixed the fresh-install path: `installSdkIfNeeded()` now builds `@gsd-build/sdk` from the in-repo `sdk/` source tree (`npm install` → `npm run build` → `npm install -g .`) and ships `sdk/src`, `sdk/prompts`, `sdk/package.json`, `sdk/package-lock.json`, `sdk/tsconfig.json` in the root `package.json` files array so registry installs carry what they need to build.

**Gap that remains:** the probe that decides whether to rebuild uses `which gsd-sdk`. Every user who installed v1.37.1 already has `/…/bin/gsd-sdk` on PATH (it just happens to be the stale 0.1.0). On upgrade the probe returns exit 0, the installer prints "✓ GSD SDK already installed" and returns without rebuilding. Issue #2414 reports this exact scenario. Verified on the author's machine: `gsd-sdk --version` → `0.1.0`; `gsd-sdk query init.manager` → the same `Expected "gsd-sdk run <prompt>"…` error from the issue.

---

## Scope

**In scope:**
- Replace the binary-existence probe in `installSdkIfNeeded()` with a capability probe
- Extend the `#2385` regression test in `tests/bugs-1656-1657.test.cjs` to assert the capability probe is wired in (so a future refactor can't revert us to the broken `which`-only check)
- `CHANGELOG.md` entry under `[Unreleased] ### Fixed`

**Out of scope:**
- Publishing a new version of `get-shit-done-cc` (separate release step)
- Fallback in skills to invoke bundled `gsd-tools.cjs` when `gsd-sdk` is missing (unnecessary if the SDK is kept current; larger refactor across ~17 skill files)
- Bumping `sdk/package.json` version (the capability probe does not need version metadata)
- Publishing a newer `@gsd-build/sdk` to npm (intentionally kept frozen per PR #2386's commit message)

---

## Design

### The probe

Replace these lines (currently `bin/install.js:6658-6664`):

```js
if (!hasSdk) {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['gsd-sdk'], { stdio: 'ignore' });
  if (probe.status === 0) {
    console.log(`  ${green}✓${reset} GSD SDK already installed (gsd-sdk on PATH)`);
    return;
  }
}
```

with a capability probe:

```js
if (!hasSdk) {
  const probe = spawnSync('gsd-sdk', ['--help'], {
    encoding: 'utf-8',
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const hasQueryCapability =
    probe.status === 0 &&
    typeof probe.stdout === 'string' &&
    probe.stdout.includes('query');
  if (hasQueryCapability) {
    console.log(`  ${green}✓${reset} GSD SDK already installed (gsd-sdk supports \`query\`)`);
    return;
  }
  // Not installed, or installed but stale (no query subcommand).
  // Fall through to the build-from-source flow.
  if (probe.status === 0) {
    console.log(`  ${yellow}→${reset} Detected stale gsd-sdk on PATH (missing \`query\` subcommand). Rebuilding from in-repo source…`);
  }
}
```

### Why `--help | grep query` is the right probe

| Signal | Stale 0.1.0 | Current (built from source) |
|---|---|---|
| Binary on PATH (`which gsd-sdk`) | yes | yes |
| `gsd-sdk --version` output | `v0.1.0` | a version string |
| `gsd-sdk --help` contains `query` | **no** | **yes** |
| `gsd-sdk query foo` exit | 1 ("Expected…") | 10 ("requires a command") |

`--help` is cheap, deterministic, exit-code 0 on both versions, and directly tests the capability the skills depend on. It is robust to future renames of the SDK package (nothing here is coupled to `@gsd-build/sdk`) and stays correct if SDK versioning changes shape.

### Behavior matrix

| State on user's machine | Flag | Old behavior | New behavior |
|---|---|---|---|
| No gsd-sdk | none | build from source | build from source |
| Stale 0.1.0 on PATH | none | **skip build (bug)** | **build from source (fix)** |
| Current SDK on PATH | none | skip build | skip build |
| Any state | `--sdk` | force build | force build |
| Any state | `--no-sdk` | skip entirely | skip entirely |

### Edge cases

- **Probe times out or throws** (`probe.error` set, e.g. ENOENT, ETIMEDOUT): `probe.status !== 0`, so `hasQueryCapability` is false → falls through to the build path. Correct behavior: treat an unresponsive SDK as "not usable, rebuild."
- **Probe succeeds but writes `query` to stderr only**: we only match stdout. The current SDK (both stale and source-built) prints USAGE to stdout, so this is fine; documented via the "stdio: ['ignore', 'pipe', 'pipe']" shape.
- **User has PATH that resolves `gsd-sdk` to something unrelated** (shim, alias, homebrew name collision): probe will either exit non-zero or not contain `query` → rebuild. Worst case is an unnecessary rebuild, not breakage.
- **`--help` output changes format in a future version** (e.g. removes the word `query`): probe would misfire and force rebuild every install. Mitigated by the regression test asserting this probe string; a deliberate change to the probe must update the test.

---

## Files changed

- `bin/install.js` — replace ~7 lines inside `installSdkIfNeeded()` with the capability probe (~15 lines including comment). Net: small.
- `tests/bugs-1656-1657.test.cjs` — add one test inside the existing `#1657 / #2385: SDK install must be wired into installer source` describe block:
  ```
  test('install.js probes for `query` capability, not just binary presence (#2414)', ...)
  ```
  Assertions: installer calls `spawnSync('gsd-sdk', ['--help'], …)` AND checks for the string `'query'` in the probe output. Guards against reintroducing the `which`-only probe.
- `CHANGELOG.md` — under `[Unreleased] ### Fixed`, one entry:
  > **Installer now rebuilds a stale `gsd-sdk` on upgrade.** v1.37.1 installed `@gsd-build/sdk@0.1.0` globally, which lacked the `query` subcommand every `/gsd-*` skill depends on. PR #2386 fixed fresh installs by building from source, but the rebuild was skipped on upgrade because `which gsd-sdk` still found the stale binary. The installer now probes `gsd-sdk --help` for the `query` capability and rebuilds from source if it's missing. Closes #2414.

No other files touched. No skill files, no SDK source, no package.json version bumps.

---

## Testing

**Regression test (added to `tests/bugs-1656-1657.test.cjs`):**
- Static assertions that the installer source contains the capability-probe wiring (matches `/spawnSync\(\s*['"]gsd-sdk['"]/` and `/includes\(\s*['"]query['"]\s*\)/`).

**Manual verification (to run before merging):**
1. Confirm stale state is present: `gsd-sdk --version` → `v0.1.0`, `gsd-sdk query init.manager` fails with `Expected "gsd-sdk run <prompt>"…`.
2. Run the updated installer against a local checkout (`node bin/install.js --claude --global`).
3. Expect: "→ Detected stale gsd-sdk on PATH… Rebuilding from in-repo source…" followed by the build log.
4. After the installer finishes: `gsd-sdk --help | grep -c query` → `1`. `gsd-sdk query init.manager` in an empty dir → JSON with a clean error, not "Expected…".
5. Re-run the installer without flags. Expect: "✓ GSD SDK already installed (gsd-sdk supports `query`)" — no rebuild.
6. Re-run with `--no-sdk`. Expect: "Skipping GSD SDK install (--no-sdk)".

No integration test against real npm global state is added — the existing `bugs-1656-1657.test.cjs` tests are source-level assertions, and matching that pattern keeps the test fast and hermetic.

---

## Risk and reversibility

- **Blast radius:** `installSdkIfNeeded()` only runs during `get-shit-done-cc` install. Does not affect running GSD sessions.
- **Rollback:** single revert restores the `which`-based probe. No migrations, no state changes, no new files to clean up.
- **Failure mode if the probe is wrong:** forces an unnecessary rebuild (~15s of `tsc` + global install). Does not break anything.

---

## Release plan (follow-up, out of scope for this change)

After this lands:
1. Bump `get-shit-done-cc` to `1.37.2` (patch — fix only, no new features).
2. Publish to npm.
3. Close #2414 with a link to the release notes.

The release step is not part of this spec's implementation plan.
