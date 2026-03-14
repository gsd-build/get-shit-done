# Multi-Model GSD Architecture

**Research Date:** 2026-03-11
**Status:** Proposed for v2.0 Milestone

## Executive Summary

This document outlines the architecture for refactoring GSD to support multiple LLM providers (Claude, GPT, Gemini, local models) through abstraction layers. The primary motivation is enabling GPT-5.4-pro via Azure Foundry as a secondary provider while maintaining Claude as the primary.

## Current Architecture Limitations

GSD currently runs inside Claude Code, using its native runtime:

| Component | Current Implementation | Limitation |
|-----------|----------------------|------------|
| Orchestration | Claude Code interprets markdown prompts | Coupled to Claude runtime |
| LLM Calls | Implicit (Claude is the runtime) | No provider choice |
| Subagents | Claude Code `Task()` tool | Claude-only |
| Tool Execution | Claude Code's Bash/Read/Write | Runtime-dependent |
| Context Window | 200k tokens (Claude) | Fixed |

## Target Architecture

### Layer 1: Workflow Definitions (Unchanged)

PLAN.md, CONTEXT.md, RESEARCH.md files remain model-agnostic:
- Declarative task specifications
- Dependencies and wave groupings
- Verification criteria
- Same workflows work across all providers

### Layer 2: GSD Core Orchestrator (New)

Standalone Node.js library (`gsd-core`):
- Parses PLAN.md frontmatter and task blocks
- Manages wave-based parallel execution
- Handles checkpoints and human-in-the-loop
- Tracks progress in STATE.md
- Independent of any LLM runtime

### Layer 3: LLM Abstraction Layer (New)

Unified interface to multiple providers:

```typescript
interface LLMProvider {
  complete(prompt: string, options: CompletionOptions): Promise<Response>;
  chat(messages: Message[], tools?: Tool[]): Promise<Response>;
  stream(messages: Message[]): AsyncIterable<Chunk>;

  // Provider capabilities
  readonly contextWindow: number;
  readonly supportsTools: boolean;
  readonly supportsVision: boolean;
  readonly supportsReasoning: boolean;
  readonly costPer1kTokens: { input: number, output: number };
}

// Model router selects best provider for task
const router = new ModelRouter({
  providers: ['claude-sonnet', 'gpt-5.4-pro', 'gemini-pro'],
  strategy: 'cost-optimized',  // or 'quality-first', 'latency-first'
  fallbackChain: ['claude-sonnet', 'gpt-5.4', 'gpt-4o-mini']
});
```

### Layer 4: Tool Execution Layer (Adapted)

Provider-agnostic tool definitions:
- Unified JSON Schema-based tool definitions
- Adapters translate to each provider's format:
  - Claude: `tool_use` blocks with content arrays
  - OpenAI: `function_call` with Tool Search
  - Gemini: `functionCall` format
- MCP server integration for extensibility
- Sandboxed execution with approval gates

### Layer 5: State Management (Enhanced)

Persistent state across sessions and models:
- Progress tracking independent of LLM
- Decision history with rationale
- Response caching for cost reduction
- Checkpoint/resume across context resets and provider switches

## Provider Comparison

### Claude (Sonnet/Opus) - Primary

| Spec | Value | Notes |
|------|-------|-------|
| Context Window | 200K tokens | Sufficient for most phases |
| Tool Calling | Native, reliable | XML-style tool_use blocks |
| Reasoning | Extended thinking (Opus) | Excellent for complex tasks |
| Instruction Following | Excellent | Multi-step workflow adherence |
| Cost | Higher | Especially Opus |

**Strengths for GSD:**
- Designed around Claude's XML tag conventions
- Excellent at following complex multi-step instructions
- Thorough, considers edge cases
- Native extended thinking for hard problems

### GPT-5.4-Pro (Azure Foundry) - Secondary

| Spec | Value | Notes |
|------|-------|-------|
| Context Window | **1.05M tokens** | 272K standard, 1M extended |
| Tool Calling | Native + Tool Search | 47% fewer tokens than traditional |
| Reasoning | Built-in effort levels | medium/high/xhigh |
| Computer Use | Native, state-of-the-art | First general-purpose model with this |
| Agentic Workflows | First-class support | Designed for this use case |
| Hallucination Rate | 33% lower than GPT-5.2 | Strong reliability |
| Cost | $2.50/M input, $15/M output | Via Azure commitment |

**Strengths for GSD:**
- Massive context window eliminates chunking concerns
- Tool Search reduces token usage significantly
- Explicitly designed for "agentic workflows"
- "Fewer interruptions and reduced manual oversight"
- Azure Foundry provides enterprise SLAs

**Considerations:**
- Responses API only (multi-turn before responding)
- Some requests may take several minutes
- Requires prompt template adaptation (no XML tags)

### Comparison Matrix

```
Task Type              Claude    GPT-5.4-Pro   Winner
─────────────────────────────────────────────────────────
Simple code edits      ★★★★★    ★★★★★         Tie
Complex refactoring    ★★★★★    ★★★★★         Tie (GPT-5.4 improved)
Multi-file changes     ★★★★☆    ★★★★★         GPT (1M context)
Following PLAN.md      ★★★★★    ★★★★★         Tie (GPT-5.4 agentic focus)
Research/analysis      ★★★★★    ★★★★★         Tie
Verification steps     ★★★★★    ★★★★★         Tie
Long-running tasks     ★★★★☆    ★★★★★         GPT (designed for this)
Cost efficiency        ★★★☆☆    ★★★★★         GPT (especially via Azure)
```

## Routing Strategy

### Primary/Secondary Model

```yaml
# .planning/config.json
{
  "multimodel": {
    "primary": "claude-sonnet",
    "secondary": "gpt-5.4-pro",
    "routing": {
      "default": "primary",
      "rules": [
        { "task": "research", "model": "primary" },
        { "task": "planning", "model": "primary" },
        { "task": "execution", "model": "secondary", "condition": "cost > $0.50" },
        { "task": "verification", "model": "primary" },
        { "context_tokens": ">200000", "model": "secondary" }
      ],
      "fallback": ["primary", "secondary", "gpt-4o-mini"]
    }
  }
}
```

### Recommended Routing

| GSD Phase | Recommended Model | Rationale |
|-----------|-------------------|-----------|
| Research | Claude Sonnet | Thorough analysis |
| Planning | Claude Sonnet | Instruction adherence |
| Execution (simple) | GPT-5.4 | Cost efficiency |
| Execution (complex) | GPT-5.4-Pro | Reasoning + agentic |
| Verification | Claude Sonnet | Meticulous checking |
| Large codebase ops | GPT-5.4-Pro | 1M context window |

## Migration Path

### Phase 1: Extract Core Logic
- Move workflow parsing to `gsd-core` library
- Move state management to standalone module
- Move task execution logic out of markdown prompts
- Deliverable: `gsd-core` npm package

### Phase 2: Add LLM Abstraction
- Integrate LiteLLM or build custom adapters
- Implement provider interface for Claude, OpenAI
- Add model router with routing rules
- Deliverable: `gsd-llm` package

### Phase 3: Unify Tool Layer
- Create provider-agnostic tool definitions
- Build adapters for Claude tools → OpenAI functions
- Implement Tool Search support for GPT-5.4
- Deliverable: `gsd-tools` unified layer

### Phase 4: Build Standalone CLI
- New CLI using gsd-core directly
- Independent of Claude Code runtime
- Support for `--model` flag
- Deliverable: `gsd` CLI v2.0

### Phase 5: Maintain Compatibility
- Keep Claude Code integration as runtime option
- Preserve existing workflow file formats
- Migration guide for v1.x users
- Deliverable: Backward compatibility layer

## Prompt Template Adaptation

### Claude Style (Current)
```xml
<objective>
Execute plan 01 of phase 11
</objective>

<files_to_read>
- .planning/STATE.md
- .planning/phases/11-*/11-01-PLAN.md
</files_to_read>

<success_criteria>
- [ ] All tasks executed
- [ ] Each task committed
</success_criteria>
```

### OpenAI Style (GPT-5.4)
```
## Objective
Execute plan 01 of phase 11

## Files to Read
- .planning/STATE.md
- .planning/phases/11-*/11-01-PLAN.md

## Success Criteria
- All tasks executed
- Each task committed

Before each tool call, explain why you are calling it.
```

## Technical Challenges

### 1. Tool Calling Differences

| Provider | Format | Adaptation |
|----------|--------|------------|
| Claude | `tool_use` blocks with content arrays | Native GSD format |
| OpenAI | `function_call` + Tool Search | Translate schema, enable tool search |
| Gemini | `functionCall` | Different schema mapping |

**Solution:** Universal tool schema with per-provider adapters

### 2. Context Window Management

| Provider | Limit | Strategy |
|----------|-------|----------|
| Claude | 200K | Current chunking approach |
| GPT-5.4 | 272K (1M extended) | Enable extended context for large phases |
| Gemini 1.5 | 2M | No concerns |

**Solution:** Adaptive loading based on provider capabilities

### 3. Prompt Optimization

Each model family responds differently:
- Claude: XML tags, thinking blocks, detailed instructions
- GPT: Markdown, JSON mode, concise instructions
- Gemini: Structured output hints

**Solution:** Prompt templates per model family in `gsd-core/prompts/`

## Cost Analysis

### Current (Claude Only)

| Profile | Model | Cost/1M tokens |
|---------|-------|----------------|
| Quality | Opus | $15 / $75 |
| Balanced | Sonnet | $3 / $15 |
| Budget | Haiku | $0.25 / $1.25 |

### Multi-Model (Estimated)

| Task | Model | Est. Cost Reduction |
|------|-------|---------------------|
| Execution | GPT-5.4 | 40% (vs Sonnet) |
| Research | Claude Sonnet | Baseline |
| Large context | GPT-5.4-Pro | N/A (enables new use cases) |
| Fallback | GPT-4o-mini | 80% (vs Sonnet) |

## Azure Foundry Integration

### Benefits
- Enterprise SLAs and reliability
- Cost benefits via Azure commitment
- Data residency compliance
- Integration with Azure DevOps
- Managed infrastructure

### Configuration
```json
{
  "providers": {
    "azure-openai": {
      "endpoint": "https://<resource>.openai.azure.com",
      "deployment": "gpt-5-4-pro",
      "apiVersion": "2026-02-01"
    }
  }
}
```

## Success Criteria for Multi-Model Milestone

1. [ ] GSD workflows execute identically on Claude and GPT-5.4
2. [ ] Model routing based on task type and cost works
3. [ ] Fallback chain handles provider failures gracefully
4. [ ] Context window differences handled transparently
5. [ ] Tool calling works across all supported providers
6. [ ] Prompt templates adapt to each model family
7. [ ] Cost reduction of 30%+ for execution-heavy phases
8. [ ] No regression in quality for planning/verification
9. [ ] Backward compatibility with v1.x Claude Code integration

## References

- [Introducing GPT-5.4 | OpenAI](https://openai.com/index/introducing-gpt-5-4/)
- [GPT-5.4 Pro Model | OpenAI API](https://developers.openai.com/api/docs/models/gpt-5.4-pro)
- [GPT-5.4 in Microsoft Foundry](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/introducing-gpt-5-4-in-microsoft-foundry/4499785)
- [GPT-5.4 deep dive | OpenAI Community](https://community.openai.com/t/gpt-5-4-deep-dive-pricing-context-limits-and-tool-search-explained/1375800)
- [Architecture Diagram](~/.agent/diagrams/gsd-multimodel-architecture.html)

---

*Document created: 2026-03-11*
*Last updated: 2026-03-11*
