/**
 * Profile Pipeline — session scanning, message extraction, and sampling
 *
 * Reads Claude Code session history (read-only) to extract user messages
 * for behavioral profiling. Three commands:
 *   - scan-sessions: list all projects and sessions
 *   - extract-messages: extract user messages from a specific project
 *   - profile-sample: multi-project sampling with recency weighting
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { output, error, safeReadFile, reapStaleTempFiles } = require('./core.cjs');

// ─── Session I/O Helpers ──────────────────────────────────────────────────────

function getSessionsDir(overridePath) {
  const dir = overridePath || path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(dir)) return null;
  return dir;
}

function scanProjectDir(projectDirPath) {
  const entries = fs.readdirSync(projectDirPath);
  const sessions = [];

  for (const entry of entries) {
    if (!entry.endsWith('.jsonl')) continue;
    const sessionId = entry.replace('.jsonl', '');
    const filePath = path.join(projectDirPath, entry);
    const stat = fs.statSync(filePath);

    sessions.push({
      sessionId,
      filePath,
      size: stat.size,
      modified: stat.mtime,
    });
  }

  sessions.sort((a, b) => b.modified - a.modified);
  return sessions;
}

function readSessionIndex(projectDirPath) {
  try {
    const indexPath = path.join(projectDirPath, 'sessions-index.json');
    const raw = fs.readFileSync(indexPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const entries = new Map();
    for (const entry of (parsed.entries || [])) {
      if (entry.sessionId) {
        entries.set(entry.sessionId, entry);
      }
    }
    return { originalPath: parsed.originalPath || null, entries };
  } catch {
    return { originalPath: null, entries: new Map() };
  }
}

function getProjectName(projectDirName, indexData, firstRecordCwd) {
  if (indexData && indexData.originalPath) {
    return path.basename(indexData.originalPath);
  }
  if (firstRecordCwd) {
    return path.basename(firstRecordCwd);
  }
  return projectDirName;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}

function formatProjectTable(projects) {
  let out = '';
  out += 'Project'.padEnd(35) + 'Sessions'.padEnd(10) + 'Size'.padEnd(10) + 'Last Active\n';
  out += '-'.repeat(75) + '\n';
  for (const p of projects) {
    const name = p.name.length > 33 ? p.name.substring(0, 30) + '...' : p.name;
    out += name.padEnd(35) + String(p.sessionCount).padEnd(10) +
           p.totalSizeHuman.padEnd(10) + p.lastActive + '\n';
  }
  return out;
}

function formatSessionTable(sessions) {
  let out = '';
  out += '  Session ID'.padEnd(42) + 'Size'.padEnd(10) + 'Modified\n';
  out += '  ' + '-'.repeat(70) + '\n';
  for (const s of sessions) {
    const id = s.sessionId.length > 38 ? s.sessionId.substring(0, 35) + '...' : s.sessionId;
    out += '  ' + id.padEnd(40) + formatBytes(s.size).padEnd(10) +
           new Date(s.modified).toISOString().replace('T', ' ').substring(0, 19) + '\n';
  }
  return out;
}

// ─── Message Extraction Helpers ───────────────────────────────────────────────

function isGenuineUserMessage(record) {
  if (record.type !== 'user') return false;
  if (record.userType !== 'external') return false;
  if (record.isMeta === true) return false;
  if (record.isSidechain === true) return false;
  const content = record.message?.content;
  if (typeof content !== 'string') return false;
  if (content.length === 0) return false;
  if (content.startsWith('<local-command')) return false;
  if (content.startsWith('<command-')) return false;
  if (content.startsWith('<task-notification')) return false;
  if (content.startsWith('<local-command-stdout')) return false;
  return true;
}

function truncateContent(content, maxLen = 2000) {
  if (content.length <= maxLen) return content;
  return content.substring(0, maxLen) + '... [truncated]';
}

async function streamExtractMessages(filePath, filterFn, maxMessages = 300) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
    terminal: false,
  });

  const messages = [];
  const sessionId = path.basename(filePath, '.jsonl');

  for await (const line of rl) {
    if (messages.length >= maxMessages) break;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (!filterFn(record)) continue;
    messages.push({
      sessionId,
      projectPath: record.cwd || null,
      timestamp: record.timestamp || null,
      content: truncateContent(record.message.content),
    });
  }

  return messages;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function cmdScanSessions(overridePath, options, raw) {
  const sessionsDir = getSessionsDir(overridePath);
  if (!sessionsDir) {
    const searchedPath = overridePath || '~/.claude/projects';
    error(`No Claude Code sessions found at ${searchedPath}.${overridePath ? '' : ' Is Claude Code installed?'}`);
  }

  process.stderr.write('Reading your session history (read-only, nothing is modified or sent anywhere)...\n');

  let projectDirs;
  try {
    projectDirs = fs.readdirSync(sessionsDir).filter(entry => {
      const fullPath = path.join(sessionsDir, entry);
      try {
        return fs.statSync(fullPath).isDirectory();
      } catch {
        return false;
      }
    });
  } catch (err) {
    error(`Cannot read sessions directory: ${err.message}`);
  }

  const projects = [];

  for (const dirName of projectDirs) {
    const projectPath = path.join(sessionsDir, dirName);
    const sessions = scanProjectDir(projectPath);
    if (sessions.length === 0) continue;

    const indexData = readSessionIndex(projectPath);
    const projectName = getProjectName(dirName, indexData);

    if (indexData.entries.size === 0 && !options.json) {
      process.stderr.write(`Index not found for ${projectName}, scanning directory...\n`);
    }

    const totalSize = sessions.reduce((sum, s) => sum + s.size, 0);
    const lastActive = sessions[0].modified.toISOString();
    const oldest = sessions[sessions.length - 1].modified.toISOString();
    const newest = sessions[0].modified.toISOString();

    const project = {
      name: projectName,
      directory: dirName,
      sessionCount: sessions.length,
      totalSize,
      totalSizeHuman: formatBytes(totalSize),
      lastActive: lastActive.replace('T', ' ').substring(0, 19),
      dateRange: { first: oldest, last: newest },
    };

    if (options.verbose) {
      project.sessions = sessions.map(s => {
        const indexed = indexData.entries.get(s.sessionId);
        const session = {
          sessionId: s.sessionId,
          size: s.size,
          sizeHuman: formatBytes(s.size),
          modified: s.modified.toISOString(),
        };
        if (indexed) {
          if (indexed.summary) session.summary = indexed.summary;
          if (indexed.messageCount !== undefined) session.messageCount = indexed.messageCount;
          if (indexed.created) session.created = indexed.created;
        }
        return session;
      });
    }

    projects.push(project);
  }

  projects.sort((a, b) => b.dateRange.last.localeCompare(a.dateRange.last));

  if (options.json || raw) {
    output(projects, raw);
  } else {
    process.stdout.write('\n' + formatProjectTable(projects));
    if (options.verbose) {
      for (const p of projects) {
        process.stdout.write(`\n  ${p.name} (${p.sessionCount} sessions):\n`);
        if (p.sessions) {
          process.stdout.write(formatSessionTable(p.sessions));
        }
      }
    }
    process.stdout.write(`\nTotal: ${projects.length} projects\n`);
    process.exit(0);
  }
}

async function cmdExtractMessages(projectArg, options, raw, overridePath) {
  const sessionsDir = getSessionsDir(overridePath);
  if (!sessionsDir) {
    const searchedPath = overridePath || '~/.claude/projects';
    error(`No Claude Code sessions found at ${searchedPath}.${overridePath ? '' : ' Is Claude Code installed?'}`);
  }

  let projectDirs;
  try {
    projectDirs = fs.readdirSync(sessionsDir).filter(entry => {
      const fullPath = path.join(sessionsDir, entry);
      try {
        return fs.statSync(fullPath).isDirectory();
      } catch {
        return false;
      }
    });
  } catch (err) {
    error(`Cannot read sessions directory: ${err.message}`);
  }

  let matchedDir = null;
  let matchedName = null;

  for (const dirName of projectDirs) {
    if (dirName === projectArg) {
      matchedDir = dirName;
      break;
    }
  }

  if (!matchedDir) {
    const lowerArg = projectArg.toLowerCase();
    const matches = projectDirs.filter(d => d.toLowerCase().includes(lowerArg));
    if (matches.length === 1) {
      matchedDir = matches[0];
    } else if (matches.length > 1) {
      const exactNameMatches = [];
      for (const dirName of matches) {
        const indexData = readSessionIndex(path.join(sessionsDir, dirName));
        const pName = getProjectName(dirName, indexData);
        if (pName.toLowerCase() === lowerArg) {
          exactNameMatches.push({ dirName, name: pName });
        }
      }
      if (exactNameMatches.length === 1) {
        matchedDir = exactNameMatches[0].dirName;
        matchedName = exactNameMatches[0].name;
      } else {
        const names = matches.map(d => {
          const idx = readSessionIndex(path.join(sessionsDir, d));
          return `  - ${getProjectName(d, idx)} (${d})`;
        });
        error(`Multiple projects match "${projectArg}":\n${names.join('\n')}\nBe more specific.`);
      }
    }
  }

  if (!matchedDir) {
    const available = projectDirs.map(d => {
      const idx = readSessionIndex(path.join(sessionsDir, d));
      return `  - ${getProjectName(d, idx)}`;
    });
    error(`No project matching "${projectArg}". Available projects:\n${available.join('\n')}`);
  }

  const projectPath = path.join(sessionsDir, matchedDir);
  const indexData = readSessionIndex(projectPath);
  const projectName = matchedName || getProjectName(matchedDir, indexData);

  process.stderr.write('Reading your session history (read-only, nothing is modified or sent anywhere)...\n');

  let sessions = scanProjectDir(projectPath);

  if (options.sessionId) {
    sessions = sessions.filter(s => s.sessionId === options.sessionId);
    if (sessions.length === 0) {
      error(`Session "${options.sessionId}" not found in project "${projectName}".`);
    }
  }

  if (options.limit && options.limit > 0) {
    sessions = sessions.slice(0, options.limit);
  }

  reapStaleTempFiles('gsd-pipeline-', { dirsOnly: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-pipeline-'));
  const outputPath = path.join(tmpDir, 'extracted-messages.jsonl');

  let sessionsProcessed = 0;
  let sessionsSkipped = 0;
  let messagesExtracted = 0;
  let messagesTruncated = 0;
  const total = sessions.length;
  const batchLimit = 300;

  for (let i = 0; i < sessions.length; i++) {
    if (messagesExtracted >= batchLimit) break;

    const session = sessions[i];
    process.stderr.write(`\rProcessing session ${i + 1}/${total}...`);

    try {
      const remaining = batchLimit - messagesExtracted;
      const msgs = await streamExtractMessages(session.filePath, isGenuineUserMessage, remaining);
      for (const msg of msgs) {
        fs.appendFileSync(outputPath, JSON.stringify(msg) + '\n');
        messagesExtracted++;
        if (msg.content.endsWith('... [truncated]')) {
          messagesTruncated++;
        }
      }
      sessionsProcessed++;
    } catch (err) {
      sessionsSkipped++;
      process.stderr.write(`\nWarning: Skipped session ${session.sessionId}: ${err.message}\n`);
    }
  }

  process.stderr.write('\r' + ' '.repeat(60) + '\r');

  const result = {
    output_file: outputPath,
    project: projectName,
    sessions_processed: sessionsProcessed,
    sessions_skipped: sessionsSkipped,
    messages_extracted: messagesExtracted,
    messages_truncated: messagesTruncated,
  };

  if (sessionsSkipped > 0 && sessionsProcessed > 0) {
    process.stdout.write(JSON.stringify(result, null, 2));
    process.exit(2);
  } else if (sessionsProcessed === 0 && sessionsSkipped > 0) {
    process.stdout.write(JSON.stringify(result, null, 2));
    process.exit(1);
  } else {
    output(result, raw);
  }
}

async function cmdProfileSample(overridePath, options, raw) {
  const sessionsDir = getSessionsDir(overridePath);
  if (!sessionsDir) {
    const searchedPath = overridePath || '~/.claude/projects';
    error(`No Claude Code sessions found at ${searchedPath}.${overridePath ? '' : ' Is Claude Code installed?'}`);
  }

  process.stderr.write('Reading your session history (read-only, nothing is modified or sent anywhere)...\n');

  const limit = options.limit || 150;
  const maxChars = options.maxChars || 500;

  let projectDirs;
  try {
    projectDirs = fs.readdirSync(sessionsDir).filter(entry => {
      const fullPath = path.join(sessionsDir, entry);
      try {
        return fs.statSync(fullPath).isDirectory();
      } catch {
        return false;
      }
    });
  } catch (err) {
    error(`Cannot read sessions directory: ${err.message}`);
  }

  if (projectDirs.length === 0) {
    error('No project directories found in sessions directory.');
  }

  const projectMeta = [];
  for (const dirName of projectDirs) {
    const projectPath = path.join(sessionsDir, dirName);
    const sessions = scanProjectDir(projectPath);
    if (sessions.length === 0) continue;
    const indexData = readSessionIndex(projectPath);
    const projectName = getProjectName(dirName, indexData);
    const lastActive = sessions[0].modified;
    projectMeta.push({ dirName, projectPath, sessions, projectName, lastActive });
  }

  projectMeta.sort((a, b) => b.lastActive - a.lastActive);

  const projectCount = projectMeta.length;
  if (projectCount === 0) {
    error('No projects with sessions found.');
  }

  const perProjectCap = options.maxPerProject || Math.max(5, Math.floor(limit / projectCount));

  const recencyThreshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const allMessages = [];
  let skippedContextDumps = 0;
  const projectBreakdown = [];

  for (const proj of projectMeta) {
    if (allMessages.length >= limit) break;

    const cappedSessions = proj.sessions.slice(0, perProjectCap);

    let projectMessages = 0;
    let projectSessionsUsed = 0;

    for (const session of cappedSessions) {
      if (allMessages.length >= limit) break;

      const isRecent = session.modified.getTime() >= recencyThreshold;
      const perSessionMax = isRecent ? 10 : 3;

      const remaining = Math.min(perSessionMax, limit - allMessages.length);

      try {
        const msgs = await streamExtractMessages(session.filePath, isGenuineUserMessage, remaining);
        let sessionUsed = false;

        for (const msg of msgs) {
          if (allMessages.length >= limit) break;

          const content = msg.content || '';
          if (content.startsWith('This session is being continued')) {
            skippedContextDumps++;
            continue;
          }

          const lines = content.split('\n').filter(l => l.trim().length > 0);
          if (lines.length > 3) {
            const logPattern = /^\[?(DEBUG|INFO|WARN|ERROR|LOG)\]?/i;
            const timestampPattern = /^\d{4}-\d{2}-\d{2}/;
            const logLines = lines.filter(l => logPattern.test(l.trim()) || timestampPattern.test(l.trim()));
            if (logLines.length / lines.length > 0.8) {
              skippedContextDumps++;
              continue;
            }
          }

          const truncated = truncateContent(content, maxChars);

          allMessages.push({
            sessionId: msg.sessionId,
            projectName: proj.projectName,
            projectPath: msg.projectPath,
            timestamp: msg.timestamp,
            content: truncated,
          });

          projectMessages++;
          sessionUsed = true;
        }
        if (sessionUsed) projectSessionsUsed++;
      } catch {
        continue;
      }
    }

    if (projectMessages > 0) {
      projectBreakdown.push({
        project: proj.projectName,
        messages: projectMessages,
        sessions: projectSessionsUsed,
      });
    }
  }

  reapStaleTempFiles('gsd-profile-', { dirsOnly: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-profile-'));
  const outputPath = path.join(tmpDir, 'profile-sample.jsonl');
  for (const msg of allMessages) {
    fs.appendFileSync(outputPath, JSON.stringify(msg) + '\n');
  }

  const result = {
    output_file: outputPath,
    projects_sampled: projectBreakdown.length,
    messages_sampled: allMessages.length,
    per_project_cap: perProjectCap,
    message_char_limit: maxChars,
    skipped_context_dumps: skippedContextDumps,
    project_breakdown: projectBreakdown,
  };

  output(result, raw);
}

module.exports = {
  cmdScanSessions,
  cmdExtractMessages,
  cmdProfileSample,
};
