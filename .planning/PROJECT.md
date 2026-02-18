# Declare

## What This Is

Declare is a future-driven meta-prompting engine for agentic development — a fork of GSD that replaces linear phase-based planning with a DAG rooted in declared futures. Users declare "what is true when this succeeds," and the system derives milestones and actions backward through causative structure. It implements the Erhard/Jensen/Zaffron ontological model: integrity as wholeness, alignment as shared future, performance as the product of both.

v1.0 shipped: graph engine, future declaration with past-detection, backward derivation, traceability (why-chains, visualization, prioritization), wave-based execution, integrity tracking with honor protocol, and alignment monitoring with drift detection and performance scoring. 4,646 LOC JavaScript, zero runtime dependencies, 10 slash commands for Claude Code.

## Core Value

Performance is the product of alignment and integrity. Declare makes both structurally enforced and visibly measured — so that every project, every team, every individual operates from a declared future with their word whole and complete.

## Requirements

### Validated

- ✓ Future declaration system — guided flow, past-detection, Socratic reframing — v1.0
- ✓ Three-layer DAG structure (declarations → milestones → actions) with upward causation — v1.0
- ✓ Backward derivation ("what must be true?" → milestones, "what must be done?" → actions) — v1.0
- ✓ Integrity tracking with honor protocol (acknowledge, inform, cleanup, renegotiate) — v1.0
- ✓ Alignment tracking — shared future document, drift detection, occurrence checks — v1.0
- ✓ Performance scoring — alignment x integrity as qualitative HIGH/MEDIUM/LOW — v1.0
- ✓ DAG visualization (ASCII tree with status markers) — v1.0
- ✓ Claude Code CLI integration via 10 /declare:* slash commands — v1.0
- ✓ Occurrence checks — AI verifies declarations still hold at milestone completion — v1.0

### Active

- [ ] Web dashboard with interactive graph visualization (declared future → milestones → actions browsable in browser)
- [ ] Clearing conversations — guided Assess → Clear → Create cycle for past-derived declarations
- [ ] Default future detection — project current trajectory vs declared future, surface the gap
- [ ] Integrity cascade warnings — when one commitment breaks, show downstream risk via graph traversal
- [ ] GSD migration path — import existing .planning/ structures into Declare format

### Out of Scope

- Team/multi-user features — future milestone, not v2 (solo + AI first, then team)
- Mobile app — not relevant for CLI-first agentic tool
- Full Vanto Group program replication — inspired by ontology, not building a coaching platform
- Gantt charts / timeline views — contradict declarative model
- Time estimates / story points — anchor in past, become constraining commitments
- Notification system — creates reactivity; tool should be pulled into, not pushing

## Context

### Current State

Shipped v1.0 with 4,646 LOC JavaScript + 1,729 LOC tests.
Tech stack: Node.js CLI, esbuild CJS bundling, Claude Code meta-prompting, markdown artifacts.
Zero runtime dependencies. 20 CLI subcommands. 10 slash commands installed at user level.
Custom graph engine (DeclareDag, 486 lines) with dual adjacency lists and Kahn's algorithm.

### Intellectual Foundations

1. **Erhard, Jensen, Zaffron — Ontological Leadership Model**
   - Integrity as wholeness/completeness (positive, not normative)
   - The cascade: integrity → workability → performance
   - Source: "Being a Leader and the Effective Exercise of Leadership" (SSRN #1263835)
   - Source: "Integrity: A Positive Model" (SSRN #1542759)

2. **Vanto Group — Three Laws of Performance**
   - How people perform correlates to how situations occur to them
   - Future-based language transforms how situations occur
   - The default future vs. the declared future

3. **GSD (Get Shit Done) — Meta-prompting Engine**
   - The existing codebase Declare forked from
   - Agent orchestration, slash command interface, markdown artifacts

## Constraints

- **Tech stack**: Node.js CLI, Claude Code meta-prompting, markdown-based artifacts
- **Compatibility**: Installable as Claude Code slash command system
- **Solo-first**: v1 targets human + AI pair; team features are future milestones
- **Ontological fidelity**: Faithfully represent Erhard/Jensen/Zaffron model
- **Zero runtime deps**: Single-file CJS bundle via esbuild

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork GSD rather than build from scratch | GSD has proven agent orchestration, CLI integration, meta-prompting patterns | ✓ Good — 17 plans in 3 days |
| DAG over linear phases | Linear phases are past-derived sequencing; DAGs represent causal structure | ✓ Good — enables backward derivation |
| Three-layer DAG (declarations → milestones → actions) | Maps to Vanto's Create → Align → Implement with causal structure | ✓ Good — clean separation of concerns |
| Dual adjacency lists (upEdges + downEdges) | O(1) bidirectional lookups for trace/visualize/prioritize | ✓ Good — powers all navigation |
| Slash commands use meta-prompt pattern | .md instructs Claude, CJS provides data via JSON | ✓ Good — clean separation, AI handles judgment |
| esbuild for CJS bundling | Single-file dist/declare-tools.cjs, zero runtime deps | ✓ Good — simple deployment |
| Integrity as honor protocol, not enforcement | Matches Erhard model — integrity is about honoring, not policing | ✓ Good — restoration-focused UX |
| Qualitative performance labels (HIGH/MEDIUM/LOW) | Never numeric scores — avoids false precision and punitive comparison | ✓ Good — ontologically honest |
| FUTURE-ARCHIVE.md for renegotiated declarations | Keep FUTURE.md clean with only active declarations | ✓ Good — clear lifecycle |
| CLI first, web later | Validate ontology in simplest form factor before building UI | — Pending (v2) |

---
*Last updated: 2026-02-17 after v1.0 milestone*
