#!/usr/bin/env node
// Usage Tracking - Task Logger
// Logs task completion to .planning/usage.json
//
// Usage:
//   node hooks/gsd-usage-log.js <task_id> <model> [complexity_score] [input_tokens] [output_tokens]
//
// Example:
//   node hooks/gsd-usage-log.js "phase-3-plan-1" "sonnet" 5 20000 2000

const fs = require('fs');
const path = require('path');

function logTask(taskId, model, complexityScore, inputTokens, outputTokens) {
  const planningDir = path.join(process.cwd(), '.planning');
  const usagePath = path.join(planningDir, 'usage.json');

  // Only track if .planning exists (GSD project)
  if (!fs.existsSync(planningDir)) {
    return;
  }

  // Load existing usage data
  let usage = {
    sessions: [],
    recent_rate_limits: []
  };

  if (fs.existsSync(usagePath)) {
    try {
      usage = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
    } catch (e) {
      // Invalid JSON, start fresh
    }
  }

  // Ensure sessions array exists
  if (!Array.isArray(usage.sessions)) {
    usage.sessions = [];
  }

  // Get current session (last one)
  let session = usage.sessions[usage.sessions.length - 1];

  // Create session if none exists
  if (!session) {
    session = {
      start_time: new Date().toISOString(),
      tasks: []
    };
    usage.sessions.push(session);
  }

  // Ensure tasks array exists
  if (!Array.isArray(session.tasks)) {
    session.tasks = [];
  }

  // Add task
  const task = {
    timestamp: new Date().toISOString(),
    task_id: taskId,
    selected_model: model
  };

  // Add optional fields
  if (complexityScore !== undefined && complexityScore !== null) {
    task.complexity_score = parseInt(complexityScore);
  }

  if (inputTokens !== undefined && inputTokens !== null) {
    task.input_tokens = parseInt(inputTokens);
  }

  if (outputTokens !== undefined && outputTokens !== null) {
    task.output_tokens = parseInt(outputTokens);
  }

  session.tasks.push(task);

  // Write updated usage
  fs.writeFileSync(usagePath, JSON.stringify(usage, null, 2));
}

// Handle rate limit logging (alternate usage mode)
function logRateLimit(errorMessage) {
  const planningDir = path.join(process.cwd(), '.planning');
  const usagePath = path.join(planningDir, 'usage.json');

  if (!fs.existsSync(planningDir)) {
    return;
  }

  let usage = {
    sessions: [],
    recent_rate_limits: []
  };

  if (fs.existsSync(usagePath)) {
    try {
      usage = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
    } catch (e) {
      // Invalid JSON, start fresh
    }
  }

  if (!Array.isArray(usage.recent_rate_limits)) {
    usage.recent_rate_limits = [];
  }

  usage.recent_rate_limits.push({
    timestamp: new Date().toISOString(),
    error: errorMessage
  });

  // Keep only last 50 rate limit events
  if (usage.recent_rate_limits.length > 50) {
    usage.recent_rate_limits = usage.recent_rate_limits.slice(-50);
  }

  fs.writeFileSync(usagePath, JSON.stringify(usage, null, 2));
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: gsd-usage-log <task_id> <model> [complexity_score] [input_tokens] [output_tokens]');
  console.error('   or: gsd-usage-log --rate-limit "<error_message>"');
  process.exit(1);
}

try {
  // Handle rate limit logging
  if (args[0] === '--rate-limit') {
    const errorMessage = args[1] || 'Rate limit exceeded';
    logRateLimit(errorMessage);
    process.exit(0);
  }

  // Handle task logging
  const taskId = args[0];
  const model = args[1];
  const complexityScore = args[2];
  const inputTokens = args[3];
  const outputTokens = args[4];

  if (!taskId || !model) {
    console.error('task_id and model are required');
    process.exit(1);
  }

  logTask(taskId, model, complexityScore, inputTokens, outputTokens);
  process.exit(0);
} catch (error) {
  // Silent failure
  process.exit(0);
}
