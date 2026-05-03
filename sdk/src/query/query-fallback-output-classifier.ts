import { readFile } from 'node:fs/promises';

export interface FallbackOutputClassification {
  mode: 'json' | 'text';
  output: unknown;
}

async function parseCliQueryJsonOutput(raw: string, projectDir: string): Promise<unknown> {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  let jsonStr = trimmed;
  if (jsonStr.startsWith('@file:')) {
    const rel = jsonStr.slice(6).trim();
    const { resolvePathUnderProject } = await import('./helpers.js');
    const filePath = await resolvePathUnderProject(projectDir, rel);
    jsonStr = await readFile(filePath, 'utf-8');
  }
  return JSON.parse(jsonStr);
}

export async function classifyFallbackOutput(raw: string, projectDir: string): Promise<FallbackOutputClassification> {
  if (raw.trim() === '') {
    return { mode: 'text', output: raw };
  }
  try {
    const output = await parseCliQueryJsonOutput(raw, projectDir);
    return { mode: 'json', output };
  } catch {
    return { mode: 'text', output: raw };
  }
}
