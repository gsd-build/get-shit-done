import { describe, it, expect } from 'vitest';
import { parsePlan, parseTasks, extractFrontmatter } from './plan-parser.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FULL_PLAN = `---
phase: 03-features
plan: 01
type: execute
wave: 2
depends_on: [01-01, 01-02]
files_modified: [src/models/user.ts, src/api/users.ts, src/components/UserList.tsx]
autonomous: true
requirements: [R001, R003]
must_haves:
  truths:
    - "User can see existing messages"
    - "User can send a message"
  artifacts:
    - path: src/components/Chat.tsx
      provides: Message list rendering
      min_lines: 30
    - path: src/app/api/chat/route.ts
      provides: Message CRUD operations
  key_links:
    - from: src/components/Chat.tsx
      to: /api/chat
      via: fetch in useEffect
      pattern: "fetch.*api/chat"
---

<objective>
Implement complete User feature as vertical slice.

Purpose: Self-contained user management that can run parallel to other features.
Output: User model, API endpoints, and UI components.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Only include SUMMARY refs if genuinely needed
@src/relevant/source.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create User model</name>
  <files>src/models/user.ts</files>
  <read_first>src/existing/types.ts, src/config/db.ts</read_first>
  <action>Define User type with id, email, name, createdAt. Export TypeScript interface.</action>
  <verify>tsc --noEmit passes</verify>
  <acceptance_criteria>
    - User type is exported from src/models/user.ts
    - Type includes id, email, name, createdAt fields
  </acceptance_criteria>
  <done>User type exported and usable</done>
</task>

<task type="auto">
  <name>Task 2: Create User API endpoints</name>
  <files>src/api/users.ts, src/api/middleware.ts</files>
  <action>GET /users (list), GET /users/:id (single), POST /users (create). Use User type from model.</action>
  <verify>fetch tests pass for all endpoints</verify>
  <done>All CRUD operations work</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Verify UI visually</name>
  <files>src/components/UserList.tsx</files>
  <action>Start dev server and present for review.</action>
  <verify>User confirms layout is correct</verify>
  <done>Visual verification passed</done>
</task>

</tasks>

<verification>
- [ ] npm run build succeeds
- [ ] API endpoints respond correctly
</verification>

<success_criteria>
- All tasks completed
- User feature works end-to-end
</success_criteria>
`;

const MINIMAL_PLAN = `---
phase: 01-test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: []
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
Minimal test plan.
</objective>

<tasks>
<task type="auto">
  <name>Single task</name>
  <files>output.txt</files>
  <action>Create output.txt</action>
  <verify>test -f output.txt</verify>
  <done>File exists</done>
</task>
</tasks>
`;

const MULTILINE_ACTION_PLAN = `---
phase: 02-impl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/server.ts]
autonomous: true
requirements: [R005]
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<tasks>
<task type="auto">
  <name>Build server with config</name>
  <files>src/server.ts</files>
  <action>
Create the Express server with the following setup:

1. Import express and configure middleware
2. Add routes for health check and API
3. Configure error handling with proper types:
   - ValidationError => 400
   - NotFoundError => 404
   - Default => 500

Example code structure:
\`\`\`typescript
const app = express();
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
\`\`\`

Make sure to handle the edge case where \`req.body\` contains
angle brackets like <script> or XML-like content.
  </action>
  <verify>npm run build && curl localhost:3000/health</verify>
  <done>Server starts and health endpoint returns 200</done>
</task>
</tasks>
`;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('extractFrontmatter', () => {
  it('extracts basic key-value pairs', () => {
    const result = extractFrontmatter(FULL_PLAN);
    expect(result.phase).toBe('03-features');
    expect(result.plan).toBe('01');
    expect(result.type).toBe('execute');
  });

  it('coerces numeric values', () => {
    const result = extractFrontmatter(FULL_PLAN);
    expect(result.wave).toBe(2);
  });

  it('coerces boolean values', () => {
    const result = extractFrontmatter(FULL_PLAN);
    expect(result.autonomous).toBe(true);
  });

  it('parses inline arrays', () => {
    const result = extractFrontmatter(FULL_PLAN);
    expect(result.depends_on).toEqual(['01-01', '01-02']);
    expect(result.files_modified).toEqual([
      'src/models/user.ts',
      'src/api/users.ts',
      'src/components/UserList.tsx',
    ]);
    expect(result.requirements).toEqual(['R001', 'R003']);
  });

  it('parses empty inline arrays', () => {
    const result = extractFrontmatter(MINIMAL_PLAN);
    expect(result.depends_on).toEqual([]);
    expect(result.files_modified).toEqual([]);
    expect(result.requirements).toEqual([]);
  });

  it('returns empty object for content without frontmatter', () => {
    const result = extractFrontmatter('# Just a heading\nSome content');
    expect(result).toEqual({});
  });

  it('returns empty object for empty string', () => {
    const result = extractFrontmatter('');
    expect(result).toEqual({});
  });
});

describe('parsePlan — frontmatter', () => {
  it('parses all typed frontmatter fields', () => {
    const result = parsePlan(FULL_PLAN);
    const fm = result.frontmatter;

    expect(fm.phase).toBe('03-features');
    expect(fm.plan).toBe('01');
    expect(fm.type).toBe('execute');
    expect(fm.wave).toBe(2);
    expect(fm.depends_on).toEqual(['01-01', '01-02']);
    expect(fm.files_modified).toEqual([
      'src/models/user.ts',
      'src/api/users.ts',
      'src/components/UserList.tsx',
    ]);
    expect(fm.autonomous).toBe(true);
    expect(fm.requirements).toEqual(['R001', 'R003']);
  });

  it('parses must_haves.truths', () => {
    const result = parsePlan(FULL_PLAN);
    expect(result.frontmatter.must_haves.truths).toEqual([
      'User can see existing messages',
      'User can send a message',
    ]);
  });

  it('parses must_haves.artifacts', () => {
    const result = parsePlan(FULL_PLAN);
    const artifacts = result.frontmatter.must_haves.artifacts;
    expect(artifacts).toHaveLength(2);
    expect(artifacts[0]).toMatchObject({
      path: 'src/components/Chat.tsx',
      provides: 'Message list rendering',
      min_lines: 30,
    });
    expect(artifacts[1]).toMatchObject({
      path: 'src/app/api/chat/route.ts',
      provides: 'Message CRUD operations',
    });
  });

  it('parses must_haves.key_links', () => {
    const result = parsePlan(FULL_PLAN);
    const links = result.frontmatter.must_haves.key_links;
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      from: 'src/components/Chat.tsx',
      to: '/api/chat',
      via: 'fetch in useEffect',
      pattern: 'fetch.*api/chat',
    });
  });

  it('parses empty must_haves', () => {
    const result = parsePlan(MINIMAL_PLAN);
    expect(result.frontmatter.must_haves).toEqual({
      truths: [],
      artifacts: [],
      key_links: [],
    });
  });

  it('provides defaults for missing frontmatter', () => {
    const result = parsePlan('<tasks></tasks>');
    expect(result.frontmatter.phase).toBe('');
    expect(result.frontmatter.wave).toBe(1);
    expect(result.frontmatter.depends_on).toEqual([]);
    expect(result.frontmatter.autonomous).toBe(true);
    expect(result.frontmatter.must_haves).toEqual({
      truths: [],
      artifacts: [],
      key_links: [],
    });
  });
});

describe('parsePlan — XML tasks', () => {
  it('parses auto tasks', () => {
    const result = parsePlan(FULL_PLAN);
    expect(result.tasks).toHaveLength(3);

    const task1 = result.tasks[0];
    expect(task1.type).toBe('auto');
    expect(task1.name).toBe('Task 1: Create User model');
    expect(task1.files).toEqual(['src/models/user.ts']);
    expect(task1.read_first).toEqual(['src/existing/types.ts', 'src/config/db.ts']);
    expect(task1.action).toBe(
      'Define User type with id, email, name, createdAt. Export TypeScript interface.',
    );
    expect(task1.verify).toBe('tsc --noEmit passes');
    expect(task1.done).toBe('User type exported and usable');
  });

  it('parses checkpoint tasks', () => {
    const result = parsePlan(FULL_PLAN);
    const checkpoint = result.tasks[2];
    expect(checkpoint.type).toBe('checkpoint:human-verify');
    expect(checkpoint.name).toBe('Verify UI visually');
  });

  it('parses acceptance_criteria list', () => {
    const result = parsePlan(FULL_PLAN);
    expect(result.tasks[0].acceptance_criteria).toEqual([
      'User type is exported from src/models/user.ts',
      'Type includes id, email, name, createdAt fields',
    ]);
  });

  it('parses multiple files from comma-separated list', () => {
    const result = parsePlan(FULL_PLAN);
    const task2 = result.tasks[1];
    expect(task2.files).toEqual(['src/api/users.ts', 'src/api/middleware.ts']);
  });

  it('handles missing optional elements', () => {
    const result = parsePlan(FULL_PLAN);
    const task2 = result.tasks[1];
    // Task 2 has no read_first or acceptance_criteria
    expect(task2.read_first).toEqual([]);
    expect(task2.acceptance_criteria).toEqual([]);
  });

  it('handles multiline action blocks', () => {
    const result = parsePlan(MULTILINE_ACTION_PLAN);
    expect(result.tasks).toHaveLength(1);

    const task = result.tasks[0];
    expect(task.action).toContain('Create the Express server');
    expect(task.action).toContain('ValidationError => 400');
    expect(task.action).toContain('app.get');
    // The angle brackets inside action should be preserved
    expect(task.action).toContain('angle brackets like <script>');
  });

  it('returns empty array for no tasks', () => {
    const result = parsePlan('---\nphase: test\n---\n\nNo tasks here.');
    expect(result.tasks).toEqual([]);
  });
});

describe('parsePlan — sections', () => {
  it('extracts objective', () => {
    const result = parsePlan(FULL_PLAN);
    expect(result.objective).toContain('Implement complete User feature');
    expect(result.objective).toContain('Self-contained user management');
  });

  it('extracts execution_context references', () => {
    const result = parsePlan(FULL_PLAN);
    expect(result.execution_context).toEqual([
      '~/.claude/get-shit-done/workflows/execute-plan.md',
      '~/.claude/get-shit-done/templates/summary.md',
    ]);
  });

  it('extracts context references (skipping comments)', () => {
    const result = parsePlan(FULL_PLAN);
    expect(result.context_refs).toEqual([
      '.planning/PROJECT.md',
      '.planning/ROADMAP.md',
      '.planning/STATE.md',
      'src/relevant/source.ts',
    ]);
  });

  it('returns empty sections for missing blocks', () => {
    const result = parsePlan(MINIMAL_PLAN);
    expect(result.execution_context).toEqual([]);
    // context_refs should be empty when no <context> block
    expect(result.context_refs).toEqual([]);
  });
});

describe('parsePlan — edge cases', () => {
  it('handles empty string input', () => {
    const result = parsePlan('');
    expect(result.frontmatter.phase).toBe('');
    expect(result.tasks).toEqual([]);
    expect(result.raw).toBe('');
  });

  it('handles null-ish input without crashing', () => {
    // @ts-expect-error — testing runtime guard
    const result = parsePlan(null);
    expect(result.tasks).toEqual([]);
    expect(result.raw).toBe('');
  });

  it('handles undefined input without crashing', () => {
    // @ts-expect-error — testing runtime guard
    const result = parsePlan(undefined);
    expect(result.tasks).toEqual([]);
    expect(result.raw).toBe('');
  });

  it('preserves raw content', () => {
    const result = parsePlan(MINIMAL_PLAN);
    expect(result.raw).toBe(MINIMAL_PLAN);
  });

  it('handles malformed XML gracefully (unclosed tags)', () => {
    const content = `---
phase: test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: []
must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<tasks>
<task type="auto">
  <name>Broken task</name>
  <action>This action is never closed
</tasks>
`;
    // Should not throw — just parse what it can
    const result = parsePlan(content);
    expect(result.tasks).toEqual([]); // Can't match <task>...</task> if malformed
    expect(result.frontmatter.phase).toBe('test');
  });

  it('handles content with only frontmatter', () => {
    const content = `---
phase: 01-solo
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: [R001]
must_haves:
  truths: []
  artifacts: []
  key_links: []
---
`;
    const result = parsePlan(content);
    expect(result.frontmatter.phase).toBe('01-solo');
    expect(result.frontmatter.requirements).toEqual(['R001']);
    expect(result.tasks).toEqual([]);
    expect(result.objective).toBe('');
  });

  it('handles code snippets with angle brackets inside action', () => {
    const result = parsePlan(MULTILINE_ACTION_PLAN);
    const action = result.tasks[0].action;
    // The <script> inside the action text should be preserved (it's between <action>...</action>)
    expect(action).toContain('<script>');
    // TypeScript code block with angle brackets should be preserved
    expect(action).toContain("res.json({ status: 'ok' })");
  });

  it('handles plan with boolean autonomous=false', () => {
    const content = `---
phase: test
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements: []
must_haves:
  truths: []
  artifacts: []
  key_links: []
---
`;
    const result = parsePlan(content);
    expect(result.frontmatter.autonomous).toBe(false);
  });
});

describe('parseTasks — standalone', () => {
  it('extracts tasks from raw task XML', () => {
    const xml = `
<tasks>
<task type="auto">
  <name>Do something</name>
  <files>a.ts</files>
  <action>Build the thing</action>
  <verify>npm test</verify>
  <done>It works</done>
</task>
</tasks>
`;
    const tasks = parseTasks(xml);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('Do something');
    expect(tasks[0].type).toBe('auto');
  });

  it('defaults task type to auto when attribute missing', () => {
    const xml = `<tasks><task><name>No type</name><action>Do it</action></task></tasks>`;
    const tasks = parseTasks(xml);
    expect(tasks[0].type).toBe('auto');
  });
});
