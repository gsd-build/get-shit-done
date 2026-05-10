import { existsSync, readFileSync } from 'node:fs';

/**
 * STATE.md Mutation Transaction Module.
 *
 * Owns transaction ordering for STATE.md mutations: acquire lock, read, choose
 * mutation surface, project frontmatter, normalize, write, release lock.
 */

export interface StateMutationTransactionOptions {
  statePath: string;
  projectDir: string;
  workstream?: string;
  transform: (content: string) => string | Promise<string>;
  acquireStateLock: (statePath: string) => Promise<string>;
  releaseStateLock: (lockPath: string) => Promise<void>;
  buildStateFrontmatter: (
    body: string,
    projectDir: string,
    workstream?: string,
  ) => Promise<Record<string, unknown>>;
  normalizeMd: (content: string) => string;
  writeFile: (path: string, content: string, encoding: BufferEncoding) => Promise<void>;
  extractFrontmatter: (content: string) => Record<string, unknown>;
  stripFrontmatter: (content: string) => string;
  reconstructFrontmatter: (frontmatter: Record<string, unknown>) => string;
  resync?: boolean;
  preserveExistingProgress?: boolean;
  mutationSurface?: 'full' | 'body';
  dryRun?: boolean;
}

export async function runStateMutationTransaction(options: StateMutationTransactionOptions): Promise<string> {
  const {
    statePath,
    projectDir,
    workstream,
    transform,
    acquireStateLock,
    releaseStateLock,
    buildStateFrontmatter,
    normalizeMd,
    writeFile,
    extractFrontmatter,
    stripFrontmatter,
    reconstructFrontmatter,
    resync = true,
    preserveExistingProgress = false,
    mutationSurface = 'body',
    dryRun = false,
  } = options;

  const lockPath = await acquireStateLock(statePath);
  try {
    const content = existsSync(statePath) ? readFileSync(statePath, 'utf-8') : '';
    const originalFm = extractFrontmatter(content);
    const preFm = !resync ? originalFm : null;
    const mutationInput = mutationSurface === 'body' ? stripFrontmatter(content) : content;
    const modified = await transform(mutationInput);
    const modifiedFm = extractFrontmatter(modified);
    const existingFm = Object.keys(modifiedFm).length > 0 ? modifiedFm : originalFm;
    const body = stripFrontmatter(modified);
    const projectedFm = await buildStateFrontmatter(body, projectDir, workstream);

    if (projectedFm.status === 'unknown' && existingFm.status && existingFm.status !== 'unknown') {
      projectedFm.status = existingFm.status;
    }

    if (!resync && preFm && preFm.progress) {
      projectedFm.progress = preFm.progress;
    } else if (preserveExistingProgress && shouldPreserveExistingProgress(existingFm.progress, projectedFm.progress)) {
      projectedFm.progress = normalizeProgressNumbers(existingFm.progress);
    }

    const yamlStr = reconstructFrontmatter(projectedFm);
    const synced = `---\n${yamlStr}\n---\n\n${body}`;
    const normalized = normalizeMd(synced);
    if (!dryRun) {
      await writeFile(statePath, normalized, 'utf-8');
    }
    return normalized;
  } finally {
    await releaseStateLock(lockPath);
  }
}

function normalizeProgressNumbers(progress: unknown): unknown {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return progress;
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(progress)) {
    const numeric = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    normalized[key] = typeof numeric === 'number' && Number.isFinite(numeric) ? numeric : value;
  }
  return normalized;
}

function shouldPreserveExistingProgress(existingProgress: unknown, projectedProgress: unknown): boolean {
  if (!existingProgress || typeof existingProgress !== 'object' || Array.isArray(existingProgress)) return false;
  const projected = projectedProgress && typeof projectedProgress === 'object' && !Array.isArray(projectedProgress)
    ? projectedProgress as Record<string, unknown>
    : {};
  const existing = existingProgress as Record<string, unknown>;
  const projectedTotalPlans = Number(projected.total_plans ?? 0);
  const projectedCompletedPlans = Number(projected.completed_plans ?? 0);
  const existingTotalPlans = Number(existing.total_plans ?? 0);
  return projectedTotalPlans === 0 && projectedCompletedPlans === 0 && existingTotalPlans > 0;
}
