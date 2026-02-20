#!/usr/bin/env node

/**
 * GSD Tools — CLI utility for GSD workflow operations
 *
 * Replaces repetitive inline bash patterns across ~50 GSD command/workflow/agent files.
 * Centralizes: config parsing, model resolution, phase lookup, git commits, summary verification.
 *
 * Usage: node gsd-tools.js <command> [args] [--raw]
 *
 * Atomic Commands:
 *   state load                         Load project config + state
 *   state update <field> <value>       Update a STATE.md field
 *   state get [section]                Get STATE.md content or section
 *   state patch --field val ...        Batch update STATE.md fields
 *   resolve-model <agent-type>         Get model for agent based on profile
 *   find-phase <phase>                 Find phase directory by number
 *   commit <message> [--files f1 f2]   Commit planning docs
 *   verify-summary <path>              Verify a SUMMARY.md file
 *   generate-slug <text>               Convert text to URL-safe slug
 *   current-timestamp [format]         Get timestamp (full|date|filename)
 *   list-todos [area]                  Count and enumerate pending todos
 *   verify-path-exists <path>          Check file/directory existence
 *   config-ensure-section              Initialize .planning/config.json
 *   history-digest                     Aggregate all SUMMARY.md data
 *   summary-extract <path> [--fields]  Extract structured data from SUMMARY.md
 *   state-snapshot                     Structured parse of STATE.md
 *   phase-plan-index <phase>           Index plans with waves and status
 *   websearch <query>                  Search web via Brave API (if configured)
 *     [--limit N] [--freshness day|week|month]
 *
 * Phase Operations:
 *   phase next-decimal <phase>         Calculate next decimal phase number
 *   phase add <description>            Append new phase to roadmap + create dir
 *   phase insert <after> <description> Insert decimal phase after existing
 *   phase remove <phase> [--force]     Remove phase, renumber all subsequent
 *   phase complete <phase>             Mark phase done, update state + roadmap
 *
 * Roadmap Operations:
 *   roadmap get-phase <phase>          Extract phase section from ROADMAP.md
 *   roadmap analyze                    Full roadmap parse with disk status
 *   roadmap update-plan-progress <N>   Update progress table row from disk (PLAN vs SUMMARY counts)
 *
 * Requirements Operations:
 *   requirements mark-complete <ids>   Mark requirement IDs as complete in REQUIREMENTS.md
 *
 * Milestone Operations:
 *   milestone complete <version>       Archive milestone, create MILESTONES.md
 *     [--name <name>]
 *
 * Validation:
 *   validate consistency               Check phase numbering, disk/roadmap sync
 *
 * Progress:
 *   progress [json|table|bar]          Render progress in various formats
 *
 * Todos:
 *   todo complete <filename>           Move todo from pending to completed
 *
 * Scaffolding:
 *   scaffold context --phase <N>       Create CONTEXT.md template
 *   scaffold uat --phase <N>           Create UAT.md template
 *   scaffold verification --phase <N>  Create VERIFICATION.md template
 *   scaffold phase-dir --phase <N>     Create phase directory
 *     --name <name>
 *
 * Frontmatter CRUD:
 *   frontmatter get <file> [--field k] Extract frontmatter as JSON
 *   frontmatter set <file> --field k   Update single frontmatter field
 *     --value jsonVal
 *   frontmatter merge <file>           Merge JSON into frontmatter
 *     --data '{json}'
 *   frontmatter validate <file>        Validate required fields
 *     --schema plan|summary|verification
 *
 * Verification Suite:
 *   verify plan-structure <file>       Check PLAN.md structure + tasks
 *   verify phase-completeness <phase>  Check all plans have summaries
 *   verify references <file>           Check @-refs + paths resolve
 *   verify commits <h1> [h2] ...      Batch verify commit hashes
 *   verify artifacts <plan-file>       Check must_haves.artifacts
 *   verify key-links <plan-file>       Check must_haves.key_links
 *
 * Template Fill:
 *   template fill summary --phase N    Create pre-filled SUMMARY.md
 *     [--plan M] [--name "..."]
 *     [--fields '{json}']
 *   template fill plan --phase N       Create pre-filled PLAN.md
 *     [--plan M] [--type execute|tdd]
 *     [--wave N] [--fields '{json}']
 *   template fill verification         Create pre-filled VERIFICATION.md
 *     --phase N [--fields '{json}']
 *
 * State Progression:
 *   state advance-plan                 Increment plan counter
 *   state record-metric --phase N      Record execution metrics
 *     --plan M --duration Xmin
 *     [--tasks N] [--files N]
 *   state update-progress              Recalculate progress bar
 *   state add-decision --summary "..."  Add decision to STATE.md
 *     [--phase N] [--rationale "..."]
 *   state add-blocker --text "..."     Add blocker
 *   state resolve-blocker --text "..." Remove blocker
 *   state record-session               Update session continuity
 *     --stopped-at "..."
 *     [--resume-file path]
 *
 * Quota Operations:
 *   quota status                       Show current quota usage
 *   quota status-bar [--json]          Format status bar string
 *   quota stats [--table]              Show detailed session statistics
 *   quota record <id> <model>          Record task usage
 *     <tokens_in> <tokens_out>
 *   quota reset                        Reset quota state
 *   quota update-from-headers <json>   Update from API headers
 *   quota check                        Check warnings and wait status
 *   quota wait                         Check if should wait for quota
 *
 * Knowledge Operations:
 *   knowledge status [--scope project|global]   Show knowledge DB status
 *   knowledge add <content> --type <type>       Add knowledge entry
 *     [--scope project|global]
 *     [--ttl permanent|long_term|short_term|ephemeral]
 *   knowledge search <query>                    Search knowledge
 *     [--scope project|global] [--limit N]
 *   knowledge get <id> [--scope project|global] Get knowledge by ID
 *   knowledge delete <id>                       Delete knowledge entry
 *     [--scope project|global]
 *   knowledge cleanup [--scope project|global]  Remove expired entries
 *   knowledge prune [--dry-run]                  Prune stale low-utility entries
 *     [--scope project|global]
 *     [--threshold N]                            Staleness threshold 0.0-1.0 (default 0.7)
 *   knowledge stats [--scope project|global]    Show access statistics
 *
 * Session Analysis:
 *   analyze-session <path>                      Prepare session for Haiku analysis
 *   historical-extract <path>                   Extract knowledge from existing project
 *   analysis-status                             Show analysis statistics
 *   list-pending-sessions                       Find sessions awaiting Haiku analysis
 *   store-analysis-result <id> <json>           Store Haiku extraction results
 *   mine-conversations                          Discover and prepare conversation mining
 *     [--max-age-days N] [--include-subagents] [--limit N] [--all-projects]
 *   store-conversation-result <id> <json>       Store conversation mining results
 *     [--content-hash <hash>]
 *   migrate-knowledge                           Migrate per-project DBs to global DB
 *   query-knowledge <question> [--project <slug>]  Search global knowledge DB (top 5 JSON)
 *
 * Compound Commands (workflow-specific initialization):
 *   init execute-phase <phase>         All context for execute-phase workflow
 *   init plan-phase <phase>            All context for plan-phase workflow
 *   init new-project                   All context for new-project workflow
 *   init new-milestone                 All context for new-milestone workflow
 *   init quick <description>           All context for quick workflow
 *   init resume                        All context for resume-project workflow
 *   init verify-work <phase>           All context for verify-work workflow
 *   init phase-op <phase>              Generic phase operation context
 *   init todos [area]                  All context for todo workflows
 *   init milestone-op                  All context for milestone operations
 *   init map-codebase                  All context for map-codebase workflow
 *   init progress                      All context for progress workflow
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { EVENT_TYPES, initLog, appendEvent, getHistory, getCurrentPhase, getLastCheckpoint, getExecutionStats, needsResume, getResumeContext, markResumed, getPhaseTimeline } = require('./execution-log.js');
const { parseRoadmap, buildDAG, getExecutionOrder, detectParallelOpportunities } = require('./roadmap-parser.js');
const { TokenBudgetMonitor } = require('./token-monitor.js');
const { FailureHandler, executeWithRetry } = require('./failure-handler.js');
const { CompletionSignal, COMPLETION_STATUS } = require('./completion-signal.js');
const { TaskChunker, BatchCoordinator, analyzeTask, estimateTaskTokens } = require('./task-chunker.js');
const { estimatePhaseSize, detectOversizedPhases, recommendSplit, validateSplitPreservesDependencies, LIMITS: PHASE_LIMITS } = require('./phase-sizer.js');
const { ParallelPhaseExecutor, analyzeParallelOpportunities: analyzeParallel, CONFIG: PARALLEL_CONFIG } = require('./parallel-executor.js');

// Phase 2: Auto Mode safety modules (lazy — gracefully absent if not installed)
let circuitBreaker, validator, escalation, feedback, learning;
try { circuitBreaker = require('./gsd-circuit-breaker'); } catch (e) { circuitBreaker = null; }
try { validator = require('./gsd-validator'); } catch (e) { validator = null; }
try { escalation = require('./gsd-escalation'); } catch (e) { escalation = null; }
try { feedback = require('./gsd-feedback'); } catch (e) { feedback = null; }
try { learning = require('./gsd-learning'); } catch (e) { learning = null; }

// Load environment variables from project root .env
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });

// ─── Model Profile Table ─────────────────────────────────────────────────────

const MODEL_PROFILES = {
  'gsd-planner':              { quality: 'opus', balanced: 'opus',   budget: 'sonnet', auto: 'sonnet' },
  'gsd-roadmapper':           { quality: 'opus', balanced: 'sonnet', budget: 'sonnet', auto: 'sonnet' },
  'gsd-executor':             { quality: 'opus', balanced: 'sonnet', budget: 'sonnet', auto: 'sonnet' },
  'gsd-phase-researcher':     { quality: 'opus', balanced: 'sonnet', budget: 'haiku',  auto: 'sonnet' },
  'gsd-project-researcher':   { quality: 'opus', balanced: 'sonnet', budget: 'haiku',  auto: 'sonnet' },
  'gsd-research-synthesizer': { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', auto: 'sonnet' },
  'gsd-debugger':             { quality: 'opus', balanced: 'sonnet', budget: 'sonnet', auto: 'sonnet' },
  'gsd-codebase-mapper':      { quality: 'sonnet', balanced: 'haiku', budget: 'haiku', auto: 'haiku'  },
  'gsd-verifier':             { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', auto: 'sonnet' },
  'gsd-plan-checker':         { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', auto: 'sonnet' },
  'gsd-integration-checker':  { quality: 'sonnet', balanced: 'sonnet', budget: 'haiku', auto: 'sonnet' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseIncludeFlag(args) {
  const includeIndex = args.indexOf('--include');
  if (includeIndex === -1) return new Set();
  const includeValue = args[includeIndex + 1];
  if (!includeValue) return new Set();
  return new Set(includeValue.split(',').map(s => s.trim()));
}

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function loadConfig(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const defaults = {
    model_profile: 'balanced',
    commit_docs: true,
    search_gitignored: false,
    branching_strategy: 'none',
    phase_branch_template: 'gsd/phase-{phase}-{slug}',
    milestone_branch_template: 'feature/{slug}',
    research: true,
    plan_checker: true,
    verifier: true,
    parallelization: true,
    brave_search: false,
  };

  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);

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
      commit_docs: get('commit_docs', { section: 'planning', field: 'commit_docs' }) ?? defaults.commit_docs,
      search_gitignored: get('search_gitignored', { section: 'planning', field: 'search_gitignored' }) ?? defaults.search_gitignored,
      branching_strategy: get('branching_strategy', { section: 'git', field: 'branching_strategy' }) ?? defaults.branching_strategy,
      phase_branch_template: get('phase_branch_template', { section: 'git', field: 'phase_branch_template' }) ?? defaults.phase_branch_template,
      milestone_branch_template: get('milestone_branch_template', { section: 'git', field: 'milestone_branch_template' }) ?? defaults.milestone_branch_template,
      research: get('research', { section: 'workflow', field: 'research' }) ?? defaults.research,
      plan_checker: get('plan_checker', { section: 'workflow', field: 'plan_check' }) ?? defaults.plan_checker,
      verifier: get('verifier', { section: 'workflow', field: 'verifier' }) ?? defaults.verifier,
      parallelization,
      brave_search: get('brave_search') ?? defaults.brave_search,
      coordinator_model: get('coordinator_model') ?? null,
    };
  } catch {
    return defaults;
  }
}

function isGitIgnored(cwd, targetPath) {
  try {
    execSync('git check-ignore -q -- ' + targetPath.replace(/[^a-zA-Z0-9._\-/]/g, ''), {
      cwd,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function execGit(cwd, args) {
  try {
    const escaped = args.map(a => {
      if (/^[a-zA-Z0-9._\-/=:@]+$/.test(a)) return a;
      return "'" + a.replace(/'/g, "'\\''") + "'";
    });
    const stdout = execSync('git ' + escaped.join(' '), {
      cwd,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status ?? 1,
      stdout: (err.stdout ?? '').toString().trim(),
      stderr: (err.stderr ?? '').toString().trim(),
    };
  }
}

function normalizePhaseName(phase) {
  const match = phase.match(/^(\d+(?:\.\d+)?)/);
  if (!match) return phase;
  const num = match[1];
  const parts = num.split('.');
  const padded = parts[0].padStart(2, '0');
  return parts.length > 1 ? `${padded}.${parts[1]}` : padded;
}

function extractFrontmatter(content) {
  const frontmatter = {};
  const match = content.match(/^---\n([\s\S]+?)\n---/);
  if (!match) return frontmatter;

  const yaml = match[1];
  const lines = yaml.split('\n');

  // Stack to track nested objects: [{obj, key, indent}]
  // obj = object to write to, key = current key collecting array items, indent = indentation level
  let stack = [{ obj: frontmatter, key: null, indent: -1 }];

  for (const line of lines) {
    // Skip empty lines
    if (line.trim() === '') continue;

    // Calculate indentation (number of leading spaces)
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    // Pop stack back to appropriate level
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1];

    // Check for key: value pattern
    const keyMatch = line.match(/^(\s*)([a-zA-Z0-9_-]+):\s*(.*)/);
    if (keyMatch) {
      const key = keyMatch[2];
      const value = keyMatch[3].trim();

      if (value === '' || value === '[') {
        // Key with no value or opening bracket — could be nested object or array
        // We'll determine based on next lines, for now create placeholder
        current.obj[key] = value === '[' ? [] : {};
        current.key = null;
        // Push new context for potential nested content
        stack.push({ obj: current.obj[key], key: null, indent });
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Inline array: key: [a, b, c]
        current.obj[key] = value.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
        current.key = null;
      } else {
        // Simple key: value
        current.obj[key] = value.replace(/^["']|["']$/g, '');
        current.key = null;
      }
    } else if (line.trim().startsWith('- ')) {
      // Array item
      const itemValue = line.trim().slice(2).replace(/^["']|["']$/g, '');

      // If current context is an empty object, convert to array
      if (typeof current.obj === 'object' && !Array.isArray(current.obj) && Object.keys(current.obj).length === 0) {
        // Find the key in parent that points to this object and convert it
        const parent = stack.length > 1 ? stack[stack.length - 2] : null;
        if (parent) {
          for (const k of Object.keys(parent.obj)) {
            if (parent.obj[k] === current.obj) {
              parent.obj[k] = [itemValue];
              current.obj = parent.obj[k];
              break;
            }
          }
        }
      } else if (Array.isArray(current.obj)) {
        current.obj.push(itemValue);
      }
    }
  }

  return frontmatter;
}

function reconstructFrontmatter(obj) {
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else if (value.every(v => typeof v === 'string') && value.length <= 3 && value.join(', ').length < 60) {
        lines.push(`${key}: [${value.join(', ')}]`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${typeof item === 'string' && (item.includes(':') || item.includes('#')) ? `"${item}"` : item}`);
        }
      }
    } else if (typeof value === 'object') {
      lines.push(`${key}:`);
      for (const [subkey, subval] of Object.entries(value)) {
        if (subval === null || subval === undefined) continue;
        if (Array.isArray(subval)) {
          if (subval.length === 0) {
            lines.push(`  ${subkey}: []`);
          } else if (subval.every(v => typeof v === 'string') && subval.length <= 3 && subval.join(', ').length < 60) {
            lines.push(`  ${subkey}: [${subval.join(', ')}]`);
          } else {
            lines.push(`  ${subkey}:`);
            for (const item of subval) {
              lines.push(`    - ${typeof item === 'string' && (item.includes(':') || item.includes('#')) ? `"${item}"` : item}`);
            }
          }
        } else if (typeof subval === 'object') {
          lines.push(`  ${subkey}:`);
          for (const [subsubkey, subsubval] of Object.entries(subval)) {
            if (subsubval === null || subsubval === undefined) continue;
            if (Array.isArray(subsubval)) {
              if (subsubval.length === 0) {
                lines.push(`    ${subsubkey}: []`);
              } else {
                lines.push(`    ${subsubkey}:`);
                for (const item of subsubval) {
                  lines.push(`      - ${item}`);
                }
              }
            } else {
              lines.push(`    ${subsubkey}: ${subsubval}`);
            }
          }
        } else {
          const sv = String(subval);
          lines.push(`  ${subkey}: ${sv.includes(':') || sv.includes('#') ? `"${sv}"` : sv}`);
        }
      }
    } else {
      const sv = String(value);
      if (sv.includes(':') || sv.includes('#') || sv.startsWith('[') || sv.startsWith('{')) {
        lines.push(`${key}: "${sv}"`);
      } else {
        lines.push(`${key}: ${sv}`);
      }
    }
  }
  return lines.join('\n');
}

function spliceFrontmatter(content, newObj) {
  const yamlStr = reconstructFrontmatter(newObj);
  const match = content.match(/^---\n[\s\S]+?\n---/);
  if (match) {
    return `---\n${yamlStr}\n---` + content.slice(match[0].length);
  }
  return `---\n${yamlStr}\n---\n\n` + content;
}

function parseMustHavesBlock(content, blockName) {
  // Extract a specific block from must_haves in raw frontmatter YAML
  // Handles 3-level nesting: must_haves > artifacts/key_links > [{path, provides, ...}]
  const fmMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (!fmMatch) return [];

  const yaml = fmMatch[1];
  // Find the block (e.g., "truths:", "artifacts:", "key_links:")
  const blockPattern = new RegExp(`^\\s{4}${blockName}:\\s*$`, 'm');
  const blockStart = yaml.search(blockPattern);
  if (blockStart === -1) return [];

  const afterBlock = yaml.slice(blockStart);
  const blockLines = afterBlock.split('\n').slice(1); // skip the header line

  const items = [];
  let current = null;

  for (const line of blockLines) {
    // Stop at same or lower indent level (non-continuation)
    if (line.trim() === '') continue;
    const indent = line.match(/^(\s*)/)[1].length;
    if (indent <= 4 && line.trim() !== '') break; // back to must_haves level or higher

    if (line.match(/^\s{6}-\s+/)) {
      // New list item at 6-space indent
      if (current) items.push(current);
      current = {};
      // Check if it's a simple string item
      const simpleMatch = line.match(/^\s{6}-\s+"?([^"]+)"?\s*$/);
      if (simpleMatch && !line.includes(':')) {
        current = simpleMatch[1];
      } else {
        // Key-value on same line as dash: "- path: value"
        const kvMatch = line.match(/^\s{6}-\s+(\w+):\s*"?([^"]*)"?\s*$/);
        if (kvMatch) {
          current = {};
          current[kvMatch[1]] = kvMatch[2];
        }
      }
    } else if (current && typeof current === 'object') {
      // Continuation key-value at 8+ space indent
      const kvMatch = line.match(/^\s{8,}(\w+):\s*"?([^"]*)"?\s*$/);
      if (kvMatch) {
        const val = kvMatch[2];
        // Try to parse as number
        current[kvMatch[1]] = /^\d+$/.test(val) ? parseInt(val, 10) : val;
      }
      // Array items under a key
      const arrMatch = line.match(/^\s{10,}-\s+"?([^"]+)"?\s*$/);
      if (arrMatch) {
        // Find the last key added and convert to array
        const keys = Object.keys(current);
        const lastKey = keys[keys.length - 1];
        if (lastKey && !Array.isArray(current[lastKey])) {
          current[lastKey] = current[lastKey] ? [current[lastKey]] : [];
        }
        if (lastKey) current[lastKey].push(arrMatch[1]);
      }
    }
  }
  if (current) items.push(current);

  return items;
}

function output(result, raw, rawValue) {
  const outputStr = raw && rawValue !== undefined
    ? String(rawValue)
    : JSON.stringify(result, null, 2);

  // For large outputs piped to another process, use a temp file to avoid
  // pipe buffer limits causing data truncation
  const LARGE_OUTPUT_THRESHOLD = 100 * 1024; // 100KB

  if (outputStr.length > LARGE_OUTPUT_THRESHOLD && !process.stdout.isTTY) {
    // Large output being piped - use temp file to prevent truncation
    const os = require('os');
    const tempFile = path.join(os.tmpdir(), `gsd-output-${process.pid}.json`);

    try {
      fs.writeFileSync(tempFile, outputStr, 'utf-8');
      // Use cat to pipe the file contents - this avoids buffer limits
      execSync(`cat "${tempFile}"`, { stdio: 'inherit' });
      // Clean up temp file
      fs.unlinkSync(tempFile);
    } catch (err) {
      // Fallback to direct write if temp file approach fails
      process.stdout.write(outputStr);
    }
  } else {
    // Normal sized output or terminal output - write directly
    process.stdout.write(outputStr);
  }

  process.exit(0);
}

function error(message) {
  process.stderr.write('Error: ' + message + '\n');
  process.exit(1);
}

// ─── Quota Tracking ───────────────────────────────────────────────────────────

const DEFAULT_QUOTA_STATE = {
  session: {
    tokens_used: 0,
    tokens_limit: 2000000, // Default ITPM limit
    reset_time: null,
    last_updated: null
  },
  weekly: {
    tokens_used: 0,
    tokens_limit: 100000000, // Default weekly estimate
    reset_time: null,
    last_updated: null
  },
  tasks: [],  // Array of { task_id, model, tokens_in, tokens_out, timestamp }
  warnings_shown: {
    session_80: false,
    weekly_80: false
  }
};

function getQuotaPath(cwd) {
  return path.join(cwd, '.planning', 'quota', 'session-usage.json');
}

function loadQuotaState(cwd) {
  const quotaPath = getQuotaPath(cwd);
  if (!fs.existsSync(quotaPath)) {
    return { ...DEFAULT_QUOTA_STATE };
  }
  try {
    return JSON.parse(fs.readFileSync(quotaPath, 'utf-8'));
  } catch {
    return { ...DEFAULT_QUOTA_STATE };
  }
}

function saveQuotaState(cwd, state) {
  const quotaPath = getQuotaPath(cwd);
  fs.mkdirSync(path.dirname(quotaPath), { recursive: true });
  fs.writeFileSync(quotaPath, JSON.stringify(state, null, 2));
}

function parseQuotaHeaders(headers) {
  // Headers from Claude API (as documented)
  // Note: In practice, headers may come as object or need parsing
  return {
    input: {
      remaining: parseInt(headers['anthropic-ratelimit-input-tokens-remaining'] || '0'),
      limit: parseInt(headers['anthropic-ratelimit-input-tokens-limit'] || '2000000'),
      reset: headers['anthropic-ratelimit-input-tokens-reset'] || null
    },
    output: {
      remaining: parseInt(headers['anthropic-ratelimit-output-tokens-remaining'] || '0'),
      limit: parseInt(headers['anthropic-ratelimit-output-tokens-limit'] || '500000'),
      reset: headers['anthropic-ratelimit-output-tokens-reset'] || null
    }
  };
}

function recordTaskUsage(cwd, taskId, model, tokensIn, tokensOut) {
  const state = loadQuotaState(cwd);

  // Add to tasks array
  state.tasks.push({
    task_id: taskId,
    model: model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    timestamp: new Date().toISOString()
  });

  // Update session totals
  state.session.tokens_used += tokensIn + tokensOut;
  state.session.last_updated = new Date().toISOString();

  // Update weekly totals
  state.weekly.tokens_used += tokensIn + tokensOut;
  state.weekly.last_updated = new Date().toISOString();

  saveQuotaState(cwd, state);
  return state;
}

function checkQuotaWarning(cwd) {
  const state = loadQuotaState(cwd);
  const warnings = [];

  const sessionPercent = state.session.tokens_limit > 0
    ? (state.session.tokens_used / state.session.tokens_limit) * 100
    : 0;
  const weeklyPercent = state.weekly.tokens_limit > 0
    ? (state.weekly.tokens_used / state.weekly.tokens_limit) * 100
    : 0;

  // 80% session warning (only show once per session)
  if (sessionPercent >= 80 && !state.warnings_shown.session_80) {
    warnings.push({
      type: 'session',
      level: 'warning',
      message: `Session quota at ${sessionPercent.toFixed(1)}%`,
      percent: sessionPercent
    });
    state.warnings_shown.session_80 = true;
    saveQuotaState(cwd, state);
  }

  // 80% weekly warning
  if (weeklyPercent >= 80 && !state.warnings_shown.weekly_80) {
    warnings.push({
      type: 'weekly',
      level: 'warning',
      message: `Weekly quota at ${weeklyPercent.toFixed(1)}%`,
      percent: weeklyPercent
    });
    state.warnings_shown.weekly_80 = true;
    saveQuotaState(cwd, state);
  }

  return warnings;
}

function checkQuotaAndWait(cwd) {
  const state = loadQuotaState(cwd);

  const sessionPercent = state.session.tokens_limit > 0
    ? (state.session.tokens_used / state.session.tokens_limit) * 100
    : 0;
  const weeklyPercent = state.weekly.tokens_limit > 0
    ? (state.weekly.tokens_used / state.weekly.tokens_limit) * 100
    : 0;

  const result = {
    should_wait: false,
    wait_type: null,
    wait_until: null,
    wait_seconds: 0,
    percent: 0
  };

  // Check session quota (98-99% threshold per user decision)
  if (sessionPercent >= 98 && state.session.reset_time) {
    const resetTime = new Date(state.session.reset_time);
    const waitMs = Math.max(0, resetTime.getTime() - Date.now());
    result.should_wait = true;
    result.wait_type = 'session';
    result.wait_until = state.session.reset_time;
    result.wait_seconds = Math.ceil(waitMs / 1000) + 5; // +5s buffer
    result.percent = sessionPercent;
  }

  // Check weekly quota
  if (weeklyPercent >= 98 && state.weekly.reset_time) {
    const resetTime = new Date(state.weekly.reset_time);
    const waitMs = Math.max(0, resetTime.getTime() - Date.now());
    // If weekly wait is longer than session wait, use weekly
    if (!result.should_wait || waitMs > result.wait_seconds * 1000) {
      result.should_wait = true;
      result.wait_type = 'weekly';
      result.wait_until = state.weekly.reset_time;
      result.wait_seconds = Math.ceil(waitMs / 1000) + 5;
      result.percent = weeklyPercent;
    }
  }

  return result;
}

function formatStatusBar(quotaState) {
  // Calculate tokens delegated to smaller models
  const tasks = quotaState.tasks || [];
  const totalTokens = tasks.reduce((sum, t) => sum + t.tokens_in + t.tokens_out, 0);

  // Calculate model distribution
  const modelCounts = { haiku: 0, sonnet: 0, opus: 0 };
  for (const task of tasks) {
    const model = task.model.toLowerCase();
    if (modelCounts[model] !== undefined) {
      modelCounts[model] += task.tokens_in + task.tokens_out;
    }
  }

  const total = modelCounts.haiku + modelCounts.sonnet + modelCounts.opus || 1;
  const hPercent = Math.round((modelCounts.haiku / total) * 100);
  const sPercent = Math.round((modelCounts.sonnet / total) * 100);
  const oPercent = Math.round((modelCounts.opus / total) * 100);

  // Format token count (K for thousands)
  const tokensK = totalTokens >= 1000 ? `${Math.round(totalTokens / 1000)}K` : totalTokens;

  // Determine most recent model (for "→ Haiku" part)
  const lastTask = tasks[tasks.length - 1];
  const lastModel = lastTask ? lastTask.model : 'none';

  // Estimate time extension (rough: 1K tokens = ~30 seconds saved vs Opus)
  // Using haiku is ~10x cheaper than Opus, sonnet ~5x cheaper
  const haikuSavings = modelCounts.haiku * 0.9; // 90% savings vs opus
  const sonnetSavings = modelCounts.sonnet * 0.5; // 50% savings vs opus
  const savedTokenValue = haikuSavings + sonnetSavings;
  const savedMinutes = Math.round(savedTokenValue / 2000); // Rough estimate

  return `Tokens: ${tokensK} → ${lastModel} | +${savedMinutes} min | H:${hPercent}% S:${sPercent}% O:${oPercent}%`;
}

function getUsageStats(quotaState) {
  const tasks = quotaState.tasks || [];

  // Calculate per-model breakdown
  const models = { haiku: { tokens: 0, tasks: 0 }, sonnet: { tokens: 0, tasks: 0 }, opus: { tokens: 0, tasks: 0 } };
  for (const task of tasks) {
    const model = task.model.toLowerCase();
    if (models[model]) {
      models[model].tokens += task.tokens_in + task.tokens_out;
      models[model].tasks += 1;
    }
  }

  // Calculate estimated cost savings (rough estimates)
  // Opus: $15/M input, $75/M output
  // Sonnet: $3/M input, $15/M output
  // Haiku: $0.25/M input, $1.25/M output
  const opusCost = (models.opus.tokens / 1000000) * 45; // Avg of input/output
  const sonnetCost = (models.sonnet.tokens / 1000000) * 9;
  const haikuCost = (models.haiku.tokens / 1000000) * 0.75;

  // If all tasks were Opus
  const totalTokens = models.haiku.tokens + models.sonnet.tokens + models.opus.tokens;
  const allOpusCost = (totalTokens / 1000000) * 45;
  const actualCost = opusCost + sonnetCost + haikuCost;
  const savings = allOpusCost - actualCost;
  const savingsPercent = allOpusCost > 0 ? (savings / allOpusCost) * 100 : 0;

  return {
    session_total: {
      tokens: totalTokens,
      tasks: tasks.length,
      duration_minutes: tasks.length > 0
        ? Math.round((new Date() - new Date(tasks[0].timestamp)) / 60000)
        : 0
    },
    per_model: {
      haiku: models.haiku,
      sonnet: models.sonnet,
      opus: models.opus
    },
    cost_estimate: {
      actual_cost: `$${actualCost.toFixed(4)}`,
      if_all_opus: `$${allOpusCost.toFixed(4)}`,
      savings: `$${savings.toFixed(4)}`,
      savings_percent: `${savingsPercent.toFixed(1)}%`
    },
    quota: {
      session_used: quotaState.session.tokens_used,
      session_limit: quotaState.session.tokens_limit,
      session_percent: ((quotaState.session.tokens_used / quotaState.session.tokens_limit) * 100).toFixed(1) + '%',
      weekly_used: quotaState.weekly.tokens_used,
      weekly_limit: quotaState.weekly.tokens_limit,
      weekly_percent: ((quotaState.weekly.tokens_used / quotaState.weekly.tokens_limit) * 100).toFixed(1) + '%'
    }
  };
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmdGenerateSlug(text, raw) {
  if (!text) {
    error('text required for slug generation');
  }

  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const result = { slug };
  output(result, raw, slug);
}

function cmdCurrentTimestamp(format, raw) {
  const now = new Date();
  let result;

  switch (format) {
    case 'date':
      result = now.toISOString().split('T')[0];
      break;
    case 'filename':
      result = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
      break;
    case 'full':
    default:
      result = now.toISOString();
      break;
  }

  output({ timestamp: result }, raw, result);
}

function cmdListTodos(cwd, area, raw) {
  const pendingDir = path.join(cwd, '.planning', 'todos', 'pending');

  let count = 0;
  const todos = [];

  try {
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(pendingDir, file), 'utf-8');
        const createdMatch = content.match(/^created:\s*(.+)$/m);
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);

        const todoArea = areaMatch ? areaMatch[1].trim() : 'general';

        // Apply area filter if specified
        if (area && todoArea !== area) continue;

        count++;
        todos.push({
          file,
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: todoArea,
          path: path.join('.planning', 'todos', 'pending', file),
        });
      } catch {}
    }
  } catch {}

  const result = { count, todos };
  output(result, raw, count.toString());
}

function cmdVerifyPathExists(cwd, targetPath, raw) {
  if (!targetPath) {
    error('path required for verification');
  }

  const fullPath = path.isAbsolute(targetPath) ? targetPath : path.join(cwd, targetPath);

  try {
    const stats = fs.statSync(fullPath);
    const type = stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other';
    const result = { exists: true, type };
    output(result, raw, 'true');
  } catch {
    const result = { exists: false, type: null };
    output(result, raw, 'false');
  }
}

function cmdConfigEnsureSection(cwd, raw) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const planningDir = path.join(cwd, '.planning');

  // Ensure .planning directory exists
  try {
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }
  } catch (err) {
    error('Failed to create .planning directory: ' + err.message);
  }

  // Check if config already exists
  if (fs.existsSync(configPath)) {
    const result = { created: false, reason: 'already_exists' };
    output(result, raw, 'exists');
    return;
  }

  // Detect Brave Search API key availability
  const homedir = require('os').homedir();
  const braveKeyFile = path.join(homedir, '.gsd', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));

  // Create default config
  const defaults = {
    model_profile: 'balanced',
    commit_docs: true,
    search_gitignored: false,
    branching_strategy: 'none',
    phase_branch_template: 'gsd/phase-{phase}-{slug}',
    milestone_branch_template: 'feature/{slug}',
    workflow: {
      research: true,
      plan_check: true,
      verifier: true,
    },
    parallelization: true,
    brave_search: hasBraveSearch,
  };

  try {
    fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), 'utf-8');
    const result = { created: true, path: '.planning/config.json' };
    output(result, raw, 'created');
  } catch (err) {
    error('Failed to create config.json: ' + err.message);
  }
}

function cmdConfigSet(cwd, keyPath, value, raw) {
  const configPath = path.join(cwd, '.planning', 'config.json');

  if (!keyPath) {
    error('Usage: config-set <key.path> <value>');
  }

  // Parse value (handle booleans and numbers)
  let parsedValue = value;
  if (value === 'true') parsedValue = true;
  else if (value === 'false') parsedValue = false;
  else if (!isNaN(value) && value !== '') parsedValue = Number(value);

  // Load existing config or start with empty object
  let config = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (err) {
    error('Failed to read config.json: ' + err.message);
  }

  // Set nested value using dot notation (e.g., "workflow.research")
  const keys = keyPath.split('.');
  let current = config;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = parsedValue;

  // Write back
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    const result = { updated: true, key: keyPath, value: parsedValue };
    output(result, raw, `${keyPath}=${parsedValue}`);
  } catch (err) {
    error('Failed to write config.json: ' + err.message);
  }
}

function cmdHistoryDigest(cwd, raw) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const digest = { phases: {}, decisions: [], tech_stack: new Set() };

  if (!fs.existsSync(phasesDir)) {
    digest.tech_stack = [];
    output(digest, raw);
    return;
  }

  try {
    const phaseDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();

    for (const dir of phaseDirs) {
      const dirPath = path.join(phasesDir, dir);
      const summaries = fs.readdirSync(dirPath).filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');

      for (const summary of summaries) {
        try {
          const content = fs.readFileSync(path.join(dirPath, summary), 'utf-8');
          const fm = extractFrontmatter(content);
          
          const phaseNum = fm.phase || dir.split('-')[0];
          
          if (!digest.phases[phaseNum]) {
            digest.phases[phaseNum] = {
              name: fm.name || dir.split('-').slice(1).join(' ') || 'Unknown',
              provides: new Set(),
              affects: new Set(),
              patterns: new Set(),
            };
          }

          // Merge provides
          if (fm['dependency-graph'] && fm['dependency-graph'].provides) {
            fm['dependency-graph'].provides.forEach(p => digest.phases[phaseNum].provides.add(p));
          } else if (fm.provides) {
            fm.provides.forEach(p => digest.phases[phaseNum].provides.add(p));
          }

          // Merge affects
          if (fm['dependency-graph'] && fm['dependency-graph'].affects) {
            fm['dependency-graph'].affects.forEach(a => digest.phases[phaseNum].affects.add(a));
          }

          // Merge patterns
          if (fm['patterns-established']) {
            fm['patterns-established'].forEach(p => digest.phases[phaseNum].patterns.add(p));
          }

          // Merge decisions
          if (fm['key-decisions']) {
            fm['key-decisions'].forEach(d => {
              digest.decisions.push({ phase: phaseNum, decision: d });
            });
          }

          // Merge tech stack
          if (fm['tech-stack'] && fm['tech-stack'].added) {
            fm['tech-stack'].added.forEach(t => digest.tech_stack.add(typeof t === 'string' ? t : t.name));
          }

        } catch (e) {
          // Skip malformed summaries
        }
      }
    }

    // Convert Sets to Arrays for JSON output
    Object.keys(digest.phases).forEach(p => {
      digest.phases[p].provides = [...digest.phases[p].provides];
      digest.phases[p].affects = [...digest.phases[p].affects];
      digest.phases[p].patterns = [...digest.phases[p].patterns];
    });
    digest.tech_stack = [...digest.tech_stack];

    output(digest, raw);
  } catch (e) {
    error('Failed to generate history digest: ' + e.message);
  }
}

function cmdPhasesList(cwd, options, raw) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const { type, phase } = options;

  // If no phases directory, return empty
  if (!fs.existsSync(phasesDir)) {
    if (type) {
      output({ files: [], count: 0 }, raw, '');
    } else {
      output({ directories: [], count: 0 }, raw, '');
    }
    return;
  }

  try {
    // Get all phase directories
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    let dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    // Sort numerically (handles decimals: 01, 02, 02.1, 02.2, 03)
    dirs.sort((a, b) => {
      const aNum = parseFloat(a.match(/^(\d+(?:\.\d+)?)/)?.[1] || '0');
      const bNum = parseFloat(b.match(/^(\d+(?:\.\d+)?)/)?.[1] || '0');
      return aNum - bNum;
    });

    // If filtering by phase number
    if (phase) {
      const normalized = normalizePhaseName(phase);
      const match = dirs.find(d => d.startsWith(normalized));
      if (!match) {
        output({ files: [], count: 0, phase_dir: null, error: 'Phase not found' }, raw, '');
        return;
      }
      dirs = [match];
    }

    // If listing files of a specific type
    if (type) {
      const files = [];
      for (const dir of dirs) {
        const dirPath = path.join(phasesDir, dir);
        const dirFiles = fs.readdirSync(dirPath);

        let filtered;
        if (type === 'plans') {
          filtered = dirFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
        } else if (type === 'summaries') {
          filtered = dirFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        } else {
          filtered = dirFiles;
        }

        files.push(...filtered.sort());
      }

      const result = {
        files,
        count: files.length,
        phase_dir: phase ? dirs[0].replace(/^\d+(?:\.\d+)?-?/, '') : null,
      };
      output(result, raw, files.join('\n'));
      return;
    }

    // Default: list directories
    output({ directories: dirs, count: dirs.length }, raw, dirs.join('\n'));
  } catch (e) {
    error('Failed to list phases: ' + e.message);
  }
}

function cmdRoadmapGetPhase(cwd, phaseNum, raw) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');

  if (!fs.existsSync(roadmapPath)) {
    output({ found: false, error: 'ROADMAP.md not found' }, raw, '');
    return;
  }

  try {
    const content = fs.readFileSync(roadmapPath, 'utf-8');

    // Escape special regex chars in phase number, handle decimal
    const escapedPhase = phaseNum.replace(/\./g, '\\.');

    // Match "### Phase X:" or "### Phase X.Y:" with optional name
    const phasePattern = new RegExp(
      `###\\s*Phase\\s+${escapedPhase}:\\s*([^\\n]+)`,
      'i'
    );
    const headerMatch = content.match(phasePattern);

    if (!headerMatch) {
      output({ found: false, phase_number: phaseNum }, raw, '');
      return;
    }

    const phaseName = headerMatch[1].trim();
    const headerIndex = headerMatch.index;

    // Find the end of this section (next ### or end of file)
    const restOfContent = content.slice(headerIndex);
    const nextHeaderMatch = restOfContent.match(/\n###\s+Phase\s+\d/i);
    const sectionEnd = nextHeaderMatch
      ? headerIndex + nextHeaderMatch.index
      : content.length;

    const section = content.slice(headerIndex, sectionEnd).trim();

    // Extract goal if present
    const goalMatch = section.match(/\*\*Goal:\*\*\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    output(
      {
        found: true,
        phase_number: phaseNum,
        phase_name: phaseName,
        goal,
        section,
      },
      raw,
      section
    );
  } catch (e) {
    error('Failed to read ROADMAP.md: ' + e.message);
  }
}

function cmdPhaseNextDecimal(cwd, basePhase, raw) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalized = normalizePhaseName(basePhase);

  // Check if phases directory exists
  if (!fs.existsSync(phasesDir)) {
    output(
      {
        found: false,
        base_phase: normalized,
        next: `${normalized}.1`,
        existing: [],
      },
      raw,
      `${normalized}.1`
    );
    return;
  }

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    // Check if base phase exists
    const baseExists = dirs.some(d => d.startsWith(normalized + '-') || d === normalized);

    // Find existing decimal phases for this base
    const decimalPattern = new RegExp(`^${normalized}\\.(\\d+)`);
    const existingDecimals = [];

    for (const dir of dirs) {
      const match = dir.match(decimalPattern);
      if (match) {
        existingDecimals.push(`${normalized}.${match[1]}`);
      }
    }

    // Sort numerically
    existingDecimals.sort((a, b) => {
      const aNum = parseFloat(a);
      const bNum = parseFloat(b);
      return aNum - bNum;
    });

    // Calculate next decimal
    let nextDecimal;
    if (existingDecimals.length === 0) {
      nextDecimal = `${normalized}.1`;
    } else {
      const lastDecimal = existingDecimals[existingDecimals.length - 1];
      const lastNum = parseInt(lastDecimal.split('.')[1], 10);
      nextDecimal = `${normalized}.${lastNum + 1}`;
    }

    output(
      {
        found: baseExists,
        base_phase: normalized,
        next: nextDecimal,
        existing: existingDecimals,
      },
      raw,
      nextDecimal
    );
  } catch (e) {
    error('Failed to calculate next decimal phase: ' + e.message);
  }
}

function cmdStateLoad(cwd, raw) {
  const config = loadConfig(cwd);
  const planningDir = path.join(cwd, '.planning');

  let stateRaw = '';
  try {
    stateRaw = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
  } catch {}

  const configExists = fs.existsSync(path.join(planningDir, 'config.json'));
  const roadmapExists = fs.existsSync(path.join(planningDir, 'ROADMAP.md'));
  const stateExists = stateRaw.length > 0;

  const result = {
    config,
    state_raw: stateRaw,
    state_exists: stateExists,
    roadmap_exists: roadmapExists,
    config_exists: configExists,
  };

  // For --raw, output a condensed key=value format
  if (raw) {
    const c = config;
    const lines = [
      `model_profile=${c.model_profile}`,
      `commit_docs=${c.commit_docs}`,
      `branching_strategy=${c.branching_strategy}`,
      `phase_branch_template=${c.phase_branch_template}`,
      `milestone_branch_template=${c.milestone_branch_template}`,
      `parallelization=${c.parallelization}`,
      `research=${c.research}`,
      `plan_checker=${c.plan_checker}`,
      `verifier=${c.verifier}`,
      `config_exists=${configExists}`,
      `roadmap_exists=${roadmapExists}`,
      `state_exists=${stateExists}`,
    ];
    process.stdout.write(lines.join('\n'));
    process.exit(0);
  }

  output(result);
}

function cmdStateGet(cwd, section, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  try {
    const content = fs.readFileSync(statePath, 'utf-8');
    
    if (!section) {
      output({ content }, raw, content);
      return;
    }

    // Try to find markdown section or field
    const fieldEscaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Check for **field:** value
    const fieldPattern = new RegExp(`\\*\\*${fieldEscaped}:\\*\\*\\s*(.*)`, 'i');
    const fieldMatch = content.match(fieldPattern);
    if (fieldMatch) {
      output({ [section]: fieldMatch[1].trim() }, raw, fieldMatch[1].trim());
      return;
    }

    // Check for ## Section
    const sectionPattern = new RegExp(`##\\s*${fieldEscaped}\\s*\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
    const sectionMatch = content.match(sectionPattern);
    if (sectionMatch) {
      output({ [section]: sectionMatch[1].trim() }, raw, sectionMatch[1].trim());
      return;
    }

    output({ error: `Section or field "${section}" not found` }, raw, '');
  } catch {
    error('STATE.md not found');
  }
}

function cmdStatePatch(cwd, patches, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  try {
    let content = fs.readFileSync(statePath, 'utf-8');
    const results = { updated: [], failed: [] };

    for (const [field, value] of Object.entries(patches)) {
      const fieldEscaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(\\*\\*${fieldEscaped}:\\*\\*\\s*)(.*)`, 'i');
      
      if (pattern.test(content)) {
        content = content.replace(pattern, `$1${value}`);
        results.updated.push(field);
      } else {
        results.failed.push(field);
      }
    }

    if (results.updated.length > 0) {
      fs.writeFileSync(statePath, content, 'utf-8');
    }

    output(results, raw, results.updated.length > 0 ? 'true' : 'false');
  } catch {
    error('STATE.md not found');
  }
}

function cmdStateUpdate(cwd, field, value) {
  if (!field || value === undefined) {
    error('field and value required for state update');
  }

  const statePath = path.join(cwd, '.planning', 'STATE.md');
  try {
    let content = fs.readFileSync(statePath, 'utf-8');
    const fieldEscaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(\\*\\*${fieldEscaped}:\\*\\*\\s*)(.*)`, 'i');
    if (pattern.test(content)) {
      content = content.replace(pattern, `$1${value}`);
      fs.writeFileSync(statePath, content, 'utf-8');
      output({ updated: true });
    } else {
      output({ updated: false, reason: `Field "${field}" not found in STATE.md` });
    }
  } catch {
    output({ updated: false, reason: 'STATE.md not found' });
  }
}

// ─── State Progression Engine ────────────────────────────────────────────────

function stateExtractField(content, fieldName) {
  const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function stateReplaceField(content, fieldName, newValue) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
  if (pattern.test(content)) {
    return content.replace(pattern, `$1${newValue}`);
  }
  return null;
}

function cmdStateAdvancePlan(cwd, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }

  let content = fs.readFileSync(statePath, 'utf-8');
  const currentPlan = parseInt(stateExtractField(content, 'Current Plan'), 10);
  const totalPlans = parseInt(stateExtractField(content, 'Total Plans in Phase'), 10);
  const today = new Date().toISOString().split('T')[0];

  if (isNaN(currentPlan) || isNaN(totalPlans)) {
    output({ error: 'Cannot parse Current Plan or Total Plans in Phase from STATE.md' }, raw);
    return;
  }

  if (currentPlan >= totalPlans) {
    content = stateReplaceField(content, 'Status', 'Phase complete — ready for verification') || content;
    content = stateReplaceField(content, 'Last Activity', today) || content;
    fs.writeFileSync(statePath, content, 'utf-8');
    output({ advanced: false, reason: 'last_plan', current_plan: currentPlan, total_plans: totalPlans, status: 'ready_for_verification' }, raw, 'false');
  } else {
    const newPlan = currentPlan + 1;
    content = stateReplaceField(content, 'Current Plan', String(newPlan)) || content;
    content = stateReplaceField(content, 'Status', 'Ready to execute') || content;
    content = stateReplaceField(content, 'Last Activity', today) || content;
    fs.writeFileSync(statePath, content, 'utf-8');
    output({ advanced: true, previous_plan: currentPlan, current_plan: newPlan, total_plans: totalPlans }, raw, 'true');
  }
}

function cmdStateRecordMetric(cwd, options, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }

  let content = fs.readFileSync(statePath, 'utf-8');
  const { phase, plan, duration, tasks, files } = options;

  if (!phase || !plan || !duration) {
    output({ error: 'phase, plan, and duration required' }, raw);
    return;
  }

  // Find Performance Metrics section and its table
  const metricsPattern = /(##\s*Performance Metrics[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n)([\s\S]*?)(?=\n##|\n$|$)/i;
  const metricsMatch = content.match(metricsPattern);

  if (metricsMatch) {
    const tableHeader = metricsMatch[1];
    let tableBody = metricsMatch[2].trimEnd();
    const newRow = `| Phase ${phase} P${plan} | ${duration} | ${tasks || '-'} tasks | ${files || '-'} files |`;

    if (tableBody.trim() === '' || tableBody.includes('None yet')) {
      tableBody = newRow;
    } else {
      tableBody = tableBody + '\n' + newRow;
    }

    content = content.replace(metricsPattern, `${tableHeader}${tableBody}\n`);
    fs.writeFileSync(statePath, content, 'utf-8');
    output({ recorded: true, phase, plan, duration }, raw, 'true');
  } else {
    output({ recorded: false, reason: 'Performance Metrics section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateUpdateProgress(cwd, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }

  let content = fs.readFileSync(statePath, 'utf-8');

  // Count summaries across all phases
  const phasesDir = path.join(cwd, '.planning', 'phases');
  let totalPlans = 0;
  let totalSummaries = 0;

  if (fs.existsSync(phasesDir)) {
    const phaseDirs = fs.readdirSync(phasesDir, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name);
    for (const dir of phaseDirs) {
      const files = fs.readdirSync(path.join(phasesDir, dir));
      totalPlans += files.filter(f => f.match(/-PLAN\.md$/i)).length;
      totalSummaries += files.filter(f => f.match(/-SUMMARY\.md$/i)).length;
    }
  }

  const percent = totalPlans > 0 ? Math.round(totalSummaries / totalPlans * 100) : 0;
  const barWidth = 10;
  const filled = Math.round(percent / 100 * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
  const progressStr = `[${bar}] ${percent}%`;

  const progressPattern = /(\*\*Progress:\*\*\s*).*/i;
  if (progressPattern.test(content)) {
    content = content.replace(progressPattern, `$1${progressStr}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    output({ updated: true, percent, completed: totalSummaries, total: totalPlans, bar: progressStr }, raw, progressStr);
  } else {
    output({ updated: false, reason: 'Progress field not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateAddDecision(cwd, options, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }

  const { phase, summary, rationale } = options;
  if (!summary) { output({ error: 'summary required' }, raw); return; }

  let content = fs.readFileSync(statePath, 'utf-8');
  const entry = `- [Phase ${phase || '?'}]: ${summary}${rationale ? ` — ${rationale}` : ''}`;

  // Find Decisions section (various heading patterns)
  const sectionPattern = /(###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = content.match(sectionPattern);

  if (match) {
    let sectionBody = match[2];
    // Remove placeholders
    sectionBody = sectionBody.replace(/None yet\.?\s*\n?/gi, '').replace(/No decisions yet\.?\s*\n?/gi, '');
    sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
    content = content.replace(sectionPattern, `${match[1]}${sectionBody}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    output({ added: true, decision: entry }, raw, 'true');
  } else {
    output({ added: false, reason: 'Decisions section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateAddBlocker(cwd, text, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }
  if (!text) { output({ error: 'text required' }, raw); return; }

  let content = fs.readFileSync(statePath, 'utf-8');
  const entry = `- ${text}`;

  const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = content.match(sectionPattern);

  if (match) {
    let sectionBody = match[2];
    sectionBody = sectionBody.replace(/None\.?\s*\n?/gi, '').replace(/None yet\.?\s*\n?/gi, '');
    sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
    content = content.replace(sectionPattern, `${match[1]}${sectionBody}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    output({ added: true, blocker: text }, raw, 'true');
  } else {
    output({ added: false, reason: 'Blockers section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateResolveBlocker(cwd, text, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }
  if (!text) { output({ error: 'text required' }, raw); return; }

  let content = fs.readFileSync(statePath, 'utf-8');

  const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const match = content.match(sectionPattern);

  if (match) {
    const sectionBody = match[2];
    const lines = sectionBody.split('\n');
    const filtered = lines.filter(line => {
      if (!line.startsWith('- ')) return true;
      return !line.toLowerCase().includes(text.toLowerCase());
    });

    let newBody = filtered.join('\n');
    // If section is now empty, add placeholder
    if (!newBody.trim() || !newBody.includes('- ')) {
      newBody = 'None\n';
    }

    content = content.replace(sectionPattern, `${match[1]}${newBody}`);
    fs.writeFileSync(statePath, content, 'utf-8');
    output({ resolved: true, blocker: text }, raw, 'true');
  } else {
    output({ resolved: false, reason: 'Blockers section not found in STATE.md' }, raw, 'false');
  }
}

function cmdStateRecordSession(cwd, options, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) { output({ error: 'STATE.md not found' }, raw); return; }

  let content = fs.readFileSync(statePath, 'utf-8');
  const now = new Date().toISOString();
  const updated = [];

  // Update Last session / Last Date
  let result = stateReplaceField(content, 'Last session', now);
  if (result) { content = result; updated.push('Last session'); }
  result = stateReplaceField(content, 'Last Date', now);
  if (result) { content = result; updated.push('Last Date'); }

  // Update Stopped at
  if (options.stopped_at) {
    result = stateReplaceField(content, 'Stopped At', options.stopped_at);
    if (!result) result = stateReplaceField(content, 'Stopped at', options.stopped_at);
    if (result) { content = result; updated.push('Stopped At'); }
  }

  // Update Resume file
  const resumeFile = options.resume_file || 'None';
  result = stateReplaceField(content, 'Resume File', resumeFile);
  if (!result) result = stateReplaceField(content, 'Resume file', resumeFile);
  if (result) { content = result; updated.push('Resume File'); }

  if (updated.length > 0) {
    fs.writeFileSync(statePath, content, 'utf-8');
    output({ recorded: true, updated }, raw, 'true');
  } else {
    output({ recorded: false, reason: 'No session fields found in STATE.md' }, raw, 'false');
  }
}

function cmdResolveModel(cwd, agentType, raw) {
  if (!agentType) {
    error('agent-type required');
  }

  const config = loadConfig(cwd);
  const profile = config.model_profile || 'balanced';

  const agentModels = MODEL_PROFILES[agentType];
  if (!agentModels) {
    const result = { model: 'sonnet', profile, unknown_agent: true };
    output(result, raw, 'sonnet');
    return;
  }

  const model = agentModels[profile] || agentModels['balanced'] || 'sonnet';
  const result = { model, profile };
  output(result, raw, model);
}

function cmdFindPhase(cwd, phase, raw) {
  if (!phase) {
    error('phase identifier required');
  }

  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalized = normalizePhaseName(phase);

  const notFound = { found: false, directory: null, phase_number: null, phase_name: null, plans: [], summaries: [] };

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

    const match = dirs.find(d => d.startsWith(normalized));
    if (!match) {
      output(notFound, raw, '');
      return;
    }

    const dirMatch = match.match(/^(\d+(?:\.\d+)?)-?(.*)/);
    const phaseNumber = dirMatch ? dirMatch[1] : normalized;
    const phaseName = dirMatch && dirMatch[2] ? dirMatch[2] : null;

    const phaseDir = path.join(phasesDir, match);
    const phaseFiles = fs.readdirSync(phaseDir);
    const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();
    const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').sort();

    const result = {
      found: true,
      directory: path.join('.planning', 'phases', match),
      phase_number: phaseNumber,
      phase_name: phaseName,
      plans,
      summaries,
    };

    output(result, raw, result.directory);
  } catch {
    output(notFound, raw, '');
  }
}

function cmdCommit(cwd, message, files, raw, amend) {
  if (!message && !amend) {
    error('commit message required');
  }

  const config = loadConfig(cwd);

  // Check commit_docs config
  if (!config.commit_docs) {
    const result = { committed: false, hash: null, reason: 'skipped_commit_docs_false' };
    output(result, raw, 'skipped');
    return;
  }

  // Check if .planning is gitignored
  if (isGitIgnored(cwd, '.planning')) {
    const result = { committed: false, hash: null, reason: 'skipped_gitignored' };
    output(result, raw, 'skipped');
    return;
  }

  // Stage files
  const filesToStage = files && files.length > 0 ? files : ['.planning/'];
  for (const file of filesToStage) {
    execGit(cwd, ['add', file]);
  }

  // Commit
  const commitArgs = amend ? ['commit', '--amend', '--no-edit'] : ['commit', '-m', message];
  const commitResult = execGit(cwd, commitArgs);
  if (commitResult.exitCode !== 0) {
    if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
      const result = { committed: false, hash: null, reason: 'nothing_to_commit' };
      output(result, raw, 'nothing');
      return;
    }
    const result = { committed: false, hash: null, reason: 'nothing_to_commit', error: commitResult.stderr };
    output(result, raw, 'nothing');
    return;
  }

  // Get short hash
  const hashResult = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
  const hash = hashResult.exitCode === 0 ? hashResult.stdout : null;
  const result = { committed: true, hash, reason: 'committed' };
  output(result, raw, hash || 'committed');
}

function cmdVerifySummary(cwd, summaryPath, checkFileCount, raw) {
  if (!summaryPath) {
    error('summary-path required');
  }

  const fullPath = path.join(cwd, summaryPath);
  const checkCount = checkFileCount || 2;

  // Check 1: Summary exists
  if (!fs.existsSync(fullPath)) {
    const result = {
      passed: false,
      checks: {
        summary_exists: false,
        files_created: { checked: 0, found: 0, missing: [] },
        commits_exist: false,
        self_check: 'not_found',
      },
      errors: ['SUMMARY.md not found'],
    };
    output(result, raw, 'failed');
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const errors = [];

  // Check 2: Spot-check files mentioned in summary
  const mentionedFiles = new Set();
  const patterns = [
    /`([^`]+\.[a-zA-Z]+)`/g,
    /(?:Created|Modified|Added|Updated|Edited):\s*`?([^\s`]+\.[a-zA-Z]+)`?/gi,
  ];

  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(content)) !== null) {
      const filePath = m[1];
      if (filePath && !filePath.startsWith('http') && filePath.includes('/')) {
        mentionedFiles.add(filePath);
      }
    }
  }

  const filesToCheck = Array.from(mentionedFiles).slice(0, checkCount);
  const missing = [];
  for (const file of filesToCheck) {
    if (!fs.existsSync(path.join(cwd, file))) {
      missing.push(file);
    }
  }

  // Check 3: Commits exist
  const commitHashPattern = /\b[0-9a-f]{7,40}\b/g;
  const hashes = content.match(commitHashPattern) || [];
  let commitsExist = false;
  if (hashes.length > 0) {
    for (const hash of hashes.slice(0, 3)) {
      const result = execGit(cwd, ['cat-file', '-t', hash]);
      if (result.exitCode === 0 && result.stdout === 'commit') {
        commitsExist = true;
        break;
      }
    }
  }

  // Check 4: Self-check section
  let selfCheck = 'not_found';
  const selfCheckPattern = /##\s*(?:Self[- ]?Check|Verification|Quality Check)/i;
  if (selfCheckPattern.test(content)) {
    const passPattern = /(?:all\s+)?(?:pass|✓|✅|complete|succeeded)/i;
    const failPattern = /(?:fail|✗|❌|incomplete|blocked)/i;
    const checkSection = content.slice(content.search(selfCheckPattern));
    if (failPattern.test(checkSection)) {
      selfCheck = 'failed';
    } else if (passPattern.test(checkSection)) {
      selfCheck = 'passed';
    }
  }

  if (missing.length > 0) errors.push('Missing files: ' + missing.join(', '));
  if (!commitsExist && hashes.length > 0) errors.push('Referenced commit hashes not found in git history');
  if (selfCheck === 'failed') errors.push('Self-check section indicates failure');

  const checks = {
    summary_exists: true,
    files_created: { checked: filesToCheck.length, found: filesToCheck.length - missing.length, missing },
    commits_exist: commitsExist,
    self_check: selfCheck,
  };

  const passed = missing.length === 0 && selfCheck !== 'failed';
  const result = { passed, checks, errors };
  output(result, raw, passed ? 'passed' : 'failed');
}

function cmdTemplateSelect(cwd, planPath, raw) {
  if (!planPath) {
    error('plan-path required');
  }

  try {
    const fullPath = path.join(cwd, planPath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Simple heuristics
    const taskMatch = content.match(/###\s*Task\s*\d+/g) || [];
    const taskCount = taskMatch.length;
    
    const decisionMatch = content.match(/decision/gi) || [];
    const hasDecisions = decisionMatch.length > 0;
    
    // Count file mentions
    const fileMentions = new Set();
    const filePattern = /`([^`]+\.[a-zA-Z]+)`/g;
    let m;
    while ((m = filePattern.exec(content)) !== null) {
      if (m[1].includes('/') && !m[1].startsWith('http')) {
        fileMentions.add(m[1]);
      }
    }
    const fileCount = fileMentions.size;

    let template = 'templates/summary-standard.md';
    let type = 'standard';

    if (taskCount <= 2 && fileCount <= 3 && !hasDecisions) {
      template = 'templates/summary-minimal.md';
      type = 'minimal';
    } else if (hasDecisions || fileCount > 6 || taskCount > 5) {
      template = 'templates/summary-complex.md';
      type = 'complex';
    }

    const result = { template, type, taskCount, fileCount, hasDecisions };
    output(result, raw, template);
  } catch (e) {
    // Fallback to standard
    output({ template: 'templates/summary-standard.md', type: 'standard', error: e.message }, raw, 'templates/summary-standard.md');
  }
}

function cmdTemplateFill(cwd, templateType, options, raw) {
  if (!templateType) { error('template type required: summary, plan, or verification'); }
  if (!options.phase) { error('--phase required'); }

  const phaseInfo = findPhaseInternal(cwd, options.phase);
  if (!phaseInfo || !phaseInfo.found) { output({ error: 'Phase not found', phase: options.phase }, raw); return; }

  const padded = normalizePhaseName(options.phase);
  const today = new Date().toISOString().split('T')[0];
  const phaseName = options.name || phaseInfo.phase_name || 'Unnamed';
  const phaseSlug = phaseInfo.phase_slug || generateSlugInternal(phaseName);
  const phaseId = `${padded}-${phaseSlug}`;
  const planNum = (options.plan || '01').padStart(2, '0');
  const fields = options.fields || {};

  let frontmatter, body, fileName;

  switch (templateType) {
    case 'summary': {
      frontmatter = {
        phase: phaseId,
        plan: planNum,
        subsystem: '[primary category]',
        tags: [],
        provides: [],
        affects: [],
        'tech-stack': { added: [], patterns: [] },
        'key-files': { created: [], modified: [] },
        'key-decisions': [],
        'patterns-established': [],
        duration: '[X]min',
        completed: today,
        ...fields,
      };
      body = [
        `# Phase ${options.phase}: ${phaseName} Summary`,
        '',
        '**[Substantive one-liner describing outcome]**',
        '',
        '## Performance',
        '- **Duration:** [time]',
        '- **Tasks:** [count completed]',
        '- **Files modified:** [count]',
        '',
        '## Accomplishments',
        '- [Key outcome 1]',
        '- [Key outcome 2]',
        '',
        '## Task Commits',
        '1. **Task 1: [task name]** - `hash`',
        '',
        '## Files Created/Modified',
        '- `path/to/file.ts` - What it does',
        '',
        '## Decisions & Deviations',
        '[Key decisions or "None - followed plan as specified"]',
        '',
        '## Next Phase Readiness',
        '[What\'s ready for next phase]',
      ].join('\n');
      fileName = `${padded}-${planNum}-SUMMARY.md`;
      break;
    }
    case 'plan': {
      const planType = options.type || 'execute';
      const wave = parseInt(options.wave) || 1;
      frontmatter = {
        phase: phaseId,
        plan: planNum,
        type: planType,
        wave,
        depends_on: [],
        files_modified: [],
        autonomous: true,
        user_setup: [],
        must_haves: { truths: [], artifacts: [], key_links: [] },
        ...fields,
      };
      body = [
        `# Phase ${options.phase} Plan ${planNum}: [Title]`,
        '',
        '## Objective',
        '- **What:** [What this plan builds]',
        '- **Why:** [Why it matters for the phase goal]',
        '- **Output:** [Concrete deliverable]',
        '',
        '## Context',
        '@.planning/PROJECT.md',
        '@.planning/ROADMAP.md',
        '@.planning/STATE.md',
        '',
        '## Tasks',
        '',
        '<task type="code">',
        '  <name>[Task name]</name>',
        '  <files>[file paths]</files>',
        '  <action>[What to do]</action>',
        '  <verify>[How to verify]</verify>',
        '  <done>[Definition of done]</done>',
        '</task>',
        '',
        '## Verification',
        '[How to verify this plan achieved its objective]',
        '',
        '## Success Criteria',
        '- [ ] [Criterion 1]',
        '- [ ] [Criterion 2]',
      ].join('\n');
      fileName = `${padded}-${planNum}-PLAN.md`;
      break;
    }
    case 'verification': {
      frontmatter = {
        phase: phaseId,
        verified: new Date().toISOString(),
        status: 'pending',
        score: '0/0 must-haves verified',
        ...fields,
      };
      body = [
        `# Phase ${options.phase}: ${phaseName} — Verification`,
        '',
        '## Observable Truths',
        '| # | Truth | Status | Evidence |',
        '|---|-------|--------|----------|',
        '| 1 | [Truth] | pending | |',
        '',
        '## Required Artifacts',
        '| Artifact | Expected | Status | Details |',
        '|----------|----------|--------|---------|',
        '| [path] | [what] | pending | |',
        '',
        '## Key Link Verification',
        '| From | To | Via | Status | Details |',
        '|------|----|----|--------|---------|',
        '| [source] | [target] | [connection] | pending | |',
        '',
        '## Requirements Coverage',
        '| Requirement | Status | Blocking Issue |',
        '|-------------|--------|----------------|',
        '| [req] | pending | |',
        '',
        '## Result',
        '[Pending verification]',
      ].join('\n');
      fileName = `${padded}-VERIFICATION.md`;
      break;
    }
    default:
      error(`Unknown template type: ${templateType}. Available: summary, plan, verification`);
      return;
  }

  const fullContent = `---\n${reconstructFrontmatter(frontmatter)}\n---\n\n${body}\n`;
  const outPath = path.join(cwd, phaseInfo.directory, fileName);

  if (fs.existsSync(outPath)) {
    output({ error: 'File already exists', path: path.relative(cwd, outPath) }, raw);
    return;
  }

  fs.writeFileSync(outPath, fullContent, 'utf-8');
  const relPath = path.relative(cwd, outPath);
  output({ created: true, path: relPath, template: templateType }, raw, relPath);
}

function cmdPhasePlanIndex(cwd, phase, raw) {
  if (!phase) {
    error('phase required for phase-plan-index');
  }

  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalized = normalizePhaseName(phase);

  // Find phase directory
  let phaseDir = null;
  let phaseDirName = null;
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    const match = dirs.find(d => d.startsWith(normalized));
    if (match) {
      phaseDir = path.join(phasesDir, match);
      phaseDirName = match;
    }
  } catch {
    // phases dir doesn't exist
  }

  if (!phaseDir) {
    output({ phase: normalized, error: 'Phase not found', plans: [], waves: {}, incomplete: [], has_checkpoints: false }, raw);
    return;
  }

  // Get all files in phase directory
  const phaseFiles = fs.readdirSync(phaseDir);
  const planFiles = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();
  const summaryFiles = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');

  // Build set of plan IDs with summaries
  const completedPlanIds = new Set(
    summaryFiles.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', ''))
  );

  const plans = [];
  const waves = {};
  const incomplete = [];
  let hasCheckpoints = false;

  for (const planFile of planFiles) {
    const planId = planFile.replace('-PLAN.md', '').replace('PLAN.md', '');
    const planPath = path.join(phaseDir, planFile);
    const content = fs.readFileSync(planPath, 'utf-8');
    const fm = extractFrontmatter(content);

    // Count tasks (## Task N patterns)
    const taskMatches = content.match(/##\s*Task\s*\d+/gi) || [];
    const taskCount = taskMatches.length;

    // Parse wave as integer
    const wave = parseInt(fm.wave, 10) || 1;

    // Parse autonomous (default true if not specified)
    let autonomous = true;
    if (fm.autonomous !== undefined) {
      autonomous = fm.autonomous === 'true' || fm.autonomous === true;
    }

    if (!autonomous) {
      hasCheckpoints = true;
    }

    // Parse files-modified
    let filesModified = [];
    if (fm['files-modified']) {
      filesModified = Array.isArray(fm['files-modified']) ? fm['files-modified'] : [fm['files-modified']];
    }

    const hasSummary = completedPlanIds.has(planId);
    if (!hasSummary) {
      incomplete.push(planId);
    }

    const plan = {
      id: planId,
      wave,
      autonomous,
      objective: fm.objective || null,
      files_modified: filesModified,
      task_count: taskCount,
      has_summary: hasSummary,
    };

    plans.push(plan);

    // Group by wave
    const waveKey = String(wave);
    if (!waves[waveKey]) {
      waves[waveKey] = [];
    }
    waves[waveKey].push(planId);
  }

  const result = {
    phase: normalized,
    plans,
    waves,
    incomplete,
    has_checkpoints: hasCheckpoints,
  };

  output(result, raw);
}

function cmdStateSnapshot(cwd, raw) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');

  if (!fs.existsSync(statePath)) {
    output({ error: 'STATE.md not found' }, raw);
    return;
  }

  const content = fs.readFileSync(statePath, 'utf-8');

  // Helper to extract **Field:** value patterns
  const extractField = (fieldName) => {
    const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i');
    const match = content.match(pattern);
    return match ? match[1].trim() : null;
  };

  // Extract basic fields
  const currentPhase = extractField('Current Phase');
  const currentPhaseName = extractField('Current Phase Name');
  const totalPhasesRaw = extractField('Total Phases');
  const currentPlan = extractField('Current Plan');
  const totalPlansRaw = extractField('Total Plans in Phase');
  const status = extractField('Status');
  const progressRaw = extractField('Progress');
  const lastActivity = extractField('Last Activity');
  const lastActivityDesc = extractField('Last Activity Description');
  const pausedAt = extractField('Paused At');

  // Parse numeric fields
  const totalPhases = totalPhasesRaw ? parseInt(totalPhasesRaw, 10) : null;
  const totalPlansInPhase = totalPlansRaw ? parseInt(totalPlansRaw, 10) : null;
  const progressPercent = progressRaw ? parseInt(progressRaw.replace('%', ''), 10) : null;

  // Extract decisions table
  const decisions = [];
  const decisionsMatch = content.match(/##\s*Decisions Made[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n([\s\S]*?)(?=\n##|\n$|$)/i);
  if (decisionsMatch) {
    const tableBody = decisionsMatch[1];
    const rows = tableBody.trim().split('\n').filter(r => r.includes('|'));
    for (const row of rows) {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 3) {
        decisions.push({
          phase: cells[0],
          summary: cells[1],
          rationale: cells[2],
        });
      }
    }
  }

  // Extract blockers list
  const blockers = [];
  const blockersMatch = content.match(/##\s*Blockers\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (blockersMatch) {
    const blockersSection = blockersMatch[1];
    const items = blockersSection.match(/^-\s+(.+)$/gm) || [];
    for (const item of items) {
      blockers.push(item.replace(/^-\s+/, '').trim());
    }
  }

  // Extract session info
  const session = {
    last_date: null,
    stopped_at: null,
    resume_file: null,
  };

  const sessionMatch = content.match(/##\s*Session\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (sessionMatch) {
    const sessionSection = sessionMatch[1];
    const lastDateMatch = sessionSection.match(/\*\*Last Date:\*\*\s*(.+)/i);
    const stoppedAtMatch = sessionSection.match(/\*\*Stopped At:\*\*\s*(.+)/i);
    const resumeFileMatch = sessionSection.match(/\*\*Resume File:\*\*\s*(.+)/i);

    if (lastDateMatch) session.last_date = lastDateMatch[1].trim();
    if (stoppedAtMatch) session.stopped_at = stoppedAtMatch[1].trim();
    if (resumeFileMatch) session.resume_file = resumeFileMatch[1].trim();
  }

  const result = {
    current_phase: currentPhase,
    current_phase_name: currentPhaseName,
    total_phases: totalPhases,
    current_plan: currentPlan,
    total_plans_in_phase: totalPlansInPhase,
    status,
    progress_percent: progressPercent,
    last_activity: lastActivity,
    last_activity_desc: lastActivityDesc,
    decisions,
    blockers,
    paused_at: pausedAt,
    session,
  };

  output(result, raw);
}

function cmdSummaryExtract(cwd, summaryPath, fields, raw) {
  if (!summaryPath) {
    error('summary-path required for summary-extract');
  }

  const fullPath = path.join(cwd, summaryPath);

  if (!fs.existsSync(fullPath)) {
    output({ error: 'File not found', path: summaryPath }, raw);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const fm = extractFrontmatter(content);

  // Parse key-decisions into structured format
  const parseDecisions = (decisionsList) => {
    if (!decisionsList || !Array.isArray(decisionsList)) return [];
    return decisionsList.map(d => {
      const colonIdx = d.indexOf(':');
      if (colonIdx > 0) {
        return {
          summary: d.substring(0, colonIdx).trim(),
          rationale: d.substring(colonIdx + 1).trim(),
        };
      }
      return { summary: d, rationale: null };
    });
  };

  // Build full result
  const fullResult = {
    path: summaryPath,
    one_liner: fm['one-liner'] || null,
    key_files: fm['key-files'] || [],
    tech_added: (fm['tech-stack'] && fm['tech-stack'].added) || [],
    patterns: fm['patterns-established'] || [],
    decisions: parseDecisions(fm['key-decisions']),
  };

  // If fields specified, filter to only those fields
  if (fields && fields.length > 0) {
    const filtered = { path: summaryPath };
    for (const field of fields) {
      if (fullResult[field] !== undefined) {
        filtered[field] = fullResult[field];
      }
    }
    output(filtered, raw);
    return;
  }

  output(fullResult, raw);
}

// ─── Knowledge Commands ──────────────────────────────────────────────────────

function cmdKnowledgeStatus(cwd, args, raw) {
  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';
  const { knowledge } = require('./knowledge.js');

  const status = knowledge.isAvailable(scope);
  const result = {
    scope,
    available: status.available,
    reason: status.reason || null,
    db_path: status.available ? require('./knowledge-db.js').getDBPath(scope) : null
  };

  output(result, raw);
}

function cmdKnowledgeAdd(cwd, args, raw) {
  const content = args[0];
  if (!content) {
    error('knowledge add: content required');
  }

  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';
  const type = args.includes('--type') ? args[args.indexOf('--type') + 1] : 'summary';
  const ttl = args.includes('--ttl') ? args[args.indexOf('--ttl') + 1] : null;

  const { resolveProjectSlug } = require('./knowledge-writer.js');
  const project_slug = resolveProjectSlug(cwd);

  const { knowledge } = require('./knowledge.js');
  const result = knowledge.add({
    content,
    type,
    scope,
    ttlCategory: ttl,
    project_slug
  });

  output(result, raw);
}

function cmdKnowledgeSearch(cwd, args, raw) {
  const query = args[0];
  if (!query) {
    error('knowledge search: query required');
  }

  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';
  const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : 10;
  const project_slug = args.includes('--project') ? args[args.indexOf('--project') + 1] : null;

  const { knowledge } = require('./knowledge.js');
  const results = knowledge.search(query, { scope, limit, project_slug });

  output(results, raw);
}

function cmdKnowledgeGet(cwd, args, raw) {
  const id = parseInt(args[0]);
  if (isNaN(id)) {
    error('knowledge get: id required (integer)');
  }

  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';

  const { knowledge } = require('./knowledge.js');
  const result = knowledge.get(id, scope);

  output(result, raw);
}

function cmdKnowledgeDelete(cwd, args, raw) {
  const id = parseInt(args[0]);
  if (isNaN(id)) {
    error('knowledge delete: id required (integer)');
  }

  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';

  const { knowledge } = require('./knowledge.js');
  const result = knowledge.delete(id, scope);

  output(result, raw);
}

function cmdKnowledgeCleanup(cwd, args, raw) {
  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';

  const { knowledge } = require('./knowledge.js');
  const result = knowledge.cleanup(scope);

  output(result, raw);
}

function cmdKnowledgePrune(cwd, args, raw) {
  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'global';
  const dryRun = args.includes('--dry-run');
  const threshold = args.includes('--threshold')
    ? parseFloat(args[args.indexOf('--threshold') + 1])
    : 0.7;

  const { knowledge } = require('./knowledge.js');
  const { pruneStaleEntries } = require('./knowledge-lifecycle.js');

  const conn = knowledge._getConnection(scope);
  if (conn.available === false) {
    error('knowledge prune: DB unavailable — ' + (conn.reason || 'unknown'));
  }

  const result = pruneStaleEntries(conn.db, {
    threshold,
    scope,
    dryRun,
    vectorEnabled: conn.vectorEnabled || false
  });

  const summary = {
    mode: dryRun ? 'dry-run' : 'live',
    scope,
    threshold,
    candidates: result.candidates,
    deleted: result.deleted,
    entries: result.entries.map(e => ({
      id: e.id,
      type: e.type,
      staleness_score: e.staleness_score,
      dormant_days: Math.round(e.dormant_days),
      access_count: e.access_count
    }))
  };

  output(summary, raw);
}

function cmdKnowledgeStats(cwd, args, raw) {
  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';

  const { knowledge } = require('./knowledge.js');
  const result = knowledge.getStats({ scope });

  output(result, raw);
}

// ─── Permission Management ───────────────────────────────────────────────────

function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)([hdw])$/);
  if (!match) {
    error(`Invalid duration format: ${str}. Use format like "7d", "24h", or "2w"`);
  }
  const [, num, unit] = match;
  const value = parseInt(num, 10);
  const ms = {
    h: value * 60 * 60 * 1000,
    d: value * 24 * 60 * 60 * 1000,
    w: value * 7 * 24 * 60 * 60 * 1000
  };
  return ms[unit];
}

function cmdPermissionGrant(cwd, args, raw) {
  const action = args[0];
  if (!action) {
    error('grant: action required (e.g., "delete_file:/test/*")');
  }

  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';
  const ttlStr = args.includes('--ttl') ? args[args.indexOf('--ttl') + 1] : null;
  const maxCostStr = args.includes('--max-cost') ? args[args.indexOf('--max-cost') + 1] : null;
  const maxCountStr = args.includes('--max-count') ? args[args.indexOf('--max-count') + 1] : null;
  const path = args.includes('--path') ? args[args.indexOf('--path') + 1] : null;

  const ttl = ttlStr ? parseDuration(ttlStr) : null;
  const limits = {};
  if (maxCostStr) limits.max_cost = parseFloat(maxCostStr);
  if (maxCountStr) limits.max_count = parseInt(maxCountStr, 10);
  if (path) limits.path = path;

  const { knowledge } = require('./knowledge.js');
  const { grantPermission } = require('./knowledge-permissions.js');

  const conn = knowledge._getConnection(scope);
  if (!conn.available) {
    error(`Knowledge system not available: ${conn.reason}`);
  }

  const result = grantPermission(conn.db, { action, scope, limits, ttl });

  output(result, raw);
}

function cmdPermissionRevoke(cwd, args, raw) {
  const token = args[0];
  if (!token) {
    error('revoke: token required');
  }

  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';

  const { knowledge } = require('./knowledge.js');
  const { revokePermission } = require('./knowledge-permissions.js');

  const conn = knowledge._getConnection(scope);
  if (!conn.available) {
    error(`Knowledge system not available: ${conn.reason}`);
  }

  const result = revokePermission(conn.db, token);

  output(result, raw);
}

function cmdPermissionList(cwd, args, raw) {
  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';
  const jsonOutput = args.includes('--json');

  const { knowledge } = require('./knowledge.js');
  const { listActivePermissions } = require('./knowledge-permissions.js');

  const conn = knowledge._getConnection(scope);
  if (!conn.available) {
    error(`Knowledge system not available: ${conn.reason}`);
  }

  const permissions = listActivePermissions(conn.db);

  if (jsonOutput || raw) {
    output({ permissions }, raw);
  } else {
    // Format as table
    console.log('\n=== Active Permissions ===\n');
    if (permissions.length === 0) {
      console.log('No active permissions.');
    } else {
      for (const perm of permissions) {
        console.log(`Action: ${perm.action_pattern}`);
        console.log(`Token: ${perm.grant_token}`);
        console.log(`Expires: ${perm.expires_at ? new Date(perm.expires_at).toISOString() : 'Never'}`);
        if (perm.limits) {
          console.log(`Limits: ${perm.limits}`);
        }
        console.log('---');
      }
    }
  }
}

// ─── Emergency Stop & Budget ─────────────────────────────────────────────────

function cmdPause(cwd, args, raw) {
  const reason = args.includes('--reason') ? args[args.indexOf('--reason') + 1] : 'user_requested';
  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';

  const { knowledge } = require('./knowledge.js');
  const { enableCircuitBreaker } = require('./knowledge-cost.js');

  const conn = knowledge._getConnection(scope);
  if (!conn.available) {
    error(`Knowledge system not available: ${conn.reason}`);
  }

  enableCircuitBreaker(conn.db, reason);

  output({ paused: true, reason }, raw, 'Emergency stop enabled. Costly and external actions will be blocked.');
}

function cmdResume(cwd, args, raw) {
  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';

  const { knowledge } = require('./knowledge.js');
  const { disableCircuitBreaker } = require('./knowledge-cost.js');

  const conn = knowledge._getConnection(scope);
  if (!conn.available) {
    error(`Knowledge system not available: ${conn.reason}`);
  }

  disableCircuitBreaker(conn.db);

  output({ resumed: true }, raw, 'Emergency stop disabled. Normal operation resumed.');
}

function cmdBudget(cwd, args, raw) {
  const period = args.includes('--period') ? args[args.indexOf('--period') + 1] : 'daily';
  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';

  if (period !== 'daily' && period !== 'weekly') {
    error('budget: period must be "daily" or "weekly"');
  }

  const { knowledge } = require('./knowledge.js');
  const { getTotalCost, getBudgetLimit, getStartOfPeriod, hasAlertFired } = require('./knowledge-cost.js');

  const conn = knowledge._getConnection(scope);
  if (!conn.available) {
    error(`Knowledge system not available: ${conn.reason}`);
  }

  const totalCost = getTotalCost(conn.db, period);
  const limit = getBudgetLimit(period);
  const percent = limit > 0 ? ((totalCost / limit) * 100).toFixed(1) : 0;
  const periodStart = getStartOfPeriod(period);

  // Check which alerts have fired
  const ALERT_THRESHOLDS = [0.5, 0.8, 0.9, 1.0];
  const firedLevels = [];
  for (const threshold of ALERT_THRESHOLDS) {
    if (hasAlertFired(conn.db, threshold, periodStart)) {
      firedLevels.push(`${(threshold * 100).toFixed(0)}%`);
    }
  }

  if (raw) {
    output({
      period,
      spent: totalCost,
      limit,
      percent: parseFloat(percent),
      alerts_fired: firedLevels
    }, raw);
  } else {
    console.log(`\n=== Budget Status (${period}) ===\n`);
    console.log(`Spent: $${totalCost.toFixed(2)} / $${limit.toFixed(2)} (${percent}%)`);
    if (firedLevels.length > 0) {
      console.log(`Alerts fired: ${firedLevels.join(', ')}`);
    }
  }
}

// ─── Principle Feedback ──────────────────────────────────────────────────────

function cmdMarkWrong(cwd, args, raw) {
  const id = parseInt(args[0]);
  if (isNaN(id)) {
    error('mark-wrong: principle-id required (integer)');
  }

  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';
  const severity = args.includes('--severity') ? args[args.indexOf('--severity') + 1] : 'minor';
  const reason = args.includes('--reason') ? args[args.indexOf('--reason') + 1] : null;

  if (!['minor', 'major', 'critical'].includes(severity)) {
    error('mark-wrong: severity must be "minor", "major", or "critical"');
  }

  const { knowledge } = require('./knowledge.js');
  const { markPrincipleWrong } = require('./knowledge-feedback.js');

  const conn = knowledge._getConnection(scope);
  if (!conn.available) {
    error(`Knowledge system not available: ${conn.reason}`);
  }

  const result = markPrincipleWrong(conn.db, id, { severity, reason });

  output(result, raw);
}

function cmdMarkOutdated(cwd, args, raw) {
  const id = parseInt(args[0]);
  if (isNaN(id)) {
    error('mark-outdated: principle-id required (integer)');
  }

  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';
  const replacement = args.includes('--replacement') ? args[args.indexOf('--replacement') + 1] : null;

  const { knowledge } = require('./knowledge.js');
  const { markPrincipleOutdated, createReplacementPrinciple } = require('./knowledge-feedback.js');

  const conn = knowledge._getConnection(scope);
  if (!conn.available) {
    error(`Knowledge system not available: ${conn.reason}`);
  }

  const result = markPrincipleOutdated(conn.db, id);

  if (replacement) {
    const replacementResult = createReplacementPrinciple(conn.db, id, replacement);
    result.replacement_id = replacementResult.new_principle_id;
  }

  output(result, raw);
}

function cmdPrincipleHistory(cwd, args, raw) {
  const id = parseInt(args[0]);
  if (isNaN(id)) {
    error('principle-history: principle-id required (integer)');
  }

  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';

  const { knowledge } = require('./knowledge.js');
  const { getPrincipleFeedbackHistory } = require('./knowledge-feedback.js');

  const conn = knowledge._getConnection(scope);
  if (!conn.available) {
    error(`Knowledge system not available: ${conn.reason}`);
  }

  const history = getPrincipleFeedbackHistory(conn.db, id);

  if (raw) {
    output({ principle_id: id, history }, raw);
  } else {
    console.log(`\n=== Feedback History for Principle ${id} ===\n`);
    if (history.length === 0) {
      console.log('No feedback recorded.');
    } else {
      for (const event of history) {
        console.log(`Type: ${event.event_type}`);
        console.log(`Date: ${new Date(event.created_at).toISOString()}`);
        console.log(`Severity: ${event.severity || 'N/A'}`);
        console.log(`Reason: ${event.reason || 'N/A'}`);
        console.log('---');
      }
    }
  }
}

function cmdPendingReplacements(cwd, args, raw) {
  const scope = args.includes('--scope') ? args[args.indexOf('--scope') + 1] : 'project';

  const { knowledge } = require('./knowledge.js');
  const { getPendingReplacements } = require('./knowledge-feedback.js');

  const conn = knowledge._getConnection(scope);
  if (!conn.available) {
    error(`Knowledge system not available: ${conn.reason}`);
  }

  const pending = getPendingReplacements(conn.db);

  if (raw) {
    output({ pending }, raw);
  } else {
    console.log('\n=== Principles Needing Replacement ===\n');
    if (pending.length === 0) {
      console.log('No pending replacements.');
    } else {
      for (const item of pending) {
        console.log(`ID: ${item.id}`);
        console.log(`Content: ${item.content.substring(0, 100)}...`);
        console.log(`Confidence: ${item.confidence}`);
        console.log('---');
      }
    }
  }
}

// ─── Checkpoint Operations ───────────────────────────────────────────────────

function cmdCheckpoint(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('checkpoint: subcommand required (create|search|latest|cleanup)');
  }

  const checkpoint = require('./knowledge-checkpoint.js');

  switch (subcommand) {
    case 'create': {
      // Parse args
      const phase = parseInt(args[args.indexOf('--phase') + 1]);
      const planId = args.includes('--plan-id') ? args[args.indexOf('--plan-id') + 1] : null;
      const taskTitle = args.includes('--task') ? args[args.indexOf('--task') + 1] : null;
      const planStr = args.includes('--plan') ? args[args.indexOf('--plan') + 1] : '';
      const completedStr = args.includes('--completed') ? args[args.indexOf('--completed') + 1] : '';
      const current = args.includes('--current') ? args[args.indexOf('--current') + 1] : null;
      const keyContext = args.includes('--key-context') ? args[args.indexOf('--key-context') + 1] : '';
      const filesStr = args.includes('--files') ? args[args.indexOf('--files') + 1] : '';
      const decisionsStr = args.includes('--decisions') ? args[args.indexOf('--decisions') + 1] : '';
      const nextStepsStr = args.includes('--next-steps') ? args[args.indexOf('--next-steps') + 1] : '';

      if (isNaN(phase) || !taskTitle) {
        error('checkpoint create: --phase and --task are required');
      }

      // Parse comma-separated arrays
      const plan = planStr ? planStr.split(',').map(s => s.trim()).filter(Boolean) : [];
      const completed = completedStr ? completedStr.split(',').map(s => s.trim()).filter(Boolean) : [];
      const files = filesStr ? filesStr.split(',').map(s => s.trim()).filter(Boolean) : [];
      const decisions = decisionsStr ? decisionsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
      const nextSteps = nextStepsStr ? nextStepsStr.split(',').map(s => s.trim()).filter(Boolean) : [];

      // Calculate remaining steps
      const remaining = plan.filter(step => !completed.includes(step) && step !== current);

      const checkpointData = {
        task_title: taskTitle,
        plan,
        progress: {
          completed,
          current: current || (plan.length > 0 ? plan[0] : 'not started'),
          remaining
        },
        files_touched: files,
        decisions,
        key_context: keyContext,
        next_steps: nextSteps,
        phase,
        plan_id: planId
      };

      checkpoint.createCheckpoint(checkpointData)
        .then(result => {
          output(result, raw);
        })
        .catch(err => {
          error(`Failed to create checkpoint: ${err.message}`);
        });
      break;
    }

    case 'search': {
      const query = args.includes('--query') ? args[args.indexOf('--query') + 1] : '';
      const phase = args.includes('--phase') ? parseInt(args[args.indexOf('--phase') + 1]) : undefined;
      const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : 10;

      if (!query && phase === undefined) {
        error('checkpoint search: --query or --phase required');
      }

      const searchQuery = query || `phase ${phase}`;

      checkpoint.searchCheckpoints(searchQuery, { phase, limit })
        .then(results => {
          if (raw) {
            output({ results }, raw);
          } else {
            console.log(`\n=== Checkpoint Search Results (${results.length}) ===\n`);
            for (const result of results) {
              const cp = result.checkpoint;
              console.log(`ID: ${result.id}`);
              console.log(`Task: ${cp.task_title}`);
              console.log(`Phase: ${cp.phase} - Plan: ${cp.plan_id || 'N/A'}`);
              console.log(`Progress: ${cp.progress.completed.length}/${cp.plan.length}`);
              console.log(`Current: ${cp.progress.current}`);
              console.log(`Similarity: ${(result.similarity * 100).toFixed(1)}%`);
              console.log('---');
            }
          }
        })
        .catch(err => {
          error(`Failed to search checkpoints: ${err.message}`);
        });
      break;
    }

    case 'latest': {
      const phase = parseInt(args[args.indexOf('--phase') + 1]);
      const planId = args.includes('--plan-id') ? args[args.indexOf('--plan-id') + 1] : null;

      if (isNaN(phase)) {
        error('checkpoint latest: --phase required');
      }

      checkpoint.getLatestCheckpoint(phase, planId)
        .then(result => {
          if (!result) {
            if (raw) {
              output({ found: false }, raw);
            } else {
              console.log('No checkpoint found.');
            }
            return;
          }

          if (raw) {
            output({ found: true, checkpoint: result }, raw);
          } else {
            const cp = result.checkpoint;
            console.log('\n=== Latest Checkpoint ===\n');
            console.log(`ID: ${result.id}`);
            console.log(`Task: ${cp.task_title}`);
            console.log(`Phase: ${cp.phase} - Plan: ${cp.plan_id || 'N/A'}`);
            console.log(`Progress: ${cp.progress.completed.length}/${cp.plan.length}`);
            console.log(`Current: ${cp.progress.current}`);
            console.log(`Created: ${new Date(result.created_at).toISOString()}`);
            console.log(`\nNext Steps:`);
            for (const step of cp.next_steps || []) {
              console.log(`  - ${step}`);
            }
          }
        })
        .catch(err => {
          error(`Failed to get latest checkpoint: ${err.message}`);
        });
      break;
    }

    case 'cleanup': {
      const phase = args.includes('--phase') ? parseInt(args[args.indexOf('--phase') + 1]) : undefined;
      const all = args.includes('--all');
      const olderThanStr = args.includes('--older-than') ? args[args.indexOf('--older-than') + 1] : null;

      let olderThan = null;
      if (olderThanStr) {
        // Parse duration (e.g., "24h", "7d")
        const match = olderThanStr.match(/^(\d+)(h|d)$/);
        if (!match) {
          error('checkpoint cleanup: --older-than must be in format "24h" or "7d"');
        }
        const value = parseInt(match[1]);
        const unit = match[2];
        const hours = unit === 'h' ? value : value * 24;
        olderThan = Date.now() - (hours * 60 * 60 * 1000);
      }

      if (!all && phase === undefined && !olderThan) {
        error('checkpoint cleanup: specify --phase, --older-than, or --all');
      }

      const options = {
        phase: all ? undefined : phase,
        older_than: olderThan,
        completed_only: false
      };

      checkpoint.cleanupCheckpoints(options)
        .then(result => {
          output(result, raw);
        })
        .catch(err => {
          error(`Failed to cleanup checkpoints: ${err.message}`);
        });
      break;
    }

    default:
      error(`Unknown checkpoint subcommand: ${subcommand}`);
  }
}

// ─── Execution Log ───────────────────────────────────────────────────────────

function cmdExecutionLog(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('execution-log: subcommand required (append|history|current|last-complete|stats)');
  }

  switch (subcommand) {
    case 'append': {
      // Parse event type
      const typeIndex = args.indexOf('--type');
      if (typeIndex === -1) {
        error('execution-log append: --type required');
      }
      const type = args[typeIndex + 1];

      // Build event object from args
      const event = { type };

      // Parse optional fields
      const parseArg = (flag) => {
        const idx = args.indexOf(flag);
        return idx !== -1 ? args[idx + 1] : undefined;
      };

      const phase = parseArg('--phase');
      const name = parseArg('--name');
      const status = parseArg('--status');
      const duration = parseArg('--duration');
      const checkpointId = parseArg('--checkpoint-id');
      const totalPhases = parseArg('--total-phases');

      if (phase !== undefined) event.phase = parseInt(phase);
      if (name !== undefined) event.name = name;
      if (status !== undefined) event.status = status;
      if (duration !== undefined) event.duration = parseInt(duration);
      if (checkpointId !== undefined) event.checkpoint_id = checkpointId;
      if (totalPhases !== undefined) event.total_phases = parseInt(totalPhases);

      const result = appendEvent(cwd, event);
      output(result, raw, 'Event appended to EXECUTION_LOG.md');
      break;
    }

    case 'history': {
      const events = getHistory(cwd);

      if (raw || args.includes('--json')) {
        output(events, true);
      } else {
        console.log('\n=== Execution History ===\n');
        if (events.length === 0) {
          console.log('No events in log.');
        } else {
          for (const event of events) {
            console.log(`[${event.timestamp}] ${event.type}${event.phase ? ` (Phase ${event.phase})` : ''}`);
            if (event.name) console.log(`  Name: ${event.name}`);
            if (event.status) console.log(`  Status: ${event.status}`);
            console.log('');
          }
        }
      }
      break;
    }

    case 'current': {
      const current = getCurrentPhase(cwd);
      output(current || { phase: null }, raw, current ? `Currently executing: Phase ${current.phase}` : 'No active phase');
      break;
    }

    case 'last-complete': {
      const events = getHistory(cwd);
      const completeEvents = events.filter(e => e.type === EVENT_TYPES.PHASE_COMPLETE);
      const lastComplete = completeEvents.length > 0 ? completeEvents[completeEvents.length - 1] : null;

      if (raw) {
        output({ phase: lastComplete ? lastComplete.phase : null }, raw);
      } else {
        if (lastComplete) {
          console.log(`Last completed phase: ${lastComplete.phase}`);
        } else {
          console.log('No completed phases yet.');
        }
      }
      break;
    }

    case 'stats': {
      const stats = getExecutionStats(cwd);

      if (raw) {
        output(stats, raw);
      } else {
        console.log('\n=== Execution Statistics ===\n');
        console.log(`Phases completed: ${stats.phases_completed}`);
        console.log(`Phases failed: ${stats.phases_failed}`);
        console.log(`Checkpoints: ${stats.checkpoint_count}`);
        if (stats.total_duration_ms > 0) {
          const hours = Math.floor(stats.total_duration_ms / 3600000);
          const mins = Math.floor((stats.total_duration_ms % 3600000) / 60000);
          console.log(`Total duration: ${hours}h ${mins}m`);
        }
      }
      break;
    }

    default:
      error(`execution-log: unknown subcommand "${subcommand}"`);
  }
}

// ─── Failure Handler Commands ────────────────────────────────────────────────

function cmdFailure(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('failure: subcommand required (test-retry|classify|backoff|log-failure)');
  }

  switch (subcommand) {
    case 'test-retry': {
      const failCount = parseInt(args[1] || '2', 10);
      let attempts = 0;

      const operation = async () => {
        attempts++;
        if (attempts <= failCount) {
          throw new Error(`Simulated failure ${attempts}/${failCount}`);
        }
        return { success: true, attempts };
      };

      executeWithRetry(operation, { operation: 'test-retry', verbose: true })
        .then(result => {
          if (raw) {
            output(result, true);
          } else {
            if (result.success) {
              console.log(`✓ Operation succeeded after ${result.retries} retries`);
              console.log(`Result: ${JSON.stringify(result.result)}`);
            } else {
              console.log(`✗ Operation failed after ${result.retries} retries`);
              console.log(`Error: ${result.error.message}`);
            }
          }
        })
        .catch(err => error(`test-retry failed: ${err.message}`));
      break;
    }

    case 'classify': {
      const errorMsg = args[1];
      if (!errorMsg) {
        error('classify: error message required');
      }

      const handler = new FailureHandler();
      const retryable = handler.isRetryable({ message: errorMsg });

      // Find which pattern matched (if any)
      let patternMatched = null;
      if (retryable) {
        for (const pattern of FailureHandler.RETRYABLE_PATTERNS) {
          if (pattern.test(errorMsg)) {
            patternMatched = pattern.toString();
            break;
          }
        }
      }

      const result = {
        retryable,
        pattern_matched: patternMatched,
      };

      output(result, raw, `Error is ${retryable ? 'retryable' : 'NOT retryable'}${patternMatched ? ` (matched: ${patternMatched})` : ''}`);
      break;
    }

    case 'backoff': {
      const attempt = parseInt(args[1], 10);
      const baseDelay = args[2] ? parseInt(args[2], 10) : undefined;

      if (isNaN(attempt)) {
        error('backoff: attempt number required (0-indexed)');
      }

      const handler = new FailureHandler(baseDelay ? { baseDelay } : {});
      const delayMs = handler.calculateBackoff(attempt);

      const result = {
        attempt,
        delay_ms: delayMs,
        delay_readable: formatDuration(delayMs),
      };

      output(result, raw, `Attempt ${attempt}: delay ${delayMs}ms (${result.delay_readable})`);
      break;
    }

    case 'log-failure': {
      const phase = args[1];
      const errorMsg = args[2];
      const action = args[3];

      if (!phase || !errorMsg || !action) {
        error('log-failure: phase, error, and action required');
      }

      if (!['retry', 'skip', 'escalate'].includes(action)) {
        error(`log-failure: action must be retry|skip|escalate, got "${action}"`);
      }

      const event = {
        type: 'failure',
        phase: parseInt(phase),
        error: errorMsg,
        action,
      };

      const result = appendEvent(cwd, event);
      output(result, raw, 'Failure logged to EXECUTION_LOG.md');
      break;
    }

    default:
      error(`failure: unknown subcommand "${subcommand}"`);
  }
}

// Helper for formatting duration in human-readable form
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ─── Completion Signals ──────────────────────────────────────────────────────

function cmdCompletion(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('completion: subcommand required (create|log|parse|handle)');
  }

  switch (subcommand) {
    case 'create': {
      // Create completion signal JSON
      const status = args[1];
      const phase = args[2];
      const detailsArg = args[3];

      if (!status || !phase) {
        error('completion create: status and phase required');
      }

      // Parse details from JSON string or key=value pairs
      let details = {};
      if (detailsArg) {
        try {
          // Try parsing as JSON first
          details = JSON.parse(detailsArg);
        } catch (e) {
          // Parse key=value pairs
          for (let i = 3; i < args.length; i++) {
            const [key, value] = args[i].split('=');
            if (key && value !== undefined) {
              // Try to parse value as JSON, otherwise use as string
              try {
                details[key] = JSON.parse(value);
              } catch {
                details[key] = value;
              }
            }
          }
        }
      }

      // Create appropriate signal using factory method
      let signal;
      const phaseNum = parseInt(phase);

      switch (status.toLowerCase()) {
        case 'success':
          signal = CompletionSignal.success(phaseNum, details);
          break;
        case 'failure':
          const error = new Error(details.error || 'Unknown error');
          if (details.stack) error.stack = details.stack;
          signal = CompletionSignal.failure(phaseNum, error, details);
          break;
        case 'blocked':
          signal = CompletionSignal.blocked(phaseNum, details.reason || 'Unknown reason', details);
          break;
        case 'skipped':
          signal = CompletionSignal.skipped(phaseNum, details.reason || 'User skipped');
          break;
        default:
          error(`completion create: unknown status "${status}"`);
      }

      output(signal.toJSON(), raw);
      break;
    }

    case 'log': {
      // Log completion signal to EXECUTION_LOG.md
      const signalArg = args[1];

      if (!signalArg) {
        error('completion log: signal JSON required');
      }

      let signalData;
      try {
        signalData = JSON.parse(signalArg);
      } catch (e) {
        error(`completion log: invalid JSON - ${e.message}`);
      }

      // Append to EXECUTION_LOG.md as NDJSON event
      const event = {
        type: EVENT_TYPES.PHASE_COMPLETE,
        phase: signalData.phase,
        status: signalData.status,
        timestamp: signalData.timestamp,
        ...signalData
      };

      appendEvent(cwd, event);
      output({ logged: true }, raw, 'Completion signal logged');
      break;
    }

    case 'parse': {
      // Parse completion signal from JSON
      const signalArg = args[1];

      if (!signalArg) {
        error('completion parse: signal JSON required');
      }

      let signalData;
      try {
        signalData = JSON.parse(signalArg);
      } catch (e) {
        error(`completion parse: invalid JSON - ${e.message}`);
      }

      // Reconstruct signal object to get helper methods
      const signal = new CompletionSignal(
        signalData.status,
        signalData.phase,
        signalData
      );

      output({
        status: signal.status,
        phase: signal.phase,
        isTerminal: signal.isTerminal(),
        canRetry: signal.canRetry()
      }, raw);
      break;
    }

    case 'handle': {
      // Process completion signal and output decision
      const signalArg = args[1];

      if (!signalArg) {
        error('completion handle: signal JSON required');
      }

      let signalData;
      try {
        signalData = JSON.parse(signalArg);
      } catch (e) {
        error(`completion handle: invalid JSON - ${e.message}`);
      }

      // Reconstruct signal to use helper methods
      const signal = new CompletionSignal(
        signalData.status,
        signalData.phase,
        signalData
      );

      let decision;

      switch (signal.status) {
        case COMPLETION_STATUS.SUCCESS:
          decision = {
            continue: true,
            nextPhase: signal.phase + 1
          };
          break;

        case COMPLETION_STATUS.FAILURE:
          if (signal.canRetry()) {
            decision = {
              continue: false,
              action: 'retry',
              backoff: signal.details.retryOptions?.backoffMs || 2000
            };
          } else {
            decision = {
              continue: false,
              action: 'escalate'
            };
          }
          break;

        case COMPLETION_STATUS.BLOCKED:
          if (signal.details.userInputRequired) {
            decision = {
              continue: false,
              action: 'await_user'
            };
          } else if (signal.details.blockingDependencies && signal.details.blockingDependencies.length > 0) {
            decision = {
              continue: false,
              action: 'await_dependency',
              deps: signal.details.blockingDependencies
            };
          } else {
            decision = {
              continue: false,
              action: 'blocked',
              reason: signal.details.reason
            };
          }
          break;

        case COMPLETION_STATUS.SKIPPED:
          decision = {
            continue: true,
            nextPhase: signal.phase + 1,
            skipped: true
          };
          break;

        default:
          error(`completion handle: unknown status "${signal.status}"`);
      }

      output(decision, raw);
      break;
    }

    default:
      error(`completion: unknown subcommand "${subcommand}"`);
  }
}

// ─── Token Budget Monitoring ─────────────────────────────────────────────────

function cmdToken(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('token: subcommand required (init|reserve|record|report|reset)');
  }

  const budgetPath = path.join(cwd, '.planning', 'token_budget.json');

  switch (subcommand) {
    case 'init': {
      // Initialize token budget file
      const model = args[1] || 'opus';
      const graduated = args.includes('--graduated');
      const telegramEnabled = args.includes('--telegram');

      let monitor;
      if (graduated) {
        const { GraduatedBudgetMonitor } = require('./graduated-alerts.js');
        monitor = new GraduatedBudgetMonitor(model, 200000, { telegramEnabled });
      } else {
        monitor = new TokenBudgetMonitor(model, 200000);
      }

      // Ensure .planning directory exists
      const planningDir = path.join(cwd, '.planning');
      if (!fs.existsSync(planningDir)) {
        fs.mkdirSync(planningDir, { recursive: true });
      }

      fs.writeFileSync(budgetPath, JSON.stringify(monitor.toJSON(), null, 2));
      output({ initialized: true, model, max_tokens: 200000, graduated, telegram: telegramEnabled }, raw, `Token budget initialized for ${model} (200k limit, graduated=${graduated}, telegram=${telegramEnabled})`);
      break;
    }

    case 'reserve': {
      // Reserve tokens before operation
      const estimatedTokens = parseInt(args[1]);
      const operation = args[2] || 'unknown-operation';

      if (isNaN(estimatedTokens)) {
        error('token reserve: estimatedTokens (number) required');
      }

      // Load existing budget
      let monitor;
      if (fs.existsSync(budgetPath)) {
        const data = JSON.parse(fs.readFileSync(budgetPath, 'utf-8'));
        monitor = TokenBudgetMonitor.fromJSON(data);
      } else {
        // Auto-initialize if not exists
        monitor = new TokenBudgetMonitor();
      }

      const canProceed = monitor.reserve(estimatedTokens, operation);

      // Update budget file
      fs.writeFileSync(budgetPath, JSON.stringify(monitor.toJSON(), null, 2));

      const report = monitor.getReport();
      output({
        can_proceed: canProceed,
        alerts: report.active_alerts,
        utilization: report.utilization_percent
      }, raw);

      // Exit code: 0 if can proceed, 1 if blocked
      process.exit(canProceed ? 0 : 1);
    }

    case 'record': {
      // Record actual usage after operation
      const actualTokens = parseInt(args[1]);
      const phase = args[2] || 'unknown-phase';

      if (isNaN(actualTokens)) {
        error('token record: actualTokens (number) required');
      }

      // Load existing budget
      let monitor;
      if (fs.existsSync(budgetPath)) {
        const data = JSON.parse(fs.readFileSync(budgetPath, 'utf-8'));

        // Detect if graduated state exists
        if (data.thresholdsPassed !== undefined) {
          const { GraduatedBudgetMonitor } = require('./graduated-alerts.js');
          monitor = GraduatedBudgetMonitor.fromJSON(data);
        } else {
          monitor = TokenBudgetMonitor.fromJSON(data);
        }
      } else {
        // Auto-initialize if not exists
        monitor = new TokenBudgetMonitor();
      }

      monitor.recordUsage(actualTokens, phase);

      // Update budget file
      fs.writeFileSync(budgetPath, JSON.stringify(monitor.toJSON(), null, 2));

      output({ recorded: true, tokens: actualTokens, phase }, raw, `Recorded ${actualTokens} tokens for ${phase}`);
      break;
    }

    case 'report': {
      // Display token usage report
      if (!fs.existsSync(budgetPath)) {
        output({ available: false, reason: 'Token budget not initialized' }, raw, 'Token budget not initialized (run: token init)');
        break;
      }

      const data = JSON.parse(fs.readFileSync(budgetPath, 'utf-8'));

      // Detect if graduated state exists
      let monitor, report;
      if (data.thresholdsPassed !== undefined) {
        const { GraduatedBudgetMonitor } = require('./graduated-alerts.js');
        monitor = GraduatedBudgetMonitor.fromJSON(data);
        report = monitor.getGraduatedReport();
      } else {
        monitor = TokenBudgetMonitor.fromJSON(data);
        report = monitor.getReport();
      }

      output(report, raw);
      break;
    }

    case 'reset': {
      // Reset for new session
      const monitor = new TokenBudgetMonitor();
      fs.writeFileSync(budgetPath, JSON.stringify(monitor.toJSON(), null, 2));
      output({ reset: true }, raw, 'Token budget reset');
      break;
    }

    default:
      error(`token: unknown subcommand "${subcommand}"`);
  }
}

// ─── Graduated Budget Alerts ──────────────────────────────────────────────────

function cmdAlerts(cwd, args, raw) {
  const subcommand = args[0];
  const { GraduatedBudgetMonitor, GRADUATED_THRESHOLDS } = require('./graduated-alerts.js');
  const budgetPath = path.join(cwd, '.planning', 'token_budget.json');

  if (!subcommand) {
    error('alerts: subcommand required (status|test|reset|history)');
  }

  switch (subcommand) {
    case 'status': {
      // Load existing budget state if available
      let monitor;
      if (fs.existsSync(budgetPath)) {
        const data = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
        monitor = GraduatedBudgetMonitor.fromJSON(data);
      } else {
        monitor = new GraduatedBudgetMonitor();
      }

      const utilization = monitor.currentUsage / monitor.maxTokens;
      output({
        current_usage: monitor.currentUsage,
        max_tokens: monitor.maxTokens,
        utilization_percent: (utilization * 100).toFixed(1),
        thresholds: GRADUATED_THRESHOLDS,
        thresholds_passed: Array.from(monitor.thresholdsPassed),
        alerts_fired: monitor.graduatedAlerts.length
      }, raw);
      break;
    }

    case 'test': {
      const utilizationPercent = parseFloat(args[1]) || 0;
      const testMonitor = new GraduatedBudgetMonitor('opus', 200000);
      const testTokens = Math.floor(200000 * (utilizationPercent / 100));

      if (!raw) {
        console.log(`Testing ${utilizationPercent}% utilization (${testTokens} tokens)...`);
      }

      try {
        testMonitor.recordUsage(testTokens, 'test-phase');
      } catch (error) {
        if (!raw) {
          console.log(`Halt triggered: ${error.message}`);
        }
      }

      output({
        utilization_tested: `${utilizationPercent}%`,
        thresholds_triggered: Array.from(testMonitor.thresholdsPassed),
        alerts: testMonitor.graduatedAlerts
      }, raw);
      break;
    }

    case 'reset': {
      if (fs.existsSync(budgetPath)) {
        const data = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
        data.thresholdsPassed = [];
        data.graduatedAlerts = [];
        fs.writeFileSync(budgetPath, JSON.stringify(data, null, 2));
        output({ reset: true }, raw, 'Graduated alert state reset');
      } else {
        output({ reset: false, reason: 'No budget file found' }, raw, 'No budget file to reset');
      }
      break;
    }

    case 'history': {
      if (fs.existsSync(budgetPath)) {
        const data = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
        const alerts = data.graduatedAlerts || [];

        if (args.includes('--json') || raw) {
          output(alerts, raw);
        } else {
          if (alerts.length === 0) {
            console.log('No graduated alerts recorded');
          } else {
            console.log('Level      | Threshold | Utilization | Phase        | Timestamp');
            console.log('-'.repeat(75));
            alerts.forEach(a => {
              console.log(`${a.level.padEnd(10)} | ${a.threshold.padEnd(9)} | ${a.utilization.padEnd(11)} | ${(a.phase || '').padEnd(12)} | ${a.timestamp}`);
            });
          }
        }
      } else {
        output({ available: false, reason: 'No budget history' }, raw, 'No budget history available');
      }
      break;
    }

    default:
      error(`alerts: unknown subcommand "${subcommand}"`);
  }
}

// ─── Task Chunking ────────────────────────────────────────────────────────────

function cmdTask(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('task: subcommand required (analyze|chunk|batch|estimate|progress|resume)');
  }

  const progressPath = path.join(cwd, '.planning', 'batch_progress.json');

  switch (subcommand) {
    case 'analyze': {
      // Analyze a task for chunking requirements
      const descIdx = args.indexOf('--description');
      const description = descIdx !== -1 ? args[descIdx + 1] : null;
      const filesIdx = args.indexOf('--files');
      const filesGlob = filesIdx !== -1 ? args[filesIdx + 1] : null;

      if (!description) {
        error('task analyze: --description required');
      }

      // Expand glob if provided
      let files = [];
      if (filesGlob) {
        try {
          const globResult = execSync(`ls -1 ${filesGlob} 2>/dev/null || true`, { cwd, encoding: 'utf-8' });
          files = globResult.trim().split('\n').filter(Boolean);
        } catch {
          // Glob expansion failed, use empty
        }
      }

      const task = { description, files };
      const result = analyzeTask(task);

      const humanMsg = result.needsChunking
        ? `Task requires chunking: ${result.chunkCount} chunks via ${result.strategy} strategy`
        : `Task is manageable: ${result.complexity} complexity (${result.estimatedTokens} estimated tokens)`;

      output(result, raw, humanMsg);
      break;
    }

    case 'chunk': {
      // Get chunk definitions for a task
      const descIdx = args.indexOf('--description');
      const description = descIdx !== -1 ? args[descIdx + 1] : null;
      const filesIdx = args.indexOf('--files');
      const filesGlob = filesIdx !== -1 ? args[filesIdx + 1] : null;
      const strategyIdx = args.indexOf('--strategy');
      const strategyOverride = strategyIdx !== -1 ? args[strategyIdx + 1] : null;

      if (!description) {
        error('task chunk: --description required');
      }

      let files = [];
      if (filesGlob) {
        try {
          const globResult = execSync(`ls -1 ${filesGlob} 2>/dev/null || true`, { cwd, encoding: 'utf-8' });
          files = globResult.trim().split('\n').filter(Boolean);
        } catch {
          // Glob expansion failed
        }
      }

      const chunker = new TaskChunker();
      const task = { description, files };
      const estimate = chunker.estimateTaskTokens(task);
      const strategy = strategyOverride || chunker.selectChunkingStrategy(task, estimate);
      const chunkCount = chunker.calculateChunkCount(estimate.tokens, strategy, estimate.signals);
      const chunks = chunker.createChunks(task, strategy, chunkCount, estimate.signals);

      output({
        strategy,
        chunkCount,
        chunks
      }, raw, `Created ${chunkCount} chunks using ${strategy} strategy`);
      break;
    }

    case 'batch': {
      // Get batch breakdown for repetitive operations
      const descIdx = args.indexOf('--description');
      const description = descIdx !== -1 ? args[descIdx + 1] : null;
      const countIdx = args.indexOf('--count');
      const batchCount = countIdx !== -1 ? parseInt(args[countIdx + 1], 10) : 10;

      if (!description) {
        error('task batch: --description required');
      }

      const chunker = new TaskChunker();
      const operationCount = chunker.extractOperationCount(description);
      const opsPerBatch = Math.ceil(operationCount / batchCount);

      const batches = [];
      for (let i = 0; i < batchCount; i++) {
        const start = i * opsPerBatch + 1;
        const end = Math.min((i + 1) * opsPerBatch, operationCount);
        if (start <= operationCount) {
          batches.push({
            batch: i + 1,
            range: `items ${start}-${end}`,
            count: end - start + 1
          });
        }
      }

      output({
        totalOperations: operationCount,
        batchCount: batches.length,
        batches
      }, raw, batches.map(b => `Batch ${b.batch}: ${b.range} (${b.count} items)`).join('\n'));
      break;
    }

    case 'estimate': {
      // Quick token estimate without full analysis
      const descIdx = args.indexOf('--description');
      const description = descIdx !== -1 ? args[descIdx + 1] : null;
      const filesIdx = args.indexOf('--files');
      const fileCount = filesIdx !== -1 ? parseInt(args[filesIdx + 1], 10) : 0;

      if (!description) {
        error('task estimate: --description required');
      }

      // Create minimal task object
      const task = {
        description,
        files: Array(fileCount || 0).fill('file.js')
      };

      const result = estimateTaskTokens(task);
      output(result, raw, `Estimated ${result.tokens} tokens (${result.complexity})`);
      break;
    }

    case 'progress': {
      // Show batch progress from checkpoint file
      if (!fs.existsSync(progressPath)) {
        output({ available: false, reason: 'No batch progress file found' }, raw, 'No active batch execution');
        break;
      }

      const data = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
      const coordinator = BatchCoordinator.fromJSON(data);
      const progress = coordinator.getProgress();

      output(progress, raw, `Progress: ${progress.completed}/${progress.total} chunks (${progress.percentComplete}%)`);
      break;
    }

    case 'resume': {
      // Resume from batch checkpoint
      if (!fs.existsSync(progressPath)) {
        output({ available: false, reason: 'No batch progress file found' }, raw, 'No batch to resume');
        break;
      }

      const data = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
      const coordinator = BatchCoordinator.fromJSON(data);
      const nextChunk = coordinator.getNextChunk();

      if (!nextChunk) {
        output({ complete: true, progress: coordinator.getProgress() }, raw, 'All chunks complete');
        break;
      }

      output({
        nextChunk,
        progress: coordinator.getProgress()
      }, raw, `Next chunk: ${nextChunk.id} - ${nextChunk.description}`);
      break;
    }

    default:
      error(`task: unknown subcommand "${subcommand}"`);
  }
}

// ─── Observability Commands ──────────────────────────────────────────────────

async function cmdObservability(args, raw) {
  const subcommand = args[0];

  switch (subcommand) {
    case 'init': {
      const obs = require('./observability.js');
      obs.initTracing({ serviceName: 'gsd-cli' });
      break;
    }

    case 'status': {
      const obs = require('./observability.js');
      output({
        enabled: obs.isTracingEnabled(),
        endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'not configured'
      }, raw);
      break;
    }

    case 'cost': {
      const llm = require('./llm-metrics.js');
      const model = args[1] || 'opus';
      const input = parseInt(args[2]) || 0;
      const output_tokens = parseInt(args[3]) || 0;
      const cachedIdx = args.indexOf('--cached');
      const cached = cachedIdx > -1 ? parseInt(args[cachedIdx + 1]) : 0;

      const cost = llm.calculateCost(model, {
        input_tokens: input,
        output_tokens: output_tokens,
        cache_read_input_tokens: cached
      });

      output({
        model,
        input_tokens: input,
        output_tokens: output_tokens,
        cached_tokens: cached,
        ...cost
      }, raw);
      break;
    }

    case 'shutdown': {
      const obs = require('./observability.js');
      await obs.shutdownTracing();
      break;
    }

    default:
      error('Usage: observability init|status|cost|shutdown');
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

async function cmdDashboard(args) {
  const subcommand = args[0];
  const { startDashboard, stopDashboard } = require('./dashboard-server.js');

  switch (subcommand) {
    case 'start': {
      const httpPort = parseInt(args[args.indexOf('--http') + 1]) || 3000;
      const wsPort = parseInt(args[args.indexOf('--ws') + 1]) || 8080;
      startDashboard({ httpPort, wsPort });
      console.log('Dashboard server running. Press Ctrl+C to stop.');
      // Keep process alive
      await new Promise(() => {}); // Never resolves
      break;
    }

    case 'stop': {
      stopDashboard();
      break;
    }

    default:
      error('Usage: dashboard start [--http PORT] [--ws PORT] | stop');
  }
}

// ─── Health Check ─────────────────────────────────────────────────────────────

async function cmdHealth(args) {
  console.log('GSD Phase 8 Health Check\n');
  console.log('='.repeat(50));

  const checks = [];

  // Check 1: Telegram credentials
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramOwner = process.env.TELEGRAM_OWNER_ID;
  checks.push({
    name: 'Telegram Credentials',
    status: telegramToken && telegramOwner ? 'PASS' : 'FAIL',
    message: telegramToken && telegramOwner ?
      'Bot token and owner ID configured' :
      'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_OWNER_ID in .env'
  });

  // Check 2: Anthropic API key
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  checks.push({
    name: 'Anthropic API Key',
    status: anthropicKey ? 'PASS' : 'FAIL',
    message: anthropicKey ?
      'API key configured for Haiku' :
      'Missing ANTHROPIC_API_KEY in .env'
  });

  // Check 3: Whisper model
  const { checkWhisperModel } = require('./whisper-transcribe.js');
  const whisperStatus = await checkWhisperModel();
  checks.push({
    name: 'Whisper Model',
    status: whisperStatus.available ? 'PASS' : 'WARN',
    message: whisperStatus.available ?
      `Model ready: ${whisperStatus.path}` :
      'Model not downloaded (voice messages disabled)'
  });

  // Check 4: OpenTelemetry
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  checks.push({
    name: 'OpenTelemetry',
    status: otelEndpoint ? 'PASS' : 'WARN',
    message: otelEndpoint ?
      `Exporting to: ${otelEndpoint}` :
      'No endpoint configured (tracing disabled)'
  });

  // Check 5: Session logs directory
  const fs = require('fs');
  const logsDir = '.planning/telegram-sessions';
  const logsDirExists = fs.existsSync(logsDir);
  checks.push({
    name: 'Session Logs',
    status: logsDirExists ? 'PASS' : 'WARN',
    message: logsDirExists ?
      `Directory exists: ${logsDir}` :
      `Directory will be created on first session`
  });

  // Check 6: Dashboard ports
  const net = require('net');
  const isDashboardPortFree = await checkPort(8765);
  checks.push({
    name: 'Dashboard Port 8765',
    status: isDashboardPortFree ? 'PASS' : 'WARN',
    message: isDashboardPortFree ?
      'Port available' :
      'Port in use (use --http flag for custom port)'
  });

  // Print results
  let allPass = true;
  checks.forEach(check => {
    const symbol = check.status === 'PASS' ? '✓' :
                    check.status === 'WARN' ? '⚠' : '✗';
    const color = check.status === 'PASS' ? '\x1b[32m' :
                   check.status === 'WARN' ? '\x1b[33m' : '\x1b[31m';
    console.log(`${color}${symbol}\x1b[0m ${check.name}: ${check.message}`);

    if (check.status === 'FAIL') allPass = false;
  });

  console.log('\n' + '='.repeat(50));

  if (allPass) {
    console.log('\x1b[32m✓ All critical checks passed!\x1b[0m\n');
    console.log('Ready to use:');
    console.log('  Telegram MCP server    - Configure via .mcp.json (Phase 14 daemon architecture)');
    console.log('  dashboard start        - Launch real-time dashboard');
  } else {
    console.log('\x1b[31m✗ Some checks failed\x1b[0m\n');
    console.log('See SETUP.md for configuration instructions');
  }
}

async function checkPort(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

// ─── Savings Report ───────────────────────────────────────────────────────────

function cmdSavings(args, raw) {
  const subcommand = args[0] || 'report';
  const { generateReport, formatReportTable, calculateSavings } = require('./savings-report.js');

  switch (subcommand) {
    case 'report': {
      const report = generateReport();
      if (args.includes('--json')) {
        output(report, raw);
      } else {
        console.log(formatReportTable(report));
      }
      break;
    }

    case 'calculate': {
      // Manual calculation: savings calculate --haiku 50000 --sonnet 100000 --opus 20000
      const haikuIdx = args.indexOf('--haiku');
      const sonnetIdx = args.indexOf('--sonnet');
      const opusIdx = args.indexOf('--opus');

      const haiku = haikuIdx > -1 ? parseInt(args[haikuIdx + 1]) : 0;
      const sonnet = sonnetIdx > -1 ? parseInt(args[sonnetIdx + 1]) : 0;
      const opus = opusIdx > -1 ? parseInt(args[opusIdx + 1]) : 0;

      const result = calculateSavings({
        haiku: { input: Math.floor(haiku * 0.7), output: Math.floor(haiku * 0.3) },
        sonnet: { input: Math.floor(sonnet * 0.7), output: Math.floor(sonnet * 0.3) },
        opus: { input: Math.floor(opus * 0.7), output: Math.floor(opus * 0.3) }
      });

      output(result, raw);
      break;
    }

    default:
      error('Usage: savings report [--json] | calculate --haiku N --sonnet N --opus N');
  }
}

// ─── Parallel Execution ───────────────────────────────────────────────────────

async function cmdParallel(cwd, args, raw) {
  const subcommand = args[0];
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const budgetPath = path.join(cwd, '.planning', 'token_budget.json');

  if (!subcommand) {
    error('parallel: subcommand required (analyze|check|config|simulate)');
  }

  // Helper to get phases
  const getPhases = async () => {
    if (!fs.existsSync(roadmapPath)) {
      error('ROADMAP.md not found');
    }
    const { phases } = await parseRoadmap(roadmapPath);
    return phases;
  };

  switch (subcommand) {
    case 'config': {
      // Display parallel execution config
      output(PARALLEL_CONFIG, raw, Object.entries(PARALLEL_CONFIG)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n'));
      break;
    }

    case 'analyze': {
      // Analyze parallel opportunities from roadmap
      const phases = await getPhases();
      const analysis = analyzeParallel(phases);

      if (raw) {
        output(analysis, raw);
      } else {
        console.log(`Total phases: ${analysis.totalPhases}`);
        console.log(`Max parallelism: ${analysis.maxParallelism}`);
        console.log('\nParallel groups (phases at same level can run together):');
        analysis.parallelGroups.forEach((group, idx) => {
          const canParallel = group.length > 1 ? '(parallel)' : '(sequential)';
          console.log(`  Wave ${idx + 1}: [${group.join(', ')}] ${canParallel}`);
        });
      }
      break;
    }

    case 'check': {
      // Check if parallel execution is possible with current token budget
      const phases = await getPhases();
      const analysis = analyzeParallel(phases);
      const executor = new ParallelPhaseExecutor(PARALLEL_CONFIG.MAX_WORKERS);

      // Load token budget if available
      let tokenMonitor = null;
      if (fs.existsSync(budgetPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(budgetPath, 'utf-8'));
          tokenMonitor = TokenBudgetMonitor.fromJSON(data);
        } catch (e) {
          // Continue without monitor
        }
      }

      const results = [];
      for (const group of analysis.parallelGroups) {
        const check = executor.canExecuteInParallel(group, tokenMonitor);
        results.push({
          group,
          ...check
        });
      }

      const canParallel = results.some(r => r.canParallel && r.group?.length > 1);

      if (raw) {
        output({
          canParallel,
          groups: results,
          tokenBudget: tokenMonitor ? tokenMonitor.getReport() : null
        }, raw);
      } else {
        console.log(`Parallel execution: ${canParallel ? 'POSSIBLE' : 'SEQUENTIAL_ONLY'}`);
        console.log(`\nGroup analysis:`);
        for (const r of results) {
          const status = r.canParallel ? 'CAN_PROCEED' : 'FALLBACK_SEQUENTIAL';
          console.log(`  [${r.group.join(', ')}]: ${status}`);
          if (!r.canParallel && r.shortfall) {
            console.log(`    Shortfall: ${r.shortfall} tokens`);
          }
        }

        if (tokenMonitor) {
          const report = tokenMonitor.getReport();
          console.log(`\nToken budget: ${report.current_usage}/${report.max_tokens} (${report.utilization_percent}%)`);
        } else {
          console.log('\nToken budget: Not initialized (run: gsd-tools token init)');
        }
      }

      // Exit code: 0 if parallel possible, 1 if sequential only
      process.exit(canParallel ? 0 : 1);
    }

    case 'simulate': {
      // Simulate parallel execution without actually spawning
      const groupsArg = args[1]; // Format: "1,2:3,4" means [1,2] then [3,4]

      if (!groupsArg) {
        // Use auto-detected groups from roadmap
        const phases = await getPhases();
        const analysis = analyzeParallel(phases);

        // Estimate durations
        let parallelTime = 0;
        let sequentialTime = 0;

        for (const group of analysis.parallelGroups) {
          const groupTime = group.length * 10; // 10 min per phase estimate
          parallelTime += Math.max(...Array(group.length).fill(10)); // Parallel: max of group
          sequentialTime += groupTime; // Sequential: sum of group
        }

        output({
          parallelGroups: analysis.parallelGroups,
          estimatedParallelMinutes: parallelTime,
          estimatedSequentialMinutes: sequentialTime,
          timeSavings: `${Math.round((1 - parallelTime / sequentialTime) * 100)}%`
        }, raw, `Parallel: ~${parallelTime} min | Sequential: ~${sequentialTime} min | Savings: ${Math.round((1 - parallelTime / sequentialTime) * 100)}%`);
      } else {
        // Parse custom groups
        const customGroups = groupsArg.split(':').map(g =>
          g.split(',').map(n => parseInt(n.trim(), 10))
        );

        let parallelTime = 0;
        let sequentialTime = 0;

        for (const group of customGroups) {
          const groupTime = group.length * 10;
          parallelTime += Math.max(...Array(group.length).fill(10));
          sequentialTime += groupTime;
        }

        output({
          customGroups,
          estimatedParallelMinutes: parallelTime,
          estimatedSequentialMinutes: sequentialTime,
          timeSavings: `${Math.round((1 - parallelTime / sequentialTime) * 100)}%`
        }, raw);
      }
      break;
    }

    default:
      error(`parallel: unknown subcommand "${subcommand}"`);
  }
}

// ─── Web Search (Brave API) ──────────────────────────────────────────────────

async function cmdWebsearch(query, options, raw) {
  const apiKey = process.env.BRAVE_API_KEY;

  if (!apiKey) {
    // No key = silent skip, agent falls back to built-in WebSearch
    output({ available: false, reason: 'BRAVE_API_KEY not set' }, raw, '');
    return;
  }

  if (!query) {
    output({ available: false, error: 'Query required' }, raw, '');
    return;
  }

  const params = new URLSearchParams({
    q: query,
    count: String(options.limit || 10),
    country: 'us',
    search_lang: 'en',
    text_decorations: 'false'
  });

  if (options.freshness) {
    params.set('freshness', options.freshness);
  }

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': apiKey
        }
      }
    );

    if (!response.ok) {
      output({ available: false, error: `API error: ${response.status}` }, raw, '');
      return;
    }

    const data = await response.json();

    const results = (data.web?.results || []).map(r => ({
      title: r.title,
      url: r.url,
      description: r.description,
      age: r.age || null
    }));

    output({
      available: true,
      query,
      count: results.length,
      results
    }, raw, results.map(r => `${r.title}\n${r.url}\n${r.description}`).join('\n\n'));
  } catch (err) {
    output({ available: false, error: err.message }, raw, '');
  }
}

// ─── Frontmatter CRUD ────────────────────────────────────────────────────────

function cmdFrontmatterGet(cwd, filePath, field, raw) {
  if (!filePath) { error('file path required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }
  const fm = extractFrontmatter(content);
  if (field) {
    const value = fm[field];
    if (value === undefined) { output({ error: 'Field not found', field }, raw); return; }
    output({ [field]: value }, raw, JSON.stringify(value));
  } else {
    output(fm, raw);
  }
}

function cmdFrontmatterSet(cwd, filePath, field, value, raw) {
  if (!filePath || !field || value === undefined) { error('file, field, and value required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  if (!fs.existsSync(fullPath)) { output({ error: 'File not found', path: filePath }, raw); return; }
  const content = fs.readFileSync(fullPath, 'utf-8');
  const fm = extractFrontmatter(content);
  let parsedValue;
  try { parsedValue = JSON.parse(value); } catch { parsedValue = value; }
  fm[field] = parsedValue;
  const newContent = spliceFrontmatter(content, fm);
  fs.writeFileSync(fullPath, newContent, 'utf-8');
  output({ updated: true, field, value: parsedValue }, raw, 'true');
}

function cmdFrontmatterMerge(cwd, filePath, data, raw) {
  if (!filePath || !data) { error('file and data required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  if (!fs.existsSync(fullPath)) { output({ error: 'File not found', path: filePath }, raw); return; }
  const content = fs.readFileSync(fullPath, 'utf-8');
  const fm = extractFrontmatter(content);
  let mergeData;
  try { mergeData = JSON.parse(data); } catch { error('Invalid JSON for --data'); return; }
  Object.assign(fm, mergeData);
  const newContent = spliceFrontmatter(content, fm);
  fs.writeFileSync(fullPath, newContent, 'utf-8');
  output({ merged: true, fields: Object.keys(mergeData) }, raw, 'true');
}

const FRONTMATTER_SCHEMAS = {
  plan: { required: ['phase', 'plan', 'type', 'wave', 'depends_on', 'files_modified', 'autonomous', 'must_haves'] },
  summary: { required: ['phase', 'plan', 'subsystem', 'tags', 'duration', 'completed'] },
  verification: { required: ['phase', 'verified', 'status', 'score'] },
};

function cmdFrontmatterValidate(cwd, filePath, schemaName, raw) {
  if (!filePath || !schemaName) { error('file and schema required'); }
  const schema = FRONTMATTER_SCHEMAS[schemaName];
  if (!schema) { error(`Unknown schema: ${schemaName}. Available: ${Object.keys(FRONTMATTER_SCHEMAS).join(', ')}`); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }
  const fm = extractFrontmatter(content);
  const missing = schema.required.filter(f => fm[f] === undefined);
  const present = schema.required.filter(f => fm[f] !== undefined);
  output({ valid: missing.length === 0, missing, present, schema: schemaName }, raw, missing.length === 0 ? 'valid' : 'invalid');
}

// ─── Verification Suite ──────────────────────────────────────────────────────

function cmdVerifyPlanStructure(cwd, filePath, raw) {
  if (!filePath) { error('file path required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }

  const fm = extractFrontmatter(content);
  const errors = [];
  const warnings = [];

  // Check required frontmatter fields
  const required = ['phase', 'plan', 'type', 'wave', 'depends_on', 'files_modified', 'autonomous', 'must_haves'];
  for (const field of required) {
    if (fm[field] === undefined) errors.push(`Missing required frontmatter field: ${field}`);
  }

  // Parse and check task elements
  const taskPattern = /<task[^>]*>([\s\S]*?)<\/task>/g;
  const tasks = [];
  let taskMatch;
  while ((taskMatch = taskPattern.exec(content)) !== null) {
    const taskContent = taskMatch[1];
    const nameMatch = taskContent.match(/<name>([\s\S]*?)<\/name>/);
    const taskName = nameMatch ? nameMatch[1].trim() : 'unnamed';
    const hasFiles = /<files>/.test(taskContent);
    const hasAction = /<action>/.test(taskContent);
    const hasVerify = /<verify>/.test(taskContent);
    const hasDone = /<done>/.test(taskContent);

    if (!nameMatch) errors.push('Task missing <name> element');
    if (!hasAction) errors.push(`Task '${taskName}' missing <action>`);
    if (!hasVerify) warnings.push(`Task '${taskName}' missing <verify>`);
    if (!hasDone) warnings.push(`Task '${taskName}' missing <done>`);
    if (!hasFiles) warnings.push(`Task '${taskName}' missing <files>`);

    tasks.push({ name: taskName, hasFiles, hasAction, hasVerify, hasDone });
  }

  if (tasks.length === 0) warnings.push('No <task> elements found');

  // Wave/depends_on consistency
  if (fm.wave && parseInt(fm.wave) > 1 && (!fm.depends_on || (Array.isArray(fm.depends_on) && fm.depends_on.length === 0))) {
    warnings.push('Wave > 1 but depends_on is empty');
  }

  // Autonomous/checkpoint consistency
  const hasCheckpoints = /<task\s+type=["']?checkpoint/.test(content);
  if (hasCheckpoints && fm.autonomous !== 'false' && fm.autonomous !== false) {
    errors.push('Has checkpoint tasks but autonomous is not false');
  }

  output({
    valid: errors.length === 0,
    errors,
    warnings,
    task_count: tasks.length,
    tasks,
    frontmatter_fields: Object.keys(fm),
  }, raw, errors.length === 0 ? 'valid' : 'invalid');
}

function cmdVerifyPhaseCompleteness(cwd, phase, raw) {
  if (!phase) { error('phase required'); }
  const phaseInfo = findPhaseInternal(cwd, phase);
  if (!phaseInfo || !phaseInfo.found) {
    output({ error: 'Phase not found', phase }, raw);
    return;
  }

  const errors = [];
  const warnings = [];
  const phaseDir = path.join(cwd, phaseInfo.directory);

  // List plans and summaries
  let files;
  try { files = fs.readdirSync(phaseDir); } catch { output({ error: 'Cannot read phase directory' }, raw); return; }

  const plans = files.filter(f => f.match(/-PLAN\.md$/i));
  const summaries = files.filter(f => f.match(/-SUMMARY\.md$/i));

  // Extract plan IDs (everything before -PLAN.md)
  const planIds = new Set(plans.map(p => p.replace(/-PLAN\.md$/i, '')));
  const summaryIds = new Set(summaries.map(s => s.replace(/-SUMMARY\.md$/i, '')));

  // Plans without summaries
  const incompletePlans = [...planIds].filter(id => !summaryIds.has(id));
  if (incompletePlans.length > 0) {
    errors.push(`Plans without summaries: ${incompletePlans.join(', ')}`);
  }

  // Summaries without plans (orphans)
  const orphanSummaries = [...summaryIds].filter(id => !planIds.has(id));
  if (orphanSummaries.length > 0) {
    warnings.push(`Summaries without plans: ${orphanSummaries.join(', ')}`);
  }

  output({
    complete: errors.length === 0,
    phase: phaseInfo.phase_number,
    plan_count: plans.length,
    summary_count: summaries.length,
    incomplete_plans: incompletePlans,
    orphan_summaries: orphanSummaries,
    errors,
    warnings,
  }, raw, errors.length === 0 ? 'complete' : 'incomplete');
}

function cmdVerifyReferences(cwd, filePath, raw) {
  if (!filePath) { error('file path required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }

  const found = [];
  const missing = [];

  // Find @-references: @path/to/file (must contain / to be a file path)
  const atRefs = content.match(/@([^\s\n,)]+\/[^\s\n,)]+)/g) || [];
  for (const ref of atRefs) {
    const cleanRef = ref.slice(1); // remove @
    const resolved = cleanRef.startsWith('~/')
      ? path.join(process.env.HOME || '', cleanRef.slice(2))
      : path.join(cwd, cleanRef);
    if (fs.existsSync(resolved)) {
      found.push(cleanRef);
    } else {
      missing.push(cleanRef);
    }
  }

  // Find backtick file paths that look like real paths (contain / and have extension)
  const backtickRefs = content.match(/`([^`]+\/[^`]+\.[a-zA-Z]{1,10})`/g) || [];
  for (const ref of backtickRefs) {
    const cleanRef = ref.slice(1, -1); // remove backticks
    if (cleanRef.startsWith('http') || cleanRef.includes('${') || cleanRef.includes('{{')) continue;
    if (found.includes(cleanRef) || missing.includes(cleanRef)) continue; // dedup
    const resolved = path.join(cwd, cleanRef);
    if (fs.existsSync(resolved)) {
      found.push(cleanRef);
    } else {
      missing.push(cleanRef);
    }
  }

  output({
    valid: missing.length === 0,
    found: found.length,
    missing,
    total: found.length + missing.length,
  }, raw, missing.length === 0 ? 'valid' : 'invalid');
}

function cmdVerifyCommits(cwd, hashes, raw) {
  if (!hashes || hashes.length === 0) { error('At least one commit hash required'); }

  const valid = [];
  const invalid = [];
  for (const hash of hashes) {
    const result = execGit(cwd, ['cat-file', '-t', hash]);
    if (result.exitCode === 0 && result.stdout.trim() === 'commit') {
      valid.push(hash);
    } else {
      invalid.push(hash);
    }
  }

  output({
    all_valid: invalid.length === 0,
    valid,
    invalid,
    total: hashes.length,
  }, raw, invalid.length === 0 ? 'valid' : 'invalid');
}

function cmdVerifyArtifacts(cwd, planFilePath, raw) {
  if (!planFilePath) { error('plan file path required'); }
  const fullPath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: planFilePath }, raw); return; }

  const artifacts = parseMustHavesBlock(content, 'artifacts');
  if (artifacts.length === 0) {
    output({ error: 'No must_haves.artifacts found in frontmatter', path: planFilePath }, raw);
    return;
  }

  const results = [];
  for (const artifact of artifacts) {
    if (typeof artifact === 'string') continue; // skip simple string items
    const artPath = artifact.path;
    if (!artPath) continue;

    const artFullPath = path.join(cwd, artPath);
    const exists = fs.existsSync(artFullPath);
    const check = { path: artPath, exists, issues: [], passed: false };

    if (exists) {
      const fileContent = safeReadFile(artFullPath) || '';
      const lineCount = fileContent.split('\n').length;

      if (artifact.min_lines && lineCount < artifact.min_lines) {
        check.issues.push(`Only ${lineCount} lines, need ${artifact.min_lines}`);
      }
      if (artifact.contains && !fileContent.includes(artifact.contains)) {
        check.issues.push(`Missing pattern: ${artifact.contains}`);
      }
      if (artifact.exports) {
        const exports = Array.isArray(artifact.exports) ? artifact.exports : [artifact.exports];
        for (const exp of exports) {
          if (!fileContent.includes(exp)) check.issues.push(`Missing export: ${exp}`);
        }
      }
      check.passed = check.issues.length === 0;
    } else {
      check.issues.push('File not found');
    }

    results.push(check);
  }

  const passed = results.filter(r => r.passed).length;
  output({
    all_passed: passed === results.length,
    passed,
    total: results.length,
    artifacts: results,
  }, raw, passed === results.length ? 'valid' : 'invalid');
}

function cmdVerifyKeyLinks(cwd, planFilePath, raw) {
  if (!planFilePath) { error('plan file path required'); }
  const fullPath = path.isAbsolute(planFilePath) ? planFilePath : path.join(cwd, planFilePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: planFilePath }, raw); return; }

  const keyLinks = parseMustHavesBlock(content, 'key_links');
  if (keyLinks.length === 0) {
    output({ error: 'No must_haves.key_links found in frontmatter', path: planFilePath }, raw);
    return;
  }

  const results = [];
  for (const link of keyLinks) {
    if (typeof link === 'string') continue;
    const check = { from: link.from, to: link.to, via: link.via || '', verified: false, detail: '' };

    const sourceContent = safeReadFile(path.join(cwd, link.from || ''));
    if (!sourceContent) {
      check.detail = 'Source file not found';
    } else if (link.pattern) {
      try {
        const regex = new RegExp(link.pattern);
        if (regex.test(sourceContent)) {
          check.verified = true;
          check.detail = 'Pattern found in source';
        } else {
          const targetContent = safeReadFile(path.join(cwd, link.to || ''));
          if (targetContent && regex.test(targetContent)) {
            check.verified = true;
            check.detail = 'Pattern found in target';
          } else {
            check.detail = `Pattern "${link.pattern}" not found in source or target`;
          }
        }
      } catch {
        check.detail = `Invalid regex pattern: ${link.pattern}`;
      }
    } else {
      // No pattern: just check source references target
      if (sourceContent.includes(link.to || '')) {
        check.verified = true;
        check.detail = 'Target referenced in source';
      } else {
        check.detail = 'Target not referenced in source';
      }
    }

    results.push(check);
  }

  const verified = results.filter(r => r.verified).length;
  output({
    all_verified: verified === results.length,
    verified,
    total: results.length,
    links: results,
  }, raw, verified === results.length ? 'valid' : 'invalid');
}

// ─── Roadmap Analysis ─────────────────────────────────────────────────────────

function cmdRoadmapAnalyze(cwd, raw) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');

  if (!fs.existsSync(roadmapPath)) {
    output({ error: 'ROADMAP.md not found', milestones: [], phases: [], current_phase: null }, raw);
    return;
  }

  const content = fs.readFileSync(roadmapPath, 'utf-8');
  const phasesDir = path.join(cwd, '.planning', 'phases');

  // Extract all phase headings: ### Phase N: Name
  const phasePattern = /###\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
  const phases = [];
  let match;

  while ((match = phasePattern.exec(content)) !== null) {
    const phaseNum = match[1];
    const phaseName = match[2].replace(/\(INSERTED\)/i, '').trim();

    // Extract goal from the section
    const sectionStart = match.index;
    const restOfContent = content.slice(sectionStart);
    const nextHeader = restOfContent.match(/\n###\s+Phase\s+\d/i);
    const sectionEnd = nextHeader ? sectionStart + nextHeader.index : content.length;
    const section = content.slice(sectionStart, sectionEnd);

    const goalMatch = section.match(/\*\*Goal:\*\*\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    const dependsMatch = section.match(/\*\*Depends on:\*\*\s*([^\n]+)/i);
    const depends_on = dependsMatch ? dependsMatch[1].trim() : null;

    // Check completion on disk
    const normalized = normalizePhaseName(phaseNum);
    let diskStatus = 'no_directory';
    let planCount = 0;
    let summaryCount = 0;
    let hasContext = false;
    let hasResearch = false;

    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      const dirMatch = dirs.find(d => d.startsWith(normalized + '-') || d === normalized);

      if (dirMatch) {
        const phaseFiles = fs.readdirSync(path.join(phasesDir, dirMatch));
        planCount = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
        summaryCount = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;
        hasContext = phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
        hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');

        if (summaryCount >= planCount && planCount > 0) diskStatus = 'complete';
        else if (summaryCount > 0) diskStatus = 'partial';
        else if (planCount > 0) diskStatus = 'planned';
        else if (hasResearch) diskStatus = 'researched';
        else if (hasContext) diskStatus = 'discussed';
        else diskStatus = 'empty';
      }
    } catch {}

    // Check ROADMAP checkbox status
    const checkboxPattern = new RegExp(`-\\s*\\[(x| )\\]\\s*.*Phase\\s+${phaseNum.replace('.', '\\.')}`, 'i');
    const checkboxMatch = content.match(checkboxPattern);
    const roadmapComplete = checkboxMatch ? checkboxMatch[1] === 'x' : false;

    phases.push({
      number: phaseNum,
      name: phaseName,
      goal,
      depends_on,
      plan_count: planCount,
      summary_count: summaryCount,
      has_context: hasContext,
      has_research: hasResearch,
      disk_status: diskStatus,
      roadmap_complete: roadmapComplete,
    });
  }

  // Extract milestone info
  const milestones = [];
  const milestonePattern = /##\s*(.*v(\d+\.\d+)[^(\n]*)/gi;
  let mMatch;
  while ((mMatch = milestonePattern.exec(content)) !== null) {
    milestones.push({
      heading: mMatch[1].trim(),
      version: 'v' + mMatch[2],
    });
  }

  // Find current and next phase
  const currentPhase = phases.find(p => p.disk_status === 'planned' || p.disk_status === 'partial') || null;
  const nextPhase = phases.find(p => p.disk_status === 'empty' || p.disk_status === 'no_directory' || p.disk_status === 'discussed' || p.disk_status === 'researched') || null;

  // Aggregated stats
  const totalPlans = phases.reduce((sum, p) => sum + p.plan_count, 0);
  const totalSummaries = phases.reduce((sum, p) => sum + p.summary_count, 0);
  const completedPhases = phases.filter(p => p.disk_status === 'complete').length;

  const result = {
    milestones,
    phases,
    phase_count: phases.length,
    completed_phases: completedPhases,
    total_plans: totalPlans,
    total_summaries: totalSummaries,
    progress_percent: totalPlans > 0 ? Math.round((totalSummaries / totalPlans) * 100) : 0,
    current_phase: currentPhase ? currentPhase.number : null,
    next_phase: nextPhase ? nextPhase.number : null,
  };

  output(result, raw);
}

// ─── Roadmap Parse ────────────────────────────────────────────────────────────

async function cmdRoadmapParse(cwd, raw) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const result = await parseRoadmap(roadmapPath);
  output(result, raw);
}

// ─── Roadmap DAG ──────────────────────────────────────────────────────────────

async function cmdRoadmapDAG(cwd, raw) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const parsed = await parseRoadmap(roadmapPath);

  if (parsed.error) {
    output({ error: parsed.error }, raw);
    return;
  }

  const { graph, inDegree } = buildDAG(parsed.phases);
  const executionResult = getExecutionOrder(parsed.phases);
  const parallelOpportunities = detectParallelOpportunities(graph, executionResult.execution_order);

  const result = {
    execution_order: executionResult.execution_order,
    has_cycle: executionResult.has_cycle,
    cycle_phases: executionResult.cycle_phases,
    parallel_opportunities: parallelOpportunities
  };

  output(result, raw);
}

// ─── Roadmap Status ───────────────────────────────────────────────────────────

async function cmdRoadmapStatus(cwd, phaseArg, raw) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const parsed = await parseRoadmap(roadmapPath);

  if (parsed.error) {
    output({ error: parsed.error }, raw);
    return;
  }

  // Update phase statuses based on disk
  const phasesDir = path.join(cwd, '.planning', 'phases');

  for (const phase of parsed.phases) {
    if (!fs.existsSync(phasesDir)) {
      phase.status = 'pending';
      continue;
    }

    // Check for phase directory
    const phasePattern = new RegExp(`^${phase.number.toString().padStart(2, '0')}-`);
    const dirs = fs.readdirSync(phasesDir).filter(d => phasePattern.test(d));

    if (dirs.length === 0) {
      phase.status = 'pending';
      continue;
    }

    const phaseDir = path.join(phasesDir, dirs[0]);
    const files = fs.readdirSync(phaseDir);

    // Check VERIFICATION.md
    const verificationFile = `${phase.number.toString().padStart(2, '0')}-VERIFICATION.md`;
    if (files.includes(verificationFile)) {
      const verificationPath = path.join(phaseDir, verificationFile);
      const content = fs.readFileSync(verificationPath, 'utf-8');
      if (content.match(/status:\s*passed/i)) {
        phase.status = 'complete';
        continue;
      }
    }

    // Check for SUMMARYs
    const summaries = files.filter(f => f.endsWith('-SUMMARY.md'));
    const plans = files.filter(f => f.endsWith('-PLAN.md'));

    if (summaries.length > 0) {
      phase.status = 'in_progress';
    } else if (plans.length > 0) {
      phase.status = 'in_progress';
    } else {
      phase.status = 'pending';
    }
  }

  // If phase arg provided, return single phase status
  if (phaseArg) {
    const targetPhase = parsed.phases.find(p => p.number === parseInt(phaseArg));
    if (targetPhase) {
      output({ phase: targetPhase.number, status: targetPhase.status }, raw, targetPhase.status);
    } else {
      output({ error: `Phase ${phaseArg} not found` }, raw);
    }
    return;
  }

  // Return all phases with statuses
  const result = {
    phases: parsed.phases.map(p => ({
      number: p.number,
      name: p.name,
      status: p.status
    }))
  };

  output(result, raw);
}

// ─── Roadmap Validate ─────────────────────────────────────────────────────────

async function cmdRoadmapValidate(cwd, raw) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const parsed = await parseRoadmap(roadmapPath);

  if (parsed.error) {
    output({ valid: false, errors: [parsed.error], warnings: [] }, raw);
    return;
  }

  const errors = [];
  const warnings = [];

  // Validate all phases have Goal
  for (const phase of parsed.phases) {
    if (!phase.goal || phase.goal.length === 0) {
      errors.push(`Phase ${phase.number}: Missing Goal`);
    }

    // Validate dependencies reference valid phases
    for (const depNum of phase.depends_on) {
      const dep = parsed.phases.find(p => p.number === depNum);
      if (!dep) {
        errors.push(`Phase ${phase.number}: Dependency Phase ${depNum} not found`);
      }
    }

    // Validate requirements IDs format (e.g., REQ-01, AUTO-01)
    for (const req of phase.requirements) {
      if (!req.match(/^[A-Z]+-\d+$/)) {
        warnings.push(`Phase ${phase.number}: Requirement "${req}" doesn't match standard format (XXX-NN)`);
      }
    }
  }

  // Check for circular dependencies
  const executionResult = getExecutionOrder(parsed.phases);
  if (executionResult.has_cycle) {
    errors.push(`Circular dependency detected in phases: ${executionResult.cycle_phases.join(', ')}`);
  }

  const result = {
    valid: errors.length === 0,
    errors,
    warnings
  };

  output(result, raw);
}

// ─── Phase Add ────────────────────────────────────────────────────────────────

function cmdPhaseAdd(cwd, description, raw) {
  if (!description) {
    error('description required for phase add');
  }

  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    error('ROADMAP.md not found');
  }

  const content = fs.readFileSync(roadmapPath, 'utf-8');
  const slug = generateSlugInternal(description);

  // Find highest integer phase number
  const phasePattern = /###\s*Phase\s+(\d+)(?:\.\d+)?:/gi;
  let maxPhase = 0;
  let m;
  while ((m = phasePattern.exec(content)) !== null) {
    const num = parseInt(m[1], 10);
    if (num > maxPhase) maxPhase = num;
  }

  const newPhaseNum = maxPhase + 1;
  const paddedNum = String(newPhaseNum).padStart(2, '0');
  const dirName = `${paddedNum}-${slug}`;
  const dirPath = path.join(cwd, '.planning', 'phases', dirName);

  // Create directory
  fs.mkdirSync(dirPath, { recursive: true });

  // Build phase entry
  const phaseEntry = `\n### Phase ${newPhaseNum}: ${description}\n\n**Goal:** [To be planned]\n**Depends on:** Phase ${maxPhase}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd:plan-phase ${newPhaseNum} to break down)\n`;

  // Find insertion point: before last "---" or at end
  let updatedContent;
  const lastSeparator = content.lastIndexOf('\n---');
  if (lastSeparator > 0) {
    updatedContent = content.slice(0, lastSeparator) + phaseEntry + content.slice(lastSeparator);
  } else {
    updatedContent = content + phaseEntry;
  }

  fs.writeFileSync(roadmapPath, updatedContent, 'utf-8');

  const result = {
    phase_number: newPhaseNum,
    padded: paddedNum,
    name: description,
    slug,
    directory: `.planning/phases/${dirName}`,
  };

  output(result, raw, paddedNum);
}

// ─── Phase Insert (Decimal) ──────────────────────────────────────────────────

function cmdPhaseInsert(cwd, afterPhase, description, raw) {
  if (!afterPhase || !description) {
    error('after-phase and description required for phase insert');
  }

  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    error('ROADMAP.md not found');
  }

  const content = fs.readFileSync(roadmapPath, 'utf-8');
  const slug = generateSlugInternal(description);

  // Verify target phase exists
  const afterPhaseEscaped = afterPhase.replace(/\./g, '\\.');
  const targetPattern = new RegExp(`###\\s*Phase\\s+${afterPhaseEscaped}:`, 'i');
  if (!targetPattern.test(content)) {
    error(`Phase ${afterPhase} not found in ROADMAP.md`);
  }

  // Calculate next decimal using existing logic
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalizedBase = normalizePhaseName(afterPhase);
  let existingDecimals = [];

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    const decimalPattern = new RegExp(`^${normalizedBase}\\.(\\d+)`);
    for (const dir of dirs) {
      const dm = dir.match(decimalPattern);
      if (dm) existingDecimals.push(parseInt(dm[1], 10));
    }
  } catch {}

  const nextDecimal = existingDecimals.length === 0 ? 1 : Math.max(...existingDecimals) + 1;
  const decimalPhase = `${normalizedBase}.${nextDecimal}`;
  const dirName = `${decimalPhase}-${slug}`;
  const dirPath = path.join(cwd, '.planning', 'phases', dirName);

  // Create directory
  fs.mkdirSync(dirPath, { recursive: true });

  // Build phase entry
  const phaseEntry = `\n### Phase ${decimalPhase}: ${description} (INSERTED)\n\n**Goal:** [Urgent work - to be planned]\n**Depends on:** Phase ${afterPhase}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd:plan-phase ${decimalPhase} to break down)\n`;

  // Insert after the target phase section
  const headerPattern = new RegExp(`(###\\s*Phase\\s+${afterPhaseEscaped}:[^\\n]*\\n)`, 'i');
  const headerMatch = content.match(headerPattern);
  if (!headerMatch) {
    error(`Could not find Phase ${afterPhase} header`);
  }

  const headerIdx = content.indexOf(headerMatch[0]);
  const afterHeader = content.slice(headerIdx + headerMatch[0].length);
  const nextPhaseMatch = afterHeader.match(/\n###\s+Phase\s+\d/i);

  let insertIdx;
  if (nextPhaseMatch) {
    insertIdx = headerIdx + headerMatch[0].length + nextPhaseMatch.index;
  } else {
    insertIdx = content.length;
  }

  const updatedContent = content.slice(0, insertIdx) + phaseEntry + content.slice(insertIdx);
  fs.writeFileSync(roadmapPath, updatedContent, 'utf-8');

  const result = {
    phase_number: decimalPhase,
    after_phase: afterPhase,
    name: description,
    slug,
    directory: `.planning/phases/${dirName}`,
  };

  output(result, raw, decimalPhase);
}

// ─── Phase Remove ─────────────────────────────────────────────────────────────

function cmdPhaseRemove(cwd, targetPhase, options, raw) {
  if (!targetPhase) {
    error('phase number required for phase remove');
  }

  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const force = options.force || false;

  if (!fs.existsSync(roadmapPath)) {
    error('ROADMAP.md not found');
  }

  // Normalize the target
  const normalized = normalizePhaseName(targetPhase);
  const isDecimal = targetPhase.includes('.');

  // Find and validate target directory
  let targetDir = null;
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    targetDir = dirs.find(d => d.startsWith(normalized + '-') || d === normalized);
  } catch {}

  // Check for executed work (SUMMARY.md files)
  if (targetDir && !force) {
    const targetPath = path.join(phasesDir, targetDir);
    const files = fs.readdirSync(targetPath);
    const summaries = files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
    if (summaries.length > 0) {
      error(`Phase ${targetPhase} has ${summaries.length} executed plan(s). Use --force to remove anyway.`);
    }
  }

  // Delete target directory
  if (targetDir) {
    fs.rmSync(path.join(phasesDir, targetDir), { recursive: true, force: true });
  }

  // Renumber subsequent phases
  const renamedDirs = [];
  const renamedFiles = [];

  if (isDecimal) {
    // Decimal removal: renumber sibling decimals (e.g., removing 06.2 → 06.3 becomes 06.2)
    const baseParts = normalized.split('.');
    const baseInt = baseParts[0];
    const removedDecimal = parseInt(baseParts[1], 10);

    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

      // Find sibling decimals with higher numbers
      const decPattern = new RegExp(`^${baseInt}\\.(\\d+)-(.+)$`);
      const toRename = [];
      for (const dir of dirs) {
        const dm = dir.match(decPattern);
        if (dm && parseInt(dm[1], 10) > removedDecimal) {
          toRename.push({ dir, oldDecimal: parseInt(dm[1], 10), slug: dm[2] });
        }
      }

      // Sort descending to avoid conflicts
      toRename.sort((a, b) => b.oldDecimal - a.oldDecimal);

      for (const item of toRename) {
        const newDecimal = item.oldDecimal - 1;
        const oldPhaseId = `${baseInt}.${item.oldDecimal}`;
        const newPhaseId = `${baseInt}.${newDecimal}`;
        const newDirName = `${baseInt}.${newDecimal}-${item.slug}`;

        // Rename directory
        fs.renameSync(path.join(phasesDir, item.dir), path.join(phasesDir, newDirName));
        renamedDirs.push({ from: item.dir, to: newDirName });

        // Rename files inside
        const dirFiles = fs.readdirSync(path.join(phasesDir, newDirName));
        for (const f of dirFiles) {
          // Files may have phase prefix like "06.2-01-PLAN.md"
          if (f.includes(oldPhaseId)) {
            const newFileName = f.replace(oldPhaseId, newPhaseId);
            fs.renameSync(
              path.join(phasesDir, newDirName, f),
              path.join(phasesDir, newDirName, newFileName)
            );
            renamedFiles.push({ from: f, to: newFileName });
          }
        }
      }
    } catch {}

  } else {
    // Integer removal: renumber all subsequent integer phases
    const removedInt = parseInt(normalized, 10);

    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

      // Collect directories that need renumbering (integer phases > removed, and their decimals)
      const toRename = [];
      for (const dir of dirs) {
        const dm = dir.match(/^(\d+)(?:\.(\d+))?-(.+)$/);
        if (!dm) continue;
        const dirInt = parseInt(dm[1], 10);
        if (dirInt > removedInt) {
          toRename.push({
            dir,
            oldInt: dirInt,
            decimal: dm[2] ? parseInt(dm[2], 10) : null,
            slug: dm[3],
          });
        }
      }

      // Sort descending to avoid conflicts
      toRename.sort((a, b) => {
        if (a.oldInt !== b.oldInt) return b.oldInt - a.oldInt;
        return (b.decimal || 0) - (a.decimal || 0);
      });

      for (const item of toRename) {
        const newInt = item.oldInt - 1;
        const newPadded = String(newInt).padStart(2, '0');
        const oldPadded = String(item.oldInt).padStart(2, '0');
        const decimalSuffix = item.decimal !== null ? `.${item.decimal}` : '';
        const oldPrefix = `${oldPadded}${decimalSuffix}`;
        const newPrefix = `${newPadded}${decimalSuffix}`;
        const newDirName = `${newPrefix}-${item.slug}`;

        // Rename directory
        fs.renameSync(path.join(phasesDir, item.dir), path.join(phasesDir, newDirName));
        renamedDirs.push({ from: item.dir, to: newDirName });

        // Rename files inside
        const dirFiles = fs.readdirSync(path.join(phasesDir, newDirName));
        for (const f of dirFiles) {
          if (f.startsWith(oldPrefix)) {
            const newFileName = newPrefix + f.slice(oldPrefix.length);
            fs.renameSync(
              path.join(phasesDir, newDirName, f),
              path.join(phasesDir, newDirName, newFileName)
            );
            renamedFiles.push({ from: f, to: newFileName });
          }
        }
      }
    } catch {}
  }

  // Update ROADMAP.md
  let roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');

  // Remove the target phase section
  const targetEscaped = targetPhase.replace(/\./g, '\\.');
  const sectionPattern = new RegExp(
    `\\n?###\\s*Phase\\s+${targetEscaped}\\s*:[\\s\\S]*?(?=\\n###\\s+Phase\\s+\\d|$)`,
    'i'
  );
  roadmapContent = roadmapContent.replace(sectionPattern, '');

  // Remove from phase list (checkbox)
  const checkboxPattern = new RegExp(`\\n?-\\s*\\[[ x]\\]\\s*.*Phase\\s+${targetEscaped}[:\\s][^\\n]*`, 'gi');
  roadmapContent = roadmapContent.replace(checkboxPattern, '');

  // Remove from progress table
  const tableRowPattern = new RegExp(`\\n?\\|\\s*${targetEscaped}\\.?\\s[^|]*\\|[^\\n]*`, 'gi');
  roadmapContent = roadmapContent.replace(tableRowPattern, '');

  // Renumber references in ROADMAP for subsequent phases
  if (!isDecimal) {
    const removedInt = parseInt(normalized, 10);

    // Collect all integer phases > removedInt
    const maxPhase = 99; // reasonable upper bound
    for (let oldNum = maxPhase; oldNum > removedInt; oldNum--) {
      const newNum = oldNum - 1;
      const oldStr = String(oldNum);
      const newStr = String(newNum);
      const oldPad = oldStr.padStart(2, '0');
      const newPad = newStr.padStart(2, '0');

      // Phase headings: ### Phase 18: → ### Phase 17:
      roadmapContent = roadmapContent.replace(
        new RegExp(`(###\\s*Phase\\s+)${oldStr}(\\s*:)`, 'gi'),
        `$1${newStr}$2`
      );

      // Checkbox items: - [ ] **Phase 18:** → - [ ] **Phase 17:**
      roadmapContent = roadmapContent.replace(
        new RegExp(`(Phase\\s+)${oldStr}([:\\s])`, 'g'),
        `$1${newStr}$2`
      );

      // Plan references: 18-01 → 17-01
      roadmapContent = roadmapContent.replace(
        new RegExp(`${oldPad}-(\\d{2})`, 'g'),
        `${newPad}-$1`
      );

      // Table rows: | 18. → | 17.
      roadmapContent = roadmapContent.replace(
        new RegExp(`(\\|\\s*)${oldStr}\\.\\s`, 'g'),
        `$1${newStr}. `
      );

      // Depends on references
      roadmapContent = roadmapContent.replace(
        new RegExp(`(Depends on:\\*\\*\\s*Phase\\s+)${oldStr}\\b`, 'gi'),
        `$1${newStr}`
      );
    }
  }

  fs.writeFileSync(roadmapPath, roadmapContent, 'utf-8');

  // Update STATE.md phase count
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (fs.existsSync(statePath)) {
    let stateContent = fs.readFileSync(statePath, 'utf-8');
    // Update "Total Phases" field
    const totalPattern = /(\*\*Total Phases:\*\*\s*)(\d+)/;
    const totalMatch = stateContent.match(totalPattern);
    if (totalMatch) {
      const oldTotal = parseInt(totalMatch[2], 10);
      stateContent = stateContent.replace(totalPattern, `$1${oldTotal - 1}`);
    }
    // Update "Phase: X of Y" pattern
    const ofPattern = /(\bof\s+)(\d+)(\s*(?:\(|phases?))/i;
    const ofMatch = stateContent.match(ofPattern);
    if (ofMatch) {
      const oldTotal = parseInt(ofMatch[2], 10);
      stateContent = stateContent.replace(ofPattern, `$1${oldTotal - 1}$3`);
    }
    fs.writeFileSync(statePath, stateContent, 'utf-8');
  }

  const result = {
    removed: targetPhase,
    directory_deleted: targetDir || null,
    renamed_directories: renamedDirs,
    renamed_files: renamedFiles,
    roadmap_updated: true,
    state_updated: fs.existsSync(statePath),
  };

  output(result, raw);
}

// ─── Roadmap Update Plan Progress ───────────────────────────────────────────

function cmdRoadmapUpdatePlanProgress(cwd, phaseNum, raw) {
  if (!phaseNum) {
    error('phase number required for roadmap update-plan-progress');
  }

  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');

  const phaseInfo = findPhaseInternal(cwd, phaseNum);
  if (!phaseInfo) {
    error(`Phase ${phaseNum} not found`);
  }

  const planCount = phaseInfo.plans.length;
  const summaryCount = phaseInfo.summaries.length;

  if (planCount === 0) {
    output({ updated: false, reason: 'No plans found', plan_count: 0, summary_count: 0 }, raw, 'no plans');
    return;
  }

  const isComplete = summaryCount >= planCount;
  const status = isComplete ? 'Complete' : summaryCount > 0 ? 'In Progress' : 'Planned';
  const today = new Date().toISOString().split('T')[0];

  if (!fs.existsSync(roadmapPath)) {
    output({ updated: false, reason: 'ROADMAP.md not found', plan_count: planCount, summary_count: summaryCount }, raw, 'no roadmap');
    return;
  }

  let roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
  const phaseEscaped = phaseNum.replace('.', '\\.');

  // Progress table row: update Plans column (summaries/plans) and Status column
  const tablePattern = new RegExp(
    `(\\|\\s*${phaseEscaped}\\.?\\s[^|]*\\|)[^|]*(\\|)\\s*[^|]*(\\|)\\s*[^|]*(\\|)`,
    'i'
  );
  const dateField = isComplete ? ` ${today} ` : '  ';
  roadmapContent = roadmapContent.replace(
    tablePattern,
    `$1 ${summaryCount}/${planCount} $2 ${status.padEnd(11)}$3${dateField}$4`
  );

  // Update plan count in phase detail section
  const planCountPattern = new RegExp(
    `(#{2,4}\\s*Phase\\s+${phaseEscaped}[\\s\\S]*?\\*\\*Plans:\\*\\*\\s*)[^\\n]+`,
    'i'
  );
  const planCountText = isComplete
    ? `${summaryCount}/${planCount} plans complete`
    : `${summaryCount}/${planCount} plans executed`;
  roadmapContent = roadmapContent.replace(planCountPattern, `$1${planCountText}`);

  // If complete: check checkbox
  if (isComplete) {
    const checkboxPattern = new RegExp(
      `(-\\s*\\[)[ ](\\]\\s*.*Phase\\s+${phaseEscaped}[:\\s][^\\n]*)`,
      'i'
    );
    roadmapContent = roadmapContent.replace(checkboxPattern, `$1x$2 (completed ${today})`);
  }

  fs.writeFileSync(roadmapPath, roadmapContent, 'utf-8');

  output({
    updated: true,
    phase: phaseNum,
    plan_count: planCount,
    summary_count: summaryCount,
    status,
    complete: isComplete,
  }, raw, `${summaryCount}/${planCount} ${status}`);
}

// ─── Requirements Mark Complete ───────────────────────────────────────────────

function cmdRequirementsMarkComplete(cwd, reqIdsRaw, raw) {
  if (!reqIdsRaw || reqIdsRaw.length === 0) {
    error('requirement IDs required. Usage: requirements mark-complete REQ-01,REQ-02 or REQ-01 REQ-02');
  }

  // Accept comma-separated, space-separated, or bracket-wrapped: [REQ-01, REQ-02]
  const reqIds = reqIdsRaw
    .join(' ')
    .replace(/[\[\]]/g, '')
    .split(/[,\s]+/)
    .map(r => r.trim())
    .filter(Boolean);

  if (reqIds.length === 0) {
    error('no valid requirement IDs found');
  }

  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  if (!fs.existsSync(reqPath)) {
    output({ updated: false, reason: 'REQUIREMENTS.md not found', ids: reqIds }, raw, 'no requirements file');
    return;
  }

  let reqContent = fs.readFileSync(reqPath, 'utf-8');
  const updated = [];
  const notFound = [];

  for (const reqId of reqIds) {
    let found = false;

    // Update checkbox: - [ ] **REQ-ID** -> - [x] **REQ-ID**
    const checkboxPattern = new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqId}\\*\\*)`, 'gi');
    if (checkboxPattern.test(reqContent)) {
      reqContent = reqContent.replace(checkboxPattern, '$1x$2');
      found = true;
    }

    // Update traceability table: | REQ-ID | Phase N | Pending | -> | REQ-ID | Phase N | Complete |
    const tablePattern = new RegExp(`(\\|\\s*${reqId}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, 'gi');
    if (tablePattern.test(reqContent)) {
      reqContent = reqContent.replace(
        new RegExp(`(\\|\\s*${reqId}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, 'gi'),
        '$1 Complete $2'
      );
      found = true;
    }

    if (found) {
      updated.push(reqId);
    } else {
      notFound.push(reqId);
    }
  }

  if (updated.length > 0) {
    fs.writeFileSync(reqPath, reqContent, 'utf-8');
  }

  output({
    updated: updated.length > 0,
    marked_complete: updated,
    not_found: notFound,
    total: reqIds.length,
  }, raw, `${updated.length}/${reqIds.length} requirements marked complete`);
}

// ─── Phase Complete (Transition) ──────────────────────────────────────────────

function cmdPhaseComplete(cwd, phaseNum, raw) {
  if (!phaseNum) {
    error('phase number required for phase complete');
  }

  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalized = normalizePhaseName(phaseNum);
  const today = new Date().toISOString().split('T')[0];

  // Verify phase info
  const phaseInfo = findPhaseInternal(cwd, phaseNum);
  if (!phaseInfo) {
    error(`Phase ${phaseNum} not found`);
  }

  const planCount = phaseInfo.plans.length;
  const summaryCount = phaseInfo.summaries.length;

  // Update ROADMAP.md: mark phase complete
  if (fs.existsSync(roadmapPath)) {
    let roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');

    // Checkbox: - [ ] Phase N: → - [x] Phase N: (...completed DATE)
    const checkboxPattern = new RegExp(
      `(-\\s*\\[)[ ](\\]\\s*.*Phase\\s+${phaseNum.replace('.', '\\.')}[:\\s][^\\n]*)`,
      'i'
    );
    roadmapContent = roadmapContent.replace(checkboxPattern, `$1x$2 (completed ${today})`);

    // Progress table: update Status to Complete, add date
    const phaseEscaped = phaseNum.replace('.', '\\.');
    const tablePattern = new RegExp(
      `(\\|\\s*${phaseEscaped}\\.?\\s[^|]*\\|[^|]*\\|)\\s*[^|]*(\\|)\\s*[^|]*(\\|)`,
      'i'
    );
    roadmapContent = roadmapContent.replace(
      tablePattern,
      `$1 Complete    $2 ${today} $3`
    );

    // Update plan count in phase section
    const planCountPattern = new RegExp(
      `(###\\s*Phase\\s+${phaseEscaped}[\\s\\S]*?\\*\\*Plans:\\*\\*\\s*)[^\\n]+`,
      'i'
    );
    roadmapContent = roadmapContent.replace(
      planCountPattern,
      `$1${summaryCount}/${planCount} plans complete`
    );

    fs.writeFileSync(roadmapPath, roadmapContent, 'utf-8');
  }

  // Find next phase
  let nextPhaseNum = null;
  let nextPhaseName = null;
  let isLastPhase = true;

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    const currentFloat = parseFloat(phaseNum);

    // Find the next phase directory after current
    for (const dir of dirs) {
      const dm = dir.match(/^(\d+(?:\.\d+)?)-?(.*)/);
      if (dm) {
        const dirFloat = parseFloat(dm[1]);
        if (dirFloat > currentFloat) {
          nextPhaseNum = dm[1];
          nextPhaseName = dm[2] || null;
          isLastPhase = false;
          break;
        }
      }
    }
  } catch {}

  // Update STATE.md
  if (fs.existsSync(statePath)) {
    let stateContent = fs.readFileSync(statePath, 'utf-8');

    // Update Current Phase
    stateContent = stateContent.replace(
      /(\*\*Current Phase:\*\*\s*).*/,
      `$1${nextPhaseNum || phaseNum}`
    );

    // Update Current Phase Name
    if (nextPhaseName) {
      stateContent = stateContent.replace(
        /(\*\*Current Phase Name:\*\*\s*).*/,
        `$1${nextPhaseName.replace(/-/g, ' ')}`
      );
    }

    // Update Status
    stateContent = stateContent.replace(
      /(\*\*Status:\*\*\s*).*/,
      `$1${isLastPhase ? 'Milestone complete' : 'Ready to plan'}`
    );

    // Update Current Plan
    stateContent = stateContent.replace(
      /(\*\*Current Plan:\*\*\s*).*/,
      `$1Not started`
    );

    // Update Last Activity
    stateContent = stateContent.replace(
      /(\*\*Last Activity:\*\*\s*).*/,
      `$1${today}`
    );

    // Update Last Activity Description
    stateContent = stateContent.replace(
      /(\*\*Last Activity Description:\*\*\s*).*/,
      `$1Phase ${phaseNum} complete${nextPhaseNum ? `, transitioned to Phase ${nextPhaseNum}` : ''}`
    );

    fs.writeFileSync(statePath, stateContent, 'utf-8');
  }

  const result = {
    completed_phase: phaseNum,
    phase_name: phaseInfo.phase_name,
    plans_executed: `${summaryCount}/${planCount}`,
    next_phase: nextPhaseNum,
    next_phase_name: nextPhaseName,
    is_last_phase: isLastPhase,
    date: today,
    roadmap_updated: fs.existsSync(roadmapPath),
    state_updated: fs.existsSync(statePath),
  };

  output(result, raw);
}

// ─── Phase Size ───────────────────────────────────────────────────────────────

async function cmdPhaseSize(cwd, args, raw) {
  const subcommand = args[0];
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');

  // Helper to get phases from roadmap
  const getPhases = async () => {
    if (!fs.existsSync(roadmapPath)) {
      error('ROADMAP.md not found');
    }
    const { phases } = await parseRoadmap(roadmapPath);
    return phases;
  };

  switch (subcommand) {
    case 'limits': {
      // Display current limits
      output(PHASE_LIMITS, raw, Object.entries(PHASE_LIMITS)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n'));
      break;
    }

    case 'estimate': {
      // Estimate size for a specific phase
      const phaseNum = parseInt(args[1]);
      if (!phaseNum) {
        error('phase size estimate: phase number required');
      }

      const phases = await getPhases();
      const phase = phases.find(p => p.number === phaseNum);
      if (!phase) {
        error(`Phase ${phaseNum} not found`);
      }

      const estimate = estimatePhaseSize(phase);
      output({
        phase: phaseNum,
        name: phase.name,
        ...estimate
      }, raw);
      break;
    }

    case 'check': {
      // Check all phases for size issues
      const phases = await getPhases();
      const oversized = detectOversizedPhases(phases);

      const result = {
        total_phases: phases.length,
        oversized_count: oversized.length,
        oversized: oversized.map(o => ({
          phase: o.phase,
          name: o.name,
          reasons: o.reasons
        }))
      };

      if (raw) {
        output(result, raw);
      } else {
        if (oversized.length === 0) {
          console.log('All phases within size limits');
        } else {
          console.log(`Found ${oversized.length} oversized phase(s):`);
          for (const o of oversized) {
            console.log(`\n  Phase ${o.phase}: ${o.name}`);
            for (const reason of o.reasons) {
              console.log(`    - ${reason}`);
            }
          }
        }
      }

      // Exit code: 0 if none oversized, 1 if any oversized
      process.exit(oversized.length > 0 ? 1 : 0);
    }

    case 'split-recommend': {
      // Get split recommendations for a phase
      const phaseNum = parseInt(args[1]);
      if (!phaseNum) {
        error('phase size split-recommend: phase number required');
      }

      const phases = await getPhases();
      const phase = phases.find(p => p.number === phaseNum);
      if (!phase) {
        error(`Phase ${phaseNum} not found`);
      }

      const recommendation = recommendSplit(phase);
      const validation = validateSplitPreservesDependencies(phase, recommendation.recommendations, phases);

      output({
        phase: phaseNum,
        name: phase.name,
        ...recommendation,
        dependency_validation: validation
      }, raw);
      break;
    }

    default: {
      // Show size estimates for all phases (table format)
      const phases = await getPhases();
      const phaseNum = subcommand ? parseInt(subcommand) : null;

      if (phaseNum) {
        // Single phase
        const phase = phases.find(p => p.number === phaseNum);
        if (!phase) {
          error(`Phase ${phaseNum} not found`);
        }
        const estimate = estimatePhaseSize(phase);
        output({
          phase: phaseNum,
          name: phase.name,
          ...estimate
        }, raw);
      } else {
        // All phases table
        const results = phases.map(p => {
          const est = estimatePhaseSize(p);
          return {
            phase: p.number,
            name: p.name.substring(0, 30),
            requirements: est.requirements,
            criteria: est.successCriteria,
            plans: est.estimatedPlans,
            tokens: est.estimatedTokens,
            risk: est.riskLevel
          };
        });

        if (raw) {
          output({ phases: results }, raw);
        } else {
          console.log('Phase | Name                           | Reqs | Criteria | Plans | Tokens  | Risk');
          console.log('------|--------------------------------|------|----------|-------|---------|------');
          for (const r of results) {
            console.log(`${String(r.phase).padEnd(5)} | ${r.name.padEnd(30)} | ${String(r.requirements).padStart(4)} | ${String(r.criteria).padStart(8)} | ${String(r.plans).padStart(5)} | ${String(r.tokens).padStart(7)} | ${r.risk}`);
          }
        }
      }
      break;
    }
  }
}

// ─── Phase Archive ────────────────────────────────────────────────────────────

async function cmdPhaseArchive(cwd, phaseNum, raw) {
  if (!phaseNum) {
    error('phase number required for phase archive');
  }

  const phaseNumber = parseInt(phaseNum);
  const archive = require('./phase-archive.js');

  try {
    const result = await archive.archivePhase(phaseNumber);
    output(result, raw);
  } catch (err) {
    error(`Failed to archive phase ${phaseNumber}: ${err.message}`);
  }
}

async function cmdPhaseInjectContext(cwd, targetPhaseNum, raw) {
  if (!targetPhaseNum) {
    error('target phase number required for inject-context');
  }

  const targetPhase = parseInt(targetPhaseNum);
  const archive = require('./phase-archive.js');

  try {
    const context = await archive.injectRelevantContext(targetPhase);
    output(context, raw);
  } catch (err) {
    error(`Failed to inject context for phase ${targetPhase}: ${err.message}`);
  }
}

async function cmdPhaseCleanupCheckpoints(cwd, phaseNum, raw) {
  if (!phaseNum) {
    error('phase number required for cleanup-checkpoints');
  }

  const phaseNumber = parseInt(phaseNum);
  const archive = require('./phase-archive.js');

  try {
    const result = await archive.cleanupEphemeralCheckpoints(phaseNumber);
    output(result, raw);
  } catch (err) {
    error(`Failed to cleanup checkpoints for phase ${phaseNumber}: ${err.message}`);
  }
}

// ─── Milestone Complete ───────────────────────────────────────────────────────

function cmdMilestoneComplete(cwd, version, options, raw) {
  if (!version) {
    error('version required for milestone complete (e.g., v1.0)');
  }

  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const milestonesPath = path.join(cwd, '.planning', 'MILESTONES.md');
  const archiveDir = path.join(cwd, '.planning', 'milestones');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const today = new Date().toISOString().split('T')[0];
  const milestoneName = options.name || version;

  // Ensure archive directory exists
  fs.mkdirSync(archiveDir, { recursive: true });

  // Gather stats from phases
  let phaseCount = 0;
  let totalPlans = 0;
  let totalTasks = 0;
  const accomplishments = [];

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

    for (const dir of dirs) {
      phaseCount++;
      const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      totalPlans += plans.length;

      // Extract one-liners from summaries
      for (const s of summaries) {
        try {
          const content = fs.readFileSync(path.join(phasesDir, dir, s), 'utf-8');
          const fm = extractFrontmatter(content);
          if (fm['one-liner']) {
            accomplishments.push(fm['one-liner']);
          }
          // Count tasks
          const taskMatches = content.match(/##\s*Task\s*\d+/gi) || [];
          totalTasks += taskMatches.length;
        } catch {}
      }
    }
  } catch {}

  // Archive ROADMAP.md
  if (fs.existsSync(roadmapPath)) {
    const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
    fs.writeFileSync(path.join(archiveDir, `${version}-ROADMAP.md`), roadmapContent, 'utf-8');
  }

  // Archive REQUIREMENTS.md
  if (fs.existsSync(reqPath)) {
    const reqContent = fs.readFileSync(reqPath, 'utf-8');
    const archiveHeader = `# Requirements Archive: ${version} ${milestoneName}\n\n**Archived:** ${today}\n**Status:** SHIPPED\n\nFor current requirements, see \`.planning/REQUIREMENTS.md\`.\n\n---\n\n`;
    fs.writeFileSync(path.join(archiveDir, `${version}-REQUIREMENTS.md`), archiveHeader + reqContent, 'utf-8');
  }

  // Archive audit file if exists
  const auditFile = path.join(cwd, '.planning', `${version}-MILESTONE-AUDIT.md`);
  if (fs.existsSync(auditFile)) {
    fs.renameSync(auditFile, path.join(archiveDir, `${version}-MILESTONE-AUDIT.md`));
  }

  // Create/append MILESTONES.md entry
  const accomplishmentsList = accomplishments.map(a => `- ${a}`).join('\n');
  const milestoneEntry = `## ${version} ${milestoneName} (Shipped: ${today})\n\n**Phases completed:** ${phaseCount} phases, ${totalPlans} plans, ${totalTasks} tasks\n\n**Key accomplishments:**\n${accomplishmentsList || '- (none recorded)'}\n\n---\n\n`;

  if (fs.existsSync(milestonesPath)) {
    const existing = fs.readFileSync(milestonesPath, 'utf-8');
    fs.writeFileSync(milestonesPath, existing + '\n' + milestoneEntry, 'utf-8');
  } else {
    fs.writeFileSync(milestonesPath, `# Milestones\n\n${milestoneEntry}`, 'utf-8');
  }

  // Update STATE.md
  if (fs.existsSync(statePath)) {
    let stateContent = fs.readFileSync(statePath, 'utf-8');
    stateContent = stateContent.replace(
      /(\*\*Status:\*\*\s*).*/,
      `$1${version} milestone complete`
    );
    stateContent = stateContent.replace(
      /(\*\*Last Activity:\*\*\s*).*/,
      `$1${today}`
    );
    stateContent = stateContent.replace(
      /(\*\*Last Activity Description:\*\*\s*).*/,
      `$1${version} milestone completed and archived`
    );
    fs.writeFileSync(statePath, stateContent, 'utf-8');
  }

  const result = {
    version,
    name: milestoneName,
    date: today,
    phases: phaseCount,
    plans: totalPlans,
    tasks: totalTasks,
    accomplishments,
    archived: {
      roadmap: fs.existsSync(path.join(archiveDir, `${version}-ROADMAP.md`)),
      requirements: fs.existsSync(path.join(archiveDir, `${version}-REQUIREMENTS.md`)),
      audit: fs.existsSync(path.join(archiveDir, `${version}-MILESTONE-AUDIT.md`)),
    },
    milestones_updated: true,
    state_updated: fs.existsSync(statePath),
  };

  output(result, raw);
}

// ─── Validate Consistency ─────────────────────────────────────────────────────

function cmdValidateConsistency(cwd, raw) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const errors = [];
  const warnings = [];

  // Check for ROADMAP
  if (!fs.existsSync(roadmapPath)) {
    errors.push('ROADMAP.md not found');
    output({ passed: false, errors, warnings }, raw, 'failed');
    return;
  }

  const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');

  // Extract phases from ROADMAP
  const roadmapPhases = new Set();
  const phasePattern = /###\s*Phase\s+(\d+(?:\.\d+)?)\s*:/gi;
  let m;
  while ((m = phasePattern.exec(roadmapContent)) !== null) {
    roadmapPhases.add(m[1]);
  }

  // Get phases on disk
  const diskPhases = new Set();
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    for (const dir of dirs) {
      const dm = dir.match(/^(\d+(?:\.\d+)?)/);
      if (dm) diskPhases.add(dm[1]);
    }
  } catch {}

  // Check: phases in ROADMAP but not on disk
  for (const p of roadmapPhases) {
    if (!diskPhases.has(p) && !diskPhases.has(normalizePhaseName(p))) {
      warnings.push(`Phase ${p} in ROADMAP.md but no directory on disk`);
    }
  }

  // Check: phases on disk but not in ROADMAP
  for (const p of diskPhases) {
    const unpadded = String(parseInt(p, 10));
    if (!roadmapPhases.has(p) && !roadmapPhases.has(unpadded)) {
      warnings.push(`Phase ${p} exists on disk but not in ROADMAP.md`);
    }
  }

  // Check: sequential phase numbers (integers only)
  const integerPhases = [...diskPhases]
    .filter(p => !p.includes('.'))
    .map(p => parseInt(p, 10))
    .sort((a, b) => a - b);

  for (let i = 1; i < integerPhases.length; i++) {
    if (integerPhases[i] !== integerPhases[i - 1] + 1) {
      warnings.push(`Gap in phase numbering: ${integerPhases[i - 1]} → ${integerPhases[i]}`);
    }
  }

  // Check: plan numbering within phases
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

    for (const dir of dirs) {
      const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md')).sort();

      // Extract plan numbers
      const planNums = plans.map(p => {
        const pm = p.match(/-(\d{2})-PLAN\.md$/);
        return pm ? parseInt(pm[1], 10) : null;
      }).filter(n => n !== null);

      for (let i = 1; i < planNums.length; i++) {
        if (planNums[i] !== planNums[i - 1] + 1) {
          warnings.push(`Gap in plan numbering in ${dir}: plan ${planNums[i - 1]} → ${planNums[i]}`);
        }
      }

      // Check: plans without summaries (completed plans)
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md'));
      const planIds = new Set(plans.map(p => p.replace('-PLAN.md', '')));
      const summaryIds = new Set(summaries.map(s => s.replace('-SUMMARY.md', '')));

      // Summary without matching plan is suspicious
      for (const sid of summaryIds) {
        if (!planIds.has(sid)) {
          warnings.push(`Summary ${sid}-SUMMARY.md in ${dir} has no matching PLAN.md`);
        }
      }
    }
  } catch {}

  // Check: frontmatter in plans has required fields
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    for (const dir of dirs) {
      const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md'));

      for (const plan of plans) {
        const content = fs.readFileSync(path.join(phasesDir, dir, plan), 'utf-8');
        const fm = extractFrontmatter(content);

        if (!fm.wave) {
          warnings.push(`${dir}/${plan}: missing 'wave' in frontmatter`);
        }
      }
    }
  } catch {}

  const passed = errors.length === 0;
  output({ passed, errors, warnings, warning_count: warnings.length }, raw, passed ? 'passed' : 'failed');
}

// ─── Progress Render ──────────────────────────────────────────────────────────

function cmdProgressRender(cwd, format, raw) {
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const milestone = getMilestoneInfo(cwd);

  const phases = [];
  let totalPlans = 0;
  let totalSummaries = 0;

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => {
      const aNum = parseFloat(a.match(/^(\d+(?:\.\d+)?)/)?.[1] || '0');
      const bNum = parseFloat(b.match(/^(\d+(?:\.\d+)?)/)?.[1] || '0');
      return aNum - bNum;
    });

    for (const dir of dirs) {
      const dm = dir.match(/^(\d+(?:\.\d+)?)-?(.*)/);
      const phaseNum = dm ? dm[1] : dir;
      const phaseName = dm && dm[2] ? dm[2].replace(/-/g, ' ') : '';
      const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;

      totalPlans += plans;
      totalSummaries += summaries;

      let status;
      if (plans === 0) status = 'Pending';
      else if (summaries >= plans) status = 'Complete';
      else if (summaries > 0) status = 'In Progress';
      else status = 'Planned';

      phases.push({ number: phaseNum, name: phaseName, plans, summaries, status });
    }
  } catch {}

  const percent = totalPlans > 0 ? Math.round((totalSummaries / totalPlans) * 100) : 0;

  if (format === 'table') {
    // Render markdown table
    const barWidth = 10;
    const filled = Math.round((percent / 100) * barWidth);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
    let out = `# ${milestone.version} ${milestone.name}\n\n`;
    out += `**Progress:** [${bar}] ${totalSummaries}/${totalPlans} plans (${percent}%)\n\n`;
    out += `| Phase | Name | Plans | Status |\n`;
    out += `|-------|------|-------|--------|\n`;
    for (const p of phases) {
      out += `| ${p.number} | ${p.name} | ${p.summaries}/${p.plans} | ${p.status} |\n`;
    }
    output({ rendered: out }, raw, out);
  } else if (format === 'bar') {
    const barWidth = 20;
    const filled = Math.round((percent / 100) * barWidth);
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
    const text = `[${bar}] ${totalSummaries}/${totalPlans} plans (${percent}%)`;
    output({ bar: text, percent, completed: totalSummaries, total: totalPlans }, raw, text);
  } else {
    // JSON format
    output({
      milestone_version: milestone.version,
      milestone_name: milestone.name,
      phases,
      total_plans: totalPlans,
      total_summaries: totalSummaries,
      percent,
    }, raw);
  }
}

// ─── Todo Complete ────────────────────────────────────────────────────────────

function cmdTodoComplete(cwd, filename, raw) {
  if (!filename) {
    error('filename required for todo complete');
  }

  const pendingDir = path.join(cwd, '.planning', 'todos', 'pending');
  const completedDir = path.join(cwd, '.planning', 'todos', 'completed');
  const sourcePath = path.join(pendingDir, filename);

  if (!fs.existsSync(sourcePath)) {
    error(`Todo not found: ${filename}`);
  }

  // Ensure completed directory exists
  fs.mkdirSync(completedDir, { recursive: true });

  // Read, add completion timestamp, move
  let content = fs.readFileSync(sourcePath, 'utf-8');
  const today = new Date().toISOString().split('T')[0];
  content = `completed: ${today}\n` + content;

  fs.writeFileSync(path.join(completedDir, filename), content, 'utf-8');
  fs.unlinkSync(sourcePath);

  output({ completed: true, file: filename, date: today }, raw, 'completed');
}

// ─── Scaffold ─────────────────────────────────────────────────────────────────

function cmdScaffold(cwd, type, options, raw) {
  const { phase, name } = options;
  const padded = phase ? normalizePhaseName(phase) : '00';
  const today = new Date().toISOString().split('T')[0];

  // Find phase directory
  const phaseInfo = phase ? findPhaseInternal(cwd, phase) : null;
  const phaseDir = phaseInfo ? path.join(cwd, phaseInfo.directory) : null;

  if (phase && !phaseDir && type !== 'phase-dir') {
    error(`Phase ${phase} directory not found`);
  }

  let filePath, content;

  switch (type) {
    case 'context': {
      filePath = path.join(phaseDir, `${padded}-CONTEXT.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — Context\n\n## Decisions\n\n_Decisions will be captured during /gsd:discuss-phase ${phase}_\n\n## Discretion Areas\n\n_Areas where the executor can use judgment_\n\n## Deferred Ideas\n\n_Ideas to consider later_\n`;
      break;
    }
    case 'uat': {
      filePath = path.join(phaseDir, `${padded}-UAT.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — User Acceptance Testing\n\n## Test Results\n\n| # | Test | Status | Notes |\n|---|------|--------|-------|\n\n## Summary\n\n_Pending UAT_\n`;
      break;
    }
    case 'verification': {
      filePath = path.join(phaseDir, `${padded}-VERIFICATION.md`);
      content = `---\nphase: "${padded}"\nname: "${name || phaseInfo?.phase_name || 'Unnamed'}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${name || phaseInfo?.phase_name || 'Unnamed'} — Verification\n\n## Goal-Backward Verification\n\n**Phase Goal:** [From ROADMAP.md]\n\n## Checks\n\n| # | Requirement | Status | Evidence |\n|---|------------|--------|----------|\n\n## Result\n\n_Pending verification_\n`;
      break;
    }
    case 'phase-dir': {
      if (!phase || !name) {
        error('phase and name required for phase-dir scaffold');
      }
      const slug = generateSlugInternal(name);
      const dirName = `${padded}-${slug}`;
      const phasesParent = path.join(cwd, '.planning', 'phases');
      fs.mkdirSync(phasesParent, { recursive: true });
      const dirPath = path.join(phasesParent, dirName);
      fs.mkdirSync(dirPath, { recursive: true });
      output({ created: true, directory: `.planning/phases/${dirName}`, path: dirPath }, raw, dirPath);
      return;
    }
    default:
      error(`Unknown scaffold type: ${type}. Available: context, uat, verification, phase-dir`);
  }

  if (fs.existsSync(filePath)) {
    output({ created: false, reason: 'already_exists', path: filePath }, raw, 'exists');
    return;
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  const relPath = path.relative(cwd, filePath);
  output({ created: true, path: relPath }, raw, relPath);
}

// ─── Compound Commands ────────────────────────────────────────────────────────

function resolveModelInternal(cwd, agentType) {
  const config = loadConfig(cwd);
  const profile = config.model_profile || 'balanced';
  const agentModels = MODEL_PROFILES[agentType];
  if (!agentModels) return 'sonnet';
  return agentModels[profile] || agentModels['balanced'] || 'sonnet';
}

function findPhaseInternal(cwd, phase) {
  if (!phase) return null;

  const phasesDir = path.join(cwd, '.planning', 'phases');
  const normalized = normalizePhaseName(phase);

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    // Match both 'NN-name' and 'phase-NN-name' directory conventions
    const match = dirs.find(d => d.startsWith(normalized) || d.startsWith('phase-' + normalized + '-') || d === 'phase-' + normalized);
    if (!match) return null;

    const dirMatch = match.match(/^(?:phase-)?(\d+(?:\.\d+)?)-?(.*)/);
    const phaseNumber = dirMatch ? dirMatch[1] : normalized;
    const rawName = dirMatch && dirMatch[2] ? dirMatch[2] : null;
    // Strip leading 'phase-' artifact if present (shouldn't be after regex fix, but safety net)
    const phaseName = rawName ? rawName.replace(/^phase-/, '') : null;
    const phaseDir = path.join(phasesDir, match);
    const phaseFiles = fs.readdirSync(phaseDir);

    const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();
    const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').sort();
    const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
    const hasContext = phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
    const hasVerification = phaseFiles.some(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');

    // Determine incomplete plans (plans without matching summaries)
    const completedPlanIds = new Set(
      summaries.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', ''))
    );
    const incompletePlans = plans.filter(p => {
      const planId = p.replace('-PLAN.md', '').replace('PLAN.md', '');
      return !completedPlanIds.has(planId);
    });

    return {
      found: true,
      directory: path.join('.planning', 'phases', match),
      phase_number: phaseNumber,
      phase_name: phaseName,
      phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
      plans,
      summaries,
      incomplete_plans: incompletePlans,
      has_research: hasResearch,
      has_context: hasContext,
      has_verification: hasVerification,
    };
  } catch {
    return null;
  }
}

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
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getMilestoneInfo(cwd) {
  try {
    const roadmap = fs.readFileSync(path.join(cwd, '.planning', 'ROADMAP.md'), 'utf-8');
    const versionMatch = roadmap.match(/v(\d+\.\d+)/);
    const nameMatch = roadmap.match(/## .*v\d+\.\d+[:\s]+([^\n(]+)/);
    return {
      version: versionMatch ? versionMatch[0] : 'v1.0',
      name: nameMatch ? nameMatch[1].trim() : 'milestone',
    };
  } catch {
    return { version: 'v1.0', name: 'milestone' };
  }
}

function cmdInitExecutePhase(cwd, phase, includes, raw) {
  if (!phase) {
    error('phase required for init execute-phase');
  }

  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);
  const milestone = getMilestoneInfo(cwd);

  const result = {
    // Models
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    verifier_model: resolveModelInternal(cwd, 'gsd-verifier'),

    // Config flags
    commit_docs: config.commit_docs,
    parallelization: config.parallelization,
    branching_strategy: config.branching_strategy,
    phase_branch_template: config.phase_branch_template,
    milestone_branch_template: config.milestone_branch_template,
    verifier_enabled: config.verifier,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,

    // Plan inventory
    plans: phaseInfo?.plans || [],
    summaries: phaseInfo?.summaries || [],
    incomplete_plans: phaseInfo?.incomplete_plans || [],
    plan_count: phaseInfo?.plans?.length || 0,
    incomplete_count: phaseInfo?.incomplete_plans?.length || 0,

    // Branch name (pre-computed)
    branch_name: config.branching_strategy === 'phase' && phaseInfo
      ? config.phase_branch_template
          .replace('{phase}', phaseInfo.phase_number)
          .replace('{slug}', phaseInfo.phase_slug || 'phase')
      : config.branching_strategy === 'milestone'
        ? config.milestone_branch_template
            .replace('{milestone}', milestone.version)
            .replace('{slug}', generateSlugInternal(milestone.name) || 'milestone')
        : null,

    // Milestone info
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),

    // File existence
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    config_exists: pathExistsInternal(cwd, '.planning/config.json'),
  };

  // Include file contents if requested via --include
  if (includes.has('state')) {
    result.state_content = safeReadFile(path.join(cwd, '.planning', 'STATE.md'));
  }
  if (includes.has('config')) {
    result.config_content = safeReadFile(path.join(cwd, '.planning', 'config.json'));
  }
  if (includes.has('roadmap')) {
    result.roadmap_content = safeReadFile(path.join(cwd, '.planning', 'ROADMAP.md'));
  }

  // Circuit breaker execution gate (Gap 1: circuit breaker -> init execute-phase wiring)
  if (circuitBreaker && circuitBreaker.checkExecution) {
    try {
      result.circuit_breaker = circuitBreaker.checkExecution(
        phaseInfo?.phase_slug || phase,
        result.executor_model,
        0
      );
    } catch (e) {
      result.circuit_breaker = { proceed: true, reason: 'check_error' };
    }
  } else {
    result.circuit_breaker = null;
  }

  output(result, raw);
}

function cmdInitPlanPhase(cwd, phase, includes, raw) {
  if (!phase) {
    error('phase required for init plan-phase');
  }

  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'gsd-phase-researcher'),
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),

    // Workflow flags
    research_enabled: config.research,
    plan_checker_enabled: config.plan_checker,
    commit_docs: config.commit_docs,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    padded_phase: phaseInfo?.phase_number?.padStart(2, '0') || null,

    // Existing artifacts
    has_research: phaseInfo?.has_research || false,
    has_context: phaseInfo?.has_context || false,
    has_plans: (phaseInfo?.plans?.length || 0) > 0,
    plan_count: phaseInfo?.plans?.length || 0,

    // Environment
    planning_exists: pathExistsInternal(cwd, '.planning'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
  };

  // Include file contents if requested via --include
  if (includes.has('state')) {
    result.state_content = safeReadFile(path.join(cwd, '.planning', 'STATE.md'));
  }
  if (includes.has('roadmap')) {
    result.roadmap_content = safeReadFile(path.join(cwd, '.planning', 'ROADMAP.md'));
  }
  if (includes.has('requirements')) {
    result.requirements_content = safeReadFile(path.join(cwd, '.planning', 'REQUIREMENTS.md'));
  }
  if (includes.has('context') && phaseInfo?.directory) {
    // Find *-CONTEXT.md in phase directory
    const phaseDirFull = path.join(cwd, phaseInfo.directory);
    try {
      const files = fs.readdirSync(phaseDirFull);
      const contextFile = files.find(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
      if (contextFile) {
        result.context_content = safeReadFile(path.join(phaseDirFull, contextFile));
      }
    } catch {}
  }
  if (includes.has('research') && phaseInfo?.directory) {
    // Find *-RESEARCH.md in phase directory
    const phaseDirFull = path.join(cwd, phaseInfo.directory);
    try {
      const files = fs.readdirSync(phaseDirFull);
      const researchFile = files.find(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
      if (researchFile) {
        result.research_content = safeReadFile(path.join(phaseDirFull, researchFile));
      }
    } catch {}
  }
  if (includes.has('verification') && phaseInfo?.directory) {
    // Find *-VERIFICATION.md in phase directory
    const phaseDirFull = path.join(cwd, phaseInfo.directory);
    try {
      const files = fs.readdirSync(phaseDirFull);
      const verificationFile = files.find(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');
      if (verificationFile) {
        result.verification_content = safeReadFile(path.join(phaseDirFull, verificationFile));
      }
    } catch {}
  }
  if (includes.has('uat') && phaseInfo?.directory) {
    // Find *-UAT.md in phase directory
    const phaseDirFull = path.join(cwd, phaseInfo.directory);
    try {
      const files = fs.readdirSync(phaseDirFull);
      const uatFile = files.find(f => f.endsWith('-UAT.md') || f === 'UAT.md');
      if (uatFile) {
        result.uat_content = safeReadFile(path.join(phaseDirFull, uatFile));
      }
    } catch {}
  }

  output(result, raw);
}

function cmdInitNewProject(cwd, raw) {
  const config = loadConfig(cwd);

  // Detect Brave Search API key availability
  const homedir = require('os').homedir();
  const braveKeyFile = path.join(homedir, '.gsd', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));

  // Detect existing code
  let hasCode = false;
  let hasPackageFile = false;
  try {
    const files = execSync('find . -maxdepth 3 \\( -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.swift" -o -name "*.java" \\) 2>/dev/null | grep -v node_modules | grep -v .git | head -5', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    hasCode = files.trim().length > 0;
  } catch {}

  hasPackageFile = pathExistsInternal(cwd, 'package.json') ||
                   pathExistsInternal(cwd, 'requirements.txt') ||
                   pathExistsInternal(cwd, 'Cargo.toml') ||
                   pathExistsInternal(cwd, 'go.mod') ||
                   pathExistsInternal(cwd, 'Package.swift');

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'gsd-project-researcher'),
    synthesizer_model: resolveModelInternal(cwd, 'gsd-research-synthesizer'),
    roadmapper_model: resolveModelInternal(cwd, 'gsd-roadmapper'),

    // Config
    commit_docs: config.commit_docs,

    // Existing state
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    has_codebase_map: pathExistsInternal(cwd, '.planning/codebase'),
    planning_exists: pathExistsInternal(cwd, '.planning'),

    // Brownfield detection
    has_existing_code: hasCode,
    has_package_file: hasPackageFile,
    is_brownfield: hasCode || hasPackageFile,
    needs_codebase_map: (hasCode || hasPackageFile) && !pathExistsInternal(cwd, '.planning/codebase'),

    // Git state
    has_git: pathExistsInternal(cwd, '.git'),

    // Enhanced search
    brave_search_available: hasBraveSearch,
  };

  output(result, raw);
}

function cmdInitNewMilestone(cwd, raw) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);

  const result = {
    // Models
    researcher_model: resolveModelInternal(cwd, 'gsd-project-researcher'),
    synthesizer_model: resolveModelInternal(cwd, 'gsd-research-synthesizer'),
    roadmapper_model: resolveModelInternal(cwd, 'gsd-roadmapper'),

    // Config
    commit_docs: config.commit_docs,
    research_enabled: config.research,

    // Current milestone
    current_milestone: milestone.version,
    current_milestone_name: milestone.name,

    // File existence
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
  };

  output(result, raw);
}

function cmdInitMilestoneBranch(cwd, raw) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);

  const result = {
    branching_strategy: config.branching_strategy,
    branch_name: config.branching_strategy === 'milestone'
      ? config.milestone_branch_template
          .replace('{milestone}', milestone.version)
          .replace('{slug}', generateSlugInternal(milestone.name) || 'milestone')
      : null,
    milestone_version: milestone.version,
    milestone_slug: generateSlugInternal(milestone.name),
  };

  output(result, raw);
}

function cmdInitQuick(cwd, description, raw) {
  const config = loadConfig(cwd);
  const now = new Date();
  const slug = description ? generateSlugInternal(description)?.substring(0, 40) : null;

  // Find next quick task number
  const quickDir = path.join(cwd, '.planning', 'quick');
  let nextNum = 1;
  try {
    const existing = fs.readdirSync(quickDir)
      .filter(f => /^\d+-/.test(f))
      .map(f => parseInt(f.split('-')[0], 10))
      .filter(n => !isNaN(n));
    if (existing.length > 0) {
      nextNum = Math.max(...existing) + 1;
    }
  } catch {}

  const result = {
    // Models
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),

    // Config
    commit_docs: config.commit_docs,

    // Quick task info
    next_num: nextNum,
    slug: slug,
    description: description || null,

    // Timestamps
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),

    // Paths
    quick_dir: '.planning/quick',
    task_dir: slug ? `.planning/quick/${nextNum}-${slug}` : null,

    // File existence
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),
  };

  output(result, raw);
}

function cmdInitResume(cwd, raw) {
  const config = loadConfig(cwd);

  // Check for interrupted agent
  let interruptedAgentId = null;
  try {
    interruptedAgentId = fs.readFileSync(path.join(cwd, '.planning', 'current-agent-id.txt'), 'utf-8').trim();
  } catch {}

  const result = {
    // File existence
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),

    // Agent state
    has_interrupted_agent: !!interruptedAgentId,
    interrupted_agent_id: interruptedAgentId,

    // Config
    commit_docs: config.commit_docs,
  };

  output(result, raw);
}

function cmdInitVerifyWork(cwd, phase, raw) {
  if (!phase) {
    error('phase required for init verify-work');
  }

  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);

  const result = {
    // Models
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),
    checker_model: resolveModelInternal(cwd, 'gsd-plan-checker'),

    // Config
    commit_docs: config.commit_docs,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,

    // Existing artifacts
    has_verification: phaseInfo?.has_verification || false,
  };

  output(result, raw);
}

function cmdInitPhaseOp(cwd, phase, raw) {
  const config = loadConfig(cwd);
  const phaseInfo = findPhaseInternal(cwd, phase);

  const result = {
    // Config
    commit_docs: config.commit_docs,
    brave_search: config.brave_search,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    padded_phase: phaseInfo?.phase_number?.padStart(2, '0') || null,

    // Existing artifacts
    has_research: phaseInfo?.has_research || false,
    has_context: phaseInfo?.has_context || false,
    has_plans: (phaseInfo?.plans?.length || 0) > 0,
    has_verification: phaseInfo?.has_verification || false,
    plan_count: phaseInfo?.plans?.length || 0,

    // File existence
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    planning_exists: pathExistsInternal(cwd, '.planning'),
  };

  output(result, raw);
}

function cmdInitTodos(cwd, area, raw) {
  const config = loadConfig(cwd);
  const now = new Date();

  // List todos (reuse existing logic)
  const pendingDir = path.join(cwd, '.planning', 'todos', 'pending');
  let count = 0;
  const todos = [];

  try {
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(pendingDir, file), 'utf-8');
        const createdMatch = content.match(/^created:\s*(.+)$/m);
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);
        const todoArea = areaMatch ? areaMatch[1].trim() : 'general';

        if (area && todoArea !== area) continue;

        count++;
        todos.push({
          file,
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: todoArea,
          path: path.join('.planning', 'todos', 'pending', file),
        });
      } catch {}
    }
  } catch {}

  const result = {
    // Config
    commit_docs: config.commit_docs,

    // Timestamps
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),

    // Todo inventory
    todo_count: count,
    todos,
    area_filter: area || null,

    // Paths
    pending_dir: '.planning/todos/pending',
    completed_dir: '.planning/todos/completed',

    // File existence
    planning_exists: pathExistsInternal(cwd, '.planning'),
    todos_dir_exists: pathExistsInternal(cwd, '.planning/todos'),
    pending_dir_exists: pathExistsInternal(cwd, '.planning/todos/pending'),
  };

  output(result, raw);
}

function cmdInitMilestoneOp(cwd, raw) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);

  // Count phases
  let phaseCount = 0;
  let completedPhases = 0;
  const phasesDir = path.join(cwd, '.planning', 'phases');
  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    phaseCount = dirs.length;

    // Count phases with summaries (completed)
    for (const dir of dirs) {
      try {
        const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
        const hasSummary = phaseFiles.some(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        if (hasSummary) completedPhases++;
      } catch {}
    }
  } catch {}

  // Check archive
  const archiveDir = path.join(cwd, '.planning', 'archive');
  let archivedMilestones = [];
  try {
    archivedMilestones = fs.readdirSync(archiveDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch {}

  const result = {
    // Config
    commit_docs: config.commit_docs,

    // Current milestone
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),

    // Phase counts
    phase_count: phaseCount,
    completed_phases: completedPhases,
    all_phases_complete: phaseCount > 0 && phaseCount === completedPhases,

    // Archive
    archived_milestones: archivedMilestones,
    archive_count: archivedMilestones.length,

    // File existence
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
    archive_exists: pathExistsInternal(cwd, '.planning/archive'),
    phases_dir_exists: pathExistsInternal(cwd, '.planning/phases'),
  };

  output(result, raw);
}

function cmdInitMapCodebase(cwd, raw) {
  const config = loadConfig(cwd);

  // Check for existing codebase maps
  const codebaseDir = path.join(cwd, '.planning', 'codebase');
  let existingMaps = [];
  try {
    existingMaps = fs.readdirSync(codebaseDir).filter(f => f.endsWith('.md'));
  } catch {}

  const result = {
    // Models
    mapper_model: resolveModelInternal(cwd, 'gsd-codebase-mapper'),

    // Config
    commit_docs: config.commit_docs,
    search_gitignored: config.search_gitignored,
    parallelization: config.parallelization,

    // Paths
    codebase_dir: '.planning/codebase',

    // Existing maps
    existing_maps: existingMaps,
    has_maps: existingMaps.length > 0,

    // File existence
    planning_exists: pathExistsInternal(cwd, '.planning'),
    codebase_dir_exists: pathExistsInternal(cwd, '.planning/codebase'),
  };

  output(result, raw);
}

function cmdInitProgress(cwd, includes, raw) {
  const config = loadConfig(cwd);
  const milestone = getMilestoneInfo(cwd);

  // Analyze phases
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const phases = [];
  let currentPhase = null;
  let nextPhase = null;

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

    for (const dir of dirs) {
      const match = dir.match(/^(\d+(?:\.\d+)?)-?(.*)/);
      const phaseNumber = match ? match[1] : dir;
      const phaseName = match && match[2] ? match[2] : null;

      const phasePath = path.join(phasesDir, dir);
      const phaseFiles = fs.readdirSync(phasePath);

      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');

      const status = summaries.length >= plans.length && plans.length > 0 ? 'complete' :
                     plans.length > 0 ? 'in_progress' :
                     hasResearch ? 'researched' : 'pending';

      const phaseInfo = {
        number: phaseNumber,
        name: phaseName,
        directory: path.join('.planning', 'phases', dir),
        status,
        plan_count: plans.length,
        summary_count: summaries.length,
        has_research: hasResearch,
      };

      phases.push(phaseInfo);

      // Find current (first incomplete with plans) and next (first pending)
      if (!currentPhase && (status === 'in_progress' || status === 'researched')) {
        currentPhase = phaseInfo;
      }
      if (!nextPhase && status === 'pending') {
        nextPhase = phaseInfo;
      }
    }
  } catch {}

  // Check for paused work
  let pausedAt = null;
  try {
    const state = fs.readFileSync(path.join(cwd, '.planning', 'STATE.md'), 'utf-8');
    const pauseMatch = state.match(/\*\*Paused At:\*\*\s*(.+)/);
    if (pauseMatch) pausedAt = pauseMatch[1].trim();
  } catch {}

  const result = {
    // Models
    executor_model: resolveModelInternal(cwd, 'gsd-executor'),
    planner_model: resolveModelInternal(cwd, 'gsd-planner'),

    // Config
    commit_docs: config.commit_docs,

    // Milestone
    milestone_version: milestone.version,
    milestone_name: milestone.name,

    // Phase overview
    phases,
    phase_count: phases.length,
    completed_count: phases.filter(p => p.status === 'complete').length,
    in_progress_count: phases.filter(p => p.status === 'in_progress').length,

    // Current state
    current_phase: currentPhase,
    next_phase: nextPhase,
    paused_at: pausedAt,
    has_work_in_progress: !!currentPhase,

    // File existence
    project_exists: pathExistsInternal(cwd, '.planning/PROJECT.md'),
    roadmap_exists: pathExistsInternal(cwd, '.planning/ROADMAP.md'),
    state_exists: pathExistsInternal(cwd, '.planning/STATE.md'),
  };

  // Include file contents if requested via --include
  if (includes.has('state')) {
    result.state_content = safeReadFile(path.join(cwd, '.planning', 'STATE.md'));
  }
  if (includes.has('roadmap')) {
    result.roadmap_content = safeReadFile(path.join(cwd, '.planning', 'ROADMAP.md'));
  }
  if (includes.has('project')) {
    result.project_content = safeReadFile(path.join(cwd, '.planning', 'PROJECT.md'));
  }
  if (includes.has('config')) {
    result.config_content = safeReadFile(path.join(cwd, '.planning', 'config.json'));
  }

  output(result, raw);
}

function cmdInitExecuteRoadmap(cwd, raw) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');

  if (!fs.existsSync(roadmapPath)) {
    output({
      error: 'ROADMAP.md not found',
      roadmap_exists: false
    }, raw);
    return;
  }

  const config = loadConfig(cwd);
  const profileToCoordinatorModel = {
    quality: 'opus',
    balanced: 'sonnet',
    budget: 'haiku',
    auto: 'haiku'
  };
  const coordinatorModel = config.coordinator_model ?? profileToCoordinatorModel[config.model_profile] ?? 'haiku';

  // Use existing cmdRoadmapAnalyze logic to get phase data
  const content = fs.readFileSync(roadmapPath, 'utf-8');
  const phasesDir = path.join(cwd, '.planning', 'phases');

  // Extract all phase headings: ### Phase N: Name
  const phasePattern = /###\s*Phase\s+(\d+(?:\.\d+)?)\s*:\s*([^\n]+)/gi;
  const phases = [];
  let match;

  while ((match = phasePattern.exec(content)) !== null) {
    const phaseNum = match[1];
    const phaseName = match[2].replace(/\(INSERTED\)/i, '').trim();

    // Extract goal from the section
    const sectionStart = match.index;
    const restOfContent = content.slice(sectionStart);
    const nextHeader = restOfContent.match(/\n###\s+Phase\s+\d/i);
    const sectionEnd = nextHeader ? sectionStart + nextHeader.index : content.length;
    const section = content.slice(sectionStart, sectionEnd);

    const goalMatch = section.match(/\*\*Goal:\*\*\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    const dependsMatch = section.match(/\*\*Depends on:\*\*\s*([^\n]+)/i);
    const depends_on = dependsMatch ? dependsMatch[1].trim() : null;

    // Check completion on disk
    const normalized = normalizePhaseName(phaseNum);
    let diskStatus = 'no_directory';
    let planCount = 0;
    let summaryCount = 0;

    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      const dirMatch = dirs.find(d => d.startsWith(normalized + '-') || d === normalized);

      if (dirMatch) {
        const phaseFiles = fs.readdirSync(path.join(phasesDir, dirMatch));
        planCount = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
        summaryCount = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;

        if (summaryCount >= planCount && planCount > 0) diskStatus = 'complete';
        else if (summaryCount > 0) diskStatus = 'partial';
        else if (planCount > 0) diskStatus = 'planned';
        else diskStatus = 'empty';
      }
    } catch {}

    phases.push({
      number: phaseNum,
      name: phaseName,
      goal,
      depends_on,
      disk_status: diskStatus,
    });
  }

  // Build execution order (simple sequential for now - no DAG parallel support yet)
  const executionOrder = phases.map(p => p.number);

  // Find next executable phases (phases that are not complete and dependencies are met)
  const completePhases = new Set(phases.filter(p => p.disk_status === 'complete').map(p => p.number));
  const executable = [];
  const blocked = [];

  for (const phase of phases) {
    if (phase.disk_status === 'complete') continue;

    // Check dependencies
    if (phase.depends_on && phase.depends_on !== 'None') {
      const deps = phase.depends_on.split(',').map(d => d.trim());
      const allDepsMet = deps.every(dep => completePhases.has(dep));

      if (allDepsMet) {
        executable.push(phase.number);
      } else {
        blocked.push({ phase: phase.number, missing_deps: deps.filter(d => !completePhases.has(d)) });
      }
    } else {
      // No dependencies, executable
      executable.push(phase.number);
    }
  }

  // Check for execution log
  const executionLogPath = path.join(cwd, '.planning', 'EXECUTION_LOG.md');
  const hasExecutionLog = fs.existsSync(executionLogPath);

  // Check for incomplete execution (resume capability)
  let resumeState = null;
  if (hasExecutionLog) {
    try {
      const logContent = fs.readFileSync(executionLogPath, 'utf-8');
      const lines = logContent.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      const events = lines.map(l => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);

      const lastComplete = events.filter(e => e.type === 'phase_complete').pop();
      const lastStart = events.filter(e => e.type === 'phase_start').pop();
      const roadmapComplete = events.some(e => e.type === 'roadmap_complete');

      if (!roadmapComplete && lastStart && (!lastComplete || lastStart.phase > lastComplete.phase)) {
        resumeState = {
          phase: lastStart.phase,
          phase_name: lastStart.name,
          status: 'in_progress'
        };
      } else if (!roadmapComplete && lastComplete) {
        resumeState = {
          last_complete_phase: lastComplete.phase,
          status: 'can_resume'
        };
      }
    } catch {}
  }

  output({
    roadmap_exists: true,
    total_phases: phases.length,
    execution_order: executionOrder,
    parallel_opportunities: [], // Future enhancement
    next_executable: executable,
    blocked_phases: blocked,
    has_execution_log: hasExecutionLog,
    resume_state: resumeState,
    coordinator_model: coordinatorModel
  }, raw);
}

// ─── Session Analysis Commands ────────────────────────────────────────────────

/**
 * analyze-session <session-file-path>
 *
 * Prepares a session JSONL file for Haiku analysis.
 * Returns extraction requests for the calling GSD workflow to pass to Task().
 */
async function cmdAnalyzeSession(cwd, args, raw) {
  const sessionFilePath = args[0];

  if (!sessionFilePath) {
    output({ status: 'error', reason: 'Usage: analyze-session <session-file-path>' }, raw);
    return;
  }

  // Resolve the path (absolute or relative to cwd)
  const resolvedPath = path.isAbsolute(sessionFilePath)
    ? sessionFilePath
    : path.join(cwd, sessionFilePath);

  // Check if file exists
  if (!fs.existsSync(resolvedPath)) {
    output({ status: 'error', reason: `Session file not found: ${resolvedPath}` }, raw);
    return;
  }

  // Lazy-require modules
  let shouldAnalyzeSession, isAlreadyAnalyzed, getSessionContentHash;
  try {
    const gates = require(path.join(__dirname, 'session-quality-gates.js'));
    shouldAnalyzeSession = gates.shouldAnalyzeSession;
    isAlreadyAnalyzed = gates.isAlreadyAnalyzed;
    getSessionContentHash = gates.getSessionContentHash;
  } catch (err) {
    output({ status: 'error', reason: 'Failed to load session-quality-gates.js: ' + err.message }, raw);
    return;
  }

  let prepareSessionForAnalysis;
  try {
    const chunker = require(path.join(__dirname, 'session-chunker.js'));
    prepareSessionForAnalysis = chunker.prepareSessionForAnalysis;
  } catch (err) {
    output({ status: 'error', reason: 'Failed to load session-chunker.js: ' + err.message }, raw);
    return;
  }

  let analyzeSession;
  try {
    const analyzer = require(path.join(__dirname, 'session-analyzer.js'));
    analyzeSession = analyzer.analyzeSession;
  } catch (err) {
    output({ status: 'error', reason: 'Failed to load session-analyzer.js: ' + err.message }, raw);
    return;
  }

  // Load session JSONL entries
  let entries = [];
  try {
    const rawContent = fs.readFileSync(resolvedPath, 'utf8');
    const lines = rawContent.split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }
  } catch (err) {
    output({ status: 'error', reason: 'Failed to read session file: ' + err.message }, raw);
    return;
  }

  // Run quality gates
  const qualityCheck = shouldAnalyzeSession(entries);
  if (!qualityCheck.analyze) {
    output({ status: 'skipped', reason: qualityCheck.reason }, raw);
    return;
  }

  // Check re-analysis prevention
  const contentHash = getSessionContentHash(entries);
  const sessionId = path.basename(resolvedPath, '.jsonl');

  if (isAlreadyAnalyzed(sessionId, contentHash)) {
    output({ status: 'already_analyzed', sessionId, contentHash }, raw);
    return;
  }

  // Prepare session (voice resolution + chunking)
  const prepared = prepareSessionForAnalysis(entries);

  // For each chunk, get extraction requests
  const allExtractionRequests = [];
  for (const chunk of prepared.chunks) {
    const requests = analyzeSession(chunk);
    allExtractionRequests.push(...requests);
  }

  output({
    status: 'ready',
    sessionId,
    sessionPath: resolvedPath,
    chunkCount: prepared.chunkCount,
    totalChars: prepared.totalChars,
    contentHash,
    extractionRequests: allExtractionRequests
  }, raw);
}

/**
 * historical-extract <planning-path>
 *
 * Extracts knowledge from an existing GSD project's completed phases.
 * Returns extraction requests for the calling GSD workflow to pass to Task().
 */
async function cmdHistoricalExtract(cwd, args, raw) {
  const planningPath = args[0];

  if (!planningPath) {
    output({ status: 'error', reason: 'Usage: historical-extract <planning-path>' }, raw);
    return;
  }

  const resolvedPath = path.isAbsolute(planningPath)
    ? planningPath
    : path.join(cwd, planningPath);

  if (!fs.existsSync(resolvedPath)) {
    output({ status: 'error', reason: `Planning path does not exist: ${resolvedPath}`, phasesFound: 0 }, raw);
    return;
  }

  const roadmapPath = path.join(resolvedPath, 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    output({ status: 'error', reason: `ROADMAP.md not found in: ${resolvedPath}`, phasesFound: 0 }, raw);
    return;
  }

  let extractFromProject;
  try {
    const extractor = require(path.join(__dirname, 'historical-extract.js'));
    extractFromProject = extractor.extractFromProject;
  } catch (err) {
    output({ status: 'error', reason: 'Failed to load historical-extract.js: ' + err.message }, raw);
    return;
  }

  const result = extractFromProject(resolvedPath);
  output(result, raw);
}

/**
 * analysis-status
 *
 * Reports statistics on analyzed sessions.
 */
function cmdAnalysisStatus(cwd, args, raw) {
  let getAnalysisStats;
  try {
    const gates = require(path.join(__dirname, 'session-quality-gates.js'));
    getAnalysisStats = gates.getAnalysisStats;
  } catch (err) {
    output({
      totalAnalyzed: 0,
      totalInsights: 0,
      lastAnalysis: null,
      error: 'Failed to load session-quality-gates.js: ' + err.message
    }, raw);
    return;
  }

  const stats = getAnalysisStats();
  const analysisLogPath = path.join(cwd, '.planning', 'telegram-sessions', '.analysis-log.jsonl');

  output({
    totalAnalyzed: stats.totalSessions || 0,
    totalInsights: stats.totalInsights || 0,
    lastAnalysis: stats.lastAnalyzedAt || null,
    analysisLogPath
  }, raw);
}

/**
 * list-pending-sessions
 *
 * Scans .planning/telegram-sessions/ for session JSONL files with
 * session_analysis_pending entries that have not yet been processed.
 */
async function cmdListPendingSessions(cwd, args, raw) {
  const sessionsDir = path.join(cwd, '.planning', 'telegram-sessions');

  if (!fs.existsSync(sessionsDir)) {
    output({ pending: [], count: 0 }, raw);
    return;
  }

  let isAlreadyAnalyzed;
  try {
    const gates = require(path.join(__dirname, 'session-quality-gates.js'));
    isAlreadyAnalyzed = gates.isAlreadyAnalyzed;
  } catch (err) {
    output({ pending: [], count: 0, error: 'Failed to load session-quality-gates.js: ' + err.message }, raw);
    return;
  }

  // Read all JSONL files in the sessions directory
  let sessionFiles = [];
  try {
    sessionFiles = fs.readdirSync(sessionsDir)
      .filter(f => f.endsWith('.jsonl') && !f.startsWith('.'))
      .map(f => path.join(sessionsDir, f));
  } catch (err) {
    output({ pending: [], count: 0, error: 'Failed to read sessions directory: ' + err.message }, raw);
    return;
  }

  const pending = [];

  for (const sessionPath of sessionFiles) {
    let entries = [];
    try {
      const rawContent = fs.readFileSync(sessionPath, 'utf8');
      const lines = rawContent.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch {
          // Skip malformed lines
        }
      }
    } catch {
      continue;
    }

    // Check if there's a session_analysis_pending entry
    const pendingEntryIdx = entries.findIndex(e => e && e.type === 'session_analysis_pending');
    if (pendingEntryIdx === -1) continue;

    // Check if a session_analysis_complete entry exists AFTER the pending entry
    const hasComplete = entries
      .slice(pendingEntryIdx + 1)
      .some(e => e && e.type === 'session_analysis_complete');

    if (hasComplete) continue;

    // Get the pending entry to retrieve extraction requests
    const pendingEntry = entries[pendingEntryIdx];
    const sessionId = pendingEntry.session_id || path.basename(sessionPath, '.jsonl');

    // Secondary guard: check analysis log
    if (pendingEntry.content_hash && isAlreadyAnalyzed(sessionId, pendingEntry.content_hash)) {
      continue;
    }

    pending.push({
      sessionId,
      sessionPath,
      extractionRequests: pendingEntry.extraction_requests || [],
      timestamp: pendingEntry.timestamp || null
    });
  }

  output({ pending, count: pending.length }, raw);
}

/**
 * store-analysis-result <session-id> <results-json>
 *
 * Accepts Haiku extraction results and persists them to the knowledge DB.
 * Marks the session as analyzed to prevent re-analysis.
 */
async function cmdStoreAnalysisResult(cwd, args, raw) {
  const sessionId = args[0];
  const resultsArg = args.slice(1).join(' ');

  if (!sessionId) {
    output({ status: 'error', reason: 'Usage: store-analysis-result <session-id> <results-json>' }, raw);
    return;
  }

  if (!resultsArg) {
    output({ stored: 0, skipped: 0, evolved: 0, errors: ['No results JSON provided'] }, raw);
    return;
  }

  // Parse the results JSON (may be a JSON string or path to JSON file)
  let results = [];
  try {
    // First try as a JSON string
    results = JSON.parse(resultsArg);
  } catch {
    // Try as a file path
    const resolvedPath = path.isAbsolute(resultsArg)
      ? resultsArg
      : path.join(cwd, resultsArg);
    try {
      const fileContent = fs.readFileSync(resolvedPath, 'utf8');
      results = JSON.parse(fileContent);
    } catch (err) {
      output({ stored: 0, skipped: 0, evolved: 0, errors: ['Failed to parse results JSON: ' + err.message] }, raw);
      return;
    }
  }

  // Handle empty results
  if (!Array.isArray(results) || results.length === 0) {
    output({ stored: 0, skipped: 0, evolved: 0, errors: [] }, raw);
    return;
  }

  // Lazy-require modules
  let parseExtractionResult;
  try {
    const analyzer = require(path.join(__dirname, 'session-analyzer.js'));
    parseExtractionResult = analyzer.parseExtractionResult;
  } catch (err) {
    output({ stored: 0, skipped: 0, evolved: 0, errors: ['Failed to load session-analyzer.js: ' + err.message] }, raw);
    return;
  }

  let storeInsights;
  try {
    const writer = require(path.join(__dirname, 'knowledge-writer.js'));
    storeInsights = writer.storeInsights;
  } catch (err) {
    output({ stored: 0, skipped: 0, evolved: 0, errors: ['Failed to load knowledge-writer.js: ' + err.message] }, raw);
    return;
  }

  let markSessionAnalyzed, getSessionContentHash;
  try {
    const gates = require(path.join(__dirname, 'session-quality-gates.js'));
    markSessionAnalyzed = gates.markSessionAnalyzed;
    getSessionContentHash = gates.getSessionContentHash;
  } catch (err) {
    output({ stored: 0, skipped: 0, evolved: 0, errors: ['Failed to load session-quality-gates.js: ' + err.message] }, raw);
    return;
  }

  // Collect all insights from all result objects
  const allInsights = [];
  const parseErrors = [];

  for (const resultObj of results) {
    if (!resultObj || typeof resultObj.type !== 'string' || typeof resultObj.result !== 'string') {
      parseErrors.push('Invalid result object (missing type or result field)');
      continue;
    }

    const { insights, errors } = parseExtractionResult(resultObj.type, resultObj.result);
    allInsights.push(...insights);
    parseErrors.push(...errors);
  }

  // Store all insights in knowledge DB
  const { resolveProjectSlug } = require(path.join(__dirname, 'knowledge-writer.js'));
  let storeResult = { stored: 0, skipped: 0, evolved: 0, errors: [] };
  if (allInsights.length > 0) {
    try {
      storeResult = await storeInsights(allInsights, { sessionId, scope: 'global', projectSlug: resolveProjectSlug(cwd) });
    } catch (err) {
      storeResult.errors.push('storeInsights failed: ' + err.message);
    }
  }

  // Mark session as analyzed
  const totalInsights = storeResult.stored + storeResult.evolved;
  const contentHash = getSessionContentHash([]); // We use a placeholder hash here since entries may not be available
  try {
    markSessionAnalyzed(sessionId, contentHash, totalInsights);
  } catch (err) {
    storeResult.errors.push('markSessionAnalyzed failed: ' + err.message);
  }

  // Append session_analysis_complete entry to the session JSONL file
  const sessionsDir = path.join(cwd, '.planning', 'telegram-sessions');
  const sessionFilePath = path.join(sessionsDir, sessionId + '.jsonl');
  if (fs.existsSync(sessionFilePath)) {
    try {
      const completeEntry = JSON.stringify({
        type: 'session_analysis_complete',
        session_id: sessionId,
        insight_count: totalInsights,
        timestamp: new Date().toISOString()
      }) + '\n';
      fs.appendFileSync(sessionFilePath, completeEntry, 'utf8');
    } catch (err) {
      storeResult.errors.push('Failed to append session_analysis_complete: ' + err.message);
    }
  }

  output({
    stored: storeResult.stored,
    skipped: storeResult.skipped,
    evolved: storeResult.evolved,
    errors: [...parseErrors, ...storeResult.errors]
  }, raw);
}

// ============================================================
// Compression: doc header extraction (Phase 09)
// ============================================================

function cmdCompressSummary(filePath, raw) {
  if (!filePath) { error('file path required'); return; }
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) { error('file not found: ' + absolutePath); return; }

  const { HeaderExtractor } = require('./compression/header-extractor');
  const extractor = new HeaderExtractor();
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const result = extractor.extractSummary(content, absolutePath);

  if (raw) {
    console.log(result.summary);
  } else {
    const reductionPercent = ((1 - result.summary.length / content.length) * 100).toFixed(1);
    output({ ...result, originalLength: content.length, reductionPercent }, false);
  }
}

function cmdCompressStats(raw) {
  output({
    message: 'Compression stats tracking not yet implemented',
    suggestion: 'Use "compress summary" command to compress individual files'
  }, raw);
}

// ============================================================
// Routing: model selection + context injection (Phase 01)
// ============================================================

function loadRoutingRules(filePath) {
  const content = safeReadFile(filePath);
  if (!content) return [];

  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const tableRows = lines.filter(l => l.trim().startsWith('|'));
  const dataRows = tableRows.slice(2);

  return dataRows.map(line => {
    const trimmed = line.trim();
    const withoutLeadingPipe = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
    const withoutTrailingPipe = withoutLeadingPipe.endsWith('|') ? withoutLeadingPipe.slice(0, -1) : withoutLeadingPipe;

    const allParts = withoutTrailingPipe.split('|').map(c => c.trim());

    if (allParts.length < 4) return null;

    const rationale = allParts[allParts.length - 1];
    const priority = allParts[allParts.length - 2];
    const model = allParts[allParts.length - 3];
    const patternStr = allParts.slice(0, allParts.length - 3).join('|').trim();

    if (!patternStr || !model || !priority) return null;
    if (patternStr.toLowerCase() === 'pattern' || model.toLowerCase() === 'model') return null;

    const patterns = patternStr.split(',').map(p => p.trim().replace(/\*\*/g, ''));
    const validPatterns = patterns.filter(p => p && p.trim().length > 0);

    if (validPatterns.length === 0) return null;

    const patternRegex = validPatterns.map(p => {
      // Protect existing .* sequences before escaping, then restore
      const protected_ = p.replace(/\.\*/g, '\x00');
      const escaped = protected_.replace(/\./g, '\\.');
      return escaped.replace(/\x00/g, '.*').replace(/(?<!\.)\*/g, '.*');
    }).join('|');

    return {
      patterns: validPatterns,
      regex: patternRegex,
      model: model.toLowerCase(),
      priority: parseInt(priority) || 1,
      rationale: rationale || ''
    };
  }).filter(Boolean);
}

function mergeRoutingRules(globalRules, projectRules) {
  const merged = [...globalRules];

  for (const projectRule of projectRules) {
    const existingIdx = merged.findIndex(r =>
      r.patterns.some(p => projectRule.patterns.includes(p))
    );

    if (existingIdx >= 0) {
      merged[existingIdx] = projectRule;
    } else {
      merged.push(projectRule);
    }
  }

  return merged;
}

function computeComplexityScore(taskDesc, rules) {
  // Signal 1 — Keyword model weight (0-50 points)
  const lowerTask = taskDesc.toLowerCase();
  let keywordScore = 0;
  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.regex, 'i');
      if (regex.test(lowerTask)) {
        const model = rule.model.toLowerCase();
        if (model === 'haiku') {
          keywordScore = Math.min(keywordScore + 5, 15);
        } else if (model === 'sonnet') {
          keywordScore = Math.min(keywordScore + 15, 30);
        } else if (model === 'opus') {
          keywordScore = Math.min(keywordScore + 30, 50);
        }
      }
    } catch (e) {
      // Skip invalid regex patterns
    }
  }
  if (keywordScore === 0) keywordScore = 25; // default: no pattern match → sonnet territory

  // Signal 2 — Task length (0-25 points)
  const wordCount = taskDesc.trim().split(/\s+/).filter(Boolean).length;
  let lengthScore;
  if (wordCount <= 5) {
    lengthScore = 3;
  } else if (wordCount <= 20) {
    lengthScore = 8;
  } else if (wordCount <= 50) {
    lengthScore = 15;
  } else if (wordCount <= 100) {
    lengthScore = 20;
  } else {
    lengthScore = 25;
  }

  // Signal 3 — Structural markers (0-25 points)
  let structuralScore = 0;
  // Code block markers
  if (/```|`[^`]+`/.test(taskDesc)) structuralScore += 8;
  // Multiple bullet points (3+)
  const bulletMatches = taskDesc.match(/^[ \t]*[-*•]/gm) || [];
  if (bulletMatches.length >= 3) structuralScore += 5;
  // Nested indicators
  if (/^[ \t]{2,}[-*•]/m.test(taskDesc) || /^[ \t]+\d+\./m.test(taskDesc)) structuralScore += 5;
  // Multiple numbered steps (3+)
  const numberedSteps = taskDesc.match(/^\s*\d+\./gm) || [];
  if (numberedSteps.length >= 3) structuralScore += 5;
  // Architectural keywords
  if (/\b(design|architecture|system|integrate|migration|migrate|refactor|evaluate)\b/i.test(taskDesc)) structuralScore += 8;
  // Cross-cutting concerns
  if (/\b(security|performance|scalability|all|entire|across)\b/i.test(taskDesc)) structuralScore += 6;
  // Negation/constraints
  if (/\b(must not|never|always|required|must)\b/i.test(taskDesc)) structuralScore += 3;
  structuralScore = Math.min(structuralScore, 25);

  const score = Math.min(keywordScore + lengthScore + structuralScore, 100);

  let tier;
  if (score <= 30) {
    tier = 'haiku';
  } else if (score <= 70) {
    tier = 'sonnet';
  } else {
    tier = 'opus';
  }

  return {
    score,
    tier,
    signals: {
      keyword: keywordScore,
      length: lengthScore,
      structural: structuralScore
    }
  };
}

function selectModelFromRules(taskDesc, rules) {
  const lowerTask = taskDesc.toLowerCase();

  // Compute multi-signal complexity score
  const { score, tier, signals } = computeComplexityScore(taskDesc, rules);

  // Track highest-priority matching rule for pattern/rationale
  let matchedRule = null;
  let highestPriority = -1;
  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.regex, 'i');
      if (regex.test(lowerTask)) {
        if (rule.priority > highestPriority) {
          highestPriority = rule.priority;
          matchedRule = rule;
        }
      }
    } catch (e) {
      // Skip invalid regex patterns
    }
  }

  const reasonBase = `complexity score ${score}/100 (keyword:${signals.keyword}, length:${signals.length}, structural:${signals.structural})`;
  const noMatch = matchedRule === null;

  return {
    model: tier,
    reason: noMatch ? `default (no pattern match) — score ${score}/100` : reasonBase,
    matched: !noMatch,
    pattern: matchedRule ? matchedRule.patterns.join(',') : null,
    score,
    signals
  };
}

function cmdRoutingMatch(cwd, taskDesc, raw) {
  if (!taskDesc) { error('task description required'); return; }

  const HOME = require('os').homedir();
  const globalRules = loadRoutingRules(path.join(HOME, '.claude', 'routing-rules.md'));
  const projectRules = loadRoutingRules(path.join(cwd, '.planning', 'routing', 'project-rules.md'));
  const merged = mergeRoutingRules(globalRules, projectRules);
  const result = selectModelFromRules(taskDesc, merged);

  output(result, raw);
}

function selectModelFromRulesWithQuota(taskDesc, rules, quotaState) {
  // Get base selection using complexity scoring (from plan 07)
  const baseSelection = selectModelFromRules(taskDesc, rules);

  if (!quotaState || !quotaState.session) {
    return baseSelection;  // No quota state — pass through unchanged
  }

  const sessionLimit = quotaState.session.tokens_limit || 0;
  if (sessionLimit === 0) {
    return baseSelection;  // Unknown limit — pass through
  }

  const sessionUsed = quotaState.session.tokens_used || 0;
  const quotaPercent = (sessionUsed / sessionLimit) * 100;

  // Apply downgrade ladder based on quota pressure
  // Per user decision: quota logic in sub-coordinator, but the routing function
  // must support quota-aware selection so coordinators can call it
  if (quotaPercent > 95) {
    // Critical: downgrade any model to haiku to conserve what remains
    if (baseSelection.model === 'opus' || baseSelection.model === 'sonnet') {
      return {
        ...baseSelection,
        model: 'haiku',
        reason: `quota-adjusted (${quotaPercent.toFixed(1)}% used, >95% threshold): conserving to haiku — original: ${baseSelection.model}`,
        quota_adjusted: true,
        quota_percent: quotaPercent
      };
    }
  } else if (quotaPercent > 80) {
    // High pressure: downgrade opus to sonnet only
    if (baseSelection.model === 'opus') {
      return {
        ...baseSelection,
        model: 'sonnet',
        reason: `quota-adjusted (${quotaPercent.toFixed(1)}% used, >80% threshold): downgraded opus→sonnet — original reason: ${baseSelection.reason}`,
        quota_adjusted: true,
        quota_percent: quotaPercent
      };
    }
  }

  // No adjustment needed
  return {
    ...baseSelection,
    quota_adjusted: false,
    quota_percent: quotaPercent
  };
}

function cmdRoutingMatchWithQuota(cwd, taskDesc, raw) {
  if (!taskDesc) { error('task description required'); return; }

  const HOME = require('os').homedir();
  const globalRules = loadRoutingRules(path.join(HOME, '.claude', 'routing-rules.md'));
  const projectRules = loadRoutingRules(path.join(cwd, '.planning', 'routing', 'project-rules.md'));
  const merged = mergeRoutingRules(globalRules, projectRules);

  const quotaState = loadQuotaState(cwd);
  const result = selectModelFromRulesWithQuota(taskDesc, merged, quotaState);

  output(result, raw);
}

function extractKeywords(text) {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'should', 'could', 'can', 'may', 'might', 'must', 'this', 'that',
    'these', 'those', 'it', 'its', 'i', 'we', 'they', 'them', 'their'
  ]);

  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

function buildContextIndex(basePaths, includeSummaries = false) {
  const index = { entries: [], created_at: new Date().toISOString() };

  let extractor = null;
  if (includeSummaries) {
    try {
      const { HeaderExtractor } = require('./compression/header-extractor');
      extractor = new HeaderExtractor();
    } catch (e) { /* compression optional */ }
  }

  for (const basePath of basePaths) {
    if (!fs.existsSync(basePath)) continue;

    const findMd = (dir) => {
      const files = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...findMd(fullPath));
        } else if (entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
      return files;
    };

    for (const file of findMd(basePath)) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        let tags = [];
        if (frontmatterMatch) {
          const tagMatch = frontmatterMatch[1].match(/tags:\s*\[([^\]]*)\]/);
          if (tagMatch) {
            tags = tagMatch[1].split(',').map(t => t.trim().replace(/['"]/g, ''));
          }
        }

        const titleMatch = content.match(/^#\s+(.+)/m);
        const title = titleMatch ? titleMatch[1].trim() : path.basename(file, '.md');

        const bodyText = content.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/^#+\s+.+$/mg, '');
        const keywords = extractKeywords(bodyText);

        let summary = null;
        if (includeSummaries && extractor) {
          try {
            const result = extractor.extractSummary(content, file);
            summary = result.summary;
          } catch (e) { /* skip */ }
        }

        index.entries.push({
          path: file,
          title,
          tags,
          keywords: [...new Set(keywords)].slice(0, 50),
          ...(summary !== null && { summary })
        });
      } catch (e) { /* skip unreadable files */ }
    }
  }

  return index;
}

function matchContextDocs(taskDesc, index, topN = 3) {
  const taskKeywords = new Set(extractKeywords(taskDesc));
  const taskWords = taskDesc.toLowerCase().split(/\s+/);

  const scored = index.entries.map(entry => {
    let score = 0;

    // Tag matches (2x weight)
    for (const tag of entry.tags) {
      if (taskWords.some(w => tag.toLowerCase().includes(w) || w.includes(tag.toLowerCase()))) {
        score += 2;
      }
    }

    // Keyword matches (1x weight)
    for (const kw of entry.keywords) {
      if (taskKeywords.has(kw)) score += 1;
    }

    // Title word matches (1.5x weight)
    const titleWords = extractKeywords(entry.title);
    for (const tw of titleWords) {
      if (taskKeywords.has(tw)) score += 1.5;
    }

    return { ...entry, score };
  });

  return scored
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

function extractClaudeInstructions(claudeMdPath) {
  const content = safeReadFile(claudeMdPath);
  if (!content) return { keywords: [], instructions: [] };

  const keywords = extractKeywords(content);
  const instructions = content
    .split('\n')
    .filter(l => l.match(/^[-*]\s+/) || l.match(/^\d+\.\s+/))
    .map(l => l.replace(/^[-*\d.]+\s+/, '').trim())
    .filter(l => l.length > 10);

  return { keywords: [...new Set(keywords)], instructions };
}

function loadContextIndex(cwd) {
  const HOME = require('os').homedir();
  const cachePath = path.join(cwd, '.planning', '.context-index-cache.json');

  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    const ageMs = Date.now() - stat.mtime.getTime();
    if (ageMs < 3600000) { // 1 hour TTL
      return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    }
  }

  // Rebuild and cache
  const basePaths = [
    path.join(HOME, '.claude', 'guides'),
    path.join(HOME, '.claude', 'get-shit-done', 'references'),
    path.join(cwd, '.planning', 'codebase'),
    path.join(cwd, 'docs')
  ];
  const index = buildContextIndex(basePaths);

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(index, null, 2));

  return index;
}

function cmdRoutingContext(cwd, taskDesc, raw) {
  if (!taskDesc) { error('task description required'); return; }

  const index = loadContextIndex(cwd);
  const matches = matchContextDocs(taskDesc, index, 3);

  output({ task: taskDesc, matches, index_size: index.entries.length }, raw);
}

function cmdRoutingFull(cwd, taskDesc, raw) {
  if (!taskDesc) { error('task description required'); return; }

  const HOME = require('os').homedir();

  const globalRules = loadRoutingRules(path.join(HOME, '.claude', 'routing-rules.md'));
  const projectRules = loadRoutingRules(path.join(cwd, '.planning', 'routing', 'project-rules.md'));
  const merged = mergeRoutingRules(globalRules, projectRules);
  const modelResult = selectModelFromRules(taskDesc, merged);

  const index = loadContextIndex(cwd);
  const contextMatches = matchContextDocs(taskDesc, index, 3);

  let contextWithSummaries = contextMatches;
  try {
    const { HeaderExtractor } = require('./compression/header-extractor');
    const extractor = new HeaderExtractor();
    contextWithSummaries = contextMatches.map(match => {
      try {
        const content = fs.readFileSync(match.path, 'utf-8');
        const { summary } = extractor.extractSummary(content, match.path);
        return { ...match, summary };
      } catch (e) {
        return { ...match, summary: null };
      }
    });
  } catch (e) { /* compression optional */ }

  // Extract CLAUDE.md keywords
  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  let claudeMd = { has_instructions: false, relevant_keywords: [] };
  const claudeInstructions = extractClaudeInstructions(claudeMdPath);
  if (claudeInstructions.instructions.length > 0 || claudeInstructions.keywords.length > 0) {
    const taskKws = new Set(extractKeywords(taskDesc));
    const relevant = claudeInstructions.keywords.filter(k => taskKws.has(k));
    claudeMd = {
      has_instructions: claudeInstructions.instructions.length > 0,
      relevant_keywords: relevant.slice(0, 10)
    };
  }

  output({ task: taskDesc, model: modelResult, context: contextWithSummaries, claude_md: claudeMd }, raw);
}

function cmdRoutingIndexBuild(cwd, args, raw) {
  const HOME = require('os').homedir();
  const cachePath = path.join(cwd, '.planning', '.context-index-cache.json');
  const withSummaries = args.includes('--with-summaries');
  const force = args.includes('--force');

  if (!force && fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath);
    const ageMs = Date.now() - stat.mtime.getTime();
    if (ageMs < 3600000) {
      output({ cached: true, age_minutes: Math.floor(ageMs / 60000) }, raw);
      return;
    }
  }

  const basePaths = [
    path.join(HOME, '.claude', 'guides'),
    path.join(HOME, '.claude', 'get-shit-done', 'references'),
    path.join(cwd, '.planning', 'codebase'),
    path.join(cwd, 'docs')
  ];
  const index = buildContextIndex(basePaths, withSummaries);

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(index, null, 2));

  output({ cached: false, entries: index.entries.length, with_summaries: withSummaries }, raw);
}

function cmdRoutingIndexRefresh(cwd, raw) {
  const cachePath = path.join(cwd, '.planning', '.context-index-cache.json');

  if (!fs.existsSync(cachePath)) {
    output({ stale: true, reason: 'Cache does not exist', entries: 0 }, raw);
    return;
  }

  const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  const stale = cached.entries.some(entry => {
    if (!fs.existsSync(entry.path)) return true;
    const stat = fs.statSync(entry.path);
    const cacheTime = new Date(cached.created_at).getTime();
    const mtime = stat.mtime.getTime();
    return mtime > cacheTime;
  });

  output({ stale, entries: cached.entries.length }, raw);
}

/**
 * mine-conversations [--max-age-days N] [--include-subagents] [--limit N] [--all-projects]
 *
 * Discovers Claude Code project JSONL conversation files, converts entries to
 * session-like format, applies quality gates, checks re-analysis prevention
 * via conversation-specific analysis log, and returns extraction requests
 * ready for the calling GSD workflow to pass to Task().
 *
 * --all-projects: scan all ~/.claude/projects/ slug directories instead of current CWD only.
 */
async function cmdMineConversations(cwd, args, raw) {
  const maxAgeDays = args.includes('--max-age-days')
    ? parseInt(args[args.indexOf('--max-age-days') + 1])
    : 30;
  const includeSubagents = args.includes('--include-subagents');
  const limit = args.includes('--limit')
    ? parseInt(args[args.indexOf('--limit') + 1])
    : 0;
  const allProjects = args.includes('--all-projects');

  // Lazy-require conversation-miner.js
  let conversationMiner;
  try {
    conversationMiner = require(path.join(__dirname, 'conversation-miner.js'));
  } catch (err) {
    output({ status: 'error', reason: 'Failed to load conversation-miner.js: ' + err.message }, raw);
    return;
  }

  if (allProjects) {
    // --all-projects: scan all project slug dirs under ~/.claude/projects/
    const { projects, totalFiles, skippedNonGSD } = conversationMiner.discoverAllProjectConversations(
      { maxAgeDays, includeSubagents }
    );

    const extractionSessions = [];
    const skipped = [];

    for (const project of projects) {
      const projectFiles = limit > 0 ? project.files.slice(0, limit) : project.files;

      for (const fileInfo of projectFiles) {
        const prepared = conversationMiner.prepareConversationForMining(fileInfo.path, fileInfo.sessionId);

        if (!prepared.shouldMine) {
          skipped.push({ sessionId: fileInfo.sessionId, projectSlug: project.projectSlug, reason: prepared.reason });
        } else {
          extractionSessions.push({
            sessionId: fileInfo.sessionId,
            sessionPath: fileInfo.path,
            projectSlug: project.projectSlug,
            mtime: fileInfo.mtime,
            chunkCount: prepared.chunkCount,
            contentHash: prepared.contentHash,
            extractionRequests: prepared.extractionRequests
          });
        }
      }
    }

    output({
      status: 'ready',
      allProjects: true,
      projectsScanned: projects.length,
      skippedNonGSD,
      filesFound: totalFiles,
      sessionsReady: extractionSessions.length,
      sessionsSkipped: skipped.length,
      sessions: extractionSessions,
      skipped
    }, raw);
    return;
  }

  // Single project mode (current CWD)
  const { files, projectSlugDir, error: discoverError } = conversationMiner.discoverProjectConversations(
    cwd,
    { maxAgeDays, includeSubagents }
  );

  if (discoverError) {
    output({ status: 'error', reason: discoverError, projectSlugDir }, raw);
    return;
  }

  // Apply limit
  const targetFiles = limit > 0 ? files.slice(0, limit) : files;

  const extractionSessions = [];
  const skipped = [];

  for (const fileInfo of targetFiles) {
    const prepared = conversationMiner.prepareConversationForMining(fileInfo.path, fileInfo.sessionId);

    if (!prepared.shouldMine) {
      skipped.push({ sessionId: fileInfo.sessionId, reason: prepared.reason });
    } else {
      extractionSessions.push({
        sessionId: fileInfo.sessionId,
        sessionPath: fileInfo.path,
        mtime: fileInfo.mtime,
        chunkCount: prepared.chunkCount,
        contentHash: prepared.contentHash,
        extractionRequests: prepared.extractionRequests
      });
    }
  }

  output({
    status: 'ready',
    filesFound: files.length,
    filesTargeted: targetFiles.length,
    sessionsReady: extractionSessions.length,
    sessionsSkipped: skipped.length,
    sessions: extractionSessions,
    skipped
  }, raw);
}

/**
 * store-conversation-result <session-id> <results-json> [--content-hash <hash>]
 *
 * Accepts Haiku extraction results from conversation mining and persists them
 * to the knowledge DB. Marks the conversation as analyzed in the
 * conversation-specific analysis log (.planning/knowledge/.conversation-analysis-log.jsonl)
 * — completely separate from the Telegram session analysis log.
 */
async function cmdStoreConversationResult(cwd, args, raw) {
  // Strip --content-hash flag before extracting sessionId and resultsArg
  const contentHashIdx = args.indexOf('--content-hash');
  const contentHash = contentHashIdx !== -1 ? args[contentHashIdx + 1] : 'unknown';
  // Build filtered args without --content-hash and its value (only filter when flag present)
  const filteredArgs = contentHashIdx !== -1
    ? args.filter((_, i) => i !== contentHashIdx && i !== contentHashIdx + 1)
    : args;

  const sessionId = filteredArgs[0];
  const resultsArg = filteredArgs.slice(1).join(' ');

  if (!sessionId) {
    output({ status: 'error', reason: 'Usage: store-conversation-result <session-id> <results-json> [--content-hash <hash>]' }, raw);
    return;
  }

  if (!resultsArg) {
    output({ stored: 0, skipped: 0, evolved: 0, errors: ['No results JSON provided'] }, raw);
    return;
  }

  // Parse the results JSON (may be a JSON string or path to JSON file)
  let results = [];
  try {
    results = JSON.parse(resultsArg);
  } catch {
    const resolvedPath = path.isAbsolute(resultsArg)
      ? resultsArg
      : path.join(cwd, resultsArg);
    try {
      const fileContent = fs.readFileSync(resolvedPath, 'utf8');
      results = JSON.parse(fileContent);
    } catch (err) {
      output({ stored: 0, skipped: 0, evolved: 0, errors: ['Failed to parse results JSON: ' + err.message] }, raw);
      return;
    }
  }

  // Handle empty results
  if (!Array.isArray(results) || results.length === 0) {
    output({ stored: 0, skipped: 0, evolved: 0, errors: [] }, raw);
    return;
  }

  // Lazy-require session-analyzer.js
  let parseExtractionResult;
  try {
    const analyzer = require(path.join(__dirname, 'session-analyzer.js'));
    parseExtractionResult = analyzer.parseExtractionResult;
  } catch (err) {
    output({ stored: 0, skipped: 0, evolved: 0, errors: ['Failed to load session-analyzer.js: ' + err.message] }, raw);
    return;
  }

  // Lazy-require knowledge-writer.js
  let storeInsights;
  try {
    const writer = require(path.join(__dirname, 'knowledge-writer.js'));
    storeInsights = writer.storeInsights;
  } catch (err) {
    output({ stored: 0, skipped: 0, evolved: 0, errors: ['Failed to load knowledge-writer.js: ' + err.message] }, raw);
    return;
  }

  // Collect all insights from all result objects
  const allInsights = [];
  const parseErrors = [];

  for (const resultObj of results) {
    if (!resultObj || typeof resultObj.type !== 'string' || typeof resultObj.result !== 'string') {
      parseErrors.push('Invalid result object (missing type or result field)');
      continue;
    }

    const { insights, errors } = parseExtractionResult(resultObj.type, resultObj.result);
    allInsights.push(...insights);
    parseErrors.push(...errors);
  }

  // Store all insights in knowledge DB (pass conversationId for context tracking)
  const { resolveProjectSlug: resolveProjectSlugConv } = require(path.join(__dirname, 'knowledge-writer.js'));
  let storeResult = { stored: 0, skipped: 0, evolved: 0, errors: [] };
  if (allInsights.length > 0) {
    try {
      storeResult = await storeInsights(allInsights, {
        sessionId,
        conversationId: sessionId,
        scope: 'global',
        projectSlug: resolveProjectSlugConv(cwd)
      });
    } catch (err) {
      storeResult.errors.push('storeInsights failed: ' + err.message);
    }
  }

  // Mark conversation as analyzed in the conversation-specific analysis log
  const totalInsights = storeResult.stored + storeResult.evolved;
  const conversationLogPath = path.join(require('os').homedir(), '.claude', 'knowledge', '.conversation-analysis-log.jsonl');
  try {
    // Ensure parent directory exists
    const logDir = path.dirname(conversationLogPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logEntry = JSON.stringify({
      session_id: sessionId,
      content_hash: contentHash,
      analyzed_at: new Date().toISOString(),
      insight_count: totalInsights,
      version: 1
    }) + '\n';
    fs.appendFileSync(conversationLogPath, logEntry, 'utf8');
  } catch (err) {
    storeResult.errors.push('Failed to write conversation analysis log: ' + err.message);
  }

  output({
    stored: storeResult.stored,
    skipped: storeResult.skipped,
    evolved: storeResult.evolved,
    errors: [...parseErrors, ...storeResult.errors]
  }, raw);
}

// ─── Knowledge Migration ──────────────────────────────────────────────────────

/**
 * migrate-knowledge
 *
 * Scans ~/.claude/projects/ for all project directories, finds any per-project
 * .planning/knowledge/<user>.db files, copies all entries to the global DB,
 * and reports results. Does NOT delete old DBs.
 */
async function cmdMigrateKnowledge(cwd, args, raw) {
  const os = require('os');
  const homedir = os.homedir();
  const username = os.userInfo().username;

  // Load better-sqlite3 directly (knowledge-db.js is not used for legacy path)
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (err) {
    output({ status: 'error', reason: 'better-sqlite3 not installed: ' + err.message }, raw);
    return;
  }

  // Open the global DB via knowledge-db.js
  let knowledgeDb;
  try {
    knowledgeDb = require(path.join(__dirname, 'knowledge-db.js'));
  } catch (err) {
    output({ status: 'error', reason: 'Failed to load knowledge-db.js: ' + err.message }, raw);
    return;
  }

  let globalConn;
  try {
    globalConn = knowledgeDb.openKnowledgeDB('global');
  } catch (err) {
    output({ status: 'error', reason: 'Failed to open global knowledge DB: ' + err.message }, raw);
    return;
  }

  const globalDB = globalConn.db;

  // Scan ~/.claude/projects/ for slug directories
  const projectsDir = path.join(homedir, '.claude', 'projects');
  let slugDirs = [];
  try {
    slugDirs = fs.readdirSync(projectsDir).filter(entry => {
      return fs.statSync(path.join(projectsDir, entry)).isDirectory();
    });
  } catch (err) {
    // ~/.claude/projects/ may not exist — that's fine
    output({
      status: 'ok',
      migrated: 0,
      projects: [],
      total_entries: 0,
      message: 'No projects directory found at ' + projectsDir
    }, raw);
    return;
  }

  const results = [];
  let totalMigrated = 0;

  for (const slug of slugDirs) {
    // Reverse slug to filesystem path: leading - means leading /, all - are /
    const reversed = slug.replace(/-/g, '/');
    const projectPath = reversed; // Already starts with /

    const legacyDbPath = path.join(projectPath, '.planning', 'knowledge', `${username}.db`);

    // Check if legacy DB exists
    if (!fs.existsSync(legacyDbPath)) {
      continue;
    }

    // Open the legacy DB directly
    let legacyDB;
    try {
      legacyDB = new Database(legacyDbPath, { readonly: true });
    } catch (err) {
      results.push({ project: projectPath, status: 'error', reason: 'Failed to open legacy DB: ' + err.message });
      continue;
    }

    let rows = [];
    try {
      // Check if knowledge table exists in legacy DB
      const tableExists = legacyDB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge'"
      ).get();

      if (!tableExists) {
        legacyDB.close();
        results.push({ project: projectPath, status: 'skipped', reason: 'No knowledge table in legacy DB' });
        continue;
      }

      rows = legacyDB.prepare('SELECT * FROM knowledge').all();
    } catch (err) {
      legacyDB.close();
      results.push({ project: projectPath, status: 'error', reason: 'Failed to read legacy DB: ' + err.message });
      continue;
    }

    legacyDB.close();

    if (rows.length === 0) {
      results.push({ project: projectPath, status: 'ok', migrated: 0 });
      continue;
    }

    // Get the column list from the global DB (may have project_slug, legacy won't)
    const globalColumns = globalDB.prepare("PRAGMA table_info(knowledge)").all().map(c => c.name);
    // Determine which columns exist in the legacy rows
    const legacyColumns = Object.keys(rows[0]);
    // Only copy columns that exist in both
    const sharedColumns = legacyColumns.filter(c => globalColumns.includes(c));

    // Prepare the insert statement
    const placeholders = sharedColumns.map(() => '?').join(', ');
    const columnList = sharedColumns.join(', ');
    const insertStmt = globalDB.prepare(
      `INSERT OR IGNORE INTO knowledge (${columnList}) VALUES (${placeholders})`
    );

    // Use transaction for bulk insert
    let copiedCount = 0;
    try {
      const insertMany = globalDB.transaction((rows) => {
        for (const row of rows) {
          const values = sharedColumns.map(c => row[c]);
          insertStmt.run(values);
          copiedCount++;
        }
      });
      insertMany(rows);
    } catch (err) {
      results.push({ project: projectPath, status: 'error', reason: 'Transaction failed: ' + err.message, migrated: copiedCount });
      continue;
    }

    // Verify: global DB count >= rows copied from this source
    const globalCount = globalDB.prepare('SELECT COUNT(*) as cnt FROM knowledge').get().cnt;
    if (globalCount < copiedCount) {
      results.push({
        project: projectPath,
        status: 'warning',
        reason: `Global count (${globalCount}) less than copied (${copiedCount}) — possible duplicates filtered`,
        migrated: copiedCount
      });
    } else {
      results.push({ project: projectPath, status: 'ok', migrated: copiedCount });
    }

    totalMigrated += copiedCount;
  }

  output({
    status: 'ok',
    migrated: totalMigrated,
    projects: results,
    total_entries: totalMigrated,
    note: 'Old per-project DBs were NOT deleted. Remove .planning/knowledge/ manually when satisfied.'
  }, raw);
}

// ─── Knowledge Query ─────────────────────────────────────────────────────────

/**
 * query-knowledge <question> [--project <slug>]
 *
 * Search the global knowledge DB for relevant past decisions, lessons, and summaries.
 * Returns top 5 results in the locked output schema for agent-readable consumption.
 *
 * Output schema per result:
 *   { question, answer, confidence, project_slug, source_type, created_at }
 *
 * Zero results: { results: [], no_results: true, query: "..." }
 */
async function cmdQueryKnowledge(cwd, args, raw) {
  // Parse --project flag
  const projectFlagIdx = args.indexOf('--project');
  const projectSlug = projectFlagIdx !== -1 ? args[projectFlagIdx + 1] : null;

  // Build the question string from remaining args (excluding --project and its value)
  const filteredArgs = args.filter((_, i) => {
    if (projectFlagIdx === -1) return true;
    return i !== projectFlagIdx && i !== projectFlagIdx + 1;
  });

  const questionString = filteredArgs.join(' ').trim();

  if (!questionString) {
    output({ status: 'error', reason: 'Usage: query-knowledge <question> [--project <slug>]' }, raw);
    return;
  }

  // Lazy-require knowledge-db.js
  let knowledgeDb;
  try {
    knowledgeDb = require(path.join(__dirname, 'knowledge-db.js'));
  } catch (err) {
    output({ results: [], no_results: true, query: questionString, error: 'Failed to load knowledge-db.js: ' + err.message }, raw);
    return;
  }

  // Open the global knowledge DB
  let conn;
  try {
    conn = knowledgeDb.openKnowledgeDB('global');
  } catch (err) {
    // DB may not exist yet (no knowledge stored)
    output({ results: [], no_results: true, query: questionString, note: 'Global knowledge DB not found or could not be opened: ' + err.message }, raw);
    return;
  }

  // Lazy-require knowledge-search.js
  let searchKnowledge;
  try {
    searchKnowledge = require(path.join(__dirname, 'knowledge-search.js')).searchKnowledge;
  } catch (err) {
    output({ results: [], no_results: true, query: questionString, error: 'Failed to load knowledge-search.js: ' + err.message }, raw);
    return;
  }

  // Execute search — top 5 results, no confidence threshold filtering
  let rawResults = [];
  try {
    rawResults = searchKnowledge(conn, questionString, {
      limit: 5,
      project_slug: projectSlug || null
    });
  } catch (err) {
    output({ results: [], no_results: true, query: questionString, error: 'Search failed: ' + err.message }, raw);
    return;
  }

  if (!rawResults || rawResults.length === 0) {
    output({ results: [], no_results: true, query: questionString }, raw);
    return;
  }

  // Map to locked output schema
  const results = rawResults.map(r => ({
    question: questionString,
    answer: r.content,
    confidence: (r.metadata && r.metadata.confidence) ? r.metadata.confidence : 'medium',
    project_slug: r.project_slug || null,
    source_type: r.type,
    created_at: r.created_at
  }));

  output({ results, query: questionString }, raw);
}

// ─── CLI Router ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const rawIndex = args.indexOf('--raw');
  const raw = rawIndex !== -1;
  if (rawIndex !== -1) args.splice(rawIndex, 1);

  const command = args[0];
  const cwd = process.cwd();

  if (!command) {
    error('Usage: gsd-tools <command> [args] [--raw]\nCommands: state, resolve-model, find-phase, commit, verify-summary, verify, frontmatter, template, generate-slug, current-timestamp, list-todos, verify-path-exists, config-ensure-section, observability, health, init');
  }

  switch (command) {
    case 'state': {
      const subcommand = args[1];
      if (subcommand === 'update') {
        cmdStateUpdate(cwd, args[2], args[3]);
      } else if (subcommand === 'get') {
        cmdStateGet(cwd, args[2], raw);
      } else if (subcommand === 'patch') {
        const patches = {};
        for (let i = 2; i < args.length; i += 2) {
          const key = args[i].replace(/^--/, '');
          const value = args[i + 1];
          if (key && value !== undefined) {
            patches[key] = value;
          }
        }
        cmdStatePatch(cwd, patches, raw);
      } else if (subcommand === 'advance-plan') {
        cmdStateAdvancePlan(cwd, raw);
      } else if (subcommand === 'record-metric') {
        const phaseIdx = args.indexOf('--phase');
        const planIdx = args.indexOf('--plan');
        const durationIdx = args.indexOf('--duration');
        const tasksIdx = args.indexOf('--tasks');
        const filesIdx = args.indexOf('--files');
        cmdStateRecordMetric(cwd, {
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          plan: planIdx !== -1 ? args[planIdx + 1] : null,
          duration: durationIdx !== -1 ? args[durationIdx + 1] : null,
          tasks: tasksIdx !== -1 ? args[tasksIdx + 1] : null,
          files: filesIdx !== -1 ? args[filesIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'update-progress') {
        cmdStateUpdateProgress(cwd, raw);
      } else if (subcommand === 'add-decision') {
        const phaseIdx = args.indexOf('--phase');
        const summaryIdx = args.indexOf('--summary');
        const rationaleIdx = args.indexOf('--rationale');
        cmdStateAddDecision(cwd, {
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          summary: summaryIdx !== -1 ? args[summaryIdx + 1] : null,
          rationale: rationaleIdx !== -1 ? args[rationaleIdx + 1] : '',
        }, raw);
      } else if (subcommand === 'add-blocker') {
        const textIdx = args.indexOf('--text');
        cmdStateAddBlocker(cwd, textIdx !== -1 ? args[textIdx + 1] : null, raw);
      } else if (subcommand === 'resolve-blocker') {
        const textIdx = args.indexOf('--text');
        cmdStateResolveBlocker(cwd, textIdx !== -1 ? args[textIdx + 1] : null, raw);
      } else if (subcommand === 'record-session') {
        const stoppedIdx = args.indexOf('--stopped-at');
        const resumeIdx = args.indexOf('--resume-file');
        cmdStateRecordSession(cwd, {
          stopped_at: stoppedIdx !== -1 ? args[stoppedIdx + 1] : null,
          resume_file: resumeIdx !== -1 ? args[resumeIdx + 1] : 'None',
        }, raw);
      } else {
        cmdStateLoad(cwd, raw);
      }
      break;
    }

    case 'resolve-model': {
      cmdResolveModel(cwd, args[1], raw);
      break;
    }

    case 'find-phase': {
      cmdFindPhase(cwd, args[1], raw);
      break;
    }

    case 'commit': {
      const amend = args.includes('--amend');
      const message = args[1];
      // Parse --files flag (collect args after --files, stopping at other flags)
      const filesIndex = args.indexOf('--files');
      const files = filesIndex !== -1 ? args.slice(filesIndex + 1).filter(a => !a.startsWith('--')) : [];
      cmdCommit(cwd, message, files, raw, amend);
      break;
    }

    case 'verify-summary': {
      const summaryPath = args[1];
      const countIndex = args.indexOf('--check-count');
      const checkCount = countIndex !== -1 ? parseInt(args[countIndex + 1], 10) : 2;
      cmdVerifySummary(cwd, summaryPath, checkCount, raw);
      break;
    }

    case 'template': {
      const subcommand = args[1];
      if (subcommand === 'select') {
        cmdTemplateSelect(cwd, args[2], raw);
      } else if (subcommand === 'fill') {
        const templateType = args[2];
        const phaseIdx = args.indexOf('--phase');
        const planIdx = args.indexOf('--plan');
        const nameIdx = args.indexOf('--name');
        const typeIdx = args.indexOf('--type');
        const waveIdx = args.indexOf('--wave');
        const fieldsIdx = args.indexOf('--fields');
        cmdTemplateFill(cwd, templateType, {
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          plan: planIdx !== -1 ? args[planIdx + 1] : null,
          name: nameIdx !== -1 ? args[nameIdx + 1] : null,
          type: typeIdx !== -1 ? args[typeIdx + 1] : 'execute',
          wave: waveIdx !== -1 ? args[waveIdx + 1] : '1',
          fields: fieldsIdx !== -1 ? JSON.parse(args[fieldsIdx + 1]) : {},
        }, raw);
      } else {
        error('Unknown template subcommand. Available: select, fill');
      }
      break;
    }

    case 'frontmatter': {
      const subcommand = args[1];
      const file = args[2];
      if (subcommand === 'get') {
        const fieldIdx = args.indexOf('--field');
        cmdFrontmatterGet(cwd, file, fieldIdx !== -1 ? args[fieldIdx + 1] : null, raw);
      } else if (subcommand === 'set') {
        const fieldIdx = args.indexOf('--field');
        const valueIdx = args.indexOf('--value');
        cmdFrontmatterSet(cwd, file, fieldIdx !== -1 ? args[fieldIdx + 1] : null, valueIdx !== -1 ? args[valueIdx + 1] : undefined, raw);
      } else if (subcommand === 'merge') {
        const dataIdx = args.indexOf('--data');
        cmdFrontmatterMerge(cwd, file, dataIdx !== -1 ? args[dataIdx + 1] : null, raw);
      } else if (subcommand === 'validate') {
        const schemaIdx = args.indexOf('--schema');
        cmdFrontmatterValidate(cwd, file, schemaIdx !== -1 ? args[schemaIdx + 1] : null, raw);
      } else {
        error('Unknown frontmatter subcommand. Available: get, set, merge, validate');
      }
      break;
    }

    case 'verify': {
      const subcommand = args[1];
      if (subcommand === 'plan-structure') {
        cmdVerifyPlanStructure(cwd, args[2], raw);
      } else if (subcommand === 'phase-completeness') {
        cmdVerifyPhaseCompleteness(cwd, args[2], raw);
      } else if (subcommand === 'references') {
        cmdVerifyReferences(cwd, args[2], raw);
      } else if (subcommand === 'commits') {
        cmdVerifyCommits(cwd, args.slice(2), raw);
      } else if (subcommand === 'artifacts') {
        cmdVerifyArtifacts(cwd, args[2], raw);
      } else if (subcommand === 'key-links') {
        cmdVerifyKeyLinks(cwd, args[2], raw);
      } else {
        error('Unknown verify subcommand. Available: plan-structure, phase-completeness, references, commits, artifacts, key-links');
      }
      break;
    }

    case 'generate-slug': {
      cmdGenerateSlug(args[1], raw);
      break;
    }

    case 'current-timestamp': {
      cmdCurrentTimestamp(args[1] || 'full', raw);
      break;
    }

    case 'list-todos': {
      cmdListTodos(cwd, args[1], raw);
      break;
    }

    case 'verify-path-exists': {
      cmdVerifyPathExists(cwd, args[1], raw);
      break;
    }

    case 'config-ensure-section': {
      cmdConfigEnsureSection(cwd, raw);
      break;
    }

    case 'config-set': {
      cmdConfigSet(cwd, args[1], args[2], raw);
      break;
    }

    case 'history-digest': {
      cmdHistoryDigest(cwd, raw);
      break;
    }

    case 'phases': {
      const subcommand = args[1];
      if (subcommand === 'list') {
        const typeIndex = args.indexOf('--type');
        const phaseIndex = args.indexOf('--phase');
        const options = {
          type: typeIndex !== -1 ? args[typeIndex + 1] : null,
          phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
        };
        cmdPhasesList(cwd, options, raw);
      } else {
        error('Unknown phases subcommand. Available: list');
      }
      break;
    }

    case 'roadmap': {
      const subcommand = args[1];
      if (subcommand === 'get-phase') {
        cmdRoadmapGetPhase(cwd, args[2], raw);
      } else if (subcommand === 'analyze') {
        cmdRoadmapAnalyze(cwd, raw);
      } else if (subcommand === 'parse') {
        cmdRoadmapParse(cwd, raw);
      } else if (subcommand === 'dag') {
        cmdRoadmapDAG(cwd, raw);
      } else if (subcommand === 'status') {
        cmdRoadmapStatus(cwd, args[2], raw);
      } else if (subcommand === 'validate') {
        cmdRoadmapValidate(cwd, raw);
      } else if (subcommand === 'update-plan-progress') {
        cmdRoadmapUpdatePlanProgress(cwd, args[2], raw);
      } else {
        error('Unknown roadmap subcommand. Available: get-phase, analyze, parse, dag, status, validate, update-plan-progress');
      }
      break;
    }

    case 'phase': {
      const subcommand = args[1];
      if (subcommand === 'next-decimal') {
        cmdPhaseNextDecimal(cwd, args[2], raw);
      } else if (subcommand === 'add') {
        cmdPhaseAdd(cwd, args.slice(2).join(' '), raw);
      } else if (subcommand === 'insert') {
        cmdPhaseInsert(cwd, args[2], args.slice(3).join(' '), raw);
      } else if (subcommand === 'remove') {
        const forceFlag = args.includes('--force');
        cmdPhaseRemove(cwd, args[2], { force: forceFlag }, raw);
      } else if (subcommand === 'complete') {
        cmdPhaseComplete(cwd, args[2], raw);
      } else if (subcommand === 'archive') {
        await cmdPhaseArchive(cwd, args[2], raw);
      } else if (subcommand === 'inject-context') {
        await cmdPhaseInjectContext(cwd, args[2], raw);
      } else if (subcommand === 'cleanup-checkpoints') {
        await cmdPhaseCleanupCheckpoints(cwd, args[2], raw);
      } else if (subcommand === 'size' || subcommand === 'limits' || subcommand === 'check' || subcommand === 'split-recommend') {
        await cmdPhaseSize(cwd, args.slice(1), raw);
      } else {
        error('Unknown phase subcommand. Available: next-decimal, add, insert, remove, complete, archive, inject-context, cleanup-checkpoints, size, limits, check, split-recommend');
      }
      break;
    }

    case 'milestone': {
      const subcommand = args[1];
      if (subcommand === 'complete') {
        const nameIndex = args.indexOf('--name');
        const milestoneName = nameIndex !== -1 ? args.slice(nameIndex + 1).join(' ') : null;
        cmdMilestoneComplete(cwd, args[2], { name: milestoneName }, raw);
      } else {
        error('Unknown milestone subcommand. Available: complete');
      }
      break;
    }

    case 'validate': {
      const subcommand = args[1];
      if (subcommand === 'consistency') {
        cmdValidateConsistency(cwd, raw);
      } else {
        error('Unknown validate subcommand. Available: consistency');
      }
      break;
    }

    case 'progress': {
      const subcommand = args[1] || 'json';
      cmdProgressRender(cwd, subcommand, raw);
      break;
    }

    case 'todo': {
      const subcommand = args[1];
      if (subcommand === 'complete') {
        cmdTodoComplete(cwd, args[2], raw);
      } else {
        error('Unknown todo subcommand. Available: complete');
      }
      break;
    }

    case 'scaffold': {
      const scaffoldType = args[1];
      const phaseIndex = args.indexOf('--phase');
      const nameIndex = args.indexOf('--name');
      const scaffoldOptions = {
        phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
        name: nameIndex !== -1 ? args.slice(nameIndex + 1).join(' ') : null,
      };
      cmdScaffold(cwd, scaffoldType, scaffoldOptions, raw);
      break;
    }

    case 'init': {
      const workflow = args[1];
      const includes = parseIncludeFlag(args);
      switch (workflow) {
        case 'execute-phase':
          cmdInitExecutePhase(cwd, args[2], includes, raw);
          break;
        case 'plan-phase':
          cmdInitPlanPhase(cwd, args[2], includes, raw);
          break;
        case 'new-project':
          cmdInitNewProject(cwd, raw);
          break;
        case 'new-milestone':
          cmdInitNewMilestone(cwd, raw);
          break;
        case 'milestone-branch':
          cmdInitMilestoneBranch(cwd, raw);
          break;
        case 'quick':
          cmdInitQuick(cwd, args.slice(2).join(' '), raw);
          break;
        case 'resume':
          cmdInitResume(cwd, raw);
          break;
        case 'verify-work':
          cmdInitVerifyWork(cwd, args[2], raw);
          break;
        case 'phase-op':
          cmdInitPhaseOp(cwd, args[2], raw);
          break;
        case 'todos':
          cmdInitTodos(cwd, args[2], raw);
          break;
        case 'milestone-op':
          cmdInitMilestoneOp(cwd, raw);
          break;
        case 'map-codebase':
          cmdInitMapCodebase(cwd, raw);
          break;
        case 'progress':
          cmdInitProgress(cwd, includes, raw);
          break;
        case 'execute-roadmap':
          cmdInitExecuteRoadmap(cwd, raw);
          break;
        default:
          error(`Unknown init workflow: ${workflow}\nAvailable: execute-phase, plan-phase, new-project, new-milestone, milestone-branch, quick, resume, verify-work, phase-op, todos, milestone-op, map-codebase, progress, execute-roadmap`);
      }
      break;
    }

    case 'phase-plan-index': {
      cmdPhasePlanIndex(cwd, args[1], raw);
      break;
    }

    case 'state-snapshot': {
      cmdStateSnapshot(cwd, raw);
      break;
    }

    case 'summary-extract': {
      const summaryPath = args[1];
      const fieldsIndex = args.indexOf('--fields');
      const fields = fieldsIndex !== -1 ? args[fieldsIndex + 1].split(',') : null;
      cmdSummaryExtract(cwd, summaryPath, fields, raw);
      break;
    }

    case 'websearch': {
      const query = args[1];
      const limitIdx = args.indexOf('--limit');
      const freshnessIdx = args.indexOf('--freshness');
      await cmdWebsearch(query, {
        limit: limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10,
        freshness: freshnessIdx !== -1 ? args[freshnessIdx + 1] : null,
      }, raw);
      break;
    }

    case 'quota': {
      const subCommand = args[1];

      if (subCommand === 'status') {
        const state = loadQuotaState(cwd);
        const sessionPercent = state.session.tokens_limit > 0
          ? ((state.session.tokens_used / state.session.tokens_limit) * 100).toFixed(1)
          : 0;
        const weeklyPercent = state.weekly.tokens_limit > 0
          ? ((state.weekly.tokens_used / state.weekly.tokens_limit) * 100).toFixed(1)
          : 0;

        const result = {
          session: {
            used: state.session.tokens_used,
            limit: state.session.tokens_limit,
            percent: parseFloat(sessionPercent),
            reset_time: state.session.reset_time
          },
          weekly: {
            used: state.weekly.tokens_used,
            limit: state.weekly.tokens_limit,
            percent: parseFloat(weeklyPercent),
            reset_time: state.weekly.reset_time
          },
          task_count: state.tasks.length
        };
        output(result, raw);
      } else if (subCommand === 'status-bar') {
        const state = loadQuotaState(cwd);

        if (args.includes('--json')) {
          const tasks = state.tasks || [];
          const modelCounts = { haiku: 0, sonnet: 0, opus: 0 };
          for (const task of tasks) {
            const model = task.model.toLowerCase();
            if (modelCounts[model] !== undefined) {
              modelCounts[model] += task.tokens_in + task.tokens_out;
            }
          }
          output({
            total_tokens: tasks.reduce((sum, t) => sum + t.tokens_in + t.tokens_out, 0),
            model_distribution: modelCounts,
            task_count: tasks.length,
            last_model: tasks[tasks.length - 1]?.model || null
          }, raw);
        } else {
          const statusBar = formatStatusBar(state);
          output({ status_bar: statusBar }, raw, statusBar);
        }
      } else if (subCommand === 'stats') {
        const state = loadQuotaState(cwd);
        const stats = getUsageStats(state);

        if (args.includes('--table')) {
          // Print as formatted table
          const totalTokens = stats.session_total.tokens;
          const tasks = state.tasks || [];
          const models = stats.per_model;

          console.log('\n=== GSD Auto Mode Session Stats ===\n');
          console.log(`Total: ${totalTokens.toLocaleString()} tokens across ${stats.session_total.tasks} tasks\n`);
          console.log('Model Distribution:');
          console.log(`  Haiku:  ${models.haiku.tokens.toLocaleString()} tokens (${models.haiku.tasks} tasks)`);
          console.log(`  Sonnet: ${models.sonnet.tokens.toLocaleString()} tokens (${models.sonnet.tasks} tasks)`);
          console.log(`  Opus:   ${models.opus.tokens.toLocaleString()} tokens (${models.opus.tasks} tasks)`);
          console.log('\nCost Savings:');
          console.log(`  Actual:    ${stats.cost_estimate.actual_cost}`);
          console.log(`  If Opus:   ${stats.cost_estimate.if_all_opus}`);
          console.log(`  Saved:     ${stats.cost_estimate.savings} (${stats.cost_estimate.savings_percent})`);
          console.log('\nQuota:');
          console.log(`  Session:   ${stats.quota.session_percent} used`);
          console.log(`  Weekly:    ${stats.quota.weekly_percent} used`);
          process.exit(0);
        } else {
          output(stats, raw);
        }
      } else if (subCommand === 'reset') {
        saveQuotaState(cwd, { ...DEFAULT_QUOTA_STATE });
        output({ reset: true }, raw);
      } else if (subCommand === 'record') {
        const [taskId, model, tokensIn, tokensOut] = args.slice(2);
        const state = recordTaskUsage(cwd, taskId, model, parseInt(tokensIn), parseInt(tokensOut));
        output({
          recorded: true,
          session_total: state.session.tokens_used,
          task_count: state.tasks.length
        }, raw);
      } else if (subCommand === 'update-from-headers') {
        const headersJson = args.slice(2).join(' ');
        const headers = JSON.parse(headersJson);
        const parsed = parseQuotaHeaders(headers);

        const state = loadQuotaState(cwd);

        // Update limits and reset times from actual API headers
        state.session.tokens_limit = parsed.input.limit;
        state.session.reset_time = parsed.input.reset;
        state.session.tokens_used = parsed.input.limit - parsed.input.remaining;

        saveQuotaState(cwd, state);
        output({
          updated: true,
          session_percent: ((state.session.tokens_used / state.session.tokens_limit) * 100).toFixed(1)
        }, raw);
      } else if (subCommand === 'check') {
        const warnings = checkQuotaWarning(cwd);
        const waitCheck = checkQuotaAndWait(cwd);
        output({
          warnings,
          wait: waitCheck
        }, raw);
      } else if (subCommand === 'wait') {
        const waitCheck = checkQuotaAndWait(cwd);

        if (!waitCheck.should_wait) {
          output({ waited: false, reason: 'quota_ok' }, raw);
        } else {
          output({
            waiting: true,
            type: waitCheck.wait_type,
            seconds: waitCheck.wait_seconds,
            until: waitCheck.wait_until
          }, raw);
        }
      } else {
        error('Unknown quota subcommand. Available: status, reset, record, update-from-headers, check, wait, status-bar, stats');
      }
      break;
    }

    case 'knowledge': {
      const knowledgeSubcmd = args[1];
      const knowledgeArgs = args.slice(2);
      switch (knowledgeSubcmd) {
        case 'status':
          cmdKnowledgeStatus(cwd, knowledgeArgs, raw);
          break;
        case 'add':
          cmdKnowledgeAdd(cwd, knowledgeArgs, raw);
          break;
        case 'search':
          cmdKnowledgeSearch(cwd, knowledgeArgs, raw);
          break;
        case 'get':
          cmdKnowledgeGet(cwd, knowledgeArgs, raw);
          break;
        case 'delete':
          cmdKnowledgeDelete(cwd, knowledgeArgs, raw);
          break;
        case 'cleanup':
          cmdKnowledgeCleanup(cwd, knowledgeArgs, raw);
          break;
        case 'prune':
          cmdKnowledgePrune(cwd, knowledgeArgs, raw);
          break;
        case 'stats':
          cmdKnowledgeStats(cwd, knowledgeArgs, raw);
          break;
        default:
          error(`knowledge: unknown subcommand '${knowledgeSubcmd}'`);
      }
      break;
    }

    case 'grant': {
      cmdPermissionGrant(cwd, args.slice(1), raw);
      break;
    }

    case 'revoke': {
      cmdPermissionRevoke(cwd, args.slice(1), raw);
      break;
    }

    case 'list-permissions': {
      cmdPermissionList(cwd, args.slice(1), raw);
      break;
    }

    case 'pause': {
      cmdPause(cwd, args.slice(1), raw);
      break;
    }

    case 'resume': {
      cmdResume(cwd, args.slice(1), raw);
      break;
    }

    case 'budget': {
      cmdBudget(cwd, args.slice(1), raw);
      break;
    }

    case 'mark-wrong': {
      cmdMarkWrong(cwd, args.slice(1), raw);
      break;
    }

    case 'mark-outdated': {
      cmdMarkOutdated(cwd, args.slice(1), raw);
      break;
    }

    case 'principle-history': {
      cmdPrincipleHistory(cwd, args.slice(1), raw);
      break;
    }

    case 'pending-replacements': {
      cmdPendingReplacements(cwd, args.slice(1), raw);
      break;
    }

    case 'checkpoint': {
      cmdCheckpoint(cwd, args.slice(1), raw);
      break;
    }

    case 'execution-log': {
      cmdExecutionLog(cwd, args.slice(1), raw);
      break;
    }

    case 'failure': {
      cmdFailure(cwd, args.slice(1), raw);
      break;
    }

    case 'completion': {
      cmdCompletion(cwd, args.slice(1), raw);
      break;
    }

    case 'token': {
      cmdToken(cwd, args.slice(1), raw);
      break;
    }

    case 'alerts': {
      cmdAlerts(cwd, args.slice(1), raw);
      break;
    }

    case 'task': {
      cmdTask(cwd, args.slice(1), raw);
      break;
    }

    case 'observability': {
      await cmdObservability(args.slice(1), raw);
      break;
    }

    case 'parallel': {
      await cmdParallel(cwd, args.slice(1), raw);
      break;
    }

    case 'dashboard': {
      await cmdDashboard(args.slice(1));
      break;
    }

    case 'health': {
      await cmdHealth(args.slice(1));
      break;
    }

    case 'savings': {
      cmdSavings(args.slice(1), raw);
      break;
    }

    case 'analyze-session': {
      await cmdAnalyzeSession(cwd, args.slice(1), raw);
      break;
    }

    case 'historical-extract': {
      await cmdHistoricalExtract(cwd, args.slice(1), raw);
      break;
    }

    case 'analysis-status': {
      cmdAnalysisStatus(cwd, args.slice(1), raw);
      break;
    }

    case 'list-pending-sessions': {
      await cmdListPendingSessions(cwd, args.slice(1), raw);
      break;
    }

    case 'store-analysis-result': {
      await cmdStoreAnalysisResult(cwd, args.slice(1), raw);
      break;
    }

    case 'mine-conversations': {
      await cmdMineConversations(cwd, args.slice(1), raw);
      break;
    }

    case 'store-conversation-result': {
      await cmdStoreConversationResult(cwd, args.slice(1), raw);
      break;
    }

    case 'migrate-knowledge': {
      await cmdMigrateKnowledge(cwd, args.slice(1), raw);
      break;
    }

    case 'query-knowledge': {
      await cmdQueryKnowledge(cwd, args.slice(1), raw);
      break;
    }

    case 'compress': {
      const subcommand = args[1];
      if (subcommand === 'summary') {
        const filePath = args[2];
        const rawFlag = args.includes('--raw');
        cmdCompressSummary(filePath, rawFlag);
      } else if (subcommand === 'stats') {
        cmdCompressStats(raw);
      } else if (subcommand === 'status') {
        // Show compression configuration and circuit breaker state
        const { loadHookConfig, getCircuitBreakerStatus } = require(path.join(process.env.HOME, '.claude/get-shit-done/bin/hooks/config'));
        const config = loadHookConfig();
        const cbStatus = getCircuitBreakerStatus();

        output({
          enabled: config.compression.enabled,
          strategy: config.compression.strategy,
          min_file_lines: config.compression.min_file_lines,
          cache_ttl: config.compression.cache_ttl,
          circuit_breaker: cbStatus
        }, raw);

      } else if (subcommand === 'enable') {
        // Enable compression
        const { loadHookConfig, saveHookConfig } = require(path.join(process.env.HOME, '.claude/get-shit-done/bin/hooks/config'));
        const config = loadHookConfig();
        config.compression.enabled = true;
        saveHookConfig(config);
        output({ enabled: true, message: 'Compression enabled' }, raw);

      } else if (subcommand === 'disable') {
        // Disable compression
        const { loadHookConfig, saveHookConfig } = require(path.join(process.env.HOME, '.claude/get-shit-done/bin/hooks/config'));
        const config = loadHookConfig();
        config.compression.enabled = false;
        saveHookConfig(config);
        output({ enabled: false, message: 'Compression disabled' }, raw);

      } else if (subcommand === 'reset') {
        // Reset circuit breaker
        const { resetCircuitBreaker } = require(path.join(process.env.HOME, '.claude/get-shit-done/bin/hooks/config'));
        resetCircuitBreaker();
        output({ message: 'Circuit breaker reset to closed state' }, raw);

      } else if (subcommand === 'metrics') {
        // Show compression statistics
        const metricsPath = path.join(process.env.HOME, '.claude', 'get-shit-done', 'compression-metrics.jsonl');
        if (!fs.existsSync(metricsPath)) {
          output({ count: 0, message: 'No compression metrics yet' }, raw);
        } else {
          const lines = fs.readFileSync(metricsPath, 'utf-8').trim().split('\n').filter(l => l.trim());
          if (lines.length === 0) {
            output({ count: 0, message: 'No compression metrics yet' }, raw);
          } else {
            const records = lines.map(l => {
              try {
                return JSON.parse(l);
              } catch (e) {
                return null;
              }
            }).filter(r => r !== null);

            const avgReduction = records.length > 0
              ? records.reduce((sum, r) => sum + parseFloat(r.reductionPercent || 0), 0) / records.length
              : 0;

            const totalTokensSaved = records.reduce((sum, r) =>
              sum + ((r.originalTokens || 0) - (r.compressedTokens || 0)), 0);

            output({
              count: records.length,
              avgReduction: avgReduction.toFixed(1) + '%',
              totalTokensSaved
            }, raw);
          }
        }

      } else if (subcommand === 'clear-cache') {
        // Clear compression cache
        const { CompressionCache } = require(path.join(process.env.HOME, '.claude/get-shit-done/bin/hooks/compression-cache'));
        const cache = new CompressionCache();
        const statsBefore = cache.stats();
        cache.clear();
        output({
          message: 'Compression cache cleared',
          entriesCleared: statsBefore.entries,
          bytesFreed: statsBefore.totalSize
        }, raw);

      } else {
        error('Unknown compress subcommand. Available: summary, stats, status, enable, disable, reset, metrics, clear-cache');
      }
      break;
    }

    case 'circuit-breaker': {
      const subCommand = args[1];

      if (!circuitBreaker) {
        error('circuit-breaker module not available — run npm install in get-shit-done/');
        break;
      }

      if (subCommand === 'thresholds') {
        const modelIdx = args.indexOf('--model');
        const taskIdx = args.indexOf('--task');

        const model = modelIdx !== -1 ? args[modelIdx + 1] : 'sonnet';
        const task = taskIdx !== -1 ? args.slice(taskIdx + 1).join(' ') : '';

        const thresholds = circuitBreaker.getAdaptiveThresholds(task, model);
        output(thresholds, raw);

      } else if (subCommand === 'update-threshold') {
        const patternIdx = args.indexOf('--pattern');
        const multiplierIdx = args.indexOf('--multiplier');

        if (patternIdx === -1 || multiplierIdx === -1) {
          error('update-threshold requires --pattern and --multiplier');
          break;
        }

        const pattern = args[patternIdx + 1];
        const multiplier = parseFloat(args[multiplierIdx + 1]);

        const thresholds = circuitBreaker.loadThresholds();
        if (!thresholds.learned) {
          thresholds.learned = {};
        }
        thresholds.learned[pattern] = multiplier;
        circuitBreaker.saveThresholds(thresholds);

        output({ updated: true, pattern, multiplier }, raw);

      } else if (subCommand === 'log') {
        const modelIdx = args.indexOf('--model');
        const limitIdx = args.indexOf('--limit');

        const modelFilter = modelIdx !== -1 ? args[modelIdx + 1] : null;
        const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 20;

        const logPath = path.join(cwd, '.planning', 'circuit-breaker', 'timeout-log.jsonl');

        if (!fs.existsSync(logPath)) {
          output({ entries: [] }, raw);
          break;
        }

        const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(l => l.trim());
        const entries = [];

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry._comment) continue; // Skip header
            if (modelFilter && entry.model !== modelFilter) continue;
            entries.push(entry);
          } catch (e) {
            // Skip invalid lines
          }
        }

        const result = entries.slice(-limit);
        output({ entries: result, total: entries.length }, raw);

      } else if (subCommand === 'stats') {
        const logPath = path.join(cwd, '.planning', 'circuit-breaker', 'timeout-log.jsonl');

        if (!fs.existsSync(logPath)) {
          output({
            total_timeouts: 0,
            by_model: {},
            average_time_to_timeout: null
          }, raw);
          break;
        }

        const lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(l => l.trim());
        const entries = [];

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry._comment) continue;
            entries.push(entry);
          } catch (e) {
            // Skip invalid lines
          }
        }

        const byModel = {};
        let totalTimeoutMs = 0;

        for (const entry of entries) {
          const model = entry.model || 'unknown';
          if (!byModel[model]) {
            byModel[model] = { count: 0, total_timeout_ms: 0 };
          }
          byModel[model].count++;

          if (entry.timeout_ms) {
            byModel[model].total_timeout_ms += entry.timeout_ms;
            totalTimeoutMs += entry.timeout_ms;
          }
        }

        const avgTimeToTimeout = entries.length > 0
          ? Math.floor(totalTimeoutMs / entries.length)
          : null;

        output({
          total_timeouts: entries.length,
          by_model: byModel,
          average_time_to_timeout: avgTimeToTimeout
        }, raw);

      } else {
        error('Unknown circuit-breaker subcommand. Available: thresholds, update-threshold, log, stats');
      }
      break;
    }

    case 'validation': {
      const subCommand = args[1];

      if (subCommand === 'validate') {
        const taskIdIdx = args.indexOf('--task-id');
        const outputIdx = args.indexOf('--output');
        const reasoningIdx = args.indexOf('--reasoning');

        const taskId = taskIdIdx !== -1 ? args[taskIdIdx + 1] : 'unknown';
        let taskOutput = outputIdx !== -1 ? args[outputIdx + 1] : '';
        let taskReasoning = reasoningIdx !== -1 ? args[reasoningIdx + 1] : '';

        // Check if output/reasoning are file paths
        if (taskOutput.startsWith('/') || taskOutput.startsWith('./')) {
          try {
            taskOutput = fs.readFileSync(taskOutput, 'utf-8');
          } catch (e) {
            // If not a file, treat as literal string
          }
        }
        if (taskReasoning.startsWith('/') || taskReasoning.startsWith('./')) {
          try {
            taskReasoning = fs.readFileSync(taskReasoning, 'utf-8');
          } catch (e) {
            // If not a file, treat as literal string
          }
        }

        // Run validation
        const task = args.slice(2).filter(a => !a.startsWith('--') && a !== taskId && a !== taskOutput && a !== taskReasoning).join(' ');
        const result = await validator.validateTask(task, taskOutput, taskReasoning, { task_id: taskId });

        output(result, raw);

      } else if (subCommand === 'depth') {
        const task = args.slice(2).join(' ');
        const result = validator.selectValidationDepth(task);
        output(result, raw);

      } else if (subCommand === 'log') {
        const taskIdIdx = args.indexOf('--task-id');
        const limitIdx = args.indexOf('--limit');

        const taskIdFilter = taskIdIdx !== -1 ? args[taskIdIdx + 1] : null;
        const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 20;

        const logFile = path.join(cwd, '.planning', 'validation', 'validation-log.jsonl');
        let entries = [];

        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf-8');
          entries = content
            .trim()
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line))
            .filter(entry => !entry._comment); // Skip header comments

          if (taskIdFilter) {
            entries = entries.filter(e => e.task_id === taskIdFilter);
          }

          entries = entries.slice(-limit); // Get last N entries
        }

        output({ entries, count: entries.length }, raw);

      } else if (subCommand === 'stats') {
        const logFile = path.join(cwd, '.planning', 'validation', 'validation-log.jsonl');
        let entries = [];

        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf-8');
          entries = content
            .trim()
            .split('\n')
            .filter(line => line.trim())
            .map(line => JSON.parse(line))
            .filter(entry => !entry._comment && entry.result);
        }

        const total = entries.length;
        const passed = entries.filter(e => e.result && e.result.valid).length;
        const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

        const avgCorrectness = total > 0
          ? (entries.reduce((sum, e) => sum + (e.result.correctness_score || 0), 0) / total).toFixed(1)
          : 0;
        const avgReasoning = total > 0
          ? (entries.reduce((sum, e) => sum + (e.result.reasoning_score || 0), 0) / total).toFixed(1)
          : 0;

        const byDepth = {
          light: entries.filter(e => e.depth === 'light').length,
          standard: entries.filter(e => e.depth === 'standard').length,
          thorough: entries.filter(e => e.depth === 'thorough').length
        };

        const stats = {
          total_validations: total,
          passed: passed,
          failed: total - passed,
          pass_rate: parseFloat(passRate),
          average_correctness: parseFloat(avgCorrectness),
          average_reasoning: parseFloat(avgReasoning),
          by_depth: byDepth
        };

        output(stats, raw);

      } else {
        error('Unknown validation subcommand. Available: validate, depth, log, stats');
      }
      break;
    }

    case 'escalation': {
      const subCommand = args[1];

      if (subCommand === 'weights') {
        // Show error weight configuration
        output(escalation.ERROR_WEIGHTS, raw);

      } else if (subCommand === 'threshold') {
        // Show escalation threshold
        output({
          threshold: escalation.ESCALATION_THRESHOLD,
          description: '1-2 errors trigger escalation'
        }, raw);

      } else if (subCommand === 'log') {
        // Read escalation log
        const taskIdIdx = args.indexOf('--task-id');
        const limitIdx = args.indexOf('--limit');

        const taskIdFilter = taskIdIdx !== -1 ? args[taskIdIdx + 1] : null;
        const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 20;

        const logFile = path.join(cwd, '.planning', 'validation', 'escalation-log.jsonl');
        let entries = [];

        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf-8');
          entries = content
            .trim()
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
              try {
                return JSON.parse(line);
              } catch {
                return null;
              }
            })
            .filter(entry => entry && !entry._comment); // Skip header comments and parse errors

          if (taskIdFilter) {
            entries = entries.filter(e => e.task_id === taskIdFilter);
          }

          entries = entries.slice(-limit); // Get last N entries
        }

        output({ entries, count: entries.length }, raw);

      } else if (subCommand === 'stats') {
        // Escalation statistics
        const logFile = path.join(cwd, '.planning', 'validation', 'escalation-log.jsonl');
        let entries = [];

        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf-8');
          entries = content
            .trim()
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
              try {
                return JSON.parse(line);
              } catch {
                return null;
              }
            })
            .filter(entry => entry && !entry._comment);
        }

        const total = entries.length;
        const byModel = {};
        let totalErrors = 0;

        entries.forEach(entry => {
          const from = entry.from_model || 'unknown';
          const to = entry.to_model || 'unknown';
          const key = `${from} → ${to}`;

          if (!byModel[key]) {
            byModel[key] = { count: 0, total_score: 0 };
          }

          byModel[key].count++;
          byModel[key].total_score += entry.cumulative_score || 0;
          totalErrors++;
        });

        const avgErrorsBeforeEscalation = total > 0
          ? (totalErrors / total).toFixed(2)
          : 0;

        const stats = {
          total_escalations: total,
          by_model: byModel,
          avg_errors_before_escalation: avgErrorsBeforeEscalation
        };

        output(stats, raw);

      } else if (subCommand === 'simulate') {
        // Simulate error scoring
        const errorsIdx = args.indexOf('--errors');
        if (errorsIdx === -1) {
          error('Missing --errors argument. Usage: escalation simulate --errors "RETRY,VALIDATION_FIX,COMPLETE_REJECTION"');
        }

        const errorsStr = args[errorsIdx + 1];
        const errorTypes = errorsStr.split(',').map(s => s.trim());

        const tracker = new escalation.ErrorTracker({ id: 'simulation' });

        errorTypes.forEach(errorType => {
          if (escalation.ERROR_WEIGHTS[errorType] !== undefined) {
            tracker.recordError(errorType, `Simulated ${errorType} error`);
          } else {
            error(`Unknown error type: ${errorType}. Valid types: ${Object.keys(escalation.ERROR_WEIGHTS).join(', ')}`);
          }
        });

        output({
          cumulative_score: tracker.cumulativeScore,
          should_escalate: tracker.shouldEscalate(),
          errors: tracker.errors.length
        }, raw);

      } else {
        error('Unknown escalation subcommand. Available: weights, threshold, log, stats, simulate');
      }
      break;
    }

    case 'feedback': {
      const subCommand = args[1];

      if (subCommand === 'config') {
        // Show current feedback configuration
        const config = feedback.loadConfig();
        const feedbackConfig = {
          feedback_enabled: config.feedback_enabled,
          feedback_mode: config.feedback_mode,
          feedback_frequency: config.feedback_frequency,
          sample_rate: config.sample_rate
        };
        output(feedbackConfig, raw);

      } else if (subCommand === 'enable') {
        // Enable feedback collection
        const modeIdx = args.indexOf('--mode');
        const frequencyIdx = args.indexOf('--frequency');

        const mode = modeIdx !== -1 ? args[modeIdx + 1] : 'human';
        const frequency = frequencyIdx !== -1 ? args[frequencyIdx + 1] : 'escalations';

        // Validate mode
        if (!['human', 'opus'].includes(mode)) {
          error('Invalid mode. Must be: human or opus');
        }

        // Validate frequency
        if (!['all', 'escalations', 'sample'].includes(frequency)) {
          error('Invalid frequency. Must be: all, escalations, or sample');
        }

        const config = feedback.loadConfig();
        config.feedback_enabled = true;
        config.feedback_mode = mode;
        config.feedback_frequency = frequency;
        feedback.saveConfig(config);

        output({
          message: 'Feedback collection enabled',
          feedback_enabled: true,
          feedback_mode: mode,
          feedback_frequency: frequency
        }, raw);

      } else if (subCommand === 'disable') {
        // Disable feedback collection
        const config = feedback.loadConfig();
        config.feedback_enabled = false;
        feedback.saveConfig(config);

        output({
          message: 'Feedback collection disabled',
          feedback_enabled: false
        }, raw);

      } else if (subCommand === 'log') {
        // Read feedback log
        const correctIdx = args.indexOf('--correct');
        const modelIdx = args.indexOf('--model');
        const limitIdx = args.indexOf('--limit');

        const options = {};

        if (correctIdx !== -1) {
          const correctVal = args[correctIdx + 1];
          options.correct = correctVal === 'true';
        }

        if (modelIdx !== -1) {
          options.model = args[modelIdx + 1];
        }

        if (limitIdx !== -1) {
          options.limit = parseInt(args[limitIdx + 1], 10);
        } else {
          options.limit = 20;
        }

        const entries = feedback.readFeedbackLog(options);
        output({ entries, count: entries.length }, raw);

      } else if (subCommand === 'stats') {
        // Feedback statistics
        const stats = feedback.calculateFeedbackStats();
        output(stats, raw);

      } else if (subCommand === 'prompt') {
        // Generate feedback prompt (for testing)
        const taskIdx = args.indexOf('--task');
        const modelIdx = args.indexOf('--model');

        if (taskIdx === -1 || modelIdx === -1) {
          error('Missing required arguments. Usage: feedback prompt --task "description" --model MODEL');
        }

        const taskDescription = args[taskIdx + 1];
        const model = args[modelIdx + 1];

        const prompt = `
Task: ${taskDescription}
Model used: ${model}

Was ${model} the right choice for this task? (y/n): `;

        if (raw) {
          output({ prompt, task: taskDescription, model }, raw);
        } else {
          console.log(prompt);
        }

      } else {
        error('Unknown feedback subcommand. Available: config, enable, disable, log, stats, prompt');
      }
      break;
    }

    case 'learning': {
      const subCommand = args[1];

      if (subCommand === 'extract') {
        // Extract patterns from feedback
        const feedbackLog = learning.readFeedbackLog();
        const patterns = learning.extractPatterns(feedbackLog);
        output({ patterns, count: patterns.length }, raw);

      } else if (subCommand === 'merge') {
        // Merge learned rules with built-in
        const builtInRules = learning.loadBuiltInRules();
        const feedbackLog = learning.readFeedbackLog();
        const learnedPatterns = learning.extractPatterns(feedbackLog);
        const result = learning.mergeRules(builtInRules, learnedPatterns);

        // Write learned rules to markdown
        learning.writeLearnedRules(learnedPatterns);

        output({
          total_rules: result.rules.length,
          learned_count: learnedPatterns.length,
          overrides: result.stats.overrides,
          conflicts_insufficient: result.stats.insufficient,
          new_rules: result.stats.new
        }, raw);

      } else if (subCommand === 'rules') {
        // Show current learned rules
        const rulesPath = path.join(process.env.HOME, '.claude/skills/gsd-task-router/learned-rules.md');

        if (!fs.existsSync(rulesPath)) {
          output({ rules: [], message: 'No learned rules file found' }, raw);
        } else {
          const content = fs.readFileSync(rulesPath, 'utf8');

          // Parse markdown table
          const lines = content.split('\n');
          const rules = [];
          let inTable = false;

          for (const line of lines) {
            if (line.startsWith('| Pattern |')) {
              inTable = true;
              continue;
            }
            if (line.startsWith('|---')) {
              continue;
            }
            if (inTable && line.startsWith('|')) {
              const parts = line.split('|').map(s => s.trim()).filter(s => s);
              if (parts.length >= 3 && parts[0] !== '(no learned rules yet)') {
                rules.push({
                  pattern: parts[0],
                  model: parts[1],
                  evidence_count: parseInt(parts[2], 10)
                });
              }
            }
            if (inTable && !line.startsWith('|')) {
              break;
            }
          }

          output({ rules, count: rules.length }, raw);
        }

      } else if (subCommand === 'clear') {
        // Clear learned rules
        learning.writeLearnedRules([]);
        output({ message: 'Learned rules cleared' }, raw);

      } else if (subCommand === 'status') {
        // Learning system status
        const feedbackLog = learning.readFeedbackLog();
        const patterns = learning.extractPatterns(feedbackLog);

        // Get merge log stats
        const mergeLogPath = path.join(process.cwd(), '.planning/feedback/rule-merge-log.jsonl');
        let lastMerge = null;
        let mergeCount = 0;

        if (fs.existsSync(mergeLogPath)) {
          const lines = fs.readFileSync(mergeLogPath, 'utf8')
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('{"_comment"'));

          mergeCount = lines.length;

          if (lines.length > 0) {
            try {
              const lastEntry = JSON.parse(lines[lines.length - 1]);
              lastMerge = lastEntry.timestamp;
            } catch (e) {
              // Ignore parse errors
            }
          }
        }

        // Get all feedback count
        const allFeedbackPath = path.join(process.cwd(), '.planning/feedback/human-feedback.jsonl');
        let totalFeedback = 0;

        if (fs.existsSync(allFeedbackPath)) {
          const lines = fs.readFileSync(allFeedbackPath, 'utf8')
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('{"_comment"'));
          totalFeedback = lines.length;
        }

        output({
          feedback_count: totalFeedback,
          incorrect_count: feedbackLog.length,
          learned_rules_count: patterns.length,
          last_merge: lastMerge,
          merge_count: mergeCount
        }, raw);

      } else {
        error('Unknown learning subcommand. Available: extract, merge, rules, clear, status');
      }
      break;
    }

    case 'auto-task': {
      const subCommand = args[1];

      if (subCommand === 'status') {
        // Show Phase 2 system status
        const cwd = process.cwd();

        // Validation status
        const validationLogPath = path.join(cwd, '.planning/validation/validation-log.jsonl');
        let validationEntries = 0;
        if (fs.existsSync(validationLogPath)) {
          validationEntries = fs.readFileSync(validationLogPath, 'utf8')
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('{"_comment"')).length;
        }

        // Circuit breaker status
        const thresholdsPath = path.join(cwd, '.planning/circuit-breaker/thresholds.json');
        let thresholds = { haiku: {}, sonnet: {}, opus: {} };
        if (fs.existsSync(thresholdsPath)) {
          try {
            thresholds = JSON.parse(fs.readFileSync(thresholdsPath, 'utf8'));
          } catch (e) {
            // Use defaults
          }
        }

        // Escalation status
        const escalationLogPath = path.join(cwd, '.planning/escalation/escalation-log.jsonl');
        let totalEscalations = 0;
        const byModel = { haiku_to_sonnet: 0, sonnet_to_opus: 0, opus_to_fail: 0 };
        if (fs.existsSync(escalationLogPath)) {
          const lines = fs.readFileSync(escalationLogPath, 'utf8')
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('{"_comment"'));

          totalEscalations = lines.length;

          lines.forEach(line => {
            try {
              const entry = JSON.parse(line);
              const from = entry.from_model || 'unknown';
              const to = entry.to_model || 'unknown';
              const key = `${from}_to_${to}`;
              if (byModel[key] !== undefined) byModel[key]++;
            } catch (e) {
              // Ignore parse errors
            }
          });
        }

        // Feedback status
        const feedbackConfig = feedback.loadConfig();
        const feedbackLogPath = path.join(cwd, '.planning/feedback/human-feedback.jsonl');
        let feedbackEntries = 0;
        if (fs.existsSync(feedbackLogPath)) {
          feedbackEntries = fs.readFileSync(feedbackLogPath, 'utf8')
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('{"_comment"')).length;
        }

        // Learning status
        const learnedRulesPath = path.join(process.env.HOME, '.claude/skills/gsd-task-router/learned-rules.md');
        let rulesCount = 0;
        if (fs.existsSync(learnedRulesPath)) {
          const content = fs.readFileSync(learnedRulesPath, 'utf8');
          const lines = content.split('\n');
          rulesCount = lines.filter(line =>
            line.startsWith('|') &&
            !line.includes('Pattern |') &&
            !line.includes('---') &&
            !line.includes('(no learned rules yet)')
          ).length;
        }

        const mergeLogPath = path.join(cwd, '.planning/feedback/rule-merge-log.jsonl');
        let lastMerge = null;
        if (fs.existsSync(mergeLogPath)) {
          const lines = fs.readFileSync(mergeLogPath, 'utf8')
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('{"_comment"'));

          if (lines.length > 0) {
            try {
              const lastEntry = JSON.parse(lines[lines.length - 1]);
              lastMerge = lastEntry.timestamp;
            } catch (e) {
              // Ignore parse errors
            }
          }
        }

        output({
          validation: {
            enabled: true,
            log_entries: validationEntries
          },
          circuit_breaker: {
            thresholds: thresholds,
            configured: Object.keys(thresholds).length > 0
          },
          escalation: {
            total: totalEscalations,
            by_model: byModel
          },
          feedback: {
            enabled: feedbackConfig.enabled,
            entries: feedbackEntries
          },
          learning: {
            rules_count: rulesCount,
            last_merge: lastMerge
          }
        }, raw);

      } else if (subCommand === 'report') {
        // Generate end-of-execution report
        const cwd = process.cwd();
        const jsonFlag = args.includes('--json');

        // Aggregate validation stats (inline implementation)
        const validationLogPath = path.join(cwd, '.planning/validation/validation-log.jsonl');
        let validationStats = { total: 0, passed: 0, pass_rate: 0, by_depth: {} };

        if (fs.existsSync(validationLogPath)) {
          const lines = fs.readFileSync(validationLogPath, 'utf8')
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('{"_comment"'));

          const entries = lines.map(line => {
            try {
              return JSON.parse(line);
            } catch (e) {
              return null;
            }
          }).filter(e => e !== null);

          const total = entries.length;
          const passed = entries.filter(e => e.recommendation === 'PASS').length;
          const passRate = total > 0 ? (passed / total) : 0;

          const byDepth = {};
          ['light', 'standard', 'thorough'].forEach(depth => {
            const depthEntries = entries.filter(e => e.depth === depth);
            const depthPassed = depthEntries.filter(e => e.recommendation === 'PASS').length;
            if (depthEntries.length > 0) {
              byDepth[depth] = {
                total: depthEntries.length,
                passed: depthPassed,
                pass_rate: depthPassed / depthEntries.length
              };
            }
          });

          validationStats = { total, passed, pass_rate: passRate, by_depth: byDepth };
        }

        // Aggregate escalation history (inline implementation)
        const escalationLogPath = path.join(cwd, '.planning/escalation/escalation-log.jsonl');
        let escalationLog = [];

        if (fs.existsSync(escalationLogPath)) {
          const lines = fs.readFileSync(escalationLogPath, 'utf8')
            .split('\n')
            .filter(line => line.trim() && !line.startsWith('{"_comment"'));

          escalationLog = lines.map(line => {
            try {
              return JSON.parse(line);
            } catch (e) {
              return null;
            }
          }).filter(e => e !== null);
        }

        // Aggregate feedback summary
        const feedbackStats = feedback.calculateFeedbackStats();

        const report = {
          validation: validationStats,
          escalation: {
            total: escalationLog.length,
            history: escalationLog.map(e => ({
              task_id: e.task_id,
              from_model: e.from_model,
              to_model: e.to_model,
              reason: e.reason,
              timestamp: e.timestamp
            }))
          },
          feedback: feedbackStats
        };

        if (jsonFlag || raw) {
          output(report, true);
        } else {
          // Format as readable text
          console.log('=== Phase 2 Execution Report ===\n');

          console.log('VALIDATION SUMMARY:');
          console.log(`  Total: ${report.validation.total}`);
          console.log(`  Passed: ${report.validation.passed}`);
          console.log(`  Pass Rate: ${(report.validation.pass_rate * 100).toFixed(1)}%`);
          if (Object.keys(report.validation.by_depth).length > 0) {
            console.log('  By Depth:');
            Object.entries(report.validation.by_depth).forEach(([depth, stats]) => {
              console.log(`    ${depth}: ${stats.passed}/${stats.total} (${(stats.pass_rate * 100).toFixed(1)}%)`);
            });
          }
          console.log('');

          console.log('ESCALATION HISTORY:');
          console.log(`  Total: ${report.escalation.total}`);
          if (report.escalation.history.length > 0) {
            report.escalation.history.forEach(e => {
              console.log(`  - ${e.task_id}: ${e.from_model} → ${e.to_model} (${e.reason})`);
            });
          } else {
            console.log('  (none)');
          }
          console.log('');

          console.log('FEEDBACK SUMMARY:');
          console.log(`  Total: ${report.feedback.total_feedback}`);
          console.log(`  Correct: ${report.feedback.correct_selections || 0}`);
          console.log(`  Incorrect: ${report.feedback.incorrect_selections || 0}`);
          console.log(`  Correct Rate: ${report.feedback.correct_rate}%`);
          if (Object.keys(report.feedback.incorrect_by_model).length > 0) {
            console.log('  Incorrect by Model:');
            Object.entries(report.feedback.incorrect_by_model).forEach(([model, count]) => {
              console.log(`    ${model}: ${count}`);
            });
          }
        }

      } else {
        error('Unknown auto-task subcommand. Available: status, report');
      }
      break;
    }

        case 'requirements': {
      const subcommand = args[1];
      if (subcommand === 'mark-complete') {
        cmdRequirementsMarkComplete(cwd, args.slice(2), raw);
      } else {
        error('Unknown requirements subcommand. Available: mark-complete');
      }
      break;
    }

    case 'routing': {
      const subcommand = args[1];
      if (subcommand === 'match') {
        cmdRoutingMatch(cwd, args.slice(2).join(' '), raw);
      } else if (subcommand === 'context') {
        cmdRoutingContext(cwd, args.slice(2).join(' '), raw);
      } else if (subcommand === 'full') {
        cmdRoutingFull(cwd, args.slice(2).join(' '), raw);
      } else if (subcommand === 'index-build') {
        cmdRoutingIndexBuild(cwd, args, raw);
      } else if (subcommand === 'index-refresh') {
        cmdRoutingIndexRefresh(cwd, raw);
      } else if (subcommand === 'match-with-quota') {
        cmdRoutingMatchWithQuota(cwd, args.slice(2).join(' '), raw);
      } else {
        error('Unknown routing subcommand. Available: match, match-with-quota, context, full, index-build, index-refresh');
      }
      break;
    }

    default:
      error(`Unknown command: ${command}`);
  }
}

main();
