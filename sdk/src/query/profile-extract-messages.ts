/**
 * `extract-messages` — parity with `get-shit-done/bin/lib/profile-pipeline.cjs` `cmdExtractMessages`.
 * Writes JSONL to a temp file and returns metadata (same shape as CJS stdout JSON).
 */
import { appendFileSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';

import { GSDError, ErrorClassification } from '../errors.js';
import { getScanSessionsRoot, scanProjectDir, readSessionIndex, getProjectName } from './profile-scan-sessions.js';

export type ExtractMessagesResult = {
  output_file: string;
  project: string;
  sessions_processed: number;
  sessions_skipped: number;
  messages_extracted: number;
  messages_truncated: number;
};

/** JSONL line shape from session exports — shared by filters and stream parser. */
export type SessionJsonlRecord = {
  type?: string;
  userType?: string;
  isMeta?: boolean;
  isSidechain?: boolean;
  message?: { content?: string };
  cwd?: string;
  timestamp?: string | number;
};

/** Same filter as CJS `isGenuineUserMessage` in profile-pipeline.cjs. */
export function isGenuineUserMessage(record: SessionJsonlRecord): boolean {
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

/** Default maxLen 2000 matches CJS `truncateContent` for stream extraction. */
export function truncateContent(content: string, maxLen = 2000): string {
  if (content.length <= maxLen) return content;
  return content.substring(0, maxLen) + '... [truncated]';
}

/** Line-delimited JSONL reader — same behavior as CJS `streamExtractMessages`. */
export async function streamExtractMessages(
  filePath: string,
  filterFn: (r: SessionJsonlRecord) => boolean,
  maxMessages: number,
): Promise<
  Array<{
    sessionId: string;
    projectPath: string | null;
    timestamp: string | number | null;
    content: string;
  }>
> {
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
    terminal: false,
  });

  const messages: Array<{
    sessionId: string;
    projectPath: string | null;
    timestamp: string | number | null;
    content: string;
  }> = [];
  const sessionId = basename(filePath, '.jsonl');

  for await (const line of rl) {
    if (messages.length >= maxMessages) break;
    let record: SessionJsonlRecord;
    try {
      record = JSON.parse(line) as SessionJsonlRecord;
    } catch {
      continue;
    }
    if (!filterFn(record)) continue;
    const content = record.message?.content;
    if (typeof content !== 'string') continue;
    messages.push({
      sessionId,
      projectPath: record.cwd ?? null,
      timestamp: record.timestamp ?? null,
      content: truncateContent(content),
    });
  }

  return messages;
}

/**
 * Port of `cmdExtractMessages` — same JSON result as `gsd-tools extract-messages` (stdout object;
 * message lines are in `output_file` JSONL, not inlined).
 */
export async function runExtractMessages(
  projectArg: string,
  options: { sessionId: string | null; limit: number | null },
  overridePath: string | null,
): Promise<ExtractMessagesResult> {
  const sessionsDir = getScanSessionsRoot(overridePath);
  if (!sessionsDir) {
    const searchedPath = overridePath || '~/.claude/projects';
    throw new GSDError(
      `No Claude Code sessions found at ${searchedPath}.${overridePath ? '' : ' Is Claude Code installed?'}`,
      ErrorClassification.Validation,
    );
  }

  let projectDirs: string[];
  try {
    projectDirs = readdirSync(sessionsDir).filter((entry) => {
      const fullPath = join(sessionsDir, entry);
      try {
        return statSync(fullPath).isDirectory();
      } catch {
        return false;
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GSDError(`Cannot read sessions directory: ${msg}`, ErrorClassification.Validation);
  }

  let matchedDir: string | null = null;
  let matchedName: string | null = null;

  for (const dirName of projectDirs) {
    if (dirName === projectArg) {
      matchedDir = dirName;
      break;
    }
  }

  if (!matchedDir) {
    const lowerArg = projectArg.toLowerCase();
    const matches = projectDirs.filter((d) => d.toLowerCase().includes(lowerArg));
    if (matches.length === 1) {
      matchedDir = matches[0]!;
    } else if (matches.length > 1) {
      const exactNameMatches: Array<{ dirName: string; name: string }> = [];
      for (const dirName of matches) {
        const indexData = readSessionIndex(join(sessionsDir, dirName));
        const pName = getProjectName(dirName, indexData);
        if (pName.toLowerCase() === lowerArg) {
          exactNameMatches.push({ dirName, name: pName });
        }
      }
      if (exactNameMatches.length === 1) {
        matchedDir = exactNameMatches[0]!.dirName;
        matchedName = exactNameMatches[0]!.name;
      } else {
        const names = matches.map((d) => {
          const idx = readSessionIndex(join(sessionsDir, d));
          return `  - ${getProjectName(d, idx)} (${d})`;
        });
        throw new GSDError(
          `Multiple projects match "${projectArg}":\n${names.join('\n')}\nBe more specific.`,
          ErrorClassification.Validation,
        );
      }
    }
  }

  if (!matchedDir) {
    const available = projectDirs.map((d) => {
      const idx = readSessionIndex(join(sessionsDir, d));
      return `  - ${getProjectName(d, idx)}`;
    });
    throw new GSDError(
      `No project matching "${projectArg}". Available projects:\n${available.join('\n')}`,
      ErrorClassification.Validation,
    );
  }

  const projectPath = join(sessionsDir, matchedDir);
  const indexData = readSessionIndex(projectPath);
  const projectName = matchedName || getProjectName(matchedDir, indexData);

  let sessions = scanProjectDir(projectPath);

  if (options.sessionId) {
    sessions = sessions.filter((s) => s.sessionId === options.sessionId);
    if (sessions.length === 0) {
      throw new GSDError(
        `Session "${options.sessionId}" not found in project "${projectName}".`,
        ErrorClassification.Validation,
      );
    }
  }

  if (options.limit !== null && options.limit !== undefined && options.limit > 0) {
    sessions = sessions.slice(0, options.limit);
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'gsd-pipeline-'));
  const outputPath = join(tmpDir, 'extracted-messages.jsonl');
  appendFileSync(outputPath, '');

  let sessionsProcessed = 0;
  let sessionsSkipped = 0;
  let messagesExtracted = 0;
  let messagesTruncated = 0;
  const batchLimit = 300;

  for (let i = 0; i < sessions.length; i++) {
    if (messagesExtracted >= batchLimit) break;

    const session = sessions[i]!;
    try {
      const remaining = batchLimit - messagesExtracted;
      const msgs = await streamExtractMessages(session.filePath, isGenuineUserMessage, remaining);
      for (const msg of msgs) {
        appendFileSync(outputPath, JSON.stringify(msg) + '\n');
        messagesExtracted++;
        if (msg.content.endsWith('... [truncated]')) {
          messagesTruncated++;
        }
      }
      sessionsProcessed++;
    } catch {
      sessionsSkipped++;
    }
  }

  return {
    output_file: outputPath,
    project: projectName,
    sessions_processed: sessionsProcessed,
    sessions_skipped: sessionsSkipped,
    messages_extracted: messagesExtracted,
    messages_truncated: messagesTruncated,
  };
}
