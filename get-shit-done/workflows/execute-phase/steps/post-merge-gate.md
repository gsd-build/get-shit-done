# Step: post_merge_gate

Post-merge build & test gate. Runs after all worktrees in a wave are merged
(parallel mode), or after the last plan completes (serial mode). Catches
cross-plan integration failures that individual worktree self-checks cannot
detect.

**Step A — Build gate:**

```bash
# Resolve build command: project config > Xcode > Makefile > language sniff
BUILD_CMD=$(gsd-sdk query config-get workflow.build_command --default "" 2>/dev/null || true)
if [ -z "$BUILD_CMD" ]; then
  XCODEPROJ=$(find . -maxdepth 2 -name "*.xcodeproj" -not -path "*/node_modules/*" 2>/dev/null | head -1)
  if [ -n "$XCODEPROJ" ]; then
    # Xcode project: get first scheme from xcodebuild -list -json
    XCODE_SCHEME=$(xcodebuild -list -json -project "$XCODEPROJ" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('project',{}).get('schemes',[None])[0] or '')" 2>/dev/null || true)
    if [ -n "$XCODE_SCHEME" ]; then
      BUILD_CMD="xcodebuild build -scheme '$XCODE_SCHEME' -destination 'platform=iOS Simulator,name=iPhone 16'"
    else
      BUILD_CMD="xcodebuild build -destination 'platform=iOS Simulator,name=iPhone 16'"
    fi
  elif [ -f "Makefile" ] && grep -q "^build:" Makefile; then
    BUILD_CMD="make build"
  elif [ -f "Justfile" ] || [ -f "justfile" ]; then
    BUILD_CMD="just build"
  elif [ -f "Cargo.toml" ]; then
    BUILD_CMD="cargo build"
  elif [ -f "go.mod" ]; then
    BUILD_CMD="go build ./..."
  elif [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
    BUILD_CMD="python -m py_compile $(find . -name '*.py' -not -path './.planning/*' -not -path './node_modules/*' | head -20 | tr '\n' ' ')"
  elif [ -f "package.json" ] && grep -q '"build"' package.json; then
    BUILD_CMD="npm run build"
  else
    BUILD_CMD=""
    echo "⚠ No build command detected — skipping build gate"
  fi
fi
# Run build with 5-minute timeout
BUILD_EXIT=0
if [ -n "$BUILD_CMD" ]; then
  timeout 300 bash -c "$BUILD_CMD" 2>&1
  BUILD_EXIT=$?
  if [ "${BUILD_EXIT}" -eq 0 ]; then
    echo "✓ Post-merge build gate passed"
  elif [ "${BUILD_EXIT}" -eq 124 ]; then
    echo "⚠ Post-merge build gate timed out after 5 minutes"
  else
    echo "✗ Post-merge build gate failed (exit code ${BUILD_EXIT})"
    WAVE_FAILURE_COUNT=$((WAVE_FAILURE_COUNT + 1))
  fi
fi
```

**If `BUILD_EXIT` is 0 (pass):** `✓ Build gate passed` → proceed to Test gate.

**If `BUILD_EXIT` is 124 (timeout):** Log warning, treat as non-blocking, continue to Test gate.

**If `BUILD_EXIT` is non-zero (build failure):** Increment `WAVE_FAILURE_COUNT` (same semantics as test failures). Present failure output and offer "Fix now" or "Continue" options (same as step 5.8).

**Step B — Test gate:**

```bash
# Resolve test command: project config > Xcode > Makefile > language sniff
TEST_CMD=$(gsd-sdk query config-get workflow.test_command --default "" 2>/dev/null || true)
if [ -z "$TEST_CMD" ]; then
  XCODEPROJ=$(find . -maxdepth 2 -name "*.xcodeproj" -not -path "*/node_modules/*" 2>/dev/null | head -1)
  if [ -n "$XCODEPROJ" ]; then
    # Xcode project: reuse scheme detected above (or re-detect)
    if [ -z "${XCODE_SCHEME:-}" ]; then
      XCODE_SCHEME=$(xcodebuild -list -json -project "$XCODEPROJ" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('project',{}).get('schemes',[None])[0] or '')" 2>/dev/null || true)
    fi
    if [ -n "$XCODE_SCHEME" ]; then
      TEST_CMD="xcodebuild test -scheme '$XCODE_SCHEME' -destination 'platform=iOS Simulator,name=iPhone 16'"
    else
      TEST_CMD="xcodebuild test -destination 'platform=iOS Simulator,name=iPhone 16'"
    fi
  elif [ -f "Makefile" ] && grep -q "^test:" Makefile; then
    TEST_CMD="make test"
  elif [ -f "Justfile" ] || [ -f "justfile" ]; then
    TEST_CMD="just test"
  elif [ -f "package.json" ]; then
    TEST_CMD="npm test"
  elif [ -f "Cargo.toml" ]; then
    TEST_CMD="cargo test"
  elif [ -f "go.mod" ]; then
    TEST_CMD="go test ./..."
  elif [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
    TEST_CMD="python -m pytest -x -q --tb=short 2>&1 || uv run python -m pytest -x -q --tb=short"
  else
    TEST_CMD="true"
    echo "⚠ No test runner detected — skipping post-merge test gate"
  fi
fi
# Run test suite with 5-minute timeout
TEST_EXIT=0
timeout 300 bash -c "$TEST_CMD" 2>&1
TEST_EXIT=$?
if [ "${TEST_EXIT}" -eq 0 ]; then
  echo "✓ Post-merge test gate passed — no cross-plan conflicts"
elif [ "${TEST_EXIT}" -eq 124 ]; then
  echo "⚠ Post-merge test gate timed out after 5 minutes"
else
  echo "✗ Post-merge test gate failed (exit code ${TEST_EXIT})"
  WAVE_FAILURE_COUNT=$((WAVE_FAILURE_COUNT + 1))
fi
```

**If `TEST_EXIT` is 0 (pass):** `✓ Post-merge test gate: {N} tests passed — no cross-plan conflicts` → continue to orchestrator tracking update.

**If `TEST_EXIT` is 124 (timeout):** Log warning, treat as non-blocking, continue. Tests may need a longer budget or manual run.

**If `TEST_EXIT` is non-zero (test failure):** Increment `WAVE_FAILURE_COUNT` to track
cumulative failures across waves. Subsequent waves should report:
`⚠ Note: ${WAVE_FAILURE_COUNT} prior wave(s) had test failures`
