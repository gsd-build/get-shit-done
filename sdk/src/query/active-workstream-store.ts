import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateWorkstreamName } from '../workstream-utils.js';

function pointerPath(projectDir: string): string {
  return join(projectDir, '.planning', 'active-workstream');
}

function workstreamDir(projectDir: string, name: string): string {
  return join(projectDir, '.planning', 'workstreams', name);
}

/**
 * Read active workstream pointer from `.planning/active-workstream`.
 * Invalid or stale pointers are self-healed by clearing the file.
 */
export function readActiveWorkstream(projectDir: string): string | null {
  const filePath = pointerPath(projectDir);
  try {
    const name = readFileSync(filePath, 'utf-8').trim();
    if (!name || !validateWorkstreamName(name)) {
      try { unlinkSync(filePath); } catch { /* already gone */ }
      return null;
    }
    if (!existsSync(workstreamDir(projectDir, name))) {
      try { unlinkSync(filePath); } catch { /* already gone */ }
      return null;
    }
    return name;
  } catch {
    return null;
  }
}

export function writeActiveWorkstream(projectDir: string, name: string | null): void {
  const filePath = pointerPath(projectDir);
  if (!name) {
    try { unlinkSync(filePath); } catch { /* already gone */ }
    return;
  }
  if (!validateWorkstreamName(name)) {
    throw new Error('Invalid workstream name: must be alphanumeric, hyphens, underscores, or dots');
  }
  const wsDir = workstreamDir(projectDir, name);
  if (!existsSync(wsDir)) {
    throw new Error(`Workstream directory does not exist: ${name}`);
  }
  writeFileSync(filePath, name + '\n', 'utf-8');
}

