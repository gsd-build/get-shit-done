export interface CategorySuggestion {
  category: string;
  confidence: number;
}

export const BASE_CATEGORIES = [
  'general',
  'backend/api',
  'frontend/ui',
  'workflow',
  'tests',
  'docs',
  'bugfix',
] as const;

const RULES: Array<{ category: string; patterns: RegExp[] }> = [
  { category: 'backend/api', patterns: [/\bapi\b/i, /\broute\b/i, /\bendpoint\b/i, /\b404\b/i] },
  { category: 'frontend/ui', patterns: [/\bui\b/i, /\bmodal\b/i, /\bpage\b/i, /\bdashboard\b/i] },
  { category: 'workflow', patterns: [/\bdiscuss\b/i, /\bplan\b/i, /\bverify\b/i, /\bexecute\b/i] },
  { category: 'tests', patterns: [/\btest\b/i, /\be2e\b/i, /\bcoverage\b/i] },
  { category: 'docs', patterns: [/\bdocs?\b/i, /\breadme\b/i, /\bcontext\b/i] },
  { category: 'bugfix', patterns: [/\bfix\b/i, /\bbug\b/i, /\bbroken\b/i, /\berror\b/i] },
];

export function detectCategoryFromIntent(intent: string): CategorySuggestion {
  const text = intent.trim();
  if (!text) {
    return { category: 'general', confidence: 0 };
  }

  let best: CategorySuggestion = { category: 'general', confidence: 0.2 };
  for (const rule of RULES) {
    const matches = rule.patterns.filter((p) => p.test(text)).length;
    if (matches === 0) continue;
    const confidence = Math.min(0.95, 0.35 + matches * 0.2);
    if (confidence > best.confidence) {
      best = { category: rule.category, confidence };
    }
  }
  return best;
}

