# SME Check Step -- lazy-loaded by discuss-phase

> **Lazy-loaded and gated.** `workflows/discuss-phase.md` reads this file ONLY
> when `use_sme_agents: true` AND `milestone.active_smes` is non-empty in STATE.md.
> Skip the Read entirely when either condition is false.

## 1. Check Config Flag

> Skip if `workflow.use_sme_agents` is not `true`. Absent = disabled (default is `false`).

```bash
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
```

**If `SME_AGENTS` is not `true`:** Skip this step entirely. Return to discuss-phase.md.

## 2. Read Active SMEs from STATE.md

Use `frontmatter.get` to read STATE.md raw YAML frontmatter. Do NOT use `state.json` — it rebuilds
frontmatter from body scanning and does not preserve custom fields like `milestone.active_smes`.

```bash
STATE_FM=$(gsd-sdk query frontmatter.get .planning/STATE.md 2>/dev/null || echo '{"data":{}}')
ACTIVE_SMES=$(echo "$STATE_FM" | python3 -c "
import json, sys
d = json.load(sys.stdin)
data = d.get('data', d)
smes = data.get('milestone', {}).get('active_smes', [])
print('\n'.join(smes) if isinstance(smes, list) else '')
" 2>/dev/null || echo "")
```

**If `ACTIVE_SMES` is empty:** Skip silently. Phase 8 has not run yet, or no SMEs are queued for
this milestone. Return to discuss-phase.md.

## 3. Fetch SME Context Blocks

For each process name in `ACTIVE_SMES`, fetch its SME context block:

```bash
SME_CONTEXT_BLOCKS=""
for PROCESS_NAME in $ACTIVE_SMES; do
  CTX=$(gsd-sdk query sme.context-block "${PROCESS_NAME}" 2>/dev/null || echo '{"data":{"found":false}}')
  FOUND=$(echo "$CTX" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('found', False))" 2>/dev/null || echo "False")
  if [ "$FOUND" = "True" ]; then
    BLOCK=$(echo "$CTX" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('block',''))" 2>/dev/null || echo "")
    SME_CONTEXT_BLOCKS="${SME_CONTEXT_BLOCKS}${BLOCK}"
  fi
done
```

**If `SME_CONTEXT_BLOCKS` is empty:** Warn that no SME documents were found for queued processes.
Never block. Return to discuss-phase.md.

## 4. Generate Probing Questions

Spawn `gsd-sme-auditor` with a prompt that explicitly overrides its plan-audit execution flow.
There is NO PLAN.md to review — the auditor produces domain-specific probing questions instead.

```
Task(
  prompt="""${SME_CONTEXT_BLOCKS}

Phase goal: ${PHASE_GOAL}

Your role here is DIFFERENT from a plan audit: there is no PLAN.md to review.
Instead, produce 3-5 domain-specific probing questions that surface the highest-severity
risks from the SME findings above. The user will answer these during the discussion
phase, before planning begins.

Focus on BLOCKERs first, then WARNINGs. Format as a numbered list. No ## markers.
""",
  subagent_type="gsd-sme-auditor",
  description="SME probing questions Phase ${PHASE}"
)
```

Capture the numbered question list returned by the auditor as `sme_risk_areas`.

Store `sme_risk_areas` for injection into `present_gray_areas` as pre-loaded domain risk areas.
These appear alongside user-selected gray areas during discussion.

## 5. Output for CONTEXT.md

When `sme_risk_areas` is non-empty, the `write_context` step includes a `<sme_context>` block
in CONTEXT.md. The block contains:
- The numbered probing questions surfaced by the auditor
- The list of active SME process names

This block is visible to the planner via CONTEXT.md and ensures domain risks are addressed
in the plan.
