---
phase: 02-content-conversion-engine
plan: 01
subsystem: installer
tags: [copilot, content-conversion, tool-mapping, path-replacement, skill-format, agent-format]

# Dependency graph
requires:
  - phase: 01-core-installer-plumbing
    provides: "isCopilot flag, getDirName('copilot'), getGlobalDir('copilot'), Copilot CLI flags and runtime selection"
provides:
  - "claudeToCopilotTools constant (13 tool mappings)"
  - "convertCopilotToolName() for agent tool conversion"
  - "convertClaudeToCopilotContent() for CONV-06 path + CONV-07 command conversion"
  - "convertClaudeCommandToCopilotSkill() for skill frontmatter transformation"
  - "convertClaudeAgentToCopilotAgent() for agent frontmatter with JSON array tools"
  - "copyCommandsAsCopilotSkills() for folder-per-skill install structure"
  - "install() isCopilot branches for skills, agents, and engine copy"
affects: [02-content-conversion-engine, 03-lifecycle-config, 04-validation-testing]

# Tech tracking
tech-stack:
  added: []
  patterns: ["fixed path mapping (no pathPrefix) for Copilot content conversion", "folder-per-skill structure mirroring Codex pattern", "JSON array tool format with deduplication"]

key-files:
  created: []
  modified: [bin/install.js]

key-decisions:
  - "Copilot uses fixed path mappings (not pathPrefix) — ~/.copilot/ for global, .github/ for local"
  - "Skills keep original tool names (no mapping) — tool mapping applies ONLY to agents"
  - "CONV-09 (router skill) discarded — no code generated"
  - "CONV-10 (CHANGELOG/VERSION) already works for all runtimes — no changes needed"
  - ".cjs/.js files also get CONV-06/CONV-07 transformation for engine directory"

patterns-established:
  - "Copilot content conversion via convertClaudeToCopilotContent() — 4 path patterns + gsd: → gsd-"
  - "Agent tool deduplication via Set after mapping (Write+Edit→edit, Grep+Glob→search)"
  - "argument-hint single-quoting for YAML safety in skill frontmatter"

requirements-completed: [CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06, CONV-07, CONV-08, CONV-09, CONV-10]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 2 Plan 1: Content Conversion Engine Summary

**Complete Copilot content conversion engine — 13-tool mapping, 4-pattern path replacement, skill/agent frontmatter transformers, and install() wiring with folder-per-skill structure**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T10:54:15Z
- **Completed:** 2026-03-03T10:59:59Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Added claudeToCopilotTools constant mapping all 13 Claude tools to Copilot equivalents
- Implemented 5 conversion functions: convertCopilotToolName, convertClaudeToCopilotContent, convertClaudeCommandToCopilotSkill, convertClaudeAgentToCopilotAgent, copyCommandsAsCopilotSkills
- Wired isCopilot branches into install() for skills (folder-per-skill), agents (.agent.md rename + tool mapping), and engine files (.md/.cjs/.js transformation)
- All 4 CONV-06 path patterns work correctly ($HOME/.claude/→$HOME/.copilot/, ~/.claude/→~/.copilot/, ./.claude/→./.github/, .claude/→.github/)
- CONV-07 gsd:→gsd- applied globally to all content
- Agent tool deduplication working (Write+Edit→edit, Grep+Glob→search)
- CONV-09 discarded (no router skill generated), CONV-10 confirmed working

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Copilot tool mapping constant and conversion functions** - `12c011a` (feat)
2. **Task 2: Wire Copilot conversion into install() flow** - `ca79c59` (feat)

## Files Created/Modified
- `bin/install.js` - Added ~205 lines: claudeToCopilotTools constant, 5 conversion functions, copyCommandsAsCopilotSkills helper, install() isCopilot branches for skills/agents/engine, GSD_TEST_MODE exports

## Decisions Made
- Copilot uses fixed path mappings (not pathPrefix) because Copilot has deterministic local-only paths
- Skills keep original Claude tool names — tool mapping applies ONLY to agents per CONTEXT.md decision
- CONV-09 (router skill) intentionally not generated — the absence of code IS the correct implementation
- CONV-10 (CHANGELOG/VERSION) already runs for ALL runtimes — no Copilot-specific code needed
- .cjs/.js files in engine directory also get CONV-06+CONV-07 transformation (verify.cjs has 8 gsd: refs)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deferred copyCommandsAsCopilotSkills export to Task 2**
- **Found during:** Task 1 (GSD_TEST_MODE exports)
- **Issue:** Plan said to add copyCommandsAsCopilotSkills to exports in Task 1, but function doesn't exist until Task 2 — caused ReferenceError breaking all test imports
- **Fix:** Removed forward reference from Task 1 exports, added it in Task 2 after function was defined
- **Files modified:** bin/install.js
- **Verification:** All 481 tests pass after fix
- **Committed in:** 12c011a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor sequencing fix — no scope change. Function still exported correctly in final state.

## Issues Encountered
None beyond the sequencing deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All conversion functions exported and verified — ready for Phase 2 Plan 2 (test suite)
- install() fully wired with isCopilot branches — ready for end-to-end validation in Phase 4
- copilot-instructions.md merge logic still needed (Phase 3: Lifecycle & Config)

---
*Phase: 02-content-conversion-engine*
*Completed: 2026-03-03*
