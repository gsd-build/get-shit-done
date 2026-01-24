# Timeout Behavior

Understanding how GSD handles agent timeouts, what to expect when agents run long, and how to customize behavior.

## Overview

GSD agents (executors, planners, verifiers, etc.) are spawned using the Task() API to complete work. While these agents usually complete within expected durations, sometimes they run longer than anticipated.

**This document explains:**
- How timeout handling works (and what it can't do)
- What happens when agents exceed expected duration
- How artifact recovery ensures work isn't lost
- How to configure timeout behavior for your project

## The Reality: No Hard Timeout Enforcement

**Important:** The Task() API used to spawn GSD agents does not support native timeout enforcement. This means:

- **Agents cannot be automatically interrupted** if they exceed expected duration
- **Task() blocks until the agent completes** (or you press Ctrl+C)
- **GSD provides graceful degradation**, not hard limits

### What GSD Does Instead

GSD implements a **graceful degradation pattern** that:

1. **Sets expectations** - Shows expected duration before spawning agent
2. **Measures actual duration** - Tracks how long agent actually took
3. **Checks for artifacts** - Verifies agent produced expected outputs
4. **Reports status intelligently** - Success based on artifacts, not just timing

This approach handles the common case where an agent completes successfully but runs slower than expected, while still detecting failures where agents neither complete on time nor produce outputs.

## Expected Durations by Agent Type

Each agent type has a default expected duration based on its typical workload:

| Agent Type | Default Duration | When It Runs | Why This Duration |
|------------|-----------------|--------------|-------------------|
| **Executor** | 10 minutes | Executing PLAN.md files | Complex plans with multiple tasks, file operations, commits |
| **Planner** | 5 minutes | Creating PLAN.md files | Planning is faster than execution, mostly markdown |
| **Verifier** | 3 minutes | Verifying work meets requirements | Quick file reading and criteria checking |
| **Researcher** | 7 minutes | Researching domain before planning | Exploration, reading multiple files, synthesis |
| **Debugger** | 10 minutes | Diagnosing failures | Investigation, testing hypotheses, deeper analysis |
| **Default** | 5 minutes | Any unspecified agent type | Conservative middle ground |

**These are user guidance, not enforced limits.** Agents that exceed these durations may still complete successfully.

## What You See: Agent Lifecycle

### 1. Agent Starting

When GSD spawns an agent, you see:

```
Starting gsd-executor agent...
Expected duration: 10 minutes
Expected outputs:
  - .planning/phases/01-auth/01-01-SUMMARY.md
  - .planning/STATE.md

⏳ Task in progress...
```

This sets expectations and shows what artifacts the agent should produce.

### 2. While Agent Runs

The Task() call blocks. You see Claude's normal thinking/working output. If the agent exceeds expected duration, you'll still be waiting - there's no automatic interrupt.

**If agent hangs indefinitely:** Press Ctrl+C to interrupt manually. GSD will check for partial work.

### 3. Agent Completes

After Task() returns, GSD checks duration and artifacts, then reports status:

#### Success Within Expected Time
```
✅ gsd-executor completed successfully
   Duration: 487s (expected: 600s)
   Artifacts: All present
```

Agent completed on time with all outputs. Ideal case.

#### Success But Slow
```
⚠️  gsd-executor took longer than expected but completed successfully
   Expected: 600s, Actual: 847s
   Artifacts: All present

   Note: Consider increasing timeout config for this agent type if this happens frequently.
```

Agent completed but ran slow. Work is done, but you might want to adjust expectations.

#### Failure - No Artifacts
```
❌ gsd-executor did not produce expected artifacts
   Duration: 234s
   Missing:
     - .planning/phases/01-auth/01-01-SUMMARY.md

   This indicates the agent failed to complete its task.
```

Agent returned but didn't create expected outputs. Likely encountered an error.

#### Failure - Exceeded Time AND No Artifacts
```
❌ gsd-executor exceeded expected duration and did not produce artifacts
   Expected: 600s, Actual: 1847s
   Missing:
     - .planning/phases/01-auth/01-01-SUMMARY.md
     - .planning/STATE.md

   The agent may have hung or encountered an error. Check logs for details.
```

Agent ran very long and produced nothing. May have been stuck or failed repeatedly.

## Artifact Recovery: How Work Is Preserved

**Core principle:** Success is determined by artifact presence, not duration compliance.

### What Are Artifacts?

Artifacts are the expected outputs an agent should produce:

- **Executor agents:** SUMMARY.md, modified source files, commits
- **Planner agents:** PLAN.md files
- **Verifier agents:** VERIFICATION.md files
- **Researcher agents:** RESEARCH.md files

### How Recovery Works

After Task() completes, GSD:

1. **Checks if expected artifacts exist** - File presence on filesystem
2. **Validates freshness** - Files modified within last 10 minutes (not stale from previous run)
3. **Reports success if artifacts exist** - Even if duration exceeded

This means if an agent takes 15 minutes instead of 10 but completes the work, **you don't lose that work**. GSD recognizes success and lets you proceed.

### User Interruption (Ctrl+C)

If you interrupt an agent manually:

```
⚠️  Task interrupted by user
   Checking for partial work...

   Artifacts found:
     ✅ .planning/phases/01-auth/01-01-SUMMARY.md
     ❌ .planning/STATE.md (missing)

   The agent may have completed some work. Review artifacts and decide:
   - If sufficient: Continue with next step
   - If incomplete: Re-run the agent
```

GSD checks what the agent managed to complete before interruption. You can decide whether partial work is usable or if re-running is needed.

## When Timeouts Actually Matter

### Scenario 1: Agent Completes Slowly

**What happens:** Agent takes 15 minutes instead of 10, produces all artifacts

**Outcome:** ⚠️ Success with warning

**What to do:** Increase timeout config if this happens regularly

**Impact:** Minor - work completed, just took longer

### Scenario 2: Agent Fails Fast

**What happens:** Agent encounters error at 2 minutes, exits without artifacts

**Outcome:** ❌ Failure

**What to do:** Review logs, fix underlying issue, re-run

**Impact:** High - work not completed

### Scenario 3: Agent Hangs Indefinitely

**What happens:** Agent gets stuck, never returns

**Outcome:** You wait indefinitely until Ctrl+C

**What to do:** Interrupt manually, check partial work, investigate hang

**Impact:** High - blocks progress, requires manual intervention

**Note:** This is the case GSD cannot handle automatically due to API limitations.

### Scenario 4: Agent Exceeds Duration, No Artifacts

**What happens:** Agent runs 20 minutes, produces nothing

**Outcome:** ❌ Failure

**What to do:** Review logs, agent may have been stuck or repeatedly failing

**Impact:** High - time wasted, no progress made

## Configuring Timeouts

You can customize expected durations in `.planning/config.json`:

```json
{
  "timeouts": {
    "executor": 600000,
    "planner": 300000,
    "verifier": 180000,
    "researcher": 420000,
    "debugger": 600000,
    "default": 300000
  }
}
```

Values are in milliseconds.

### When to Adjust Timeouts

**Increase timeouts if:**
- Agents regularly complete successfully but exceed expected duration
- Your project is large/complex (increase all by 50-100%)
- Specific agent types consistently run longer (increase just those)

**Decrease timeouts if:**
- You want faster feedback on likely failures
- Your project is simple/small (decrease all by 30-50%)
- Running quick experiments (decrease all for faster iteration)

**Example: Large codebase project**
```json
{
  "timeouts": {
    "executor": 900000,     // 15 min (was 10)
    "researcher": 600000,   // 10 min (was 7)
    "planner": 420000       // 7 min (was 5)
  }
}
```

### Valid Ranges

- **Minimum:** 60000ms (1 minute) - Prevents unrealistic expectations
- **Maximum:** 1800000ms (30 minutes) - Prevents indefinite waiting
- **Invalid values:** Fall back to defaults with warning

See [Configuration Reference](configuration.md#timeouts) for complete details.

## Limitations and Workarounds

### What GSD Cannot Do

**Cannot prevent indefinite hangs**
- Task() API has no timeout parameter
- If agent truly hangs, GSD cannot interrupt it
- **Workaround:** Press Ctrl+C, check partial work

**Cannot guarantee completion within expected time**
- Timeouts are guidance, not enforcement
- Slow agents will take as long as they need
- **Workaround:** Adjust timeout config to match reality

**Cannot recover from agent crashes**
- If agent crashes without writing artifacts, work is lost
- GSD can detect this but cannot prevent it
- **Workaround:** Review logs, fix root cause, re-run

### What GSD Does Well

**Detects slow-but-successful agents**
- Reports completion even if duration exceeded
- Preserves work that was produced
- Provides guidance on config adjustment

**Validates agent output**
- Checks artifacts exist and are recent
- Distinguishes "slow success" from "failure"
- Prevents false positives from stale files

**Sets clear expectations**
- Shows expected duration before spawning
- Reports actual vs expected after completion
- Helps users understand normal vs abnormal behavior

## Best Practices

### For Project Owners

1. **Set realistic timeouts** based on your project complexity
2. **Monitor completion times** - If agents regularly exceed expectations, adjust config
3. **Investigate consistent slow agents** - May indicate underlying issues
4. **Keep config in version control** - Share timeout settings with team

### For GSD Users

1. **Trust the artifact check** - If GSD says success, artifacts exist
2. **Don't panic on timeout warnings** - Agent completed, just ran slow
3. **Investigate timeout failures** - These indicate real problems
4. **Use Ctrl+C when stuck** - If agent hasn't responded in 2x expected duration, interrupt

### For Integration

1. **Reference timeout utility** - Use `@~/.claude/get-shit-done/utilities/task-timeout.md` in custom commands
2. **Follow the pattern** - Start time, Task() call, end time, artifact check, status report
3. **Handle all outcomes** - Success, slow success, failure, interruption
4. **Log duration data** - Track actual vs expected for optimization

## Summary

**What timeouts are:** User expectations about how long agents should take

**What timeouts are not:** Hard limits that interrupt agents

**Success criteria:** Artifacts exist, regardless of duration

**When to intervene:** Agent hasn't responded in 2x expected duration

**How to customize:** Edit `.planning/config.json` timeouts section

**What to do on failure:** Review logs, check artifacts, investigate root cause, re-run

The timeout system provides **graceful degradation** and **artifact-based success detection**, not hard enforcement. It makes slow agents visible without losing successful work, and helps you understand when agents are truly failing vs just running slower than expected.
