# Task Timeout Utility

Reusable pattern for Task() calls with graceful degradation when agents run longer than expected.

## Limitation Notice

**Task() has no native timeout parameter.** This utility provides:
- Expected duration documentation
- Artifact-based success detection
- User guidance when agents run long
- Post-execution timing analysis

**Does NOT provide:**
- Hard timeout enforcement (not possible with current API)
- Ability to interrupt hung agents

See `.planning/phases/01-timeout-infrastructure/01-01-DISCOVERY.md` for investigation details.

---

## Timeout Wrapper Pattern

Wrap each Task() call with timing, artifact checking, and user communication:

```markdown
# Define expectations before Task()
AGENT_TYPE="gsd-executor"
EXPECTED_DURATION_MS=600000  # 10 minutes
EXPECTED_ARTIFACTS=(
  ".planning/phases/XX-name/XX-YY-SUMMARY.md"
  ".planning/STATE.md"
)

# Log start for user visibility
echo "Starting ${AGENT_TYPE} agent..."
echo "Expected duration: $((EXPECTED_DURATION_MS / 60000)) minutes"
echo "Expected outputs: ${EXPECTED_ARTIFACTS[@]}"
START_TIME=$(date +%s)

# Execute Task (blocks until complete)
Task(prompt="...", subagent_type="${AGENT_TYPE}", model="...")

# Measure and report
END_TIME=$(date +%s)
ACTUAL_DURATION_MS=$(( (END_TIME - START_TIME) * 1000 ))

# Check artifacts
check_artifacts() {
  local all_exist=true
  for artifact in "${EXPECTED_ARTIFACTS[@]}"; do
    if [[ ! -f "$artifact" ]]; then
      echo "Missing artifact: $artifact"
      all_exist=false
    fi
  done
  echo "$all_exist"
}

ARTIFACTS_EXIST=$(check_artifacts)

# Report status
if [[ $ACTUAL_DURATION_MS -gt $EXPECTED_DURATION_MS ]]; then
  if [[ "$ARTIFACTS_EXIST" == "true" ]]; then
    echo "⚠️  Agent took longer than expected but completed successfully"
    echo "   Expected: $((EXPECTED_DURATION_MS / 1000))s, Actual: $((ACTUAL_DURATION_MS / 1000))s"
  else
    echo "❌ Agent exceeded expected duration and did not produce artifacts"
    echo "   Expected: $((EXPECTED_DURATION_MS / 1000))s, Actual: $((ACTUAL_DURATION_MS / 1000))s"
    exit 1
  fi
else
  if [[ "$ARTIFACTS_EXIST" == "true" ]]; then
    echo "✅ Agent completed successfully in $((ACTUAL_DURATION_MS / 1000))s"
  else
    echo "❌ Agent completed but did not produce expected artifacts"
    exit 1
  fi
fi
```

**Key points:**
- Task() still blocks until agent completes (no way to interrupt)
- Timing provides visibility and warnings, not enforcement
- Artifact checking determines actual success/failure
- Users can Ctrl+C if Task() blocks too long and manually check artifacts

---

## Artifact Check Function

Pattern for verifying agent produced expected outputs:

```bash
check_artifacts() {
  local expected_artifacts=("$@")
  local now=$(date +%s)
  local max_age_seconds=600  # 10 minutes

  for artifact in "${expected_artifacts[@]}"; do
    if [[ ! -f "$artifact" ]]; then
      echo "artifacts_missing"
      return 1
    fi

    # Check if file is recent (modified in last max_age_seconds)
    local file_mtime=$(stat -c %Y "$artifact" 2>/dev/null || echo 0)
    local age=$((now - file_mtime))

    if [[ $age -gt $max_age_seconds ]]; then
      echo "artifacts_stale"
      return 2
    fi
  done

  echo "artifacts_exist"
  return 0
}

# Usage:
EXPECTED_ARTIFACTS=(
  ".planning/phases/01-timeout/01-01-SUMMARY.md"
  ".planning/STATE.md"
)

STATUS=$(check_artifacts "${EXPECTED_ARTIFACTS[@]}")

case "$STATUS" in
  artifacts_exist)
    echo "✅ All expected artifacts exist and are recent"
    ;;
  artifacts_missing)
    echo "❌ Some expected artifacts are missing"
    ;;
  artifacts_stale)
    echo "⚠️  Artifacts exist but are stale (may be from previous run)"
    ;;
esac
```

**Return codes:**
- `artifacts_exist` (0): All files exist and modified within max_age_seconds
- `artifacts_missing` (1): One or more files don't exist
- `artifacts_stale` (2): Files exist but are older than max_age_seconds

---

## Timeout Defaults Table

Recommended expected durations by agent type:

| Agent Type | Expected Duration | Rationale |
|------------|-------------------|-----------|
| `gsd-executor` | 600000ms (10 min) | Complex plans with multiple tasks, commits, file operations |
| `gsd-planner` | 300000ms (5 min) | Planning is faster than execution, mostly reading and writing markdown |
| `gsd-verifier` | 180000ms (3 min) | Verification reads files and checks criteria, quick operation |
| `gsd-researcher` | 420000ms (7 min) | Research involves exploration, reading multiple files, synthesis |
| `gsd-debugger` | 600000ms (10 min) | Debugging requires investigation, testing hypotheses, longer duration |
| `general-purpose` | 300000ms (5 min) | Default for unspecified agent types |

**Configuration override:**
These are defaults. Users can configure custom durations in `.planning/config.json` (see Config Integration below).

**When to adjust defaults:**
- Complex plans: Add 50-100% to executor duration
- Large codebases: Add 50% to researcher duration
- Deep debugging: Add 100% to debugger duration

---

## User Message Templates

### Agent Running (at start)
```
Starting {agent-type} agent...
Expected duration: {N} minutes
Expected outputs:
  - {artifact-1}
  - {artifact-2}

⏳ Task in progress...
```

### Success Within Expected Time
```
✅ {agent-type} completed successfully
   Duration: {actual}s (expected: {expected}s)
   Artifacts: All present
```

### Success But Slow
```
⚠️  {agent-type} took longer than expected but completed successfully
   Expected: {expected}s, Actual: {actual}s
   Artifacts: All present

   Note: Consider increasing timeout config for this agent type if this happens frequently.
```

### Failure - No Artifacts
```
❌ {agent-type} did not produce expected artifacts
   Duration: {actual}s
   Missing:
     - {artifact-1}
     - {artifact-2}

   This indicates the agent failed to complete its task.
```

### Failure - Exceeded Time And No Artifacts
```
❌ {agent-type} exceeded expected duration and did not produce artifacts
   Expected: {expected}s, Actual: {actual}s
   Missing:
     - {artifact-1}
     - {artifact-2}

   The agent may have hung or encountered an error. Check logs for details.
```

### User Interrupted (Ctrl+C)
```
⚠️  Task interrupted by user
   Checking for partial work...

   Artifacts found:
     ✅ {artifact-1}
     ❌ {artifact-2} (missing)

   The agent may have completed some work. Review artifacts and decide:
   - If sufficient: Continue with next step
   - If incomplete: Re-run the agent
```

---

## Config Integration

Read custom timeout values from `.planning/config.json`:

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

**Shell implementation:**

```bash
# Read timeout from config, fall back to defaults
read_timeout_config() {
  local agent_type=$1
  local default_ms=$2
  local config_file=".planning/config.json"

  if [[ -f "$config_file" ]]; then
    local timeout=$(grep -o "\"${agent_type}\"[[:space:]]*:[[:space:]]*[0-9]*" "$config_file" | grep -o '[0-9]*')
    if [[ -n "$timeout" ]]; then
      echo "$timeout"
      return
    fi
  fi

  echo "$default_ms"
}

# Usage example:
EXECUTOR_TIMEOUT=$(read_timeout_config "executor" 600000)
PLANNER_TIMEOUT=$(read_timeout_config "planner" 300000)

echo "Using executor timeout: ${EXECUTOR_TIMEOUT}ms"
```

**Default values** (if config doesn't exist or doesn't specify):
- executor: 600000ms (10 min)
- planner: 300000ms (5 min)
- verifier: 180000ms (3 min)
- researcher: 420000ms (7 min)
- debugger: 600000ms (10 min)
- default: 300000ms (5 min)

**Config validation:**
- Minimum timeout: 60000ms (1 minute) - prevent unrealistic expectations
- Maximum timeout: 1800000ms (30 minutes) - prevent indefinite waiting
- Invalid values: Fall back to defaults with warning

---

## Complete Example

Putting it all together for an executor agent:

```bash
#!/bin/bash

# 1. Read timeout configuration
read_timeout_config() {
  local agent_type=$1
  local default_ms=$2
  local config_file=".planning/config.json"

  if [[ -f "$config_file" ]]; then
    local timeout=$(grep -o "\"${agent_type}\"[[:space:]]*:[[:space:]]*[0-9]*" "$config_file" | grep -o '[0-9]*')
    if [[ -n "$timeout" ]]; then
      echo "$timeout"
      return
    fi
  fi

  echo "$default_ms"
}

# 2. Define expectations
AGENT_TYPE="gsd-executor"
EXPECTED_DURATION_MS=$(read_timeout_config "executor" 600000)
EXPECTED_ARTIFACTS=(
  ".planning/phases/01-timeout/01-01-SUMMARY.md"
  ".planning/STATE.md"
)

# 3. Inform user
echo "Starting ${AGENT_TYPE} agent..."
echo "Expected duration: $((EXPECTED_DURATION_MS / 60000)) minutes"
echo "Expected outputs:"
for artifact in "${EXPECTED_ARTIFACTS[@]}"; do
  echo "  - $artifact"
done
echo ""
echo "⏳ Task in progress..."

# 4. Execute Task
START_TIME=$(date +%s)

Task(prompt="Execute plan at .planning/phases/01-timeout/01-01-PLAN.md

Plan:
{plan-content}

Project state:
{state-content}", subagent_type="gsd-executor", model="sonnet")

# 5. Measure duration
END_TIME=$(date +%s)
ACTUAL_DURATION_MS=$(( (END_TIME - START_TIME) * 1000 ))

# 6. Check artifacts
check_artifacts() {
  local all_exist=true
  for artifact in "${EXPECTED_ARTIFACTS[@]}"; do
    if [[ ! -f "$artifact" ]]; then
      echo "Missing: $artifact" >&2
      all_exist=false
    fi
  done
  echo "$all_exist"
}

ARTIFACTS_EXIST=$(check_artifacts)

# 7. Report status
echo ""
if [[ $ACTUAL_DURATION_MS -gt $EXPECTED_DURATION_MS ]]; then
  if [[ "$ARTIFACTS_EXIST" == "true" ]]; then
    echo "⚠️  Agent took longer than expected but completed successfully"
    echo "   Expected: $((EXPECTED_DURATION_MS / 1000))s, Actual: $((ACTUAL_DURATION_MS / 1000))s"
    echo "   Artifacts: All present"
    echo ""
    echo "   Consider increasing 'executor' timeout in .planning/config.json"
  else
    echo "❌ Agent exceeded expected duration and did not produce artifacts"
    echo "   Expected: $((EXPECTED_DURATION_MS / 1000))s, Actual: $((ACTUAL_DURATION_MS / 1000))s"
    check_artifacts  # Will print missing artifacts
    exit 1
  fi
else
  if [[ "$ARTIFACTS_EXIST" == "true" ]]; then
    echo "✅ Agent completed successfully"
    echo "   Duration: $((ACTUAL_DURATION_MS / 1000))s (expected: $((EXPECTED_DURATION_MS / 1000))s)"
    echo "   Artifacts: All present"
  else
    echo "❌ Agent completed but did not produce expected artifacts"
    echo "   Duration: $((ACTUAL_DURATION_MS / 1000))s"
    check_artifacts  # Will print missing artifacts
    exit 1
  fi
fi
```

---

## Requirements Satisfied

This pattern satisfies the following requirements:

- **TMO-01**: Expected duration defaults documented for all agent types
- **TMO-02**: Graceful handling - success determined by artifacts, not just duration
- **TMO-03**: If artifacts exist, report success even if duration exceeded
- **TMO-04**: Configuration option in `.planning/config.json` to adjust expected durations
- **TMO-05**: Clear user messages at start, during, and after execution
- **ART-01**: On duration exceeded, check if expected output files exist
- **ART-02**: If artifacts exist, report success with warning

**Not satisfied** (due to API limitations):
- Hard timeout enforcement - Task() has no timeout parameter
- Ability to interrupt hung agents - would require API changes

---

## Integration Checklist

When adding this pattern to a command or workflow:

- [ ] Add reference: `@~/.claude/get-shit-done/utilities/task-timeout.md`
- [ ] Define EXPECTED_ARTIFACTS array for each Task() call
- [ ] Read timeout config at command start
- [ ] Add user message before Task() execution
- [ ] Start timing before Task()
- [ ] Call Task() as usual (no API changes)
- [ ] Measure duration after Task()
- [ ] Check artifacts with check_artifacts()
- [ ] Report status with appropriate template
- [ ] Exit with proper code (0 = success, 1 = failure)
