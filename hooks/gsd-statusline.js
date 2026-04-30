#!/usr/bin/env node
// gsd-hook-version: {{GSD_VERSION}}
// Claude Code Statusline - GSD Edition
// Shows: model | current task (or GSD state) | directory | context usage

const fs = require('fs');
const path = require('path');
const os = require('os');

// --- Config + last-command readers ------------------------------------------

/**
 * Walk up from dir looking for .planning/config.json and return its parsed contents.
 * Returns {} if not found or unreadable.
 */
function readGsdConfig(dir) {
  const home = os.homedir();
  let current = dir;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(current, '.planning', 'config.json');
    if (fs.existsSync(candidate)) {
      try {
        return JSON.parse(fs.readFileSync(candidate, 'utf8')) || {};
      } catch (e) {
        return {};
      }
    }
    const parent = path.dirname(current);
    if (parent === current || current === home) break;
    current = parent;
  }
  return {};
}

/**
 * Lookup a dotted key path (e.g. 'statusline.show_last_command') in a config
 * object that may use either nested or flat keys.
 */
function getConfigValue(cfg, keyPath) {
  if (!cfg || typeof cfg !== 'object') return undefined;
  if (keyPath in cfg) return cfg[keyPath];
  const parts = keyPath.split('.');
  let cur = cfg;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * Extract the most recently invoked slash command from a Claude Code JSONL
 * transcript file. Returns the command name (no leading slash) or null.
 *
 * Claude Code embeds slash invocations in user messages as
 *   <command-name>/foo</command-name>
 * We scan lines from the end of the file, stopping at the first match.
 */
function readLastSlashCommand(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return null;
  let content;
  try {
    if (!fs.existsSync(transcriptPath)) return null;
    // Read only the tail — typical transcripts grow large. 256 KiB comfortably
    // covers dozens of recent turns while staying cheap per render.
    const stat = fs.statSync(transcriptPath);
    const MAX = 256 * 1024;
    const start = Math.max(0, stat.size - MAX);
    const fd = fs.openSync(transcriptPath, 'r');
    try {
      const buf = Buffer.alloc(stat.size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      content = buf.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch (e) {
    return null;
  }
  // Find the LAST occurrence — scan right-to-left via lastIndexOf on the tag.
  const tagClose = '</command-name>';
  const idx = content.lastIndexOf(tagClose);
  if (idx < 0) return null;
  const openTag = '<command-name>';
  const openIdx = content.lastIndexOf(openTag, idx);
  if (openIdx < 0) return null;
  let name = content.slice(openIdx + openTag.length, idx).trim();
  // Strip a leading slash if present, and any trailing arguments-on-same-line noise.
  if (name.startsWith('/')) name = name.slice(1);
  // Command names in Claude Code transcripts are plain identifiers like "gsd-plan-phase"
  // or namespaced like "plugin:skill". Reject anything with whitespace/newlines/control chars.
  if (!name || /[\s\\"<>]/.test(name) || name.length > 80) return null;
  return name;
}

// --- GSD state reader -------------------------------------------------------

/**
 * Walk up from dir looking for .planning/STATE.md.
 * Returns parsed state object or null.
 */
function readGsdState(dir) {
  const home = os.homedir();
  let current = dir;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(current, '.planning', 'STATE.md');
    if (fs.existsSync(candidate)) {
      try {
        return parseStateMd(fs.readFileSync(candidate, 'utf8'));
      } catch (e) {
        return null;
      }
    }
    const parent = path.dirname(current);
    if (parent === current || current === home) break;
    current = parent;
  }
  return null;
}

/**
 * Parse STATE.md frontmatter + Phase line from body.
 *
 * Returns:
 *   { status, milestone, milestoneName, phaseNum, phaseTotal, phaseName,
 *     activePhase, nextAction, nextPhases, completedPhases, totalPhases, percent }
 *
 * Phase-lifecycle fields (issue #2833):
 *   - activePhase  : phase number ("4.5") when an orchestrator is mid-flight, null otherwise
 *   - nextAction   : recommended next command ("execute-phase") when idle, null otherwise
 *   - nextPhases   : array of phase numbers (["4.5"]) for nextAction, null otherwise
 *   - completedPhases / totalPhases / percent : milestone progress dimension
 *
 * All new fields default to undefined when absent — formatGsdState() degrades
 * gracefully so existing STATE.md files (without these fields) keep working.
 */
function parseStateMd(content) {
  const state = {};

  // YAML frontmatter between --- markers (anchored at file start)
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    // Top-level scalar key: value
    for (const line of fm.split('\n')) {
      const m = line.match(/^(\w+):\s*(.+)/);
      if (!m) continue;
      const [, key, val] = m;
      const v = val.trim().replace(/^["']|["']$/g, '');
      // status / milestone-level fields (existing — preserved exactly)
      if (key === 'status') state.status = v === 'null' ? null : v;
      if (key === 'milestone') state.milestone = v === 'null' ? null : v;
      if (key === 'milestone_name') state.milestoneName = v === 'null' ? null : v;
      // Phase-lifecycle fields (new in issue #2833)
      // active_phase: phase number when an orchestrator is in-flight, null when idle
      if (key === 'active_phase') state.activePhase = (v === 'null' || v === '') ? null : v;
      // next_action: recommended command when idle (discuss-phase / plan-phase / execute-phase / verify-phase)
      if (key === 'next_action') state.nextAction = (v === 'null' || v === '') ? null : v;
    }
    // next_phases YAML flow array: ["4.5", "4.6"] — single-line flow only
    // Block sequences (- 4.5 / - 4.6 over multiple lines) are intentionally
    // not parsed here; statusline only needs the primary recommendation.
    const npMatch = fm.match(/^next_phases:\s*\[([^\]]*)\]/m);
    if (npMatch) {
      const items = npMatch[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      state.nextPhases = items.length > 0 ? items : null;
    }
    // progress nested block: completed_phases / total_phases / percent (2-space indent)
    const progMatch = fm.match(/^progress:\s*\n((?:[ \t]+\w+:.+\n?)+)/m);
    if (progMatch) {
      const cp = progMatch[1].match(/^[ \t]+completed_phases:\s*(\d+)/m);
      const tp = progMatch[1].match(/^[ \t]+total_phases:\s*(\d+)/m);
      const pc = progMatch[1].match(/^[ \t]+percent:\s*(\d+)/m);
      if (cp) state.completedPhases = cp[1];
      if (tp) state.totalPhases = tp[1];
      if (pc) state.percent = pc[1];
    }
  }

  // Phase: N of M (name)  or  Phase: none active (...)
  const phaseMatch = content.match(/^Phase:\s*(\d+)\s+of\s+(\d+)(?:\s+\(([^)]+)\))?/m);
  if (phaseMatch) {
    state.phaseNum = phaseMatch[1];
    state.phaseTotal = phaseMatch[2];
    state.phaseName = phaseMatch[3] || null;
  }

  // Fallback: parse Status: from body when frontmatter is absent
  if (!state.status) {
    const bodyStatus = content.match(/^Status:\s*(.+)/m);
    if (bodyStatus) {
      const raw = bodyStatus[1].trim().toLowerCase();
      if (raw.includes('ready to plan') || raw.includes('planning')) state.status = 'planning';
      else if (raw.includes('execut')) state.status = 'executing';
      else if (raw.includes('complet') || raw.includes('archived')) state.status = 'complete';
    }
  }

  return state;
}

/**
 * Render a 10-segment milestone progress bar (matches the context meter style).
 *
 * @param {number|string|null|undefined} percent — 0-100; missing/NaN returns ''
 * @returns {string} '[█████░░░░░] 50%' or '' (so callers can `[bar].filter(Boolean)`)
 */
function renderProgressBar(percent) {
  if (percent == null || isNaN(percent)) return '';
  const pct = Math.max(0, Math.min(100, parseInt(percent, 10)));
  const filled = Math.floor(pct / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return `[${bar}] ${pct}%`;
}

/**
 * Format GSD state into display string.
 *
 * Backward-compatible default (no new fields populated):
 *   "v1.9 Code Quality · executing · fix-graphiti-deployment (1/5)"
 *
 * Phase-lifecycle scenes (issue #2833 — activate when STATE.md frontmatter
 * carries the new fields; otherwise rendering falls through to the default):
 *
 *   active_phase set                       → "v2.0 [██░] X% · Phase 4.5 executing"
 *   active_phase null + next_action set    → "v2.0 [██░] X% · next execute-phase 4.5"
 *   percent=100 (milestone done)           → "v2.0 [██████████] 100% · milestone complete"
 *   none of the above                      → existing "<status> · <phase>" path
 *
 * Progress bar is opt-in: appended to the milestone segment only when
 * progress.percent is present in frontmatter; absent → empty string.
 */
function formatGsdState(s) {
  const parts = [];

  // Milestone segment: version + name + (opt-in) progress bar
  if (s.milestone || s.milestoneName) {
    const ver = s.milestone || '';
    const name = (s.milestoneName && s.milestoneName !== 'milestone') ? s.milestoneName : '';
    const bar = renderProgressBar(s.percent);
    const pieces = [ver, name, bar].filter(Boolean);
    if (pieces.length > 0) parts.push(pieces.join(' '));
  }

  // Phase-lifecycle scenes (issue #2833) — first match wins; falls through to
  // the original "<status> · <phase>" path when none of the new fields apply.
  const phasesStr = (s.nextPhases && s.nextPhases.length > 0) ? s.nextPhases.join('/') : null;

  if (s.activePhase) {
    // Scene 1: an orchestrator is mid-flight on this phase.
    // stage = whichever lifecycle status was written by the orchestrator
    //   (discussing / planning / executing / verifying)
    const stage = s.status || '';
    parts.push(stage ? `Phase ${s.activePhase} ${stage}` : `Phase ${s.activePhase}`);
  } else if (s.nextAction && phasesStr) {
    // Scene 2: idle + a recommended next command is visible to the user.
    // Surfaces "what to run next" without the user opening STATE.md.
    parts.push(`next ${s.nextAction} ${phasesStr}`);
  } else if (s.percent === '100' || (s.completedPhases && s.totalPhases && s.completedPhases === s.totalPhases)) {
    // Scene 3: milestone complete (every phase done).
    parts.push('milestone complete');
  } else {
    // Backward-compatible default — preserved EXACTLY for STATE.md files that
    // don't carry the new lifecycle fields. Identical output to v1.38.x and
    // earlier so no existing project's status-line changes shape.
    if (s.status) parts.push(s.status);
    if (s.phaseNum && s.phaseTotal) {
      const phase = s.phaseName
        ? `${s.phaseName} (${s.phaseNum}/${s.phaseTotal})`
        : `ph ${s.phaseNum}/${s.phaseTotal}`;
      parts.push(phase);
    }
  }

  return parts.join(' · ');
}

// --- stdin ------------------------------------------------------------------

function runStatusline() {
  let input = '';
  // Timeout guard: if stdin doesn't close within 3s (e.g. pipe issues on
  // Windows/Git Bash), exit silently instead of hanging. See #775.
  const stdinTimeout = setTimeout(() => process.exit(0), 3000);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const model = data.model?.display_name || 'Claude';
    const dir = data.workspace?.current_dir || process.cwd();
    const session = data.session_id || '';
    const remaining = data.context_window?.remaining_percentage;

    // Context window display (shows USED percentage scaled to usable context)
    // Claude Code reserves a buffer for autocompact. By default this is ~16.5%
    // of the total window, but users can override it via CLAUDE_CODE_AUTO_COMPACT_WINDOW
    // (a token count). When the env var is set, compute the buffer % dynamically so
    // the meter correctly reflects early-compaction configurations (#2219).
    const totalCtx = data.context_window?.total_tokens || 1_000_000;
    const acw = parseInt(process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW || '0', 10);
    const AUTO_COMPACT_BUFFER_PCT = acw > 0
      ? Math.min(100, (acw / totalCtx) * 100)
      : 16.5;
    let ctx = '';
    if (remaining != null) {
      // Normalize: subtract buffer from remaining, scale to usable range
      const usableRemaining = Math.max(0, ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100);
      const used = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));

      // Write context metrics to bridge file for the context-monitor PostToolUse hook.
      // The monitor reads this file to inject agent-facing warnings when context is low.
      // Reject session IDs with path separators or traversal sequences to prevent
      // a malicious session_id from writing files outside the temp directory.
      const sessionSafe = session && !/[/\\]|\.\./.test(session);
      if (sessionSafe) {
        try {
          const bridgePath = path.join(os.tmpdir(), `claude-ctx-${session}.json`);
          // used_pct written to the bridge must match CC's native /context reporting:
          // raw used = 100 - remaining_percentage (no buffer normalization applied).
          // The normalized `used` value is correct for the statusline progress bar but
          // inflates the context monitor warning messages by ~13 points (#2451).
          const rawUsedPct = Math.round(100 - remaining);
          const bridgeData = JSON.stringify({
            session_id: session,
            remaining_percentage: remaining,
            used_pct: rawUsedPct,
            timestamp: Math.floor(Date.now() / 1000)
          });
          fs.writeFileSync(bridgePath, bridgeData);
        } catch (e) {
          // Silent fail -- bridge is best-effort, don't break statusline
        }
      }

      // Build progress bar (10 segments)
      const filled = Math.floor(used / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

      // Color based on usable context thresholds
      if (used < 50) {
        ctx = ` \x1b[32m${bar} ${used}%\x1b[0m`;
      } else if (used < 65) {
        ctx = ` \x1b[33m${bar} ${used}%\x1b[0m`;
      } else if (used < 80) {
        ctx = ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      } else {
        ctx = ` \x1b[5;31m💀 ${bar} ${used}%\x1b[0m`;
      }
    }

    // Current task from todos
    let task = '';
    const homeDir = os.homedir();
    // Respect CLAUDE_CONFIG_DIR for custom config directory setups (#870)
    const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(homeDir, '.claude');
    const todosDir = path.join(claudeDir, 'todos');
    if (session && fs.existsSync(todosDir)) {
      try {
        const files = fs.readdirSync(todosDir)
          .filter(f => f.startsWith(session) && f.includes('-agent-') && f.endsWith('.json'))
          .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
          .sort((a, b) => b.mtime - a.mtime);

        if (files.length > 0) {
          try {
            const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
            const inProgress = todos.find(t => t.status === 'in_progress');
            if (inProgress) task = inProgress.activeForm || '';
          } catch (e) {}
        }
      } catch (e) {
        // Silently fail on file system errors - don't break statusline
      }
    }

    // GSD state (milestone · status · phase) — shown when no todo task
    const gsdStateStr = task ? '' : formatGsdState(readGsdState(dir) || {});

    // GSD update available?
    // Check shared cache first (#1421), fall back to runtime-specific cache for
    // backward compatibility with older gsd-check-update.js versions.
    let gsdUpdate = '';
    const sharedCacheFile = path.join(homeDir, '.cache', 'gsd', 'gsd-update-check.json');
    const legacyCacheFile = path.join(claudeDir, 'cache', 'gsd-update-check.json');
    const cacheFile = fs.existsSync(sharedCacheFile) ? sharedCacheFile : legacyCacheFile;
    if (fs.existsSync(cacheFile)) {
      try {
        const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (cache.update_available) {
          gsdUpdate = '\x1b[33m⬆ /gsd-update\x1b[0m │ ';
        }
        if (cache.stale_hooks && cache.stale_hooks.length > 0) {
          // If installed version is ahead of npm latest, this is a dev install.
          // Running /gsd-update would downgrade — show a contextual warning instead.
          const isDevInstall = (() => {
            if (!cache.installed || !cache.latest || cache.latest === 'unknown') return false;
            const parseV = v => v.replace(/^v/, '').split('.').map(Number);
            const [ai, bi, ci] = parseV(cache.installed);
            const [an, bn, cn] = parseV(cache.latest);
            return ai > an || (ai === an && bi > bn) || (ai === an && bi === bn && ci > cn);
          })();
          if (isDevInstall) {
            gsdUpdate += '\x1b[33m⚠ dev install — re-run installer to sync hooks\x1b[0m │ ';
          } else {
            gsdUpdate += '\x1b[31m⚠ stale hooks — run /gsd-update\x1b[0m │ ';
          }
        }
      } catch (e) {}
    }

    // Last-slash-command suffix (opt-in via statusline.show_last_command, #2538).
    // Reads the active session transcript for the most recent <command-name> tag.
    // Failure here must never break the statusline — wrap the entire lookup.
    let lastCmdSuffix = '';
    try {
      const cfg = readGsdConfig(dir);
      if (getConfigValue(cfg, 'statusline.show_last_command') === true) {
        const transcriptPath = data.transcript_path;
        const lastCmd = readLastSlashCommand(transcriptPath);
        if (lastCmd) {
          lastCmdSuffix = ` │ \x1b[2mlast: /${lastCmd}\x1b[0m`;
        }
      }
    } catch (e) {
      // Never break the statusline on config/transcript errors
    }

    // Output
    const dirname = path.basename(dir);
    const middle = task
      ? `\x1b[1m${task}\x1b[0m`
      : gsdStateStr
        ? `\x1b[2m${gsdStateStr}\x1b[0m`
        : null;

    if (middle) {
      process.stdout.write(`${gsdUpdate}\x1b[2m${model}\x1b[0m │ ${middle} │ \x1b[2m${dirname}\x1b[0m${ctx}${lastCmdSuffix}`);
    } else {
      process.stdout.write(`${gsdUpdate}\x1b[2m${model}\x1b[0m │ \x1b[2m${dirname}\x1b[0m${ctx}${lastCmdSuffix}`);
    }
  } catch (e) {
    // Silent fail - don't break statusline on parse errors
  }
});
}

// Export helpers for unit tests. Harmless when run as a script.
module.exports = {
  readGsdState, parseStateMd, formatGsdState,
  readGsdConfig, getConfigValue, readLastSlashCommand,
};

/**
 * Render the statusline from an already-parsed hook input object. Exported for
 * testing without feeding stdin. Returns the rendered string.
 */
function renderStatusline(data) {
  const model = data.model?.display_name || 'Claude';
  const dir = data.workspace?.current_dir || process.cwd();
  const dirname = path.basename(dir);

  let lastCmdSuffix = '';
  try {
    const cfg = readGsdConfig(dir);
    if (getConfigValue(cfg, 'statusline.show_last_command') === true) {
      const lastCmd = readLastSlashCommand(data.transcript_path);
      if (lastCmd) {
        lastCmdSuffix = ` │ \x1b[2mlast: /${lastCmd}\x1b[0m`;
      }
    }
  } catch (e) { /* swallow */ }

  const gsdStateStr = formatGsdState(readGsdState(dir) || {});
  const middle = gsdStateStr ? `\x1b[2m${gsdStateStr}\x1b[0m` : null;
  if (middle) {
    return `\x1b[2m${model}\x1b[0m │ ${middle} │ \x1b[2m${dirname}\x1b[0m${lastCmdSuffix}`;
  }
  return `\x1b[2m${model}\x1b[0m │ \x1b[2m${dirname}\x1b[0m${lastCmdSuffix}`;
}

module.exports.renderStatusline = renderStatusline;

if (require.main === module) runStatusline();
