/**
 * Knowledge Layer — Source code analysis
 * Language detection, export/import extraction, module guessing.
 */
'use strict';

const path = require('path');
const { LANG_MAP, IGNORE_DIRS } = require('./constants.cjs');

function getFileLanguage(filePath) {
  return LANG_MAP[path.extname(filePath).toLowerCase()] || 'unknown';
}

function extractExports(content, lang) {
  const exports = [];
  if (['javascript', 'typescript'].includes(lang)) {
    const pats = [
      /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g,
      /module\.exports\s*=\s*\{([^}]+)\}/g,
      /exports\.(\w+)\s*=/g,
    ];
    for (const p of pats) {
      let m;
      while ((m = p.exec(content)) !== null) {
        if (m[1] && m[1].includes(',')) {
          m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(e => exports.push(e));
        } else if (m[1]) exports.push(m[1].trim());
      }
    }
  } else if (lang === 'python') {
    const pats = [/^def\s+(\w+)/gm, /^class\s+(\w+)/gm];
    for (const p of pats) { let m; while ((m = p.exec(content)) !== null) exports.push(m[1]); }
  } else if (lang === 'go') {
    const p = /^func\s+(\p{Lu}\w*)/gmu;
    let m;
    while ((m = p.exec(content)) !== null) exports.push(m[1]);
  } else if (lang === 'rust') {
    const p = /^pub\s+(?:fn|struct|enum|trait|type|const)\s+(\w+)/gm;
    let m;
    while ((m = p.exec(content)) !== null) exports.push(m[1]);
  }
  return [...new Set(exports)];
}

function extractImports(content, lang) {
  const imports = [];
  if (['javascript', 'typescript'].includes(lang)) {
    const pats = [
      /(?:import|require)\s*\(?['"]([^'"]+)['"]\)?/g,
      /from\s+['"]([^'"]+)['"]/g,
    ];
    for (const p of pats) { let m; while ((m = p.exec(content)) !== null) imports.push(m[1]); }
  } else if (lang === 'python') {
    const pats = [/^import\s+(\S+)/gm, /^from\s+(\S+)\s+import/gm];
    for (const p of pats) { let m; while ((m = p.exec(content)) !== null) imports.push(m[1]); }
  } else if (lang === 'go') {
    const p = /^\s*"([^"]+)"/gm;
    let m;
    while ((m = p.exec(content)) !== null) imports.push(m[1]);
  }
  return [...new Set(imports)];
}

function guessModule(filePath, cwd) {
  const rel = path.relative(cwd, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  const filtered = parts.filter(p => !IGNORE_DIRS.has(p));
  if (filtered.length <= 1) return 'root';
  return filtered[0] + (filtered.length > 2 ? '/' + filtered[1] : '');
}

module.exports = { getFileLanguage, extractExports, extractImports, guessModule };
