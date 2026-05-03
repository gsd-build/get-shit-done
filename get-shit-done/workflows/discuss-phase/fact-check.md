# CONTEXT.md fact-check pass

Run this after `write_context` produces the file, before `git_commit`. Best-effort: failures log a
warning and never block the workflow.

## Checks

**1. Schema version** — grep the freshly-written CONTEXT.md for schema/version mentions:
```bash
CONTEXT_FILE="${phase_dir}/${padded_phase}-CONTEXT.md"
SCHEMA_MENTIONS=$(grep -oiE '\b(schema|version)\s*[:=]?\s*v?[0-9]+' "$CONTEXT_FILE" 2>/dev/null || true)
```
For each candidate, verify against the live codebase:
```bash
LIVE_SCHEMA=$(grep -rn 'SCHEMA_VERSION\s*=' src/ 2>/dev/null | head -1 || true)
```
If `SCHEMA_MENTIONS` references a version and `LIVE_SCHEMA` contains a different version, record a
mismatch. If a single clear replacement exists, auto-correct the CONTEXT.md line. Otherwise append a
`<verification_warnings>` block to CONTEXT.md listing the discrepancy.

**2. Table names** — grep for SQL-table-like identifiers:
```bash
TABLE_MENTIONS=$(grep -oE '\b[a-z][a-z_]{2,}\b' "$CONTEXT_FILE" 2>/dev/null \
  | grep -v '^the\|^and\|^for\|^with\|^this\|^that\|^from\|^into\|^where\|^order' \
  | sort -u || true)
```
For each candidate that appears in a CREATE/ALTER/INSERT context in the file, check the live schema:
```bash
grep -rn "CREATE TABLE\s\+${name}" src/ migrations/ schemas/ store/ 2>/dev/null | head -1 || true
```
Unknown tables → `<verification_warnings>`.

**3. File paths** — for each line mentioning `src/...` or `tests/...`:
```bash
grep -oE '(src|tests)/[a-zA-Z0-9/_.-]+\.[a-zA-Z]+' "$CONTEXT_FILE" 2>/dev/null | while read path; do
  [ -f "$path" ] || echo "MISSING: $path"
done || true
```
Missing paths → `<verification_warnings>`.

**4. Class names** — PascalCase identifiers found in CONTEXT.md:
```bash
grep -oE '\b[A-Z][a-zA-Z0-9]{3,}\b' "$CONTEXT_FILE" 2>/dev/null | sort -u | while read cls; do
  grep -rn "class ${cls}" src/ 2>/dev/null | head -1 || true
done || true
```
Unknown classes (no match in src/) → `<verification_warnings>` (heuristic — false positives expected;
planner resolves them).

## Output

If any mismatch was found, append to CONTEXT.md:
```markdown
<verification_warnings>
Auto-detected on: {date}
- SCHEMA_VERSION mismatch: CONTEXT.md says vN, live code says vM
- Unknown table: foo_bar (referenced at line N, not found in src/)
- Missing file: src/path/to/missing.ts
- Unknown class: MyClass (not found in src/)
</verification_warnings>
```

If no mismatches: no output — proceed silently to `git_commit`.

If any grep fails (no `src/` dir, unusual project layout): log one line:
```
[fact-check] skipped — project layout not recognized
```
and continue.
