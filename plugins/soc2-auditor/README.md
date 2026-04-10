# gsd-plugin-soc2

SOC 2 Auditor skill plugin for [GSD](https://github.com/gsd-build/get-shit-done) / Claude Code. Manages the full SOC 2 examination lifecycle from engagement kickoff to final report delivery.

## Install

```bash
# Install to current project
npx gsd-plugin-soc2

# Install globally
npx gsd-plugin-soc2 --global

# Remove
npx gsd-plugin-soc2 --uninstall
```

## Skills

| Skill | Description |
|-------|-------------|
| `/soc2-kickoff` | Ingest engagement letter, extract scope, create `.audit/` structure |
| `/soc2-plan` | Risk assessment, control identification, testing strategy |
| `/soc2-pbc` | Generate Prepared By Client evidence request list |
| `/soc2-sample` | Calculate sample sizes and select sample items |
| `/soc2-test` | Test controls — inspect evidence, reperform, observe, inquiry |
| `/soc2-workpaper` | Assemble formal work papers with cross-references |
| `/soc2-review` | Peer review / engagement quality review |
| `/soc2-package` | Final report assembly + Word (.docx) export |

## Workflow

```
soc2-kickoff → soc2-plan → soc2-pbc → soc2-sample → soc2-test → soc2-workpaper → soc2-review → soc2-package
```

Each skill is self-contained and can be run independently, but they're designed to flow sequentially through the engagement lifecycle.

## State Directory

All engagement state lives in `.audit/` at the project root. This directory is fully standalone — no dependency on GSD's `.planning/` structure.

```
.audit/
├── ENGAGEMENT.md          # Client, period, type, TSC scope, team
├── STATE.md               # Current phase, controls summary, WP status
├── config.json            # Engagement config, integrations
├── SCOPE.md               # TSC categories in/out, boundaries
├── RISK-ASSESSMENT.md     # Risk factor analysis
├── AUDIT-PLAN.md          # Testing strategy, materiality
├── CONTROL-MATRIX.md      # Master control-to-criteria mapping
├── PBC-LIST.md            # Evidence request tracking
├── workpapers/            # Per-control work papers
│   └── {CONTROL-ID}/
│       ├── SAMPLING-MEMO.md
│       ├── TEST-RESULTS.md
│       ├── WORKPAPER.md
│       └── REVIEW-NOTES.md
└── deliverables/          # Final report sections
    ├── section-1-opinion.md
    ├── section-2-assertion.md
    ├── section-3-description-review.md
    ├── section-4-controls-tests-results.md
    └── report.docx
```

## Supported Engagement Types

- **Type I** — Design effectiveness at a point in time
- **Type II** — Operating effectiveness over a period

## Trust Service Categories

All five AICPA Trust Service Categories are supported:

- **Security** (Common Criteria CC1-CC9) — always in scope
- **Availability** (A1)
- **Processing Integrity** (PI1)
- **Confidentiality** (C1)
- **Privacy** (P1-P8)

## Quick Start

1. **Start an engagement:**
   ```
   /soc2-kickoff
   ```
   Provide your engagement letter when prompted. The skill extracts scope, creates `.audit/`, and confirms terms with you.

2. **Plan the audit:**
   ```
   /soc2-plan
   ```
   Performs risk assessment, maps Trust Service Criteria to controls, builds the audit plan.

3. **Generate PBC list:**
   ```
   /soc2-pbc
   ```
   Creates evidence request list from the control matrix.

4. **Sample and test:**
   ```
   /soc2-sample CC-6.1
   /soc2-test CC-6.1 --mode inspect --evidence-path ./evidence/
   ```

5. **Assemble and review:**
   ```
   /soc2-workpaper all --finalize
   /soc2-review all
   ```

6. **Package final report:**
   ```
   /soc2-package
   ```
   Assembles all four report sections and exports to Word via pandoc.

## Professional Judgment Gates

Every skill that requires professional judgment (risk assessment, sample selection, test conclusions, opinion determination) presents its work to the human auditor for confirmation before proceeding. The AI prepares — the auditor decides.

## Word Export

The `/soc2-package` skill converts final deliverables from Markdown to `.docx` using pandoc. To use a firm-branded template:

```json
// .audit/config.json
{
  "wordTemplate": "./templates/firm-template.docx"
}
```

## Requirements

- Node.js >= 22.0.0
- Claude Code (with or without GSD)
- pandoc (optional, for Word export)
