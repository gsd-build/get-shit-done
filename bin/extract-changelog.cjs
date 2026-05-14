#!/usr/bin/env node
'use strict';

/**
 * Extract changelog entries between two versions.
 *
 * Usage:
 *   node extract-changelog.cjs --from <installed> --to <latest> [changelog-file]
 *   curl -sL <url> | node extract-changelog.cjs --from <installed> --to <latest> -
 *
 * Reads from file arg (default: stdin), parses Keep-a-Changelog format,
 * and prints only sections between --from (exclusive) and --to (inclusive).
 * Exit 0 with output, exit 1 on usage error, exit 2 if no matching range found.
 */

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = { from: null, to: null, file: null };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--from' && rest[i + 1]) { args.from = rest[++i]; continue; }
    if (rest[i] === '--to' && rest[i + 1]) { args.to = rest[++i]; continue; }
    if (rest[i] === '--json') { args.json = true; continue; }
    if (rest[i] === '--help' || rest[i] === '-h') {
      console.log('Usage: extract-changelog.cjs --from <version> --to <version> [file|-]');
      console.log('  Reads changelog from file or stdin, extracts entries between versions.');
      process.exit(0);
    }
    args.file = rest[i];
  }
  if (!args.from || !args.to) {
    console.error('Error: --from and --to are required');
    process.exit(1);
  }
  return args;
}

function parseVersion(tag) {
  // Strip leading 'v' if present
  const v = tag.replace(/^v/, '');
  return v.split('.').map(Number);
}

function versionGt(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

function versionEq(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  return pa[0] === pb[0] && pa[1] === pb[1] && pa[2] === pb[2];
}

function versionGte(a, b) {
  return versionEq(a, b) || versionGt(a, b);
}

function extractSections(text, fromVersion, toVersion) {
  // Split into version sections using ## [version] headers
  // Pattern: ## [X.Y.Z] or ## [X.Y.Z](...) - YYYY-MM-DD
  const versionHeaderRe = /^## \[(\d+\.\d+\.\d+)\]/gm;
  const sections = [];
  let match;

  while ((match = versionHeaderRe.exec(text)) !== null) {
    sections.push({
      version: match[1],
      start: match.index,
      headerEnd: match.index + match[0].length,
    });
  }

  if (sections.length === 0) {
    return null;
  }

  // Determine end position for each section (start of next section or end of text)
  for (let i = 0; i < sections.length; i++) {
    if (i + 1 < sections.length) {
      sections[i].end = sections[i + 1].start;
    } else {
      sections[i].end = text.length;
    }
  }

  // Collect sections where version > fromVersion AND version <= toVersion
  const collected = [];
  for (const section of sections) {
    if (versionGt(section.version, fromVersion) && !versionGt(section.version, toVersion)) {
      collected.push({
        version: section.version,
        content: text.slice(section.start, section.end).trimEnd(),
      });
    }
  }

  return collected;
}

function main() {
  const args = parseArgs(process.argv);
  let text;

  if (args.file && args.file !== '-') {
    text = fs.readFileSync(path.resolve(args.file), 'utf8');
  } else {
    // Read from stdin
    text = fs.readFileSync(0, 'utf8');
  }

  const sections = extractSections(text, args.from, args.to);

  if (!sections || sections.length === 0) {
    if (args.json) {
      console.log(JSON.stringify({ ok: false, versions: [], count: 0 }));
    } else {
      console.error(`No changelog entries found between v${args.from} and v${args.to}`);
    }
    process.exit(2);
  }

  if (args.json) {
    console.log(JSON.stringify({
      ok: true,
      from: args.from,
      to: args.to,
      count: sections.length,
      versions: sections.map(s => s.version),
    }));
    return;
  }

  // Print collected sections
  for (let i = 0; i < sections.length; i++) {
    if (i > 0) console.log('');
    console.log(sections[i].content);
  }
}

main();
