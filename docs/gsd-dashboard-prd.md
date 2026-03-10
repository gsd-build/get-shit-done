# GSD Web Dashboard - Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-10
**Author:** Maurice van der Merwe
**Status:** Draft

---

## Executive Summary

The GSD Web Dashboard is a feature-rich web application that provides a visual interface for the GSD (Get Shit Done) workflow system. It replicates and enhances the Claude Code CLI experience, enabling users to discuss, plan, and execute development phases through an intuitive browser-based UI with real-time AI agent orchestration.

---

## Problem Statement

Currently, GSD operates exclusively through Claude Code's CLI interface. While powerful, this presents barriers:

1. **Learning curve** - Users must learn slash commands and workflow patterns
2. **No visual progress tracking** - Progress is text-based, hard to scan
3. **Limited collaboration** - Single-user CLI sessions
4. **No persistent dashboard** - Can't glance at project status without opening Claude Code
5. **Context switching** - Must switch between IDE and Claude Code terminal

---

## Goals & Success Metrics

### Goals
1. Provide full GSD workflow capability via web UI
2. Real-time streaming of AI agent output
3. Visual progress tracking across projects/phases
4. Interactive checkpoint handling
5. Roadmap and dependency visualization

### Success Metrics
| Metric | Target |
|--------|--------|
| Feature parity with CLI | 100% of core workflows |
| Time to complete discuss-phase | Equal or faster than CLI |
| User satisfaction | 4.5/5 rating |
| Concurrent project support | 10+ projects |

---

## User Personas

### Primary: Solo Developer
- Uses GSD for personal projects
- Wants visual progress tracking
- Values keyboard shortcuts and efficiency

### Secondary: Tech Lead
- Manages multiple GSD projects
- Needs dashboard overview of team progress
- Delegates execution to team members

### Tertiary: New GSD User
- Learning the GSD workflow
- Benefits from visual guidance
- Needs clear next-action prompts

---

## Core Features

### F1: Project Dashboard
**Priority:** P0 (Must Have)

Display all GSD projects with status at a glance.

**Requirements:**
- F1.1: List all projects with .planning/ directories
- F1.2: Show health status indicator per project (healthy/degraded/error)
- F1.3: Display current phase and progress percentage
- F1.4: Show recent activity feed (last 5 actions)
- F1.5: Quick actions: Open, Health Check, Progress
- F1.6: Search/filter projects by name or status

**Acceptance Criteria:**
- [ ] Projects load within 2 seconds
- [ ] Health status updates in real-time
- [ ] Click project to navigate to project view

---

### F2: Discuss Phase (Context Gathering)
**Priority:** P0 (Must Have)

Interactive chat interface for gathering phase context before planning.

**Requirements:**
- F2.1: Chat-style conversation with Claude
- F2.2: Real-time streaming of Claude responses
- F2.3: Live preview of CONTEXT.md being generated
- F2.4: Decision locking UI (mark decisions as locked vs discretionary)
- F2.5: Phase boundary visualization
- F2.6: Save/resume discussion sessions
- F2.7: Manual edit of CONTEXT.md with sync

**Acceptance Criteria:**
- [ ] Responses stream in real-time (no waiting for complete response)
- [ ] CONTEXT.md preview updates as conversation progresses
- [ ] Can lock/unlock individual decisions
- [ ] Session persists across browser refresh

---

### F3: Plan Phase
**Priority:** P0 (Must Have)

Research, planning, and verification workflow with visual feedback.

**Requirements:**
- F3.1: Research progress streaming with status indicators
- F3.2: Research output preview (RESEARCH.md)
- F3.3: Plan generation with wave visualization
- F3.4: Plan preview with task breakdown
- F3.5: Verification loop feedback (issues found → revision)
- F3.6: Edit plans before execution
- F3.7: Requirement coverage matrix
- F3.8: Dependency graph visualization

**Acceptance Criteria:**
- [ ] Research phase shows progress (spawning researcher → complete)
- [ ] Plans display with wave grouping
- [ ] Can edit plan tasks inline
- [ ] Verification issues highlight specific plans

---

### F4: Execute Phase
**Priority:** P0 (Must Have)

Real-time execution with streaming output and checkpoint handling.

**Requirements:**
- F4.1: Wave-based execution progress UI
- F4.2: Real-time log streaming per plan
- F4.3: Tool use visualization (Read, Write, Bash, etc.)
- F4.4: Checkpoint dialog with response input
- F4.5: File diff viewer (before/after)
- F4.6: Git commit timeline
- F4.7: Pause/resume execution
- F4.8: Error recovery UI

**Acceptance Criteria:**
- [ ] Logs stream in real-time with <100ms latency
- [ ] Checkpoints pause UI and await user input
- [ ] File changes show diff with syntax highlighting
- [ ] Can abort execution gracefully

---

### F5: Verify Work (UAT)
**Priority:** P1 (Should Have)

User acceptance testing workflow with visual checklists.

**Requirements:**
- F5.1: Verification report viewer
- F5.2: Gap highlighting with severity
- F5.3: Manual testing checklist
- F5.4: Approve/reject workflow
- F5.5: Gap closure routing (→ plan-phase --gaps)

**Acceptance Criteria:**
- [ ] Verification results display clearly
- [ ] Can mark manual tests as pass/fail
- [ ] Gap closure creates new phase automatically

---

### F6: Roadmap Visualizer
**Priority:** P1 (Should Have)

Visual representation of project roadmap and progress.

**Requirements:**
- F6.1: Gantt-style phase timeline
- F6.2: Dependency graph (phase → phase)
- F6.3: Progress tracking per phase
- F6.4: Milestone grouping
- F6.5: Click-to-navigate to phase
- F6.6: Drag-to-reorder phases (future)

**Acceptance Criteria:**
- [ ] Roadmap renders within 1 second
- [ ] Dependencies shown as connecting lines
- [ ] Completed phases visually distinct

---

### F7: Settings & Configuration
**Priority:** P2 (Nice to Have)

Project and global settings management.

**Requirements:**
- F7.1: Model profile selection (quality/balanced/budget)
- F7.2: Workflow toggles (research, verification, etc.)
- F7.3: API key management
- F7.4: Theme selection (light/dark)
- F7.5: Keyboard shortcut customization

---

### F8: Debug Session Support
**Priority:** P2 (Nice to Have)

Visual debugging workflow integration.

**Requirements:**
- F8.1: Debug session creation
- F8.2: Hypothesis tracking
- F8.3: Evidence collection UI
- F8.4: Session history

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     GSD Web Dashboard                        │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React + TypeScript)                              │
│  ├── Components (Dashboard, Discuss, Plan, Execute, etc.)  │
│  ├── State Management (Zustand)                             │
│  ├── Real-time (Socket.io-client)                           │
│  └── UI Framework (TailwindCSS + shadcn/ui)                 │
├─────────────────────────────────────────────────────────────┤
│  Backend (Node.js + Express)                                │
│  ├── REST API (/api/projects, /api/phases, etc.)           │
│  ├── WebSocket Server (Socket.io)                           │
│  ├── Job Queue (BullMQ + Redis)                             │
│  ├── Agent Orchestrator (Claude API integration)            │
│  └── GSD Lib Integration (direct require)                   │
├─────────────────────────────────────────────────────────────┤
│  External Services                                          │
│  ├── Claude API (Anthropic SDK)                             │
│  ├── File System (.planning/, project files)                │
│  └── Git (commits, branches, worktrees)                     │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend Framework | React 18 | Industry standard, large ecosystem |
| Language | TypeScript | Type safety, better DX |
| Styling | TailwindCSS + shadcn/ui | Rapid development, consistent design |
| State Management | Zustand | Lightweight, simple API |
| Code Editor | Monaco Editor | VS Code parity |
| Graphs | React Flow | Interactive node graphs |
| Backend Framework | Express/Fastify | Mature, well-supported |
| Real-time | Socket.io | Reliable WebSocket abstraction |
| Job Queue | BullMQ | Redis-backed, robust |
| AI Integration | Anthropic SDK | Official Claude API |
| Database | SQLite (dev) / PostgreSQL (prod) | Simple to complex scaling |

### Data Flow

```
User Action → WebSocket Event → Backend Handler → Agent Orchestrator
     ↑                                                    │
     │                                                    ▼
     │                                              Claude API
     │                                                    │
     │                                                    ▼
     │                                              Tool Execution
     │                                                    │
     └──────────────── WebSocket Event ◄──────────────────┘
```

### Agent Orchestration

The backend must replicate Claude Code's agent spawning:

1. **Load agent prompt** from GSD agents directory
2. **Create Claude API message** with system prompt + tools
3. **Stream response** via WebSocket to frontend
4. **Execute tool calls** against file system
5. **Handle checkpoints** by pausing and awaiting user input
6. **Collect results** and update state

---

## API Specification

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/projects | List all GSD projects |
| GET | /api/projects/:id | Get project details |
| GET | /api/projects/:id/status | Get project status/health |
| GET | /api/projects/:id/roadmap | Get parsed roadmap |
| GET | /api/projects/:id/state | Get parsed state |
| GET | /api/projects/:id/phases | List phases |
| GET | /api/projects/:id/phases/:num | Get phase details |
| GET | /api/projects/:id/phases/:num/plans | Get phase plans |
| POST | /api/projects/:id/health | Run health check |

### WebSocket Events

#### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| project:open | { path: string } | Open project for real-time updates |
| discuss:start | { phase: number } | Start discuss-phase workflow |
| discuss:message | { message: string } | Send user message in discussion |
| plan:start | { phase: number, flags?: string[] } | Start plan-phase workflow |
| execute:start | { phase: number } | Start execute-phase workflow |
| execute:checkpoint | { response: string } | Respond to checkpoint |
| execute:abort | {} | Abort current execution |

#### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| agent:thinking | { agent: string } | Agent is processing |
| agent:output | { content: string } | Streaming text output |
| agent:tool | { tool: string, input: any, output: any } | Tool execution |
| agent:complete | { status: string } | Agent finished |
| checkpoint | { type: string, details: any } | Checkpoint reached |
| progress | { phase: number, plan?: string, percent: number } | Progress update |
| error | { code: string, message: string } | Error occurred |
| file:changed | { path: string, type: 'create'|'modify'|'delete' } | File changed |
| git:commit | { hash: string, message: string } | Commit created |

---

## Security Considerations

1. **API Key Storage** - Claude API keys stored securely, never exposed to frontend
2. **File System Access** - Sandboxed to project directories only
3. **Command Execution** - Bash commands validated and sandboxed
4. **Authentication** - Optional auth layer for multi-user deployments
5. **CORS** - Strict origin policy

---

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Initial load time | < 3 seconds |
| WebSocket latency | < 100ms |
| Concurrent users | 10 (single instance) |
| Browser support | Chrome, Firefox, Safari, Edge (latest 2 versions) |
| Mobile support | Responsive, touch-friendly |
| Accessibility | WCAG 2.1 AA |

---

## Out of Scope (v1)

1. Multi-user collaboration (real-time shared sessions)
2. Cloud deployment/hosting service
3. Mobile native apps
4. Offline mode
5. Plugin/extension system
6. Git provider integrations (GitHub, GitLab UI)

---

## Milestones

| Milestone | Duration | Deliverables |
|-----------|----------|--------------|
| M1: Foundation | 2 weeks | Project scaffold, backend API, basic frontend |
| M2: Dashboard | 1 week | Project list, health status, progress views |
| M3: Discuss Phase | 2 weeks | Chat UI, streaming, CONTEXT.md generation |
| M4: Plan Phase | 2 weeks | Research, planning, verification UI |
| M5: Execute Phase | 2 weeks | Execution UI, streaming, checkpoints |
| M6: Polish | 1 week | Verification, roadmap viz, settings |

**Total estimated duration: 10 weeks**

---

## Appendix

### A. Wireframes

(To be added)

### B. Related Documents

- GSD CLI Documentation
- MCP Server API (Phase 12)
- Claude API Reference

### C. Glossary

| Term | Definition |
|------|------------|
| GSD | Get Shit Done - AI-assisted development workflow system |
| Phase | A unit of work in the roadmap (e.g., "Phase 5: Core Infrastructure") |
| Plan | An executable task document within a phase (e.g., "05-01-PLAN.md") |
| Wave | A group of plans that can execute in parallel |
| Checkpoint | A pause point requiring user input during execution |
| CONTEXT.md | User decisions and preferences captured during discuss-phase |
