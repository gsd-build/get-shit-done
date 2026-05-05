---
phase: 03-sme-creator-agent
reviewed: 2026-04-29T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - agents/gsd-sme-creator-analyzer.md
  - agents/gsd-sme-creator.md
  - evals/sme-creator.promptfooconfig.yaml
findings:
  critical: 0
  warning: 9
  info: 4
  total: 13
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-29
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files reviewed: the SME creator orchestrator agent, the parallel analyzer sub-agent, and the promptfoo eval regression suite. No critical (security/crash) issues found. Nine warnings covering logic gaps, silent failure modes, and correctness issues in the eval assertions. Four info items covering incomplete scope, implicit assumptions, and style issues.

The most impactful warnings are: (1) the orchestrator has no error-handling path for sub-agent failure, so findings can be silently dropped; (2) the eval's process boundary test uses asymmetric normalization that can produce false failures; and (3) the eval requires at least one finding to pass, which rejects valid SMEs for clean codebases.

---

## Warnings

### WR-01: Sub-agent failure leaves findings silently dropped

**File:** `agents/gsd-sme-creator.md:110-112`
**Issue:** The `collect_results` step calls `TaskOutput(block=true)` for all tasks, then reads `.tmp` files — but there is no documented path for what happens when a sub-agent times out, errors, or writes zero bytes. If any sub-agent fails, its partition's findings are silently absent from the final SME with no error marker, no count discrepancy, and no repair attempt.
**Fix:** After reading each `.tmp` file, check that it is non-empty. If a partition file is missing or empty after `TaskOutput` completes, add an explicit entry in the final SME under a `## INCOMPLETE` marker noting which partition was lost and why. Example check to add after reading:
```bash
if [ ! -s ".planning/smes/.tmp/${PROCESS_NAME}-part-${N}.md" ]; then
  echo "WARNING: partition ${N} produced no findings -- sub-agent may have failed"
fi
```

### WR-02: BLOCKER downgrade rule stated in definition block but not enforced in analyzer process step

**File:** `agents/gsd-sme-creator-analyzer.md:63-67`
**Issue:** The `finding_format` block states "A BLOCKER without historical evidence is malformed — downgrade to WARNING." However, the procedural `analyze_files` step (lines 96-105) has no instruction to validate severity before writing. The analyzer may write an unsupported BLOCKER, which is then caught (or not) by the orchestrator's synthesize step. This creates an unreliable two-layer check.
**Fix:** Add an explicit self-check instruction in `write_findings` step: before writing any `[BLOCKER]` finding, confirm it contains a commit hash, PR number, or direct code comment quote. If not, write it as `[WARNING]` instead. This mirrors the rule the orchestrator applies and closes the gap.

### WR-03: `discover_process_files` misses presentation layer files

**File:** `agents/gsd-sme-creator.md:67-70`
**Issue:** The grep scope is `sdk/src/ agents/ get-shit-done/`. Per CLAUDE.md, the presentation layer lives in `/bin/` and `/commands/gsd/*.md`. CLI entry points for a process — often where input validation, help text, and routing logic live — are never discovered and never analyzed.
**Fix:** Expand the grep command to include `bin/` and `commands/`:
```bash
grep -rl "{PROCESS_NAME}" --include="*.ts" --include="*.md" \
  sdk/src/ agents/ get-shit-done/ bin/ commands/ 2>/dev/null
```

### WR-04: `find` command includes generated output directories

**File:** `agents/gsd-sme-creator.md:69`
**Issue:** The `find . -name "*{PROCESS_NAME}*"` command excludes `node_modules`, `.planning`, `.git`, and `.claude`, but does NOT exclude `dist/`, `build/`, or other generated output directories. A compiled artifact named after the process (e.g., `dist/sme-creator.js`) would be added to the partition list, causing a sub-agent to analyze generated output instead of source code.
**Fix:**
```bash
find . -name "*{PROCESS_NAME}*" \
  -not -path "*/node_modules/*" \
  -not -path "*/.planning/*" \
  -not -path "*/.git/*" \
  -not -path "*/.claude/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*"
```

### WR-05: Section self-check uses `grep -c` with alternation — counts lines, not unique sections

**File:** `agents/gsd-sme-creator.md:170-172`
**Issue:** The self-check uses a single `grep -c "## Process Overview\|## Identified Risks\|..."` invocation. `grep -c` returns the count of *lines* that match any of the patterns, not the count of distinct sections present. If one required section is missing but another appears twice (e.g., a copy-paste error), the count would still reach 6 and the check would pass with a malformed document.
**Fix:** Use separate greps per section and sum the boolean results:
```bash
SECTION_COUNT=0
for section in "## Process Overview" "## Identified Risks" "## Test Gaps" "## Outdated Logic" "## Edge Cases" "## Known Blockers"; do
  grep -qF "$section" ".planning/smes/${PROCESS_NAME}-SME.md" && SECTION_COUNT=$((SECTION_COUNT + 1))
done
```
This guarantees each of the 6 distinct sections is present exactly once (or at least once).

### WR-06: Eval "Process boundary" test uses asymmetric hyphen normalization

**File:** `evals/sme-creator.promptfooconfig.yaml:147-154`
**Issue:** The test strips hyphens from `process_name` (e.g., `sme-creator` → `smecreator`) but does NOT strip hyphens from cited file paths before comparison. A file path like `` `sdk/src/query/sme.ts` `` contains `sme`, which does not match `smecreator`. This can cause legitimate paths belonging to the process to fail the 70% threshold, generating a false boundary violation for hyphenated process names.
**Fix:** Apply the same hyphen-stripping normalization to both sides of the comparison:
```javascript
const matchingPaths = paths.filter(p =>
  p.replace(/-/g, '').toLowerCase().includes(processName.toLowerCase())
);
```
The `processName` variable already has hyphens stripped (line 147); apply the same `.replace(/-/g, '')` to `p` on the filter side as well.

### WR-07: Eval "Task completion" test requires at least one finding — rejects valid clean-codebase SMEs

**File:** `evals/sme-creator.promptfooconfig.yaml:170`
**Issue:** The assertion `return sme.length > 200 && /\[(BLOCKER|WARNING|WATCH)\]/.test(sme)` requires at least one severity-tagged finding to pass. A correctly generated SME for a genuinely risk-free or empty process would fail this test. The test conflates "agent produced output" with "agent found at least one risk," which is a category error.
**Fix:** Split into two separate test cases: one checking document is non-trivially populated (`sme.length > 200`), and a separate advisory test that warns if no findings are present. Alternatively, remove the finding requirement and rely on the document structure checks (6 sections, proper frontmatter) to validate completeness:
```javascript
return sme.length > 200 && sme.includes('## Process Overview');
```

### WR-08: Eval reads only `files[0]` — non-deterministic for multi-SME directories

**File:** `evals/sme-creator.promptfooconfig.yaml:17`
**Issue:** Every test case uses `files[0]` after `fs.readdirSync(smeDir).filter(...)`. `readdirSync` returns files in filesystem order, which is not guaranteed to be alphabetical on all platforms. If multiple SME files exist, the eval non-deterministically targets one of them — a passing eval run may target a different file than a failing one.
**Fix:** Sort the files array before indexing:
```javascript
files = fs.readdirSync(smeDir).filter(f => f.endsWith('-SME.md')).sort();
```
Apply this change consistently across all 9 test cases that use `files[0]`.

### WR-09: Eval has no `providers` block — model used for `llm-rubric` assertion is undefined

**File:** `evals/sme-creator.promptfooconfig.yaml:81-84`
**Issue:** The YAML has no `providers` section. The `llm-rubric` assertion at line 81 (BLOCKER severity check) requires an LLM to evaluate the rubric, but the model/provider to use is unspecified. Promptfoo will use whatever default provider is configured in the environment, which may differ across machines, CI, and developer workstations. This makes the rubric assertion non-deterministic across environments.
**Fix:** Add an explicit `providers` block at the top level specifying at minimum the model for rubric evaluation:
```yaml
providers:
  - id: anthropic:claude-3-haiku-20240307
    config:
      temperature: 0
```
And add a `defaultTest.options.provider` or use `rubricModel` config to pin the rubric LLM.

---

## Info

### IN-01: PR merge message grep is GitHub-merge-commit-specific and produces no output for squash/rebase workflows

**File:** `agents/gsd-sme-creator-analyzer.md:41`
**Issue:** `git log --follow --grep="Merge pull request"` only matches GitHub's default PR merge commit message format. Repos that use squash merges or rebase merges (common in this project given `feat(XX):` commit style) will get zero results with no warning. The analyzer silently misses all PR context.
**Fix:** Add a fallback grep for conventional commit PR references, or document the assumption that the target repo uses merge commits:
```bash
# Try GitHub merge commit format first
git log --follow --grep="Merge pull request" --format="%H %s%n%b" -n 20 <file>
# Fallback: look for PR references in any format
git log --follow --grep="(#[0-9]+)" --format="%H %s%n%b" -n 20 <file>
```

### IN-02: Partition rule "files >500 lines gets its own partition" has no implementation

**File:** `agents/gsd-sme-creator.md:83`
**Issue:** The rule states large files get their own partition, but the orchestrator has no step that runs `wc -l` on discovered files before partitioning. The rule is stated as a constraint but is unenforceable without a counting step.
**Fix:** Add a line-count discovery step before partitioning:
```bash
wc -l $FILE_LIST 2>/dev/null | sort -rn | head -20
```
Then use the output to identify files exceeding 500 lines and assign them to solo partitions before grouping the rest.

### IN-03: `block_mode` field has no explanation of valid values in the agent instructions

**File:** `agents/gsd-sme-creator.md:149`
**Issue:** The frontmatter template hardcodes `block_mode: soft` but the orchestrator is never told what values are valid (`soft`, `strict`), what they mean, or when to use `strict`. An agent that infers from context might write an arbitrary value, breaking the eval regex `block_mode: (soft|strict)`.
**Fix:** Add a brief inline comment or note in the `synthesize_and_write` step:
```
block_mode: soft  # valid values: soft (warn only) | strict (block execution on BLOCKER findings)
```

### IN-04: Eval `prompts` block is absent — unconventional promptfoo config that may require version-specific behavior

**File:** `evals/sme-creator.promptfooconfig.yaml:1`
**Issue:** The config has no `prompts` section. Promptfoo's standard invocation requires either prompts driving model output or a provider that generates output. This config operates purely as a JavaScript assertion harness against pre-existing files. While functional, it relies on promptfoo's behavior when `prompts` is absent, which varies across versions and may require `--no-cache` or specific flags to avoid errors about missing prompt definitions.
**Fix:** Add a comment at the top clarifying the non-standard usage:
```yaml
# NOTE: This config contains no prompts/providers.
# It runs pure JavaScript assertions against pre-existing .planning/smes/ output files.
# Run with: npx promptfoo eval --config evals/sme-creator.promptfooconfig.yaml --filter-type javascript
# The llm-rubric assertion (BLOCKER test) requires a provider to be configured in ~/.promptfoorc
```
Alternatively, add a dummy prompt and provider for the llm-rubric test while leaving other tests as JavaScript-only.

---

_Reviewed: 2026-04-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
