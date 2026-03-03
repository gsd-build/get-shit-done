# Phase 4: Integration Testing & Validation - Context

**Gathered:** 2025-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify the Copilot installer output is correct through end-to-end integration tests. No new features, no changes to installer code — purely automated tests that run install in `/tmp` and validate the result.

QUAL-02 (non-GSD conflict detection) is OUT OF SCOPE — the feature doesn't exist for any runtime and adding it would be new functionality.

</domain>

<decisions>
## Implementation Decisions

### Test scope
- Tests execute a full `install --copilot` in a `/tmp` directory and verify output
- Verify: skills exist with correct structure (gsd-*/SKILL.md), agents exist (gsd-*.agent.md), instructions file has markers, manifest includes all files, engine directory is complete
- Same verification approach as existing `verifyInstalled()` / `verifyFileInstalled()` — existence + structure checks
- Also verify SHA256 hashes via manifest to confirm content integrity (same as `writeManifest()` already does)

### Comparison strategy
- Use the same SHA256 hash comparison that the manifest system already uses — no new comparison mechanisms
- No structural/normalized diffing, no byte-level diff against reference `.github/` — keep it simple

### Installer output
- No changes to installer console output (existing ✓/✗ checkmarks stay as-is)
- Tests are purely assertions in the test file, not runtime verification features

### What gets validated
- All GSD skills present as `.github/skills/gsd-*/SKILL.md`
- All GSD agents present as `.github/agents/gsd-*.agent.md`
- `copilot-instructions.md` exists with `<!-- GSD Configuration -->` markers
- `gsd-file-manifest.json` exists with correct structure
- `get-shit-done/` engine directory populated (bin, references, templates, workflows)
- Uninstall removes all GSD artifacts cleanly

### Claude's Discretion
- Exact number and granularity of test cases
- Whether to test local-only or both local + global
- Helper function organization

</decisions>

<specifics>
## Specific Ideas

- Run install in isolated `/tmp` directories (same pattern as existing tests)
- Reuse existing `GSD_TEST_MODE` exports for function-level testing if needed
- Tests go in `tests/copilot-install.test.cjs` alongside existing Phase 1-3 tests

</specifics>

<deferred>
## Deferred Ideas

- **QUAL-02 (conflict detection)**: Warning when non-GSD files exist in skills/agents dirs — doesn't exist for any runtime, would be new feature
- **Reference diff comparison**: Byte-level or structural diff against `.github/` reference implementation — out of scope, not currently done for any runtime

</deferred>

---

*Phase: 04-integration-testing-validation*
*Context gathered: 2025-07-25*
