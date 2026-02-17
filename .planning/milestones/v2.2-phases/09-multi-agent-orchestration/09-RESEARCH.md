# Phase 9: Multi-Agent Orchestration - Research

**Researched:** 2026-02-17
**Domain:** Parallel external agent invocation with Promise.all(), response aggregation, and theme-based feedback synthesis with source attribution
**Confidence:** HIGH

## Summary

Phase 9 extends Phase 8's sequential single-agent draft-review-synthesize pattern to invoke N agents simultaneously at workflow checkpoints. The scope has two halves: (1) a new `coplanner invoke-all` command in gsd-tools.cjs that calls all configured agents in parallel using `Promise.all()` with per-agent timeouts and returns a JSON array of results, and (2) updated markdown workflow instructions that replace the Phase 8 "for each agent" sequential loop with a single `invoke-all` call followed by a merged synthesis section organized by theme with bracket-tag attribution.

The critical technical change is converting from `execSync` (synchronous, blocking) to `child_process.exec` or `util.promisify(execSync)` for async parallel invocation. Each adapter currently uses `execSync` internally. Two approaches exist: (A) add an `invokeAsync()` method to each adapter that returns a Promise, or (B) wrap existing synchronous `invoke()` calls in worker threads/separate processes. Approach A is simpler and consistent with the zero-dependency constraint -- `child_process.exec` with a callback converted to a Promise via `util.promisify` is Node.js stdlib and trivially achieves parallelism.

The workflow instruction changes are moderate. The existing "for each agent in agents array" loop (runs `coplanner invoke` per agent, collects results, shows per-agent feedback blocks) gets replaced by a single `coplanner invoke-all` call that returns the complete results array. The per-agent feedback display and synthesis sections are then restructured: per-agent blocks remain (same format as Phase 8), followed by a new merged synthesis section organized by theme rather than by agent.

**Primary recommendation:** Add `invokeAsync()` to each adapter (using `child_process.exec` with Promise wrapper), add a new `coplanner invoke-all` command to gsd-tools.cjs that calls `Promise.all()` on all configured agents, and update the four co-planner review sections in the three workflow command files to use `invoke-all` with the theme-based synthesis pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- True parallel invocation via Promise.all() -- all configured agents called simultaneously
- Per-agent timeouts (each agent has own timeout from config, default 120s) -- one slow agent doesn't block others
- JSON array return format: `[{agent, status, response}]` -- consistent with existing `--raw` pattern in gsd-tools.cjs
- Per-agent blocks displayed first (same format as Phase 8), followed by a merged synthesis section
- Synthesis organized by theme (e.g., "Missing requirements", "Scope concerns") not by agent
- Bracket tag attribution inline: `[Codex, Gemini]` after each point in synthesis
- Claude's judgment -- agents advise, Claude decides (matches Phase 8 philosophy)
- Disagreements highlighted explicitly in synthesis with resolution
- Brief one-line rationale per override when Claude rejects an agent's suggestion
- Partial failure: proceed with available responses, note failures
- Total failure: skip review entirely, continue workflow with warning (graceful degradation from Phase 6)
- Inline warning at top of synthesis: "Warning: 1 of 3 agents failed (Gemini CLI: timeout)"

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `child_process.exec` | Node.js built-in | Async CLI invocation (replaces `execSync` for parallel calls) | Returns callback-based result, easily wrapped in Promise. Built-in timeout support via `options.timeout`. Already available in Node.js -- no new imports needed beyond destructuring from `child_process`. |
| `util.promisify` | Node.js built-in | Convert `exec` callback to Promise for `Promise.all()` | Standard Node.js pattern for async conversion. Zero external dependencies. |
| `Promise.all` | JavaScript built-in | Run all agent invocations simultaneously | Exactly matches the locked decision. Resolves when all promises settle (using `Promise.allSettled` for partial failure handling). |
| `gsd-tools.cjs` | Existing | New `coplanner invoke-all` command | Extends existing coplanner command group. Follows established routing pattern. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `get-shit-done/bin/adapters/*.cjs` | Existing | Per-CLI invocation logic | Each adapter gets a new `invokeAsync()` export alongside existing sync `invoke()` |
| `commands/gsd/new-project.md` | Existing | Requirements + roadmap checkpoint instructions | Replace sequential agent loop with `invoke-all` call |
| `commands/gsd/plan-phase.md` | Existing | Plan checkpoint instructions | Replace sequential agent loop with `invoke-all` call |
| `commands/gsd/execute-phase.md` | Existing | Verification checkpoint instructions | Replace sequential agent loop with `invoke-all` call |
| `.planning/config.json` | Existing | `co_planners` section | No schema changes needed -- existing `timeout_ms` and per-checkpoint agents work as-is |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `child_process.exec` + Promise wrapper | `child_process.spawn` with event listeners | `spawn` is streaming-oriented and requires manual stdout buffering. `exec` buffers automatically and has simpler error handling. For request/response pattern (not streaming), `exec` is cleaner. |
| `Promise.allSettled` | `Promise.all` with individual `.catch()` | `allSettled` is cleaner for partial failure -- it never rejects, returns `{status, value/reason}` for each. Matches the locked decision that one failure shouldn't block others. Available since Node.js 12.9.0. |
| Add `invokeAsync()` to adapters | Wrap sync `invoke()` in `setTimeout`/worker | Adding native async to adapters is cleaner than wrapping sync code in workarounds. `execSync` blocks the event loop; `exec` does not. True parallelism requires actually async I/O. |
| New top-level `coplanner invoke-all` command | Multiple parallel `coplanner invoke` bash calls | Claude cannot run multiple bash commands simultaneously. A single command that handles parallelism internally is the only viable approach. |

**Installation:**
```bash
# No installation needed -- zero new dependencies
# Uses Node.js built-ins: child_process.exec, util.promisify, Promise.allSettled
```

## Architecture Patterns

### Recommended Project Structure
```
get-shit-done/
  bin/
    gsd-tools.cjs              # MODIFY: add 'coplanner invoke-all' subcommand
    adapters/
      codex.cjs                # MODIFY: add invokeAsync() export
      gemini.cjs               # MODIFY: add invokeAsync() export
      opencode.cjs             # MODIFY: add invokeAsync() export
commands/gsd/
  new-project.md               # MODIFY: replace sequential loop with invoke-all at requirements + roadmap
  plan-phase.md                # MODIFY: replace sequential loop with invoke-all at plan
  execute-phase.md             # MODIFY: replace sequential loop with invoke-all at verification
```

### Pattern 1: Async Adapter Invocation
**What:** Each adapter exports an `invokeAsync(prompt, options)` function that returns a Promise resolving to the same `{text, cli, duration, exitCode, error, errorType}` schema as the sync `invoke()`.
**When to use:** Called by `coplanner invoke-all` for parallel execution.
**Example:**
```javascript
// In each adapter (e.g., codex.cjs)
const { exec } = require('child_process');

function invokeAsync(prompt, options) {
  const timeout = (options && options.timeout) || 120000;
  const model = options && options.model;
  const tmpFile = path.join(os.tmpdir(), `gsd-${CLI_NAME}-${Date.now()}.txt`);
  const start = Date.now();

  return new Promise((resolve) => {
    fs.writeFileSync(tmpFile, prompt, 'utf-8');

    let cmd = `cat "${tmpFile}" | codex exec - --ephemeral --full-auto --skip-git-repo-check`;
    if (model) cmd += ` -m "${model}"`;

    exec(cmd, { timeout, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      const duration = Date.now() - start;
      try { fs.unlinkSync(tmpFile); } catch (_) {}

      if (err) {
        resolve({
          text: null, cli: CLI_NAME, duration,
          exitCode: err.code || 1, error: err.message,
          errorType: classifyError(err),
        });
      } else {
        resolve({
          text: stdout.trim(), cli: CLI_NAME, duration,
          exitCode: 0, error: null, errorType: null,
        });
      }
    });
  });
}
```

### Pattern 2: Parallel Invocation Command
**What:** A new `coplanner invoke-all` subcommand that accepts a prompt and a list of agents (or reads from config), invokes all via `Promise.allSettled()`, and returns a JSON array.
**When to use:** At every co-planner review checkpoint in workflow commands.
**Example:**
```javascript
// In gsd-tools.cjs
async function cmdCoplannerInvokeAll(cwd, agents, prompt, options, raw) {
  const killSwitch = checkKillSwitch(cwd);
  if (!killSwitch.enabled) {
    output({ results: [], skipped: true, reason: 'co-planners disabled' }, !raw);
    return;
  }

  const promises = agents.map(agentName => {
    const adapter = loadAdapter(agentName);
    if (!adapter || !adapter.invokeAsync) {
      return Promise.resolve({
        agent: agentName, status: 'error',
        response: null, error: 'NO_ADAPTER', duration: 0,
      });
    }
    return adapter.invokeAsync(prompt, { timeout: options.timeout, model: options.model })
      .then(result => ({
        agent: agentName,
        status: result.error ? 'error' : 'success',
        response: result.text,
        error: result.error,
        errorType: result.errorType,
        duration: result.duration,
      }));
  });

  const results = await Promise.allSettled(promises);
  const formatted = results.map(r =>
    r.status === 'fulfilled' ? r.value : {
      agent: 'unknown', status: 'error',
      response: null, error: r.reason?.message || 'Unknown error',
    }
  );

  output({ results: formatted }, !raw);
}
```

### Pattern 3: Theme-Based Synthesis Display
**What:** After per-agent feedback blocks, Claude produces a merged synthesis organized by theme rather than by agent, with bracket-tag attribution.
**When to use:** At every co-planner review section in workflow commands.
**Example:**
```markdown
### Merged Synthesis

⚠ 1 of 3 agents failed (Gemini CLI: timeout)

**Missing Requirements:**
- Authentication flow needs explicit session timeout handling [Codex]
- No error recovery strategy for payment failures [OpenCode]

**Scope Concerns:**
- Admin dashboard may be too broad for Phase 1 [Codex, OpenCode]

**Conflicts:**
- Codex suggested adding WebSocket support but OpenCode flagged scope creep — accepted with narrowed scope limited to real-time notifications only

| # | Theme | Source(s) | Feedback | Decision | Reasoning |
|---|-------|-----------|----------|----------|-----------|
| 1 | Missing Reqs | [Codex] | Session timeout | Accepted | Implied by auth requirement |
| 2 | Scope | [Codex, OpenCode] | Admin too broad | Accepted | Narrowed to core CRUD |
| 3 | Architecture | [OpenCode] | Add caching layer | Rejected | Premature optimization |
```

### Anti-Patterns to Avoid
- **Sequential fallback:** Do NOT implement invoke-all as a loop that calls sync `invoke()` for each agent. This defeats the entire purpose. True parallelism requires async I/O.
- **Global timeout for all agents:** Do NOT use a single timeout that kills all agents at once. Per-agent timeouts ensure one slow agent doesn't abort the others. Use `Promise.allSettled` (not `Promise.all`) so individual rejections don't cancel the group.
- **Duplicate temp files:** Each parallel invocation writes a temp file. Use `Date.now()` + agent name in the filename to avoid collisions: `gsd-${CLI_NAME}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`
- **Losing the sync API:** Do NOT remove the existing sync `invoke()` from adapters. The existing `coplanner invoke` command still needs it for single-agent calls. Both sync and async versions must coexist.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async exec | Custom spawn+buffer wrapper | `child_process.exec` with Promise wrapper | `exec` already buffers stdout/stderr and supports timeout natively. A spawn wrapper would duplicate 20+ lines of buffering logic. |
| Partial failure handling | Try/catch around Promise.all | `Promise.allSettled()` | Built-in since Node 12.9.0. Returns `{status:'fulfilled', value}` or `{status:'rejected', reason}` for each promise. Never throws. |
| Agent timeout isolation | Manual clearTimeout per agent | `exec` timeout option | The timeout option on `exec` sends SIGTERM after the specified ms. Per-agent isolation is automatic when each agent runs in its own `exec` call. |
| Result aggregation | Custom event emitter pattern | `Promise.allSettled().then(map)` | The Promise API handles all the coordination. No need for an event bus or custom collector. |

**Key insight:** The entire parallelism infrastructure is already available in Node.js stdlib. The only new code is the Promise wrapper in each adapter and the `invoke-all` command that orchestrates them.

## Common Pitfalls

### Pitfall 1: Temp File Collisions in Parallel Execution
**What goes wrong:** Multiple adapters write temp files simultaneously. If filenames collide (same `Date.now()` value), one agent's prompt overwrites another's.
**Why it happens:** `Date.now()` has millisecond resolution. Two parallel `fs.writeFileSync` calls in the same millisecond produce the same filename.
**How to avoid:** Include the agent/CLI name AND a random suffix in the temp filename: `gsd-${CLI_NAME}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`. The existing adapters already use CLI_NAME in the filename, but adding randomness provides extra safety.
**Warning signs:** Intermittent wrong-agent responses, or agents receiving prompts meant for other agents.

### Pitfall 2: execSync Blocking the Event Loop
**What goes wrong:** If the `invoke-all` command accidentally uses the existing sync `invoke()` inside Promise wrappers, the event loop is still blocked. `Promise.all([syncFn1(), syncFn2()])` calls them sequentially because `execSync` blocks before the Promise resolves.
**Why it happens:** Wrapping synchronous code in a Promise doesn't make it async. `execSync` blocks the entire Node.js process.
**How to avoid:** Use `child_process.exec` (the async callback version) inside `invokeAsync()`. This is the only way to achieve true parallelism without worker threads.
**Warning signs:** Agents always completing in sequence (agent1 finishes, then agent2 starts, then agent3 starts), never overlapping.

### Pitfall 3: Promise.all vs Promise.allSettled
**What goes wrong:** Using `Promise.all()` causes the entire parallel invocation to reject if any single agent fails, losing all successful responses.
**Why it happens:** `Promise.all` short-circuits on first rejection. If Gemini times out, Codex and OpenCode results are discarded.
**How to avoid:** Use `Promise.allSettled()` which always resolves with an array of `{status, value/reason}` objects. Never rejects. Then filter by status in the result mapping.
**Warning signs:** Getting "All co-planners failed" when only one actually failed.

### Pitfall 4: Claude's Bash Tool Cannot Run Parallel Commands
**What goes wrong:** Attempting to invoke agents in parallel from the workflow markdown by telling Claude to "run these bash commands simultaneously."
**Why it happens:** Claude's Bash tool executes commands sequentially. There is no way to run multiple Bash tool calls in true parallel from a slash command's markdown instructions.
**How to avoid:** All parallelism must happen INSIDE gsd-tools.cjs. The workflow command issues ONE bash call (`coplanner invoke-all`), and the parallelism happens within that single Node.js process.
**Warning signs:** Workflow instructions attempting background processes (`&`) or subshells for parallelism.

### Pitfall 5: Config Schema Mismatch for Per-Agent Timeouts
**What goes wrong:** CONTEXT.md says "per-agent timeouts (each agent has own timeout from config)" but the existing config schema only has a global `timeout_ms`.
**Why it happens:** The Phase 7 config schema defined `co_planners.timeout_ms` as a single global value. Per-agent timeout configuration was not part of Phase 7's scope.
**How to avoid:** Two options: (A) extend config schema with per-agent timeout overrides, or (B) use the global `timeout_ms` as the default but pass it per-agent to each `exec` call so they time out independently. Option B satisfies the CONTEXT.md requirement ("one slow agent doesn't block others") because each `exec` call has its own timeout -- they just happen to share the same value. The requirement is about isolation, not different values.
**Warning signs:** All agents timing out simultaneously because a single timer governs the group.

## Code Examples

### Async Adapter Pattern (codex.cjs extension)
```javascript
// Add to each adapter alongside existing invoke()
const { exec } = require('child_process');

function invokeAsync(prompt, options) {
  const timeout = (options && options.timeout) || 120000;
  const model = options && options.model;
  const tmpFile = path.join(os.tmpdir(),
    `gsd-${CLI_NAME}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`);
  const start = Date.now();

  return new Promise((resolve) => {
    try {
      fs.writeFileSync(tmpFile, prompt, 'utf-8');
    } catch (writeErr) {
      resolve({
        text: null, cli: CLI_NAME, duration: 0,
        exitCode: 1, error: writeErr.message, errorType: 'WRITE_ERROR',
      });
      return;
    }

    let cmd = `cat "${tmpFile}" | codex exec - --ephemeral --full-auto --skip-git-repo-check`;
    if (model) cmd += ` -m "${model}"`;

    exec(cmd, {
      timeout,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    }, (err, stdout) => {
      const duration = Date.now() - start;
      try { fs.unlinkSync(tmpFile); } catch (_) {}

      if (err) {
        resolve({
          text: null, cli: CLI_NAME, duration,
          exitCode: err.code || 1, error: err.message,
          errorType: classifyError(err),
        });
      } else {
        resolve({
          text: stdout.trim(), cli: CLI_NAME, duration,
          exitCode: 0, error: null, errorType: null,
        });
      }
    });
  });
}

module.exports = { detect, invoke, invokeAsync, CLI_NAME };
```

### invoke-all Command Pattern
```javascript
// New subcommand in gsd-tools.cjs coplanner group
case 'invoke-all': {
  const promptIdx = args.indexOf('--prompt');
  const prompt = promptIdx !== -1 ? args[promptIdx + 1] : null;
  if (!prompt) error('--prompt required');
  const agentsIdx = args.indexOf('--agents');
  const agentsList = agentsIdx !== -1 ? args[agentsIdx + 1].split(',') : null;
  const checkpointIdx = args.indexOf('--checkpoint');
  const checkpoint = checkpointIdx !== -1 ? args[checkpointIdx + 1] : null;
  const timeoutIdx = args.indexOf('--timeout');
  const timeout = timeoutIdx !== -1 ? parseInt(args[timeoutIdx + 1], 10) : undefined;

  // Resolve agents: explicit list > checkpoint config > error
  let agents = agentsList;
  if (!agents && checkpoint) {
    const resolved = getAgentsForCheckpoint(cwd, checkpoint);
    agents = resolved.agents;
  }
  if (!agents || agents.length === 0) error('No agents specified or configured');

  await cmdCoplannerInvokeAll(cwd, agents, prompt, { timeout }, raw);
  break;
}
```

### Workflow Instruction Pattern (replaces sequential loop)
```markdown
## Co-Planner Review — {Checkpoint}

**Resolve and invoke all co-planner agents:**

```bash
CO_AGENTS_JSON=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs coplanner agents "{checkpoint}")
```

Parse JSON. Extract `agents` array. If empty, skip to adversary review.

If non-empty, construct prompt (same as Phase 8) and invoke all agents in parallel:

```bash
RESULTS_JSON=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs coplanner invoke-all \
  --agents "{agents_csv}" --prompt "$(cat "$PROMPT_FILE")")
```

Parse `RESULTS_JSON`. Extract `results` array: `[{agent, status, response, error, errorType, duration}]`.

**Failure triage:**
- Count successes and failures from results array
- If ALL failed: display warning and skip to adversary review
- If SOME failed: display inline warning at top: "⚠ {N} of {M} agents failed ({agent}: {errorType})"

**Display per-agent feedback blocks** (same format as Phase 8)

**Display merged synthesis** (organized by theme, not by agent):

```
### Merged Synthesis

**{Theme 1}:**
- {feedback point} [{Agent1}]
- {feedback point} [{Agent1}, {Agent2}]

**{Theme 2}:**
- {feedback point} [{Agent2}]
```
```

## State of the Art

| Old Approach (Phase 8) | New Approach (Phase 9) | What Changes | Impact |
|------------------------|------------------------|--------------|--------|
| Sequential `coplanner invoke` per agent | Single `coplanner invoke-all` with Promise.allSettled | Adapters gain `invokeAsync()`, gsd-tools.cjs gains `invoke-all` subcommand | Invocation time drops from sum-of-agents to max-of-agents |
| Per-agent feedback blocks only | Per-agent blocks + merged theme-based synthesis | Workflow instructions add synthesis section after per-agent display | Clearer actionable output, cross-agent patterns emerge |
| Simple accept/reject log | Theme-grouped synthesis with bracket attribution | Claude organizes by theme, tags sources inline | Conflicts between agents become visible |
| Silent skip on all-fail | Inline failure warning in synthesis header | "⚠ 1 of 3 agents failed" banner | Users know what happened |

**Deprecated/outdated:**
- The Phase 8 "for each agent" sequential loop pattern in workflow commands becomes obsolete for multi-agent scenarios. Single-agent invocation via `coplanner invoke` remains for debugging/testing.

## Open Questions

1. **Per-agent timeout configuration**
   - What we know: CONTEXT.md says "per-agent timeouts (each agent has own timeout from config, default 120s)". Current config has only global `co_planners.timeout_ms`.
   - What's unclear: Whether each agent needs a different timeout value, or just independent timeout enforcement per exec call.
   - Recommendation: Implement independent timeout enforcement using the global `timeout_ms` value passed to each `exec` call. This satisfies "one slow agent doesn't block others" without config schema changes. If per-agent values are needed later, the config schema can add `co_planners.agents_config: {codex: {timeout_ms: 60000}}` without breaking existing behavior. Keep it simple for Phase 9.

2. **Prompt file for invoke-all**
   - What we know: Current invoke uses `--prompt "text"` which has shell quoting issues for large artifacts. Phase 8 uses temp files to work around this.
   - What's unclear: Whether `invoke-all` should accept a temp file path (`--prompt-file`) instead of inline text.
   - Recommendation: Add `--prompt-file` as an alternative to `--prompt`. The workflow instructions already create temp files (Phase 8 pattern). Having `invoke-all` read from a file path avoids double-escaping issues entirely. The command reads the file, passes content to all adapters, and cleans up.

3. **invoke-all command design: agents list vs checkpoint**
   - What we know: `invoke-all` needs to know which agents to invoke. Two approaches: accept explicit `--agents codex,gemini` or accept `--checkpoint requirements` and resolve internally.
   - What's unclear: Whether both should be supported or just one.
   - Recommendation: Support both. `--checkpoint` resolves via existing `getAgentsForCheckpoint()` internally. `--agents` takes an explicit CSV list. The workflow commands would use `--checkpoint` (cleaner, single source of truth). `--agents` is available for testing/debugging. If both specified, `--agents` takes precedence.

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** -- Read all three adapter files (`codex.cjs`, `gemini.cjs`, `opencode.cjs`), gsd-tools.cjs coplanner command group (lines 252-346, 4941-5024, 5427-5460), all four co-planner review sections in workflow commands
- **Node.js child_process docs** -- `exec()` signature: `exec(command, options, callback)` with `options.timeout` for per-process timeout. Returns ChildProcess. Callback receives `(error, stdout, stderr)`.
- **Node.js Promise.allSettled** -- Available since Node.js 12.9.0. Returns `Array<{status: 'fulfilled', value} | {status: 'rejected', reason}>`. Never rejects.

### Secondary (MEDIUM confidence)
- **Phase 6 research** -- Confirmed `execSync` was chosen specifically because "Co-planning is request/response, not streaming. `execSync` is simpler." Phase 9 changes this calculus because parallel invocation requires non-blocking I/O.
- **Phase 8 research** -- Confirmed the sequential "for each agent" pattern and its structural precedent from the adversary review pattern.

### Tertiary (LOW confidence)
- None. All findings verified against codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All tools are Node.js built-ins already partially used in codebase
- Architecture: HIGH -- Pattern is straightforward async conversion of existing sync code, plus workflow instruction updates
- Pitfalls: HIGH -- All pitfalls identified from direct codebase analysis and known Node.js async patterns

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable -- Node.js stdlib, no external dependencies)
