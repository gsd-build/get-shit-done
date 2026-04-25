/**
 * Core — Shared utilities, constants, and internal helpers
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execSync, execFileSync, spawnSync } = require('child_process');
const { MODEL_PROFILES } = require('./model-profiles.cjs');

const WORKSTREAM_SESSION_ENV_KEYS = [
  'GSD_SESSION_KEY',
  'CODEX_THREAD_ID',
  'CLAUDE_SESSION_ID',
  'CLAUDE_CODE_SSE_PORT',
  'OPENCODE_SESSION_ID',
  'GEMINI_SESSION_ID',
  'CURSOR_SESSION_ID',
  'WINDSURF_SESSION_ID',
  'TERM_SESSION_ID',
  'WT_SESSION',
  'TMUX_PANE',
  'ZELLIJ_SESSION_NAME',
];

let cachedControllingTtyToken = null;
let didProbeControllingTtyToken = false;

// Track all .planning/.lock files held by this process so they can be removed
// on exit. process.on('exit') fires even on process.exit(1), unlike try/finally
// which is skipped when error() calls process.exit(1) inside a locked region (#1916).
const _heldPlanningLocks = new Set();
process.on('exit', () => {
  for (const lockPath of _heldPlanningLocks) {
    try { fs.unlinkSync(lockPath); } catch { /* already gone */ }
  }
});

// ─── Path helpers ────────────────────────────────────────────────────────────

/** Normalize a relative path to always use forward slashes (cross-platform). */
function toPosixPath(p) {
  return p.split(path.sep).join('/');
}

/**
 * Scan immediate child directories for separate git repos.
 * Returns a sorted array of directory names that have their own `.git`.
 * Excludes hidden directories and node_modules.
 */
function detectSubRepos(cwd) {
  const results = [];
  try {
    const entries = fs.readdirSync(cwd, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const gitPath = path.join(cwd, entry.name, '.git');
      try {
        if (fs.existsSync(gitPath)) {
          results.push(entry.name);
        }
      } catch {}
    }
  } catch {}
  return results.sort();
}

/**
 * Walk up from `startDir` to find the project root that owns `.planning/`.
 *
 * In multi-repo workspaces, Claude may open inside a sub-repo (e.g. `backend/`)
 * instead of the project root. This function prevents `.planning/` from being
 * created inside the sub-repo by locating the nearest ancestor that already has
 * a `.planning/` directory.
 *
 * Detection strategy (checked in order for each ancestor):
 * 1. Parent has `.planning/config.json` with `sub_repos` listing this directory
 * 2. Parent has `.planning/config.json` with `multiRepo: true` (legacy format)
 * 3. Parent has `.planning/` and current dir has its own `.git` (heuristic)
 *
 * Returns `startDir` unchanged when no ancestor `.planning/` is found (first-run
 * or single-repo projects).
 */
function findProjectRoot(startDir) {
  const resolved = path.resolve(startDir);
  const root = path.parse(resolved).root;
  const homedir = require('os').homedir();

  // If startDir already contains .planning/, it IS the project root.
  // Do not walk up to a parent workspace that also has .planning/ (#1362).
  const ownPlanning = path.join(resolved, '.planning');
  if (fs.existsSync(ownPlanning) && fs.statSync(ownPlanning).isDirectory()) {
    return startDir;
  }

  // Check if startDir or any of its ancestors (up to AND including the
  // candidate project root) contains a .git directory. This handles both
  // `backend/` (direct sub-repo) and `backend/src/modules/` (nested inside),
  // as well as the common case where .git lives at the same level as .planning/.
  function isInsideGitRepo(candidateParent) {
    let d = resolved;
    while (d !== root) {
      if (fs.existsSync(path.join(d, '.git'))) return true;
      if (d === candidateParent) break;
      d = path.dirname(d);
    }
    return false;
  }

  let dir = resolved;
  while (dir !== root) {
    const parent = path.dirname(dir);
    if (parent === dir) break; // filesystem root
    if (parent === homedir) break; // never go above home

    const parentPlanning = path.join(parent, '.planning');
    if (fs.existsSync(parentPlanning) && fs.statSync(parentPlanning).isDirectory()) {
      const configPath = path.join(parentPlanning, 'config.json');
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const subRepos = config.sub_repos || config.planning?.sub_repos || [];

        // Check explicit sub_repos list
        if (Array.isArray(subRepos) && subRepos.length > 0) {
          const relPath = path.relative(parent, resolved);
          const topSegment = relPath.split(path.sep)[0];
          if (subRepos.includes(topSegment)) {
            return parent;
          }
        }

        // Check legacy multiRepo flag
        if (config.multiRepo === true && isInsideGitRepo(parent)) {
          return parent;
        }
      } catch {
        // config.json missing or malformed — fall back to .git heuristic
      }

      // Heuristic: parent has .planning/ and we're inside a git repo
      if (isInsideGitRepo(parent)) {
        return parent;
      }
    }
    dir = parent;
  }
  return startDir;
}

// ─── Output helpers ───────────────────────────────────────────────────────────

/**
 * Remove stale gsd-* temp files/dirs older than maxAgeMs (default: 5 minutes).
 * Runs opportunistically before each new temp file write to prevent unbounded accumulation.
 * @param {string} prefix - filename prefix to match (e.g., 'gsd-')
 * @param {object} opts
 * @param {number} opts.maxAgeMs - max age in ms before removal (default: 5 min)
 * @param {boolean} opts.dirsOnly - if true, only remove directories (default: false)
 */
/**
 * Dedicated GSD temp directory: path.join(os.tmpdir(), 'gsd').
 * Created on first use. Keeps GSD temp files isolated from the system
 * temp directory so reap scans only GSD files (#1975).
 */
const GSD_TEMP_DIR = path.join(require('os').tmpdir(), 'gsd');

function ensureGsdTempDir() {
  fs.mkdirSync(GSD_TEMP_DIR, { recursive: true });
}

function reapStaleTempFiles(prefix = 'gsd-', { maxAgeMs = 5 * 60 * 1000, dirsOnly = false } = {}) {
  try {
    ensureGsdTempDir();
    const now = Date.now();
    const entries = fs.readdirSync(GSD_TEMP_DIR);
    for (const entry of entries) {
      if (!entry.startsWith(prefix)) continue;
      const fullPath = path.join(GSD_TEMP_DIR, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (now - stat.mtimeMs > maxAgeMs) {
          if (stat.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else if (!dirsOnly) {
            fs.unlinkSync(fullPath);
          }
        }
      } catch {
        // File may have been removed between readdir and stat — ignore
      }
    }
  } catch {
    // Non-critical — don't let cleanup failures break output
  }
}

function output(result, raw, rawValue) {
  let data;
  if (raw && rawValue !== undefined) {
    data = String(rawValue);
  } else {
    const json = JSON.stringify(result, null, 2);
    // Large payloads exceed Claude Code's Bash tool buffer (~50KB).
    // Write to tmpfile and output the path prefixed with @file: so callers can detect it.
    if (json.length > 50000) {
      reapStaleTempFiles();
      ensureGsdTempDir();
      const tmpPath = path.join(GSD_TEMP_DIR, `gsd-${Date.now()}.json`);
      fs.writeFileSync(tmpPath, json, 'utf-8');
      data = '@file:' + tmpPath;
    } else {
      data = json;
    }
  }
  // process.stdout.write() is async when stdout is a pipe — process.exit()
  // can tear down the process before the reader consumes the buffer.
  // fs.writeSync(1, ...) blocks until the kernel accepts the bytes, and
  // skipping process.exit() lets the event loop drain naturally.
  fs.writeSync(1, data);
}

function error(message) {
  fs.writeSync(2, 'Error: ' + message + '\n');
  process.exit(1);
}

// ─── File & Config utilities ──────────────────────────────────────────────────

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Canonical config defaults. Single source of truth — imported by config.cjs and verify.cjs.
 */
const CONFIG_DEFAULTS = {
  model_profile: 'balanced',
  commit_docs: true,
  search_gitignored: false,
  branching_strategy: 'none',
  phase_branch_template: 'gsd/phase-{phase}-{slug}',
  milestone_branch_template: 'gsd/{milestone}-{slug}',
  quick_branch_template: null,
  research: true,
  plan_checker: true,
  verifier: true,
  nyquist_validation: true,
  ai_integration_phase: true,
  parallelization: true,
  brave_search: false,
  firecrawl: false,
  exa_search: false,
  text_mode: false, // when true, use plain-text numbered lists instead of AskUserQuestion menus
  sub_repos: [],
  resolve_model_ids: false, // false: return alias as-is | true: map to full Claude model ID | "omit": return '' (runtime uses its default)
  context_window: 200000, // default 200k; set to 1000000 for Opus/Sonnet 4.6 1M models
  phase_naming: 'sequential', // 'sequential' (default, auto-increment) or 'custom' (arbitrary string IDs)
  project_code: null, // optional short prefix for phase dirs (e.g., 'CK' → 'CK-01-foundation')
  subagent_timeout: 300000, // 5 min default; increase for large codebases or slower models (ms)
  security_enforcement: true, // workflow.security_enforcement — threat-model-anchored security verification via /gsd-secure-phase
  security_asvs_level: 1, // workflow.security_asvs_level — OWASP ASVS verification level (1=opportunistic, 2=standard, 3=comprehensive)
  security_block_on: 'high', // workflow.security_block_on — minimum severity that blocks phase advancement ('high' | 'medium' | 'low')
  post_planning_gaps: true, // workflow.post_planning_gaps — unified post-planning gap report (#2493): scan REQUIREMENTS.md + CONTEXT.md decisions vs all PLAN.md files
};

function loadConfig(cwd) {
  const configPath = path.join(planningDir(cwd), 'config.json');
  const defaults = CONFIG_DEFAULTS;

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);

    // Migrate deprecated "depth" key to "granularity" with value mapping
    if ('depth' in parsed && !('granularity' in parsed)) {
      const depthToGranularity = { quick: 'coarse', standard: 'standard', comprehensive: 'fine' };
      parsed.granularity = depthToGranularity[parsed.depth] || parsed.depth;
      delete parsed.depth;
      try { fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8'); } catch { /* intentionally empty */ }
    }

    // Auto-detect and sync sub_repos: scan for child directories with .git
    let configDirty = false;

    // Migrate legacy "multiRepo: true" boolean → planning.sub_repos array.
    // Canonical location is planning.sub_repos (#2561); writing to top-level
    // would be flagged as unknown by the validator below (#2638).
    if (parsed.multiRepo === true && !parsed.sub_repos && !parsed.planning?.sub_repos) {
      const detected = detectSubRepos(cwd);
      if (detected.length > 0) {
        if (!parsed.planning) parsed.planning = {};
        parsed.planning.sub_repos = detected;
        parsed.planning.commit_docs = false;
        delete parsed.multiRepo;
        configDirty = true;
      }
    }

    // Self-heal legacy/buggy installs: strip any stale top-level sub_repos,
    // preserving its value as the planning.sub_repos seed if that slot is empty.
    if (Object.prototype.hasOwnProperty.call(parsed, 'sub_repos')) {
      if (!parsed.planning) parsed.planning = {};
      if (!parsed.planning.sub_repos) {
        parsed.planning.sub_repos = parsed.sub_repos;
      }
      delete parsed.sub_repos;
      configDirty = true;
    }

    // Keep planning.sub_repos in sync with actual filesystem
    const currentSubRepos = parsed.planning?.sub_repos || [];
    if (Array.isArray(currentSubRepos) && currentSubRepos.length > 0) {
      const detected = detectSubRepos(cwd);
      if (detected.length > 0) {
        const sorted = [...currentSubRepos].sort();
        if (JSON.stringify(sorted) !== JSON.stringify(detected)) {
          if (!parsed.planning) parsed.planning = {};
          parsed.planning.sub_repos = detected;
          configDirty = true;
        }
      }
    }

    // Persist sub_repos changes (migration or sync)
    if (configDirty) {
      try { fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf-8'); } catch {}
    }

    // Warn about unrecognized top-level keys so users don't silently lose config.
    // Derived from config-set's VALID_CONFIG_KEYS (canonical source) plus internal-only
    // keys that loadConfig handles but config-set doesn't expose. This avoids maintaining
    // a hardcoded duplicate that drifts when new config keys are added.
    // DYNAMIC_KEY_PATTERNS supplies topLevel for each pattern so adding a new
    // dynamic-pattern namespace to config-schema.cjs automatically updates this set
    // — no more drift between the read side and the write side (#2687).
    const { VALID_CONFIG_KEYS, DYNAMIC_KEY_PATTERNS } = require('./config-schema.cjs');
    const KNOWN_TOP_LEVEL = new Set([
      // Extract top-level key names from dot-notation paths (e.g., 'workflow.research' → 'workflow')
      ...[...VALID_CONFIG_KEYS].map(k => k.split('.')[0]),
      // Dynamic-pattern top-level containers (e.g. review, model_profile_overrides)
      ...DYNAMIC_KEY_PATTERNS.map(p => p.topLevel),
      // Internal keys loadConfig reads but config-set doesn't expose
      'model_overrides', 'context_window', 'resolve_model_ids', 'claude_md_path',
      // Deprecated keys (still accepted for migration, not in config-set)
      'depth', 'multiRepo',
    ]);
    const unknownKeys = Object.keys(parsed).filter(k => !KNOWN_TOP_LEVEL.has(k));
    if (unknownKeys.length > 0) {
      process.stderr.write(
        `gsd-tools: warning: unknown config key(s) in .planning/config.json: ${unknownKeys.join(', ')} — these will be ignored\n`
      );
    }

    // #2517 — Validate runtime/tier values for keys that loadConfig handles but
    // can be edited directly into config.json (bypassing config-set's enum check).
    // This catches typos like `runtime: "codx"` and `model_profile_overrides.codex.banana`
    // at read time without rejecting back-compat values from new runtimes
    // (review findings #10, #13).
    _warnUnknownProfileOverrides(parsed, '.planning/config.json');

    const get = (key, nested) => {
      if (parsed[key] !== undefined) return parsed[key];
      if (nested && parsed[nested.section] && parsed[nested.section][nested.field] !== undefined) {
        return parsed[nested.section][nested.field];
      }
      return undefined;
    };

    const parallelization = (() => {
      const val = get('parallelization');
      if (typeof val === 'boolean') return val;
      if (typeof val === 'object' && val !== null && 'enabled' in val) return val.enabled;
      return defaults.parallelization;
    })();

    return {
      model_profile: get('model_profile') ?? defaults.model_profile,
      commit_docs: (() => {
        const explicit = get('commit_docs', { section: 'planning', field: 'commit_docs' });
        // If explicitly set in config, respect the user's choice
        if (explicit !== undefined) return explicit;
        // Auto-detection: when no explicit value and .planning/ is gitignored,
        // default to false instead of true
        if (isGitIgnored(cwd, '.planning/')) return false;
        return defaults.commit_docs;
      })(),
      search_gitignored: get('search_gitignored', { section: 'planning', field: 'search_gitignored' }) ?? defaults.search_gitignored,
      branching_strategy: get('branching_strategy', { section: 'git', field: 'branching_strategy' }) ?? defaults.branching_strategy,
      phase_branch_template: get('phase_branch_template', { section: 'git', field: 'phase_branch_template' }) ?? defaults.phase_branch_template,
      milestone_branch_template: get('milestone_branch_template', { section: 'git', field: 'milestone_branch_template' }) ?? defaults.milestone_branch_template,
      quick_branch_template: get('quick_branch_template', { section: 'git', field: 'quick_branch_template' }) ?? defaults.quick_branch_template,
      research: get('research', { section: 'workflow', field: 'research' }) ?? defaults.research,
      plan_checker: get('plan_checker', { section: 'workflow', field: 'plan_check' }) ?? defaults.plan_checker,
      verifier: get('verifier', { section: 'workflow', field: 'verifier' }) ?? defaults.verifier,
      nyquist_validation: get('nyquist_validation', { section: 'workflow', field: 'nyquist_validation' }) ?? defaults.nyquist_validation,
      post_planning_gaps: get('post_planning_gaps', { section: 'workflow', field: 'post_planning_gaps' }) ?? defaults.post_planning_gaps,
      parallelization,
      brave_search: get('brave_search') ?? defaults.brave_search,
      firecrawl: get('firecrawl') ?? defaults.firecrawl,
      exa_search: get('exa_search') ?? defaults.exa_search,
      tdd_mode: get('tdd_mode', { section: 'workflow', field: 'tdd_mode' }) ?? false,
      text_mode: get('text_mode', { section: 'workflow', field: 'text_mode' }) ?? defaults.text_mode,
      auto_advance: get('auto_advance', { section: 'workflow', field: 'auto_advance' }) ?? false,
      _auto_chain_active: get('_auto_chain_active', { section: 'workflow', field: '_auto_chain_active' }) ?? false,
      mode: get('mode') ?? 'interactive',
      sub_repos: get('sub_repos', { section: 'planning', field: 'sub_repos' }) ?? defaults.sub_repos,
      resolve_model_ids: get('resolve_model_ids') ?? defaults.resolve_model_ids,
      context_window: get('context_window') ?? defaults.context_window,
      phase_naming: get('phase_naming') ?? defaults.phase_naming,
      project_code: get('project_code') ?? defaults.project_code,
      subagent_timeout: get('subagent_timeout', { section: 'workflow', field: 'subagent_timeout' }) ?? defaults.subagent_timeout,
      model_overrides: parsed.model_overrides || null,
      // #2517 — runtime-aware profiles. `runtime` defaults to null (back-compat).
      // When null, resolveModelInternal preserves today's Claude-native behavior.
      // NOTE: `runtime` and `model_profile_overrides` are intentionally read
      // flat-only (not via `get()` with a workflow.X fallback) — they are
      // top-level keys per docs/CONFIGURATION.md. The lighter-touch decision
      // here was to document the constraint rather than introduce nested
      // resolution edge cases for two new keys (review finding #9). The
      // schema validation in `_warnUnknownProfileOverrides` runs against the
      // raw `parsed` blob, so direct `.planning/config.json` edits surface
      // unknown runtime/tier names at load time, not silently (review finding #10).
      runtime: parsed.runtime || null,
      model_profile_overrides: parsed.model_profile_overrides || null,
      agent_skills: parsed.agent_skills || {},
      manager: parsed.manager || {},
      response_language: get('response_language') || null,
      claude_md_path: get('claude_md_path') || null,
      claude_md_assembly: parsed.claude_md_assembly || null,
    };
  } catch {
    // Fall back to ~/.gsd/defaults.json only for truly pre-project contexts (#1683)
    // If .planning/ exists, the project is initialized — just missing config.json
    if (fs.existsSync(planningDir(cwd))) {
      return defaults;
    }
    try {
      const home = process.env.GSD_HOME || os.homedir();
      const globalDefaultsPath = path.join(home, '.gsd', 'defaults.json');
      const raw = fs.readFileSync(globalDefaultsPath, 'utf-8');
      const globalDefaults = JSON.parse(raw);
      return {
        ...defaults,
        model_profile: globalDefaults.model_profile ?? defaults.model_profile,
        commit_docs: globalDefaults.commit_docs ?? defaults.commit_docs,
        research: globalDefaults.research ?? defaults.research,
        plan_checker: globalDefaults.plan_checker ?? defaults.plan_checker,
        verifier: globalDefaults.verifier ?? defaults.verifier,
        nyquist_validation: globalDefaults.nyquist_validation ?? defaults.nyquist_validation,
        post_planning_gaps: globalDefaults.post_planning_gaps
          ?? globalDefaults.workflow?.post_planning_gaps
          ?? defaults.post_planning_gaps,
        parallelization: globalDefaults.parallelization ?? defaults.parallelization,
        text_mode: globalDefaults.text_mode ?? defaults.text_mode,
        resolve_model_ids: globalDefaults.resolve_model_ids ?? defaults.resolve_model_ids,
        context_window: globalDefaults.context_window ?? defaults.context_window,
        subagent_timeout: globalDefaults.subagent_timeout ?? defaults.subagent_timeout,
        model_overrides: globalDefaults.model_overrides || null,
        agent_skills: globalDefaults.agent_skills || {},
        response_language: globalDefaults.response_language || null,
      };
    } catch {
      return defaults;
    }
  }
}

// ─── Git utilities ────────────────────────────────────────────────────────────

const _gitIgnoredCache = new Map();

function isGitIgnored(cwd, targetPath) {
  const key = cwd + '::' + targetPath;
  if (_gitIgnoredCache.has(key)) return _gitIgnoredCache.get(key);
  try {
    // --no-index checks .gitignore rules regardless of whether the file is tracked.
    // Without it, git check-ignore returns "not ignored" for tracked files even when
    // .gitignore explicitly lists them — a common source of confusion when .planning/
    // was committed before being added to .gitignore.
    // Use execFileSync (array args) to prevent shell interpretation of special characters
    // in file paths — avoids command injection via crafted path names.
    execFileSync('git', ['check-ignore', '-q', '--no-index', '--', targetPath], {
      cwd,
      stdio: 'pipe',
    });
    _gitIgnoredCache.set(key, true);
    return true;
  } catch {
    _gitIgnoredCache.set(key, false);
    return false;
  }
}

// ─── Markdown normalization ─────────────────────────────────────────────────

/**
 * Normalize markdown to fix common markdownlint violations.
 * Applied at write points so GSD-generated .planning/ files are IDE-friendly.
 *
 * Rules enforced:
 *   MD022 — Blank lines around headings
 *   MD031 — Blank lines around fenced code blocks
 *   MD032 — Blank lines around lists
 *   MD012 — No multiple consecutive blank lines (collapsed to 2 max)
 *   MD047 — Files end with a single newline
 */
function normalizeMd(content) {
  if (!content || typeof content !== 'string') return content;

  // Normalize line endings to LF for consistent processing
  let text = content.replace(/\r\n/g, '\n');

  const lines = text.split('\n');
  const result = [];

  // Pre-compute fence state in a single O(n) pass instead of O(n^2) per-line scanning
  const fenceRegex = /^```/;
  const insideFence = new Array(lines.length);
  let fenceOpen = false;
  for (let i = 0; i < lines.length; i++) {
    if (fenceRegex.test(lines[i].trimEnd())) {
      if (fenceOpen) {
        // This is a closing fence — mark as NOT inside (it's the boundary)
        insideFence[i] = false;
        fenceOpen = false;
      } else {
        // This is an opening fence
        insideFence[i] = false;
        fenceOpen = true;
      }
    } else {
      insideFence[i] = fenceOpen;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prev = i > 0 ? lines[i - 1] : '';
    const prevTrimmed = prev.trimEnd();
    const trimmed = line.trimEnd();
    const isFenceLine = fenceRegex.test(trimmed);

    // MD022: Blank line before headings (skip first line and frontmatter delimiters)
    if (/^#{1,6}\s/.test(trimmed) && i > 0 && prevTrimmed !== '' && prevTrimmed !== '---') {
      result.push('');
    }

    // MD031: Blank line before fenced code blocks (opening fences only)
    if (isFenceLine && i > 0 && prevTrimmed !== '' && !insideFence[i] && (i === 0 || !insideFence[i - 1] || isFenceLine)) {
      // Only add blank before opening fences (not closing ones)
      if (i === 0 || !insideFence[i - 1]) {
        result.push('');
      }
    }

    // MD032: Blank line before lists (- item, * item, N. item, - [ ] item)
    if (/^(\s*[-*+]\s|\s*\d+\.\s)/.test(line) && i > 0 &&
        prevTrimmed !== '' && !/^(\s*[-*+]\s|\s*\d+\.\s)/.test(prev) &&
        prevTrimmed !== '---') {
      result.push('');
    }

    result.push(line);

    // MD022: Blank line after headings
    if (/^#{1,6}\s/.test(trimmed) && i < lines.length - 1) {
      const next = lines[i + 1];
      if (next !== undefined && next.trimEnd() !== '') {
        result.push('');
      }
    }

    // MD031: Blank line after closing fenced code blocks
    if (/^```\s*$/.test(trimmed) && i > 0 && insideFence[i - 1] && i < lines.length - 1) {
      const next = lines[i + 1];
      if (next !== undefined && next.trimEnd() !== '') {
        result.push('');
      }
    }

    // MD032: Blank line after last list item in a block
    if (/^(\s*[-*+]\s|\s*\d+\.\s)/.test(line) && i < lines.length - 1) {
      const next = lines[i + 1];
      if (next !== undefined && next.trimEnd() !== '' &&
          !/^(\s*[-*+]\s|\s*\d+\.\s)/.test(next) &&
          !/^\s/.test(next)) {
        // Only add blank line if next line is not a continuation/indented line
        result.push('');
      }
    }
  }

  text = result.join('\n');

  // MD012: Collapse 3+ consecutive blank lines to 2
  text = text.replace(/\n{3,}/g, '\n\n');

  // MD047: Ensure file ends with exactly one newline
  text = text.replace(/\n*$/, '\n');

  return text;
}

function execGit(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  return {
    exitCode: result.status ?? 1,
    stdout: (result.stdout ?? '').toString().trim(),
    stderr: (result.stderr ?? '').toString().trim(),
  };
}

// ─── Common path helpers ──────────────────────────────────────────────────────

/**
 * Resolve the main worktree root when running inside a git worktree.
 * In a linked worktree, .planning/ lives in the main worktree, not in the linked one.
 * Returns the main worktree path, or cwd if not in a worktree.
 */
function resolveWorktreeRoot(cwd) {
  // If the current directory already has its own .planning/, respect it.
  // This handles linked worktrees with independent planning state (e.g., Conductor workspaces).
  if (fs.existsSync(path.join(cwd, '.planning'))) {
    return cwd;
  }

  // Check if we're in a linked worktree
  const gitDir = execGit(cwd, ['rev-parse', '--git-dir']);
  const commonDir = execGit(cwd, ['rev-parse', '--git-common-dir']);

  if (gitDir.exitCode !== 0 || commonDir.exitCode !== 0) return cwd;

  // In a linked worktree, .git is a file pointing to .git/worktrees/<name>
  // and git-common-dir points to the main repo's .git directory
  const gitDirResolved = path.resolve(cwd, gitDir.stdout);
  const commonDirResolved = path.resolve(cwd, commonDir.stdout);

  if (gitDirResolved !== commonDirResolved) {
    // We're in a linked worktree — resolve main worktree root
    // The common dir is the main repo's .git, so its parent is the main worktree root
    return path.dirname(commonDirResolved);
  }

  return cwd;
}

/**
 * Parse `git worktree list --porcelain` output into an array of
 * { path, branch } objects.  Entries with a detached HEAD (no branch line)
 * are skipped because we cannot safely reason about their merge status.
 *
 * @param {string} porcelain - raw output from git worktree list --porcelain
 * @returns {{ path: string, branch: string }[]}
 */
function parseWorktreePorcelain(porcelain) {
  const entries = [];
  let current = null;
  for (const line of porcelain.split('\n')) {
    if (line.startsWith('worktree ')) {
      current = { path: line.slice('worktree '.length).trim(), branch: null };
    } else if (line.startsWith('branch refs/heads/') && current) {
      current.branch = line.slice('branch refs/heads/'.length).trim();
    } else if (line === '' && current) {
      if (current.branch) entries.push(current);
      current = null;
    }
  }
  // flush last entry if file doesn't end with blank line
  if (current && current.branch) entries.push(current);
  return entries;
}

/**
 * Remove linked git worktrees whose branch has already been merged into the
 * current HEAD of the main worktree.  Also runs `git worktree prune` to clear
 * any stale references left by manually-deleted worktree directories.
 *
 * Safe guards:
 *  - Never removes the main worktree (first entry in --porcelain output).
 *  - Never removes the worktree at process.cwd().
 *  - Never removes a worktree whose branch has unmerged commits.
 *  - Skips detached-HEAD worktrees (no branch name).
 *
 * @param {string} repoRoot - absolute path to the main (or any) worktree of
 *   the repository; used as `cwd` for git commands.
 * @returns {string[]} list of worktree paths that were removed
 */
function pruneOrphanedWorktrees(repoRoot) {
  const pruned = [];
  const cwd = process.cwd();

  try {
    // 1. Get all worktrees in porcelain format
    const listResult = execGit(repoRoot, ['worktree', 'list', '--porcelain']);
    if (listResult.exitCode !== 0) return pruned;

    const worktrees = parseWorktreePorcelain(listResult.stdout);
    if (worktrees.length === 0) {
      execGit(repoRoot, ['worktree', 'prune']);
      return pruned;
    }

    // 2. First entry is the main worktree — never touch it
    const mainWorktreePath = worktrees[0].path;

    // 3. Check each non-main worktree
    for (let i = 1; i < worktrees.length; i++) {
      const { path: wtPath, branch } = worktrees[i];

      // Never remove the worktree for the current process directory
      if (wtPath === cwd || cwd.startsWith(wtPath + path.sep)) continue;

      // Check if the branch is fully merged into HEAD (main)
      // git merge-base --is-ancestor <branch> HEAD exits 0 when merged
      const ancestorCheck = execGit(repoRoot, [
        'merge-base', '--is-ancestor', branch, 'HEAD',
      ]);

      if (ancestorCheck.exitCode !== 0) {
        // Not yet merged — leave it alone
        continue;
      }

      // Remove the worktree and delete the branch
      const removeResult = execGit(repoRoot, ['worktree', 'remove', '--force', wtPath]);
      if (removeResult.exitCode === 0) {
        execGit(repoRoot, ['branch', '-D', branch]);
        pruned.push(wtPath);
      }
    }
  } catch { /* never crash the caller */ }

  // 4. Always run prune to clear stale references (e.g. manually-deleted dirs)
  execGit(repoRoot, ['worktree', 'prune']);

  return pruned;
}

/**
 * Acquire a file-based lock for .planning/ writes.
 * Prevents concurrent worktrees from corrupting shared planning files.
 * Lock is auto-released after the callback completes.
 */
function withPlanningLock(cwd, fn) {
  const lockPath = path.join(planningDir(cwd), '.lock');
  const lockTimeout = 10000; // 10 seconds
  const retryDelay = 100;
  const start = Date.now();

  // Ensure .planning/ exists
  try { fs.mkdirSync(planningDir(cwd), { recursive: true }); } catch { /* ok */ }

  while (Date.now() - start < lockTimeout) {
    try {
      // Atomic create — fails if file exists
      fs.writeFileSync(lockPath, JSON.stringify({
        pid: process.pid,
        cwd,
        acquired: new Date().toISOString(),
      }), { flag: 'wx' });

      // Register for exit-time cleanup so process.exit(1) inside a locked region
      // cannot leave a stale lock file (#1916).
      _heldPlanningLocks.add(lockPath);

      // Lock acquired — run the function
      try {
        return fn();
      } finally {
        _heldPlanningLocks.delete(lockPath);
        try { fs.unlinkSync(lockPath); } catch { /* already released */ }
      }
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Lock exists — check if stale (>30s old)
        try {
          const stat = fs.statSync(lockPath);
          if (Date.now() - stat.mtimeMs > 30000) {
            fs.unlinkSync(lockPath);
            continue; // retry
          }
        } catch { continue; }

        // Wait and retry (cross-platform, no shell dependency)
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        continue;
      }
      throw err;
    }
  }
  // Timeout — force acquire (stale lock recovery)
  try { fs.unlinkSync(lockPath); } catch { /* ok */ }
  return fn();
}

/**
 * Get the .planning directory path, project- and workstream-aware.
 *
 * Resolution order:
 * 1. If GSD_PROJECT is set (env var or explicit `project` arg), routes to
 *    `.planning/{project}/` — supports multi-project workspaces where several
 *    independent projects share a single `.planning/` root directory (e.g.,
 *    an Obsidian vault or monorepo knowledge base used as a command center).
 * 2. If GSD_WORKSTREAM is set, routes to `.planning/workstreams/{ws}/`.
 * 3. Otherwise returns `.planning/`.
 *
 * GSD_PROJECT and GSD_WORKSTREAM can be combined:
 *   `.planning/{project}/workstreams/{ws}/`
 *
 * @param {string} cwd - project root
 * @param {string} [ws] - explicit workstream name; if omitted, checks GSD_WORKSTREAM env var
 * @param {string} [project] - explicit project name; if omitted, checks GSD_PROJECT env var
 */
function planningDir(cwd, ws, project) {
  if (project === undefined) project = process.env.GSD_PROJECT || null;
  if (ws === undefined) ws = process.env.GSD_WORKSTREAM || null;

  // Reject path separators and traversal components in project/workstream names
  const BAD_SEGMENT = /[/\\]|\.\./;
  if (project && BAD_SEGMENT.test(project)) {
    throw new Error(`GSD_PROJECT contains invalid path characters: ${project}`);
  }
  if (ws && BAD_SEGMENT.test(ws)) {
    throw new Error(`GSD_WORKSTREAM contains invalid path characters: ${ws}`);
  }

  let base = path.join(cwd, '.planning');
  if (project) base = path.join(base, project);
  if (ws) base = path.join(base, 'workstreams', ws);
  return base;
}

/** Always returns the root .planning/ path, ignoring workstreams and projects. For shared resources. */
function planningRoot(cwd) {
  return path.join(cwd, '.planning');
}

/**
 * Get common .planning file paths, project-and-workstream-aware.
 *
 * All paths route through planningDir(cwd, ws), which honors the GSD_PROJECT
 * env var and active workstream. This matches loadConfig() above (line 256),
 * which has always read config.json via planningDir(cwd). Previously project
 * and config were resolved against the unrouted .planning/ root, which broke
 * `gsd-tools config-get` in multi-project layouts (the CRUD writers and the
 * reader pointed at different files).
 */
function planningPaths(cwd, ws) {
  const base = planningDir(cwd, ws);
  return {
    planning: base,
    state: path.join(base, 'STATE.md'),
    roadmap: path.join(base, 'ROADMAP.md'),
    project: path.join(base, 'PROJECT.md'),
    config: path.join(base, 'config.json'),
    phases: path.join(base, 'phases'),
    requirements: path.join(base, 'REQUIREMENTS.md'),
  };
}

// ─── Active Workstream Detection ─────────────────────────────────────────────

function sanitizeWorkstreamSessionToken(value) {
  if (value === null || value === undefined) return null;
  const token = String(value).trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  return token ? token.slice(0, 160) : null;
}

function probeControllingTtyToken() {
  if (didProbeControllingTtyToken) return cachedControllingTtyToken;
  didProbeControllingTtyToken = true;

  // `tty` reads stdin. When stdin is already non-interactive, spawning it only
  // adds avoidable failures on the routing hot path and cannot reveal a stable token.
  if (!(process.stdin && process.stdin.isTTY)) {
    return cachedControllingTtyToken;
  }

  try {
    const ttyPath = execFileSync('tty', [], {
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'ignore'],
    }).trim();
    if (ttyPath && ttyPath !== 'not a tty') {
      const token = sanitizeWorkstreamSessionToken(ttyPath.replace(/^\/dev\//, ''));
      if (token) cachedControllingTtyToken = `tty-${token}`;
    }
  } catch {}

  return cachedControllingTtyToken;
}

function getControllingTtyToken() {
  for (const envKey of ['TTY', 'SSH_TTY']) {
    const token = sanitizeWorkstreamSessionToken(process.env[envKey]);
    if (token) return `tty-${token.replace(/^dev_/, '')}`;
  }

  return probeControllingTtyToken();
}

/**
 * Resolve a deterministic session key for workstream-local routing.
 *
 * Order:
 * 1. Explicit runtime/session env vars (`GSD_SESSION_KEY`, `CODEX_THREAD_ID`, etc.)
 * 2. Terminal identity exposed via `TTY` or `SSH_TTY`
 * 3. One best-effort `tty` probe when stdin is interactive
 * 4. `null`, which tells callers to use the legacy shared pointer fallback
 */
function getWorkstreamSessionKey() {
  for (const envKey of WORKSTREAM_SESSION_ENV_KEYS) {
    const raw = process.env[envKey];
    const token = sanitizeWorkstreamSessionToken(raw);
    if (token) return `${envKey.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${token}`;
  }

  return getControllingTtyToken();
}

function getSessionScopedWorkstreamFile(cwd) {
  const sessionKey = getWorkstreamSessionKey();
  if (!sessionKey) return null;

  // Use realpathSync.native so the hash is derived from the canonical filesystem
  // path. On Windows, path.resolve returns whatever case the caller supplied,
  // while realpathSync.native returns the case the OS recorded — they differ on
  // case-insensitive NTFS, producing different hashes and different tmpdir slots.
  // Fall back to path.resolve when the directory does not yet exist.
  let planningAbs;
  try {
    planningAbs = fs.realpathSync.native(planningRoot(cwd));
  } catch {
    planningAbs = path.resolve(planningRoot(cwd));
  }
  const projectId = crypto
    .createHash('sha1')
    .update(planningAbs)
    .digest('hex')
    .slice(0, 16);

  const dirPath = path.join(os.tmpdir(), 'gsd-workstream-sessions', projectId);
  return {
    sessionKey,
    dirPath,
    filePath: path.join(dirPath, sessionKey),
  };
}

function clearActiveWorkstreamPointer(filePath, cleanupDirPath) {
  try { fs.unlinkSync(filePath); } catch {}

  // Session-scoped pointers for a repo share one tmp directory. Only remove it
  // when it is empty so clearing or self-healing one session never deletes siblings.
  // Explicitly check remaining entries rather than relying on rmdirSync throwing
  // ENOTEMPTY — that error is not raised reliably on Windows.
  if (cleanupDirPath) {
    try {
      const remaining = fs.readdirSync(cleanupDirPath);
      if (remaining.length === 0) {
        fs.rmdirSync(cleanupDirPath);
      }
    } catch {}
  }
}

/**
 * Pointer files are self-healing: invalid names or deleted-workstream pointers
 * are removed on read so the session falls back to `null` instead of carrying
 * silent stale state forward. Session-scoped callers may also prune an empty
 * per-project tmp directory; shared `.planning/active-workstream` callers do not.
 */
function readActiveWorkstreamPointer(filePath, cwd, cleanupDirPath = null) {
  try {
    const name = fs.readFileSync(filePath, 'utf-8').trim();
    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      clearActiveWorkstreamPointer(filePath, cleanupDirPath);
      return null;
    }
    const wsDir = path.join(planningRoot(cwd), 'workstreams', name);
    if (!fs.existsSync(wsDir)) {
      clearActiveWorkstreamPointer(filePath, cleanupDirPath);
      return null;
    }
    return name;
  } catch {
    return null;
  }
}

/**
 * Get the active workstream name.
 *
 * Resolution priority:
 * 1. Session-scoped pointer (tmpdir) when the runtime exposes a stable session key
 * 2. Legacy shared `.planning/active-workstream` file when no session key is available
 *
 * The shared file is intentionally ignored when a session key exists so multiple
 * concurrent sessions do not overwrite each other's active workstream.
 */
function getActiveWorkstream(cwd) {
  const sessionScoped = getSessionScopedWorkstreamFile(cwd);
  if (sessionScoped) {
    return readActiveWorkstreamPointer(sessionScoped.filePath, cwd, sessionScoped.dirPath);
  }

  const sharedFilePath = path.join(planningRoot(cwd), 'active-workstream');
  return readActiveWorkstreamPointer(sharedFilePath, cwd);
}

/**
 * Set the active workstream. Pass null to clear.
 *
 * When a stable session key is available, this updates a tmpdir-backed
 * session-scoped pointer. Otherwise it falls back to the legacy shared
 * `.planning/active-workstream` file for backward compatibility.
 */
function setActiveWorkstream(cwd, name) {
  const sessionScoped = getSessionScopedWorkstreamFile(cwd);
  const filePath = sessionScoped
    ? sessionScoped.filePath
    : path.join(planningRoot(cwd), 'active-workstream');

  if (!name) {
    clearActiveWorkstreamPointer(filePath, sessionScoped ? sessionScoped.dirPath : null);
    return;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Invalid workstream name: must be alphanumeric, hyphens, and underscores only');
  }

  if (sessionScoped) {
    fs.mkdirSync(sessionScoped.dirPath, { recursive: true });
  }
  fs.writeFileSync(filePath, name + '\n', 'utf-8');
}

// ─── Phase utilities ──────────────────────────────────────────────────────────

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePhaseName(phase) {
  const str = String(phase);
  // Strip optional project_code prefix (e.g., 'CK-01' → '01')
  const stripped = str.replace(/^[A-Z]{1,6}-(?=\d)/, '');
  // Standard numeric phases: 1, 01, 12A, 12.1
  const match = stripped.match(/^(\d+)([A-Z])?((?:\.\d+)*)/i);
  if (match) {
    const padded = match[1].padStart(2, '0');
    // Preserve original case of letter suffix (#1962).
    // Uppercasing causes directory/roadmap mismatches on case-sensitive filesystems
    // (e.g., "16c" in ROADMAP.md → directory "16C-name" → progress can't match).
    const letter = match[2] || '';
    const decimal = match[3] || '';
    return padded + letter + decimal;
  }
  // Custom phase IDs (e.g. PROJ-42, AUTH-101): return as-is
  return str;
}

function comparePhaseNum(a, b) {
  // Strip optional project_code prefix before comparing (e.g., 'CK-01-name' → '01-name')
  const sa = String(a).replace(/^[A-Z]{1,6}-/, '');
  const sb = String(b).replace(/^[A-Z]{1,6}-/, '');
  const pa = sa.match(/^(\d+)([A-Z])?((?:\.\d+)*)/i);
  const pb = sb.match(/^(\d+)([A-Z])?((?:\.\d+)*)/i);
  // If either is non-numeric (custom ID), fall back to string comparison
  if (!pa || !pb) return String(a).localeCompare(String(b));
  const intDiff = parseInt(pa[1], 10) - parseInt(pb[1], 10);
  if (intDiff !== 0) return intDiff;
  // No letter sorts before letter: 12 < 12A < 12B
  const la = (pa[2] || '').toUpperCase();
  const lb = (pb[2] || '').toUpperCase();
  if (la !== lb) {
    if (!la) return -1;
    if (!lb) return 1;
    return la < lb ? -1 : 1;
  }
  // Segment-by-segment decimal comparison: 12A < 12A.1 < 12A.1.2 < 12A.2
  const aDecParts = pa[3] ? pa[3].slice(1).split('.').map(p => parseInt(p, 10)) : [];
  const bDecParts = pb[3] ? pb[3].slice(1).split('.').map(p => parseInt(p, 10)) : [];
  const maxLen = Math.max(aDecParts.length, bDecParts.length);
  if (aDecParts.length === 0 && bDecParts.length > 0) return -1;
  if (bDecParts.length === 0 && aDecParts.length > 0) return 1;
  for (let i = 0; i < maxLen; i++) {
    const av = Number.isFinite(aDecParts[i]) ? aDecParts[i] : 0;
    const bv = Number.isFinite(bDecParts[i]) ? bDecParts[i] : 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/**
 * Extract the phase token from a directory name.
 * Supports: '01-name', '1009A-name', '999.6-name', 'CK-01-name', 'PROJ-42-name'.
 * Returns the token portion (e.g. '01', '1009A', '999.6', 'PROJ-42') or the full name if no separator.
 */
function extractPhaseToken(dirName) {
  // Try project-code-prefixed numeric: CK-01-name → CK-01, CK-01A.2-name → CK-01A.2
  const codePrefixed = dirName.match(/^([A-Z]{1,6}-\d+[A-Z]?(?:\.\d+)*)(?:-|$)/i);
  if (codePrefixed) return codePrefixed[1];
  // Try plain numeric: 01-name, 1009A-name, 999.6-name
  const numeric = dirName.match(/^(\d+[A-Z]?(?:\.\d+)*)(?:-|$)/i);
  if (numeric) return numeric[1];
  // Custom IDs: PROJ-42-name → everything before the last segment that looks like a name
  const custom = dirName.match(/^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)(?:-[a-z]|$)/i);
  if (custom) return custom[1];
  return dirName;
}

/**
 * Check if a directory name's phase token matches the normalized phase exactly.
 * Case-insensitive comparison for the token portion.
 */
function phaseTokenMatches(dirName, normalized) {
  const token = extractPhaseToken(dirName);
  if (token.toUpperCase() === normalized.toUpperCase()) return true;
  // Strip optional project_code prefix from dir and retry
  const stripped = dirName.replace(/^[A-Z]{1,6}-(?=\d)/i, '');
  if (stripped !== dirName) {
    const strippedToken = extractPhaseToken(stripped);
    if (strippedToken.toUpperCase() === normalized.toUpperCase()) return true;
  }
  return false;
}

function searchPhaseInDir(baseDir, relBase, normalized) {
  try {
    const dirs = readSubdirectories(baseDir, true);
    // Match: exact phase token comparison (not prefix matching)
    const match = dirs.find(d => phaseTokenMatches(d, normalized));
    if (!match) return null;

    // Extract phase number and name — supports numeric (01-name), project-code-prefixed (CK-01-name), and custom (PROJ-42-name)
    const dirMatch = match.match(/^(?:[A-Z]{1,6}-)(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i)
      || match.match(/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i)
      || match.match(/^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)-(.+)/i)
      || [null, match, null];
    const phaseNumber = dirMatch ? dirMatch[1] : normalized;
    const phaseName = dirMatch && dirMatch[2] ? dirMatch[2] : null;
    const phaseDir = path.join(baseDir, match);
    const { plans: unsortedPlans, summaries: unsortedSummaries, hasResearch, hasContext, hasVerification, hasReviews } = getPhaseFileStats(phaseDir);
    const plans = unsortedPlans.sort();
    const summaries = unsortedSummaries.sort();

    const completedPlanIds = new Set(
      summaries.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', ''))
    );
    const incompletePlans = plans.filter(p => {
      const planId = p.replace('-PLAN.md', '').replace('PLAN.md', '');
      return !completedPlanIds.has(planId);
    });

    return {
      found: true,
      directory: toPosixPath(path.join(relBase, match)),
      phase_number: phaseNumber,
      phase_name: phaseName,
      phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
      plans,
      summaries,
      incomplete_plans: incompletePlans,
      has_research: hasResearch,
      has_context: hasContext,
      has_verification: hasVerification,
      has_reviews: hasReviews,
    };
  } catch {
    return null;
  }
}

function findPhaseInternal(cwd, phase) {
  if (!phase) return null;

  const phasesDir = path.join(planningDir(cwd), 'phases');
  const normalized = normalizePhaseName(phase);

  // Search current phases first
  const relPhasesDir = toPosixPath(path.relative(cwd, phasesDir));
  const current = searchPhaseInDir(phasesDir, relPhasesDir, normalized);
  if (current) return current;

  // Search archived milestone phases (newest first)
  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  if (!fs.existsSync(milestonesDir)) return null;

  try {
    const milestoneEntries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    const archiveDirs = milestoneEntries
      .filter(e => e.isDirectory() && /^v[\d.]+-phases$/.test(e.name))
      .map(e => e.name)
      .sort()
      .reverse();

    for (const archiveName of archiveDirs) {
      const version = archiveName.match(/^(v[\d.]+)-phases$/)[1];
      const archivePath = path.join(milestonesDir, archiveName);
      const relBase = '.planning/milestones/' + archiveName;
      const result = searchPhaseInDir(archivePath, relBase, normalized);
      if (result) {
        result.archived = version;
        return result;
      }
    }
  } catch { /* intentionally empty */ }

  return null;
}

function getArchivedPhaseDirs(cwd) {
  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  const results = [];

  if (!fs.existsSync(milestonesDir)) return results;

  try {
    const milestoneEntries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    // Find v*-phases directories, sort newest first
    const phaseDirs = milestoneEntries
      .filter(e => e.isDirectory() && /^v[\d.]+-phases$/.test(e.name))
      .map(e => e.name)
      .sort()
      .reverse();

    for (const archiveName of phaseDirs) {
      const version = archiveName.match(/^(v[\d.]+)-phases$/)[1];
      const archivePath = path.join(milestonesDir, archiveName);
      const dirs = readSubdirectories(archivePath, true);

      for (const dir of dirs) {
        results.push({
          name: dir,
          milestone: version,
          basePath: path.join('.planning', 'milestones', archiveName),
          fullPath: path.join(archivePath, dir),
        });
      }
    }
  } catch { /* intentionally empty */ }

  return results;
}

// ─── Roadmap milestone scoping ───────────────────────────────────────────────

/**
 * Strip shipped milestone content wrapped in <details> blocks.
 * Used to isolate current milestone phases when searching ROADMAP.md
 * for phase headings or checkboxes — prevents matching archived milestone
 * phases that share the same numbers as current milestone phases.
 */
function stripShippedMilestones(content) {
  return content.replace(/<details>[\s\S]*?<\/details>/gi, '');
}

/**
 * Extract the current milestone section from ROADMAP.md by positive lookup.
 *
 * Instead of stripping <details> blocks (negative heuristic that breaks if
 * agents wrap the current milestone in <details>), this finds the section
 * matching the current milestone version and returns only that content.
 *
 * Falls back to stripShippedMilestones() if:
 * - cwd is not provided
 * - STATE.md doesn't exist or has no milestone field
 * - Version can't be found in ROADMAP.md
 *
 * @param {string} content - Full ROADMAP.md content
 * @param {string} [cwd] - Working directory for reading STATE.md
 * @returns {string} Content scoped to current milestone
 */
function extractCurrentMilestone(content, cwd) {
  if (!cwd) return stripShippedMilestones(content);

  // 1. Get current milestone version from STATE.md frontmatter
  let version = null;
  try {
    const statePath = path.join(planningDir(cwd), 'STATE.md');
    if (fs.existsSync(statePath)) {
      const stateRaw = fs.readFileSync(statePath, 'utf-8');
      const milestoneMatch = stateRaw.match(/^milestone:\s*(.+)/m);
      if (milestoneMatch) {
        version = milestoneMatch[1].trim();
      }
    }
  } catch {}

  // 2. Fallback: derive version from getMilestoneInfo pattern in ROADMAP.md itself
  if (!version) {
    // Check for 🚧 in-progress marker
    const inProgressMatch = content.match(/🚧\s*\*\*v(\d+\.\d+)\s/);
    if (inProgressMatch) {
      version = 'v' + inProgressMatch[1];
    }
  }

  if (!version) return stripShippedMilestones(content);

  // 3. Find the section matching this version
  // Match headings like: ## Roadmap v3.0: Name, ## v3.0 Name, etc.
  const escapedVersion = escapeRegex(version);
  const sectionPattern = new RegExp(
    `(^#{1,3}\\s+.*${escapedVersion}[^\\n]*)`,
    'mi'
  );
  const sectionMatch = content.match(sectionPattern);

  if (!sectionMatch) return stripShippedMilestones(content);

  const sectionStart = sectionMatch.index;

  // Find the end: next milestone heading at same or higher level, or EOF
  // Milestone headings look like: ## v2.0, ## Roadmap v2.0, ## ✅ v1.0, etc.
  const headingLevel = sectionMatch[1].match(/^(#{1,3})\s/)[1].length;
  const restContent = content.slice(sectionStart + sectionMatch[0].length);
  // Exclude phase headings (e.g. "### Phase 12: v1.0 Tech-Debt Closure") from
  // being treated as milestone boundaries just because they mention vX.Y in
  // the title. Phase headings always start with the literal `Phase `. See #2619.
  const nextMilestonePattern = new RegExp(
    `^#{1,${headingLevel}}\\s+(?!Phase\\s+\\S)(?:.*v\\d+\\.\\d+|✅|📋|🚧)`,
    'mi'
  );
  const nextMatch = restContent.match(nextMilestonePattern);

  let sectionEnd;
  if (nextMatch) {
    sectionEnd = sectionStart + sectionMatch[0].length + nextMatch.index;
  } else {
    sectionEnd = content.length;
  }

  // Return everything before the current milestone section (non-milestone content
  // like title, overview) plus the current milestone section
  const beforeMilestones = content.slice(0, sectionStart);
  const currentSection = content.slice(sectionStart, sectionEnd);

  // Also include any content before the first milestone heading (title, overview, etc.)
  // but strip any <details> blocks in it (these are definitely shipped)
  const preamble = beforeMilestones.replace(/<details>[\s\S]*?<\/details>/gi, '');

  return preamble + currentSection;
}

/**
 * Replace a pattern only in the current milestone section of ROADMAP.md
 * (everything after the last </details> close tag). Used for write operations
 * that must not accidentally modify archived milestone checkboxes/tables.
 */
function replaceInCurrentMilestone(content, pattern, replacement) {
  const lastDetailsClose = content.lastIndexOf('</details>');
  if (lastDetailsClose === -1) {
    return content.replace(pattern, replacement);
  }
  const offset = lastDetailsClose + '</details>'.length;
  const before = content.slice(0, offset);
  const after = content.slice(offset);
  return before + after.replace(pattern, replacement);
}

// ─── Roadmap & model utilities ────────────────────────────────────────────────

function getRoadmapPhaseInternal(cwd, phaseNum) {
  if (!phaseNum) return null;
  const roadmapPath = path.join(planningDir(cwd), 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) return null;

  try {
    const content = extractCurrentMilestone(fs.readFileSync(roadmapPath, 'utf-8'), cwd);
    // Strip leading zeros from purely numeric phase numbers so "03" matches "Phase 3:"
    // in canonical ROADMAP headings. Non-numeric IDs (e.g. "PROJ-42") are kept as-is.
    const normalized = /^\d+$/.test(String(phaseNum))
      ? String(phaseNum).replace(/^0+(?=\d)/, '')
      : String(phaseNum);
    const escapedPhase = escapeRegex(normalized);
    // Match both numeric and custom (Phase PROJ-42:) headers.
    // For purely numeric phases allow optional leading zeros so both "Phase 1:" and
    // "Phase 01:" are matched regardless of whether the ROADMAP uses padded numbers.
    const isNumeric = /^\d+$/.test(String(phaseNum));
    const phasePattern = isNumeric
      ? new RegExp(`#{2,4}\\s*Phase\\s+0*${escapedPhase}:\\s*([^\\n]+)`, 'i')
      : new RegExp(`#{2,4}\\s*Phase\\s+${escapedPhase}:\\s*([^\\n]+)`, 'i');
    const headerMatch = content.match(phasePattern);
    if (!headerMatch) return null;

    const phaseName = headerMatch[1].trim();
    const headerIndex = headerMatch.index;
    const restOfContent = content.slice(headerIndex);
    const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+[\w]/i);
    const sectionEnd = nextHeaderMatch ? headerIndex + nextHeaderMatch.index : content.length;
    const section = content.slice(headerIndex, sectionEnd).trim();

    const goalMatch = section.match(/\*\*Goal(?:\*\*:|\*?\*?:\*\*)\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    return {
      found: true,
      phase_number: phaseNum.toString(),
      phase_name: phaseName,
      goal,
      section,
    };
  } catch {
    return null;
  }
}

// ─── Agent installation validation (#1371) ───────────────────────────────────

/**
 * Resolve the agents directory from the GSD install location.
 * gsd-tools.cjs lives at <configDir>/get-shit-done/bin/gsd-tools.cjs,
 * so agents/ is at <configDir>/agents/.
 *
 * GSD_AGENTS_DIR env var overrides the default path. Used in tests and for
 * installs where the agents directory is not co-located with gsd-tools.cjs.
 *
 * @returns {string} Absolute path to the agents directory
 */
function getAgentsDir() {
  if (process.env.GSD_AGENTS_DIR) {
    return process.env.GSD_AGENTS_DIR;
  }
  // __dirname is get-shit-done/bin/lib/ → go up 3 levels to configDir
  return path.join(__dirname, '..', '..', '..', 'agents');
}

/**
 * Check which GSD agents are installed on disk.
 * Returns an object with installation status and details.
 *
 * Recognises both standard format (gsd-planner.md) and Copilot format
 * (gsd-planner.agent.md). Copilot renames agent files during install (#1512).
 *
 * @returns {{ agents_installed: boolean, missing_agents: string[], installed_agents: string[], agents_dir: string }}
 */
function checkAgentsInstalled() {
  const agentsDir = getAgentsDir();
  const expectedAgents = Object.keys(MODEL_PROFILES);
  const installed = [];
  const missing = [];

  if (!fs.existsSync(agentsDir)) {
    return {
      agents_installed: false,
      missing_agents: expectedAgents,
      installed_agents: [],
      agents_dir: agentsDir,
    };
  }

  for (const agent of expectedAgents) {
    // Check both .md (standard) and .agent.md (Copilot) file formats.
    const agentFile = path.join(agentsDir, `${agent}.md`);
    const agentFileCopilot = path.join(agentsDir, `${agent}.agent.md`);
    if (fs.existsSync(agentFile) || fs.existsSync(agentFileCopilot)) {
      installed.push(agent);
    } else {
      missing.push(agent);
    }
  }

  return {
    agents_installed: installed.length > 0 && missing.length === 0,
    missing_agents: missing,
    installed_agents: installed,
    agents_dir: agentsDir,
  };
}

// ─── Model alias resolution ───────────────────────────────────────────────────

/**
 * Map short model aliases to full model IDs.
 * Updated each release to match current model versions.
 * Users can override with model_overrides in config.json for custom/latest models.
 */
const MODEL_ALIAS_MAP = {
  'opus': 'claude-opus-4-6',
  'sonnet': 'claude-sonnet-4-6',
  'haiku': 'claude-haiku-4-5',
};

/**
 * #2517 — runtime-aware tier resolution.
 * Maps `model_profile` tiers (opus/sonnet/haiku) to runtime-native model IDs and
 * (where supported) reasoning_effort settings.
 *
 * Each entry: { model: <id>, reasoning_effort?: <level> }
 *
 * `claude` mirrors MODEL_ALIAS_MAP — present for symmetry so `runtime: "claude"`
 * resolves through the same code path. `codex` defaults are taken from the spec
 * in #2517. Unknown runtimes fall back to the Claude alias to avoid emitting
 * provider-specific IDs the runtime cannot accept.
 */
const RUNTIME_PROFILE_MAP = {
  claude: {
    opus:   { model: 'claude-opus-4-6' },
    sonnet: { model: 'claude-sonnet-4-6' },
    haiku:  { model: 'claude-haiku-4-5' },
  },
  codex: {
    opus:   { model: 'gpt-5.4',        reasoning_effort: 'xhigh' },
    sonnet: { model: 'gpt-5.3-codex',  reasoning_effort: 'medium' },
    haiku:  { model: 'gpt-5.4-mini',   reasoning_effort: 'medium' },
  },
};

const RUNTIMES_WITH_REASONING_EFFORT = new Set(['codex']);

/**
 * Tier enum allowed under `model_profile_overrides[runtime][tier]`. Mirrors the
 * regex in `config-schema.cjs` (DYNAMIC_KEY_PATTERNS) so loadConfig surfaces the
 * same constraint at read time, not only at config-set time (review finding #10).
 */
const RUNTIME_OVERRIDE_TIERS = new Set(['opus', 'sonnet', 'haiku']);

/**
 * Allowlist of runtime names the install pipeline currently knows how to emit
 * native model IDs for. Synced with `getDirName` in `bin/install.js` and the
 * runtime list in `docs/CONFIGURATION.md`. Free-string runtimes outside this
 * set are still accepted (#2517 deliberately leaves the runtime field open) —
 * a warning fires once at loadConfig so a typo like `runtime: "codx"` does not
 * silently fall back to Claude defaults (review findings #10, #13).
 */
const KNOWN_RUNTIMES = new Set([
  'claude', 'codex', 'opencode', 'kilo', 'gemini', 'qwen',
  'copilot', 'cursor', 'windsurf', 'augment', 'trae', 'codebuddy',
  'antigravity', 'cline',
]);

const _warnedConfigKeys = new Set();
/**
 * Emit a one-time stderr warning for unknown runtime/tier keys in a parsed
 * config blob. Idempotent across calls — the same (file, key) pair only warns
 * once per process so loadConfig can be called repeatedly without spamming.
 *
 * Does NOT reject — preserves back-compat for users on a runtime not yet in the
 * allowlist (the new-runtime case must always be possible without code changes).
 */
function _warnUnknownProfileOverrides(parsed, configLabel) {
  if (!parsed || typeof parsed !== 'object') return;

  const runtime = parsed.runtime;
  if (runtime && typeof runtime === 'string' && !KNOWN_RUNTIMES.has(runtime)) {
    const key = `${configLabel}::runtime::${runtime}`;
    if (!_warnedConfigKeys.has(key)) {
      _warnedConfigKeys.add(key);
      try {
        process.stderr.write(
          `gsd: warning — config key "runtime" has unknown value "${runtime}". ` +
          `Known runtimes: ${[...KNOWN_RUNTIMES].sort().join(', ')}. ` +
          `Resolution will fall back to safe defaults. (#2517)\n`
        );
      } catch { /* stderr might be closed in some test harnesses */ }
    }
  }

  const overrides = parsed.model_profile_overrides;
  if (!overrides || typeof overrides !== 'object') return;
  for (const [overrideRuntime, tierMap] of Object.entries(overrides)) {
    if (!KNOWN_RUNTIMES.has(overrideRuntime)) {
      const key = `${configLabel}::override-runtime::${overrideRuntime}`;
      if (!_warnedConfigKeys.has(key)) {
        _warnedConfigKeys.add(key);
        try {
          process.stderr.write(
            `gsd: warning — model_profile_overrides.${overrideRuntime}.* uses ` +
            `unknown runtime "${overrideRuntime}". Known runtimes: ` +
            `${[...KNOWN_RUNTIMES].sort().join(', ')}. (#2517)\n`
          );
        } catch { /* ok */ }
      }
    }
    if (!tierMap || typeof tierMap !== 'object') continue;
    for (const tierName of Object.keys(tierMap)) {
      if (!RUNTIME_OVERRIDE_TIERS.has(tierName)) {
        const key = `${configLabel}::override-tier::${overrideRuntime}.${tierName}`;
        if (!_warnedConfigKeys.has(key)) {
          _warnedConfigKeys.add(key);
          try {
            process.stderr.write(
              `gsd: warning — model_profile_overrides.${overrideRuntime}.${tierName} ` +
              `uses unknown tier "${tierName}". Allowed tiers: opus, sonnet, haiku. (#2517)\n`
            );
          } catch { /* ok */ }
        }
      }
    }
  }
}

// Internal helper exposed for tests so per-process warning state can be reset
// between cases that intentionally exercise the warning path repeatedly.
function _resetRuntimeWarningCacheForTests() {
  _warnedConfigKeys.clear();
}

/**
 * #2517 — Resolve the runtime-aware tier entry for (runtime, tier).
 *
 * Single source of truth shared by core.cjs (resolveModelInternal /
 * resolveReasoningEffortInternal) and bin/install.js (Codex/OpenCode TOML emit
 * paths). Always merges built-in defaults with user overrides at the field
 * level so partial overrides keep the unspecified fields:
 *
 *   `{ codex: { opus: "gpt-5-pro" } }`           keeps reasoning_effort: 'xhigh'
 *   `{ codex: { opus: { reasoning_effort: 'low' } } }` keeps model: 'gpt-5.4'
 *
 * Without this field-merge, the documented string-shorthand example silently
 * dropped reasoning_effort and a partial-object override silently dropped the
 * model — both reported as critical findings in the #2609 review.
 *
 * Inputs:
 *   - runtime: string (e.g. 'codex', 'claude', 'opencode')
 *   - tier:    'opus' | 'sonnet' | 'haiku'
 *   - overrides: optional `model_profile_overrides` blob (may be null/undefined)
 *
 * Returns `{ model: string, reasoning_effort?: string } | null`.
 */
function resolveTierEntry({ runtime, tier, overrides }) {
  if (!runtime || !tier) return null;

  const builtin = RUNTIME_PROFILE_MAP[runtime]?.[tier] || null;
  const userRaw = overrides?.[runtime]?.[tier];

  // String shorthand from CONFIGURATION.md examples — `{ codex: { opus: "gpt-5-pro" } }`.
  // Treat as `{ model: "gpt-5-pro" }` so the field-merge below still preserves
  // reasoning_effort from the built-in defaults.
  let userEntry = null;
  if (userRaw) {
    userEntry = typeof userRaw === 'string' ? { model: userRaw } : userRaw;
  }

  if (!builtin && !userEntry) return null;
  // Field-merge: user fields win, built-in fills the gaps.
  return { ...(builtin || {}), ...(userEntry || {}) };
}

/**
 * Convenience wrapper used by resolveModelInternal / resolveReasoningEffortInternal.
 * Pulls runtime + overrides out of a loaded config and delegates to resolveTierEntry.
 */
function _resolveRuntimeTier(config, tier) {
  return resolveTierEntry({
    runtime: config.runtime,
    tier,
    overrides: config.model_profile_overrides,
  });
}

function resolveModelInternal(cwd, agentType) {
  const config = loadConfig(cwd);

  // 1. Per-agent override — always respected; highest precedence.
  // Users who set fully-qualified model IDs (e.g., "openai/gpt-5.4") get exactly that.
  const override = config.model_overrides?.[agentType];
  if (override) {
    return override;
  }

  // 2. Compute the tier (opus/sonnet/haiku) for this agent under the active profile.
  const profile = String(config.model_profile || 'balanced').toLowerCase();
  const agentModels = MODEL_PROFILES[agentType];
  const tier = agentModels ? (agentModels[profile] || agentModels['balanced']) : null;

  // 3. Runtime-aware resolution (#2517) — only when `runtime` is explicitly set
  // to a non-Claude runtime. `runtime: "claude"` is the implicit default and is
  // treated as a no-op here so it does not silently override `resolve_model_ids:
  // "omit"` (review finding #4). Deliberate ordering for non-Claude runtimes:
  // explicit opt-in beats `resolve_model_ids: "omit"` so users on Codex installs
  // that auto-set "omit" can still flip on tiered behavior by setting runtime
  // alone. inherit profile is preserved verbatim.
  if (config.runtime && config.runtime !== 'claude' && profile !== 'inherit' && tier) {
    const entry = _resolveRuntimeTier(config, tier);
    if (entry?.model) return entry.model;
    // Unknown runtime with no user-supplied overrides — fall through to Claude-safe
    // default rather than emit an ID the runtime can't accept.
  }

  // 4. resolve_model_ids: "omit" — return empty string so the runtime uses its
  // configured default model. For non-Claude runtimes (OpenCode, Codex, etc.) that
  // don't recognize Claude aliases. Set automatically during install. See #1156.
  if (config.resolve_model_ids === 'omit') {
    return '';
  }

  // 5. Profile lookup (Claude-native default).
  if (!agentModels) return 'sonnet';
  if (profile === 'inherit') return 'inherit';
  // `tier` is guaranteed truthy here: agentModels exists, and MODEL_PROFILES
  // entries always define `balanced`, so `agentModels[profile] || agentModels.balanced`
  // resolves to a string. Keep the local for readability — no defensive fallback.
  const alias = tier;

  // resolve_model_ids: true — map alias to full Claude model ID.
  // Prevents 404s when the Task tool passes aliases directly to the API.
  if (config.resolve_model_ids) {
    return MODEL_ALIAS_MAP[alias] || alias;
  }

  return alias;
}

/**
 * #2517 — Resolve runtime-specific reasoning_effort for an agent.
 * Returns null unless:
 *   - `runtime` is explicitly set in config,
 *   - the runtime supports reasoning_effort (currently: codex),
 *   - profile is not 'inherit',
 *   - the resolved tier entry has a `reasoning_effort` value.
 *
 * Never returns a value for Claude — keeps reasoning_effort out of Claude spawn paths.
 */
function resolveReasoningEffortInternal(cwd, agentType) {
  const config = loadConfig(cwd);
  if (!config.runtime) return null;
  // Strict allowlist: reasoning_effort only propagates for runtimes whose
  // install path actually accepts it. Adding a new runtime here is the only
  // way to enable effort propagation — overrides cannot bypass the gate.
  // Without this, a typo in `runtime` (e.g. `"codx"`) plus a user override
  // for that typo would leak `xhigh` into a Claude or unknown install
  // (review finding #3).
  if (!RUNTIMES_WITH_REASONING_EFFORT.has(config.runtime)) return null;
  // Per-agent override means user supplied a fully-qualified ID; reasoning_effort
  // for that case must be set via per-agent mechanism, not tier inference.
  if (config.model_overrides?.[agentType]) return null;

  const profile = String(config.model_profile || 'balanced').toLowerCase();
  if (profile === 'inherit') return null;
  const agentModels = MODEL_PROFILES[agentType];
  if (!agentModels) return null;
  const tier = agentModels[profile] || agentModels['balanced'];
  if (!tier) return null;

  const entry = _resolveRuntimeTier(config, tier);
  return entry?.reasoning_effort || null;
}

// ─── Summary body helpers ─────────────────────────────────────────────────

/**
 * Extract a one-liner from the summary body when it's not in frontmatter.
 * The summary template defines one-liner as a bold markdown line after the heading:
 *   # Phase X: Name Summary
 *   **[substantive one-liner text]**
 */
function extractOneLinerFromBody(content) {
  if (!content) return null;
  // Normalize EOLs so matching works for LF and CRLF files.
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Strip frontmatter first
  const body = normalized.replace(/^---\n[\s\S]*?\n---\n*/, '');
  // Find the first **...** span on a line after a # heading.
  // Two supported template forms:
  //   1) Labeled:  **One-liner:** Real prose here.   (bug #2660 — new template)
  //   2) Bare:     **Real prose here.**              (legacy template)
  // For (1), the first bold span ends in a colon and the prose that follows
  // on the same line is the one-liner. For (2), the bold span itself is the
  // one-liner.
  const match = body.match(/^#[^\n]*\n+\*\*([^*\n]+)\*\*([^\n]*)/m);
  if (!match) return null;
  const boldInner = match[1].trim();
  const afterBold = match[2];
  // Labeled form: bold span is a "Label:" prefix — capture prose after it.
  if (/:\s*$/.test(boldInner)) {
    const prose = afterBold.trim();
    return prose.length > 0 ? prose : null;
  }
  // Bare form: the bold content itself is the one-liner.
  return boldInner.length > 0 ? boldInner : null;
}

// ─── Misc utilities ───────────────────────────────────────────────────────────

function pathExistsInternal(cwd, targetPath) {
  const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);
  try {
    fs.statSync(fullPath);
    return true;
  } catch {
    return false;
  }
}

function generateSlugInternal(text) {
  if (!text) return null;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60);
}

function getMilestoneInfo(cwd) {
  try {
    const roadmap = fs.readFileSync(path.join(planningDir(cwd), 'ROADMAP.md'), 'utf-8');

    // 0. Prefer STATE.md milestone: frontmatter as the authoritative source.
    // This prevents falling through to a regex that may match an old heading
    // when the active milestone's 🚧 marker is inside a <summary> tag without
    // **bold** formatting (bug #2409).
    let stateVersion = null;
    if (cwd) {
      try {
        const statePath = path.join(planningDir(cwd), 'STATE.md');
        if (fs.existsSync(statePath)) {
          const stateRaw = fs.readFileSync(statePath, 'utf-8');
          const m = stateRaw.match(/^milestone:\s*(.+)/m);
          if (m) stateVersion = m[1].trim();
        }
      } catch { /* intentionally empty */ }
    }

    if (stateVersion) {
      // Look up the name for this version in ROADMAP.md
      const escapedVer = escapeRegex(stateVersion);
      // Match heading-format: ## Roadmap v2.9: Name  or  ## v2.9 Name
      const headingMatch = roadmap.match(
        new RegExp(`##[^\\n]*${escapedVer}[:\\s]+([^\\n(]+)`, 'i')
      );
      if (headingMatch) {
        // If the heading line contains ✅ the milestone is already shipped.
        // Fall through to normal detection so the NEW active milestone is returned
        // instead of the stale shipped one still recorded in STATE.md.
        if (!headingMatch[0].includes('✅')) {
          return { version: stateVersion, name: headingMatch[1].trim() };
        }
        // Shipped milestone — do not early-return; fall through to normal detection below.
      } else {
        // Match list-format: 🚧 **v2.9 Name** or 🚧 v2.9 Name
        const listMatch = roadmap.match(
          new RegExp(`🚧\\s*\\*?\\*?${escapedVer}\\s+([^*\\n]+)`, 'i')
        );
        if (listMatch) {
          return { version: stateVersion, name: listMatch[1].trim() };
        }
        // Version found in STATE.md but no name match in ROADMAP — return bare version
        return { version: stateVersion, name: 'milestone' };
      }
    }

    // First: check for list-format roadmaps using 🚧 (in-progress) marker
    // e.g. "- 🚧 **v2.1 Belgium** — Phases 24-28 (in progress)"
    // e.g. "- 🚧 **v1.2.1 Tech Debt** — Phases 1-8 (in progress)"
    const inProgressMatch = roadmap.match(/🚧\s*\*\*v(\d+(?:\.\d+)+)\s+([^*]+)\*\*/);
    if (inProgressMatch) {
      return {
        version: 'v' + inProgressMatch[1],
        name: inProgressMatch[2].trim(),
      };
    }

    // Second: heading-format roadmaps — strip shipped milestones.
    // <details> blocks are stripped by stripShippedMilestones; heading-format ✅ markers
    // are excluded by the negative lookahead below so a stale STATE.md version (or any
    // shipped ✅ heading) never wins over the first non-shipped milestone heading.
    const cleaned = stripShippedMilestones(roadmap);
    // Negative lookahead skips headings that contain ✅ (shipped milestone marker).
    // Supports 2+ segment versions: v1.2, v1.2.1, v2.0.1, etc.
    const headingMatch = cleaned.match(/## (?!.*✅).*v(\d+(?:\.\d+)+)[:\s]+([^\n(]+)/);
    if (headingMatch) {
      return {
        version: 'v' + headingMatch[1],
        name: headingMatch[2].trim(),
      };
    }
    // Fallback: try bare version match (greedy — capture longest version string)
    const versionMatch = cleaned.match(/v(\d+(?:\.\d+)+)/);
    return {
      version: versionMatch ? versionMatch[0] : 'v1.0',
      name: 'milestone',
    };
  } catch {
    return { version: 'v1.0', name: 'milestone' };
  }
}

/**
 * Returns a filter function that checks whether a phase directory belongs
 * to the current milestone based on ROADMAP.md phase headings.
 * If no ROADMAP exists or no phases are listed, returns a pass-all filter.
 */
function getMilestonePhaseFilter(cwd) {
  const milestonePhaseNums = new Set();
  try {
    const roadmap = extractCurrentMilestone(fs.readFileSync(path.join(planningDir(cwd), 'ROADMAP.md'), 'utf-8'), cwd);
    // Match both numeric phases (Phase 1:) and custom IDs (Phase PROJ-42:)
    const phasePattern = /#{2,4}\s*Phase\s+([\w][\w.-]*)\s*:/gi;
    let m;
    while ((m = phasePattern.exec(roadmap)) !== null) {
      milestonePhaseNums.add(m[1]);
    }
  } catch { /* intentionally empty */ }

  if (milestonePhaseNums.size === 0) {
    const passAll = () => true;
    passAll.phaseCount = 0;
    return passAll;
  }

  const normalized = new Set(
    [...milestonePhaseNums].map(n => (n.replace(/^0+(?=\d)/, '') || '0').toLowerCase())
  );

  function isDirInMilestone(dirName) {
    // Try numeric match first
    const m = dirName.match(/^0*(\d+[A-Za-z]?(?:\.\d+)*)/);
    if (m && normalized.has(m[1].toLowerCase())) return true;
    // Try custom ID match (e.g. PROJ-42-description → PROJ-42)
    const customMatch = dirName.match(/^([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*)/);
    if (customMatch && normalized.has(customMatch[1].toLowerCase())) return true;
    return false;
  }
  isDirInMilestone.phaseCount = milestonePhaseNums.size;
  return isDirInMilestone;
}

// ─── Phase file helpers ──────────────────────────────────────────────────────

/** Filter a file list to just PLAN.md / *-PLAN.md entries. */
function filterPlanFiles(files) {
  return files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
}

/** Filter a file list to just SUMMARY.md / *-SUMMARY.md entries. */
function filterSummaryFiles(files) {
  return files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
}

/**
 * Read a phase directory and return counts/flags for common file types.
 * Returns an object with plans[], summaries[], and boolean flags for
 * research/context/verification files.
 */
function getPhaseFileStats(phaseDir) {
  const files = fs.readdirSync(phaseDir);
  return {
    plans: filterPlanFiles(files),
    summaries: filterSummaryFiles(files),
    hasResearch: files.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md'),
    hasContext: files.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md'),
    hasVerification: files.some(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md'),
    hasReviews: files.some(f => f.endsWith('-REVIEWS.md') || f === 'REVIEWS.md'),
  };
}

/**
 * Read immediate child directories from a path.
 * Returns [] if the path doesn't exist or can't be read.
 * Pass sort=true to apply comparePhaseNum ordering.
 */
function readSubdirectories(dirPath, sort = false) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    return sort ? dirs.sort((a, b) => comparePhaseNum(a, b)) : dirs;
  } catch {
    return [];
  }
}

// ─── Atomic file writes ───────────────────────────────────────────────────────

/**
 * Write a file atomically using write-to-temp-then-rename.
 *
 * On POSIX systems, `fs.renameSync` is atomic when the source and destination
 * are on the same filesystem. This prevents a process killed mid-write from
 * leaving a truncated file that is unparseable on next read.
 *
 * The temp file is placed alongside the target so it is guaranteed to be on
 * the same filesystem (required for rename atomicity). The PID is embedded in
 * the temp file name so concurrent writers use distinct paths.
 *
 * If `renameSync` fails (e.g. cross-device move), the function falls back to a
 * direct `writeFileSync` so callers always get a best-effort write.
 *
 * @param {string} filePath  Absolute path to write.
 * @param {string|Buffer} content  File content.
 * @param {string} [encoding='utf-8']  Encoding passed to writeFileSync.
 */
function atomicWriteFileSync(filePath, content, encoding = 'utf-8') {
  const tmpPath = filePath + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmpPath, content, encoding);
    fs.renameSync(tmpPath, filePath);
  } catch (renameErr) {
    // Clean up the temp file if rename failed, then fall back to direct write.
    try { fs.unlinkSync(tmpPath); } catch { /* already gone or never created */ }
    fs.writeFileSync(filePath, content, encoding);
  }
}

/**
 * Format a Date as a fuzzy relative time string (e.g. "5 minutes ago").
 * @param {Date} date
 * @returns {string}
 */
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(days / 365);
  if (years === 1) return '1 year ago';
  return `${years} years ago`;
}

module.exports = {
  output,
  error,
  safeReadFile,
  loadConfig,
  isGitIgnored,
  execGit,
  normalizeMd,
  escapeRegex,
  normalizePhaseName,
  comparePhaseNum,
  searchPhaseInDir,
  extractPhaseToken,
  phaseTokenMatches,
  findPhaseInternal,
  getArchivedPhaseDirs,
  getRoadmapPhaseInternal,
  resolveModelInternal,
  resolveReasoningEffortInternal,
  RUNTIME_PROFILE_MAP,
  RUNTIMES_WITH_REASONING_EFFORT,
  KNOWN_RUNTIMES,
  RUNTIME_OVERRIDE_TIERS,
  resolveTierEntry,
  _resetRuntimeWarningCacheForTests,
  pathExistsInternal,
  generateSlugInternal,
  getMilestoneInfo,
  getMilestonePhaseFilter,
  stripShippedMilestones,
  extractCurrentMilestone,
  replaceInCurrentMilestone,
  toPosixPath,
  extractOneLinerFromBody,
  resolveWorktreeRoot,
  withPlanningLock,
  findProjectRoot,
  detectSubRepos,
  reapStaleTempFiles,
  GSD_TEMP_DIR,
  MODEL_ALIAS_MAP,
  CONFIG_DEFAULTS,
  planningDir,
  planningRoot,
  planningPaths,
  getActiveWorkstream,
  setActiveWorkstream,
  filterPlanFiles,
  filterSummaryFiles,
  getPhaseFileStats,
  readSubdirectories,
  getAgentsDir,
  checkAgentsInstalled,
  atomicWriteFileSync,
  timeAgo,
  pruneOrphanedWorktrees,
};
