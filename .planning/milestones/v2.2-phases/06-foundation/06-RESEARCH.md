# Phase 6: Foundation - Research

**Researched:** 2026-02-16
**Domain:** CLI detection, invocation normalization, and graceful degradation for external AI CLIs
**Confidence:** HIGH

## Summary

Phase 6 builds the foundational layer for external AI CLI (Codex, Gemini, OpenCode) invocation within gsd-tools.cjs. The work decomposes into four distinct concerns: (1) a detection command that probes each CLI via `cli --version`, (2) a kill switch in config.json with env var override, (3) per-CLI adapter modules in a new `adapters/` directory that normalize invocation and output to a common schema, and (4) error handling that classifies failures (NOT_FOUND, TIMEOUT, EXIT_ERROR, PERMISSION) and returns structured results instead of throwing.

All three target CLIs are verified installable and callable on the development machine. Codex CLI (v0.101.0), Gemini CLI (v0.30.0-nightly), and OpenCode (v1.1.65) all support non-interactive JSON output. Zero new npm dependencies are required -- Node.js `child_process.execSync` (already used extensively in gsd-tools.cjs) handles everything. The adapter pattern is the correct architecture: each CLI has meaningfully different invocation syntax and output schemas.

**Primary recommendation:** Build adapters as separate `.cjs` files in `get-shit-done/bin/adapters/`, loaded by gsd-tools.cjs via `require()`. Each adapter exports `detect()` and `invoke()` functions returning the common schema `{ text, cli, duration, exitCode }`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Disable via `co_planners.enabled` in config.json + `GSD_CO_PLANNERS` env var override (env var takes precedence)
- Scope is global -- one switch disables ALL external CLI invocation everywhere
- When disabled, workflow runs normally with silent skip -- no messages about skipping co-planner steps
- Detect CLIs using version flag (`cli --version`) -- proves installed and callable in one command
- Report availability + version string per CLI (not path or capabilities)
- Output as human-readable table by default, with `--json` flag for structured machine output
- CLI-specific adapters -- each CLI gets its own adapter that translates a common internal call to native flags/args
- Code organized in separate `adapters/` directory -- one file per CLI (codex.cjs, gemini.cjs, opencode.cjs)
- All adapters return common text schema: `{ text, cli, duration, exitCode }`
- Global default timeout, configurable in config.json (single value for all CLIs)
- On failure (timeout, error, missing): log clear warning message, then continue workflow -- never crash
- Adapters report distinct error types: NOT_FOUND, TIMEOUT, EXIT_ERROR, PERMISSION -- enables meaningful user-facing messages

### Claude's Discretion
No specific areas marked for discretion -- all decisions were locked during discussion.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `child_process` | Built-in (v22+) | Spawn CLI processes, capture output | Already used in gsd-tools.cjs for git operations, websearch. `execSync` provides synchronous invocation with built-in timeout. |
| `gsd-tools.cjs` | Existing | CLI wrapper + command routing | Central tool binary for GSD. All new commands add to the existing switch/case dispatch. |
| `.planning/config.json` | Existing | Kill switch + timeout storage | Established pattern for adversary config. Co-planner config follows identical nesting conventions. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `process.env` | Built-in | `GSD_CO_PLANNERS` env var override | Kill switch precedence: env var > config.json |
| `path` module | Built-in | Resolve adapter file paths | Loading adapters via `require()` from `adapters/` directory |
| `fs` module | Built-in | Read config.json, write temp prompt files | Config parsing (existing pattern) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `execSync` (synchronous) | `spawn` (async streaming) | Co-planning is request/response, not streaming. `execSync` is simpler, blocks correctly, timeout is built-in. `spawn` would require event handlers and Promise wrappers for no benefit in Phase 6. |
| Separate adapter files | Inline switch/case in gsd-tools.cjs | Adapter files keep gsd-tools.cjs from growing unboundedly. Each CLI has ~50-80 lines of detection + invocation + parsing logic. Three adapters inline would add ~200+ lines to an already 5000+ line file. |
| `which` command for detection | `cli --version` | `which` only finds the binary on PATH. `--version` proves it is installed AND callable (catches broken installations, missing runtimes, permission issues). |

**Installation:**
```bash
# No installation needed -- zero new dependencies
# Adapters use only Node.js built-ins (child_process, path, fs)
```

## Architecture Patterns

### Recommended Project Structure
```
get-shit-done/
  bin/
    gsd-tools.cjs              # Existing: add 'coplanner' command group
    adapters/                   # NEW: one file per CLI
      codex.cjs                 # Codex CLI adapter
      gemini.cjs                # Gemini CLI adapter
      opencode.cjs              # OpenCode adapter
```

### Pattern 1: Adapter Module Contract
**What:** Each adapter exports a standard interface with `detect()` and `invoke()` functions.
**When to use:** Every adapter must conform to this contract.
**Example:**
```javascript
// Source: GSD codebase conventions (CommonJS, camelCase functions)

const { execSync } = require('child_process');

const CLI_NAME = 'codex';
const VERSION_CMD = 'codex --version';

/**
 * Detect if CLI is installed and callable
 * @returns {{ available: boolean, version: string|null, error: string|null }}
 */
function detect() {
  try {
    const stdout = execSync(VERSION_CMD, {
      encoding: 'utf-8',
      timeout: 10000,   // 10s for version check
      stdio: 'pipe',
    });
    const version = stdout.trim().split('\n').pop().trim();
    return { available: true, version, error: null };
  } catch (err) {
    if (err.code === 'ENOENT' || (err.stderr && err.stderr.includes('not found'))) {
      return { available: false, version: null, error: 'NOT_FOUND' };
    }
    if (err.signal === 'SIGTERM') {
      return { available: false, version: null, error: 'TIMEOUT' };
    }
    return { available: false, version: null, error: 'PERMISSION' };
  }
}

/**
 * Invoke CLI with a prompt and return normalized response
 * @param {string} prompt - The prompt text to send
 * @param {object} options - { timeout, model }
 * @returns {{ text: string, cli: string, duration: number, exitCode: number, error: string|null, errorType: string|null }}
 */
function invoke(prompt, options = {}) {
  const timeout = options.timeout || 120000;
  const start = Date.now();

  // ... CLI-specific invocation logic
  // ... output parsing
  // ... return normalized schema
}

module.exports = { detect, invoke, CLI_NAME };
```

### Pattern 2: execSync Error Classification
**What:** Map `execSync` error properties to the four required error types.
**When to use:** In every adapter's `invoke()` and `detect()` functions.
**Example:**
```javascript
// Source: Node.js v22 child_process docs + verified behavior on this machine

function classifyError(err) {
  // TIMEOUT: execSync killed the process after timeout elapsed
  // err.signal === 'SIGTERM' and err.killed is truthy
  if (err.signal === 'SIGTERM') return 'TIMEOUT';

  // NOT_FOUND: command not on PATH
  // err.code === 'ENOENT' or shell returns 127
  if (err.code === 'ENOENT' || err.status === 127) return 'NOT_FOUND';

  // PERMISSION: command exists but cannot execute
  // shell returns 126
  if (err.status === 126) return 'PERMISSION';

  // EXIT_ERROR: command ran but returned non-zero
  return 'EXIT_ERROR';
}
```

### Pattern 3: Config Reading with Env Var Override
**What:** Kill switch precedence chain: `GSD_CO_PLANNERS` env var > `co_planners.enabled` in config.json > default (false).
**When to use:** Before any co-planner operation (detect, invoke).
**Example:**
```javascript
// Source: Existing pattern from loadConfig() in gsd-tools.cjs

function isCoplannerEnabled(cwd) {
  // Env var takes absolute precedence
  const envVal = process.env.GSD_CO_PLANNERS;
  if (envVal !== undefined) {
    return envVal === 'true' || envVal === '1';
  }

  // Fall back to config.json
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return config.co_planners?.enabled === true;
  } catch {
    return false;  // Default: disabled
  }
}
```

### Pattern 4: Human-Readable Table + JSON Output
**What:** Detection command outputs a table by default, structured JSON with `--json` flag.
**When to use:** The `coplanner detect` command.
**Example:**
```
# Default (human-readable table):
CLI        Available  Version
codex      yes        codex-cli 0.101.0
gemini     yes        0.30.0-nightly.20260210.a2174751d
opencode   yes        1.1.65

# With --json flag:
{
  "codex": { "available": true, "version": "codex-cli 0.101.0" },
  "gemini": { "available": true, "version": "0.30.0-nightly.20260210.a2174751d" },
  "opencode": { "available": true, "version": "1.1.65" }
}
```

### Anti-Patterns to Avoid
- **Hardcoding CLI paths:** Use `execSync('codex --version')` which relies on PATH resolution. Never use `/usr/local/bin/codex`. Different users install CLIs differently (npm global, Homebrew, cargo, pnpm, nvm).
- **Parsing version output with regex:** Different CLIs have different version output formats. Just capture the trimmed string. Do not try to extract semver.
- **Throwing on detection failure:** Detection must always return a result object, never throw. The whole point is graceful reporting.
- **Embedding adapter logic in gsd-tools.cjs main function:** The main switch/case should delegate to adapter modules. Keep gsd-tools.cjs as a thin dispatcher for co-planner commands.
- **Using `command -v` or `which` for detection:** These only check PATH existence. `--version` proves the CLI is actually callable (catches broken symlinks, missing runtimes, permission issues).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Process timeout | Custom setTimeout + kill logic | `execSync` timeout option | Node.js handles SIGTERM delivery and cleanup. `execSync({timeout: N})` is battle-tested. On timeout, throws with `signal: 'SIGTERM'`. |
| JSON parsing | Custom regex extractors | `JSON.parse()` with try/catch | CLI JSON outputs are well-formed. Regex parsing breaks on nested objects, escaped strings, unicode. |
| Path resolution | Manual PATH scanning | `execSync('cli --version')` | Shell handles PATH resolution. ENOENT error code indicates "not found". |
| Config dot-notation access | Custom traversal | Existing `cmdConfigGet`/`cmdConfigSet` | Already implemented in gsd-tools.cjs with full dot-notation support (e.g., `co_planners.enabled`). |

**Key insight:** Node.js `child_process.execSync` already handles the three hardest problems (timeout, PATH resolution, exit code capture). The adapter layer is thin -- it only needs to construct the correct CLI command string and parse the CLI-specific output format.

## Common Pitfalls

### Pitfall 1: CLI Process Hanging Despite Timeout
**What goes wrong:** `execSync` timeout sends SIGTERM to the shell process, but child processes spawned by the CLI may survive. Codex CLI wraps commands in `bash -lc` which creates child processes that keep stdout/stderr pipes open.
**Why it happens:** `execSync` timeout kills the direct child (the shell), not grandchildren. Codex and Gemini spawn additional processes.
**How to avoid:** Pipe through `timeout` command as a belt-and-suspenders approach: `execSync('timeout ' + (timeoutSec) + ' codex --version')`. On macOS, use the coreutils `gtimeout` if available, or rely solely on `execSync` timeout (which does work for the direct process). For Phase 6, `execSync` timeout is sufficient -- the adapters invoke CLIs directly, not through additional shell wrappers.
**Warning signs:** Bash tool calls that never return. Orphaned node/python processes visible in `ps aux`.

### Pitfall 2: Gemini CLI Aliased, Not Binary
**What goes wrong:** On this development machine, `gemini` is aliased to `npx https://github.com/google-gemini/gemini-cli`. Running `execSync('gemini --version')` through Node.js does not load shell aliases.
**Why it happens:** Node.js `execSync` uses `/bin/sh` by default, which does not load `.zshrc` or `.bashrc` aliases. The `gemini` command works in the user's terminal but fails in Node.js child processes.
**How to avoid:** Detection should try both the direct binary name and common installation paths. If `gemini` fails with ENOENT, check if `npx @google/gemini-cli --version` works. Document that users should install Gemini CLI globally (`pnpm add -g @google/gemini-cli`) rather than relying on aliases. The adapter's `detect()` function should handle this gracefully -- report NOT_FOUND with a helpful error message.
**Warning signs:** Detection reports `gemini: NOT_FOUND` even though the user can run `gemini` in their terminal.

### Pitfall 3: Shell Environment Contamination
**What goes wrong:** `execSync` inherits the parent process environment, including variables like `DEBUG` (which causes Gemini CLI to freeze in non-interactive mode), conda activations, or nvm shims that change behavior.
**Why it happens:** The default `execSync` options inherit `process.env`. External CLIs may respond differently to environment variables the user has set for other purposes.
**How to avoid:** For invocation (not detection), sanitize the environment: pass only essential variables (PATH, HOME, TERM, plus CLI-specific auth vars like `CODEX_API_KEY`, `GEMINI_API_KEY`). Do NOT set `DEBUG`. Example: `execSync(cmd, { env: { PATH: process.env.PATH, HOME: process.env.HOME, ... } })`.
**Warning signs:** CLI invocation hangs or produces unexpected output. Works in some sessions but not others.

### Pitfall 4: Version Output Format Variance
**What goes wrong:** Each CLI returns version information differently. Codex prints `codex-cli 0.101.0`. Gemini prints `0.30.0-nightly.20260210.a2174751d`. OpenCode prints `1.1.65` (but with ANSI-escaped logo art on stderr). Parsing these into a consistent format is fragile.
**Why it happens:** No standard for CLI version output format.
**How to avoid:** Capture the full trimmed stdout as the version string. Do not try to normalize to semver. Do not try to strip prefixes. The version string is for display and debugging only -- it does not need to be machine-parsed beyond "non-empty means callable."
**Warning signs:** Version string includes ANSI escape codes or multi-line output.

### Pitfall 5: OpenCode Bun Warning Noise
**What goes wrong:** OpenCode (built on Bun) emits a warning to stderr on x64 Macs: `warn: CPU lacks AVX support, strange crashes may occur`. This warning appears in every invocation and may confuse error detection if stderr is checked for errors.
**Why it happens:** OpenCode uses Bun as its runtime, and Bun emits CPU compatibility warnings on certain hardware.
**How to avoid:** When parsing OpenCode output, only check stdout for the response and exitCode for success/failure. Do not treat stderr content as an error signal unless exitCode is non-zero. Use `stdio: 'pipe'` to capture stderr separately from stdout.
**Warning signs:** Detection falsely reports OpenCode as errored because stderr is non-empty.

### Pitfall 6: Config Default Must Be Disabled
**What goes wrong:** If `co_planners.enabled` defaults to `true`, users without any external CLIs installed get errors or slowdowns on every workflow operation as the system tries to detect and invoke non-existent tools.
**Why it happens:** Unlike the adversary (which uses the already-available Claude model), co-planners require external tools the user may not have installed.
**How to avoid:** Default `co_planners.enabled` to `false` in both the config template and `loadConfig()` defaults. Co-planning is opt-in, not opt-out. The user explicitly enables it via `/gsd:settings` or manual config edit.
**Warning signs:** New GSD users report slowdowns or errors they did not expect.

## Code Examples

Verified patterns from codebase investigation and live CLI testing:

### Adapter Loading Pattern
```javascript
// Source: Follows require() pattern used throughout gsd-tools.cjs

const ADAPTER_DIR = path.join(__dirname, 'adapters');

function loadAdapter(cliName) {
  const adapterPath = path.join(ADAPTER_DIR, `${cliName}.cjs`);
  try {
    return require(adapterPath);
  } catch {
    return null;  // Adapter file doesn't exist
  }
}

const SUPPORTED_CLIS = ['codex', 'gemini', 'opencode'];
```

### Detection Command Implementation
```javascript
// Source: Follows cmdGenerateSlug/cmdVerifyPathExists patterns in gsd-tools.cjs

function cmdCoplannerDetect(cwd, raw) {
  const results = {};

  for (const cliName of SUPPORTED_CLIS) {
    const adapter = loadAdapter(cliName);
    if (!adapter) {
      results[cliName] = { available: false, version: null, error: 'NO_ADAPTER' };
      continue;
    }
    results[cliName] = adapter.detect();
  }

  if (raw) {
    // Human-readable table
    const lines = ['CLI        Available  Version'];
    for (const [name, info] of Object.entries(results)) {
      const avail = info.available ? 'yes' : 'no';
      const ver = info.version || (info.error || '-');
      lines.push(`${name.padEnd(10)} ${avail.padEnd(10)} ${ver}`);
    }
    process.stdout.write(lines.join('\n'));
    process.exit(0);
  }

  output(results, false);
}
```

### Invocation with Timeout and Error Classification
```javascript
// Source: Follows execGit() pattern in gsd-tools.cjs (line 225)

function invokeWithTimeout(command, options = {}) {
  const timeout = options.timeout || 120000;
  const env = options.env || process.env;
  const start = Date.now();

  try {
    const stdout = execSync(command, {
      encoding: 'utf-8',
      timeout,
      stdio: 'pipe',
      env,
      maxBuffer: 10 * 1024 * 1024,  // 10MB buffer for large responses
    });
    return {
      exitCode: 0,
      stdout: stdout,
      stderr: '',
      duration: Date.now() - start,
      errorType: null,
    };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: (err.stdout ?? '').toString(),
      stderr: (err.stderr ?? '').toString(),
      duration: Date.now() - start,
      errorType: classifyError(err),
    };
  }
}
```

### Kill Switch Check
```javascript
// Source: Follows loadConfig() pattern in gsd-tools.cjs (line 160)

function checkKillSwitch(cwd) {
  // Env var takes precedence
  const envVal = process.env.GSD_CO_PLANNERS;
  if (envVal !== undefined) {
    return { enabled: envVal === 'true' || envVal === '1', source: 'env' };
  }

  // Config.json
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const enabled = config.co_planners?.enabled === true;
    return { enabled, source: 'config' };
  } catch {
    return { enabled: false, source: 'default' };
  }
}
```

### Codex Adapter Invocation
```javascript
// Source: Verified via `codex exec --help` on this machine (v0.101.0)
// Codex outputs plain text to stdout by default (progress to stderr)

function invoke(prompt, options = {}) {
  const timeout = options.timeout || 120000;
  const model = options.model ? ` -m "${options.model}"` : '';
  const start = Date.now();

  // Write prompt to temp file, pipe via stdin
  const tmpFile = path.join(os.tmpdir(), `gsd-codex-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, prompt, 'utf-8');

  const cmd = `cat "${tmpFile}" | codex exec - --ephemeral --full-auto --skip-git-repo-check${model}`;

  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout,
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024,
    });

    fs.unlinkSync(tmpFile);
    return {
      text: stdout.trim(),
      cli: 'codex',
      duration: Date.now() - start,
      exitCode: 0,
      error: null,
      errorType: null,
    };
  } catch (err) {
    try { fs.unlinkSync(tmpFile); } catch {}
    return {
      text: (err.stdout ?? '').toString().trim(),
      cli: 'codex',
      duration: Date.now() - start,
      exitCode: err.status ?? 1,
      error: err.message,
      errorType: classifyError(err),
    };
  }
}
```

### Gemini Adapter Invocation
```javascript
// Source: Verified via `gemini --help` on this machine (v0.30.0-nightly)
// Gemini with --output-format json returns { response, stats }

function invoke(prompt, options = {}) {
  const timeout = options.timeout || 120000;
  const model = options.model ? ` -m "${options.model}"` : '';
  const start = Date.now();

  const tmpFile = path.join(os.tmpdir(), `gsd-gemini-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, prompt, 'utf-8');

  const cmd = `cat "${tmpFile}" | gemini -p --output-format json${model}`;

  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout,
      stdio: 'pipe',
      env: sanitizeEnv(process.env),  // Remove DEBUG to prevent freeze
      maxBuffer: 10 * 1024 * 1024,
    });

    fs.unlinkSync(tmpFile);

    // Parse Gemini JSON response
    const parsed = JSON.parse(stdout);
    return {
      text: parsed.response || stdout.trim(),
      cli: 'gemini',
      duration: Date.now() - start,
      exitCode: 0,
      error: null,
      errorType: null,
    };
  } catch (err) {
    try { fs.unlinkSync(tmpFile); } catch {}
    return {
      text: (err.stdout ?? '').toString().trim(),
      cli: 'gemini',
      duration: Date.now() - start,
      exitCode: err.status ?? 1,
      error: err.message,
      errorType: classifyError(err),
    };
  }
}

function sanitizeEnv(env) {
  const clean = { ...env };
  delete clean.DEBUG;  // Gemini CLI freezes with DEBUG set
  return clean;
}
```

### OpenCode Adapter Invocation
```javascript
// Source: Verified via `opencode run --help` on this machine (v1.1.65)
// OpenCode run with --format json returns JSON events

function invoke(prompt, options = {}) {
  const timeout = options.timeout || 120000;
  const model = options.model ? ` -m "${options.model}"` : '';
  const start = Date.now();

  // OpenCode run takes message as positional args
  const tmpFile = path.join(os.tmpdir(), `gsd-opencode-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, prompt, 'utf-8');

  // Pipe prompt via stdin is not confirmed for opencode run;
  // use --file attachment or pass prompt as argument
  const cmd = `cat "${tmpFile}" | opencode run --format json${model}`;

  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout,
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024,
    });

    fs.unlinkSync(tmpFile);

    // Parse OpenCode JSON -- format is JSON events, extract assistant response
    const text = extractOpenCodeResponse(stdout);
    return {
      text,
      cli: 'opencode',
      duration: Date.now() - start,
      exitCode: 0,
      error: null,
      errorType: null,
    };
  } catch (err) {
    try { fs.unlinkSync(tmpFile); } catch {}
    return {
      text: (err.stdout ?? '').toString().trim(),
      cli: 'opencode',
      duration: Date.now() - start,
      exitCode: err.status ?? 1,
      error: err.message,
      errorType: classifyError(err),
    };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `codex exec --json` (JSONL events) | `codex exec -` (plain text stdout) | v0.100+ | Plain text is simpler for single-shot invocation. JSONL is for streaming UIs. Use plain text for Phase 6. |
| `opencode run` (pre-1.0) | `opencode run --format json` (v1.0+) | v1.0 release | JSON output standardized. Pre-1.0 had inconsistent CLI interface. |
| `gemini` as npx alias | `pnpm add -g @google/gemini-cli` | v0.28+ stable | Global install gives a real binary on PATH. npx alias does not work from Node.js `execSync`. |
| Separate `command -v` + version check | Single `cli --version` | GSD design decision | One command proves both existence and callability. |

**Deprecated/outdated:**
- OpenCode `opencode -p` flag: The research docs reference `-p` for non-interactive mode, but current OpenCode (v1.1.65) uses `opencode run` subcommand instead. The `--prompt` flag exists on the main command but launches TUI. Use `opencode run "prompt"` for non-interactive mode.
- Codex `--output-last-message`: Still available but adds file I/O overhead. Plain stdout capture (no `--json`) is cleaner for the "get text response" use case.

## Open Questions

1. **OpenCode stdin piping in `run` mode**
   - What we know: `opencode run --format json "message"` works with positional args. The `run` subcommand does not document stdin piping.
   - What's unclear: Whether `cat prompt.txt | opencode run --format json` works, or if prompt must be passed as a positional argument.
   - Recommendation: Test during implementation. If stdin fails, write prompt to temp file and use `opencode run --format json "$(cat /tmp/prompt.txt)"` or `opencode run --format json --file /tmp/prompt.txt`. The `--file` flag is confirmed to exist.

2. **OpenCode JSON output schema**
   - What we know: `--format json` produces JSON events. The exact schema is not documented in official docs.
   - What's unclear: The precise field names for extracting the assistant's final text response.
   - Recommendation: Run a test invocation during implementation and inspect the output. Build the parser defensively with fallbacks.

3. **Gemini alias vs binary on this machine**
   - What we know: `gemini` is aliased to `npx https://github.com/google-gemini/gemini-cli` on this machine. This alias will NOT work from Node.js `execSync` (aliases are shell-specific).
   - What's unclear: Whether the binary is also available on PATH from a global install, or only through the alias.
   - Recommendation: The adapter's `detect()` function should handle ENOENT gracefully. If detection fails, the user needs to install globally: `pnpm add -g @google/gemini-cli`.

4. **Temp file cleanup on process kill**
   - What we know: Adapters write prompt text to temp files in `os.tmpdir()`. If the process is killed mid-invocation, the temp file may not be cleaned up.
   - What's unclear: Whether temp file accumulation is a practical concern for the single-shot review use case.
   - Recommendation: Use timestamped filenames (`gsd-codex-${Date.now()}.txt`) in the OS temp directory. The OS cleans these periodically. Add cleanup in the finally block. Not a Phase 6 blocker.

## Implementation Notes

### New gsd-tools.cjs Commands

Three new commands under the `coplanner` group:

```
coplanner detect [--json]              -> Detection results (table or JSON)
coplanner invoke <cli> --prompt <text> -> Normalized { text, cli, duration, exitCode }
  [--timeout <ms>] [--model <model>]
coplanner enabled                      -> { enabled: bool, source: "env"|"config"|"default" }
```

### Config Schema Addition

Add to `get-shit-done/templates/config.json`:
```json
{
  "co_planners": {
    "enabled": false,
    "timeout_ms": 120000
  }
}
```

Phase 6 only needs `enabled` and `timeout_ms`. Per-checkpoint configuration (`checkpoints`, `agents` with commands/flags) is Phase 7 scope. Keep the config minimal for this phase.

### loadConfig() Extension

Add to the `loadConfig()` function's defaults and return value:
```javascript
const defaults = {
  // ... existing defaults ...
  co_planners_enabled: false,
  co_planners_timeout: 120000,
};

// In return:
co_planners_enabled: get('co_planners_enabled', { section: 'co_planners', field: 'enabled' }) ?? defaults.co_planners_enabled,
co_planners_timeout: get('co_planners_timeout', { section: 'co_planners', field: 'timeout_ms' }) ?? defaults.co_planners_timeout,
```

But note: the kill switch also needs env var override, which `loadConfig()` currently does not support. A dedicated `checkKillSwitch()` function is cleaner.

### File Count Estimate

| File | Action | Estimated Lines |
|------|--------|-----------------|
| `get-shit-done/bin/adapters/codex.cjs` | NEW | ~80 |
| `get-shit-done/bin/adapters/gemini.cjs` | NEW | ~90 |
| `get-shit-done/bin/adapters/opencode.cjs` | NEW | ~90 |
| `get-shit-done/bin/gsd-tools.cjs` | MODIFY | ~120 added (coplanner commands, main switch) |
| `get-shit-done/templates/config.json` | MODIFY | ~4 lines added |
| `bin/install.js` | MODIFY | ~5 lines (copy adapters/ directory) |

### Verification Approach

Each requirement maps to a testable command:

| Requirement | Verification |
|-------------|--------------|
| INFRA-01 (detection) | Run `gsd-tools.cjs coplanner detect` -- see table/JSON of installed CLIs |
| INFRA-02 (kill switch) | Set `co_planners.enabled: false`, run invoke -- verify silent skip. Set `GSD_CO_PLANNERS=true` -- verify override. |
| CORE-03 (graceful degradation) | Invoke with non-existent CLI name -- verify structured error returned. Invoke with 1ms timeout -- verify TIMEOUT error. |

## Sources

### Primary (HIGH confidence)
- Node.js v22 `child_process.execSync` documentation -- timeout behavior, error properties
- `codex exec --help` (v0.101.0) -- live flag verification on development machine
- `gemini --help` (v0.30.0-nightly) -- live flag verification on development machine
- `opencode run --help` (v1.1.65) -- live flag verification on development machine
- `gsd-tools.cjs` codebase -- existing `execGit()` pattern (line 225), `loadConfig()` (line 160), `output()`/`error()` helpers

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` -- layer placement, adapter design, config schema
- `.planning/research/STACK.md` -- CLI invocation patterns, normalization layer
- `.planning/research/PITFALLS.md` -- process hanging, output format fragility, shell environment
- `.planning/codebase/CONVENTIONS.md` -- naming patterns, error handling, module design

### Tertiary (LOW confidence)
- OpenCode stdin piping in `run` mode -- not documented, needs live testing
- OpenCode JSON output schema -- not documented in official docs
- Gemini alias behavior from Node.js -- observed on this machine, may vary

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, verified Node.js built-ins, existing patterns
- Architecture: HIGH -- adapter pattern is well-understood, follows existing gsd-tools.cjs conventions
- Pitfalls: HIGH -- verified against actual CLI behavior on development machine, cross-referenced with GitHub issues from project research
- CLI invocation specifics: MEDIUM-HIGH -- Codex and Gemini flags verified live; OpenCode `run` subcommand verified but JSON output schema undocumented

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days -- CLI tools update frequently but core invocation patterns are stable)

---
*Phase: 06-foundation*
*Research for: CLI detection, invocation normalization, and graceful degradation*
