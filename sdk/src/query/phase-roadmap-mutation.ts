import { readFile, writeFile } from 'node:fs/promises';
import { planningPaths } from './helpers.js';
import { acquireStateLock, releaseStateLock } from './state-mutation.js';

/**
 * Replace a pattern only in the current milestone section of ROADMAP.md.
 *
 * Port of replaceInCurrentMilestone from core.cjs lines 1013-1022.
 *
 * Semantics:
 *   • No `</details>` in the content  → plain `content.replace(pattern, replacement)`.
 *   • Otherwise → split at the last `</details>` and replace only in the
 *     content AFTER it.
 *   • If the after-slice produces no replacement (pattern not found there),
 *     fall back to replacing inside the last `<details>...</details>` block.
 *     This handles the case where the active milestone is itself wrapped in
 *     a `<details>` block (e.g. collapsed by the user or during a milestone
 *     transition). Earlier shipped-milestone blocks are left untouched because
 *     only the last `<details>` block is targeted by the fallback.
 *     (Fixes #2641.)
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
  const afterReplaced = after.replace(pattern, replacement);
  if (afterReplaced !== after) {
    // Pattern matched in the after-slice (normal case: active milestone is
    // outside/after the last </details>).
    return before + afterReplaced;
  }
  // Pattern did not match after the last </details>. Fall back to replacing
  // inside the last <details> block (active milestone is wrapped in <details>).
  const lastDetailsOpen = content.lastIndexOf('<details>');
  if (lastDetailsOpen === -1 || lastDetailsOpen >= lastDetailsClose) {
    // Malformed or no proper block — return unchanged.
    return content;
  }
  const blockBefore = content.slice(0, lastDetailsOpen);
  const blockInner = content.slice(lastDetailsOpen, offset);
  const blockAfter = content.slice(offset);
  return blockBefore + blockInner.replace(pattern, replacement) + blockAfter;
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
