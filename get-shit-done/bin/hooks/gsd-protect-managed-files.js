#!/usr/bin/env node
/**
 * GSD Managed File Protection Hook
 *
 * PreToolUse hook (Write | Edit) that blocks direct edits to files
 * managed by the GSD installer inside ~/.claude/.
 *
 * The authoritative file list comes from ~/.claude/gsd-file-manifest.json,
 * which is rewritten on every `node bin/install.js` run. This means the
 * protection always reflects exactly what the installer owns — no manual
 * maintenance required.
 *
 * On a block, Claude receives a clear error message explaining:
 *   - which file was protected
 *   - where the source lives in the GSD project
 *   - the three steps to make the change correctly
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const CLAUDE_DIR      = path.join(os.homedir(), '.claude');
const MANIFEST_PATH   = path.join(CLAUDE_DIR, 'gsd-file-manifest.json');
const SOURCE_PATH_FILE = path.join(CLAUDE_DIR, 'gsd-source-path.txt');

function run() {
  let raw = '';
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      const data      = JSON.parse(raw);
      const toolInput = data.tool_input || {};

      // Both Write and Edit carry file_path
      let filePath = toolInput.file_path;
      if (!filePath) { process.exit(0); }

      // Normalise ~ and make absolute
      if (filePath.startsWith('~')) {
        filePath = path.join(os.homedir(), filePath.slice(1));
      }
      filePath = path.resolve(filePath);

      // Only intercept paths inside ~/.claude/
      const claudePrefix = CLAUDE_DIR + path.sep;
      if (!filePath.startsWith(claudePrefix)) { process.exit(0); }

      // Load manifest — fail open if absent
      if (!fs.existsSync(MANIFEST_PATH)) { process.exit(0); }
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      if (!manifest || !manifest.files) { process.exit(0); }

      // Relative path from ~/.claude/ — used as manifest key
      const relPath = path.relative(CLAUDE_DIR, filePath).replace(/\\/g, '/');

      // Not a managed file — allow
      if (!(relPath in manifest.files)) { process.exit(0); }

      // Resolve source project root
      let sourceRoot = '/Users/ollorin/get-shit-done'; // safe fallback
      if (fs.existsSync(SOURCE_PATH_FILE)) {
        const stored = fs.readFileSync(SOURCE_PATH_FILE, 'utf8').trim();
        if (stored) { sourceRoot = stored; }
      }

      const sourceFile    = path.join(sourceRoot, relPath);
      const installScript = path.join(sourceRoot, 'bin', 'install.js');

      const message = [
        '⛔  GSD PROTECTED FILE — EDIT BLOCKED',
        '',
        'This file is managed by the GSD installer and cannot be edited directly.',
        'Changes made here are overwritten the next time install runs.',
        '',
        `  Protected:  ${filePath}`,
        '',
        'Make the change in the source project instead:',
        '',
        `  1. Edit source:  ${sourceFile}`,
        `  2. Commit:       git -C "${sourceRoot}" add -A && git -C "${sourceRoot}" commit -m "your message"`,
        `  3. Deploy:       node "${installScript}"`,
        '',
        'The installer will copy the updated file to ~/.claude/ automatically.',
      ].join('\n');

      process.stdout.write(message + '\n');
      process.exit(2); // exit 2 = block tool call and surface message to Claude

    } catch (_) {
      // Fail open — never block due to a hook bug
      process.exit(0);
    }
  });
}

run();
