#!/usr/bin/env node

/**
 * session-end-standalone.js
 * Claude Code Stop hook — extracts knowledge from assistant responses.
 *
 * Registered as a Stop hook in ~/.claude/settings.json by install.js.
 * Fires after each assistant turn (not just at session end).
 *
 * Strategy:
 * - Reads Stop hook JSON from stdin (session_id, last_assistant_message, stop_hook_active)
 * - Guards stop_hook_active to prevent infinite loops
 * - Appends last_assistant_message to /tmp/gsd-session-{session_id}.txt
 * - Re-runs extraction on full accumulated text (dedup prevents duplicate DB entries)
 * - Cleans up temp files older than 24h
 * - Always exits 0 — never blocks Claude from stopping
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Resolve bin dir relative to this script so requires work regardless of cwd
const BIN_DIR = path.resolve(__dirname, '..');

const TEMP_PREFIX = path.join(os.tmpdir(), 'gsd-session-');
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

async function main() {
  // --- Read stdin ---
  let hookData;
  try {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (!raw) process.exit(0);
    hookData = JSON.parse(raw);
  } catch (_) {
    // Cannot parse stdin — do nothing, let Claude stop
    process.exit(0);
  }

  const { session_id, last_assistant_message, stop_hook_active } = hookData;

  // --- Infinite loop guard ---
  // When stop_hook_active is true, this hook already caused Claude to continue.
  // Do not extract again or we will loop forever.
  if (stop_hook_active === true) {
    process.exit(0);
  }

  // --- Content guard ---
  if (
    !last_assistant_message ||
    typeof last_assistant_message !== 'string' ||
    !last_assistant_message.trim()
  ) {
    process.exit(0);
  }

  if (!session_id || typeof session_id !== 'string') {
    process.exit(0);
  }

  // --- Accumulate response in temp file ---
  const tempFile = TEMP_PREFIX + session_id + '.txt';
  try {
    fs.appendFileSync(tempFile, last_assistant_message + '\n\n---\n\n');
  } catch (err) {
    if (process.env.GSD_DEBUG) {
      process.stderr.write(`[session-end-standalone] failed to write temp file: ${err.message}\n`);
    }
    process.exit(0);
  }

  // --- Read accumulated text ---
  let accumulated;
  try {
    accumulated = fs.readFileSync(tempFile, 'utf8');
  } catch (_) {
    process.exit(0);
  }

  // --- Extract and store knowledge ---
  try {
    const { extractKnowledge } = require(path.join(BIN_DIR, 'knowledge-extraction.js'));
    const extraction = extractKnowledge(accumulated, {});

    if (!extraction || !extraction.extractions || extraction.extractions.length === 0) {
      // Nothing to store
      cleanupOldTempFiles();
      process.exit(0);
    }

    const { processExtractionBatch } = require(path.join(BIN_DIR, 'knowledge-evolution.js'));
    const { knowledge } = require(path.join(BIN_DIR, 'knowledge.js'));

    const scope = 'global';
    const readiness = knowledge.isReady(scope);

    if (readiness && readiness.ready) {
      const conn = knowledge._getConnection(scope);
      if (conn && conn.available) {
        const result = await processExtractionBatch(conn, extraction.extractions, {
          scope,
          source: 'stop_hook'
        });
        if (process.env.GSD_DEBUG) {
          process.stderr.write(
            `[session-end-standalone] session=${session_id.slice(0, 8)} ` +
            `created=${result.created} evolved=${result.evolved} skipped=${result.skipped}\n`
          );
        }
      }
    } else if (process.env.GSD_DEBUG) {
      const reason = readiness ? readiness.reason : 'knowledge system unavailable';
      process.stderr.write(`[session-end-standalone] skipped: ${reason}\n`);
    }
  } catch (err) {
    // Extraction errors must never block Claude
    if (process.env.GSD_DEBUG) {
      process.stderr.write(`[session-end-standalone] extraction error: ${err.message}\n`);
    }
  }

  cleanupOldTempFiles();
  process.exit(0);
}

/**
 * Remove /tmp/gsd-session-*.txt files older than MAX_AGE_MS.
 * Best-effort: any error is silently swallowed.
 */
function cleanupOldTempFiles() {
  try {
    const tmpDir = os.tmpdir();
    const files = fs.readdirSync(tmpDir);
    const now = Date.now();
    for (const f of files) {
      if (!f.startsWith('gsd-session-') || !f.endsWith('.txt')) continue;
      const fp = path.join(tmpDir, f);
      try {
        const stat = fs.statSync(fp);
        if (now - stat.mtimeMs > MAX_AGE_MS) {
          fs.unlinkSync(fp);
        }
      } catch (_) {}
    }
  } catch (_) {}
}

main().catch(() => process.exit(0));
