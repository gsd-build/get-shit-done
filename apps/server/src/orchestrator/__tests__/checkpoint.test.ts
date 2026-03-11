import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashResponse,
  createCheckpoint,
  processCheckpointResponse,
  getPendingCheckpoints,
  getPendingCheckpointsForAgent,
  markCheckpointWarned,
  markCheckpointPaused,
  removeCheckpoint,
  getCheckpoint,
  clearAllCheckpoints,
} from '../checkpoint.js';

describe('checkpoint', () => {
  beforeEach(() => {
    clearAllCheckpoints();
  });

  describe('hashResponse', () => {
    it('creates consistent hash for same inputs', () => {
      // Arrange
      const checkpointId = 'cp-123';
      const response = 'user response';

      // Act
      const hash1 = hashResponse(checkpointId, response);
      const hash2 = hashResponse(checkpointId, response);

      // Assert
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it('creates different hashes for different responses', () => {
      // Arrange
      const checkpointId = 'cp-123';

      // Act
      const hash1 = hashResponse(checkpointId, 'response1');
      const hash2 = hashResponse(checkpointId, 'response2');

      // Assert
      expect(hash1).not.toBe(hash2);
    });

    it('creates different hashes for different checkpoint IDs', () => {
      // Arrange
      const response = 'same response';

      // Act
      const hash1 = hashResponse('cp-1', response);
      const hash2 = hashResponse('cp-2', response);

      // Assert
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('createCheckpoint', () => {
    it('creates checkpoint with all required fields', () => {
      // Act
      const checkpoint = createCheckpoint(
        'agent-1',
        'user_confirmation',
        'Please confirm',
        { urgency: 'high' },
        30000
      );

      // Assert
      expect(checkpoint.checkpointId).toBeDefined();
      expect(checkpoint.agentId).toBe('agent-1');
      expect(checkpoint.type).toBe('user_confirmation');
      expect(checkpoint.prompt).toBe('Please confirm');
      expect(checkpoint.options).toEqual({ urgency: 'high' });
      expect(checkpoint.timeoutMs).toBe(30000);
      expect(checkpoint.createdAt).toBeLessThanOrEqual(Date.now());
      expect(checkpoint.responseHash).toBeUndefined();
    });

    it('uses default timeout of 60s', () => {
      // Act
      const checkpoint = createCheckpoint(
        'agent-1',
        'user_confirmation',
        'Prompt'
      );

      // Assert
      expect(checkpoint.timeoutMs).toBe(60000);
    });

    it('stores checkpoint for later retrieval', () => {
      // Act
      const checkpoint = createCheckpoint(
        'agent-1',
        'user_confirmation',
        'Prompt'
      );

      // Assert
      const retrieved = getCheckpoint(checkpoint.checkpointId);
      expect(retrieved).toEqual(checkpoint);
    });

    it('tracks checkpoint by agent ID', () => {
      // Arrange
      createCheckpoint('agent-1', 'user_confirmation', 'Prompt 1');
      createCheckpoint('agent-1', 'user_confirmation', 'Prompt 2');
      createCheckpoint('agent-2', 'user_confirmation', 'Prompt 3');

      // Act
      const agent1Checkpoints = getPendingCheckpointsForAgent('agent-1');
      const agent2Checkpoints = getPendingCheckpointsForAgent('agent-2');

      // Assert
      expect(agent1Checkpoints).toHaveLength(2);
      expect(agent2Checkpoints).toHaveLength(1);
    });
  });

  describe('processCheckpointResponse', () => {
    it('accepts first response and stores hash', () => {
      // Arrange
      const checkpoint = createCheckpoint(
        'agent-1',
        'user_confirmation',
        'Prompt'
      );

      // Act
      const result = processCheckpointResponse(
        checkpoint.checkpointId,
        'user says yes'
      );

      // Assert
      expect(result.accepted).toBe(true);
      expect(result.checkpoint).toBeDefined();
      expect(result.checkpoint?.responseHash).toBeDefined();
      expect(result.checkpoint?.response).toBe('user says yes');
    });

    it('accepts duplicate response with same content', () => {
      // Arrange - idempotency
      const checkpoint = createCheckpoint(
        'agent-1',
        'user_confirmation',
        'Prompt'
      );
      processCheckpointResponse(checkpoint.checkpointId, 'same response');

      // Act
      const result = processCheckpointResponse(
        checkpoint.checkpointId,
        'same response'
      );

      // Assert
      expect(result.accepted).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('rejects different response after first is accepted', () => {
      // Arrange
      const checkpoint = createCheckpoint(
        'agent-1',
        'user_confirmation',
        'Prompt'
      );
      processCheckpointResponse(checkpoint.checkpointId, 'first response');

      // Act
      const result = processCheckpointResponse(
        checkpoint.checkpointId,
        'different response'
      );

      // Assert
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('CHECKPOINT_ALREADY_RESPONDED');
    });

    it('returns not found for unknown checkpoint', () => {
      // Act
      const result = processCheckpointResponse('unknown-id', 'response');

      // Assert
      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('CHECKPOINT_NOT_FOUND');
    });
  });

  describe('getPendingCheckpoints', () => {
    it('returns only checkpoints without responses', () => {
      // Arrange
      const cp1 = createCheckpoint('agent-1', 'user_confirmation', 'Prompt 1');
      const cp2 = createCheckpoint('agent-1', 'user_confirmation', 'Prompt 2');
      createCheckpoint('agent-1', 'user_confirmation', 'Prompt 3');

      // Respond to first two
      processCheckpointResponse(cp1.checkpointId, 'response');
      processCheckpointResponse(cp2.checkpointId, 'response');

      // Act
      const pending = getPendingCheckpoints();

      // Assert
      expect(pending).toHaveLength(1);
      expect(pending[0]?.prompt).toBe('Prompt 3');
    });

    it('returns empty array when all checkpoints have responses', () => {
      // Arrange
      const cp = createCheckpoint('agent-1', 'user_confirmation', 'Prompt');
      processCheckpointResponse(cp.checkpointId, 'response');

      // Act
      const pending = getPendingCheckpoints();

      // Assert
      expect(pending).toHaveLength(0);
    });
  });

  describe('getPendingCheckpointsForAgent', () => {
    it('returns pending checkpoints for specific agent', () => {
      // Arrange
      const cp1 = createCheckpoint('agent-1', 'user_confirmation', 'A1-P1');
      createCheckpoint('agent-1', 'user_confirmation', 'A1-P2');
      createCheckpoint('agent-2', 'user_confirmation', 'A2-P1');

      processCheckpointResponse(cp1.checkpointId, 'response');

      // Act
      const agent1Pending = getPendingCheckpointsForAgent('agent-1');
      const agent2Pending = getPendingCheckpointsForAgent('agent-2');

      // Assert
      expect(agent1Pending).toHaveLength(1);
      expect(agent1Pending[0]?.prompt).toBe('A1-P2');
      expect(agent2Pending).toHaveLength(1);
    });

    it('returns empty array for unknown agent', () => {
      // Act
      const pending = getPendingCheckpointsForAgent('unknown-agent');

      // Assert
      expect(pending).toHaveLength(0);
    });
  });

  describe('markCheckpointWarned', () => {
    it('sets warnedAt timestamp', () => {
      // Arrange
      const checkpoint = createCheckpoint(
        'agent-1',
        'user_confirmation',
        'Prompt'
      );
      const beforeMark = Date.now();

      // Act
      markCheckpointWarned(checkpoint.checkpointId);

      // Assert
      const updated = getCheckpoint(checkpoint.checkpointId);
      expect(updated?.warnedAt).toBeGreaterThanOrEqual(beforeMark);
    });

    it('does nothing for unknown checkpoint', () => {
      // Act & Assert - should not throw
      expect(() => markCheckpointWarned('unknown')).not.toThrow();
    });
  });

  describe('markCheckpointPaused', () => {
    it('sets pausedAt timestamp', () => {
      // Arrange
      const checkpoint = createCheckpoint(
        'agent-1',
        'user_confirmation',
        'Prompt'
      );
      const beforeMark = Date.now();

      // Act
      markCheckpointPaused(checkpoint.checkpointId);

      // Assert
      const updated = getCheckpoint(checkpoint.checkpointId);
      expect(updated?.pausedAt).toBeGreaterThanOrEqual(beforeMark);
    });
  });

  describe('removeCheckpoint', () => {
    it('removes checkpoint from storage', () => {
      // Arrange
      const checkpoint = createCheckpoint(
        'agent-1',
        'user_confirmation',
        'Prompt'
      );

      // Act
      removeCheckpoint(checkpoint.checkpointId);

      // Assert
      expect(getCheckpoint(checkpoint.checkpointId)).toBeUndefined();
    });

    it('removes checkpoint from agent tracking', () => {
      // Arrange
      const checkpoint = createCheckpoint(
        'agent-1',
        'user_confirmation',
        'Prompt'
      );

      // Act
      removeCheckpoint(checkpoint.checkpointId);

      // Assert
      expect(getPendingCheckpointsForAgent('agent-1')).toHaveLength(0);
    });

    it('cleans up agent set when last checkpoint removed', () => {
      // Arrange
      const cp1 = createCheckpoint('agent-1', 'user_confirmation', 'P1');
      const cp2 = createCheckpoint('agent-1', 'user_confirmation', 'P2');

      // Act
      removeCheckpoint(cp1.checkpointId);
      removeCheckpoint(cp2.checkpointId);

      // Assert
      expect(getPendingCheckpointsForAgent('agent-1')).toHaveLength(0);
    });

    it('does nothing for unknown checkpoint', () => {
      // Act & Assert - should not throw
      expect(() => removeCheckpoint('unknown')).not.toThrow();
    });
  });

  describe('clearAllCheckpoints', () => {
    it('removes all checkpoints', () => {
      // Arrange
      createCheckpoint('agent-1', 'user_confirmation', 'P1');
      createCheckpoint('agent-2', 'user_confirmation', 'P2');

      // Act
      clearAllCheckpoints();

      // Assert
      expect(getPendingCheckpoints()).toHaveLength(0);
      expect(getPendingCheckpointsForAgent('agent-1')).toHaveLength(0);
      expect(getPendingCheckpointsForAgent('agent-2')).toHaveLength(0);
    });
  });
});
