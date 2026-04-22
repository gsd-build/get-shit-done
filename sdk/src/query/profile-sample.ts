/**
 * `profile-sample` — parity with `get-shit-done/bin/lib/profile-pipeline.cjs` `cmdProfileSample`.
 */
import { appendFileSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { GSDError, ErrorClassification } from '../errors.js';
import { getScanSessionsRoot, scanProjectDir, readSessionIndex, getProjectName } from './profile-scan-sessions.js';
import { isGenuineUserMessage, streamExtractMessages, truncateContent } from './profile-extract-messages.js';

export type ProfileSampleResult = {
  output_file: string;
  projects_sampled: number;
  messages_sampled: number;
  per_project_cap: number;
  message_char_limit: number;
  skipped_context_dumps: number;
  project_breakdown: Array<{ project: string; messages: number; sessions: number }>;
};

/**
 * Port of `cmdProfileSample` — same JSON + JSONL file shape as `gsd-tools profile-sample`.
 */
export async function runProfileSample(
  overridePath: string | null,
  options: { limit: number; maxPerProject: number | null; maxChars: number },
): Promise<ProfileSampleResult> {
  const sessionsDir = getScanSessionsRoot(overridePath);
  if (!sessionsDir) {
    const searchedPath = overridePath || '~/.claude/projects';
    throw new GSDError(
      `No Claude Code sessions found at ${searchedPath}.${overridePath ? '' : ' Is Claude Code installed?'}`,
      ErrorClassification.Validation,
    );
  }

  const limit = options.limit || 150;
  const maxChars = options.maxChars || 500;
  const maxPerProject = options.maxPerProject;

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

  if (projectDirs.length === 0) {
    throw new GSDError('No project directories found in sessions directory.', ErrorClassification.Validation);
  }

  const projectMeta: Array<{
    dirName: string;
    projectPath: string;
    sessions: ReturnType<typeof scanProjectDir>;
    projectName: string;
    lastActive: Date;
  }> = [];

  for (const dirName of projectDirs) {
    const projectPath = join(sessionsDir, dirName);
    const sessions = scanProjectDir(projectPath);
    if (sessions.length === 0) continue;
    const indexData = readSessionIndex(projectPath);
    const projectName = getProjectName(dirName, indexData);
    const lastActive = sessions[0]!.modified;
    projectMeta.push({ dirName, projectPath, sessions, projectName, lastActive });
  }

  projectMeta.sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());

  const projectCount = projectMeta.length;
  if (projectCount === 0) {
    throw new GSDError('No projects with sessions found.', ErrorClassification.Validation);
  }

  const perProjectCap = maxPerProject || Math.max(5, Math.floor(limit / projectCount));

  const recencyThreshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const allMessages: Array<{
    sessionId: string;
    projectName: string;
    projectPath: string | null;
    timestamp: string | number | null;
    content: string;
  }> = [];
  let skippedContextDumps = 0;
  const projectBreakdown: Array<{ project: string; messages: number; sessions: number }> = [];

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

          const lines = content.split('\n').filter((l) => l.trim().length > 0);
          if (lines.length > 3) {
            const logPattern = /^\[?(DEBUG|INFO|WARN|ERROR|LOG)\]?/i;
            const timestampPattern = /^\d{4}-\d{2}-\d{2}/;
            const logLines = lines.filter(
              (l) => logPattern.test(l.trim()) || timestampPattern.test(l.trim()),
            );
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

  const tmpDir = mkdtempSync(join(tmpdir(), 'gsd-profile-'));
  const outputPath = join(tmpDir, 'profile-sample.jsonl');
  for (const msg of allMessages) {
    appendFileSync(outputPath, JSON.stringify(msg) + '\n');
  }

  return {
    output_file: outputPath,
    projects_sampled: projectBreakdown.length,
    messages_sampled: allMessages.length,
    per_project_cap: perProjectCap,
    message_char_limit: maxChars,
    skipped_context_dumps: skippedContextDumps,
    project_breakdown: projectBreakdown,
  };
}
