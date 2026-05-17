'use strict';

const fs = require('node:fs');
const path = require('node:path');

function candidateNames() {
  return process.platform === 'win32'
    ? ['fallow.exe', 'fallow.cmd', 'fallow.bat', 'fallow']
    : ['fallow'];
}

function isExecutableFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    if (process.platform === 'win32') return true;
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findInPath(envPath) {
  if (!envPath) return null;
  const names = candidateNames();
  const segments = envPath.split(path.delimiter).filter(Boolean);
  for (const segment of segments) {
    for (const name of names) {
      const candidate = path.join(segment, name);
      if (isExecutableFile(candidate)) return candidate;
    }
  }
  return null;
}

function findInNodeModules(cwd) {
  const names = candidateNames();
  const binDir = path.join(cwd, 'node_modules', '.bin');
  for (const name of names) {
    const candidate = path.join(binDir, name);
    if (isExecutableFile(candidate)) return candidate;
  }
  return null;
}

function resolveFallowBinary({ cwd, envPath = process.env.PATH || '' }) {
  return findInNodeModules(cwd) || findInPath(envPath) || null;
}

function requireFallowBinary({ cwd, envPath = process.env.PATH || '' }) {
  const binary = resolveFallowBinary({ cwd, envPath });
  if (binary) return binary;
  throw new Error(
    'Fallow is enabled but no binary was found. Please install fallow via `npm install -D fallow` or `cargo install fallow`.',
  );
}

function normalizeFallowReport(report) {
  const unused = Array.isArray(report?.unusedExports) ? report.unusedExports : [];
  const duplicates = Array.isArray(report?.duplicates) ? report.duplicates : [];
  const circular = Array.isArray(report?.circularDependencies) ? report.circularDependencies : [];

  const findings = [];

  for (const item of unused) {
    findings.push({
      type: 'unused_export',
      message: `Unused export ${item.symbol || '<unknown>'}`,
      file: item.file || '',
      line: item.line ?? null,
    });
  }

  for (const item of duplicates) {
    findings.push({
      type: 'duplicate_block',
      message: `Duplicate block (${Math.round((item.similarity || 0) * 100)}% similarity)`,
      file: item.left?.file || '',
      line: item.left?.start ?? null,
      related_file: item.right?.file || '',
    });
  }

  for (const item of circular) {
    findings.push({
      type: 'circular_dependency',
      message: `Circular dependency: ${(item.cycle || []).join(' -> ')}`,
      file: Array.isArray(item.cycle) && item.cycle.length > 0 ? item.cycle[0] : '',
      line: null,
    });
  }

  return {
    summary: {
      unused_exports: unused.length,
      duplicates: duplicates.length,
      circular_dependencies: circular.length,
      total: findings.length,
    },
    findings,
  };
}

module.exports = {
  normalizeFallowReport,
  requireFallowBinary,
  resolveFallowBinary,
};
