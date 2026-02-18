# Phase 1: Foundation - Research

**Researched:** 2026-02-16
**Domain:** Graph engine, markdown artifact layer, CLI slash commands, git integration, fork boundary
**Confidence:** HIGH

## Summary

Phase 1 builds four foundational components: (1) a custom three-layer graph engine persisted as markdown, (2) artifact templates for FUTURE.md and MILESTONES.md, (3) Claude Code slash commands under the `/declare:*` namespace, and (4) git integration for atomic commits on every state change. The phase also establishes the fork boundary from GSD via FORK-BOUNDARY.md.

The graph engine is the most technically dense component (~300 lines, zero runtime dependencies). It must model declarations, milestones, and actions as nodes with many-to-many upward-causation edges, support three states (PENDING, ACTIVE, DONE), and persist entirely as markdown tables. The slash command system leverages Claude Code's skills/commands infrastructure (`.claude/commands/` or `.claude/skills/`), which uses markdown files with YAML frontmatter -- identical to GSD's existing pattern. The tooling layer (`declare-tools.cjs`) is forked from `gsd-tools.cjs` and bundled via esbuild into a single CJS file.

**Primary recommendation:** Build in this order: (1) FORK-BOUNDARY.md, (2) declare-tools.cjs scaffolding with graph engine core, (3) markdown persistence (parse/write FUTURE.md + MILESTONES.md), (4) slash commands wiring, (5) git integration, (6) `/declare:status` with validation.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Slash command design:**
- Colon-separated namespace: `/declare:init`, `/declare:status`, `/declare:help`
- Phase 1 commands: init (setup), status (graph state), help (discoverability)
- Re-init behavior: detect existing `.planning/`, offer to keep/replace each artifact individually (merge approach)
- Status command shows rich visual summary: graph stats, layer counts, health indicators, last activity

**Artifact formats:**
- FUTURE.md uses sectioned cards: each declaration gets its own section with ID, statement, status, and linked milestones
- Node IDs use semantic prefixes: D-01 (Declaration), M-01 (Milestone), A-01 (Action)
- Artifacts are human-editable: users can edit FUTURE.md and MILESTONES.md directly; system validates on next load

**Fork boundary:**
- Fork and diverge: copy GSD patterns into Declare's codebase, then evolve independently. No upstream dependency on GSD.
- Carry forward full agent stack: planner, executor, researcher, verifier -- adapted to work with graph structure
- FORK-BOUNDARY.md is a living document: tracks ongoing divergence from GSD, updated as Declare evolves
- Own tooling: `declare-tools.cjs` -- Declare's own CLI tooling, forked from gsd-tools patterns

**Graph model:**
- Many-to-many relationships: actions can serve multiple milestones, milestones can link to multiple declarations. Full graph, not a tree.
- Three node states: PENDING, ACTIVE, DONE -- tracks what's being worked on
- Markdown-only persistence: parse on load, write on save. No JSON cache. Simple and transparent.
- Validation on command: `/declare:status` runs structural validation (no orphans, no cycles, valid edges); normal operations trust the data

### Claude's Discretion

- Graph engine internal architecture and data structures
- Exact markdown parsing/writing implementation
- MILESTONES.md structure (single file vs two files for milestones and actions)
- Status command layout and formatting details
- Error message wording and help text content

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >= 18.0.0 | Runtime | LTS baseline, native fetch/structuredClone/node:test. Matches GSD. |
| JavaScript (CJS) | ES2022 | Language | GSD uses CJS throughout for Claude Code compatibility. JSDoc + @ts-check for type safety without build step. |
| esbuild | ^0.27.0 | Bundler | Already in GSD. Bundles declare-tools.cjs into single distributable file. Sub-second builds. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:test | built-in | Test runner | Testing graph engine operations (addNode, addEdge, topoSort, detectCycles) |
| node:assert | built-in | Assertions | Test assertions with strict mode |
| node:crypto | built-in | Hashing | SHA-256 for commit integrity if needed |
| node:child_process | built-in | Git operations | Shell out to git for atomic commits, status checks |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom graph engine | graphlib (2.1.8) | graphlib is unmaintained since 2020, general-purpose, doesn't model 3-layer hierarchy. Custom is simpler and domain-specific. |
| Custom toposort | toposort (2.0.2) | Kahn's algorithm is ~40 lines. toposort adds 2KB bundled. Either works; hand-roll recommended for zero-dep constraint. |
| Hand-rolled markdown parsing | gray-matter (4.0.3) | gray-matter handles frontmatter edge cases better, but FUTURE.md/MILESTONES.md use section-based cards, not frontmatter. Hand-rolled regex is appropriate for table/section parsing. |
| Raw ANSI codes | chalk (5.x) | Output is consumed by AI agents. Raw ANSI escape codes suffice. |

**Installation:**
```bash
# Dev dependencies only (graph engine has zero runtime deps)
npm install -D esbuild@^0.27.0
```

## Architecture Patterns

### Recommended Project Structure

```
declare-cc/
├── src/
│   ├── graph/
│   │   ├── engine.js          # DeclareDag class (~300 lines)
│   │   └── engine.test.js     # Graph engine tests
│   ├── artifacts/
│   │   ├── future.js          # FUTURE.md parser/writer
│   │   ├── milestones.js      # MILESTONES.md parser/writer
│   │   └── artifacts.test.js  # Artifact parsing tests
│   ├── git/
│   │   └── commit.js          # Atomic commit operations
│   ├── commands/
│   │   ├── init.js            # /declare:init logic
│   │   ├── status.js          # /declare:status logic
│   │   └── help.js            # /declare:help logic
│   └── declare-tools.js       # Entry point (subcommand dispatch)
├── commands/
│   └── declare/
│       ├── init.md            # Slash command: /declare:init
│       ├── status.md          # Slash command: /declare:status
│       └── help.md            # Slash command: /declare:help
├── agents/                    # Forked agent prompts (future phases)
├── workflows/                 # Forked workflow definitions
├── templates/                 # Artifact templates
│   ├── future.md              # FUTURE.md template
│   └── milestones.md          # MILESTONES.md template
├── esbuild.config.js          # Bundle src/ into dist/declare-tools.cjs
├── FORK-BOUNDARY.md           # Living document: GSD divergence tracking
└── dist/
    └── declare-tools.cjs      # Bundled single-file CLI tool
```

### Pattern 1: Graph Engine as In-Memory Adjacency List

**What:** The `DeclareDag` class stores nodes in a Map and edges as adjacency lists. No external graph library.

**When to use:** All graph operations -- adding nodes/edges, validation, topological sort, layer queries.

**Recommendation (Claude's Discretion area):**

```javascript
// Source: Custom design based on GSD architecture research + CONTEXT.md constraints
class DeclareDag {
  constructor() {
    this.nodes = new Map();      // id -> { id, type, title, status, metadata }
    this.upEdges = new Map();    // id -> Set of IDs this node causes/realizes (upward)
    this.downEdges = new Map();  // id -> Set of IDs that cause/realize this node (downward)
  }

  addNode(id, type, title, status = 'PENDING', metadata = {}) {
    // Validate semantic prefix: D-XX, M-XX, A-XX
    const prefixMap = { 'D': 'declaration', 'M': 'milestone', 'A': 'action' };
    const prefix = id.split('-')[0];
    if (prefixMap[prefix] !== type) throw new Error(`ID prefix ${prefix} doesn't match type ${type}`);

    this.nodes.set(id, { id, type, title, status, metadata });
    if (!this.upEdges.has(id)) this.upEdges.set(id, new Set());
    if (!this.downEdges.has(id)) this.downEdges.set(id, new Set());
    return this;
  }

  addEdge(from, to) {
    // Validate: edges flow upward (action->milestone or milestone->declaration)
    const fromNode = this.nodes.get(from);
    const toNode = this.nodes.get(to);
    if (!fromNode || !toNode) throw new Error(`Node not found: ${from} or ${to}`);

    const validEdges = {
      'action': 'milestone',
      'milestone': 'declaration',
    };
    if (validEdges[fromNode.type] !== toNode.type) {
      throw new Error(`Invalid edge: ${fromNode.type} -> ${toNode.type}`);
    }

    this.upEdges.get(from).add(to);
    this.downEdges.get(to).add(from);
    return this;
  }

  // Layer queries
  getDeclarations() { return this._byType('declaration'); }
  getMilestones() { return this._byType('milestone'); }
  getActions() { return this._byType('action'); }
  _byType(type) { return [...this.nodes.values()].filter(n => n.type === type); }

  // Validation (runs on /declare:status)
  validate() {
    const errors = [];

    // Check for orphan nodes (no edges at all)
    for (const [id, node] of this.nodes) {
      if (node.type === 'declaration') continue; // Declarations can be top-level
      if (this.upEdges.get(id).size === 0) {
        errors.push({ type: 'orphan', node: id, message: `${id} has no upward connection` });
      }
    }

    // Check for cycles (Kahn's algorithm)
    if (this._hasCycle()) {
      errors.push({ type: 'cycle', message: 'Graph contains a cycle' });
    }

    // Validate edge targets exist
    for (const [from, targets] of this.upEdges) {
      for (const to of targets) {
        if (!this.nodes.has(to)) {
          errors.push({ type: 'broken_edge', from, to, message: `Edge target ${to} not found` });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Topological sort (Kahn's algorithm, inverted edges for execution order)
  topologicalSort() {
    // For execution: actions first, then milestones, then declarations
    // Use downEdges (inverted): process nodes whose dependencies are all done
    const inDegree = new Map();
    const adjList = new Map();

    for (const id of this.nodes.keys()) {
      inDegree.set(id, 0);
      adjList.set(id, new Set());
    }

    // Build execution graph: if A causes M, then A must complete before M
    for (const [to, fromSet] of this.downEdges) {
      for (const from of fromSet) {
        adjList.get(from).add(to);
        inDegree.set(to, (inDegree.get(to) || 0) + 1);
      }
    }

    const queue = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const sorted = [];
    while (queue.length > 0) {
      const node = queue.shift();
      sorted.push(node);
      for (const neighbor of adjList.get(node)) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) queue.push(neighbor);
      }
    }

    if (sorted.length !== this.nodes.size) {
      throw new Error('Cycle detected: topological sort incomplete');
    }

    return sorted;
  }

  _hasCycle() {
    try {
      this.topologicalSort();
      return false;
    } catch {
      return true;
    }
  }

  // Serialization helpers
  toJSON() {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.upEdges.entries()].flatMap(([from, tos]) =>
        [...tos].map(to => ({ from, to }))
      ),
    };
  }

  static fromJSON(data) {
    const dag = new DeclareDag();
    for (const node of data.nodes) {
      dag.addNode(node.id, node.type, node.title, node.status, node.metadata);
    }
    for (const edge of data.edges) {
      dag.addEdge(edge.from, edge.to);
    }
    return dag;
  }
}
```

**Estimated size:** ~200 lines for the core class, ~100 lines for serialization/parsing helpers. Well within the ~300 line budget.

### Pattern 2: Markdown Section-Card Parsing

**What:** Parse FUTURE.md and MILESTONES.md as section-delimited cards (not frontmatter-based). Each `###` heading starts a new node card.

**When to use:** Loading graph state from disk, writing graph state back.

**Recommendation (Claude's Discretion area -- MILESTONES.md structure):**

Use a SINGLE MILESTONES.md file containing both milestones and actions. Rationale: keeping everything in one file simplifies parsing, reduces file count, and matches the user's decision that the graph is "markdown-only persistence." A single file is also easier for humans to scan.

**FUTURE.md format:**
```markdown
# Future: [Project Name]

## D-01: [Declaration Title]
**Statement:** [Present-tense truth statement]
**Status:** PENDING | ACTIVE | DONE
**Milestones:** M-01, M-02

## D-02: [Declaration Title]
**Statement:** [Present-tense truth statement]
**Status:** ACTIVE
**Milestones:** M-03
```

**MILESTONES.md format:**
```markdown
# Milestones & Actions: [Project Name]

## Milestones

| ID | Title | Status | Realizes | Caused By |
|----|-------|--------|----------|-----------|
| M-01 | [title] | PENDING | D-01 | A-01, A-02 |
| M-02 | [title] | ACTIVE | D-01 | A-03 |
| M-03 | [title] | PENDING | D-02 | A-04 |

## Actions

| ID | Title | Status | Causes |
|----|-------|--------|--------|
| A-01 | [title] | PENDING | M-01 |
| A-02 | [title] | DONE | M-01 |
| A-03 | [title] | ACTIVE | M-01, M-02 |
| A-04 | [title] | PENDING | M-03 |
```

**Parsing approach:** Simple regex-based line-by-line parsing. Split on `## ` for FUTURE.md sections. Parse `| ` delimited rows for MILESTONES.md tables. No AST library needed.

```javascript
// Parse a markdown table into array of objects
function parseMarkdownTable(text) {
  const lines = text.trim().split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 2) return [];

  const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
  // Skip separator line (lines[1])
  return lines.slice(2).map(line => {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] || ''; });
    return row;
  });
}

// Parse FUTURE.md into declaration nodes
function parseFutureFile(content) {
  const declarations = [];
  const sections = content.split(/^## /m).slice(1); // Skip file header

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const headerMatch = lines[0].match(/^(D-\d+):\s*(.+)/);
    if (!headerMatch) continue;

    const [, id, title] = headerMatch;
    const statement = extractField(lines, 'Statement');
    const status = extractField(lines, 'Status') || 'PENDING';
    const milestones = extractField(lines, 'Milestones')?.split(',').map(s => s.trim()) || [];

    declarations.push({ id, title, statement, status, milestones });
  }
  return declarations;
}

function extractField(lines, field) {
  const line = lines.find(l => l.startsWith(`**${field}:**`));
  if (!line) return null;
  return line.replace(`**${field}:**`, '').trim();
}
```

### Pattern 3: Slash Command as Thin Wrapper

**What:** Each `/declare:*` slash command is a markdown file in `.claude/commands/declare/` that references a workflow file containing the actual logic.

**When to use:** All three Phase 1 commands.

**How it works in Claude Code:**

Claude Code discovers slash commands from:
- Project-level: `.claude/commands/declare/init.md` creates `/declare:init`
- Personal-level: `~/.claude/commands/declare/init.md` creates `/declare:init`

The colon namespace comes from the directory structure: `commands/declare/init.md` = `/declare:init`. This matches GSD's pattern (`commands/gsd/help.md` = `/gsd:help`).

```yaml
# .claude/commands/declare/init.md
---
name: declare:init
description: Initialize Declare project with future declarations and graph structure
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---
<objective>
Initialize a Declare project in the current directory.
</objective>

<execution_context>
@path/to/declare-cc/workflows/init.md
</execution_context>

<process>
Execute the init workflow from the referenced file.
$ARGUMENTS
</process>
```

**Key details from official docs (HIGH confidence):**
- Frontmatter fields: `name`, `description`, `allowed-tools`, `disable-model-invocation`, `context`, `agent`, `argument-hint`
- Arguments via `$ARGUMENTS` (all args) or `$0`, `$1` (positional)
- Dynamic context injection with `` !`command` `` syntax (runs shell command, inserts output)
- `context: fork` runs in isolated subagent
- Skills (`.claude/skills/`) and commands (`.claude/commands/`) are equivalent; skills add optional features

### Pattern 4: Atomic Git Commits via declare-tools.cjs

**What:** Every state change (init, add node, change status) produces a single atomic git commit. The `declare-tools.cjs commit` subcommand handles this.

**When to use:** After every write operation that modifies `.planning/` files.

**Implementation:** Fork GSD's `cmdCommit` pattern exactly:

```javascript
function commitPlanningDocs(cwd, message, files) {
  const config = loadConfig(cwd);

  // Respect commit_docs config
  if (!config.commit_docs) return { committed: false, reason: 'skipped_config' };

  // Check if .planning is gitignored
  if (isGitIgnored(cwd, '.planning')) return { committed: false, reason: 'skipped_gitignored' };

  // Stage specific files
  const filesToStage = files.length > 0 ? files : ['.planning/'];
  for (const file of filesToStage) {
    execGit(cwd, ['add', file]);
  }

  // Commit
  const result = execGit(cwd, ['commit', '-m', message]);
  if (result.exitCode !== 0) {
    if (result.stdout.includes('nothing to commit')) {
      return { committed: false, reason: 'nothing_to_commit' };
    }
    return { committed: false, reason: 'error', error: result.stderr };
  }

  const hash = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
  return { committed: true, hash: hash.stdout };
}
```

### Anti-Patterns to Avoid

- **JSON cache alongside markdown:** User explicitly decided "markdown-only persistence, no JSON cache." Do not create a `.planning/dag.json` or any binary state file. Parse markdown on load, write markdown on save.
- **Over-engineering the graph for Phase 1:** The graph engine needs addNode, addEdge, removeNode, validate, topologicalSort, and layer queries. Do NOT build wave scheduling, critical path, impact analysis, or coverage reports in Phase 1. Those are Phase 3+.
- **Frontmatter-based artifact format:** User decided FUTURE.md uses "sectioned cards" (## headers per declaration), not YAML frontmatter per file. Parse sections, not frontmatter.
- **Coupling to GSD upstream:** User decided "fork and diverge." Do not import from GSD or maintain an upstream remote. Copy patterns, then own them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git operations | Custom git client | `child_process.execSync('git ...')` | GSD's proven pattern. 20 lines covers all needed operations. |
| Test framework | Custom test harness | `node:test` + `node:assert` | Built into Node 18+. GSD already uses it. |
| CJS bundling | Multi-file distribution | esbuild single-file bundle | Users never run `npm install` in their config dir. One file = zero install friction. |
| Markdown table generation | Manual string concatenation | Simple template function | Table writing is repetitive. A 10-line helper avoids alignment bugs. |
| Cycle detection | BFS/DFS from scratch | Kahn's algorithm (built into topologicalSort) | Topological sort naturally detects cycles. One algorithm, two uses. |

**Key insight:** The graph engine IS the thing to hand-roll. Everything else should use proven patterns from GSD or Node.js built-ins.

## Common Pitfalls

### Pitfall 1: Markdown Parsing Brittleness

**What goes wrong:** Regex-based markdown parsing breaks when users hand-edit files with slightly different formatting (extra spaces, missing colons, reordered fields).
**Why it happens:** Users will edit FUTURE.md and MILESTONES.md directly (this is an explicit design goal). They won't follow the exact format every time.
**How to avoid:** Parse permissively, write strictly. Accept variations on input (flexible regex, trimmed whitespace, case-insensitive status matching). Always write output in canonical format. Validate on load and surface clear errors.
**Warning signs:** Tests only use perfectly formatted input. No tests with hand-edited files.

### Pitfall 2: Graph State Desync Between Files

**What goes wrong:** FUTURE.md references M-01 but MILESTONES.md doesn't have M-01. Or MILESTONES.md says A-01 causes M-02, but M-02 was deleted from FUTURE.md's milestones list.
**Why it happens:** Two files represent one graph. Edits to one file don't automatically update the other.
**How to avoid:** Load both files into a single DeclareDag instance. Validation catches cross-file inconsistencies. The `/declare:status` command runs this validation. On write, always write both files atomically (in the same git commit).
**Warning signs:** Code that writes one file without checking the other.

### Pitfall 3: Re-init Destroying User Data

**What goes wrong:** User runs `/declare:init` on an existing project and loses their declarations/milestones.
**Why it happens:** The init command creates fresh templates without checking for existing files.
**How to avoid:** Locked decision: "detect existing `.planning/`, offer to keep/replace each artifact individually." Always check for existing files first. Default to merge, not replace.
**Warning signs:** Init workflow that doesn't check `fs.existsSync()` before writing.

### Pitfall 4: Non-Atomic Multi-File Commits

**What goes wrong:** System writes FUTURE.md successfully, then crashes before writing MILESTONES.md. The graph is now in an inconsistent state.
**Why it happens:** Writing two files is not atomic at the filesystem level.
**How to avoid:** Write all files to disk first (all or nothing at the app level), then commit them all in a single `git add + git commit`. The git commit is the atomicity boundary. If a write fails mid-way, the previous git state is still valid.
**Warning signs:** Separate commits for FUTURE.md and MILESTONES.md changes to the same graph operation.

### Pitfall 5: Validation That Blocks Normal Operations

**What goes wrong:** The system validates on every operation, blocking work when there are minor inconsistencies (like an orphan action from a WIP edit).
**Why it happens:** Eagerness to enforce graph integrity everywhere.
**How to avoid:** Locked decision: "validation on command -- `/declare:status` runs structural validation; normal operations trust the data." Only validate when explicitly requested. Operations like addNode should not refuse because something else is orphaned.
**Warning signs:** Validation calls in addNode, addEdge, or write operations.

## Code Examples

### Creating a Graph and Persisting It

```javascript
// Create a new graph
const dag = new DeclareDag();

// Add nodes
dag.addNode('D-01', 'declaration', 'Users can declare futures', 'ACTIVE');
dag.addNode('M-01', 'milestone', 'CLI accepts declaration input', 'PENDING');
dag.addNode('A-01', 'action', 'Build declaration parser', 'PENDING');

// Add upward-causation edges
dag.addEdge('A-01', 'M-01');  // action causes milestone
dag.addEdge('M-01', 'D-01');  // milestone realizes declaration

// Validate
const validation = dag.validate();
// { valid: true, errors: [] }

// Write to disk
const futureContent = writeFutureFile(dag.getDeclarations(), 'My Project');
const milestonesContent = writeMilestonesFile(dag.getMilestones(), dag.getActions());
fs.writeFileSync('.planning/FUTURE.md', futureContent);
fs.writeFileSync('.planning/MILESTONES.md', milestonesContent);

// Atomic commit
commitPlanningDocs(cwd, 'declare: initialize project graph', [
  '.planning/FUTURE.md',
  '.planning/MILESTONES.md',
]);
```

### Loading a Graph From Disk

```javascript
// Read both files
const futureContent = fs.readFileSync('.planning/FUTURE.md', 'utf-8');
const msContent = fs.readFileSync('.planning/MILESTONES.md', 'utf-8');

// Parse into structured data
const declarations = parseFutureFile(futureContent);
const { milestones, actions } = parseMilestonesFile(msContent);

// Reconstruct graph
const dag = new DeclareDag();

for (const d of declarations) {
  dag.addNode(d.id, 'declaration', d.title, d.status, { statement: d.statement });
}
for (const m of milestones) {
  dag.addNode(m.id, 'milestone', m.title, m.status);
  // Add edges: milestone realizes declaration(s)
  for (const declId of m.realizes.split(',').map(s => s.trim())) {
    dag.addEdge(m.id, declId);
  }
}
for (const a of actions) {
  dag.addNode(a.id, 'action', a.title, a.status);
  // Add edges: action causes milestone(s)
  for (const msId of a.causes.split(',').map(s => s.trim())) {
    dag.addEdge(a.id, msId);
  }
}
```

### Slash Command Structure

```yaml
# .claude/commands/declare/status.md
---
name: declare:status
description: Show graph state, layer counts, health indicators, and last activity
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---
<objective>
Show rich visual summary of the Declare graph: node counts per layer,
status distribution, validation health, and recent activity.
</objective>

<execution_context>
@path/to/declare-cc/workflows/status.md
</execution_context>

<process>
Execute the status workflow from the referenced file.
$ARGUMENTS
</process>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.claude/commands/` only | `.claude/skills/` + `.claude/commands/` unified | Claude Code 2.1.3 (Jan 2026) | Both work identically. Skills add optional features (supporting files, subagent execution). Commands keep working. |
| Separate `name` in frontmatter required | `name` optional, defaults to directory/filename | Claude Code 2.1+ | Simpler command files. Name derived from path. |
| No dynamic context in commands | `!`command`` syntax for shell injection | Claude Code 2.1+ | Can embed `node declare-tools.cjs status --raw` output directly in command prompt. |

**Deprecated/outdated:**
- None relevant. GSD's patterns are current with Claude Code's latest command/skill system.

## Open Questions

1. **MILESTONES.md: single file vs. two files**
   - What we know: User left this to Claude's discretion. Two options: (a) single MILESTONES.md with both milestone and action tables, (b) separate MILESTONES.md and ACTIONS.md.
   - Recommendation: **Single file.** Reduces file count, easier to scan, simpler atomic writes. Both tables fit naturally under `## Milestones` and `## Actions` sections. The graph is small enough (typically 10-30 milestones, 30-100 actions) that one file stays manageable.
   - Confidence: HIGH -- clear tradeoff favoring simplicity.

2. **Where to install declare-tools.cjs**
   - What we know: GSD installs to `~/.claude/get-shit-done/bin/gsd-tools.cjs`. Declare forks and diverges.
   - What's unclear: Does Declare install to `~/.claude/declare-cc/bin/declare-tools.cjs`? Or a different location?
   - Recommendation: `~/.claude/declare-cc/bin/declare-tools.cjs` -- mirrors GSD's pattern, clear separation.
   - Confidence: MEDIUM -- depends on installation mechanism decisions (not in Phase 1 scope yet).

3. **Node ID auto-increment behavior**
   - What we know: IDs use semantic prefixes (D-01, M-01, A-01). Zero-padded two digits.
   - What's unclear: What happens at D-100? Does auto-increment scan existing IDs to find the next available number?
   - Recommendation: Scan existing nodes of the same type, find max numeric suffix, increment. Allow arbitrary width (D-01 through D-999). Two-digit padding is default for display.
   - Confidence: HIGH -- standard auto-increment pattern.

## Sources

### Primary (HIGH confidence)
- GSD source code: `gsd-tools.cjs` (~5200 lines) -- init patterns, commit operations, config loading, git integration, subcommand dispatch
- GSD slash commands: `.claude/commands/gsd/*.md` -- frontmatter structure, workflow references, argument passing
- [Claude Code official docs: Skills/Slash Commands](https://code.claude.com/docs/en/slash-commands) -- frontmatter reference, argument substitution, dynamic context injection, `context: fork`, skill vs command equivalence
- GSD project research: `.planning/research/ARCHITECTURE.md`, `STACK.md`, `PITFALLS.md` -- graph engine design, technology choices, domain pitfalls

### Secondary (MEDIUM confidence)
- [Claude Code slash commands blog post](https://en.bioerrorlog.work/entry/claude-code-custom-slash-command) -- confirms directory-based namespace pattern
- npm registry (verified in prior research): esbuild 0.27.3, gray-matter 4.0.3, toposort 2.0.2

### Tertiary (LOW confidence)
- None -- all claims verified against primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- directly forking GSD's proven stack, no new dependencies
- Architecture: HIGH -- graph engine design well-understood, patterns from GSD codebase analysis + DAG CS fundamentals
- Artifact formats: HIGH -- user locked the design decisions, implementation is straightforward markdown parsing
- Slash commands: HIGH -- verified against official Claude Code docs and GSD's working implementation
- Pitfalls: HIGH -- derived from GSD's existing patterns and project-specific research

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable domain, no rapidly changing dependencies)
