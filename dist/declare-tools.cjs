#!/usr/bin/env node
"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/git/commit.js
var require_commit = __commonJS({
  "src/git/commit.js"(exports2, module2) {
    "use strict";
    var { execFileSync } = require("node:child_process");
    var { readFileSync, existsSync } = require("node:fs");
    var { join } = require("node:path");
    function execGit(cwd, args) {
      try {
        const stdout = execFileSync("git", args, {
          cwd,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"]
        });
        return { exitCode: 0, stdout: stdout.trim(), stderr: "" };
      } catch (err) {
        return {
          exitCode: err.status || 1,
          stdout: (err.stdout || "").trim(),
          stderr: (err.stderr || "").trim()
        };
      }
    }
    function loadConfig(cwd) {
      const configPath = join(cwd, ".planning", "config.json");
      if (!existsSync(configPath)) {
        return { commit_docs: true };
      }
      try {
        const raw = readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(raw);
        return { commit_docs: true, ...parsed };
      } catch {
        return { commit_docs: true };
      }
    }
    function isGitIgnored(cwd, path) {
      const result = execGit(cwd, ["check-ignore", "-q", path]);
      return result.exitCode === 0;
    }
    function commitPlanningDocs2(cwd, message, files) {
      const config = loadConfig(cwd);
      if (!config.commit_docs) {
        return { committed: false, reason: "skipped_config" };
      }
      if (isGitIgnored(cwd, ".planning")) {
        return { committed: false, reason: "skipped_gitignored" };
      }
      const filesToStage = files.length > 0 ? files : [".planning/"];
      for (const file of filesToStage) {
        const addResult = execGit(cwd, ["add", file]);
        if (addResult.exitCode !== 0) {
          return { committed: false, reason: "error", error: `Failed to stage ${file}: ${addResult.stderr}` };
        }
      }
      const result = execGit(cwd, ["commit", "-m", message]);
      if (result.exitCode !== 0) {
        const combined = result.stdout + " " + result.stderr;
        if (combined.includes("nothing to commit") || combined.includes("nothing added to commit")) {
          return { committed: false, reason: "nothing_to_commit" };
        }
        return { committed: false, reason: "error", error: result.stderr || result.stdout };
      }
      const hashResult = execGit(cwd, ["rev-parse", "--short", "HEAD"]);
      return { committed: true, hash: hashResult.stdout };
    }
    module2.exports = { commitPlanningDocs: commitPlanningDocs2, loadConfig, execGit };
  }
});

// src/artifacts/future.js
var require_future = __commonJS({
  "src/artifacts/future.js"(exports2, module2) {
    "use strict";
    function extractField(lines, field) {
      const pattern = new RegExp(`^\\*\\*${field}:\\*\\*`, "i");
      const line = lines.find((l) => pattern.test(l.trim()));
      if (!line) return null;
      return line.trim().replace(/^\*\*[^:]+:\*\*\s*/, "").trim();
    }
    function parseFutureFile(content) {
      if (!content || !content.trim()) return [];
      const declarations = [];
      const sections = content.split(/^## /m).slice(1);
      for (const section of sections) {
        const lines = section.trim().split("\n");
        const headerMatch = lines[0].match(/^(D-\d+):\s*(.+)/);
        if (!headerMatch) continue;
        const [, id, title] = headerMatch;
        const statement = extractField(lines, "Statement") || "";
        const rawStatus = extractField(lines, "Status") || "PENDING";
        const status = rawStatus.toUpperCase().trim();
        const rawMilestones = extractField(lines, "Milestones");
        const milestones = rawMilestones ? rawMilestones.split(",").map((s) => s.trim()).filter(Boolean) : [];
        declarations.push({ id, title: title.trim(), statement, status, milestones });
      }
      return declarations;
    }
    function writeFutureFile(declarations, projectName) {
      const lines = [`# Future: ${projectName}`, ""];
      for (const d of declarations) {
        lines.push(`## ${d.id}: ${d.title}`);
        lines.push(`**Statement:** ${d.statement}`);
        lines.push(`**Status:** ${d.status}`);
        lines.push(`**Milestones:** ${d.milestones.join(", ")}`);
        lines.push("");
      }
      return lines.join("\n");
    }
    module2.exports = { parseFutureFile, writeFutureFile };
  }
});

// src/artifacts/milestones.js
var require_milestones = __commonJS({
  "src/artifacts/milestones.js"(exports2, module2) {
    "use strict";
    function parseMarkdownTable(text) {
      const lines = text.trim().split("\n").filter((l) => l.trim().startsWith("|"));
      if (lines.length < 2) return [];
      const headers = lines[0].split("|").map((h) => h.trim()).filter(Boolean);
      return lines.slice(2).map((line) => {
        const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
        const row = {};
        headers.forEach((h, i) => {
          row[h] = cells[i] || "";
        });
        return row;
      });
    }
    function splitMultiValue(value) {
      if (!value || !value.trim()) return [];
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
    function parseMilestonesFile(content) {
      if (!content || !content.trim()) {
        return { milestones: [], actions: [] };
      }
      const milestonesMatch = content.match(/## Milestones\s*\n([\s\S]*?)(?=## Actions|$)/i);
      const actionsMatch = content.match(/## Actions\s*\n([\s\S]*?)$/i);
      const milestoneRows = milestonesMatch ? parseMarkdownTable(milestonesMatch[1]) : [];
      const actionRows = actionsMatch ? parseMarkdownTable(actionsMatch[1]) : [];
      const milestones = milestoneRows.map((row) => ({
        id: (row["ID"] || "").trim(),
        title: (row["Title"] || "").trim(),
        status: (row["Status"] || "PENDING").trim().toUpperCase(),
        realizes: splitMultiValue(row["Realizes"] || ""),
        causedBy: splitMultiValue(row["Caused By"] || "")
      })).filter((m) => m.id);
      const actions = actionRows.map((row) => ({
        id: (row["ID"] || "").trim(),
        title: (row["Title"] || "").trim(),
        status: (row["Status"] || "PENDING").trim().toUpperCase(),
        causes: splitMultiValue(row["Causes"] || "")
      })).filter((a) => a.id);
      return { milestones, actions };
    }
    function pad(str, width) {
      return str + " ".repeat(Math.max(0, width - str.length));
    }
    function writeMilestonesFile(milestones, actions, projectName) {
      const lines = [`# Milestones & Actions: ${projectName}`, ""];
      lines.push("## Milestones", "");
      const mHeaders = ["ID", "Title", "Status", "Realizes", "Caused By"];
      const mRows = milestones.map((m) => [
        m.id,
        m.title,
        m.status,
        m.realizes.join(", "),
        m.causedBy.join(", ")
      ]);
      lines.push(...formatTable(mHeaders, mRows));
      lines.push("");
      lines.push("## Actions", "");
      const aHeaders = ["ID", "Title", "Status", "Causes"];
      const aRows = actions.map((a) => [
        a.id,
        a.title,
        a.status,
        a.causes.join(", ")
      ]);
      lines.push(...formatTable(aHeaders, aRows));
      lines.push("");
      return lines.join("\n");
    }
    function formatTable(headers, rows) {
      const widths = headers.map((h, i) => {
        const cellWidths = rows.map((r) => (r[i] || "").length);
        return Math.max(h.length, ...cellWidths);
      });
      const headerLine = "| " + headers.map((h, i) => pad(h, widths[i])).join(" | ") + " |";
      const separatorLine = "|" + widths.map((w) => "-".repeat(w + 2)).join("|") + "|";
      const dataLines = rows.map(
        (row) => "| " + row.map((cell, i) => pad(cell, widths[i])).join(" | ") + " |"
      );
      return [headerLine, separatorLine, ...dataLines];
    }
    module2.exports = { parseMilestonesFile, writeMilestonesFile, parseMarkdownTable };
  }
});

// src/commands/init.js
var require_init = __commonJS({
  "src/commands/init.js"(exports2, module2) {
    "use strict";
    var { existsSync, mkdirSync, writeFileSync, readFileSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { writeFutureFile } = require_future();
    var { writeMilestonesFile } = require_milestones();
    var { commitPlanningDocs: commitPlanningDocs2 } = require_commit();
    function runInit2(cwd, args) {
      const projectName = args && args[0] || basename(cwd);
      const planningDir = join(cwd, ".planning");
      const artifacts = [
        { name: "FUTURE.md", path: join(planningDir, "FUTURE.md") },
        { name: "MILESTONES.md", path: join(planningDir, "MILESTONES.md") },
        { name: "config.json", path: join(planningDir, "config.json") }
      ];
      const created = [];
      const existing = [];
      if (!existsSync(planningDir)) {
        mkdirSync(planningDir, { recursive: true });
      }
      for (const artifact of artifacts) {
        if (existsSync(artifact.path)) {
          existing.push(artifact.name);
        } else {
          let content;
          switch (artifact.name) {
            case "FUTURE.md":
              content = writeFutureFile([], projectName);
              break;
            case "MILESTONES.md":
              content = writeMilestonesFile([], [], projectName);
              break;
            case "config.json":
              content = JSON.stringify({ commit_docs: true }, null, 2) + "\n";
              break;
          }
          writeFileSync(artifact.path, content, "utf-8");
          created.push(artifact.name);
        }
      }
      if (created.length === 0) {
        return {
          initialized: true,
          created,
          existing,
          committed: false
        };
      }
      const filesToCommit = created.map((name) => join(".planning", name));
      const commitResult = commitPlanningDocs2(
        cwd,
        `docs(declare): initialize project "${projectName}"`,
        filesToCommit
      );
      return {
        initialized: true,
        created,
        existing,
        committed: commitResult.committed,
        hash: commitResult.hash
      };
    }
    module2.exports = { runInit: runInit2 };
  }
});

// src/graph/engine.js
var require_engine = __commonJS({
  "src/graph/engine.js"(exports2, module2) {
    "use strict";
    var PREFIX_TO_TYPE = { D: "declaration", M: "milestone", A: "action" };
    var TYPE_TO_PREFIX = { declaration: "D", milestone: "M", action: "A" };
    var VALID_STATUSES = /* @__PURE__ */ new Set(["PENDING", "ACTIVE", "DONE"]);
    var VALID_TYPES = /* @__PURE__ */ new Set(["declaration", "milestone", "action"]);
    var VALID_EDGE_DIRECTIONS = {
      action: "milestone",
      milestone: "declaration"
    };
    var DeclareDag = class _DeclareDag {
      constructor() {
        this.nodes = /* @__PURE__ */ new Map();
        this.upEdges = /* @__PURE__ */ new Map();
        this.downEdges = /* @__PURE__ */ new Map();
      }
      // ---------------------------------------------------------------------------
      // Node operations
      // ---------------------------------------------------------------------------
      /**
       * Add a node to the graph.
       * @param {string} id - Semantic ID (D-XX, M-XX, A-XX)
       * @param {string} type - 'declaration' | 'milestone' | 'action'
       * @param {string} title - Human-readable title
       * @param {string} [status='PENDING'] - PENDING | ACTIVE | DONE
       * @param {Record<string, any>} [metadata={}] - Additional metadata
       * @returns {DeclareDag} this (for chaining)
       */
      addNode(id, type, title, status = "PENDING", metadata = {}) {
        if (!VALID_TYPES.has(type)) {
          throw new Error(`Invalid node type: ${type}. Must be one of: declaration, milestone, action`);
        }
        if (!VALID_STATUSES.has(status)) {
          throw new Error(`Invalid status: ${status}. Must be one of: PENDING, ACTIVE, DONE`);
        }
        const prefix = id.split("-")[0];
        if (PREFIX_TO_TYPE[prefix] !== type) {
          throw new Error(
            `ID prefix '${prefix}' doesn't match type '${type}'. Expected prefix '${TYPE_TO_PREFIX[type]}' for type '${type}'`
          );
        }
        if (!/^[DMA]-\d+$/.test(id)) {
          throw new Error(`Invalid ID format: ${id}. Expected format: D-01, M-01, A-01`);
        }
        if (this.nodes.has(id)) {
          throw new Error(`Node already exists: ${id}`);
        }
        this.nodes.set(id, { id, type, title, status, metadata });
        if (!this.upEdges.has(id)) this.upEdges.set(id, /* @__PURE__ */ new Set());
        if (!this.downEdges.has(id)) this.downEdges.set(id, /* @__PURE__ */ new Set());
        return this;
      }
      /**
       * Remove a node and all its edges.
       * @param {string} id
       * @returns {DeclareDag} this
       */
      removeNode(id) {
        if (!this.nodes.has(id)) {
          throw new Error(`Node not found: ${id}`);
        }
        const upTargets = this.upEdges.get(id);
        if (upTargets) {
          for (const target of upTargets) {
            const downSet = this.downEdges.get(target);
            if (downSet) downSet.delete(id);
          }
        }
        const downSources = this.downEdges.get(id);
        if (downSources) {
          for (const source of downSources) {
            const upSet = this.upEdges.get(source);
            if (upSet) upSet.delete(id);
          }
        }
        this.upEdges.delete(id);
        this.downEdges.delete(id);
        this.nodes.delete(id);
        return this;
      }
      /**
       * Get a node by ID.
       * @param {string} id
       * @returns {{id: string, type: string, title: string, status: string, metadata: Record<string, any>} | undefined}
       */
      getNode(id) {
        return this.nodes.get(id);
      }
      /**
       * Update a node's status.
       * @param {string} id
       * @param {string} status - PENDING | ACTIVE | DONE
       * @returns {DeclareDag} this
       */
      updateNodeStatus(id, status) {
        if (!VALID_STATUSES.has(status)) {
          throw new Error(`Invalid status: ${status}. Must be one of: PENDING, ACTIVE, DONE`);
        }
        const node = this.nodes.get(id);
        if (!node) {
          throw new Error(`Node not found: ${id}`);
        }
        node.status = status;
        return this;
      }
      // ---------------------------------------------------------------------------
      // Edge operations
      // ---------------------------------------------------------------------------
      /**
       * Add an upward-causation edge.
       * Valid directions: action->milestone, milestone->declaration.
       * @param {string} from - Source node ID
       * @param {string} to - Target node ID
       * @returns {DeclareDag} this
       */
      addEdge(from, to) {
        const fromNode = this.nodes.get(from);
        const toNode = this.nodes.get(to);
        if (!fromNode) throw new Error(`Node not found: ${from}`);
        if (!toNode) throw new Error(`Node not found: ${to}`);
        const expectedTo = VALID_EDGE_DIRECTIONS[fromNode.type];
        if (expectedTo !== toNode.type) {
          throw new Error(
            `Invalid edge: ${fromNode.type} -> ${toNode.type}. Only action->milestone and milestone->declaration edges are allowed`
          );
        }
        this.upEdges.get(from).add(to);
        this.downEdges.get(to).add(from);
        return this;
      }
      /**
       * Remove an edge.
       * @param {string} from
       * @param {string} to
       * @returns {DeclareDag} this
       */
      removeEdge(from, to) {
        const upSet = this.upEdges.get(from);
        if (upSet) upSet.delete(to);
        const downSet = this.downEdges.get(to);
        if (downSet) downSet.delete(from);
        return this;
      }
      // ---------------------------------------------------------------------------
      // Layer queries
      // ---------------------------------------------------------------------------
      /** @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>} */
      getDeclarations() {
        return this._byType("declaration");
      }
      /** @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>} */
      getMilestones() {
        return this._byType("milestone");
      }
      /** @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>} */
      getActions() {
        return this._byType("action");
      }
      /**
       * Get nodes that this node causes/realizes (upward neighbors).
       * @param {string} id
       * @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>}
       */
      getUpstream(id) {
        const targets = this.upEdges.get(id);
        if (!targets) return [];
        return [...targets].map((t) => this.nodes.get(t)).filter(Boolean);
      }
      /**
       * Get nodes that cause/realize this node (downward neighbors).
       * @param {string} id
       * @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>}
       */
      getDownstream(id) {
        const sources = this.downEdges.get(id);
        if (!sources) return [];
        return [...sources].map((s) => this.nodes.get(s)).filter(Boolean);
      }
      /**
       * @param {string} type
       * @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>}
       * @private
       */
      _byType(type) {
        return [...this.nodes.values()].filter((n) => n.type === type);
      }
      // ---------------------------------------------------------------------------
      // Validation (runs on /declare:status, NOT on normal operations)
      // ---------------------------------------------------------------------------
      /**
       * Validate graph structure.
       * Checks: orphan nodes, cycles, broken edges, invalid edge directions.
       * @returns {{ valid: boolean, errors: Array<{type: string, node?: string, from?: string, to?: string, message: string}> }}
       */
      validate() {
        const errors = [];
        for (const [id, node] of this.nodes) {
          if (node.type === "declaration") continue;
          if (this.upEdges.get(id).size === 0) {
            errors.push({
              type: "orphan",
              node: id,
              message: `${id} has no upward connection`
            });
          }
        }
        if (this._hasCycle()) {
          errors.push({
            type: "cycle",
            message: "Graph contains a cycle"
          });
        }
        for (const [from, targets] of this.upEdges) {
          for (const to of targets) {
            if (!this.nodes.has(to)) {
              errors.push({
                type: "broken_edge",
                from,
                to,
                message: `Edge target ${to} not found`
              });
            }
          }
        }
        return { valid: errors.length === 0, errors };
      }
      // ---------------------------------------------------------------------------
      // Topological sort
      // ---------------------------------------------------------------------------
      /**
       * Kahn's algorithm topological sort.
       * Returns node IDs in execution order: actions first, then milestones, then declarations.
       * @returns {string[]}
       * @throws {Error} If cycle detected
       */
      topologicalSort() {
        const inDegree = /* @__PURE__ */ new Map();
        const adjList = /* @__PURE__ */ new Map();
        for (const id of this.nodes.keys()) {
          inDegree.set(id, 0);
          adjList.set(id, /* @__PURE__ */ new Set());
        }
        for (const [from, targets] of this.upEdges) {
          for (const to of targets) {
            if (!this.nodes.has(to)) continue;
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
          throw new Error("Cycle detected: topological sort incomplete");
        }
        return sorted;
      }
      /**
       * Check if graph has a cycle.
       * @returns {boolean}
       * @private
       */
      _hasCycle() {
        try {
          this.topologicalSort();
          return false;
        } catch {
          return true;
        }
      }
      // ---------------------------------------------------------------------------
      // Serialization
      // ---------------------------------------------------------------------------
      /**
       * Serialize graph to JSON-compatible object.
       * @returns {{ nodes: Array, edges: Array<{from: string, to: string}> }}
       */
      toJSON() {
        return {
          nodes: [...this.nodes.values()].map((n) => ({ ...n })),
          edges: [...this.upEdges.entries()].flatMap(
            ([from, tos]) => [...tos].map((to) => ({ from, to }))
          )
        };
      }
      /**
       * Reconstruct DeclareDag from JSON.
       * @param {{ nodes: Array, edges: Array<{from: string, to: string}> }} data
       * @returns {DeclareDag}
       */
      static fromJSON(data) {
        const dag = new _DeclareDag();
        for (const node of data.nodes) {
          dag.addNode(node.id, node.type, node.title, node.status, node.metadata || {});
        }
        for (const edge of data.edges) {
          dag.addEdge(edge.from, edge.to);
        }
        return dag;
      }
      // ---------------------------------------------------------------------------
      // Auto-increment helper
      // ---------------------------------------------------------------------------
      /**
       * Get the next available ID for a given type.
       * Scans existing nodes, finds max numeric suffix, returns next ID.
       * @param {string} type - 'declaration' | 'milestone' | 'action'
       * @returns {string} Next ID (e.g., 'D-03' if D-01, D-02 exist)
       */
      nextId(type) {
        if (!VALID_TYPES.has(type)) {
          throw new Error(`Invalid type: ${type}`);
        }
        const prefix = TYPE_TO_PREFIX[type];
        let max = 0;
        for (const [id, node] of this.nodes) {
          if (node.type === type) {
            const num = parseInt(id.split("-")[1], 10);
            if (num > max) max = num;
          }
        }
        const next = max + 1;
        const padded = next < 10 ? `0${next}` : `${next}`;
        return `${prefix}-${padded}`;
      }
      // ---------------------------------------------------------------------------
      // Node counts
      // ---------------------------------------------------------------------------
      /** @returns {number} Total node count */
      get size() {
        return this.nodes.size;
      }
      /**
       * Get graph statistics.
       * @returns {{ declarations: number, milestones: number, actions: number, edges: number, byStatus: {PENDING: number, ACTIVE: number, DONE: number} }}
       */
      stats() {
        const byStatus = { PENDING: 0, ACTIVE: 0, DONE: 0 };
        let declarations = 0;
        let milestones = 0;
        let actions = 0;
        let edges = 0;
        for (const node of this.nodes.values()) {
          byStatus[node.status]++;
          if (node.type === "declaration") declarations++;
          else if (node.type === "milestone") milestones++;
          else if (node.type === "action") actions++;
        }
        for (const targets of this.upEdges.values()) {
          edges += targets.size;
        }
        return { declarations, milestones, actions, edges, byStatus };
      }
    };
    module2.exports = { DeclareDag };
  }
});

// src/commands/status.js
var require_status = __commonJS({
  "src/commands/status.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { execFileSync } = require("node:child_process");
    var { parseFutureFile } = require_future();
    var { parseMilestonesFile } = require_milestones();
    var { DeclareDag } = require_engine();
    function runStatus2(cwd) {
      const planningDir = join(cwd, ".planning");
      if (!existsSync(planningDir)) {
        return { error: "No Declare project found. Run /declare:init first." };
      }
      const projectName = basename(cwd);
      const futurePath = join(planningDir, "FUTURE.md");
      const milestonesPath = join(planningDir, "MILESTONES.md");
      const futureContent = existsSync(futurePath) ? readFileSync(futurePath, "utf-8") : "";
      const milestonesContent = existsSync(milestonesPath) ? readFileSync(milestonesPath, "utf-8") : "";
      const declarations = parseFutureFile(futureContent);
      const { milestones, actions } = parseMilestonesFile(milestonesContent);
      const dag = new DeclareDag();
      for (const d of declarations) {
        dag.addNode(d.id, "declaration", d.title, d.status || "PENDING");
      }
      for (const m of milestones) {
        dag.addNode(m.id, "milestone", m.title, m.status || "PENDING");
      }
      for (const a of actions) {
        dag.addNode(a.id, "action", a.title, a.status || "PENDING");
      }
      for (const m of milestones) {
        for (const declId of m.realizes) {
          if (dag.getNode(declId)) {
            dag.addEdge(m.id, declId);
          }
        }
        for (const actionId of m.causedBy) {
          if (dag.getNode(actionId)) {
            dag.addEdge(actionId, m.id);
          }
        }
      }
      for (const a of actions) {
        for (const milestoneId of a.causes) {
          if (dag.getNode(milestoneId)) {
            dag.addEdge(a.id, milestoneId);
          }
        }
      }
      const validation = dag.validate();
      const stats = dag.stats();
      let lastActivity = "No activity recorded";
      try {
        const output = execFileSync("git", ["log", "-1", "--format=%ci %s", "--", ".planning/"], {
          cwd,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"]
        }).trim();
        if (output) {
          lastActivity = output;
        }
      } catch {
      }
      let health = "healthy";
      if (!validation.valid) {
        const hasCycle = validation.errors.some((e) => e.type === "cycle");
        const hasBroken = validation.errors.some((e) => e.type === "broken_edge");
        health = hasCycle || hasBroken ? "errors" : "warnings";
      }
      return {
        project: projectName,
        stats: {
          declarations: stats.declarations,
          milestones: stats.milestones,
          actions: stats.actions,
          edges: stats.edges,
          byStatus: stats.byStatus
        },
        validation: {
          valid: validation.valid,
          errors: validation.errors
        },
        lastActivity,
        health
      };
    }
    module2.exports = { runStatus: runStatus2 };
  }
});

// src/commands/help.js
var require_help = __commonJS({
  "src/commands/help.js"(exports2, module2) {
    "use strict";
    function runHelp2() {
      return {
        commands: [
          {
            name: "/declare:init",
            description: "Initialize a Declare project with future declarations and graph structure",
            usage: "/declare:init [project-name]"
          },
          {
            name: "/declare:status",
            description: "Show graph state, layer counts, health indicators, and last activity",
            usage: "/declare:status"
          },
          {
            name: "add-declaration",
            description: "Add a new declaration to FUTURE.md with auto-incremented ID",
            usage: 'add-declaration --title "..." --statement "..."'
          },
          {
            name: "add-milestone",
            description: "Add a new milestone to MILESTONES.md linked to declarations",
            usage: 'add-milestone --title "..." --realizes D-01[,D-02]'
          },
          {
            name: "add-action",
            description: "Add a new action to MILESTONES.md linked to milestones",
            usage: 'add-action --title "..." --causes M-01[,M-02]'
          },
          {
            name: "load-graph",
            description: "Load full graph state as JSON with stats and validation",
            usage: "load-graph"
          },
          {
            name: "/declare:help",
            description: "Show available Declare commands",
            usage: "/declare:help"
          }
        ],
        version: "0.1.0"
      };
    }
    module2.exports = { runHelp: runHelp2 };
  }
});

// src/commands/parse-args.js
var require_parse_args = __commonJS({
  "src/commands/parse-args.js"(exports2, module2) {
    "use strict";
    function parseFlag(args, flag) {
      const flagStr = `--${flag}`;
      const idx = args.indexOf(flagStr);
      if (idx === -1 || idx + 1 >= args.length) return null;
      return args[idx + 1];
    }
    module2.exports = { parseFlag };
  }
});

// src/commands/add-declaration.js
var require_add_declaration = __commonJS({
  "src/commands/add-declaration.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { parseFutureFile, writeFutureFile } = require_future();
    var { DeclareDag } = require_engine();
    var { commitPlanningDocs: commitPlanningDocs2, loadConfig } = require_commit();
    var { parseFlag } = require_parse_args();
    function runAddDeclaration2(cwd, args) {
      const title = parseFlag(args, "title");
      const statement = parseFlag(args, "statement");
      if (!title) {
        return { error: "Missing required flag: --title" };
      }
      if (!statement) {
        return { error: "Missing required flag: --statement" };
      }
      const planningDir = join(cwd, ".planning");
      const futurePath = join(planningDir, "FUTURE.md");
      const projectName = basename(cwd);
      if (!existsSync(planningDir)) {
        mkdirSync(planningDir, { recursive: true });
      }
      const futureContent = existsSync(futurePath) ? readFileSync(futurePath, "utf-8") : "";
      const declarations = parseFutureFile(futureContent);
      const dag = new DeclareDag();
      for (const d of declarations) {
        dag.addNode(d.id, "declaration", d.title, d.status || "PENDING");
      }
      const id = dag.nextId("declaration");
      declarations.push({
        id,
        title,
        statement,
        status: "PENDING",
        milestones: []
      });
      const content = writeFutureFile(declarations, projectName);
      writeFileSync(futurePath, content, "utf-8");
      const config = loadConfig(cwd);
      let committed = false;
      let hash;
      if (config.commit_docs !== false) {
        const result = commitPlanningDocs2(
          cwd,
          `declare: add ${id} "${title}"`,
          [".planning/FUTURE.md"]
        );
        committed = result.committed;
        hash = result.hash;
      }
      return { id, title, statement, status: "PENDING", committed, hash };
    }
    module2.exports = { runAddDeclaration: runAddDeclaration2 };
  }
});

// src/commands/add-milestone.js
var require_add_milestone = __commonJS({
  "src/commands/add-milestone.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { parseFutureFile, writeFutureFile } = require_future();
    var { parseMilestonesFile, writeMilestonesFile } = require_milestones();
    var { DeclareDag } = require_engine();
    var { commitPlanningDocs: commitPlanningDocs2, loadConfig } = require_commit();
    var { parseFlag } = require_parse_args();
    function runAddMilestone2(cwd, args) {
      const title = parseFlag(args, "title");
      const realizesRaw = parseFlag(args, "realizes");
      if (!title) {
        return { error: "Missing required flag: --title" };
      }
      if (!realizesRaw) {
        return { error: "Missing required flag: --realizes" };
      }
      const realizes = realizesRaw.split(",").map((s) => s.trim()).filter(Boolean);
      const planningDir = join(cwd, ".planning");
      const futurePath = join(planningDir, "FUTURE.md");
      const milestonesPath = join(planningDir, "MILESTONES.md");
      const projectName = basename(cwd);
      if (!existsSync(planningDir)) {
        mkdirSync(planningDir, { recursive: true });
      }
      const futureContent = existsSync(futurePath) ? readFileSync(futurePath, "utf-8") : "";
      const milestonesContent = existsSync(milestonesPath) ? readFileSync(milestonesPath, "utf-8") : "";
      const declarations = parseFutureFile(futureContent);
      const { milestones, actions } = parseMilestonesFile(milestonesContent);
      const dag = new DeclareDag();
      for (const d of declarations) {
        dag.addNode(d.id, "declaration", d.title, d.status || "PENDING");
      }
      for (const m of milestones) {
        dag.addNode(m.id, "milestone", m.title, m.status || "PENDING");
      }
      for (const a of actions) {
        dag.addNode(a.id, "action", a.title, a.status || "PENDING");
      }
      for (const declId of realizes) {
        if (!dag.getNode(declId)) {
          return { error: `Declaration not found: ${declId}` };
        }
      }
      const id = dag.nextId("milestone");
      milestones.push({
        id,
        title,
        status: "PENDING",
        realizes,
        causedBy: []
      });
      for (const declId of realizes) {
        const decl = declarations.find((d) => d.id === declId);
        if (decl && !decl.milestones.includes(id)) {
          decl.milestones.push(id);
        }
      }
      const futureOutput = writeFutureFile(declarations, projectName);
      writeFileSync(futurePath, futureOutput, "utf-8");
      const milestonesOutput = writeMilestonesFile(milestones, actions, projectName);
      writeFileSync(milestonesPath, milestonesOutput, "utf-8");
      const config = loadConfig(cwd);
      let committed = false;
      let hash;
      if (config.commit_docs !== false) {
        const result = commitPlanningDocs2(
          cwd,
          `declare: add ${id} "${title}"`,
          [".planning/FUTURE.md", ".planning/MILESTONES.md"]
        );
        committed = result.committed;
        hash = result.hash;
      }
      return { id, title, realizes, status: "PENDING", committed, hash };
    }
    module2.exports = { runAddMilestone: runAddMilestone2 };
  }
});

// src/commands/add-action.js
var require_add_action = __commonJS({
  "src/commands/add-action.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { parseMilestonesFile, writeMilestonesFile } = require_milestones();
    var { DeclareDag } = require_engine();
    var { commitPlanningDocs: commitPlanningDocs2, loadConfig } = require_commit();
    var { parseFlag } = require_parse_args();
    function runAddAction2(cwd, args) {
      const title = parseFlag(args, "title");
      const causesRaw = parseFlag(args, "causes");
      if (!title) {
        return { error: "Missing required flag: --title" };
      }
      if (!causesRaw) {
        return { error: "Missing required flag: --causes" };
      }
      const causes = causesRaw.split(",").map((s) => s.trim()).filter(Boolean);
      const planningDir = join(cwd, ".planning");
      const milestonesPath = join(planningDir, "MILESTONES.md");
      const projectName = basename(cwd);
      if (!existsSync(planningDir)) {
        mkdirSync(planningDir, { recursive: true });
      }
      const milestonesContent = existsSync(milestonesPath) ? readFileSync(milestonesPath, "utf-8") : "";
      const { milestones, actions } = parseMilestonesFile(milestonesContent);
      const dag = new DeclareDag();
      for (const m of milestones) {
        dag.addNode(m.id, "milestone", m.title, m.status || "PENDING");
      }
      for (const a of actions) {
        dag.addNode(a.id, "action", a.title, a.status || "PENDING");
      }
      for (const msId of causes) {
        if (!dag.getNode(msId)) {
          return { error: `Milestone not found: ${msId}` };
        }
      }
      const id = dag.nextId("action");
      actions.push({
        id,
        title,
        status: "PENDING",
        causes
      });
      for (const msId of causes) {
        const ms = milestones.find((m) => m.id === msId);
        if (ms && !ms.causedBy.includes(id)) {
          ms.causedBy.push(id);
        }
      }
      const output = writeMilestonesFile(milestones, actions, projectName);
      writeFileSync(milestonesPath, output, "utf-8");
      const config = loadConfig(cwd);
      let committed = false;
      let hash;
      if (config.commit_docs !== false) {
        const result = commitPlanningDocs2(
          cwd,
          `declare: add ${id} "${title}"`,
          [".planning/MILESTONES.md"]
        );
        committed = result.committed;
        hash = result.hash;
      }
      return { id, title, causes, status: "PENDING", committed, hash };
    }
    module2.exports = { runAddAction: runAddAction2 };
  }
});

// src/commands/load-graph.js
var require_load_graph = __commonJS({
  "src/commands/load-graph.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync } = require("node:fs");
    var { join } = require("node:path");
    var { parseFutureFile } = require_future();
    var { parseMilestonesFile } = require_milestones();
    var { DeclareDag } = require_engine();
    function runLoadGraph2(cwd) {
      const planningDir = join(cwd, ".planning");
      if (!existsSync(planningDir)) {
        return { error: "No Declare project found. Run /declare:init first." };
      }
      const futurePath = join(planningDir, "FUTURE.md");
      const milestonesPath = join(planningDir, "MILESTONES.md");
      const futureContent = existsSync(futurePath) ? readFileSync(futurePath, "utf-8") : "";
      const milestonesContent = existsSync(milestonesPath) ? readFileSync(milestonesPath, "utf-8") : "";
      const declarations = parseFutureFile(futureContent);
      const { milestones, actions } = parseMilestonesFile(milestonesContent);
      const dag = new DeclareDag();
      for (const d of declarations) {
        dag.addNode(d.id, "declaration", d.title, d.status || "PENDING");
      }
      for (const m of milestones) {
        dag.addNode(m.id, "milestone", m.title, m.status || "PENDING");
      }
      for (const a of actions) {
        dag.addNode(a.id, "action", a.title, a.status || "PENDING");
      }
      for (const m of milestones) {
        for (const declId of m.realizes) {
          if (dag.getNode(declId)) {
            dag.addEdge(m.id, declId);
          }
        }
        for (const actionId of m.causedBy) {
          if (dag.getNode(actionId)) {
            dag.addEdge(actionId, m.id);
          }
        }
      }
      for (const a of actions) {
        for (const milestoneId of a.causes) {
          if (dag.getNode(milestoneId)) {
            dag.addEdge(a.id, milestoneId);
          }
        }
      }
      return {
        declarations,
        milestones,
        actions,
        stats: dag.stats(),
        validation: dag.validate()
      };
    }
    module2.exports = { runLoadGraph: runLoadGraph2 };
  }
});

// src/declare-tools.js
var { commitPlanningDocs } = require_commit();
var { runInit } = require_init();
var { runStatus } = require_status();
var { runHelp } = require_help();
var { runAddDeclaration } = require_add_declaration();
var { runAddMilestone } = require_add_milestone();
var { runAddAction } = require_add_action();
var { runLoadGraph } = require_load_graph();
function parseCwdFlag(argv) {
  const idx = argv.indexOf("--cwd");
  if (idx === -1 || idx + 1 >= argv.length) return null;
  return argv[idx + 1];
}
function parsePositionalArgs(argv) {
  const positional = [];
  let i = 0;
  while (i < argv.length) {
    if (argv[i] === "--cwd") {
      i += 2;
    } else if (argv[i] === "--files") {
      i++;
      while (i < argv.length && !argv[i].startsWith("--")) i++;
    } else if (argv[i].startsWith("--")) {
      i++;
    } else {
      positional.push(argv[i]);
      i++;
    }
  }
  return positional;
}
function parseFilesFlag(argv) {
  const idx = argv.indexOf("--files");
  if (idx === -1) return [];
  const files = [];
  for (let i = idx + 1; i < argv.length; i++) {
    if (argv[i].startsWith("--")) break;
    files.push(argv[i]);
  }
  return files;
}
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  if (!command) {
    console.log(JSON.stringify({ error: "No command specified. Use: commit, init, status, add-declaration, add-milestone, add-action, load-graph, help" }));
    process.exit(1);
  }
  try {
    switch (command) {
      case "commit": {
        const message = args[1];
        if (!message) {
          console.log(JSON.stringify({ error: "commit requires a message argument" }));
          process.exit(1);
        }
        const files = parseFilesFlag(args);
        const cwd = process.cwd();
        const result = commitPlanningDocs(cwd, message, files);
        console.log(JSON.stringify(result));
        process.exit(result.committed || result.reason === "nothing_to_commit" ? 0 : 1);
        break;
      }
      case "init": {
        const cwdInit = parseCwdFlag(args) || process.cwd();
        const initArgs = parsePositionalArgs(args.slice(1));
        const result = runInit(cwdInit, initArgs);
        console.log(JSON.stringify(result));
        break;
      }
      case "status": {
        const cwdStatus = parseCwdFlag(args) || process.cwd();
        const result = runStatus(cwdStatus);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "help": {
        const result = runHelp();
        console.log(JSON.stringify(result));
        break;
      }
      case "add-declaration": {
        const cwdAddDecl = parseCwdFlag(args) || process.cwd();
        const result = runAddDeclaration(cwdAddDecl, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "add-milestone": {
        const cwdAddMs = parseCwdFlag(args) || process.cwd();
        const result = runAddMilestone(cwdAddMs, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "add-action": {
        const cwdAddAct = parseCwdFlag(args) || process.cwd();
        const result = runAddAction(cwdAddAct, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "load-graph": {
        const cwdLoadGraph = parseCwdFlag(args) || process.cwd();
        const result = runLoadGraph(cwdLoadGraph);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      default:
        console.log(JSON.stringify({ error: `Unknown command: ${command}. Use: commit, init, status, add-declaration, add-milestone, add-action, load-graph, help` }));
        process.exit(1);
    }
  } catch (err) {
    console.log(JSON.stringify({ error: err.message || String(err) }));
    process.exit(1);
  }
}
main();
