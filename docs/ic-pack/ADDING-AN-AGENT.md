<!-- CLASSIFICATION: UNCLASSIFIED -->
# Adding a New IC Pack Agent

> **Status:** Stub. The agent file template is Appendix A of the design spec. This doc will mirror the spec template + add Adelphi-specific authoring notes.

See spec [Appendix A — Agent File Template](../specs/2026-05-05-ic-agent-pack-design.md#appendix-a--agent-file-template).

Quick form:

1. Create `agents/gsd-<name>.md` with frontmatter + role + execution flow + completion marker.
2. Register the completion marker in `references/agent-contracts.ic-pack.md`.
3. Add the agent → model mapping to `MODEL_PROFILES` in `sdk/src/query/config-query.ts` (note: this is upstream territory; coordinate with upstream sync — see [UPGRADE-PROCEDURE.md](UPGRADE-PROCEDURE.md)).
4. (Optional) Register a workflow gate in `.planning/intel-gates.json` template.
5. Bump `VERSION` pack field on next release.
