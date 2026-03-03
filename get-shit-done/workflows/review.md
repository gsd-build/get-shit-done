<purpose>
Orchestrate cross-AI peer review of phase plans by invoking external AI CLIs (Gemini, Claude, Codex) and assembling their feedback into a REVIEWS.md document.
</purpose>

<required_reading>
@~/.claude/get-shit-done/references/ui-brand.md
</required_reading>

<process>

## 1. Initialize

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init review "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

Parse JSON for: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `padded_phase`, `plans`, `plan_count`, `has_reviews`, `cli_available`, `roadmap_exists`, `requirements_exists`, `project_exists`.

**If `phase_found` is false:** Error — phase not found.
**If `plan_count` is 0:** Error — no plans to review. Run `/gsd:plan-phase` first.

## 2. Parse Arguments

Extract from $ARGUMENTS: phase number, flags (`--gemini`, `--claude`, `--codex`, `--all`).

**If `--all`:** Enable all available CLIs.
**If no CLI flags:** Default to `--all`.

## 3. Check CLI Availability

```bash
CLI_CHECK=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" review check-cli)
```

Cross-reference requested CLIs with availability. Warn about unavailable CLIs.

**If no requested CLIs are available:** Error — install at least one AI CLI.

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► CROSS-AI REVIEW — PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reviewers: {list of available requested CLIs}
Plans: {plan_count}
```

## 4. Build Review Prompt

```bash
PROMPT_INFO=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" review build-prompt --phase "$PHASE")
PROMPT_FILE=$(echo "$PROMPT_INFO" | jq -r '.prompt_path')
```

## 5. Invoke CLIs (Sequential)

For each enabled and available CLI, invoke sequentially:

### Gemini
```bash
GEMINI_OUT=$(mktemp /tmp/gsd-review-gemini-XXXXXX.md)
cat "$PROMPT_FILE" | gemini -p > "$GEMINI_OUT" 2>/dev/null
GEMINI_EXIT=$?
```

### Claude
```bash
CLAUDE_OUT=$(mktemp /tmp/gsd-review-claude-XXXXXX.md)
cat "$PROMPT_FILE" | claude -p --model sonnet > "$CLAUDE_OUT" 2>/dev/null
CLAUDE_EXIT=$?
```

### Codex
```bash
CODEX_OUT=$(mktemp /tmp/gsd-review-codex-XXXXXX.md)
cat "$PROMPT_FILE" | codex -p > "$CODEX_OUT" 2>/dev/null
CODEX_EXIT=$?
```

Display progress for each: `◆ {CLI} review... {done|failed}`

**Per-CLI failure handling:** If a CLI fails (non-zero exit), skip it and continue with remaining CLIs. Warn user about failures.

## 6. Write REVIEWS.md

Build the write-reviews command with all successful review files:

```bash
WRITE_ARGS="review write-reviews --phase $PHASE"
if [ $GEMINI_EXIT -eq 0 ]; then WRITE_ARGS="$WRITE_ARGS --gemini-file $GEMINI_OUT"; fi
if [ $CLAUDE_EXIT -eq 0 ]; then WRITE_ARGS="$WRITE_ARGS --claude-file $CLAUDE_OUT"; fi
if [ $CODEX_EXIT -eq 0 ]; then WRITE_ARGS="$WRITE_ARGS --codex-file $CODEX_OUT"; fi

RESULT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" $WRITE_ARGS)
```

## 7. Commit

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "docs(phase-${PHASE}): add cross-AI reviews" --files "${phase_dir}/${padded_phase}-REVIEWS.md"
```

## 8. Present Results

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► REVIEWS COMPLETE — PHASE {X}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Reviewers: {list}
Output: {reviews_path}
```

## 9. Cleanup

Remove temporary files (prompt file, individual review files).

</process>

<offer_next>
Output this markdown directly:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE {X} REVIEWED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase {X}: {Name}** — Reviews from {N} AI(s)

| Reviewer | Status |
|----------|--------|
| Gemini   | ✓/✗    |
| Claude   | ✓/✗    |
| Codex    | ✓/✗    |

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Incorporate feedback into plans:**

/gsd:plan-phase {X} --reviews

<sub>Reviews are saved in {reviews_path}</sub>

───────────────────────────────────────────────────────────────
</offer_next>

<success_criteria>
- [ ] Phase validated and plans found
- [ ] CLI availability checked
- [ ] Prompt built from project/phase context
- [ ] At least one CLI invoked successfully
- [ ] REVIEWS.md written with per-reviewer sections
- [ ] Temporary files cleaned up
- [ ] User sees status and next steps
</success_criteria>
