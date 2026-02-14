#!/usr/bin/env node
// SessionEnd/Stop — clean up stale signal files and ephemeral state

const fs = require('fs');
const path = require('path');

const SIGNAL_FILES = ['.active-agent', '.active-skill', '.active-operation', '.active-plan', '.auto-next'];
const TRACKER_FILES = ['.context-tracker', '.compact-counter'];

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cwd = data.cwd || process.cwd();
    const planningDir = path.join(cwd, '.planning');

    if (!fs.existsSync(planningDir)) { process.exit(0); }

    // Remove all signal files
    for (const name of [...SIGNAL_FILES, ...TRACKER_FILES]) {
      const filePath = path.join(planningDir, name);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { }
      }
    }

    // Detect orphaned .PROGRESS files (from crashed executions)
    try {
      const entries = fs.readdirSync(planningDir);
      const orphaned = entries.filter(e => e.startsWith('.PROGRESS-'));
      if (orphaned.length > 0) {
        process.stderr.write(`WARNING: Found ${orphaned.length} orphaned .PROGRESS file(s) from crashed execution. Run /gsd:health to investigate.`);
      }
    } catch (e) { }

  } catch (e) { }
  process.exit(0);
});
