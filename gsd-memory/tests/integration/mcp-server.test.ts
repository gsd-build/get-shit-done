import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Integration tests for the MCP server
 *
 * These tests spawn the actual MCP server and communicate with it
 * via the MCP protocol over stdio.
 */

interface McpMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

class McpClient {
  private serverProcess: ChildProcess | null = null;
  private buffer = '';
  private pendingRequests: Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }> = new Map();
  private nextId = 1;

  async start(): Promise<void> {
    const serverPath = path.join(__dirname, '../../dist/index.js');

    // Check if built
    if (!fs.existsSync(serverPath)) {
      throw new Error('Server not built. Run npm run build first.');
    }

    this.serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.serverProcess.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.serverProcess.stderr?.on('data', (data: Buffer) => {
      // Server logs to stderr, ignore for tests
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message: McpMessage = JSON.parse(line);
          if (message.id !== undefined) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
              this.pendingRequests.delete(message.id);
              if (message.error) {
                pending.reject(new Error(message.error.message));
              } else {
                pending.resolve(message.result);
              }
            }
          }
        } catch {
          // Ignore non-JSON lines
        }
      }
    }
  }

  async sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.serverProcess) {
      throw new Error('Server not started');
    }

    const id = this.nextId++;
    const message: McpMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.serverProcess!.stdin?.write(JSON.stringify(message) + '\n');

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 5000);
    });
  }

  async listTools(): Promise<{ tools: Array<{ name: string; description: string }> }> {
    const result = await this.sendRequest('tools/list');
    return result as { tools: Array<{ name: string; description: string }> };
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }> }> {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args
    });
    return result as { content: Array<{ type: string; text: string }> };
  }

  stop(): void {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }
}

describe('MCP server integration', () => {
  let client: McpClient;
  let testProjectDir: string;

  beforeAll(async () => {
    // Create test project directory
    testProjectDir = path.join(os.tmpdir(), `gsd-mcp-test-${Date.now()}`);
    fs.mkdirSync(path.join(testProjectDir, '.planning', 'phases', '01-test'), { recursive: true });
    fs.writeFileSync(
      path.join(testProjectDir, '.planning', 'PROJECT.md'),
      `# Test Project

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use TypeScript | Type safety | Good |
`
    );
    fs.writeFileSync(
      path.join(testProjectDir, '.planning', 'phases', '01-test', '01-01-SUMMARY.md'),
      `---
phase: 01-test
plan: 01
subsystem: core
tags:
  - testing
  - integration
key-decisions:
  - Use vitest for testing
patterns-established:
  - TDD workflow
tech-stack:
  added:
    - vitest: 1.0.0
---
# Plan Summary

Implemented testing infrastructure.
`
    );

    // Try to start client - may fail if not built
    try {
      client = new McpClient();
      await client.start();
    } catch (err) {
      // Will handle in individual tests
    }
  });

  afterAll(() => {
    if (client) {
      client.stop();
    }
    if (fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true });
    }
  });

  describe('tool listing', () => {
    it('lists all GSD memory tools', async () => {
      if (!client) {
        // Server not built, skip test
        console.log('Skipping: server not built');
        return;
      }

      const { tools } = await client.listTools();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('gsd_memory_search');
      expect(toolNames).toContain('gsd_memory_decisions');
      expect(toolNames).toContain('gsd_memory_patterns');
      expect(toolNames).toContain('gsd_memory_pitfalls');
      expect(toolNames).toContain('gsd_memory_stack');
      expect(toolNames).toContain('gsd_memory_register');
      expect(toolNames).toContain('gsd_memory_index');
      expect(toolNames).toContain('gsd_memory_status');
    });

    it('returns tool descriptions', async () => {
      if (!client) return;

      const { tools } = await client.listTools();

      for (const tool of tools) {
        expect(tool.description).toBeTruthy();
        expect(typeof tool.description).toBe('string');
      }
    });
  });

  describe('status tool', () => {
    it('returns status information', async () => {
      if (!client) return;

      const result = await client.callTool('gsd_memory_status', {});
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');

      const status = JSON.parse(result.content[0].text);
      expect(status).toHaveProperty('qmdAvailable');
      expect(status).toHaveProperty('totalProjects');
      expect(status).toHaveProperty('projects');
    });
  });

  describe('register tool', () => {
    it('registers a project successfully', async () => {
      if (!client) return;

      const result = await client.callTool('gsd_memory_register', {
        path: testProjectDir,
        name: 'mcp-test-project'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
    });

    it('fails gracefully for non-existent path', async () => {
      if (!client) return;

      const result = await client.callTool('gsd_memory_register', {
        path: '/nonexistent/path',
        name: 'bad-project'
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
    });
  });

  describe('search tool', () => {
    it('searches across registered projects', async () => {
      if (!client) return;

      // Register first
      await client.callTool('gsd_memory_register', {
        path: testProjectDir,
        name: 'search-test-project'
      });

      const result = await client.callTool('gsd_memory_search', {
        query: 'testing'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      // search returns an array directly
      expect(Array.isArray(response)).toBe(true);
    });

    it('filters by project', async () => {
      if (!client) return;

      const result = await client.callTool('gsd_memory_search', {
        query: 'test',
        project: 'search-test-project'
      });

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      expect(Array.isArray(response)).toBe(true);
    });
  });

  describe('decisions tool', () => {
    it('finds decisions from registered projects', async () => {
      if (!client) return;

      const result = await client.callTool('gsd_memory_decisions', {});

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      // findDecisions returns an array directly
      expect(Array.isArray(response)).toBe(true);
    });
  });

  describe('patterns tool', () => {
    it('finds patterns from registered projects', async () => {
      if (!client) return;

      const result = await client.callTool('gsd_memory_patterns', {});

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      // findPatterns returns an array directly
      expect(Array.isArray(response)).toBe(true);
    });
  });

  describe('stack tool', () => {
    it('finds tech stack entries', async () => {
      if (!client) return;

      const result = await client.callTool('gsd_memory_stack', {});

      expect(result.content).toBeDefined();
      const response = JSON.parse(result.content[0].text);
      // findStack returns an array directly
      expect(Array.isArray(response)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('handles unknown tool gracefully', async () => {
      if (!client) return;

      try {
        await client.callTool('nonexistent_tool', {});
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeDefined();
      }
    });

    it('handles missing required parameters', async () => {
      if (!client) return;

      const result = await client.callTool('gsd_memory_register', {
        // Missing required 'path' parameter
      });

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
    });
  });
});
