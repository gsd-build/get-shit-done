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

// Risk scoring weights for conflict assessment
const RISK_FACTORS = {
  fileTypeWeights: {
    'md': 0.5,    // Markdown - easy to resolve
    'json': 0.7,  // Config - moderate
    'cjs': 1.0,   // Code - standard
    'js': 1.0,
    'ts': 1.2,    // TypeScript - slightly harder
  },
  smallConflict: 10,   // lines
  mediumConflict: 50,  // lines
};

// Binary file categories by risk level
const BINARY_CATEGORIES = {
  safe: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
         '.woff', '.woff2', '.ttf', '.eot', '.pdf'],
  review: ['.json.gz', '.zip', '.tar', '.gz', '.bz2', '.7z'],
  dangerous: ['.exe', '.dll', '.so', '.dylib', '.sh', '.bat', '.cmd'],
};

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

// Sync event types for logging to STATE.md
const SYNC_EVENTS = {
  FETCH: 'fetch',
  MERGE_START: 'merge-start',
  MERGE_COMPLETE: 'merge-complete',
  MERGE_FAILED: 'merge-failed',
  ABORT: 'abort',
  UPSTREAM_CONFIGURED: 'upstream-configured',
  UPSTREAM_URL_CHANGED: 'upstream-url-changed',
  BACKUP_CREATED: 'backup-created',
  ROLLBACK_EXECUTED: 'rollback-executed',
  CONFLICT_DETECTED: 'conflict-detected',
};

// Header for Sync History section in STATE.md
const SYNC_HISTORY_HEADER = `### Sync History

| Date | Event | Details |
|------|-------|---------|`;

// Backup branch naming prefix
const BACKUP_BRANCH_PREFIX = 'backup/pre-sync-';

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

/**
 * Get upstream commits with their affected files.
 * Uses git log with --name-only to retrieve commit metadata and file lists.
 *
 * @param {string} cwd - Working directory
 * @returns {{ hash: string, author: string, date: string, subject: string, files: string[] }[]}
 */
function getCommitsWithFiles(cwd) {
  const config = loadUpstreamConfig(cwd);

  // Check if upstream is configured
  if (!config.url) {
    return [];
  }

  const remoteName = DEFAULT_REMOTE_NAME;
  const branch = DEFAULT_BRANCH;

  // Get commits with format and file names
  // Format: hash|author|date|subject followed by blank line and file names
  const logResult = execGit(cwd, [
    'log',
    '--format=%h|%an|%as|%s',
    '--name-only',
    `HEAD..${remoteName}/${branch}`,
  ]);

  if (!logResult.success || !logResult.stdout || logResult.stdout.trim() === '') {
    return [];
  }

  // Parse the output - commits are separated by blank lines
  // Each commit block: metadata line, then file names (one per line)
  const lines = logResult.stdout.split('\n');
  const commits = [];
  let currentCommit = null;

  for (const line of lines) {
    if (line === '') {
      // Blank line - if we have a current commit with files, it's complete
      // The next non-blank line will be a new commit metadata line
      continue;
    }

    // Check if this is a metadata line (contains |)
    if (line.includes('|')) {
      // Save previous commit if exists
      if (currentCommit) {
        commits.push(currentCommit);
      }

      // Parse new commit metadata
      const [hash, author, date, ...subjectParts] = line.split('|');
      currentCommit = {
        hash: hash.trim(),
        author: author.trim(),
        date: date.trim(),
        subject: subjectParts.join('|').trim(), // Rejoin in case subject contains |
        files: [],
      };
    } else if (currentCommit) {
      // This is a file name
      currentCommit.files.push(line.trim());
    }
  }

  // Don't forget the last commit
  if (currentCommit) {
    commits.push(currentCommit);
  }

  return commits;
}

/**
 * Group commits by top-level directory they affect.
 * Multi-touch commits appear under each affected directory.
 * Implements adaptive depth: if >50% of commits cluster in one directory AND >5 commits total,
 * go one level deeper for that directory (capped at 2 levels).
 *
 * @param {{ hash: string, files: string[] }[]} commits - Commits with file lists
 * @returns {Map<string, Set<object>>} - Map of directory to Set of commits
 */
function groupCommitsByDirectory(commits) {
  const groups = new Map(); // directory -> Set of commits

  // First pass: group by top-level directory
  for (const commit of commits) {
    if (!commit.files || commit.files.length === 0) {
      // Commits with no files go to root
      const dir = '/';
      if (!groups.has(dir)) groups.set(dir, new Set());
      groups.get(dir).add(commit);
      continue;
    }

    for (const file of commit.files) {
      // Get top-level directory
      const dir = file.includes('/') ? file.split('/')[0] + '/' : '/';
      if (!groups.has(dir)) groups.set(dir, new Set());
      groups.get(dir).add(commit);
    }
  }

  // Second pass: adaptive depth for clustered directories
  // If >50% of commits in one dir AND >5 total commits, go deeper
  if (commits.length > 5) {
    const dirsToRefine = [];

    for (const [dir, commitSet] of groups) {
      if (dir === '/') continue; // Don't refine root
      if (commitSet.size > commits.length * 0.5) {
        dirsToRefine.push(dir);
      }
    }

    for (const dir of dirsToRefine) {
      refineGroupDepth(commits, groups, dir);
    }
  }

  return groups;
}

/**
 * Refine a directory group to one level deeper.
 * Called by groupCommitsByDirectory for clustered directories.
 *
 * @param {{ hash: string, files: string[] }[]} commits - All commits
 * @param {Map<string, Set<object>>} groups - Current groups (modified in place)
 * @param {string} dir - Directory to refine (e.g., "commands/")
 */
function refineGroupDepth(commits, groups, dir) {
  const dirWithoutSlash = dir.slice(0, -1); // Remove trailing slash
  const subGroups = new Map();

  // Find all commits that were in this directory
  const commitsInDir = groups.get(dir);
  if (!commitsInDir) return;

  // Regroup at next depth level
  for (const commit of commitsInDir) {
    for (const file of commit.files || []) {
      if (!file.startsWith(dirWithoutSlash + '/')) continue;

      // Get path after top directory
      const rest = file.slice(dirWithoutSlash.length + 1);
      const subDir = rest.includes('/')
        ? `${dirWithoutSlash}/${rest.split('/')[0]}/`
        : dir; // Keep at current level if no subdirectory

      if (!subGroups.has(subDir)) subGroups.set(subDir, new Set());
      subGroups.get(subDir).add(commit);
    }
  }

  // Only apply refinement if it actually splits the group
  if (subGroups.size > 1) {
    groups.delete(dir);
    for (const [subDir, subCommits] of subGroups) {
      groups.set(subDir, subCommits);
    }
  }
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

// ─── Sync History Logging ─────────────────────────────────────────────────────

/**
 * Format a date for sync history log entries.
 * Format: "YYYY-MM-DD HH:MM"
 * @param {Date} date - Date to format
 * @returns {string}
 */
function formatSyncHistoryDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * Append an entry to the Sync History section in STATE.md.
 * Creates the section if it doesn't exist (below Session Continuity).
 *
 * @param {string} cwd - Working directory
 * @param {string} event - Event type (from SYNC_EVENTS)
 * @param {string} details - Event details
 * @returns {{ success: boolean, error?: string }}
 */
function appendSyncHistoryEntry(cwd, event, details) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');

  try {
    // Read existing STATE.md content
    let content;
    try {
      content = fs.readFileSync(statePath, 'utf-8');
    } catch {
      return { success: false, error: 'STATE.md not found' };
    }

    // Format the new entry
    const now = new Date();
    const dateStr = formatSyncHistoryDate(now);
    const entry = `| ${dateStr} | ${event} | ${details} |`;

    // Check if Sync History section already exists
    if (content.includes('### Sync History')) {
      // Find the table header line ending with |---------|
      const headerPattern = /\|------\|-------\|---------\|/;
      const headerMatch = content.match(headerPattern);

      if (headerMatch) {
        // Insert new entry immediately after the header (newest first)
        const headerEnd = content.indexOf(headerMatch[0]) + headerMatch[0].length;
        content = content.slice(0, headerEnd) + '\n' + entry + content.slice(headerEnd);
      } else {
        // Malformed section - try to append after section header
        const sectionStart = content.indexOf('### Sync History');
        const nextSection = content.indexOf('\n## ', sectionStart + 1);
        const insertPoint = nextSection > 0 ? nextSection : content.length;
        content = content.slice(0, insertPoint) + '\n' + entry + content.slice(insertPoint);
      }
    } else {
      // Section doesn't exist - create it
      // Find the last --- separator in file
      const lastSeparator = content.lastIndexOf('\n---');

      if (lastSeparator > 0) {
        // Insert new section before the final separator
        content = content.slice(0, lastSeparator) +
          '\n\n' + SYNC_HISTORY_HEADER + '\n' + entry +
          content.slice(lastSeparator);
      } else {
        // No separator found - append to end
        content += '\n\n' + SYNC_HISTORY_HEADER + '\n' + entry + '\n';
      }
    }

    // Write updated STATE.md
    fs.writeFileSync(statePath, content, 'utf-8');
    return { success: true };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get sync history entries from STATE.md.
 *
 * @param {string} cwd - Working directory
 * @param {object} options - { limit?: number }
 * @returns {Array<{ date: string, event: string, details: string }>}
 */
function getSyncHistory(cwd, options = {}) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');

  try {
    const content = fs.readFileSync(statePath, 'utf-8');

    // Check if Sync History section exists
    if (!content.includes('### Sync History')) {
      return [];
    }

    // Find the section
    const sectionStart = content.indexOf('### Sync History');
    const sectionEnd = content.indexOf('\n## ', sectionStart + 1);
    const section = sectionEnd > 0
      ? content.slice(sectionStart, sectionEnd)
      : content.slice(sectionStart);

    // Parse table rows (skip header rows)
    const entries = [];
    const lines = section.split('\n');
    let inTable = false;

    for (const line of lines) {
      // Skip header rows
      if (line.startsWith('| Date') || line.startsWith('|---')) {
        inTable = true;
        continue;
      }

      // Parse data rows
      if (inTable && line.startsWith('|')) {
        const parts = line.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 3) {
          entries.push({
            date: parts[0],
            event: parts[1],
            details: parts[2],
          });
        }
      }
    }

    // Apply limit if specified
    if (options.limit && options.limit > 0) {
      return entries.slice(0, options.limit);
    }

    return entries;

  } catch {
    return [];
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

// ─── Analyze Command ──────────────────────────────────────────────────────────

/**
 * Format directory groups for human-readable output.
 * @param {Map<string, Set<object>>} groups - Directory to commits map
 * @returns {string}
 */
function formatDirectoryGroups(groups) {
  const folderEmoji = '\uD83D\uDCC1'; // folder emoji
  let text = '';

  for (const [dir, commitSet] of groups) {
    const commits = Array.from(commitSet);
    text += `${folderEmoji} ${dir} (${commits.length} commit${commits.length === 1 ? '' : 's'})\n`;
    for (const commit of commits) {
      text += `  ${commit.hash} ${truncateSubject(commit.subject)}\n`;
    }
    text += '\n';
  }

  return text;
}

/**
 * Analyze upstream commits grouped by directory or feature type.
 * Default: directory grouping. Use --by-feature for conventional commit grouping.
 *
 * @param {string} cwd - Working directory
 * @param {object} options - { by_feature?: boolean, branch?: string }
 * @param {function} output - Output callback
 * @param {function} error - Error callback
 * @param {boolean} raw - Output as JSON
 */
function cmdUpstreamAnalyze(cwd, options, output, error, raw) {
  const upstreamConfig = loadUpstreamConfig(cwd);

  // Check if upstream is configured
  if (!upstreamConfig.url) {
    error('Upstream not configured. Run: gsd-tools upstream configure <url>');
    return;
  }

  // Get commits with files
  const commits = getCommitsWithFiles(cwd);

  // Handle zero state - up to date
  if (commits.length === 0) {
    const lastFetchDate = upstreamConfig.last_fetch
      ? formatDate(new Date(upstreamConfig.last_fetch))
      : 'never';

    const result = {
      grouped_by: options?.by_feature ? 'feature' : 'directory',
      total_commits: 0,
      groups: {},
      message: `Up to date with upstream (last synced: ${lastFetchDate})`,
    };

    if (raw) {
      output(result, true);
    } else {
      output(result, false, result.message);
    }
    return;
  }

  // Check for --by-feature flag
  if (options?.by_feature) {
    // Use existing groupCommitsByType for conventional commit grouping
    const { groups, other } = groupCommitsByType(commits);

    // Check if any conventional commits were found
    const hasConventionalCommits = Object.keys(groups).length > 0;

    if (!hasConventionalCommits || other.length > commits.length * 0.5) {
      // Fallback to directory grouping with warning
      const dirGroups = groupCommitsByDirectory(commits);

      const result = {
        grouped_by: 'directory',
        reason: 'no_conventional_commits',
        total_commits: commits.length,
        groups: {},
      };

      // Convert Map to object for JSON
      for (const [dir, commitSet] of dirGroups) {
        result.groups[dir] = Array.from(commitSet).map(c => ({
          hash: c.hash,
          subject: c.subject,
        }));
      }

      if (raw) {
        output(result, true);
      } else {
        let text = 'Note: Few conventional commits found, falling back to directory grouping.\n\n';
        text += formatDirectoryGroups(dirGroups);
        output(result, false, text.trim());
      }
      return;
    }

    // Build result for feature grouping
    const result = {
      grouped_by: 'feature',
      total_commits: commits.length,
      groups: {},
      other: [],
    };

    // Format groups for JSON output
    for (const [type, typeCommits] of Object.entries(groups)) {
      result.groups[type] = typeCommits.map(c => ({
        hash: c.hash,
        subject: c.parsed_description || c.subject,
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
      // Format human-readable output
      let text = '';

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

      output(result, false, text.trim());
    }
    return;
  }

  // Default: directory grouping
  const dirGroups = groupCommitsByDirectory(commits);

  // Build result for directory grouping
  const result = {
    grouped_by: 'directory',
    total_commits: commits.length,
    groups: {},
  };

  // Convert Map to object for JSON
  for (const [dir, commitSet] of dirGroups) {
    result.groups[dir] = Array.from(commitSet).map(c => ({
      hash: c.hash,
      subject: c.subject,
    }));
  }

  if (raw) {
    output(result, true);
  } else {
    const text = formatDirectoryGroups(dirGroups);
    output(result, false, text.trim());
  }
}

// ─── Git Version and Conflict Preview Functions ───────────────────────────────

/**
 * Check Git version and determine if modern features are supported.
 * @param {string} cwd - Working directory
 * @returns {{ major: number, minor: number, supportsWriteTree: boolean }}
 */
function checkGitVersion(cwd) {
  const result = execGit(cwd, ['--version']);
  if (!result.success || !result.stdout) {
    return { major: 0, minor: 0, supportsWriteTree: false };
  }

  const match = result.stdout.match(/git version (\d+)\.(\d+)/);
  if (!match) {
    return { major: 0, minor: 0, supportsWriteTree: false };
  }

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);

  // merge-tree --write-tree requires Git 2.38+
  const supportsWriteTree = major > 2 || (major === 2 && minor >= 38);

  return { major, minor, supportsWriteTree };
}

/**
 * Get conflict preview using git merge-tree --write-tree.
 * @param {string} cwd - Working directory
 * @returns {{ conflicts: Array, clean?: boolean, tree_oid?: string, error?: string, message?: string }}
 */
function getConflictPreview(cwd) {
  const remoteName = DEFAULT_REMOTE_NAME;
  const branch = DEFAULT_BRANCH;

  // Check Git version first
  const gitVersion = checkGitVersion(cwd);
  if (!gitVersion.supportsWriteTree) {
    return {
      conflicts: [],
      error: 'git_version',
      message: `Git 2.38+ required for conflict preview (found ${gitVersion.major}.${gitVersion.minor})`,
    };
  }

  // Run git merge-tree --write-tree
  // Exit 0 = clean merge, non-zero = conflicts
  const result = execGit(cwd, ['merge-tree', '--write-tree', 'HEAD', `${remoteName}/${branch}`]);

  // Parse the output - first line is always the tree OID
  if (!result.stdout) {
    // If stdout is empty but command succeeded, it's clean
    if (result.success) {
      return { conflicts: [], clean: true };
    }
    return {
      conflicts: [],
      error: 'merge_tree_failed',
      message: result.stderr || 'merge-tree command failed',
    };
  }

  const lines = result.stdout.split('\n');
  const treeOid = lines[0];

  // If only one line (the OID) or command succeeded with clean merge
  if (lines.length <= 2 && result.success) {
    return { conflicts: [], clean: true, tree_oid: treeOid };
  }

  // Parse conflict output - look for CONFLICT markers and file paths
  const conflicts = [];
  let currentFile = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // CONFLICT (content): Merge conflict in <file>
    const conflictMatch = line.match(/^CONFLICT \([^)]+\): (?:Merge conflict in |.*?)\s*(.+)$/);
    if (conflictMatch) {
      const file = conflictMatch[1].trim();
      if (file && !conflicts.some(c => c.file === file)) {
        conflicts.push({ file, regions: [] });
      }
      continue;
    }

    // Auto-merging <file> (indicates file was processed)
    const autoMergeMatch = line.match(/^Auto-merging (.+)$/);
    if (autoMergeMatch) {
      // Just tracking, not necessarily a conflict
      continue;
    }
  }

  return {
    conflicts,
    clean: conflicts.length === 0,
    tree_oid: treeOid,
  };
}

/**
 * Get detailed conflict regions for specific files.
 * Parses conflict markers from merge-tree output.
 * @param {string} cwd - Working directory
 * @param {string[]} files - List of conflicted files
 * @returns {Array<{ file: string, regions: Array<{ start_line: number, end_line: number, ours: string, theirs: string }> }>}
 */
function getDetailedConflicts(cwd, files) {
  const remoteName = DEFAULT_REMOTE_NAME;
  const branch = DEFAULT_BRANCH;
  const results = [];

  for (const file of files) {
    // Use git show to get the merged content with conflict markers
    // Create a temporary merge to see the conflict markers
    const result = execGit(cwd, [
      'merge-tree',
      '--write-tree',
      '-z',
      'HEAD',
      `${remoteName}/${branch}`
    ]);

    // For detailed conflicts, we parse the conflict markers
    // The merge-tree output with -z gives us detailed info
    const regions = parseConflictRegions(result.stdout, file);

    results.push({ file, regions });
  }

  return results;
}

/**
 * Parse conflict regions from merge output.
 * @param {string} content - Content potentially containing conflict markers
 * @param {string} file - File path to match
 * @returns {Array<{ start_line: number, end_line: number, ours: string, theirs: string }>}
 */
function parseConflictRegions(content, file) {
  const regions = [];

  if (!content) return regions;

  // Look for conflict markers pattern
  const conflictPattern = /<<<<<<< [^\n]+\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [^\n]+/g;

  let match;
  let lineNum = 1;

  while ((match = conflictPattern.exec(content)) !== null) {
    const ours = match[1].trimEnd();
    const theirs = match[2].trimEnd();

    // Count lines to approximate position
    const beforeConflict = content.slice(0, match.index);
    const startLine = (beforeConflict.match(/\n/g) || []).length + 1;
    const conflictLines = match[0].split('\n').length;

    regions.push({
      start_line: startLine,
      end_line: startLine + conflictLines - 1,
      ours,
      theirs,
    });
  }

  return regions;
}

/**
 * Score the risk/difficulty of resolving a conflict.
 * @param {{ file: string, regions: Array }} conflict
 * @returns {'easy'|'moderate'|'hard'}
 */
function scoreConflictRisk(conflict) {
  const ext = conflict.file.split('.').pop().toLowerCase();
  const baseWeight = RISK_FACTORS.fileTypeWeights[ext] || 1.0;

  let score = 0;

  // Factor 1: Number of conflict regions in file
  score += (conflict.regions?.length || 1) * 0.5;

  // Factor 2: Size of conflicts (approximate from regions)
  let totalLines = 0;
  if (conflict.regions) {
    for (const region of conflict.regions) {
      const oursLines = (region.ours?.split('\n') || []).length;
      const theirsLines = (region.theirs?.split('\n') || []).length;
      totalLines += Math.max(oursLines, theirsLines);
    }
  }

  if (totalLines > RISK_FACTORS.mediumConflict) {
    score += 2;
  } else if (totalLines > RISK_FACTORS.smallConflict) {
    score += 1;
  }

  // Factor 3: File importance (GSD-specific)
  if (conflict.file.includes('STATE.md')) {
    score += 2; // Critical state file
  }
  if (conflict.file.includes('lib/')) {
    score += 0.5; // Core code
  }

  // Apply file type weight
  score *= baseWeight;

  // Map score to risk level
  if (score < 2) return 'easy';
  if (score < 5) return 'moderate';
  return 'hard';
}

/**
 * Calculate overall risk from all conflicts.
 * @param {Array<{ file: string, regions: Array }>} conflicts
 * @returns {'EASY'|'MODERATE'|'HARD'|null}
 */
function calculateOverallRisk(conflicts) {
  if (!conflicts || conflicts.length === 0) return null;

  const scores = conflicts.map(scoreConflictRisk);

  if (scores.some(s => s === 'hard')) return 'HARD';
  if (scores.some(s => s === 'moderate')) return 'MODERATE';
  return 'EASY';
}

// ─── Binary File Detection Functions ──────────────────────────────────────────

/**
 * Detect binary file changes in upstream.
 * Uses git diff --numstat where binary files show "- -" format.
 * @param {string} cwd - Working directory
 * @returns {{ safe: string[], review: string[], dangerous: string[], total: number }}
 */
function detectBinaryChanges(cwd) {
  const remoteName = DEFAULT_REMOTE_NAME;
  const branch = DEFAULT_BRANCH;

  const result = execGit(cwd, ['diff', '--numstat', `HEAD..${remoteName}/${branch}`]);

  const binaries = { safe: [], review: [], dangerous: [], total: 0 };

  if (!result.success || !result.stdout) {
    return binaries;
  }

  for (const line of result.stdout.split('\n').filter(Boolean)) {
    // Binary format: "-\t-\tpath/to/file"
    if (line.startsWith('-\t-\t')) {
      const file = line.slice(4);
      binaries.total++;

      // Get the file extension (handle multi-part extensions like .json.gz)
      const lowerFile = file.toLowerCase();

      // Check dangerous first (executables, scripts)
      const isDangerous = BINARY_CATEGORIES.dangerous.some(ext =>
        lowerFile.endsWith(ext)
      );
      if (isDangerous) {
        binaries.dangerous.push(file);
        continue;
      }

      // Check review (archives, compressed data)
      const needsReview = BINARY_CATEGORIES.review.some(ext =>
        lowerFile.endsWith(ext)
      );
      if (needsReview) {
        binaries.review.push(file);
        continue;
      }

      // Check safe (images, fonts, documents)
      const ext = '.' + file.split('.').pop().toLowerCase();
      if (BINARY_CATEGORIES.safe.includes(ext)) {
        binaries.safe.push(file);
        continue;
      }

      // Unknown binary - default to review
      binaries.review.push(file);
    }
  }

  return binaries;
}

/**
 * Format binary changes for human-readable output.
 * @param {{ safe: string[], review: string[], dangerous: string[], total: number }} binaries
 * @returns {string}
 */
function formatBinaryChanges(binaries) {
  if (binaries.total === 0) {
    return '';
  }

  const packageEmoji = '\uD83D\uDCE6'; // package
  const warningEmoji = '\u26A0\uFE0F';  // warning
  const dangerEmoji = '\uD83D\uDED1';   // stop sign

  let text = `${packageEmoji} Binary Changes (${binaries.total} file${binaries.total === 1 ? '' : 's'})\n\n`;

  if (binaries.safe.length > 0) {
    text += `Safe (${binaries.safe.length}):\n`;
    for (const file of binaries.safe) {
      text += `  ${file}\n`;
    }
    text += '\n';
  }

  if (binaries.review.length > 0) {
    text += `${warningEmoji} Review recommended (${binaries.review.length}):\n`;
    for (const file of binaries.review) {
      text += `  ${file}\n`;
    }
    text += '\n';
  }

  if (binaries.dangerous.length > 0) {
    text += `${dangerEmoji} DANGEROUS - Manual review required (${binaries.dangerous.length}):\n`;
    for (const file of binaries.dangerous) {
      text += `  ${file}\n`;
    }
    text += '\n';
  }

  return text.trim();
}

// ─── Structural Conflict Detection ────────────────────────────────────────────

/**
 * Get fork's modifications to a specific file.
 * Returns line change summary for display in conflict output.
 * @param {string} cwd - Working directory
 * @param {string} file - File path to check
 * @returns {{ added_lines: number, removed_lines: number }}
 */
function getForkModifications(cwd, file) {
  const result = execGit(cwd, ['diff', '--stat', `${DEFAULT_REMOTE_NAME}/${DEFAULT_BRANCH}..HEAD`, '--', file]);
  if (!result.success || !result.stdout) {
    return { added_lines: 0, removed_lines: 0 };
  }

  // Parse stat output: "file.cjs | 15 +++ --"
  // Or summary line: " 1 file changed, 12 insertions(+), 3 deletions(-)"
  const lines = result.stdout.split('\n');
  const summaryLine = lines[lines.length - 1];

  let added = 0;
  let removed = 0;

  const insertMatch = summaryLine.match(/(\d+)\s+insertions?\(\+\)/);
  const deleteMatch = summaryLine.match(/(\d+)\s+deletions?\(-\)/);

  if (insertMatch) added = parseInt(insertMatch[1], 10);
  if (deleteMatch) removed = parseInt(deleteMatch[1], 10);

  return { added_lines: added, removed_lines: removed };
}

/**
 * Detect file renames in upstream changes.
 * Uses -M90 threshold (90% similarity) per RESEARCH patterns.
 * @param {string} cwd - Working directory
 * @returns {Array<{ type: 'rename', similarity: number, from: string, to: string, fork_modified: boolean, modifications?: object }>}
 */
function detectRenames(cwd) {
  // Run: git diff -M90 --diff-filter=R --name-status HEAD..upstream/main
  const result = execGit(cwd, ['diff', '-M90', '--diff-filter=R', '--name-status', `HEAD..${DEFAULT_REMOTE_NAME}/${DEFAULT_BRANCH}`]);

  const renames = [];
  if (!result.success || !result.stdout) {
    return renames;
  }

  for (const line of result.stdout.split('\n').filter(Boolean)) {
    // Format: R090\told-path\tnew-path (tab-separated)
    const match = line.match(/^R(\d+)\t(.+)\t(.+)$/);
    if (match) {
      const from = match[2];
      const similarity = parseInt(match[1], 10);

      // Check if fork modified the source file
      const forkModResult = execGit(cwd, ['diff', '--name-only', `${DEFAULT_REMOTE_NAME}/${DEFAULT_BRANCH}..HEAD`, '--', from]);
      const forkModified = forkModResult.success && forkModResult.stdout.trim() !== '';

      const rename = {
        type: 'rename',
        similarity,
        from,
        to: match[3],
        fork_modified: forkModified,
      };

      // Get modification details if fork modified the file
      if (forkModified) {
        rename.modifications = getForkModifications(cwd, from);
      }

      renames.push(rename);
    }
  }

  return renames;
}

/**
 * Detect delete conflicts in upstream changes.
 * Only returns files where the fork has modifications (these are the conflicts).
 * @param {string} cwd - Working directory
 * @returns {Array<{ type: 'delete', file: string, fork_modified: true, modifications: object }>}
 */
function detectDeleteConflicts(cwd) {
  // Run: git diff --diff-filter=D --name-only HEAD..upstream/main
  const result = execGit(cwd, ['diff', '--diff-filter=D', '--name-only', `HEAD..${DEFAULT_REMOTE_NAME}/${DEFAULT_BRANCH}`]);

  const deletes = [];
  if (!result.success || !result.stdout) {
    return deletes;
  }

  for (const file of result.stdout.split('\n').filter(Boolean)) {
    // Check if fork modified this file
    const forkModResult = execGit(cwd, ['diff', '--name-only', `${DEFAULT_REMOTE_NAME}/${DEFAULT_BRANCH}..HEAD`, '--', file]);

    if (forkModResult.success && forkModResult.stdout.trim() !== '') {
      // Fork has modifications - this is a conflict
      const modifications = getForkModifications(cwd, file);
      deletes.push({
        type: 'delete',
        file,
        fork_modified: true,
        modifications,
      });
    }
  }

  return deletes;
}

/**
 * Detect all structural conflicts (renames + deletes) between HEAD and upstream.
 * Returns combined results with conflict indicators.
 * @param {string} cwd - Working directory
 * @returns {{ renames: Array, deletes: Array, total: number, has_conflicts: boolean }}
 */
function detectStructuralConflicts(cwd) {
  const renames = detectRenames(cwd);
  const deletes = detectDeleteConflicts(cwd);

  // Count conflicts: renames where fork modified + all deletes (already filtered)
  const renameConflicts = renames.filter(r => r.fork_modified);
  const total = renameConflicts.length + deletes.length;

  return {
    renames,
    deletes,
    total,
    has_conflicts: total > 0,
  };
}

// ─── Preview Command ──────────────────────────────────────────────────────────

/**
 * Generate a context-aware suggestion based on conflict details.
 * @param {{ file: string, regions: Array }} conflict
 * @returns {string}
 */
function generateConflictSuggestion(conflict) {
  const file = conflict.file;
  const regionCount = conflict.regions?.length || 1;

  // GSD-specific suggestions
  if (file.includes('STATE.md')) {
    return 'STATE.md conflicts typically involve progress tracking. Review carefully and consider keeping fork-specific data.';
  }

  if (file.includes('config.json') && file.includes('.planning')) {
    return 'Configuration conflict. Merge upstream settings but preserve fork-specific overrides.';
  }

  if (file.includes('lib/')) {
    if (regionCount === 1) {
      return 'Single conflict region in core module. Review changes carefully before accepting either version.';
    }
    return `Multiple conflict regions (${regionCount}). Consider reviewing each section individually.`;
  }

  // Generic suggestions based on file type
  const ext = file.split('.').pop().toLowerCase();

  if (ext === 'md') {
    return 'Documentation conflict. Usually safe to merge, keeping both sets of changes if applicable.';
  }

  if (ext === 'json') {
    return 'JSON conflict. Validate syntax after resolving. Consider using a JSON merge tool.';
  }

  // Default suggestion
  if (regionCount === 1) {
    return 'Single conflict region - straightforward to resolve manually.';
  }

  return `${regionCount} conflict regions. Review each section and test thoroughly after merge.`;
}

/**
 * Preview upstream merge conflicts and binary changes.
 * Provides risk scoring and context-aware suggestions.
 *
 * @param {string} cwd - Working directory
 * @param {object} options - { branch?: string }
 * @param {function} output - Output callback
 * @param {function} error - Error callback
 * @param {boolean} raw - Output as JSON
 */
function cmdUpstreamPreview(cwd, options, output, error, raw) {
  const upstreamConfig = loadUpstreamConfig(cwd);
  const remoteName = DEFAULT_REMOTE_NAME;
  const branch = options?.branch || DEFAULT_BRANCH;

  // Check if upstream is configured
  if (!upstreamConfig.url) {
    error('Upstream not configured. Run: gsd-tools upstream configure <url>');
    return;
  }

  // Get conflict preview
  const conflictResult = getConflictPreview(cwd);

  // Handle Git version error
  if (conflictResult.error === 'git_version') {
    output({
      error: 'git_version',
      message: conflictResult.message,
      suggestion: 'Upgrade to Git 2.38+ for conflict preview support.',
    }, raw, conflictResult.message);
    return;
  }

  // Get binary changes
  const binaries = detectBinaryChanges(cwd);

  // Get current upstream SHA for state tracking
  const shaResult = execGit(cwd, ['rev-parse', `${remoteName}/${branch}`]);
  const currentUpstreamSha = shaResult.success ? shaResult.stdout : null;

  // Get detailed conflicts for files that have them
  let detailedConflicts = conflictResult.conflicts;
  if (conflictResult.conflicts.length > 0) {
    const files = conflictResult.conflicts.map(c => c.file);
    detailedConflicts = getDetailedConflicts(cwd, files);

    // Merge the original conflict info with detailed regions
    detailedConflicts = conflictResult.conflicts.map(c => {
      const detailed = detailedConflicts.find(d => d.file === c.file);
      return {
        ...c,
        regions: detailed?.regions || c.regions || [],
      };
    });
  }

  // Calculate overall risk
  const overallRisk = calculateOverallRisk(detailedConflicts);

  // Determine if acknowledgment is required (dangerous binaries or review binaries)
  const requiresAcknowledgment = binaries.dangerous.length > 0 || binaries.review.length > 0;

  // Save analysis state to config.json
  upstreamConfig.analysis = {
    analyzed_at: new Date().toISOString(),
    analyzed_sha: currentUpstreamSha,
    conflict_count: detailedConflicts.length,
    binary_acknowledged: false,
    binary_files: [...binaries.safe, ...binaries.review, ...binaries.dangerous],
  };
  saveUpstreamConfig(cwd, upstreamConfig);

  // Build result object
  const result = {
    risk: overallRisk,
    conflicts: detailedConflicts.map(c => ({
      file: c.file,
      regions: c.regions,
      risk: scoreConflictRisk(c),
      suggestion: generateConflictSuggestion(c),
    })),
    binaries: {
      safe: binaries.safe,
      review: binaries.review,
      dangerous: binaries.dangerous,
    },
    analyzed_sha: currentUpstreamSha,
    requires_acknowledgment: requiresAcknowledgment,
    clean: conflictResult.clean && binaries.total === 0,
  };

  if (raw) {
    output(result, true);
    return;
  }

  // Format human-readable output
  const magnifierEmoji = '\uD83D\uDD0D'; // magnifying glass
  const lightbulbEmoji = '\uD83D\uDCA1'; // light bulb
  const checkEmoji = '\u2705';           // green check

  let text = '';

  // Handle clean merge case
  if (conflictResult.clean && binaries.total === 0) {
    text = `${checkEmoji} Merge is clean - no conflicts expected\n`;
    text += '\nNo binary file changes detected.';
    output(result, false, text);
    return;
  }

  // Show conflict preview if conflicts exist
  if (detailedConflicts.length > 0) {
    text += `${magnifierEmoji} Conflict Preview (Merge Risk: ${overallRisk})\n\n`;

    for (const conflict of detailedConflicts) {
      const risk = scoreConflictRisk(conflict);
      const regionCount = conflict.regions?.length || 0;
      text += `${conflict.file} \u2014 ${regionCount || '?'} conflict region${regionCount === 1 ? '' : 's'} [${risk}]\n`;

      // Show conflict markers if available
      if (conflict.regions && conflict.regions.length > 0) {
        for (const region of conflict.regions.slice(0, 2)) { // Limit to first 2 regions
          text += '<<<<<<< HEAD (fork)\n';
          if (region.ours) {
            text += `  ${region.ours.split('\n').slice(0, 5).join('\n  ')}\n`;
            if (region.ours.split('\n').length > 5) {
              text += '  ...\n';
            }
          }
          text += '=======\n';
          if (region.theirs) {
            text += `  ${region.theirs.split('\n').slice(0, 5).join('\n  ')}\n`;
            if (region.theirs.split('\n').length > 5) {
              text += '  ...\n';
            }
          }
          text += '>>>>>>> upstream\n\n';
        }

        if (conflict.regions.length > 2) {
          text += `  ... and ${conflict.regions.length - 2} more conflict regions\n\n`;
        }
      }

      // Add suggestion
      const suggestion = generateConflictSuggestion(conflict);
      text += `${lightbulbEmoji} Suggestion: ${suggestion}\n\n`;
    }
  } else if (!conflictResult.clean) {
    // Conflict preview failed but not clean
    text += `${magnifierEmoji} Conflict Preview\n\n`;
    text += 'Unable to determine specific conflicts. Run a test merge to see details.\n\n';
  }

  // Show binary changes if any
  if (binaries.total > 0) {
    text += '\n' + formatBinaryChanges(binaries);

    if (requiresAcknowledgment) {
      text += '\n\nAcknowledge binary changes before merge? (y/n)';
    }
  }

  output(result, false, text.trim());
}

// ─── Acknowledgment State Management ──────────────────────────────────────────

/**
 * Load analysis state from config.json.
 * Returns the upstream.analysis section with defaults if not exists.
 * @param {string} cwd - Working directory
 * @returns {{ structural_conflicts: Array, binary_acknowledged: boolean }}
 */
function loadAnalysisState(cwd) {
  const configPath = path.join(cwd, CONFIG_PATH);
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    if (config.upstream && config.upstream.analysis) {
      return config.upstream.analysis;
    }
  } catch {
    // Config doesn't exist yet
  }
  return { structural_conflicts: [], binary_acknowledged: false };
}

/**
 * Save analysis state to config.json.
 * Updates upstream.analysis section, preserving other sections.
 * @param {string} cwd - Working directory
 * @param {object} analysisState - Analysis state to save
 */
function saveAnalysisState(cwd, analysisState) {
  const configPath = path.join(cwd, CONFIG_PATH);
  let config = {};

  // Load existing config
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(content);
  } catch {
    // Start fresh if no config exists
  }

  // Ensure upstream section exists
  if (!config.upstream) {
    config.upstream = {};
  }

  // Update analysis section
  config.upstream.analysis = analysisState;

  // Ensure directory exists
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Acknowledge a specific conflict or all conflicts.
 * Updates upstream.analysis.structural_conflicts with acknowledgment state.
 * @param {string} cwd - Working directory
 * @param {number|null} conflictIndex - 1-based index of conflict to acknowledge (null for all)
 * @param {boolean} ackAll - If true, acknowledge all conflicts
 * @returns {{ success: boolean, acknowledged: number, message: string }}
 */
function acknowledgeConflict(cwd, conflictIndex, ackAll = false) {
  const analysisState = loadAnalysisState(cwd);
  const now = new Date().toISOString();

  if (!analysisState.structural_conflicts || analysisState.structural_conflicts.length === 0) {
    return { success: false, acknowledged: 0, message: 'No structural conflicts recorded' };
  }

  if (ackAll) {
    // Acknowledge all conflicts
    let count = 0;
    for (const conflict of analysisState.structural_conflicts) {
      if (!conflict.acknowledged) {
        conflict.acknowledged = true;
        conflict.acknowledged_at = now;
        count++;
      }
    }
    saveAnalysisState(cwd, analysisState);
    return { success: true, acknowledged: count, message: `Acknowledged ${count} conflict(s)` };
  }

  // Acknowledge specific conflict by index
  const index = conflictIndex - 1; // Convert to 0-based
  if (index < 0 || index >= analysisState.structural_conflicts.length) {
    return {
      success: false,
      acknowledged: 0,
      message: `Invalid conflict index: ${conflictIndex}. Valid range: 1-${analysisState.structural_conflicts.length}`,
    };
  }

  const conflict = analysisState.structural_conflicts[index];
  if (conflict.acknowledged) {
    return { success: true, acknowledged: 0, message: `Conflict ${conflictIndex} already acknowledged` };
  }

  conflict.acknowledged = true;
  conflict.acknowledged_at = now;
  saveAnalysisState(cwd, analysisState);

  return { success: true, acknowledged: 1, message: `Conflict ${conflictIndex} acknowledged` };
}

/**
 * Check if all conflicts have been acknowledged and merge is ready.
 * @param {string} cwd - Working directory
 * @returns {{ ready_to_merge: boolean, pending: string[], total_conflicts: number, acknowledged: number }}
 */
function checkAllAcknowledged(cwd) {
  const analysisState = loadAnalysisState(cwd);
  const pending = [];

  if (!analysisState.structural_conflicts || analysisState.structural_conflicts.length === 0) {
    // No conflicts recorded - check if there are any currently
    const detected = detectStructuralConflicts(cwd);
    if (detected.has_conflicts) {
      // There are conflicts but none recorded - not ready
      return {
        ready_to_merge: false,
        pending: ['Structural conflicts not analyzed yet'],
        total_conflicts: detected.total,
        acknowledged: 0,
      };
    }
    // No conflicts at all
    return { ready_to_merge: true, pending: [], total_conflicts: 0, acknowledged: 0 };
  }

  // Check structural conflicts
  let acknowledged = 0;
  for (let i = 0; i < analysisState.structural_conflicts.length; i++) {
    const conflict = analysisState.structural_conflicts[i];
    if (conflict.acknowledged) {
      acknowledged++;
    } else {
      const desc = conflict.type === 'rename'
        ? `Rename: ${conflict.from} -> ${conflict.to}`
        : `Delete: ${conflict.file}`;
      pending.push(`${i + 1}. ${desc}`);
    }
  }

  // Check binary acknowledgment if binary files exist
  if (analysisState.binary_files && analysisState.binary_files.length > 0) {
    if (!analysisState.binary_acknowledged) {
      pending.push(`Binary files (${analysisState.binary_files.length} files)`);
    }
  }

  return {
    ready_to_merge: pending.length === 0,
    pending,
    total_conflicts: analysisState.structural_conflicts.length,
    acknowledged,
  };
}

/**
 * Clear analysis state after merge completes.
 * Removes upstream.analysis section from config.json.
 * @param {string} cwd - Working directory
 */
function clearAnalysisState(cwd) {
  const configPath = path.join(cwd, CONFIG_PATH);

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);

    if (config.upstream && config.upstream.analysis) {
      delete config.upstream.analysis;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    }
  } catch {
    // Config doesn't exist, nothing to clear
  }
}

// ─── Resolve Command ──────────────────────────────────────────────────────────

/**
 * Sync detected conflicts with stored analysis state.
 * Updates config.json if conflicts have changed.
 * @param {string} cwd - Working directory
 * @param {{ renames: Array, deletes: Array }} detected - Detected conflicts
 * @param {{ structural_conflicts: Array }} analysisState - Current analysis state
 * @returns {boolean} - True if state was updated
 */
function syncAnalysisState(cwd, detected, analysisState) {
  // Build list of current conflicts
  const currentConflicts = [];

  for (const rename of detected.renames) {
    if (rename.fork_modified) {
      // Check if already exists in stored state
      const existing = analysisState.structural_conflicts?.find(
        c => c.type === 'rename' && c.from === rename.from
      );
      currentConflicts.push({
        type: 'rename',
        from: rename.from,
        to: rename.to,
        similarity: rename.similarity,
        acknowledged: existing?.acknowledged || false,
        acknowledged_at: existing?.acknowledged_at || null,
      });
    }
  }

  for (const del of detected.deletes) {
    const existing = analysisState.structural_conflicts?.find(
      c => c.type === 'delete' && c.file === del.file
    );
    currentConflicts.push({
      type: 'delete',
      file: del.file,
      acknowledged: existing?.acknowledged || false,
      acknowledged_at: existing?.acknowledged_at || null,
    });
  }

  // Check if state needs updating
  const storedCount = analysisState.structural_conflicts?.length || 0;
  const currentCount = currentConflicts.length;

  // Update if counts differ or we have no stored conflicts but do have current ones
  if (storedCount !== currentCount || (storedCount === 0 && currentCount > 0)) {
    analysisState.structural_conflicts = currentConflicts;
    analysisState.analyzed_at = new Date().toISOString();
    saveAnalysisState(cwd, analysisState);
    return true;
  }

  return false;
}

/**
 * Resolve structural conflicts command.
 * Supports list/acknowledge/status modes for rename/delete conflict resolution workflow.
 *
 * @param {string} cwd - Working directory
 * @param {object} options - { list?: boolean, acknowledge?: number, acknowledge_all?: boolean, status?: boolean }
 * @param {function} output - Output callback
 * @param {function} error - Error callback
 * @param {boolean} raw - Output as JSON
 */
function cmdUpstreamResolve(cwd, options, output, error, raw) {
  const upstreamConfig = loadUpstreamConfig(cwd);

  // Check if upstream is configured
  if (!upstreamConfig.url) {
    error('Upstream not configured. Run: gsd-tools upstream configure <url>');
    return;
  }

  // Emojis for output
  const warningEmoji = '\u26A0\uFE0F';   // warning
  const checkEmoji = '\u2705';          // check mark
  const arrowEmoji = '\u2192';          // right arrow

  // Detect current structural conflicts
  const detected = detectStructuralConflicts(cwd);

  // Load existing analysis state
  let analysisState = loadAnalysisState(cwd);

  // Sync detected conflicts with analysis state
  // If detection results changed, update the stored state
  const needsUpdate = syncAnalysisState(cwd, detected, analysisState);
  if (needsUpdate) {
    analysisState = loadAnalysisState(cwd);
  }

  // Handle status mode
  if (options?.status) {
    const readiness = checkAllAcknowledged(cwd);

    if (raw) {
      output({
        ready_to_merge: readiness.ready_to_merge,
        total_conflicts: readiness.total_conflicts,
        acknowledged: readiness.acknowledged,
        pending: readiness.pending,
      }, true);
    } else {
      let text = '';
      if (readiness.ready_to_merge) {
        text = `${checkEmoji} All structural conflicts acknowledged. Ready to merge.`;
      } else {
        text = `${warningEmoji} Not ready to merge.\n\n`;
        text += `Conflicts: ${readiness.acknowledged}/${readiness.total_conflicts} acknowledged\n`;
        if (readiness.pending.length > 0) {
          text += '\nPending:\n';
          for (const item of readiness.pending) {
            text += `  ${item}\n`;
          }
        }
      }
      output({ ...readiness }, false, text.trim());
    }
    return;
  }

  // Handle acknowledge mode
  if (options?.acknowledge !== undefined || options?.acknowledge_all) {
    const result = acknowledgeConflict(
      cwd,
      options.acknowledge_all ? null : options.acknowledge,
      !!options.acknowledge_all
    );

    if (raw) {
      output(result, true);
    } else {
      let text = result.message;
      if (result.success && result.acknowledged > 0) {
        // Show remaining count
        const readiness = checkAllAcknowledged(cwd);
        const remaining = readiness.total_conflicts - readiness.acknowledged;
        if (remaining > 0) {
          text += `\n${remaining} conflict(s) remaining.`;
        } else {
          text += `\n${checkEmoji} All conflicts acknowledged. Ready to merge.`;
        }
      }
      output(result, false, text);
    }
    return;
  }

  // Default: list mode
  // Handle zero state - no structural conflicts
  if (!detected.has_conflicts) {
    const result = {
      conflicts: [],
      ready_to_merge: true,
      pending_count: 0,
    };

    if (raw) {
      output(result, true);
    } else {
      output(result, false, `${checkEmoji} No structural conflicts detected.`);
    }
    return;
  }

  // Build conflicts list with acknowledgment status
  const conflicts = [];
  let id = 1;

  // Add renames (only those where fork has modifications)
  for (const rename of detected.renames) {
    if (rename.fork_modified) {
      const storedConflict = analysisState.structural_conflicts?.find(
        c => c.type === 'rename' && c.from === rename.from
      );
      conflicts.push({
        id: id++,
        type: 'rename',
        from: rename.from,
        to: rename.to,
        similarity: rename.similarity,
        modifications: rename.modifications,
        acknowledged: !!storedConflict?.acknowledged,
        acknowledged_at: storedConflict?.acknowledged_at || null,
      });
    }
  }

  // Add deletes
  for (const del of detected.deletes) {
    const storedConflict = analysisState.structural_conflicts?.find(
      c => c.type === 'delete' && c.file === del.file
    );
    conflicts.push({
      id: id++,
      type: 'delete',
      file: del.file,
      modifications: del.modifications,
      acknowledged: !!storedConflict?.acknowledged,
      acknowledged_at: storedConflict?.acknowledged_at || null,
    });
  }

  const pendingCount = conflicts.filter(c => !c.acknowledged).length;
  const result = {
    conflicts,
    ready_to_merge: pendingCount === 0,
    pending_count: pendingCount,
  };

  if (raw) {
    output(result, true);
    return;
  }

  // Format human-readable output per CONTEXT.md
  let text = `${warningEmoji} STRUCTURAL CONFLICTS \u2014 Must resolve before merge\n\n`;

  for (const conflict of conflicts) {
    const status = conflict.acknowledged ? `[${checkEmoji} acknowledged]` : '[pending]';

    if (conflict.type === 'rename') {
      text += `${conflict.id}. POSSIBLE RENAME (${conflict.similarity}% similar)\n`;
      text += `   ${conflict.from} ${arrowEmoji} ${conflict.to}\n`;
      if (conflict.modifications) {
        const mods = conflict.modifications;
        const changes = [];
        if (mods.added_lines > 0) changes.push(`+${mods.added_lines} lines`);
        if (mods.removed_lines > 0) changes.push(`-${mods.removed_lines} lines`);
        if (changes.length > 0) {
          text += `   Your changes: ${changes.join(', ')}\n`;
        }
      }
      text += `   Status: ${status}\n\n`;
    } else {
      text += `${conflict.id}. DELETE CONFLICT\n`;
      text += `   Upstream deleted: ${conflict.file}\n`;
      if (conflict.modifications) {
        const mods = conflict.modifications;
        text += `   Your version has modifications: +${mods.added_lines} lines, -${mods.removed_lines} lines\n`;
      }
      text += `   Action required: Acknowledge loss or extract changes first\n`;
      text += `   Status: ${status}\n\n`;
    }
  }

  text += `Run /gsd:sync-resolve --ack <N> to acknowledge conflict N\n`;
  text += `Run /gsd:sync-resolve --ack-all to acknowledge all`;

  output(result, false, text.trim());
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
  RISK_FACTORS,
  BINARY_CATEGORIES,
  SYNC_EVENTS,
  BACKUP_BRANCH_PREFIX,

  // Helper functions
  execGit,
  loadUpstreamConfig,
  saveUpstreamConfig,
  getRemotes,
  getCommitsWithFiles,
  groupCommitsByDirectory,
  formatDate,
  parseConventionalCommit,
  groupCommitsByType,
  truncateSubject,

  // Sync history logging functions
  appendSyncHistoryEntry,
  getSyncHistory,

  // Conflict preview functions
  checkGitVersion,
  getConflictPreview,
  getDetailedConflicts,
  scoreConflictRisk,
  calculateOverallRisk,

  // Binary detection functions
  detectBinaryChanges,
  formatBinaryChanges,

  // Structural conflict detection
  detectStructuralConflicts,

  // Acknowledgment state management
  loadAnalysisState,
  saveAnalysisState,
  acknowledgeConflict,
  checkAllAcknowledged,
  clearAnalysisState,

  // Commands
  cmdUpstreamConfigure,
  cmdUpstreamFetch,
  cmdUpstreamStatus,
  cmdUpstreamLog,
  cmdUpstreamAnalyze,
  cmdUpstreamPreview,
  cmdUpstreamResolve,

  // Notification functions
  checkUpstreamNotification,
  formatNotificationBanner,
};
