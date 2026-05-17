<purpose>
Analyze ROADMAP.md phases for dependency relationships before execution. Detect file overlap between phases, semantic API/data-flow dependencies, and suggest `Depends on` entries to prevent merge conflicts during parallel execution by `/gsd:manager`.
</purpose>

<process>

## 1. Load ROADMAP.md

Read `.planning/ROADMAP.md`. If it does not exist, error: "No ROADMAP.md found — run `/gsd:new-project` first."

Extract all phases. For each phase capture:
- Phase number and name
- Scope/Goal description
- Files listed in `Files` or `files_modified` fields (if present)
- Existing `Depends on` field value

## 2. Infer Likely File Modifications

For each phase without explicit `files_modified`, analyze the scope/goal description to infer which files will likely be modified. Use these heuristics:

- **Database/schema phases** → migration files, schema definitions, model files
- **API/backend phases** → route files, controller files, service files, handler files
- **Frontend/UI phases** → component files, page files, style files
- **Auth phases** → middleware files, auth route files, session/token files
- **Config/infra phases** → config files, environment files, CI/CD files
- **Test phases** → test files, spec files, fixture files
- **Shared utility phases** → lib/utils files, shared type definitions

Group phases by their inferred file domain (database, API, frontend, auth, config, shared).

## 3. Detect Dependency Relationships

For each pair of phases (A, B), check for dependency signals:

### File Overlap Detection
If phases A and B will both modify files in the same domain or the same specific files, one must run before the other. The phase that *provides* the foundation runs first.

### Semantic Dependency Detection
Read each phase's scope/goal for these patterns:
- Phase B mentions consuming, using, or calling something that Phase A creates/implements
- Phase B references an "API", "schema", "model", "endpoint", or "interface" that Phase A builds
- Phase B says "after X is complete", "once X is built", "using the X from Phase N"
- Phase B extends or modifies code that Phase A establishes

### Data Flow Detection
- Phase A creates data structures, schemas, or types → Phase B consumes or transforms them
- Phase A seeds/migrates the database → Phase B reads from that database
- Phase A exposes an API contract → Phase B implements the client for that contract

## 4. Build Dependency Table

Output a dependency suggestion table:

```
Phase Dependency Analysis
=========================

Phase N: <name>
  Scope: <brief scope>
  Likely touches: <inferred file domains>

  Suggested dependencies:
  → Depends on: <Phase M> — reason: <overlap/semantic/data-flow explanation>

  Current "Depends on": <existing value or "(none)">
```

For phase pairs with no detected dependency, state: "No dependency detected between Phase X and Phase Y."

## 5. Summarize Suggested Changes

Show a consolidated diff of proposed ROADMAP.md `Depends on` changes:

```
Suggested ROADMAP.md updates:
  Phase 3: add "Depends on: 1, 2"   (file overlap: database schema)
  Phase 5: add "Depends on: 3"      (semantic: uses auth API from Phase 3)
  Phase 4: no change needed         (independent scope)
```

## 6. Confirm and Apply

Ask the user: "Apply these `Depends on` suggestions to ROADMAP.md? (yes / no / edit)"

- **yes** — Write all suggested `Depends on` entries to ROADMAP.md. Confirm each write.
- **no** — Print the suggestions as text only. User updates manually.
- **edit** — Present each suggestion individually with yes/no/skip per suggestion.

When writing to ROADMAP.md:
- Locate the phase entry and add or update the `Depends on:` field
- Preserve all other phase content unchanged
- Do not reorder phases

After applying: "ROADMAP.md updated. Run `/gsd:manager` to execute phases in the correct order."

</process>
