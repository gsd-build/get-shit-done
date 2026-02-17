# Phase 9: Multi-Agent Orchestration - Discussion Guide

**Researched:** 2026-02-17
**Domain:** Multi-agent parallel review and feedback synthesis
**Confidence:** HIGH

## Overview

Phase 9 extends Phase 8's single-agent review pattern to support multiple agents reviewing the same artifact in parallel. The key challenge is transforming separate agent responses into one coherent synthesis while preserving attribution.

**Phase 8 pattern:** Draft → invoke 1 agent → display feedback → Claude synthesizes → artifact revised
**Phase 9 extends to:** Draft → invoke N agents in parallel → display all responses → Claude synthesizes all → artifact revised

## Key Decision Areas

### 1. Parallel Invocation Approach
How agents are invoked — sequential, truly parallel, or fail-fast threshold.

### 2. Feedback Synthesis Strategy
How merged feedback is presented — narrative, per-agent blocks + synthesis, consensus-highlighted, or decision matrix.

### 3. Conflict Resolution
When agents disagree — Claude's judgment, majority vote, weighted votes, or unanimous-only.

### 4. Failure & Partial Response Handling
When agents fail — proceed with available, abort, or configurable threshold.

### 5. Attribution Style
How to show which agent said what — footnotes, inline labels, mini-sections, or source table.

## Suggested Question Flow

1. Parallel Invocation Approach (foundational)
2. Failure Handling (second-order foundational)
3. Synthesis Strategy (shapes the output)
4. Conflict Resolution (decision logic inside synthesis)
5. Attribution Style (refinement on readability)

---

*Phase: 09-multi-agent-orchestration*
*Guide generated: 2026-02-17*
