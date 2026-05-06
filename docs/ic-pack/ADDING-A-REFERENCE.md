<!-- CLASSIFICATION: UNCLASSIFIED -->
# Adding a New Reference Doc

> **Status:** Stub. The reference doc template is Appendix B of the design spec.

See spec [Appendix B — Reference Doc Template](../specs/2026-05-05-ic-agent-pack-design.md#appendix-b--reference-doc-template).

Quick form:

1. Write `intel-refs/<topic-area>/<name>.md` with classification frontmatter (must be UNCLASSIFIED).
2. Add an entry to `intel-refs/MANIFEST.json` with `applies_when`, `owner`, `last_reviewed`.
3. Run `bash tools/ci/validate-manifest.sh` locally to confirm.
4. Commit; ships with next pack release.
