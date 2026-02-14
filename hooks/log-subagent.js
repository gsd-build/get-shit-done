#!/usr/bin/env node
// SubagentStart/SubagentStop — manage .active-agent signal

const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cwd = data.cwd || process.cwd();
    const planningDir = path.join(cwd, '.planning');

    if (!fs.existsSync(planningDir)) { process.exit(0); }

    const signalPath = path.join(planningDir, '.active-agent');
    const event = data.event || data.hook_event || '';

    if (event === 'SubagentStart' || data.agent_name) {
      // Write signal with agent name
      const agentName = data.agent_name || data.subagent_type || 'unknown';
      fs.writeFileSync(signalPath, agentName);
    } else if (event === 'SubagentStop') {
      // Remove signal
      if (fs.existsSync(signalPath)) {
        fs.unlinkSync(signalPath);
      }
    }
  } catch (e) { }
  process.exit(0);
});
