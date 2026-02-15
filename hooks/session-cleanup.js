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

    // Detect and recover orphaned .PROGRESS files (from crashed executions)
    try {
      const entries = fs.readdirSync(planningDir);
      const orphaned = entries.filter(e => e.startsWith('.PROGRESS-'));
      if (orphaned.length > 0) {
        const recoveryInfo = [];
        for (const progressFile of orphaned) {
          try {
            const progressData = JSON.parse(fs.readFileSync(path.join(planningDir, progressFile), 'utf8'));
            const planId = progressFile.replace('.PROGRESS-', '');
            recoveryInfo.push(`${planId}: task ${progressData.task || '?'}/${progressData.total || '?'}${progressData.commit ? ` (last commit: ${progressData.commit})` : ''}`);
          } catch (e) {
            recoveryInfo.push(`${progressFile}: unreadable`);
          }
        }

        // Update STATE.md with recovery info if it exists
        const statePath = path.join(planningDir, 'STATE.md');
        if (fs.existsSync(statePath)) {
          try {
            let stateContent = fs.readFileSync(statePath, 'utf8');
            const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
            const recoverySection = `\n\n### Recovery Info\n\nOrphaned progress detected (${now}):\n${recoveryInfo.map(r => `- ${r}`).join('\n')}\nRun \`/gsd:resume-work\` or \`/gsd:execute-phase\` to continue.\n`;

            // Append to Session Continuity section or end of file
            const sessionIdx = stateContent.indexOf('## Session Continuity');
            if (sessionIdx !== -1) {
              // Find end of session section
              const nextSection = stateContent.indexOf('\n## ', sessionIdx + 1);
              const insertPos = nextSection !== -1 ? nextSection : stateContent.length;
              stateContent = stateContent.slice(0, insertPos) + recoverySection + stateContent.slice(insertPos);
            } else {
              stateContent = stateContent.trimEnd() + recoverySection;
            }
            fs.writeFileSync(statePath, stateContent);
          } catch (e) { /* non-fatal */ }
        }

        // Clean up orphaned files after recording recovery info
        for (const progressFile of orphaned) {
          try { fs.unlinkSync(path.join(planningDir, progressFile)); } catch (e) { }
        }

        process.stderr.write(`RECOVERED: Found ${orphaned.length} orphaned .PROGRESS file(s). Recovery info written to STATE.md. Progress: ${recoveryInfo.join('; ')}`);
      }
    } catch (e) { }

    // Fix agent-history.json entries stuck at "spawned"
    try {
      const historyPath = path.join(planningDir, 'agent-history.json');
      if (fs.existsSync(historyPath)) {
        const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        let fixed = 0;
        const now = new Date().toISOString();
        for (const entry of (history.entries || [])) {
          if (entry.status === 'spawned') {
            entry.status = 'unknown_completion';
            entry.completion_timestamp = now;
            entry.note = 'Status inferred during session cleanup — agent may have completed or crashed';
            fixed++;
          }
        }
        if (fixed > 0) {
          fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
          process.stderr.write(` Fixed ${fixed} stuck agent-history entries.`);
        }
      }
    } catch (e) { /* non-fatal */ }

  } catch (e) { }
  process.exit(0);
});
