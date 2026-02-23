#!/usr/bin/env node

/**
 * session-end-standalone.js
 * Claude Code Stop hook — lightweight session-end handler.
 *
 * Knowledge extraction now happens at phase start via mine-conversations
 * (Haiku-based, captures all reasoning types — not just technical).
 *
 * This hook:
 * - Reads stdin (Claude Code protocol requirement)
 * - Cleans up /tmp/gsd-session-* temp files from previous implementation
 * - Always exits 0 — never blocks Claude from stopping
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

async function main() {
  // Consume stdin — required by Claude Code hook protocol
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
  } catch (_) {}

  // Clean up old temp files left by previous regex-extraction implementation
  cleanupOldTempFiles();

  process.exit(0);
}

function cleanupOldTempFiles() {
  try {
    const files = fs.readdirSync(os.tmpdir());
    const now = Date.now();
    for (const f of files) {
      if (!f.startsWith('gsd-session-')) continue;
      if (!f.endsWith('.txt') && !f.endsWith('.done')) continue;
      const fp = path.join(os.tmpdir(), f);
      try {
        const stat = fs.statSync(fp);
        if (now - stat.mtimeMs > MAX_AGE_MS) fs.unlinkSync(fp);
      } catch (_) {}
    }
  } catch (_) {}
}

main().catch(() => process.exit(0));
