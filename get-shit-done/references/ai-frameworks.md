# AI Framework Decision Matrix

> Reference used by `gsd-framework-selector` and `gsd-ai-researcher`.
> Distilled from official docs, benchmarks, and developer reports (2026).

---

## Quick Picks

| Situation | Pick |
|-----------|------|
| Simplest path to a working agent (OpenAI) | OpenAI Agents SDK |
| Simplest path to a working agent (model-agnostic) | CrewAI |
| Production RAG / document Q&A | LlamaIndex |
| Complex stateful workflows with branching | LangGraph |
| Multi-agent teams with defined roles | CrewAI |
| Code-aware autonomous agents (Anthropic) | Claude Agent SDK |
| "I don't know my requirements yet" | LangChain |
| Regulated / audit-trail required | LangGraph |
| Enterprise Microsoft/.NET shops | AutoGen/AG2 |
| Google Cloud / Gemini-committed teams | Google ADK |
| Pure NLP pipelines with explicit control | Haystack |

---

## Framework Profiles

### CrewAI
- **Type:** Multi-agent orchestration
- **Language:** Python only
- **Model support:** Model-agnostic
- **Learning curve:** Beginner (role/task/crew maps to real teams)
- **Best for:** Content pipelines, research automation, business process workflows, rapid prototyping
- **Avoid if:** Fine-grained state management, TypeScript, fault-tolerant checkpointing, complex conditional branching
- **Strengths:** Fastest multi-agent prototyping, 5.76x faster than LangGraph on QA tasks, built-in memory (short/long/entity/contextual), Flows architecture, standalone (no LangChain dep)
- **Weaknesses:** Limited checkpointing, coarse error handling, Python only
- **Eval concerns:** Task decomposition accuracy, inter-agent handoff, goal completion rate, loop detection

### LlamaIndex
- **Type:** RAG and data ingestion
- **Language:** Python + TypeScript
- **Model support:** Model-agnostic
- **Learning curve:** Intermediate
- **Best for:** Legal research, internal knowledge assistants, enterprise document search, any system where retrieval quality is the #1 priority
- **Avoid if:** Primary need is agent orchestration, multi-agent collaboration, or chatbot conversation flow
- **Strengths:** Best-in-class document parsing (LlamaParse), 35% retrieval accuracy improvement, 20-30% faster queries, mixed retrieval strategies (vector + graph + reranker)
- **Weaknesses:** Data framework first — agent orchestration is secondary
- **Eval concerns:** Context faithfulness, hallucination, answer relevance, retrieval precision/recall

### LangChain
- **Type:** General-purpose LLM framework
- **Language:** Python + TypeScript
- **Model support:** Model-agnostic (widest ecosystem)
- **Learning curve:** Intermediate–Advanced
- **Best for:** Evolving requirements, many third-party integrations, teams wanting one framework for everything, RAG + agents + chains
- **Avoid if:** Simple well-defined use case, RAG-primary (use LlamaIndex), complex stateful workflows (use LangGraph), performance at scale is critical
- **Strengths:** Largest community and integration ecosystem, 25% faster development vs scratch, covers RAG/agents/chains/memory
- **Weaknesses:** Abstraction overhead, p99 latency degrades under load, complexity creep risk
- **Eval concerns:** End-to-end task completion, chain correctness, retrieval quality

### LangGraph
- **Type:** Stateful agent workflows (graph-based)
- **Language:** Python + TypeScript (full parity)
- **Model support:** Model-agnostic (inherits LangChain integrations)
- **Learning curve:** Intermediate–Advanced (graph mental model)
- **Best for:** Production-grade stateful workflows, regulated industries, audit trails, human-in-the-loop flows, fault-tolerant multi-step agents
- **Avoid if:** Simple chatbot, purely linear workflow, rapid prototyping
- **Strengths:** Best checkpointing (every node), time-travel debugging, native Postgres/Redis persistence, streaming support, chosen by 62% of developers for stateful agent work (2026)
- **Weaknesses:** More upfront scaffolding, steeper curve, overkill for simple cases
- **Eval concerns:** State transition correctness, goal completion rate, tool use accuracy, safety guardrails

### OpenAI Agents SDK
- **Type:** Native OpenAI agent framework
- **Language:** Python + TypeScript
- **Model support:** Optimized for OpenAI (supports 100+ via Chat Completions compatibility)
- **Learning curve:** Beginner (4 primitives: Agents, Handoffs, Guardrails, Tracing)
- **Best for:** OpenAI-committed teams, rapid agent prototyping, voice agents (gpt-realtime), teams wanting visual builder (AgentKit)
- **Avoid if:** Model flexibility needed, complex multi-agent collaboration, persistent state management required, vendor lock-in concern
- **Strengths:** Simplest mental model, built-in tracing and guardrails, Handoffs for agent delegation, Realtime Agents for voice
- **Weaknesses:** OpenAI vendor lock-in, no built-in persistent state, younger ecosystem
- **Eval concerns:** Instruction following, safety guardrails, escalation accuracy, tone consistency

### Claude Agent SDK (Anthropic)
- **Type:** Code-aware autonomous agent framework
- **Language:** Python + TypeScript
- **Model support:** Claude models only
- **Learning curve:** Intermediate (18 hook events, MCP, tool decorators)
- **Best for:** Developer tooling, code generation/review agents, autonomous coding assistants, MCP-heavy architectures, safety-critical applications
- **Avoid if:** Model flexibility needed, stable/mature API required, use case unrelated to code/tool-use
- **Strengths:** Deepest MCP integration, built-in filesystem/shell access, 18 lifecycle hooks, automatic context compaction, extended thinking, safety-first design
- **Weaknesses:** Claude-only vendor lock-in, newer/evolving API, smaller community
- **Eval concerns:** Tool use correctness, safety, code quality, instruction following

### AutoGen / AG2 / Microsoft Agent Framework
- **Type:** Multi-agent conversational framework
- **Language:** Python (AG2), Python + .NET (Microsoft Agent Framework)
- **Model support:** Model-agnostic
- **Learning curve:** Intermediate–Advanced
- **Best for:** Research applications, conversational problem-solving, code generation + execution loops, Microsoft/.NET shops
- **Avoid if:** You want ecosystem stability, deterministic workflows, or "safest long-term bet" (fragmentation risk)
- **Strengths:** Most sophisticated conversational agent patterns, code generation + execution loop, async event-driven (v0.4+), cross-language interop (Microsoft Agent Framework)
- **Weaknesses:** Ecosystem fragmented (AutoGen maintenance mode, AG2 fork, Microsoft Agent Framework preview) — genuine long-term risk
- **Eval concerns:** Conversation goal completion, consensus quality, code execution correctness

### Google ADK (Agent Development Kit)
- **Type:** Multi-agent orchestration framework
- **Language:** Python + Java
- **Model support:** Optimized for Gemini; supports other models via LiteLLM
- **Learning curve:** Intermediate (agent/tool/session model, familiar if you know LangGraph)
- **Best for:** Google Cloud / Vertex AI shops, multi-agent workflows needing built-in session management and memory, teams already committed to Gemini, agent pipelines that need Google Search / BigQuery tool integration
- **Avoid if:** Model flexibility is required beyond Gemini, no Google Cloud dependency acceptable, TypeScript-only stack
- **Strengths:** First-party Google support, built-in session/memory/artifact management, tight Vertex AI and Google Search integration, own eval framework (RAGAS-compatible), multi-agent by design (sequential, parallel, loop patterns), Java SDK for enterprise teams
- **Weaknesses:** Gemini vendor lock-in in practice, younger community than LangChain/LlamaIndex, less third-party integration depth
- **Eval concerns:** Multi-agent task decomposition, tool use correctness, session state consistency, goal completion rate

### Haystack
- **Type:** NLP pipeline framework
- **Language:** Python
- **Model support:** Model-agnostic
- **Learning curve:** Intermediate
- **Best for:** Explicit, auditable NLP pipelines, document processing with fine-grained control, enterprise search, regulated industries needing transparency
- **Avoid if:** Rapid prototyping, multi-agent workflows, or you want a large community
- **Strengths:** Explicit pipeline control, strong for structured data pipelines, good documentation
- **Weaknesses:** Smaller community, less agent-oriented than alternatives
- **Eval concerns:** Extraction accuracy, pipeline output validity, retrieval quality

---

## Decision Dimensions

### By System Type

| System Type | Primary Framework(s) | Key Eval Concerns |
|-------------|---------------------|-------------------|
| RAG / Knowledge Q&A | LlamaIndex, LangChain | Context faithfulness, hallucination, retrieval precision/recall |
| Multi-agent orchestration | CrewAI, LangGraph, Google ADK | Task decomposition, handoff quality, goal completion |
| Conversational assistants | OpenAI Agents SDK, Claude Agent SDK | Tone, safety, instruction following, escalation |
| Structured data extraction | LangChain, LlamaIndex | Schema compliance, extraction accuracy |
| Autonomous task agents | LangGraph, OpenAI Agents SDK | Safety guardrails, tool correctness, cost adherence |
| Content generation | Claude Agent SDK, OpenAI Agents SDK | Brand voice, factual accuracy, tone |
| Code automation | Claude Agent SDK | Code correctness, safety, test pass rate |

### By Team Size and Stage

| Context | Recommendation |
|---------|----------------|
| Solo dev, prototyping | OpenAI Agents SDK or CrewAI (fastest to running) |
| Solo dev, RAG | LlamaIndex (batteries included) |
| Team, production, stateful | LangGraph (best fault tolerance) |
| Team, evolving requirements | LangChain (broadest escape hatches) |
| Team, multi-agent | CrewAI (simplest role abstraction) |
| Enterprise, .NET | AutoGen AG2 / Microsoft Agent Framework |

### By Model Commitment

| Preference | Framework |
|-----------|-----------|
| OpenAI-only | OpenAI Agents SDK |
| Anthropic/Claude-only | Claude Agent SDK |
| Google/Gemini-committed | Google ADK |
| Model-agnostic (full flexibility) | LangChain, LlamaIndex, CrewAI, LangGraph, Haystack |

---

## Anti-Patterns

1. **Using LangChain for simple chatbots** — Direct SDK call is less code, faster, and easier to debug
2. **Using CrewAI for complex stateful workflows** — Checkpointing gaps will bite you in production
3. **Using OpenAI Agents SDK with non-OpenAI models** — Loses the integration benefits you chose it for
4. **Using LlamaIndex as a multi-agent framework** — It can do agents, but that's not its strength
5. **Defaulting to LangChain without evaluating alternatives** — "Everyone uses it" ≠ right for your use case
6. **Starting a new project on AutoGen (not AG2)** — AutoGen is in maintenance mode; use AG2 or wait for Microsoft Agent Framework GA
7. **Choosing LangGraph for simple linear flows** — The graph overhead is not worth it; use LangChain chains instead
8. **Ignoring vendor lock-in** — Provider-native SDKs (OpenAI, Claude) trade flexibility for integration depth; decide consciously

---

## Combination Plays (Multi-Framework Stacks)

| Production Pattern | Stack |
|-------------------|-------|
| RAG with observability | LlamaIndex + LangSmith or Langfuse |
| Stateful agent with RAG | LangGraph + LlamaIndex |
| Multi-agent with tracing | CrewAI + Langfuse |
| OpenAI agents with evals | OpenAI Agents SDK + Promptfoo or Braintrust |
| Claude agents with MCP | Claude Agent SDK + LangSmith or Arize Phoenix |
