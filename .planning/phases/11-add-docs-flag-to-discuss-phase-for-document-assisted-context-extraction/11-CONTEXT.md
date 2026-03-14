# Phase 11: Add --docs flag to discuss-phase - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a `--docs` flag to the discuss-phase workflow that accepts reference documents (PRD, spec, etc.) and auto-extracts implementation decisions from them. Only ask the user questions for gaps or ambiguities that cannot be resolved from the provided documents. This is a workflow enhancement — it extends existing discuss-phase behavior, not a new command.

</domain>

<decisions>
## Implementation Decisions

### Extraction Classification
- Use four-tier classification: Explicit (direct quote), Inferred (reasonable conclusion), Ambiguous (conflicting info), Gap (nothing found)
- Conservative inference — only infer when evidence is strong; prefer asking over guessing wrong
- Reference format: file + approximate location (section/heading) — human-friendly, survives doc edits
- Conflicting info: present both signals with sources, ask user to resolve

### User Interaction Flow
- Grouped summary presentation: show all extracted decisions grouped by area, then all gaps/ambiguities needing input
- When docs fully resolve everything: confirm and offer elaboration ("Is this correct? Want to discuss anything further?")
- User can override extractions inline — mark as user decision overriding doc extraction
- For gaps: use standard discuss-phase 4-question flow for just the gap areas

### CONTEXT.md Provenance
- Inline notation for attribution: decision text [from: prd.md] or [user input]
- Mark inferred decisions with [inferred] so planner knows confidence level
- When user overrides: show both with user wins (Doc said X, user chose Y [override])
- Include "Documents Used" section listing each doc with 1-line description of coverage

### Edge Case Handling
- Large docs: focused search based on gray areas, don't read entire doc
- Missing/unreadable docs: warn and continue with available docs, note which failed
- No hard limit on document count — focused search handles scale
- Support markdown and text files (.md, .txt) — what GSD workflows typically use

### Claude's Discretion
- Exact search/extraction algorithm for documents
- Presentation formatting within the established structure
- How to identify relevant sections in large documents
- Error message wording

</decisions>

<specifics>
## Specific Ideas

- Flag syntax: `--docs path/to/doc1.md,path/to/doc2.md` (comma-separated)
- Preserve all existing discuss-phase behavior when flag not used
- CONTEXT.md output should be identical in structure to standard discuss-phase, just with provenance added
- Downstream consumers (researcher, planner) benefit from source attribution

</specifics>

<deferred>
## Deferred Ideas

- Automatic document discovery (user must specify paths for now)
- Document format validation beyond basic readability
- Semantic versioning of documents
- Caching extracted decisions across sessions
- Support for PDF/DOCX formats

</deferred>

---

*Phase: 11-add-docs-flag-to-discuss-phase-for-document-assisted-context-extraction*
*Context gathered: 2026-03-07*
