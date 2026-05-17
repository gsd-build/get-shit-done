/**
 * Structural tests for ADR 0005 (SDK architecture seam-map) and
 * ADR 0006 (planning-path projection module), per issue #3271.
 *
 * Assertions parse the markdown by splitting on heading lines and inspect
 * typed records. The docs/adr/README.md index must exist and reference
 * both ADRs by filename.
 */

// allow-test-rule: heading-split structural parser for ADR markdown documents.
// Assertions target typed records (heading sets, status strings, filename refs),
// not raw .includes()/.match() on prose.

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ADR_DIR = path.join(__dirname, '..', 'docs', 'adr');
const README_PATH = path.join(ADR_DIR, 'README.md');

// --- Helpers -----------------------------------------------------------------

function parseAdr(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read ADR file: ${filePath} — ${err.message}`);
  }

  // CRLF-tolerant split: Windows checkouts (autocrlf=true) include \r\n.
  // Capture groups like /^##\s+(.+)$/ would otherwise pull a trailing \r
  // into headings (e.g. "decision\r"), breaking heading equality checks.
  const lines = raw.split(/\r?\n/);
  let title = null;
  const headings = [];
  let status = null;
  let date = null;

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1 && title === null) { title = h1[1].trim(); continue; }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) { headings.push(h2[1].trim().toLowerCase()); continue; }
    const statusMatch = line.match(/\*\*Status:\*\*\s*(.+)/);
    if (statusMatch && status === null) { status = statusMatch[1].trim(); continue; }
    const dateMatch = line.match(/\*\*Date:\*\*\s*(.+)/);
    if (dateMatch && date === null) { date = dateMatch[1].trim(); }
  }

  return { title, headings, status, date };
}

function parseReadmeIndex(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read ADR README: ${filePath} — ${err.message}`);
  }

  // CRLF-tolerant split: Windows checkouts (autocrlf=true) include \r\n.
  // Capture groups like /^##\s+(.+)$/ would otherwise pull a trailing \r
  // into headings (e.g. "decision\r"), breaking heading equality checks.
  const lines = raw.split(/\r?\n/);
  const linkedFiles = [];

  for (const line of lines) {
    const linkRe = /\[.*?\]\(\.?\/?([^)]+\.md)\)/g;
    let m;
    while ((m = linkRe.exec(line)) !== null) {
      linkedFiles.push(path.basename(m[1]));
    }
  }

  return { linkedFiles };
}

// --- ADR 0005: SDK Architecture seam-map -------------------------------------

describe('ADR 0005 — SDK architecture seam-map', () => {
  const adrPath = path.join(ADR_DIR, '0005-sdk-architecture-seam-map.md');

  test('file exists', () => {
    assert.ok(fs.existsSync(adrPath), `Expected ADR file to exist: ${adrPath}`);
  });

  test('has a title (H1 heading)', () => {
    const { title } = parseAdr(adrPath);
    assert.ok(title && title.length > 0, 'ADR must have a non-empty H1 title');
  });

  test('has Status metadata', () => {
    const { status } = parseAdr(adrPath);
    assert.ok(status && status.length > 0, 'ADR must have a **Status:** line');
  });

  test('has Date metadata', () => {
    const { date } = parseAdr(adrPath);
    assert.ok(date && date.length > 0, 'ADR must have a **Date:** line');
  });

  test('has Decision section', () => {
    const { headings } = parseAdr(adrPath);
    assert.ok(
      headings.some(h => h === 'decision'),
      `ADR must have a ## Decision section. Found headings: ${headings.join(', ')}`
    );
  });

  test('has Consequences section', () => {
    const { headings } = parseAdr(adrPath);
    assert.ok(
      headings.some(h => h === 'consequences'),
      `ADR must have a ## Consequences section. Found headings: ${headings.join(', ')}`
    );
  });

  test('cross-references at least two other ADR files', () => {
    // allow-test-rule: reading markdown link targets and backtick code spans
    // from ADR to build a typed set of referenced filenames.
    const raw = fs.readFileSync(adrPath, 'utf8');
    const refs = new Set();
    const linkRe = /\((\d{4}-[^)]*\.md)\)/g;
    let m;
    while ((m = linkRe.exec(raw)) !== null) { refs.add(path.basename(m[1])); }
    const codeRe = /`(\d{4}-[^`]*\.md)`/g;
    while ((m = codeRe.exec(raw)) !== null) { refs.add(path.basename(m[1])); }
    refs.delete('0005-sdk-architecture-seam-map.md');
    assert.ok(
      refs.size >= 2,
      `Seam-map ADR must cross-reference at least 2 other ADR files. Found: ${[...refs].join(', ')}`
    );
  });
});

// --- ADR 0006: Planning Path Projection Module --------------------------------

describe('ADR 0006 — planning-path projection module', () => {
  const adrPath = path.join(ADR_DIR, '0006-planning-path-projection-module.md');

  test('file exists', () => {
    assert.ok(fs.existsSync(adrPath), `Expected ADR file to exist: ${adrPath}`);
  });

  test('has a title (H1 heading)', () => {
    const { title } = parseAdr(adrPath);
    assert.ok(title && title.length > 0, 'ADR must have a non-empty H1 title');
  });

  test('has Status metadata', () => {
    const { status } = parseAdr(adrPath);
    assert.ok(status && status.length > 0, 'ADR must have a **Status:** line');
  });

  test('has Date metadata', () => {
    const { date } = parseAdr(adrPath);
    assert.ok(date && date.length > 0, 'ADR must have a **Date:** line');
  });

  test('has Decision section', () => {
    const { headings } = parseAdr(adrPath);
    assert.ok(
      headings.some(h => h === 'decision'),
      `ADR must have a ## Decision section. Found headings: ${headings.join(', ')}`
    );
  });

  test('has Consequences section', () => {
    const { headings } = parseAdr(adrPath);
    assert.ok(
      headings.some(h => h === 'consequences'),
      `ADR must have a ## Consequences section. Found headings: ${headings.join(', ')}`
    );
  });
});

// --- docs/adr/README.md index ------------------------------------------------

describe('docs/adr/README.md index', () => {
  test('README file exists', () => {
    assert.ok(
      fs.existsSync(README_PATH),
      `Expected docs/adr/README.md to exist: ${README_PATH}`
    );
  });

  test('links to ADR 0005', () => {
    const { linkedFiles } = parseReadmeIndex(README_PATH);
    assert.ok(
      linkedFiles.some(f => f === '0005-sdk-architecture-seam-map.md'),
      `README must link to 0005-sdk-architecture-seam-map.md. Found: ${linkedFiles.join(', ')}`
    );
  });

  test('links to ADR 0006', () => {
    const { linkedFiles } = parseReadmeIndex(README_PATH);
    assert.ok(
      linkedFiles.some(f => f === '0006-planning-path-projection-module.md'),
      `README must link to 0006-planning-path-projection-module.md. Found: ${linkedFiles.join(', ')}`
    );
  });

  test('links to all existing ADR files', () => {
    const existingAdrs = fs.readdirSync(ADR_DIR)
      .filter(f => /^\d{4}-.*\.md$/.test(f))
      .sort();

    const { linkedFiles } = parseReadmeIndex(README_PATH);

    for (const adrFile of existingAdrs) {
      assert.ok(
        linkedFiles.includes(adrFile),
        `README must link to every ADR. Missing: ${adrFile}`
      );
    }
  });
});
