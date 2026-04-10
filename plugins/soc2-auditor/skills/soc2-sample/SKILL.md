---
name: soc2-sample
description: "Calculate sample sizes and select sample items for control testing"
argument-hint: "<control-id> [--method statistical|judgmental] [--population-size N] [--confidence 95|90]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - AskUserQuestion
---

<objective>
Calculate appropriate sample sizes and select specific sample items for control testing. Produces a sampling memo in the control's workpaper directory.

Supports statistical attribute sampling, frequency-based sampling, and judgmental sampling. The method is determined by control frequency, risk level, and population size.

Requires: `.audit/CONTROL-MATRIX.md` must exist. If a specific control-id is provided, that control must be in the matrix.
</objective>

<references>
@.claude/skills/soc2-references/sampling-tables.md
@.claude/skills/soc2-references/sampling-methodology.md
@.claude/skills/soc2-templates/sampling-memo.md
</references>

<context>
$ARGUMENTS
</context>

<process>

## Step 0: Parse Arguments and Load Context

Parse $ARGUMENTS for:
- **control-id** (required) — the control to sample for, or "all" to generate sampling memos for all controls
- **--method** (optional) — override sampling method (statistical | judgmental | frequency)
- **--population-size** (optional) — override population size
- **--confidence** (optional) — confidence level (95 or 90, default 95)

Read `.audit/CONTROL-MATRIX.md` and `.audit/config.json`.

If processing a specific control, extract:
- Control description
- TSC criteria
- Frequency
- Risk level
- Type (preventive/detective)

If "all" is specified, iterate through all controls with Status = "Not Tested".

## Step 1: Determine Sampling Method

### Decision Logic

1. **Type I engagement** → Sample size = 1 for all controls (design walkthrough only). Skip to Step 4.

2. **IT automated control** (system-enforced, no human judgment):
   - Sample size = 1
   - Additionally: validate no changes to the control during the audit period via ITGC testing
   - Method = "IT Application Control"

3. **Frequency-based** (control operates at a defined frequency):
   - Use frequency-based sampling table from references
   - Adjust for risk level:
     - Low risk: use minimum
     - Moderate risk: use midpoint
     - High risk: use maximum
   - Method = "Frequency-Based"

4. **Statistical** (large population, per-occurrence controls, or explicit override):
   - Look up from attribute sampling tables
   - Parameters: confidence level, tolerable deviation rate, expected deviation rate
   - Method = "Statistical Attribute"

5. **Judgmental** (small populations, unique controls, or explicit override):
   - Professional judgment with documented rationale
   - Method = "Judgmental"

### Calculate Sample Size

Using the determined method, calculate the sample size:

**Frequency-based lookup (from sampling tables reference):**

| Frequency | Population (12 mo) | Low Risk | Moderate Risk | High Risk |
|-----------|--------------------|---------:|-------------:|----------:|
| Annual | 1 | 1 | 1 | 1 |
| Quarterly | 4 | 2 | 3 | 4 |
| Monthly | 12 | 2 | 3 | 5 |
| Weekly | 52 | 5 | 9 | 15 |
| Daily | 250+ | 20 | 30 | 40 |
| Per occurrence | varies | 25 | 40 | 60 |

**Statistical lookup:**
- Look up in sampling tables using: confidence level × expected deviation rate × tolerable deviation rate
- Adjust for finite population if population < 5× sample size

**Population size:**
- If --population-size provided, use it
- If frequency-based, calculate from frequency × months in audit period
- If per-occurrence, ask the user for population size

## Step 2: Select Sample Items

### Selection Method

1. **Random selection** (default for statistical and large frequency-based):
   - Generate random numbers using Bash:
   ```bash
   # Generate N random numbers between 1 and POPULATION_SIZE
   shuf -i 1-POPULATION_SIZE -n SAMPLE_SIZE | sort -n
   ```
   - Map random numbers to specific population items

2. **Systematic selection** (for time-based populations):
   - Calculate interval: population_size ÷ sample_size
   - Select random start, then every nth item
   - Ensure period coverage across the full audit period

3. **For frequency-based controls:**
   - Spread selections across the audit period
   - For monthly controls (sample 3-5): select specific months ensuring period coverage
   - For weekly controls: spread across all quarters
   - For daily controls: spread across all months

### Period Coverage Check

Verify the selected items provide adequate period coverage:
- Items should span the full audit period
- No more than ~25% of items from any single quarter
- For high-risk controls, ensure every quarter is represented

If coverage is inadequate, re-select to ensure distribution.

## Step 3: Present Sample for Confirmation

Present the sampling parameters and selected items to the auditor:

"Sampling Plan for {{CONTROL_ID}} — {{CONTROL_DESC}}:

Method: {{METHOD}}
Population: {{POP_SIZE}} ({{FREQUENCY}}, {{PERIOD}})
Sample Size: {{SAMPLE_SIZE}}
Risk Level: {{RISK_LEVEL}}
Confidence: {{CONFIDENCE}}%
Tolerable Deviation: {{TOLERABLE}}%

Selected Items:
[Table of selected items with identifiers/dates]

Period Coverage:
[Quarter breakdown]

Confirm this sampling plan? (yes / adjust)"

**GATE: Auditor must confirm the sampling plan.**

If the auditor requests adjustments (different sample size, different items, additional selections), accommodate and re-present.

## Step 4: Write Sampling Memo

Create the workpaper directory if it doesn't exist:
```bash
mkdir -p .audit/workpapers/{CONTROL_ID}
```

Using the sampling memo template, write `.audit/workpapers/{CONTROL_ID}/SAMPLING-MEMO.md`:
- Control information
- Population description and source
- Sampling parameters (method, size, confidence, rates)
- Period coverage analysis
- Selected items table
- Preparer sign-off

## Step 5: Update STATE.md

Update `.audit/STATE.md` to reflect sampling progress.

## Step 6: Display Summary

```
Sampling Memo Created

Control: {{CONTROL_ID}} — {{CONTROL_DESC}}
Method: {{METHOD}}
Sample Size: {{SAMPLE_SIZE}}
Items Selected: [list of identifiers/dates]

File Created:
  .audit/workpapers/{{CONTROL_ID}}/SAMPLING-MEMO.md

Next step: Run /soc2-test {{CONTROL_ID}} to begin testing this control
```

</process>

<guidelines>
- NEVER skip the auditor confirmation gate — sampling decisions require professional judgment
- For Type I engagements, all sample sizes are 1 — this is a design walkthrough, not operating effectiveness
- IT automated controls require ITGC validation in addition to the single-instance test
- When population size is uncertain, ask the auditor rather than guessing
- Random number generation must be reproducible — document the method used
- Period coverage is critical — a sample clustered in one month is insufficient for a 12-month period
- If "all" is specified, process each control sequentially with individual confirmation gates
- Management review controls (high judgment) should get 1.5-2x the standard sample size
- If the control matrix shows a control as already tested, warn and ask whether to re-sample
</guidelines>
