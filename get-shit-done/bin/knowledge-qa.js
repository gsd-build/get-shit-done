const { knowledge } = require('./knowledge.js');

// Question templates for common knowledge gaps
const QUESTION_TEMPLATES = {
  preferences: [
    'What testing strategy do you prefer for this project?',
    'Do you have a preference for error handling patterns?',
    'What commit message style does this project use?',
    'How do you prefer to structure API responses?',
    'What naming conventions should we follow?'
  ],
  architecture: [
    'What is the preferred way to handle database connections?',
    'How should we structure shared utilities?',
    'What logging approach works best for this project?',
    'How do you prefer to handle configuration?'
  ],
  workflow: [
    'What should I always do before pushing code?',
    'Are there any patterns I should avoid in this codebase?',
    'What documentation style works best here?',
    'How should I handle breaking changes?'
  ]
};

async function analyzeKnowledgeGaps(options = {}) {
  const { scope = 'project', cwd = process.cwd() } = options;

  // Get existing knowledge statistics
  let stats = { decision: 0, lesson: 0, total: 0 };

  try {
    if (knowledge.isReady(scope, cwd)) {
      const result = await knowledge.getStats({ scope });
      stats = result.reduce((acc, s) => {
        acc[s.type] = s.total_count;
        acc.total += s.total_count;
        return acc;
      }, { decision: 0, lesson: 0, total: 0 });
    }
  } catch (err) {
    // Proceed with defaults
  }

  // Identify gaps based on what's missing
  const gaps = [];

  if (stats.lesson < 5) {
    gaps.push('preferences');  // Few lessons = need preference info
  }
  if (stats.decision < 3) {
    gaps.push('architecture');  // Few decisions = need architecture context
  }
  if (stats.total < 10) {
    gaps.push('workflow');  // Low total = need workflow patterns
  }

  return { stats, gaps };
}

async function generateQuestions(options = {}) {
  const { maxQuestions = 5, scope = 'project' } = options;
  const { gaps } = await analyzeKnowledgeGaps({ scope });

  const questions = [];

  // Select questions from relevant categories
  for (const gap of gaps) {
    const templates = QUESTION_TEMPLATES[gap] || [];
    const remaining = maxQuestions - questions.length;

    if (remaining <= 0) break;

    // Take up to 2 questions per category
    const selected = templates.slice(0, Math.min(2, remaining));
    questions.push(...selected.map(q => ({
      question: q,
      category: gap
    })));
  }

  // If still need more, add from random categories
  while (questions.length < maxQuestions) {
    const categories = Object.keys(QUESTION_TEMPLATES);
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const templates = QUESTION_TEMPLATES[cat];
    const q = templates[Math.floor(Math.random() * templates.length)];

    // Avoid duplicates
    if (!questions.some(existing => existing.question === q)) {
      questions.push({ question: q, category: cat });
    }
  }

  return questions.slice(0, maxQuestions);
}

async function processAnswer(question, answer, options = {}) {
  const { scope = 'global' } = options;  // User preferences go to global

  if (!answer || answer.trim().length < 10) {
    return { stored: false, reason: 'answer_too_short' };
  }

  // Format as Q&A pair
  const content = `Q: ${question}\nA: ${answer.trim()}`;

  try {
    const { insertOrEvolve } = require('./knowledge-evolution.js');
    const { generateEmbedding } = require('./embeddings.js');

    const embedding = await generateEmbedding(content);

    // Check if knowledge system is ready
    if (!knowledge.isReady(scope)) {
      return { stored: false, reason: 'knowledge_unavailable' };
    }

    const conn = await knowledge._getConnection(scope);
    const result = await insertOrEvolve(conn, {
      content,
      type: 'lesson',
      scope,
      embedding,
      metadata: {
        source: 'qa_session',
        question,
        category: options.category || 'general',
        answered_at: Date.now()
      }
    });

    return {
      stored: true,
      action: result.action,
      id: result.id
    };
  } catch (err) {
    return { stored: false, reason: err.message };
  }
}

async function runQASession(options = {}) {
  const { maxQuestions = 5, askUser, onComplete } = options;

  if (typeof askUser !== 'function') {
    throw new Error('askUser callback required for Q&A session');
  }

  const questions = await generateQuestions({ maxQuestions });
  const results = [];

  console.log('\n=== Knowledge Q&A Session ===');
  console.log('Help me learn your preferences and patterns.\n');

  for (const { question, category } of questions) {
    try {
      const answer = await askUser(question);

      if (answer && answer.trim()) {
        const result = await processAnswer(question, answer, {
          scope: 'global',
          category
        });
        results.push({ question, answer, ...result });

        if (result.stored) {
          console.log(`  -> Learned (${result.action})`);
        }
      } else {
        results.push({ question, skipped: true });
        console.log('  -> Skipped');
      }
    } catch (err) {
      results.push({ question, error: err.message });
    }
  }

  const summary = {
    total: questions.length,
    answered: results.filter(r => r.stored).length,
    skipped: results.filter(r => r.skipped).length,
    errors: results.filter(r => r.error).length,
    results
  };

  console.log(`\n=== Session Complete ===`);
  console.log(`Learned ${summary.answered} preferences\n`);

  if (onComplete) {
    onComplete(summary);
  }

  return summary;
}

module.exports = {
  QUESTION_TEMPLATES,
  analyzeKnowledgeGaps,
  generateQuestions,
  processAnswer,
  runQASession
};
