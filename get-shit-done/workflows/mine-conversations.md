<purpose>
Mine Claude Code project conversations to extract decisions, reasoning patterns, and meta-knowledge.

This workflow discovers conversation JSONL files at /Users/ollorin/.claude/projects/{slug}/, converts them to
session-like entries, spawns Haiku subagents for knowledge extraction, and stores results in the
project's knowledge database.

The conversation-miner.js module handles format conversion (Claude Code JSONL → Phase 11
compatible entries). The mine-conversations CLI command applies quality gates and prevents
re-analysis via .planning/knowledge/.conversation-analysis-log.jsonl. This workflow reads those
entries, invokes Haiku Task() for each extraction type, and stores the results via
store-conversation-result.

Invocation:
- Manually: /gsd:mine-conversations
- With options: /gsd:mine-conversations --max-age-days 7 --limit 5
- Include subagent files: /gsd:mine-conversations --include-subagents
</purpose>

<constraints>
- ZERO direct API calls — all Haiku work via Task(subagent_type="general-purpose", model="haiku")
- Sequential processing: one conversation at a time to avoid overwhelming the system
- Partial analysis is better than none: if one extraction type fails, continue with others
- If store-conversation-result fails for a conversation, log and continue with the next
- Default to current project only, last 30 days
</constraints>

<process>

<step name="discover_conversations">
Discover conversation JSONL files that are ready to be mined for knowledge.

```bash
MINE_JSON=$(node /Users/ollorin/.claude/get-shit-done/bin/gsd-tools.js mine-conversations --max-age-days 30 --limit 10)
```

Parse the JSON output. Extract `status`, `sessionsReady`, `sessionsSkipped`, `sessions`, `skipped`.

If `status === 'error'`:
```
Error during conversation discovery: {error message}
```
Exit.

If `sessionsReady === 0`:
```
No conversations ready for mining.
Already analyzed: {sessionsSkipped} conversation(s) skipped.
```
If any skipped, list unique reasons grouped (e.g., "already-analyzed: 5, too-short: 2").
Exit.

Otherwise, report:
```
Found {sessionsReady} conversation(s) ready for mining ({sessionsSkipped} skipped).
```

If any skipped, briefly list their reasons grouped by type.
</step>

<step name="process_each_conversation" for_each="session in sessions">
Process each conversation sequentially to extract knowledge.

**For each session in the sessions array:**

1. Log start:
   ```
   Mining conversation {sessionId}...
   ```

2. If `session.extractionRequests` is empty or missing, skip:
   ```
   Conversation {sessionId}: no extraction requests found, skipping.
   ```

3. **For each extraction request** in `session.extractionRequests`:
   Each request has `{ type: string, prompt: string }`.

   Spawn a Haiku subagent for each extraction type:
   ```
   Task(
     subagent_type="general-purpose",
     model="haiku",
     prompt="{request.prompt}"
   )
   ```

   Collect the raw text output from each Task() call.

   If Task() throws or returns empty: log the error and continue with remaining
   extraction types for this conversation.

4. **Assemble results array** from all successful Task() outputs:
   ```json
   [
     {"type": "decision", "result": "{haikuOutput1}"},
     {"type": "reasoning_pattern", "result": "{haikuOutput2}"},
     {"type": "meta_knowledge", "result": "{haikuOutput3}"}
   ]
   ```

   Serialize to JSON string.

5. **Store the results** by calling gsd-tools.js:
   ```bash
   STORE_RESULT=$(node /Users/ollorin/.claude/get-shit-done/bin/gsd-tools.js \
     store-conversation-result "{sessionId}" '{resultsJson}' --content-hash "{session.contentHash}")
   ```

   Note: Pass `session.contentHash` to `--content-hash` so the store command marks this exact
   content version as analyzed. Future runs of mine-conversations will skip this conversation.

   Parse `STORE_RESULT` for `stored`, `skipped`, `evolved`, `errors`.

6. Log outcome:
   ```
   Conversation {sessionId}: {stored} stored, {evolved} evolved, {skipped} skipped, {errors.length} errors
   ```

   If errors exist, list them (for debugging, not fatal).
</step>

<step name="summary">
After processing all conversations, output a final summary:

```
Conversation Mining Complete
=============================
Conversations processed: {count}
Total insights stored: {totalStored}
Total insights evolved: {totalEvolved}
Total insights skipped (duplicates): {totalSkipped}
Errors encountered: {totalErrors}
```

If any conversations failed entirely (all extraction types failed), list them for manual retry:
```
Failed conversations (retry manually):
- {sessionId}: {reason}
```

If `totalErrors > 0` and all errors are non-fatal (individual extraction types), this is
normal — partial analysis is expected for conversations with unusual content.
</step>

</process>

<success_criteria>
- [ ] All discovered conversations processed via Haiku Task() subagents (zero direct API calls)
- [ ] Results stored via store-conversation-result (marks conversations as analyzed)
- [ ] Already-analyzed conversations skipped at discovery time via .conversation-analysis-log.jsonl
- [ ] Summary report generated showing totals (stored, evolved, skipped, errors)
- [ ] Failed conversations listed for manual retry
</success_criteria>
