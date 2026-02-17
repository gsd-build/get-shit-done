# Phase 6: Foundation - Discussion Guide

**Researched:** 2026-02-16
**Domain:** CLI Infrastructure (Detection, Invocation, Graceful Degradation)

## Overview

Phase 6 establishes the foundational layer for invoking external AI CLIs (codex, gemini, opencode) as co-planners. This layer must detect which CLIs are available, normalize invocation across different CLI interfaces, and gracefully degrade when CLIs are unavailable, misconfigured, or fail.

Key constraint: Zero new npm dependencies — uses Node.js `child_process.execSync` only.

## Key Decision Areas

### 1. Kill Switch & Disable Mechanism
- How users disable co-planner invocation (config flag, env var, CLI flag, combination)
- Scope: global disable vs per-checkpoint granularity
- Precedence rules when multiple disable mechanisms exist

### 2. Detection Strategy
- Method for verifying CLI availability (version flag, which, capability probe)
- What information detection reports (availability, version, capabilities, path)
- Output format for detection results (text, JSON, both)

### 3. Invocation Contract
- How each CLI receives input (native format, adapters, common contract)
- How output is normalized across CLIs (preserve native, common schema, JSON, markdown)
- CLI-specific adapter design vs universal interface

### 4. Error Handling & Timeouts
- Timeout strategy (fixed global, per-CLI configurable, adaptive)
- Behavior on timeout (fail, skip with notice, retry)
- Behavior on CLI error (fail fast, skip CLI, log and continue)
- Distinction between error types (missing, timeout, bad exit code, permission)

## Domain Best Practices

- Early detection, lazy invocation — detect at startup, invoke only when needed
- Explicit timeouts with clear signals — distinct error types (timeout vs missing vs error)
- Preserve partial results — one CLI failure shouldn't silence all feedback
- CLI-agnostic abstraction — internal code shouldn't care which CLI is used
- Non-blocking errors — external failures degrade to "no feedback" not "workflow failed"
- Exit codes matter — use conventions (0=success, 1=error, 127=not found, 124=timeout)

## Common Mistakes

- Assuming CLI is in PATH (package managers install to different locations)
- Tight timeouts blocking legitimate work
- Silent failures hiding problems (graceful != silent)
- No distinction between error types
- Incomplete kill switch (some code paths still invoke)
- Output parsing brittleness (prefer structured JSON)

---

*Phase: 06-foundation*
*Guide generated: 2026-02-16*
