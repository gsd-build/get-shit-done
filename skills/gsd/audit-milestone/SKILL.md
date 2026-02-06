---
name: audit-milestone
description: Audit milestone completion against original intent before archiving
license: MIT
metadata:
  author: get-shit-done
  version: "1.0"
  category: project-management
allowed-tools: 
---

# audit-milestone Skill

## Objective

Verify milestone achieved its definition of done. Check requirements coverage, cross-phase integration, and end-to-end flows.
**This command IS the orchestrator.** Reads existing VERIFICATION.md files (phases already verified during execute-phase), aggregates tech debt and deferred gaps, then spawns integration checker for cross-phase wiring.

## When to Use



## Process

## 0. Resolve Model Profile
Read model profile for agent spawning:
```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```
Default to "balanced" if not set.
**Model lookup table:**
| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-integration-checker | sonnet | sonnet | haiku |
Store resolved model for use in Task call below.
## 1. Determine Milestone Scope
```bash
# Get phases in milestone
ls -d .planning/phases/*/ | sort -V
```
- Parse version from arguments or detect current from ROADMAP.md
- Identify all phase directories in scope
- Extract milestone definition of done from ROADMAP.md
- Extract requirements mapped to this milestone from REQUIREMENTS.md
## 2. Read All Phase Verifications
For each phase directory, read the VERIFICATION.md:
```bash
cat .planning/phases/01-*/*-VERIFICATION.md
cat .planning/phases/02-*/*-VERIFICATION.md
# etc.
```
From each VERIFICATION.md, extract:
- **Status:** passed | gaps_found
- **Critical gaps:** (if any — these are blockers)
- **Non-critical gaps:** tech debt, deferred items, warnings
- **Anti-patterns found:** TODOs, stubs, placeholders
- **Requirements coverage:** which requirements satisfied/blocked
If a phase is missing VERIFICATION.md, flag it as "unverified phase" — this is a blocker.

## Success Criteria

- [ ] Milestone scope identified
- [ ] All phase VERIFICATION.md files read
- [ ] Tech debt and deferred gaps aggregated
- [ ] Integration checker spawned for cross-phase wiring
- [ ] v{version}-MILESTONE-AUDIT.md created
- [ ] Results presented with actionable next steps

## Examples

### Example Usage
[TBD: Add specific examples of when and how to use this skill]

## Error Handling

- If required files are missing: Display clear error messages with setup instructions
- If arguments are invalid: Show usage examples and exit gracefully
- If operations fail: Provide detailed error information and suggest remedies
