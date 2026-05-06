# Feedback Workflow

User-driven intake for GSD issues — bugs, feature requests, and general questions.

**Principle:** Minimize friction. Two mandatory prompts (type + content), one optional
step (diagnostics for bugs), then file. The goal is fewer dropped issues, not a
perfect bug report.

Complements `/gsd-forensics` (investigation-driven, triggered by failures). This
command is proactive: run it any time, for any reason.

---

## Step 1: Collect Issue Type

If `$ARGUMENTS` is non-empty, use it to pre-fill the title suggestion in Step 2.

Ask:
> "What type of issue?
> [1] Bug — something is broken or behaving unexpectedly
> [2] Feature request — new capability or enhancement
> [3] Question — usage help, clarification, or design discussion"

Record `ISSUE_TYPE` as `bug`, `feature`, or `question`.

---

## Step 2: Collect Title and Description

Ask for a title (≤72 chars) and body in a single prompt:

For **bug**:
> "Title (≤72 chars): one sentence describing what broke.
> Description: expected behavior, actual behavior, steps to reproduce."

For **feature**:
> "Title (≤72 chars): one sentence naming the capability.
> Description: the use case and what you'd like added."

For **question**:
> "Title (≤72 chars): the question itself.
> Description: relevant context (GSD version, command used, etc.)."

Record `ISSUE_TITLE` and `ISSUE_BODY`.

Note the current GSD version if available:
```bash
cat ~/.claude/get-shit-done/VERSION 2>/dev/null
```

If version is found, append to the body:
```text
---
GSD version: {version}
```

---

## Step 3: Attach Diagnostics (bugs only, optional)

**Skip this step entirely for feature requests and questions.**

For bugs, ask once:
> "Want to attach diagnostics? I'll run the forensics investigation and include its findings. [y/N]"

If **yes** and `.planning/` exists in the current directory:
1. Run the forensics investigation by reading and executing
   @~/.claude/get-shit-done/workflows/forensics.md with the issue title
   as the problem description. Let it complete its full investigation.
2. Locate the report it just created:
   ```bash
   ls -t .planning/forensics/report-*.md 2>/dev/null | head -1
   ```
3. Read the report. Extract only the **Evidence Summary** and **Anomalies Detected**
   sections (skip Root Cause Hypothesis and Recommended Actions — those are already
   in the issue description from Step 2).
4. Redact paths: replace all occurrences of `$HOME` and the literal home directory
   path with `~`.
5. Append to `ISSUE_BODY`:
   ```text
   ---
   ## Attached Diagnostics

   {extracted Evidence Summary section}

   {extracted Anomalies Detected section}
   ```

If **no**, or if `.planning/` does not exist, or if the user does not respond
affirmatively: skip silently and proceed to Step 4.

---

## Step 4: File the Issue

**Determine label:**
```bash
case "$ISSUE_TYPE" in
  bug)      CANDIDATE_LABEL="bug" ;;
  feature)  CANDIDATE_LABEL="enhancement" ;;
  question) CANDIDATE_LABEL="question" ;;
  *)        CANDIDATE_LABEL="" ;;
esac

# Verify the label exists (exact match) before using it
LABEL=""
if [ -n "$CANDIDATE_LABEL" ]; then
  EXISTS=$(gh label list --repo gsd-build/get-shit-done \
    --search "$CANDIDATE_LABEL" --json name -q '.[0].name' 2>/dev/null)
  [ "$EXISTS" = "$CANDIDATE_LABEL" ] && LABEL="$CANDIDATE_LABEL"
fi
```

**Primary — gh CLI:**
```bash
LABEL_FLAG=""
[ -n "$LABEL" ] && LABEL_FLAG="--label $LABEL"

gh issue create \
  --repo gsd-build/get-shit-done \
  --title "$ISSUE_TITLE" \
  --body "$ISSUE_BODY" \
  ${LABEL_FLAG}
```

If this succeeds, go to Step 5.

**Fallback — pre-filled browser URL** (if gh is unavailable or unauthenticated):

Build a URL-encoded link using Node.js (always available in GSD environments) and
open it in the system browser:
```bash
BROWSER_URL=$(node -e "
  const t = process.argv[1];
  const b = process.argv[2];
  const l = process.argv[3];
  let url = 'https://github.com/gsd-build/get-shit-done/issues/new'
    + '?title=' + encodeURIComponent(t)
    + '&body='  + encodeURIComponent(b);
  if (l) url += '&labels=' + encodeURIComponent(l);
  console.log(url);
" "$ISSUE_TITLE" "$ISSUE_BODY" "$LABEL")

# Open in the system browser — portable across macOS, Linux, and Windows
case "$(uname -s 2>/dev/null)" in
  Darwin)               open "$BROWSER_URL" ;;
  Linux)                xdg-open "$BROWSER_URL" 2>/dev/null || true ;;
  CYGWIN*|MINGW*|MSYS*) cmd.exe /c start "" "$BROWSER_URL" 2>/dev/null || true ;;
esac
echo "$BROWSER_URL"
```

Display: `Open this URL to file the issue (fields are pre-filled): {BROWSER_URL}`

**Last resort — copy-paste markdown:**

If neither of the above is possible, display:

```text
─────────────────────────────────────────
File this issue at:
https://github.com/gsd-build/get-shit-done/issues/new

Title:
{ISSUE_TITLE}

Body:
{ISSUE_BODY}
─────────────────────────────────────────
```

---

## Step 5: Confirm

- **gh CLI path:** Show the returned issue URL. Done.
- **Browser fallback:** Show the URL, ask the user to open it.
- **Copy-paste fallback:** Ask the user to file manually using the text above.
