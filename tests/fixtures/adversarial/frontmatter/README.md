# Adversarial Frontmatter Fixtures (#3594)

Reusable hostile inputs for `get-shit-done/bin/lib/frontmatter.cjs`
`extractFrontmatter()` and downstream consumers.

Each fixture is a single markdown file whose name encodes the abuse
category. Tests load them by relative path so the corpus can grow
without test code changes. Adding a new fixture means: drop the file
in here, add an entry to the matrix in
`tests/feat-3594-parser-adversarial-frontmatter.test.cjs`, decide
what invariant the parser must satisfy (typically "does not throw,
does not return half-parsed garbage, does not silently lose data").

Categories present:

- `duplicate-keys.md` — same key appears twice. Parser must produce
  a deterministic result; tests document which value wins (last-wins
  is the current behavior).
- `crlf-mixed.md` — CRLF endings throughout the frontmatter block.
  Parser must handle the `\r` consistently and not bleed it into
  values.
- `unclosed-block.md` — opening `---` with no closing `---`. Parser
  must return empty frontmatter (or a clean error), never partial.
- `unicode-keys-and-values.md` — non-ASCII keys/values. Parser must
  round-trip them as-is.
- `null-byte-value.md` — value contains a U+0000 null. Parser must
  preserve or normalize it; must not crash and must not truncate
  silently.
- `huge-bounded.md` — a deliberately-large but bounded frontmatter
  block (~64KB of array items). Parser must complete in reasonable
  time with a typed result, not OOM or hang.
