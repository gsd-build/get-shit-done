/**
 * Knowledge Layer — Smart context assembly
 * Stemming, synonym expansion, relevance scoring, tiered module selection,
 * and token-budgeted context assembly for agent queries.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { STOP_WORDS } = require('./constants.cjs');
const {
  safeRead, safeJsonRead, safeJsonWrite, tokenEstimate, removeStopWords,
  withFileLock, knowledgeDir, indexPath, decisionsPath, patternsPath,
  conventionsPath, bugsPath, assumptionsPath,
} = require('./utils.cjs');
const { getChangedFilesSince } = require('./git-diff.cjs');

// ─── Synonym Groups ───────────────────────────────────────────────────────────

const SYNONYM_GROUPS = [
  ['auth', 'authentication', 'login', 'logout', 'signin', 'signup', 'session', 'token', 'jwt', 'oauth', 'credential', 'password'],
  ['database', 'db', 'sql', 'query', 'schema', 'migration', 'table', 'orm', 'postgres', 'mysql', 'sqlite', 'mongo'],
  ['api', 'endpoint', 'route', 'handler', 'controller', 'rest', 'graphql', 'request', 'response'],
  ['test', 'spec', 'assert', 'coverage', 'mock', 'stub', 'fixture'],
  ['deploy', 'deployment', 'release', 'publish', 'ship', 'rollout', 'ci', 'cd', 'pipeline'],
  ['error', 'exception', 'throw', 'catch', 'fault', 'failure', 'crash', 'bug'],
  ['config', 'configuration', 'settings', 'options', 'preferences', 'env', 'environment'],
  ['security', 'vulnerability', 'xss', 'csrf', 'injection', 'sanitize', 'audit'],
  ['cache', 'caching', 'memoize', 'redis', 'ttl', 'invalidate'],
  ['monitor', 'monitoring', 'observability', 'metric', 'alert', 'health', 'logging', 'trace'],
  ['performance', 'perf', 'optimize', 'bottleneck', 'latency', 'throughput', 'benchmark'],
  ['state', 'store', 'redux', 'context', 'provider', 'reducer', 'dispatch'],
  ['ui', 'component', 'render', 'view', 'template', 'layout', 'style', 'css'],
  ['queue', 'worker', 'job', 'background', 'async', 'cron', 'scheduler'],
  ['file', 'filesystem', 'read', 'write', 'stream', 'buffer', 'path', 'directory'],
];

const SYNONYM_MAP = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) {
    if (!SYNONYM_MAP.has(word)) SYNONYM_MAP.set(word, new Set());
    for (const syn of group) { if (syn !== word) SYNONYM_MAP.get(word).add(syn); }
  }
}

function expandSynonyms(terms) {
  const synonyms = new Set();
  const originalSet = new Set(terms);
  for (const term of terms) {
    const syns = SYNONYM_MAP.get(term);
    if (syns) { for (const s of syns) { if (!originalSet.has(s)) synonyms.add(s); } }
  }
  return { original: terms, synonyms: [...synonyms] };
}

// ─── Stemmer ──────────────────────────────────────────────────────────────────

function stem(word) {
  if (!word || word.length < 3) return word;
  let w = word.toLowerCase();
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies')) w = w.slice(0, -2);
  else if (w.endsWith('ss')) { /* keep */ }
  else if (w.endsWith('s') && w.length > 3) w = w.slice(0, -1);
  if (w.endsWith('eed') && w.length > 4) w = w.slice(0, -1);
  else if (w.endsWith('ed') && w.length > 4 && /[aeiou]/.test(w.slice(0, -2))) {
    w = w.slice(0, -2);
    if (/([^aeiou])\1$/.test(w) && !/[lsz]$/.test(w.slice(0, -1))) w = w.slice(0, -1);
  } else if (w.endsWith('ing') && w.length > 5 && /[aeiou]/.test(w.slice(0, -3))) {
    w = w.slice(0, -3);
    if (/([^aeiou])\1$/.test(w) && !/[lsz]$/.test(w.slice(0, -1))) w = w.slice(0, -1);
  }
  const step2 = [['ization', 'ize'], ['isation', 'ize'], ['ation', 'ate'], ['fulness', 'ful'], ['ousness', 'ous'], ['iveness', 'ive'], ['ibility', 'ible'], ['ment', ''], ['ness', ''], ['ence', ''], ['ance', '']];
  for (const [suffix, replacement] of step2) { if (w.endsWith(suffix) && w.length - suffix.length >= 2) { w = w.slice(0, -suffix.length) + replacement; break; } }
  const step3 = [['able', ''], ['ible', ''], ['ful', ''], ['ous', ''], ['ive', ''], ['tion', 't'], ['sion', 's'], ['ly', ''], ['er', ''], ['est', '']];
  for (const [suffix, replacement] of step3) { if (w.endsWith(suffix) && w.length - suffix.length >= 3) { w = w.slice(0, -suffix.length) + replacement; break; } }
  return w;
}

function stemTerms(words) { return [...new Set(words.map(w => stem(w)))]; }

// ─── Relevance Scoring ────────────────────────────────────────────────────────

function scoreRelevance(term, module, moduleName) {
  let score = 0;
  const nameLower = (moduleName || '').toLowerCase();
  const descLower = (module.description || '').toLowerCase();
  const stemmedTerm = stem(term);

  if (nameLower === term) score += 20;
  else if (stem(nameLower) === stemmedTerm) score += 16;
  else if (nameLower.includes(term)) score += 12;

  if (descLower.includes(term)) score += 6;
  else { const descWords = descLower.split(/\W+/).filter(Boolean); if (descWords.some(w => stem(w) === stemmedTerm)) score += 5; }

  const files = module.files || [];
  for (const fp of files) { if (fp.toLowerCase().includes(term)) { score += 4; break; } }

  const exports = module.exports || [];
  for (const exp of exports) { const el = exp.toLowerCase(); if (el.includes(term) || stem(el) === stemmedTerm) { score += 5; break; } }

  const patterns = module.patterns || [];
  for (const pat of patterns) { const pl = pat.toLowerCase(); if (pl.includes(term)) { score += 4; break; } }

  if (score > 0) {
    const accessCount = module.access_count || 0;
    if (accessCount > 0) score += Math.min(accessCount, 20) * 0.3;
    if (module.last_accessed) {
      const daysSince = (Date.now() - new Date(module.last_accessed).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 1) score += 3; else if (daysSince < 7) score += 1;
    }
  }
  return score;
}

function computeConfidence(entry, currentPhase) {
  if (!entry) return 0;
  let confidence = 0.5;
  const status = (entry.status || '').toLowerCase();
  if (status === 'active' || status === '') confidence += 0.1;
  else if (status === 'superseded') confidence -= 0.3;
  else if (status === 'deprecated') confidence -= 0.4;
  const phase = entry.established_in_phase || entry.phase || 0;
  const cp = currentPhase || 0;
  if (cp > 0 && phase > 0) { const phasesOld = cp - phase; if (phasesOld >= 5) confidence += 0.2; else if (phasesOld >= 2) confidence += 0.1; }
  const modules = entry.affected_modules || entry.modules_using || [];
  if (modules.length >= 3) confidence += 0.1; else if (modules.length >= 1) confidence += 0.05;
  if (entry.last_referenced) {
    const daysSinceRef = (Date.now() - new Date(entry.last_referenced).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceRef < 7) confidence += 0.1; else if (daysSinceRef < 30) confidence += 0.05;
  }
  return Math.max(0, Math.min(1, confidence));
}

// ─── Context Assembly ─────────────────────────────────────────────────────────

const MAX_CONTEXT_TOKENS = 12000;
const AGENT_BUDGETS = { planner: 10000, executor: 8000, verifier: 7000, researcher: 6000, debugger: 9000 };

function assembleContext(cwd, taskDescription, opts) {
  if (!cwd) throw new Error('assembleContext requires cwd');
  if (!taskDescription) throw new Error('assembleContext requires taskDescription');

  const options = opts || {};
  const projectConfig = safeJsonRead(path.join(cwd, '.planning', 'config.json'));
  let budget = options.budget;
  if (!budget && options.agent) {
    const userBudgets = (projectConfig && projectConfig.context_budgets) || {};
    budget = userBudgets[options.agent] || AGENT_BUDGETS[options.agent];
  }
  if (!budget) budget = MAX_CONTEXT_TOKENS;

  const index = safeJsonRead(indexPath(cwd));
  if (!index) {
    return { relevant_modules: [], module_docs: [], decisions: [], patterns: [], conventions: '', estimated_tokens: 0, budget_applied: false };
  }

  // Tokenize, stem, expand
  const rawTerms = removeStopWords(taskDescription.toLowerCase().split(/\W+/).filter(t => t.length > 0));
  const terms = stemTerms(rawTerms);
  const { synonyms } = expandSynonyms(rawTerms);
  const synonymTerms = stemTerms(synonyms);

  // Score modules
  const moduleScores = [];
  for (const [modName, modData] of Object.entries(index.modules || {})) {
    let totalScore = 0;
    for (const term of terms) totalScore += scoreRelevance(term, modData, modName);
    for (const syn of synonymTerms) totalScore += scoreRelevance(syn, modData, modName) * 0.4;
    if (totalScore > 0) moduleScores.push({ module: modName, score: totalScore, data: modData });
  }
  moduleScores.sort((a, b) => b.score - a.score);

  const fullModules = moduleScores.slice(0, 2);
  const gistModules = moduleScores.slice(2, 5);
  const microModules = moduleScores.slice(5, 10);
  const topModules = moduleScores.slice(0, 10);

  // Module docs
  let moduleDocs = [];
  for (const { module: modName } of fullModules) {
    const safeName = modName.replace(/[^a-zA-Z0-9_-]/g, '-');
    const docPath = path.join(knowledgeDir(cwd), 'modules', safeName);
    if (fs.existsSync(docPath)) {
      try {
        const entries = fs.readdirSync(docPath).filter(f => f.endsWith('.md'));
        for (const entry of entries) {
          const content = safeRead(path.join(docPath, entry));
          if (content) moduleDocs.push({ module: modName, file: entry, content });
        }
      } catch { /* skip */ }
    }
  }
  moduleDocs = moduleDocs.slice(0, 5);

  const gistSurrogates = gistModules.map(m => ({
    module: m.module, score: m.score,
    gist: (m.data && m.data.surrogate_gist) || `${m.module}: ${(m.data && m.data.description) || 'no description'}`,
  }));
  const microSurrogates = microModules.map(m => ({
    module: m.module, score: m.score,
    micro: (m.data && m.data.surrogate_micro) || `${m.module} (${((m.data && m.data.files) || []).length} files)`,
  }));

  // Update access tracking
  try {
    const ip = indexPath(cwd);
    const idx = safeJsonRead(ip);
    if (idx && idx.modules) {
      const now = new Date().toISOString();
      let changed = false;
      for (const m of topModules) {
        if (idx.modules[m.module]) {
          idx.modules[m.module].access_count = (idx.modules[m.module].access_count || 0) + 1;
          idx.modules[m.module].last_accessed = now;
          changed = true;
        }
      }
      if (changed) withFileLock(ip, () => safeJsonWrite(ip, idx));
    }
  } catch { /* best effort */ }

  const currentPhase = projectConfig ? (projectConfig.current_phase || 0) : 0;

  // Decisions
  const registry = safeJsonRead(decisionsPath(cwd));
  let relevantDecisions = [];
  if (registry && registry.decisions) {
    const topModuleNames = new Set(topModules.map(m => m.module));
    for (const d of registry.decisions) {
      const affectsRelevant = (d.affected_modules || []).some(m => topModuleNames.has(m));
      const titleWords = (d.title || '').toLowerCase().split(/\W+/).filter(Boolean).map(stem);
      const matchesTerm = terms.some(term => titleWords.includes(term));
      if (affectsRelevant || matchesTerm) {
        relevantDecisions.push({ ...d, confidence: computeConfidence(d, currentPhase) });
      }
    }
  }
  relevantDecisions.sort((a, b) => b.confidence - a.confidence);
  relevantDecisions = relevantDecisions.slice(0, 10);

  // Patterns
  const catalog = safeJsonRead(patternsPath(cwd));
  let relevantPatterns = [];
  if (catalog && catalog.patterns) {
    const topModuleNames = new Set(topModules.map(m => m.module));
    for (const p of catalog.patterns) {
      const usedByRelevant = (p.modules_using || []).some(m => topModuleNames.has(m));
      const nameWords = (p.name || '').toLowerCase().split(/\W+/).filter(Boolean).map(stem);
      const matchesTerm = terms.some(term => nameWords.includes(term));
      if (usedByRelevant || matchesTerm) {
        relevantPatterns.push({ ...p, confidence: computeConfidence(p, currentPhase) });
      }
    }
  }
  relevantPatterns.sort((a, b) => b.confidence - a.confidence);
  relevantPatterns = relevantPatterns.slice(0, 10);

  // Assumptions
  let premises = [];
  try {
    const asmRegistry = safeJsonRead(assumptionsPath(cwd));
    if (asmRegistry && Array.isArray(asmRegistry.assumptions)) {
      premises = asmRegistry.assumptions.filter(a => a.confidence === 'established').slice(0, 5).map(a => ({ id: a.id, statement: a.statement, type: a.type }));
    }
  } catch { /* no assumptions */ }

  // Conventions
  let conventions = safeRead(conventionsPath(cwd)) || '';
  if (tokenEstimate(conventions) > 2000) conventions = conventions.slice(0, 8000);

  // Token budget enforcement
  let budgetApplied = false;
  const estimate = () => {
    return [JSON.stringify(fullModules), JSON.stringify(moduleDocs), JSON.stringify(gistSurrogates), JSON.stringify(microSurrogates), JSON.stringify(relevantDecisions), JSON.stringify(relevantPatterns), JSON.stringify(premises), conventions].reduce((sum, part) => sum + tokenEstimate(part), 0);
  };

  let estimatedTokens = estimate();
  if (estimatedTokens > budget) { budgetApplied = true; if (conventions.length > 1000) { conventions = conventions.slice(0, 1000); estimatedTokens = estimate(); } }
  if (estimatedTokens > budget && relevantPatterns.length > 5) { relevantPatterns = relevantPatterns.slice(0, 5); estimatedTokens = estimate(); }
  if (estimatedTokens > budget && relevantDecisions.length > 5) { relevantDecisions = relevantDecisions.slice(0, 5); estimatedTokens = estimate(); }
  if (estimatedTokens > budget && moduleDocs.length > 3) { moduleDocs = moduleDocs.slice(0, 3); estimatedTokens = estimate(); }
  if (estimatedTokens > budget) { conventions = ''; estimatedTokens = estimate(); }

  return {
    relevant_modules: topModules.map(m => ({ module: m.module, score: m.score, file_count: (m.data.files || []).length, description: m.data.description || '' })),
    module_docs: moduleDocs, gist_modules: gistSurrogates, micro_modules: microSurrogates,
    decisions: relevantDecisions, patterns: relevantPatterns, premises, conventions,
    estimated_tokens: estimatedTokens, budget_applied: budgetApplied,
  };
}

// ─── Diff-Aware Context ───────────────────────────────────────────────────────

function assembleDiffAwareContext(cwd, taskDescription, opts) {
  if (!cwd) throw new Error('assembleDiffAwareContext requires cwd');
  if (!taskDescription) throw new Error('assembleDiffAwareContext requires taskDescription');

  const base = assembleContext(cwd, taskDescription, opts);
  const index = safeJsonRead(indexPath(cwd));
  if (!index || !index.last_mapped_commit) return { ...base, diff_context: null };

  let changes;
  try { changes = getChangedFilesSince(cwd, index.last_mapped_commit); } catch { return { ...base, diff_context: null }; }

  const changedFiles = [...(changes.added || []), ...(changes.modified || [])];
  if (changedFiles.length === 0) return { ...base, diff_context: null };

  const diffModules = new Set();
  for (const file of changedFiles) {
    const fileInfo = (index.files || {})[file];
    if (fileInfo && fileInfo.module) diffModules.add(fileInfo.module);
  }

  const boosted = base.relevant_modules.map(m => {
    if (diffModules.has(m.module)) return { ...m, score: m.score + 15, diff_boosted: true };
    return m;
  });
  boosted.sort((a, b) => b.score - a.score);

  return { ...base, relevant_modules: boosted, diff_context: { changed_files: changedFiles, diff_modules: [...diffModules] } };
}

module.exports = {
  stem, stemTerms, scoreRelevance, expandSynonyms, computeConfidence,
  assembleContext, assembleDiffAwareContext,
  MAX_CONTEXT_TOKENS, AGENT_BUDGETS,
};
