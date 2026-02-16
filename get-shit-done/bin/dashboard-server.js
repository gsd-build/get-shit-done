/**
 * Real-time Progress Dashboard
 *
 * Streams EXECUTION_LOG.md events via WebSocket for live progress tracking.
 * Pattern: NDJSON streaming with file watching
 * Source: Phase 8 Research - Pattern 5
 */

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Import execution log helpers
const { getHistory, getExecutionStats } = require('./execution-log.js');

let wss = null;
let httpServer = null;
let fileWatcher = null;

const DASHBOARD_HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>GSD Execution Dashboard</title>
  <style>
    body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; margin: 0; }
    h1 { color: #4ec9b0; margin-bottom: 20px; }
    .container { display: flex; gap: 20px; }
    .events { flex: 2; max-height: 80vh; overflow-y: auto; }
    .stats { flex: 1; position: sticky; top: 20px; background: #252526; padding: 15px; border: 1px solid #3c3c3c; border-radius: 4px; height: fit-content; }
    .event { padding: 10px; margin: 5px 0; background: #2d2d2d; border-left: 3px solid #007acc; border-radius: 2px; }
    .phase_start { border-color: #4ec9b0; }
    .phase_complete { border-color: #b5cea8; }
    .phase_failed { border-color: #f48771; }
    .checkpoint { border-color: #dcdcaa; }
    .roadmap_start { border-color: #569cd6; background: #2d3748; }
    .roadmap_complete { border-color: #9cdcfe; background: #2d3748; }
    .time { color: #808080; }
    .type { font-weight: bold; color: #9cdcfe; }
    .message { margin-top: 5px; }
    .stat-row { display: flex; justify-content: space-between; margin: 8px 0; }
    .stat-label { color: #808080; }
    .stat-value { color: #4ec9b0; font-weight: bold; }
    .connected { color: #b5cea8; }
    .disconnected { color: #f48771; }
  </style>
</head>
<body>
  <h1>GSD Autonomous Execution Dashboard</h1>
  <div class="container">
    <div class="events" id="events">
      <p style="color: #808080;">Connecting to WebSocket...</p>
    </div>
    <div class="stats" id="stats">
      <h3>Statistics</h3>
      <div class="stat-row"><span class="stat-label">Status:</span><span class="stat-value disconnected" id="status">Connecting...</span></div>
      <div class="stat-row"><span class="stat-label">Phases Completed:</span><span class="stat-value" id="phases-completed">-</span></div>
      <div class="stat-row"><span class="stat-label">Phases Failed:</span><span class="stat-value" id="phases-failed">-</span></div>
      <div class="stat-row"><span class="stat-label">Checkpoints:</span><span class="stat-value" id="checkpoints">-</span></div>
      <div class="stat-row"><span class="stat-label">Events:</span><span class="stat-value" id="event-count">0</span></div>
    </div>
  </div>

  <script>
    const eventsDiv = document.getElementById('events');
    const statusEl = document.getElementById('status');
    let eventCount = 0;

    function connect() {
      const ws = new WebSocket('ws://localhost:8080');

      ws.onopen = () => {
        statusEl.textContent = 'Connected';
        statusEl.className = 'stat-value connected';
        eventsDiv.innerHTML = '';
      };

      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);

        if (data.type === 'initial_state') {
          data.events.forEach(renderEvent);
          updateStats(data.stats);
        } else if (data.type === 'event') {
          renderEvent(data.event);
          eventCount++;
          document.getElementById('event-count').textContent = eventCount;
        }
      };

      ws.onclose = () => {
        statusEl.textContent = 'Disconnected';
        statusEl.className = 'stat-value disconnected';
        setTimeout(connect, 3000);
      };
    }

    function renderEvent(event) {
      const div = document.createElement('div');
      div.className = 'event ' + (event.type || '');
      const time = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '-';
      div.innerHTML = \`
        <span class="time">[\${time}]</span>
        <span class="type">\${event.type || 'unknown'}</span>
        \${event.phase ? ' - Phase ' + event.phase : ''}
        \${event.message ? '<div class="message">' + event.message + '</div>' : ''}
      \`;
      eventsDiv.insertBefore(div, eventsDiv.firstChild);
      eventCount++;
    }

    function updateStats(stats) {
      document.getElementById('phases-completed').textContent = stats.phases_completed || 0;
      document.getElementById('phases-failed').textContent = stats.phases_failed || 0;
      document.getElementById('checkpoints').textContent = stats.checkpoint_count || 0;
      eventCount = stats.total_events || 0;
      document.getElementById('event-count').textContent = eventCount;
    }

    connect();
  </script>
</body>
</html>
`;

/**
 * Start the dashboard server
 * @param {object} options - { httpPort, wsPort, logPath }
 */
function startDashboard(options = {}) {
  const httpPort = options.httpPort || 3000;
  const wsPort = options.wsPort || 8080;
  const logPath = options.logPath || '.planning/EXECUTION_LOG.md';

  // HTTP server for dashboard HTML
  httpServer = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/dashboard') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(DASHBOARD_HTML);
    } else if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  // WebSocket server for real-time updates
  wss = new WebSocket.Server({ port: wsPort });

  wss.on('connection', (ws) => {
    console.log('Dashboard client connected');

    // Send initial state
    try {
      const events = getHistory(process.cwd());
      const stats = getExecutionStats(process.cwd());
      ws.send(JSON.stringify({
        type: 'initial_state',
        events,
        stats
      }));
    } catch (error) {
      console.error('Error sending initial state:', error.message);
    }

    ws.on('close', () => {
      console.log('Dashboard client disconnected');
    });
  });

  // Watch log file for changes
  if (fs.existsSync(logPath)) {
    let lastSize = fs.statSync(logPath).size;

    fileWatcher = fs.watch(logPath, (eventType) => {
      if (eventType === 'change') {
        const currentSize = fs.statSync(logPath).size;

        if (currentSize > lastSize) {
          // Read new content
          const stream = fs.createReadStream(logPath, {
            start: lastSize,
            encoding: 'utf8'
          });

          let buffer = '';
          stream.on('data', (chunk) => {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop();

            lines.forEach(line => {
              if (line.trim() && !line.startsWith('#') && !line.startsWith('---')) {
                try {
                  const event = JSON.parse(line);
                  // Broadcast to all connected clients
                  wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(JSON.stringify({ type: 'event', event }));
                    }
                  });
                } catch (err) {
                  // Skip invalid JSON lines
                }
              }
            });
          });

          stream.on('end', () => {
            lastSize = currentSize;
          });
        }
      }
    });
  }

  httpServer.listen(httpPort, () => {
    console.log(`Dashboard: http://localhost:${httpPort}`);
    console.log(`WebSocket: ws://localhost:${wsPort}`);
  });

  return { httpPort, wsPort };
}

/**
 * Stop the dashboard server
 */
function stopDashboard() {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
  if (wss) {
    wss.close();
    wss = null;
  }
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  console.log('Dashboard stopped');
}

module.exports = {
  startDashboard,
  stopDashboard,
  DASHBOARD_HTML
};
