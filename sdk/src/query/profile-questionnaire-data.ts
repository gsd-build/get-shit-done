/**
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

export const PROFILING_QUESTIONS: ProfilingQuestion[] = [
  {
    dimension: 'communication_style',
    header: 'Communication Style',
    context: 'Think about the last few times you asked Claude to build or change something. How did you frame the request?',
    question: 'When you ask Claude to build something, how much context do you typically provide?',
    options: [
      { label: 'Minimal -- "fix the bug", "add dark mode", just say what\'s needed', value: 'a', rating: 'terse-direct' },
      { label: 'Some context -- explain what and why in a paragraph or two', value: 'b', rating: 'conversational' },
      { label: 'Detailed specs -- headers, numbered lists, problem analysis, constraints', value: 'c', rating: 'detailed-structured' },
      { label: 'It depends on the task -- simple tasks get short prompts, complex ones get detailed specs', value: 'd', rating: 'mixed' },
    ],
  },
  {
    dimension: 'decision_speed',
    header: 'Decision Making',
    context: 'Think about times when Claude presented you with multiple options -- like choosing a library, picking an architecture, or selecting an approach.',
    question: 'When Claude presents you with options, how do you typically decide?',
    options: [
      { label: 'Pick quickly based on gut feeling or past experience', value: 'a', rating: 'fast-intuitive' },
      { label: 'Ask for a comparison table or pros/cons, then decide', value: 'b', rating: 'deliberate-informed' },
      { label: 'Research independently (read docs, check GitHub stars) before deciding', value: 'c', rating: 'research-first' },
      { label: 'Let Claude recommend -- I generally trust the suggestion', value: 'd', rating: 'delegator' },
    ],
  },
  {
    dimension: 'explanation_depth',
    header: 'Explanation Preferences',
    context: 'Think about when Claude explains code it wrote or an approach it took. How much detail feels right?',
    question: 'When Claude explains something, how much detail do you want?',
    options: [
      { label: 'Just the code -- I\'ll read it and figure it out myself', value: 'a', rating: 'code-only' },
      { label: 'Brief explanation with the code -- a sentence or two about the approach', value: 'b', rating: 'concise' },
      { label: 'Detailed walkthrough -- explain the approach, trade-offs, and code structure', value: 'c', rating: 'detailed' },
      { label: 'Deep dive -- teach me the concepts behind it so I understand the fundamentals', value: 'd', rating: 'educational' },
    ],
  },
  {
    dimension: 'debugging_approach',
    header: 'Debugging Style',
    context: 'Think about the last few times something broke in your code. How did you approach it with Claude?',
    question: 'When something breaks, how do you typically approach debugging with Claude?',
    options: [
      { label: 'Paste the error and say "fix it" -- get it working fast', value: 'a', rating: 'fix-first' },
      { label: 'Share the error plus context, ask Claude to diagnose what went wrong', value: 'b', rating: 'diagnostic' },
      { label: 'Investigate myself first, then ask Claude about my specific theories', value: 'c', rating: 'hypothesis-driven' },
      { label: 'Walk through the code together step by step to understand the issue', value: 'd', rating: 'collaborative' },
    ],
  },
  {
    dimension: 'ux_philosophy',
    header: 'UX Philosophy',
    context: 'Think about user-facing features you have built recently. How did you balance functionality with design?',
    question: 'When building user-facing features, what do you prioritize?',
    options: [
      { label: 'Get it working first, polish the UI later (or never)', value: 'a', rating: 'function-first' },
      { label: 'Basic usability from the start -- nothing ugly, but no pixel-perfection', value: 'b', rating: 'pragmatic' },
      { label: 'Design and UX are as important as functionality -- I care about the experience', value: 'c', rating: 'design-conscious' },
      { label: 'I mostly build backend, CLI, or infrastructure -- UX is minimal', value: 'd', rating: 'backend-focused' },
    ],
  },
  {
    dimension: 'vendor_philosophy',
    header: 'Library & Vendor Choices',
    context: 'Think about the last time you needed a library or service for a project. How did you go about choosing it?',
    question: 'When choosing libraries or services, what is your typical approach?',
    options: [
      { label: 'Use whatever Claude suggests -- speed matters more than the perfect choice', value: 'a', rating: 'pragmatic-fast' },
      { label: 'Prefer well-known, battle-tested options (React, PostgreSQL, Express)', value: 'b', rating: 'conservative' },
      { label: 'Research alternatives, read docs, compare benchmarks before committing', value: 'c', rating: 'thorough-evaluator' },
      { label: 'Strong opinions -- I already know what I like and I stick with it', value: 'd', rating: 'opinionated' },
    ],
  },
  {
    dimension: 'frustration_triggers',
    header: 'Frustration Triggers',
    context: 'Think about moments when working with AI coding assistants that made you frustrated or annoyed.',
    question: 'What frustrates you most when working with AI coding assistants?',
    options: [
      { label: 'Doing things I didn\'t ask for -- adding features, refactoring code, scope creep', value: 'a', rating: 'scope-creep' },
      { label: 'Not following instructions precisely -- ignoring constraints or requirements I stated', value: 'b', rating: 'instruction-adherence' },
      { label: 'Over-explaining or being too verbose -- just give me the code and move on', value: 'c', rating: 'verbosity' },
      { label: 'Breaking working code while fixing something else -- regressions', value: 'd', rating: 'regression' },
    ],
  },
  {
    dimension: 'learning_style',
    header: 'Learning Preferences',
    context: 'Think about encountering something new -- an unfamiliar library, a codebase you inherited, a concept you hadn\'t used before.',
    question: 'When you encounter something new in your codebase, how do you prefer to learn about it?',
    options: [
      { label: 'Read the code directly -- I figure things out by reading and experimenting', value: 'a', rating: 'self-directed' },
      { label: 'Ask Claude to explain the relevant parts to me', value: 'b', rating: 'guided' },
      { label: 'Read official docs and tutorials first, then try things', value: 'c', rating: 'documentation-first' },
      { label: 'See a working example, then modify it to understand how it works', value: 'd', rating: 'example-driven' },
    ],
  },
];

export const CLAUDE_INSTRUCTIONS: Record<string, Record<string, string>> = {
  communication_style: {
    'terse-direct': 'Keep responses concise and action-oriented. Skip lengthy preambles. Match this developer\'s direct style.',
    'conversational': 'Use a natural conversational tone. Explain reasoning briefly alongside code. Engage with the developer\'s questions.',
    'detailed-structured': 'Match this developer\'s structured communication: use headers for sections, numbered lists for steps, and acknowledge provided context before responding.',
    'mixed': 'Adapt response detail to match the complexity of each request. Brief for simple tasks, detailed for complex ones.',
  },
  decision_speed: {
    'fast-intuitive': 'Present a single strong recommendation with brief justification. Skip lengthy comparisons unless asked.',
    'deliberate-informed': 'Present options in a structured comparison table with pros/cons. Let the developer make the final call.',
    'research-first': 'Include links to docs, GitHub repos, or benchmarks when recommending tools. Support the developer\'s research process.',
    'delegator': 'Make clear recommendations with confidence. Explain your reasoning briefly, but own the suggestion.',
  },
  explanation_depth: {
    'code-only': 'Prioritize code output. Add comments inline rather than prose explanations. Skip walkthroughs unless asked.',
    'concise': 'Pair code with a brief explanation (1-2 sentences) of the approach. Keep prose minimal.',
    'detailed': 'Explain the approach, key trade-offs, and code structure alongside the implementation. Use headers to organize.',
    'educational': 'Teach the underlying concepts and principles, not just the implementation. Relate new patterns to fundamentals.',
  },
  debugging_approach: {
    'fix-first': 'Prioritize the fix. Show the corrected code first, then optionally explain what was wrong. Minimize diagnostic preamble.',
    'diagnostic': 'Diagnose the root cause before presenting the fix. Explain what went wrong and why the fix addresses it.',
    'hypothesis-driven': 'Engage with the developer\'s theories. Validate or refine their hypotheses before jumping to solutions.',
    'collaborative': 'Walk through the debugging process step by step. Explain the investigation approach, not just the conclusion.',
  },
  ux_philosophy: {
    'function-first': 'Focus on functionality and correctness. Keep UI minimal and functional. Skip design polish unless requested.',
    'pragmatic': 'Build clean, usable interfaces without over-engineering. Apply basic design principles (spacing, alignment, contrast).',
    'design-conscious': 'Invest in UX quality: thoughtful spacing, smooth transitions, responsive layouts. Treat design as a first-class concern.',
    'backend-focused': 'Optimize for developer experience (clear APIs, good error messages, helpful CLI output) over visual design.',
  },
  vendor_philosophy: {
    'pragmatic-fast': 'Suggest libraries quickly based on popularity and reliability. Don\'t over-analyze choices for non-critical dependencies.',
    'conservative': 'Recommend well-established, widely-adopted tools with strong community support. Avoid bleeding-edge options.',
    'thorough-evaluator': 'Compare alternatives with specific metrics (bundle size, GitHub stars, maintenance activity). Support informed decisions.',
    'opinionated': 'Respect the developer\'s existing tool preferences. Ask before suggesting alternatives to their preferred stack.',
  },
  frustration_triggers: {
    'scope-creep': 'Do exactly what is asked -- nothing more. Never add unrequested features, refactoring, or "improvements". Ask before expanding scope.',
    'instruction-adherence': 'Follow instructions precisely. Re-read constraints before responding. If requirements conflict, flag the conflict rather than silently choosing.',
    'verbosity': 'Be concise. Lead with code, follow with brief explanation only if needed. Avoid restating the problem or unnecessary context.',
    'regression': 'Before modifying working code, verify the change is safe. Run existing tests mentally. Flag potential regression risks explicitly.',
  },
  learning_style: {
    'self-directed': 'Point to relevant code sections and let the developer explore. Add signposts (file paths, function names) rather than full explanations.',
    'guided': 'Explain concepts in context of the developer\'s codebase. Use their actual code as examples when teaching.',
    'documentation-first': 'Link to official documentation and relevant sections. Structure explanations like reference material.',
    'example-driven': 'Lead with working code examples. Show a minimal example first, then explain how to extend or modify it.',
  },
};

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
  return `Adapt to this developer's ${dimension.replace(/_/g, ' ')} preference: ${rating}.`;
}
