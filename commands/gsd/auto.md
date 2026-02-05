---
name: gsd:auto
description: Toggle auto-mode for continuous phase execution
argument-hint: "[on|off]"
allowed-tools:
  - Read
  - Write
  - Bash
---

<execution_context>
@~/.claude/get-shit-done/references/ui-brand.md
</execution_context>

<objective>
Toggle auto-mode on/off. When on, a Stop hook chains plan-phase and execute-phase
automatically — the developer only needs to start the first command.

Auto-mode uses the `Stop` hook (`gsd-auto-continue.js`) to detect GSD completion
patterns and inject the next command.

**Hard stops (auto-mode always pauses):**
- Milestone complete
- Verifier returns `human_needed`
- Error (error box pattern)
- Gap closure attempted 3+ times
</objective>

<context>
Args: $ARGUMENTS (optional: "on", "off", or empty for toggle)
</context>

<process>

## 1. Verify Hook Installation (always runs first)

Check if the Stop hook is configured:

```bash
# Check project-level and global settings
grep -rq "gsd-auto-continue" .claude/settings.json .claude/settings.local.json 2>/dev/null && echo "hook_found" || \
grep -rq "gsd-auto-continue" ~/.claude/settings.json ~/.claude/settings.local.json 2>/dev/null && echo "hook_found" || \
echo "hook_missing"
```

**If hook missing → skip all other steps and show setup guide:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-MODE SETUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Auto-mode chains plan-phase and execute-phase automatically.
One command starts the workflow — the hook handles the rest.

**Step 1 — Register the Stop hook**

Add to your `~/.claude/settings.json` inside the `"hooks"` object:

  "Stop": [{
    "hooks": [{
      "type": "command",
      "command": "node \"<path-to-gsd>/hooks/gsd-auto-continue.js\"",
      "timeout": 10
    }]
  }]

Replace <path-to-gsd> with your GSD install path.
Run `cat ~/.claude/get-shit-done/VERSION` to verify the location.

If you already have a `"Stop"` array, add the entry to the existing array.

**Step 2 — Restart Claude Code** (hooks load on startup)

**Step 3 — Enable auto-mode**

From any GSD project directory:

  /gsd:auto on
```

**If hook found → continue to step 2.**

## 2. Validate Environment

```bash
test -f .planning/config.json && echo "exists" || echo "missing"
```

**If missing:** Show note (not error):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Stop hook installed.

⚠ No GSD project in current directory.

Run `/gsd:auto on` from a directory with `.planning/config.json`
or start a new project with `/gsd:new-project`.
```

**Stop here if config missing.** If config exists → continue.

## 3. Read Current Config

Read `.planning/config.json`. Parse `auto_mode` value (default: `false` if not present).

## 4. Determine Action

Parse $ARGUMENTS:
- `on` → set auto_mode to true
- `off` → set auto_mode to false
- empty → toggle (true ↔ false)

## 5. Update Config

Read `.planning/config.json`, update `auto_mode` field.

**If `auto_mode` key doesn't exist yet**, add it after `"mode"`:

```json
{
  "mode": "...",
  "auto_mode": true,
  ...
}
```

Write updated config.

## 6. Display Status

**If auto_mode turned ON:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-MODE ON ⚡
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Continuous execution enabled.

**How it works:**
The Stop hook detects GSD completions and chains the next command.
- plan-phase ✓ → auto-starts execute-phase
- execute-phase ✓ → auto-starts plan-phase for next phase
- Gaps found → auto-starts gap closure loop

**Stops for:**
- Milestone completion
- Verifier `human_needed` status
- Errors (error box pattern)
- Gap closure after 3 attempts

**Start your workflow with any GSD command:**
/gsd:plan-phase — plan next phase
/gsd:execute-phase — execute current phase
/gsd:progress — check status and auto-route

/gsd:auto off — disable auto-mode
```

**If auto_mode turned OFF:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► AUTO-MODE OFF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Manual mode restored. Commands show "Next Up" suggestions and wait.

/gsd:auto on — re-enable auto-mode
```

</process>

<success_criteria>
- [ ] Config validated
- [ ] auto_mode toggled correctly in config.json
- [ ] Hook installation verified
- [ ] Status displayed with clear on/off indication
- [ ] If hook missing: registration instructions shown
</success_criteria>
