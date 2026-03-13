/**
 * GSD Interactive Module
 *
 * Interactive exploration mode for upstream commits.
 * Provides readline-based REPL for deep-diving into specific commits,
 * viewing diffs, predicted conflicts, related commits, and asking Claude questions.
 * Part of the GSD Upstream Sync feature (v1.1).
 */

const readline = require('readline');
const { execSync } = require('child_process');

// Import upstream module for conflict preview and commit functions
const upstream = require('./upstream.cjs');

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFF_PREVIEW_THRESHOLD = 50; // Lines threshold for smart preview

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
 * Load commit details (metadata and files) for a specific commit.
 * @param {string} cwd - Working directory
 * @param {string} hash - Commit hash
 * @returns {{ hash: string, subject: string, author: string, date: string, files: string[], body: string } | null}
 */
function loadCommitDetails(cwd, hash) {
  // Get commit metadata
  const logResult = execGit(cwd, [
    'log',
    '-1',
    '--format=%H|%an|%as|%s|%b',
    hash,
  ]);

  if (!logResult.success || !logResult.stdout) {
    return null;
  }

  const [fullHash, author, date, subject, ...bodyParts] = logResult.stdout.split('|');
  const body = bodyParts.join('|').trim();

  // Get files changed in commit
  const filesResult = execGit(cwd, [
    'diff-tree',
    '--no-commit-id',
    '--name-only',
    '-r',
    hash,
  ]);

  const files = filesResult.success && filesResult.stdout
    ? filesResult.stdout.split('\n').filter(Boolean)
    : [];

  return {
    hash: fullHash.trim(),
    subject: subject.trim(),
    author: author.trim(),
    date: date.trim(),
    files,
    body,
  };
}

/**
 * Get diff statistics for a commit.
 * @param {string} cwd - Working directory
 * @param {string} hash - Commit hash
 * @returns {{ totalLines: number, files: Array<{ file: string, added: number, removed: number }> }}
 */
function getDiffStats(cwd, hash) {
  const result = execGit(cwd, [
    'diff',
    '--numstat',
    `${hash}^..${hash}`,
  ]);

  if (!result.success || !result.stdout) {
    return { totalLines: 0, files: [] };
  }

  const files = [];
  let totalLines = 0;

  for (const line of result.stdout.split('\n').filter(Boolean)) {
    const [added, removed, file] = line.split('\t');
    const addedNum = added === '-' ? 0 : parseInt(added, 10);
    const removedNum = removed === '-' ? 0 : parseInt(removed, 10);
    files.push({ file, added: addedNum, removed: removedNum });
    totalLines += addedNum + removedNum;
  }

  return { totalLines, files };
}

/**
 * Show smart diff - summary for >50 lines, full diff otherwise.
 * @param {string} cwd - Working directory
 * @param {{ hash: string, files: string[] }} commit - Commit object
 * @returns {string} - Formatted diff output
 */
function showSmartDiff(cwd, commit) {
  const stats = getDiffStats(cwd, commit.hash);

  if (stats.totalLines > DIFF_PREVIEW_THRESHOLD) {
    // Show summary instead of full diff
    const lines = [
      `Diff too large (${stats.totalLines} lines changed). Showing summary:\n`,
    ];

    for (const file of stats.files) {
      const change = file.added > 0 && file.removed > 0
        ? `+${file.added}/-${file.removed}`
        : file.added > 0
          ? `+${file.added}`
          : `-${file.removed}`;
      lines.push(`  ${file.file} (${change})`);
    }

    lines.push(`\nUse 'diff <filename>' to see specific file diff.`);
    return lines.join('\n');
  }

  // Show full diff
  const diffResult = execGit(cwd, [
    'show',
    '--format=',
    '--color=never',
    commit.hash,
  ]);

  return diffResult.success ? diffResult.stdout : 'Unable to show diff.';
}

/**
 * Show diff for a specific file in a commit.
 * @param {string} cwd - Working directory
 * @param {{ hash: string }} commit - Commit object
 * @param {string} filename - File to show diff for
 * @returns {string} - File diff output
 */
function showFileDiff(cwd, commit, filename) {
  const diffResult = execGit(cwd, [
    'show',
    '--format=',
    '--color=never',
    commit.hash,
    '--',
    filename,
  ]);

  if (!diffResult.success || !diffResult.stdout) {
    return `No changes to '${filename}' in this commit.`;
  }

  return diffResult.stdout;
}

/**
 * Show files affected by a commit.
 * @param {{ files: string[] }} commit - Commit object with files array
 * @returns {string} - Formatted file list
 */
function showAffectedFiles(commit) {
  if (!commit.files || commit.files.length === 0) {
    return 'No files changed in this commit.';
  }

  const lines = [`${commit.files.length} files changed:\n`];
  for (const file of commit.files) {
    lines.push(`  ${file}`);
  }
  return lines.join('\n');
}

/**
 * Show predicted conflicts for a commit.
 * Uses upstream.getConflictPreview() to analyze potential conflicts.
 * @param {string} cwd - Working directory
 * @param {{ hash: string, files: string[] }} commit - Commit object
 * @returns {string} - Conflict preview output
 */
function showPredictedConflicts(cwd, commit) {
  // Get conflict preview from upstream module
  const preview = upstream.getConflictPreview(cwd);

  if (preview.error) {
    return `Cannot preview conflicts: ${preview.message || preview.error}`;
  }

  if (!preview.conflicts || preview.conflicts.length === 0) {
    return 'No conflicts predicted for this commit.';
  }

  // Filter conflicts to files in this commit
  const commitFiles = new Set(commit.files);
  const relevantConflicts = preview.conflicts.filter(c => commitFiles.has(c.file));

  if (relevantConflicts.length === 0) {
    return 'No conflicts predicted for files in this commit.';
  }

  const lines = [`${relevantConflicts.length} potential conflict(s):\n`];
  for (const conflict of relevantConflicts) {
    const riskLabel = conflict.risk_score >= 5 ? 'hard' : conflict.risk_score >= 2 ? 'moderate' : 'easy';
    lines.push(`  ${conflict.file} (${riskLabel})`);
    if (conflict.regions && conflict.regions.length > 0) {
      lines.push(`    ${conflict.regions.length} conflict region(s)`);
    }
  }

  return lines.join('\n');
}

/**
 * Show related commits - other commits that touch the same files.
 * @param {string} cwd - Working directory
 * @param {{ hash: string, files: string[] }} commit - Commit object
 * @returns {string} - Related commits output
 */
function showRelatedCommits(cwd, commit) {
  // Get all upstream commits
  const commits = upstream.getCommitsWithFiles(cwd);

  if (commits.length === 0) {
    return 'No other upstream commits available.';
  }

  const commitFiles = new Set(commit.files);
  const related = [];

  for (const other of commits) {
    if (other.hash === commit.hash || other.hash.startsWith(commit.hash.slice(0, 7))) {
      continue; // Skip self
    }

    // Check for overlapping files
    const overlap = (other.files || []).filter(f => commitFiles.has(f));
    if (overlap.length > 0) {
      related.push({
        hash: other.hash,
        subject: other.subject,
        overlap: overlap.length,
        files: overlap.slice(0, 3), // Show first 3
      });
    }
  }

  if (related.length === 0) {
    return 'No related commits found (no file overlap).';
  }

  // Sort by overlap count descending
  related.sort((a, b) => b.overlap - a.overlap);

  const lines = [`${related.length} related commit(s):\n`];
  for (const r of related.slice(0, 5)) { // Show top 5
    const truncated = r.subject.length > 50 ? r.subject.slice(0, 47) + '...' : r.subject;
    lines.push(`  ${r.hash.slice(0, 7)} ${truncated}`);
    lines.push(`    Overlaps ${r.overlap} file(s): ${r.files.join(', ')}${r.overlap > 3 ? '...' : ''}`);
  }

  if (related.length > 5) {
    lines.push(`  ... and ${related.length - 5} more`);
  }

  return lines.join('\n');
}

/**
 * Format a prompt for Claude to analyze a commit.
 * @param {string} cwd - Working directory
 * @param {{ hash: string, subject: string, author: string, date: string, files: string[], body: string }} commit - Commit details
 * @param {string} question - User's question
 * @returns {string} - Formatted prompt for Claude
 */
function askClaude(cwd, commit, question) {
  const stats = getDiffStats(cwd, commit.hash);

  // Get the diff content (limited to avoid huge outputs)
  let diffContent = '';
  if (stats.totalLines <= 200) {
    const diffResult = execGit(cwd, ['show', '--format=', '--color=never', commit.hash]);
    if (diffResult.success) {
      diffContent = diffResult.stdout;
    }
  }

  const prompt = `You are helping analyze an upstream commit for a fork sync operation.

## Commit Information

- **Hash:** ${commit.hash}
- **Author:** ${commit.author}
- **Date:** ${commit.date}
- **Subject:** ${commit.subject}
${commit.body ? `- **Body:** ${commit.body}` : ''}

## Files Changed (${commit.files.length})

${commit.files.map(f => `- ${f}`).join('\n')}

## Changes Summary

${stats.files.map(f => `- ${f.file}: +${f.added}/-${f.removed}`).join('\n')}

${diffContent ? `## Diff\n\n\`\`\`diff\n${diffContent}\n\`\`\`` : '(Diff too large to include - use diff command to inspect specific files)'}

## Question

${question}

Please provide a concise, helpful answer.`;

  return prompt;
}

// ─── Command Handlers ─────────────────────────────────────────────────────────

/**
 * Command definitions for explore REPL.
 */
const EXPLORE_COMMANDS = {
  files: {
    description: 'Show files changed in this commit',
    handler: (session) => {
      console.log(showAffectedFiles(session.commit));
    },
  },

  diff: {
    description: 'Show diff (or diff <filename> for specific file)',
    handler: (session, args) => {
      if (args.length > 0) {
        console.log(showFileDiff(session.cwd, session.commit, args[0]));
      } else {
        console.log(showSmartDiff(session.cwd, session.commit));
      }
    },
  },

  conflicts: {
    description: 'Show predicted conflicts',
    handler: (session) => {
      console.log(showPredictedConflicts(session.cwd, session.commit));
    },
  },

  related: {
    description: 'Show related commits (touch same files)',
    handler: (session) => {
      console.log(showRelatedCommits(session.cwd, session.commit));
    },
  },

  next: {
    description: 'Navigate to next commit in range',
    handler: (session) => {
      if (session.position >= session.commitList.length - 1) {
        console.log('Already at the last commit.');
        return;
      }

      session.position++;
      const newHash = session.commitList[session.position];
      const newCommit = loadCommitDetails(session.cwd, newHash);

      if (newCommit) {
        session.commit = newCommit;
        session.rl.setPrompt(`explore ${newHash.slice(0, 7)}> `);
        console.log(`\nMoved to commit ${newHash.slice(0, 7)}: ${newCommit.subject}`);
      } else {
        session.position--;
        console.log('Failed to load next commit.');
      }
    },
  },

  prev: {
    description: 'Navigate to previous commit',
    handler: (session) => {
      if (session.position <= 0) {
        console.log('Already at the first commit.');
        return;
      }

      session.position--;
      const newHash = session.commitList[session.position];
      const newCommit = loadCommitDetails(session.cwd, newHash);

      if (newCommit) {
        session.commit = newCommit;
        session.rl.setPrompt(`explore ${newHash.slice(0, 7)}> `);
        console.log(`\nMoved to commit ${newHash.slice(0, 7)}: ${newCommit.subject}`);
      } else {
        session.position++;
        console.log('Failed to load previous commit.');
      }
    },
  },

  ask: {
    description: 'Ask Claude a question about this commit',
    handler: (session, args) => {
      if (args.length === 0) {
        console.log('Usage: ask <question>');
        console.log('Example: ask What does this change do?');
        return;
      }

      const question = args.join(' ');
      const prompt = askClaude(session.cwd, session.commit, question);

      console.log('\n--- Copy the following prompt to Claude ---\n');
      console.log(prompt);
      console.log('\n--- End of prompt ---');
    },
  },

  help: {
    description: 'Show available commands',
    handler: () => {
      console.log('\nAvailable commands:\n');
      for (const [name, cmd] of Object.entries(EXPLORE_COMMANDS)) {
        console.log(`  ${name.padEnd(12)} ${cmd.description}`);
      }
      console.log('');
    },
  },

  quit: {
    description: 'Exit exploration',
    handler: (session) => {
      session.rl.close();
    },
  },

  q: {
    description: 'Exit exploration (alias)',
    handler: (session) => {
      EXPLORE_COMMANDS.quit.handler(session);
    },
  },
};

// ─── Session Management ───────────────────────────────────────────────────────

/**
 * Create an interactive exploration session for a commit.
 * @param {string} cwd - Working directory
 * @param {string} commitHash - Hash of commit to explore
 * @param {string[]} commitList - Full list of commit hashes for navigation
 * @returns {Promise<void>} - Resolves when session ends
 */
function createExploreSession(cwd, commitHash, commitList) {
  return new Promise((resolve) => {
    // Load commit details
    const commit = loadCommitDetails(cwd, commitHash);
    if (!commit) {
      console.error(`Could not load commit ${commitHash}`);
      resolve();
      return;
    }

    // Find position in commit list
    const position = commitList.findIndex(h => h === commitHash || h.startsWith(commitHash.slice(0, 7)));
    if (position === -1) {
      console.error(`Commit ${commitHash} not found in commit list`);
      resolve();
      return;
    }

    // Create readline interface
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `explore ${commitHash.slice(0, 7)}> `,
    });

    // Session state
    const session = {
      cwd,
      commit,
      commitList,
      position,
      rl,
    };

    // Show initial commit info
    console.log(`\nExploring commit ${commit.hash.slice(0, 7)}`);
    console.log(`  Author: ${commit.author}`);
    console.log(`  Date: ${commit.date}`);
    console.log(`  Subject: ${commit.subject}`);
    console.log(`  Files: ${commit.files.length} changed`);
    console.log(`  Position: ${position + 1} of ${commitList.length} upstream commits`);
    console.log('\nType "help" for available commands.\n');

    rl.prompt();

    // Handle line input
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        rl.prompt();
        return;
      }

      const [commandName, ...args] = trimmed.split(/\s+/);
      const command = EXPLORE_COMMANDS[commandName.toLowerCase()];

      if (command) {
        command.handler(session, args);
      } else {
        console.log(`Unknown command: ${commandName}. Type "help" for available commands.`);
      }

      // Prompt again unless quit was called
      if (!rl.closed) {
        rl.prompt();
      }
    });

    // Handle close
    rl.on('close', () => {
      console.log('Exploration ended.');
      resolve();
    });
  });
}

// ─── Module Exports ───────────────────────────────────────────────────────────

module.exports = {
  // Constants
  DIFF_PREVIEW_THRESHOLD,

  // Helper functions
  execGit,
  loadCommitDetails,
  getDiffStats,
  showSmartDiff,
  showFileDiff,
  showAffectedFiles,
  showPredictedConflicts,
  showRelatedCommits,
  askClaude,

  // Command handlers
  EXPLORE_COMMANDS,

  // Session management
  createExploreSession,
};
