/**
 * Checkpoint State Management with Idempotency
 *
 * Per CONTEXT.md:
 * - Checkpoint requests emit to WebSocket with timeout warning
 * - Checkpoint responses are deduplicated by ID + hash
 * - Pending checkpoints persist and auto-push on reconnect
 *
 * Idempotency: "accept first, ignore duplicates" via checkpoint ID + response hash
 */

import { createHash, randomUUID } from 'crypto';
import type { CheckpointRequestEvent } from '@gsd/events';

export interface PendingCheckpoint {
  checkpointId: string;
  agentId: string;
  type: CheckpointRequestEvent['type'];
  prompt: string;
  options?: CheckpointRequestEvent['options'];
  createdAt: number;
  timeoutMs: number;
  warnedAt?: number | undefined;
  pausedAt?: number | undefined;
  responseHash?: string | undefined; // Set when first response received
  response?: string | undefined; // Store actual response for retrieval
}

// In-memory store for pending checkpoints
// Per CONTEXT.md: persist for reconnect scenarios
const pendingCheckpoints = new Map<string, PendingCheckpoint>();

// Map agentId -> checkpointIds for quick lookup
const agentCheckpoints = new Map<string, Set<string>>();

/**
 * Hash response for idempotency per CONTEXT.md:
 * "Idempotency via checkpoint ID + response hash (accept first, ignore duplicates)"
 */
export function hashResponse(checkpointId: string, response: string): string {
  return createHash('sha256')
    .update(`${checkpointId}:${response}`)
    .digest('hex');
}

/**
 * Create a new checkpoint and register it
 */
export function createCheckpoint(
  agentId: string,
  type: PendingCheckpoint['type'],
  prompt: string,
  options?: PendingCheckpoint['options'],
  timeoutMs: number = 60000 // Default 60s per CONTEXT.md
): PendingCheckpoint {
  const checkpointId = randomUUID();

  const checkpoint: PendingCheckpoint = {
    checkpointId,
    agentId,
    type,
    prompt,
    options,
    createdAt: Date.now(),
    timeoutMs,
  };

  pendingCheckpoints.set(checkpointId, checkpoint);

  // Track by agentId
  let agentSet = agentCheckpoints.get(agentId);
  if (!agentSet) {
    agentSet = new Set();
    agentCheckpoints.set(agentId, agentSet);
  }
  agentSet.add(checkpointId);

  return checkpoint;
}

/**
 * Process a checkpoint response with idempotency check
 * Per CONTEXT.md: "accept first, ignore duplicates"
 */
export function processCheckpointResponse(
  checkpointId: string,
  response: string
): {
  accepted: boolean;
  checkpoint?: PendingCheckpoint | undefined;
  reason?: string | undefined;
} {
  const checkpoint = pendingCheckpoints.get(checkpointId);

  if (!checkpoint) {
    return { accepted: false, reason: 'CHECKPOINT_NOT_FOUND' };
  }

  const hash = hashResponse(checkpointId, response);

  // Idempotency check
  if (checkpoint.responseHash) {
    if (checkpoint.responseHash === hash) {
      // Duplicate of accepted response - acknowledge without error
      return { accepted: true, checkpoint };
    }
    return { accepted: false, reason: 'CHECKPOINT_ALREADY_RESPONDED' };
  }

  // First response - accept and store hash + response
  checkpoint.responseHash = hash;
  checkpoint.response = response;

  return { accepted: true, checkpoint };
}

/**
 * Get all pending checkpoints (no response yet)
 */
export function getPendingCheckpoints(): PendingCheckpoint[] {
  return Array.from(pendingCheckpoints.values()).filter((c) => !c.responseHash);
}

/**
 * Get pending checkpoints for a specific agent
 * Per CONTEXT.md: "Auto-push checkpoint:pending immediately after socket reconnects"
 */
export function getPendingCheckpointsForAgent(
  agentId: string
): PendingCheckpoint[] {
  const checkpointIds = agentCheckpoints.get(agentId);
  if (!checkpointIds) return [];

  return Array.from(checkpointIds)
    .map((id) => pendingCheckpoints.get(id))
    .filter((c): c is PendingCheckpoint => !!c && !c.responseHash);
}

/**
 * Mark checkpoint as warned (30s per CONTEXT.md)
 */
export function markCheckpointWarned(checkpointId: string): void {
  const checkpoint = pendingCheckpoints.get(checkpointId);
  if (checkpoint) {
    checkpoint.warnedAt = Date.now();
  }
}

/**
 * Mark checkpoint as paused (60s per CONTEXT.md)
 */
export function markCheckpointPaused(checkpointId: string): void {
  const checkpoint = pendingCheckpoints.get(checkpointId);
  if (checkpoint) {
    checkpoint.pausedAt = Date.now();
  }
}

/**
 * Clean up checkpoint after processing
 */
export function removeCheckpoint(checkpointId: string): void {
  const checkpoint = pendingCheckpoints.get(checkpointId);
  if (checkpoint) {
    pendingCheckpoints.delete(checkpointId);
    const agentSet = agentCheckpoints.get(checkpoint.agentId);
    if (agentSet) {
      agentSet.delete(checkpointId);
      if (agentSet.size === 0) {
        agentCheckpoints.delete(checkpoint.agentId);
      }
    }
  }
}

/**
 * Get checkpoint by ID
 */
export function getCheckpoint(checkpointId: string): PendingCheckpoint | undefined {
  return pendingCheckpoints.get(checkpointId);
}

/**
 * Clear all checkpoints for testing or shutdown
 */
export function clearAllCheckpoints(): void {
  pendingCheckpoints.clear();
  agentCheckpoints.clear();
}
