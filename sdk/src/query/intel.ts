/**
 * Intel query handlers — .planning/intel/ file management.
 *
 * Ported from get-shit-done/bin/lib/intel.cjs.
 * Provides intel status, diff, snapshot, validate, query, extract-exports,
 * and patch-meta operations for the project intelligence system.
 *
 * @example
 * ```typescript
 * import { intelStatus, intelQuery } from './intel.js';
 *
 * await intelStatus([], '/project');
 * // { data: { files: { ... }, overall_stale: false } }
 *
 * await intelQuery(['AuthService'], '/project');
 * // { data: { matches: [...], term: 'AuthService', total: 3 } }
 * ```
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { planningPaths, resolvePathUnderProject } from './helpers.js';
import type { QueryHandler } from './utils.js';

// ─── Constants ───────────────────────────────────────────────────────────

const INTEL_FILES: Record<string, string> = {
  files: 'files.json',
  apis: 'apis.json',
  deps: 'deps.json',
  arch: 'arch.md',
  stack: 'stack.json',
};

const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Internal helpers ────────────────────────────────────────────────────

function intelDir(projectDir: string): string {
  return join(projectDir, '.planning', 'intel');
}

function isIntelEnabled(projectDir: string): boolean {
  try {
    const cfg = JSON.parse(readFileSync(planningPaths(projectDir).config, 'utf-8'));
    return cfg?.intel?.enabled === true;
  } catch {
    return false;
  }
}

function intelFilePath(projectDir: string, filename: string): string {
  return join(intelDir(projectDir), filename);
}

function safeReadJson(filePath: string): unknown {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function hashFile(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}

/** Max recursion depth when walking JSON for intel queries (avoids stack overflow). */
export const MAX_JSON_SEARCH_DEPTH = 48;

export function searchJsonEntries(data: unknown, term: string, depth = 0): unknown[] {
  const lowerTerm = term.toLowerCase();
  const results: unknown[] = [];
  if (depth > MAX_JSON_SEARCH_DEPTH) return results;
  if (!data || typeof data !== 'object') return results;

  function matchesInValue(value: unknown, d: number): boolean {
    if (d > MAX_JSON_SEARCH_DEPTH) return false;
    if (typeof value === 'string') return value.toLowerCase().includes(lowerTerm);
    if (Array.isArray(value)) return value.some(v => matchesInValue(v, d + 1));
    if (value && typeof value === 'object') return Object.values(value as object).some(v => matchesInValue(v, d + 1));
    return false;
  }

  if (Array.isArray(data)) {
    for (const entry of data) {
      if (matchesInValue(entry, depth + 1)) results.push(entry);
    }
  } else {
    for (const [, value] of Object.entries(data as object)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          if (matchesInValue(entry, depth + 1)) results.push(entry);
        }
      }
    }
  }
  return results;
}

function searchArchMd(filePath: string, term: string): string[] {
  if (!existsSync(filePath)) return [];
  const lowerTerm = term.toLowerCase();
  const content = readFileSync(filePath, 'utf-8');
  return content.split('\n').filter(line => line.toLowerCase().includes(lowerTerm));
}

// ─── Handlers ────────────────────────────────────────────────────────────

const INTEL_DISABLED_MSG = 'Intel system disabled. Set intel.enabled=true in config.json to activate.';

export const intelStatus: QueryHandler = async (_args, projectDir, _workstream) => {
  if (!isIntelEnabled(projectDir)) {
    return { data: { disabled: true, message: INTEL_DISABLED_MSG } };
  }
  const now = Date.now();
  const files: Record<string, unknown> = {};
  let overallStale = false;

  for (const [, filename] of Object.entries(INTEL_FILES)) {
    const filePath = intelFilePath(projectDir, filename);
    if (!existsSync(filePath)) {
      files[filename] = { exists: false, updated_at: null, stale: true };
      overallStale = true;
      continue;
    }
    let updatedAt: string | null = null;
    if (filename.endsWith('.md')) {
      try { updatedAt = statSync(filePath).mtime.toISOString(); } catch { /* skip */ }
    } else {
      const data = safeReadJson(filePath) as Record<string, unknown> | null;
      if (data?._meta) {
        updatedAt = (data._meta as Record<string, unknown>).updated_at as string | null;
      }
    }
    const stale = !updatedAt || (now - new Date(updatedAt).getTime()) > STALE_MS;
    if (stale) overallStale = true;
    files[filename] = { exists: true, updated_at: updatedAt, stale };
  }
  return { data: { files, overall_stale: overallStale } };
};

export const intelDiff: QueryHandler = async (_args, projectDir, _workstream) => {
  if (!isIntelEnabled(projectDir)) {
    return { data: { disabled: true, message: INTEL_DISABLED_MSG } };
  }
  const snapshotPath = intelFilePath(projectDir, '.last-refresh.json');
  const snapshot = safeReadJson(snapshotPath) as Record<string, unknown> | null;
  if (!snapshot) return { data: { no_baseline: true } };

  const prevHashes = (snapshot.hashes as Record<string, string>) || {};
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];

  for (const [, filename] of Object.entries(INTEL_FILES)) {
    const filePath = intelFilePath(projectDir, filename);
    const currentHash = hashFile(filePath);
    if (currentHash && !prevHashes[filename]) added.push(filename);
    else if (currentHash && prevHashes[filename] && currentHash !== prevHashes[filename]) changed.push(filename);
    else if (!currentHash && prevHashes[filename]) removed.push(filename);
  }
  return { data: { changed, added, removed } };
};

export const intelSnapshot: QueryHandler = async (_args, projectDir, _workstream) => {
  if (!isIntelEnabled(projectDir)) {
    return { data: { disabled: true, message: INTEL_DISABLED_MSG } };
  }
  const dir = intelDir(projectDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const hashes: Record<string, string> = {};
  let fileCount = 0;
  for (const [, filename] of Object.entries(INTEL_FILES)) {
    const filePath = join(dir, filename);
    const hash = hashFile(filePath);
    if (hash) { hashes[filename] = hash; fileCount++; }
  }

  const timestamp = new Date().toISOString();
  writeFileSync(join(dir, '.last-refresh.json'), JSON.stringify({ hashes, timestamp, version: 1 }, null, 2), 'utf-8');
  return { data: { saved: true, timestamp, files: fileCount } };
};

export const intelValidate: QueryHandler = async (_args, projectDir, _workstream) => {
  if (!isIntelEnabled(projectDir)) {
    return { data: { disabled: true, message: INTEL_DISABLED_MSG } };
  }
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [, filename] of Object.entries(INTEL_FILES)) {
    const filePath = intelFilePath(projectDir, filename);
    if (!existsSync(filePath)) {
      errors.push(`Missing intel file: ${filename}`);
      continue;
    }
    if (!filename.endsWith('.md')) {
      const data = safeReadJson(filePath) as Record<string, unknown> | null;
      if (!data) { errors.push(`Invalid JSON in: ${filename}`); continue; }
      const meta = data._meta as Record<string, unknown> | undefined;
      if (!meta?.updated_at) warnings.push(`${filename}: missing _meta.updated_at`);
      else {
        const age = Date.now() - new Date(meta.updated_at as string).getTime();
        if (age > STALE_MS) warnings.push(`${filename}: stale (${Math.round(age / 3600000)}h old)`);
      }
    }
  }
  return { data: { valid: errors.length === 0, errors, warnings } };
};

export const intelQuery: QueryHandler = async (args, projectDir, _workstream) => {
  const term = args[0] || '';
  if (!isIntelEnabled(projectDir)) {
    return { data: { disabled: true, message: INTEL_DISABLED_MSG } };
  }
  const matches: unknown[] = [];
  let total = 0;

  for (const [, filename] of Object.entries(INTEL_FILES)) {
    if (filename.endsWith('.md')) {
      const filePath = intelFilePath(projectDir, filename);
      const archMatches = searchArchMd(filePath, term);
      if (archMatches.length > 0) { matches.push({ source: filename, entries: archMatches }); total += archMatches.length; }
    } else {
      const filePath = intelFilePath(projectDir, filename);
      const data = safeReadJson(filePath);
      if (!data) continue;
      const found = searchJsonEntries(data, term);
      if (found.length > 0) { matches.push({ source: filename, entries: found }); total += found.length; }
    }
  }
  return { data: { matches, term, total } };
};

/**
 * Extract exports from a JS/CJS/ESM file — port of `intelExtractExports` in `intel.cjs` (lines 502–614).
 * Returns `{ file, exports, method }` with `file` as a resolved absolute path (matches `gsd-tools.cjs`).
 */
export const intelExtractExports: QueryHandler = async (args, projectDir, _workstream) => {
  const raw = args[0];
  if (!raw) {
    return { data: { file: '', exports: [], method: 'none' } };
  }
  let filePath: string;
  try {
    filePath = await resolvePathUnderProject(projectDir, raw);
  } catch {
    return { data: { file: raw, exports: [], method: 'none' } };
  }
  if (!existsSync(filePath)) {
    return { data: { file: filePath, exports: [], method: 'none' } };
  }

  const content = readFileSync(filePath, 'utf-8');
  const exports: string[] = [];
  let method = 'none';

  const allMatches = [...content.matchAll(/module\.exports\s*=\s*\{/g)];
  if (allMatches.length > 0) {
    const lastMatch = allMatches[allMatches.length - 1]!;
    const startIdx = lastMatch.index! + lastMatch[0].length;
    let depth = 1;
    let endIdx = startIdx;
    while (endIdx < content.length && depth > 0) {
      if (content[endIdx] === '{') depth++;
      else if (content[endIdx] === '}') depth--;
      if (depth > 0) endIdx++;
    }
    const block = content.substring(startIdx, endIdx);
    method = 'module.exports';
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
      const keyMatch = trimmed.match(/^(\w+)\s*[,}:]/) || trimmed.match(/^(\w+)$/);
      if (keyMatch) exports.push(keyMatch[1]!);
    }
  }

  const individualPattern = /^exports\.(\w+)\s*=/gm;
  let im: RegExpExecArray | null;
  while ((im = individualPattern.exec(content)) !== null) {
    if (!exports.includes(im[1]!)) {
      exports.push(im[1]!);
      if (method === 'none') method = 'exports.X';
    }
  }

  const hadCjs = exports.length > 0;

  const esmExports: string[] = [];

  const defaultNamedPattern = /^export\s+default\s+(?:function|class)\s+(\w+)/gm;
  let em: RegExpExecArray | null;
  while ((em = defaultNamedPattern.exec(content)) !== null) {
    if (!esmExports.includes(em[1]!)) esmExports.push(em[1]!);
  }

  const defaultAnonPattern = /^export\s+default\s+(?!function\s|class\s)/gm;
  if (defaultAnonPattern.test(content) && esmExports.length === 0) {
    if (!esmExports.includes('default')) esmExports.push('default');
  }

  const exportFnPattern = /^export\s+(?:async\s+)?function\s+(\w+)\s*\(/gm;
  while ((em = exportFnPattern.exec(content)) !== null) {
    if (!esmExports.includes(em[1]!)) esmExports.push(em[1]!);
  }

  const exportVarPattern = /^export\s+(?:const|let|var)\s+(\w+)\s*=/gm;
  while ((em = exportVarPattern.exec(content)) !== null) {
    if (!esmExports.includes(em[1]!)) esmExports.push(em[1]!);
  }

  const exportClassPattern = /^export\s+class\s+(\w+)/gm;
  while ((em = exportClassPattern.exec(content)) !== null) {
    if (!esmExports.includes(em[1]!)) esmExports.push(em[1]!);
  }

  const exportBlockPattern = /^export\s*\{([^}]+)\}/gm;
  while ((em = exportBlockPattern.exec(content)) !== null) {
    const items = em[1]!.split(',');
    for (const item of items) {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const name = trimmed.split(/\s+as\s+/)[0]!.trim();
      if (name && !esmExports.includes(name)) esmExports.push(name);
    }
  }

  for (const e of esmExports) {
    if (!exports.includes(e)) exports.push(e);
  }

  const hadEsm = esmExports.length > 0;
  if (hadCjs && hadEsm) {
    method = 'mixed';
  } else if (hadEsm && !hadCjs) {
    method = 'esm';
  }

  return { data: { file: filePath, exports, method } };
};

export const intelPatchMeta: QueryHandler = async (args, projectDir, _workstream) => {
  const raw = args[0];
  if (!raw) {
    return { data: { patched: false, error: 'File not found' } };
  }
  let filePath: string;
  try {
    filePath = await resolvePathUnderProject(projectDir, raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: { patched: false, error: msg } };
  }
  if (!existsSync(filePath)) {
    return { data: { patched: false, error: `File not found: ${filePath}` } };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data._meta) data._meta = {};
    const meta = data._meta as Record<string, unknown>;
    const timestamp = new Date().toISOString();
    meta.updated_at = timestamp;
    meta.version = ((meta.version as number) || 0) + 1;
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    return { data: { patched: true, file: filePath, timestamp } };
  } catch (err) {
    return { data: { patched: false, error: String(err) } };
  }
};

// ─── intelUpdate ───────────────────────────────────────────────────────────

/**
 * `gsd-tools intel update` entry point: returns the same JSON as `intel.cjs` `intelUpdate`.
 * Does not run the full graph refresh in-process — that work is done by the
 * **gsd-intel-updater** agent after spawn. When `.planning/intel/` is disabled in config,
 * returns `{ disabled: true, message }` so SDK output matches the CJS CLI.
 *
 * Port of `intelUpdate` from `intel.cjs` lines 314–321.
 */
export const intelUpdate: QueryHandler = async (_args, projectDir, _workstream) => {
  if (!isIntelEnabled(projectDir)) {
    return { data: { disabled: true, message: INTEL_DISABLED_MSG } };
  }
  return {
    data: {
      action: 'spawn_agent',
      message: 'Run gsd-tools intel update or spawn gsd-intel-updater agent for full refresh',
    },
  };
};
