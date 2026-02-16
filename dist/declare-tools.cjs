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
        return { milestones: [] };
      }
      const milestonesMatch = content.match(/## Milestones\s*\n([\s\S]*?)(?=## |$)/i);
      const milestoneRows = milestonesMatch ? parseMarkdownTable(milestonesMatch[1]) : [];
      const milestones = milestoneRows.map((row) => ({
        id: (row["ID"] || "").trim(),
        title: (row["Title"] || "").trim(),
        status: (row["Status"] || "PENDING").trim().toUpperCase(),
        realizes: splitMultiValue(row["Realizes"] || ""),
        hasPlan: (row["Plan"] || "").trim().toUpperCase() === "YES"
      })).filter((m) => m.id);
      return { milestones };
    }
    function pad(str, width) {
      return str + " ".repeat(Math.max(0, width - str.length));
    }
    function writeMilestonesFile(milestones, projectNameOrActions, maybeProjectName) {
      const projectName = maybeProjectName || (typeof projectNameOrActions === "string" ? projectNameOrActions : "Project");
      const lines = [`# Milestones: ${projectName}`, ""];
      lines.push("## Milestones", "");
      const mHeaders = ["ID", "Title", "Status", "Realizes", "Plan"];
      const mRows = milestones.map((m) => [
        m.id,
        m.title,
        m.status,
        m.realizes.join(", "),
        m.hasPlan ? "YES" : "NO"
      ]);
      lines.push(...formatTable(mHeaders, mRows));
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
      const milestonesDir = join(planningDir, "milestones");
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
      if (!existsSync(milestonesDir)) {
        mkdirSync(milestonesDir, { recursive: true });
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
              content = writeMilestonesFile([], projectName);
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

// src/artifacts/plan.js
var require_plan = __commonJS({
  "src/artifacts/plan.js"(exports2, module2) {
    "use strict";
    function extractField(lines, field) {
      const pattern = new RegExp(`^\\*\\*${field}:\\*\\*`, "i");
      const line = lines.find((l) => pattern.test(l.trim()));
      if (!line) return null;
      return line.trim().replace(/^\*\*[^:]+:\*\*\s*/, "").trim();
    }
    function parsePlanFile(content) {
      if (!content || !content.trim()) {
        return { milestone: null, realizes: [], status: "PENDING", derived: "", actions: [] };
      }
      const headerMatch = content.match(/^# Plan:\s*(M-\d+)/m);
      const milestone = headerMatch ? headerMatch[1] : null;
      const headerSection = content.split(/^## /m)[0] || "";
      const headerLines = headerSection.split("\n");
      const realizesRaw = extractField(headerLines, "Realizes");
      const realizes = realizesRaw ? realizesRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
      const status = (extractField(headerLines, "Status") || "PENDING").toUpperCase();
      const derived = extractField(headerLines, "Derived") || "";
      const actionSections = content.split(/^### /m).slice(1);
      const actions = actionSections.map((section) => {
        const lines = section.trim().split("\n");
        const actionHeaderMatch = lines[0].match(/^(A-\d+):\s*(.+)/);
        if (!actionHeaderMatch) return null;
        const [, id, title] = actionHeaderMatch;
        const actionStatus = (extractField(lines, "Status") || "PENDING").toUpperCase();
        const produces = extractField(lines, "Produces") || "";
        const description = lines.slice(1).filter((l) => !l.trim().startsWith("**")).map((l) => l.trim()).filter(Boolean).join("\n");
        return { id, title: title.trim(), status: actionStatus, produces, description };
      }).filter(Boolean);
      return { milestone, realizes, status, derived, actions };
    }
    function writePlanFile(milestoneId, milestoneTitle, realizes, actions) {
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const lines = [
        `# Plan: ${milestoneId} -- ${milestoneTitle}`,
        "",
        `**Milestone:** ${milestoneId}`,
        `**Realizes:** ${realizes.join(", ")}`,
        `**Status:** PENDING`,
        `**Derived:** ${today}`,
        "",
        "## Actions",
        ""
      ];
      for (const action of actions) {
        const id = action.id || "A-XX";
        const status = action.status || "PENDING";
        const produces = action.produces || "";
        lines.push(`### ${id}: ${action.title}`);
        lines.push(`**Status:** ${status}`);
        if (produces) {
          lines.push(`**Produces:** ${produces}`);
        }
        if (action.description) {
          lines.push(action.description);
        }
        lines.push("");
      }
      return lines.join("\n");
    }
    module2.exports = { parsePlanFile, writePlanFile };
  }
});

// src/artifacts/milestone-folders.js
var require_milestone_folders = __commonJS({
  "src/artifacts/milestone-folders.js"(exports2, module2) {
    "use strict";
    var { existsSync, mkdirSync, readdirSync, renameSync } = require("node:fs");
    var { join, basename } = require("node:path");
    function slugify(title) {
      return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    function milestoneFolderName(id, title) {
      return `${id}-${slugify(title)}`;
    }
    function getMilestoneFolderPath(planningDir, id, title) {
      return join(planningDir, "milestones", milestoneFolderName(id, title));
    }
    function ensureMilestoneFolder(planningDir, id, title) {
      const folderPath = getMilestoneFolderPath(planningDir, id, title);
      if (!existsSync(folderPath)) {
        mkdirSync(folderPath, { recursive: true });
      }
      return folderPath;
    }
    function findMilestoneFolder(planningDir, id) {
      const milestonesDir = join(planningDir, "milestones");
      if (!existsSync(milestonesDir)) return null;
      const entries = readdirSync(milestonesDir, { withFileTypes: true });
      const folder = entries.find((e) => e.isDirectory() && e.name.startsWith(id));
      return folder ? join(milestonesDir, folder.name) : null;
    }
    function archiveMilestoneFolder(planningDir, id) {
      const folder = findMilestoneFolder(planningDir, id);
      if (!folder) return false;
      const archiveDir = join(planningDir, "milestones", "_archived");
      mkdirSync(archiveDir, { recursive: true });
      renameSync(folder, join(archiveDir, basename(folder)));
      return true;
    }
    module2.exports = {
      slugify,
      milestoneFolderName,
      getMilestoneFolderPath,
      ensureMilestoneFolder,
      findMilestoneFolder,
      archiveMilestoneFolder
    };
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

// src/commands/build-dag.js
var require_build_dag = __commonJS({
  "src/commands/build-dag.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, readdirSync } = require("node:fs");
    var { join } = require("node:path");
    var { parseFutureFile } = require_future();
    var { parseMilestonesFile } = require_milestones();
    var { parsePlanFile } = require_plan();
    var { DeclareDag } = require_engine();
    function loadActionsFromFolders(planningDir) {
      const milestonesDir = join(planningDir, "milestones");
      if (!existsSync(milestonesDir)) return [];
      const allActions = [];
      const entries = readdirSync(milestonesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
        const planPath = join(milestonesDir, entry.name, "PLAN.md");
        if (!existsSync(planPath)) continue;
        const content = readFileSync(planPath, "utf-8");
        const { milestone, actions } = parsePlanFile(content);
        for (const action of actions) {
          allActions.push({
            id: action.id,
            title: action.title,
            status: action.status,
            produces: action.produces,
            causes: milestone ? [milestone] : []
          });
        }
      }
      return allActions;
    }
    function buildDagFromDisk(cwd) {
      const planningDir = join(cwd, ".planning");
      if (!existsSync(planningDir)) {
        return { error: "No Declare project found. Run /declare:init first." };
      }
      const futurePath = join(planningDir, "FUTURE.md");
      const milestonesPath = join(planningDir, "MILESTONES.md");
      const futureContent = existsSync(futurePath) ? readFileSync(futurePath, "utf-8") : "";
      const milestonesContent = existsSync(milestonesPath) ? readFileSync(milestonesPath, "utf-8") : "";
      const declarations = parseFutureFile(futureContent);
      const { milestones } = parseMilestonesFile(milestonesContent);
      const actions = loadActionsFromFolders(planningDir);
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
      }
      for (const a of actions) {
        for (const milestoneId of a.causes) {
          if (dag.getNode(milestoneId)) {
            dag.addEdge(a.id, milestoneId);
          }
        }
      }
      return { dag, declarations, milestones, actions };
    }
    module2.exports = { buildDagFromDisk, loadActionsFromFolders };
  }
});

// src/commands/status.js
var require_status = __commonJS({
  "src/commands/status.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { execFileSync } = require("node:child_process");
    var { parsePlanFile } = require_plan();
    var { findMilestoneFolder } = require_milestone_folders();
    var { buildDagFromDisk } = require_build_dag();
    function detectStaleness(cwd, planningDir, milestones) {
      const indicators = [];
      for (const m of milestones) {
        const folder = findMilestoneFolder(planningDir, m.id);
        if (!folder) {
          indicators.push({ milestone: m.id, issue: "NO_PLAN", detail: "No plan derived yet" });
          continue;
        }
        const planPath = join(folder, "PLAN.md");
        if (!existsSync(planPath)) {
          indicators.push({ milestone: m.id, issue: "EMPTY_FOLDER", detail: "Folder exists but no PLAN.md" });
          continue;
        }
        try {
          const lastMod = execFileSync("git", ["log", "-1", "--format=%ct", "--", planPath], {
            cwd,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "pipe"]
          }).trim();
          if (lastMod) {
            const ageDays = (Date.now() - parseInt(lastMod, 10) * 1e3) / 864e5;
            if (ageDays > 30) {
              indicators.push({ milestone: m.id, issue: "STALE", detail: `Plan not updated in ${Math.floor(ageDays)} days` });
            }
          }
        } catch {
        }
        const plan = parsePlanFile(readFileSync(planPath, "utf-8"));
        if (m.status === "ACTIVE" && plan.actions.length > 0 && plan.actions.every((a) => a.status === "DONE")) {
          indicators.push({ milestone: m.id, issue: "COMPLETABLE", detail: "All actions done, milestone still ACTIVE" });
        }
        if (m.status === "DONE" && plan.actions.some((a) => a.status !== "DONE")) {
          indicators.push({ milestone: m.id, issue: "INCONSISTENT", detail: "Milestone marked DONE but has incomplete actions" });
        }
      }
      return indicators;
    }
    function runStatus2(cwd) {
      const planningDir = join(cwd, ".planning");
      const graphResult = buildDagFromDisk(cwd);
      if (graphResult.error) return graphResult;
      const { dag, declarations, milestones, actions } = graphResult;
      const projectName = basename(cwd);
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
      const withPlan = milestones.filter((m) => m.hasPlan).length;
      const coverage = {
        total: milestones.length,
        withPlan,
        percentage: milestones.length > 0 ? Math.round(withPlan / milestones.length * 100) : 100
      };
      const staleness = detectStaleness(cwd, planningDir, milestones);
      let health = "healthy";
      if (!validation.valid) {
        const hasCycle = validation.errors.some((e) => e.type === "cycle");
        const hasBroken = validation.errors.some((e) => e.type === "broken_edge");
        health = hasCycle || hasBroken ? "errors" : "warnings";
      }
      if (staleness.length > 0 && health === "healthy") {
        health = "warnings";
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
        health,
        coverage,
        staleness
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
            description: "Show graph state, coverage, staleness indicators, and last activity",
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
            name: "create-plan",
            description: "Write action plan (PLAN.md) to milestone folder",
            usage: `create-plan --milestone M-XX --actions '[{"title":"...","produces":"..."}]'`
          },
          {
            name: "load-graph",
            description: "Load full graph state as JSON with stats and validation",
            usage: "load-graph"
          },
          {
            name: "/declare:milestones",
            description: "Derive milestones backward from declared futures with checkbox confirmation",
            usage: "/declare:milestones [D-XX]"
          },
          {
            name: "/declare:actions",
            description: "Derive action plans per milestone and write PLAN.md to milestone folders",
            usage: "/declare:actions [M-XX]"
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
      const { milestones } = parseMilestonesFile(milestonesContent);
      const dag = new DeclareDag();
      for (const d of declarations) {
        dag.addNode(d.id, "declaration", d.title, d.status || "PENDING");
      }
      for (const m of milestones) {
        dag.addNode(m.id, "milestone", m.title, m.status || "PENDING");
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
        hasPlan: false
      });
      for (const declId of realizes) {
        const decl = declarations.find((d) => d.id === declId);
        if (decl && !decl.milestones.includes(id)) {
          decl.milestones.push(id);
        }
      }
      const futureOutput = writeFutureFile(declarations, projectName);
      writeFileSync(futurePath, futureOutput, "utf-8");
      const milestonesOutput = writeMilestonesFile(milestones, projectName);
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
    function runAddAction2(_cwd, _args) {
      return {
        error: `add-action has been replaced by create-plan. Use: node declare-tools.cjs create-plan --milestone M-XX --actions '[{"title":"...","produces":"..."}]'`
      };
    }
    module2.exports = { runAddAction: runAddAction2 };
  }
});

// src/commands/load-graph.js
var require_load_graph = __commonJS({
  "src/commands/load-graph.js"(exports2, module2) {
    "use strict";
    var { buildDagFromDisk, loadActionsFromFolders } = require_build_dag();
    function runLoadGraph2(cwd) {
      const graphResult = buildDagFromDisk(cwd);
      if (graphResult.error) return graphResult;
      const { dag, declarations, milestones, actions } = graphResult;
      return {
        declarations,
        milestones,
        actions,
        stats: dag.stats(),
        validation: dag.validate()
      };
    }
    module2.exports = { runLoadGraph: runLoadGraph2, loadActionsFromFolders };
  }
});

// src/commands/create-plan.js
var require_create_plan = __commonJS({
  "src/commands/create-plan.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { parseFutureFile } = require_future();
    var { parseMilestonesFile, writeMilestonesFile } = require_milestones();
    var { writePlanFile } = require_plan();
    var { loadActionsFromFolders } = require_load_graph();
    var { ensureMilestoneFolder } = require_milestone_folders();
    var { DeclareDag } = require_engine();
    var { commitPlanningDocs: commitPlanningDocs2, loadConfig } = require_commit();
    var { parseFlag } = require_parse_args();
    function runCreatePlan2(cwd, args) {
      const milestoneId = parseFlag(args, "milestone");
      const actionsRaw = parseFlag(args, "actions");
      if (!milestoneId) {
        return { error: "Missing required flag: --milestone" };
      }
      if (!actionsRaw) {
        return { error: "Missing required flag: --actions" };
      }
      let actionDefs;
      try {
        actionDefs = JSON.parse(actionsRaw);
        if (!Array.isArray(actionDefs)) {
          return { error: "--actions must be a JSON array of [{title, produces}]" };
        }
      } catch {
        return { error: "--actions must be valid JSON: " + actionsRaw };
      }
      const planningDir = join(cwd, ".planning");
      const milestonesPath = join(planningDir, "MILESTONES.md");
      const futurePath = join(planningDir, "FUTURE.md");
      const projectName = basename(cwd);
      if (!existsSync(planningDir)) {
        return { error: "No Declare project found. Run /declare:init first." };
      }
      const futureContent = existsSync(futurePath) ? readFileSync(futurePath, "utf-8") : "";
      const milestonesContent = existsSync(milestonesPath) ? readFileSync(milestonesPath, "utf-8") : "";
      const declarations = parseFutureFile(futureContent);
      const { milestones } = parseMilestonesFile(milestonesContent);
      const targetMs = milestones.find((m) => m.id === milestoneId);
      if (!targetMs) {
        return { error: `Milestone not found: ${milestoneId}` };
      }
      const dag = new DeclareDag();
      for (const d of declarations) {
        dag.addNode(d.id, "declaration", d.title, d.status || "PENDING");
      }
      for (const m of milestones) {
        dag.addNode(m.id, "milestone", m.title, m.status || "PENDING");
      }
      const existingActions = loadActionsFromFolders(planningDir);
      for (const a of existingActions) {
        dag.addNode(a.id, "action", a.title, a.status || "PENDING");
      }
      const actions = actionDefs.map((def) => {
        const id = dag.nextId("action");
        dag.addNode(id, "action", def.title, "PENDING");
        return {
          id,
          title: def.title,
          status: "PENDING",
          produces: def.produces || ""
        };
      });
      const folder = ensureMilestoneFolder(planningDir, milestoneId, targetMs.title);
      const planContent = writePlanFile(milestoneId, targetMs.title, targetMs.realizes, actions);
      const planPath = join(folder, "PLAN.md");
      writeFileSync(planPath, planContent, "utf-8");
      targetMs.hasPlan = true;
      const msOutput = writeMilestonesFile(milestones, projectName);
      writeFileSync(milestonesPath, msOutput, "utf-8");
      const relFolder = folder.replace(cwd + "/", "");
      const filesToCommit = [
        ".planning/MILESTONES.md",
        join(relFolder, "PLAN.md")
      ];
      const config = loadConfig(cwd);
      let committed = false;
      let hash;
      if (config.commit_docs !== false) {
        const result = commitPlanningDocs2(
          cwd,
          `declare: create plan for ${milestoneId} "${targetMs.title}"`,
          filesToCommit
        );
        committed = result.committed;
        hash = result.hash;
      }
      return {
        milestone: milestoneId,
        folder: relFolder,
        actions: actions.map((a) => ({ id: a.id, title: a.title, produces: a.produces })),
        committed,
        hash
      };
    }
    module2.exports = { runCreatePlan: runCreatePlan2 };
  }
});

// src/commands/trace.js
var require_trace = __commonJS({
  "src/commands/trace.js"(exports2, module2) {
    "use strict";
    var { writeFileSync } = require("node:fs");
    var { resolve } = require("node:path");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    function traceUpward(dag, startId) {
      const startNode = dag.getNode(startId);
      if (!startNode) return [];
      if (startNode.type === "declaration") {
        return [[{ id: startNode.id, type: startNode.type, title: startNode.title, status: startNode.status }]];
      }
      const upstream = dag.getUpstream(startId);
      if (upstream.length === 0) {
        return [[{ id: startNode.id, type: startNode.type, title: startNode.title, status: startNode.status }]];
      }
      const paths = [];
      const startEntry = { id: startNode.id, type: startNode.type, title: startNode.title, status: startNode.status };
      for (const parent of upstream) {
        const parentPaths = traceUpward(dag, parent.id);
        for (const parentPath of parentPaths) {
          paths.push([startEntry, ...parentPath]);
        }
      }
      return paths;
    }
    function formatTracePaths(nodeId, node, paths) {
      if (paths.length === 0) {
        return `${nodeId}: (not found)
`;
      }
      const lines = [];
      lines.push(`${node.id}: ${node.title} [${node.status}]`);
      if (paths.length === 1 && paths[0].length === 1) {
        lines.push("  (no upstream connections)");
        return lines.join("\n") + "\n";
      }
      const byFirstUpstream = /* @__PURE__ */ new Map();
      for (const path of paths) {
        if (path.length < 2) continue;
        const firstUp = path[1];
        if (!byFirstUpstream.has(firstUp.id)) {
          byFirstUpstream.set(firstUp.id, []);
        }
        byFirstUpstream.get(firstUp.id).push(path);
      }
      const upstreamIds = [...byFirstUpstream.keys()];
      for (let i = 0; i < upstreamIds.length; i++) {
        const upId = upstreamIds[i];
        const groupPaths = byFirstUpstream.get(upId);
        const isLast = i === upstreamIds.length - 1;
        const connector = isLast ? "\u2514\u2500\u2500" : "\u251C\u2500\u2500";
        const indent = isLast ? "    " : "\u2502   ";
        const upNode = groupPaths[0][1];
        lines.push(`${connector} ${upNode.id}: ${upNode.title} [${upNode.status}]`);
        const declNodes = /* @__PURE__ */ new Map();
        for (const path of groupPaths) {
          if (path.length > 2) {
            const decl = path[2];
            declNodes.set(decl.id, decl);
          }
        }
        const declList = [...declNodes.values()];
        for (let j = 0; j < declList.length; j++) {
          const decl = declList[j];
          const declIsLast = j === declList.length - 1;
          const declConnector = declIsLast ? "\u2514\u2500\u2500" : "\u251C\u2500\u2500";
          lines.push(`${indent}${declConnector} ${decl.id}: ${decl.title} [${decl.status}]`);
        }
      }
      return lines.join("\n") + "\n";
    }
    function runTrace2(cwd, args) {
      const graphResult = buildDagFromDisk(cwd);
      if (graphResult.error) return graphResult;
      const { dag } = graphResult;
      const nodeId = parseFlag(args, "node") || (args[0] && !args[0].startsWith("--") ? args[0] : null);
      const outputFile = parseFlag(args, "output");
      if (!nodeId) {
        const declarations = dag.getDeclarations().map((n) => ({ id: n.id, title: n.title, status: n.status }));
        const milestones = dag.getMilestones().map((n) => ({ id: n.id, title: n.title, status: n.status }));
        const actions = dag.getActions().map((n) => ({ id: n.id, title: n.title, status: n.status }));
        return {
          nodes: {
            declarations,
            milestones,
            actions,
            total: declarations.length + milestones.length + actions.length
          }
        };
      }
      const node = dag.getNode(nodeId);
      if (!node) {
        return { error: `Node not found: ${nodeId}. Use 'trace' without arguments to see available nodes.` };
      }
      let paths = traceUpward(dag, nodeId);
      let truncated = false;
      let totalPaths = paths.length;
      if (paths.length > 20) {
        paths = paths.slice(0, 20);
        truncated = true;
      }
      const nodeInfo = { id: node.id, type: node.type, title: node.title, status: node.status };
      const formatted = formatTracePaths(nodeId, nodeInfo, paths);
      let resolvedOutput;
      if (outputFile) {
        resolvedOutput = resolve(cwd, outputFile);
        writeFileSync(resolvedOutput, formatted, "utf-8");
      }
      const result = {
        nodeId,
        node: nodeInfo,
        paths,
        pathCount: paths.length,
        formatted
      };
      if (truncated) {
        result.truncated = true;
        result.totalPaths = totalPaths;
      }
      if (resolvedOutput) {
        result.outputFile = resolvedOutput;
      }
      return result;
    }
    module2.exports = { runTrace: runTrace2, traceUpward, formatTracePaths };
  }
});

// src/commands/prioritize.js
var require_prioritize = __commonJS({
  "src/commands/prioritize.js"(exports2, module2) {
    "use strict";
    var { writeFileSync } = require("node:fs");
    var { resolve } = require("node:path");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    function dependencyWeight(dag, nodeId) {
      const visited = /* @__PURE__ */ new Set();
      const queue = [nodeId];
      while (queue.length > 0) {
        const current = (
          /** @type {string} */
          queue.shift()
        );
        if (visited.has(current)) continue;
        visited.add(current);
        const upstream = dag.getUpstream(current);
        for (const parent of upstream) {
          if (!visited.has(parent.id)) {
            queue.push(parent.id);
          }
        }
      }
      return visited.size - 1;
    }
    function getSubtreeNodeIds(dag, rootId) {
      const visited = /* @__PURE__ */ new Set();
      const queue = [rootId];
      while (queue.length > 0) {
        const current = (
          /** @type {string} */
          queue.shift()
        );
        if (visited.has(current)) continue;
        visited.add(current);
        const downstream = dag.getDownstream(current);
        for (const child of downstream) {
          if (!visited.has(child.id)) {
            queue.push(child.id);
          }
        }
      }
      return visited;
    }
    function rankActions(dag, filterDeclarationId) {
      let actions = dag.getActions();
      if (filterDeclarationId) {
        const subtreeNodes = getSubtreeNodeIds(dag, filterDeclarationId);
        actions = actions.filter((a) => subtreeNodes.has(a.id));
      }
      const ranked = actions.map((a) => ({
        id: a.id,
        title: a.title,
        score: dependencyWeight(dag, a.id)
      }));
      ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
      return ranked.map((item, index) => ({
        rank: index + 1,
        ...item
      }));
    }
    function formatRanking(ranking, filter) {
      const lines = [];
      if (filter) {
        lines.push(`Priority ranking (filtered by ${filter}):`);
      } else {
        lines.push("Priority ranking (all actions):");
      }
      lines.push("");
      if (ranking.length === 0) {
        lines.push("  No actions found.");
        return lines.join("\n") + "\n";
      }
      for (const item of ranking) {
        lines.push(`  ${item.rank}. ${item.id}: ${item.title} (score: ${item.score})`);
      }
      return lines.join("\n") + "\n";
    }
    function runPrioritize2(cwd, args) {
      const graphResult = buildDagFromDisk(cwd);
      if (graphResult.error) return graphResult;
      const { dag } = graphResult;
      const filterDeclaration = parseFlag(args, "declaration");
      const outputFile = parseFlag(args, "output");
      if (filterDeclaration) {
        const filterNode = dag.getNode(filterDeclaration);
        if (!filterNode) {
          return { error: `Declaration not found: ${filterDeclaration}. Use a valid D-XX ID.` };
        }
        if (filterNode.type !== "declaration") {
          return { error: `${filterDeclaration} is a ${filterNode.type}, not a declaration. Use --declaration with a D-XX ID.` };
        }
      }
      const ranking = rankActions(dag, filterDeclaration || void 0);
      const formatted = formatRanking(ranking, filterDeclaration);
      const result = {
        ranking,
        filter: filterDeclaration || null,
        totalActions: ranking.length,
        formatted
      };
      if (outputFile) {
        const resolvedOutput = resolve(cwd, outputFile);
        writeFileSync(resolvedOutput, formatted, "utf-8");
        result.outputFile = resolvedOutput;
      }
      return result;
    }
    module2.exports = { runPrioritize: runPrioritize2, dependencyWeight, getSubtreeNodeIds, rankActions };
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
var { runCreatePlan } = require_create_plan();
var { runLoadGraph } = require_load_graph();
var { runTrace } = require_trace();
var { runPrioritize } = require_prioritize();
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
    console.log(JSON.stringify({ error: "No command specified. Use: commit, init, status, add-declaration, add-milestone, create-plan, load-graph, trace, prioritize, help" }));
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
      case "create-plan": {
        const cwdCreatePlan = parseCwdFlag(args) || process.cwd();
        const result = runCreatePlan(cwdCreatePlan, args.slice(1));
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
      case "trace": {
        const cwdTrace = parseCwdFlag(args) || process.cwd();
        const result = runTrace(cwdTrace, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "prioritize": {
        const cwdPrioritize = parseCwdFlag(args) || process.cwd();
        const result = runPrioritize(cwdPrioritize, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      default:
        console.log(JSON.stringify({ error: `Unknown command: ${command}. Use: commit, init, status, add-declaration, add-milestone, create-plan, load-graph, trace, prioritize, help` }));
        process.exit(1);
    }
  } catch (err) {
    console.log(JSON.stringify({ error: err.message || String(err) }));
    process.exit(1);
  }
}
main();
