# Phase 11: Add --docs flag to discuss-phase - Research

**Researched:** 2026-03-07
**Domain:** GSD workflow extension, document parsing, decision extraction
**Confidence:** HIGH

## Summary

This phase extends the existing `discuss-phase` workflow to accept reference documents via a `--docs` flag and auto-extract implementation decisions, only asking users about gaps or ambiguities. The implementation is primarily workflow-level changes to `discuss-phase.md` and `commands/gsd/discuss-phase.md`, with no new CLI tooling required since Claude's Read tool can handle document parsing.

The key insight is that this is NOT a programmatic extraction task — Claude reads the documents directly and performs the analysis. The workflow orchestrates when and how to read, what to extract, and how to present findings to the user. The existing `--prd` flag in `plan-phase` provides a similar pattern but is simpler (treats all PRD content as locked decisions). This feature requires more nuanced extraction with confidence classification.

**Primary recommendation:** Extend discuss-phase workflow with a new conditional path that reads documents first, extracts decisions with four-tier classification (Explicit/Inferred/Ambiguous/Gap), presents grouped summary to user, then falls into standard discuss-phase flow for unresolved items only.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use four-tier classification: Explicit (direct quote), Inferred (reasonable conclusion), Ambiguous (conflicting info), Gap (nothing found)
- Conservative inference — only infer when evidence is strong; prefer asking over guessing wrong
- Reference format: file + approximate location (section/heading) — human-friendly, survives doc edits
- Conflicting info: present both signals with sources, ask user to resolve
- Grouped summary presentation: show all extracted decisions grouped by area, then all gaps/ambiguities needing input
- When docs fully resolve everything: confirm and offer elaboration
- User can override extractions inline — mark as user decision overriding doc extraction
- For gaps: use standard discuss-phase 4-question flow for just the gap areas
- Inline notation for attribution: decision text [from: prd.md] or [user input]
- Mark inferred decisions with [inferred] so planner knows confidence level
- When user overrides: show both with user wins (Doc said X, user chose Y [override])
- Include "Documents Used" section listing each doc with 1-line description of coverage
- Large docs: focused search based on gray areas, don't read entire doc
- Missing/unreadable docs: warn and continue with available docs, note which failed
- No hard limit on document count
- Support markdown and text files (.md, .txt)
- Flag syntax: `--docs path/to/doc1.md,path/to/doc2.md` (comma-separated)
- Preserve all existing discuss-phase behavior when flag not used
- CONTEXT.md output should be identical in structure to standard discuss-phase, just with provenance added

### Claude's Discretion
- Exact search/extraction algorithm for documents
- Presentation formatting within the established structure
- How to identify relevant sections in large documents
- Error message wording

### Deferred Ideas (OUT OF SCOPE)
- Automatic document discovery (user must specify paths for now)
- Document format validation beyond basic readability
- Semantic versioning of documents
- Caching extracted decisions across sessions
- Support for PDF/DOCX formats
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| discuss-phase.md | existing | Main workflow file | Extends existing workflow |
| commands/gsd/discuss-phase.md | existing | Command registration | Defines allowed tools, argument-hint |
| templates/context.md | existing | CONTEXT.md template | Reference for output structure |
| Read tool | Claude native | Document reading | Built-in, handles .md and .txt |
| AskUserQuestion | Claude native | User interaction | Existing pattern in discuss-phase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gsd-tools.cjs init phase-op | existing | Phase initialization | Get phase_dir, phase_slug, padded_phase |
| Bash | Claude native | File existence checks | Validate doc paths before reading |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Claude reading docs | gsd-tools.cjs extract-docs command | Claude reading is simpler, no new CLI code needed, Claude handles nuance better |
| Comma-separated paths | Space-separated or array | Comma is clearer in argument parsing, matches common CLI conventions |

**Installation:**
No new dependencies required. All functionality uses existing GSD infrastructure and Claude's built-in tools.

## Architecture Patterns

### Recommended Workflow Structure
```
discuss-phase.md
├── <step name="initialize">          # Existing — unchanged
├── <step name="check_existing">      # Existing — unchanged
├── <step name="parse_docs_flag">     # NEW — extract --docs argument, validate paths
├── <step name="extract_from_docs">   # NEW — read docs, classify decisions
├── <step name="present_extractions"> # NEW — show grouped findings, get user confirmation/overrides
├── <step name="analyze_phase">       # Modified — skip areas already resolved from docs
├── <step name="present_gray_areas">  # Modified — only show unresolved areas
├── <step name="discuss_areas">       # Existing — unchanged (runs for gaps only)
├── <step name="write_context">       # Modified — add provenance notation
├── <step name="confirm_creation">    # Existing — unchanged
├── <step name="git_commit">          # Existing — unchanged
├── <step name="update_state">        # Existing — unchanged
└── <step name="auto_advance">        # Existing — unchanged
```

### Pattern 1: Document Extraction Flow
**What:** Read documents, identify decisions relevant to phase gray areas
**When to use:** When `--docs` flag is present with valid paths
**Example:**
```markdown
<step name="parse_docs_flag">
Parse $ARGUMENTS for --docs flag.

Extract document paths:
- Split by comma
- Trim whitespace
- Validate each path exists (Bash: test -f "$path")

**If any path invalid:**
Display warning: "Document not found: {path}. Continuing with available documents."

**If all paths invalid:**
Fall back to standard discuss-phase flow.

Store valid_docs list for next step.
</step>
```

### Pattern 2: Four-Tier Classification
**What:** Categorize each extracted finding by confidence level
**When to use:** For every potential decision found in documents
**Example:**
```markdown
<extraction_classification>
For each gray area identified:

1. **Explicit** — Direct statement in document
   - Source quote available
   - Notation: [from: filename.md, "Section Name"]

2. **Inferred** — Reasonable conclusion from context
   - Supporting evidence but not direct statement
   - Notation: [inferred from: filename.md, "Section Name"]
   - Only use when evidence is strong

3. **Ambiguous** — Conflicting information found
   - Multiple sources disagree OR single doc has contradictions
   - Present both signals with sources
   - Notation: [ambiguous: filename.md says X, filename2.md says Y]

4. **Gap** — Nothing found addressing this area
   - Route to standard discuss-phase questioning
   - Notation: [gap — needs user input]
</extraction_classification>
```

### Pattern 3: Focused Document Search
**What:** For large documents, search based on gray areas rather than reading entire doc
**When to use:** When document is large OR when specific gray areas are known
**Example:**
```markdown
<focused_search>
Given gray areas: [layout style, loading behavior, empty state]

For each document:
1. Scan for section headings containing relevant keywords
2. Read sections matching gray area topics
3. Extract decisions from matched sections only

Keywords by gray area type:
- Layout/UI: "layout", "design", "visual", "display", "appearance", "style"
- Behavior: "behavior", "interaction", "flow", "when", "should", "trigger"
- Empty states: "empty", "no data", "zero", "nothing", "missing"
- Loading: "loading", "progress", "fetch", "async", "wait"
</focused_search>
```

### Pattern 4: Provenance-Enhanced CONTEXT.md
**What:** Extend CONTEXT.md structure with source attribution
**When to use:** When `--docs` flag was used
**Example:**
```markdown
<decisions>
## Implementation Decisions

### Layout Style
- Card-based layout [from: prd.md, "UI Requirements"]
- Rounded corners, subtle shadows [inferred from: prd.md, "Visual Design"]

### Loading Behavior
- Infinite scroll [from: spec.md, "Scrolling Behavior"]
- Pull-to-refresh on mobile [from: prd.md, "Mobile Interactions"]

### User Overrides
- New posts indicator at top (Doc said: auto-insert new posts) [override by user]

### Claude's Discretion
- Loading skeleton design [gap — no doc coverage]
- Error state handling [gap — no doc coverage]

</decisions>

<documents_used>
## Documents Used

| Document | Coverage | Extraction Quality |
|----------|----------|-------------------|
| prd.md | UI requirements, mobile behavior | HIGH — explicit requirements |
| spec.md | Scrolling, data loading | MEDIUM — some inference needed |

</documents_used>
```

### Anti-Patterns to Avoid
- **Reading entire large documents:** Use focused search based on gray areas
- **Treating all extractions as equal:** Must classify by confidence level
- **Overriding user decisions silently:** Always show doc says X, user chose Y
- **Ignoring missing documents:** Warn but continue with available docs
- **Making hard assumptions from weak evidence:** Use [inferred] only with strong evidence

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Document reading | Custom file parser | Claude's Read tool | Built-in, handles edge cases |
| Path validation | Complex validation logic | Bash `test -f` | Simple, reliable |
| User prompting | Custom prompt formatting | AskUserQuestion | Matches existing discuss-phase UX |
| Argument parsing | Complex regex | Simple string split on comma | --docs is single flag with clear format |

**Key insight:** This feature is about orchestrating Claude's existing capabilities (reading, reasoning, asking questions), not building new infrastructure.

## Common Pitfalls

### Pitfall 1: Over-Inferring from Weak Evidence
**What goes wrong:** Marking as "Inferred" when evidence is actually ambiguous or absent
**Why it happens:** Pressure to provide complete extractions, confirmation bias
**How to avoid:** Conservative inference threshold — when in doubt, classify as Gap
**Warning signs:** Many [inferred] items that don't have clear supporting quotes

### Pitfall 2: Breaking Existing Workflow
**What goes wrong:** Changes to discuss-phase break the standard (no --docs) path
**Why it happens:** Conditional logic leaks into non-conditional steps
**How to avoid:** New steps are guarded by `has_docs` flag, existing steps remain unchanged when flag absent
**Warning signs:** Test standard discuss-phase flow before and after changes

### Pitfall 3: Ignoring Document Read Failures
**What goes wrong:** Workflow fails entirely when one document can't be read
**Why it happens:** Using strict error handling without fallback
**How to avoid:** Per-doc try/catch, continue with available docs, warn about failures
**Warning signs:** "File not found" crashes workflow instead of graceful degradation

### Pitfall 4: Losing Provenance in Output
**What goes wrong:** CONTEXT.md doesn't include source attribution
**Why it happens:** Standard template used without modifications
**How to avoid:** Template has conditional `<documents_used>` section, inline notation enforced
**Warning signs:** Downstream agents don't know which decisions came from docs vs user

### Pitfall 5: Redundant Questioning
**What goes wrong:** Asking user about areas already resolved from documents
**Why it happens:** analyze_phase doesn't filter by extraction results
**How to avoid:** analyze_phase receives extraction results, filters gray areas to only gaps/ambiguous
**Warning signs:** User asked "What layout style?" when doc explicitly states card-based

## Code Examples

### Example 1: Argument Parsing
```markdown
<step name="parse_docs_flag">
Check $ARGUMENTS for --docs flag.

**If --docs present:**
```bash
# Extract paths after --docs flag
DOCS_ARG=$(echo "$ARGUMENTS" | grep -oP '(?<=--docs\s)[^\s]+')
```

Split by comma:
```bash
IFS=',' read -ra DOC_PATHS <<< "$DOCS_ARG"
```

For each path, validate:
```bash
for doc in "${DOC_PATHS[@]}"; do
  doc=$(echo "$doc" | xargs)  # trim whitespace
  if [ -f "$doc" ]; then
    VALID_DOCS+=("$doc")
  else
    INVALID_DOCS+=("$doc")
  fi
done
```

**If any invalid:**
```
Note: Could not find: {invalid_docs}
Continuing with: {valid_docs}
```

**If all invalid:**
```
None of the specified documents could be found.
Falling back to standard discuss-phase flow.
```
Set `has_docs=false`, proceed to analyze_phase.

**If has valid docs:**
Set `has_docs=true`, proceed to extract_from_docs.
</step>
```

### Example 2: Document Extraction with Classification
```markdown
<step name="extract_from_docs">
**Requires:** valid_docs list from parse_docs_flag

For each document in valid_docs:

1. Read the document:
   - If large (> 1000 lines), use focused search
   - Otherwise, read entire document

2. For each gray area relevant to this phase:
   - Search for explicit statements
   - Note section/heading where found
   - Classify confidence level

3. Compile findings:
```markdown
### Extracted Decisions

**From prd.md:**
| Gray Area | Finding | Classification | Location |
|-----------|---------|----------------|----------|
| Layout | "Use card-based layout with shadows" | Explicit | UI Requirements, line 45 |
| Loading | References "smooth scrolling" | Inferred | Performance, line 112 |
| Empty State | No coverage found | Gap | - |

**From spec.md:**
| Gray Area | Finding | Classification | Location |
|-----------|---------|----------------|----------|
| Loading | "Paginate with 20 items per page" | Explicit | Data Loading, line 89 |
```

4. Detect conflicts:
   - prd.md says smooth scrolling (infinite)
   - spec.md says paginate with 20 items
   - Mark as Ambiguous, present both

Store extraction_results for present_extractions step.
</step>
```

### Example 3: User Confirmation Flow
```markdown
<step name="present_extractions">
**Requires:** extraction_results from extract_from_docs

Group by resolution status:

**Resolved (Explicit + Inferred):**
```
## Decisions Extracted from Documents

### Layout (from prd.md)
- Card-based layout with shadows [Explicit]
- Rounded corners [Inferred from visual design section]

### Loading (from prd.md + spec.md)
- Pull-to-refresh on mobile [Explicit, prd.md]
```

**Needs Resolution (Ambiguous):**
```
### Conflicts Found

**Loading pattern:**
- prd.md: "smooth infinite scrolling"
- spec.md: "paginate with 20 items per page"

Which approach should we use?
```

**Gaps:**
```
### Areas Not Covered by Documents

- Empty state design
- Error handling
```

**Use AskUserQuestion:**
- header: "Review"
- question: "Review the extracted decisions above. Correct anything, then we'll discuss the gaps."
- options:
  - "Looks good, discuss gaps" — proceed to discuss_areas for gap areas only
  - "I want to change something" — allow inline overrides

**If user wants changes:**
For each override:
- Note: "Doc said X, user chose Y [override]"
- Update extraction_results

**If all areas resolved (no gaps, no ambiguous):**
- question: "Documents resolved all gray areas. Create CONTEXT.md?"
- options: "Yes, create it" / "I want to discuss something first"
</step>
```

### Example 4: Modified CONTEXT.md Output
```markdown
<step name="write_context">
**Modified for --docs support:**

If has_docs is true, use enhanced template:

```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning
**Source:** Document extraction + user input

<documents_used>
## Documents Used

| Document | Coverage | Quality |
|----------|----------|---------|
| prd.md | Layout, loading, mobile | HIGH |
| spec.md | Data handling | MEDIUM |

</documents_used>

<domain>
## Phase Boundary

[From phase analysis — unchanged]

</domain>

<decisions>
## Implementation Decisions

### Layout Style
- Card-based layout [from: prd.md]
- Rounded corners [inferred: prd.md]

### Loading Behavior
- Pull-to-refresh [from: prd.md]
- Infinite scroll [override: doc said paginate, user chose infinite]

### Empty State
- Show friendly illustration [user input]
- Suggest accounts to follow [user input]

### Claude's Discretion
- Loading skeleton design [gap — no doc coverage]

</decisions>

<specifics>
## Specific Ideas

[From discussion — unchanged structure]

</specifics>

<deferred>
## Deferred Ideas

[From discussion — unchanged structure]

</deferred>

---

*Phase: XX-name*
*Context gathered: [date]*
*Source documents: prd.md, spec.md*
```

If has_docs is false, use standard template (unchanged).
</step>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| --prd in plan-phase only | --docs in discuss-phase | This phase | More nuanced extraction, confidence levels, user can override |
| All PRD content = locked | Four-tier classification | This phase | Downstream agents know confidence level |
| No provenance tracking | Inline [from: file] notation | This phase | Planner knows decision source |

**Deprecated/outdated:**
- None — this is a new feature extending existing patterns

## Open Questions

1. **How to handle very large documents (>5000 lines)?**
   - What we know: User specified "focused search based on gray areas"
   - What's unclear: Exact line threshold for switching to focused search
   - Recommendation: Use 1000 lines as threshold, can tune based on usage

2. **Should extraction results persist across sessions?**
   - What we know: User deferred "caching extracted decisions"
   - What's unclear: If CONTEXT.md provenance is sufficient for replay
   - Recommendation: CONTEXT.md serves as the persisted state; no separate cache needed

## Sources

### Primary (HIGH confidence)
- discuss-phase.md workflow — current implementation patterns
- plan-phase.md workflow — --prd flag pattern for comparison
- templates/context.md — CONTEXT.md structure reference
- commands/gsd/discuss-phase.md — allowed tools and argument format
- 11-CONTEXT.md — User decisions constraining implementation

### Secondary (MEDIUM confidence)
- gsd-tools.cjs init phase-op — phase initialization patterns
- lib/init.cjs — how phase_dir, phase_slug derived

### Tertiary (LOW confidence)
- None — all findings verified against existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — uses only existing GSD infrastructure
- Architecture: HIGH — follows existing workflow patterns exactly
- Pitfalls: HIGH — based on analysis of existing workflows and user constraints

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (30 days — stable feature, low churn expected)
