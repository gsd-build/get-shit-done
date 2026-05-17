import { readFile, writeFile } from 'node:fs/promises';
import { planningPaths } from './helpers.js';
import { acquireStateLock, releaseStateLock } from './state-mutation.js';

/**
 * Replace a pattern only in the current milestone section of ROADMAP.md.
 *
 * Port of replaceInCurrentMilestone from core.cjs lines 1013-1022.
 *
 * Semantics (byte-for-byte CJS parity):
 *   • No `</details>` in the content  → plain `content.replace(pattern, replacement)`.
 *   • Otherwise → split at the last `</details>` and replace only in the
 *     content AFTER it.
 *
 * INTENTIONALLY DOES NOT fall back to "search the last <details> block when
 * the after-slice didn't match." That fallback existed in an earlier SDK
 * port and would silently corrupt shipped-milestone content when the current
 * milestone is itself wrapped in `<details open>...</details>` and there's
 * nothing after the close tag. CJS callers handle the "milestone inside
 * <details>" case by passing the unscoped `content.replace(...)` directly
 * (see phase.cjs:1080 for plan-count update). Keep this function in
 * lockstep with core.cjs — deviations are how bug-2005 slipped in.
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
  return before + after.replace(pattern, replacement);
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
