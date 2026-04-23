# CONTEXT.md template — for discuss-phase write_context step

> **Lazy-loaded.** Read this file only inside the `write_context` step of
> `workflows/discuss-phase.md`, immediately before writing
> `${phase_dir}/${padded_phase}-CONTEXT.md`. Do not put a reference to this
> file in `<required_reading>` — that defeats the progressive-disclosure
> savings introduced by issue #2551.

## Variable substitutions

The caller substitutes:
- `[X]` → phase number
- `[Name]` → phase name
- `[date]` → ISO date when context was gathered
- `${padded_phase}` → zero-padded phase number (e.g., `07`, `15`)
- `{N}` → counts (requirements, etc.)

## Conditional sections

- **`<spec_lock>`** — include only when `spec_loaded = true` (a `*-SPEC.md`
  was found by `check_spec`). Otherwise omit the entire `<spec_lock>` block.
- **Folded Todos / Reviewed Todos** — include subsections only when the
  `cross_reference_todos` step folded or reviewed at least one todo.

## Template body

```markdown
# Phase [X]: [Name] - Context

**Gathered:** [date]
**Status:** Ready for planning

<domain>
## Phase Boundary

[Clear statement of what this phase delivers — the scope anchor]

</domain>

[If spec_loaded = true, insert this section:]
<spec_lock>
## Requirements (locked via SPEC.md)

**{N} requirements are locked.** See `{padded_phase}-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `{padded_phase}-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):** [copy the "In scope" bullet list from SPEC.md Boundaries]
**Out of scope (from SPEC.md):** [copy the "Out of scope" bullet list from SPEC.md Boundaries]

</spec_lock>

<decisions>
## Implementation Decisions

### [Category 1 that was discussed]
- **D-01:** [Decision or preference captured]
- **D-02:** [Another decision if applicable]

### [Category 2 that was discussed]
- **D-03:** [Decision or preference captured]

### Claude's Discretion
[Areas where user said "you decide" — note that Claude has flexibility here]

### Folded Todos
[If any todos were folded into scope from the cross_reference_todos step, list them here.
Each entry should include the todo title, original problem, and how it fits this phase's scope.
If no todos were folded: omit this subsection entirely.]

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

[MANDATORY section. Write the FULL accumulated canonical refs list here.
Sources: ROADMAP.md refs + REQUIREMENTS.md refs + user-referenced docs during
discussion + any docs discovered during codebase scout. Group by topic area.
Every entry needs a full relative path — not just a name.]

### [Topic area 1]
- `path/to/adr-or-spec.md` — [What it decides/defines that's relevant]
- `path/to/doc.md` §N — [Specific section reference]

### [Topic area 2]
- `path/to/feature-doc.md` — [What this doc defines]

[If no external specs: "No external specs — requirements fully captured in decisions above"]

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- [Component/hook/utility]: [How it could be used in this phase]

### Established Patterns
- [Pattern]: [How it constrains/enables this phase]

### Integration Points
- [Where new code connects to existing system]

</code_context>

<specifics>
## Specific Ideas

[Any particular references, examples, or "I want it like X" moments from discussion]

[If none: "No specific requirements — open to standard approaches"]

</specifics>

<deferred>
## Deferred Ideas

[Ideas that came up but belong in other phases. Don't lose them.]

### Reviewed Todos (not folded)
[If any todos were reviewed in cross_reference_todos but not folded into scope,
list them here so future phases know they were considered.
Each entry: todo title + reason it was deferred (out of scope, belongs in Phase Y, etc.)
If no reviewed-but-deferred todos: omit this subsection entirely.]

[If none: "None — discussion stayed within phase scope"]

</deferred>

---

*Phase: [X]-[Name]*
*Context gathered: [date]*
```
