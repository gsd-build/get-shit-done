---
phase: 08-notifications-and-observability
plan: 05
subsystem: observability
tags: [dashboard, websocket, savings-report, cost-analysis, real-time]
dependency_graph:
  requires: [08-03-execution-log]
  provides: [dashboard-server, savings-report]
  affects: [gsd-tools]
tech_stack:
  added: [ws]
  patterns: [websocket-streaming, ndjson-events, file-watching]
key_files:
  created:
    - get-shit-done/bin/dashboard-server.js
    - get-shit-done/bin/savings-report.js
  modified:
    - get-shit-done/bin/gsd-tools.js
    - package.json
decisions:
  - Use WebSocket for real-time event streaming instead of polling
  - Separate HTTP server (3000) and WebSocket server (8080) for flexibility
  - File watcher streams only new EXECUTION_LOG.md content to avoid re-sending history
  - Savings baseline is all-Opus execution for maximum impact visibility
  - Support both formatted table and JSON output for human/programmatic use
metrics:
  duration: 223 seconds
  completed: 2026-02-16T13:21:04Z
---

# Phase 08 Plan 05: Real-time Progress Dashboard and Token Savings Report Summary

**One-liner:** WebSocket dashboard streams live execution events; savings report quantifies auto mode ROI vs all-Opus baseline

## What Was Built

Created production observability tools for autonomous execution monitoring and value quantification:

1. **dashboard-server.js** - Real-time WebSocket dashboard
   - HTTP server serves embedded dashboard HTML on port 3000
   - WebSocket server broadcasts events on port 8080
   - File watcher streams new EXECUTION_LOG.md entries to connected clients
   - Dashboard UI shows live event timeline with color-coded event types
   - Statistics panel tracks phases completed/failed, checkpoints, total events

2. **savings-report.js** - Token cost savings analysis
   - Calculates actual cost across haiku/sonnet/opus model usage
   - Compares against hypothetical all-Opus execution baseline
   - Generates detailed breakdown by model tier with token counts
   - Provides optimization recommendations based on usage patterns
   - Supports both CLI table format and JSON output

3. **gsd-tools CLI integration**
   - `dashboard start/stop` commands for server lifecycle
   - `savings report` shows formatted savings table
   - `savings calculate` for manual cost analysis with --haiku/--sonnet/--opus flags
   - Commands integrated into main gsd-tools router

## Implementation Details

### Dashboard Architecture

```
Client (Browser)
    ↓ HTTP GET /
HTTP Server (port 3000) → HTML Dashboard
    ↓
WebSocket (port 8080)
    ↓ initial_state
{ events: [...], stats: {...} }
    ↓ live updates
File Watcher → EXECUTION_LOG.md
    ↓ new lines
Parse NDJSON → Broadcast to clients
```

**Key Pattern:** Incremental file reading via `fs.createReadStream({ start: lastSize })` ensures only new content is parsed and broadcast, avoiding memory issues on large logs.

### Savings Calculation

**Formula:**
```
actual_cost = Σ (model_tokens / 1M * CLAUDE_PRICING[model])
opus_baseline = total_tokens / 1M * CLAUDE_PRICING[opus]
savings = opus_baseline - actual_cost
savings_percent = (savings / opus_baseline) * 100
```

**Example Output:**
```
============================================================
TOKEN SAVINGS REPORT
============================================================

SUMMARY
----------------------------------------
Total Tokens:      150,000
  Input:           105,000
  Output:          45,000

Actual Cost:       $1.2345
Opus Baseline:     $2.8500
Savings:           $1.6155 (56.7%)

MODEL BREAKDOWN
----------------------------------------
HAIKU          50,000 in /      10,000 out  $0.0450
SONNET         45,000 in /      25,000 out  $0.4895
OPUS           10,000 in /      10,000 out  $0.7000

RECOMMENDATIONS
----------------------------------------
* Excellent savings (56.7%). Auto mode routing is effective.
```

## Deviations from Plan

None - plan executed exactly as written.

## Testing & Verification

**Task 1 Verification:**
```bash
node -e "const ds = require('./get-shit-done/bin/dashboard-server.js'); \
  console.log(typeof ds.startDashboard, typeof ds.stopDashboard)"
# Output: function function
```

**Task 2 Verification:**
```bash
node -e "const sr = require('./get-shit-done/bin/savings-report.js'); \
  const s = sr.calculateSavings({haiku: {input: 50000, output: 10000}, \
    opus: {input: 100000, output: 50000}}); \
  console.log(s.savings_percent > 0)"
# Output: true
```

**Task 3 Verification:**
```bash
node get-shit-done/bin/gsd-tools.js savings calculate --haiku 100000 --sonnet 50000 --opus 10000 | grep -c "savings_percent"
# Output: 1
```

## Success Criteria Met

- [x] dashboard-server.js provides WebSocket streaming of execution log
- [x] Dashboard HTML displays live events and statistics
- [x] savings-report.js calculates cost savings vs all-Opus baseline
- [x] CLI commands provide access to dashboard and savings features
- [x] Report includes recommendations based on usage patterns

## Integration Points

**Imports from:**
- `execution-log.js` - getHistory(), getExecutionStats()
- `llm-metrics.js` - CLAUDE_PRICING constants

**Exports to:**
- `gsd-tools.js` - dashboard and savings commands
- Future: Autonomous orchestrator can check savings to justify auto mode ROI

## Usage Examples

**Start Dashboard:**
```bash
node get-shit-done/bin/gsd-tools.js dashboard start
# Dashboard: http://localhost:3000
# WebSocket: ws://localhost:8080
# Visit browser to see live execution timeline
```

**Generate Savings Report:**
```bash
node get-shit-done/bin/gsd-tools.js savings report
# Shows formatted table with savings breakdown
```

**Manual Calculation:**
```bash
node get-shit-done/bin/gsd-tools.js savings calculate --haiku 100000 --sonnet 50000 --opus 10000 --json
# Returns JSON with savings metrics
```

## Files Modified

**Created:**
- `/Users/ollorin/get-shit-done/get-shit-done/bin/dashboard-server.js` (251 lines)
- `/Users/ollorin/get-shit-done/get-shit-done/bin/savings-report.js` (207 lines)

**Modified:**
- `/Users/ollorin/get-shit-done/get-shit-done/bin/gsd-tools.js` (+88 lines)
- `/Users/ollorin/get-shit-done/package.json` (added `ws` dependency)

## Commits

| Hash    | Message                                         |
|---------|-------------------------------------------------|
| bc996f4 | feat(08-05): add dashboard server               |
| 54ff497 | feat(08-05): add token savings report module    |
| 674e38a | feat(08-05): add dashboard and savings CLI cmds |

## Self-Check: PASSED

**Files exist:**
```bash
[ -f "get-shit-done/bin/dashboard-server.js" ] && echo "FOUND: dashboard-server.js" || echo "MISSING"
# FOUND: dashboard-server.js

[ -f "get-shit-done/bin/savings-report.js" ] && echo "FOUND: savings-report.js" || echo "MISSING"
# FOUND: savings-report.js
```

**Commits exist:**
```bash
git log --oneline --all | grep -E "bc996f4|54ff497|674e38a"
# bc996f4 feat(08-05): add dashboard server for real-time execution streaming
# 54ff497 feat(08-05): add token savings report module
# 674e38a feat(08-05): add dashboard and savings CLI commands
```

All artifacts verified present in repository.
