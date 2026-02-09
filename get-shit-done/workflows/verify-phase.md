<purpose>
Verify phase goal achievement through goal-backward analysis. Check that the codebase delivers what the phase promised, not just that tasks completed.

Executed by a verification subagent spawned from execute-phase.md.
</purpose>

<core_principle>
**Task completion ≠ Goal achievement**

A task "create chat component" can be marked complete when the component is a placeholder. The task was done — but the goal "working chat interface" was not achieved.

Goal-backward verification:
1. What must be TRUE for the goal to be achieved?
2. What must EXIST for those truths to hold?
3. What must be WIRED for those artifacts to function?

Then verify each level against the actual codebase.
</core_principle>

<required_reading>
@~/.claude/get-shit-done/references/verification-patterns.md
@~/.claude/get-shit-done/templates/verification-report.md
</required_reading>

<process>

<step name="load_context" priority="first">
Load phase operation context:

```bash
INIT=$(node ~/.claude/get-shit-done/bin/gsd-tools.js init phase-op "${PHASE_ARG}")
```

Extract from init JSON: `phase_dir`, `phase_number`, `phase_name`, `has_plans`, `plan_count`.

Then load phase details and list plans/summaries:
```bash
node ~/.claude/get-shit-done/bin/gsd-tools.js roadmap get-phase "${phase_number}"
grep -E "^| ${phase_number}" .planning/REQUIREMENTS.md 2>/dev/null
ls "$phase_dir"/*-SUMMARY.md "$phase_dir"/*-PLAN.md 2>/dev/null
```

Extract **phase goal** from ROADMAP.md (the outcome to verify, not tasks) and **requirements** from REQUIREMENTS.md if it exists.
</step>

<step name="establish_must_haves">
**Option A: Must-haves in PLAN frontmatter**

Use gsd-tools to extract must_haves from each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  MUST_HAVES=$(node ~/.claude/get-shit-done/bin/gsd-tools.js frontmatter get "$plan" --field must_haves)
  echo "=== $plan ===" && echo "$MUST_HAVES"
done
```

Returns JSON: `{ truths: [...], artifacts: [...], key_links: [...] }`

Aggregate all must_haves across plans for phase-level verification.

**Option B: Derive from phase goal**

If no must_haves in frontmatter (MUST_HAVES returns error or empty):
1. State the goal from ROADMAP.md
2. Derive **truths** (3-7 observable behaviors, each testable)
3. Derive **artifacts** (concrete file paths for each truth)
4. Derive **key links** (critical wiring where stubs hide)
5. Document derived must-haves before proceeding
</step>

<step name="verify_truths">
For each observable truth, determine if the codebase enables it.

**Status:** ✓ VERIFIED (all supporting artifacts pass) | ✗ FAILED (artifact missing/stub/unwired) | ? UNCERTAIN (needs human)

For each truth: identify supporting artifacts → check artifact status → check wiring → determine truth status.

**Example:** Truth "User can see existing messages" depends on Chat.tsx (renders), /api/chat GET (provides), Message model (schema). If Chat.tsx is a stub or API returns hardcoded [] → FAILED. If all exist, are substantive, and connected → VERIFIED.
</step>

<step name="verify_artifacts">
Use gsd-tools for artifact verification against must_haves in each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  ARTIFACT_RESULT=$(node ~/.claude/get-shit-done/bin/gsd-tools.js verify artifacts "$plan")
  echo "=== $plan ===" && echo "$ARTIFACT_RESULT"
done
```

Parse JSON result: `{ all_passed, passed, total, artifacts: [{path, exists, issues, passed}] }`

**Artifact status from result:**
- `exists=false` → MISSING
- `issues` not empty → STUB (check issues for "Only N lines" or "Missing pattern")
- `passed=true` → VERIFIED (Levels 1-2 pass)

**Level 3 — Wired (manual check for artifacts that pass Levels 1-2):**
```bash
grep -r "import.*$artifact_name" src/ --include="*.ts" --include="*.tsx"  # IMPORTED
grep -r "$artifact_name" src/ --include="*.ts" --include="*.tsx" | grep -v "import"  # USED
```
WIRED = imported AND used. ORPHANED = exists but not imported/used.

| Exists | Substantive | Wired | Status |
|--------|-------------|-------|--------|
| ✓ | ✓ | ✓ | ✓ VERIFIED |
| ✓ | ✓ | ✗ | ⚠️ ORPHANED |
| ✓ | ✗ | - | ✗ STUB |
| ✗ | - | - | ✗ MISSING |
</step>

<step name="verify_wiring">
Use gsd-tools for key link verification against must_haves in each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  LINKS_RESULT=$(node ~/.claude/get-shit-done/bin/gsd-tools.js verify key-links "$plan")
  echo "=== $plan ===" && echo "$LINKS_RESULT"
done
```

Parse JSON result: `{ all_verified, verified, total, links: [{from, to, via, verified, detail}] }`

**Link status from result:**
- `verified=true` → WIRED
- `verified=false` with "not found" → NOT_WIRED
- `verified=false` with "Pattern not found" → PARTIAL

**Fallback patterns (if key_links not in must_haves):**

| Pattern | Check | Status |
|---------|-------|--------|
| Component → API | fetch/axios call to API path, response used (await/.then/setState) | WIRED / PARTIAL (call but unused response) / NOT_WIRED |
| API → Database | Prisma/DB query on model, result returned via res.json() | WIRED / PARTIAL (query but not returned) / NOT_WIRED |
| Form → Handler | onSubmit with real implementation (fetch/axios/mutate/dispatch), not console.log/empty | WIRED / STUB (log-only/empty) / NOT_WIRED |
| State → Render | useState variable appears in JSX (`{stateVar}` or `{stateVar.property}`) | WIRED / NOT_WIRED |

Record status and evidence for each key link.
</step>

<step name="verify_requirements">
If REQUIREMENTS.md exists:
```bash
grep -E "Phase ${PHASE_NUM}" .planning/REQUIREMENTS.md 2>/dev/null
```

For each requirement: parse description → identify supporting truths/artifacts → status: ✓ SATISFIED / ✗ BLOCKED / ? NEEDS HUMAN.
</step>

<step name="scan_antipatterns">
Extract files modified in this phase from SUMMARY.md, scan each:

| Pattern | Search | Severity |
|---------|--------|----------|
| TODO/FIXME/XXX/HACK | `grep -n -E "TODO\|FIXME\|XXX\|HACK"` | ⚠️ Warning |
| Placeholder content | `grep -n -iE "placeholder\|coming soon\|will be here"` | 🛑 Blocker |
| Empty returns | `grep -n -E "return null\|return \{\}\|return \[\]\|=> \{\}"` | ⚠️ Warning |
| Log-only functions | Functions containing only console.log | ⚠️ Warning |

Categorize: 🛑 Blocker (prevents goal) | ⚠️ Warning (incomplete) | ℹ️ Info (notable).
</step>

<step name="verify_quality">
**Check quality must_haves if present in plan frontmatter.**

```bash
# Check if any plan has quality requirements
grep -l "quality:" "$PHASE_DIR"/*-PLAN.md 2>/dev/null
```

If quality section exists in must_haves, verify each criterion.

### 0. Detect Project Type

```bash
detect_project_type() {
  if [ -f "package.json" ]; then
    echo "node"
  elif [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "requirements.txt" ]; then
    echo "python"
  elif [ -f "go.mod" ]; then
    echo "go"
  elif [ -f "Cargo.toml" ]; then
    echo "rust"
  elif [ -f "build.gradle" ] || [ -f "pom.xml" ]; then
    echo "java"
  elif ls *.csproj *.sln >/dev/null 2>&1; then
    echo "dotnet"
  else
    echo "unknown"
  fi
}

PROJECT_TYPE=$(detect_project_type)
```

### Test File Patterns by Project Type

| Type | Test Files | Test Pattern | Assertion Pattern |
|------|------------|--------------|-------------------|
| node | `*.test.ts`, `*.spec.js`, `__tests__/*` | `test\(`, `it\(`, `describe\(` | `expect\(`, `assert` |
| python | `test_*.py`, `*_test.py` | `def test_`, `class Test` | `assert`, `self.assert` |
| go | `*_test.go` | `func Test`, `func Benchmark` | `t.Error`, `t.Fatal`, `require.` |
| rust | `#[test]`, `tests/*.rs` | `#\[test\]`, `fn test_` | `assert!`, `assert_eq!` |
| java | `*Test.java`, `*Spec.java` | `@Test`, `void test` | `assert`, `assertEquals` |
| dotnet | `*Tests.cs`, `*Spec.cs` | `[Test]`, `[Fact]` | `Assert.` |

### 1. Find Test Files

```bash
find_test_files() {
  case "$PROJECT_TYPE" in
    node)
      find . -name "*.test.ts" -o -name "*.test.js" -o -name "*.spec.ts" -o -name "*.spec.js" | grep -v node_modules
      ;;
    python)
      find . -name "test_*.py" -o -name "*_test.py" | grep -v __pycache__ | grep -v venv
      ;;
    go)
      find . -name "*_test.go"
      ;;
    rust)
      find . -name "*.rs" -path "*/tests/*" -o -name "*.rs" -exec grep -l "#\[test\]" {} \;
      ;;
    java)
      find . -name "*Test.java" -o -name "*Spec.java"
      ;;
    dotnet)
      find . -name "*Tests.cs" -o -name "*Spec.cs"
      ;;
    *)
      find . -name "*test*" -o -name "*spec*" | head -20
      ;;
  esac
}
```

### 2. Test Category Existence

For TDD plans (`type: tdd`), verify all 4 test categories exist:

```bash
verify_test_categories() {
  local test_files="$1"
  local missing=()

  # Category patterns (language-agnostic keywords)
  local has_acceptance=$(echo "$test_files" | xargs grep -l -E "acceptance|should.*return|should.*create|happy.?path|success" 2>/dev/null | wc -l)
  local has_edge=$(echo "$test_files" | xargs grep -l -E "edge|null|empty|invalid|overflow|boundary|negative|zero|missing" 2>/dev/null | wc -l)
  local has_security=$(echo "$test_files" | xargs grep -l -E "security|injection|xss|csrf|auth|sanitiz|escap|permission|forbidden" 2>/dev/null | wc -l)
  local has_perf=$(echo "$test_files" | xargs grep -l -E "performance|benchmark|timeout|< ?[0-9]+.?ms|slow|fast|throughput" 2>/dev/null | wc -l)

  [ "$has_acceptance" -eq 0 ] && missing+=("acceptance")
  [ "$has_edge" -eq 0 ] && missing+=("edge_cases")
  [ "$has_security" -eq 0 ] && missing+=("security")
  [ "$has_perf" -eq 0 ] && missing+=("performance")

  if [ ${#missing[@]} -eq 0 ]; then
    echo "PASSED: All 4 test categories present"
  else
    echo "FAILED: Missing test categories: ${missing[*]}"
  fi
}
```

### 3. Per-Category Minimum Tests

```bash
verify_category_coverage() {
  local test_files="$1"
  local min_per_category=2

  # Count tests per category (language-agnostic)
  local acceptance=$(echo "$test_files" | xargs grep -c -E "acceptance|should.*return|should.*create|happy.?path" 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
  local edge=$(echo "$test_files" | xargs grep -c -E "null|empty|invalid|overflow|boundary|negative|missing" 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
  local security=$(echo "$test_files" | xargs grep -c -E "security|injection|xss|auth|sanitiz|permission" 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
  local perf=$(echo "$test_files" | xargs grep -c -E "performance|benchmark|timeout|throughput" 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')

  echo "Category coverage:"
  echo "  Acceptance: ${acceptance:-0} tests (min: $min_per_category)"
  echo "  Edge cases: ${edge:-0} tests (min: $min_per_category)"
  echo "  Security: ${security:-0} tests (min: $min_per_category)"
  echo "  Performance: ${perf:-0} tests (min: $min_per_category)"

  if [ "${acceptance:-0}" -ge "$min_per_category" ] && \
     [ "${edge:-0}" -ge "$min_per_category" ] && \
     [ "${security:-0}" -ge "$min_per_category" ] && \
     [ "${perf:-0}" -ge "$min_per_category" ]; then
    echo "PASSED: All categories meet minimum"
  else
    echo "FAILED: Some categories below minimum"
  fi
}
```

### 4. Test Quality Validation (Anti-Fake Tests)

Detect tests written to pass rather than to test:

```bash
verify_test_quality() {
  local test_files="$1"
  local fake_patterns=0
  local issues=()

  # Pattern 1: Always-true assertions (all languages)
  if echo "$test_files" | xargs grep -qE "expect\(true\)|assert True|assert\.True|assertTrue\(true\)|Assert\.True\(true\)" 2>/dev/null; then
    issues+=("Always-true assertions found")
    ((fake_patterns++))
  fi

  # Pattern 2: Empty test bodies
  if echo "$test_files" | xargs grep -qE "test.*\{\s*\}|def test_.*:\s*pass|fn test_.*\{\s*\}" 2>/dev/null; then
    issues+=("Empty test bodies found")
    ((fake_patterns++))
  fi

  # Pattern 3: No assertions - count tests vs assertions
  local test_count=$(echo "$test_files" | xargs grep -cE "test\(|it\(|def test_|func Test|#\[test\]|\@Test" 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
  local assert_count=$(echo "$test_files" | xargs grep -cE "expect\(|assert|Assert|should\.|require\.|t\.Error|t\.Fatal" 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
  if [ "${test_count:-0}" -gt 0 ] && [ "${assert_count:-0}" -lt "${test_count:-0}" ]; then
    issues+=("Some tests have no assertions ($assert_count assertions for $test_count tests)")
    ((fake_patterns++))
  fi

  # Pattern 4: Only existence checks without value verification
  local existence_only=$(echo "$test_files" | xargs grep -cE "toBeDefined|is not None|!= nil|\\.IsNotNull" 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
  local value_checks=$(echo "$test_files" | xargs grep -cE "toBe\(|toEqual\(|assertEqual|assert_eq|\.Equal\(|Equals\(" 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
  if [ "${existence_only:-0}" -gt 0 ] && [ "${value_checks:-0}" -eq 0 ]; then
    issues+=("Only existence checks without value verification")
    ((fake_patterns++))
  fi

  # Pattern 5: Excessive mocking
  local mock_count=$(echo "$test_files" | xargs grep -cE "mock\(|Mock\(|@patch|jest\.mock|vi\.mock|mockito" 2>/dev/null | awk -F: '{sum+=$2} END {print sum}')
  if [ "${mock_count:-0}" -gt "${test_count:-0}" ]; then
    issues+=("Excessive mocking - more mocks than tests")
    ((fake_patterns++))
  fi

  if [ "$fake_patterns" -eq 0 ]; then
    echo "PASSED: Tests appear to be genuine"
  else
    echo "FAILED: $fake_patterns fake test patterns detected:"
    for issue in "${issues[@]}"; do
      echo "  - $issue"
    done
  fi
}
```

### 5. Run Tests (Project-Agnostic)

```bash
run_tests() {
  case "$PROJECT_TYPE" in
    node)
      npm test 2>&1
      ;;
    python)
      pytest 2>&1 || python -m pytest 2>&1 || python -m unittest discover 2>&1
      ;;
    go)
      go test ./... 2>&1
      ;;
    rust)
      cargo test 2>&1
      ;;
    java)
      ./gradlew test 2>&1 || mvn test 2>&1
      ;;
    dotnet)
      dotnet test 2>&1
      ;;
    *)
      echo "Unknown project type - check test command in PROJECT.md"
      return 1
      ;;
  esac
}

verify_tests_pass() {
  run_tests
  local result=$?

  if [ $result -eq 0 ]; then
    echo "PASSED: All tests pass"
  else
    echo "FAILED: Tests are failing"
  fi
}
```

### 6. Test Coverage (Project-Agnostic)

```bash
verify_test_coverage() {
  local min_coverage="$1"
  local coverage=""

  case "$PROJECT_TYPE" in
    node)
      coverage=$(npm test -- --coverage --coverageReporters=text 2>/dev/null | grep "All files" | awk '{print $4}' | tr -d '%')
      ;;
    python)
      coverage=$(pytest --cov --cov-report=term 2>/dev/null | grep "TOTAL" | awk '{print $NF}' | tr -d '%')
      ;;
    go)
      coverage=$(go test -cover ./... 2>/dev/null | grep -oE "[0-9]+\.[0-9]+%" | head -1 | tr -d '%')
      ;;
    rust)
      # cargo-tarpaulin required
      coverage=$(cargo tarpaulin --out Stdout 2>/dev/null | grep -oE "[0-9]+\.[0-9]+%" | head -1 | tr -d '%')
      ;;
    java)
      # Extract from jacoco report
      coverage=$(find . -name "index.html" -path "*jacoco*" -exec grep -oE "Total[^0-9]*[0-9]+" {} \; | grep -oE "[0-9]+$" | head -1)
      ;;
    dotnet)
      coverage=$(dotnet test --collect:"XPlat Code Coverage" 2>/dev/null | grep -oE "Line coverage: [0-9.]+" | grep -oE "[0-9.]+")
      ;;
    *)
      echo "WARNING: Cannot determine coverage for $PROJECT_TYPE"
      return 0
      ;;
  esac

  if [ -n "$coverage" ] && [ "${coverage%.*}" -ge "$min_coverage" ]; then
    echo "PASSED: Coverage $coverage% >= $min_coverage%"
  else
    echo "FAILED: Coverage ${coverage:-unknown}% < $min_coverage%"
  fi
}
```

### 7. Security Tests (Project-Agnostic)

```bash
verify_security_tests() {
  local level="$1"
  local result=0

  case "$PROJECT_TYPE" in
    node)
      npm test -- --grep "security" 2>/dev/null || npm test -- --testNamePattern="security" 2>/dev/null
      result=$?
      ;;
    python)
      pytest -k "security" 2>/dev/null
      result=$?
      ;;
    go)
      go test -run ".*Security.*" ./... 2>/dev/null
      result=$?
      ;;
    rust)
      cargo test security 2>/dev/null
      result=$?
      ;;
    java)
      ./gradlew test --tests "*Security*" 2>/dev/null || mvn test -Dtest="*Security*" 2>/dev/null
      result=$?
      ;;
    dotnet)
      dotnet test --filter "FullyQualifiedName~Security" 2>/dev/null
      result=$?
      ;;
    *)
      echo "WARNING: Cannot run security tests for $PROJECT_TYPE"
      return 0
      ;;
  esac

  if [ $result -eq 0 ]; then
    echo "PASSED: Security tests pass for $level"
  else
    echo "FAILED: Security tests failing"
  fi
}
```

### 8. Vulnerability Scan (Project-Agnostic)

```bash
verify_no_vulnerabilities() {
  local critical=0
  local high=0

  case "$PROJECT_TYPE" in
    node)
      npm audit --json 2>/dev/null > /tmp/audit.json
      critical=$(grep -o '"critical":[0-9]*' /tmp/audit.json | head -1 | grep -o '[0-9]*')
      high=$(grep -o '"high":[0-9]*' /tmp/audit.json | head -1 | grep -o '[0-9]*')
      ;;
    python)
      # pip-audit or safety required
      pip-audit --format=json 2>/dev/null > /tmp/audit.json || safety check --json 2>/dev/null > /tmp/audit.json
      critical=$(grep -c '"CRITICAL"\|"critical"' /tmp/audit.json 2>/dev/null || echo 0)
      high=$(grep -c '"HIGH"\|"high"' /tmp/audit.json 2>/dev/null || echo 0)
      ;;
    go)
      # govulncheck required
      govulncheck ./... 2>/dev/null > /tmp/audit.txt
      critical=$(grep -c "CRITICAL" /tmp/audit.txt 2>/dev/null || echo 0)
      high=$(grep -c "HIGH" /tmp/audit.txt 2>/dev/null || echo 0)
      ;;
    rust)
      cargo audit 2>/dev/null > /tmp/audit.txt
      critical=$(grep -c "CRITICAL" /tmp/audit.txt 2>/dev/null || echo 0)
      high=$(grep -c "HIGH\|warning:" /tmp/audit.txt 2>/dev/null || echo 0)
      ;;
    java)
      # OWASP dependency-check or gradle plugin
      ./gradlew dependencyCheckAnalyze 2>/dev/null || mvn dependency-check:check 2>/dev/null
      critical=$(grep -c "CRITICAL" build/reports/dependency-check-report.html 2>/dev/null || echo 0)
      high=$(grep -c "HIGH" build/reports/dependency-check-report.html 2>/dev/null || echo 0)
      ;;
    dotnet)
      dotnet list package --vulnerable 2>/dev/null > /tmp/audit.txt
      critical=$(grep -c "Critical" /tmp/audit.txt 2>/dev/null || echo 0)
      high=$(grep -c "High" /tmp/audit.txt 2>/dev/null || echo 0)
      ;;
    *)
      echo "WARNING: Cannot scan vulnerabilities for $PROJECT_TYPE"
      return 0
      ;;
  esac

  if [ "${critical:-0}" -eq 0 ] && [ "${high:-0}" -eq 0 ]; then
    echo "PASSED: No critical/high vulnerabilities"
  else
    echo "FAILED: Found ${critical:-0} critical, ${high:-0} high vulnerabilities"
  fi
}
```

### 9. Performance Tests (Project-Agnostic)

```bash
verify_performance_tests() {
  local result=0

  case "$PROJECT_TYPE" in
    node)
      npm test -- --grep "performance" 2>/dev/null || npm test -- --testNamePattern="performance" 2>/dev/null
      result=$?
      ;;
    python)
      pytest -k "performance or benchmark" 2>/dev/null
      result=$?
      ;;
    go)
      go test -run ".*Performance.*" -bench=. ./... 2>/dev/null
      result=$?
      ;;
    rust)
      cargo test performance 2>/dev/null && cargo bench 2>/dev/null
      result=$?
      ;;
    java)
      ./gradlew test --tests "*Performance*" 2>/dev/null || mvn test -Dtest="*Performance*" 2>/dev/null
      result=$?
      ;;
    dotnet)
      dotnet test --filter "FullyQualifiedName~Performance" 2>/dev/null
      result=$?
      ;;
    *)
      echo "WARNING: Cannot run performance tests for $PROJECT_TYPE"
      return 0
      ;;
  esac

  if [ $result -eq 0 ]; then
    echo "PASSED: Performance tests pass"
  else
    echo "WARNING: Performance tests failing (non-blocking)"
  fi
}
```

### Quality Status

| Check | Status | Severity |
|-------|--------|----------|
| Test categories exist | Required | Blocker if missing |
| Per-category minimum | Required | Blocker if below minimum |
| Test quality (no fakes) | Required | Blocker if fake patterns |
| Tests pass | Required | Blocker if failing |
| Overall coverage | Required | Blocker if below threshold |
| Security tests | Required | Blocker if failing |
| Vulnerabilities | Required | Blocker if critical/high |
| Performance | Optional | Warning only |

**Supported project types:** Node.js, Python, Go, Rust, Java, .NET

**Reference:** @~/.claude/get-shit-done/references/security-compliance.md

Record quality verification results in VERIFICATION.md.
</step>

<step name="identify_human_verification">
**Always needs human:** Visual appearance, user flow completion, real-time behavior (WebSocket/SSE), external service integration, performance feel, error message clarity.

**Needs human if uncertain:** Complex wiring grep can't trace, dynamic state-dependent behavior, edge cases.

Format each as: Test Name → What to do → Expected result → Why can't verify programmatically.
</step>

<step name="determine_status">
**passed:** All truths VERIFIED, all artifacts pass levels 1-3, all key links WIRED, no blocker anti-patterns.

**gaps_found:** Any truth FAILED, artifact MISSING/STUB, key link NOT_WIRED, or blocker found.

**human_needed:** All automated checks pass but human verification items remain.

**Score:** `verified_truths / total_truths`
</step>

<step name="generate_fix_plans">
If gaps_found:

1. **Cluster related gaps:** API stub + component unwired → "Wire frontend to backend". Multiple missing → "Complete core implementation". Wiring only → "Connect existing components".

2. **Generate plan per cluster:** Objective, 2-3 tasks (files/action/verify each), re-verify step. Keep focused: single concern per plan.

3. **Order by dependency:** Fix missing → fix stubs → fix wiring → verify.
</step>

<step name="create_report">
```bash
REPORT_PATH="$PHASE_DIR/${PHASE_NUM}-VERIFICATION.md"
```

Fill template sections: frontmatter (phase/timestamp/status/score), goal achievement, artifact table, wiring table, requirements coverage, anti-patterns, human verification, gaps summary, fix plans (if gaps_found), metadata.

See ~/.claude/get-shit-done/templates/verification-report.md for complete template.
</step>

<step name="return_to_orchestrator">
Return status (`passed` | `gaps_found` | `human_needed`), score (N/M must-haves), report path.

If gaps_found: list gaps + recommended fix plan names.
If human_needed: list items requiring human testing.

Orchestrator routes: `passed` → update_roadmap | `gaps_found` → create/execute fixes, re-verify | `human_needed` → present to user.
</step>

</process>

<success_criteria>
- [ ] Must-haves established (from frontmatter or derived)
- [ ] All truths verified with status and evidence
- [ ] All artifacts checked at all three levels
- [ ] All key links verified
- [ ] Requirements coverage assessed (if applicable)
- [ ] Anti-patterns scanned and categorized
- [ ] Quality must_haves verified (coverage, security, vulnerabilities) if present
- [ ] Human verification items identified
- [ ] Overall status determined
- [ ] Fix plans generated (if gaps_found)
- [ ] VERIFICATION.md created with complete report
- [ ] Results returned to orchestrator
</success_criteria>
