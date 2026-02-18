# Phase 11: Context & Decisions

**Captured:** 2026-02-17
**Source:** User requirements during initial planning review

## User Decisions (LOCKED)

These decisions are final. Plans must implement exactly as specified.

### 1. Zero API Calls - Subscription Only
- **Decision:** ALL Haiku analysis via Claude Code Task tool with subscription. ZERO direct API calls.
- **Rationale:** User has Claude Code subscription - use that for everything
- **Implementation:** All Haiku analysis via `Task(subagent_type="general-purpose", model="haiku", ...)`
- **Absolutely NO:** `@anthropic-ai/sdk`, `anthropic.messages.create()`, or any direct API usage
- **Batch operations:** If historical extraction needs 100 analyses, create task queue and process via Task() sequentially
- **Do NOT optimize for speed by using API** - subscription-only is the hard requirement

### 2. Conversation Grouping (Multi-Message Support)
- **Problem:** User might send multiple messages/voice recordings for one question. Haiku might ask follow-up questions.
- **Decision:** Add `conversation_id` field to track related messages
- **Flow:**
  1. When conversation starts, generate UUID as conversation_id
  2. All questions/answers/messages in that conversation share the same conversation_id
  3. When conversation ends (user types "done" or timeout), collect all messages with that conversation_id
  4. Sort messages chronologically
  5. Spawn Haiku subagent to analyze the FULL conversation (not individual messages)
- **Storage:** conversation_id must be in question-queue entries and session JSONL

### 3. Voice Message Processing
- **Decision:** Voice messages must be automatically transcribed and logged as TEXT
- **Flow:**
  1. Telegram bot receives voice message
  2. Haiku chat agent OR MCP automation detects voice message
  3. Spawn subagent or use Task() to run Whisper speech-to-text
  4. Text version sent to Haiku as response
  5. Session log records TEXT of answer (not just "voice message received")
- **Note:** Whisper already installed (Phase 10), just need to integrate with conversation flow

### 4. Historical Data Mining
- **Decision:** Provide command to extract knowledge from existing GSD projects
- **Use case:** User has existing projects with completed phases/milestones. After updating GSD, run command to backfill knowledge database.
- **Command:** `gsd-tools.js historical-extract <path/to/project/.planning>`
- **What it does:**
  1. Reads ROADMAP.md, STATE.md, plan files, VERIFICATION.md from target project
  2. For each completed phase, spawn Haiku subagent to analyze
  3. Extract: decisions made, patterns learned, principles discovered, reasoning chains
  4. Populate knowledge database with extracted meta-knowledge
  5. Use conversation_id concept: treat each phase as one "conversation"

### 5. Database Initialization
- **Decision:** Knowledge database creation happens at:
  - **Installation time** (Phase 10 install script should create it), OR
  - **Milestone/project creation** (/gsd:new-project or /gsd:new-milestone)
- **Path:** `.planning/knowledge/<username>.db` (project-scoped)
- **Auto-create:** If database doesn't exist on first use, create it automatically
- **No manual setup required**

### 6. Analysis Timing
- **Decision:** Analysis happens BEFORE conversation close (not after)
- **Flow:**
  1. User indicates conversation is done (types "done", timeout, or explicit signal)
  2. BEFORE closing conversation, spawn Haiku subagent to analyze
  3. Haiku extracts knowledge and stores in database
  4. THEN mark conversation as closed
- **Why:** Ensures knowledge is captured even if session crashes/terminates unexpectedly

## Claude's Discretion

Areas where Claude can make implementation choices:

### Conversation End Detection
- How to detect "conversation is done"? (user types "done", timeout after N minutes, explicit button?)
- Recommendation: Support multiple signals (explicit "done" command, 10-minute timeout, /end command)

### Haiku Prompt Structure
- Exact prompts for extraction (decisions, reasoning, meta-knowledge)
- Use research findings but adapt as needed for Task() subagent format

### Historical Extraction Batching
- How many phases to process in parallel? (to avoid overwhelming system)
- Recommendation: 3 parallel Haiku subagents, sequential for phases within each project

### Database Schema Extensions
- conversation_id field addition to existing Phase 3 schema
- Any indexes needed for conversation-based queries

## Deferred Ideas (Out of Scope)

None yet - all requirements are in scope for Phase 11.

## Open Questions

1. **Conversation timeout:** How long should we wait for next message before auto-closing conversation? (Recommend: 10 minutes)
2. **Voice message format:** Store both audio file reference AND transcribed text, or just text? (Recommend: just text to save space)
3. **Historical extraction scope:** Analyze only completed phases, or also incomplete phases with partial work? (Recommend: completed only)
4. **Database migration:** If Phase 3 database already exists in some projects, how to add conversation_id field? (Recommend: ALTER TABLE with default NULL for existing entries)

## Success Criteria

Phase 11 is successful when:
1. User sends multi-message conversation via Telegram → Haiku analyzes full context → knowledge stored
2. User sends voice message → automatically transcribed → Haiku sees text → knowledge stored
3. User runs `historical-extract` on old project → meta-knowledge extracted → database populated
4. Database auto-initializes on first use (installation or new project)
5. Zero extra API costs - all Haiku work via Claude Code subscription
