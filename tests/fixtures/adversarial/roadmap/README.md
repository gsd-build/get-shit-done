# Adversarial Roadmap Fixtures (#3594)

Hostile / messy ROADMAP.md inputs for
`get-shit-done/bin/lib/roadmap.cjs` (`searchPhaseInContent`,
`cmdRoadmapGetPhase`, `cmdRoadmapAnalyze`) and the SDK roadmap parser
in `sdk/src/query/roadmap.ts`.

Tests in `tests/feat-3594-parser-adversarial-roadmap.test.cjs` and
`tests/feat-3594-parser-property-style.test.cjs` consume these.

Categories:

- `phase-heading-inside-fenced-code.md` — a ``` md ``` block contains
  a `## Phase 999: fake` heading. The parser MUST ignore headings
  inside fenced code blocks. Historical regression #2787.
- `nested-fenced-code.md` — outer ``` ``` ``` ``` ` block with inner
  ``` ``` ``` ``` ` block. Headings inside either layer must be
  ignored.
- `unicode-phase-titles.md` — phase titles with non-ASCII characters.
  Parser must preserve them in the returned `phase_name`.
- `repeated-phase-ids.md` — same integer phase number listed twice.
  Parser behavior must be deterministic (first-wins or last-wins is
  fine; the test pins whichever).
- `decimal-phase-mixed.md` — integer phase 2 and decimal phase 2.1
  share a prefix. Parser must not return phase 2 when asked for 2.1
  (or vice versa). Historical regression #3537.
- `markdown-headings-inside-html-comment.md` — `<!-- ## Phase 999
  --> ` patterns. Parser must not be fooled by comments.
