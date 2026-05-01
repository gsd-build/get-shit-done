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
 */
function parseChangelog(text) {
  const releases = [];
  const lines = text.split(/\r?\n/);
  let cur = null;
  let curSection = null;
  for (const line of lines) {
    const releaseMatch = line.match(/^##\s+\[([^\]]+)\](?:\s*-\s*(\S+))?/);
    if (releaseMatch) {
      cur = { version: releaseMatch[1], date: releaseMatch[2] || null, sections: [] };
      curSection = null;
      releases.push(cur);
      continue;
    }
    if (!cur) continue;
    const sectionMatch = line.match(/^###\s+(.+?)\s*$/);
    if (sectionMatch) {
      curSection = { type: sectionMatch[1], bullets: [] };
      cur.sections.push(curSection);
      continue;
    }
    if (!curSection) continue;
    const bulletMatch = line.match(/^-\s+(.*?)\s*\(#(\d+)\)\s*$/);
    if (bulletMatch) {
      curSection.bullets.push({ body: bulletMatch[1], pr: Number(bulletMatch[2]) });
    }
  }
  return { releases };
}

module.exports = { serializeChangelog, parseChangelog };
