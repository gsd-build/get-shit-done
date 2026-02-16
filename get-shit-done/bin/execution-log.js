const fs = require('fs');
const path = require('path');

const EVENT_TYPES = {
  ROADMAP_START: 'roadmap_start',
  ROADMAP_COMPLETE: 'roadmap_complete',
  PHASE_START: 'phase_start',
  PHASE_COMPLETE: 'phase_complete',
  PHASE_FAILED: 'phase_failed',
  CHECKPOINT: 'checkpoint',
  DEPENDENCY_WAIT: 'dependency_wait',
  RESUME: 'resume',
  USER_DECISION: 'user_decision'
};

/**
 * Get path to EXECUTION_LOG.md in project
 */
function getLogPath(projectPath) {
  return path.join(projectPath, '.planning', 'EXECUTION_LOG.md');
}

/**
 * Initialize EXECUTION_LOG.md if it doesn't exist
 */
function initLog(projectPath) {
  const logPath = getLogPath(projectPath);

  if (fs.existsSync(logPath)) {
    return { created: false, path: logPath };
  }

  const header = '# Autonomous Roadmap Execution Log\n\n';
  fs.writeFileSync(logPath, header, 'utf8');

  return { created: true, path: logPath };
}

/**
 * Append event to log in JSONL format
 */
function appendEvent(projectPath, event) {
  // Ensure log exists
  initLog(projectPath);

  // Validate event has type field
  if (!event.type) {
    throw new Error('Event must have a type field');
  }

  // Add timestamp
  const timestamp = new Date().toISOString();
  const fullEvent = { timestamp, ...event };

  // Append as JSONL
  const logPath = getLogPath(projectPath);
  fs.appendFileSync(logPath, JSON.stringify(fullEvent) + '\n', 'utf8');

  return { success: true, event_id: timestamp };
}

/**
 * Parse log into events array
 */
function getHistory(projectPath) {
  const logPath = getLogPath(projectPath);

  if (!fs.existsSync(logPath)) {
    return [];
  }

  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');

  const events = [];
  for (const line of lines) {
    // Skip header lines and empty lines
    if (!line.trim() || line.startsWith('#')) {
      continue;
    }

    try {
      events.push(JSON.parse(line));
    } catch (err) {
      // Skip invalid JSON lines
      console.warn(`Skipping invalid JSON line: ${line.substring(0, 50)}...`);
    }
  }

  return events;
}

/**
 * Get currently executing phase
 */
function getCurrentPhase(projectPath) {
  const events = getHistory(projectPath);

  // Find most recent phase_start without matching phase_complete
  const phaseStarts = events.filter(e => e.type === EVENT_TYPES.PHASE_START);
  const phaseCompletes = events.filter(e =>
    e.type === EVENT_TYPES.PHASE_COMPLETE || e.type === EVENT_TYPES.PHASE_FAILED
  );

  // Check each phase_start from most recent to oldest
  for (let i = phaseStarts.length - 1; i >= 0; i--) {
    const start = phaseStarts[i];
    const hasComplete = phaseCompletes.some(c => c.phase === start.phase);

    if (!hasComplete) {
      return { phase: start.phase, started_at: start.timestamp };
    }
  }

  return null;
}

/**
 * Get most recent checkpoint
 */
function getLastCheckpoint(projectPath, phase) {
  const events = getHistory(projectPath);

  let checkpoints = events.filter(e => e.type === EVENT_TYPES.CHECKPOINT);

  // Filter by phase if specified
  if (phase !== undefined) {
    checkpoints = checkpoints.filter(e => e.phase === phase);
  }

  // Return most recent
  return checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
}

/**
 * Get aggregate execution statistics
 */
function getExecutionStats(projectPath) {
  const events = getHistory(projectPath);

  const phasesStarted = events.filter(e => e.type === EVENT_TYPES.PHASE_START).length;
  const phasesCompleted = events.filter(e => e.type === EVENT_TYPES.PHASE_COMPLETE).length;
  const phasesFailed = events.filter(e => e.type === EVENT_TYPES.PHASE_FAILED).length;
  const checkpointCount = events.filter(e => e.type === EVENT_TYPES.CHECKPOINT).length;

  // Calculate total duration
  let totalDurationMs = 0;
  const roadmapStarts = events.filter(e => e.type === EVENT_TYPES.ROADMAP_START);
  const roadmapCompletes = events.filter(e => e.type === EVENT_TYPES.ROADMAP_COMPLETE);

  if (roadmapStarts.length > 0 && roadmapCompletes.length > 0) {
    const firstStart = new Date(roadmapStarts[0].timestamp);
    const lastComplete = new Date(roadmapCompletes[roadmapCompletes.length - 1].timestamp);
    totalDurationMs = lastComplete - firstStart;
  }

  return {
    phases_completed: phasesCompleted,
    phases_failed: phasesFailed,
    total_duration_ms: totalDurationMs,
    checkpoint_count: checkpointCount
  };
}

/**
 * Detect if execution was interrupted
 */
function needsResume(projectPath) {
  const currentPhase = getCurrentPhase(projectPath);

  if (currentPhase) {
    const lastCheckpoint = getLastCheckpoint(projectPath, currentPhase.phase);
    return {
      needs_resume: true,
      interrupted_phase: currentPhase.phase,
      last_checkpoint: lastCheckpoint
    };
  }

  return { needs_resume: false };
}

/**
 * Build context for resumption
 */
function getResumeContext(projectPath) {
  const resumeInfo = needsResume(projectPath);

  if (!resumeInfo.needs_resume) {
    return null;
  }

  const phase = resumeInfo.interrupted_phase;
  const checkpoint = resumeInfo.last_checkpoint;

  // Get all events for this phase
  const timeline = getPhaseTimeline(projectPath, phase);

  // Determine next steps based on checkpoint
  let nextSteps = 'Resume execution from interrupted phase';
  if (checkpoint) {
    nextSteps = `Resume from checkpoint: ${checkpoint.checkpoint_id || 'unknown'}`;
  }

  return {
    phase,
    checkpoint,
    timeline,
    next_steps: nextSteps
  };
}

/**
 * Log resume event
 */
function markResumed(projectPath, phase) {
  const lastCheckpoint = getLastCheckpoint(projectPath, phase);

  appendEvent(projectPath, {
    type: EVENT_TYPES.RESUME,
    phase,
    previous_checkpoint: lastCheckpoint ? lastCheckpoint.checkpoint_id : null
  });

  return { success: true };
}

/**
 * Get all events for a specific phase
 */
function getPhaseTimeline(projectPath, phase) {
  const events = getHistory(projectPath);
  return events.filter(e => e.phase === phase);
}

module.exports = {
  EVENT_TYPES,
  initLog,
  appendEvent,
  getHistory,
  getCurrentPhase,
  getLastCheckpoint,
  getExecutionStats,
  needsResume,
  getResumeContext,
  markResumed,
  getPhaseTimeline
};
