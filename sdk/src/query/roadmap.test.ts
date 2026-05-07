/**
 * Unit tests for roadmap query handlers.
 *
 * Tests roadmapAnalyze, roadmapGetPhase, getMilestoneInfo,
 * extractCurrentMilestone, and stripShippedMilestones.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// These will be imported once roadmap.ts is created
import {
  roadmapAnalyze,
  roadmapGetPhase,
  getMilestoneInfo,
  extractCurrentMilestone,
  extractNextMilestoneSection,
  extractPhasesFromSection,
  stripShippedMilestones,
} from './roadmap.js';

// ─── Test fixtures ────────────────────────────────────────────────────────

const ROADMAP_CONTENT = `# Roadmap

## Current Milestone: v3.0 SDK-First Migration

**Goal:** Migrate all deterministic orchestration into TypeScript SDK.

- [x] **Phase 9: Foundation and Test Infrastructure**
- [ ] **Phase 10: Read-Only Queries**
- [ ] **Phase 11: Mutations**

### Phase 9: Foundation and Test Infrastructure

**Goal:** Build core SDK infrastructure.

**Depends on:** None

**Success Criteria**:
1. Error classification system exists
2. Query registry works

### Phase 10: Read-Only Queries

**Goal:** Port read-only query operations.

**Depends on:** Phase 9

**Success Criteria**:
1. All read queries work
2. Golden file tests pass

### Phase 11: Mutations

**Goal:** Port mutation operations.

**Depends on:** Phase 10
`;

const STATE_WITH_MILESTONE = `---
gsd_state_version: 1.0
milestone: v3.0
status: executing
---

# Project State

**Current Phase:** 10
**Status:** Ready to execute
`;

// ─── Helpers ──────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'roadmap-test-'));
  await mkdir(join(tmpDir, '.planning', 'phases', '09-foundation'), { recursive: true });
  await mkdir(join(tmpDir, '.planning', 'phases', '10-read-only-queries'), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── stripShippedMilestones ───────────────────────────────────────────────

describe('stripShippedMilestones', () => {
  it('removes <details> blocks', () => {
    const content = 'before\n<details>\nshipped content\n</details>\nafter';
    expect(stripShippedMilestones(content)).toBe('before\n\nafter');
  });

  it('handles multiple <details> blocks', () => {
    const content = '<details>a</details>middle<details>b</details>end';
    expect(stripShippedMilestones(content)).toBe('middleend');
  });

  // Bug #2641 (symmetry): tolerate attributes on <details> tag, matching
  // extractCurrentMilestone's attribute-tolerant fallback. Without this,
  // shipped content wrapped in `<details open>` (a common GitHub pattern for
  // sections that should default to expanded) would leak through the strip.
  it('removes <details open> blocks (attribute-bearing tags)', () => {
    const content = 'before\n<details open>\nshipped content\n</details>\nafter';
    expect(stripShippedMilestones(content)).toBe('before\n\nafter');
  });

  it('removes <details class="..."> blocks (attribute-bearing tags)', () => {
    const content = 'a<details class="milestone" data-version="v0.5">x</details>b';
    expect(stripShippedMilestones(content)).toBe('ab');
  });

  it('returns content unchanged when no details blocks', () => {
    expect(stripShippedMilestones('no details here')).toBe('no details here');
  });

  // Bug #2496: inline ✅ SHIPPED heading sections must be stripped
  it('strips ## heading sections marked ✅ SHIPPED', () => {
    const content = [
      '## Milestone v1.0: MVP — ✅ SHIPPED 2026-01-15',
      '',
      'Phase 1, Phase 2',
      '',
      '## Milestone v2.0: Current',
      '',
      'Phase 3',
    ].join('\n');
    const stripped = stripShippedMilestones(content);
    expect(stripped).not.toContain('MVP');
    expect(stripped).not.toContain('v1.0');
    expect(stripped).toContain('v2.0');
    expect(stripped).toContain('Current');
  });

  it('strips multiple inline SHIPPED sections and leaves non-shipped content', () => {
    const content = [
      '## Milestone v1.0: Alpha — ✅ SHIPPED 2026-01-01',
      '',
      'Old content',
      '',
      '## Milestone v1.5: Beta — ✅ SHIPPED 2026-02-01',
      '',
      'More old content',
      '',
      '## Milestone v2.0: Gamma',
      '',
      'Current content',
    ].join('\n');
    const stripped = stripShippedMilestones(content);
    expect(stripped).not.toContain('Alpha');
    expect(stripped).not.toContain('Beta');
    expect(stripped).toContain('Gamma');
    expect(stripped).toContain('Current content');
  });

  // Bug #2508 follow-up: ### headings must be stripped too
  it('strips ### heading sections marked ✅ SHIPPED', () => {
    const content = [
      '### Milestone v1.0: MVP — ✅ SHIPPED 2026-01-15',
      '',
      'Phase 1, Phase 2',
      '',
      '### Milestone v2.0: Current',
      '',
      'Phase 3',
    ].join('\n');
    const stripped = stripShippedMilestones(content);
    expect(stripped).not.toContain('MVP');
    expect(stripped).not.toContain('v1.0');
    expect(stripped).toContain('v2.0');
    expect(stripped).toContain('Current');
  });
});

// ─── getMilestoneInfo ─────────────────────────────────────────────────────

describe('getMilestoneInfo', () => {
  it('extracts version and name from heading format', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT);
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v3.0');
    expect(info.name).toBe('SDK-First Migration');
  });

  it('extracts from in-progress marker format', async () => {
    const roadmap = '- \u{1F6A7} **v2.1 Belgium** \u2014 Phases 24-28 (in progress)';
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v2.1');
    expect(info.name).toBe('Belgium');
  });

  it('extracts from yellow-circle in-flight marker (GSD ROADMAP template)', async () => {
    const roadmap = '- 🟡 **v3.1 Upstream Landing** — Phase 15 (in flight)';
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v3.1');
    expect(info.name).toBe('Upstream Landing');
  });

  it('uses last **vX.Y Title** in milestone list before ## Phases when no emoji match', async () => {
    const roadmap = `## Milestones

- ✅ **v1.0 A**
- ✅ **v3.0 B**
- ✅ **v3.1 Current Name**

## Phases
`;
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v3.1');
    expect(info.name).toBe('Current Name');
  });

  it('falls back to STATE.md milestone when ROADMAP.md is missing', async () => {
    await writeFile(
      join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v4.2\nmilestone_name: From State\n---\n\n# State\n',
    );
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v4.2');
    expect(info.name).toBe('From State');
  });

  it('falls back to v1.0 when ROADMAP.md and STATE.md lack milestone', async () => {
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v1.0');
    expect(info.name).toBe('milestone');
  });

  // Bug #2495: STATE.md must take priority over ROADMAP heading matching
  it('prefers STATE.md milestone over ROADMAP heading match', async () => {
    const roadmap = [
      '## Milestone v1.0: Shipped — ✅ SHIPPED 2026-01-01',
      '',
      'Phase 1',
      '',
      '## Milestone v2.0: Current Active',
      '',
      'Phase 2',
    ].join('\n');
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    await writeFile(
      join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v2.0\nmilestone_name: Current Active\n---\n',
    );
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v2.0');
    expect(info.name).toBe('Current Active');
  });

  // Bug #2508 follow-up: STATE.md has milestone version but no milestone_name —
  // should use ROADMAP for the real name, still prefer STATE.md for version.
  it('uses ROADMAP name when STATE.md has milestone version but no milestone_name', async () => {
    const roadmap = [
      '## Milestone v2.0: Real Name From Roadmap',
      '',
      'Phase 2',
    ].join('\n');
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    await writeFile(
      join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v2.0\n---\n',  // no milestone_name
    );
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v2.0');
    expect(info.name).toBe('Real Name From Roadmap');
  });

  it('returns correct milestone from STATE.md even when ROADMAP inline-SHIPPED stripping would fix it', async () => {
    // ROADMAP with an unstripped shipped milestone heading (pre-fix state)
    const roadmap = [
      '## Milestone v1.0: Old — ✅ SHIPPED 2026-01-01',
      '',
      'Old phases',
      '',
      '## Milestone v2.0: New',
      '',
      'New phases',
    ].join('\n');
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    await writeFile(
      join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v2.0\nmilestone_name: New\n---\n',
    );
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v2.0');
    expect(info.name).toBe('New');
  });
});

// ─── extractCurrentMilestone ──────────────────────────────────────────────

describe('extractCurrentMilestone', () => {
  it('scopes content to current milestone from STATE.md version', async () => {
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE_WITH_MILESTONE);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT);
    const result = await extractCurrentMilestone(ROADMAP_CONTENT, tmpDir);
    expect(result).toContain('Phase 10');
    expect(result).toContain('v3.0');
  });

  it('strips shipped milestones when no cwd version found', async () => {
    const content = '<details>old</details>current content';
    // No STATE.md, no in-progress marker
    const result = await extractCurrentMilestone(content, tmpDir);
    expect(result).toBe('current content');
  });

  // ─── Bug #2422: preamble Backlog leak ─────────────────────────────────
  it('bug-2422: does not include ## Backlog section before the current milestone', async () => {
    const roadmapWithBacklog = `# ROADMAP

## Backlog
### Phase 999.1: Parking lot item A
### Phase 999.2: Parking lot item B

### 🚧 v2.0 My Milestone (In Progress)
- [ ] **Phase 100: Real work**

## v2.0 Phase Details
### Phase 100: Real work
**Goal**: Do stuff.
`;
    const state = `---\nmilestone: v2.0\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmapWithBacklog);

    const result = await extractCurrentMilestone(roadmapWithBacklog, tmpDir);

    // Must NOT include backlog phases
    expect(result).not.toContain('Phase 999.1');
    expect(result).not.toContain('Phase 999.2');
    expect(result).not.toContain('Parking lot');
    // Must include the actual v2.0 content
    expect(result).toContain('Phase 100');
  });

  // ─── Bug #2619: phase heading containing vX.Y triggers truncation ─────
  it('bug-2619: does not truncate at a phase heading containing vX.Y', async () => {
    // A phase title like "Phase 12: v1.0 Tech-Debt Closure" was being treated
    // as a milestone boundary because the greedy `.*v(\d+(?:\.\d+)+)` branch
    // in nextMilestoneRegex matched any heading with a version literal.
    const roadmapWithPhaseVersion = `# ROADMAP

## Phases

### 🚧 v1.1 Launch-Ready (In Progress)

### Phase 11: Structured Logging
**Goal**: Add structured logging

### Phase 12: v1.0 Tech-Debt Closure
**Goal**: Close out v1.0 debt

### Phase 19: Security Audit
**Goal**: Full security audit
`;
    const state = `---\nmilestone: v1.1\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmapWithPhaseVersion);

    const result = await extractCurrentMilestone(roadmapWithPhaseVersion, tmpDir);

    // Phase 12 and Phase 19 must both survive — the slice cannot be truncated
    // at "### Phase 12: v1.0 Tech-Debt Closure".
    expect(result).toContain('### Phase 12: v1.0 Tech-Debt Closure');
    expect(result).toContain('### Phase 19: Security Audit');
  });

  // ─── Bug #2619 (CodeRabbit follow-up): case-insensitive Phase lookahead ───
  it('bug-2619: does not truncate at PHASE/phase heading containing vX.Y (case-insensitive)', async () => {
    // The negative lookahead `(?!Phase\s+\S)` must be case-insensitive so that
    // headings like "### PHASE 12: v1.0 Tech-Debt" or "### phase 12: v1.0 …"
    // are also excluded from milestone-boundary matching.
    const roadmapMixedCase = `# ROADMAP

## Phases

### 🚧 v1.1 Launch-Ready (In Progress)

### PHASE 11: Structured Logging
**Goal**: Add structured logging

### phase 12: v1.0 Tech-Debt Closure
**Goal**: Close out v1.0 debt

### Phase 19: Security Audit
**Goal**: Full security audit
`;
    const state = `---\nmilestone: v1.1\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmapMixedCase);

    const result = await extractCurrentMilestone(roadmapMixedCase, tmpDir);

    expect(result).toContain('### PHASE 11: Structured Logging');
    expect(result).toContain('### phase 12: v1.0 Tech-Debt Closure');
    expect(result).toContain('### Phase 19: Security Audit');
  });

  // ─── Bug #2641: <details><summary>vX.Y …</summary> not recognized as anchor ───
  it('bug-2641: finds active milestone wrapped in <details><summary>vX.Y …</summary>', async () => {
    // Many projects (GitHub-friendly collapse) wrap the active milestone's
    // phase details inside <details><summary>v0.9 …</summary>. Without the
    // <details>-aware fallback, extractCurrentMilestone misses the heading
    // anchor (because <summary> is HTML), falls through to
    // stripShippedMilestones, and loses all <details> blocks — including
    // the active one. Result: roadmapGetPhase returns {found:false} for
    // phases that ARE in the active ROADMAP.
    const roadmapWithActiveDetails = `# Roadmap

## Milestones
- ✅ **v0.8 Foundation** — shipped
- 📋 **v0.9 Local-First Bus** — active

## Phases

<details>
<summary>✅ v0.8 Foundation — SHIPPED 2026-04-15</summary>

### Phase 1: Old phase
**Goal:** Old goal.
</details>

<details>
<summary>v0.9 Local-First Bus (active) — Phase Details</summary>

### Phase 1: Library
**Goal:** Build the library.

### Phase 3: Polish
**Goal:** Add polish.
</details>
`;
    const state = `---\nmilestone: v0.9\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmapWithActiveDetails);

    const result = await extractCurrentMilestone(roadmapWithActiveDetails, tmpDir);

    // Active milestone's phases must survive
    expect(result).toContain('### Phase 1: Library');
    expect(result).toContain('### Phase 3: Polish');
    expect(result).toContain('Add polish.');
    // Shipped milestone phases must not bleed in
    expect(result).not.toContain('Old phase');
    // The <summary> text is normalized as a `## ` milestone heading so
    // downstream consumers (e.g. roadmapAnalyze's data.milestones scan) see
    // the active milestone anchor — not just the body.
    expect(result).toMatch(/^##\s+v0\.9 Local-First Bus \(active\) — Phase Details/m);
  });

  // ─── Bug #2641 (CodeRabbit follow-up): quoted YAML version normalization ───
  it('bug-2641: handles quoted YAML version (milestone: "v0.9") in STATE.md', async () => {
    // STATE.md may use quoted YAML (`milestone: "v0.9"`). Without quote-stripping,
    // version would carry literal quotes, escapedVersion would be `\"v0\.9\"`,
    // and neither the markdown-heading regex nor the <details><summary> fallback
    // would match — falling through to stripShippedMilestones and reintroducing
    // the archived-milestone misrouting this PR addresses. Parity with
    // parseMilestoneFromState() and getMilestoneInfo() (which both strip quotes).
    const roadmap = `# Roadmap

<details>
<summary>v0.9 Local-First Bus (active) — Phase Details</summary>

### Phase 3: Polish
**Goal:** Add polish.
</details>
`;
    const stateQuoted = `---\nmilestone: "v0.9"\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), stateQuoted);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);

    const result = await extractCurrentMilestone(roadmap, tmpDir);

    expect(result).toContain('### Phase 3: Polish');
    expect(result).toMatch(/^##\s+v0\.9 Local-First Bus/m);
  });

  // ─── Bug #2641: tolerate attributes on <details> tag (e.g. <details open>) ───
  it('bug-2641: finds active milestone in <details open><summary>vX.Y …</summary>', async () => {
    // GitHub auto-renders <details open> for sections that should default to
    // expanded. The <details>-aware fallback regex must use <details\b[^>]*>
    // (not literal <details>) so attribute-bearing tags also anchor correctly.
    const roadmapWithDetailsOpen = `# Roadmap

## Phases

<details open>
<summary>v0.9 Local-First Bus (active) — Phase Details</summary>

### Phase 3: Polish
**Goal:** Add polish.
</details>
`;
    const state = `---\nmilestone: v0.9\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmapWithDetailsOpen);

    const result = await extractCurrentMilestone(roadmapWithDetailsOpen, tmpDir);

    expect(result).toContain('### Phase 3: Polish');
    expect(result).toContain('Add polish.');
    expect(result).toMatch(/^##\s+v0\.9 Local-First Bus/m);
  });

  it('bug-2641: v0.1 must not substring-match v0.10 in markdown heading anchor path', async () => {
    const roadmap = `# Roadmap

## v0.10 Future Milestone

### Phase 7: Wrong Phase
**Goal:** This is from v0.10, not v0.1.

## v0.1 Active Milestone

### Phase 1: Right Phase
**Goal:** This is the active milestone.
`;
    const state = `---\nmilestone: v0.1\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);

    const result = await extractCurrentMilestone(roadmap, tmpDir);

    expect(result).toContain('### Phase 1: Right Phase');
    expect(result).toContain('This is the active milestone');
    expect(result).not.toContain('Phase 7: Wrong Phase');
    expect(result).not.toContain('This is from v0.10');
  });

  // ─── Bug #2641 (review hardening): substring-version trap ───
  it('bug-2641: v0.1 must not substring-match <summary>v0.10 …</summary>', async () => {
    // The fallback regex anchors on `escapedVersion` inside `<summary>` text.
    // Without a non-version-character lookahead, `v0.1` matches inside `v0.10`,
    // and the function returns the v0.10 block's body as the active milestone
    // — confidently-wrong content (worse than the pre-fix fall-through, which
    // returned known-incomplete content). The synthesized `## v0.10 …` heading
    // would then mask the bug from downstream debugging. Lock the boundary.
    const roadmap = `# Roadmap

<details>
<summary>v0.10 Future Milestone — Phase Details</summary>

### Phase 7: Wrong Phase
**Goal:** This is from v0.10, not v0.1.
</details>

<details>
<summary>v0.1 Active — Phase Details</summary>

### Phase 1: Right Phase
**Goal:** This is the active milestone.
</details>
`;
    const state = `---\nmilestone: v0.1\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);

    const result = await extractCurrentMilestone(roadmap, tmpDir);

    expect(result).toContain('### Phase 1: Right Phase');
    expect(result).toContain('This is the active milestone');
    expect(result).not.toContain('Phase 7: Wrong Phase');
    expect(result).not.toContain('This is from v0.10');
  });

  // ─── Bug #2641 (review hardening): nested <details> guard ───
  it('bug-2641: nested <details> falls through (does not silently truncate)', async () => {
    // The lazy [\s\S]*?</details> terminates on the FIRST </details>, which
    // is the inner closer when nesting is present. Without a guard, the
    // function returns truncated body and silently loses everything after the
    // inner </details>. Detect nesting and fall through to the existing
    // stripShippedMilestones path so the failure mode is loud (no match) not
    // silent (truncated content).
    const roadmap = `# Roadmap

<details>
<summary>v0.9 Local-First Bus — Phase Details</summary>

### Phase 1: Library
<details>
<summary>Implementation notes</summary>
Detail
</details>

### Phase 2: Polish — would be silently lost without the guard
**Goal:** Add polish.
</details>
`;
    const state = `---\nmilestone: v0.9\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);

    const result = await extractCurrentMilestone(roadmap, tmpDir);

    // The critical contract: must NOT return a synthesized `## v0.9` heading
    // anchored to truncated body. The truncation case (without the nested-
    // guard) would emit `## v0.9 Local-First Bus\n\n### Phase 1: Library\n
    // <details><summary>Implementation notes</summary>\nDetail` and silently
    // lose Phase 2 — confidently-wrong content. Falling through to
    // stripShippedMilestones() may leak unrelated content but doesn't claim
    // to be the active milestone. Loud failure > silent truncation.
    expect(result).not.toMatch(/^##\s+v0\.9 Local-First Bus/m);
    // The Phase 1 detail block (which sits between the outer <details> open
    // and the inner </details>) must not appear under a v0.9 heading.
    expect(result).not.toMatch(/##\s+v0\.9[\s\S]*Phase 1: Library/);
  });

  // ─── Bug #2641 (review hardening): empty <details> body guard ───
  it('bug-2641: empty <details> body falls through (no phantom milestone)', async () => {
    // <details><summary>v0.9</summary></details> with no body would synthesize
    // `## v0.9\n` — a phantom milestone with zero phases. roadmapAnalyze would
    // then return {phases: []} with no error signal. Treat as no-match.
    const roadmap = `# Roadmap

<details>
<summary>v0.9 Empty</summary>
</details>
`;
    const state = `---\nmilestone: v0.9\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);

    const result = await extractCurrentMilestone(roadmap, tmpDir);

    // Must not synthesize a phantom heading
    expect(result).not.toMatch(/^##\s+v0\.9/m);
  });

  // ─── Bug #2641 (lockdown): leading `#` in <summary> stripped from synthesized heading ───
  it('bug-2641: strips leading # from <summary> text in synthesized heading', async () => {
    // Prevents a `<summary># v0.9 …</summary>` from producing `## # v0.9 …`,
    // which downstream `#{2,4}` heading regexes would parse as a 4-hash
    // header. The implementation uses `.replace(/^#+\s*/, '')` on the captured
    // summary; this test pins that path so a future refactor doesn't drop it.
    const roadmap = `# Roadmap

<details>
<summary># v0.9 Hash-Prefixed</summary>

### Phase 1: Test
**Goal:** Works.
</details>
`;
    const state = `---\nmilestone: v0.9\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);

    const result = await extractCurrentMilestone(roadmap, tmpDir);

    // Synthesized heading must be `## v0.9 …`, not `## # v0.9 …`
    expect(result).toMatch(/^##\s+v0\.9 Hash-Prefixed/m);
    expect(result).not.toMatch(/^##\s+#+/m);
  });

  // ─── Bug #2641 (review hardening): inline HTML in <summary> + leading # ───
  it('bug-2641: tolerates inline HTML in <summary> and strips it from synthesized heading', async () => {
    // GitHub-rendered summaries commonly contain inline tags like
    // <em>(active)</em> or <code>v0.9</code>. The summary capture must allow
    // them through and the synthesized `## ` heading must strip the tags so
    // the result is clean markdown (no `## <em>...</em>`).
    const roadmap = `# Roadmap

<details open>
<summary><strong>v0.9 Local-First Bus</strong> <em>(active)</em></summary>

### Phase 3: Polish
**Goal:** Add polish.
</details>
`;
    const state = `---\nmilestone: v0.9\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);

    const result = await extractCurrentMilestone(roadmap, tmpDir);

    expect(result).toContain('### Phase 3: Polish');
    expect(result).toMatch(/^##\s+v0\.9 Local-First Bus\s+\(active\)/m);
    // Tags must be stripped from the synthesized heading
    expect(result).not.toMatch(/^##.*<strong>/m);
    expect(result).not.toMatch(/^##.*<em>/m);
  });

  // ─── Bug #2641 (lockdown): single-quote YAML version ───
  it('bug-2641: handles single-quote YAML version (milestone: \'v0.9\') in STATE.md', async () => {
    // Parity coverage with the double-quote test. The strip pattern
    // `/^["']|["']$/g` handles both — locked here so a future change to
    // either character class doesn't silently regress one form.
    const roadmap = `# Roadmap

<details>
<summary>v0.9 Local-First Bus — Phase Details</summary>

### Phase 3: Polish
**Goal:** Add polish.
</details>
`;
    const stateSingle = `---\nmilestone: 'v0.9'\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), stateSingle);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);

    const result = await extractCurrentMilestone(roadmap, tmpDir);

    expect(result).toContain('### Phase 3: Polish');
    expect(result).toMatch(/^##\s+v0\.9 Local-First Bus/m);
  });

  // ─── Bug #2641 (lockdown): heading wins when BOTH heading and <details> match ───
  it('bug-2641: markdown heading anchor wins over <details><summary> fallback', async () => {
    // The <details> fallback only fires when the heading-level lookup MISSES.
    // If a ROADMAP has both `### v0.9 …` heading AND `<details><summary>v0.9 …</summary>`
    // for the same version, the heading anchor must win. Locks precedence so a
    // future refactor doesn't accidentally flip the order and silently change
    // which slice gets returned.
    const roadmap = `# Roadmap

### v0.9 Local-First Bus (heading-anchored)

### Phase 1: Heading-anchored Phase
**Goal:** From the heading slice.

<details>
<summary>v0.9 Local-First Bus — Phase Details (details-anchored)</summary>

### Phase 99: Details-anchored Phase
**Goal:** From the details slice.
</details>
`;
    const state = `---\nmilestone: v0.9\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);

    const result = await extractCurrentMilestone(roadmap, tmpDir);

    // Heading slice is what got returned — original `### v0.9` heading
    // present, Phase 1 from the heading slice present.
    expect(result).toContain('### v0.9 Local-First Bus (heading-anchored)');
    expect(result).toContain('### Phase 1: Heading-anchored Phase');
    // Critical: the <details> fallback did NOT fire, so no synthesized
    // `## ` heading is prepended. (The heading-anchor slice extends to the
    // next milestone boundary and includes the downstream <details> block
    // verbatim — that's a property of the heading-anchor path, not the
    // fallback. We're locking which CODE PATH ran, not how its output looks.)
    expect(result).not.toMatch(/^##\s+v0\.9 Local-First Bus.*details-anchored/im);
    // The original heading must appear at the START of the slice (the
    // heading-anchor path returns content starting at the matched heading).
    expect(result.indexOf('### v0.9 Local-First Bus (heading-anchored)')).toBe(0);
  });

  // ─── Bug #2641 (lockdown): multiple <details> blocks for same version ───
  it('bug-2641: when multiple <details> match the version, the FIRST is returned', async () => {
    // `content.match(detailsPattern)` (non-`g`) returns the first match in
    // document order. Lock this so a future change to the matcher (e.g.
    // switching to `matchAll` and picking the last) doesn't silently change
    // which block is treated as the active milestone. Document-order-first is
    // intentional: in real ROADMAPs, the active milestone is conventionally
    // listed before any duplicates (e.g. retro-active or branch-merge artefacts).
    const roadmap = `# Roadmap

<details>
<summary>v0.9 Local-First Bus — Phase Details (FIRST)</summary>

### Phase 1: First-block Phase
**Goal:** Should be returned.
</details>

<details>
<summary>v0.9 Local-First Bus — Phase Details (SECOND)</summary>

### Phase 99: Second-block Phase
**Goal:** Should NOT be returned.
</details>
`;
    const state = `---\nmilestone: v0.9\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);

    const result = await extractCurrentMilestone(roadmap, tmpDir);

    expect(result).toContain('### Phase 1: First-block Phase');
    expect(result).not.toContain('### Phase 99: Second-block Phase');
    expect(result).toMatch(/^##\s+v0\.9 Local-First Bus.*FIRST/m);
  });

  // ─── Bug #2422: same-version sub-heading truncation ───────────────────
  it('bug-2422: does not truncate at same-version sub-heading (## v2.0 Phase Details)', async () => {
    const roadmapWithDetails = `# ROADMAP

### 🚧 v2.0 My Milestone (In Progress)
- [ ] **Phase 100: Real work**

## v2.0 Phase Details
### Phase 100: Real work
**Goal**: Do stuff.
`;
    const state = `---\nmilestone: v2.0\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmapWithDetails);

    const result = await extractCurrentMilestone(roadmapWithDetails, tmpDir);

    // The detail section must survive — not be cut off
    expect(result).toContain('Phase 100');
    expect(result).toContain('Phase Details');
  });
});

// ─── roadmapGetPhase ──────────────────────────────────────────────────────

describe('roadmapGetPhase', () => {
  it('returns phase info for existing phase', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT);
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE_WITH_MILESTONE);
    const result = await roadmapGetPhase(['10'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(true);
    expect(data.phase_number).toBe('10');
    expect(data.phase_name).toBe('Read-Only Queries');
    expect(data.goal).toBe('Port read-only query operations.');
    expect((data.success_criteria as string[]).length).toBe(2);
    expect(data.section).toContain('### Phase 10');
  });

  it('returns { found: false } for nonexistent phase', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT);
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE_WITH_MILESTONE);
    const result = await roadmapGetPhase(['999'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(false);
    expect(data.phase_number).toBe('999');
  });

  it('throws GSDError when no phase number provided', async () => {
    await expect(roadmapGetPhase([], tmpDir)).rejects.toThrow();
  });

  it('handles malformed roadmap (checklist-only, no detail section)', async () => {
    const malformed = `# Roadmap\n\n- [ ] **Phase 99: Missing Detail**\n`;
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), malformed);
    const result = await roadmapGetPhase(['99'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBe('malformed_roadmap');
    expect(data.phase_name).toBe('Missing Detail');
  });

  it('returns error object when ROADMAP.md not found', async () => {
    const result = await roadmapGetPhase(['10'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(false);
    expect(data.error).toBe('ROADMAP.md not found');
  });

  // ─── Bug #2641 (regression): end-to-end via roadmapGetPhase ───
  it('bug-2641: returns found:true for phase inside <details>-wrapped active milestone', async () => {
    // End-to-end coverage: roadmapGetPhase calls extractCurrentMilestone
    // internally. Without the <details>-aware fallback, the active
    // milestone's phases were stripped before the phase-heading lookup,
    // and roadmapGetPhase returned {found:false} for phases that exist.
    const roadmap = `# Roadmap

## Milestones
- 📋 **v0.9 Local-First Bus** — active

<details>
<summary>v0.9 Local-First Bus (active) — Phase Details</summary>

### Phase 3: Polish

**Goal:** Add polish.

**Success Criteria**:
1. Polish applied
2. Tests pass
</details>
`;
    const state = `---\nmilestone: v0.9\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);

    const result = await roadmapGetPhase(['3'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(true);
    expect(data.phase_number).toBe('3');
    expect(data.phase_name).toBe('Polish');
    expect(data.goal).toBe('Add polish.');
  });
});

// ─── roadmapAnalyze ───────────────────────────────────────────────────────

describe('roadmapAnalyze', () => {
  it('returns full analysis for valid roadmap', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT);
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE_WITH_MILESTONE);

    // Create some plan/summary files for disk correlation
    await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-01-PLAN.md'), '---\n---\n');
    await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-01-SUMMARY.md'), '---\n---\n');
    await writeFile(join(tmpDir, '.planning', 'phases', '10-read-only-queries', '10-01-PLAN.md'), '---\n---\n');

    const result = await roadmapAnalyze([], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.phase_count).toBe(3);
    expect((data.phases as Array<Record<string, unknown>>).length).toBe(3);

    const phases = data.phases as Array<Record<string, unknown>>;
    // Phase 9 has 1 plan, 1 summary => complete (or roadmap checkbox says complete)
    const p9 = phases.find(p => p.number === '9');
    expect(p9).toBeDefined();
    expect(p9!.name).toBe('Foundation and Test Infrastructure');
    expect(p9!.roadmap_complete).toBe(true); // [x] in checklist

    // Phase 10 has 1 plan, 0 summaries => planned
    const p10 = phases.find(p => p.number === '10');
    expect(p10).toBeDefined();
    expect(p10!.disk_status).toBe('planned');
    expect(p10!.plan_count).toBe(1);

    // Phase 11 has no directory content
    const p11 = phases.find(p => p.number === '11');
    expect(p11).toBeDefined();
    expect(p11!.disk_status).toBe('no_directory');

    expect(data.total_plans).toBeGreaterThan(0);
    expect(typeof data.progress_percent).toBe('number');
  });

  it('returns error when ROADMAP.md not found', async () => {
    const result = await roadmapAnalyze([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBe('ROADMAP.md not found');
  });

  it('overrides disk_status to complete when roadmap checkbox is checked', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT);
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE_WITH_MILESTONE);

    // Phase 9 dir is empty (no plans/summaries) but roadmap has [x]
    const result = await roadmapAnalyze([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const phases = data.phases as Array<Record<string, unknown>>;
    const p9 = phases.find(p => p.number === '9');
    expect(p9!.disk_status).toBe('complete');
    expect(p9!.roadmap_complete).toBe(true);
  });

  it('detects missing phase details from checklist', async () => {
    const roadmapWithExtra = ROADMAP_CONTENT + '\n- [ ] **Phase 99: Future Phase**\n';
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmapWithExtra);
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE_WITH_MILESTONE);

    const result = await roadmapAnalyze([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.missing_phase_details).toContain('99');
  });

  it('handles repeated calls correctly (no lastIndex bug)', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT);
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE_WITH_MILESTONE);

    const result1 = await roadmapAnalyze([], tmpDir);
    const result2 = await roadmapAnalyze([], tmpDir);
    const data1 = result1.data as Record<string, unknown>;
    const data2 = result2.data as Record<string, unknown>;

    expect((data1.phases as unknown[]).length).toBe((data2.phases as unknown[]).length);
  });

  // ─── Bug #2641 (regression): roadmapAnalyze populates milestones array
  //    for <details>-wrapped active milestones via the synthesized `## ` heading. ───
  it('bug-2641: data.milestones contains the active milestone when wrapped in <details>', async () => {
    // Without the synthesized heading injected by extractCurrentMilestone's
    // <details>-aware fallback, the milestone-heading scan at the bottom of
    // roadmapAnalyze (`/##\s*(.*v(\d+(?:\.\d+)+)[^(\n]*)/gi`) would find
    // nothing useful inside the body of a <details>-wrapped active milestone
    // and `data.milestones` would be empty / wrong.
    const roadmap = `# Roadmap

## Milestones
- 📋 **v0.9 Local-First Bus** — active

<details>
<summary>v0.9 Local-First Bus (active) — Phase Details</summary>

### Phase 1: Library
**Goal:** Build the library.

### Phase 3: Polish
**Goal:** Add polish.
</details>
`;
    const state = `---\nmilestone: v0.9\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);

    const result = await roadmapAnalyze([], tmpDir);
    const data = result.data as Record<string, unknown>;
    // Defensive guard: fail with a clear message if roadmapAnalyze didn't
    // populate data.milestones, rather than throwing TypeError on `.some()`.
    expect(data.milestones).toBeDefined();
    const milestones = data.milestones as Array<{ heading: string; version: string }>;

    // Active milestone surfaces with correct version
    expect(milestones.some(m => m.version === 'v0.9')).toBe(true);
    expect(milestones.some(m => m.heading.includes('Local-First Bus'))).toBe(true);

    // Phases are also surfaced (the original bug)
    const phases = data.phases as Array<Record<string, unknown>>;
    expect(phases.length).toBe(2);
    expect(phases.some(p => p.number === '1')).toBe(true);
    expect(phases.some(p => p.number === '3')).toBe(true);
  });
});

// ─── extractPhasesFromSection + extractNextMilestoneSection (#2497) ──────

describe('extractPhasesFromSection', () => {
  it('parses phase number, name, goal, and depends_on from a milestone section', () => {
    const section = [
      '',
      '### Phase 31: Email Schema',
      '**Goal**: Set up Prisma models.',
      '**Depends on**: None',
      '',
      '### Phase 32: Today\'s Sheets',
      '**Goal**: Port the GAS sender.',
      '**Depends on**: Phase 31',
      '',
    ].join('\n');
    const phases = extractPhasesFromSection(section);
    expect(phases).toEqual([
      { number: '31', name: 'Email Schema', goal: 'Set up Prisma models.', depends_on: 'None' },
      { number: '32', name: "Today's Sheets", goal: 'Port the GAS sender.', depends_on: 'Phase 31' },
    ]);
  });

  it('returns empty array when section has no phase headings', () => {
    expect(extractPhasesFromSection('no phases here\njust prose.')).toEqual([]);
  });
});

describe('extractNextMilestoneSection', () => {
  const MULTI = [
    '# Roadmap',
    '',
    '## Milestone v1.0: Old — ✅ SHIPPED 2026-01-01',
    '',
    'Shipped stuff.',
    '',
    '## Milestone v2.0.5: Current Milestone',
    '',
    '### Phase 35: Audit',
    '**Goal**: Audit schemas.',
    '',
    '## Milestone v2.1: Daily Emails',
    '',
    '### Phase 31: Schema',
    '**Goal**: Build schema.',
    '**Depends on**: None',
    '',
    '### Phase 32: Sending',
    '**Goal**: Send emails.',
    '**Depends on**: Phase 31',
    '',
    '## Milestone v2.2: Later',
    '',
    '### Phase 99: Future',
    '**Goal**: Later work.',
  ].join('\n');

  it('returns the milestone immediately after the active one (STATE-driven)', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), MULTI);
    await writeFile(
      join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v2.0.5\nmilestone_name: Current Milestone\n---\n',
    );
    const next = await extractNextMilestoneSection(MULTI, tmpDir);
    expect(next).not.toBeNull();
    expect(next!.version).toBe('v2.1');
    expect(next!.name).toBe('Daily Emails');
    // Phases parse correctly from the returned section — only v2.1 phases,
    // not v2.2's Phase 99.
    const phases = extractPhasesFromSection(next!.section).map(p => p.number);
    expect(phases).toEqual(['31', '32']);
  });

  it('returns null when the active milestone is the last one in ROADMAP', async () => {
    const roadmap = [
      '# Roadmap',
      '',
      '## Milestone v2.0.5: Last One',
      '',
      '### Phase 35: Final',
      '**Goal**: Final work.',
    ].join('\n');
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    await writeFile(
      join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v2.0.5\n---\n',
    );
    const next = await extractNextMilestoneSection(roadmap, tmpDir);
    expect(next).toBeNull();
  });

  it('returns null when no current milestone can be resolved', async () => {
    const next = await extractNextMilestoneSection('# Roadmap\nno milestones\n', tmpDir);
    expect(next).toBeNull();
  });
});
