---
"get-shit-done-cc": patch
---

**Added: adversarial parser fixture corpus and tests.** New `tests/fixtures/adversarial/{frontmatter,roadmap}/` directories with hostile-but-realistic inputs (duplicate keys, CRLF endings, unclosed blocks, Unicode, null bytes, fenced-code headings, decimal phase prefix collisions, HTML-commented headings), exercised by new behavioral tests (`feat-3594-parser-adversarial-frontmatter.test.cjs`, `feat-3594-parser-adversarial-roadmap.test.cjs`) plus one deterministic seeded property-style test (`feat-3594-parser-property-style.test.cjs`) covering 500 generated inputs per assertion. Pins current parser behavior for known still-open regressions (#2787 fenced-code-block headings in the CJS parser; HTML-comment heading false positives) so the future fix lands as a one-line assertion flip.
