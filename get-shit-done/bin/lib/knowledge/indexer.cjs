/**
 * Knowledge Layer — Codebase indexer
 * Scans source files, computes SHA-256 hashes, detects modules,
 * maps files to modules, and stores results in INDEX.json.
 * Supports both full rebuild and incremental updates via git-diff.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { VERSION, IGNORE_DIRS, CODE_EXTS } = require('./constants.cjs');
const { getFileLanguage, extractExports, extractImports, guessModule } = require('./source-analysis.cjs');
const { getChangedFilesSince, getCurrentHead, isBinaryFile } = require('./git-diff.cjs');
const {
  safeRead, safeJsonRead, safeJsonWrite, sha256, ensureDir,
  isoNow, withFileLock, knowledgeDir, indexPath, execGitSafe,
} = require('./utils.cjs');

// ─── Directory Walker ─────────────────────────────────────────────────────────

function walkDir(dir) {
  const results = [];
  function walk(currentDir) {
    let entries;
    try { entries = fs.readdirSync(currentDir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (CODE_EXTS.has(ext)) results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

// ─── Single File Indexing ─────────────────────────────────────────────────────

function indexSingleFile(filePath, cwd) {
  const content = safeRead(filePath);
  if (content === null) return null;
  const rel = path.relative(cwd, filePath).replace(/\\/g, '/');
  const lang = getFileLanguage(filePath);
  const lines = content.split('\n').length;
  const hash = sha256(content);
  const exportsList = extractExports(content, lang);
  const importsList = extractImports(content, lang);
  const mod = guessModule(filePath, cwd);
  let sizeBytes = 0;
  try { sizeBytes = fs.statSync(filePath).size; } catch { /* ignore */ }
  return {
    path: rel, module: mod, hash, description: '',
    language: lang, line_count: lines, size_bytes: sizeBytes,
    exports: exportsList, imports: importsList,
    patterns: [], last_mapped: isoNow(),
  };
}

// ─── Surrogate Generation ─────────────────────────────────────────────────────

function generateSurrogates(moduleName, moduleData) {
  const files = moduleData.files || [];
  const exports = moduleData.exports || [];
  const deps = moduleData.dependencies || [];
  const patterns = moduleData.patterns || [];
  const desc = moduleData.description || '';

  const topExports = exports.slice(0, 10).join(', ') || 'none';
  const patList = patterns.slice(0, 5).join(', ') || 'none';
  const depList = deps.slice(0, 5).join(', ') || 'none';

  const gist = `Module: ${moduleName} | Files: ${files.length} | Exports: ${topExports} | Patterns: ${patList} | Deps: ${depList}${desc ? ' | ' + desc : ''}`;
  const micro = `${moduleName}: ${desc || 'no description'} (${files.length} files, ${exports.length} exports)`;

  return { surrogate_gist: gist, surrogate_micro: micro };
}

// ─── Full Index Build ─────────────────────────────────────────────────────────

function buildIndex(cwd) {
  const kd = knowledgeDir(cwd);
  if (!fs.existsSync(kd)) {
    throw new Error('Knowledge layer not initialized. Run gsd-tools.cjs knowledge init first.');
  }

  const ip = indexPath(cwd);
  const existing = safeJsonRead(ip) || {
    version: VERSION, last_mapped_commit: '0000000', last_updated: isoNow(),
    stats: { total_files: 0, total_modules: 0, total_patterns: 0, total_exports: 0, total_dependencies: 0 },
    modules: {}, files: {}, patterns: {},
  };

  const allFiles = walkDir(cwd);
  let indexed = 0, skipped = 0, errors = 0;
  existing.files = {};

  for (const fp of allFiles) {
    try {
      const info = indexSingleFile(fp, cwd);
      if (!info) { skipped++; continue; }
      existing.files[info.path] = {
        module: info.module, hash: info.hash, description: info.description,
        patterns: info.patterns, last_mapped: info.last_mapped,
        size_bytes: info.size_bytes, line_count: info.line_count,
        exports: info.exports, imports: info.imports,
      };
      indexed++;
    } catch { errors++; }
  }

  // Rebuild modules from file data
  const modules = {};
  for (const [fp, info] of Object.entries(existing.files)) {
    const mod = info.module;
    if (!modules[mod]) {
      modules[mod] = { path: mod === 'root' ? '.' : mod, description: '', files: [], exports: [], dependencies: [], patterns: [] };
    }
    modules[mod].files.push(fp);
  }

  for (const [modName, modData] of Object.entries(modules)) {
    const allExports = [];
    for (const fp of modData.files) {
      const fileEntry = existing.files[fp];
      if (fileEntry && fileEntry.exports) allExports.push(...fileEntry.exports);
    }
    modData.exports = [...new Set(allExports)];
    const surrogates = generateSurrogates(modName, modData);
    modData.surrogate_gist = surrogates.surrogate_gist;
    modData.surrogate_micro = surrogates.surrogate_micro;
    if (modData.access_count === undefined) modData.access_count = 0;
    if (modData.last_accessed === undefined) modData.last_accessed = null;
  }

  existing.modules = modules;
  if (!existing.patterns) existing.patterns = {};

  const headResult = execGitSafe(cwd, ['rev-parse', '--short', 'HEAD']);
  if (headResult.exitCode === 0) existing.last_mapped_commit = headResult.stdout;

  const allExportsCount = Object.values(modules).reduce((sum, m) => sum + (m.exports || []).length, 0);
  existing.stats = {
    total_files: Object.keys(existing.files).length,
    total_modules: Object.keys(existing.modules).length,
    total_patterns: Object.keys(existing.patterns).length,
    total_exports: allExportsCount,
    total_dependencies: 0,
  };
  existing.last_updated = isoNow();

  withFileLock(ip, () => safeJsonWrite(ip, existing));

  return { ok: true, indexed, skipped, errors, total_files: existing.stats.total_files, total_modules: existing.stats.total_modules };
}

// ─── Incremental Index Update ─────────────────────────────────────────────────

function updateIndexIncremental(cwd) {
  const startTime = Date.now();
  const ip = indexPath(cwd);
  let existing;

  try { existing = safeJsonRead(ip); } catch {
    const result = buildIndex(cwd);
    return { ...result, deleted: 0, renamed: 0, fallback: true, duration_ms: Date.now() - startTime };
  }

  if (!existing || !existing.files || !existing.last_mapped_commit || existing.last_mapped_commit === '0000000') {
    const result = buildIndex(cwd);
    return { ...result, deleted: 0, renamed: 0, fallback: true, duration_ms: Date.now() - startTime };
  }

  const lastCommit = existing.last_mapped_commit;
  const changes = getChangedFilesSince(cwd, lastCommit);
  const totalIndexedFiles = Object.keys(existing.files).length;
  const totalChangedCount = changes.added.length + changes.modified.length + changes.deleted.length + changes.renamed.length;
  const rebuildRecommended = totalIndexedFiles > 0 && totalChangedCount > totalIndexedFiles * 0.5;

  let indexed = 0, skipped = 0, errors = 0, deletedCount = 0, renamedCount = 0;

  for (const df of changes.deleted) {
    const rel = df.replace(/\\/g, '/');
    if (existing.files[rel]) { delete existing.files[rel]; deletedCount++; }
  }

  for (const rename of changes.renamed) {
    const oldRel = rename.old.replace(/\\/g, '/');
    const oldEntry = existing.files[oldRel] || {};
    delete existing.files[oldRel];
    const absPath = path.resolve(cwd, rename.new);
    if (fs.existsSync(absPath) && !isBinaryFile(rename.new)) {
      const ext = path.extname(rename.new).toLowerCase();
      if (CODE_EXTS.has(ext)) {
        try {
          const info = indexSingleFile(absPath, cwd);
          if (info) {
            existing.files[info.path] = {
              module: info.module, hash: info.hash,
              description: oldEntry.description || '', patterns: oldEntry.patterns || [],
              last_mapped: info.last_mapped, size_bytes: info.size_bytes, line_count: info.line_count,
              exports: info.exports, imports: info.imports,
            };
            indexed++;
          }
        } catch { errors++; }
      }
    }
    renamedCount++;
  }

  const filesToProcess = [...new Set([...changes.added, ...changes.modified])];
  for (const relFile of filesToProcess) {
    const absPath = path.resolve(cwd, relFile);
    if (!fs.existsSync(absPath)) { skipped++; continue; }
    if (isBinaryFile(relFile)) { skipped++; continue; }
    const ext = path.extname(relFile).toLowerCase();
    if (!CODE_EXTS.has(ext)) { skipped++; continue; }
    try {
      const info = indexSingleFile(absPath, cwd);
      if (!info) { skipped++; continue; }
      if (existing.files[info.path] && existing.files[info.path].hash === info.hash) { skipped++; continue; }
      existing.files[info.path] = {
        module: info.module, hash: info.hash,
        description: (existing.files[info.path] || {}).description || '',
        patterns: (existing.files[info.path] || {}).patterns || [],
        last_mapped: info.last_mapped, size_bytes: info.size_bytes, line_count: info.line_count,
        exports: info.exports, imports: info.imports,
      };
      indexed++;
    } catch { errors++; }
  }

  // Rebuild modules
  const modules = {};
  for (const [fp, info] of Object.entries(existing.files)) {
    const mod = info.module;
    if (!modules[mod]) {
      modules[mod] = {
        path: mod === 'root' ? '.' : mod,
        description: (existing.modules && existing.modules[mod] || {}).description || '',
        files: [], exports: [],
        dependencies: (existing.modules && existing.modules[mod] || {}).dependencies || [],
        patterns: (existing.modules && existing.modules[mod] || {}).patterns || [],
      };
    }
    modules[mod].files.push(fp);
  }

  for (const [modName, modData] of Object.entries(modules)) {
    const surrogates = generateSurrogates(modName, modData);
    modData.surrogate_gist = surrogates.surrogate_gist;
    modData.surrogate_micro = surrogates.surrogate_micro;
    const prev = existing.modules && existing.modules[modName];
    modData.access_count = (prev && prev.access_count) || 0;
    modData.last_accessed = (prev && prev.last_accessed) || null;
  }

  existing.modules = modules;
  const head = getCurrentHead(cwd);
  if (head !== '0000000') existing.last_mapped_commit = head;

  existing.stats = {
    total_files: Object.keys(existing.files).length,
    total_modules: Object.keys(existing.modules).length,
    total_patterns: Object.keys(existing.patterns || {}).length,
    total_exports: 0,
    total_dependencies: (existing.stats && existing.stats.total_dependencies) || 0,
  };
  existing.last_updated = isoNow();

  withFileLock(ip, () => safeJsonWrite(ip, existing));

  return {
    ok: true, indexed, skipped, errors, deleted: deletedCount, renamed: renamedCount,
    total_files: existing.stats.total_files, fallback: false,
    rebuild_recommended: rebuildRecommended, duration_ms: Date.now() - startTime,
  };
}

// ─── Query Helpers ────────────────────────────────────────────────────────────

function getIndex(cwd) { return safeJsonRead(indexPath(cwd), null); }

function listModules(cwd) {
  const index = safeJsonRead(indexPath(cwd));
  if (!index || !index.modules) return { ok: true, modules: [] };
  const modules = Object.entries(index.modules).map(([name, data]) => ({
    name, file_count: (data.files || []).length, description: data.description || '',
    exports_count: (data.exports || []).length,
  }));
  modules.sort((a, b) => b.file_count - a.file_count);
  return { ok: true, modules };
}

module.exports = {
  buildIndex, updateIndexIncremental, getIndex, listModules,
  walkDir, generateSurrogates,
};
