<purpose>
Check for GSD updates via npm, display changelog for versions between installed and latest, obtain user confirmation, and execute clean installation with cache clearing.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="get_installed_version">
Detect whether GSD is installed locally or globally by checking both locations and validating install integrity.

First, derive `PREFERRED_CONFIG_DIR` and `PREFERRED_RUNTIME` from the invoking prompt's `execution_context` path:
- If the path contains `/get-shit-done/workflows/update.md`, strip that suffix and store the remainder as `PREFERRED_CONFIG_DIR`
- Path contains `/.codex/` -> `codex`
- Path contains `/.gemini/` -> `gemini`
- Path contains `/.config/kilo/` or `/.kilo/`, or `PREFERRED_CONFIG_DIR` contains `kilo.json` / `kilo.jsonc` -> `kilo`
- Path contains `/.config/opencode/` or `/.opencode/`, or `PREFERRED_CONFIG_DIR` contains `opencode.json` / `opencode.jsonc` -> `opencode`
- Otherwise -> `claude`

Use `PREFERRED_CONFIG_DIR` when available so custom `--config-dir` installs are checked before default locations.
Use `PREFERRED_RUNTIME` as the first runtime checked so `/gsd-update` targets the runtime that invoked it.

Kilo config precedence must match the installer: `KILO_CONFIG_DIR` -> `dirname(KILO_CONFIG)` -> `XDG_CONFIG_HOME/kilo` -> `~/.config/kilo`.

```bash
expand_home() {
  case "$1" in
    "~/"*) printf '%s/%s\n' "$HOME" "${1#~/}" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

# Runtime candidates: "<runtime>:<config-dir>" stored as an array.
# Using an array instead of a space-separated string ensures correct
# iteration in both bash and zsh (zsh does not word-split unquoted
# variables by default). Fixes #1173.
RUNTIME_DIRS=( "claude:.claude" "opencode:.config/opencode" "opencode:.opencode" "gemini:.gemini" "kilo:.config/kilo" "kilo:.kilo" "codex:.codex" )
ENV_RUNTIME_DIRS=()

# PREFERRED_CONFIG_DIR / PREFERRED_RUNTIME should be set from execution_context
# before running this block.
if [ -n "$PREFERRED_CONFIG_DIR" ]; then
  PREFERRED_CONFIG_DIR="$(expand_home "$PREFERRED_CONFIG_DIR")"
  if [ -z "$PREFERRED_RUNTIME" ]; then
    if [ -f "$PREFERRED_CONFIG_DIR/kilo.json" ] || [ -f "$PREFERRED_CONFIG_DIR/kilo.jsonc" ]; then
      PREFERRED_RUNTIME="kilo"
    elif [ -f "$PREFERRED_CONFIG_DIR/opencode.json" ] || [ -f "$PREFERRED_CONFIG_DIR/opencode.jsonc" ]; then
      PREFERRED_RUNTIME="opencode"
    elif [ -f "$PREFERRED_CONFIG_DIR/config.toml" ]; then
      PREFERRED_RUNTIME="codex"
    fi
  fi
fi

# If runtime is still unknown, infer from runtime env vars; fallback to claude.
if [ -z "$PREFERRED_RUNTIME" ]; then
  if [ -n "$CODEX_HOME" ]; then
    PREFERRED_RUNTIME="codex"
  elif [ -n "$GEMINI_CONFIG_DIR" ]; then
    PREFERRED_RUNTIME="gemini"
  elif [ -n "$KILO_CONFIG_DIR" ]; then
    PREFERRED_RUNTIME="kilo"
  elif [ -n "$KILO_CONFIG" ]; then
    PREFERRED_RUNTIME="kilo"
  elif [ -n "$OPENCODE_CONFIG_DIR" ] || [ -n "$OPENCODE_CONFIG" ]; then
    PREFERRED_RUNTIME="opencode"
  elif [ -n "$CLAUDE_CONFIG_DIR" ]; then
    PREFERRED_RUNTIME="claude"
  else
    PREFERRED_RUNTIME="claude"
  fi
fi

# If execution_context already points at an installed config dir, trust it first.
# This covers custom --config-dir installs that do not live under the default
# runtime directories.
if [ -n "$PREFERRED_CONFIG_DIR" ] && { [ -f "$PREFERRED_CONFIG_DIR/get-shit-done/VERSION" ] || [ -f "$PREFERRED_CONFIG_DIR/get-shit-done/workflows/update.md" ]; }; then
  INSTALL_SCOPE="GLOBAL"
  for dir in .claude .config/opencode .opencode .gemini .config/kilo .kilo .codex; do
    resolved_local="$(cd "./$dir" 2>/dev/null && pwd)"
    if [ -n "$resolved_local" ] && [ "$resolved_local" = "$PREFERRED_CONFIG_DIR" ]; then
      INSTALL_SCOPE="LOCAL"
      break
    fi
  done

  if [ -f "$PREFERRED_CONFIG_DIR/get-shit-done/VERSION" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$PREFERRED_CONFIG_DIR/get-shit-done/VERSION"; then
    INSTALLED_VERSION="$(cat "$PREFERRED_CONFIG_DIR/get-shit-done/VERSION")"
  else
    INSTALLED_VERSION="0.0.0"
  fi

  echo "$INSTALLED_VERSION"
  echo "$INSTALL_SCOPE"
  echo "${PREFERRED_RUNTIME:-claude}"
  exit 0
fi

# Absolute global candidates from env overrides (covers custom config dirs).
if [ -n "$CLAUDE_CONFIG_DIR" ]; then
  ENV_RUNTIME_DIRS+=( "claude:$(expand_home "$CLAUDE_CONFIG_DIR")" )
fi
if [ -n "$GEMINI_CONFIG_DIR" ]; then
  ENV_RUNTIME_DIRS+=( "gemini:$(expand_home "$GEMINI_CONFIG_DIR")" )
fi
if [ -n "$KILO_CONFIG_DIR" ]; then
  ENV_RUNTIME_DIRS+=( "kilo:$(expand_home "$KILO_CONFIG_DIR")" )
elif [ -n "$KILO_CONFIG" ]; then
  ENV_RUNTIME_DIRS+=( "kilo:$(dirname "$(expand_home "$KILO_CONFIG")")" )
elif [ -n "$XDG_CONFIG_HOME" ]; then
  ENV_RUNTIME_DIRS+=( "kilo:$(expand_home "$XDG_CONFIG_HOME")/kilo" )
fi
if [ -n "$OPENCODE_CONFIG_DIR" ]; then
  ENV_RUNTIME_DIRS+=( "opencode:$(expand_home "$OPENCODE_CONFIG_DIR")" )
elif [ -n "$OPENCODE_CONFIG" ]; then
  ENV_RUNTIME_DIRS+=( "opencode:$(dirname "$(expand_home "$OPENCODE_CONFIG")")" )
elif [ -n "$XDG_CONFIG_HOME" ]; then
  ENV_RUNTIME_DIRS+=( "opencode:$(expand_home "$XDG_CONFIG_HOME")/opencode" )
fi
if [ -n "$CODEX_HOME" ]; then
  ENV_RUNTIME_DIRS+=( "codex:$(expand_home "$CODEX_HOME")" )
fi

# Reorder entries so preferred runtime is checked first.
ORDERED_RUNTIME_DIRS=()
for entry in "${RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  if [ "$runtime" = "$PREFERRED_RUNTIME" ]; then
    ORDERED_RUNTIME_DIRS+=( "$entry" )
  fi
done
ORDERED_ENV_RUNTIME_DIRS=()
for entry in "${ENV_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  if [ "$runtime" = "$PREFERRED_RUNTIME" ]; then
    ORDERED_ENV_RUNTIME_DIRS+=( "$entry" )
  fi
done
for entry in "${ENV_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  if [ "$runtime" != "$PREFERRED_RUNTIME" ]; then
    ORDERED_ENV_RUNTIME_DIRS+=( "$entry" )
  fi
done
for entry in "${RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  if [ "$runtime" != "$PREFERRED_RUNTIME" ]; then
    ORDERED_RUNTIME_DIRS+=( "$entry" )
  fi
done

# Check local first (takes priority only if valid and distinct from global)
LOCAL_VERSION_FILE="" LOCAL_MARKER_FILE="" LOCAL_DIR="" LOCAL_RUNTIME=""
for entry in "${ORDERED_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  dir="${entry#*:}"
  if [ -f "./$dir/get-shit-done/VERSION" ] || [ -f "./$dir/get-shit-done/workflows/update.md" ]; then
    LOCAL_RUNTIME="$runtime"
    LOCAL_VERSION_FILE="./$dir/get-shit-done/VERSION"
    LOCAL_MARKER_FILE="./$dir/get-shit-done/workflows/update.md"
    LOCAL_DIR="$(cd "./$dir" 2>/dev/null && pwd)"
    break
  fi
done

GLOBAL_VERSION_FILE="" GLOBAL_MARKER_FILE="" GLOBAL_DIR="" GLOBAL_RUNTIME=""
for entry in "${ORDERED_ENV_RUNTIME_DIRS[@]}"; do
  runtime="${entry%%:*}"
  dir="${entry#*:}"
  if [ -f "$dir/get-shit-done/VERSION" ] || [ -f "$dir/get-shit-done/workflows/update.md" ]; then
    GLOBAL_RUNTIME="$runtime"
    GLOBAL_VERSION_FILE="$dir/get-shit-done/VERSION"
    GLOBAL_MARKER_FILE="$dir/get-shit-done/workflows/update.md"
    GLOBAL_DIR="$(cd "$dir" 2>/dev/null && pwd)"
    break
  fi
done

if [ -z "$GLOBAL_RUNTIME" ]; then
  for entry in "${ORDERED_RUNTIME_DIRS[@]}"; do
    runtime="${entry%%:*}"
    dir="${entry#*:}"
    if [ -f "$HOME/$dir/get-shit-done/VERSION" ] || [ -f "$HOME/$dir/get-shit-done/workflows/update.md" ]; then
      GLOBAL_RUNTIME="$runtime"
      GLOBAL_VERSION_FILE="$HOME/$dir/get-shit-done/VERSION"
      GLOBAL_MARKER_FILE="$HOME/$dir/get-shit-done/workflows/update.md"
      GLOBAL_DIR="$(cd "$HOME/$dir" 2>/dev/null && pwd)"
      break
    fi
  done
fi

# Only treat as LOCAL if the resolved paths differ (prevents misdetection when CWD=$HOME)
IS_LOCAL=false
if [ -n "$LOCAL_VERSION_FILE" ] && [ -f "$LOCAL_VERSION_FILE" ] && [ -f "$LOCAL_MARKER_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$LOCAL_VERSION_FILE"; then
  if [ -z "$GLOBAL_DIR" ] || [ "$LOCAL_DIR" != "$GLOBAL_DIR" ]; then
    IS_LOCAL=true
  fi
fi

if [ "$IS_LOCAL" = true ]; then
  INSTALLED_VERSION="$(cat "$LOCAL_VERSION_FILE")"
  INSTALL_SCOPE="LOCAL"
  TARGET_RUNTIME="$LOCAL_RUNTIME"
elif [ -n "$GLOBAL_VERSION_FILE" ] && [ -f "$GLOBAL_VERSION_FILE" ] && [ -f "$GLOBAL_MARKER_FILE" ] && grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+' "$GLOBAL_VERSION_FILE"; then
  INSTALLED_VERSION="$(cat "$GLOBAL_VERSION_FILE")"
  INSTALL_SCOPE="GLOBAL"
  TARGET_RUNTIME="$GLOBAL_RUNTIME"
elif [ -n "$LOCAL_RUNTIME" ] && [ -f "$LOCAL_MARKER_FILE" ]; then
  # Runtime detected but VERSION missing/corrupt: treat as unknown version, keep runtime target
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="LOCAL"
  TARGET_RUNTIME="$LOCAL_RUNTIME"
elif [ -n "$GLOBAL_RUNTIME" ] && [ -f "$GLOBAL_MARKER_FILE" ]; then
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="GLOBAL"
  TARGET_RUNTIME="$GLOBAL_RUNTIME"
else
  INSTALLED_VERSION="0.0.0"
  INSTALL_SCOPE="UNKNOWN"
  TARGET_RUNTIME="claude"
fi

echo "$INSTALLED_VERSION"
echo "$INSTALL_SCOPE"
echo "$TARGET_RUNTIME"
```

Parse output:
- Line 1 = installed version (`0.0.0` means unknown version)
- Line 2 = install scope (`LOCAL`, `GLOBAL`, or `UNKNOWN`)
- Line 3 = target runtime (`claude`, `opencode`, `gemini`, `kilo`, or `codex`)
- If scope is `UNKNOWN`, proceed to install step using `--claude --global` fallback.

If multiple runtime installs are detected and the invoking runtime cannot be determined from execution_context, ask the user which runtime to update before running install.

**If VERSION file missing:**
```
## GSD Update

**Installed version:** Unknown

Your installation doesn't include version tracking.

Running fresh install...
```

Proceed to install step (treat as version 0.0.0 for comparison).
</step>

<step name="check_latest_version">
Check npm for latest version:

```bash
npm view get-shit-done-cc version 2>/dev/null
```

**If npm check fails:**
```
Couldn't check for updates (offline or npm unavailable).

To update manually: `npx get-shit-done-cc --global`
```

Exit.
</step>

<step name="compare_versions">
Compare installed vs latest:

**If installed == latest:**
```
## GSD Update

**Installed:** X.Y.Z
**Latest:** X.Y.Z

You're already on the latest version.
```

Exit.

**If installed > latest:**
```
## GSD Update

**Installed:** X.Y.Z
**Latest:** A.B.C

You're ahead of the latest release — this looks like a dev install.

If you see a "⚠ dev install — re-run installer to sync hooks" warning in
your statusline, your hook files are older than your VERSION file. Fix it
by re-running the local installer from your dev branch:

    node bin/install.js --global --claude

Running /gsd-update would install the npm release (A.B.C) and downgrade
your dev version — do NOT use it to resolve this warning.
```

Exit.
</step>

<step name="show_changes_and_confirm">
**If update available**, fetch and show what's new BEFORE updating:

1. Fetch changelog from GitHub raw URL
2. Extract entries between installed and latest versions
3. Display preview and ask for confirmation:

```
## GSD Update Available

**Installed:** 1.5.10
**Latest:** 1.5.15

### What's New
────────────────────────────────────────────────────────────

## [1.5.15] - 2026-01-20

### Added
- Feature X

## [1.5.14] - 2026-01-18

### Fixed
- Bug fix Y

────────────────────────────────────────────────────────────

⚠️  **Note:** The installer performs a clean install of GSD folders:
- `commands/gsd/` will be wiped and replaced
- `get-shit-done/` will be wiped and replaced
- `agents/gsd-*` files will be replaced

(Paths are relative to detected runtime install location:
global: `~/.claude/`, `~/.config/opencode/`, `~/.opencode/`, `~/.gemini/`, `~/.config/kilo/`, or `~/.codex/`
local: `./.claude/`, `./.config/opencode/`, `./.opencode/`, `./.gemini/`, `./.kilo/`, or `./.codex/`)

Your custom files in other locations are preserved:
- Custom commands not in `commands/gsd/` ✓
- Custom agents not prefixed with `gsd-` ✓
- Custom hooks ✓
- Your CLAUDE.md files ✓

If you've modified any GSD files directly, they'll be automatically backed up to `gsd-local-patches/` and can be reapplied with `/gsd-reapply-patches` after the update.
```


**Text mode (`workflow.text_mode: true` in config or `--text` flag):** Set `TEXT_MODE=true` if `--text` is present in `$ARGUMENTS` OR `text_mode` from init JSON is `true`. When TEXT_MODE is active, replace every `AskUserQuestion` call with a plain-text numbered list and ask the user to type their choice number. This is required for non-Claude runtimes (OpenAI Codex, Gemini CLI, etc.) where `AskUserQuestion` is not available.
Use AskUserQuestion:
- Question: "Proceed with update?"
- Options:
  - "Yes, update now"
  - "No, cancel"

**If user cancels:** Exit.
</step>

<step name="run_update">
Run the update using the install type detected in step 1:

Build runtime flag from step 1:
```bash
RUNTIME_FLAG="--$TARGET_RUNTIME"
```

**If LOCAL install:**
```bash
npx -y get-shit-done-cc@latest "$RUNTIME_FLAG" --local
```

**If GLOBAL install:**
```bash
npx -y get-shit-done-cc@latest "$RUNTIME_FLAG" --global
```

**If UNKNOWN install:**
```bash
npx -y get-shit-done-cc@latest --claude --global
```

Capture output. If install fails, show error and exit.

Clear the update cache so statusline indicator disappears:

```bash
expand_home() {
  case "$1" in
    "~/"*) printf '%s/%s\n' "$HOME" "${1#~/}" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

# Clear update cache across preferred, env-derived, and default runtime directories
CACHE_DIRS=()
if [ -n "$PREFERRED_CONFIG_DIR" ]; then
  CACHE_DIRS+=( "$(expand_home "$PREFERRED_CONFIG_DIR")" )
fi
if [ -n "$CLAUDE_CONFIG_DIR" ]; then
  CACHE_DIRS+=( "$(expand_home "$CLAUDE_CONFIG_DIR")" )
fi
if [ -n "$GEMINI_CONFIG_DIR" ]; then
  CACHE_DIRS+=( "$(expand_home "$GEMINI_CONFIG_DIR")" )
fi
if [ -n "$KILO_CONFIG_DIR" ]; then
  CACHE_DIRS+=( "$(expand_home "$KILO_CONFIG_DIR")" )
elif [ -n "$KILO_CONFIG" ]; then
  CACHE_DIRS+=( "$(dirname "$(expand_home "$KILO_CONFIG")")" )
elif [ -n "$XDG_CONFIG_HOME" ]; then
  CACHE_DIRS+=( "$(expand_home "$XDG_CONFIG_HOME")/kilo" )
fi
if [ -n "$OPENCODE_CONFIG_DIR" ]; then
  CACHE_DIRS+=( "$(expand_home "$OPENCODE_CONFIG_DIR")" )
elif [ -n "$OPENCODE_CONFIG" ]; then
  CACHE_DIRS+=( "$(dirname "$(expand_home "$OPENCODE_CONFIG")")" )
elif [ -n "$XDG_CONFIG_HOME" ]; then
  CACHE_DIRS+=( "$(expand_home "$XDG_CONFIG_HOME")/opencode" )
fi
if [ -n "$CODEX_HOME" ]; then
  CACHE_DIRS+=( "$(expand_home "$CODEX_HOME")" )
fi

for dir in "${CACHE_DIRS[@]}"; do
  if [ -n "$dir" ]; then
    rm -f "$dir/cache/gsd-update-check.json"
  fi
done

for dir in .claude .config/opencode .opencode .gemini .config/kilo .kilo .codex; do
  rm -f "./$dir/cache/gsd-update-check.json"
  rm -f "$HOME/$dir/cache/gsd-update-check.json"
done
```

The SessionStart hook (`gsd-check-update.js`) writes to the detected runtime's cache directory, so preferred/env-derived paths and default paths must all be cleared to prevent stale update indicators.
</step>

<step name="display_result">
Format completion message (changelog was already shown in confirmation step):

```
╔═══════════════════════════════════════════════════════════╗
║  GSD Updated: v1.5.10 → v1.5.15                           ║
╚═══════════════════════════════════════════════════════════╝

⚠️  Restart your runtime to pick up the new commands.

[View full changelog](https://github.com/gsd-build/get-shit-done/blob/main/CHANGELOG.md)
```
</step>


<step name="check_local_patches">
After update completes, check if the installer detected and backed up any locally modified files:

Check for gsd-local-patches/backup-meta.json in the config directory.

**If patches found:**

```
Local patches were backed up before the update.
Run /gsd-reapply-patches to merge your modifications into the new version.
```

**If no patches:** Continue normally.
</step>
</process>

<success_criteria>
- [ ] Installed version read correctly
- [ ] Latest version checked via npm
- [ ] Update skipped if already current
- [ ] Changelog fetched and displayed BEFORE update
- [ ] Clean install warning shown
- [ ] User confirmation obtained
- [ ] Update executed successfully
- [ ] Restart reminder shown
</success_criteria>
