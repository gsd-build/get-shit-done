<purpose>
Research how to implement a phase. Spawns gsd-phase-researcher with phase context.

Standalone research command. For most workflows, use `/gsd:plan-phase` which integrates research automatically.
</purpose>

<process>

## Step 0: Resolve Model Profile

@C:/Users/rickw/.claude/get-shit-done/references/model-profile-resolution.md

Resolve model for:
- `gsd-phase-researcher`

## Step 1: Normalize and Validate Phase

@C:/Users/rickw/.claude/get-shit-done/references/phase-argument-parsing.md

```bash
# Extract --ws flag from arguments
WS_NAME=""
GSD_WS=""
if echo "$ARGUMENTS" | grep -qE '\-\-ws[= ]'; then
  WS_NAME=$(echo "$ARGUMENTS" | grep -oE '\-\-ws[= ][^ ]+' | sed 's/--ws[= ]//')
  GSD_WS="--ws $WS_NAME"
fi

PHASE_INFO=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${PHASE}" ${GSD_WS})
```

If `found` is false: Error and exit.

## Step 2: Check Existing Research

```bash
ls ${phase_dir}/*RESEARCH.md 2>/dev/null
```

If exists: Offer update/view/skip options.

## Step 3: Gather Phase Context

```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init phase-op "${PHASE}" ${GSD_WS})
# Extract: phase_dir, padded_phase, phase_number, state_path, requirements_path, context_path
```

## Step 4: Spawn Researcher

```
Task(
  prompt="<objective>
Research implementation approach for Phase {phase}: {name}
</objective>

<files_to_read>
- {context_path} (USER DECISIONS from /gsd:discuss-phase)
- {requirements_path} (Project requirements)
- {state_path} (Project decisions and history)
</files_to_read>

<additional_context>
Phase description: {description}
</additional_context>

<output>
Write to: ${phase_dir}/${PHASE}-RESEARCH.md
</output>",
  subagent_type="gsd-phase-researcher",
  model="{researcher_model}"
)
```

## Step 5: Handle Return

- `## RESEARCH COMPLETE` — Display summary, offer: Plan/Dig deeper/Review/Done
- `## CHECKPOINT REACHED` — Present to user, spawn continuation
- `## RESEARCH INCONCLUSIVE` — Show attempts, offer: Add context/Try different mode/Manual

</process>
