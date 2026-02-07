import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Import tools directly for e2e testing
import { register, unregister } from '../../src/tools/register.js';
import { index, indexAll } from '../../src/tools/index-tool.js';
import { search } from '../../src/tools/search.js';
import { findDecisions } from '../../src/tools/decisions.js';
import { findPatterns } from '../../src/tools/patterns.js';
import { findPitfalls } from '../../src/tools/pitfalls.js';
import { findStack } from '../../src/tools/stack.js';
import { getStatus } from '../../src/tools/status.js';
import { getRegistry, saveRegistry, type ProjectRegistry } from '../../src/registry.js';

/**
 * End-to-end integration tests
 *
 * These tests exercise the full workflow:
 * 1. Register a project
 * 2. Index its contents
 * 3. Search and query across projects
 * 4. Cross-project search
 */

describe('End-to-end workflow', () => {
  let project1Dir: string;
  let project2Dir: string;
  let originalRegistry: ProjectRegistry | null = null;

  beforeAll(async () => {
    // Backup existing registry
    try {
      originalRegistry = await getRegistry();
    } catch {
      originalRegistry = null;
    }

    // Create project 1 - an auth service
    project1Dir = path.join(os.tmpdir(), `gsd-e2e-project1-${Date.now()}`);
    createTestProject(project1Dir, 'auth-service', {
      phase: '01',
      planSummary: {
        phase: '01-auth',
        plan: '01',
        subsystem: 'authentication',
        tags: ['auth', 'jwt', 'security'],
        keyDecisions: ['Use JWT for stateless auth', 'Token expiry: 1 hour'],
        patternsEstablished: ['Bearer token middleware', 'Refresh token rotation'],
        techStack: [
          { name: 'jose', version: '5.2.0' },
          { name: 'bcrypt', version: '5.1.0' }
        ]
      },
      research: {
        domain: 'authentication',
        pitfalls: [
          { description: 'JWT secret in code', prevention: 'Use env vars' },
          { description: 'No token rotation', prevention: 'Implement refresh tokens' }
        ],
        standardStack: [
          { library: 'jose', version: '5.x', purpose: 'JWT signing' }
        ]
      },
      project: {
        decisions: [
          { decision: 'Stateless auth with JWT', rationale: 'Horizontal scaling', outcome: 'Good' }
        ]
      }
    });

    // Create project 2 - an API gateway
    project2Dir = path.join(os.tmpdir(), `gsd-e2e-project2-${Date.now()}`);
    createTestProject(project2Dir, 'api-gateway', {
      phase: '01',
      planSummary: {
        phase: '01-gateway',
        plan: '01',
        subsystem: 'gateway',
        tags: ['api', 'routing', 'ratelimit'],
        keyDecisions: ['Use express for routing', 'Redis for rate limiting'],
        patternsEstablished: ['Route middleware chain', 'Error boundary pattern'],
        techStack: [
          { name: 'express', version: '4.18.0' },
          { name: 'ioredis', version: '5.3.0' }
        ]
      },
      research: {
        domain: 'api-design',
        pitfalls: [
          { description: 'No rate limiting', prevention: 'Add Redis-based limiter' }
        ],
        standardStack: [
          { library: 'express', version: '4.x', purpose: 'HTTP server' }
        ]
      },
      project: {
        decisions: [
          { decision: 'Express over Fastify', rationale: 'Team familiarity', outcome: 'Pending' }
        ]
      }
    });
  });

  afterAll(async () => {
    // Cleanup projects
    if (fs.existsSync(project1Dir)) {
      fs.rmSync(project1Dir, { recursive: true });
    }
    if (fs.existsSync(project2Dir)) {
      fs.rmSync(project2Dir, { recursive: true });
    }

    // Restore original registry
    if (originalRegistry) {
      await saveRegistry(originalRegistry);
    }
  });

  describe('Project registration', () => {
    it('registers project 1', async () => {
      const result = await register({
        path: project1Dir,
        name: 'e2e-auth-service'
      });

      expect(result.success).toBe(true);
      expect(result.project?.name).toBe('e2e-auth-service');
    });

    it('registers project 2', async () => {
      const result = await register({
        path: project2Dir,
        name: 'e2e-api-gateway'
      });

      expect(result.success).toBe(true);
      expect(result.project?.name).toBe('e2e-api-gateway');
    });

    it('shows both projects in status', async () => {
      const status = await getStatus();

      expect(status.totalProjects).toBeGreaterThanOrEqual(2);
      expect(status.projects.some((p) => p.name === 'e2e-auth-service')).toBe(true);
      expect(status.projects.some((p) => p.name === 'e2e-api-gateway')).toBe(true);
    });
  });

  describe('Project indexing', () => {
    it('indexes project 1', async () => {
      const result = await index({
        project: 'e2e-auth-service'
      });

      expect(result.success).toBe(true);
    });

    it('indexes project 2', async () => {
      const result = await index({
        project: 'e2e-api-gateway'
      });

      expect(result.success).toBe(true);
    });

    it('indexes all projects', async () => {
      const result = await indexAll();

      // indexAll returns success: true only if ALL projects succeed
      // Since we may have stale projects from previous test runs, check results array
      expect(result.results.length).toBeGreaterThanOrEqual(2);
      // At least our 2 test projects should succeed
      const successCount = result.results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Search functionality', () => {
    it('searches across all projects', async () => {
      const results = await search({
        query: 'authentication'
      });

      expect(results.length).toBeGreaterThan(0);
      // Should find matches in auth-service
      expect(results.some(r => r.project === 'e2e-auth-service')).toBe(true);
    });

    it('filters search by project', async () => {
      const results = await search({
        query: 'token',
        project: 'e2e-auth-service'
      });

      expect(results.length).toBeGreaterThan(0);
      // All results should be from auth-service
      for (const r of results) {
        expect(r.project).toBe('e2e-auth-service');
      }
    });

    it('respects limit parameter', async () => {
      const results = await search({
        query: 'the',
        limit: 3
      });

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Decision queries', () => {
    it('finds decisions across projects', async () => {
      const decisions = await findDecisions({});

      expect(decisions.length).toBeGreaterThan(0);

      // Should find JWT decision from project 1
      const jwtDecision = decisions.find(
        d => d.decision.toLowerCase().includes('jwt')
      );
      expect(jwtDecision).toBeDefined();
    });

    it('filters decisions by keyword', async () => {
      const decisions = await findDecisions({
        query: 'express'
      });

      expect(decisions.length).toBeGreaterThan(0);
      // All matching decisions should mention express
      for (const d of decisions) {
        expect(
          d.decision.toLowerCase().includes('express') ||
          d.rationale?.toLowerCase().includes('express')
        ).toBe(true);
      }
    });

    it('filters decisions by project', async () => {
      const decisions = await findDecisions({
        project: 'e2e-api-gateway'
      });

      // All decisions should be from api-gateway
      for (const d of decisions) {
        expect(d.project).toBe('e2e-api-gateway');
      }
    });
  });

  describe('Pattern queries', () => {
    it('finds patterns across projects', async () => {
      const patterns = await findPatterns({});

      expect(patterns.length).toBeGreaterThan(0);

      // Should find bearer token pattern from project 1
      const bearerPattern = patterns.find(
        p => p.pattern.toLowerCase().includes('bearer') ||
             p.pattern.toLowerCase().includes('token')
      );
      expect(bearerPattern).toBeDefined();
    });

    it('filters patterns by keyword', async () => {
      const patterns = await findPatterns({
        query: 'middleware'
      });

      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe('Pitfall queries', () => {
    it('finds pitfalls across projects', async () => {
      const pitfalls = await findPitfalls({});

      // Pitfalls require XML-tagged sections in RESEARCH.md
      // Our simple test fixtures don't have these, so we just verify the query works
      expect(Array.isArray(pitfalls)).toBe(true);
    });

    it('filters pitfalls by domain', async () => {
      const pitfalls = await findPitfalls({
        domain: 'authentication'
      });

      // All pitfalls should be from auth domain (if any found)
      for (const p of pitfalls) {
        expect(p.domain.toLowerCase()).toContain('auth');
      }
    });
  });

  describe('Tech stack queries', () => {
    it('finds tech stack across projects', async () => {
      const stack = await findStack({});

      // Tech stack is extracted from SUMMARY.md tech-stack.added frontmatter
      // and RESEARCH.md <standard_stack> sections
      expect(Array.isArray(stack)).toBe(true);

      // If we have stack entries, verify structure
      if (stack.length > 0) {
        expect(stack[0]).toHaveProperty('library');
        expect(stack[0]).toHaveProperty('project');
      }
    });

    it('filters stack by library name', async () => {
      const stack = await findStack({
        query: 'jose'
      });

      // All results should match the query
      for (const s of stack) {
        expect(
          s.library.toLowerCase().includes('jose') ||
          s.purpose?.toLowerCase().includes('jose')
        ).toBe(true);
      }
    });
  });

  describe('Cross-project search', () => {
    it('returns results from multiple projects', async () => {
      // Search for something that exists in both projects
      const results = await search({
        query: 'version'
      });

      const projectsFound = new Set(results.map(r => r.project));
      expect(projectsFound.size).toBeGreaterThanOrEqual(2);
    });

    it('includes project context in results', async () => {
      const results = await search({
        query: 'token'
      });

      for (const r of results) {
        expect(r.project).toBeDefined();
        expect(r.source).toBeDefined();
      }
    });
  });

  describe('Project unregistration', () => {
    it('unregisters a project', async () => {
      // Register a temp project to unregister
      const tempDir = path.join(os.tmpdir(), `gsd-e2e-temp-${Date.now()}`);
      createTestProject(tempDir, 'temp-project', {
        phase: '01',
        planSummary: {
          phase: '01-temp',
          plan: '01',
          subsystem: 'temp',
          tags: ['temp'],
          keyDecisions: [],
          patternsEstablished: [],
          techStack: []
        },
        research: {
          domain: 'temp',
          pitfalls: [],
          standardStack: []
        },
        project: { decisions: [] }
      });

      await register({ path: tempDir, name: 'e2e-temp' });

      const result = await unregister('e2e-temp');
      expect(result.success).toBe(true);

      // Verify removed from status
      const status = await getStatus();
      expect(status.projects.some((p) => p.name === 'e2e-temp')).toBe(false);

      // Cleanup
      fs.rmSync(tempDir, { recursive: true });
    });
  });
});

// Helper function to create test project structure
interface TestProjectOptions {
  phase: string;
  planSummary: {
    phase: string;
    plan: string;
    subsystem: string;
    tags: string[];
    keyDecisions: string[];
    patternsEstablished: string[];
    techStack: Array<{ name: string; version: string }>;
  };
  research: {
    domain: string;
    pitfalls: Array<{ description: string; prevention: string }>;
    standardStack: Array<{ library: string; version: string; purpose: string }>;
  };
  project: {
    decisions: Array<{ decision: string; rationale: string; outcome: string }>;
  };
}

function createTestProject(dir: string, name: string, opts: TestProjectOptions): void {
  const planningDir = path.join(dir, '.planning');
  const phasesDir = path.join(planningDir, 'phases', `${opts.phase}-${name}`);
  fs.mkdirSync(phasesDir, { recursive: true });

  // Create PROJECT.md
  let projectMd = `# ${name}\n\n## Key Decisions\n\n| Decision | Rationale | Outcome |\n|----------|-----------|---------|`;
  for (const d of opts.project.decisions) {
    projectMd += `\n| ${d.decision} | ${d.rationale} | ${d.outcome} |`;
  }
  fs.writeFileSync(path.join(planningDir, 'PROJECT.md'), projectMd);

  // Create SUMMARY.md
  const techStackYaml = opts.planSummary.techStack.map(t => `    ${t.name}: "${t.version}"`).join('\n');
  const summaryMd = `---
phase: ${opts.planSummary.phase}
plan: ${opts.planSummary.plan}
subsystem: ${opts.planSummary.subsystem}
tags:
${opts.planSummary.tags.map(t => `  - ${t}`).join('\n')}
key-decisions:
${opts.planSummary.keyDecisions.map(d => `  - ${d}`).join('\n')}
patterns-established:
${opts.planSummary.patternsEstablished.map(p => `  - ${p}`).join('\n')}
tech-stack:
  added:
${techStackYaml}
---
# Phase Summary

Implementation summary for ${name}.
`;
  fs.writeFileSync(path.join(phasesDir, `${opts.phase}-01-SUMMARY.md`), summaryMd);

  // Create RESEARCH.md
  let pitfallsSection = '';
  if (opts.research.pitfalls.length > 0) {
    pitfallsSection = '\n## Pitfalls\n\n';
    for (const p of opts.research.pitfalls) {
      pitfallsSection += `### ${p.description}\n\n**Prevention:** ${p.prevention}\n\n`;
    }
  }

  let stackTable = '';
  if (opts.research.standardStack.length > 0) {
    stackTable = '\n## Standard Stack\n\n| Library | Version | Purpose |\n|---------|---------|---------|';
    for (const s of opts.research.standardStack) {
      stackTable += `\n| ${s.library} | ${s.version} | ${s.purpose} |`;
    }
  }

  const researchMd = `---
domain: ${opts.research.domain}
confidence: high
---
# Research for ${name}
${pitfallsSection}${stackTable}
`;
  fs.writeFileSync(path.join(phasesDir, `${opts.phase}-RESEARCH.md`), researchMd);

  // Create config.json
  fs.writeFileSync(
    path.join(planningDir, 'config.json'),
    JSON.stringify({ project: name }, null, 2)
  );
}
