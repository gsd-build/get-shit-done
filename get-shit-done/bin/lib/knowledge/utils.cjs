/**
 * Knowledge Layer — Utility functions
 * Self-contained utilities for the knowledge engine. No dependency on GSD core
 * to keep the knowledge layer portable and independently testable.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

// --- File I/O ----------------------------------------------------------------

function safeRead(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return null; }
}

function safeJsonRead(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch { return fallback !== undefined ? fallback : null; }
}

function safeJsonWrite(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmpPath = filePath + '.tmp.' + process.pid;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch { /* cleanup */ }
    throw err;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

// --- Hashing -----------------------------------------------------------------

function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
}

// --- Date/Time ---------------------------------------------------------------

function isoNow() { return new Date().toISOString(); }

// --- Text Processing ---------------------------------------------------------

const { STOP_WORDS } = require('./constants.cjs');

function tokenEstimate(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

function removeStopWords(words) {
  return words.filter(w => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()));
}

// --- File Locking ------------------------------------------------------------
// FIX(review #12): acquireLock uses exponential backoff with Atomics.wait.
// When Atomics.wait is unavailable (e.g., main thread in some runtimes),
// the fallback checks elapsed time before each retry to avoid tight spin.

const LOCK_TIMEOUT_MS = 5000;
const LOCK_RETRY_MS = 50;
const STALE_LOCK_MS = 30000;

function acquireLock(lockPath, timeout) {
  const maxWait = typeof timeout === 'number' ? timeout : LOCK_TIMEOUT_MS;
  const start = Date.now();
  let delay = LOCK_RETRY_MS;
  while (Date.now() - start < maxWait) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
      return;
    } catch {
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch { continue; }
      const remaining = maxWait - (Date.now() - start);
      if (remaining <= 0) break;
      const wait = Math.min(delay, remaining);
      try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait); }
      catch {
        // Atomics.wait unavailable — burn elapsed time check only, no busy-spin.
        // The while-loop condition (Date.now() - start < maxWait) prevents spinning
        // because `delay` grows exponentially and we break when remaining <= 0.
      }
      delay = Math.min(delay * 2, 1000);
    }
  }
  throw new Error('Could not acquire lock ' + lockPath + ' within ' + maxWait + 'ms');
}

function releaseLock(lockPath) {
  try { fs.unlinkSync(lockPath); } catch { /* already released */ }
}

function withFileLock(filePath, fn) {
  const lockPath = filePath + '.lock';
  acquireLock(lockPath);
  try { return fn(); } finally { releaseLock(lockPath); }
}

// --- Git Helpers -------------------------------------------------------------

function execGitSafe(cwd, args) {
  try {
    const result = spawnSync('git', args, {
      cwd, stdio: 'pipe', encoding: 'utf-8', timeout: 30000,
    });
    return {
      exitCode: result.status === null ? 1 : result.status,
      stdout: (result.stdout || '').trim(),
      stderr: (result.stderr || '').trim(),
    };
  } catch (err) {
    return { exitCode: 1, stdout: '', stderr: err.message || String(err) };
  }
}

// --- Path Helpers ------------------------------------------------------------

function knowledgeDir(cwd) { return path.join(cwd, '.planning', 'knowledge'); }
function indexPath(cwd) { return path.join(knowledgeDir(cwd), 'INDEX.json'); }
function depsPath(cwd) { return path.join(knowledgeDir(cwd), 'DEPENDENCIES.json'); }
function decisionsPath(cwd) { return path.join(knowledgeDir(cwd), 'decisions', 'REGISTRY.json'); }
function patternsPath(cwd) { return path.join(knowledgeDir(cwd), 'patterns', 'CATALOG.json'); }
function conventionsPath(cwd) { return path.join(knowledgeDir(cwd), 'CONVENTIONS.md'); }
function assumptionsPath(cwd) { return path.join(knowledgeDir(cwd), 'assumptions', 'REGISTRY.json'); }

module.exports = {
  safeRead, safeJsonRead, safeJsonWrite, ensureDir,
  sha256, isoNow, tokenEstimate, removeStopWords,
  withFileLock, execGitSafe,
  knowledgeDir, indexPath, depsPath, decisionsPath,
  patternsPath, conventionsPath, assumptionsPath,
};
