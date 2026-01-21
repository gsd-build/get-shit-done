#!/usr/bin/env node
// Claude Code Statusline - GSD Enhanced Edition
// Shows: model | phase/plan | costs | usage | progress

const fs = require('fs');
const path = require('path');
const os = require('os');

// Read JSON from stdin
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const statusline = buildStatusline(data);
    if (statusline) {
      process.stdout.write(statusline);
    }
  } catch (e) {
    // Silent fail - don't break statusline on parse errors
  }
});

function buildStatusline(data) {
  const model = data.model?.display_name || 'Claude';
  const dir = data.workspace?.current_dir || process.cwd();
  const remaining = data.context_window?.remaining_percentage;

  // Load config and GSD state
  const gsdInfo = loadGSDInfo(dir);
  const config = gsdInfo.config || {};
  const statusConfig = config.statusline || {};

  // Determine level
  const level = statusConfig.level || 'standard';

  // Build parts based on level
  const parts = [];

  // GSD update notice (always first if available)
  const updateNotice = getUpdateNotice();
  if (updateNotice) parts.push(updateNotice);

  // Model (always show)
  parts.push(formatModel(model, config.model_profile));

  // Phase/Plan progress (standard+)
  if (level !== 'minimal' && gsdInfo.state) {
    const progress = formatProgress(gsdInfo.state, gsdInfo.roadmap, level === 'detailed');
    if (progress) parts.push(progress);
  }

  // Costs (if enabled)
  if (statusConfig.show_costs !== false && level !== 'minimal') {
    const costs = formatCosts(gsdInfo, level === 'detailed');
    if (costs) parts.push(costs);
  }

  // Model usage (if enabled and adaptive)
  if (statusConfig.show_model_usage && config.model_profile === 'adaptive') {
    const usage = formatModelUsage(gsdInfo);
    if (usage) parts.push(usage);
  }

  // Adaptive info (if enabled and adaptive)
  if (statusConfig.show_adaptive_info && config.model_profile === 'adaptive' && level !== 'minimal') {
    const adaptive = formatAdaptiveInfo(gsdInfo);
    if (adaptive) parts.push(adaptive);
  }

  // Rate limits (if enabled)
  if (statusConfig.show_rate_limits !== false && gsdInfo.rateLimitWarning) {
    parts.push(formatRateLimitWarning(gsdInfo.rateLimitWarning));
  }

  // Git state (if enabled)
  if (statusConfig.show_git_state && level === 'detailed') {
    const git = formatGitState(dir);
    if (git) parts.push(git);
  }

  // Tests (if enabled)
  if (statusConfig.show_tests && level === 'detailed') {
    const tests = formatTests(dir);
    if (tests) parts.push(tests);
  }

  // Active agents (if running)
  if (level !== 'minimal' && gsdInfo.activeAgents > 0) {
    parts.push(`\x1b[33m⚙ ${gsdInfo.activeAgents} agents\x1b[0m`);
  }

  // Checkpoint indicator
  if (gsdInfo.checkpoint) {
    parts.push(`\x1b[33m⏸ ${gsdInfo.checkpoint}\x1b[0m`);
  }

  // Time (if enabled)
  if (statusConfig.show_time && level === 'detailed') {
    const time = formatTime(gsdInfo);
    if (time) parts.push(time);
  }

  // Context window (always show, at end)
  const ctx = formatContextWindow(remaining);

  // Directory (minimal only)
  if (level === 'minimal') {
    const dirname = path.basename(dir);
    parts.push(`\x1b[2m${dirname}\x1b[0m`);
  }

  // Join parts
  return parts.join(' │ ') + ctx;
}

function loadGSDInfo(dir) {
  const info = {
    config: null,
    state: null,
    roadmap: null,
    usage: null,
    rateLimitWarning: null,
    activeAgents: 0,
    checkpoint: null
  };

  const planningDir = path.join(dir, '.planning');
  if (!fs.existsSync(planningDir)) return info;

  // Load config
  try {
    const configPath = path.join(planningDir, 'config.json');
    if (fs.existsSync(configPath)) {
      info.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {}

  // Load STATE.md
  try {
    const statePath = path.join(planningDir, 'STATE.md');
    if (fs.existsSync(statePath)) {
      info.state = parseStateMD(fs.readFileSync(statePath, 'utf8'));
    }
  } catch (e) {}

  // Load ROADMAP.md
  try {
    const roadmapPath = path.join(planningDir, 'ROADMAP.md');
    if (fs.existsSync(roadmapPath)) {
      info.roadmap = parseRoadmapMD(fs.readFileSync(roadmapPath, 'utf8'));
    }
  } catch (e) {}

  // Load usage.json
  try {
    const usagePath = path.join(planningDir, 'usage.json');
    if (fs.existsSync(usagePath)) {
      info.usage = JSON.parse(fs.readFileSync(usagePath, 'utf8'));
    }
  } catch (e) {}

  // Check for active agents (look for agent lock files or recent agent activity)
  try {
    const agentFiles = fs.readdirSync(planningDir).filter(f => f.endsWith('-agent.lock'));
    info.activeAgents = agentFiles.length;
  } catch (e) {}

  // Check rate limit status for team accounts
  if (info.config?.claude_plan_type === 'team') {
    // Could check recent rate limit events in usage.json
    if (info.usage?.recent_rate_limits) {
      const recentLimits = info.usage.recent_rate_limits.filter(rl => {
        const age = Date.now() - new Date(rl.timestamp).getTime();
        return age < 60 * 60 * 1000; // Within last hour
      });
      if (recentLimits.length >= 3) {
        info.rateLimitWarning = `${recentLimits.length} hits/hr`;
      }
    }
  }

  return info;
}

function parseStateMD(content) {
  const state = {
    phase: null,
    plan: null,
    status: null
  };

  // Extract current position
  const posMatch = content.match(/Current Position:.*?Phase (\d+).*?Plan (\d+)/s);
  if (posMatch) {
    state.phase = parseInt(posMatch[1]);
    state.plan = parseInt(posMatch[2]);
  }

  // Try alternate format
  if (!state.phase) {
    const phaseMatch = content.match(/Phase:\s*(\d+)/);
    const planMatch = content.match(/Plan:\s*(\d+)/);
    if (phaseMatch) state.phase = parseInt(phaseMatch[1]);
    if (planMatch) state.plan = parseInt(planMatch[1]);
  }

  return state.phase ? state : null;
}

function parseRoadmapMD(content) {
  const roadmap = {
    totalPhases: 0,
    completedPhases: 0,
    currentPhaseName: null,
    phases: []
  };

  // Count total phases
  const phaseMatches = content.match(/^##\s+Phase\s+\d+:/gm);
  if (phaseMatches) {
    roadmap.totalPhases = phaseMatches.length;
  }

  // Count completed phases (marked with ✓)
  const completedMatches = content.match(/^##\s+Phase\s+\d+:.*✓/gm);
  if (completedMatches) {
    roadmap.completedPhases = completedMatches.length;
  }

  // Get current phase name
  const currentMatch = content.match(/^##\s+Phase\s+\d+:\s+(.+?)(?:\s+\[|$)/m);
  if (currentMatch) {
    roadmap.currentPhaseName = currentMatch[1].trim();
  }

  return roadmap.totalPhases > 0 ? roadmap : null;
}

function formatModel(model, profile) {
  if (profile === 'adaptive') {
    return `\x1b[2mAdaptive\x1b[0m \x1b[2m(\x1b[0m${model}\x1b[2m) ✨\x1b[0m`;
  }
  return `\x1b[2m${model}\x1b[0m`;
}

function formatProgress(state, roadmap, detailed) {
  if (!state || !roadmap) return null;

  const phase = state.phase;
  const plan = state.plan || 1;
  const total = roadmap.totalPhases;
  const name = roadmap.currentPhaseName;

  if (detailed) {
    // Detailed: "P 3/8: Auth (2/3)"
    const shortName = name ? name.substring(0, 12) : '';
    return `\x1b[1mP ${phase}/${total}: ${shortName}\x1b[0m (${plan}/?)`;
  } else {
    // Standard: "Phase 3/8: Auth │ Plan 2/3"
    const shortName = name ? name.substring(0, 15) : '';
    return `\x1b[1mPhase ${phase}/${total}: ${shortName}\x1b[0m`;
  }
}

function formatCosts(gsdInfo, detailed) {
  const usage = gsdInfo.usage;
  if (!usage) return null;

  // Calculate costs from usage
  const costs = calculateCosts(usage);

  if (detailed) {
    // Detailed: "$2.43/$18.76"
    return `\x1b[32m$${costs.session.toFixed(2)}/$${costs.project.toFixed(2)}\x1b[0m`;
  } else {
    // Standard: "$2.43"
    return `\x1b[32m$${costs.session.toFixed(2)}\x1b[0m`;
  }
}

function formatModelUsage(gsdInfo) {
  const usage = gsdInfo.usage;
  if (!usage || !usage.sessions) return null;

  // Count model usage from recent session
  let haiku = 0, sonnet = 0, opus = 0;

  const recentSession = usage.sessions[usage.sessions.length - 1];
  if (recentSession && recentSession.tasks) {
    recentSession.tasks.forEach(t => {
      if (t.selected_model === 'haiku') haiku++;
      else if (t.selected_model === 'sonnet') sonnet++;
      else if (t.selected_model === 'opus') opus++;
    });
  }

  if (haiku + sonnet + opus === 0) return null;

  return `\x1b[2m${haiku}H ${sonnet}S ${opus}O\x1b[0m`;
}

function formatAdaptiveInfo(gsdInfo) {
  const usage = gsdInfo.usage;
  if (!usage || !usage.sessions) return null;

  const recentSession = usage.sessions[usage.sessions.length - 1];
  if (!recentSession || !recentSession.tasks || recentSession.tasks.length === 0) return null;

  const lastTask = recentSession.tasks[recentSession.tasks.length - 1];
  const model = lastTask.selected_model;
  const score = lastTask.complexity_score || 0;

  return `\x1b[2mLast: ${model} (${score}pts)\x1b[0m`;
}

function formatRateLimitWarning(warning) {
  return `\x1b[33m⚠️ ${warning}\x1b[0m`;
}

function formatGitState(dir) {
  try {
    const { execSync } = require('child_process');

    // Check uncommitted changes
    const status = execSync('git status --porcelain 2>/dev/null', { cwd: dir, encoding: 'utf8' });
    const hasChanges = status.trim().length > 0;

    // Check ahead/behind
    const aheadBehind = execSync('git rev-list --left-right --count @{u}...HEAD 2>/dev/null', { cwd: dir, encoding: 'utf8' });
    const [behind, ahead] = aheadBehind.trim().split('\t').map(n => parseInt(n));

    const parts = [];
    if (hasChanges) parts.push('*');
    if (ahead > 0) parts.push(`↑${ahead}`);
    if (behind > 0) parts.push(`↓${behind}`);

    return parts.length > 0 ? `\x1b[2m${parts.join(' ')}\x1b[0m` : null;
  } catch (e) {
    return null;
  }
}

function formatTests(dir) {
  // Look for common test result files or run status
  try {
    const { execSync } = require('child_process');
    // This is a placeholder - would need actual test runner integration
    // Could check for jest/vitest/pytest results, etc.
    return null;
  } catch (e) {
    return null;
  }
}

function formatTime(gsdInfo) {
  const usage = gsdInfo.usage;
  if (!usage || !usage.sessions) return null;

  const recentSession = usage.sessions[usage.sessions.length - 1];
  if (!recentSession || !recentSession.start_time) return null;

  const start = new Date(recentSession.start_time);
  const now = new Date();
  const minutes = Math.floor((now - start) / 60000);

  if (minutes < 60) {
    return `\x1b[2m${minutes}min\x1b[0m`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `\x1b[2m${hours}h ${mins}m\x1b[0m`;
  }
}

function formatContextWindow(remaining) {
  if (remaining == null) return '';

  const rem = Math.round(remaining);
  const used = Math.max(0, Math.min(100, 100 - rem));

  // Build progress bar (10 segments)
  const filled = Math.floor(used / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

  // Color based on usage
  if (used < 50) {
    return ` \x1b[32m${bar} ${used}%\x1b[0m`;
  } else if (used < 65) {
    return ` \x1b[33m${bar} ${used}%\x1b[0m`;
  } else if (used < 80) {
    return ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
  } else {
    return ` \x1b[5;31m💀 ${bar} ${used}%\x1b[0m`;
  }
}

function getUpdateNotice() {
  try {
    const homeDir = os.homedir();
    const cacheFile = path.join(homeDir, '.claude', 'cache', 'gsd-update-check.json');
    if (fs.existsSync(cacheFile)) {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cache.update_available) {
        return '\x1b[33m⬆ /gsd:update\x1b[0m';
      }
    }
  } catch (e) {}
  return null;
}

function calculateCosts(usage) {
  // Claude pricing (approximate, as of Jan 2026)
  const pricing = {
    haiku: { input: 0.25 / 1000000, output: 1.25 / 1000000 },
    sonnet: { input: 3 / 1000000, output: 15 / 1000000 },
    opus: { input: 15 / 1000000, output: 75 / 1000000 }
  };

  let sessionCost = 0;
  let projectCost = 0;

  // Calculate from sessions
  if (usage.sessions) {
    usage.sessions.forEach((session, idx) => {
      if (!session.tasks) return;

      const isCurrentSession = idx === usage.sessions.length - 1;

      session.tasks.forEach(task => {
        const model = task.selected_model || 'sonnet';
        const inputTokens = task.input_tokens || 20000; // Estimate if not tracked
        const outputTokens = task.output_tokens || 2000; // Estimate if not tracked

        const cost = (inputTokens * pricing[model].input) + (outputTokens * pricing[model].output);

        projectCost += cost;
        if (isCurrentSession) sessionCost += cost;
      });
    });
  }

  return {
    session: sessionCost,
    project: projectCost
  };
}
