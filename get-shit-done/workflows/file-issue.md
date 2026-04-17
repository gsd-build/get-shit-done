<purpose>
Render a GitHub issue body from caller-provided inputs, submit via `gh issue create` when possible, and always fall back to a prefilled URL plus raw markdown so the user can file manually. This is the shared terminal path for `/gsd-feedback` and `/gsd-forensics` — neither workflow should file issues directly.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<input_contract>
Callers set these variables before delegating to this workflow:

- `ISSUE_TYPE` — one of `bug`, `feature`, `question` (required)
- `ISSUE_TITLE` — user-visible issue title (required)
- `ISSUE_DESCRIPTION` — main body / summary from the user (required)
- `DIAGNOSTICS_MARKDOWN` — pre-rendered diagnostics block from the caller (required; may be `"(none)"` if the caller has no diagnostics)
- `INVESTIGATION_FINDINGS` — optional markdown block with forensic findings; empty string or unset when absent
- `REPO` — target repo slug; default `gsd-build/get-shit-done`
</input_contract>

<process>

<step name="resolve_defaults">
```bash
: "${REPO:=gsd-build/get-shit-done}"
: "${INVESTIGATION_FINDINGS:=}"
: "${DIAGNOSTICS_MARKDOWN:=(none)}"
```

Validate required inputs. If `ISSUE_TYPE`, `ISSUE_TITLE`, or `ISSUE_DESCRIPTION` is missing, abort with a clear error — callers must satisfy the contract.
Also validate that `ISSUE_TYPE` is one of `bug`, `feature`, or `question`; if not, abort with a clear error.
</step>

<step name="render_issue_body">
Map labels:
- `bug` -> `bug`
- `feature` -> `enhancement`
- `question` -> `question`

Render the issue body as markdown. The investigation section is included only when `INVESTIGATION_FINDINGS` is non-empty.

````markdown
## Summary

**Type:** {ISSUE_TYPE}

## What happened / what you want

{ISSUE_DESCRIPTION}

{if INVESTIGATION_FINDINGS non-empty:}
## Investigation Findings

{INVESTIGATION_FINDINGS}
{end if}

<details>
<summary>Diagnostic Info</summary>

{DIAGNOSTICS_MARKDOWN}

</details>
````

Write the rendered body to a temp file (`ISSUE_BODY_FILE`) so it can be reused by both `gh issue create` and the URL fallback without double-escaping.
</step>

<step name="submit_with_gh">
Attempt GitHub CLI submission first.

Resolve the mapped label only if it exists in the target repo (avoid hard failures when the repo is missing the label):

```bash
LABEL_NAME="{mapped label from ISSUE_TYPE}"
EXISTING_LABEL=$(gh label list --repo "$REPO" --search "$LABEL_NAME" --json name -q '.[] | select(.name == env.LABEL_NAME) | .name' 2>/dev/null || true)

LABEL_FLAG=""
if [ -n "$EXISTING_LABEL" ]; then
  LABEL_FLAG="--label $EXISTING_LABEL"
fi
```

Create the issue:

```bash
gh issue create \
  --repo "$REPO" \
  --title "$ISSUE_TITLE" \
  $LABEL_FLAG \
  --body-file "$ISSUE_BODY_FILE"
```

If this succeeds, capture the returned issue URL and skip to `final_output`.
</step>

<step name="prefilled_url_fallback">
If `gh` is unavailable, unauthenticated, or issue creation fails, build a prefilled GitHub issue URL:

```bash
TITLE_ENC=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$ISSUE_TITLE")
BODY_ENC=$(node -e "console.log(encodeURIComponent(require('fs').readFileSync(process.argv[1], 'utf8')))" "$ISSUE_BODY_FILE")
LABEL_ENC=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "{mapped label from ISSUE_TYPE}")
PREFILLED_URL="https://github.com/${REPO}/issues/new?title=${TITLE_ENC}&body=${BODY_ENC}&labels=${LABEL_ENC}"
```

Try to open the URL automatically, but do not block on failure:

```bash
if command -v open >/dev/null 2>&1; then
  open "$PREFILLED_URL" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$PREFILLED_URL" >/dev/null 2>&1 || true
elif command -v powershell >/dev/null 2>&1; then
  powershell -NoProfile -Command "Start-Process '$PREFILLED_URL'" >/dev/null 2>&1 || true
elif command -v cmd.exe >/dev/null 2>&1; then
  cmd.exe /c start "" "$PREFILLED_URL" >/dev/null 2>&1 || true
fi
```

Always print the prefilled URL even if browser launch fails.
</step>

<step name="final_output">
Always return:
- the issue type
- the final title
- the rendered markdown body (in a fenced block so the user can paste directly)

If `gh issue create` succeeded:
```text
Issue created: {ISSUE_URL}
```

If `gh issue create` failed but the prefilled URL was generated:
```text
Open this URL to file the issue:
{PREFILLED_URL}
```

If both automated paths fail, return:
```text
Manual fallback: paste the markdown body into a new GitHub issue at https://github.com/${REPO}/issues/new
```

The raw markdown body must always be present in the output so the user has an escape hatch regardless of which path succeeded.
</step>

</process>

<success_criteria>
- Required inputs validated before any submission attempt
- Label mapping respects `bug`/`feature`/`question` → `bug`/`enhancement`/`question`
- Label existence checked against `$REPO` before applying
- `gh issue create` is attempted before fallback paths
- Prefilled `issues/new?title=...&body=...&labels=...` URL generated when gh submission is unavailable
- Cross-platform browser open attempted (open, xdg-open, Start-Process, cmd.exe /c start)
- Raw markdown body always returned regardless of submission outcome
- Investigation section included only when `INVESTIGATION_FINDINGS` is non-empty
</success_criteria>
