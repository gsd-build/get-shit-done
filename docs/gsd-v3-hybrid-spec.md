# GSD v3.0 Hybrid Runtime - Technical Specification

**Version:** 1.0
**Date:** 2026-03-11
**Author:** Maurice van der Merwe
**Status:** Draft

---

## Overview

This specification details the technical implementation of GSD v3.0's hybrid runtime modernization. It covers the TypeScript agent runtime, database schema, API design, and integration patterns.

---

## 1. Package Structure

### 1.1 Monorepo Layout

```
gsd/
├── packages/
│   ├── core/                 # @gsd/core - Agent runtime
│   ├── api/                  # @gsd/api - REST + WebSocket server
│   ├── cli/                  # @gsd/cli - Command-line interface
│   ├── dashboard/            # @gsd/dashboard - Web UI
│   └── shared/               # @gsd/shared - Types and utilities
├── prompts/                  # Markdown prompts (unchanged)
│   ├── agents/
│   ├── workflows/
│   ├── templates/
│   └── references/
├── migrations/               # Database migrations
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

### 1.2 Package Dependencies

```
@gsd/shared (no deps)
    ↑
@gsd/core (depends on shared)
    ↑
@gsd/api (depends on core, shared)
    ↑
@gsd/cli (depends on api client from shared)
@gsd/dashboard (depends on api client from shared)
```

---

## 2. Core Package (@gsd/core)

### 2.1 Prompt Loader

```typescript
// packages/core/src/prompts/loader.ts

import { z } from 'zod';
import matter from 'gray-matter';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

// Schema for agent frontmatter
const AgentFrontmatterSchema = z.object({
  name: z.string(),
  description: z.string(),
  model: z.enum(['claude-sonnet-4-5', 'claude-opus-4-5', 'inherit']).default('inherit'),
  tools: z.array(z.string()).optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().min(0).max(1).optional(),
});

export type AgentFrontmatter = z.infer<typeof AgentFrontmatterSchema>;

export interface AgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  tools: string[];
  maxTokens?: number;
  temperature?: number;
  sourceFile: string;
}

export class PromptLoader {
  private cache: Map<string, AgentDefinition> = new Map();
  private promptsDir: string;

  constructor(promptsDir: string) {
    this.promptsDir = promptsDir;
  }

  async load(agentName: string): Promise<AgentDefinition> {
    const cached = this.cache.get(agentName);
    if (cached) return cached;

    const filePath = resolve(this.promptsDir, 'agents', `${agentName}.md`);
    const content = await readFile(filePath, 'utf-8');
    const { data, content: body } = matter(content);

    const frontmatter = AgentFrontmatterSchema.parse(data);
    const systemPrompt = await this.resolveIncludes(body);

    const definition: AgentDefinition = {
      name: frontmatter.name,
      description: frontmatter.description,
      systemPrompt,
      model: frontmatter.model,
      tools: frontmatter.tools ?? [],
      maxTokens: frontmatter.maxTokens,
      temperature: frontmatter.temperature,
      sourceFile: filePath,
    };

    this.cache.set(agentName, definition);
    return definition;
  }

  private async resolveIncludes(content: string): Promise<string> {
    // Resolve @file references
    const includePattern = /@([a-zA-Z0-9_\-\/\.]+\.md)/g;
    let result = content;

    for (const match of content.matchAll(includePattern)) {
      const includePath = resolve(this.promptsDir, match[1]);
      const includeContent = await readFile(includePath, 'utf-8');
      result = result.replace(match[0], includeContent);
    }

    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

### 2.2 Agent Runtime

```typescript
// packages/core/src/agents/runtime.ts

import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText, tool, CoreMessage } from 'ai';
import { z } from 'zod';
import { AgentDefinition, PromptLoader } from '../prompts/loader';
import { ToolRegistry } from '../tools/registry';
import { StateManager } from '../state/manager';
import { Tracer } from '../trace/tracer';
import { CheckpointManager, Checkpoint } from '../checkpoints/manager';

export interface AgentContext {
  projectPath: string;
  phaseNumber?: number;
  planId?: string;
  executionId: string;
  parentExecutionId?: string;
}

export interface AgentResult {
  success: boolean;
  output: string;
  toolCalls: ToolCallRecord[];
  checkpoints: Checkpoint[];
  error?: string;
}

export interface ToolCallRecord {
  tool: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  status: 'success' | 'error';
}

export class AgentRuntime {
  private anthropic = createAnthropic();
  private promptLoader: PromptLoader;
  private toolRegistry: ToolRegistry;
  private stateManager: StateManager;
  private tracer: Tracer;
  private checkpointManager: CheckpointManager;

  constructor(options: {
    promptsDir: string;
    toolRegistry: ToolRegistry;
    stateManager: StateManager;
    tracer: Tracer;
    checkpointManager: CheckpointManager;
  }) {
    this.promptLoader = new PromptLoader(options.promptsDir);
    this.toolRegistry = options.toolRegistry;
    this.stateManager = options.stateManager;
    this.tracer = options.tracer;
    this.checkpointManager = options.checkpointManager;
  }

  async execute(
    agentName: string,
    context: AgentContext,
    userMessage: string,
    onStream?: (chunk: string) => void,
    onToolCall?: (record: ToolCallRecord) => void,
    onCheckpoint?: (checkpoint: Checkpoint) => Promise<string>,
  ): Promise<AgentResult> {
    const span = this.tracer.startSpan('agent.execute', {
      agent: agentName,
      executionId: context.executionId,
    });

    try {
      const definition = await this.promptLoader.load(agentName);
      const tools = this.toolRegistry.getTools(definition.tools);

      const messages: CoreMessage[] = [
        { role: 'user', content: userMessage },
      ];

      const toolCalls: ToolCallRecord[] = [];
      const checkpoints: Checkpoint[] = [];
      let output = '';

      // Agent loop
      while (true) {
        const response = await streamText({
          model: this.anthropic(definition.model),
          system: this.renderSystemPrompt(definition.systemPrompt, context),
          messages,
          tools,
          maxTokens: definition.maxTokens,
          temperature: definition.temperature,
        });

        let assistantMessage = '';

        for await (const chunk of response.textStream) {
          assistantMessage += chunk;
          output += chunk;
          onStream?.(chunk);
        }

        // Handle tool calls
        const toolCallsInResponse = await response.toolCalls;

        if (toolCallsInResponse.length === 0) {
          // No tool calls, agent is done
          break;
        }

        // Execute tools
        const toolResults = [];
        for (const toolCall of toolCallsInResponse) {
          const toolSpan = this.tracer.startSpan('tool.execute', {
            tool: toolCall.toolName,
          });

          const startTime = Date.now();

          try {
            // Check for checkpoint tool
            if (toolCall.toolName === 'checkpoint') {
              const checkpoint = await this.checkpointManager.create({
                executionId: context.executionId,
                type: toolCall.args.type,
                message: toolCall.args.message,
                options: toolCall.args.options,
              });

              checkpoints.push(checkpoint);

              // Wait for user response
              const response = onCheckpoint
                ? await onCheckpoint(checkpoint)
                : await this.checkpointManager.waitForResponse(checkpoint.id);

              toolResults.push({
                toolCallId: toolCall.toolCallId,
                result: response,
              });

              toolCalls.push({
                tool: toolCall.toolName,
                input: toolCall.args,
                output: response,
                durationMs: Date.now() - startTime,
                status: 'success',
              });
            } else {
              // Regular tool execution
              const result = await this.toolRegistry.execute(
                toolCall.toolName,
                toolCall.args,
                context,
              );

              toolResults.push({
                toolCallId: toolCall.toolCallId,
                result,
              });

              const record: ToolCallRecord = {
                tool: toolCall.toolName,
                input: toolCall.args,
                output: result,
                durationMs: Date.now() - startTime,
                status: 'success',
              };

              toolCalls.push(record);
              onToolCall?.(record);
            }

            toolSpan.end();
          } catch (error) {
            const record: ToolCallRecord = {
              tool: toolCall.toolName,
              input: toolCall.args,
              output: error instanceof Error ? error.message : 'Unknown error',
              durationMs: Date.now() - startTime,
              status: 'error',
            };

            toolCalls.push(record);
            onToolCall?.(record);
            toolSpan.end({ error: true });

            toolResults.push({
              toolCallId: toolCall.toolCallId,
              result: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
          }
        }

        // Add assistant message and tool results to history
        messages.push({
          role: 'assistant',
          content: assistantMessage,
          toolCalls: toolCallsInResponse,
        });

        messages.push({
          role: 'tool',
          content: toolResults,
        });
      }

      span.end();

      return {
        success: true,
        output,
        toolCalls,
        checkpoints,
      };
    } catch (error) {
      span.end({ error: true });

      return {
        success: false,
        output: '',
        toolCalls: [],
        checkpoints: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private renderSystemPrompt(template: string, context: AgentContext): string {
    return template
      .replace(/{project_path}/g, context.projectPath)
      .replace(/{phase_number}/g, context.phaseNumber?.toString() ?? '')
      .replace(/{plan_id}/g, context.planId ?? '')
      .replace(/{execution_id}/g, context.executionId);
  }
}
```

### 2.3 Tool Registry

```typescript
// packages/core/src/tools/registry.ts

import { tool as createTool } from 'ai';
import { z, ZodSchema } from 'zod';
import { AgentContext } from '../agents/runtime';

export interface ToolDefinition<TInput extends ZodSchema, TOutput> {
  name: string;
  description: string;
  parameters: TInput;
  execute: (input: z.infer<TInput>, context: AgentContext) => Promise<TOutput>;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition<ZodSchema, unknown>> = new Map();

  register<TInput extends ZodSchema, TOutput>(
    definition: ToolDefinition<TInput, TOutput>,
  ): void {
    this.tools.set(definition.name, definition as ToolDefinition<ZodSchema, unknown>);
  }

  getTools(names: string[]): Record<string, ReturnType<typeof createTool>> {
    const result: Record<string, ReturnType<typeof createTool>> = {};

    for (const name of names) {
      const definition = this.tools.get(name);
      if (!definition) {
        throw new Error(`Tool not found: ${name}`);
      }

      result[name] = createTool({
        description: definition.description,
        parameters: definition.parameters,
      });
    }

    return result;
  }

  async execute(
    name: string,
    input: unknown,
    context: AgentContext,
  ): Promise<unknown> {
    const definition = this.tools.get(name);
    if (!definition) {
      throw new Error(`Tool not found: ${name}`);
    }

    const validatedInput = definition.parameters.parse(input);
    return definition.execute(validatedInput, context);
  }
}

// Example tool definitions
export const coreTools = {
  readFile: {
    name: 'read_file',
    description: 'Read the contents of a file',
    parameters: z.object({
      path: z.string().describe('Path to the file to read'),
    }),
    execute: async ({ path }, context) => {
      const { readFile } = await import('fs/promises');
      const { resolve } = await import('path');
      const fullPath = resolve(context.projectPath, path);
      return readFile(fullPath, 'utf-8');
    },
  } satisfies ToolDefinition<typeof z.object({ path: z.string() }), string>,

  writeFile: {
    name: 'write_file',
    description: 'Write content to a file',
    parameters: z.object({
      path: z.string().describe('Path to the file to write'),
      content: z.string().describe('Content to write'),
    }),
    execute: async ({ path, content }, context) => {
      const { writeFile } = await import('fs/promises');
      const { resolve, dirname } = await import('path');
      const { mkdir } = await import('fs/promises');
      const fullPath = resolve(context.projectPath, path);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content);
      return `Wrote ${content.length} bytes to ${path}`;
    },
  } satisfies ToolDefinition<typeof z.object({ path: z.string(), content: z.string() }), string>,

  bash: {
    name: 'bash',
    description: 'Execute a bash command',
    parameters: z.object({
      command: z.string().describe('Command to execute'),
      cwd: z.string().optional().describe('Working directory'),
    }),
    execute: async ({ command, cwd }, context) => {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd ?? context.projectPath,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      return { stdout, stderr };
    },
  } satisfies ToolDefinition<typeof z.object({ command: z.string(), cwd: z.string().optional() }), { stdout: string; stderr: string }>,
};
```

---

## 3. State Management

### 3.1 Database Schema (Drizzle)

```typescript
// packages/core/src/state/schema.ts

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Projects table
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  path: text('path').notNull().unique(),
  name: text('name').notNull(),
  currentMilestone: text('current_milestone'),
  currentPhase: integer('current_phase'),
  currentPlan: text('current_plan'),
  status: text('status').notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Milestones table
export const milestones = sqliteTable('milestones', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  version: text('version').notNull(),
  name: text('name').notNull(),
  status: text('status').notNull().default('planned'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// Phases table
export const phases = sqliteTable('phases', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  milestoneId: text('milestone_id').notNull().references(() => milestones.id),
  number: integer('number').notNull(),
  name: text('name').notNull(),
  goal: text('goal').notNull(),
  status: text('status').notNull().default('not_started'),
  requirements: text('requirements', { mode: 'json' }).$type<string[]>(),
  successCriteria: text('success_criteria', { mode: 'json' }).$type<string[]>(),
  dependsOn: text('depends_on', { mode: 'json' }).$type<number[]>(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// Plans table
export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  phaseId: text('phase_id').notNull().references(() => phases.id),
  number: integer('number').notNull(),
  name: text('name').notNull(),
  wave: integer('wave').notNull().default(1),
  status: text('status').notNull().default('not_started'),
  filePath: text('file_path').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// Executions table
export const executions = sqliteTable('executions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  phaseId: text('phase_id').references(() => phases.id),
  planId: text('plan_id').references(() => plans.id),
  agentName: text('agent_name').notNull(),
  status: text('status').notNull().default('running'),
  parentExecutionId: text('parent_execution_id'),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  error: text('error'),
});

// Checkpoints table
export const checkpoints = sqliteTable('checkpoints', {
  id: text('id').primaryKey(),
  executionId: text('execution_id').notNull().references(() => executions.id),
  type: text('type').notNull(),
  message: text('message').notNull(),
  options: text('options', { mode: 'json' }).$type<string[]>(),
  response: text('response'),
  status: text('status').notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  respondedAt: integer('responded_at', { mode: 'timestamp' }),
});

// Tool calls table
export const toolCalls = sqliteTable('tool_calls', {
  id: text('id').primaryKey(),
  executionId: text('execution_id').notNull().references(() => executions.id),
  toolName: text('tool_name').notNull(),
  input: text('input', { mode: 'json' }),
  output: text('output', { mode: 'json' }),
  status: text('status').notNull(),
  durationMs: integer('duration_ms').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// Traces table
export const traces = sqliteTable('traces', {
  id: text('id').primaryKey(),
  executionId: text('execution_id').notNull().references(() => executions.id),
  spanId: text('span_id').notNull(),
  parentSpanId: text('parent_span_id'),
  name: text('name').notNull(),
  attributes: text('attributes', { mode: 'json' }),
  startTime: integer('start_time', { mode: 'timestamp' }).notNull(),
  endTime: integer('end_time', { mode: 'timestamp' }),
  status: text('status').notNull().default('ok'),
});

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  milestones: many(milestones),
  phases: many(phases),
  executions: many(executions),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, {
    fields: [milestones.projectId],
    references: [projects.id],
  }),
  phases: many(phases),
}));

export const phasesRelations = relations(phases, ({ one, many }) => ({
  project: one(projects, {
    fields: [phases.projectId],
    references: [projects.id],
  }),
  milestone: one(milestones, {
    fields: [phases.milestoneId],
    references: [milestones.id],
  }),
  plans: many(plans),
}));

export const plansRelations = relations(plans, ({ one }) => ({
  phase: one(phases, {
    fields: [plans.phaseId],
    references: [phases.id],
  }),
}));

export const executionsRelations = relations(executions, ({ one, many }) => ({
  project: one(projects, {
    fields: [executions.projectId],
    references: [projects.id],
  }),
  phase: one(phases, {
    fields: [executions.phaseId],
    references: [phases.id],
  }),
  plan: one(plans, {
    fields: [executions.planId],
    references: [plans.id],
  }),
  checkpoints: many(checkpoints),
  toolCalls: many(toolCalls),
  traces: many(traces),
}));
```

### 3.2 State Manager

```typescript
// packages/core/src/state/manager.ts

import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq, and } from 'drizzle-orm';
import * as schema from './schema';
import { v4 as uuid } from 'uuid';

export class StateManager {
  private db: BetterSQLite3Database<typeof schema>;

  constructor(dbPath: string) {
    const sqlite = new Database(dbPath);
    this.db = drizzle(sqlite, { schema });
  }

  // Project operations
  async getProject(path: string) {
    return this.db.query.projects.findFirst({
      where: eq(schema.projects.path, path),
      with: {
        milestones: true,
        phases: {
          with: {
            plans: true,
          },
        },
      },
    });
  }

  async createProject(data: {
    path: string;
    name: string;
  }) {
    const id = uuid();
    await this.db.insert(schema.projects).values({
      id,
      path: data.path,
      name: data.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return id;
  }

  // Phase operations
  async getPhase(projectId: string, phaseNumber: number) {
    return this.db.query.phases.findFirst({
      where: and(
        eq(schema.phases.projectId, projectId),
        eq(schema.phases.number, phaseNumber),
      ),
      with: {
        plans: true,
      },
    });
  }

  async updatePhaseStatus(phaseId: string, status: string) {
    await this.db.update(schema.phases)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.phases.id, phaseId));
  }

  // Execution operations
  async createExecution(data: {
    projectId: string;
    phaseId?: string;
    planId?: string;
    agentName: string;
    parentExecutionId?: string;
  }) {
    const id = uuid();
    await this.db.insert(schema.executions).values({
      id,
      ...data,
      startedAt: new Date(),
    });
    return id;
  }

  async completeExecution(executionId: string, error?: string) {
    await this.db.update(schema.executions)
      .set({
        status: error ? 'failed' : 'completed',
        completedAt: new Date(),
        error,
      })
      .where(eq(schema.executions.id, executionId));
  }

  // Markdown sync
  async syncFromMarkdown(projectPath: string): Promise<void> {
    // Parse STATE.md, ROADMAP.md, etc.
    // Update database to match
    // This enables backward compatibility with CLI users
  }

  async syncToMarkdown(projectPath: string): Promise<void> {
    // Write database state to markdown files
    // Maintains .planning/ files for direct reading
  }
}
```

---

## 4. API Layer

### 4.1 REST API (Hono)

```typescript
// packages/api/src/routes/projects.ts

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { StateManager } from '@gsd/core';

const projectsRouter = new Hono();

// List all projects
projectsRouter.get('/', async (c) => {
  const state = c.get('state') as StateManager;
  const projects = await state.listProjects();
  return c.json({ success: true, data: projects });
});

// Get project by path
projectsRouter.get('/:path{.+}', async (c) => {
  const state = c.get('state') as StateManager;
  const path = c.req.param('path');
  const project = await state.getProject(path);

  if (!project) {
    return c.json({ success: false, error: { code: 'PROJECT_NOT_FOUND' } }, 404);
  }

  return c.json({ success: true, data: project });
});

// Get project health
projectsRouter.get('/:path{.+}/health', async (c) => {
  const state = c.get('state') as StateManager;
  const path = c.req.param('path');
  const health = await state.getProjectHealth(path);
  return c.json({ success: true, data: health });
});

// Get project roadmap
projectsRouter.get('/:path{.+}/roadmap', async (c) => {
  const state = c.get('state') as StateManager;
  const path = c.req.param('path');
  const roadmap = await state.getProjectRoadmap(path);
  return c.json({ success: true, data: roadmap });
});

export { projectsRouter };
```

### 4.2 WebSocket Events

```typescript
// packages/api/src/ws/handlers.ts

import { Server } from 'socket.io';
import { AgentRuntime, AgentContext } from '@gsd/core';

export function setupWebSocketHandlers(io: Server, runtime: AgentRuntime) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Execute agent
    socket.on('agent:execute', async (data: {
      agent: string;
      projectPath: string;
      phaseNumber?: number;
      planId?: string;
      message: string;
    }) => {
      const context: AgentContext = {
        projectPath: data.projectPath,
        phaseNumber: data.phaseNumber,
        planId: data.planId,
        executionId: crypto.randomUUID(),
      };

      socket.emit('agent:started', { executionId: context.executionId });

      try {
        const result = await runtime.execute(
          data.agent,
          context,
          data.message,
          // Stream handler
          (chunk) => socket.emit('agent:stream', { chunk }),
          // Tool call handler
          (toolCall) => socket.emit('agent:tool', toolCall),
          // Checkpoint handler
          async (checkpoint) => {
            socket.emit('checkpoint:request', checkpoint);
            return new Promise((resolve) => {
              socket.once(`checkpoint:response:${checkpoint.id}`, (response: string) => {
                resolve(response);
              });
            });
          },
        );

        socket.emit('agent:complete', result);
      } catch (error) {
        socket.emit('agent:error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Checkpoint response
    socket.on('checkpoint:respond', (data: { checkpointId: string; response: string }) => {
      socket.emit(`checkpoint:response:${data.checkpointId}`, data.response);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}
```

---

## 5. CLI Package

### 5.1 Commander Setup

```typescript
// packages/cli/src/index.ts

import { Command } from 'commander';
import { createApiClient } from '@gsd/shared';
import ora from 'ora';
import chalk from 'chalk';

const program = new Command();
const api = createApiClient(process.env.GSD_API_URL || 'http://localhost:3000');

program
  .name('gsd')
  .description('GSD - Get Shit Done')
  .version('3.0.0');

// Progress command
program
  .command('progress')
  .description('Check project progress')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (options) => {
    const spinner = ora('Loading project...').start();

    try {
      const project = await api.getProject(options.path);
      spinner.stop();

      console.log(chalk.bold(`\nProject: ${project.name}`));
      console.log(`Milestone: ${project.currentMilestone}`);
      console.log(`Phase: ${project.currentPhase}`);
      console.log(`Status: ${project.status}`);
    } catch (error) {
      spinner.fail('Failed to load project');
      console.error(error);
      process.exit(1);
    }
  });

// Execute phase command
program
  .command('execute-phase <phase>')
  .description('Execute all plans in a phase')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (phase, options) => {
    const phaseNumber = parseInt(phase, 10);

    // Connect to WebSocket for streaming
    const ws = await api.connectWebSocket();

    ws.on('agent:stream', (data) => {
      process.stdout.write(data.chunk);
    });

    ws.on('agent:tool', (data) => {
      console.log(chalk.dim(`\n[Tool: ${data.tool}]`));
    });

    ws.on('checkpoint:request', async (checkpoint) => {
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      console.log(chalk.yellow(`\n[Checkpoint] ${checkpoint.message}`));

      const response = await new Promise<string>((resolve) => {
        rl.question('Response: ', (answer) => {
          rl.close();
          resolve(answer);
        });
      });

      ws.emit('checkpoint:respond', {
        checkpointId: checkpoint.id,
        response,
      });
    });

    ws.on('agent:complete', (result) => {
      if (result.success) {
        console.log(chalk.green('\n\nPhase execution complete!'));
      } else {
        console.log(chalk.red(`\n\nPhase execution failed: ${result.error}`));
      }
      process.exit(result.success ? 0 : 1);
    });

    ws.emit('agent:execute', {
      agent: 'gsd-execute-phase',
      projectPath: options.path,
      phaseNumber,
      message: `Execute phase ${phaseNumber}`,
    });
  });

program.parse();
```

---

## 6. Observability

### 6.1 Tracer

```typescript
// packages/core/src/trace/tracer.ts

import { v4 as uuid } from 'uuid';

export interface Span {
  spanId: string;
  parentSpanId?: string;
  name: string;
  attributes: Record<string, unknown>;
  startTime: Date;
  endTime?: Date;
  status: 'ok' | 'error';
}

export interface TraceExporter {
  export(spans: Span[]): Promise<void>;
}

export class Tracer {
  private spans: Map<string, Span> = new Map();
  private currentSpanId?: string;
  private exporters: TraceExporter[] = [];

  addExporter(exporter: TraceExporter): void {
    this.exporters.push(exporter);
  }

  startSpan(name: string, attributes: Record<string, unknown> = {}): SpanHandle {
    const spanId = uuid();
    const span: Span = {
      spanId,
      parentSpanId: this.currentSpanId,
      name,
      attributes,
      startTime: new Date(),
      status: 'ok',
    };

    this.spans.set(spanId, span);
    const previousSpanId = this.currentSpanId;
    this.currentSpanId = spanId;

    return {
      end: async (options?: { error?: boolean }) => {
        span.endTime = new Date();
        span.status = options?.error ? 'error' : 'ok';
        this.currentSpanId = previousSpanId;

        // Export completed span
        for (const exporter of this.exporters) {
          await exporter.export([span]);
        }
      },
      addAttribute: (key: string, value: unknown) => {
        span.attributes[key] = value;
      },
    };
  }
}

export interface SpanHandle {
  end: (options?: { error?: boolean }) => Promise<void>;
  addAttribute: (key: string, value: unknown) => void;
}

// Database exporter
export class DatabaseTraceExporter implements TraceExporter {
  constructor(private stateManager: StateManager) {}

  async export(spans: Span[]): Promise<void> {
    for (const span of spans) {
      await this.stateManager.insertTrace(span);
    }
  }
}

// Console exporter (development)
export class ConsoleTraceExporter implements TraceExporter {
  async export(spans: Span[]): Promise<void> {
    for (const span of spans) {
      const duration = span.endTime
        ? span.endTime.getTime() - span.startTime.getTime()
        : 0;
      console.log(`[TRACE] ${span.name} (${duration}ms) - ${span.status}`);
    }
  }
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// tests/unit/prompt-loader.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptLoader } from '@gsd/core';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';

describe('PromptLoader', () => {
  const testDir = '/tmp/gsd-test-prompts';
  let loader: PromptLoader;

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true });
    await mkdir(join(testDir, 'agents'), { recursive: true });
    loader = new PromptLoader(testDir);
  });

  it('loads agent with frontmatter', async () => {
    await writeFile(
      join(testDir, 'agents', 'test-agent.md'),
      `---
name: test-agent
description: A test agent
model: claude-sonnet-4-5
tools:
  - read_file
  - write_file
---

You are a test agent.
`
    );

    const agent = await loader.load('test-agent');

    expect(agent.name).toBe('test-agent');
    expect(agent.description).toBe('A test agent');
    expect(agent.model).toBe('claude-sonnet-4-5');
    expect(agent.tools).toEqual(['read_file', 'write_file']);
    expect(agent.systemPrompt).toContain('You are a test agent');
  });

  it('resolves @file includes', async () => {
    await mkdir(join(testDir, 'references'), { recursive: true });

    await writeFile(
      join(testDir, 'references', 'common.md'),
      'This is common content.'
    );

    await writeFile(
      join(testDir, 'agents', 'include-agent.md'),
      `---
name: include-agent
description: Agent with include
---

Start content.
@references/common.md
End content.
`
    );

    const agent = await loader.load('include-agent');

    expect(agent.systemPrompt).toContain('This is common content');
    expect(agent.systemPrompt).toContain('Start content');
    expect(agent.systemPrompt).toContain('End content');
  });
});
```

### 7.2 Integration Tests

```typescript
// tests/integration/agent-execution.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AgentRuntime, ToolRegistry, StateManager, Tracer } from '@gsd/core';

describe('Agent Execution', () => {
  let runtime: AgentRuntime;
  let state: StateManager;

  beforeAll(async () => {
    state = new StateManager(':memory:');
    const toolRegistry = new ToolRegistry();
    const tracer = new Tracer();

    runtime = new AgentRuntime({
      promptsDir: './prompts',
      toolRegistry,
      stateManager: state,
      tracer,
      checkpointManager: new CheckpointManager(state),
    });
  });

  it('executes simple agent task', async () => {
    const result = await runtime.execute(
      'gsd-executor',
      {
        projectPath: '/tmp/test-project',
        executionId: 'test-123',
      },
      'Read the README.md file',
    );

    expect(result.success).toBe(true);
    expect(result.toolCalls.length).toBeGreaterThan(0);
  });
});
```

---

## 8. Migration Path

### 8.1 Coexistence Phase

```typescript
// packages/core/src/compat/legacy-bridge.ts

/**
 * Bridge between v2.0 gsd-tools.cjs and v3.0 runtime.
 * Allows gradual migration of commands.
 */

import { execSync } from 'child_process';

export class LegacyBridge {
  private gsdToolsPath: string;

  constructor() {
    this.gsdToolsPath = `${process.env.HOME}/.claude/get-shit-done/bin/gsd-tools.cjs`;
  }

  /**
   * Call legacy gsd-tools.cjs command
   */
  callLegacy(command: string, args: string[]): string {
    return execSync(
      `node ${this.gsdToolsPath} ${command} ${args.join(' ')}`,
      { encoding: 'utf-8' }
    );
  }

  /**
   * Check if command is implemented in v3.0
   */
  hasV3Implementation(command: string): boolean {
    const v3Commands = [
      'progress',
      'execute-phase',
      'plan-phase',
      // Add as implemented
    ];
    return v3Commands.includes(command);
  }
}
```

---

## 9. Configuration

### 9.1 Environment Variables

```bash
# .env
GSD_DATABASE_URL=sqlite:./gsd.db
GSD_API_PORT=3000
GSD_PROMPTS_DIR=./prompts
GSD_LOG_LEVEL=info
GSD_TRACE_EXPORTER=console  # console | database | otlp

# Claude API
ANTHROPIC_API_KEY=sk-ant-xxx

# Optional: External tracing
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

### 9.2 Configuration File

```typescript
// gsd.config.ts

import { defineConfig } from '@gsd/core';

export default defineConfig({
  prompts: {
    dir: './prompts',
    watch: true,  // Hot reload in dev
  },
  database: {
    url: process.env.GSD_DATABASE_URL || 'sqlite:./gsd.db',
    migrations: './migrations',
  },
  api: {
    port: 3000,
    cors: ['http://localhost:5173'],  // Dashboard
  },
  trace: {
    exporter: 'database',
    retentionDays: 30,
  },
  agents: {
    defaultModel: 'claude-sonnet-4-5',
    maxConcurrent: 5,
  },
});
```

---

## 10. Deployment

### 10.1 Docker Compose

```yaml
# docker-compose.yml

version: '3.8'

services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    ports:
      - "3000:3000"
    environment:
      - GSD_DATABASE_URL=postgres://gsd:gsd@db:5432/gsd
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./prompts:/app/prompts:ro
      - projects:/projects
    depends_on:
      - db

  dashboard:
    build:
      context: .
      dockerfile: Dockerfile.dashboard
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:3000

  db:
    image: postgres:16
    environment:
      - POSTGRES_USER=gsd
      - POSTGRES_PASSWORD=gsd
      - POSTGRES_DB=gsd
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
  projects:
```

---

## Appendix

### A. Type Definitions

```typescript
// packages/shared/src/types/index.ts

export interface Project {
  id: string;
  path: string;
  name: string;
  currentMilestone?: string;
  currentPhase?: number;
  currentPlan?: string;
  status: 'active' | 'paused' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface Phase {
  id: string;
  number: number;
  name: string;
  goal: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  requirements: string[];
  successCriteria: string[];
  dependsOn: number[];
  plans: Plan[];
}

export interface Plan {
  id: string;
  number: number;
  name: string;
  wave: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  filePath: string;
}

export interface Execution {
  id: string;
  agentName: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface Checkpoint {
  id: string;
  executionId: string;
  type: string;
  message: string;
  options?: string[];
  response?: string;
  status: 'pending' | 'responded' | 'timeout';
}
```

---

*Specification created: 2026-03-11*
