'use strict';

/**
 * Pure renderer for the changeset-fragment workflow (#2975).
 *
 * Returns a typed Changelog IR — no file I/O. The IR is the contract that
 * tests assert on; the markdown serializer is a separate concern.
 *
 *   IR shape: {
 *     releaseHeader: { version: string, date: string },
 *     sections: [{ type: string, bullets: [{ pr: number, body: string }] }],
 *     priorChangelog: string | null,
 *   }
 */
// Keep a Changelog (https://keepachangelog.com) standard section order.
const SECTION_ORDER = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];

function renderChangelog({ fragments, version, date, priorChangelog }) {
  const byType = new Map();
  for (const f of fragments) {
    if (!byType.has(f.type)) byType.set(f.type, []);
    byType.get(f.type).push({ pr: f.pr, body: f.body });
  }
  const sections = SECTION_ORDER
    .filter((type) => byType.has(type))
    .map((type) => ({ type, bullets: byType.get(type) }));
  return {
    releaseHeader: { version, date },
    sections,
    priorChangelog: priorChangelog || null,
  };
}

module.exports = { renderChangelog };
