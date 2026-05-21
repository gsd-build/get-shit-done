'use strict';

/**
 * Markdown serializer + parser for the changelog IR. The two are inverses
 * over the well-formed subset; tests assert via round-trip (parse(serialize(ir)))
 * rather than by inspecting serialized text — see CONTRIBUTING.md
 * "Prohibited: Raw Text Matching on Test Outputs".
 *
 * Serialized form (Keep a Changelog):
 *
 *   ## [1.42.0] - 2026-05-01
 *
 *   ### Fixed
 *
 *   - body of the bullet (#NNNN)
 *
 *   <priorChangelog appended verbatim>
 */

function serializeChangelog(ir) {
  const lines = [];
  const { version, date } = ir.releaseHeader;
  lines.push(`## [${version}] - ${date}`);
  lines.push('');
  for (const section of ir.sections) {
    lines.push(`### ${section.type}`);
    lines.push('');
    for (const b of section.bullets) {
      lines.push(`- ${b.body} (#${b.pr})`);
    }
    lines.push('');
  }
  let out = lines.join('\n');
  if (ir.priorChangelog) {
    out += '\n' + ir.priorChangelog;
  }
  return out;
}

/**
 * Inverse parser: extracts the structured releases from a CHANGELOG.md
 * text. Returns { releases: [{ version, date, sections: [{ type, bullets:
 * [{ pr, body }] }] }] }. Tolerates the actual repo's CHANGELOG dialect.
 *
 * Multi-line bullets are supported: a bullet opens on a line starting with
 * `- ` and continues on lines starting with two or more spaces (or a tab).
 * The `(#NNNN)` PR trailer may appear on any continuation line.  Single-line
 * bullets (entire entry on one `- ` line) are still handled as before.
 *
 * Fix for #3496: the previous implementation only matched single-line bullets
 * whose `(#NNNN)` suffix was on the same line as the opening `- `.  Long
 * bullets — which wrap onto indented continuation lines — returned 0 entries
 * for their section even when the markdown was well-formed.
 */
function parseChangelog(text) {
  const releases = [];
  const lines = text.split(/\r?\n/);
  let cur = null;
  let curSection = null;
  // Accumulates lines belonging to the current in-flight bullet (may span
  // multiple lines).  Flushed when a new block-level element is encountered.
  let bulletLines = null;

  function flushBullet() {
    if (bulletLines === null || !curSection) return;
    const joined = bulletLines.join(' ').trim();
    // Locate the (# pr) trailer anywhere in the joined text.  The trailer is
    // expected to be at the very end, but we tolerate trailing whitespace.
    const trailMatch = joined.match(/^(.*?)\s*\(#(\d+)\)\s*$/);
    if (trailMatch) {
      curSection.bullets.push({ body: trailMatch[1].trim(), pr: Number(trailMatch[2]) });
    }
    bulletLines = null;
  }

  for (const line of lines) {
    const releaseMatch = line.match(/^##\s+\[([^\]]+)\](?:\s*-\s*(\S+))?/);
    if (releaseMatch) {
      flushBullet();
      cur = { version: releaseMatch[1], date: releaseMatch[2] || null, sections: [] };
      curSection = null;
      releases.push(cur);
      continue;
    }
    if (!cur) continue;
    const sectionMatch = line.match(/^###\s+(.+?)\s*$/);
    if (sectionMatch) {
      flushBullet();
      curSection = { type: sectionMatch[1], bullets: [] };
      cur.sections.push(curSection);
      continue;
    }
    if (!curSection) continue;

    // New bullet: line begins with `- ` (after optional leading spaces that
    // would indicate a nested list — we only handle top-level bullets here).
    if (/^-\s+/.test(line)) {
      flushBullet();
      bulletLines = [line.replace(/^-\s+/, '')];
      continue;
    }

    // Continuation line: indented with at least two spaces (or a tab).
    if (bulletLines !== null && /^[ \t]{2}/.test(line)) {
      bulletLines.push(line.trim());
      continue;
    }

    // Any other line (blank, heading, etc.) terminates a pending bullet.
    flushBullet();
  }
  flushBullet();

  return { releases };
}

module.exports = { serializeChangelog, parseChangelog };
