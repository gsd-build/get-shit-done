import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { withLock } from './file-lock.js';

/**
 * Session metadata - first line of every session JSONL file
 */
export interface SessionMetadata {
  type: 'session_metadata';
  session_id: string;
  pid: number;
  cwd: string;
  start_time: string;
  last_heartbeat: string;
  label?: string;
  tasks: any[];
}

/**
 * Generic JSONL entry
 */
export interface SessionEntry {
  type: string;
  [key: string]: any;
}

/**
 * Session information for discovery
 */
export interface SessionInfo {
  id: string;
  path: string;
  metadata: SessionMetadata | null;
}

// Base directory for session storage
function getProjectRoot(): string {
  if (process.env.PROJECT_ROOT) {
    return process.env.PROJECT_ROOT;
  }
  // Traverse up from mcp-servers/telegram-mcp to project root
  const currentDir = process.cwd();
  if (currentDir.includes('mcp-servers/telegram-mcp')) {
    return path.resolve(currentDir, '../..');
  }
  return currentDir;
}

const PROJECT_ROOT = getProjectRoot();
export const SESSIONS_DIR = path.join(PROJECT_ROOT, '.planning/telegram-sessions');
const ARCHIVE_DIR = path.join(SESSIONS_DIR, 'archive');
const HEARTBEAT_TTL_HOURS = 24;

/**
 * Get full path to session JSONL file
 */
export function getSessionPath(sessionId: string): string {
  return path.join(SESSIONS_DIR, `${sessionId}.jsonl`);
}

/**
 * Self-healing JSONL reader
 * Handles corrupted lines gracefully, warns if >10% corrupted
 */
export async function loadSessionJSONL(filePath: string): Promise<any[]> {
  // Return empty array if file doesn't exist
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = await fs.readFile(filePath, 'utf8');
    if (!content.trim()) {
      return [];
    }

    const lines = content.trim().split('\n');
    const entries: any[] = [];
    let corruptedCount = 0;

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        entries.push(JSON.parse(line));
      } catch (err) {
        corruptedCount++;
        console.warn(`[session-manager] Corrupted JSONL line in ${filePath}, skipping:`, line.substring(0, 100));
      }
    }

    // Warn if >10% lines corrupted
    if (lines.length > 0 && corruptedCount / lines.length > 0.1) {
      console.warn(
        `[session-manager] WARNING: ${corruptedCount}/${lines.length} lines (${Math.round((corruptedCount / lines.length) * 100)}%) corrupted in ${filePath}`
      );
    }

    return entries;
  } catch (err) {
    console.error(`[session-manager] Failed to read ${filePath}:`, err);
    return [];
  }
}

/**
 * Append entry to session file with file locking
 */
export async function appendToSession(sessionId: string, entry: any): Promise<void> {
  const filePath = getSessionPath(sessionId);

  await withLock(filePath, async () => {
    await fs.appendFile(filePath, JSON.stringify(entry) + '\n', 'utf8');
  });
}

/**
 * Create new session with UUID and metadata
 * Triggers opportunistic cleanup of stale sessions
 */
export async function createSession(label?: string): Promise<string> {
  // Ensure sessions directory exists
  if (!existsSync(SESSIONS_DIR)) {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  }

  // Generate session ID
  const sessionId = uuidv4();
  const filePath = getSessionPath(sessionId);
  const now = new Date().toISOString();

  // Create session metadata as first line
  const metadata: SessionMetadata = {
    type: 'session_metadata',
    session_id: sessionId,
    pid: process.pid,
    cwd: process.cwd(),
    start_time: now,
    last_heartbeat: now,
    label,
    tasks: []
  };

  // Write metadata (creates file)
  await fs.writeFile(filePath, JSON.stringify(metadata) + '\n', 'utf8');

  // Opportunistic cleanup (don't block on errors)
  cleanupStaleSessions().catch(err => {
    console.error('[session-manager] Opportunistic cleanup failed:', err);
  });

  return sessionId;
}

/**
 * Discover all sessions in sessions directory
 * Returns array of SessionInfo with metadata (or null if corrupted)
 */
export async function discoverSessions(): Promise<SessionInfo[]> {
  if (!existsSync(SESSIONS_DIR)) {
    return [];
  }

  const files = await fs.readdir(SESSIONS_DIR);
  const sessionFiles = files.filter(f => f.endsWith('.jsonl') && !f.startsWith('.'));

  const sessions: SessionInfo[] = [];

  for (const file of sessionFiles) {
    const filePath = path.join(SESSIONS_DIR, file);
    const sessionId = file.replace('.jsonl', '');

    // Load first line to get metadata
    const entries = await loadSessionJSONL(filePath);
    const metadata = entries.length > 0 && entries[0].type === 'session_metadata'
      ? (entries[0] as SessionMetadata)
      : null;

    sessions.push({
      id: sessionId,
      path: filePath,
      metadata
    });
  }

  return sessions;
}

/**
 * Check if session is alive using dual detection:
 * 1. PID exists (process is running)
 * 2. Heartbeat is fresh (within TTL)
 */
export async function isSessionAlive(metadata: SessionMetadata): Promise<boolean> {
  // Check 1: PID exists
  let pidExists = false;
  try {
    // Signal 0 = existence check (no actual signal sent)
    process.kill(metadata.pid, 0);
    pidExists = true;
  } catch (err) {
    // Process doesn't exist or no permission
    pidExists = false;
  }

  // Check 2: Heartbeat freshness
  const lastHeartbeat = new Date(metadata.last_heartbeat);
  const now = new Date();
  const hoursSinceHeartbeat = (now.getTime() - lastHeartbeat.getTime()) / (1000 * 60 * 60);
  const heartbeatFresh = hoursSinceHeartbeat < HEARTBEAT_TTL_HOURS;

  // Both checks must pass
  return pidExists && heartbeatFresh;
}

/**
 * Opportunistic cleanup - archive dead sessions
 * Non-blocking, catches all errors
 */
export async function cleanupStaleSessions(): Promise<void> {
  try {
    const sessions = await discoverSessions();

    for (const session of sessions) {
      if (!session.metadata) {
        // Corrupted session - archive it
        console.warn(`[session-manager] Archiving corrupted session: ${session.id}`);
        await archiveSession(session.path).catch(err => {
          console.error(`[session-manager] Failed to archive corrupted session ${session.id}:`, err);
        });
        continue;
      }

      const alive = await isSessionAlive(session.metadata);
      if (!alive) {
        console.log(`[session-manager] Archiving stale session: ${session.id} (PID ${session.metadata.pid})`);
        await archiveSession(session.path).catch(err => {
          console.error(`[session-manager] Failed to archive stale session ${session.id}:`, err);
        });
      }
    }
  } catch (err) {
    console.error('[session-manager] Cleanup failed:', err);
  }
}

/**
 * Archive session to date-based archive directory
 * Format: archive/YYYY-MM-DD/<session-id>.jsonl
 */
export async function archiveSession(sessionPath: string): Promise<void> {
  const sessionId = path.basename(sessionPath, '.jsonl');
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const archiveDateDir = path.join(ARCHIVE_DIR, today);

  // Ensure archive directory exists
  await fs.mkdir(archiveDateDir, { recursive: true });

  const archivePath = path.join(archiveDateDir, `${sessionId}.jsonl`);

  // Move session file to archive
  await fs.rename(sessionPath, archivePath);

  console.error(`[session-manager] Archived session ${sessionId} to ${archivePath}`);
}

/**
 * Update session heartbeat
 * Appends heartbeat entry to session file
 */
export async function updateHeartbeat(sessionId: string): Promise<void> {
  const entry = {
    type: 'heartbeat',
    timestamp: new Date().toISOString()
  };

  await appendToSession(sessionId, entry);
}

/**
 * Explicitly close session
 * Appends session_close entry to session file
 */
export async function closeSession(sessionId: string): Promise<void> {
  const entry = {
    type: 'session_close',
    timestamp: new Date().toISOString()
  };

  await appendToSession(sessionId, entry);
}
