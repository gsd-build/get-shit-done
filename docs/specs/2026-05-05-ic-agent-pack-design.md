# IC Agent Pack — Design Specification

| Field | Value |
|---|---|
| **Date** | 2026-05-05 |
| **Status** | Draft for Review |
| **Repo** | `git@github.com:adelphidata/gsd-ic.git` |
| **Strategy** | Soft fork of canonical GSD (`gsd-build/get-shit-done`) |
| **Operating environment** | Low-side commercial cloud, UNCLASSIFIED only |
| **Scope** | v1 — additive intelligence-domain pack on top of stock GSD |

---

## 1. Executive Summary

The IC Agent Pack is a soft-fork extension of GSD that adds **58 specialized agents, 3 deterministic hooks, and 5 behavioral skills** to enable rapid prototyping of any IC-shaped software application.

The framework's north star is **first to demo, with full government-contracting administrative coverage** — the working prototype lands in front of the customer fast, and the contracting paperwork (SoW decomposition, CDRL mapping, capability statements, white papers, ATO drafts, ITAR / privacy / CMMC posture) lands alongside it. A demo without the paperwork loses the follow-on; the paperwork without the demo never gets read. Both are first-class deliverables.

It does not handle classified content, does not determine classifications (the developer declares them per-file), and does not modify stock GSD agents — it composes alongside them via a thin layer of plug-in agents, manifest-indexed reference knowledge, skill-injection overlays, and config-driven workflow gate hooks.

**Audience and scale.** The framework is used by Adelphi internal engineering and customer-facing personnel (PMs, capture team, technical leads who interface with IC customers). It is designed for **medium scale**: 5–20 engineers running 3–10 concurrent programs without state collisions or workflow drift between teams.

The design optimizes three goals simultaneously:

- **Maintenance** — knowledge curation is decoupled from agent code; SMEs add domain knowledge by writing reference docs and updating a manifest, no agent edits required.
- **Upgradability** — soft fork tracks upstream `gsd-build/get-shit-done`; conflict surface is bounded to a small set of config-driven workflow gate hooks that degrade cleanly when disabled.
- **Performance** — lazy reference loading keeps per-agent context cost comparable to or lower than stock GSD; deterministic work runs in zero-token hooks.

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. Cover every functional role an IC contracting prototype shop needs across the lifecycle: capture (RFI/proposal/white paper), program kickoff (SoW/CDRL/customer context), domain research (per-INT specialists + all-source), prototype design (mission gap, fusion architecture, eval), engineering (synthetic data, devops), customer engagement (capability brief, demo, narrative), compliance (RMF, STIG, CMMC, ITAR, privacy), security personas (ISSO, ISSM), ATO documentation (SSP, POA&M, ConMon, IRP, contingency, evidence, dryruns), and transition readiness.
2. Spend zero LLM tokens determining classifications. Classifications are user-declared per file.
3. Make adding a new mission area a single-Markdown-file change (reference doc + manifest entry); no agent edits.
4. Keep upstream merge conflict surface to ≤ 1 modified line per workflow insertion point.
5. Keep per-agent context budget comparable to or lower than stock GSD researchers.
6. **Onboarding speed.** A new engineer joining a program is productive — first useful PR or artifact landed — within one week. Achieved via documented agent contracts, reference docs that read as standalone primers, and a project-context-mapper that captures program state in a single artifact.
7. **Decision auditability.** Every artifact the framework produces is traceable to who decided what, when, and why. Achieved via the combined audit-trail mechanism in §4.6.

### 2.2 Non-Goals

1. Not a CUI-handling environment. Operating posture is UNCLASSIFIED only. Posture escalation is an explicit, human-authorized event, not an automated one.
2. Not a classified-environment framework. The pack runs on commercial low-side infrastructure.
3. Not a replacement for stock GSD agents. All custom agents are additive; behavioral overlays on stock agents are skills, not forks.
4. Not yet a sustainment framework. Long-term ATO operation is partially supported (compliance specialists exist) but the primary use case is prototyping. Sustainment-specific surface (e.g., continuous compliance monitoring at scale) is out of scope for v1.
5. Not a replacement for human judgment on legal/regulatory questions. ITAR/privacy/CMMC agents flag and recommend; legal counsel decides.
6. **Not a substitute for legal counsel.** Compliance agents (ITAR, privacy, CMMC) surface findings and risks; the determination of whether something is ITAR-controlled, USPER-protected, or CMMC-deficient is a legal judgment that stays with retained counsel.
7. **Not turnkey automation.** Every artifact the framework produces has a human-in-the-loop checkpoint. The framework accelerates skilled work; it does not eliminate the need for skilled humans to review, edit, and sign off.
8. **Not a substitute for cleared SME knowledge.** Reference docs encode public/CUI-or-lower IC-flavored knowledge. Classified tradecraft, customer-program details, and compartmented insights stay with cleared humans and never enter the framework repo.
9. **Not a corporate knowledge management system.** `.planning/` is per-program. The framework does not build a company-wide cross-program knowledge graph, search index, or institutional-memory backend. Reusable artifacts (narrative blocks, capability statements, demo scripts) live in the program that produced them; cross-program reuse is an explicit copy operation, not implicit retrieval.

### 2.3 Constraints

- All artifacts in this repo are UNCLASSIFIED. CI enforces this (see §12).
- All reference content is sourced from public/open-source IC-flavored knowledge (published doctrine, open standards, published tradecraft principles) plus company-IP unclassified material.
- Customer-sensitive program details are not in the framework repo; they live in per-program `.planning/intel-context.md` files in customer projects.
- **Staffing model assumption.** The framework assumes ≥ 2 engineers maintaining the reference library and ≥ 1 SME assigned per primary INT discipline (HUMINT, GEOINT, SIGINT, OSINT, MASINT, CYBINT, FININT). Without this minimum, references decay and the per-INT researcher agents lose accuracy. Customers and programs that don't have SME coverage in a given INT must source it before deploying agents in that discipline.
- **Per-program isolation.** Per-program `.planning/` directories must not cross-contaminate. The framework enforces no shared state across programs at the file-system layer; cross-program artifact reuse is an explicit copy operation initiated by an engineer, not implicit. CI checks for cross-program path leaks.

---

## 3. Operating Environment

### 3.1 Development environment

- Commercial cloud, low-side
- **Cloud provider scope: AWS-first.** `gsd-intel-devops` and IaC examples target AWS as the primary stack. Other providers (Azure, GCP) are supported as edge cases when a specific program demands them, but are not the default substrate.
- **Engineer dev environment: both laptop and cloud.** Engineers may work on local laptops or cloud dev environments (Codespaces, GitPod, Coder, etc.). The framework operates correctly in both — install/sync tooling assumes neither.
- Internet access available (Context7, WebSearch, WebFetch all functional)
- All artifacts UNCLASSIFIED
- User declares classification per file (see §4.5 for convention)

### 3.2 Multi-AO support

Most prototypes target a single AO (NGA, NSA, NRO, CIA, DIA, or another customer). **Multi-AO prototypes are rare and handled ad hoc.** The default design assumes single-AO per program; `gsd-customer-context-mapper` writes one AO per `.planning/intel-context.md`. When a multi-AO prototype is genuinely required, an engineer manually composes overlays from `config-overlays/{nga,nsa,...}/` for the relevant AOs in that program's `agent_skills` map.

### 3.3 Eventual transition target (relevant for design choices)

- IC partition cloud (`aws-iso`, `aws-iso-b`, `aws-iso-f`, Azure IC, IC ITE C2E)
- Air-gapped from commercial internet
- Different ARN namespace, restricted service catalog
- Different authorization regime (ICD 503 / DCID 6/3, not DOD CC SRG)
- Customer-specific AOs (NSA, NGA, NRO, CIA, DIA, others)
- **Intermediate environments are sometimes on the path.** A subset of transitions go through FedRAMP Moderate, IL4, or IL5 environments before landing in the IC partition. `gsd-transition-advisor` handles both **direct paths** (low-side dev → IC partition) and **stepped paths** (low-side → FedRAMP Mod → IL4/IL5 → IC partition) by reading the program's declared transition path from `.planning/intel-context.md` and surfacing the appropriate sequence of compliance and architectural concerns at each stage.

The framework runs entirely on the dev environment. Transition-target awareness is encoded into `gsd-transition-advisor` and `gsd-intel-devops` so prototypes are designed transition-friendly from day one.

---

## 4. Architecture

### 4.1 Layer Model

```
┌────────────────────────────────────────────────────────────────┐
│ Layer 5: Per-program project context                           │
│   .planning/intel-context.md (customer, mission, ceiling, etc.)│
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│ Layer 4: Per-customer skill overlays                           │
│   config-overlays/{nga,nsa,nro,cia,dia,...}/                   │
│   (injected via agent_skills config per-program)               │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│ Layer 3: Skills (4)                                            │
│   skills/{intel-coding-conventions, prototyping-discipline,    │
│   classification-conventions, cross-program-reuse,             │
│   adelphi-house-style}/                                        │
│   (injected into stock + custom agents at spawn)               │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│ Layer 2: Manifest-indexed reference library                    │
│   intel-refs/MANIFEST.json + intel-refs/**/*.md                │
│   (lazy-loaded by agents based on phase scope)                 │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│ Layer 1: Thin agent files (45)                                 │
│   agents/gsd-*.md                                              │
│   (frontmatter + role + execution flow + completion marker)    │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│ Layer 0: Hooks (3, deterministic, zero LLM tokens)             │
│   hooks/gsd-{classification-banner, classified-leak-detector,  │
│   prompt-injection-scan-intel}.js                              │
└────────────────────────────────────────────────────────────────┘

       ┌────────────────────────────────────────────────────┐
       │ CI / Validation (cross-cutting, zero LLM tokens)   │
       │   tools/validate-*.sh — manifest, classification,  │
       │   agents, skills, workflow patches, leak detection │
       │   (gates every PR; gates every upstream sync)      │
       └────────────────────────────────────────────────────┘
```

CI/validation is shown as a cross-cutting concern beneath the layered stack — it gates every state change to any layer. Treated as a first-class architectural element, not just an operational appendix (see §12 for the validator suite).

### 4.2 Design principles

1. **Thin agents.** Every agent file ≤ 500 lines. Frontmatter + role + execution flow + completion markers + manifest pointer. Substantive knowledge lives in references, not the agent prompt.
2. **Manifest-driven references.** Agents read `intel-refs/MANIFEST.json` at startup, match phase scope keywords against `applies_when` tags, lazy-load only relevant references. Adding a new reference = new file + manifest entry; no agent edits.
3. **Skill injection for behavioral overlay.** Bend stock GSD agents (executor, planner, debugger, eval-planner) without forking them via `.planning/config.json`'s `agent_skills` map.
4. **Hooks for deterministic always-on work.** Zero LLM tokens for banner stamping, leak detection, prompt-injection scanning.
5. **Per-customer overlays + per-program project context.** Customer-specific knowledge (NGA flavor vs. NSA flavor) lives in `config-overlays/`. Per-project specifics in `.planning/intel-context.md`.
6. **User-declared classification.** No agent ever determines classification. Files declare via frontmatter or comment header (see §4.5).
7. **Soft fork with config-driven gate hooks.** Workflow modifications use one conditional `Skill(...)` call per insertion point; disabling all gates restores stock behavior exactly. Minimizes upstream merge conflicts.
8. **Per-program isolation.** Per-program `.planning/` directories never share state across programs. Cross-program artifact reuse is an explicit copy operation, not implicit retrieval. Validators in §12 actively check for cross-program path leaks. This is what enables medium-scale concurrent program operation without state collisions.

### 4.3 Single-responsibility per agent

Each of the 58 agents has one clear responsibility, one input contract, one output artifact, and one completion marker. Agents that orchestrate (ISSO, ISSM, all-source-researcher) consume the outputs of specialists and produce higher-level synthesis; specialists never call other specialists.

### 4.4 Single-source-of-truth pattern

Knowledge that's reused across multiple deliverable agents (mission narrative, customer context, capability descriptions) is owned by a **shared utility agent** (`gsd-mission-narrative-writer`, `gsd-customer-context-mapper`) and consumed by leaf deliverable agents. This prevents inconsistent customer messaging across briefs, white papers, capability statements, and proposals.

### 4.5 User-declared classification convention

Every file authored by the framework or by users declares its classification in the appropriate metadata location:

**Markdown / YAML files** — frontmatter:
```yaml
---
classification: UNCLASSIFIED
---
```

**Source code** — first-line comment per language convention:
```python
# CLASSIFICATION: UNCLASSIFIED
```
```javascript
// CLASSIFICATION: UNCLASSIFIED
```
```hcl
// CLASSIFICATION: UNCLASSIFIED
```

**Configuration files (JSON/TOML/etc.)** — accompanying `.classification` sidecar file with the marking, since some config formats don't support comments.

**Binary files (images, PDFs, datasets, model weights, compiled artifacts)** — **no per-file declaration required.** At UNCLASSIFIED-only operating posture, the default is implicit. The repo's classification floor is enforced by CI (§12); binary files inherit it. If posture ever escalates above UNCLASSIFIED, this rule must be revisited.

**Generated / derived artifacts (build outputs, compiled binaries, generator-script output)** — **always default UNCLASSIFIED.** Derived files don't require their own classification reasoning because the operating environment is U-only. If a derived artifact would contain content above U, that's a posture-escalation event the human author owns, not the framework.

**Git commit messages** — **subject lines are prefixed with `[U]`** (e.g., `[U] feat: add gsd-fusion-architect agent`). Commit-message marking is a skill-injected behavior into all code-modifying agents (`gsd-executor`, `gsd-debugger`, `gsd-code-fixer`) via the `classification-conventions` skill. Validates in CI alongside file declarations.

**Agent-created files** — when an agent creates a new file, it applies the **project-default classification (UNCLASSIFIED in v1) automatically.** No per-file user prompt; the project-default is set in `.planning/intel-context.md` (`classification_ceiling: UNCLASSIFIED`) and inherited by every agent at startup. If the project ever needs a different default, it changes there once.

The `gsd-classification-banner.js` hook validates the declaration matches the on-disk banner and stamps if missing. **Missing declarations error loudly — no silent defaults** (text-artifact rule; binaries are exempt per above).

### 4.6 Decision auditability mechanism

To satisfy the §2.1 goal of decision auditability (every artifact traceable to who decided what, when, and why), the framework maintains three layered audit channels. They are not redundant — each captures different granularity:

**1. Append-only operational log (`.planning/audit.md`).** Every agent appends a one-line entry on every meaningful action. Format:

```
2026-05-05T14:23:11Z  gsd-mission-gap-analyst  MISSION_GAP_COMPLETE  phase=01-context  artifact=.planning/MISSION-GAP.md  notes=customer-confirmed-via-tim-2026-05-04
```

Used for fast forensic queries ("when did we capture the mission gap framing?") and for catching unexpected state changes between sessions.

**2. Structured git commit messages.** All meaningful decisions are made via git commits with a structured message convention:

```
docs(decision): <one-line decision summary> [U]

Decided: <what was decided>
Why: <rationale, including alternatives considered>
Refs: <related artifacts, AAR meeting IDs, customer confirmations>
```

The `[U]` classification prefix is required (see §4.5). Decision commits use the `docs(decision):` type prefix to make them filterable in `git log`. Used for the durable, branch-traceable record.

**3. Per-decision rationale files (`.planning/decisions/{YYYY-MM-DD}-{topic}.md`).** **Major architectural and product decisions only** (not every operational call). Format follows ADR (Architecture Decision Record) convention:

```yaml
---
classification: UNCLASSIFIED
date: 2026-05-05
status: Accepted
decided_by: <name(s)>
---

# Decision: <topic>

## Context
## Decision
## Consequences
## Alternatives Considered
```

Used when decisions affect downstream work for other engineers / programs / customers and need a citable record.

**What goes where:**

| Decision granularity | Channel |
|---|---|
| Operational ("ran the auditor, no findings") | Append-only log only |
| Tactical ("chose library X for capability Y") | Append-only log + structured git commit |
| Strategic ("changing transition target from NGA to NRO") | All three: log, commit, ADR file |

CI validates the existence of `.planning/audit.md` and the structured-commit format on `docs(decision):` commits. ADR files are not auto-validated for structure beyond classification frontmatter (the human authoring should produce them deliberately).

---

## 5. Agent Slate (58 Agents in 15 Families)

Each agent's row lists role, primary inputs, primary outputs, completion marker, allowed tools, and the manifest topic tags it consumes.

### Family A — Compliance Specialists (8 agents)

| # | Agent | Role | Inputs | Outputs | Completion Marker | Tools | Knowledge tags |
|---|---|---|---|---|---|---|---|
| 1 | `gsd-rmf-control-mapper` | Maps phase requirements to NIST 800-53 Rev 5 controls; produces control responsibility matrix (system / inherited / hybrid). **Default baseline: Moderate** (overridable via `intel-context.md` `target_baseline`). | REQUIREMENTS.md, CONTEXT.md, phase scope, `target_baseline` from intel-context.md (default: `moderate`) | `.planning/phases/{phase}/{phase}-CONTROL-MATRIX.md` | `## RMF MAPPING COMPLETE` / `## RMF MAPPING BLOCKED` | Read, Write, Bash, Grep, Glob | classification, tradecraft, ecosystem |
| 2 | `gsd-stig-auditor` | Runs DISA STIG profile checks against IaC, container configs, OS configs at the target impact level. **Default profile: IL4/IL5** (aim higher to avoid transition rework; overridable via `intel-context.md` `target_stig_profile`). | Project IaC files, container Dockerfiles, OS configs, `target_stig_profile` from intel-context.md (default: `il4-il5`) | `.planning/phases/{phase}/{phase}-STIG-AUDIT.md` | `## STIG AUDIT COMPLETE` / `## STIG VIOLATIONS FOUND` | Read, Write, Bash, Grep, Glob | classification, ecosystem |
| 3 | `gsd-cmmc-auditor` | Audits contractor environment for CMMC 2.0 compliance. **Default level: Level 2 (CUI)** — full NIST 800-171 (110 controls); overridable via `intel-context.md` `target_cmmc_level`. | Contractor CI/CD configs, dev system configs, `target_cmmc_level` from intel-context.md (default: `level-2`) | `.planning/CMMC-AUDIT.md` | `## CMMC AUDIT COMPLETE` / `## CMMC GAPS FOUND` | Read, Write, Bash, Grep, Glob | classification, tradecraft |
| 4 | `gsd-itar-screener` | Screens technical data for USML category exposure under ITAR/EAR | Source files, technical docs, system architecture | `.planning/phases/{phase}/{phase}-ITAR-SCREEN.md` | `## ITAR SCREEN COMPLETE` / `## ITAR EXPOSURE FOUND` / `## ITAR ESCALATE` | Read, Write, Bash, Grep, Glob, WebSearch | classification, ecosystem |
| 5 | `gsd-fips-140-3-validator` | Verifies cryptographic libraries used in the project are FIPS 140-3 validated against NIST CMVP. Catches non-validated crypto early. | `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, source-imports of crypto modules | `.planning/phases/{phase}/{phase}-FIPS-VALIDATION.md` | `## FIPS VALIDATION COMPLETE` / `## FIPS NON-VALIDATED FOUND` | Read, Write, Bash, Grep, Glob, WebSearch, WebFetch | classification, ecosystem |
| 6 | `gsd-sbom-generator` | Produces a Software Bill of Materials (CycloneDX or SPDX) per EO 14028 mandate. Wraps tools like `syft`, `cyclonedx-cli`, `npm sbom`, `pip-audit`. Reasons about completeness across multi-language stacks. | Project root, lockfiles for each language ecosystem | `.planning/SBOM/{date}-sbom.cdx.json` (or `.spdx.json`); `.planning/SBOM/SUMMARY.md` | `## SBOM COMPLETE` / `## SBOM INCOMPLETE` | Read, Write, Bash, Grep, Glob | ecosystem |
| 7 | `gsd-nist-800-171-auditor` | Audits against NIST SP 800-171 control set (110 controls) standalone — distinct from CMMC L2 (which inherits 800-171 but adds enforcement framework). Some contracts cite 800-171 directly without invoking CMMC. | Contractor environment configs, dev system state | `.planning/NIST-800-171-AUDIT.md` | `## 800-171 AUDIT COMPLETE` / `## 800-171 GAPS FOUND` | Read, Write, Bash, Grep, Glob | classification, tradecraft |
| 8 | `gsd-dfars-incident-responder` | Produces the DFARS 252.204-7012 incident-reporting playbook: 72-hour reporting timelines, DC3 / DCISE notification procedures, evidence preservation steps. Distinct from `gsd-irp-author` (proactive IRP) — this is the post-incident reporting capability. | System architecture, classification of impacted data, contract DFARS clauses | `.planning/DFARS-INCIDENT-PLAYBOOK.md` | `## DFARS PLAYBOOK COMPLETE` | Read, Write, Bash, Grep, Glob | classification, tradecraft, ecosystem |

### Family B — Privacy (1 agent)

| # | Agent | Role | Inputs | Outputs | Completion Marker | Tools | Knowledge tags |
|---|---|---|---|---|---|---|---|
| 9 | `gsd-privacy-reviewer` | USPER/PII review under EO 12333 / FISA / AG Guidelines + GDPR; produces PIA and PTA when applicable. **Trigger: keyword-matched** — runs only when phase scope mentions PII, USPER, personal data, biometrics, or related terms. Dormant otherwise. | Data models, schemas, source files handling user data, customer context | `.planning/phases/{phase}/{phase}-PRIVACY-REVIEW.md`, `.planning/PIA.md`, `.planning/PTA.md` | `## PRIVACY REVIEW COMPLETE` / `## PRIVACY ISSUES FOUND` / `## PIA REQUIRED` | Read, Write, Bash, Grep, Glob | classification, tradecraft |

### Family C — Security Personas (2 agents, orchestrators)

| # | Agent | Role | Inputs | Outputs | Completion Marker | Tools | Knowledge tags |
|---|---|---|---|---|---|---|---|
| 10 | `gsd-isso` | Operational security ownership; **orchestrates Family A + B + D specialists** (compliance + privacy + ATO documentation); synthesizes their outputs into a single ISSO Brief that ISSM consumes. Reports to ISSM. | All Family A+B outputs, STATE.md, phase artifacts; spawns Family D agents (SSP-drafter, POA&M-tracker, ConMon-planner, IRP-author, Contingency-planner, evidence-packager when triggered) as sub-specialists | `.planning/phases/{phase}/{phase}-ISSO-BRIEF.md` (synthesis); Family D outputs are owned by their respective agents | `## ISSO REVIEW COMPLETE` / `## ISSO BRIEF READY` | Read, Write, Bash, Grep, Glob, Task | classification, tradecraft, ecosystem |
| 11 | `gsd-issm` | Managerial oversight; consumes ISSO brief; makes risk-acceptance recommendations; owns Risk Determination. **May escalate** by spawning `gsd-sar-dryrun` and `gsd-iv-and-v-dryrun` before signing off. Produces submission package + a "likely AO questions" appendix to prepare humans for the AO conversation. The framework **stops at ISSM**; humans handle the actual AO interaction. | ISSO brief, control matrix, risk register, optional dryrun outputs | `.planning/phases/{phase}/{phase}-ISSM-DETERMINATION.md`, Risk Assessment, "Likely AO Questions" appendix | `## ISSM DETERMINATION COMPLETE` (variants: READY-FOR-AO, REMEDIATE-FIRST, RISK-ACCEPTED-WITH-MITIGATION) | Read, Write, Bash, Grep, Glob, Task | classification, tradecraft, ecosystem |

### Family D — ATO Documentation Specialists (8 agents)

| # | Agent | Role | Inputs | Outputs | Completion Marker | Tools | Knowledge tags |
|---|---|---|---|---|---|---|---|
| 12 | `gsd-ssp-drafter` | Authors System Security Plan per NIST SP 800-18 | Control matrix, system architecture, project context | `.planning/SSP.md` | `## SSP DRAFT COMPLETE` / `## SSP DRAFT BLOCKED` | Read, Write, Bash, Grep, Glob | classification, tradecraft |
| 13 | `gsd-poam-tracker` | Manages POA&M; gap → remediation conversion; milestone tracking | SAR/IV&V findings, audit gaps, prior POA&M | `.planning/POAM.md` | `## POAM UPDATE COMPLETE` | Read, Write, Bash, Grep, Glob | classification, tradecraft |
| 14 | `gsd-sar-dryrun` | Simulates Security Control Assessor pre-submission audit | SSP, control matrix, evidence package | `.planning/SAR-DRYRUN.md` | `## SAR DRYRUN COMPLETE` / `## SAR FINDINGS` | Read, Write, Bash, Grep, Glob | classification, tradecraft |
| 15 | `gsd-iv-and-v-dryrun` | Simulates Independent V&V audit pre-submission | Full evidence package, system architecture, test artifacts | `.planning/IVV-DRYRUN.md` | `## IVV DRYRUN COMPLETE` / `## IVV FINDINGS` | Read, Write, Bash, Grep, Glob | classification, tradecraft |
| 16 | `gsd-conmon-planner` | Authors Continuous Monitoring Plan and strategy | SSP, control matrix, system architecture | `.planning/CONMON-PLAN.md` | `## CONMON PLAN COMPLETE` | Read, Write, Bash, Grep, Glob | classification, tradecraft |
| 17 | `gsd-irp-author` | Authors Incident Response Plan | SSP, threat model, system architecture | `.planning/IRP.md` | `## IRP COMPLETE` | Read, Write, Bash, Grep, Glob | classification, tradecraft |
| 18 | `gsd-contingency-planner` | Authors Contingency / DR Plan | SSP, system architecture, BIA | `.planning/CONTINGENCY-PLAN.md` | `## CONTINGENCY PLAN COMPLETE` | Read, Write, Bash, Grep, Glob | classification, tradecraft |
| 19 | `gsd-evidence-packager` | Assembles ATO/IV&V submission packages **per-milestone** (PDR / CDR / TRR / ATO submission). Auto at milestone boundaries; on-demand otherwise (e.g., customer asks mid-phase). | All phase artifacts, SSP, POA&M, audits, test artifacts | `.planning/evidence-packages/{date}/` (zip + index) | `## EVIDENCE PACKAGE COMPLETE` / `## EVIDENCE PACKAGE INCOMPLETE` | Read, Write, Bash, Grep, Glob | classification, tradecraft |

### Family E — CDRL & Customer Artifacts (4 agents)

| # | Agent | Role | Inputs | Outputs | Completion Marker | Tools | Knowledge tags |
|---|---|---|---|---|---|---|---|
| 20 | `gsd-cdrl-mapper` | Parses CDRL list; maps each data item to phase/milestone and required format; detects unmapped CDRLs | Contract document or CDRL list, ROADMAP.md | `.planning/CDRL-MAP.md` | `## CDRL MAPPING COMPLETE` / `## UNMAPPED CDRLs FOUND` | Read, Write, Bash, Grep, Glob | ecosystem |
| 21 | `gsd-milestone-brief-generator` | Builds formal program-review content (PDR/CDR/TRR/SRR). **Output: dual-format Markdown** — readable as plain Markdown + convertible to slide deck via `marp-cli` (Marp-compatible front-matter and slide breaks). | Phase summaries, control matrix, test results, milestone type | `.planning/briefs/{milestone}-{date}-BRIEF.md` (dual-format) | `## MILESTONE BRIEF COMPLETE` | Read, Write, Bash, Grep, Glob | tradecraft, ecosystem |
| 22 | `gsd-after-action-recorder` | Captures customer feedback / exit-brief content into structured artifacts. **Accepts any of three input formats**: paste of typed notes, path to a transcript file, or a multi-turn structured form (attendees, decisions, action items, customer reactions). Adapts based on input. | User-provided meeting notes (paste / transcript / structured form), customer context | `.planning/aar/{date}-AAR.md`, deltas to `.planning/intel-context.md` consumed by `gsd-customer-context-mapper` (#33) on next phase boundary | `## AFTER ACTION COMPLETE` | Read, Write, Bash, Grep, Glob, AskUserQuestion | demo, ecosystem |
| 23 | `gsd-tim-facilitator` | Prepares Technical Interchange Meeting (TIM) materials: agenda, customer-ask anticipation, talking points, decision-prep matrix. Distinct from `gsd-milestone-brief-generator` (#21 — formal milestone reviews) and `gsd-capability-brief-generator` (#24 — pitch-style customer briefings). TIMs are working-level, ongoing, two-way. | Customer context, prior AARs, current phase status, target meeting date + topic | `.planning/tims/{date}-TIM-PREP.md` (agenda + talking points + anticipated customer asks + decision matrix) | `## TIM PREP COMPLETE` | Read, Write, Bash, Grep, Glob | ecosystem, tradecraft |

### Family F — Customer Engagement & Deliverables (4 agents)

| # | Agent | Role | Inputs | Outputs | Completion Marker | Tools | Knowledge tags |
|---|---|---|---|---|---|---|---|
| 24 | `gsd-capability-brief-generator` | Slides + talking points for customer meetings; consumes shared narrative blocks. **Output: dual-format Markdown** — readable as plain Markdown + convertible to slide deck via `marp-cli`. | Project state, narrative blocks (#26 — picks `executive` or `mission-tactical` variant by audience), target audience | `.planning/briefs/capability-{date}-BRIEF.md` (dual-format) | `## CAPABILITY BRIEF COMPLETE` | Read, Write, Bash, Grep, Glob | demo, ecosystem |
| 25 | `gsd-white-paper-drafter` | Pitch / technical white papers in IC house style; consumes shared narrative blocks (technical or executive variant per target). **House style: dual-loaded** — reads `intel-refs/house-style/white-papers.md` for content templates AND has the `adelphi-house-style` skill injected for behavioral voice rules. | Narrative blocks (#26), technical findings, target program, house-style refs + skill | `.planning/papers/{title}.md` | `## WHITE PAPER COMPLETE` | Read, Write, Bash, Grep, Glob | demo, ecosystem |
| 26 | `gsd-demo-scripter` | Repeatable demo scripts: scenarios, datasets, expected outputs, fallback paths. **Data strategy: all-three** — references external paths + checksums for big datasets, includes inline samples for tiny seed data, spawns `gsd-synthetic-data-engineer` (#49) for sensitive-looking placeholders. Mix per-need. | Capability description, dataset references, project state | `.planning/demos/{name}-DEMO-SCRIPT.md`; optional inline data; optional synthetic-data spawn | `## DEMO SCRIPT COMPLETE` | Read, Write, Bash, Grep, Glob, Task | demo |
| 27 | `gsd-mission-narrative-writer` | **Shared utility.** Produces three audience-specific variants of each narrative block: **technical** (engineering audience), **executive** (PM/leadership), **mission-tactical** (analyst/operator). Each block (mission frame / problem / capability claim / risk-of-inaction / transition path) is rendered in all three voices. Consuming agents pick the variant matching their audience. Consumed by `gsd-capability-brief-generator` (#23), `gsd-white-paper-drafter` (#24), `gsd-rfi-analyst` (#27), `gsd-capability-statement-generator` (#28), `gsd-proposal-drafter` (#29). | Capability description, customer context, mission gap analysis | `.planning/narrative/{capability}-NARRATIVE.md` with three sections per block (`### Technical`, `### Executive`, `### Mission-Tactical`) | `## NARRATIVE BLOCKS COMPLETE` | Read, Write, Bash, Grep, Glob | tradecraft, ecosystem |

### Family G — Capture / BD (4 agents)

| # | Agent | Role | Inputs | Outputs | Completion Marker | Tools | Knowledge tags |
|---|---|---|---|---|---|---|---|
| 28 | `gsd-rfi-analyst` | RFI/RFP intake → prototype scope + win themes. Consumes per-program win-theme library at `.planning/win-themes.md`. | RFI/RFP doc, capability statement library, `.planning/win-themes.md` | `.planning/captures/{date}-{name}-RFI-ANALYSIS.md` | `## RFI ANALYSIS COMPLETE` | Read, Write, Bash, Grep, Glob | ecosystem |
| 29 | `gsd-capability-statement-generator` | "What do you have on X?" — short on-demand response | Capability list, narrative blocks, target topic, past-performance entries from `gsd-past-performance-manager` (#30) | `.planning/capabilities/{topic}-STATEMENT.md` | `## CAPABILITY STATEMENT COMPLETE` | Read, Write, Bash, Grep, Glob | ecosystem |
| 30 | `gsd-proposal-drafter` | Formal FAR 15 / OT contract response. **Drafts the full proposal — all written volumes (technical, management, past performance) plus a cost basis with stated assumptions.** Humans review and finalize cost figures; agent does not finalize numbers, only proposes them with documented assumptions. | RFP, narrative blocks (all three audience variants from #26), technical approach, past performance from #30, win themes | `.planning/proposals/{name}/{volume}.md` (one file per volume) | `## PROPOSAL DRAFT COMPLETE` | Read, Write, Bash, Grep, Glob | ecosystem |
| 31 | `gsd-past-performance-manager` | **Per-program tracker** of delivered prototypes, customer feedback, lessons-learned, and citation-ready accomplishments. Output is the source of truth that `gsd-capability-statement-generator` (#28) and `gsd-proposal-drafter` (#29) consume for "we did X for customer Y" claims. Per-program scoped per the "not a corporate KB" non-goal; cross-program reuse via the cross-program-reuse skill (§7). | This program's SUMMARY.md files, AAR archives, customer references, milestone briefs | `.planning/past-performance/PP-LOG.md` (chronological); `.planning/past-performance/CITATIONS.md` (claim-by-claim) | `## PP UPDATE COMPLETE` | Read, Write, Bash, Grep, Glob | ecosystem |

### Family H — Mission & Prototype Design (4 agents)

| # | Agent | Role | Inputs | Outputs | Completion Marker | Tools | Knowledge tags |
|---|---|---|---|---|---|---|---|
| 32 | `gsd-mission-gap-analyst` | Frames a prototype against an analyst use case / real mission gap. **Hybrid intake**: reads `.planning/use-case.md` if present (with required fields: analyst role, current workflow, pain point, success criteria); falls back to multi-turn interview to fill any missing fields. | Customer context, `.planning/use-case.md` (optional structured input) or interview, INT-discipline knowledge | `.planning/MISSION-GAP.md`; updates `.planning/use-case.md` if filled via interview | `## MISSION GAP COMPLETE` | Read, Write, Bash, Grep, Glob, AskUserQuestion | tradecraft, capability-patterns |
| 33 | `gsd-customer-context-mapper` | Captures program metadata (AO, customer org, end users, mission domain, classification ceiling, transition target). **Lifecycle: runs once at kickoff (mandatory), auto-rechecks at every plan-phase boundary** (catches drift), plus on-demand. AAR-recorder (#22) writes deltas that this agent ingests on next phase boundary. | Program description, contract doc, public AO information, AAR deltas if any | `.planning/intel-context.md` (master context file) | `## CONTEXT MAPPED` | Read, Write, Bash, Grep, Glob | ecosystem |
| 34 | `gsd-sow-decomposer` | Parses SoW into phases, requirements, CDRL hooks | SoW document | `.planning/SOW-DECOMPOSITION.md`, suggested phases for ROADMAP | `## SOW DECOMPOSITION COMPLETE` | Read, Write, Bash, Grep, Glob | ecosystem |
| 35 | `gsd-capability-gap-analyst` | Audits Adelphi's own capability portfolio against current/anticipated customer needs. **Distinct from `gsd-mission-gap-analyst` (#31)** which works prototype-by-prototype against a specific analyst use case; this one works portfolio-by-portfolio against an opportunity pipeline. Surfaces "we need to invest in X capability before going after Y opportunity." | Past-performance log (from #30), opportunity pipeline (provided by user/PM), modernization themes from intel-refs/modernization/ | `.planning/captures/CAPABILITY-GAP-{date}.md` | `## CAPABILITY GAP ANALYSIS COMPLETE` | Read, Write, Bash, Grep, Glob | tradecraft, capability-patterns, modernization, ecosystem |

### Family I — Per-INT Discipline Researchers (10 agents)

All Family I agents share inputs (phase scope, customer context, manifest references for the discipline), output contract (`.planning/phases/{phase}/{phase}-RESEARCH.md` or appended section), completion marker (`## RESEARCH COMPLETE` / `## RESEARCH BLOCKED` — matches stock GSD researcher convention), and toolset (Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*).

| # | Agent | Discipline coverage | Knowledge tags |
|---|---|---|---|
| 36 | `gsd-humint-researcher` | HUMINT, i2, biometrics, identity exploitation, IIR/HCR formats, asset validation, source protection | int-disciplines/humint, capability-patterns, tradecraft |
| 37 | `gsd-geoint-researcher` | IMINT, FMV, AGI, foundation GEOINT (NITF / GeoTIFF / STANAG 4609 / KML / MGRS / OGC) | int-disciplines/geoint, capability-patterns |
| 38 | `gsd-sigint-researcher` | COMINT-focused SIGINT (communications metadata, signal classification, EOB analytic patterns) — paired with `gsd-techsigint-researcher` (#45) for technical-collection side | int-disciplines/sigint, capability-patterns |
| 39 | `gsd-osint-researcher` | OSINT, SOCMINT, PAI (STIX / MISP / collection ethics / persona separation) | int-disciplines/osint, capability-patterns, tradecraft |
| 40 | `gsd-masint-researcher` | All phenomenologies (RADINT/ACINT/IRINT/NUCINT/etc.), sensor fusion, signature libraries | int-disciplines/masint, capability-patterns |
| 41 | `gsd-cybint-researcher` | Cyber threat intelligence (ATT&CK / D3FEND / Diamond Model / kill chains / threat-intel platforms) | int-disciplines/cybint, capability-patterns, ai-ml |
| 42 | `gsd-finint-researcher` | Financial intelligence (SWIFT / blockchain / sanctions / illicit-finance) | int-disciplines/finint, capability-patterns |
| 43 | `gsd-techint-researcher` | Foreign materiel exploitation, adversary weapon-system analysis, reverse-engineering report patterns, captured-equipment data shapes | int-disciplines/techint, capability-patterns |
| 44 | `gsd-medint-researcher` | Medical intelligence: disease surveillance, biothreat indicators, biosurveillance prototypes, public-health data models | int-disciplines/medint, capability-patterns, ai-ml |
| 45 | `gsd-techsigint-researcher` | **Technical SIGINT** — radar emissions analysis, ELINT, FISINT (Foreign Instrumentation Signals), instrumentation telemetry. Distinct from #38 (which focuses on COMINT/communications). Pair these two for full SIGINT coverage when phase scope demands both. | int-disciplines/techsigint, int-disciplines/sigint, capability-patterns |

### Family J — All-Source Research & Tradecraft Compliance (2 agents)

| # | Agent | Role | Inputs | Outputs | Completion Marker | Tools | Knowledge tags |
|---|---|---|---|---|---|---|---|
| 46 | `gsd-all-source-researcher` | Multi-INT analytic framing; entity resolution, temporal/spatial correlation, ICD 203 application across fused output, OBP/ABI methodology. **Always fires after Family I specialists complete**, even on single-INT phases (in which case it produces a thin all-source-framing wrapper around the single specialist's output for consistency with multi-INT phases). | Phase scope, customer context, outputs of all spawned Family I specialists | `.planning/phases/{phase}/{phase}-FUSION-RESEARCH.md` | `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED` | Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__* | int-disciplines/* (all), capability-patterns, tradecraft/icd-203 |
| 47 | `gsd-icd-203-enforcer` | Audits analytic outputs (research, briefs, narratives, white papers, proposals) for ICD 203 / Words of Estimative Probability (WEP) compliance. Catches: missing source-attribution discipline (ICD 206), uncalibrated language ("very likely" without WEP mapping), unsupported assertions, mixed-methodology findings without rationale. Produces structured findings the authoring agent (or human) addresses. | Any analytic artifact (file path); `intel-refs/tradecraft/icd-203.md`, `intel-refs/tradecraft/icd-206.md`, `intel-refs/tradecraft/words-of-estimative-probability.md` | `.planning/phases/{phase}/{phase}-ICD-203-AUDIT.md` (per-artifact findings) | `## ICD 203 AUDIT COMPLETE` / `## ICD 203 VIOLATIONS FOUND` | Read, Write, Bash, Grep, Glob | tradecraft, capability-patterns |

### Family K — Specialty Domain (1 agent)

| # | Agent | Role | Inputs | Outputs | Completion Marker | Tools | Knowledge tags |
|---|---|---|---|---|---|---|---|
| 48 | `gsd-domex-engineer` | Document and Media Exploitation engineering: NLP, OCR, forensic image/video analysis, captured-media triage tooling. **Full implementation scope** — designs AND implements DOMEX prototypes (NLP pipelines, OCR configurations, forensic image-processing workflows). Functions as a specialist executor for this domain. | Phase scope (DOMEX-relevant), captured-media descriptions, target capability | `.planning/phases/{phase}/{phase}-DOMEX-DESIGN.md` + actual implementation code in project source tree | `## DOMEX ENGINEERING COMPLETE` | Read, Write, **Edit**, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__* | int-disciplines/humint, capability-patterns, ai-ml |

### Family L — Mission-Framing Analysts (4 agents)

**Trigger: always-on parallel.** All four fire on every phase that has analytic content; produce findings even when not strictly relevant (cheap insurance for catching cross-cutting concerns the planner might not have flagged).

| # | Agent | Role | Inputs | Outputs | Completion Marker | Tools | Knowledge tags |
|---|---|---|---|---|---|---|---|
| 49 | `gsd-ci-analyst` | Counterintelligence framing: foreign-collection-target analysis, deception detection, foreign D&D | Phase scope, customer context, threat-actor references | `.planning/phases/{phase}/{phase}-CI-ANALYSIS.md` | `## CI ANALYSIS COMPLETE` | Read, Write, Bash, Grep, Glob | tradecraft, capability-patterns |
| 50 | `gsd-targeting-analyst` | Targeting analysis: find/fix/finish support tools, evidence standards | Phase scope, mission-domain context | `.planning/phases/{phase}/{phase}-TARGETING-ANALYSIS.md` | `## TARGETING ANALYSIS COMPLETE` | Read, Write, Bash, Grep, Glob | tradecraft, capability-patterns |
| 51 | `gsd-insider-threat-analyst` | Insider threat analytic patterns: anomaly behavior, indicator correlation, ITP requirements | Phase scope, ITP requirements | `.planning/phases/{phase}/{phase}-INSIDER-THREAT.md` | `## INSIDER THREAT ANALYSIS COMPLETE` | Read, Write, Bash, Grep, Glob | tradecraft, capability-patterns |
| 52 | `gsd-adversary-modeler` | Structured adversary modeling: ATT&CK / D3FEND / kill chains, OB decomposition | Phase scope, target adversary description | `.planning/phases/{phase}/{phase}-ADVERSARY-MODEL.md` | `## ADVERSARY MODEL COMPLETE` | Read, Write, Bash, Grep, Glob | capability-patterns, ai-ml |

### Family M — Architecture / Fusion (1 agent)

| # | Agent | Role | Inputs | Outputs | Completion Marker | Tools | Knowledge tags |
|---|---|---|---|---|---|---|---|
| 53 | `gsd-fusion-architect` | Designs multi-INT fusion architectures: entity resolution patterns, temporal correlation, cross-INT provenance, OBP-aligned object models | Multi-INT research outputs, capability description | `.planning/phases/{phase}/{phase}-FUSION-ARCH.md` | `## FUSION ARCHITECTURE COMPLETE` | Read, Write, Bash, Grep, Glob | capability-patterns, int-disciplines/* |

### Family N — Engineering Enablement (4 agents)

| # | Agent | Role | Inputs | Outputs | Completion Marker | Tools | Knowledge tags |
|---|---|---|---|---|---|---|---|
| 54 | `gsd-synthetic-data-engineer` | Synthetic data generation for demos — realistic-distribution data standing in for sensitive/classified inputs. **Coverage spans all four data families**: (a) tabular/structured (CSV / JSON / Parquet — entity records, transactions, timeseries); (b) geospatial (GeoJSON / KML / NITF-shaped imagery / synthetic FMV); (c) text/document corpus (synthetic IIRs / OSINT articles / chat / document collections); (d) sensor/signal data (IQ / acoustic / phenomenology). Picks generation strategy per data family. | Real-data schema description, target distribution constraints, demo scenario, target data family | Synthetic dataset files + generator scripts in `.planning/synthetic-data/{name}/`; data-family-specific tooling (Faker/Mimesis for tabular, GDAL for geospatial, etc.) | `## SYNTHETIC DATA READY` | Read, Write, **Edit**, Bash, Grep, Glob | demo, ai-ml |
| 55 | `gsd-intel-devops` | Partition-aware IaC, STIG-hardened images, air-gap-promotable build patterns; encodes IC-cloud-partition (ISO/ISOB/ISOF) considerations. **AWS-first** with pre-baked partition-aware patterns across four service catalogs: (a) compute/container (ECS/EKS/Lambda/Fargate); (b) data services (S3/RDS/DynamoDB/OpenSearch with KMS variations); (c) AI/ML services (Bedrock/SageMaker/Comprehend/Textract — including notes where these don't exist in IC partitions and what alternatives apply); (d) networking/security (VPC/Transit Gateway/IAM Identity Center variations/GuardDuty/Security Hub). Each pattern documents commercial → IL4/5 → ISO/ISOB/ISOF translations. | Target deployment environment, system architecture, transition target from `gsd-transition-advisor` | IaC (Terraform/CloudFormation), CI/CD configs, hardening guidance, partition-translation notes | `## DEVOPS PLAN COMPLETE` | Read, Write, **Edit**, Bash, Grep, Glob | classification, ecosystem |
| 56 | `gsd-ai-eval-auditor` | IC-flavored AI/ML eval design and audit. **Replaces what was the `eval-mission-utility` skill** (Round 4 promotion to full agent). Designs and audits eval strategies emphasizing: mission-utility metrics (analyst hours saved on test scenario, not just MMLU), HITL-design eval, adversarial robustness, classification-aware test data, defensible-to-customer measurement claims. Pairs with stock `gsd-eval-planner` for general eval mechanics. | AI/ML system design, capability claims to validate, target customer audience for the eval | `.planning/phases/{phase}/{phase}-AI-EVAL-DESIGN.md`; `.planning/phases/{phase}/{phase}-AI-EVAL-AUDIT.md` | `## AI EVAL DESIGN COMPLETE` / `## AI EVAL AUDIT COMPLETE` / `## AI EVAL ISSUES FOUND` | Read, Write, Bash, Grep, Glob | ai-ml, capability-patterns, tradecraft |
| 57 | `gsd-fm-adaptation-engineer` | Foundation model adaptation engineering: RAG, fine-tune, prompting patterns suitable for IC content. Knows the unique constraints of IC FM use (classification-aware retrieval, source attribution, hallucination tolerance, on-prem inference for transition). Implements adaptation pipelines, not just designs them. | AI capability requirements, target FM(s), data fabric design, classification ceiling | `.planning/phases/{phase}/{phase}-FM-ADAPTATION-DESIGN.md` + implementation code | `## FM ADAPTATION COMPLETE` | Read, Write, **Edit**, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__* | ai-ml, capability-patterns, ecosystem |

### Family O — Transition (1 agent)

| # | Agent | Role | Inputs | Outputs | Completion Marker | Tools | Knowledge tags |
|---|---|---|---|---|---|---|---|
| 58 | `gsd-transition-advisor` | Pre-flight check for prototype → PoR transition: control inheritance, supportability gaps, data-ownership clarity, partition portability, valley-of-death risk patterns. **Hybrid path handling**: reads `transition_path` from `intel-context.md` if present (e.g., `["low-side", "fedramp-mod", "il5", "aws-iso"]` for stepped path or `["low-side", "aws-iso"]` for direct); auto-suggests path if absent based on customer (engineer confirms or overrides). Generates per-stage readiness check covering the controls / portability / supportability concerns relevant at each stage. | Project state, intended PoR, control matrix, `transition_path` from intel-context.md (or interview to fill it) | `.planning/TRANSITION-READINESS.md` (per-stage checks) | `## TRANSITION READINESS COMPLETE` / `## TRANSITION GAPS FOUND` | Read, Write, Bash, Grep, Glob, AskUserQuestion | classification, tradecraft, ecosystem |

---

## 6. Hooks (3)

Hooks are deterministic scripts registered in the host runtime's settings to fire on tool events. Zero LLM tokens per invocation.

### 6.0 Implementation language and installation

**Language: mixed by complexity.**

- **Node.js (`.js`)** — for hooks needing structured logic, JSON parsing, or non-trivial pattern detection. Default for the three v1 hooks.
- **Bash / POSIX shell (`.sh`)** — for simple deterministic checks (single regex, file-presence, command-runs).
- **Python (`.py`)** — only when explicit need arises (complex regex, ML-adjacent pattern detection); not used in v1.

**Installation: per-project.** Hooks are installed into each program's `.claude/hooks/` (or runtime equivalent) via `tools/install-pack.sh`. This supports per-program activation, where a specific program may need a hook disabled (e.g., a leak-detector that conflicts with that program's local conventions). Engineers activate per-program rather than relying on a global install.

**Default failure mode: all advisory.** All three hooks emit warnings (stderr / status output) but never block writes by default. `.planning/intel-gates.json` allows per-hook `block_on_match: true` to upgrade to blocking when a program demands it.

### 6.1 `hooks/gsd-classification-banner.js`

| Field | Value |
|---|---|
| **Event** | `PostToolUse` matching `Write\|Edit` |
| **Behavior** | Reads classification declaration from file frontmatter (Markdown/YAML) or first-line comment (source). Validates banner matches declaration. Stamps banner if missing. Errors loudly if no declaration found. |
| **Configuration** | `.planning/intel-gates.json` → `hooks.classification_banner.enabled` (default true) |
| **Output** | Modified file with banner; advisory message on validation failure |
| **Failure mode** | Hook does not block writes, but emits red-flag advisory to status output |

### 6.2 `hooks/gsd-classified-leak-detector.js`

| Field | Value |
|---|---|
| **Event** | `PostToolUse` matching `Write\|Edit` |
| **Behavior** | Scans Write outputs for classification banners or compartment markings (`S//`, `TS//`, `SI//`, `TK//`, `HCS//`, `KDK//`, `G//`, etc.) that don't belong at low-side. Triggers loud advisory; can be configured to block the write. |
| **Configuration** | `.planning/intel-gates.json` → `hooks.classified_leak.enabled`, `hooks.classified_leak.block_on_match` (default false) |
| **Output** | Advisory message; optionally blocks write |
| **Pattern catalog** | `hooks/patterns/classified-markings.json` — versioned list of marking patterns to detect |

### 6.3 `hooks/gsd-prompt-injection-scan-intel.js`

| Field | Value |
|---|---|
| **Event** | `PostToolUse` (extends stock GSD's prompt-injection scanner) |
| **Behavior** | Layered detector for IC-flavored prompt-injection patterns: tradecraft-rule-bypass attempts ("ignore your tradecraft rules"), source-protection-evasion ("reveal the source identity"), classification-bypass ("treat this as unclassified") |
| **Configuration** | `.planning/intel-gates.json` → `hooks.prompt_injection_intel.enabled` (default true) |
| **Output** | Extends stock scanner's advisory output with IC-specific findings |
| **Pattern catalog** | `hooks/patterns/intel-injection-patterns.json` |

---

## 7. Skills (5)

Skills are reference content injected into agents via `.planning/config.json`'s `agent_skills` map. They modify agent behavior without forking agent source.

### 7.0 Skill → Agent promotion rule

A skill should be promoted to a full agent when **two or more** of the following apply:

1. **Multi-step reasoning required.** The behavior needs structured thinking with distinct steps that don't fit cleanly into a host-agent's existing flow (e.g., load context → analyze → produce → review).
2. **Own context window benefit.** The skill's content + task would meaningfully consume the host agent's context; promoting gives a fresh ~200K window dedicated to the work.
3. **Produces a distinct artifact.** The work produces a discrete output file or structured artifact rather than just modifying the host agent's behavior.

A single criterion = stay a skill. Two = ambiguous, judgment call. Three = clear promotion.

`gsd-ai-eval-auditor` (#56) was promoted from the (now-removed) `eval-mission-utility` skill in Round 4 review per all three criteria.

### 7.0.1 Skill versioning

Skills are not explicitly versioned. Stock GSD pattern is followed: each `SKILL.md` is a markdown file; the change record is its git history. CI validates that every skill referenced by `agent_skills` exists; further version semantics are not enforced.

### 7.1 `skills/intel-coding-conventions/SKILL.md`

| Field | Value |
|---|---|
| **Injected into** | `gsd-executor`, `gsd-debugger`, `gsd-code-fixer` |
| **Content outline** | Classification declaration in source headers; CUI-aware logging (no PII / IP / source attribution in logs); partition-aware AWS calls (when applicable); no commercial-internet-only deps in critical path; explicit `# CLASSIFICATION:` first-line convention enforcement |
| **Activation** | Always active when injected via config |

### 7.2 `skills/prototyping-discipline/SKILL.md`

| Field | Value |
|---|---|
| **Injected into** | `gsd-planner`, `gsd-executor` |
| **Content outline** | Cheapest-path-to-demo bias; tear-down as first-class deliverable; no premature scaling; "show what you can show" tearline-friendly framing; demo repeatability over demo robustness |
| **Activation** | Always active when injected |

### 7.3 `skills/classification-conventions/SKILL.md`

| Field | Value |
|---|---|
| **Injected into** | `gsd-executor`, `gsd-debugger`, `gsd-code-fixer`, `gsd-doc-writer`, all narrative-producing custom agents (Family E, F, G) |
| **Content outline** | "Always declare classification in frontmatter/header when creating a file. Default declaration is UNCLASSIFIED unless explicitly told otherwise. Never auto-determine. Commit subjects prefixed `[U]`. If user explicitly directs CUI handling, FLAG and require human authorization before applying." |
| **Activation** | Always active when injected |

### 7.4 `skills/cross-program-reuse/SKILL.md`

| Field | Value |
|---|---|
| **Injected into** | `gsd-executor`, optionally on-demand into any agent that needs to copy artifacts between programs |
| **Content outline** | Procedure for explicit copy of artifacts (narrative blocks, demo scripts, capability statements) between programs. Steps: (1) confirm source artifact's classification ≤ target program's ceiling; (2) copy with new file path; (3) re-stamp classification banner per target program's `intel-context.md`; (4) append entries to BOTH programs' `.planning/audit.md` logs documenting the copy with source/target paths and rationale; (5) note in target's commit message that artifact is reused (`docs(reuse): copy <artifact> from <program> [U]`). Never an implicit operation — always engineer-initiated. |
| **Activation** | Only when injected on-demand for a specific reuse operation |

### 7.5 `skills/adelphi-house-style/SKILL.md`

| Field | Value |
|---|---|
| **Injected into** | `gsd-white-paper-drafter`, `gsd-proposal-drafter`, `gsd-capability-brief-generator`, `gsd-capability-statement-generator`, `gsd-mission-narrative-writer` |
| **Content outline** | Adelphi voice rules: tone (confident not boastful, mission-grounded not jargon-soup), pronoun discipline (program team's "we", not company "we"), evidence cadence (claim → quantified evidence → mission impact), prohibited phrases (silver-bullet language, vague analyst-relevant filler), preferred sentence length, preferred structural patterns. Behavioral overlay on top of `intel-refs/house-style/{white-papers,proposals,briefs}.md` content templates. |
| **Activation** | Always active when injected |

---

## 8. Knowledge Layer

### 8.1 Manifest Schema (`intel-refs/MANIFEST.json`)

```json
{
  "version": "2026.05",
  "topics": {
    "int-disciplines/humint.md": {
      "applies_when": ["humint", "i2", "biometrics", "domex", "case-management", "asset-validation"],
      "owner": "alice@adelphi.ai",
      "last_reviewed": "2026-04-15",
      "classification": "UNCLASSIFIED"
    },
    "int-disciplines/geoint.md": {
      "applies_when": ["geoint", "imint", "fmv", "imagery", "nitf", "stanag-4609", "kml", "geotiff", "mgrs"],
      "owner": "bob@adelphi.ai",
      "last_reviewed": "2026-04-20",
      "classification": "UNCLASSIFIED"
    },
    "capability-patterns/pattern-of-life.md": {
      "applies_when": ["pol", "pattern of life", "behavior tracking", "abi"],
      "owner": "carol@adelphi.ai",
      "last_reviewed": "2026-03-20",
      "classification": "UNCLASSIFIED"
    }
  }
}
```

| Field | Required | Description |
|---|---|---|
| `version` | yes | Manifest version. **Format: `YYYY.MM`** (date-shaped, bumped on every framework release; matches release cadence; signals "manifest as of this release"). |
| `topics` | yes | Map of relative-path → topic metadata |
| `topics.<path>.applies_when` | yes | Array of keyword tags an agent matches against phase scope |
| `topics.<path>.owner` | yes | SME owner email — required for review accountability |
| `topics.<path>.last_reviewed` | yes | ISO date of last SME review. CI emits a stale-reference warning when `last_reviewed` is older than 6 months. |
| `topics.<path>.classification` | yes | Must equal `"UNCLASSIFIED"` for any reference in this repo (CI-enforced) |

**Reference doc length budget: no hard cap.** References are length-self-regulating via SME ownership and the staleness warning above. CI tracks `last_reviewed` and warns engineers when references go stale; SMEs split or trim reactively when reviewing. This trades length-cap rigidity for ownership-driven curation.

### 8.2 Reference Doc Structure

```
intel-refs/
├── MANIFEST.json
├── int-disciplines/
│   ├── humint.md
│   ├── geoint.md
│   ├── sigint.md
│   ├── osint.md
│   ├── masint.md
│   ├── cybint.md
│   └── finint.md
├── capability-patterns/
│   ├── entity-resolution.md
│   ├── pattern-of-life.md
│   ├── network-analysis.md
│   ├── anomaly-detection.md
│   ├── attribution.md
│   ├── triage-workflow.md
│   └── ...
├── tradecraft/
│   ├── icd-203.md
│   ├── icd-206.md
│   ├── words-of-estimative-probability.md
│   ├── structured-analytic-techniques.md
│   ├── tearline-reporting.md
│   ├── source-protection.md
│   └── ...
├── classification/
│   ├── compartments.md
│   ├── releasability.md
│   ├── cui-categories.md
│   ├── derivative-classification.md
│   └── ...
├── demo/
│   ├── vignettes.md
│   ├── ux-patterns.md
│   └── failure-modes.md
├── modernization/
│   └── themes.md
├── ai-ml/
│   ├── hitl-patterns.md
│   ├── xai-patterns.md
│   ├── eval-patterns.md
│   └── fm-adaptation.md
└── ecosystem/
    ├── functional-managers.md
    ├── ic-ite.md
    ├── c2e.md
    ├── ot-consortia.md
    ├── innovation-tracks.md
    └── ...
```

Each reference doc starts with frontmatter declaring its classification, owner, and last-reviewed date. Body content is the actual reference material.

### 8.3 Per-Customer Overlay Structure

```
config-overlays/
├── README.md          ← onboarding doc for adding a new customer
├── nga/
│   ├── overlay.json   ← agent_skills overlay map
│   ├── overlay.md     ← human-readable customer notes (UNCLASSIFIED)
│   └── refs/          ← customer-specific reference doc additions
├── nsa/
├── nro/
├── cia/
├── dia/
└── ...
```

`overlay.json` example:
```json
{
  "customer": "nga",
  "agent_skills": {
    "gsd-geoint-researcher": [
      ".claude/skills/intel-coding-conventions",
      "config-overlays/nga/refs/nga-geoint-fm-overlay"
    ],
    "gsd-mission-narrative-writer": [
      "config-overlays/nga/refs/nga-mission-language"
    ]
  }
}
```

### 8.4 Per-Program Project Context (`.planning/intel-context.md`)

```yaml
---
classification: UNCLASSIFIED
program: nga-pol-prototype
customer:
  agency: NGA
  office: Innovation Office
  end_users: GEOINT analysts (TS/SCI tier)
mission_domain: gray-zone activity tracking
classification_ceiling: UNCLASSIFIED
escalation_path: prompt   # prompt | block | log
posture_escalation_threshold: 3
target_transition: NGA Map of the World (PoR)
target_partition: aws-iso-east-1
target_stig_profile: IL2-baseline
contract_vehicle: NGA Innovation OT
in_scope_ints: [geoint, osint]
key_personnel:
  pm: jane@adelphi.ai
  technical_lead: bob@adelphi.ai
  isso: alice@adelphi.ai
---

(Free-form program notes follow here.)
```

This file is loaded by every Family I, J, L, N, O agent at startup.

**Schema strictness: loose + agent-required.** The framework does not enforce a global schema for `intel-context.md`. Instead:

- **Required-by-anyone field**: `classification_ceiling` (must be `UNCLASSIFIED` in v1; framework checks).
- **Required-by-customer-mapper**: `program`, `customer.agency`, `mission_domain`.
- **Per-agent fields**: each agent declares (in its prompt) which fields it requires to operate. Missing fields error at agent invocation, not at validation time.

This decentralizes schema ownership: agents document their own data needs; engineers see errors only when they invoke an agent that needs more context. Avoids over-strict schema enforcement that would block work for fields no one needs.

---

## 9. Workflow Integration

### 9.1 Gate Hook Pattern

Stock GSD workflow files are modified at a small, fixed set of insertion points. Each insertion adds **one conditional `Skill(...)` call**:

```
If config.intel_gates.<gate-name>.enabled:
  Skill(skill="intel-gate-<gate-name>", args="<phase> <ws>")
```

The `intel-gate-*` skill (a slash command in `commands/gsd/` namespace, internal) reads `.planning/intel-gates.json`, dispatches the right custom agent based on phase context, and routes the result.

### 9.2 `.planning/intel-gates.json` Schema

```json
{
  "version": 1,
  "hooks": {
    "classification_banner": { "enabled": true },
    "classified_leak": { "enabled": true, "block_on_match": false },
    "prompt_injection_intel": { "enabled": true }
  },
  "gates": {
    "context-mapper": {
      "enabled": true,
      "trigger": "new-project.post-scaffold",
      "agent": "gsd-customer-context-mapper"
    },
    "mission-gap": {
      "enabled": true,
      "trigger": "new-project.post-context",
      "agent": "gsd-mission-gap-analyst"
    },
    "int-research": {
      "enabled": true,
      "trigger": "plan-phase.research-stage",
      "dispatcher": "select-by-int-discipline",
      "agents": [
        "gsd-humint-researcher",
        "gsd-geoint-researcher",
        "gsd-sigint-researcher",
        "gsd-osint-researcher",
        "gsd-masint-researcher",
        "gsd-cybint-researcher",
        "gsd-finint-researcher",
        "gsd-all-source-researcher"
      ]
    },
    "compliance-audit": {
      "enabled": true,
      "trigger": "plan-phase.post-planner",
      "agents": [
        "gsd-itar-screener",
        "gsd-privacy-reviewer",
        "gsd-fips-140-3-validator",
        "gsd-sbom-generator",
        "gsd-nist-800-171-auditor",
        "gsd-dfars-incident-responder"
      ],
      "poam_auto_create": true
    },
    "isso-review": {
      "enabled": true,
      "trigger": "execute-phase.post-wave",
      "agent": "gsd-isso"
    },
    "transition-readiness": {
      "enabled": true,
      "trigger": "verify-work.pre-uat",
      "agent": "gsd-transition-advisor"
    }
  }
}
```

### 9.3 Insertion Points

| Stock workflow | Insertion point | Gate name | What fires |
|---|---|---|---|
| `new-project.md` | After PROJECT.md scaffolding | `context-mapper`, `mission-gap` | `gsd-customer-context-mapper` then `gsd-mission-gap-analyst` |
| `discuss-phase.md` | During context gathering | `discuss-intel` | INT-aware questioning, classification-ceiling assumption surfacing (delegates to per-INT researchers as needed) |
| `plan-phase.md` (research stage) | Replaces or augments stock researcher | `int-research` | Per-INT researcher(s) selected by phase scope; `gsd-all-source-researcher` for multi-INT |
| `plan-phase.md` (post-planner) | Pre-checker | `compliance-audit` | `gsd-itar-screener`, `gsd-privacy-reviewer` |
| `execute-phase.md` | Per-task post-commit | (hook only) | Classification banner hook, classified-leak hook fire automatically |
| `execute-phase.md` (post-wave) | Post-verifier | `isso-review` | `gsd-isso` review |
| `verify-work.md` | Pre-UAT | `transition-readiness` | `gsd-transition-advisor` |
| `secure-phase.md` | Threat model gate | `intel-threats` | Extended STRIDE with IC-flavored threats |
| `audit-milestone.md` | Periodic | `issm-review` | `gsd-issm` review + `gsd-poam-tracker` update |

### 9.4 Dispatcher Protocol

The `intel-gate-*` skill dispatcher is a thin command that:

1. Reads `.planning/intel-gates.json` and `.planning/intel-context.md`
2. Looks up the specified gate by name
3. Determines which agent(s) to spawn based on `dispatcher` policy:
   - `direct`: spawns the single named `agent`
   - `select-by-int-discipline`: parses phase scope for INT keywords against the in-scope INTs from `intel-context.md`, spawns matched per-INT researchers in parallel
   - `select-by-mission-framing`: similar but for mission-framing analysts
4. Collects completion markers
5. Returns structured result to the calling workflow

### 9.5 POA&M Auto-Population

When `poam_auto_create: true` is set on the compliance-audit gate (default), every finding produced by a Family A or B agent is automatically converted into a POA&M entry with status `Open` by `gsd-poam-tracker`. The `gsd-isso` and `gsd-issm` agents then curate, prioritize, and close them as part of their orchestration.

The auto-create behavior maps:
- Each finding becomes one POA&M row with: source agent, control reference (NIST 800-53 / CMMC / 800-171 / DFARS / etc.), severity, recommended action, due-date proposal
- Auto-created entries inherit `[U]` classification banner (per §4.5)
- POA&M file is `.planning/POAM.md` with structured frontmatter; auto-create is idempotent (re-running compliance agents updates open entries, doesn't duplicate)

This satisfies both the auditability goal (every finding traceable to who/when/why via the audit log §4.6) and the prototype-velocity goal (no manual ferrying of audit findings into POA&M tables).

### 9.6 Trigger string vocabulary

Trigger strings (e.g., `plan-phase.research-stage`) follow the convention `<workflow-name>.<step-name>`. **The vocabulary is open-ended** — any string is a valid trigger. **CI validates** that every trigger referenced in `intel-gates.json` resolves to a real step in some stock workflow. This avoids enumerating an artificial vocabulary while keeping configuration honest.

When upstream renames a workflow step, CI catches the dangling trigger reference and fails the upstream-sync until intel-gates.json is updated.

### 9.7 Per-customer overlay precedence

When two customer overlays both apply (rare multi-AO case where a program targets >1 customer), they compose by **first-wins**:

- Order is the order overlays appear in the program's `agent_skills` config (e.g., `["config-overlays/nga", "config-overlays/nro"]`).
- The first overlay's content takes precedence.
- Later overlays supplement only where the first is silent.

This forces engineers to intentionally rank customers when running multi-AO. CI does not warn on multi-overlay; the first-wins rule is deterministic and engineer-controlled.

### 9.8 Workflow patch storage

Workflow patches (modifications to stock GSD workflow files for the gate-hook insertion points) are stored as **a script-driven set of edits**, not as static `.diff` files:

```
tools/patch-workflows.sh
```

The script applies edits programmatically (via `sed` / `awk` / structured `jq` operations on the workflow Markdown). This approach is more resilient than `.diff` files when upstream restructures workflows in ways that don't change the semantic insertion points. The script is the source of truth; CI re-runs it on every upstream-sync to validate the edits still apply.

Engineers update the script when upstream restructures invalidate an edit; the diff for review is the script change, not a regenerated `.diff` file.

### 9.9 Conflict Minimization Strategy

- Each insertion point modifies at most one line of stock workflow content (the conditional `Skill(...)` call).
- Disabling all gates restores stock behavior exactly. Upstream merges only conflict on the small set of touched lines.
- Workflow patches live in `workflow-patches/*.diff` — applied during install/sync, not maintained as full overlays. This keeps the diff against upstream visible and reviewable.

---

## 10. Repo Layout

```
/Users/romansky/gsd-ic/                ← soft fork of canonical GSD
├── agents/                            ← 45 custom agents alongside the stock 33
│   ├── gsd-rmf-control-mapper.md
│   ├── gsd-itar-screener.md
│   ├── gsd-isso.md
│   └── ... (42 more)
├── commands/gsd/                      ← new slash commands (internal, gate dispatchers)
│   ├── intel-gate-context-mapper.md
│   ├── intel-gate-int-research.md
│   ├── intel-gate-compliance-audit.md
│   └── ... (per gate)
├── intel-refs/                        ← Layer 2 knowledge library
│   ├── MANIFEST.json
│   ├── int-disciplines/                ← humint, geoint, sigint, osint, masint,
│   │                                     cybint, finint, techint, medint, techsigint
│   ├── capability-patterns/
│   ├── tradecraft/                     ← icd-203, icd-206, weps, sats, etc.
│   ├── classification/
│   ├── house-style/                    ← white-papers.md, proposals.md, briefs.md
│   ├── demo/
│   ├── modernization/
│   ├── ai-ml/                          ← hitl-patterns, xai-patterns, eval-patterns
│   └── ecosystem/
├── skills/                            ← Layer 3 (4 skills)
│   ├── intel-coding-conventions/
│   ├── prototyping-discipline/
│   ├── classification-conventions/
│   ├── cross-program-reuse/
│   └── adelphi-house-style/
├── config-overlays/                   ← Layer 4 (per-customer)
│   ├── README.md
│   ├── nga/
│   ├── nsa/
│   ├── nro/
│   ├── cia/
│   └── dia/
├── hooks/                             ← Layer 0 (3 new hooks)
│   ├── gsd-classification-banner.js
│   ├── gsd-classified-leak-detector.js
│   ├── gsd-prompt-injection-scan-intel.js
│   └── patterns/
│       ├── classified-markings.json
│       └── intel-injection-patterns.json
├── workflow-patches/                  ← Surgical patches to stock workflows
│   ├── new-project.intel-gates.diff
│   ├── plan-phase.intel-gates.diff
│   ├── execute-phase.intel-gates.diff
│   ├── verify-work.intel-gates.diff
│   ├── secure-phase.intel-gates.diff
│   └── audit-milestone.intel-gates.diff
├── tools/                             ← Maintenance and CI scripts (sub-organized for clarity)
│   ├── install-pack.sh                ← installs custom artifacts into per-project .claude/ dirs
│   ├── patch-workflows.sh             ← applies workflow gate-hook edits programmatically (§9.8)
│   ├── reuse.sh                       ← cross-program-reuse helper (calls into the skill)
│   ├── release-pack.sh                ← bumps pack version, tags release
│   ├── sync/
│   │   └── sync-from-upstream.sh      ← merges upstream/main + reapplies workflow patches
│   ├── ci/
│   │   ├── validate-manifest.sh
│   │   ├── validate-classification.sh
│   │   ├── validate-agents.sh
│   │   ├── validate-skills.sh
│   │   ├── validate-workflow-patches.sh
│   │   ├── validate-no-classified-leak.sh
│   │   ├── validate-triggers.sh                ← every gate trigger resolves to a real workflow step
│   │   ├── validate-reference-staleness.sh     ← warns on references with last_reviewed > 6mo
│   │   └── validate-audit-log.sh               ← enforces .planning/audit.md entry format
│   └── release/
│       └── (release-helper scripts as needed)
├── docs/                              ← Documentation (this directory inherits from upstream)
│   ├── README.md (upstream)
│   ├── ARCHITECTURE.md (upstream)
│   ├── ic-pack/                       ← IC pack docs
│   │   ├── README.md
│   │   ├── ARCHITECTURE.md
│   │   ├── QUICKSTART.md                ← 30-min path from clone to first agent invocation
│   │   ├── PER-CUSTOMER-PLAYBOOK.md     ← onboarding a new customer (overlay setup, refs, gotchas)
│   │   ├── TROUBLESHOOTING.md           ← common failure modes and fixes
│   │   ├── ADDING-AN-AGENT.md
│   │   ├── ADDING-A-REFERENCE.md
│   │   ├── ADDING-A-CUSTOMER-OVERLAY.md
│   │   ├── ADDING-A-SKILL.md
│   │   ├── UPGRADE-PROCEDURE.md
│   │   └── ARCHITECTURE-DIAGRAMS/       ← rendered Mermaid diagrams (layer model, agent flows, gate dispatch)
│   └── specs/
│       └── 2026-05-05-ic-agent-pack-design.md   ← THIS FILE
└── (everything else inherited from upstream GSD, untouched)
```

### 10.1 Per-program `.planning/` directory shape

When a program uses the IC pack, its `.planning/` directory has these IC-pack-specific subdirectories alongside the standard GSD ones:

```
.planning/                              ← per-program; isolated per §2.3 constraint
├── intel-context.md                    ← per-program project context (§4 Layer 5)
├── intel-gates.json                    ← per-program gate enablement (§9)
├── audit.md                            ← append-only operational log (§4.6)
├── decisions/                          ← per-decision rationale files (§4.6)
│   └── {YYYY-MM-DD}-{topic}.md
├── synthetic-data/                     ← outputs from gsd-synthetic-data-engineer (#54)
│   └── {dataset-name}/
├── past-performance/                   ← per-program past-performance tracker (#31)
│   ├── PP-LOG.md
│   └── CITATIONS.md
├── narrative/                          ← three-audience narrative blocks (#27)
├── briefs/                             ← capability + milestone briefs (#21, #24)
├── papers/                             ← white papers (#25)
├── demos/                              ← demo scripts (#26)
├── proposals/                          ← formal proposals (#30)
├── captures/                           ← RFI analyses + capability gap analyses (#28, #35)
├── capabilities/                       ← capability statements (#29)
├── tims/                               ← TIM prep materials (#23)
├── aar/                                ← after-action records (#22)
├── win-themes.md                       ← per-program win-theme library
├── evidence-packages/                  ← ATO/IV&V submissions (#19)
└── (standard GSD subdirectories: phases/, todos/, threads/, etc.)
```

---

## 11. Maintenance & Upgradability

### 11.-1 Release cadence

**Continuous + tagged.** Main is always releasable; explicit tagged releases happen at meaningful milestones (new agent families ship, batch of reference-doc updates, upstream-GSD-version-bump validation). Tagged releases bump the `pack` version in `VERSION` (date-shaped `YYYY.MM.N`).

Engineers consuming the pack pin to a tag in their per-program install (`tools/install-pack.sh --version=YYYY.MM.N`); CI runs against the latest tag; main is the rolling integration branch where work happens.

### 11.0 IC Pack version

The IC pack maintains its own version, separate from but coupled to upstream GSD:

- **`VERSION` file at repo root** — declares two values:
  - `pack: YYYY.MM.N` (e.g., `2026.05.0`) — the IC pack's own release; bumped on every pack release; aligns date-shape with manifest version (§8.1).
  - `gsd_pinned: vX.Y.Z` (e.g., `v1.40.0`) — the upstream GSD version this pack is known-compatible with; bumped on every upstream sync that has been validated against the pack.

- `tools/sync-from-upstream.sh` updates `gsd_pinned` after a successful merge; `tools/release-pack.sh` bumps `pack` on a tagged release.

- Engineers running the pack pin to a specific `pack` version via `tools/install-pack.sh --version=YYYY.MM.N`; CI uses the latest `pack` tag.

### 11.1 Soft Fork Tracking Procedure

```bash
# Pull GSD community improvements
git -C /path/to/gsd-ic fetch upstream
git -C /path/to/gsd-ic merge upstream/main

# If conflicts in workflow files, reapply patches
bash /path/to/gsd-ic/tools/sync-from-upstream.sh

# Validate
bash /path/to/gsd-ic/tools/validate-manifest.sh
bash /path/to/gsd-ic/tools/validate-classification.sh
bash /path/to/gsd-ic/tools/validate-agents.sh
bash /path/to/gsd-ic/tools/validate-skills.sh
bash /path/to/gsd-ic/tools/validate-workflow-patches.sh
bash /path/to/gsd-ic/tools/validate-no-classified-leak.sh

# Push to fork
git -C /path/to/gsd-ic push origin main
```

### 11.2 Adding a New Agent

1. Create `agents/gsd-<name>.md` following the template in `docs/ic-pack/ADDING-AN-AGENT.md` (also Appendix A here)
2. Register completion marker in `references/agent-contracts.md` (alongside the upstream registry)
3. Register agent → model row in `MODEL_PROFILES` in `sdk/src/query/config-query.ts`
4. (Optional) Register a workflow gate by editing `.planning/intel-gates.json` template; **do not edit workflow files**
5. Run `tools/install-pack.sh` to sync into runtime dirs
6. Add a `.changeset/*.md` if the upstream `Changeset Required` CI check is enabled

### 11.3 Adding a New Reference

1. Write `intel-refs/<topic-area>/<name>.md` with classification frontmatter (must be `UNCLASSIFIED`)
2. Add entry to `intel-refs/MANIFEST.json` with `applies_when`, `owner`, `last_reviewed`
3. Run `tools/validate-manifest.sh` to confirm
4. Commit

### 11.4 Adding a New Customer Overlay

1. Create `config-overlays/<customer>/`
2. Drop in `overlay.json` with customer-specific `agent_skills` map
3. (Optional) Drop customer-specific reference docs in `config-overlays/<customer>/refs/`
4. Reference from per-program `.planning/config.json` `agent_skills`

### 11.5 Adding a New Skill

1. Create `skills/<skill-name>/SKILL.md` with the skill content
2. Add to per-program `.planning/config.json` `agent_skills` map for the agents that should use it
3. Run `tools/validate-skills.sh`

---

## 12. CI / Validation Strategy

| Check | Enforces | Failure mode |
|---|---|---|
| `validate-manifest.sh` | Every manifest entry resolves to a real file; every reference doc has owner + last_reviewed + classification fields | Build fail |
| `validate-classification.sh` | No reference doc has `classification != "UNCLASSIFIED"` — prevents accidental commit of CUI/classified content | Build fail |
| `validate-agents.sh` | Every agent has frontmatter + completion marker + matches the contract template | Build fail |
| `validate-skills.sh` | Every skill referenced by `agent_skills` exists; every `SKILL.md` has classification frontmatter | Build fail |
| `validate-workflow-patches.sh` | Workflow patches still apply cleanly against current upstream | Build fail (gate before merge) |
| `validate-no-classified-leak.sh` | Repo grep for `S//`, `TS//`, `SI//`, `TK//`, `HCS//`, etc. — fails build if any classified compartment marking is found | Build fail |
| `validate-completion-markers.sh` | Every agent's declared completion marker is registered in `references/agent-contracts.md` | Build fail |
| `validate-triggers.sh` | Every trigger string referenced in `intel-gates.json` resolves to a real step in some stock workflow file | Build fail |
| `validate-reference-staleness.sh` | Warns when any reference doc's `last_reviewed` exceeds 6 months; does not fail build (advisory) | Warning |
| `validate-audit-log.sh` | Enforces format of `.planning/audit.md` entries (timestamp + agent + completion-marker + artifact-path + notes); fails on malformed lines | Build fail |

CI runs on every PR. Soft-fork sync from upstream also runs all checks before push.

---

## 13. Build Sequencing within v1

All 58 agents ship in v1; this section orders the build for fastest time-to-working-pack.

| Phase | Build | Why first |
|---|---|---|
| **0. Foundations** | `gsd-customer-context-mapper`, `gsd-classification-banner` hook, `gsd-classified-leak-detector` hook, `gsd-prompt-injection-scan-intel` hook, manifest skeleton, 5 essential reference docs (`int-disciplines/humint`, `int-disciplines/geoint`, `tradecraft/icd-203`, `capability-patterns/entity-resolution`, `capability-patterns/pattern-of-life`), `classification-conventions` skill, `intel-coding-conventions` skill | Everything downstream reads context; hooks protect every write from day one; foundational refs unblock per-INT specialists |
| **1. Compliance core** | `gsd-itar-screener`, `gsd-privacy-reviewer`, `gsd-cmmc-auditor`, `gsd-rmf-control-mapper`, `gsd-fips-140-3-validator`, `gsd-sbom-generator`, `gsd-nist-800-171-auditor`, `gsd-dfars-incident-responder` | Compliance must work before custom development extends. All 8 Family A specialists + the privacy reviewer ship together so POA&M auto-population works end-to-end on first program. |
| **2. Domain knowledge** | All 7 per-INT researchers + `gsd-all-source-researcher` + `gsd-domex-engineer` + supporting reference library | Enables domain-aware planning for any prototype |
| **3. Mission/design** | `gsd-mission-gap-analyst`, `gsd-customer-context-mapper` (already in Phase 0), `gsd-sow-decomposer`, `gsd-mission-narrative-writer`, `gsd-capability-gap-analyst`, `gsd-fusion-architect` | Bridge from opportunity to capability |
| **4. Customer engagement** | `gsd-capability-brief-generator`, `gsd-white-paper-drafter`, `gsd-demo-scripter`, `gsd-after-action-recorder`, `gsd-tim-facilitator`, `gsd-rfi-analyst`, `gsd-capability-statement-generator`, `gsd-proposal-drafter`, `gsd-past-performance-manager`, `prototyping-discipline` skill, `adelphi-house-style` skill, `cross-program-reuse` skill | Speed-to-demo deliverables; the demo *and* the contracting paperwork |
| **5. Engineering enablement + mission framings** | `gsd-synthetic-data-engineer`, `gsd-intel-devops`, `gsd-stig-auditor`, `gsd-ci-analyst`, `gsd-targeting-analyst`, `gsd-insider-threat-analyst`, `gsd-adversary-modeler` | Specialty engineering and analytic roles. `gsd-stig-auditor` lives here (not Phase 1) because it depends on `gsd-intel-devops` producing IaC/container configs to audit. |
| **6. Security personas + ATO docs + transition** | `gsd-isso`, `gsd-issm`, all Family D ATO doc specialists (SSP-drafter, POA&M-tracker, SAR-dryrun, IV&V-dryrun, ConMon-planner, IRP-author, contingency-planner, evidence-packager), `gsd-cdrl-mapper`, `gsd-milestone-brief-generator`, `gsd-transition-advisor` | Higher-level orchestrators built on top of compliance core |
| **7. Round 4 expansion: tradecraft compliance + new INTs + always-on parallels + AI specialty** | `gsd-icd-203-enforcer`, `gsd-techint-researcher`, `gsd-medint-researcher`, `gsd-techsigint-researcher`, `gsd-tim-facilitator`, Family L always-on integration (CI / targeting / insider-threat / adversary-modeler — wiring into intel-gates.json), `gsd-ai-eval-auditor`, `gsd-fm-adaptation-engineer` | Surfaces that build on top of the foundation: analytic-quality enforcement, additional INTs, parallel mission-framing wiring, AI/ML specialty agents. These ship after Phase 6 because they consume artifacts from earlier-phase agents. |

---

## 14. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-01 | SME bottleneck on reference doc curation | High | High | Manifest-driven structure decouples knowledge from agents; SMEs edit Markdown without code touch. Reference owners assigned per topic; quarterly review cadence. |
| R-02 | Upstream GSD makes incompatible workflow changes | Medium | Medium | Gate hooks minimize touch points; CI validates patches reapply cleanly; sync-from-upstream script automates re-application |
| R-03 | Customer-sensitive content accidentally committed to framework repo | Low | High | CI `validate-no-classified-leak.sh` + `validate-classification.sh` + reference doc classification frontmatter required |
| R-04 | Per-customer overlay drift across customers | Medium | Low | Each overlay has README; CI validates overlay schema; manifest validates customer-specific refs |
| R-05 | Agent file size budget exceeded as references inline | Low | Medium | Manifest-driven loading prevents inline bloat; CI enforces ≤500-line agent files |
| R-06 | Per-INT researcher knowledge insufficient depth for advanced prototypes | Medium | Medium | Per-INT split allows independent depth-of-knowledge growth; can promote to dedicated sub-discipline researcher (e.g., `gsd-imint-researcher`) when warranted |
| R-07 | Soft fork diverges too far to merge upstream changes | Low | High | Architecture deliberately additive; only workflow patches modify stock files; quarterly upstream sync target |
| R-08 | Hooks cause friction in dev workflow (false positives, blocking) | Medium | Low | All hooks default to advisory mode; block-on-match is opt-in per-project |
| R-09 | `tools/patch-workflows.sh` fails unexpectedly when upstream restructures workflows | Medium | Medium | CI runs the patch script on every upstream-sync; failures gate the merge until script is updated. Script is the source of truth (§9.8). |
| R-10 | Family L mission-framing analysts (always-on parallel) produce noise — engineers may start ignoring outputs | Medium | Medium | Gates can disable per-program via intel-gates.json; per-program review-threshold tuning when noise exceeds signal. SMEs review the trigger logic quarterly. |
| R-11 | `gsd-ai-eval-auditor` "mission utility" metric defined inconsistently across programs | Medium | Low | Standardize the mission-utility metric definition in `intel-refs/ai-ml/eval-patterns.md`; auditor agent reads the standard and applies it consistently. |
| R-12 | (mitigated by upstream architecture) Context rot — agents fill their context window | — | — | **Not a meaningful risk for this pack.** Stock GSD's fresh-context-per-agent design (each spawn gets ~200K) addresses this at the framework layer; the IC pack inherits the mitigation. Listed here for completeness, not as an open risk. |

---

## 15. Rollout Plan

### 15.1 Internal rollout — per-program adoption

The pack does not have a company-wide rollout date. Instead, each program's PM decides when to enable the pack on their program based on readiness and program tempo. This avoids forcing adoption on programs in critical-delivery windows and respects per-program autonomy.

**Per-program adoption procedure:**

1. **PM evaluation.** PM reviews the pack against current program needs and timeline. Estimate cost: 1–2 hour read of QUICKSTART.md + ARCHITECTURE.md.
2. **SME readiness check.** Confirm SMEs are assigned per primary INT in scope (per §2.3 staffing constraint). Without SMEs, defer enablement until staffed.
3. **Pilot phase.** PM picks one upcoming phase to use the pack on; engineers use it; PM and engineers do an after-action.
4. **Decision: continue / extend / roll back.** Based on pilot outcome.
5. **Full enablement** (if continued). Pack is enabled for the rest of the program; per-program `.planning/intel-gates.json` is tuned.

**Programs do not migrate mid-stream** unless the PM explicitly chooses to. The pack-enabled program is its own decision.

### 15.1.1 Pre-rollout: SME onboarding

Before any program can adopt, SMEs need to have curated the relevant `intel-refs/` content. For a new INT discipline coming online, the curation effort is 1–3 weeks per discipline (reference docs, customer overlays, capability-pattern entries). This is the staff-onboarding bottleneck mentioned in R-01.

### 15.2 Documentation

- `docs/ic-pack/README.md` — what this is, when to use
- `docs/ic-pack/ARCHITECTURE.md` — layered architecture explanation (subset of this spec)
- `docs/ic-pack/ADDING-AN-AGENT.md` — how to add a new agent
- `docs/ic-pack/ADDING-A-REFERENCE.md` — how to add a new reference doc
- `docs/ic-pack/ADDING-A-CUSTOMER-OVERLAY.md` — onboarding a new customer
- `docs/ic-pack/UPGRADE-PROCEDURE.md` — soft-fork upstream sync

### 15.3 Training

- 60-min walkthrough: framework overview + how to invoke a few key agents
- 30-min hands-on: adding a reference doc to the manifest
- 30-min hands-on: scaffolding a new prototype with the IC pack enabled

---

## 16. Open Questions / Decisions Deferred to Implementation

The following decisions are deferred to the implementation plan (writing-plans output) so we don't block on them now:

| ID | Question | Disposition |
|---|---|---|
| O-01 | Exact frontmatter schema for `intel-refs/*.md` files (free-form text vs. structured sections beyond the manifest fields) | Decide in writing-plans Phase 0 |
| O-02 | ~~Which `Trigger` strings the gate dispatcher recognizes — full enumeration~~ | **Resolved by §9.6** — vocabulary is open-ended; CI validates each trigger resolves to a real workflow step |
| O-03 | ~~Per-customer overlay precedence rules when overlays conflict~~ | **Resolved by §9.7** — first-wins ordering by position in `agent_skills` config |
| O-04 | ~~Whether `gsd-intel-devops` should produce IaC stubs or only review them~~ | **Resolved by Round 4** — full implementation across 4 AWS service catalogs; produces IaC, CI/CD configs, hardening guidance |
| O-05 | Posture-escalation flow specifics if/when CUI handling is later required (out of v1 scope) | Future v2 |
| O-06 | ~~Whether the gate dispatcher should support agent fan-out + result-merge for parallel execution within a gate~~ | **Resolved by Family L always-on parallel decision (Round 4)** — gate dispatcher fans out to multiple agents in parallel; results collected and routed back to caller |
| O-07 | Specific `applies_when` keyword vocabulary (controlled vocabulary vs. free tags) | Decide in writing-plans Phase 0 |

---

## 17. Appendices

### Appendix A — Agent File Template

```markdown
---
name: gsd-<role-name>
description: <One-line role description>
tools: Read, Write, Bash, Grep, Glob   # principle of least privilege
color: <terminal-color>
---

<role>
You are a GSD <role-name>. <One paragraph describing the role's responsibility.>

Spawned by:
- <gate or workflow that fires this agent>

Your job: <What the agent produces and what it must NOT do.>

@~/.claude/get-shit-done/references/mandatory-initial-read.md
</role>

<knowledge_loading>
At startup, read `intel-refs/MANIFEST.json` and `.planning/intel-context.md`.
Match phase scope keywords against `applies_when` tags; load the matched
reference docs. Do not load references whose classification field is not
"UNCLASSIFIED".
</knowledge_loading>

<execution_flow>
<step name="load_context">
  Read .planning/intel-context.md and the manifest.
</step>
<step name="<task>">
  <Description of the agent's work>
</step>
<step name="produce_output">
  Write to <output-path> using the structure in Appendix B.
</step>
</execution_flow>

<structured_returns>
## <COMPLETION_MARKER>
<Output schema>
</structured_returns>

<critical_rules>
- Never determine classifications. Honor user-declared classification only.
- Reference docs you load are UNCLASSIFIED only.
- Do not write classified content. If your output would contain it, halt and emit `## <ROLE> BLOCKED: classification escalation required`.
</critical_rules>
```

### Appendix B — Reference Doc Template

```markdown
---
classification: UNCLASSIFIED
owner: <email>
last_reviewed: 2026-05-05
applies_when: [keyword1, keyword2, ...]
---

# <Topic Title>

<One-paragraph summary of what this reference covers and when an agent should consult it.>

## <Section 1>

<Content>

## <Section 2>

<Content>

## See Also

- `<other-reference-path>` — for related coverage
```

### Appendix C — Skill File Template

```markdown
---
name: <skill-name>
description: <One-line>
classification: UNCLASSIFIED
---

# <Skill Title>

<Behavioral guidance content. Read by agents when this skill is in their
agent_skills config.>

## Rules

1. <Rule>
2. <Rule>

## Examples

<Concrete examples showing the expected behavior>
```

### Appendix D — Completion Marker Registry (full)

| Agent | Marker(s) |
|---|---|
| `gsd-rmf-control-mapper` | `## RMF MAPPING COMPLETE` / `## RMF MAPPING BLOCKED` |
| `gsd-stig-auditor` | `## STIG AUDIT COMPLETE` / `## STIG VIOLATIONS FOUND` |
| `gsd-cmmc-auditor` | `## CMMC AUDIT COMPLETE` / `## CMMC GAPS FOUND` |
| `gsd-itar-screener` | `## ITAR SCREEN COMPLETE` / `## ITAR EXPOSURE FOUND` / `## ITAR ESCALATE` |
| `gsd-fips-140-3-validator` | `## FIPS VALIDATION COMPLETE` / `## FIPS NON-VALIDATED FOUND` |
| `gsd-sbom-generator` | `## SBOM COMPLETE` / `## SBOM INCOMPLETE` |
| `gsd-nist-800-171-auditor` | `## 800-171 AUDIT COMPLETE` / `## 800-171 GAPS FOUND` |
| `gsd-dfars-incident-responder` | `## DFARS PLAYBOOK COMPLETE` |
| `gsd-privacy-reviewer` | `## PRIVACY REVIEW COMPLETE` / `## PRIVACY ISSUES FOUND` / `## PIA REQUIRED` |
| `gsd-isso` | `## ISSO REVIEW COMPLETE` / `## ISSO BRIEF READY` |
| `gsd-issm` | `## ISSM DETERMINATION COMPLETE` (READY-FOR-AO / REMEDIATE-FIRST / RISK-ACCEPTED-WITH-MITIGATION) |
| `gsd-ssp-drafter` | `## SSP DRAFT COMPLETE` / `## SSP DRAFT BLOCKED` |
| `gsd-poam-tracker` | `## POAM UPDATE COMPLETE` |
| `gsd-sar-dryrun` | `## SAR DRYRUN COMPLETE` / `## SAR FINDINGS` |
| `gsd-iv-and-v-dryrun` | `## IVV DRYRUN COMPLETE` / `## IVV FINDINGS` |
| `gsd-conmon-planner` | `## CONMON PLAN COMPLETE` |
| `gsd-irp-author` | `## IRP COMPLETE` |
| `gsd-contingency-planner` | `## CONTINGENCY PLAN COMPLETE` |
| `gsd-evidence-packager` | `## EVIDENCE PACKAGE COMPLETE` / `## EVIDENCE PACKAGE INCOMPLETE` |
| `gsd-cdrl-mapper` | `## CDRL MAPPING COMPLETE` / `## UNMAPPED CDRLs FOUND` |
| `gsd-milestone-brief-generator` | `## MILESTONE BRIEF COMPLETE` |
| `gsd-after-action-recorder` | `## AFTER ACTION COMPLETE` |
| `gsd-tim-facilitator` | `## TIM PREP COMPLETE` |
| `gsd-capability-brief-generator` | `## CAPABILITY BRIEF COMPLETE` |
| `gsd-white-paper-drafter` | `## WHITE PAPER COMPLETE` |
| `gsd-demo-scripter` | `## DEMO SCRIPT COMPLETE` |
| `gsd-mission-narrative-writer` | `## NARRATIVE BLOCKS COMPLETE` |
| `gsd-rfi-analyst` | `## RFI ANALYSIS COMPLETE` |
| `gsd-capability-statement-generator` | `## CAPABILITY STATEMENT COMPLETE` |
| `gsd-proposal-drafter` | `## PROPOSAL DRAFT COMPLETE` |
| `gsd-past-performance-manager` | `## PP UPDATE COMPLETE` |
| `gsd-mission-gap-analyst` | `## MISSION GAP COMPLETE` |
| `gsd-customer-context-mapper` | `## CONTEXT MAPPED` |
| `gsd-sow-decomposer` | `## SOW DECOMPOSITION COMPLETE` |
| `gsd-capability-gap-analyst` | `## CAPABILITY GAP ANALYSIS COMPLETE` |
| `gsd-humint-researcher` | `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED` |
| `gsd-geoint-researcher` | `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED` |
| `gsd-sigint-researcher` | `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED` |
| `gsd-osint-researcher` | `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED` |
| `gsd-masint-researcher` | `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED` |
| `gsd-cybint-researcher` | `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED` |
| `gsd-finint-researcher` | `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED` |
| `gsd-techint-researcher` | `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED` |
| `gsd-medint-researcher` | `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED` |
| `gsd-techsigint-researcher` | `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED` |
| `gsd-all-source-researcher` | `## RESEARCH COMPLETE` / `## RESEARCH BLOCKED` |
| `gsd-icd-203-enforcer` | `## ICD 203 AUDIT COMPLETE` / `## ICD 203 VIOLATIONS FOUND` |
| `gsd-domex-engineer` | `## DOMEX ENGINEERING COMPLETE` |
| `gsd-ci-analyst` | `## CI ANALYSIS COMPLETE` |
| `gsd-targeting-analyst` | `## TARGETING ANALYSIS COMPLETE` |
| `gsd-insider-threat-analyst` | `## INSIDER THREAT ANALYSIS COMPLETE` |
| `gsd-adversary-modeler` | `## ADVERSARY MODEL COMPLETE` |
| `gsd-fusion-architect` | `## FUSION ARCHITECTURE COMPLETE` |
| `gsd-synthetic-data-engineer` | `## SYNTHETIC DATA READY` |
| `gsd-intel-devops` | `## DEVOPS PLAN COMPLETE` |
| `gsd-ai-eval-auditor` | `## AI EVAL DESIGN COMPLETE` / `## AI EVAL AUDIT COMPLETE` / `## AI EVAL ISSUES FOUND` |
| `gsd-fm-adaptation-engineer` | `## FM ADAPTATION COMPLETE` |
| `gsd-transition-advisor` | `## TRANSITION READINESS COMPLETE` / `## TRANSITION GAPS FOUND` |

### Appendix E — Manifest Topic Tag Vocabulary (initial draft)

```
INT disciplines: humint, geoint, sigint, osint, masint, cybint, finint
GEOINT sub:      imint, fmv, agi, foundation-geoint
SIGINT sub:      comint, elint, fisint
OSINT sub:       socmint, pai
Mission framings: ci, fi, targeting, insider-threat, d-and-d
Capability patterns: entity-resolution, pattern-of-life, network-analysis,
                    anomaly-detection, attribution, triage-workflow,
                    knowledge-graph, sentiment-analysis, fusion
Mission domains: counterterrorism, counterproliferation, wmd, cyber, space, fid
Tradecraft: icd-203, icd-206, weps, sats, tearline, source-protection
Classification: marking, releasability, cui-categories, derivative
AI/ML: hitl, xai, eval, fm-adaptation, adversarial-robustness
Demo: vignettes, ux-patterns, failure-modes, repeatability
Modernization: ai-adoption, osint-elevation, commercial-sensors, prc-focus,
              counterspace, climate-security, cyber-physical
Ecosystem: ic-ite, c2e, jwics, sipnet, niprnet, functional-managers,
          ot-consortia, innovation-tracks
Stages: tcped, ped, dissemination, collection-management, all-source-fusion
```

This vocabulary is extended as new reference docs and agents are added; CI validates manifest entries reference only known tags or warns on novel tags for review.

---

## End of Spec

Reviewers: please leave inline comments or open issues against this file. Once approved, the next deliverable is an implementation plan (writing-plans output) sequencing the 7 build phases described in §13.
