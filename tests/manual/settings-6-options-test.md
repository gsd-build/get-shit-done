# Manual Test: Settings Command Shows All 6 Options

**Status:** ✅ PASSING (after fix)

## Test Objective
Verify that `/gsd:settings` command displays all 6 configuration options to the user.

## Expected Behavior
When running `/gsd:settings`, user should be presented with 6 interactive questions:
1. Model Profile (Quality/Balanced/Budget)
2. Research (Yes/No)
3. Plan Check (Yes/No)
4. Verifier (Yes/No)
5. TDD Workflow (Yes/No) ⚠️ **MISSING**
6. Security Compliance (none/soc2/hipaa) ⚠️ **MISSING**

## Actual Behavior (BEFORE FIX)
Only 4 options displayed:
1. Model ✓
2. Research ✓
3. Plan Check ✓
4. Verifier ✓
5. TDD ❌ NOT SHOWN
6. Security ❌ NOT SHOWN

## Actual Behavior (AFTER FIX)
All 6 options displayed in 2 rounds:

**Round 1:**
1. Model ✓
2. Research ✓
3. Plan Check ✓
4. Verifier ✓

**Round 2:**
5. TDD ✓
6. Security ✓

## Root Cause
`AskUserQuestion` tool has a per-call limit of ~4-5 questions. `settings.md` attempts to pass all 6 questions in a single `AskUserQuestion([...])` call, causing questions #5 and #6 to be silently truncated.

## Test Steps
1. Initialize a GSD project: `/gsd:new-project`
2. Run `/gsd:settings`
3. Count the number of interactive questions presented
4. Verify TDD and Security options are visible

## Success Criteria
- [ ] All 6 questions are displayed
- [ ] Questions appear in 2 rounds (following new-project.md pattern)
- [ ] Round 1: Model, Research, Plan Check, Verifier (4 questions)
- [ ] Round 2: TDD, Security (2 questions)
- [ ] Config.json is updated with all 6 settings

## Verification Commands
```bash
# After running /gsd:settings, verify config contains all fields:
cat .planning/config.json | grep -E '(model_profile|security_compliance|workflow)'

# Expected output should include:
# "model_profile": "...",
# "security_compliance": "...",
# "workflow": { "research": ..., "plan_check": ..., "verifier": ..., "tdd": ... }
```

## Related Files
- `/commands/gsd/settings.md` - Command definition (needs fix)
- `/commands/gsd/new-project.md` - Reference implementation (2-round pattern)
- `/.planning/config.json` - Config file to update
