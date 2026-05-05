# SME Process Detection Step -- lazy-loaded by new-milestone

> **Lazy-loaded and gated.** `workflows/new-milestone.md` reads this file ONLY
> when `use_sme_agents: true` is set in config (checked in step 1 below).
> Skip the Read entirely when the condition is false.

## 1. Check Config Flag

> Skip if `workflow.use_sme_agents` is not `true`. Absent = disabled (default is `false`).

```bash
SME_AGENTS=$(gsd-sdk query config-get workflow.use_sme_agents --raw 2>/dev/null || echo "false")
```

**If `SME_AGENTS` is not `true`:** Skip this step entirely. Return to new-milestone.md.

## 2. List Existing SMEs

Call `sme.list` to get all existing SME documents with metadata.

```bash
SME_LIST=$(gsd-sdk query sme.list 2>/dev/null || echo '{"data":{"enabled":false,"smes":[]}}')
ENABLED=$(echo "$SME_LIST" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',{}).get('enabled',False))" 2>/dev/null || echo "False")
```

**If `ENABLED` is not `True`:** Skip silently. Return to new-milestone.md.

Extract all process names with metadata from the SME list:

```bash
ALL_PROCESSES=$(echo "$SME_LIST" | python3 -c "
import json, sys
d = json.load(sys.stdin)
smes = d.get('data', {}).get('smes', [])
for sme in smes:
    print(sme.get('process_name', ''))
" 2>/dev/null || echo "")
```

## 3. Detect Processes from Milestone Goal

Call `sme.detect-processes` with the milestone goal text. At milestone setup time, no
`--file-paths` are available — goal keyword matching is the detection mechanism here.

```bash
SME_DETECT=$(gsd-sdk query sme.detect-processes --goal "${MILESTONE_GOAL}" 2>/dev/null || echo '{"data":{"enabled":false,"matches":[]}}')
MATCHED_PROCESSES=$(echo "$SME_DETECT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
matches = d.get('data', {}).get('matches', [])
print('\n'.join(m.get('process_name', '') for m in matches))
" 2>/dev/null || echo "")
```

Also surface ALL existing SMEs from `sme.list` (not just auto-detected matches) so the user
can manually include any that were not auto-detected by keyword matching.

## 4. Confirm Existing SMEs (DETECT-03)

If there are existing SME documents (from `sme.list`), present them to the user.
Auto-detected matches should be pre-selected/highlighted.

**Normal mode:**

```
AskUserQuestion(
  header: "Active SMEs",
  question: "These SME documents are available. Auto-detected matches are marked with [match]. Which should be active for this milestone?",
  multiSelect: true,
  options: [
    { label: "{process_name} [match]", description: "Block mode: {block_mode} | Findings: {blocker}B / {warning}W / {watch}W" },
    ...non-matched SMEs without [match] tag...
  ]
)
```

**Text mode** (`TEXT_MODE=true`):

```
Available SME documents:
1. {process_name} [match] ({block_mode}, {blocker}B/{warning}W/{watch}W)
2. {process_name} ({block_mode}, {blocker}B/{warning}W/{watch}W)
Enter numbers to activate (comma-separated), or "none" to skip:
```

**Auto mode:** Select ALL detected matches automatically.
Log: `[auto] Activated N SME(s): [list]`

If user selects "none" or no SMEs exist: continue to step 5 with empty `SELECTED_SMES`.

## 5. Offer Creation for Uncovered Processes (DETECT-04)

If the user wants to create SMEs for processes not yet covered, offer per-process creation.

```
AskUserQuestion(
  header: "Create Missing SMEs",
  question: "Would you like to create SME documents for any additional processes? You can specify process names, or skip.",
  options:
    - "Enter process names (comma-separated)"
    - "Skip -- no new SMEs needed"
)
```

Resolve creator model and skills before spawning (per CONFIG-03, DETECT-04):

```bash
CREATOR_MODEL=$(gsd-sdk query resolve-model gsd-sme-creator --raw 2>/dev/null || echo "inherit")
AGENT_SKILLS_CREATOR=$(gsd-sdk query agent-skills gsd-sme-creator || echo "")
```

For each accepted process name:

1. Validate name (T-08-01 mitigation — prevent injection into gsd-sme-creator path):

```bash
if [[ ! "$PROCESS_NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
  echo "ERROR: Process name must contain only letters, digits, hyphens, and underscores."
  echo "Got: '$PROCESS_NAME'"
  exit 1
fi
```

2. Spawn `gsd-sme-creator`:

```
Task(
  subagent_type="gsd-sme-creator",
  model="{CREATOR_MODEL}",
  description="Create SME for {PROCESS_NAME}",
  prompt="Process: {PROCESS_NAME}
Today: {date}
Analyze the '{PROCESS_NAME}' process and produce .planning/smes/{PROCESS_NAME}-SME.md.
{AGENT_SKILLS_CREATOR}"
)
```

3. After creator returns: check the return for `## SME Creation Complete` marker.
   If found: add process name to `SELECTED_SMES`.
   If not found: log warning ("SME creation failed for {PROCESS_NAME} -- skipping") and
   continue without adding to SELECTED_SMES.

**Auto mode:** Skip creation offer (do not spawn agents without user consent).

## 6. Write active_smes to STATE.md (DETECT-05)

If `SELECTED_SMES` is non-empty, write to STATE.md using `frontmatter.merge`.
Use ONLY `frontmatter.merge` -- the SDK state mutation handlers go through
`buildStateFrontmatter` which erases custom nested fields like `milestone.active_smes`.

```bash
ACTIVE_SMES_JSON=$(python3 -c "
import sys, json
names = [n.strip() for n in '''${SELECTED_SMES}'''.split() if n.strip()]
print(json.dumps({'milestone': {'active_smes': names}}))
")
gsd-sdk query frontmatter.merge .planning/STATE.md --data "$ACTIVE_SMES_JSON"
```

If `SELECTED_SMES` is empty: skip silently. No `active_smes` field written. Never block.

## 7. Commit

If `active_smes` were written:

```bash
gsd-sdk query commit "docs: queue active SMEs for milestone" --files .planning/STATE.md
```
