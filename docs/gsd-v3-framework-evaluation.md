# GSD v3.0 Agent Framework Evaluation

**Version:** 1.0
**Date:** 2026-03-11
**Purpose:** Evaluate multi-agent frameworks for GSD v3.0 hybrid runtime

---

## Evaluation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| TypeScript Native | High | Must have first-class TypeScript support, not just types |
| Checkpoint Support | High | Native pause/resume with state persistence |
| Streaming | High | Real-time token streaming to UI |
| Observability | Medium | Tracing, debugging, metrics |
| Claude Integration | High | Works well with Anthropic SDK |
| Complexity | Medium | Learning curve and maintenance burden |
| Community | Medium | Documentation, examples, support |
| Lock-in Risk | Low | Can we migrate if needed |

---

## Framework Comparison

### 1. Vercel AI SDK

**Repository:** https://github.com/vercel/ai
**Language:** TypeScript
**Stars:** 10k+

**Overview:**
The Vercel AI SDK is a TypeScript library for building AI-powered applications. It provides streaming primitives, tool calling, and hooks for React integration.

**Strengths:**
- Native TypeScript, excellent DX
- Built-in streaming with `streamText()` and `streamUI()`
- Tool calling with Zod schemas
- React hooks (`useChat`, `useCompletion`)
- Works with multiple providers (Anthropic, OpenAI, etc.)
- Active development, Vercel backing

**Weaknesses:**
- No built-in checkpoint/pause-resume
- No agent graph abstraction
- Need to build orchestration ourselves
- No built-in tracing (need custom)

**GSD Fit:**
- Streaming: ✅ Excellent
- Tools: ✅ Excellent
- Checkpoints: ⚠️ Manual implementation
- Multi-agent: ⚠️ Manual orchestration

**Code Example:**
```typescript
import { streamText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

const anthropic = createAnthropic();

const result = await streamText({
  model: anthropic('claude-sonnet-4-5'),
  system: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'Hello' }],
  tools: {
    readFile: tool({
      description: 'Read a file',
      parameters: z.object({ path: z.string() }),
      execute: async ({ path }) => fs.readFile(path, 'utf-8'),
    }),
  },
});

for await (const chunk of result.textStream) {
  console.log(chunk);
}
```

**Verdict:** Best for streaming UI, but need to build agent orchestration ourselves.

---

### 2. LangGraph (LangChain)

**Repository:** https://github.com/langchain-ai/langgraph
**Language:** Python (JS version exists but lags)
**Stars:** 8k+

**Overview:**
LangGraph is a library for building stateful, multi-actor applications with LLMs. It uses a graph-based approach where nodes are agents/tools and edges are state transitions.

**Strengths:**
- Mature agent orchestration patterns
- Built-in checkpointing with persistence
- LangSmith integration for observability
- Human-in-the-loop patterns
- Subgraph support for complex workflows

**Weaknesses:**
- Python-first (JS/TS version is behind)
- Heavy abstraction (LangChain ecosystem)
- Steeper learning curve
- More complex than needed for GSD?

**GSD Fit:**
- Streaming: ✅ Good
- Tools: ✅ Good
- Checkpoints: ✅ Excellent (native)
- Multi-agent: ✅ Excellent (native)

**Code Example (Python):**
```python
from langgraph.graph import StateGraph, END
from langgraph.checkpoint import MemorySaver

# Define state
class AgentState(TypedDict):
    messages: list
    next_action: str

# Define nodes
def executor_node(state: AgentState):
    # Execute plan
    return {"messages": state["messages"] + ["Executed"]}

# Build graph
graph = StateGraph(AgentState)
graph.add_node("executor", executor_node)
graph.add_edge("executor", END)

# Add checkpointing
memory = MemorySaver()
app = graph.compile(checkpointer=memory, interrupt_before=["executor"])

# Run with interrupt
result = app.invoke({"messages": ["Start"], "next_action": "execute"})
# User can respond here
result = app.invoke(None, config={"thread_id": "123"})  # Resume
```

**Verdict:** Best native multi-agent support, but Python-first is a concern.

---

### 3. Mastra

**Repository:** https://github.com/mastra-ai/mastra
**Language:** TypeScript
**Stars:** 2k+

**Overview:**
Mastra is a TypeScript framework for building AI agents with built-in tools, memory, and orchestration. It's designed to be simple yet powerful.

**Strengths:**
- Native TypeScript
- Built-in agent abstraction
- Tool registry pattern
- Memory/context management
- Simpler than LangGraph

**Weaknesses:**
- Newer, less battle-tested
- Smaller community
- Checkpoint support unclear
- Less documentation

**GSD Fit:**
- Streaming: ✅ Good
- Tools: ✅ Good
- Checkpoints: ⚠️ Needs investigation
- Multi-agent: ✅ Good

**Code Example:**
```typescript
import { Agent, createTool } from '@mastra/core';

const readFile = createTool({
  name: 'read_file',
  description: 'Read a file',
  schema: z.object({ path: z.string() }),
  execute: async ({ path }) => fs.readFile(path, 'utf-8'),
});

const agent = new Agent({
  name: 'executor',
  instructions: 'You are a code executor.',
  model: 'claude-sonnet-4-5',
  tools: [readFile],
});

const result = await agent.generate('Execute the plan');
```

**Verdict:** Promising TypeScript option, needs deeper evaluation.

---

### 4. Claude Agent SDK (Anthropic)

**Repository:** https://github.com/anthropics/claude-agent-sdk
**Language:** TypeScript / Python
**Stars:** 1k+

**Overview:**
Official Anthropic SDK for building agents. Designed specifically for Claude models with native tool use support.

**Strengths:**
- Official Anthropic support
- Designed for Claude
- Simple, focused API
- Low abstraction overhead
- TypeScript native

**Weaknesses:**
- Limited orchestration patterns
- No built-in checkpointing
- Single-agent focused
- Need to build multi-agent ourselves

**GSD Fit:**
- Streaming: ✅ Excellent
- Tools: ✅ Excellent
- Checkpoints: ⚠️ Manual
- Multi-agent: ⚠️ Manual

**Code Example:**
```typescript
import { Agent } from 'claude-agent-sdk';

const agent = new Agent({
  model: 'claude-sonnet-4-5',
  tools: [
    {
      name: 'read_file',
      description: 'Read a file',
      input_schema: { type: 'object', properties: { path: { type: 'string' } } },
      handler: async ({ path }) => fs.readFile(path, 'utf-8'),
    },
  ],
});

for await (const event of agent.stream('Execute the task')) {
  console.log(event);
}
```

**Verdict:** Best Claude integration, but need custom orchestration.

---

### 5. AutoGen (Microsoft)

**Repository:** https://github.com/microsoft/autogen
**Language:** Python
**Stars:** 35k+

**Overview:**
Microsoft's framework for building multi-agent conversational systems. Agents can talk to each other to solve tasks.

**Strengths:**
- Very mature
- Excellent multi-agent patterns
- Conversation-based orchestration
- Code execution built-in

**Weaknesses:**
- Python only
- Heavy framework
- Designed for agent chat, not GSD workflow
- Overkill for our use case

**GSD Fit:**
- Streaming: ✅ Good
- Tools: ✅ Good
- Checkpoints: ⚠️ Different paradigm
- Multi-agent: ✅ Excellent

**Verdict:** Wrong paradigm for GSD (chat-based vs workflow-based).

---

### 6. CrewAI

**Repository:** https://github.com/crewAIInc/crewAI
**Language:** Python
**Stars:** 25k+

**Overview:**
Role-based multi-agent framework where you define "crews" of agents with specific roles that collaborate on tasks.

**Strengths:**
- Role-based agent design
- Task delegation patterns
- Memory across agents
- Process management

**Weaknesses:**
- Python only
- Role-based doesn't map to GSD
- Less control over execution
- Different mental model

**GSD Fit:**
- Streaming: ⚠️ Limited
- Tools: ✅ Good
- Checkpoints: ⚠️ Limited
- Multi-agent: ✅ Good (but different model)

**Verdict:** Role-based model doesn't fit GSD's workflow-based design.

---

## Recommendation Matrix

| Framework | TypeScript | Checkpoints | Streaming | Multi-Agent | Complexity | Recommendation |
|-----------|------------|-------------|-----------|-------------|------------|----------------|
| Vercel AI SDK | ✅ Native | ⚠️ Manual | ✅ Excellent | ⚠️ Manual | Low | **Primary choice** |
| LangGraph | ⚠️ JS lags | ✅ Native | ✅ Good | ✅ Native | High | Fallback if JS improves |
| Mastra | ✅ Native | ⚠️ Unclear | ✅ Good | ✅ Good | Medium | Evaluate further |
| Claude Agent SDK | ✅ Native | ⚠️ Manual | ✅ Excellent | ⚠️ Manual | Low | Combine with Vercel |
| AutoGen | ❌ Python | ⚠️ Different | ✅ Good | ✅ Excellent | High | Not recommended |
| CrewAI | ❌ Python | ⚠️ Limited | ⚠️ Limited | ✅ Good | Medium | Not recommended |

---

## Recommended Approach

### Primary: Vercel AI SDK + Custom Orchestration

Build on Vercel AI SDK for streaming and tool calling, add custom orchestration layer for GSD-specific patterns.

```
┌─────────────────────────────────────────────────────────┐
│                   GSD Agent Runtime                      │
├─────────────────────────────────────────────────────────┤
│  Custom Layer (we build)                                │
│  ├── Agent Graph — GSD workflow state machine           │
│  ├── Checkpoint Manager — pause/resume with DB          │
│  ├── Wave Executor — parallel plan execution            │
│  └── Prompt Loader — markdown → agent config            │
├─────────────────────────────────────────────────────────┤
│  Vercel AI SDK                                          │
│  ├── streamText() — LLM streaming                       │
│  ├── tool() — typed tool definitions                    │
│  └── generateObject() — structured outputs              │
├─────────────────────────────────────────────────────────┤
│  Anthropic SDK                                          │
│  └── Claude API — actual model calls                    │
└─────────────────────────────────────────────────────────┘
```

**Why this approach:**
1. TypeScript native throughout
2. Best streaming support for Dashboard
3. We control the orchestration layer
4. Can swap underlying framework later
5. Prompts remain portable (markdown)

### Alternative: Mastra (Evaluate During v2.0)

If Mastra matures and adds checkpoint support, consider it for v3.0. It provides more out-of-the-box agent patterns while staying TypeScript native.

**Evaluation criteria:**
- [ ] Checkpoint/pause-resume support added
- [ ] Documentation quality improves
- [ ] Community grows
- [ ] Production usage examples available

### Fallback: LangGraph JS

If LangGraph's JavaScript SDK catches up to Python, it becomes attractive for native multi-agent patterns. Currently the JS version lacks parity.

**Watch for:**
- [ ] JS/TS SDK reaches feature parity with Python
- [ ] LangSmith integration for JS
- [ ] Documentation and examples for JS

---

## Implementation Timeline

| Phase | Action |
|-------|--------|
| v2.0 (current) | Use existing GSD + gsd-tools.cjs |
| v2.0 + 2 months | Evaluate Mastra in side project |
| v2.0 + 4 months | Prototype custom orchestration with Vercel AI SDK |
| v3.0 start | Make final framework decision based on prototypes |
| v3.0 M1 | Build core runtime with chosen approach |

---

## Appendix: Quick Reference

### Vercel AI SDK Quick Start

```bash
pnpm add ai @ai-sdk/anthropic zod
```

```typescript
import { streamText, tool } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const anthropic = createAnthropic();

const result = await streamText({
  model: anthropic('claude-sonnet-4-5'),
  system: 'You are a helpful assistant.',
  tools: {
    myTool: tool({
      description: 'My tool',
      parameters: z.object({ input: z.string() }),
      execute: async ({ input }) => `Processed: ${input}`,
    }),
  },
  messages: [{ role: 'user', content: 'Use my tool' }],
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk);
}
```

### LangGraph JS Quick Start

```bash
pnpm add @langchain/langgraph @langchain/anthropic
```

```typescript
import { StateGraph, END } from '@langchain/langgraph';
import { ChatAnthropic } from '@langchain/anthropic';

const model = new ChatAnthropic({ model: 'claude-sonnet-4-5' });

const graph = new StateGraph({
  channels: {
    messages: { value: (a, b) => [...a, ...b] },
  },
})
  .addNode('agent', async (state) => {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  })
  .addEdge('agent', END);

const app = graph.compile();
const result = await app.invoke({ messages: ['Hello'] });
```

---

*Evaluation completed: 2026-03-11*
