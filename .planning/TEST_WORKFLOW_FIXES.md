# Test Plan: Workflow Buffer Limit and JSON Fixes

## Test 1: Control Character Handling

**Objective**: Verify gsd-tools.js correctly escapes control characters in file content

**Setup**:
```bash
# Create test file with control character
printf 'Test content\x01with control char\x02here\n' > /tmp/test-ctrl.txt
```

**Test**:
```bash
cd ~/.claude/get-shit-done/bin
node -e "
const fs = require('fs');
function safeReadFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, (char) => {
      return '\\\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
    });
  } catch {
    return null;
  }
}
const content = safeReadFile('/tmp/test-ctrl.txt');
const json = JSON.stringify({ test: content });
console.log('SUCCESS: JSON.stringify did not throw');
console.log(json);
"
```

**Expected**:
- No JSON parse errors
- Control characters escaped as `\u0001`, `\u0002`, etc.
- Output: `SUCCESS: JSON.stringify did not throw`

**Cleanup**:
```bash
rm /tmp/test-ctrl.txt
```

## Test 2: Temp File Pattern with Small JSON

**Objective**: Verify temp file pattern works correctly for normal-sized JSON

**Test**:
```bash
cd /Users/ollorin/get-shit-done
INIT_FILE="/tmp/gsd-test-$$.json"
node ~/.claude/get-shit-done/bin/gsd-tools.js state load > "$INIT_FILE"
if [ -f "$INIT_FILE" ]; then
  echo "SUCCESS: Temp file created"
  COMMIT_DOCS=$(jq -r '.commit_docs' < "$INIT_FILE")
  echo "commit_docs value: $COMMIT_DOCS"
  rm "$INIT_FILE"
else
  echo "FAIL: Temp file not created"
fi
```

**Expected**:
- Temp file created successfully
- jq extracts field correctly
- Output: `SUCCESS: Temp file created`

## Test 3: Temp File Pattern with Large JSON (--include flags)

**Objective**: Verify temp file pattern handles large JSON that would fail with command substitution

**Prerequisites**: Phase with large VERIFICATION.md (>1MB) or STATE.md with substantial content

**Test**:
```bash
cd /Users/ollorin/get-shit-done
INIT_FILE="/tmp/gsd-test-large-$$.json"

# Test plan-phase init which includes multiple large files
node ~/.claude/get-shit-done/bin/gsd-tools.js init plan-phase "7" \
  --include state,roadmap,requirements,context,research,verification,uat \
  > "$INIT_FILE"

if [ -f "$INIT_FILE" ]; then
  SIZE=$(wc -c < "$INIT_FILE" | tr -d ' ')
  echo "SUCCESS: Large JSON created (${SIZE} bytes)"

  # Verify jq can parse it
  if jq -e '.phase_found' < "$INIT_FILE" > /dev/null 2>&1; then
    echo "SUCCESS: jq can parse large JSON"
    PHASE_FOUND=$(jq -r '.phase_found' < "$INIT_FILE")
    echo "phase_found: $PHASE_FOUND"
  else
    echo "FAIL: jq parse error"
  fi

  # Test extracting large content field
  if jq -e '.verification_content' < "$INIT_FILE" > /dev/null 2>&1; then
    VERIFY_LEN=$(jq -r '.verification_content // "" | length' < "$INIT_FILE")
    echo "verification_content length: $VERIFY_LEN bytes"
  fi

  rm "$INIT_FILE"
else
  echo "FAIL: Temp file not created"
fi
```

**Expected**:
- Temp file created with size >1MB if VERIFICATION.md is large
- jq successfully parses large JSON
- All content fields extracted correctly
- No "Argument list too long" or "jq parse error" messages

## Test 4: Workflow Integration Test

**Objective**: Verify actual workflow can use temp file pattern

**Test**: Execute a simple workflow step that uses the pattern
```bash
cd /Users/ollorin/get-shit-done

# Simulate workflow init step
INIT_FILE="/tmp/gsd-init-$$.json"
node ~/.claude/get-shit-done/bin/gsd-tools.js init progress \
  --include state,roadmap,project,config > "$INIT_FILE"

# Simulate workflow extraction step
PROJECT_EXISTS=$(jq -r '.project_exists' < "$INIT_FILE")
STATE_CONTENT=$(jq -r '.state_content // "null"' < "$INIT_FILE")

echo "project_exists: $PROJECT_EXISTS"
echo "state_content length: ${#STATE_CONTENT} chars"

# Cleanup
rm "$INIT_FILE"
```

**Expected**:
- All jq extractions work
- No errors
- state_content extracted successfully

## Test 5: Verify No Duplicate STATE Reads

**Objective**: Confirm STATE.md is only read once per init command

**Method**: Add temporary logging to gsd-tools.js or use strace

**Manual verification**:
```bash
# Check workflow files don't read STATE.md twice
cd /Users/ollorin/get-shit-done/get-shit-done/workflows
grep -n "STATE.md" plan-phase.md execute-phase.md execute-plan.md
# Should only show references in comments, not in cat/Read commands
```

**Expected**:
- No `cat .planning/STATE.md` commands after init
- No duplicate `--include state` flags in same workflow
- All STATE access via `state_content` from INIT_FILE

## Success Criteria

All tests pass with:
- ✓ Control characters properly escaped
- ✓ Temp files created and parsed
- ✓ Large JSON (>1MB) handled correctly
- ✓ jq queries work on temp files
- ✓ No duplicate file reads
- ✓ No "command substitution buffer limit" errors

## Regression Prevention

Before releasing changes:
1. Run all tests above
2. Test with actual large phase (Phase 7 with VERIFICATION.md)
3. Verify `/gsd:plan-phase 7` completes without jq errors
4. Verify `/gsd:execute-phase 7` can read all init data
