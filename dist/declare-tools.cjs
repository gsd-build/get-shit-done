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
    function parseFutureArchive(content) {
      if (!content || !content.trim()) return [];
      const entries = [];
      const sections = content.split(/^## /m).slice(1);
      for (const section of sections) {
        const lines = section.trim().split("\n");
        const headerMatch = lines[0].match(/^Archived:\s*(D-\d+)\s*--\s*(.+)/);
        if (!headerMatch) continue;
        const [, id, title] = headerMatch;
        const statement = extractField(lines, "Statement") || "";
        const archivedAt = extractField(lines, "Archived") || "";
        const reason = extractField(lines, "Reason") || "";
        const replacedBy = extractField(lines, "Replaced By") || "";
        const statusAtArchive = extractField(lines, "Status at Archive") || "";
        entries.push({ id, title: title.trim(), statement, archivedAt, reason, replacedBy, statusAtArchive });
      }
      return entries;
    }
    function writeFutureArchive(entries) {
      const lines = ["# Future Archive", ""];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (i > 0) lines.push("---", "");
        lines.push(`## Archived: ${e.id} -- ${e.title}`);
        lines.push(`**Statement:** ${e.statement}`);
        lines.push(`**Archived:** ${e.archivedAt}`);
        lines.push(`**Reason:** ${e.reason}`);
        lines.push(`**Replaced By:** ${e.replacedBy}`);
        lines.push(`**Status at Archive:** ${e.statusAtArchive}`);
        lines.push("");
      }
      return lines.join("\n");
    }
    function appendToArchive(existingContent, entry) {
      const entries = parseFutureArchive(existingContent || "");
      entries.push(entry);
      return writeFutureArchive(entries);
    }
    module2.exports = { parseFutureFile, writeFutureFile, parseFutureArchive, writeFutureArchive, appendToArchive };
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
    var VALID_STATUSES = /* @__PURE__ */ new Set(["PENDING", "ACTIVE", "DONE", "KEPT", "BROKEN", "HONORED", "RENEGOTIATED"]);
    var COMPLETED_STATUSES = /* @__PURE__ */ new Set(["DONE", "KEPT", "HONORED", "RENEGOTIATED"]);
    function isCompleted(status) {
      return COMPLETED_STATUSES.has(status);
    }
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
        const byStatus = {};
        for (const s of VALID_STATUSES) byStatus[s] = 0;
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
    function findOrphans(dag) {
      const { errors } = dag.validate();
      return errors.filter((e) => e.type === "orphan" && e.node).map((e) => {
        const node = dag.getNode(e.node);
        return node ? { id: node.id, type: node.type, title: node.title, status: node.status } : { id: e.node, type: "unknown", title: "", status: "" };
      });
    }
    module2.exports = { DeclareDag, COMPLETED_STATUSES, isCompleted, findOrphans };
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
    var { isCompleted } = require_engine();
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
        if (m.status === "ACTIVE" && plan.actions.length > 0 && plan.actions.every((a) => isCompleted(a.status))) {
          indicators.push({ milestone: m.id, issue: "COMPLETABLE", detail: "All actions done, milestone still ACTIVE" });
        }
        if (isCompleted(m.status) && plan.actions.some((a) => !isCompleted(a.status))) {
          indicators.push({ milestone: m.id, issue: "INCONSISTENT", detail: "Milestone marked completed but has incomplete actions" });
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
      const integrity = {
        total: milestones.length,
        verified: 0,
        // KEPT + HONORED + RENEGOTIATED
        kept: 0,
        honored: 0,
        renegotiated: 0,
        broken: 0,
        pending: 0
        // PENDING + ACTIVE + DONE (not yet verified)
      };
      for (const m of milestones) {
        switch (m.status) {
          case "KEPT":
            integrity.kept++;
            integrity.verified++;
            break;
          case "HONORED":
            integrity.honored++;
            integrity.verified++;
            break;
          case "RENEGOTIATED":
            integrity.renegotiated++;
            integrity.verified++;
            break;
          case "BROKEN":
            integrity.broken++;
            break;
          default:
            integrity.pending++;
            break;
        }
      }
      let health = "healthy";
      if (!validation.valid) {
        const hasCycle = validation.errors.some((e) => e.type === "cycle");
        const hasBroken = validation.errors.some((e) => e.type === "broken_edge");
        health = hasCycle || hasBroken ? "errors" : "warnings";
      }
      if (staleness.length > 0 && health === "healthy") {
        health = "warnings";
      }
      if (integrity.broken > 0 && health === "healthy") {
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
        staleness,
        integrity
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

// src/commands/add-milestones-batch.js
var require_add_milestones_batch = __commonJS({
  "src/commands/add-milestones-batch.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
    var { join, basename } = require("node:path");
    var { parseFutureFile, writeFutureFile } = require_future();
    var { parseMilestonesFile, writeMilestonesFile } = require_milestones();
    var { DeclareDag } = require_engine();
    var { commitPlanningDocs: commitPlanningDocs2, loadConfig } = require_commit();
    var { parseFlag } = require_parse_args();
    function runAddMilestonesBatch2(cwd, args) {
      const jsonRaw = parseFlag(args, "json");
      if (!jsonRaw) {
        return { error: "Missing required flag: --json (JSON array of { title, realizes })" };
      }
      let inputs;
      try {
        inputs = JSON.parse(jsonRaw);
      } catch {
        return { error: "Invalid JSON in --json flag" };
      }
      if (!Array.isArray(inputs) || inputs.length === 0) {
        return { error: "--json must be a non-empty array of { title, realizes }" };
      }
      for (let i = 0; i < inputs.length; i++) {
        if (!inputs[i].title) return { error: `Item ${i}: missing title` };
        if (!inputs[i].realizes) return { error: `Item ${i}: missing realizes` };
      }
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
      for (let i = 0; i < inputs.length; i++) {
        const realizes = inputs[i].realizes.split(",").map((s) => s.trim()).filter(Boolean);
        for (const declId of realizes) {
          if (!dag.getNode(declId)) {
            return { error: `Item ${i}: declaration not found: ${declId}` };
          }
        }
      }
      const results = [];
      for (const input of inputs) {
        const realizes = input.realizes.split(",").map((s) => s.trim()).filter(Boolean);
        const id = dag.nextId("milestone");
        dag.addNode(id, "milestone", input.title, "PENDING");
        milestones.push({
          id,
          title: input.title,
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
        results.push({ id, title: input.title, realizes, status: "PENDING" });
      }
      const futureOutput = writeFutureFile(declarations, projectName);
      writeFileSync(futurePath, futureOutput, "utf-8");
      const milestonesOutput = writeMilestonesFile(milestones, projectName);
      writeFileSync(milestonesPath, milestonesOutput, "utf-8");
      const config = loadConfig(cwd);
      let committed = false;
      let hash;
      if (config.commit_docs !== false) {
        const ids = results.map((r) => r.id).join(", ");
        const result = commitPlanningDocs2(
          cwd,
          `declare: add milestones ${ids}`,
          [".planning/FUTURE.md", ".planning/MILESTONES.md"]
        );
        committed = result.committed;
        hash = result.hash;
      }
      return { milestones: results, committed, hash };
    }
    module2.exports = { runAddMilestonesBatch: runAddMilestonesBatch2 };
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

// src/commands/visualize.js
var require_visualize = __commonJS({
  "src/commands/visualize.js"(exports2, module2) {
    "use strict";
    var { writeFileSync } = require("node:fs");
    var { resolve } = require("node:path");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
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
    function statusMarker(dag, node) {
      if (node.status === "DONE") return "[\u2713]";
      if (node.status === "ACTIVE") return "[>]";
      const children = dag.getDownstream(node.id);
      if (children.length > 0) {
        const hasNonDoneChild = children.some((c) => c.status !== "DONE");
        if (hasNonDoneChild) return "[!]";
      }
      return "[\u25CB]";
    }
    function sortById(nodes) {
      return [...nodes].sort((a, b) => a.id.localeCompare(b.id));
    }
    function buildTreeData(dag, scopeFilter) {
      const declarations = sortById(dag.getDeclarations());
      const tree = [];
      for (const decl of declarations) {
        if (scopeFilter && !scopeFilter.has(decl.id)) continue;
        const declEntry = {
          node: { id: decl.id, type: decl.type, title: decl.title, status: decl.status, marker: statusMarker(dag, decl) },
          children: []
        };
        const milestones = sortById(dag.getDownstream(decl.id));
        for (const ms of milestones) {
          if (scopeFilter && !scopeFilter.has(ms.id)) continue;
          const msEntry = {
            node: { id: ms.id, type: ms.type, title: ms.title, status: ms.status, marker: statusMarker(dag, ms) },
            children: []
          };
          const actions = sortById(dag.getDownstream(ms.id));
          for (const act of actions) {
            if (scopeFilter && !scopeFilter.has(act.id)) continue;
            msEntry.children.push({
              node: { id: act.id, type: act.type, title: act.title, status: act.status, marker: statusMarker(dag, act) },
              children: []
            });
          }
          declEntry.children.push(msEntry);
        }
        tree.push(declEntry);
      }
      if (tree.length === 0 && scopeFilter) {
        const milestones = sortById(dag.getMilestones());
        for (const ms of milestones) {
          if (!scopeFilter.has(ms.id)) continue;
          const msEntry = {
            node: { id: ms.id, type: ms.type, title: ms.title, status: ms.status, marker: statusMarker(dag, ms) },
            children: []
          };
          const actions = sortById(dag.getDownstream(ms.id));
          for (const act of actions) {
            if (scopeFilter && !scopeFilter.has(act.id)) continue;
            msEntry.children.push({
              node: { id: act.id, type: act.type, title: act.title, status: act.status, marker: statusMarker(dag, act) },
              children: []
            });
          }
          tree.push(msEntry);
        }
      }
      return tree;
    }
    function formatTree(tree) {
      const lines = [];
      for (const root of tree) {
        lines.push(`${root.node.id}: ${root.node.title} ${root.node.marker}`);
        renderChildren(root.children, "", lines);
        lines.push("");
      }
      while (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
      }
      return lines.join("\n") + "\n";
    }
    function renderChildren(children, prefix, lines) {
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const isLast = i === children.length - 1;
        const connector = isLast ? "\u2514\u2500\u2500" : "\u251C\u2500\u2500";
        const childPrefix = isLast ? `${prefix}    ` : `${prefix}\u2502   `;
        lines.push(`${prefix}${connector} ${child.node.id}: ${child.node.title} ${child.node.marker}`);
        if (child.children.length > 0) {
          renderChildren(child.children, childPrefix, lines);
        }
      }
    }
    function runVisualize2(cwd, args) {
      const graphResult = buildDagFromDisk(cwd);
      if (graphResult.error) return graphResult;
      const { dag } = graphResult;
      const scopeId = args[0] && !args[0].startsWith("--") ? args[0] : null;
      const outputFile = parseFlag(args, "output");
      let scopeFilter = null;
      if (scopeId) {
        const scopeNode = dag.getNode(scopeId);
        if (!scopeNode) {
          return { error: `Node not found: ${scopeId}. Use a valid D-XX or M-XX ID.` };
        }
        scopeFilter = getSubtreeNodeIds(dag, scopeId);
      }
      const tree = buildTreeData(dag, scopeFilter);
      const formatted = formatTree(tree);
      let declCount = 0;
      let msCount = 0;
      let actCount = 0;
      function countNodes(nodes) {
        for (const entry of nodes) {
          const type = entry.node.type;
          if (type === "declaration") declCount++;
          else if (type === "milestone") msCount++;
          else if (type === "action") actCount++;
          countNodes(entry.children);
        }
      }
      countNodes(tree);
      const result = {
        scope: scopeId || "full",
        tree,
        formatted,
        stats: { declarations: declCount, milestones: msCount, actions: actCount }
      };
      if (outputFile) {
        const resolvedOutput = resolve(cwd, outputFile);
        writeFileSync(resolvedOutput, formatted, "utf-8");
        result.outputFile = resolvedOutput;
      }
      return result;
    }
    module2.exports = { runVisualize: runVisualize2, getSubtreeNodeIds, buildTreeData, formatTree, statusMarker };
  }
});

// src/commands/compute-waves.js
var require_compute_waves = __commonJS({
  "src/commands/compute-waves.js"(exports2, module2) {
    "use strict";
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { isCompleted } = require_engine();
    function runComputeWaves2(cwd, args) {
      const milestoneId = parseFlag(args, "milestone");
      if (!milestoneId) {
        return { error: "Missing --milestone flag. Usage: compute-waves --milestone M-XX" };
      }
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const milestone = dag.getNode(milestoneId);
      if (!milestone) {
        return { error: `Milestone not found: ${milestoneId}` };
      }
      if (milestone.type !== "milestone") {
        return { error: `${milestoneId} is not a milestone (type: ${milestone.type})` };
      }
      const actions = dag.getDownstream(milestoneId).filter((n) => n.type === "action" && !isCompleted(n.status));
      if (actions.length === 0) {
        return {
          milestoneId,
          milestoneTitle: milestone.title,
          declarations: [],
          waves: [],
          totalActions: 0,
          allDone: true
        };
      }
      const wave1Actions = actions.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        produces: a.metadata.produces || ""
      })).sort((a, b) => a.id.localeCompare(b.id));
      const upstream = dag.getUpstream(milestoneId);
      const declarations = upstream.filter((n) => n.type === "declaration").map((n) => ({ id: n.id, title: n.title }));
      return {
        milestoneId,
        milestoneTitle: milestone.title,
        declarations,
        waves: [{ wave: 1, actions: wave1Actions }],
        totalActions: wave1Actions.length,
        allDone: false
      };
    }
    module2.exports = { runComputeWaves: runComputeWaves2 };
  }
});

// src/artifacts/exec-plan.js
var require_exec_plan = __commonJS({
  "src/artifacts/exec-plan.js"(exports2, module2) {
    "use strict";
    var { traceUpward } = require_trace();
    function buildWhyChain(paths, milestoneId, milestoneTitle) {
      const declMap = /* @__PURE__ */ new Map();
      for (const path of paths) {
        for (const node of path) {
          if (node.type === "declaration") {
            declMap.set(node.id, node.title);
          }
        }
      }
      const declarations = [...declMap.entries()].map(([id, title]) => ({ id, title }));
      const declStrings = declarations.map((d) => `${d.id}: ${d.title}`);
      const whyChain = declStrings.length > 0 ? `This action causes ${milestoneId} ("${milestoneTitle}") which realizes ${declStrings.join(", ")}` : `This action causes ${milestoneId} ("${milestoneTitle}")`;
      return { whyChain, declarations };
    }
    function generateExecPlan(dag, actionId, milestoneId, waveNumber) {
      const action = dag.getNode(actionId);
      const milestone = dag.getNode(milestoneId);
      if (!action) {
        return `# Error: Action ${actionId} not found in DAG
`;
      }
      if (!milestone) {
        return `# Error: Milestone ${milestoneId} not found in DAG
`;
      }
      const paths = traceUpward(dag, actionId);
      const { whyChain, declarations } = buildWhyChain(paths, milestoneId, milestone.title);
      const produces = action.metadata.produces || "";
      const description = action.metadata.description || action.title;
      const contextRefs = [
        "@.planning/FUTURE.md",
        "@.planning/MILESTONES.md"
      ];
      const lines = [
        "---",
        `phase: ${milestoneId}`,
        `plan: ${actionId}`,
        "type: execute",
        `wave: ${waveNumber}`,
        "depends_on: []",
        "files_modified: []",
        "autonomous: true",
        "---",
        "",
        "<objective>",
        action.title,
        "",
        `Purpose: ${whyChain}`,
        `Output: ${produces || "See action description"}`,
        "</objective>",
        "",
        "<context>",
        ...contextRefs,
        "</context>",
        "",
        "<tasks>",
        "",
        '<task type="auto">',
        `  <name>Task 1: ${action.title}</name>`,
        `  <files>${produces || "TBD - executor determines from action scope"}</files>`,
        "  <action>",
        description,
        "",
        `Context: ${whyChain}`,
        "  </action>",
        `  <verify>Verify that the action's output exists and functions correctly</verify>`,
        `  <done>${produces || action.title} is complete and verified</done>`,
        "</task>",
        "",
        "</tasks>",
        "",
        "<verification>",
        "1. Action produces artifacts exist on disk",
        "2. Any tests related to this action pass",
        "3. Git commits reflect the work done",
        "</verification>",
        "",
        "<success_criteria>",
        `${action.title} is complete, verified, and advances milestone ${milestoneId}`,
        "</success_criteria>",
        "",
        "<output>",
        "After completion, commit atomically and report results to orchestrator.",
        "</output>",
        ""
      ];
      return lines.join("\n");
    }
    module2.exports = { generateExecPlan, buildWhyChain };
  }
});

// src/commands/generate-exec-plan.js
var require_generate_exec_plan = __commonJS({
  "src/commands/generate-exec-plan.js"(exports2, module2) {
    "use strict";
    var { writeFileSync } = require("node:fs");
    var { join } = require("node:path");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { generateExecPlan } = require_exec_plan();
    var { findMilestoneFolder } = require_milestone_folders();
    function runGenerateExecPlan2(cwd, args) {
      const actionId = parseFlag(args, "action");
      if (!actionId) {
        return { error: "Missing --action flag. Usage: generate-exec-plan --action A-XX --milestone M-XX" };
      }
      const milestoneId = parseFlag(args, "milestone");
      if (!milestoneId) {
        return { error: "Missing --milestone flag. Usage: generate-exec-plan --action A-XX --milestone M-XX" };
      }
      const waveStr = parseFlag(args, "wave");
      const wave = waveStr ? parseInt(waveStr, 10) : 1;
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const action = dag.getNode(actionId);
      if (!action) {
        return { error: `Action not found: ${actionId}` };
      }
      if (action.type !== "action") {
        return { error: `${actionId} is not an action (type: ${action.type})` };
      }
      const milestone = dag.getNode(milestoneId);
      if (!milestone) {
        return { error: `Milestone not found: ${milestoneId}` };
      }
      if (milestone.type !== "milestone") {
        return { error: `${milestoneId} is not a milestone (type: ${milestone.type})` };
      }
      const content = generateExecPlan(dag, actionId, milestoneId, wave);
      const planningDir = join(cwd, ".planning");
      const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);
      if (!milestoneFolder) {
        return { error: `Milestone folder not found for ${milestoneId}. Run /declare:actions first to create the milestone plan.` };
      }
      const numericSuffix = actionId.split("-")[1];
      const filename = `EXEC-PLAN-${numericSuffix}.md`;
      const outputPath = join(milestoneFolder, filename);
      writeFileSync(outputPath, content, "utf-8");
      return {
        actionId,
        milestoneId,
        wave,
        outputPath,
        content: content.substring(0, 200)
      };
    }
    module2.exports = { runGenerateExecPlan: runGenerateExecPlan2 };
  }
});

// src/commands/verify-wave.js
var require_verify_wave = __commonJS({
  "src/commands/verify-wave.js"(exports2, module2) {
    "use strict";
    var { existsSync } = require("node:fs");
    var { resolve } = require("node:path");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { traceUpward } = require_trace();
    var { isCompleted } = require_engine();
    function looksLikeFilePath(produces) {
      if (!produces || produces.trim() === "") return false;
      return /[/\\]/.test(produces) || /\.\w{1,10}$/.test(produces);
    }
    function runVerifyWave2(cwd, args) {
      const milestoneId = parseFlag(args, "milestone");
      if (!milestoneId) {
        return { error: 'Missing --milestone flag. Usage: verify-wave --milestone M-XX --actions "A-01,A-02"' };
      }
      const actionsStr = parseFlag(args, "actions");
      if (!actionsStr) {
        return { error: 'Missing --actions flag. Usage: verify-wave --milestone M-XX --actions "A-01,A-02"' };
      }
      const completedActionIds = actionsStr.split(",").map((s) => s.trim()).filter(Boolean);
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const milestone = dag.getNode(milestoneId);
      if (!milestone) {
        return { error: `Milestone not found: ${milestoneId}` };
      }
      if (milestone.type !== "milestone") {
        return { error: `${milestoneId} is not a milestone (type: ${milestone.type})` };
      }
      const allChecks = [];
      const completedActions = [];
      for (const actionId of completedActionIds) {
        const action = dag.getNode(actionId);
        allChecks.push({
          actionId,
          check: "action-exists",
          passed: !!action
        });
        if (!action) {
          completedActions.push({ id: actionId, title: "(not found)", producesExist: null });
          continue;
        }
        const produces = action.metadata.produces || "";
        if (looksLikeFilePath(produces)) {
          const filePath = resolve(cwd, produces);
          const exists = existsSync(filePath);
          allChecks.push({
            actionId,
            check: "produces-exist",
            passed: exists
          });
          completedActions.push({ id: actionId, title: action.title, producesExist: exists });
        } else {
          allChecks.push({
            actionId,
            check: "produces-exist",
            passed: true
          });
          completedActions.push({ id: actionId, title: action.title, producesExist: null });
        }
      }
      const allMilestoneActions = dag.getDownstream(milestoneId).filter((n) => n.type === "action");
      const milestoneCompletable = allMilestoneActions.every(
        (a) => isCompleted(a.status) || completedActionIds.includes(a.id)
      );
      const paths = traceUpward(dag, milestoneId);
      const declMap = /* @__PURE__ */ new Map();
      for (const path of paths) {
        for (const node of path) {
          if (node.type === "declaration") {
            declMap.set(node.id, node.title);
          }
        }
      }
      const declarations = [...declMap.entries()].map(([id, title]) => ({ id, title }));
      const declStrings = declarations.map((d) => `${d.id}: ${d.title}`);
      const whyChain = declStrings.length > 0 ? `${milestoneId} ("${milestone.title}") realizes ${declStrings.join(", ")}` : `${milestoneId} ("${milestone.title}")`;
      const passed = allChecks.every((c) => c.passed);
      return {
        milestoneId,
        milestoneTitle: milestone.title,
        completedActions,
        milestoneCompletable,
        traceContext: {
          declarations,
          whyChain
        },
        allChecks,
        passed
      };
    }
    module2.exports = { runVerifyWave: runVerifyWave2 };
  }
});

// src/commands/execute.js
var require_execute = __commonJS({
  "src/commands/execute.js"(exports2, module2) {
    "use strict";
    var { join } = require("node:path");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { findMilestoneFolder } = require_milestone_folders();
    var { isCompleted } = require_engine();
    function runExecute2(cwd, args) {
      const milestoneId = parseFlag(args, "milestone");
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag, milestones } = graphResult;
      if (!milestoneId) {
        const milestonePicker = milestones.map((m) => {
          const actions = dag.getDownstream(m.id).filter((n) => n.type === "action");
          const doneCount2 = actions.filter((a) => isCompleted(a.status)).length;
          return {
            id: m.id,
            title: m.title,
            status: m.status,
            actionCount: actions.length,
            doneCount: doneCount2
          };
        });
        return { milestones: milestonePicker };
      }
      const milestone = dag.getNode(milestoneId);
      if (!milestone) {
        return { error: `Milestone not found: ${milestoneId}` };
      }
      if (milestone.type !== "milestone") {
        return { error: `${milestoneId} is not a milestone (type: ${milestone.type})` };
      }
      const allActionsRaw = dag.getDownstream(milestoneId).filter((n) => n.type === "action");
      const allActions = allActionsRaw.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        produces: a.metadata.produces || ""
      })).sort((a, b) => a.id.localeCompare(b.id));
      const pendingActions = allActions.filter((a) => !isCompleted(a.status));
      const doneCount = allActions.length - pendingActions.length;
      const waves = [];
      if (pendingActions.length > 0) {
        waves.push({ wave: 1, actions: pendingActions });
      }
      const upstream = dag.getUpstream(milestoneId);
      const declarations = upstream.filter((n) => n.type === "declaration").map((n) => ({ id: n.id, title: n.title }));
      const planningDir = join(cwd, ".planning");
      const milestoneFolderPath = findMilestoneFolder(planningDir, milestoneId);
      return {
        milestoneId,
        milestoneTitle: milestone.title,
        status: milestone.status,
        declarations,
        allActions,
        pendingActions,
        waves,
        totalActions: allActions.length,
        pendingCount: pendingActions.length,
        doneCount,
        allDone: pendingActions.length === 0,
        milestoneFolderPath
      };
    }
    module2.exports = { runExecute: runExecute2 };
  }
});

// src/commands/verify-milestone.js
var require_verify_milestone = __commonJS({
  "src/commands/verify-milestone.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, statSync } = require("node:fs");
    var { resolve, join } = require("node:path");
    var { execFileSync } = require("node:child_process");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { findMilestoneFolder } = require_milestone_folders();
    var { parsePlanFile } = require_plan();
    var { traceUpward } = require_trace();
    function looksLikeFilePath(produces) {
      if (!produces || produces.trim() === "") return false;
      return /[/\\]/.test(produces) || /\.\w{1,10}$/.test(produces);
    }
    function runVerifyMilestone2(cwd, args) {
      const milestoneId = parseFlag(args, "milestone");
      if (!milestoneId) {
        return { error: "Missing --milestone flag. Usage: verify-milestone --milestone M-XX" };
      }
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const milestone = dag.getNode(milestoneId);
      if (!milestone) {
        return { error: `Milestone not found: ${milestoneId}` };
      }
      if (milestone.type !== "milestone") {
        return { error: `${milestoneId} is not a milestone (type: ${milestone.type})` };
      }
      const planningDir = join(cwd, ".planning");
      const milestoneFolder = findMilestoneFolder(planningDir, milestoneId);
      const criteria = [];
      let scCounter = 1;
      if (milestoneFolder) {
        const planPath = join(milestoneFolder, "PLAN.md");
        if (existsSync(planPath)) {
          const planContent = readFileSync(planPath, "utf-8");
          const plan = parsePlanFile(planContent);
          for (const action of plan.actions) {
            if (!action.produces) continue;
            if (looksLikeFilePath(action.produces)) {
              const filePath = resolve(cwd, action.produces);
              const exists = existsSync(filePath);
              let evidence = exists ? `File exists` : `File not found: ${action.produces}`;
              if (exists) {
                try {
                  const stats = statSync(filePath);
                  evidence = `File exists (${stats.size} bytes)`;
                } catch {
                }
              }
              criteria.push({
                id: `SC-${String(scCounter).padStart(2, "0")}`,
                type: "artifact",
                passed: exists,
                description: `${action.id} produces ${action.produces}`,
                evidence,
                actionId: action.id
              });
              scCounter++;
            }
          }
        }
      }
      const packagePath = join(cwd, "package.json");
      if (existsSync(packagePath)) {
        try {
          const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));
          if (pkg.scripts && pkg.scripts.test) {
            let testPassed = false;
            let testEvidence = "";
            try {
              const result = execFileSync("npm", ["test"], {
                cwd,
                timeout: 6e4,
                stdio: "pipe"
              });
              testPassed = true;
              testEvidence = "npm test exited with code 0";
            } catch (err) {
              testPassed = false;
              const stderr = err.stderr ? err.stderr.toString().slice(0, 200) : "";
              testEvidence = `npm test failed (exit code ${err.status || "unknown"}): ${stderr}`;
            }
            criteria.push({
              id: `SC-${String(scCounter).padStart(2, "0")}`,
              type: "test",
              passed: testPassed,
              description: "npm test passes",
              evidence: testEvidence
            });
            scCounter++;
          }
        } catch {
        }
      }
      criteria.push({
        id: `SC-${String(scCounter).padStart(2, "0")}`,
        type: "ai",
        passed: null,
        description: "AI assessment of milestone truth alignment",
        evidence: null
      });
      const programmaticCriteria = criteria.filter((c) => c.type !== "ai");
      const programmaticPassed = programmaticCriteria.length === 0 || programmaticCriteria.every((c) => c.passed === true);
      const paths = traceUpward(dag, milestoneId);
      const declMap = /* @__PURE__ */ new Map();
      for (const path of paths) {
        for (const node of path) {
          if (node.type === "declaration") {
            declMap.set(node.id, node.title);
          }
        }
      }
      const declarations = [...declMap.entries()].map(([id, title]) => ({ id, title }));
      const declStrings = declarations.map((d) => `${d.id}: ${d.title}`);
      const whyChain = declStrings.length > 0 ? `${milestoneId} ("${milestone.title}") realizes ${declStrings.join(", ")}` : `${milestoneId} ("${milestone.title}")`;
      return {
        milestoneId,
        milestoneTitle: milestone.title,
        milestoneFolder,
        criteria,
        programmaticPassed,
        aiAssessmentNeeded: true,
        traceContext: {
          declarations,
          whyChain
        }
      };
    }
    module2.exports = { runVerifyMilestone: runVerifyMilestone2 };
  }
});

// src/commands/check-drift.js
var require_check_drift = __commonJS({
  "src/commands/check-drift.js"(exports2, module2) {
    "use strict";
    var { buildDagFromDisk } = require_build_dag();
    var { findOrphans } = require_engine();
    function findNearestConnections(dag, orphanId) {
      const node = dag.getNode(orphanId);
      if (!node) return [];
      const suggestions = [];
      if (node.type === "action") {
        const milestones = dag.getMilestones();
        for (const m of milestones) {
          const downstream = dag.getDownstream(m.id);
          const hasActions = downstream.some((d) => d.type === "action");
          if (hasActions) {
            suggestions.push({
              type: "connect",
              target: m.id,
              targetTitle: m.title,
              reason: `Milestone already has ${downstream.filter((d) => d.type === "action").length} action(s)`
            });
          }
          if (suggestions.length >= 3) break;
        }
        if (suggestions.length === 0) {
          for (const m of milestones) {
            suggestions.push({
              type: "connect",
              target: m.id,
              targetTitle: m.title,
              reason: "Available milestone"
            });
            if (suggestions.length >= 3) break;
          }
        }
      } else if (node.type === "milestone") {
        const declarations = dag.getDeclarations();
        for (const d of declarations) {
          if (d.status === "ACTIVE" || d.status === "PENDING") {
            suggestions.push({
              type: "connect",
              target: d.id,
              targetTitle: d.title,
              reason: `Declaration is ${d.status}`
            });
          }
          if (suggestions.length >= 3) break;
        }
        if (suggestions.length === 0) {
          for (const d of declarations) {
            suggestions.push({
              type: "connect",
              target: d.id,
              targetTitle: d.title,
              reason: "Available declaration"
            });
            if (suggestions.length >= 3) break;
          }
        }
      }
      return suggestions.slice(0, 3);
    }
    function runCheckDrift2(cwd) {
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const orphans = findOrphans(dag);
      const driftedNodes = orphans.map((orphan) => ({
        id: orphan.id,
        type: orphan.type,
        title: orphan.title,
        status: orphan.status,
        suggestions: findNearestConnections(dag, orphan.id)
      }));
      return {
        hasDrift: driftedNodes.length > 0,
        driftedNodes
      };
    }
    module2.exports = { runCheckDrift: runCheckDrift2 };
  }
});

// src/commands/check-occurrence.js
var require_check_occurrence = __commonJS({
  "src/commands/check-occurrence.js"(exports2, module2) {
    "use strict";
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { isCompleted } = require_engine();
    function runCheckOccurrence2(cwd, args) {
      const targetDecl = parseFlag(args || [], "declaration");
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const allDeclarations = dag.getDeclarations();
      const declarations = targetDecl ? allDeclarations.filter((d) => d.id === targetDecl) : allDeclarations;
      if (targetDecl && declarations.length === 0) {
        return { error: `Declaration not found: ${targetDecl}` };
      }
      const result = declarations.map((decl) => {
        const downstream = dag.getDownstream(decl.id);
        const milestones = downstream.filter((n) => n.type === "milestone");
        let totalActions = 0;
        let completedActions = 0;
        for (const m of milestones) {
          const mDownstream = dag.getDownstream(m.id);
          const actions = mDownstream.filter((n) => n.type === "action");
          totalActions += actions.length;
          completedActions += actions.filter((a) => isCompleted(a.status)).length;
        }
        return {
          declarationId: decl.id,
          statement: decl.metadata?.statement || decl.title,
          status: decl.status,
          milestoneCount: milestones.length,
          milestones: milestones.map((m) => ({
            id: m.id,
            title: m.title,
            status: m.status
          })),
          actionSummary: {
            total: totalActions,
            completed: completedActions
          }
        };
      });
      return { declarations: result };
    }
    module2.exports = { runCheckOccurrence: runCheckOccurrence2 };
  }
});

// src/commands/compute-performance.js
var require_compute_performance = __commonJS({
  "src/commands/compute-performance.js"(exports2, module2) {
    "use strict";
    var { buildDagFromDisk } = require_build_dag();
    var { isCompleted } = require_engine();
    function ratioToLabel(ratio, highThreshold, medThreshold) {
      if (ratio >= highThreshold) return "HIGH";
      if (ratio >= medThreshold) return "MEDIUM";
      return "LOW";
    }
    function combineLabels(alignment, integrity) {
      if (alignment === "LOW" || integrity === "LOW") return "LOW";
      if (alignment === "HIGH" && integrity === "HIGH") return "HIGH";
      return "MEDIUM";
    }
    function runComputePerformance2(cwd) {
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const declarations = dag.getDeclarations();
      if (declarations.length === 0) {
        return {
          perDeclaration: [],
          rollup: { alignment: "HIGH", integrity: "HIGH", performance: "HIGH" }
        };
      }
      const perDeclaration = declarations.map((decl) => {
        const downstream = dag.getDownstream(decl.id);
        const milestones = downstream.filter((n) => n.type === "milestone");
        let milestonesWithActions = 0;
        for (const m of milestones) {
          const mDownstream = dag.getDownstream(m.id);
          if (mDownstream.some((n) => n.type === "action")) {
            milestonesWithActions++;
          }
        }
        const alignmentRatio = milestones.length > 0 ? milestonesWithActions / milestones.length : 0;
        const alignmentLevel = milestones.length === 0 ? "LOW" : ratioToLabel(alignmentRatio, 0.8, 0.5);
        let verified = 0;
        let broken = 0;
        let pending = 0;
        for (const m of milestones) {
          const status = m.status;
          if (status === "KEPT" || status === "HONORED" || status === "RENEGOTIATED") {
            verified++;
          } else if (status === "BROKEN") {
            broken++;
          } else {
            pending++;
          }
        }
        let integrityLevel;
        if (milestones.length === 0) {
          integrityLevel = "HIGH";
        } else {
          const brokenRatio = broken / milestones.length;
          const verifiedRatio = verified / milestones.length;
          if (brokenRatio > 0.3) {
            integrityLevel = "LOW";
          } else if (verifiedRatio >= 0.7 && broken === 0) {
            integrityLevel = "HIGH";
          } else if (verifiedRatio >= 0.4) {
            integrityLevel = "MEDIUM";
          } else {
            integrityLevel = "LOW";
          }
        }
        const performance = combineLabels(alignmentLevel, integrityLevel);
        return {
          declarationId: decl.id,
          declarationTitle: decl.title,
          statement: decl.metadata?.statement || decl.title,
          alignment: {
            level: alignmentLevel,
            milestonesTotal: milestones.length,
            milestonesWithActions
          },
          integrity: {
            level: integrityLevel,
            verified,
            broken,
            pending,
            total: milestones.length
          },
          performance
        };
      });
      const hasAnyLowAlignment = perDeclaration.some((d) => d.alignment.level === "LOW");
      const hasAnyLowIntegrity = perDeclaration.some((d) => d.integrity.level === "LOW");
      const allHighAlignment = perDeclaration.every((d) => d.alignment.level === "HIGH");
      const allHighIntegrity = perDeclaration.every((d) => d.integrity.level === "HIGH");
      const rollupAlignment = hasAnyLowAlignment ? "LOW" : allHighAlignment ? "HIGH" : "MEDIUM";
      const rollupIntegrity = hasAnyLowIntegrity ? "LOW" : allHighIntegrity ? "HIGH" : "MEDIUM";
      const rollupPerformance = combineLabels(rollupAlignment, rollupIntegrity);
      return {
        perDeclaration,
        rollup: {
          alignment: rollupAlignment,
          integrity: rollupIntegrity,
          performance: rollupPerformance
        }
      };
    }
    module2.exports = { runComputePerformance: runComputePerformance2 };
  }
});

// src/commands/renegotiate.js
var require_renegotiate = __commonJS({
  "src/commands/renegotiate.js"(exports2, module2) {
    "use strict";
    var { existsSync, readFileSync, writeFileSync, mkdirSync } = require("node:fs");
    var { join } = require("node:path");
    var { parseFlag } = require_parse_args();
    var { buildDagFromDisk } = require_build_dag();
    var { parseFutureFile, writeFutureFile, appendToArchive } = require_future();
    var { isCompleted } = require_engine();
    function runRenegotiate2(cwd, args) {
      const declId = parseFlag(args || [], "declaration");
      const reason = parseFlag(args || [], "reason");
      if (!declId) {
        return { error: 'Missing --declaration flag. Usage: renegotiate --declaration D-XX --reason "..."' };
      }
      if (!reason) {
        return { error: 'Missing --reason flag. Usage: renegotiate --declaration D-XX --reason "..."' };
      }
      const graphResult = buildDagFromDisk(cwd);
      if ("error" in graphResult) return graphResult;
      const { dag } = graphResult;
      const declNode = dag.getNode(declId);
      if (!declNode || declNode.type !== "declaration") {
        return { error: `Declaration not found: ${declId}` };
      }
      const planningDir = join(cwd, ".planning");
      const futurePath = join(planningDir, "FUTURE.md");
      const archivePath = join(planningDir, "FUTURE-ARCHIVE.md");
      const futureContent = existsSync(futurePath) ? readFileSync(futurePath, "utf-8") : "";
      const declarations = parseFutureFile(futureContent);
      const declEntry = declarations.find((d) => d.id === declId);
      if (!declEntry) {
        return { error: `Declaration ${declId} not found in FUTURE.md` };
      }
      declEntry.status = "RENEGOTIATED";
      const headerMatch = futureContent.match(/^# Future: (.+)/m);
      const projectName = headerMatch ? headerMatch[1].trim() : "Project";
      writeFileSync(futurePath, writeFutureFile(declarations, projectName));
      const archivedAt = (/* @__PURE__ */ new Date()).toISOString();
      const existingArchive = existsSync(archivePath) ? readFileSync(archivePath, "utf-8") : "";
      const updatedArchive = appendToArchive(existingArchive, {
        id: declId,
        title: declEntry.title,
        statement: declEntry.statement,
        archivedAt,
        reason,
        replacedBy: "",
        statusAtArchive: "RENEGOTIATED"
      });
      writeFileSync(archivePath, updatedArchive);
      const downstream = dag.getDownstream(declId);
      const milestones = downstream.filter((n) => n.type === "milestone");
      const orphanedMilestones = [];
      for (const m of milestones) {
        const upstream = dag.getUpstream(m.id);
        const realizesOnlyThis = upstream.length === 1 && upstream[0].id === declId;
        if (realizesOnlyThis) {
          const mDownstream = dag.getDownstream(m.id);
          const actions = mDownstream.filter((n) => n.type === "action").map((a) => ({ id: a.id, title: a.title, status: a.status }));
          orphanedMilestones.push({
            id: m.id,
            title: m.title,
            status: m.status,
            actions
          });
        }
      }
      return {
        archived: { id: declId, title: declEntry.title, archivedAt },
        orphanedMilestones,
        archivePath,
        nextStep: "Create replacement declaration or reassign milestones"
      };
    }
    module2.exports = { runRenegotiate: runRenegotiate2 };
  }
});

// src/declare-tools.js
var { commitPlanningDocs } = require_commit();
var { runInit } = require_init();
var { runStatus } = require_status();
var { runHelp } = require_help();
var { runAddDeclaration } = require_add_declaration();
var { runAddMilestone } = require_add_milestone();
var { runAddMilestonesBatch } = require_add_milestones_batch();
var { runAddAction } = require_add_action();
var { runCreatePlan } = require_create_plan();
var { runLoadGraph } = require_load_graph();
var { runTrace } = require_trace();
var { runPrioritize } = require_prioritize();
var { runVisualize } = require_visualize();
var { runComputeWaves } = require_compute_waves();
var { runGenerateExecPlan } = require_generate_exec_plan();
var { runVerifyWave } = require_verify_wave();
var { runExecute } = require_execute();
var { runVerifyMilestone } = require_verify_milestone();
var { runCheckDrift } = require_check_drift();
var { runCheckOccurrence } = require_check_occurrence();
var { runComputePerformance } = require_compute_performance();
var { runRenegotiate } = require_renegotiate();
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
    console.log(JSON.stringify({ error: "No command specified. Use: commit, init, status, add-declaration, add-milestone, add-milestones, create-plan, load-graph, trace, prioritize, visualize, compute-waves, generate-exec-plan, verify-wave, verify-milestone, execute, check-drift, check-occurrence, compute-performance, renegotiate, help" }));
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
      case "add-milestones": {
        const cwdAddMsBatch = parseCwdFlag(args) || process.cwd();
        const result = runAddMilestonesBatch(cwdAddMsBatch, args.slice(1));
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
      case "visualize": {
        const cwdVisualize = parseCwdFlag(args) || process.cwd();
        const result = runVisualize(cwdVisualize, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "compute-waves": {
        const cwdComputeWaves = parseCwdFlag(args) || process.cwd();
        const result = runComputeWaves(cwdComputeWaves, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "generate-exec-plan": {
        const cwdGenExecPlan = parseCwdFlag(args) || process.cwd();
        const result = runGenerateExecPlan(cwdGenExecPlan, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "verify-wave": {
        const cwdVerifyWave = parseCwdFlag(args) || process.cwd();
        const result = runVerifyWave(cwdVerifyWave, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "execute": {
        const cwdExecute = parseCwdFlag(args) || process.cwd();
        const result = runExecute(cwdExecute, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "verify-milestone": {
        const cwdVerifyMs = parseCwdFlag(args) || process.cwd();
        const result = runVerifyMilestone(cwdVerifyMs, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "check-drift": {
        const cwdCheckDrift = parseCwdFlag(args) || process.cwd();
        const result = runCheckDrift(cwdCheckDrift);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "check-occurrence": {
        const cwdCheckOcc = parseCwdFlag(args) || process.cwd();
        const result = runCheckOccurrence(cwdCheckOcc, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "compute-performance": {
        const cwdCompPerf = parseCwdFlag(args) || process.cwd();
        const result = runComputePerformance(cwdCompPerf);
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      case "renegotiate": {
        const cwdReneg = parseCwdFlag(args) || process.cwd();
        const result = runRenegotiate(cwdReneg, args.slice(1));
        console.log(JSON.stringify(result));
        if (result.error) process.exit(1);
        break;
      }
      default:
        console.log(JSON.stringify({ error: `Unknown command: ${command}. Use: commit, init, status, add-declaration, add-milestone, add-milestones, create-plan, load-graph, trace, prioritize, visualize, compute-waves, generate-exec-plan, verify-wave, verify-milestone, execute, check-drift, check-occurrence, compute-performance, renegotiate, help` }));
        process.exit(1);
    }
  } catch (err) {
    console.log(JSON.stringify({ error: err.message || String(err) }));
    process.exit(1);
  }
}
main();
