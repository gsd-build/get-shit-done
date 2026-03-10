# GSD Web Dashboard - Technical Specification

**Version:** 1.0
**Date:** 2026-03-10
**Status:** Draft

---

## 1. Overview

This document provides the technical specification for implementing the GSD Web Dashboard, a browser-based interface for the GSD workflow system.

---

## 2. Repository Structure

```
gsd-dashboard/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # CI pipeline
│       └── deploy.yml             # Deployment
├── packages/
│   ├── web/                       # Frontend application
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── app/               # Next.js app router
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx       # Dashboard
│   │   │   │   ├── projects/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   ├── discuss/
│   │   │   │   │   │   ├── plan/
│   │   │   │   │   │   ├── execute/
│   │   │   │   │   │   └── roadmap/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── settings/
│   │   │   ├── components/
│   │   │   │   ├── ui/            # shadcn/ui components
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── ProjectCard.tsx
│   │   │   │   │   ├── ProjectList.tsx
│   │   │   │   │   ├── ActivityFeed.tsx
│   │   │   │   │   └── QuickActions.tsx
│   │   │   │   ├── discuss/
│   │   │   │   │   ├── ChatPanel.tsx
│   │   │   │   │   ├── ChatMessage.tsx
│   │   │   │   │   ├── ChatInput.tsx
│   │   │   │   │   ├── ContextPreview.tsx
│   │   │   │   │   └── DecisionLock.tsx
│   │   │   │   ├── plan/
│   │   │   │   │   ├── ResearchProgress.tsx
│   │   │   │   │   ├── PlanPreview.tsx
│   │   │   │   │   ├── WaveVisualization.tsx
│   │   │   │   │   ├── VerificationLoop.tsx
│   │   │   │   │   └── RequirementMatrix.tsx
│   │   │   │   ├── execute/
│   │   │   │   │   ├── ExecutionPanel.tsx
│   │   │   │   │   ├── WaveProgress.tsx
│   │   │   │   │   ├── LogStream.tsx
│   │   │   │   │   ├── ToolUseCard.tsx
│   │   │   │   │   ├── CheckpointDialog.tsx
│   │   │   │   │   ├── FileDiffViewer.tsx
│   │   │   │   │   └── CommitTimeline.tsx
│   │   │   │   ├── roadmap/
│   │   │   │   │   ├── RoadmapGantt.tsx
│   │   │   │   │   ├── DependencyGraph.tsx
│   │   │   │   │   └── PhaseCard.tsx
│   │   │   │   └── common/
│   │   │   │       ├── Header.tsx
│   │   │   │       ├── Sidebar.tsx
│   │   │   │       ├── StatusBadge.tsx
│   │   │   │       └── ProgressBar.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useSocket.ts
│   │   │   │   ├── useProject.ts
│   │   │   │   ├── usePhase.ts
│   │   │   │   └── useAgent.ts
│   │   │   ├── stores/
│   │   │   │   ├── projectStore.ts
│   │   │   │   ├── discussStore.ts
│   │   │   │   ├── executeStore.ts
│   │   │   │   └── settingsStore.ts
│   │   │   ├── lib/
│   │   │   │   ├── api.ts
│   │   │   │   ├── socket.ts
│   │   │   │   └── utils.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── tailwind.config.ts
│   │   ├── next.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── server/                    # Backend application
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point
│   │   │   ├── app.ts             # Express app setup
│   │   │   ├── api/
│   │   │   │   ├── routes.ts
│   │   │   │   ├── projects.ts
│   │   │   │   ├── phases.ts
│   │   │   │   └── health.ts
│   │   │   ├── ws/
│   │   │   │   ├── index.ts
│   │   │   │   ├── handlers.ts
│   │   │   │   └── events.ts
│   │   │   ├── agents/
│   │   │   │   ├── orchestrator.ts
│   │   │   │   ├── tools.ts
│   │   │   │   ├── prompts.ts
│   │   │   │   └── types.ts
│   │   │   ├── jobs/
│   │   │   │   ├── queue.ts
│   │   │   │   ├── discuss.ts
│   │   │   │   ├── plan.ts
│   │   │   │   └── execute.ts
│   │   │   ├── gsd/
│   │   │   │   ├── wrapper.ts     # GSD lib wrapper
│   │   │   │   ├── state.ts
│   │   │   │   ├── roadmap.ts
│   │   │   │   └── phase.ts
│   │   │   ├── services/
│   │   │   │   ├── claude.ts
│   │   │   │   ├── git.ts
│   │   │   │   └── files.ts
│   │   │   └── utils/
│   │   │       ├── logger.ts
│   │   │       └── errors.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── shared/                    # Shared types and utilities
│       ├── src/
│       │   ├── types.ts
│       │   ├── events.ts
│       │   └── constants.ts
│       ├── tsconfig.json
│       └── package.json
│
├── docker/
│   ├── Dockerfile.web
│   ├── Dockerfile.server
│   └── docker-compose.yml
├── scripts/
│   ├── dev.sh
│   └── build.sh
├── turbo.json                     # Turborepo config
├── package.json                   # Root package.json
├── pnpm-workspace.yaml
└── README.md
```

---

## 3. Frontend Architecture

### 3.1 State Management

Using Zustand for lightweight, performant state management:

```typescript
// stores/projectStore.ts
import { create } from 'zustand';
import { Project, Phase, HealthStatus } from '@gsd-dashboard/shared';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchProjects: () => Promise<void>;
  selectProject: (id: string) => void;
  refreshHealth: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/projects');
      const projects = await response.json();
      set({ projects, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  selectProject: (id) => {
    const project = get().projects.find(p => p.id === id);
    set({ currentProject: project });
  },

  refreshHealth: async (id) => {
    const response = await fetch(`/api/projects/${id}/health`, { method: 'POST' });
    const health = await response.json();
    set(state => ({
      projects: state.projects.map(p =>
        p.id === id ? { ...p, health } : p
      )
    }));
  },
}));
```

### 3.2 WebSocket Integration

```typescript
// hooks/useSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@gsd-dashboard/shared';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function useSocket() {
  const socketRef = useRef<TypedSocket | null>(null);

  useEffect(() => {
    socketRef.current = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
      transports: ['websocket'],
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const emit = useCallback(<E extends keyof ClientToServerEvents>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]>
  ) => {
    socketRef.current?.emit(event, ...args);
  }, []);

  const on = useCallback(<E extends keyof ServerToClientEvents>(
    event: E,
    handler: ServerToClientEvents[E]
  ) => {
    socketRef.current?.on(event, handler as any);
    return () => socketRef.current?.off(event, handler as any);
  }, []);

  return { emit, on, socket: socketRef.current };
}
```

### 3.3 Key Components

#### ChatPanel (Discuss Phase)

```typescript
// components/discuss/ChatPanel.tsx
import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useDiscussStore } from '@/stores/discussStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ContextPreview } from './ContextPreview';

interface Props {
  projectId: string;
  phase: number;
}

export function ChatPanel({ projectId, phase }: Props) {
  const { messages, context, addMessage, updateContext } = useDiscussStore();
  const [isThinking, setIsThinking] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { emit, on } = useSocket();

  useEffect(() => {
    const unsubOutput = on('agent:output', ({ content }) => {
      setStreamingContent(prev => prev + content);
    });

    const unsubComplete = on('agent:complete', ({ status }) => {
      if (streamingContent) {
        addMessage({ role: 'assistant', content: streamingContent });
        setStreamingContent('');
      }
      setIsThinking(false);
    });

    const unsubContext = on('context:updated', (data) => {
      updateContext(data);
    });

    // Start discussion
    emit('discuss:start', { projectId, phase });

    return () => {
      unsubOutput();
      unsubComplete();
      unsubContext();
    };
  }, [projectId, phase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = (content: string) => {
    addMessage({ role: 'user', content });
    setIsThinking(true);
    emit('discuss:message', { message: content });
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}
          {streamingContent && (
            <ChatMessage
              message={{ role: 'assistant', content: streamingContent }}
              isStreaming
            />
          )}
          {isThinking && !streamingContent && <ThinkingIndicator />}
          <div ref={messagesEndRef} />
        </div>
        <ChatInput onSend={handleSend} disabled={isThinking} />
      </div>
      <div className="w-96 border-l bg-muted/30">
        <ContextPreview context={context} />
      </div>
    </div>
  );
}
```

#### ExecutionPanel

```typescript
// components/execute/ExecutionPanel.tsx
import { useState, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useExecuteStore } from '@/stores/executeStore';
import { WaveProgress } from './WaveProgress';
import { LogStream } from './LogStream';
import { CheckpointDialog } from './CheckpointDialog';
import { FileDiffViewer } from './FileDiffViewer';

interface Props {
  projectId: string;
  phase: number;
}

export function ExecutionPanel({ projectId, phase }: Props) {
  const {
    waves,
    logs,
    checkpoint,
    changedFiles,
    addLog,
    setCheckpoint,
    addChangedFile,
    updateWaveStatus
  } = useExecuteStore();

  const { emit, on } = useSocket();

  useEffect(() => {
    const handlers = [
      on('wave:start', ({ wave, plans }) => {
        updateWaveStatus(wave, 'running', plans);
      }),
      on('agent:output', ({ content }) => {
        addLog({ type: 'output', content, timestamp: Date.now() });
      }),
      on('agent:tool', ({ tool, input, output }) => {
        addLog({ type: 'tool', tool, input, output, timestamp: Date.now() });
        if (tool === 'Write' || tool === 'Edit') {
          addChangedFile(input.path);
        }
      }),
      on('checkpoint', (data) => {
        setCheckpoint(data);
      }),
      on('wave:complete', ({ wave, status }) => {
        updateWaveStatus(wave, status);
      }),
    ];

    emit('execute:start', { projectId, phase });

    return () => handlers.forEach(unsub => unsub());
  }, [projectId, phase]);

  const handleCheckpointResponse = (response: string) => {
    emit('execute:checkpoint', { response });
    setCheckpoint(null);
  };

  const handleAbort = () => {
    emit('execute:abort', {});
  };

  return (
    <div className="flex h-full">
      <div className="w-64 border-r p-4 bg-muted/30">
        <WaveProgress waves={waves} />
        <button
          onClick={handleAbort}
          className="mt-4 w-full btn btn-destructive"
        >
          Abort Execution
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        {checkpoint ? (
          <CheckpointDialog
            checkpoint={checkpoint}
            onRespond={handleCheckpointResponse}
          />
        ) : (
          <LogStream logs={logs} />
        )}
      </div>

      <div className="w-80 border-l">
        <FileDiffViewer files={changedFiles} projectId={projectId} />
      </div>
    </div>
  );
}
```

---

## 4. Backend Architecture

### 4.1 Express App Setup

```typescript
// server/src/app.ts
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { projectRoutes } from './api/projects';
import { phaseRoutes } from './api/phases';
import { setupWebSocket } from './ws';
import { errorHandler } from './utils/errors';

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  // Middleware
  app.use(cors());
  app.use(express.json());

  // REST API routes
  app.use('/api/projects', projectRoutes);
  app.use('/api/projects/:projectId/phases', phaseRoutes);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // WebSocket setup
  setupWebSocket(io);

  // Error handling
  app.use(errorHandler);

  return { app, httpServer, io };
}
```

### 4.2 Agent Orchestrator

```typescript
// server/src/agents/orchestrator.ts
import Anthropic from '@anthropic-ai/sdk';
import { Socket } from 'socket.io';
import { loadAgentPrompt } from './prompts';
import { getToolsForAgent, executeTool } from './tools';
import { ToolResult, AgentType, AgentContext } from './types';

export class AgentOrchestrator {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async runAgent(
    agentType: AgentType,
    userPrompt: string,
    context: AgentContext,
    socket: Socket
  ): Promise<void> {
    const systemPrompt = await loadAgentPrompt(agentType);
    const tools = getToolsForAgent(agentType);

    socket.emit('agent:thinking', { agent: agentType });

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userPrompt }
    ];

    let continueLoop = true;

    while (continueLoop) {
      const response = await this.client.messages.create({
        model: context.model || 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        messages,
        tools,
        stream: true,
      });

      let assistantContent: Anthropic.ContentBlock[] = [];
      let currentToolUse: { id: string; name: string; input: string } | null = null;

      for await (const event of response) {
        switch (event.type) {
          case 'content_block_start':
            if (event.content_block.type === 'tool_use') {
              currentToolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                input: '',
              };
            }
            break;

          case 'content_block_delta':
            if (event.delta.type === 'text_delta') {
              socket.emit('agent:output', { content: event.delta.text });
            } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
              currentToolUse.input += event.delta.partial_json;
            }
            break;

          case 'content_block_stop':
            if (currentToolUse) {
              const input = JSON.parse(currentToolUse.input);

              // Check for checkpoint
              if (this.isCheckpoint(currentToolUse.name, input)) {
                socket.emit('checkpoint', {
                  type: input.type || 'verification',
                  details: input,
                });

                // Wait for user response
                const response = await this.waitForCheckpointResponse(socket);

                // Continue with response
                assistantContent.push({
                  type: 'tool_use',
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                  input,
                });

                messages.push({ role: 'assistant', content: assistantContent });
                messages.push({
                  role: 'user',
                  content: [{
                    type: 'tool_result',
                    tool_use_id: currentToolUse.id,
                    content: response,
                  }],
                });

                assistantContent = [];
              } else {
                // Execute tool
                const result = await executeTool(
                  currentToolUse.name,
                  input,
                  context
                );

                socket.emit('agent:tool', {
                  tool: currentToolUse.name,
                  input,
                  output: result,
                });

                assistantContent.push({
                  type: 'tool_use',
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                  input,
                });

                messages.push({ role: 'assistant', content: assistantContent });
                messages.push({
                  role: 'user',
                  content: [{
                    type: 'tool_result',
                    tool_use_id: currentToolUse.id,
                    content: JSON.stringify(result),
                  }],
                });

                assistantContent = [];
              }
              currentToolUse = null;
            }
            break;

          case 'message_stop':
            if (response.stop_reason === 'end_turn') {
              continueLoop = false;
            }
            break;
        }
      }
    }

    socket.emit('agent:complete', { status: 'success' });
  }

  private isCheckpoint(toolName: string, input: any): boolean {
    return toolName === 'AskUserQuestion' ||
           (toolName === 'checkpoint' && input.type);
  }

  private waitForCheckpointResponse(socket: Socket): Promise<string> {
    return new Promise((resolve) => {
      socket.once('execute:checkpoint', ({ response }) => {
        resolve(response);
      });
    });
  }
}
```

### 4.3 Tool Execution

```typescript
// server/src/agents/tools.ts
import fs from 'fs/promises';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { AgentContext, ToolResult } from './types';

export async function executeTool(
  name: string,
  input: any,
  context: AgentContext
): Promise<ToolResult> {
  const { projectPath } = context;

  switch (name) {
    case 'Read': {
      const filePath = path.resolve(projectPath, input.file_path);
      // Security: Ensure path is within project
      if (!filePath.startsWith(projectPath)) {
        return { error: 'Path outside project directory' };
      }
      const content = await fs.readFile(filePath, 'utf-8');
      return { content };
    }

    case 'Write': {
      const filePath = path.resolve(projectPath, input.file_path);
      if (!filePath.startsWith(projectPath)) {
        return { error: 'Path outside project directory' };
      }
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, input.content);
      return { success: true, path: input.file_path };
    }

    case 'Edit': {
      const filePath = path.resolve(projectPath, input.file_path);
      if (!filePath.startsWith(projectPath)) {
        return { error: 'Path outside project directory' };
      }
      const content = await fs.readFile(filePath, 'utf-8');
      const newContent = content.replace(input.old_string, input.new_string);
      await fs.writeFile(filePath, newContent);
      return { success: true, path: input.file_path };
    }

    case 'Bash': {
      try {
        const output = execSync(input.command, {
          cwd: projectPath,
          encoding: 'utf-8',
          timeout: input.timeout || 30000,
          maxBuffer: 10 * 1024 * 1024,
        });
        return { output };
      } catch (error: any) {
        return {
          error: error.message,
          stdout: error.stdout,
          stderr: error.stderr,
        };
      }
    }

    case 'Glob': {
      const { glob } = await import('glob');
      const matches = await glob(input.pattern, {
        cwd: projectPath,
        nodir: true,
      });
      return { files: matches };
    }

    case 'Grep': {
      const { glob } = await import('glob');
      const files = await glob(input.pattern || '**/*', {
        cwd: projectPath,
        nodir: true,
        ignore: ['node_modules/**', '.git/**'],
      });

      const results: Array<{ file: string; line: number; content: string }> = [];

      for (const file of files.slice(0, 100)) { // Limit files searched
        try {
          const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
          const lines = content.split('\n');
          lines.forEach((line, i) => {
            if (line.includes(input.query)) {
              results.push({ file, line: i + 1, content: line.trim() });
            }
          });
        } catch {
          // Skip unreadable files
        }
      }

      return { matches: results.slice(0, 50) };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export function getToolsForAgent(agentType: string): Anthropic.Tool[] {
  const baseTools: Anthropic.Tool[] = [
    {
      name: 'Read',
      description: 'Read a file from the project',
      input_schema: {
        type: 'object',
        properties: {
          file_path: { type: 'string', description: 'Path to the file' },
        },
        required: ['file_path'],
      },
    },
    {
      name: 'Glob',
      description: 'Find files matching a pattern',
      input_schema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern' },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'Grep',
      description: 'Search file contents',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          pattern: { type: 'string', description: 'File pattern to search' },
        },
        required: ['query'],
      },
    },
  ];

  const writeTools: Anthropic.Tool[] = [
    {
      name: 'Write',
      description: 'Write a file to the project',
      input_schema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['file_path', 'content'],
      },
    },
    {
      name: 'Edit',
      description: 'Edit a file by replacing text',
      input_schema: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          old_string: { type: 'string' },
          new_string: { type: 'string' },
        },
        required: ['file_path', 'old_string', 'new_string'],
      },
    },
    {
      name: 'Bash',
      description: 'Run a shell command',
      input_schema: {
        type: 'object',
        properties: {
          command: { type: 'string' },
          timeout: { type: 'number' },
        },
        required: ['command'],
      },
    },
  ];

  switch (agentType) {
    case 'researcher':
      return [...baseTools];
    case 'planner':
      return [...baseTools, ...writeTools];
    case 'executor':
      return [...baseTools, ...writeTools];
    case 'verifier':
      return [...baseTools, ...writeTools];
    default:
      return baseTools;
  }
}
```

---

## 5. Database Schema

Using SQLite for simplicity (can migrate to PostgreSQL):

```sql
-- Projects table
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table (for discuss/execute sessions)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  type TEXT NOT NULL, -- 'discuss', 'plan', 'execute'
  phase INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'active', 'completed', 'aborted'
  data JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Messages table (for chat history)
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL, -- 'user', 'assistant'
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table (for background tasks)
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL, -- 'pending', 'running', 'completed', 'failed'
  input JSON,
  output JSON,
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME
);
```

---

## 6. Environment Configuration

```bash
# .env.example

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Database
DATABASE_URL=sqlite:./data/gsd-dashboard.db

# Redis (for job queue)
REDIS_URL=redis://localhost:6379

# GSD
GSD_PATH=~/.claude/get-shit-done

# Security
SESSION_SECRET=your-secret-key
CORS_ORIGINS=http://localhost:3000
```

---

## 7. Deployment

### Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: docker/Dockerfile.web
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3001
      - NEXT_PUBLIC_WS_URL=http://localhost:3001
    depends_on:
      - server

  server:
    build:
      context: .
      dockerfile: docker/Dockerfile.server
    ports:
      - "3001:3001"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - DATABASE_URL=sqlite:/data/gsd.db
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./data:/data
      - ${HOME}/.claude/get-shit-done:/gsd:ro
      - ${HOME}/Projects:/projects:rw
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  redis-data:
```

---

## 8. Testing Strategy

| Type | Tool | Coverage Target |
|------|------|-----------------|
| Unit | Vitest | 80% |
| Component | React Testing Library | Key components |
| Integration | Supertest + Socket.io-mock | API + WebSocket |
| E2E | Playwright | Critical user flows |

---

## 9. Performance Targets

| Metric | Target |
|--------|--------|
| Initial page load (LCP) | < 2.5s |
| WebSocket message latency | < 100ms |
| API response time (p95) | < 500ms |
| Memory usage (server) | < 512MB |
| Concurrent WebSocket connections | 100+ |

---

## 10. Security Checklist

- [ ] API key never sent to frontend
- [ ] File paths validated (no path traversal)
- [ ] Bash commands sandboxed
- [ ] Rate limiting on API endpoints
- [ ] Input validation with Zod
- [ ] CORS properly configured
- [ ] CSP headers set
- [ ] Secure session management
