'use strict';

// Shared test helpers for graphify test suite.
// Extracted from graphify.test.cjs to serve graphify*.test.cjs split files.
// Refs #3761.

const fs = require('fs');
const path = require('path');
const os = require('node:os');
const { execFileSync } = require('child_process');

function enableGraphify(planningDir) {
  const configPath = path.join(planningDir, 'config.json');
  const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {};
  config.graphify = { enabled: true };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

function writeGraphJson(planningDir, data) {
  const graphsDir = path.join(planningDir, 'graphs');
  fs.mkdirSync(graphsDir, { recursive: true });
  fs.writeFileSync(
    path.join(graphsDir, 'graph.json'),
    JSON.stringify(data, null, 2),
    'utf8'
  );
}

function writeSnapshotJson(planningDir, data) {
  const graphsDir = path.join(planningDir, 'graphs');
  fs.mkdirSync(graphsDir, { recursive: true });
  fs.writeFileSync(
    path.join(graphsDir, '.last-build-snapshot.json'),
    JSON.stringify(data, null, 2),
    'utf8'
  );
}

function gitHead(cwd) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf-8' }).trim();
}

function commitEmpty(cwd, message) {
  execFileSync('git', ['commit', '--allow-empty', '-m', message], { cwd, stdio: 'pipe' });
}

// Helper for auto-update status tests: builds a temp git project with
// optional .last-build-status.json written as autoUpdateValue.
// autoUpdateValue === null means no status file is written.
function makeStatusProject(autoUpdateValue) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3347-status-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: tmpDir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpDir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir });
  fs.writeFileSync(path.join(tmpDir, 'README.md'), '# t\n');
  execFileSync('git', ['add', '.'], { cwd: tmpDir });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: tmpDir });
  fs.mkdirSync(path.join(tmpDir, '.planning/graphs'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.planning/config.json'),
    JSON.stringify({ graphify: { enabled: true } }),
  );
  // Write a fresh (current-mtime) graph so age-based stale is false; only the
  // auto-update status field can set stale: true.
  fs.writeFileSync(
    path.join(tmpDir, '.planning/graphs/graph.json'),
    JSON.stringify({ nodes: [], edges: [] }),
  );
  if (autoUpdateValue !== null) {
    fs.writeFileSync(
      path.join(tmpDir, '.planning/graphs/.last-build-status.json'),
      JSON.stringify(autoUpdateValue),
    );
  }
  return tmpDir;
}

const SAMPLE_GRAPH = {
  nodes: [
    { id: 'n1', label: 'AuthService', description: 'Handles user authentication and token validation', type: 'service' },
    { id: 'n2', label: 'UserModel', description: 'User database model for storing credentials', type: 'model' },
    { id: 'n3', label: 'SessionManager', description: 'Manages active user sessions', type: 'service' },
    { id: 'n4', label: 'EmailService', description: 'Sends notification emails', type: 'service' },
    { id: 'n5', label: 'Logger', description: 'Centralized logging utility', type: 'utility' },
  ],
  edges: [
    { source: 'n1', target: 'n2', label: 'reads_from', confidence: 'EXTRACTED' },
    { source: 'n1', target: 'n3', label: 'creates', confidence: 'INFERRED' },
    { source: 'n2', target: 'n3', label: 'triggers', confidence: 'AMBIGUOUS' },
    { source: 'n3', target: 'n4', label: 'notifies', confidence: 'INFERRED' },
    { source: 'n4', target: 'n5', label: 'logs_via', confidence: 'EXTRACTED' },
  ],
  hyperedges: [],
};

const SAMPLE_NODES_MINIMAL = [
  { id: 'n1', label: 'A', description: '', type: 'service' },
  { id: 'n2', label: 'B', description: '', type: 'model' },
];

module.exports = {
  enableGraphify,
  writeGraphJson,
  writeSnapshotJson,
  gitHead,
  commitEmpty,
  makeStatusProject,
  SAMPLE_GRAPH,
  SAMPLE_NODES_MINIMAL,
};
