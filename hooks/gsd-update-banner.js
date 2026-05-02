#!/usr/bin/env node
// gsd-hook-version: {{GSD_VERSION}}
// SessionStart banner that surfaces GSD update availability when GSD's
// statusline isn't installed. Reads the cache that
// gsd-check-update-worker.js writes to ~/.cache/gsd/gsd-update-check.json.
//
// Opt-in by design: bin/install.js only registers this hook when the user
// declines to install (or replace) the GSD statusline. The presence of the
// SessionStart entry IS the opt-in — there is no separate runtime flag.
//
// See issue #2795 for the rationale.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Suppress repeat parse-error banners for 24 hours so a genuinely broken
// cache file doesn't nag the user every session.
const RATE_LIMIT_SECONDS = 24 * 60 * 60;

/**
 * Build the SessionStart JSON envelope to emit, given parsed cache state.
 * Pure function — no I/O. Returns null when the hook should print nothing.
 *
 * @param {object} state
 * @param {object|null} state.cache                  Parsed cache, or null if missing/unreadable.
 * @param {boolean}     state.parseError             True iff cache file existed but JSON.parse failed.
 * @param {boolean}     state.suppressFailureWarning True when a recent failure warning already fired.
 * @returns {{systemMessage: string}|null}           JSON envelope, or null for silent exit.
 */
function buildBannerOutput(state) {
  const { cache, parseError, suppressFailureWarning } = state || {};
  if (parseError) {
    if (suppressFailureWarning) return null;
    return { systemMessage: 'GSD update check failed.' };
  }
  if (!cache) return null;
  if (!cache.update_available) return null;
  const installed = cache.installed || 'unknown';
  const latest = cache.latest || 'unknown';
  return {
    systemMessage: `GSD update available: ${installed} → ${latest}. Run /gsd-update.`,
  };
}

/**
 * Read and parse the update-check cache file.
 *
 * @param {string} cacheFile
 * @returns {{cache: object|null, parseError: boolean}}
 */
function readCache(cacheFile) {
  let cache = null;
  let parseError = false;
  try {
    if (fs.existsSync(cacheFile)) {
      const raw = fs.readFileSync(cacheFile, 'utf8');
      cache = JSON.parse(raw);
    }
  } catch (e) {
    // Distinguish "file unreadable" from "JSON malformed": both fail-open to
    // null cache, but a JSON parse error becomes a one-time diagnostic.
    parseError = e instanceof SyntaxError;
  }
  return { cache, parseError };
}

/**
 * Has a failure warning been emitted within the rate-limit window?
 *
 * @param {string} sentinelFile
 * @param {number} nowSeconds
 * @returns {boolean}
 */
function shouldSuppressFailureWarning(sentinelFile, nowSeconds) {
  try {
    if (!fs.existsSync(sentinelFile)) return false;
    const last = parseInt(fs.readFileSync(sentinelFile, 'utf8').trim(), 10);
    if (!Number.isFinite(last)) return false;
    return nowSeconds - last < RATE_LIMIT_SECONDS;
  } catch (e) {
    return false;
  }
}

function recordFailureWarning(sentinelFile, nowSeconds) {
  try {
    fs.writeFileSync(sentinelFile, String(nowSeconds));
  } catch (e) {
    // Best-effort: a non-writable cache dir means we'll re-warn next session,
    // which is no worse than the un-instrumented baseline.
  }
}

function main() {
  const cacheDir = path.join(os.homedir(), '.cache', 'gsd');
  const cacheFile = path.join(cacheDir, 'gsd-update-check.json');
  const sentinelFile = path.join(cacheDir, 'banner-failure-warned-at');
  const now = Math.floor(Date.now() / 1000);

  const { cache, parseError } = readCache(cacheFile);
  const suppressFailureWarning = parseError
    ? shouldSuppressFailureWarning(sentinelFile, now)
    : false;
  const output = buildBannerOutput({ cache, parseError, suppressFailureWarning });

  if (parseError && !suppressFailureWarning) {
    // Ensure cache dir exists before writing the sentinel — first-run case
    // where ~/.cache/gsd was created by check-update but the parent dir got
    // wiped between runs.
    try {
      fs.mkdirSync(cacheDir, { recursive: true });
    } catch (e) {
      // Best-effort: failure to create the dir means we'll re-warn next
      // session, which is no worse than the un-instrumented baseline.
    }
    recordFailureWarning(sentinelFile, now);
  }

  if (output) {
    process.stdout.write(JSON.stringify(output));
  }
}

if (require.main === module) main();

module.exports = {
  buildBannerOutput,
  readCache,
  shouldSuppressFailureWarning,
  RATE_LIMIT_SECONDS,
};
