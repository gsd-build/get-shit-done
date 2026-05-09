import { readFile, writeFile } from 'node:fs/promises';
import { planningPaths } from './helpers.js';
import { acquireStateLock, releaseStateLock } from './state-mutation.js';

/**
 * Replace a pattern only in the current milestone section of ROADMAP.md.
 *
 * Port of replaceInCurrentMilestone from core.cjs line 1197-1206.
 */
export function replaceInCurrentMilestone(
  content: string,
  pattern: string | RegExp,
  replacement: string,
): string {
  const lastDetailsClose = content.lastIndexOf('</details>');
  if (lastDetailsClose === -1) {
    return content.replace(pattern, replacement);
  }
  const offset = lastDetailsClose + '</details>'.length;
  const before = content.slice(0, offset);
  const after = content.slice(offset);

  const replacedAfter = after.replace(pattern, replacement);
  if (replacedAfter !== after) {
    return before + replacedAfter;
  }

  const detailsBlockRe = /<details>[\s\S]*?<\/details>/gi;
  const spans: { start: number; end: number; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = detailsBlockRe.exec(content)) !== null) {
    spans.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }

  if (spans.length === 0) {
    return content.replace(pattern, replacement);
  }

  const lastSpan = spans[spans.length - 1];
  const updatedLastBlock = lastSpan.text.replace(pattern, replacement);
  return (
    content.slice(0, lastSpan.start) +
    updatedLastBlock +
    content.slice(lastSpan.end)
  );
}

/**
 * Atomic read-modify-write for ROADMAP.md.
 *
 * Holds a lockfile across the entire read -> transform -> write cycle.
 */
export async function readModifyWriteRoadmapMd(
  projectDir: string,
  modifier: (content: string) => string | Promise<string>,
  workstream?: string,
): Promise<string> {
  const roadmapPath = planningPaths(projectDir, workstream).roadmap;
  const lockPath = await acquireStateLock(roadmapPath);
  try {
    let content: string;
    try {
      content = await readFile(roadmapPath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        content = '';
      } else {
        throw err;
      }
    }
    const modified = await modifier(content);
    await writeFile(roadmapPath, modified, 'utf-8');
    return modified;
  } finally {
    await releaseStateLock(lockPath);
  }
}
