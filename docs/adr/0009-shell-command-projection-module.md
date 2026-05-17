# Shell Command Projection Module owns runtime-aware OS command rendering

- **Status:** Accepted
- **Date:** 2026-05-12

We propose introducing a Shell Command Projection Module that owns projection from typed command intent to concrete shell/runtime-specific command text. GSD currently hand-builds hook commands, PATH repair commands, shim scripts, and other serialized OS-facing command strings across installer call sites. That drift has repeatedly produced cross-shell regressions (`#2376`, `#2979`, `#3002`, `#3011`, `#3181`, `#3393`, `#3413`). The proposed seam concentrates quoting, path-style, and runtime-wrapper policy in one module while keeping real subprocess execution on array-arg/non-shell paths.

## Decision

- Add a **Shell Command Projection Module** under `get-shit-done/bin/lib/` as the single owner for runtime-aware command-text rendering.
- Feed the module typed inputs (`platform`, `shell`, `runtime`, executable token, args, path policy) instead of prebuilt shell strings.
- Keep callers as thin Adapters that request projected text for:
  - managed hook commands in `settings.json`
  - managed hook commands in runtime config TOML/JSON surfaces
  - user-facing PATH repair / setup instructions
  - generated shim / wrapper script text written to disk
- Keep internal subprocess execution (`spawnSync`, `execFileSync`, SDK query dispatch) outside this seam. The module does **not** become a generic command runner.
- Make runtime-specific wrappers explicit policy at the seam (for example, emit PowerShell call-operator prefixes only for shells/runtimes that require them).
- Make path-style projection explicit policy at the seam (`native Windows`, `POSIX slash`, `$HOME`-relative, `project-dir-relative`, etc.).
- Prefer typed IR outputs that tests can assert against directly, then render text at the final Adapter.

## Initial Scope

First migration slice should cover installer/runtime surfaces already proving this bug class:

1. managed JS and `.sh` hook command construction
2. managed hook rewrite / normalization on reinstall
3. Codex hook block command rendering
4. PATH diagnostic action-line rendering
5. Windows shim / wrapper script text builders
6. local-install hook command rendering (`$CLAUDE_PROJECT_DIR` vs cwd-relative runtime paths)

It should **not** in the first pass expand into workflow markdown ` ```bash` blocks or replace safe internal subprocess APIs with shell-string execution.

## Migration Inventory

### `bin/install.js`

These call sites should migrate behind the Shell Command Projection Module:

- `formatHookCommandForShell()` — `bin/install.js:605-608`
- `formatManagedHookScriptToken()` — `bin/install.js:610-614`
- `rewriteLegacyManagedNodeHookCommands()` projection path — `bin/install.js:639-718`
- `buildCodexHookBlock()` — `bin/install.js:752-768`
- `rewriteLegacyCodexHookBlock()` — `bin/install.js:784-812`
- `buildHookCommand()` — `bin/install.js:827-857`
- `localCmd()` builder — `bin/install.js:8855-8857`
- per-hook command constructors — `bin/install.js:8858-8875`, `9065-9067`, `9090-9092`, `9119-9121`, `9143-9145`, `9173-9176`
- legacy PATH hint strings — `bin/install.js:9764-9768`
- `formatSdkPathDiagnostic()` render path — `bin/install.js:10075-10084`, builder at `10532-10582`
- `buildWindowsShimTriple()` — `bin/install.js:10487-10510`

### Tests expected to move with the seam

- `tests/bug-2979-hook-absolute-node.test.cjs`
- `tests/sh-hook-paths.test.cjs`
- `tests/bug-3011-sdk-path-diagnostic.test.cjs`
- `tests/bug-3017-codex-hook-absolute-node.test.cjs`
- `tests/bug-2376-opencode-windows-home-path.test.cjs`
- `tests/bug-3020-install-shell-path-probe.test.cjs`
- `tests/bug-3359-stale-gsd-sdk-path-version.test.cjs`

## Interface sketch

The module should accept typed command intent rather than concatenated shell fragments. Example shape:

```js
projectShellCommand({
  platform: 'linux' | 'darwin' | 'win32',
  shell: 'bash' | 'zsh' | 'cmd' | 'pwsh',
  runtime: 'claude' | 'gemini' | 'codex' | 'opencode' | 'copilot' | 'antigravity' | 'generic',
  executable: { kind: 'node' | 'bash' | 'pwsh' | 'literal', token: '...' },
  args: ['...'],
  pathStyle: 'native' | 'posix' | 'home-relative' | 'project-relative',
})
```

For user-facing multi-line guidance, the seam should return typed action IR first, then let the installer print it:

```js
projectShellActions({ intent: 'prepend-path', platform, targetDir, runtime })
```

For generated shim/wrapper files, the seam should own script text rendering too:

```js
projectShellScript({ shell: 'cmd' | 'pwsh' | 'sh', executable, argsTemplate })
```

## Consequences

- Quoting, slash-direction, wrapper-prefix, and variable-expansion policy become local to one module.
- Installer/runtime call sites become thinner and stop inventing sibling string builders.
- Windows runtime-specific regressions become easier to classify as seam bugs instead of one-off installer bugs.
- Tests can assert against typed projection IR instead of source-grepping ad-hoc string concatenation sites.
- The first implementation will move a broad installer surface, so scope discipline matters: start with installer/runtime projection only, not every shell string in the repo.
- If accepted, `CONTEXT.md` should gain a canonical **Shell Command Projection Module** entry and future architecture reviews should treat out-of-seam command rendering as drift.

## Open questions

- Whether `hooks.shell_preference` from `#3082` should become an input policy consumed by this module or remain a higher-level runtime config concern.
- Whether Windows Git Bash should be modeled as explicit `shell: 'bash'` + `platform: 'win32'` or as a distinct shell target.
- Whether existing shim/script builders should migrate in the first pass or follow immediately after the hook/diagnostic path is stable.
- Whether the seam should live entirely in installer land or later become shared with other runtime-output surfaces outside `bin/install.js`.

## References

- Feature issue: `#3439`
- Related bug history: `#2376`, `#2979`, `#3002`, `#3011`, `#3017`, `#3020`, `#3082`, `#3181`, `#3393`, `#3413`
- See `0005-sdk-architecture-seam-map.md`
- See `0008-installer-migration-module.md`

## Update — 2026-05-13 (Phases 1–4 expansion, `#3465`–`#3468`)

The seam grew beyond the original "rendering only" scope. The "does not become a generic command runner" and "does not replace safe internal subprocess APIs" constraints (Decision §17, Initial Scope §33) were intentionally superseded.

**Scope now owned by `shell-command-projection.cjs`:**

- runtime-aware command-text rendering (original ADR scope)
- subprocess dispatch — `execGit`, `execNpm`, `execTool`, `probeTty` (Phase 2, `#3466`)
- platform file I/O — `platformWriteSync`, `platformReadSync`, `platformEnsureDir`, `normalizeContent` (Phase 3, `#3467`)
- legacy wrappers `atomicWriteFileSync` / `safeReadFile` / `normalizeMd` removed from `core.cjs` (Phase 4, `#3468`)

**Result-shape invariant:** all `exec*` return `{ exitCode, stdout, stderr }` and never throw on non-zero exit. Platform-conditional logic (`shell: process.platform === 'win32'`, `probeTty` Windows null return, `.md`-aware normalization) lives only at the seam.

**Open question resolutions:**

- Q4 (installer-only vs shared seam): **resolved — shared.** The seam lives in `get-shit-done/bin/lib/`, consumed by installer, planning workflow, and every fs/subprocess call site across the tool.
- Q1, Q2, Q3 (`hooks.shell_preference`, Windows Git Bash modeling, shim/script builder migration timing): unresolved, carried forward as projection-design concerns independent of the I/O expansion.

See CONTEXT.md "Shell Command Projection Module" entry for the canonical current-state description.
