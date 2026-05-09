import { existsSync } from 'node:fs';
import { mkdir, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function listDirectories(dirPath: string): Promise<string[]> {
  if (!existsSync(dirPath)) return [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export async function ensureDirectoryWithGitkeep(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
  await writeFile(join(dirPath, '.gitkeep'), '', 'utf-8');
}

export async function archiveDirectories(
  sourceDir: string,
  archiveDir: string,
  shouldArchive: (dirName: string) => boolean,
): Promise<number> {
  await mkdir(archiveDir, { recursive: true });
  const sourceDirs = await listDirectories(sourceDir);
  let archivedCount = 0;
  for (const dirName of sourceDirs) {
    if (!shouldArchive(dirName)) continue;
    await rename(join(sourceDir, dirName), join(archiveDir, dirName));
    archivedCount++;
  }
  return archivedCount;
}
