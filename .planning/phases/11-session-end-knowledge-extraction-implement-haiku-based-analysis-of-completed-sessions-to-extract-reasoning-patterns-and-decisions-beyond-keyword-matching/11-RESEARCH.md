# Phase 11: Session-end knowledge extraction - Research

**Researched:** 2026-02-17
**Domain:** LLM-powered session analysis, knowledge extraction, semantic reasoning pattern detection
**Confidence:** MEDIUM-HIGH

## Summary

Phase 11 builds on completed infrastructure (Phase 10.1's session JSONL storage, Phase 4's knowledge system foundations) to implement intelligent session analysis using Claude Haiku 4.5. Unlike Phase 4's regex-based keyword matching ("decided to", "I learned"), this phase leverages Haiku's semantic understanding to extract reasoning patterns, decision context, and higher-order insights from completed Claude Code sessions.

The core innovation: use fast, cost-efficient Haiku ($1 input / $5 output per million tokens) to analyze session transcripts and extract structured knowledge that goes beyond surface-level keywords. Haiku can understand context, identify implicit decisions, trace reasoning chains, and detect patterns that regex cannot capture.

Current session storage (Phase 10.1) provides per-session JSONL files at `.planning/telegram-sessions/<session-id>.jsonl` with metadata, questions, answers, and heartbeat entries. These sessions are perfect input for Haiku analysis at session end or during batch processing.

**Primary recommendation:** Implement session-end hook that triggers Haiku analysis when session closes (explicit or automatic), extracting decisions, reasoning patterns, meta-knowledge, and conversation insights for storage in Phase 3's knowledge system.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | ^0.32.0 | Claude API client | Official Anthropic SDK, already in use (Phase 8) |
| better-sqlite3 | ^11.8.1 | Knowledge storage | Phase 3 foundation, vector + relational |
| @xenova/transformers | ^2.18.0 | Local embeddings | Phase 4 foundation, no API costs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| gray-matter | ^4.0.3 | Parse frontmatter | Extract session metadata from JSONL |
| tiktoken | ^1.0.18 | Token counting | Track Haiku analysis costs |
| zod | ^3.24.1 | Schema validation | Validate Haiku extraction output |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Haiku 4.5 | Sonnet 4.5 | Better quality but 3x cost, slower (defeats purpose) |
| API-based | Local Llama models | Zero API cost but quality/speed issues for analysis |
| Session-end | Batch nightly | Lower overhead but loses real-time context |

**Installation:**
```bash
# Core dependencies already installed in Phase 4, 8
npm install zod tiktoken  # Only if not present
```

## Architecture Patterns

### Recommended Project Structure
```
get-shit-done/bin/
├── session-analyzer.js      # Haiku session analysis orchestrator
├── session-extractor.js     # Pattern extraction logic
├── analysis-prompts.js      # Prompt templates for Haiku
└── knowledge-writer.js      # Write to Phase 3 knowledge DB

mcp-servers/telegram-mcp/src/
├── hooks/
│   └── session-end-hook.ts  # Trigger on session close
└── analysis/
    ├── haiku-analyzer.ts    # Core Haiku API integration
    └── pattern-extractors/  # Domain-specific extractors
        ├── decision-extractor.ts
        ├── reasoning-extractor.ts
        └── meta-knowledge-extractor.ts
```

### Pattern 1: Session-End Hook with Haiku Analysis
**What:** When session closes (explicit or automatic after 24h TTL), trigger Haiku analysis before archiving
**When to use:** Every completed session (opt-out via config if needed)
**Example:**
```typescript
// Source: Phase 10.1 session-manager.ts + new analysis hook
import { closeSession, loadSessionJSONL } from '../storage/session-manager.js';
import { analyzeSessionWithHaiku } from '../analysis/haiku-analyzer.js';
import { storeKnowledge } from '../../../get-shit-done/bin/knowledge.js';

export async function closeSessionWithAnalysis(sessionId: string): Promise<void> {
  // 1. Load session entries
  const entries = await loadSessionJSONL(getSessionPath(sessionId));

  // 2. Run Haiku analysis
  const insights = await analyzeSessionWithHaiku(entries, {
    extractDecisions: true,
    extractReasoning: true,
    extractMetaKnowledge: true
  });

  // 3. Store in knowledge system
  for (const insight of insights) {
    await storeKnowledge({
      type: insight.type,  // 'decision', 'reasoning_pattern', 'meta_knowledge'
      content: insight.content,
      context: insight.context,
      session_id: sessionId,
      ttl: determineTTL(insight.type)
    });
  }

  // 4. Close session normally
  await closeSession(sessionId);
}
```

### Pattern 2: Multi-Pass Haiku Analysis
**What:** Run Haiku multiple times with specialized prompts for different extraction tasks
**When to use:** Complex sessions with rich content (>50 entries, >10 questions)
**Example:**
```typescript
// Source: Research on multi-agent patterns
async function analyzeSessionWithHaiku(
  entries: SessionEntry[],
  options: AnalysisOptions
): Promise<Insight[]> {
  const insights: Insight[] = [];

  // Pass 1: Extract explicit decisions
  if (options.extractDecisions) {
    const decisions = await haikuExtract(entries, DECISION_PROMPT);
    insights.push(...decisions);
  }

  // Pass 2: Extract reasoning patterns (chain-of-thought)
  if (options.extractReasoning) {
    const reasoning = await haikuExtract(entries, REASONING_PROMPT);
    insights.push(...reasoning);
  }

  // Pass 3: Extract meta-knowledge (principles, preferences)
  if (options.extractMetaKnowledge) {
    const meta = await haikuExtract(entries, META_KNOWLEDGE_PROMPT);
    insights.push(...meta);
  }

  return deduplicateInsights(insights);
}
```

### Pattern 3: Structured Output with Zod Schema
**What:** Use Zod schemas to validate Haiku extraction output, ensuring type safety
**When to use:** Always - prevents malformed knowledge entries
**Example:**
```typescript
// Source: Anthropic docs + community patterns
import { z } from 'zod';

const DecisionSchema = z.object({
  type: z.literal('decision'),
  decision: z.string().min(10),
  reasoning: z.string(),
  alternatives_considered: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
  context_snippet: z.string()
});

async function extractDecisions(sessionEntries: SessionEntry[]): Promise<Decision[]> {
  const prompt = buildDecisionExtractionPrompt(sessionEntries);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4.5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  });

  // Parse and validate
  const rawDecisions = JSON.parse(response.content[0].text);
  return z.array(DecisionSchema).parse(rawDecisions);
}
```

### Pattern 4: Token Budget Management
**What:** Monitor Haiku analysis costs, skip/batch if budget exceeded
**When to use:** Production deployments with cost controls
**Example:**
```typescript
// Source: Phase 7 token budget monitoring patterns
import { countTokens } from 'tiktoken';
import { TokenBudgetMonitor } from '../../../get-shit-done/bin/token-budget.js';

async function analyzeSessionWithBudget(
  sessionId: string,
  maxTokens: number = 10000
): Promise<Insight[] | null> {
  const entries = await loadSessionJSONL(getSessionPath(sessionId));
  const sessionText = entriesToText(entries);

  const inputTokens = countTokens(sessionText);
  const estimatedCost = (inputTokens / 1_000_000) * 1.0; // $1 per MTok

  if (TokenBudgetMonitor.wouldExceed(estimatedCost)) {
    console.warn(`[session-analyzer] Skipping ${sessionId}: budget exceeded`);
    return null; // Queue for batch processing later
  }

  return await analyzeSessionWithHaiku(entries);
}
```

### Anti-Patterns to Avoid
- **Re-analyzing same session multiple times:** Use content hash to detect already-analyzed sessions
- **Passing entire session to single Haiku call:** Sessions >30k chars should be chunked (25k segments like Claude Code /insights)
- **No deduplication:** Haiku may extract overlapping insights across passes - deduplicate before storage
- **Ignoring session metadata:** First line (session_metadata type) contains valuable context (PID, label, tasks)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Custom byte estimators | tiktoken library | Anthropic uses tiktoken, ensures accurate cost tracking |
| Prompt templates | String concatenation | Structured prompt builders | Maintainability, testability, version control |
| Schema validation | Manual JSON checks | Zod schemas | Type safety, runtime validation, auto-generated types |
| Session chunking | Custom text splitters | Proven 25k-char segments | Phase 9 research, Claude Code /insights uses this |
| Deduplication | Custom similarity | Phase 4 three-stage dedup | Content hash → canonical hash → embedding (0.88 threshold) |

**Key insight:** Haiku analysis quality depends heavily on prompt engineering. Don't hand-roll prompts - use structured templates with clear output schemas, examples, and constraints. Test prompts on representative sessions before production deployment.

## Common Pitfalls

### Pitfall 1: Analysis Runs on Every Session Close
**What goes wrong:** Small sessions (3-5 entries, test sessions) trigger expensive Haiku calls unnecessarily
**Why it happens:** No filtering logic between session close and analysis trigger
**How to avoid:** Implement session quality gates:
```typescript
function shouldAnalyzeSession(entries: SessionEntry[]): boolean {
  const questionCount = entries.filter(e => e.type === 'question').length;
  const answerCount = entries.filter(e => e.type === 'answer').length;
  const totalEntries = entries.length;

  // Only analyze sessions with meaningful interaction
  return questionCount >= 2 && answerCount >= 2 && totalEntries >= 10;
}
```
**Warning signs:** High Haiku API costs for minimal knowledge gain, many empty extraction results

### Pitfall 2: Haiku Hallucinates Decisions Not Present
**What goes wrong:** Haiku invents decisions or reasoning patterns that don't exist in session
**Why it happens:** Prompt doesn't constrain output to explicit evidence, no grounding mechanism
**How to avoid:**
1. Require context snippets in extraction schema (forces Haiku to cite source)
2. Add validation prompt: "Only extract if explicitly stated in conversation"
3. Use LOW confidence for inferred patterns vs HIGH for explicit statements
**Warning signs:** Extracted knowledge contradicts user actions, "decisions" user doesn't recognize

### Pitfall 3: Session Context Lost in Chunking
**What goes wrong:** Large sessions split into chunks, Haiku analyzes chunks independently, loses cross-chunk reasoning chains
**Why it happens:** Naive chunking at arbitrary boundaries without context preservation
**How to avoid:** Use overlapping chunk windows or two-stage analysis:
```typescript
// Stage 1: Chunk-level extraction
const chunkInsights = chunks.map(chunk => haikuExtract(chunk));

// Stage 2: Cross-chunk synthesis
const synthesized = await haikuSynthesize(chunkInsights, fullSessionMetadata);
```
**Warning signs:** Fragmented reasoning patterns, duplicate extractions with different contexts

### Pitfall 4: No Incremental Processing for Long-Running Sessions
**What goes wrong:** 24-hour sessions with hundreds of entries only analyzed at end, loses recency
**Why it happens:** Analysis only triggered on session close
**How to avoid:** Implement incremental analysis at heartbeat intervals:
```typescript
// Every 50 entries or 1 hour, run incremental analysis on new entries
async function updateHeartbeat(sessionId: string): Promise<void> {
  const entries = await loadSessionJSONL(getSessionPath(sessionId));
  const lastAnalyzedIndex = getLastAnalyzedIndex(sessionId);

  if (entries.length - lastAnalyzedIndex >= 50) {
    const newEntries = entries.slice(lastAnalyzedIndex);
    const insights = await analyzeSessionWithHaiku(newEntries);
    await storeKnowledge(insights);
    setLastAnalyzedIndex(sessionId, entries.length);
  }

  // Continue normal heartbeat
  await appendToSession(sessionId, { type: 'heartbeat', timestamp: new Date().toISOString() });
}
```
**Warning signs:** Session-end analysis takes >30s, users report "forgot earlier decisions"

## Code Examples

Verified patterns from official sources and research:

### Extract Decisions with Context Grounding
```typescript
// Source: Anthropic prompt engineering best practices + research
const DECISION_EXTRACTION_PROMPT = `Analyze this Claude Code session and extract ALL decisions made.

Session transcript:
{{SESSION_ENTRIES}}

For each decision, provide:
1. What was decided
2. Why it was decided (reasoning)
3. Alternatives that were considered
4. Confidence level (high/medium/low based on explicitness)
5. Exact context snippet (quote from session proving decision exists)

Output as JSON array:
[
  {
    "type": "decision",
    "decision": "Use Haiku for session analysis instead of Sonnet",
    "reasoning": "Cost efficiency (3x cheaper) and speed (2x faster) while maintaining quality for extraction tasks",
    "alternatives_considered": ["Sonnet 4.5", "Local Llama models"],
    "confidence": "high",
    "context_snippet": "User: Should we use Haiku or Sonnet? Assistant: Haiku is better here - 3x cheaper..."
  }
]

CRITICAL: Only extract decisions explicitly stated in transcript. If uncertain, set confidence to "low".`;

async function extractDecisions(entries: SessionEntry[]): Promise<Decision[]> {
  const sessionText = formatEntriesForPrompt(entries);
  const prompt = DECISION_EXTRACTION_PROMPT.replace('{{SESSION_ENTRIES}}', sessionText);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4.5',
    max_tokens: 2000,
    temperature: 0.3, // Lower temp for extraction (vs generation)
    messages: [{ role: 'user', content: prompt }]
  });

  const decisions = JSON.parse(response.content[0].text);
  return z.array(DecisionSchema).parse(decisions);
}
```

### Extract Reasoning Patterns (Chain-of-Thought)
```typescript
// Source: LLM reasoning research + Anthropic internal reasoning patterns
const REASONING_PATTERN_PROMPT = `Analyze this Claude Code session and identify REASONING PATTERNS.

Session transcript:
{{SESSION_ENTRIES}}

Look for:
- Multi-step reasoning chains (A → B → C → conclusion)
- Problem-solving approaches (debugging, investigation, root cause analysis)
- Decision-making frameworks (pros/cons, criteria evaluation, tradeoff analysis)
- Meta-reasoning (reflection on approach, strategy changes)

For each pattern, extract:
1. Pattern type (chain-of-thought, debugging, tradeoff-analysis, etc.)
2. Description of the reasoning process
3. Trigger condition (what prompted this reasoning)
4. Outcome/conclusion
5. Reusability (can this pattern apply to future problems?)

Output as JSON array:
[
  {
    "type": "reasoning_pattern",
    "pattern_type": "chain-of-thought",
    "description": "Session analysis cost calculation: counted tokens → estimated API cost → compared budget → decided on chunking strategy",
    "trigger": "Budget constraint concern",
    "outcome": "Adopted 25k-char chunking with overlap to stay under budget",
    "reusable": true,
    "context_snippet": "..."
  }
]`;
```

### Extract Meta-Knowledge (Principles, Preferences)
```typescript
// Source: Phase 4 knowledge system + synthesis patterns
const META_KNOWLEDGE_PROMPT = `Analyze this Claude Code session and extract META-KNOWLEDGE.

Meta-knowledge = higher-order insights beyond specific decisions:
- User preferences (coding style, architecture choices, tool preferences)
- Working principles (how user approaches problems)
- Constraints (budget limits, time pressure, quality bars)
- Learning patterns (what user needed clarification on, repeated questions)

Session transcript:
{{SESSION_ENTRIES}}

For each meta-knowledge item:
1. Category (preference, principle, constraint, learning_pattern)
2. Knowledge statement (generalized insight)
3. Evidence (which decisions/conversations support this)
4. Confidence (high/medium/low based on repetition and explicitness)
5. Scope (project-specific or global preference)

Output as JSON array:
[
  {
    "type": "meta_knowledge",
    "category": "preference",
    "statement": "User prefers TypeScript over JavaScript for new modules",
    "evidence": ["3 instances of choosing TS", "explicit statement about type safety"],
    "confidence": "high",
    "scope": "global",
    "context_snippet": "..."
  }
]`;
```

### Session Entry Formatting for Haiku
```typescript
// Source: Phase 10.1 session structure + research
function formatEntriesForPrompt(entries: SessionEntry[]): string {
  // Skip session_metadata (first line), heartbeats, system events
  const relevantEntries = entries.filter(e =>
    ['question', 'answer', 'bot_response', 'user_message'].includes(e.type)
  );

  return relevantEntries.map((entry, idx) => {
    const timestamp = new Date(entry.timestamp).toISOString();

    switch (entry.type) {
      case 'question':
        return `[${idx}] [${timestamp}] QUESTION: ${entry.question}${entry.context ? `\nContext: ${entry.context}` : ''}`;

      case 'answer':
        return `[${idx}] [${timestamp}] ANSWER: ${entry.answer}`;

      case 'user_message':
        return `[${idx}] [${timestamp}] USER: ${entry.content}`;

      case 'bot_response':
        return `[${idx}] [${timestamp}] ASSISTANT: ${entry.content}`;

      default:
        return '';
    }
  }).filter(Boolean).join('\n\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Regex keyword matching | LLM semantic analysis | 2025-2026 | Captures implicit decisions, context, reasoning chains |
| Full-session single pass | Chunked multi-pass extraction | 2024-2025 | Handles long sessions, specializes extraction |
| Store raw conversations | Store extracted insights | Phase 4 design | Knowledge DB scalability, searchability |
| Sonnet for all analysis | Haiku for extraction + Sonnet for synthesis | Haiku 4.5 release | 3x cost reduction, 2x speed improvement |
| Manual session review | Automatic session-end analysis | Phase 11 | Zero manual effort, consistent extraction |

**Deprecated/outdated:**
- **Regex-only extraction:** Phase 4 foundation but insufficient for reasoning patterns
- **Storing full session transcripts in knowledge DB:** Too large, use session archives + extracted insights instead
- **Synchronous session-end analysis:** Blocks session close, use async queue instead

## Open Questions

1. **Optimal chunking strategy for sessions >30k chars**
   - What we know: Claude Code /insights uses 25k-char chunks, works well
   - What's unclear: Should we use overlapping windows? Semantic boundary detection?
   - Recommendation: Start with 25k non-overlapping, measure extraction quality, iterate if needed

2. **Incremental vs session-end analysis tradeoff**
   - What we know: Session-end captures full context, incremental reduces latency
   - What's unclear: Cost/benefit analysis for different session patterns
   - Recommendation: Implement both, make configurable, track metrics to inform default

3. **Cross-session synthesis timing**
   - What we know: Synthesis extracts patterns across multiple sessions (Phase 4 design)
   - What's unclear: Should Phase 11 implement synthesis or defer to future phase?
   - Recommendation: Implement basic session-level analysis first, defer cross-session synthesis to Phase 12 (Historical Conversation Mining)

4. **Haiku prompt optimization needs**
   - What we know: Prompt quality drives extraction quality
   - What's unclear: How much prompt engineering needed before production?
   - Recommendation: Build prompt evaluation framework, test on 10-20 real sessions, iterate until 80%+ accuracy

5. **Deduplication with Phase 4 three-stage approach**
   - What we know: Phase 4 has content hash → canonical hash → embedding similarity (0.88 threshold)
   - What's unclear: Does Haiku-extracted knowledge fit this dedup model or need custom approach?
   - Recommendation: Use Phase 4 dedup infrastructure, monitor for Haiku-specific edge cases

## Sources

### Primary (HIGH confidence)
- Anthropic Claude Haiku 4.5 official docs - pricing, capabilities, use cases
- Phase 10.1 session-manager.ts - session JSONL structure, metadata schema
- Phase 8 telegram-haiku-monitor.js - existing Haiku integration patterns
- Phase 4 embeddings.js - local embedding generation, deduplication approach

### Secondary (MEDIUM confidence)
- [Deep Dive: How Claude Code's /insights Command Works](https://www.zolkos.com/2026/02/04/deep-dive-how-claude-codes-insights-command-works.html) - session chunking strategy (25k chars)
- [Claude Haiku 4.5 Deep Dive: Cost, Capabilities, and the Multi-Agent Opportunity](https://caylent.com/blog/claude-haiku-4-5-deep-dive-cost-capabilities-and-the-multi-agent-opportunity) - pricing ($1 input / $5 output), multi-agent patterns
- [Temporal Patterns: Durable AI Agents with Multi-Model Scatter/Gather](https://james-carr.org/posts/2026-02-05-temporal-durable-ai-agents/) - parallel Haiku instances for analysis
- [Applications of Large Language Model Reasoning](https://www.arxiv.org/pdf/2503.11989) - chain-of-thought extraction patterns

### Tertiary (LOW confidence)
- [A Modular LLM Approach to Argument Extraction](https://scholarworks.gvsu.edu/theses/1170/) - multi-agent extraction with task-specific models
- Web search: LLM reasoning patterns, semantic analysis techniques - general background, needs verification

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM-HIGH - Haiku 4.5 proven for extraction, tiktoken standard, Zod widely used
- Architecture: MEDIUM - Patterns based on Phase 8 Haiku integration + research, needs validation on real sessions
- Pitfalls: MEDIUM - Derived from research + logical analysis, not battle-tested in GSD context

**Research date:** 2026-02-17
**Valid until:** 2026-04-17 (60 days - LLM space moves fast but extraction patterns relatively stable)

**Dependencies:**
- Phase 3: Knowledge system (SQLite + sqlite-vec storage)
- Phase 4: Embeddings (local generation), deduplication infrastructure
- Phase 10.1: Session JSONL storage, session lifecycle management

**Next steps for planning:**
- Define session quality gates (when to analyze vs skip)
- Design Haiku prompt templates (decision, reasoning, meta-knowledge extraction)
- Specify integration points with Phase 3 knowledge storage
- Define cost budget and monitoring (Phase 7 token budget integration)
- Create session-end hook architecture (async queue vs blocking)
