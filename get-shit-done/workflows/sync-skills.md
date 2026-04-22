# sync-skills — Cross-Runtime GSD Skill Sync

**Command:** `/gsd:sync-skills`

Sync managed `gsd-*` skill directories from one canonical runtime's skills root to one or more destination runtime skills roots. Keeps multi-runtime installs aligned after a `gsd-update` on one runtime.

---

## Arguments

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--from <runtime>` | Yes | *(none)* | Source runtime — the canonical runtime to copy from |
| `--to <runtime\|all>` | Yes | *(none)* | Destination runtime or `all` supported runtimes |
| `--dry-run` | No | *on by default* | Preview changes without writing anything |
| `--apply` | No | *off* | Execute the diff (overrides dry-run) |

If neither `--dry-run` nor `--apply` is specified, dry-run is the default.

**Supported runtime names:** `claude`, `codex`, `copilot`, `cursor`, `windsurf`, `opencode`, `gemini`, `kilo`, `augment`, `trae`, `qwen`, `codebuddy`, `cline`, `antigravity`

---

## Step 1: Parse Arguments

```bash
FROM_RUNTIME=""
TO_RUNTIMES=()
IS_APPLY=false

# Parse --from
if [[ "$@" == *"--from"* ]]; then
  FROM_RUNTIME=$(echo "$@" | grep -oP '(?<=--from )\S+')
fi

# Parse --to
if [[ "$@" == *"--to all"* ]]; then
  TO_RUNTIMES=(claude codex copilot cursor windsurf opencode gemini kilo augment trae qwen codebuddy cline antigravity)
elif [[ "$@" == *"--to"* ]]; then
  TO_RUNTIMES=( $(echo "$@" | grep -oP '(?<=--to )\S+') )
fi

# Parse --apply
if [[ "$@" == *"--apply"* ]]; then
  IS_APPLY=true
fi
```

**Validation:**
- If `--from` is missing or unrecognized: print error and exit
- If `--to` is missing or unrecognized: print error and exit
- If `--from` == `--to` (single destination): print `[no-op: source and destination are the same runtime]` and exit

---

## Step 2: Resolve Skills Roots

Use `install.js --skills-root` to resolve paths — this reuses the single authoritative path table rather than duplicating it:

```bash
INSTALL_JS="$(dirname "$0")/../get-shit-done/bin/install.js"
# If running from a global install, resolve relative to the GSD package
INSTALL_JS_GLOBAL="$HOME/.claude/get-shit-done/bin/install.js"
[[ ! -f "$INSTALL_JS" ]] && INSTALL_JS="$INSTALL_JS_GLOBAL"

SRC_SKILLS_ROOT=$(node "$INSTALL_JS" --skills-root "$FROM_RUNTIME")

for DEST_RUNTIME in "${TO_RUNTIMES[@]}"; do
  DEST_SKILLS_ROOTS["$DEST_RUNTIME"]=$(node "$INSTALL_JS" --skills-root "$DEST_RUNTIME")
done
```

**Guard:** If the source skills root does not exist, print:
```
error: source skills root not found: <path>
       Is GSD installed globally for the '<runtime>' runtime?
       Run: node ~/.claude/get-shit-done/bin/install.js --global --<runtime>
```
Then exit.

**Guard:** If `--to` contains the same runtime as `--from`, skip that destination silently.

---

## Step 3: Compute Diff Per Destination

For each destination runtime:

```bash
# List gsd-* subdirectories in source
SRC_SKILLS=$(ls -1 "$SRC_SKILLS_ROOT" 2>/dev/null | grep '^gsd-')

# List gsd-* subdirectories in destination (may not exist yet)
DST_SKILLS=$(ls -1 "$DEST_ROOT" 2>/dev/null | grep '^gsd-')

# Diff:
# CREATE  — in SRC but not in DST
# UPDATE  — in both; content differs (compare recursively via checksums)
# REMOVE  — in DST but not in SRC (stale GSD skill no longer in source)
# SKIP    — in both; content identical (already up to date)
```

**Non-GSD preservation:** Only `gsd-*` entries are ever created, updated, or removed. Entries in the destination that do not start with `gsd-` are never touched.

---

## Step 4: Print Diff Report

Always print the report, regardless of `--apply` or `--dry-run`:

```
sync source: <runtime> (<src_skills_root>)
sync targets: <dest1>, <dest2>

== <dest1> (<dest1_skills_root>) ==
CREATE: gsd-help
UPDATE: gsd-update
REMOVE: gsd-old-command
SKIP:   gsd-plan-phase (up to date)
(N changes)

== <dest2> (<dest2_skills_root>) ==
CREATE: gsd-help
(N changes)

dry-run only. use --apply to execute.    ← omit this line if --apply
```

If a destination root does not exist and `--apply` is true, print `CREATE DIR: <path>` before its entries.

If all destinations are already up to date:
```
All destinations are up to date. No changes needed.
```

---

## Step 5: Execute (only when --apply)

If `--dry-run` (or no flag): skip this step entirely and exit after printing the report.

For each destination with changes:

```bash
mkdir -p "$DEST_ROOT"

for SKILL in $CREATE_LIST $UPDATE_LIST; do
  rm -rf "$DEST_ROOT/$SKILL"
  cp -r "$SRC_SKILLS_ROOT/$SKILL" "$DEST_ROOT/$SKILL"
done

for SKILL in $REMOVE_LIST; do
  rm -rf "$DEST_ROOT/$SKILL"
done
```

**Idempotency:** Running `--apply` a second time with no intervening changes must report zero changes (all entries are SKIP).

**Atomicity:** Each skill directory is replaced as a unit (remove then copy). Partial updates of individual files within a skill are not performed — the whole directory is replaced.

After executing all destinations:

```
Sync complete: <N> skills synced to <M> runtime(s).
```

---

## Safety Rules

1. **Only `gsd-*` directories** are created, updated, or removed. Any directory not starting with `gsd-` in a destination root is untouched.
2. **Dry-run is the default.** `--apply` must be passed explicitly to write anything.
3. **Source root must exist.** Never create the source root; it must have been created by a prior `gsd-update` or installer run.
4. **No cross-runtime content transformation.** Sync copies files verbatim. It does not apply runtime-specific content transformations (those happen at install time). If a runtime requires transformed content (e.g. Augment's format differs), the developer should run the installer for that runtime instead of using sync.

---

## Limitations

- Sync copies files verbatim and does not apply runtime-specific content transformations. Use the GSD installer directly for runtimes that require format conversion.
- Cross-project skills (`.agents/skills/`) are out of scope — this command only touches global runtime skills roots.
- Bidirectional sync is not supported. Choose one canonical source with `--from`.
