#!/usr/bin/env node
// Usage Tracking - SessionStart Hook
// Initializes usage tracking session in .planning/usage.json

const fs = require('fs');
const path = require('path');

// Read JSON from stdin (standard hook pattern)
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Only run on startup (not resume)
    if (data.source !== 'startup') {
      process.exit(0);
    }

    const planningDir = path.join(process.cwd(), '.planning');
    const usagePath = path.join(planningDir, 'usage.json');

    // Only track if .planning exists (GSD project)
    if (!fs.existsSync(planningDir)) {
      process.exit(0);
    }

    // Load existing usage data or create new
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

    // Ensure recent_rate_limits array exists
    if (!Array.isArray(usage.recent_rate_limits)) {
      usage.recent_rate_limits = [];
    }

    // Start new session
    const session = {
      start_time: new Date().toISOString(),
      tasks: []
    };

    usage.sessions.push(session);

    // Limit to last 10 sessions to prevent file bloat
    if (usage.sessions.length > 10) {
      usage.sessions = usage.sessions.slice(-10);
    }

    // Clean up old rate limit events (older than 24 hours)
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    usage.recent_rate_limits = usage.recent_rate_limits.filter(rl => {
      const timestamp = new Date(rl.timestamp).getTime();
      return timestamp > dayAgo;
    });

    // Write updated usage
    fs.writeFileSync(usagePath, JSON.stringify(usage, null, 2));

    process.exit(0);
  } catch (error) {
    // Silent failure - never block Claude
    process.exit(0);
  }
});
