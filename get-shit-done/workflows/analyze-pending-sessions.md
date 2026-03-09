<purpose>
Process sessions marked as session_analysis_pending by the Telegram MCP server.

This workflow completes the full analysis loop by:
1. Discovering sessions awaiting Haiku analysis (marked by the MCP server at conversation end)
2. Spawning Haiku subagents to extract decisions, reasoning patterns, and meta-knowledge
3. Storing the extracted knowledge in the project's knowledge database

The MCP server prepares extraction requests and writes a session_analysis_pending JSONL
entry. This workflow reads those entries, invokes Haiku Agent() for each extraction type,
and stores the results via gsd-tools.js.

Invocation:
- Manually: /gsd:analyze-pending-sessions
- At session start: Via a Claude Code SessionStart hook that checks for pending sessions
- After historical extraction: To process extraction requests from historical-extract
</purpose>

<constraints>
- ZERO direct API calls — all Haiku work via Agent(subagent_type="general-purpose", model="haiku")
- Sequential processing: one session at a time to avoid overwhelming the system
- Partial analysis is better than none: if one extraction type fails, continue with others
- If store-analysis-result fails for a session, log and continue with the next session
</constraints>

<process>

<step name="discover_pending_sessions">
Discover sessions that have been flagged for analysis by the MCP server.

```bash
PENDING_JSON=$(node ~/.claude/get-shit-done/bin/gsd-tools.js list-pending-sessions)
```

Parse the JSON output. Extract `count` and `pending` array.

If `count === 0`:
```
No pending sessions to analyze. Knowledge database is up to date.
```
Exit.

Otherwise, report:
```
Found {count} session(s) pending Haiku analysis.
```

Note: `pending` is an array of objects with shape:
  `{ sessionId, sessionPath, extractionRequests, timestamp }`

Where `extractionRequests` is an array of `{ type, prompt, expectedSchema }` objects
that were prepared by session-analyzer.js at session close time.
</step>

<step name="process_each_session" for_each="session in pending">
Process each session sequentially to extract knowledge.

**For each session:**

1. Log start: `Analyzing session {sessionId}...`

2. If `session.extractionRequests` is empty or missing, skip:
   ```
   Session {sessionId}: no extraction requests found, skipping.
   ```

3. **For each extraction request** in `session.extractionRequests`:
   Each request has `{ type: string, prompt: string }`.

   Spawn a Haiku subagent for each extraction type:
   ```
   Agent(
     subagent_type="general-purpose",
     model="haiku",
     prompt="{request.prompt}",
     description="Extract {item.type}",
     max_turns=15
   )
   ```

   Collect the raw text output from each Agent() call.

   If Agent() throws or returns empty: log the error and continue with remaining
   extraction types for this session.

4. **Assemble results array** from all successful Agent() outputs:
   ```json
   [
     {"type": "decision", "result": "{haikuOutput1}"},
     {"type": "reasoning_pattern", "result": "{haikuOutput2}"},
     {"type": "meta_knowledge", "result": "{haikuOutput3}"}
   ]
   ```

   Serialize to JSON string (or write to a temp file).

5. **Store the results** by calling gsd-tools.js:
   ```bash
   STORE_RESULT=$(node ~/.claude/get-shit-done/bin/gsd-tools.js \
     store-analysis-result "{sessionId}" '{resultsJson}')
   ```

   Parse `STORE_RESULT` for `stored`, `skipped`, `evolved`, `errors`.

6. Log outcome:
   ```
   Session {sessionId}: {stored} stored, {evolved} evolved, {skipped} skipped, {errors.length} errors
   ```

   If errors exist, list them (for debugging, not fatal).
</step>

<step name="summary">
After processing all pending sessions, output a final summary:

```
Session Analysis Complete
=========================
Sessions processed: {count}
Total insights stored: {totalStored}
Total insights evolved: {totalEvolved}
Total insights skipped (duplicates): {totalSkipped}
Errors encountered: {totalErrors}
```

If any sessions failed entirely (all extraction types failed), list them for manual retry.

If `totalErrors > 0` and all errors are non-fatal (individual extraction types), this is
normal — partial analysis is expected for sessions with unusual content.
</step>

<step name="historical_extraction_mode">
This step applies when invoked AFTER running `historical-extract`:

```bash
HISTORICAL_JSON=$(node ~/.claude/get-shit-done/bin/gsd-tools.js \
  historical-extract "/path/to/project/.planning")
```

The `historical-extract` command returns:
```json
{
  "phasesFound": N,
  "phasesCompleted": N,
  "extractionRequests": [
    {"phaseNumber": "01", "conversationId": "phase-01", "phaseName": "...", "requests": [...]}
  ]
}
```

For each item in `extractionRequests`, treat it like a pending session:
- Use `conversationId` as the sessionId
- Use `requests` as the extraction requests
- Process each request via Haiku Agent() and store results via store-analysis-result

This enables bulk extraction from existing projects with completed phases.
</step>

</process>

<success_criteria>
- [ ] All pending sessions discovered via list-pending-sessions
- [ ] Each session's extraction requests passed to Haiku Agent() subagents
- [ ] Results stored via store-analysis-result (marks sessions as analyzed, writes to knowledge DB)
- [ ] session_analysis_complete entry written to each processed session JSONL file
- [ ] Summary report generated showing totals
- [ ] Failed sessions listed for manual retry
</success_criteria>
