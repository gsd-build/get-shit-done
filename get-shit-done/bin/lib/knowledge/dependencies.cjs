/**
 * Knowledge Layer — Dependency graph builder
 * Builds forward/reverse import maps, detects circular dependencies,
 * resolves path aliases, provides impact analysis.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { VERSION } = require('./constants.cjs');
const { getFileLanguage, extractImports } = require('./source-analysis.cjs');
const {
  safeRead, safeJsonRead, safeJsonWrite, isoNow, withFileLock,
  indexPath, depsPath,
} = require('./utils.cjs');

let _cachedAliases = null;
let _cachedAliasesCwd = null;

function loadPathAliases(cwd) {
  if (_cachedAliases && _cachedAliasesCwd === cwd) return _cachedAliases;
  _cachedAliasesCwd = cwd;
  _cachedAliases = {};
  for (const configFile of ['tsconfig.json', 'jsconfig.json']) {
    const fp = path.join(cwd, configFile);
    const config = safeJsonRead(fp);
    if (config && config.compilerOptions && config.compilerOptions.paths) {
      const baseUrl = config.compilerOptions.baseUrl || '.';
      const basePath = path.resolve(cwd, baseUrl);
      for (const [alias, targets] of Object.entries(config.compilerOptions.paths)) {
        const prefix = alias.replace('/*', '');
        const target = (targets[0] || '').replace('/*', '');
        _cachedAliases[prefix] = path.resolve(basePath, target);
      }
      break;
    }
  }
  return _cachedAliases;
}

function _resolveImports(imports, filePath, fileSet, aliases, cwd) {
  const resolved = [];
  for (const imp of imports) {
    let resolvedPath;
    if (!imp.startsWith('.') && !imp.startsWith('/')) {
      let aliasResolved = false;
      for (const [prefix, targetDir] of Object.entries(aliases)) {
        if (imp === prefix || imp.startsWith(prefix + '/')) {
          const rest = imp.slice(prefix.length).replace(/^\//, '');
          resolvedPath = path.relative(cwd, path.join(targetDir, rest)).replace(/\\/g, '/');
          aliasResolved = true;
          break;
        }
      }
      if (!aliasResolved) continue;
    } else {
      const importDir = path.dirname(filePath);
      resolvedPath = path.posix.normalize(path.posix.join(importDir, imp)).replace(/\\/g, '/');
    }
    const candidates = [resolvedPath];
    if (!path.extname(resolvedPath)) {
      for (const ext of ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '/index.js', '/index.ts']) {
        candidates.push(resolvedPath + ext);
      }
    }
    for (const candidate of candidates) {
      if (fileSet.has(candidate)) { resolved.push(candidate); break; }
    }
  }
  return resolved;
}

function buildDependencyGraph(cwd) {
  const index = safeJsonRead(indexPath(cwd));
  if (!index) throw new Error('INDEX.json not found. Run buildIndex() first.');

  const forward = {};
  const reverse = {};
  const moduleDeps = {};
  const fileSet = new Set(Object.keys(index.files));
  const aliases = loadPathAliases(cwd);

  for (const [filePath, fileInfo] of Object.entries(index.files)) {
    let imports;
    if (fileInfo.imports && fileInfo.imports.length > 0) {
      imports = fileInfo.imports;
    } else {
      const content = safeRead(path.resolve(cwd, filePath));
      if (!content) continue;
      imports = extractImports(content, getFileLanguage(filePath));
    }
    const resolvedImports = _resolveImports(imports, filePath, fileSet, aliases, cwd);
    if (resolvedImports.length > 0) {
      forward[filePath] = resolvedImports;
      for (const target of resolvedImports) {
        if (!reverse[target]) reverse[target] = [];
        reverse[target].push(filePath);
      }
    }
  }

  for (const [file, deps] of Object.entries(forward)) {
    const sourceModule = (index.files[file] || {}).module;
    if (!sourceModule) continue;
    if (!moduleDeps[sourceModule]) moduleDeps[sourceModule] = new Set();
    for (const dep of deps) {
      const targetModule = (index.files[dep] || {}).module;
      if (targetModule && targetModule !== sourceModule) moduleDeps[sourceModule].add(targetModule);
    }
  }

  const moduleDepsPlain = {};
  for (const [mod, deps] of Object.entries(moduleDeps)) moduleDepsPlain[mod] = [...deps];

  const circular = [];
  for (const [mod, deps] of Object.entries(moduleDepsPlain)) {
    for (const dep of deps) {
      if (moduleDepsPlain[dep] && moduleDepsPlain[dep].includes(mod)) {
        const pair = [mod, dep].sort().join(' <-> ');
        if (!circular.includes(pair)) circular.push(pair);
      }
    }
  }

  const totalEdges = Object.values(forward).reduce((sum, arr) => sum + arr.length, 0);
  const depsData = { version: VERSION, last_updated: isoNow(), forward, reverse, module_deps: moduleDepsPlain, circular };
  withFileLock(depsPath(cwd), () => safeJsonWrite(depsPath(cwd), depsData));

  withFileLock(indexPath(cwd), () => {
    const idx = safeJsonRead(indexPath(cwd));
    if (idx && idx.stats) {
      idx.stats.total_dependencies = totalEdges;
      for (const [mod, deps] of Object.entries(moduleDepsPlain)) {
        if (idx.modules[mod]) idx.modules[mod].dependencies = deps;
      }
      safeJsonWrite(indexPath(cwd), idx);
    }
  });

  return { ok: true, total_edges: totalEdges, circular_count: circular.length };
}

function getImpactedFiles(cwd, filePath) {
  const deps = safeJsonRead(depsPath(cwd));
  if (!deps) return { ok: false, error: 'DEPENDENCIES.json not found.' };
  const normalized = filePath.replace(/\\/g, '/');
  const impacted = deps.reverse[normalized] || [];
  const index = safeJsonRead(indexPath(cwd));
  const impactedModules = new Set();
  if (index && index.files) {
    for (const f of impacted) {
      const fileInfo = index.files[f];
      if (fileInfo && fileInfo.module) impactedModules.add(fileInfo.module);
    }
  }
  return { ok: true, file: normalized, impacted_files: impacted, impacted_modules: [...impactedModules] };
}

module.exports = { buildDependencyGraph, getImpactedFiles, loadPathAliases };
