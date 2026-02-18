// @ts-check
'use strict';

/**
 * DeclareDag - Three-layer directed acyclic graph for Declare.
 *
 * Nodes: declarations (D-XX), milestones (M-XX), actions (A-XX)
 * Edges: upward causation only (action->milestone, milestone->declaration)
 * States: PENDING, ACTIVE, DONE
 *
 * Zero runtime dependencies. CJS module.
 */

/** @type {Record<string, string>} */
const PREFIX_TO_TYPE = { D: 'declaration', M: 'milestone', A: 'action' };

/** @type {Record<string, string>} */
const TYPE_TO_PREFIX = { declaration: 'D', milestone: 'M', action: 'A' };

/**
 * Status state machine (convention, not enforced by engine):
 *
 *   PENDING -> ACTIVE -> DONE -> KEPT          (happy path: verified true)
 *   PENDING -> ACTIVE -> DONE -> BROKEN -> HONORED       (remediation succeeds)
 *   PENDING -> ACTIVE -> DONE -> BROKEN -> RENEGOTIATED  (user adjusts)
 *
 * Orchestration logic follows transitions; engine only validates membership.
 */
const VALID_STATUSES = new Set(['PENDING', 'ACTIVE', 'DONE', 'KEPT', 'BROKEN', 'HONORED', 'RENEGOTIATED']);

/** Statuses that indicate a node's work is completed (BROKEN means verification failed, remediation in progress). */
const COMPLETED_STATUSES = new Set(['DONE', 'KEPT', 'HONORED', 'RENEGOTIATED']);

/**
 * Check if a status represents a completed state.
 * @param {string} status
 * @returns {boolean}
 */
function isCompleted(status) {
  return COMPLETED_STATUSES.has(status);
}

const VALID_TYPES = new Set(['declaration', 'milestone', 'action']);

/**
 * Valid upward-causation edges: from-type -> to-type.
 * Actions cause milestones; milestones realize declarations.
 */
const VALID_EDGE_DIRECTIONS = {
  action: 'milestone',
  milestone: 'declaration',
};

class DeclareDag {
  constructor() {
    /** @type {Map<string, {id: string, type: string, title: string, status: string, metadata: Record<string, any>}>} */
    this.nodes = new Map();
    /** @type {Map<string, Set<string>>} id -> Set of IDs this node causes/realizes (upward) */
    this.upEdges = new Map();
    /** @type {Map<string, Set<string>>} id -> Set of IDs that cause/realize this node (downward) */
    this.downEdges = new Map();
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
  addNode(id, type, title, status = 'PENDING', metadata = {}) {
    if (!VALID_TYPES.has(type)) {
      throw new Error(`Invalid node type: ${type}. Must be one of: declaration, milestone, action`);
    }
    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: PENDING, ACTIVE, DONE`);
    }

    // Validate semantic prefix matches type
    const prefix = id.split('-')[0];
    if (PREFIX_TO_TYPE[prefix] !== type) {
      throw new Error(
        `ID prefix '${prefix}' doesn't match type '${type}'. ` +
        `Expected prefix '${TYPE_TO_PREFIX[type]}' for type '${type}'`
      );
    }

    // Validate ID format: PREFIX-DIGITS
    if (!/^[DMA]-\d+$/.test(id)) {
      throw new Error(`Invalid ID format: ${id}. Expected format: D-01, M-01, A-01`);
    }

    if (this.nodes.has(id)) {
      throw new Error(`Node already exists: ${id}`);
    }

    this.nodes.set(id, { id, type, title, status, metadata });
    if (!this.upEdges.has(id)) this.upEdges.set(id, new Set());
    if (!this.downEdges.has(id)) this.downEdges.set(id, new Set());

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

    // Remove all upward edges from this node
    const upTargets = this.upEdges.get(id);
    if (upTargets) {
      for (const target of upTargets) {
        const downSet = this.downEdges.get(target);
        if (downSet) downSet.delete(id);
      }
    }

    // Remove all downward edges to this node
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
        `Invalid edge: ${fromNode.type} -> ${toNode.type}. ` +
        `Only action->milestone and milestone->declaration edges are allowed`
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
    return this._byType('declaration');
  }

  /** @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>} */
  getMilestones() {
    return this._byType('milestone');
  }

  /** @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>} */
  getActions() {
    return this._byType('action');
  }

  /**
   * Get nodes that this node causes/realizes (upward neighbors).
   * @param {string} id
   * @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>}
   */
  getUpstream(id) {
    const targets = this.upEdges.get(id);
    if (!targets) return [];
    return [...targets].map(t => this.nodes.get(t)).filter(Boolean);
  }

  /**
   * Get nodes that cause/realize this node (downward neighbors).
   * @param {string} id
   * @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>}
   */
  getDownstream(id) {
    const sources = this.downEdges.get(id);
    if (!sources) return [];
    return [...sources].map(s => this.nodes.get(s)).filter(Boolean);
  }

  /**
   * @param {string} type
   * @returns {Array<{id: string, type: string, title: string, status: string, metadata: Record<string, any>}>}
   * @private
   */
  _byType(type) {
    return [...this.nodes.values()].filter(n => n.type === type);
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

    // Check for orphan nodes (milestones/actions with no upward edge)
    for (const [id, node] of this.nodes) {
      if (node.type === 'declaration') continue; // Declarations are top-level, no upward edge needed
      if (this.upEdges.get(id).size === 0) {
        errors.push({
          type: 'orphan',
          node: id,
          message: `${id} has no upward connection`,
        });
      }
    }

    // Check for cycles (via Kahn's algorithm)
    if (this._hasCycle()) {
      errors.push({
        type: 'cycle',
        message: 'Graph contains a cycle',
      });
    }

    // Validate edge targets exist
    for (const [from, targets] of this.upEdges) {
      for (const to of targets) {
        if (!this.nodes.has(to)) {
          errors.push({
            type: 'broken_edge',
            from,
            to,
            message: `Edge target ${to} not found`,
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
    // Build execution graph: if A causes M (upEdge A->M), then A must complete before M
    // So in the execution graph, A->M means "A before M" -- use upEdges as adjacency
    const inDegree = new Map();
    const adjList = new Map();

    for (const id of this.nodes.keys()) {
      inDegree.set(id, 0);
      adjList.set(id, new Set());
    }

    // For each upward edge from->to: from must come before to in execution order
    // So from is a prerequisite of to
    for (const [from, targets] of this.upEdges) {
      for (const to of targets) {
        if (!this.nodes.has(to)) continue; // Skip broken edges
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
      nodes: [...this.nodes.values()].map(n => ({ ...n })),
      edges: [...this.upEdges.entries()].flatMap(([from, tos]) =>
        [...tos].map(to => ({ from, to }))
      ),
    };
  }

  /**
   * Reconstruct DeclareDag from JSON.
   * @param {{ nodes: Array, edges: Array<{from: string, to: string}> }} data
   * @returns {DeclareDag}
   */
  static fromJSON(data) {
    const dag = new DeclareDag();
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
        const num = parseInt(id.split('-')[1], 10);
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
    /** @type {Record<string, number>} */
    const byStatus = {};
    for (const s of VALID_STATUSES) byStatus[s] = 0;
    let declarations = 0;
    let milestones = 0;
    let actions = 0;
    let edges = 0;

    for (const node of this.nodes.values()) {
      byStatus[node.status]++;
      if (node.type === 'declaration') declarations++;
      else if (node.type === 'milestone') milestones++;
      else if (node.type === 'action') actions++;
    }

    for (const targets of this.upEdges.values()) {
      edges += targets.size;
    }

    return { declarations, milestones, actions, edges, byStatus };
  }
}

/**
 * Find orphan nodes in a DAG (milestones/actions with no upward connection).
 * Convenience wrapper around validate() that filters for orphan-type errors.
 *
 * @param {DeclareDag} dag
 * @returns {Array<{id: string, type: string, title: string, status: string}>}
 */
function findOrphans(dag) {
  const { errors } = dag.validate();
  return errors
    .filter(e => e.type === 'orphan' && e.node)
    .map(e => {
      const node = dag.getNode(e.node);
      return node
        ? { id: node.id, type: node.type, title: node.title, status: node.status }
        : { id: e.node, type: 'unknown', title: '', status: '' };
    });
}

module.exports = { DeclareDag, COMPLETED_STATUSES, isCompleted, findOrphans };
