/**
 * Frontmatter — Org property drawer parsing, serialization, and CRUD commands
 */

const fs = require('fs');
const path = require('path');
const { safeReadFile, output, error } = require('./core.cjs');

// ─── Parsing engine ───────────────────────────────────────────────────────────

/**
 * Parse an inline array value like "[a, b, c]" or '["a, x", "b"]'.
 * Tries JSON.parse first (handles quoted strings with commas),
 * falls back to comma-split for simple unquoted arrays.
 */
function parseInlineArray(value) {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(s => String(s));
  } catch { /* fall through */ }

  // Quote-aware comma splitter: respects single/double quotes so commas
  // inside quoted values are not treated as delimiters.
  const inner = value.slice(1, -1);
  const items = [];
  let current = '';
  let quoteChar = null;

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (quoteChar) {
      if (ch === quoteChar) {
        quoteChar = null;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      quoteChar = ch;
    } else if (ch === ',') {
      const trimmed = current.trim();
      if (trimmed) items.push(trimmed);
      current = '';
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) items.push(trimmed);

  return items;
}

function extractFrontmatter(content) {
  const frontmatter = {};
  const match = content.match(/^:PROPERTIES:\n([\s\S]+?)\n:END:/);
  if (!match) return frontmatter;

  const props = match[1];
  const lines = props.split('\n');

  for (const line of lines) {
    if (line.trim() === '') continue;

    // Match :key: value pattern (org property drawer format)
    const keyMatch = line.match(/^:([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*):\s*(.*)/);
    if (!keyMatch) continue;

    const fullKey = keyMatch[1];
    const value = keyMatch[2].trim();

    // Handle dot-notation keys for nested objects (e.g., "tech-stack.added")
    const parts = fullKey.split('.');

    if (parts.length === 1) {
      // Simple key
      const key = parts[0];
      if (value === '' || value === '{}') {
        frontmatter[key] = {};
      } else if (value === '[]') {
        frontmatter[key] = [];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = parseInlineArray(value);
      } else {
        frontmatter[key] = value.replace(/^["']|["']$/g, '');
      }
    } else {
      // Dot-notation: build nested object
      let target = frontmatter;
      for (let i = 0; i < parts.length - 1; i++) {
        if (target[parts[i]] === undefined || typeof target[parts[i]] !== 'object' || Array.isArray(target[parts[i]])) {
          target[parts[i]] = {};
        }
        target = target[parts[i]];
      }

      const leafKey = parts[parts.length - 1];
      if (value === '' || value === '{}') {
        target[leafKey] = {};
      } else if (value === '[]') {
        target[leafKey] = [];
      } else if (value.startsWith('[') && value.endsWith(']')) {
        target[leafKey] = parseInlineArray(value);
      } else {
        target[leafKey] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  return frontmatter;
}

function reconstructFrontmatter(obj, prefix) {
  const lines = [];
  prefix = prefix || '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`:${fullKey}: []`);
      } else {
        const needsQuoting = value.some(v => String(v).includes(','));
        const items = needsQuoting
          ? value.map(v => `"${String(v)}"`)
          : value.map(v => String(v));
        lines.push(`:${fullKey}: [${items.join(', ')}]`);
      }
    } else if (typeof value === 'object') {
      // Recurse into nested objects with dot-notation
      const nested = reconstructFrontmatter(value, fullKey);
      if (nested) lines.push(nested);
    } else {
      const sv = String(value);
      if (sv.includes(':') || sv.includes('#') || sv.startsWith('[') || sv.startsWith('{')) {
        lines.push(`:${fullKey}: "${sv}"`);
      } else {
        lines.push(`:${fullKey}: ${sv}`);
      }
    }
  }
  return lines.join('\n');
}

function spliceFrontmatter(content, newObj) {
  const propsStr = reconstructFrontmatter(newObj);
  const match = content.match(/^:PROPERTIES:\n[\s\S]+?\n:END:/);
  if (match) {
    return `:PROPERTIES:\n${propsStr}\n:END:` + content.slice(match[0].length);
  }
  return `:PROPERTIES:\n${propsStr}\n:END:\n\n` + content;
}

function parseMustHavesBlock(content, blockName) {
  // Extract a specific block from must_haves in property drawer format
  // Uses dot-notation: :must_haves.artifacts: or :must_haves.key_links:
  const fmMatch = content.match(/^:PROPERTIES:\n([\s\S]+?)\n:END:/);
  if (!fmMatch) return [];

  const props = fmMatch[1];
  // Look for :must_haves.{blockName}: [values]
  const pattern = new RegExp(`:must_haves\\.${blockName}:\\s*(.+)`, 'm');
  const match = props.match(pattern);
  if (!match) return [];

  const value = match[1].trim();

  if (value.startsWith('[') && value.endsWith(']')) {
    return parseInlineArray(value);
  }

  return [];
}

// ─── Frontmatter CRUD commands ────────────────────────────────────────────────

const FRONTMATTER_SCHEMAS = {
  plan: { required: ['phase', 'plan', 'type', 'wave', 'depends_on', 'files_modified', 'autonomous', 'must_haves'] },
  summary: { required: ['phase', 'plan', 'subsystem', 'tags', 'duration', 'completed'] },
  verification: { required: ['phase', 'verified', 'status', 'score'] },
};

function cmdFrontmatterGet(cwd, filePath, field, raw) {
  if (!filePath) { error('file path required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }
  const fm = extractFrontmatter(content);
  if (field) {
    const value = fm[field];
    if (value === undefined) { output({ error: 'Field not found', field }, raw); return; }
    output({ [field]: value }, raw, JSON.stringify(value));
  } else {
    output(fm, raw);
  }
}

function cmdFrontmatterSet(cwd, filePath, field, value, raw) {
  if (!filePath || !field || value === undefined) { error('file, field, and value required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  if (!fs.existsSync(fullPath)) { output({ error: 'File not found', path: filePath }, raw); return; }
  const content = fs.readFileSync(fullPath, 'utf-8');
  const fm = extractFrontmatter(content);
  let parsedValue;
  try { parsedValue = JSON.parse(value); } catch { parsedValue = value; }
  fm[field] = parsedValue;
  const newContent = spliceFrontmatter(content, fm);
  fs.writeFileSync(fullPath, newContent, 'utf-8');
  output({ updated: true, field, value: parsedValue }, raw, 'true');
}

function cmdFrontmatterMerge(cwd, filePath, data, raw) {
  if (!filePath || !data) { error('file and data required'); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  if (!fs.existsSync(fullPath)) { output({ error: 'File not found', path: filePath }, raw); return; }
  const content = fs.readFileSync(fullPath, 'utf-8');
  const fm = extractFrontmatter(content);
  let mergeData;
  try { mergeData = JSON.parse(data); } catch { error('Invalid JSON for --data'); return; }
  Object.assign(fm, mergeData);
  const newContent = spliceFrontmatter(content, fm);
  fs.writeFileSync(fullPath, newContent, 'utf-8');
  output({ merged: true, fields: Object.keys(mergeData) }, raw, 'true');
}

function cmdFrontmatterValidate(cwd, filePath, schemaName, raw) {
  if (!filePath || !schemaName) { error('file and schema required'); }
  const schema = FRONTMATTER_SCHEMAS[schemaName];
  if (!schema) { error(`Unknown schema: ${schemaName}. Available: ${Object.keys(FRONTMATTER_SCHEMAS).join(', ')}`); }
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  const content = safeReadFile(fullPath);
  if (!content) { output({ error: 'File not found', path: filePath }, raw); return; }
  const fm = extractFrontmatter(content);
  const missing = schema.required.filter(f => fm[f] === undefined);
  const present = schema.required.filter(f => fm[f] !== undefined);
  output({ valid: missing.length === 0, missing, present, schema: schemaName }, raw, missing.length === 0 ? 'valid' : 'invalid');
}

module.exports = {
  extractFrontmatter,
  reconstructFrontmatter,
  spliceFrontmatter,
  parseMustHavesBlock,
  FRONTMATTER_SCHEMAS,
  cmdFrontmatterGet,
  cmdFrontmatterSet,
  cmdFrontmatterMerge,
  cmdFrontmatterValidate,
};
