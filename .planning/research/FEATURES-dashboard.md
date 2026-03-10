# Feature Research: GSD Web Dashboard

**Domain:** AI-powered development workflow dashboard
**Researched:** 2026-03-10
**Confidence:** MEDIUM (based on ecosystem research, PRD requirements, Claude API docs)

## Feature Landscape

This research maps features for the GSD Web Dashboard against industry patterns for AI agent orchestration UIs, real-time streaming interfaces, and developer workflow dashboards. Features are categorized by user expectation and implementation complexity.

### Table Stakes (Users Expect These)

Features users assume exist in any AI workflow dashboard. Missing these = product feels incomplete or amateur.

| Feature | Why Expected | Complexity | PRD Ref | MCP Server Dependency |
|---------|--------------|------------|---------|----------------------|
| **Real-time token streaming** | ChatGPT/Claude trained users to expect immediate response; waiting for complete responses feels broken | MEDIUM | F2.2, F4.2 | Yes - stream events from agent execution |
| **Project listing with status** | Basic dashboard requirement; users need overview before drilling down | LOW | F1.1-F1.3 | Yes - list projects, read health status |
| **Health indicator per project** | Visual status is table stakes for any monitoring dashboard | LOW | F1.2 | Yes - health check endpoint |
| **Progress percentage display** | Users expect quantifiable progress, not just "in progress" | LOW | F1.3 | Yes - state parsing endpoint |
| **Chat-style conversation UI** | Standard pattern for AI interfaces since 2023; anything else feels foreign | LOW | F2.1 | Yes - message exchange API |
| **Streaming response rendering** | [llm-ui](https://llm-ui.com/) and similar libs are standard; chunky updates feel laggy | MEDIUM | F2.2, F4.2 | Yes - SSE or WebSocket streaming |
| **WebSocket/SSE connection** | HTTP polling is obsolete for real-time; [WebSockets are the standard for AI agents](https://ably.com/blog/websockets-vs-http-for-ai-streaming-and-agents) | MEDIUM | Architecture | Yes - WebSocket server |
| **Pause/abort execution** | Users need escape hatch when AI goes wrong; [essential for HITL systems](https://docs.temporal.io/ai-cookbook/human-in-the-loop-python) | MEDIUM | F4.7 | Yes - abort endpoint |
| **Error display with context** | Generic "error occurred" is unacceptable; show what went wrong and where | LOW | F4.8 | Yes - structured error responses |
| **Syntax highlighting in code** | [Monaco Editor](https://monaco-react.surenatoyan.com/) is the standard; plain text code display looks broken | LOW | F4.5 | No - frontend only |
| **Dark mode support** | [72% of developers prefer dark mode](https://medium.com/@designstudiouiux/ai-driven-trends-in-ui-ux-design-2025-2026-7cb03e5e5324); no dark mode = unusable for target audience | LOW | F7.4 | No - frontend only |
| **Keyboard shortcuts** | Developer tools without keyboard shortcuts feel amateur | LOW | F7.5 | No - frontend only |
| **Session persistence** | Refreshing browser shouldn't lose context; [Chainlit and others handle this](https://docs.chainlit.io/get-started/overview) | MEDIUM | F2.6 | Partial - state stored server-side |

### Differentiators (Competitive Advantage)

Features that set GSD Dashboard apart from generic AI chat interfaces. These provide real value over CLI.

| Feature | Value Proposition | Complexity | PRD Ref | MCP Server Dependency |
|---------|-------------------|------------|---------|----------------------|
| **Inline tool visualization** | Show tool calls as they happen (Read, Write, Bash) in conversation flow; [Chainlit pioneered this pattern](https://deepwiki.com/Chainlit/chainlit/4-step-and-message-system) with step cards | MEDIUM | F4.3 | Yes - tool call events in stream |
| **CONTEXT.md live preview** | See decisions being captured in real-time during discuss phase; unique to GSD workflow | MEDIUM | F2.3 | Yes - file watch or generation events |
| **Wave-based execution progress** | Visualize parallel plan execution with wave grouping; maps to GSD's core value prop | MEDIUM | F3.3, F4.1 | Yes - wave metadata in execution events |
| **Checkpoint dialog modal** | Interactive pause points where AI awaits user input; [human-in-the-loop done right](https://blog.n8n.io/human-in-the-loop-automation/) | HIGH | F4.4 | Yes - checkpoint events + response endpoint |
| **File diff viewer** | Before/after code comparison with syntax highlighting; [Monaco DiffEditor](https://monaco-react.surenatoyan.com/) makes this achievable | MEDIUM | F4.5 | Yes - file change events with content |
| **Decision locking UI** | Mark decisions as locked vs discretionary; unique GSD concept | LOW | F2.4 | Yes - CONTEXT.md structure |
| **Dependency graph visualization** | Interactive node graph showing phase/plan dependencies; [React Flow](https://reactflow.dev) is ideal | HIGH | F3.8, F6.2 | Yes - roadmap parsing endpoint |
| **Gantt-style roadmap** | Timeline view of phases with progress; [DHTMLX Gantt](https://dhtmlx.com/docs/products/dhtmlxGantt-for-React/) or [SVAR Gantt](https://svar.dev/react/gantt/) | HIGH | F6.1, F6.3 | Yes - roadmap data |
| **Git commit timeline** | Show commits created during execution in timeline; reinforces tangible progress | LOW | F4.6 | Yes - git events in stream |
| **Verification gap highlighting** | Visual indication of what passed/failed in UAT; unique to GSD workflow | MEDIUM | F5.2 | Yes - verification report parsing |
| **Requirement coverage matrix** | Track which requirements are addressed by which plans; traceability visualization | MEDIUM | F3.7 | Yes - ROADMAP.md parsing |
| **Research progress streaming** | Show researcher agent spawning and completion; unique multi-agent visibility | MEDIUM | F3.1 | Yes - agent lifecycle events |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems. Explicitly NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time collaboration** | Teams want to work together | [GSD is single-developer workflow by design](docs/gsd-dashboard-prd.md#out-of-scope-v1); adds massive complexity for minimal value | Share project state via git; async collaboration |
| **Auto-retry failed executions** | "Just keep trying until it works" | Can cause loops, waste tokens, create inconsistent state; [human judgment needed for failures](https://medium.com/rose-digital/how-to-design-a-human-in-the-loop-agent-flow-without-killing-velocity-fe96a893525e) | Show clear error, let user decide retry |
| **Drag-to-reorder phases** | Visual roadmap editing sounds nice | Breaks requirement traceability, dependency ordering; roadmap changes should be deliberate | Edit ROADMAP.md directly; show warning on conflicts |
| **Automatic CONTEXT.md generation** | "AI should know what I want" | Defeats purpose of discuss phase; decisions need human input | AI suggests, human approves/locks |
| **Inline code editing during execution** | "Let me fix that file while running" | Creates race conditions with AI file writes; chaotic state | Pause execution, edit, resume |
| **Plugin/extension system** | Extensibility is always requested | Adds maintenance burden, security surface, scope creep; [out of scope for v1](docs/gsd-dashboard-prd.md#out-of-scope-v1) | Well-designed API; let community build on top |
| **Mobile native apps** | "I want it on my phone" | Development dashboards need screen real estate; mobile is secondary use case | Responsive web; touch-friendly where practical |
| **Offline mode** | "Work without internet" | AI requires API calls; offline mode is fake value | Good error handling when offline; clear status |
| **Ambient/automatic UI changes** | "Adapt to how I use it" | [Users feel disoriented when UI changes unpredictably](https://altersquare.medium.com/ui-patterns-that-dont-work-for-ai-powered-interfaces-b7547b6d45af); breaks muscle memory | Explicit settings; user-controlled layout |
| **Voice input** | "Talk to my AI assistant" | Development workflows are text-heavy; voice adds latency and ambiguity | Focus on fast keyboard input |

## Feature Dependencies

```
                        [WebSocket Server]
                              |
           +------------------+------------------+
           |                  |                  |
    [Token Streaming]  [Tool Call Events]  [Progress Events]
           |                  |                  |
           v                  v                  v
    [Chat UI]          [Inline Tool Viz]   [Progress Display]
           |                  |                  |
           +--------+---------+                  |
                    |                            |
           [Discuss Phase UI] <------------------+
                    |
                    v
           [CONTEXT.md Preview]
                    |
                    v
           [Decision Locking]


    [MCP Server API Layer]
           |
    +------+------+------+------+
    |      |      |      |      |
 [List] [Health] [State] [Roadmap] [Execute]
    |      |      |      |      |
    v      v      v      v      v
[Project Dashboard]-----+------+
                        |
                        v
              [Plan Phase UI]
                        |
         +--------------+--------------+
         |              |              |
[Research Stream] [Wave Viz] [Dep Graph]
                        |
                        v
              [Execute Phase UI]
                        |
         +--------------+--------------+
         |              |              |
[Log Streaming] [Checkpoint] [Diff Viewer]
                        |
                        v
              [Verify Phase UI]
                        |
         +--------------+--------------+
         |              |              |
[Gap Highlight] [Checklist] [Approval Flow]
```

### Dependency Notes

- **WebSocket Server required first:** All real-time features depend on bidirectional communication. Without WebSocket/SSE infrastructure, dashboard is just a fancy viewer.
- **MCP Server API is foundation:** PRD Phase 12 (MCP Server) must provide endpoints for all server-side operations. Dashboard cannot function without API layer.
- **Token streaming enables chat:** Chat UI is unusable without streaming; users won't wait 30+ seconds for complete responses.
- **Tool events enable inline viz:** Without structured tool call events from API, can only show raw text output.
- **Checkpoint events require bidirectional:** Pause/resume pattern needs both push (checkpoint reached) and pull (user response).
- **Dependency graph requires roadmap parsing:** MCP Server must parse ROADMAP.md and return structured data.

## MVP Definition

### Launch With (v1)

Core functionality that validates the dashboard concept. Without these, dashboard has no value over CLI.

- [x] **Project list + health status** (F1.1-F1.3) - Users need starting point
- [x] **Discuss phase chat with streaming** (F2.1-F2.2) - Core workflow entry point
- [x] **CONTEXT.md preview** (F2.3) - Differentiator showing value over CLI
- [x] **Plan phase with research streaming** (F3.1-F3.2) - Users see work happening
- [x] **Execute phase with log streaming** (F4.1-F4.2) - Core execution visibility
- [x] **Tool call visualization** (F4.3) - Inline steps, not just text
- [x] **Checkpoint dialog** (F4.4) - Human-in-the-loop is GSD's value prop
- [x] **Pause/abort execution** (F4.7) - Essential escape hatch
- [x] **Error display** (F4.8) - Users need to know what went wrong

**MVP rationale:** These features provide the core discuss -> plan -> execute workflow with visual enhancements that justify using dashboard over CLI.

### Add After Validation (v1.x)

Features to add once core workflow is working and users are engaged.

- [ ] **File diff viewer** (F4.5) - Add when users complain about file change visibility
- [ ] **Wave visualization** (F3.3, F4.1) - Add when parallel execution is common
- [ ] **Git commit timeline** (F4.6) - Add when users want execution history
- [ ] **Decision locking** (F2.4) - Add when users request more control
- [ ] **Plan editing** (F3.6) - Add when users want pre-execution tweaks

**Trigger:** User feedback requesting these specific capabilities; usage metrics showing workflow completion.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Gantt roadmap** (F6.1) - Complex visualization; validate simpler progress first
- [ ] **Dependency graph** (F3.8, F6.2) - React Flow integration; high effort
- [ ] **Verification UI** (F5.1-F5.5) - Full UAT workflow; can use CLI initially
- [ ] **Settings management** (F7.1-F7.5) - Config in files works; UI is convenience
- [ ] **Debug session UI** (F8.1-F8.4) - Specialized workflow; lower priority

**Deferral rationale:** These features add polish but don't validate core value. Users can fall back to CLI for these workflows initially.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | MCP Dependency |
|---------|------------|---------------------|----------|----------------|
| Real-time streaming | HIGH | MEDIUM | P1 | Yes |
| Project dashboard | HIGH | LOW | P1 | Yes |
| Chat conversation UI | HIGH | LOW | P1 | Yes |
| Tool call visualization | HIGH | MEDIUM | P1 | Yes |
| Checkpoint dialogs | HIGH | HIGH | P1 | Yes |
| CONTEXT.md preview | MEDIUM | MEDIUM | P1 | Yes |
| Pause/abort | HIGH | MEDIUM | P1 | Yes |
| Error handling | HIGH | LOW | P1 | Yes |
| File diff viewer | MEDIUM | MEDIUM | P2 | Yes |
| Wave visualization | MEDIUM | MEDIUM | P2 | Yes |
| Git timeline | LOW | LOW | P2 | Yes |
| Decision locking | MEDIUM | LOW | P2 | Yes |
| Gantt roadmap | MEDIUM | HIGH | P3 | Yes |
| Dependency graph | MEDIUM | HIGH | P3 | Yes |
| Verification UI | MEDIUM | MEDIUM | P3 | Yes |
| Settings UI | LOW | LOW | P3 | Partial |
| Debug UI | LOW | MEDIUM | P3 | Yes |

**Priority key:**
- P1: Must have for launch (validates core concept)
- P2: Should have, add when possible (enhances core workflows)
- P3: Nice to have, future consideration (polish and completeness)

## Competitor Feature Analysis

| Feature | Claude Web | Cursor | VS Code + Copilot | GSD Dashboard (Target) |
|---------|------------|--------|-------------------|------------------------|
| Token streaming | Yes | Yes | Yes | Yes |
| Tool visualization | Limited (artifacts) | Inline | Inline | Inline with cards |
| Progress tracking | No | No | No | Yes (wave/plan level) |
| Checkpoint handling | No (auto-approve) | Yes | No | Yes (explicit dialogs) |
| Multi-file context | Artifacts | Composer | Workspace | Phase-scoped |
| Roadmap view | No | No | No | Yes (Gantt + graph) |
| Verification workflow | No | No | No | Yes (UAT flow) |
| Git integration | No | Limited | Extension | Native (timeline) |
| State persistence | Session | Project | Workspace | .planning/ directory |
| Diff viewer | No | Yes | Yes | Yes (Monaco) |

**GSD Dashboard advantages:**
1. **Workflow-native progress:** Not just chat; visualizes multi-phase development workflow
2. **Checkpoint-first design:** Human-in-the-loop is core pattern, not afterthought
3. **Research visibility:** Shows what AI is learning, not just outputting
4. **Requirement traceability:** Plans link back to requirements; unique to GSD

## Technology Patterns from Research

### Real-Time Streaming

**Recommended approach:** [Vercel AI SDK](https://ai-sdk.dev/docs/foundations/streaming) provides unified streaming abstraction.

- Use SSE for one-way streaming (token output)
- Use WebSocket for bidirectional (checkpoints, tool responses)
- [llm-ui](https://llm-ui.com/) for smooth character-by-character rendering
- Implement skeleton loaders for perceived performance

### Tool Visualization

**Recommended approach:** [Chainlit step pattern](https://deepwiki.com/Chainlit/chainlit/4-step-and-message-system)

- Tool calls appear as collapsible cards in conversation
- Show input, output, timing for each tool
- Progressive disclosure: summary by default, expand for details
- Streaming tool input via [fine-grained tool streaming](https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming)

### Checkpoint Handling

**Recommended approach:** [LangGraph interrupt pattern](https://docs.langchain.com/oss/python/langgraph/interrupts)

- Server sends checkpoint event with type and context
- UI shows modal dialog blocking further output
- User response sent via Command pattern
- State persisted for resume across browser refresh

### Graph Visualization

**Recommended approach:** [React Flow](https://reactflow.dev) for dependency graphs

- Custom nodes for phases/plans
- Edges show dependencies with types (requires, conflicts)
- Interactive: click to navigate, hover for details
- Async layout for large graphs

### Gantt Visualization

**Recommended approach:** [SVAR Gantt](https://svar.dev/react/gantt/) (open source) or [DHTMLX](https://dhtmlx.com/docs/products/dhtmlxGantt-for-React/) (more features)

- Phase as parent tasks, plans as subtasks
- Dependencies shown as connecting arrows
- Progress bar per phase
- Click to navigate to phase details

## Sources

### Official Documentation
- [Vercel AI SDK Streaming](https://ai-sdk.dev/docs/foundations/streaming)
- [Claude API Fine-Grained Tool Streaming](https://platform.claude.com/docs/en/agents-and-tools/tool-use/fine-grained-tool-streaming)
- [LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [MCP Apps UI Extension](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)

### Libraries and Frameworks
- [llm-ui - React library for LLMs](https://llm-ui.com/)
- [Chainlit - Build Conversational AI](https://docs.chainlit.io/get-started/overview)
- [React Flow - Node-based UIs](https://reactflow.dev)
- [Monaco Editor React](https://monaco-react.surenatoyan.com/)
- [SVAR React Gantt](https://svar.dev/react/gantt/)

### Architecture Patterns
- [WebSockets vs HTTP for AI Streaming](https://ably.com/blog/websockets-vs-http-for-ai-streaming-and-agents)
- [Human-in-the-Loop AI Agent (Temporal)](https://docs.temporal.io/ai-cookbook/human-in-the-loop-python)
- [Human in the Loop Automation (n8n)](https://blog.n8n.io/human-in-the-loop-automation/)
- [AI Agent Orchestration Patterns (Azure)](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns)

### Anti-Pattern Research
- [UI Patterns That Don't Work for AI Interfaces](https://altersquare.medium.com/ui-patterns-that-dont-work-for-ai-powered-interfaces-b7547b6d45af)
- [Human-in-the-Loop Agent Flow Design](https://medium.com/rose-digital/how-to-design-a-human-in-the-loop-agent-flow-without-killing-velocity-fe96a893525e)
- [AI-Driven Trends in UI/UX Design 2025-2026](https://medium.com/@designstudiouiux/ai-driven-trends-in-ui-ux-design-2025-2026-7cb03e5e5324)

### Competitor Analysis
- [Cursor vs GitHub Copilot 2026](https://www.digitalocean.com/resources/articles/github-copilot-vs-cursor)
- [7 Best UI Frameworks for AI Agents](https://fast.io/resources/best-ui-frameworks-ai-agents/)

---
*Feature research for: GSD Web Dashboard*
*Researched: 2026-03-10*
