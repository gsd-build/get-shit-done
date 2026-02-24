/**
 * GSD Upstream Module
 *
 * Upstream remote management and sync operations for fork maintenance.
 * Part of the GSD Upstream Sync feature (v1.1).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_REMOTE_NAME = 'upstream';
const DEFAULT_BRANCH = 'main';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const CONFIG_PATH = '.planning/config.json';

// Conventional commit type mappings with emoji and labels
const COMMIT_TYPES = {
  feat:     { emoji: '\u2728', label: 'Features' },           // sparkles
  fix:      { emoji: '\uD83D\uDC1B', label: 'Fixes' },         // bug
  refactor: { emoji: '\u267B\uFE0F', label: 'Refactors' },     // recycling
  docs:     { emoji: '\uD83D\uDCDA', label: 'Documentation' }, // books
  test:     { emoji: '\u2705', label: 'Tests' },              // check mark
  chore:    { emoji: '\uD83D\uDD27', label: 'Chores' },        // wrench
  style:    { emoji: '\uD83D\uDC84', label: 'Styles' },        // lipstick
  perf:     { emoji: '\u26A1', label: 'Performance' },        // lightning
  ci:       { emoji: '\uD83D\uDC77', label: 'CI' },            // construction worker
  build:    { emoji: '\uD83C\uDFD7\uFE0F', label: 'Build' },    // building construction
};

// Pattern to match conventional commits: type(scope)?: description
const CONVENTIONAL_PATTERN = /^(\w+)(?:\([^)]+\))?!?:\s*(.+)/;

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Execute a git command and return structured result.
 * @param {string} cwd - Working directory
 * @param {string[]} args - Git command arguments
 * @returns {{ success: boolean, stdout?: string, stderr?: string }}
 */
function execGit(cwd, args) {
  try {
    // Quote arguments containing special shell characters
    const quotedArgs = args.map(arg => {
      // If arg contains shell-special chars, wrap in single quotes
      // (escape any existing single quotes first)
      if (/[%|&;<>()$`\\"\s]/.test(arg)) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }
      return arg;
    });
    const stdout = execSync(`git ${quotedArgs.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return { success: true, stdout };
  } catch (err) {
    return {
      success: false,
      stderr: err.stderr ? err.stderr.toString().trim() : err.message,
    };
  }
}

/**
 * Load upstream configuration from .planning/config.json.
 * Returns the upstream section plus notification settings.
 * @param {string} cwd - Working directory
 * @returns {{ upstream: object, notifications_enabled: boolean }}
 */
function loadUpstreamConfig(cwd) {
  const configPath = path.join(cwd, CONFIG_PATH);
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    return {
      ...(config.upstream || {}),
      notifications_enabled: config.upstream_notifications !== false, // default true
    };
  } catch {
    return { notifications_enabled: true };
  }
}

/**
 * Save upstream configuration to .planning/config.json.
 * Merges with existing config, preserving other sections.
 * @param {string} cwd - Working directory
 * @param {object} upstreamConfig - Upstream config to save
 */
function saveUpstreamConfig(cwd, upstreamConfig) {
  const configPath = path.join(cwd, CONFIG_PATH);
  let config = {};

  // Load existing config
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(content);
  } catch {
    // Start fresh if no config exists
  }

  // Merge upstream config
  config.upstream = upstreamConfig;

  // Ensure directory exists
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Get list of git remotes with their URLs.
 * @param {string} cwd - Working directory
 * @returns {{ name: string, url: string }[]}
 */
function getRemotes(cwd) {
  const result = execGit(cwd, ['remote', '-v']);
  if (!result.success || !result.stdout) {
    return [];
  }

  const remotes = new Map();
  const lines = result.stdout.split('\n');

  for (const line of lines) {
    const match = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)$/);
    if (match) {
      remotes.set(match[1], match[2]);
    }
  }

  return Array.from(remotes.entries()).map(([name, url]) => ({ name, url }));
}

// ─── Configure Command ────────────────────────────────────────────────────────

/**
 * Configure upstream remote.
 * Auto-detects from existing remotes if no URL provided.
 *
 * @param {string} cwd - Working directory
 * @param {string|null} url - Upstream URL (optional, auto-detect if not provided)
 * @param {object} options - { remote_name?: string }
 * @param {function} output - Output callback
 * @param {function} error - Error callback
 * @param {boolean} raw - Output as JSON
 */
function cmdUpstreamConfigure(cwd, url, options, output, error, raw) {
  const remoteName = options?.remote_name || DEFAULT_REMOTE_NAME;
  const remotes = getRemotes(cwd);

  // If no URL provided, try to auto-detect
  if (!url) {
    // Check if 'upstream' remote already exists
    const existingUpstream = remotes.find(r => r.name === 'upstream');
    if (existingUpstream) {
      url = existingUpstream.url;
    } else if (remotes.length === 1 && remotes[0].name !== 'origin') {
      // Single non-origin remote, suggest it
      url = remotes[0].url;
    } else if (remotes.length > 1) {
      // Multiple remotes - list them for user selection
      const remoteList = remotes
        .filter(r => r.name !== 'origin')
        .map((r, i) => `  ${i + 1}. ${r.name}: ${r.url}`)
        .join('\n');

      if (remoteList) {
        output({
          configured: false,
          reason: 'multiple_remotes',
          message: 'Multiple remotes found. Please specify URL or select:\n' + remoteList,
          remotes: remotes.filter(r => r.name !== 'origin'),
        }, raw, 'multiple_remotes');
        return;
      }
    }
  }

  // Still no URL - error
  if (!url) {
    error('No upstream URL provided and could not auto-detect. Usage: upstream configure <url>');
    return;
  }

  // Validate URL by testing git ls-remote
  const validateResult = execGit(cwd, ['ls-remote', '--exit-code', url, 'HEAD']);
  if (!validateResult.success) {
    output({
      configured: false,
      reason: 'invalid_url',
      url,
      error: `Could not access remote: ${validateResult.stderr}`,
    }, raw, 'invalid_url');
    return;
  }

  // Check if remote already exists
  const existingRemote = remotes.find(r => r.name === remoteName);

  if (existingRemote) {
    // Update existing remote
    const updateResult = execGit(cwd, ['remote', 'set-url', remoteName, url]);
    if (!updateResult.success) {
      error(`Failed to update remote: ${updateResult.stderr}`);
      return;
    }
  } else {
    // Add new remote
    const addResult = execGit(cwd, ['remote', 'add', remoteName, url]);
    if (!addResult.success) {
      error(`Failed to add remote: ${addResult.stderr}`);
      return;
    }
  }

  // Mirror to git config
  execGit(cwd, ['config', 'gsd.upstream.url', url]);

  // Save to config.json
  const upstreamConfig = loadUpstreamConfig(cwd);
  upstreamConfig.url = url;
  saveUpstreamConfig(cwd, upstreamConfig);

  output({
    configured: true,
    url,
    remote_name: remoteName,
    validated: true,
    action: existingRemote ? 'updated' : 'added',
  }, raw, 'configured');
}

// ─── Fetch Command ────────────────────────────────────────────────────────────

/**
 * Fetch upstream changes and update cache.
 *
 * @param {string} cwd - Working directory
 * @param {object} options - { prune?: boolean }
 * @param {function} output - Output callback
 * @param {function} error - Error callback
 * @param {boolean} raw - Output as JSON
 */
function cmdUpstreamFetch(cwd, options, output, error, raw) {
  const upstreamConfig = loadUpstreamConfig(cwd);

  // Check if upstream is configured
  if (!upstreamConfig.url) {
    error('Upstream not configured. Run: gsd-tools upstream configure <url>');
    return;
  }

  const remoteName = DEFAULT_REMOTE_NAME;
  const branch = options?.branch || DEFAULT_BRANCH;
  const pruneFlag = options?.prune ? '--prune' : '';

  // Run git fetch
  const fetchArgs = ['fetch', remoteName];
  if (pruneFlag) fetchArgs.push(pruneFlag);
  fetchArgs.push('--quiet');

  const fetchResult = execGit(cwd, fetchArgs);

  if (!fetchResult.success) {
    // Network error - return cached state with warning
    output({
      fetched: false,
      reason: 'network_error',
      error: fetchResult.stderr,
      cached_commits_behind: upstreamConfig.commits_behind || null,
      cached_last_fetch: upstreamConfig.last_fetch || null,
    }, raw, 'network_error');
    return;
  }

  // Count commits behind
  const countResult = execGit(cwd, ['rev-list', '--count', `HEAD..${remoteName}/${branch}`]);
  const commitsBehind = countResult.success ? parseInt(countResult.stdout, 10) : 0;

  // Get latest upstream commit SHA
  const shaResult = execGit(cwd, ['rev-parse', `${remoteName}/${branch}`]);
  const lastSha = shaResult.success ? shaResult.stdout : null;

  // Get latest upstream commit date
  const dateResult = execGit(cwd, ['log', '-1', '--format=%as', `${remoteName}/${branch}`]);
  const latestDate = dateResult.success ? dateResult.stdout : null;

  // Format date for display (e.g., "Feb 24")
  let formattedDate = null;
  if (latestDate) {
    try {
      const d = new Date(latestDate);
      formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      formattedDate = latestDate;
    }
  }

  // Update cache in config.json
  upstreamConfig.last_fetch = new Date().toISOString();
  upstreamConfig.commits_behind = commitsBehind;
  upstreamConfig.last_upstream_sha = lastSha;
  saveUpstreamConfig(cwd, upstreamConfig);

  output({
    fetched: true,
    commits_behind: commitsBehind,
    latest_date: formattedDate,
    last_sha: lastSha,
    message: commitsBehind > 0
      ? `Fetched ${commitsBehind} new commits. Run /gsd:sync-status for details.`
      : 'Fork is up to date with upstream.',
  }, raw, 'fetched');
}

// ─── Status Command ────────────────────────────────────────────────────────────

/**
 * Show upstream sync status with commits behind, file summary, and warnings.
 *
 * @param {string} cwd - Working directory
 * @param {object} options - { branch?: string }
 * @param {function} output - Output callback
 * @param {function} error - Error callback
 * @param {boolean} raw - Output as JSON
 */
function cmdUpstreamStatus(cwd, options, output, error, raw) {
  const upstreamConfig = loadUpstreamConfig(cwd);

  // Check if upstream is configured
  if (!upstreamConfig.url) {
    error('Upstream not configured. Run: gsd-tools upstream configure <url>');
    return;
  }

  const remoteName = DEFAULT_REMOTE_NAME;
  const branch = options?.branch || DEFAULT_BRANCH;

  // Check if cache is stale (>24 hours since last fetch)
  let cacheStale = false;
  if (upstreamConfig.last_fetch) {
    const lastFetchTime = new Date(upstreamConfig.last_fetch).getTime();
    const now = Date.now();
    cacheStale = (now - lastFetchTime) > CACHE_DURATION_MS;
  } else {
    cacheStale = true;
  }

  // Get commit count behind
  const countResult = execGit(cwd, ['rev-list', '--count', `HEAD..${remoteName}/${branch}`]);
  if (!countResult.success) {
    error(`Failed to count commits: ${countResult.stderr}. Try running 'gsd-tools upstream fetch' first.`);
    return;
  }
  const commitsBehind = parseInt(countResult.stdout, 10);

  // Handle zero state - up to date
  if (commitsBehind === 0) {
    const lastFetchDate = upstreamConfig.last_fetch
      ? formatDate(new Date(upstreamConfig.last_fetch))
      : 'never';

    const result = {
      commits_behind: 0,
      up_to_date: true,
      last_synced: lastFetchDate,
      cache_stale: cacheStale,
      warnings: {},
    };

    if (raw) {
      output(result, true);
    } else {
      output(result, false, `Up to date with upstream (last synced: ${lastFetchDate})`);
    }
    return;
  }

  // Get latest upstream commit date
  const dateResult = execGit(cwd, ['log', '-1', '--format=%as', `${remoteName}/${branch}`]);
  const latestDate = dateResult.success ? formatDate(new Date(dateResult.stdout)) : null;

  // Get file change summary
  const statResult = execGit(cwd, ['diff', '--stat', `HEAD..${remoteName}/${branch}`]);
  let filesChanged = 0;
  let statSummary = '';
  if (statResult.success && statResult.stdout) {
    const lines = statResult.stdout.split('\n');
    const summaryLine = lines[lines.length - 1];
    const fileMatch = summaryLine.match(/(\d+)\s+files?\s+changed/);
    if (fileMatch) {
      filesChanged = parseInt(fileMatch[1], 10);
    }
    statSummary = summaryLine.trim();
  }

  // Get directory breakdown
  const dirstatResult = execGit(cwd, ['diff', '--dirstat=files', `HEAD..${remoteName}/${branch}`]);
  const directories = [];
  if (dirstatResult.success && dirstatResult.stdout) {
    const lines = dirstatResult.stdout.split('\n');
    for (const line of lines) {
      const match = line.match(/\s*[\d.]+%\s+(.+)/);
      if (match) {
        directories.push(match[1].trim());
      }
    }
  }

  // Get file list if <=10 files changed
  let fileList = [];
  if (filesChanged > 0 && filesChanged <= 10) {
    const nameOnlyResult = execGit(cwd, ['diff', '--name-only', `HEAD..${remoteName}/${branch}`]);
    if (nameOnlyResult.success && nameOnlyResult.stdout) {
      fileList = nameOnlyResult.stdout.split('\n').filter(Boolean);
    }
  }

  // Check for uncommitted changes
  const statusResult = execGit(cwd, ['status', '--porcelain']);
  const hasUncommittedChanges = statusResult.success && statusResult.stdout.length > 0;

  // Check for unpushed commits
  const unpushedResult = execGit(cwd, ['rev-list', '--count', 'origin/main..HEAD']);
  const unpushedCommits = unpushedResult.success ? parseInt(unpushedResult.stdout, 10) : 0;

  // Build warnings
  const warnings = {};
  if (hasUncommittedChanges) {
    warnings.uncommitted_changes = true;
  }
  if (unpushedCommits > 0) {
    warnings.unpushed_commits = unpushedCommits;
  }

  // Build result
  const result = {
    commits_behind: commitsBehind,
    latest_upstream_date: latestDate,
    files_changed: filesChanged,
    directories: directories.slice(0, 5), // Top 5 directories
    file_list: fileList,
    warnings,
    cache_stale: cacheStale,
  };

  if (raw) {
    output(result, true);
  } else {
    // Format human-readable output per CONTEXT.md
    let text = `${commitsBehind} commits behind upstream`;
    if (latestDate) {
      text += ` (latest: ${latestDate})`;
    }
    text += '\n';

    if (filesChanged > 0) {
      if (filesChanged <= 10 && fileList.length > 0) {
        text += `${filesChanged} files changed:\n`;
        for (const file of fileList) {
          text += `  ${file}\n`;
        }
      } else if (directories.length > 0) {
        text += `${filesChanged} files changed in ${directories.slice(0, 3).join(', ')}`;
        if (directories.length > 3) {
          text += ` (+${directories.length - 3} more)`;
        }
        text += '\n';
      } else {
        text += `${filesChanged} files changed\n`;
      }
    }

    // Add warnings
    if (warnings.uncommitted_changes) {
      text += '\n\u26A0 Local has uncommitted changes \u2014 commit before sync';
    }
    if (warnings.unpushed_commits) {
      text += `\n\u26A0 ${warnings.unpushed_commits} unpushed commits to origin`;
    }

    output(result, false, text.trim());
  }
}

/**
 * Format a date for display (e.g., "Feb 24").
 * @param {Date} date - Date to format
 * @returns {string}
 */
function formatDate(date) {
  try {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return date.toISOString().split('T')[0];
  }
}

// ─── Conventional Commit Helpers ───────────────────────────────────────────────

/**
 * Parse a conventional commit subject line.
 * @param {string} subject - Commit subject line
 * @returns {{ type: string, description: string } | null}
 */
function parseConventionalCommit(subject) {
  const match = subject.match(CONVENTIONAL_PATTERN);
  if (match) {
    const [, type, description] = match;
    return { type: type.toLowerCase(), description };
  }
  return null;
}

/**
 * Group commits by conventional commit type.
 * @param {{ hash: string, author: string, date: string, subject: string }[]} commits
 * @returns {{ groups: Record<string, object[]>, other: object[] }}
 */
function groupCommitsByType(commits) {
  const groups = {};
  const other = [];

  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit.subject);
    if (parsed && COMMIT_TYPES[parsed.type]) {
      const type = parsed.type;
      if (!groups[type]) groups[type] = [];
      groups[type].push({
        ...commit,
        parsed_type: type,
        parsed_description: parsed.description,
      });
    } else {
      other.push(commit);
    }
  }

  return { groups, other };
}

/**
 * Truncate a string with ellipsis.
 * @param {string} str - String to truncate
 * @param {number} maxLen - Maximum length (default 60)
 * @returns {string}
 */
function truncateSubject(str, maxLen = 60) {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

// ─── Log Command ──────────────────────────────────────────────────────────────

/**
 * Show upstream commit log grouped by conventional commit type.
 *
 * @param {string} cwd - Working directory
 * @param {object} options - { branch?: string, limit?: number }
 * @param {function} output - Output callback
 * @param {function} error - Error callback
 * @param {boolean} raw - Output as JSON
 */
function cmdUpstreamLog(cwd, options, output, error, raw) {
  const upstreamConfig = loadUpstreamConfig(cwd);

  // Check if upstream is configured
  if (!upstreamConfig.url) {
    error('Upstream not configured. Run: gsd-tools upstream configure <url>');
    return;
  }

  const remoteName = DEFAULT_REMOTE_NAME;
  const branch = options?.branch || DEFAULT_BRANCH;

  // Get commits using parseable format: hash|author|date|subject
  const logResult = execGit(cwd, ['log', '--format=%h|%an|%as|%s', `HEAD..${remoteName}/${branch}`]);

  if (!logResult.success) {
    error(`Failed to get commit log: ${logResult.stderr}. Try running 'gsd-tools upstream fetch' first.`);
    return;
  }

  // Handle zero state
  if (!logResult.stdout || logResult.stdout.trim() === '') {
    const lastFetchDate = upstreamConfig.last_fetch
      ? formatDate(new Date(upstreamConfig.last_fetch))
      : 'never';

    const result = {
      total_commits: 0,
      grouped: false,
      groups: {},
      other: [],
      message: `Up to date with upstream (last synced: ${lastFetchDate})`,
    };

    if (raw) {
      output(result, true);
    } else {
      output(result, false, result.message);
    }
    return;
  }

  // Parse commit lines
  const lines = logResult.stdout.split('\n').filter(Boolean);
  const commits = lines.map(line => {
    const [hash, author, date, ...subjectParts] = line.split('|');
    return {
      hash: hash.trim(),
      author: author.trim(),
      date: date.trim(),
      subject: subjectParts.join('|').trim(), // Rejoin in case subject contains |
    };
  });

  // Group by conventional commit type
  const { groups, other } = groupCommitsByType(commits);

  // Check if any conventional commits were found
  const hasConventionalCommits = Object.keys(groups).length > 0;

  // Build result
  const result = {
    total_commits: commits.length,
    grouped: hasConventionalCommits,
    groups: {},
    other: [],
  };

  // Format groups for JSON output
  for (const [type, typeCommits] of Object.entries(groups)) {
    result.groups[type] = typeCommits.map(c => ({
      hash: c.hash,
      subject: c.parsed_description,
    }));
  }

  // Add non-conventional commits
  result.other = other.map(c => ({
    hash: c.hash,
    subject: c.subject,
  }));

  if (raw) {
    output(result, true);
  } else {
    // Format human-readable output per CONTEXT.md
    let text = '';

    if (hasConventionalCommits) {
      // Output grouped format
      // Sort types by order in COMMIT_TYPES
      const typeOrder = Object.keys(COMMIT_TYPES);
      const sortedTypes = Object.keys(groups).sort(
        (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
      );

      for (const type of sortedTypes) {
        const typeInfo = COMMIT_TYPES[type];
        const typeCommits = groups[type];
        text += `${typeInfo.emoji} ${typeInfo.label} (${typeCommits.length} commit${typeCommits.length === 1 ? '' : 's'})\n`;
        for (const commit of typeCommits) {
          text += `  ${commit.hash} ${truncateSubject(commit.subject)}\n`;
        }
        text += '\n';
      }

      // Add non-conventional commits at the end
      if (other.length > 0) {
        text += `Other (${other.length} commit${other.length === 1 ? '' : 's'})\n`;
        for (const commit of other) {
          text += `  ${commit.hash} ${truncateSubject(commit.subject)}\n`;
        }
        text += '\n';
      }
    } else {
      // Fallback to flat chronological list
      text = `${commits.length} commits (flat chronological list):\n\n`;
      for (const commit of commits) {
        text += `  ${commit.hash} ${truncateSubject(commit.subject)}\n`;
      }
    }

    output(result, false, text.trim());
  }
}

// ─── Notification Functions ───────────────────────────────────────────────────

/**
 * Check for upstream updates for session-start notification.
 * Uses cache for fast response, never throws errors.
 *
 * @param {string} cwd - Working directory
 * @param {object} options - { fetch?: boolean } - if true, attempt fresh fetch
 * @returns {{ enabled: boolean, commits_behind?: number, cached?: boolean, fetch_failed?: boolean, last_fetch?: string, notifications_enabled?: boolean, reason?: string }}
 */
function checkUpstreamNotification(cwd, options = {}) {
  const config = loadUpstreamConfig(cwd);

  // Check if upstream is configured
  if (!config.url) {
    return { enabled: false, reason: 'not_configured' };
  }

  // Check if notifications are disabled by user
  if (!config.notifications_enabled) {
    return {
      enabled: true,
      notifications_enabled: false,
      commits_behind: config.commits_behind || null,
      reason: 'disabled_by_user',
    };
  }

  // Check if cache is valid (within 24 hours)
  const now = Date.now();
  let cacheValid = false;
  if (config.last_fetch) {
    const lastFetchTime = new Date(config.last_fetch).getTime();
    cacheValid = (now - lastFetchTime) < CACHE_DURATION_MS;
  }

  // If cache is valid and no refresh requested, return cached value
  if (cacheValid && options.fetch !== true) {
    return {
      enabled: true,
      commits_behind: config.commits_behind || 0,
      cached: true,
      fetch_failed: false,
      last_fetch: config.last_fetch,
      notifications_enabled: true,
    };
  }

  // If refresh not requested and cache is stale, still return cached value
  if (options.fetch !== true) {
    return {
      enabled: true,
      commits_behind: config.commits_behind || null,
      cached: true,
      fetch_failed: false,
      last_fetch: config.last_fetch || null,
      notifications_enabled: true,
    };
  }

  // Attempt fresh fetch (only if explicitly requested)
  const fetchResult = execGit(cwd, ['fetch', DEFAULT_REMOTE_NAME, '--quiet']);

  if (!fetchResult.success) {
    // Network error - return cached value with fetch_failed flag
    return {
      enabled: true,
      commits_behind: config.commits_behind || null,
      cached: true,
      fetch_failed: true,
      last_fetch: config.last_fetch || null,
      notifications_enabled: true,
    };
  }

  // Fetch succeeded - count commits behind
  const countResult = execGit(cwd, ['rev-list', '--count', `HEAD..${DEFAULT_REMOTE_NAME}/${DEFAULT_BRANCH}`]);
  const commitsBehind = countResult.success ? parseInt(countResult.stdout, 10) : 0;

  // Update cache
  const configPath = path.join(cwd, CONFIG_PATH);
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const fullConfig = JSON.parse(content);
    fullConfig.upstream = fullConfig.upstream || {};
    fullConfig.upstream.last_fetch = new Date().toISOString();
    fullConfig.upstream.commits_behind = commitsBehind;
    fs.writeFileSync(configPath, JSON.stringify(fullConfig, null, 2) + '\n', 'utf-8');
  } catch {
    // Silently ignore cache update errors
  }

  return {
    enabled: true,
    commits_behind: commitsBehind,
    cached: false,
    fetch_failed: false,
    last_fetch: new Date().toISOString(),
    notifications_enabled: true,
  };
}

/**
 * Format the notification check result for session banner display.
 *
 * @param {{ enabled: boolean, commits_behind?: number, notifications_enabled?: boolean }} result
 * @returns {string|null} - Banner text or null if no notification needed
 */
function formatNotificationBanner(result) {
  if (!result.enabled) return null;
  if (!result.notifications_enabled) return null;
  if (result.commits_behind === null || result.commits_behind === undefined) return null;

  if (result.commits_behind === 0) {
    return 'Fork is up to date with upstream';
  }

  const s = result.commits_behind === 1 ? '' : 's';
  return `${result.commits_behind} upstream commit${s} available. Run /gsd:sync-status for details`;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Constants
  DEFAULT_REMOTE_NAME,
  DEFAULT_BRANCH,
  CACHE_DURATION_MS,
  CONFIG_PATH,
  COMMIT_TYPES,
  CONVENTIONAL_PATTERN,

  // Helper functions
  execGit,
  loadUpstreamConfig,
  saveUpstreamConfig,
  getRemotes,
  formatDate,
  parseConventionalCommit,
  groupCommitsByType,
  truncateSubject,

  // Commands
  cmdUpstreamConfigure,
  cmdUpstreamFetch,
  cmdUpstreamStatus,
  cmdUpstreamLog,

  // Notification functions
  checkUpstreamNotification,
  formatNotificationBanner,
};
