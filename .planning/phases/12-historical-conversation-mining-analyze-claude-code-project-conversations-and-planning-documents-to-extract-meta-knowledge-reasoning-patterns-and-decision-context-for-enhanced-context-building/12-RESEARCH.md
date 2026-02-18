# Phase 12: Historical Conversation Mining - Research

**Researched:** 2026-02-17
**Domain:** Claude Code conversation JSONL format, cross-session knowledge extraction, format adaptation
**Confidence:** HIGH

## Summary

Phase 12 mines Claude Code's project conversation history stored at `~/.claude/projects/{project-slug}/*.jsonl`. These files are the source of truth for what actually happened across Claude Code sessions: which GSD commands were run, how Claude reasoned through decisions, what errors occurred, and what user corrections were made.

Phase 11 already handles two extraction sources: Telegram MCP sessions (question/answer format) and `.planning/` documents (RESEARCH.md, PLAN.md, SUMMARY.md, VERIFICATION.md via `historical-extract.js`). Phase 12 adds a third source: the raw Claude Code conversation logs. This introduces a significant format challenge — the JSONL entries use `type: 'user' | 'assistant' | 'progress' | 'system'` rather than the Telegram-style `question/answer/user_message/bot_response` types that the existing extraction pipeline expects.

The practical data picture is important: 64 JSONL files for this project total 86MB on disk, but only ~136K tokens of actual text content (plus 179 subagent files adding ~259K tokens). The rest is `progress` entries (hook execution traces, tool call metadata) that contain no extractable knowledge. A conversation miner must filter aggressively to surface the ~395K tokens of real content across all files.

**Primary recommendation:** Build `conversation-miner.js` as a format adapter that converts Claude Code JSONL entries into session-like entries compatible with the existing `session-analyzer.js` + `analysis-prompts.js` + `knowledge-writer.js` pipeline. Add a `mine-conversations` CLI command to `gsd-tools.js` and a `mine-conversations.md` GSD workflow. Reuse Phase 11's extraction infrastructure wholesale — the heavy lifting is format conversion, not new analysis logic.

## Standard Stack

### Core (Already Installed — No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^11.8.1 | Knowledge storage | Phase 3 foundation, already in use |
| Node.js fs/path | built-in | JSONL file reading | No dependency needed |
| Node.js crypto | built-in | SHA-256 content hashing | Used by session-quality-gates.js |

### Phase 11 Infrastructure to Reuse
| Module | Location | Purpose | How Phase 12 Uses It |
|--------|----------|---------|----------------------|
| session-analyzer.js | get-shit-done/bin/ | Prepares Haiku extraction requests | Call analyzeSession() after format conversion |
| analysis-prompts.js | get-shit-done/bin/ | Haiku prompt templates | formatEntriesForPrompt() + builders |
| session-quality-gates.js | get-shit-done/bin/ | Quality gates + re-analysis prevention | Needs adaptation for conversation format |
| session-chunker.js | get-shit-done/bin/ | 25k-char chunking | chunkSession() after format conversion |
| knowledge-writer.js | get-shit-done/bin/ | Store insights in Phase 3 DB | storeInsights() — no changes needed |
| historical-extract.js | get-shit-done/bin/ | .planning/ doc mining | Already complete — Phase 12 does NOT touch this |

### New Module
| Module | Location | Purpose |
|--------|----------|---------|
| conversation-miner.js | get-shit-done/bin/ | Converts Claude Code JSONL to session-like entries |

**Installation:** No new packages needed. Everything reuses Phase 11 + Phase 3 infrastructure.

## Architecture Patterns

### Recommended Project Structure
```
get-shit-done/bin/
├── conversation-miner.js    # NEW: Claude Code JSONL format adapter
├── session-analyzer.js      # Phase 11 (unchanged)
├── session-chunker.js       # Phase 11 (unchanged)
├── session-quality-gates.js # Phase 11 (unchanged, with notes on format)
├── knowledge-writer.js      # Phase 11 (unchanged)
└── gsd-tools.js             # Phase 11 (add mine-conversations command)

get-shit-done/workflows/
├── analyze-pending-sessions.md  # Phase 11 (already exists)
└── mine-conversations.md        # NEW: workflow for conversation mining
```

### Pattern 1: Format Adapter (Core of Phase 12)
**What:** Convert Claude Code JSONL entries (`user/assistant/progress/system`) into Telegram-style session entries (`user_message/bot_response`) compatible with `formatEntriesForPrompt()`.
**When to use:** Always — this is the entry point for all conversation mining.
**Example:**
```javascript
// Source: Analysis of ~/.claude/projects JSONL format + analysis-prompts.js requirements

const RELEVANT_TYPES = new Set(['user', 'assistant']);

/**
 * Convert Claude Code JSONL entries to session-like entries.
 * Filters out noise (progress, file-history-snapshot, queue-operation, system).
 * Maps user → user_message, assistant text → bot_response.
 * Skips tool results (user messages with content type='tool_result').
 * Skips command injections (user messages with XML <command-*> tags only).
 */
function convertConversationEntries(jsonlEntries) {
  const result = [];

  for (const entry of jsonlEntries) {
    if (!entry || !RELEVANT_TYPES.has(entry.type)) continue;

    const timestamp = entry.timestamp || new Date().toISOString();
    const message = entry.message || {};
    const content = message.content;

    if (entry.type === 'user') {
      // Skip tool_result content (these are tool outputs, not human input)
      if (Array.isArray(content)) {
        const hasOnlyToolResults = content.every(
          item => item && item.type === 'tool_result'
        );
        if (hasOnlyToolResults) continue;

        // Extract text items only (skip tool_result items)
        const texts = content
          .filter(item => item && item.type === 'text')
          .map(item => item.text || '')
          .join('\n')
          .trim();

        if (texts.length < 20) continue; // Skip minimal/empty messages

        // Skip pure command injections (XML-only messages from GSD workflows)
        const cleanText = texts.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim();
        if (cleanText.length < 10) continue;

        result.push({
          type: 'user_message',
          content: cleanText || texts,
          timestamp,
          original_type: 'user'
        });

      } else if (typeof content === 'string' && content.trim().length > 20) {
        const cleanText = content.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '').trim();
        if (cleanText.length < 10) continue;
        result.push({
          type: 'user_message',
          content: cleanText || content,
          timestamp,
          original_type: 'user'
        });
      }

    } else if (entry.type === 'assistant') {
      // Extract text blocks only (skip tool_use blocks)
      if (Array.isArray(content)) {
        const texts = content
          .filter(item => item && item.type === 'text')
          .map(item => item.text || '')
          .join('\n')
          .trim();

        if (texts.length < 30) continue; // Skip brief orchestration notes

        result.push({
          type: 'bot_response',
          content: texts,
          timestamp,
          original_type: 'assistant'
        });
      }
    }
  }

  return result;
}
```

### Pattern 2: Project Conversation Discovery
**What:** Find all Claude Code JSONL files for a project by mapping the working directory to the project slug used by Claude Code.
**When to use:** The `mine-conversations` command needs to discover the right project directory.
**Example:**
```javascript
// Source: Direct observation of ~/.claude/projects/ directory structure
// Claude Code converts CWD path to slug by replacing / with -

const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Discover Claude Code conversation JSONL files for a project.
 *
 * Claude Code stores conversations at:
 *   ~/.claude/projects/{project-slug}/*.jsonl
 *
 * The project slug is the CWD path with / replaced by -:
 *   /Users/ollorin/get-shit-done → -Users-ollorin-get-shit-done
 *
 * @param {string} projectCwd - Absolute path to project directory
 * @param {object} options
 * @param {number} [options.maxAgeDays=30] - Skip files older than N days
 * @param {boolean} [options.includeSubagents=false] - Also scan subagent/ dirs
 * @returns {Array<{path: string, sessionId: string, size: number, mtime: Date}>}
 */
function discoverProjectConversations(projectCwd, options = {}) {
  const { maxAgeDays = 30, includeSubagents = false } = options;

  const homeDir = os.homedir();
  const claudeProjectsDir = path.join(homeDir, '.claude', 'projects');

  // Convert project CWD to Claude Code slug
  const slug = projectCwd.replace(/\//g, '-');
  const projectSlugDir = path.join(claudeProjectsDir, slug);

  if (!fs.existsSync(projectSlugDir)) {
    return { files: [], projectSlugDir, error: 'Project slug directory not found' };
  }

  const cutoffMs = maxAgeDays > 0
    ? Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    : 0;

  const files = [];

  // Scan top-level JSONL files (main conversations)
  const entries = fs.readdirSync(projectSlugDir);
  for (const entry of entries) {
    if (entry.endsWith('.jsonl')) {
      const fullPath = path.join(projectSlugDir, entry);
      const stat = fs.statSync(fullPath);

      if (cutoffMs > 0 && stat.mtimeMs < cutoffMs) continue;

      files.push({
        path: fullPath,
        sessionId: entry.replace('.jsonl', ''),
        size: stat.size,
        mtime: stat.mtime
      });
    }

    // Optionally include subagent JSONL files
    if (includeSubagents) {
      const subagentsPath = path.join(projectSlugDir, entry, 'subagents');
      if (fs.existsSync(subagentsPath)) {
        const subFiles = fs.readdirSync(subagentsPath).filter(f => f.endsWith('.jsonl'));
        for (const sf of subFiles) {
          const fullPath = path.join(subagentsPath, sf);
          const stat = fs.statSync(fullPath);
          if (cutoffMs > 0 && stat.mtimeMs < cutoffMs) continue;
          files.push({
            path: fullPath,
            sessionId: `${entry}-sub-${sf.replace('.jsonl', '')}`,
            size: stat.size,
            mtime: stat.mtime,
            isSubagent: true
          });
        }
      }
    }
  }

  // Sort by modification time, newest first
  files.sort((a, b) => b.mtime - a.mtime);
  return { files, projectSlugDir };
}
```

### Pattern 3: Conversation-Level Quality Gate
**What:** Adapted quality gate for conversation JSONL entries (which use user_message/bot_response, not question/answer).
**When to use:** Before preparing extraction requests — skip trivial conversations.
**Example:**
```javascript
// Source: session-quality-gates.js pattern + conversation format analysis
// Conversation JSONLs typically have very few human text messages (avg 2-5 per session)
// but many tool calls. A conversation is worth mining if it has >= 3 bot_response blocks

function shouldMineConversation(convertedEntries) {
  const userMsgCount = convertedEntries.filter(e => e.type === 'user_message').length;
  const botRespCount = convertedEntries.filter(e => e.type === 'bot_response').length;
  const totalText = convertedEntries.reduce((sum, e) => sum + (e.content || '').length, 0);

  if (botRespCount < 2) {
    return { mine: false, reason: `Only ${botRespCount} assistant response(s) - too sparse` };
  }

  if (totalText < 500) {
    return { mine: false, reason: `Only ${totalText} total chars - insufficient content` };
  }

  return {
    mine: true,
    reason: `${userMsgCount} user msgs, ${botRespCount} bot responses, ${totalText} chars`
  };
}
```

### Pattern 4: Cross-Session Synthesis via Existing knowledge-synthesis.js
**What:** After mining individual conversations, trigger synthesis to extract cross-session patterns.
**When to use:** After bulk conversation mining (e.g., mine all 30-day conversations).
**Example:**
```javascript
// Source: knowledge-synthesis.js (Phase 4) - synthesizePrinciples() already exists
// Phase 12 does NOT need to implement new synthesis — just call existing function

async function runPostMiningsynthesis(conn, options = {}) {
  const { synthesizePrinciples } = require('./knowledge-synthesis.js');

  // synthesizePrinciples() clusters existing knowledge entries by embedding similarity
  // and generates principle-level generalizations
  const result = await synthesizePrinciples(conn, {
    types: ['decision', 'lesson'],  // Include decisions from conversation mining
    limit: 200  // Process up to 200 recent entries
  });

  return result;
}
```

### Anti-Patterns to Avoid
- **Processing every line in JSONL as a potential insight:** Over 90% of lines are `progress` entries (hook execution, tool call metadata). Filter to `type: 'user' | 'assistant'` only.
- **Treating tool_result content as user input:** When a user entry contains `content: [{type:'tool_result', ...}]`, it's Claude Code's tool output, not human text. Always filter these.
- **Processing XML command wrappers as human intent:** GSD workflow injections (`<command-message>`, `<objective>`, etc.) are system-level context, not human reasoning. Strip these from user messages.
- **Expecting rich text from brief orchestration notes:** Many assistant messages are 1-2 sentences (`"Good! Phase 8 has 2 incomplete plans."`). Don't expect profound reasoning — filter by minimum length.
- **Mining subagents by default:** Subagent files (in `{session-id}/subagents/`) contain execution detail but also significant noise. Make subagent mining opt-in.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Haiku prompt templates | New prompt templates | Existing analysis-prompts.js (DECISION, REASONING, META_KNOWLEDGE) | Phase 11 prompts already tuned for knowledge extraction. Format-agnostic after formatEntriesForPrompt() |
| Knowledge storage | Custom DB insertion | knowledge-writer.js storeInsights() | Phase 4 three-stage dedup + evolution + TTL already implemented |
| Deduplication | Content similarity | knowledge-dedup.js checkDuplicate() | Phase 4 three-stage dedup (content hash → canonical hash → embedding) |
| Chunking | Custom text splitter | session-chunker.js chunkSession() | 25k-char chunks proven by Phase 11, reuse directly after format conversion |
| Re-analysis prevention | Custom tracking | session-quality-gates.js markSessionAnalyzed() | Uses content hash + analysis log — extend to conversation mining |
| Cross-session synthesis | New clustering | knowledge-synthesis.js synthesizePrinciples() | Phase 4 already implements embedding clustering into principles |

**Key insight:** Phase 12's core value is the format adapter (converting Claude Code JSONL to session-like entries). Once entries are in the right format, the entire Phase 11 extraction pipeline runs unchanged.

## Common Pitfalls

### Pitfall 1: The 90% Noise Problem
**What goes wrong:** Mining JSONL files without filtering produces mostly `progress` entries (hook execution traces, tool call metadata) with zero extractable knowledge. A 4.8MB file might have only 13K chars of actual text.
**Why it happens:** Claude Code stores full execution trace, not just conversation text.
**How to avoid:** Filter aggressively on `type === 'user' | 'assistant'` and then filter by content type within those entries. Remove `tool_result` user entries. Remove `tool_use` assistant entries. Only keep text blocks.
**Warning signs:** Extraction requests with empty session text, Haiku returning `[]` for all extraction types.

### Pitfall 2: Tool Result Entries Misidentified as User Input
**What goes wrong:** User entries with `content: [{type:'tool_result', content:'...'}]` are treated as human messages, polluting extraction with command outputs.
**Why it happens:** Claude Code sends tool results back to the model as `type: 'user'` entries (this is how Anthropic's API conversation format works).
**How to avoid:** Check if ALL content items in a user entry are `type: 'tool_result'` — if so, skip the entry entirely.
**Warning signs:** Extracted "decisions" that contain file paths, bash output, or JSON dumps.

### Pitfall 3: GSD Command Injection Treated as Human Reasoning
**What goes wrong:** GSD workflow files inject massive XML blocks (`<objective>`, `<context>`, `<tasks>`) as user messages. These are system context, not human reasoning. Haiku extracts pseudo-decisions from workflow descriptions.
**Why it happens:** GSD runs as slash commands which inject workflow content as user messages. The injection contains real decision language ("Use X", "Implement Y") but it's workflow template text, not user preferences.
**How to avoid:** Strip XML tags and their content from user messages. Check if the clean text after stripping is < 10 chars — if so, skip the entry.
**Warning signs:** Extracted "decisions" match GSD workflow template text verbatim.

### Pitfall 4: Session Age Filtering Missing
**What goes wrong:** Mining ALL 64+ JSONL files on first run, including files from months ago or other projects, creating excessive Haiku Task() invocations.
**Why it happens:** No age filter applied to file discovery.
**How to avoid:** Default `maxAgeDays=30` in `discoverProjectConversations()`. The prior decision (Phase 04-05) sets this as the standard filter for session log discovery.
**Warning signs:** `mine-conversations` command returns 60+ files, analysis loop runs for many minutes.

### Pitfall 5: Quality Gate Mismatch (question/answer vs user_message/bot_response)
**What goes wrong:** Using `shouldAnalyzeSession()` from Phase 11 on converted conversation entries. The gate checks for `question` and `answer` types — both return 0 for conversation entries — causing all conversations to be skipped with "Only 0 questions (minimum 2)".
**Why it happens:** `session-quality-gates.js` SUBSTANTIVE_TYPES set is `{question, answer, user_message, bot_response}`. The question/answer minimum thresholds still apply even though conversation entries never have those types.
**How to avoid:** Create `shouldMineConversation()` in `conversation-miner.js` with thresholds tuned for the conversation format (bot_response count >= 2, total chars >= 500). Do NOT call `shouldAnalyzeSession()` on conversation entries.
**Warning signs:** All conversations skipped with "Only 0 questions" reason.

### Pitfall 6: Slug Mapping Fails for Non-Standard Paths
**What goes wrong:** Claude Code's project slug mapping (`/Users/ollorin/get-shit-done` → `-Users-ollorin-get-shit-done`) may not work for paths with spaces or unusual characters.
**Why it happens:** The slug is derived by replacing `/` with `-`, but the exact algorithm isn't documented. Paths with spaces or `.` may produce unexpected slugs.
**How to avoid:** Add fallback discovery: if the expected slug path doesn't exist, list all dirs in `~/.claude/projects/` and find the one that contains the current project's files (by cross-referencing `cwd` field in JSONL entries).
**Warning signs:** `discoverProjectConversations()` returns `{ files: [], error: 'Project slug directory not found' }` even though conversations exist.

## Code Examples

Verified patterns from direct codebase inspection:

### Complete JSONL Entry Type Reference
```
Claude Code JSONL entry types (verified from ~/.claude/projects/*.jsonl):

type: 'user'              - Human input OR tool results returned to Claude
  content: string         - Direct text (slash command, human message)
  content: [{type:'tool_result', ...}]  - Tool output (SKIP for mining)
  content: [{type:'text', text:'...'}]  - Human text (USE for mining)

type: 'assistant'         - Claude's response
  message.content: [{type:'text', text:'...'}]    - Claude's reasoning (USE)
  message.content: [{type:'tool_use', input:{}}]  - Tool call (SKIP)
  message.content: mixed  - Often text THEN tool_use (USE only text items)

type: 'progress'          - Hook execution traces, tool progress (ALWAYS SKIP)
  data: {type:'hook_progress', hookEvent, command}  - 90%+ of entries by count

type: 'system'            - Session metadata (turn_duration, etc.) (SKIP)
  subtype: 'turn_duration'
  slug, version, gitBranch, sessionId

type: 'file-history-snapshot'  - File state tracking (SKIP)

type: 'queue-operation'   - Internal queue ops (SKIP)
  operation: 'enqueue' | 'dequeue' | 'remove' | 'popAll'
```

### gsd-tools.js mine-conversations Command Pattern
```javascript
// Source: Follow existing cmdAnalyzeSession pattern in gsd-tools.js

/**
 * mine-conversations [--max-age-days N] [--include-subagents] [--limit N]
 *
 * Discovers Claude Code project conversations, converts to session-like entries,
 * and prepares Haiku extraction requests for the calling GSD workflow.
 */
async function cmdMineConversations(cwd, args, raw) {
  // Parse options
  const maxAgeDays = parseInt(getArg(args, '--max-age-days') || '30', 10);
  const includeSubagents = args.includes('--include-subagents');
  const limit = parseInt(getArg(args, '--limit') || '0', 10);

  let conversationMiner;
  try {
    conversationMiner = require(path.join(__dirname, 'conversation-miner.js'));
  } catch (err) {
    output({ status: 'error', reason: 'conversation-miner.js not loadable: ' + err.message }, raw);
    return;
  }

  // Discover conversations
  const { files, projectSlugDir, error } = conversationMiner.discoverProjectConversations(
    cwd, { maxAgeDays, includeSubagents }
  );

  if (error) {
    output({ status: 'error', reason: error, projectSlugDir }, raw);
    return;
  }

  const targetFiles = limit > 0 ? files.slice(0, limit) : files;

  // For each file: convert → quality check → prepare requests
  const extractionSessions = [];
  const skipped = [];

  for (const fileInfo of targetFiles) {
    const prepared = conversationMiner.prepareConversationForMining(fileInfo.path, fileInfo.sessionId);

    if (!prepared.shouldMine) {
      skipped.push({ sessionId: fileInfo.sessionId, reason: prepared.reason });
      continue;
    }

    extractionSessions.push({
      sessionId: fileInfo.sessionId,
      sessionPath: fileInfo.path,
      mtime: fileInfo.mtime,
      chunkCount: prepared.chunkCount,
      extractionRequests: prepared.extractionRequests
    });
  }

  output({
    status: 'ready',
    filesFound: files.length,
    filesTargeted: targetFiles.length,
    sessionsReady: extractionSessions.length,
    sessionsSkipped: skipped.length,
    sessions: extractionSessions,
    skipped
  }, raw);
}
```

### Conversation Mining Workflow Step Pattern
```markdown
<!-- Source: analyze-pending-sessions.md pattern adapted for conversation mining -->

<step name="mine_conversations">
Discover and mine Claude Code conversations for the current project.

```bash
MINE_JSON=$(node /path/to/gsd-tools.js mine-conversations --max-age-days 30)
```

Parse JSON: extract `sessionsReady` and `sessions` array.

If `sessionsReady === 0`:
  ```
  No conversations ready for mining. All skipped (insufficient content or already analyzed).
  ```

For each session in `sessions`:
  For each `extractionRequest` in `session.extractionRequests`:
    ```
    Task(
      subagent_type="general-purpose",
      model="haiku",
      prompt="{extractionRequest.prompt}"
    )
    ```
  Collect results, store via `store-analysis-result`:
  ```bash
  node /path/to/gsd-tools.js store-analysis-result "{sessionId}" '{resultsJson}'
  ```
</step>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual session review | Automated JSONL mining | Phase 12 | Zero manual effort for conversation knowledge extraction |
| regex-only extraction | LLM semantic extraction via Haiku Task() | Phase 11 | Captures implicit reasoning, not just keywords |
| Session-end only | Historical bulk mining | Phase 12 | Extract from all past conversations on demand |
| Single source (Telegram/docs) | Three sources (Telegram + .planning + conversations) | Phase 12 | Complete knowledge coverage |
| Per-session analysis only | Per-session + cross-session synthesis | Phase 12 + knowledge-synthesis.js | Principles extracted from patterns |

**Not deprecated:**
- Phase 11 infrastructure (session-analyzer.js, analysis-prompts.js, etc.) — all reused by Phase 12
- Three-stage deduplication — protects against re-mining the same conversations

## Open Questions

1. **Subagent mining by default or opt-in?**
   - What we know: Subagent files add 259K tokens across 179 files. They contain detailed plan execution traces.
   - What's unclear: Signal-to-noise ratio in subagent files vs main session files.
   - Recommendation: Opt-in via `--include-subagents` flag. Default to main session files only. Monitor extraction quality before enabling.

2. **Cross-project mining scope**
   - What we know: `~/.claude/projects/` has 4 project slug directories, 217 JSONL files total, 723MB.
   - What's unclear: Should Phase 12 mine only the current project or all projects?
   - Recommendation: Default to current project only. Add `--all-projects` flag as opt-in. Cross-project mining is a stretch goal.

3. **Already-analyzed conversation detection**
   - What we know: `session-quality-gates.js` `isAlreadyAnalyzed()` uses a `.analysis-log.jsonl` file. Content hash prevents re-analysis.
   - What's unclear: Where to store the analysis log for conversation files (different location than Telegram sessions).
   - Recommendation: Store at `.planning/knowledge/.conversation-analysis-log.jsonl`. Reuse `markSessionAnalyzed()` / `isAlreadyAnalyzed()` from Phase 11 with a custom log path parameter, OR accept that the existing log works if session IDs are unique (JSONL UUID filenames are globally unique).

4. **Minimum threshold for conversation quality**
   - What we know: Median conversation has ~3-5 assistant text blocks, 2-3 user messages.
   - What's unclear: Is `botRespCount >= 2` sufficient, or should it be >= 3?
   - Recommendation: Start with `botRespCount >= 2, totalChars >= 500`. Track extraction quality and adjust.

5. **Tool call names as meta-knowledge**
   - What we know: Tool call patterns (e.g., "Bash used 28x, Read 16x, Task 10x in one session") reveal workflow patterns.
   - What's unclear: Should tool usage statistics be extracted as meta-knowledge?
   - Recommendation: Defer to a future enhancement. Phase 12 focuses on text-based extraction using existing prompts.

## Sources

### Primary (HIGH confidence)
- Direct inspection of `~/.claude/projects/-Users-ollorin-get-shit-done/` — verified JSONL structure, entry types, data volume
- `get-shit-done/bin/session-analyzer.js` — verified analyzeSession() API
- `get-shit-done/bin/session-quality-gates.js` — verified shouldAnalyzeSession(), SUBSTANTIVE_TYPES constants
- `get-shit-done/bin/analysis-prompts.js` — verified formatEntriesForPrompt(), RELEVANT_TYPES constants
- `get-shit-done/bin/historical-extract.js` — verified Phase 11 format adapter pattern
- `get-shit-done/bin/knowledge-writer.js` — verified storeInsights(), conversation_id support
- `get-shit-done/bin/knowledge-synthesis.js` — verified synthesizePrinciples() API
- Phase 11 VERIFICATION.md — confirmed 16/16 must-haves, all infrastructure operational
- Phase 11 CONTEXT.md — confirmed locked decisions (Zero API calls, sequential processing)

### Secondary (MEDIUM confidence)
- Python analysis of 64 JSONL files — confirmed 86MB total, ~136K tokens actual text, 64 files for current project
- Python analysis of 179 subagent files — confirmed ~259K tokens actual text in subagents
- gsd-tools.js cmdListPendingSessions pattern — confirmed session discovery approach

### Tertiary (LOW confidence)
- Claude Code project slug format (`/Users/ollorin/get-shit-done` → `-Users-ollorin-get-shit-done`) — observed from directory listing, not from official Claude Code documentation

## Metadata

**Confidence breakdown:**
- Claude Code JSONL format: HIGH — directly inspected 20+ files, ran Python analysis across all 64 files
- Phase 11 infrastructure API: HIGH — read source code of all relevant modules
- Format adapter approach: HIGH — follows same pattern as historical-extract.js, verified compatible types
- Quality gate thresholds: MEDIUM — derived from data analysis, needs validation against real extraction results
- Slug mapping algorithm: LOW — observed pattern, not documented in official sources

**Research date:** 2026-02-17
**Valid until:** 2026-04-17 (60 days — Claude Code JSONL format is stable, Phase 11 infrastructure is fixed)

**Dependencies:**
- Phase 11: session-analyzer.js, analysis-prompts.js, session-quality-gates.js, session-chunker.js, knowledge-writer.js, gsd-tools.js
- Phase 3: Knowledge DB (SQLite + sqlite-vec), knowledge-synthesis.js, knowledge-dedup.js

**What Phase 12 does NOT implement:**
- Changes to session-analyzer.js, analysis-prompts.js, session-quality-gates.js, session-chunker.js, knowledge-writer.js (all Phase 11 — unchanged)
- Changes to historical-extract.js (Phase 11 mines .planning/ docs — unchanged)
- New Haiku prompt templates (existing decision/reasoning/meta_knowledge prompts work)
- New knowledge DB schema (existing schema handles conversation_id already)
