/**
 * One-off generator: extracts PROFILING_QUESTIONS + CLAUDE_INSTRUCTIONS from profile-output.cjs
 * Run: node scripts/gen-profile-questionnaire-data.mjs
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', '..');
const cjs = fs.readFileSync(join(root, 'get-shit-done/bin/lib/profile-output.cjs'), 'utf-8');

const m1 = cjs.match(/const PROFILING_QUESTIONS = (\[[\s\S]*?\]);/);
const m2 = cjs.match(/const CLAUDE_INSTRUCTIONS = (\{[\s\S]*?\n\});/);
if (!m1 || !m2) {
  console.error('regex extract failed');
  process.exit(1);
}

const header = `/**
 * Synced from get-shit-done/bin/lib/profile-output.cjs (PROFILING_QUESTIONS, CLAUDE_INSTRUCTIONS).
 * Used by profileQuestionnaire for parity with cmdProfileQuestionnaire.
 */

export type ProfilingOption = { label: string; value: string; rating: string };

export type ProfilingQuestion = {
  dimension: string;
  header: string;
  context: string;
  question: string;
  options: ProfilingOption[];
};

export const PROFILING_QUESTIONS: ProfilingQuestion[] = ${m1[1]};

export const CLAUDE_INSTRUCTIONS: Record<string, Record<string, string>> = ${m2[1]};

export function isAmbiguousAnswer(dimension: string, value: string): boolean {
  if (dimension === 'communication_style' && value === 'd') return true;
  const question = PROFILING_QUESTIONS.find((q) => q.dimension === dimension);
  if (!question) return false;
  const option = question.options.find((o) => o.value === value);
  if (!option) return false;
  return option.rating === 'mixed';
}

export function generateClaudeInstruction(dimension: string, rating: string): string {
  const dimInstructions = CLAUDE_INSTRUCTIONS[dimension];
  if (dimInstructions && dimInstructions[rating]) {
    return dimInstructions[rating]!;
  }
  return \`Adapt to this developer's \${dimension.replace(/_/g, ' ')} preference: \${rating}.\`;
}
`;

const outPath = join(root, 'sdk/src/query/profile-questionnaire-data.ts');
fs.writeFileSync(outPath, header);
console.log('wrote', outPath);
