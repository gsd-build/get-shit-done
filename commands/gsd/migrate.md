---
name: gsd:migrate
description: Migrate v1.x projects to v2.0 format
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Migrate existing v1.x GSD projects to v2.0 format with optimization features.

Adds version tracking, optimization settings, and enhanced parallelization options to existing projects. Safe migration with automatic backups.
</objective>

<process>

## Phase 1: Detection

**Check for existing project:**

```bash
ls .planning/config.json 2>/dev/null
```

**If not found:**
```
╔═══════════════════════════════════════════════════════════╗
║  GSD Migration                                            ║
╚═══════════════════════════════════════════════════════════╝

❌ No GSD project found in current directory.

This command migrates existing v1.x projects to v2.0 format.

To initialize a new v2.0 project: /gsd:new-project
```

STOP here if no project found.

**Read current config:**

```bash
cat .planning/config.json
```

Parse the JSON to check for:
1. `gsd_version` field
2. `optimization` section (required for complete v2.0 config)

**If gsd_version exists and >= 2.0.0 AND optimization section exists:**
```
╔═══════════════════════════════════════════════════════════╗
║  GSD Migration                                            ║
╚═══════════════════════════════════════════════════════════╝

✓ Project is already on v2.0 format.

Current version: {gsd_version}

No migration needed.
```

STOP here if already migrated.

**If gsd_version >= 2.0.0 BUT optimization section is MISSING:**

This is an incomplete migration (possibly manual edit or corruption). Continue to analysis phase to add missing sections.

**If gsd_version is missing or < 2.0.0:**

Continue to analysis phase.

## Phase 2: Analysis

Display banner:
```
╔═══════════════════════════════════════════════════════════╗
║  GSD Migration: v1.x → v2.0                               ║
╚═══════════════════════════════════════════════════════════╝

Analyzing project structure...
```

**Check .planning/ structure:**

```bash
ls -la .planning/
```

Identify key files:
- [ ] config.json exists
- [ ] PROJECT.md exists (optional but expected)
- [ ] ROADMAP.md exists (optional but expected)
- [ ] REQUIREMENTS.md exists (optional but expected)
- [ ] STATE.md exists (optional but expected)

**Validate config.json format:**

Parse current config.json and check for required v1 fields:
- `mode` (interactive/yolo)
- `depth` (quick/standard/comprehensive)
- `workflow` object with research/plan_check/verifier flags
- `model_profile` (quality/balanced/budget)

**Present analysis:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MIGRATION ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Status:
  GSD Version: {detected_version or "v1.x (unversioned)"}
  Project Files: {count} found
  Config Valid: {yes/no}

Files Detected:
  ✓ config.json
  {✓/✗} PROJECT.md
  {✓/✗} ROADMAP.md
  {✓/✗} REQUIREMENTS.md
  {✓/✗} STATE.md

Migration Will:
  1. Backup config.json → config.json.v1.backup
  2. Add gsd_version: "2.0.0"
  3. Add optimization section with defaults
  4. Add enhanced parallelization settings
  5. Add granular gate controls
  6. Preserve all existing settings
  7. Validate updated config parses correctly

Your existing workflow settings will be preserved:
  Mode: {current_mode}
  Depth: {current_depth}
  Model Profile: {current_profile}
  Workflow Agents: {current_workflow_flags}
```

## Phase 3: Migration Options

Use AskUserQuestion:
- header: "Migration"
- question: "How would you like to proceed?"
- multiSelect: false
- options:
  - "Migrate now (Recommended)" — Upgrade to v2.0 with automatic backup
  - "Show what will change" — Preview the new config.json structure
  - "Cancel" — Keep using v1.x format

**If "Cancel":** STOP here.

**If "Show what will change":**

Read current config.json and generate preview of migrated version:

```json
{
  "gsd_version": "2.0.0",

  // PRESERVED FROM v1.x
  "mode": "{current_mode}",
  "depth": "{current_depth}",
  "model_profile": "{current_profile}",

  "workflow": {
    "research": {current_research},
    "plan_check": {current_plan_check},
    "verifier": {current_verifier}
  },

  // NEW IN v2.0
  "optimization": {
    "level": "standard",
    "context_budget": {
      "enabled": true,
      "warn_threshold": 40,
      "suggest_split_threshold": 60,
      "critical_threshold": 75
    },
    "tiered_instructions": true,
    "delta_context": true,
    "lazy_references": true,
    "compact_workflows": true
  },

  "parallelization": {
    "enabled": {current_parallelization_enabled},
    "plan_level": true,
    "task_level": false,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },

  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_breakdown": true,
    "confirm_plan": true,
    "execute_next_plan": true,
    "issues_review": true,
    "confirm_transition": true
  },

  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  }
}
```

Display:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEW CONFIG STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Show full JSON above]

Key Changes:
  ✓ Version tracking added
  ✓ Optimization controls added
  ✓ Enhanced parallelization settings
  ✓ Granular gate controls
  ✓ Safety guardrails

All existing settings preserved ✓
```

Then re-ask migration question (loop back to options).

**If "Migrate now":** Continue to Phase 4.

## Phase 4: Migration Execution

Display progress banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MIGRATING TO v2.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ Creating backup...
```

**Step 1: Backup config.json**

```bash
cp .planning/config.json .planning/config.json.v1.backup
```

Verify backup created:
```bash
ls -la .planning/config.json.v1.backup
```

If backup fails, STOP and report error.

Display: `✓ Backup created: config.json.v1.backup`

**Step 2: Parse current config**

Read and parse `.planning/config.json` to extract:
- `mode` (default to "yolo" if missing)
- `depth` (default to "standard" if missing)
- `model_profile` (default to "balanced" if missing)
- `workflow.research` (default to true if missing)
- `workflow.plan_check` (default to true if missing)
- `workflow.verifier` (default to true if missing)
- `parallelization` (v1 used boolean, default to true if missing)
- `commit_docs` (if present, preserve)

**Step 3: Build migrated config**

Create new config structure preserving v1 values:

```json
{
  "gsd_version": "2.0.0",
  "mode": "{preserved_mode}",
  "depth": "{preserved_depth}",
  "model_profile": "{preserved_model_profile}",

  "workflow": {
    "research": {preserved_research},
    "plan_check": {preserved_plan_check},
    "verifier": {preserved_verifier}
  },

  "optimization": {
    "level": "standard",
    "context_budget": {
      "enabled": true,
      "warn_threshold": 40,
      "suggest_split_threshold": 60,
      "critical_threshold": 75
    },
    "tiered_instructions": true,
    "delta_context": true,
    "lazy_references": true,
    "compact_workflows": true
  },

  "parallelization": {
    "enabled": {preserved_parallelization_as_boolean},
    "plan_level": true,
    "task_level": false,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },

  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_breakdown": true,
    "confirm_plan": true,
    "execute_next_plan": true,
    "issues_review": true,
    "confirm_transition": true
  },

  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  },

  "commit_docs": {preserved_commit_docs_if_present}
}
```

Note: If `commit_docs` was not in v1 config, omit it from v2 config.

Display: `▶ Building new config...`

**Step 4: Write migrated config**

Write the new JSON to `.planning/config.json`.

Display: `✓ Config updated`

**Step 5: Validate migration**

Attempt to parse the new config.json:

```bash
cat .planning/config.json | python3 -m json.tool >/dev/null 2>&1 && echo "valid" || echo "invalid"
```

**If invalid:**
```
❌ Migration failed: Invalid JSON generated

Rolling back...
```

Restore backup:
```bash
cp .planning/config.json.v1.backup .planning/config.json
```

STOP with error.

**If valid:**

Display: `✓ Validation passed`

**Step 6: Commit migration (if git repo)**

Check if in git repo:
```bash
git rev-parse --git-dir >/dev/null 2>&1 && echo "yes" || echo "no"
```

**If yes:**
```bash
git add .planning/config.json .planning/config.json.v1.backup
git commit -m "$(cat <<'EOF'
chore: migrate to GSD v2.0 format

- Add version tracking (gsd_version: 2.0.0)
- Add optimization settings (level: standard)
- Add enhanced parallelization controls
- Add granular gate configuration
- Add safety guardrails
- Preserve all v1.x settings
- Create backup: config.json.v1.backup
EOF
)"
```

Display: `✓ Changes committed`

**If not in git repo:** Skip commit step.

## Phase 5: Success & Recommendations

Display completion banner:

```
╔═══════════════════════════════════════════════════════════╗
║  Migration Complete ✓                                     ║
╚═══════════════════════════════════════════════════════════╝

Your project is now on GSD v2.0!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CHANGES MADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Version tracking added
  gsd_version: "2.0.0"

✓ Optimization features enabled (level: standard)
  • Context budget tracking (warn at 40%, critical at 75%)
  • Tiered instruction loading
  • Delta context for updates
  • Lazy reference loading
  • Compact workflow templates

✓ Enhanced parallelization controls
  • Plan-level parallelization: ON
  • Max concurrent agents: 3
  • Minimum plans for parallel: 2

✓ Granular gate controls
  • All confirmation gates configured
  • Safety guardrails active

✓ All v1.x settings preserved
  • Mode: {current_mode}
  • Depth: {current_depth}
  • Model profile: {current_profile}
  • Workflow agents: {agents_summary}

✓ Backup created
  .planning/config.json.v1.backup

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 OPTIMIZATION SETTINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your project uses "standard" optimization:
  ✓ Balance between performance and context usage
  ✓ Suitable for most projects
  ✓ Context warnings at 40% usage
  ✓ Split suggestions at 60% usage

Other levels available:
  • minimal — Disable optimizations, maximum context
  • aggressive — Maximum optimizations, minimum context

Change anytime: /gsd:settings

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 NEXT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your project is ready to use with v2.0 features:

  /gsd:progress — Continue where you left off
  /gsd:settings — Customize optimization settings
  /gsd:help — See all v2.0 commands

New in v2.0:
  • Faster execution with parallel plans
  • Smart context management
  • Granular control over confirmations
  • Enhanced workflow agents

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  If you encounter issues, restore backup:
    cp .planning/config.json.v1.backup .planning/config.json

```

</process>

<success_criteria>
- [ ] Detected .planning/config.json exists
- [ ] Checked gsd_version field presence and value
- [ ] Skipped if already v2.0+
- [ ] Analyzed project structure validity
- [ ] Created backup: config.json.v1.backup
- [ ] Preserved all v1.x settings
- [ ] Added gsd_version: "2.0.0"
- [ ] Added optimization section with defaults
- [ ] Added enhanced parallelization settings
- [ ] Added granular gates configuration
- [ ] Added safety section
- [ ] Validated migrated JSON parses correctly
- [ ] Committed changes to git (if in repo)
- [ ] Displayed success summary with recommendations
- [ ] Provided rollback instructions
</success_criteria>
