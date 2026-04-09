/**
 * Schema Drift Detection — Detects schema-relevant file changes and verifies
 * that the appropriate database push command was executed during a phase.
 *
 * Prevents false-positive verification when schema files change but no push
 * occurs — TypeScript types come from config, not the live database, so
 * build/types pass on a broken state.
 */

'use strict';

// ─── ORM Patterns ────────────────────────────────────────────────────────────
//
// Each entry maps a glob-like pattern to an ORM name. Patterns use forward
// slashes internally — Windows backslash paths are normalized before matching.

const SCHEMA_PATTERNS = [
  // Payload CMS
  { pattern: /^src\/collections\/.*\.ts$/, orm: 'payload' },
  { pattern: /^src\/globals\/.*\.ts$/, orm: 'payload' },

  // Prisma
  { pattern: /^prisma\/schema\.prisma$/, orm: 'prisma' },
  { pattern: /^prisma\/schema\/.*\.prisma$/, orm: 'prisma' },

  // Drizzle
  { pattern: /^drizzle\/schema\.ts$/, orm: 'drizzle' },
  { pattern: /^src\/db\/schema\.ts$/, orm: 'drizzle' },
  { pattern: /^drizzle\/.*\.ts$/, orm: 'drizzle' },

  // Supabase
  { pattern: /^supabase\/migrations\/.*\.sql$/, orm: 'supabase' },

  // TypeORM
  { pattern: /^src\/entities\/.*\.ts$/, orm: 'typeorm' },
  { pattern: /^src\/migrations\/.*\.ts$/, orm: 'typeorm' },
];

// ─── Push Commands & Evidence Patterns ───────────────────────────────────────
//
// For each ORM, the push command that agents should run, plus regex patterns
// that indicate the push was actually executed (matched against execution logs,
// SUMMARY.md content, and git commit messages).

const ORM_INFO = {
  payload: {
    pushCommand: 'npx payload migrate',
    envHint: 'CI=true PAYLOAD_MIGRATING=true npx payload migrate',
    interactiveWarning: 'Payload migrate may require interactive prompts — use CI=true PAYLOAD_MIGRATING=true to suppress',
    evidencePatterns: [
      /payload\s+migrate/i,
      /PAYLOAD_MIGRATING/,
    ],
  },
  prisma: {
    pushCommand: 'npx prisma db push',
    envHint: 'npx prisma db push --accept-data-loss (if destructive changes are intended)',
    interactiveWarning: 'Prisma db push may prompt for confirmation on destructive changes — use --accept-data-loss to bypass',
    evidencePatterns: [
      /prisma\s+db\s+push/i,
      /prisma\s+migrate\s+deploy/i,
      /prisma\s+migrate\s+dev/i,
    ],
  },
  drizzle: {
    pushCommand: 'npx drizzle-kit push',
    envHint: 'npx drizzle-kit push',
    interactiveWarning: null,
    evidencePatterns: [
      /drizzle-kit\s+push/i,
      /drizzle-kit\s+migrate/i,
    ],
  },
  supabase: {
    pushCommand: 'supabase db push',
    envHint: 'supabase db push',
    interactiveWarning: 'Supabase db push may require authentication — ensure SUPABASE_ACCESS_TOKEN is set',
    evidencePatterns: [
      /supabase\s+db\s+push/i,
      /supabase\s+migration\s+up/i,
    ],
  },
  typeorm: {
    pushCommand: 'npx typeorm migration:run',
    envHint: 'npx typeorm migration:run -d src/data-source.ts',
    interactiveWarning: null,
    evidencePatterns: [
      /typeorm\s+migration:run/i,
      /typeorm\s+schema:sync/i,
    ],
  },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Detect schema-relevant files in a list of file paths.
 *
 * @param {string[]} files - List of file paths (relative to project root)
 * @returns {{ detected: boolean, matches: string[], orms: string[] }}
 */
function detectSchemaFiles(files) {
  const matches = [];
  const orms = new Set();

  for (const rawFile of files) {
    // Normalize Windows backslash paths
    const file = rawFile.replace(/\\/g, '/');

    for (const { pattern, orm } of SCHEMA_PATTERNS) {
      if (pattern.test(file)) {
        matches.push(rawFile);
        orms.add(orm);
        break; // One match per file is enough
      }
    }
  }

  return {
    detected: matches.length > 0,
    matches,
    orms: Array.from(orms),
  };
}

/**
 * Get ORM-specific push command info.
 *
 * @param {string} ormName - ORM identifier (payload, prisma, drizzle, supabase, typeorm)
 * @returns {{ pushCommand: string, envHint: string, interactiveWarning: string|null, evidencePatterns: RegExp[] } | null}
 */
function detectSchemaOrm(ormName) {
  return ORM_INFO[ormName] || null;
}

/**
 * Check for schema drift: schema files changed but no push evidence found.
 *
 * @param {string[]} changedFiles - Files changed during the phase
 * @param {string} executionLog - Combined text from SUMMARY.md, commit messages, and execution logs
 * @param {{ skipCheck?: boolean }} [options] - Options
 * @returns {{ driftDetected: boolean, blocking: boolean, schemaFiles: string[], orms: string[], unpushedOrms: string[], message: string, skipped?: boolean }}
 */
function checkSchemaDrift(changedFiles, executionLog, options = {}) {
  const { skipCheck = false } = options;

  const detection = detectSchemaFiles(changedFiles);

  if (!detection.detected) {
    return {
      driftDetected: false,
      blocking: false,
      schemaFiles: [],
      orms: [],
      unpushedOrms: [],
      message: '',
    };
  }

  // Check which ORMs have push evidence in the execution log
  const pushedOrms = new Set();
  const unpushedOrms = [];

  for (const orm of detection.orms) {
    const info = ORM_INFO[orm];
    if (!info) continue;

    const hasPushEvidence = info.evidencePatterns.some(p => p.test(executionLog));
    if (hasPushEvidence) {
      pushedOrms.add(orm);
    } else {
      unpushedOrms.push(orm);
    }
  }

  const driftDetected = unpushedOrms.length > 0;

  if (!driftDetected) {
    return {
      driftDetected: false,
      blocking: false,
      schemaFiles: detection.matches,
      orms: detection.orms,
      unpushedOrms: [],
      message: '',
    };
  }

  // Build actionable message
  const pushCommands = unpushedOrms
    .map(orm => {
      const info = ORM_INFO[orm];
      return info ? `  ${orm}: ${info.envHint || info.pushCommand}` : null;
    })
    .filter(Boolean)
    .join('\n');

  const message = [
    'Schema drift detected: schema-relevant files changed but no database push was executed.',
    '',
    `Schema files changed: ${detection.matches.join(', ')}`,
    `ORMs requiring push: ${unpushedOrms.join(', ')}`,
    '',
    'Required push commands:',
    pushCommands,
    '',
    'Run the appropriate push command, or set GSD_SKIP_SCHEMA_CHECK=true to bypass this gate.',
  ].join('\n');

  if (skipCheck) {
    return {
      driftDetected: true,
      blocking: false,
      skipped: true,
      schemaFiles: detection.matches,
      orms: detection.orms,
      unpushedOrms,
      message: 'Schema drift detected but check was skipped (GSD_SKIP_SCHEMA_CHECK=true).',
    };
  }

  return {
    driftDetected: true,
    blocking: true,
    schemaFiles: detection.matches,
    orms: detection.orms,
    unpushedOrms,
    message,
  };
}

module.exports = {
  SCHEMA_PATTERNS,
  ORM_INFO,
  detectSchemaFiles,
  detectSchemaOrm,
  checkSchemaDrift,
};
