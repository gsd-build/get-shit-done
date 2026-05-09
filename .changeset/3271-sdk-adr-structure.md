---
type: Enhancement
pr: 3302
---
**`docs/adr/` index and SDK seam ADRs (#3271)** — added `docs/adr/README.md` as an indexed entry point for all Architecture Decision Records, linking all seven ADRs. ADR 0005 documents the top-level SDK architecture seam map (Dispatch Policy Module, Model Catalog Module, Planning Workspace Module, SDK Package Seam Module, Planning Path Projection Module). ADR 0006 documents how SDK query handlers project planning paths (`cwd → effectiveRoot → .planning/<project>/...`). A structural test (`tests/enh-3271-sdk-adr-structure.test.cjs`) asserts each ADR has required headings and Status/Date metadata, and that the README links every ADR file by filename.
