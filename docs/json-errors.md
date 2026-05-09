# JSON Error Mode — `gsd-tools` Structured Errors

## Overview

`gsd-tools` supports a **JSON error mode** that emits all errors as structured
JSON objects on stderr instead of free-form text.  This is the recommended
surface for tests and tooling that need to assert on error types without
grepping raw text (see `CONTRIBUTING.md` — "Prohibited: Raw Text Matching on
Test Outputs").

## Activating

Either flag or env var activates the mode:

```bash
# Flag (preferred in test code):
node gsd-tools.cjs --json-errors <command> [args]

# Env var (preferred for shell wrappers and CI):
GSD_JSON_ERRORS=1 node gsd-tools.cjs <command> [args]
```

## Wire format

On any error, exactly one JSON line is written to **stderr** and the process
exits with code 1:

```json
{ "ok": false, "reason": "<error_code>", "message": "<human text>" }
```

Fields:

| Field     | Type    | Description |
|-----------|---------|-------------|
| `ok`      | `false` | Always `false` for error objects. |
| `reason`  | string  | Typed reason code from the taxonomy below. |
| `message` | string  | Human-readable description (may change; do not assert on it). |

## Error code taxonomy

Codes are frozen constants in `get-shit-done/bin/lib/core.cjs` under
`ERROR_REASON`.  Tests must assert on `reason` values (stable), not `message`
text (unstable).

### Dispatch errors (gsd-tools routing layer)

| Code | When emitted |
|------|-------------|
| `sdk_unknown_command` | Unknown top-level command (`gsd-tools bogus-cmd`) |
| `sdk_unknown_command` | Unknown dotted command (`gsd-tools foo.bar` where `foo` is not a known command) |
| `sdk_unknown_command` | Unknown subcommand within a domain (e.g. `gsd-tools intel bogus-sub`) |
| `sdk_missing_arg` | Required argument omitted by an SDK-level guard |
| `sdk_fail_fast` | SDK fail-fast policy triggered |

### Usage / flag errors

| Code | When emitted |
|------|-------------|
| `usage` | `--pick` flag used without a following value |
| `usage` | Version flag (`--version`, `-v`) which gsd-tools never accepts |
| `usage` | Top-level no-args invocation (usage text) |

### Config errors (`config-get`, `config-set`, `config-ensure-section`)

| Code | When emitted |
|------|-------------|
| `config_key_not_found` | `config-get` for a key that is absent from the config file |
| `config_no_file` | Config operation when `.planning/config.json` does not exist |
| `config_parse_failed` | Config file exists but is not valid JSON |
| `config_invalid_key` | `config-set` for a key outside the allowed whitelist |

### Phase / workflow errors

| Code | When emitted |
|------|-------------|
| `phase_not_found` | Phase directory lookup returns no match |
| `summary_no_planning` | Summary operation when no `.planning/` directory exists |

### Graphify errors

| Code | When emitted |
|------|-------------|
| `graphify_no_graph` | Graphify query or diff when no graph has been built |
| `graphify_invalid_query` | Graphify query with a malformed query string |

### Hook / security errors

| Code | When emitted |
|------|-------------|
| `hooks_opt_out` | Hooks are disabled via opt-out config |
| `security_scan_failed` | Security scan produced a finding that blocks the operation |

### Fallback

| Code | When emitted |
|------|-------------|
| `unknown` | All other errors without a specific reason code assigned |

## Writing tests

Always parse stderr with `JSON.parse` and assert on typed fields.  Never use
`.includes()`, `.match()`, or regex on the raw error string.

```js
// CORRECT: parse then assert on typed field
const result = runGsdTools(['--json-errors', 'bogus-command'], tmpDir);
assert.strictEqual(result.success, false);
const err = JSON.parse(result.error);
assert.strictEqual(err.ok, false);
assert.strictEqual(err.reason, 'sdk_unknown_command');

// WRONG: text matching (banned by lint-no-source-grep policy)
// assert.ok(result.error.includes('Unknown command'));
```

## Adding a new error code

1. Add the constant to `ERROR_REASON` in
   `get-shit-done/bin/lib/core.cjs` (snake\_case, prefixed by subsystem).
2. Pass it as the second argument to `error()` at the call site.
3. Add a row to this document.
4. Add a test asserting the new `reason` code via `JSON.parse`.
