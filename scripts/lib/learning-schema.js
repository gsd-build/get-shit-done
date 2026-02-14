/**
 * Learning Schema Definitions
 *
 * Zod schemas for validating extracted learnings from phase summaries
 * and verification reports.
 */

const { z } = require('zod');

/**
 * Decision Schema
 * Represents an important choice made during a phase
 */
const DecisionSchema = z.object({
  decision: z.string().describe('What was decided'),
  rationale: z.string().describe('Why this decision was made'),
  alternatives: z.array(z.string()).optional().describe('Other options considered'),
  outcome: z.string().optional().describe('Result of this decision, if known')
});

/**
 * Pattern Schema
 * Represents a reusable approach that worked well
 */
const PatternSchema = z.object({
  pattern: z.string().describe('Name or description of the pattern'),
  context: z.string().describe('When/where this pattern applies'),
  example: z.string().optional().describe('Concrete example from this phase'),
  antiPattern: z.string().optional().describe('What to avoid')
});

/**
 * Mistake Schema
 * Represents something that went wrong and how to prevent it
 */
const MistakeSchema = z.object({
  what: z.string().describe('What went wrong'),
  why: z.string().describe('Why it happened'),
  prevention: z.string().describe('How to prevent this in the future'),
  warningSigns: z.array(z.string()).optional().describe('Early indicators of this problem')
});

/**
 * Pitfall Schema
 * Represents something that seemed simple but had hidden complexity
 */
const PitfallSchema = z.object({
  description: z.string().describe('What the pitfall is'),
  complexity: z.string().describe('Why it was more complex than expected'),
  solution: z.string().describe('How it was solved')
});

/**
 * Phase Learnings Schema
 * Complete learnings extracted from a single phase
 */
const PhaseLearningsSchema = z.object({
  decisions: z.array(DecisionSchema).default([]),
  patterns: z.array(PatternSchema).default([]),
  mistakes: z.array(MistakeSchema).default([]),
  pitfalls: z.array(PitfallSchema).default([]),

  // Metadata
  extractedAt: z.string().describe('ISO timestamp of extraction'),
  source: z.string().describe('Source file(s) for this extraction'),
  milestone: z.string().describe('Milestone version'),
  phase: z.string().describe('Phase identifier')
});

// Export schemas and inferred types
module.exports = {
  DecisionSchema,
  PatternSchema,
  MistakeSchema,
  PitfallSchema,
  PhaseLearningsSchema
};
