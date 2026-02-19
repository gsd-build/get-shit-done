/**
 * knowledge-db.js
 *
 * SQLite database infrastructure for the knowledge system.
 * Provides database initialization, schema management, and connection lifecycle.
 *
 * Usage:
 *   const { openKnowledgeDB, closeKnowledgeDB } = require('./knowledge-db.js')
 *   const conn = openKnowledgeDB('project')
 *   // ... use conn.db
 *   closeKnowledgeDB(conn.db)
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')

// ─── Constants ─────────────────────────────────────────────────────────────

const SCHEMA_VERSION = 4
const DB_CONNECTIONS = new Map()

// ─── Path Resolution ───────────────────────────────────────────────────────

/**
 * Get database file path for given scope
 *
 * As of schema v4, all scopes resolve to the global DB at ~/.claude/knowledge/<user>.db.
 * The 'legacy' scope returns the old per-project path for use by the migration command only.
 *
 * @param {string} scope - 'global', 'project', or 'legacy'
 * @returns {string} Absolute path to database file
 */
function getDBPath(scope) {
  const username = os.userInfo().username

  if (scope === 'legacy') {
    // Old per-project path — only used by migrate-knowledge command
    return path.join(process.cwd(), '.planning', 'knowledge', `${username}.db`)
  }

  // Both 'global' and 'project' resolve to the same global DB
  return path.join(os.homedir(), '.claude', 'knowledge', `${username}.db`)
}

// ─── Availability Check ────────────────────────────────────────────────────

/**
 * Check if knowledge database is available (dependencies installed)
 * @param {string} scope - 'global' or 'project'
 * @returns {{ available: boolean, reason?: string }}
 */
function isKnowledgeDBAvailable(scope) {
  try {
    require('better-sqlite3')
  } catch (err) {
    return {
      available: false,
      reason: 'better-sqlite3 not installed: ' + err.message
    }
  }

  try {
    require('sqlite-vec')
  } catch (err) {
    return {
      available: false,
      reason: 'sqlite-vec not installed: ' + err.message
    }
  }

  return { available: true }
}

// ─── Schema Creation ───────────────────────────────────────────────────────

/**
 * Initialize database schema
 * @param {object} db - better-sqlite3 database connection
 */
function createSchema(db) {
  // Main knowledge table
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      type TEXT NOT NULL,
      scope TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER,
      access_count INTEGER DEFAULT 0,
      last_accessed INTEGER,
      content_hash TEXT,
      metadata TEXT,
      project_slug TEXT
    );
  `)

  // FTS5 full-text search table
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      content,
      content='knowledge',
      content_rowid='id',
      tokenize='porter unicode61'
    );
  `)

  // FTS5 sync triggers
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS knowledge_fts_insert AFTER INSERT ON knowledge BEGIN
      INSERT INTO knowledge_fts(rowid, content) VALUES (new.id, new.content);
    END;
  `)

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS knowledge_fts_update AFTER UPDATE ON knowledge BEGIN
      UPDATE knowledge_fts SET content = new.content WHERE rowid = new.id;
    END;
  `)

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS knowledge_fts_delete AFTER DELETE ON knowledge BEGIN
      DELETE FROM knowledge_fts WHERE rowid = old.id;
    END;
  `)

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_expires
    ON knowledge(expires_at) WHERE expires_at IS NOT NULL;
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_type_access
    ON knowledge(type, access_count DESC);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_hash
    ON knowledge(content_hash);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_knowledge_project_slug
    ON knowledge(project_slug);
  `)

  // Permissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grant_token TEXT UNIQUE NOT NULL,
      action_pattern TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'global',
      limits TEXT,
      granted_at INTEGER NOT NULL,
      expires_at INTEGER,
      revoked_at INTEGER,
      metadata TEXT
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_permissions_pattern ON permissions(action_pattern);
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_permissions_active ON permissions(revoked_at) WHERE revoked_at IS NULL;
  `)

  // Permission usage tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS permission_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grant_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (grant_id) REFERENCES permissions(id)
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_permission_usage_grant ON permission_usage(grant_id);
  `)

  // Cost tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cost_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      cost REAL NOT NULL,
      timestamp INTEGER NOT NULL,
      metadata TEXT
    );
  `)

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cost_timestamp ON cost_tracking(timestamp DESC);
  `)

  // Budget alerts tracking (deduplication)
  db.exec(`
    CREATE TABLE IF NOT EXISTS budget_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      threshold REAL NOT NULL,
      period_start INTEGER NOT NULL,
      fired_at INTEGER NOT NULL,
      UNIQUE(threshold, period_start)
    );
  `)

  // Circuit breaker state
  db.exec(`
    CREATE TABLE IF NOT EXISTS circuit_breaker (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 0,
      reason TEXT,
      enabled_at INTEGER
    );
  `)

  db.exec(`
    INSERT OR IGNORE INTO circuit_breaker (id, enabled) VALUES (1, 0);
  `)
}

/**
 * Create vector search table (requires sqlite-vec extension)
 * @param {object} db - better-sqlite3 database connection
 * @returns {boolean} True if vector table created successfully
 */
function createVectorTable(db) {
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_vec USING vec0(
        embedding float[512]
      );
    `)
    return true
  } catch (err) {
    console.warn('Could not create vector table:', err.message)
    return false
  }
}

// ─── Migration System ──────────────────────────────────────────────────────

/**
 * Get current schema version from database
 * @param {object} db - better-sqlite3 database connection
 * @returns {number} Current schema version
 */
function getCurrentVersion(db) {
  return db.pragma('user_version', { simple: true })
}

/**
 * Set schema version in database
 * @param {object} db - better-sqlite3 database connection
 * @param {number} version - Schema version to set
 */
function setVersion(db, version) {
  db.pragma(`user_version = ${version}`)
}

/**
 * Run database migrations
 * @param {object} db - better-sqlite3 database connection
 * @returns {number} Final schema version
 */
function migrateDatabase(db) {
  const currentVersion = getCurrentVersion(db)

  if (currentVersion === 0) {
    // Initial schema creation
    createSchema(db)
    setVersion(db, SCHEMA_VERSION)
  }

  // Migration from version 1 to version 2: Add permissions tables
  if (currentVersion === 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grant_token TEXT UNIQUE NOT NULL,
        action_pattern TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT 'global',
        limits TEXT,
        granted_at INTEGER NOT NULL,
        expires_at INTEGER,
        revoked_at INTEGER,
        metadata TEXT
      );
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_permissions_pattern ON permissions(action_pattern);
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_permissions_active ON permissions(revoked_at) WHERE revoked_at IS NULL;
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS permission_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        grant_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (grant_id) REFERENCES permissions(id)
      );
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_permission_usage_grant ON permission_usage(grant_id);
    `)

    setVersion(db, 2)
  }

  // Migration from version 2 to version 3: Add cost tracking tables
  if (currentVersion === 2) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cost_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        cost REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      );
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_cost_timestamp ON cost_tracking(timestamp DESC);
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS budget_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        threshold REAL NOT NULL,
        period_start INTEGER NOT NULL,
        fired_at INTEGER NOT NULL,
        UNIQUE(threshold, period_start)
      );
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS circuit_breaker (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        enabled_at INTEGER
      );
    `)

    db.exec(`
      INSERT OR IGNORE INTO circuit_breaker (id, enabled) VALUES (1, 0);
    `)

    setVersion(db, 3)
  }

  // Migration from version 3 to version 4: Add project_slug column for global DB tagging
  if (getCurrentVersion(db) === 3) {
    db.exec(`
      ALTER TABLE knowledge ADD COLUMN project_slug TEXT;
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_project_slug ON knowledge(project_slug);
    `)

    setVersion(db, 4)
  }

  return getCurrentVersion(db)
}

// ─── Connection Management ─────────────────────────────────────────────────

/**
 * Open or create knowledge database
 * @param {string} scope - 'global' or 'project'
 * @returns {{ db: object, vectorEnabled: boolean, ftsEnabled: boolean, scope: string }}
 */
function openKnowledgeDB(scope) {
  const dbPath = getDBPath(scope)

  // Return cached connection if exists
  if (DB_CONNECTIONS.has(dbPath)) {
    return DB_CONNECTIONS.get(dbPath)
  }

  // Ensure directory exists
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  // Load better-sqlite3
  let Database
  try {
    Database = require('better-sqlite3')
  } catch (err) {
    throw new Error('better-sqlite3 not available: ' + err.message)
  }

  // Open database
  const db = new Database(dbPath)

  // Configure SQLite pragmas
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = -10000')
  db.pragma('temp_store = MEMORY')

  // Load sqlite-vec extension
  let vectorEnabled = false
  try {
    const sqliteVec = require('sqlite-vec')
    sqliteVec.load(db)
    vectorEnabled = true
  } catch (err) {
    console.warn('sqlite-vec extension unavailable:', err.message)
  }

  // Run migrations
  migrateDatabase(db)

  // Create vector table if extension loaded
  if (vectorEnabled) {
    vectorEnabled = createVectorTable(db)
  }

  // Create connection object
  const connection = {
    db,
    vectorEnabled,
    ftsEnabled: true,
    scope
  }

  // Cache connection
  DB_CONNECTIONS.set(dbPath, connection)

  return connection
}

/**
 * Close database connection
 * @param {object} db - better-sqlite3 database connection
 */
function closeKnowledgeDB(db) {
  if (!db) return

  // Find and remove from cache
  for (const [path, conn] of DB_CONNECTIONS.entries()) {
    if (conn.db === db) {
      DB_CONNECTIONS.delete(path)
      break
    }
  }

  // Close database
  try {
    db.close()
  } catch (err) {
    console.warn('Error closing database:', err.message)
  }
}

/**
 * Execute function with knowledge database
 * @param {string} scope - 'global' or 'project'
 * @param {function} fn - Function to execute with db connection
 * @returns {object} Result object with { success, result?, error?, skipped?, reason? }
 */
function withKnowledgeDB(scope, fn) {
  // Check availability
  const available = isKnowledgeDBAvailable(scope)
  if (!available.available) {
    return {
      skipped: true,
      reason: available.reason
    }
  }

  // Open database
  let conn
  try {
    conn = openKnowledgeDB(scope)
  } catch (err) {
    return {
      success: false,
      error: 'Failed to open database: ' + err.message
    }
  }

  // Execute function
  try {
    const result = fn(conn)
    return {
      success: true,
      result
    }
  } catch (err) {
    return {
      success: false,
      error: err.message
    }
  } finally {
    // Note: we don't close here because connections are cached
    // Call closeKnowledgeDB explicitly when done with all operations
  }
}

// ─── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  openKnowledgeDB,
  closeKnowledgeDB,
  migrateDatabase,
  getDBPath,
  isKnowledgeDBAvailable,
  withKnowledgeDB
}
