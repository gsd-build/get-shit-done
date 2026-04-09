/**
 * Research gate — validates RESEARCH.md for unresolved open questions
 * before allowing plan-phase to proceed (#1602).
 *
 * Pure functions: no I/O, no side effects. The caller reads the file
 * and passes the content string.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ResearchGateResult {
  /** Whether research is clear to proceed to planning */
  pass: boolean;
  /** Unresolved questions found (empty if pass=true) */
  unresolvedQuestions: string[];
}

// ─── Open questions detection ───────────────────────────────────────────────

/**
 * Check RESEARCH.md content for unresolved open questions.
 *
 * Rules:
 * - If no "## Open Questions" section exists → pass
 * - If section header has "(RESOLVED)" suffix → pass
 * - If section exists but is empty (only whitespace before next heading) → pass
 * - Otherwise → fail with list of unresolved questions
 */
export function checkResearchGate(researchContent: string): ResearchGateResult {
  // Find "## Open Questions" section (case-insensitive)
  const sectionMatch = researchContent.match(
    /^##\s+Open\s+Questions\b([^\n]*)/im,
  );

  if (!sectionMatch) {
    return { pass: true, unresolvedQuestions: [] };
  }

  // Check for (RESOLVED) suffix on the heading
  const headingSuffix = sectionMatch[1].trim();
  if (/\(resolved\)/i.test(headingSuffix)) {
    return { pass: true, unresolvedQuestions: [] };
  }

  // Extract section content until next heading or EOF
  const headingIndex = researchContent.indexOf(sectionMatch[0]);
  const afterHeading = researchContent.slice(headingIndex + sectionMatch[0].length);

  // Find next heading at same or higher level
  const nextHeadingMatch = afterHeading.match(/\n##\s+[^\n]/);
  const sectionBody = nextHeadingMatch
    ? afterHeading.slice(0, nextHeadingMatch.index)
    : afterHeading;

  // Extract question items (numbered list or bullet points)
  const unresolvedQuestions: string[] = [];
  let totalQuestionLines = 0;
  const lines = sectionBody.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Match: "1. **Question**", "- **Question**", "* **Question**", "1. Question"
    const questionMatch = trimmed.match(
      /^(?:\d+[.)]\s*|\*\s+|-\s+)\*{0,2}([^*\n]+)\*{0,2}/,
    );
    if (questionMatch) {
      totalQuestionLines++;
      const questionText = questionMatch[1].trim();
      // Skip questions marked as resolved inline (handles — RESOLVED, - RESOLVED, RESOLVED:, etc.)
      if (!/\bresolved\b/i.test(trimmed)) {
        unresolvedQuestions.push(questionText);
      }
    }
  }

  // Empty section body → pass
  if (sectionBody.trim() === '') {
    return { pass: true, unresolvedQuestions: [] };
  }

  // All question lines were resolved → pass
  if (totalQuestionLines > 0 && unresolvedQuestions.length === 0) {
    return { pass: true, unresolvedQuestions: [] };
  }

  // Unresolved questions found → fail
  if (unresolvedQuestions.length > 0) {
    return { pass: false, unresolvedQuestions };
  }

  // Section has content but no parseable question lines → fail conservatively
  // (e.g., prose-style questions without list formatting)
  return { pass: false, unresolvedQuestions: ['(unstructured open questions detected — review ## Open Questions section)'] };
}
