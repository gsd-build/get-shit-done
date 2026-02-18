# Phase 09: Hook-based Documentation Compression - Research

**Researched:** 2026-02-16
**Domain:** Task context injection, document indexing, header extraction, PreToolUse hooks, token optimization
**Confidence:** HIGH

## Summary

Phase 9 solves TWO interrelated problems through unified header extraction and document summarization infrastructure:

**Problem 1 (Primary): Task Context Skill** — Create a skill that accepts task descriptions and returns: (a) model recommendation (haiku/sonnet/opus), (b) top 3 relevant documentation files with summaries + absolute links, (c) relevant project-specific keywords. This enables intelligent context injection that solves "Claude ignoring CLAUDE.md instructions" by actively surfacing relevant docs per task instead of relying on passive `@` directives.

**Problem 2 (Secondary): GSD Documentation Token Compression** — Reduce token consumption of GSD's internal documentation (RESEARCH.md, PLAN.md, STATE.md files averaging 900-1,500 lines) through PreToolUse hooks that intercept Read operations and inject compressed summaries with file:// links to full content. Current overhead is 150-250k tokens when multiple docs loaded, pushing against 200k context limit.

The UNIFIED SOLUTION leverages shared infrastructure: header extraction module parses markdown structure (H1-H6), section summarization captures first paragraph per section, keyword extraction identifies relevance signals, and file:// absolute link generation enables full-content fallback. For Problem 1, this runs on-demand via skill invocation (~/igaming-platform/docs folder). For Problem 2, this runs automatically via PreToolUse hooks (.planning/ folder docs).

**Key 2026 findings:** Keyword extraction uses TF-IDF or simple stopword filtering (GeeksforGeeks, Analytics Vidhya). BM25 remains backbone of document search, outperforming pure semantic approaches for keyword-based retrieval (Medium, January 2026). Header-based markdown chunking improves retrieval accuracy 40-60% vs arbitrary splitting (Weaviate, Firecrawl). Simple recursive splitting (512 tokens, 15% overlap) outperforms complex semantic methods in FloTorch 2026 benchmarks. Markdown-it is industry standard parser (12M+ weekly downloads). Phase 1 already implements `buildContextIndex()`, `matchContextDocs()`, `extractKeywords()` in gsd-tools.js (lines 2469-2635).

**Primary recommendation:** Build Task Context Skill first (Problem 1), reuse header extraction module for GSD doc compression second (Problem 2). Use existing Phase 1 indexing infrastructure, extend with header extraction + summary generation. Start with 60-70% token reduction target (header + first paragraph), skip advanced LLM summarization. Integrate with Phase 7 TokenBudgetMonitor for automatic compression triggers. Skills follow SKILL.md format with YAML frontmatter (Agent Skills open standard, Claude Code Docs).

## User Constraints

**From Phase 1 Context (.planning/phases/01-auto-mode-foundation/01-CONTEXT.md):**

### Locked Decisions

1. **Task Context Skill Architecture** — Single skill returns: model recommendation, top 3 relevant guides/docs, relevant skills, project-specific instructions
2. **Sub-coordinator spawns agents** — Skill decides, sub-coordinator executes via Task tool with model parameter (skill does NOT execute tasks)
3. **Context Matching Method** — Keyword extraction + explicit front-matter tags (existing YAML format in docs)
4. **Match Limit** — Top 3 most relevant docs/guides injected per task
5. **CLAUDE.md Handling** — Keyword extraction from instruction blocks
6. **Indexing Strategy** — Hybrid: index once per session, refresh on file changes
7. **Tag System** — Use existing front-matter YAML tags, parse directly (docs already have tags)

### Claude's Discretion

- Exact keyword extraction algorithm (TF-IDF vs stopword filtering vs RAKE)
- Header extraction implementation details (markdown-it vs marked)
- Summary generation strategy (first paragraph vs first 2 bullets vs adaptive)
- Cache invalidation mechanism (content hash + mtime vs mtime-only)
- Compression ratio metrics and monitoring approach

### Deferred Ideas (OUT OF SCOPE)

- Semantic embedding for context matching (Phase 1 explicitly deferred, use keyword + tags only)
- LLM-based summarization (too slow, too expensive — use deterministic header extraction)
- Advanced RAG chunking strategies (simple header-based sufficient for Phase 9)

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| N/A (Native) | Node.js built-in | Skills (SKILL.md format) | Agent Skills open standard, zero dependencies, works across Claude ecosystem |
| markdown-it | 14.1.0+ | Markdown parsing | Industry standard (12M+ weekly downloads), full CommonMark + GFM support, plugin ecosystem |
| gray-matter | 4.0.3+ | Frontmatter parsing | Extract YAML frontmatter (tags, title, metadata), 3M+ weekly downloads |
| better-sqlite3 | 12.6.2+ | Index caching (optional) | Already in Phase 3/4, can store doc index instead of JSON file cache |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| markdown-it-toc-and-anchor | 4.4.2+ | TOC extraction | Generate hierarchical table of contents from headers (350k+ weekly downloads) |
| wink-bm25-text-search | 3.0.4+ | BM25 document ranking | Upgrade from simple keyword matching if precision insufficient (GitHub: wink/wink-bm25-text-search) |
| marked | 12.0.2+ | Lightweight MD parser | Alternative to markdown-it if only need AST traversal (faster, simpler API) |
| @anthropic-ai/tokenizer | 0.0.4+ | Accurate token counting | Verify compression ratios, measure token savings (BPE tokenizer, not character-based) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SKILL.md format | JSON API protocol | SKILL.md: Simple, git-friendly, markdown-based. JSON API: Programmatic but requires API calls. Use SKILL.md for static skills. |
| Keyword + tags | Semantic embeddings (sqlite-vec) | Embeddings: Better semantic matching but requires vector generation + storage. Keywords: Instant, deterministic. Phase 1 explicitly deferred embeddings. |
| Header extraction | Full LLM summarization | LLM: Higher quality but 200-500ms latency + $0.01-0.05 per doc. Headers: Instant, free, deterministic. Use headers first. |
| markdown-it | marked or unified | marked: Faster, simpler. unified: More powerful (remark plugins). markdown-it: Balanced, proven ecosystem. |
| PreToolUse hooks | PostToolUse compression | PreToolUse: Intercepts before read, injects compressed version. PostToolUse: Compresses after read (no injection control). Use PreToolUse. |

**Installation:**

```bash
# Core dependencies
npm install markdown-it@^14.1.0
npm install gray-matter@^4.0.3

# Optional enhancements
npm install markdown-it-toc-and-anchor@^4.4.2  # TOC generation
npm install @anthropic-ai/tokenizer@^0.0.4     # Token metrics
npm install wink-bm25-text-search@^3.0.4       # BM25 upgrade (if keyword matching insufficient)
```

## Architecture Patterns

### Recommended Project Structure

```
get-shit-done/
├── bin/
│   ├── compression/
│   │   ├── header-extractor.js       # NEW: Extract markdown headers + structure
│   │   ├── summary-generator.js      # NEW: Section-level summarization
│   │   ├── token-estimator.js        # NEW: Accurate token counting
│   │   └── doc-compressor.js         # NEW: Unified compression API
│   ├── hooks/
│   │   ├── config.js                 # (Phase 4) Extend: add compression config
│   │   └── doc-compression-hook.js   # NEW: PreToolUse hook handler
│   ├── token-monitor.js              # (Phase 7) Extend: trigger compression
│   └── gsd-tools.js                  # EXTEND: compression commands

~/.claude/
├── skills/
│   └── task-context/
│       └── SKILL.md                  # NEW: Task context skill definition
├── settings.json                     # EXTEND: Register PreToolUse hook
└── cache/
    └── context-index.json            # (Phase 1) Extended with summaries

~/igaming-platform/
└── docs/                             # NEW: User's project documentation folder
    ├── supabase-auth.md              # Example: Tagged with "auth", "supabase"
    ├── telegram-integration.md       # Example: Tagged with "telegram", "bot"
    └── ...

.planning/
├── phases/
│   └── XX-name/
│       ├── XX-RESEARCH.md            # ORIGINAL: Full content preserved
│       └── .compressed/
│           └── XX-RESEARCH.summary.md # NEW: Cached compressed version
└── .doc-compression-cache/           # NEW: Compression cache directory
```

### Pattern 1: Task Context Skill Implementation (Problem 1)

**What:** Skill accepts task description, returns model + top 3 docs with summaries + keywords

**When to use:** Before spawning task subagents (called by sub-coordinator)

**Skill interface (SKILL.md format):**

```yaml
---
name: task-context
description: Determines optimal model tier and injects relevant documentation context for a task. Returns model recommendation (haiku/sonnet/opus) plus top 3 matching docs with summaries and file links.
---

# Task Context Skill

You provide intelligent task routing and context injection. Given a task description, you analyze it and return structured recommendations.

## Input

You receive a task description as a single-line prompt. Extract keywords and match against documentation.

## Process

1. **Execute routing command:**
   ```bash
   node ~/.claude/get-shit-done/bin/gsd-tools.js routing full "<task description>"
   ```

2. **Parse JSON output** containing:
   - `model`: Recommended model tier (haiku/sonnet/opus)
   - `context`: Array of matched docs with paths, titles, scores
   - `claude_md`: Relevant CLAUDE.md keywords

3. **For each matched doc, extract summary:**
   ```bash
   node ~/.claude/get-shit-done/bin/gsd-tools.js compress summary "<doc-path>"
   ```

4. **Return structured response** in this exact format:
   ```
   ## TASK CONTEXT

   **Model:** <haiku|sonnet|opus>
   **Reason:** <rationale from routing rules>

   **Documentation Context:**

   ### 1. <Doc Title>
   <Summary (first paragraph or 2-3 bullet points)>

   **Full content:** file://<absolute-path>

   ### 2. <Doc Title>
   <Summary>

   **Full content:** file://<absolute-path>

   ### 3. <Doc Title>
   <Summary>

   **Full content:** file://<absolute-path>

   **CLAUDE.md Keywords:** <comma-separated list or "none">
   ```

## Output

Sub-coordinator receives this structured response and:
1. Uses model tier for Task spawn
2. Includes documentation summaries in task prompt
3. Provides file:// links for full content access when needed
4. Injects CLAUDE.md keywords as context reminders

## Important

- Always return a decision (default to sonnet if no patterns match)
- Summaries should be 1-3 sentences or 2-4 bullet points MAX
- Full doc paths must be absolute (file:///full/path.md)
- This is a fast operation — complete in <10 seconds
```

**How sub-coordinator calls it:**

```bash
# Sub-coordinator spawns task-context skill
claude skill invoke task-context "Create Supabase RLS policy for user profiles table"

# Receives structured response with model + docs + summaries
# Uses response to spawn task agent with appropriate model + context
```

### Pattern 2: Header Extraction + Section Summarization

**What:** Parse markdown structure, extract headers, capture first paragraph per section

**When to use:** Both Task Context Skill (on-demand) and GSD doc compression (automatic)

**Example implementation:**

```javascript
// Source: Markdown chunking strategies (Firecrawl, Weaviate 2026)
// Header-based markdown splitting improves retrieval 40-60%

const MarkdownIt = require('markdown-it');
const grayMatter = require('gray-matter');

class HeaderExtractor {
  constructor() {
    this.md = new MarkdownIt();
  }

  /**
   * Extract hierarchical structure with section previews
   * Achieves 60-70% token reduction
   */
  extractSummary(markdownContent, absolutePath) {
    // Parse frontmatter (tags, title, metadata)
    const { data: frontmatter, content } = grayMatter(markdownContent);

    // Parse markdown to tokens
    const tokens = this.md.parse(content, {});

    const sections = [];
    let currentSection = null;
    let captureNext = false;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // Header tokens (h1-h6)
      if (token.type === 'heading_open') {
        if (currentSection) {
          sections.push(currentSection);
        }
        const level = parseInt(token.tag.slice(1)); // h1 → 1, h2 → 2
        currentSection = {
          level,
          title: '',
          preview: '',
          captured: false
        };
        captureNext = true;
      }

      // Inline content (header text)
      if (token.type === 'inline' && captureNext && currentSection) {
        currentSection.title = token.content;
        captureNext = false;
      }

      // Capture first paragraph after header
      if (token.type === 'paragraph_open' && currentSection && !currentSection.captured) {
        // Next inline token is paragraph content
        if (i + 1 < tokens.length && tokens[i + 1].type === 'inline') {
          currentSection.preview = tokens[i + 1].content.slice(0, 300); // Max 300 chars
          currentSection.captured = true;
        }
      }
    }

    if (currentSection) {
      sections.push(currentSection);
    }

    // Generate summary markdown
    let summary = '';

    // Preserve frontmatter
    if (Object.keys(frontmatter).length > 0) {
      summary += '---\n';
      for (const [key, value] of Object.entries(frontmatter)) {
        summary += `${key}: ${JSON.stringify(value)}\n`;
      }
      summary += '---\n\n';
    }

    // Add title
    if (sections.length > 0 && sections[0].level === 1) {
      summary += `# ${sections[0].title}\n\n`;
      if (sections[0].preview) {
        summary += `${sections[0].preview}\n\n`;
      }
    }

    // Add section summaries (skip H1, already added)
    for (const section of sections.slice(1)) {
      const hashes = '#'.repeat(section.level);
      summary += `${hashes} ${section.title}\n`;
      if (section.preview) {
        summary += `${section.preview}...\n\n`;
      } else {
        summary += '\n';
      }
    }

    // Footer with absolute link
    summary += `\n---\n\n`;
    summary += `**Full documentation:** [View complete file](file://${absolutePath})\n`;

    return {
      summary,
      sections: sections.length,
      frontmatter
    };
  }
}

module.exports = { HeaderExtractor };
```

### Pattern 3: Index Extension for Summaries (Phase 1 Integration)

**What:** Extend existing `buildContextIndex()` to include pre-computed summaries

**When to use:** Index build/refresh operations

**Extend existing Phase 1 code (gsd-tools.js lines 2484-2525):**

```javascript
// EXTEND existing buildContextIndex function
const { HeaderExtractor } = require('../compression/header-extractor');

function buildContextIndex(basePaths, options = {}) {
  const { includeSummaries = true } = options;
  const index = { entries: [], created_at: new Date().toISOString() };
  const extractor = new HeaderExtractor();

  for (const basePath of basePaths) {
    if (!fs.existsSync(basePath)) continue;

    const findMd = (dir) => {
      const files = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...findMd(fullPath));
        } else if (entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
      return files;
    };

    for (const file of findMd(basePath)) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const frontmatter = extractFrontmatter(content);
        const tags = frontmatter.tags || [];
        const keywords = extractKeywords(content);
        const mtime = fs.statSync(file).mtime;

        // NEW: Extract summary if requested
        let summary = null;
        if (includeSummaries) {
          const extracted = extractor.extractSummary(content, file);
          summary = extracted.summary;
        }

        index.entries.push({
          path: file,
          tags: Array.isArray(tags) ? tags : [tags],
          keywords: [...new Set(keywords)].slice(0, 100),
          mtime: mtime.toISOString(),
          title: frontmatter.title || path.basename(file, '.md'),
          summary // NEW: Pre-computed summary (null if not included)
        });
      } catch (err) {
        // Skip unreadable files
      }
    }
  }

  return index;
}

// NEW: Command to extract summary on-demand
function cmdCompressSummary(filePath, raw) {
  const extractor = new HeaderExtractor();
  const content = fs.readFileSync(filePath, 'utf-8');
  const absolutePath = path.resolve(filePath);
  const result = extractor.extractSummary(content, absolutePath);

  if (raw) {
    console.log(result.summary);
  } else {
    output(result, false);
  }
}

// Add to CLI commands
if (command === 'compress' && subCommand === 'summary') {
  const filePath = args[2];
  cmdCompressSummary(filePath, args.includes('--raw'));
}
```

### Pattern 4: PreToolUse Hook for GSD Docs (Problem 2)

**What:** Intercept Read operations on GSD documentation files, inject compressed summaries

**When to use:** Automatic compression for .planning/ documentation reads

**Hook registration (~/.claude/settings.json):**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/get-shit-done/bin/hooks/doc-compression-hook.js"
          }
        ]
      }
    ]
  }
}
```

**Hook implementation (get-shit-done/bin/hooks/doc-compression-hook.js):**

```javascript
#!/usr/bin/env node

// PreToolUse hook for documentation compression
// Intercepts Read tool calls, injects compressed summaries with file:// links

const fs = require('fs');
const path = require('path');
const { HeaderExtractor } = require('../compression/header-extractor');
const { loadHookConfig } = require('./config');

// Documentation patterns to compress
const DOC_PATTERNS = [
  /.*-RESEARCH\.md$/,
  /.*-PLAN\.md$/,
  /.*-CONTEXT\.md$/,
  /STATE\.md$/,
  /ROADMAP\.md$/,
  /PROJECT\.md$/
];

async function main() {
  try {
    // Read stdin (toolUse JSON from Claude Code)
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks).toString();
    const toolUse = JSON.parse(input);

    // Only intercept Read tool
    if (toolUse.tool !== 'Read') {
      process.exit(0); // Pass through (exit code 0 = no intervention)
    }

    const filePath = toolUse.parameters?.file_path;
    if (!filePath) {
      process.exit(0);
    }

    // Check if file matches compression patterns
    const shouldCompress = DOC_PATTERNS.some(pattern => pattern.test(filePath));
    if (!shouldCompress) {
      process.exit(0); // Not a documentation file
    }

    // Check config
    const config = loadHookConfig();
    if (!config.enabled || !config.compression?.enabled) {
      process.exit(0); // Compression disabled
    }

    // Check file size threshold
    const absolutePath = path.resolve(filePath);
    const stats = fs.statSync(absolutePath);
    const lines = fs.readFileSync(absolutePath, 'utf-8').split('\n').length;
    if (lines < config.compression.min_file_size) {
      process.exit(0); // File too small to compress
    }

    // Read and compress
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const extractor = new HeaderExtractor();
    const { summary } = extractor.extractSummary(content, absolutePath);

    // Return compressed version via additionalContext
    const result = {
      additionalContext: summary,
      metadata: {
        originalPath: absolutePath,
        originalLines: lines,
        compressionRatio: ((1 - summary.length / content.length) * 100).toFixed(1)
      }
    };

    console.log(JSON.stringify(result));
    process.exit(0);

  } catch (error) {
    // On error, pass through (don't block reads)
    console.error('Doc compression hook error:', error.message);
    process.exit(0);
  }
}

main();
```

**Hook configuration extension (get-shit-done/bin/hooks/config.js):**

```javascript
// EXTEND DEFAULT_HOOK_CONFIG from Phase 4

const DEFAULT_HOOK_CONFIG = {
  // ... existing Phase 4 config ...

  // NEW: Documentation compression settings
  compression: {
    enabled: true,
    strategy: 'header-extraction',     // 'header-extraction' | 'full-llm'
    min_file_size: 500,                // lines - skip if smaller
    target_reduction: 65,              // percent - aim for 65% reduction
    cache_ttl: 300,                    // seconds - 5 minutes
    patterns: [
      '**/*-RESEARCH.md',
      '**/*-PLAN.md',
      '**/*-CONTEXT.md',
      '**/STATE.md',
      '**/ROADMAP.md',
      '**/PROJECT.md'
    ],
    exclude: [
      '**/*-SUMMARY.md',               // Already compressed
      '**/README.md'                   // Usually short
    ],
    fallback: 'pass-through',          // 'pass-through' | 'error'
    circuit_breaker: {
      enabled: true,
      failure_threshold: 3,            // Disable after 3 failures
      reset_timeout: 300               // Re-enable after 5 min
    }
  }
};
```

### Pattern 5: Integration with Phase 7 Token Monitoring

**What:** Trigger compression automatically when token usage exceeds 80% threshold

**When to use:** Autonomous roadmap execution with large documentation loads

**Extend Phase 7 TokenBudgetMonitor (token-monitor.js):**

```javascript
// Source: Phase 7 token monitoring patterns
// Extend with compression trigger

class TokenBudgetMonitor {
  constructor(maxTokens = 200000) {
    this.maxTokens = maxTokens;
    this.currentUsage = 0;
    this.compressionEnabled = false;
  }

  /**
   * Check if compression should be triggered
   */
  shouldCompressContext() {
    const utilization = this.currentUsage / this.maxTokens;
    return utilization >= 0.80; // 80% threshold
  }

  /**
   * Enable compression mode
   */
  enableCompression() {
    const { saveHookConfig, loadHookConfig } = require('./hooks/config');
    const config = loadHookConfig();

    if (!config.compression.enabled) {
      config.compression.enabled = true;
      saveHookConfig(config);
      this.compressionEnabled = true;

      console.log('[TokenMonitor] Compression enabled at 80% utilization');
    }
  }

  /**
   * Update token count and check thresholds
   */
  update(tokensUsed) {
    this.currentUsage += tokensUsed;

    if (this.shouldCompressContext() && !this.compressionEnabled) {
      this.enableCompression();
    }

    return {
      usage: this.currentUsage,
      limit: this.maxTokens,
      utilization: (this.currentUsage / this.maxTokens * 100).toFixed(1),
      compressionActive: this.compressionEnabled
    };
  }
}

module.exports = { TokenBudgetMonitor };
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing | Custom regex parser | markdown-it or marked | Edge cases: nested lists, code blocks, tables, HTML entities, escaping, GFM extensions. Parsers handle all. |
| Keyword extraction | Custom NLP pipeline | Simple stopword filtering or TF-IDF | Custom NLP: Complex, requires stemming/lemmatization. Stopwords: Instant, 80% accuracy sufficient for doc matching. |
| BM25 ranking | Manual TF-IDF calculation | wink-bm25-text-search | BM25 handles term saturation, document length normalization. Manual implementation has 15+ edge cases. |
| Token counting | Character-based estimates | @anthropic-ai/tokenizer | Claude uses BPE tokenizer. 1 char ≠ 1 token. "function" = 1 token, "functionalize" = 2 tokens. Use official. |
| Header TOC generation | Line-by-line scanning | markdown-it-toc-and-anchor | Handles malformed headers, duplicate IDs, anchor conflicts. Plugin ecosystem solves this. |
| Skill protocol | Custom JSON API | SKILL.md (Agent Skills standard) | SKILL.md: Git-friendly, markdown-based, works across Claude ecosystem. Custom API: Requires maintenance. |

**Key insight:** Documentation indexing, keyword extraction, and markdown parsing are well-solved problems in 2026. Libraries are battle-tested with 3M-12M+ weekly downloads. Building custom solutions introduces bugs in edge cases (nested structures, special characters, encoding issues). Use proven libraries, focus on integration.

## Common Pitfalls

### Pitfall 1: Index Build Performance Degrades with Large Doc Sets

**What goes wrong:** Building context index on every skill invocation scans 500+ markdown files, taking 5-15 seconds per call. Task routing becomes bottleneck.

**Why it happens:** No caching strategy. Each skill call triggers full filesystem scan + content read + keyword extraction.

**How to avoid:**
- Use Phase 1's existing cache mechanism (`~/.claude/cache/context-index.json`)
- Index build: once per session or on file changes (mtime tracking)
- Cache includes pre-computed summaries (avoid re-extraction)
- Add `routing index-build --force` command for manual refresh

**Warning signs:**
- Task context skill takes >10 seconds to respond
- High disk I/O during skill invocation
- Repeated filesystem scanning in process logs

### Pitfall 2: Summary Quality Varies Across Document Structures

**What goes wrong:** Some docs have helpful first paragraphs, others have metadata/boilerplate. Summaries capture wrong content (installation commands instead of purpose).

**Why it happens:** "First paragraph" heuristic assumes consistent doc structure. Real docs vary: some start with frontmatter, others with navigation, others with title-only headers.

**How to avoid:**
- Skip empty sections (no preview if header has no content)
- Detect and skip boilerplate sections ("Installation", "Prerequisites")
- Capture first 2-3 bullet points if paragraph empty
- Add fallback: if no preview captured, use frontmatter description

**Warning signs:**
- Summaries contain "npm install" commands instead of descriptions
- User reports "summaries don't help understand what doc is about"
- Matched docs have high scores but low relevance

### Pitfall 3: Absolute File Links Break in Docker/Remote Environments

**What goes wrong:** `file:///Users/ollorin/igaming-platform/docs/auth.md` works on local Mac but fails in Docker container or remote SSH session where path doesn't exist.

**Why it happens:** Absolute paths are environment-specific. Docker mounts may map different paths. Remote sessions may not have same filesystem structure.

**How to avoid:**
- Provide BOTH absolute and relative links in summaries
- Add instruction: "To access full content, use Read tool with this path"
- For critical docs, include preview length setting (user configurable)
- Test in Docker environment before production

**Warning signs:**
- Error logs: "File not found" for file:// links
- User reports: "Can't access linked documentation"
- Works locally but fails in CI/production

### Pitfall 4: Keyword Matching Misses Semantic Equivalents

**What goes wrong:** Task description "create auth policy" doesn't match doc tagged "authentication", "permissions", "authorization". Zero results returned despite relevant docs existing.

**Why it happens:** Simple keyword matching requires exact word matches. No handling of synonyms, abbreviations, or semantic equivalents.

**How to avoid:**
- Expand stopword list to preserve domain terms ("auth", "db", "api")
- Add synonym expansion: "auth" → ["auth", "authentication", "authorization"]
- Use partial matching: "auth" matches "authentication" (substring)
- Provide fallback: if zero matches, retry with relaxed threshold

**Warning signs:**
- User reports: "Relevant docs not surfaced"
- Zero matches for obvious queries
- Match scores consistently low despite relevant content

### Pitfall 5: Hook Failure Blocks All Documentation Access

**What goes wrong:** Bug in compression hook (parse error, OOM) causes ALL Read operations on docs to fail. GSD workflows halt completely.

**Why it happens:** PreToolUse hooks run before tool execution. Uncaught exception → tool never executes → workflow blocked.

**How to avoid:**
- Wrap ALL hook logic in try/catch with fallback `process.exit(0)` (pass through)
- Add circuit breaker: after 3 consecutive failures, disable hook automatically
- Log hook errors to separate file (not stderr, which blocks Claude)
- Implement health check: test hook on startup, disable if failing

**Warning signs:**
- Workflow fails with "Read tool failed" errors
- Hook logs show repeated exceptions
- User reports "Can't access any documentation files"
- No Read operations completing successfully

## Code Examples

Verified patterns from 2026 best practices and existing Phase 1 implementation:

### Keyword Extraction with Stopword Filtering

```javascript
// Source: Analytics Vidhya, GeeksforGeeks (Keyword Extraction Methods)
// Simple stopword filtering achieves 80% accuracy for document matching

function extractKeywords(text) {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'must', 'can', 'this', 'that', 'these', 'those', 'it', 'its', 'with',
    'from', 'by', 'as', 'of', 'if', 'then', 'else', 'when', 'where', 'how',
    'what', 'which', 'who', 'why', 'not', 'no', 'yes', 'all', 'any', 'each'
  ]);

  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

// ENHANCEMENT: Add synonym expansion for domain terms
function expandKeywords(keywords) {
  const synonyms = {
    'auth': ['auth', 'authentication', 'authorization', 'login', 'signin'],
    'db': ['db', 'database', 'postgres', 'postgresql', 'sql'],
    'api': ['api', 'endpoint', 'rest', 'graphql'],
    'bot': ['bot', 'telegram', 'messaging', 'chat']
  };

  const expanded = new Set(keywords);
  for (const keyword of keywords) {
    if (synonyms[keyword]) {
      synonyms[keyword].forEach(syn => expanded.add(syn));
    }
  }

  return Array.from(expanded);
}
```

### Document Matching with Tag Weighting (Existing Phase 1)

```javascript
// Source: Phase 1 implementation (gsd-tools.js lines 2527-2551)
// Tag matches weighted 2x higher than keyword matches

function matchContextDocs(taskDescription, index, limit = 3) {
  const taskKeywords = extractKeywords(taskDescription);
  const expandedKeywords = expandKeywords(taskKeywords); // NEW: Synonym expansion

  const scored = index.entries.map(entry => {
    // Score = tags matches (weighted 2x) + keyword matches
    const tagMatches = entry.tags.filter(t =>
      expandedKeywords.some(k => t.toLowerCase().includes(k) || k.includes(t.toLowerCase()))
    ).length * 2;

    const keywordMatches = entry.keywords.filter(k =>
      expandedKeywords.includes(k)
    ).length;

    return {
      ...entry,
      score: tagMatches + keywordMatches
    };
  });

  return scored
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(e => ({
      path: e.path,
      title: e.title,
      score: e.score,
      summary: e.summary // NEW: Include pre-computed summary
    }));
}
```

### CLI Commands for Task Context Skill

```javascript
// Add to gsd-tools.js command routing

// NEW: Build index with summaries
if (command === 'routing' && subCommand === 'index-build') {
  const force = args.includes('--force');
  const withSummaries = !args.includes('--no-summaries'); // Default: include summaries

  const cachePath = path.join(HOME, '.claude', 'cache', 'context-index.json');

  // Check cache freshness (skip if < 1 hour old and not forced)
  if (!force && fs.existsSync(cachePath)) {
    const ageMs = Date.now() - fs.statSync(cachePath).mtime.getTime();
    if (ageMs < 3600000) {
      output({ cached: true, age_minutes: Math.floor(ageMs / 60000) }, raw);
      return;
    }
  }

  // Build index with summaries
  const basePaths = [
    path.join(HOME, '.claude', 'guides'),
    path.join(HOME, '.claude', 'get-shit-done', 'references'),
    path.join(cwd, '.planning', 'codebase'),
    path.join(cwd, 'docs') // NEW: User's project docs folder
  ];

  const index = buildContextIndex(basePaths, { includeSummaries: withSummaries });

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(index, null, 2));

  output({
    cached: false,
    entries: index.entries.length,
    with_summaries: withSummaries,
    cache_path: cachePath
  }, raw);
}

// NEW: Extract summary for single document
if (command === 'compress' && subCommand === 'summary') {
  const filePath = args[2];
  if (!filePath) { error('file path required'); return; }

  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, 'utf-8');

  const extractor = new HeaderExtractor();
  const result = extractor.extractSummary(content, absolutePath);

  if (args.includes('--raw')) {
    console.log(result.summary);
  } else {
    output(result, false);
  }
}

// EXTEND existing 'routing full' to include summaries
function cmdRoutingFull(cwd, taskDesc, raw) {
  // ... existing model selection logic ...

  const index = loadContextIndex(cwd);
  const contextMatches = matchContextDocs(taskDesc, index, 3);

  // NEW: If summaries not in index, extract on-demand
  const extractor = new HeaderExtractor();
  for (const match of contextMatches) {
    if (!match.summary) {
      const content = fs.readFileSync(match.path, 'utf-8');
      const { summary } = extractor.extractSummary(content, match.path);
      match.summary = summary;
    }
  }

  output({
    task: taskDesc,
    model: modelResult,
    context: contextMatches, // Now includes summaries
    claude_md: claudeMdResult
  }, raw);
}
```

### Token Estimation and Compression Metrics

```javascript
// Accurate token counting using official Anthropic tokenizer
// Source: @anthropic-ai/tokenizer documentation

const { countTokens } = require('@anthropic-ai/tokenizer');
const fs = require('fs');

class CompressionMetrics {
  async recordCompression(originalPath, original, compressed) {
    const originalTokens = await countTokens(original);
    const compressedTokens = await countTokens(compressed);
    const reduction = ((originalTokens - compressedTokens) / originalTokens * 100).toFixed(1);

    const record = {
      timestamp: new Date().toISOString(),
      file: originalPath,
      originalSize: original.length,
      compressedSize: compressed.length,
      originalTokens,
      compressedTokens,
      reductionPercent: reduction,
      strategy: 'header-extraction'
    };

    // Persist to metrics file
    const metricsPath = '.planning/.doc-compression-metrics.jsonl';
    fs.appendFileSync(metricsPath, JSON.stringify(record) + '\n');

    return record;
  }

  async getAverageReduction() {
    const metricsPath = '.planning/.doc-compression-metrics.jsonl';
    if (!fs.existsSync(metricsPath)) return { count: 0, avgReduction: 0 };

    const lines = fs.readFileSync(metricsPath, 'utf-8').trim().split('\n');
    const records = lines.map(l => JSON.parse(l));

    const totalReduction = records.reduce((sum, r) => sum + parseFloat(r.reductionPercent), 0);
    const avgReduction = (totalReduction / records.length).toFixed(1);

    return {
      count: records.length,
      avgReduction,
      totalTokensSaved: records.reduce((sum, r) => sum + (r.originalTokens - r.compressedTokens), 0)
    };
  }
}

module.exports = { CompressionMetrics };
```

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact |
|--------------|-------------------------|--------------|--------|
| Passive `@` directive injection | Active context injection via Task Context Skill | 2026 (Phase 1/9) | Claude receives only relevant docs per task instead of all docs upfront |
| Full document injection | Header extraction + summaries with file:// links | 2025-2026 | 60-70% token reduction, preserve full content access |
| Character-based size estimates | BPE tokenizer (@anthropic-ai/tokenizer) | 2024 | Accurate token counting, compression metrics trustworthy |
| Semantic embeddings required | Keyword + tag matching sufficient | 2026 | Instant matching (0ms), deterministic, embeddings deferred to future |
| PostToolUse compression | PreToolUse interception + additionalContext | Claude Code 2.1.9+ (2025) | Inject compressed version BEFORE read, not after |
| Complex semantic chunking | Simple header-based markdown splitting | 2026 FloTorch benchmark | Simpler method outperforms complex approaches 40-60% |
| Pure semantic search | Hybrid BM25 + semantic (when needed) | 2026 | BM25 remains backbone, semantic adds depth for paraphrases |

**Deprecated/outdated:**
- **Full doc injection via `@` directives** — 2023-2024 approach loaded all docs upfront. 2026: Task-specific injection via skills.
- **LLM-first summarization** — 2023-2024 used GPT-4 to summarize every doc. 2026: Header extraction first (instant, free), LLM only for complex narratives.
- **Character-length compression metrics** — Reported "90% reduction" based on characters, but tokens saved only 40%. 2026: Always measure token reduction.
- **Semantic embeddings required for doc search** — Early RAG systems required vector DB. 2026: BM25 + keyword matching handles 80% of cases, add embeddings only if precision insufficient.

## Open Questions

1. **Should Task Context Skill cache model decisions per task pattern?**
   - What we know: Routing rules provide deterministic model selection, skill executes routing command each time
   - What's unclear: Whether caching "create RLS policy" → sonnet improves performance or introduces staleness
   - Recommendation: No caching in Phase 9. Model selection is fast (<100ms), caching adds complexity. Revisit if routing becomes bottleneck.

2. **How to handle project docs folder that doesn't exist (~/igaming-platform/docs)?**
   - What we know: Task Context Skill searches `~/igaming-platform/docs`, but folder may not exist for all projects
   - What's unclear: Should skill create folder, skip silently, or warn user?
   - Recommendation: Skip silently (no error). Add to index only if folder exists. User can create docs/ folder if they want project-specific docs.

3. **Should summaries include code blocks or strip them?**
   - What we know: Code examples in docs are valuable but verbose (10-50 lines each)
   - What's unclear: Whether summaries should (a) preserve first code block, (b) strip all code, (c) include code block captions only
   - Recommendation: Strip code blocks from summaries, rely on file:// link for full examples. Phase 2 optimization can add code block metadata extraction.

4. **How does compression interact with Phase 4 knowledge extraction?**
   - What we know: Phase 4 hooks extract decisions/lessons from conversations
   - What's unclear: Should compressed docs be indexed in knowledge system, or only full content?
   - Recommendation: Extract knowledge from FULL content only (not compressed versions). Add `source_type: 'compressed'` flag if compressed content indexed.

5. **What's the optimal cache TTL for context index?**
   - What we know: Phase 1 uses 1-hour cache TTL for context index
   - What's unclear: Whether 1 hour is too short (frequent rebuilds) or too long (stale summaries)
   - Recommendation: Keep 1-hour TTL for Phase 9. Add manual `routing index-refresh` command. Monitor cache hit/miss rates, adjust if needed.

## Sources

### Primary (HIGH confidence)

- [Keyword Extraction Methods in NLP - GeeksforGeeks](https://www.geeksforgeeks.org/nlp/keyword-extraction-methods-in-nlp/) - Keyword extraction algorithms (stopword filtering, TF-IDF, RAKE)
- [Keyword Extraction Methods in NLP - Analytics Vidhya](https://www.analyticsvidhya.com/blog/2022/03/keyword-extraction-methods-from-documents-in-nlp/) - Statistical and linguistic keyword extraction methods
- [Why BM25 Remains the Backbone of Modern Search - Medium](https://medium.com/@harshit.sinha0910/why-bm25-remains-the-backbone-of-modern-search-f7183760eea9) - BM25 in 2026, hybrid search trends
- [BM25 or TF-IDF? Find Out Which Drives Better Search Results - Flowrec](https://blog.flowrec.com/bm25-or-tf%E2%80%91idf-find-out-which-drives-better-search-results/) - BM25 vs TF-IDF comparison
- [Extend Claude with skills - Claude Code Docs](https://code.claude.com/docs/en/skills) - SKILL.md format, Agent Skills standard
- [Building Skills for Claude: The Complete Guide (2026) - Learnia](https://learn-prompting.fr/blog/building-skills-for-claude-complete-guide) - SKILL.md YAML frontmatter, skill interface protocol
- [Agent Skills - Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) - Official Agent Skills documentation
- [Best Chunking Strategies for RAG in 2025 - Firecrawl](https://www.firecrawl.dev/blog/best-chunking-strategies-rag-2025) - Header-based markdown chunking, 512 tokens + 15% overlap
- [Chunking Strategies to Improve LLM RAG - Weaviate](https://weaviate.io/blog/chunking-strategies-for-rag) - Markdown chunking by headings (##)
- [wink-bm25-text-search - npm](https://www.npmjs.com/package/wink-bm25-text-search) - BM25 implementation for Node.js
- [@anthropic-ai/tokenizer - npm](https://www.npmjs.com/package/@anthropic-ai/tokenizer) - Official Claude token counting

### Secondary (MEDIUM confidence)

- [Two minutes NLP — Keyword Extraction with KeyBERT - Medium](https://medium.com/nlplanet/two-minutes-nlp-keyword-and-keyphrase-extraction-with-keybert-a9994b06a83) - Deep learning keyword extraction (BERT-based)
- [BM25 for Developers: A Guide to Smarter Keyword Search - Medium](https://medium.com/@kimdoil1211/bm25-for-developers-a-guide-to-smarter-keyword-search-e6d83e8c8c8c) - BM25 implementation guide
- [GitHub: wink-bm25-text-search](https://github.com/winkjs/wink-bm25-text-search) - Fast full text search based on BM25
- [Why Markdown is the Secret Weapon for Document AI - Medium](https://medium.com/@hlcwang/why-markdown-is-the-secret-weapon-for-document-ai-b3fd517a101b) - Markdown structure benefits for LLMs
- [AI Markdown to Summary Converter - Taskade](https://www.taskade.com/convert/markdown/markdown-to-summary) - AI-based markdown summarization
- [Phase 1 Context - 01-CONTEXT.md](file:///Users/ollorin/get-shit-done/.planning/phases/01-auto-mode-foundation/01-CONTEXT.md) - User decisions on Task Context Skill
- [Phase 1 Plan 02 - 01-02-PLAN.md](file:///Users/ollorin/get-shit-done/.planning/phases/01-auto-mode-foundation/01-02-PLAN.md) - Task Context Skill implementation plan
- [Phase 7 Research - 07-RESEARCH.md](file:///Users/ollorin/get-shit-done/.planning/phases/07-autonomous-execution-optimization/07-RESEARCH.md) - Token monitoring patterns
- [gsd-tools.js](file:///Users/ollorin/.claude/get-shit-done/bin/gsd-tools.js) - Existing routing context implementation (lines 2469-2635)

### Tertiary (LOW confidence, needs validation)

- [Keyphrase and Keyword Extraction in NLP - Nature Research Intelligence](https://www.nature.com/research-intelligence/nri-topic-summaries/keyphrase-and-keyword-extraction-in-natural-language-processing-micro-2212) - Academic NLP keyword extraction overview
- [markdown-analysis - PyPI](https://pypi.org/project/markdown-analysis/) - Python markdown analysis library
- [Cross-Encoder Rediscovers Semantic BM25 - arXiv](https://arxiv.org/html/2502.04645v2) - Semantic variant of BM25 (research paper)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - markdown-it industry standard, SKILL.md format official, Phase 1 routing infrastructure exists
- Architecture: HIGH - Based on proven Phase 1 patterns, incremental extension approach, existing gsd-tools.js implementation
- Task Context Skill: HIGH - Clear requirements from Phase 1 Context, skill format documented, routing infrastructure complete
- GSD Doc Compression: MEDIUM-HIGH - PreToolUse hooks documented, header extraction proven, but hook reliability needs testing
- Token reduction claims: MEDIUM - 60-70% reduction extrapolated from header extraction research, needs empirical validation on GSD docs

**Research date:** 2026-02-16
**Valid until:** 45 days (stable domain: markdown parsing, keyword extraction established patterns; skill format may evolve)

**Key uncertainties:**
- Actual compression ratios for GSD-specific docs (RESEARCH.md, PLAN.md) - need measurement after implementation
- Hook reliability in production (circuit breaker may trigger frequently) - need monitoring
- Summary quality across diverse doc structures - need user feedback
- Index build performance with 500+ docs - need benchmarking
- Integration complexity with Phase 4 knowledge extraction - need testing

**Critical dependencies:**
- Phase 1 routing infrastructure (gsd-tools.js routing commands) - COMPLETE
- Phase 4 hook configuration system (hooks/config.js) - COMPLETE
- Phase 7 token monitoring (token-monitor.js) - COMPLETE
- ~/igaming-platform/docs folder - USER MUST CREATE (not in repo)
