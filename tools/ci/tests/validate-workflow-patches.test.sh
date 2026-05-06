#!/usr/bin/env bash
TEST_NAME="validate-workflow-patches"
source "$(dirname "$0")/_lib.sh"
VALIDATOR="$GSD_IC_ROOT/tools/ci/validate-workflow-patches.sh"

# --- Case 1: no patch script -> fail (the script is a required deliverable) ---
fx="$(mkfixture no-script)"
run_validator "$VALIDATOR" "$fx"
expect_fail "missing patch-workflows.sh is fatal"

# --- Case 2: patch script exists, exits 0 in dry-run -> pass ---
fx="$(mkfixture good)"
mkdir -p "$fx/tools" "$fx/workflow-patches"
cat > "$fx/tools/patch-workflows.sh" <<'SH'
#!/usr/bin/env bash
# stub
exit 0
SH
chmod +x "$fx/tools/patch-workflows.sh"
run_validator "$VALIDATOR" "$fx"
expect_pass "exit-0 patch script passes"

# --- Case 3: patch script exits non-zero -> fail ---
fx="$(mkfixture broken)"
mkdir -p "$fx/tools" "$fx/workflow-patches"
cat > "$fx/tools/patch-workflows.sh" <<'SH'
#!/usr/bin/env bash
echo "patch failed: foo.diff did not apply"
exit 1
SH
chmod +x "$fx/tools/patch-workflows.sh"
run_validator "$VALIDATOR" "$fx"
expect_fail "non-zero patch script is fatal"

report
