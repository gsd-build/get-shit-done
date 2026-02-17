# Phase 10: Settings Fix & Integration Polish - Discussion Guide

**Researched:** 2026-02-17
**Domain:** CLI tool integration, user settings flow
**Confidence:** HIGH

## Overview

Phase 10 is gap closure work: wiring CLI detection into the settings flow and fixing three accumulated technical debts from the v2.2 audit. The core issue: settings.md cannot currently run `coplanner detect` (no Bash tool), so users can't see which CLIs are installed before selecting them as agents.

## Key Decision Areas

### 1. CLI Detection Display Strategy
How users see which CLIs are installed during the settings flow.

### 2. Config Initialization Timing
When `co_planners` section appears in config.json (eager vs lazy).

### 3. Detection Error Handling in Settings
What happens when detection fails or times out during settings flow.

### 4. Docstring and CLI Interface Documentation
How much detail the gsd-tools.cjs docstring provides about coplanner subcommands.

## Gap Sources
- v2.2-MILESTONE-AUDIT.md: integration #8, flow #1, tech debt items

---

*Phase: 10-settings-fix-integration-polish*
*Guide generated: 2026-02-17*
