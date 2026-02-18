const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = path.join(process.env.HOME, '.claude', 'get-shit-done', 'compression-cache');

/**
 * CompressionCache - File-based caching for compressed documentation
 *
 * Purpose: Prevent redundant compression of unchanged files
 * Cache key: MD5 hash of (filePath + content + mtime)
 * TTL: Configurable expiration time (default 300s)
 */
class CompressionCache {
  constructor(ttlSeconds = 300) {
    this.ttl = ttlSeconds * 1000; // Convert to ms
    this.ensureCacheDir();
  }

  /**
   * Ensure cache directory exists
   */
  ensureCacheDir() {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  /**
   * Generate cache key from file path, content hash, and mtime
   * @param {string} filePath - Absolute file path
   * @param {string} content - File content
   * @param {number} mtime - File modification time (milliseconds)
   * @returns {string} MD5 hash key
   */
  getCacheKey(filePath, content, mtime) {
    const hash = crypto.createHash('md5')
      .update(filePath + content + mtime.toString())
      .digest('hex');
    return hash;
  }

  /**
   * Get cached summary if valid
   * @param {string} filePath - Absolute file path
   * @param {string} content - File content
   * @param {number} mtime - File modification time (milliseconds)
   * @returns {string|null} Cached summary or null if not found/expired
   */
  get(filePath, content, mtime) {
    try {
      const key = this.getCacheKey(filePath, content, mtime);
      const cachePath = path.join(CACHE_DIR, key + '.json');

      if (!fs.existsSync(cachePath)) return null;

      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      const age = Date.now() - cached.timestamp;

      if (age > this.ttl) {
        fs.unlinkSync(cachePath); // Expired, remove
        return null;
      }

      return cached.summary;
    } catch (error) {
      // If cache read fails, return null (will re-compress)
      return null;
    }
  }

  /**
   * Store summary in cache
   * @param {string} filePath - Absolute file path
   * @param {string} content - File content
   * @param {number} mtime - File modification time (milliseconds)
   * @param {string} summary - Compressed summary to cache
   */
  set(filePath, content, mtime, summary) {
    try {
      const key = this.getCacheKey(filePath, content, mtime);
      const cachePath = path.join(CACHE_DIR, key + '.json');

      fs.writeFileSync(cachePath, JSON.stringify({
        timestamp: Date.now(),
        filePath,
        summary
      }));
    } catch (error) {
      // If cache write fails, log but don't throw (compression still worked)
      console.error(`[cache] Error writing cache: ${error.message}`);
    }
  }

  /**
   * Clear all cached entries
   */
  clear() {
    try {
      if (fs.existsSync(CACHE_DIR)) {
        const files = fs.readdirSync(CACHE_DIR);
        for (const file of files) {
          fs.unlinkSync(path.join(CACHE_DIR, file));
        }
      }
    } catch (error) {
      console.error(`[cache] Error clearing cache: ${error.message}`);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} { entries: number, totalSize: number }
   */
  stats() {
    try {
      if (!fs.existsSync(CACHE_DIR)) return { entries: 0, totalSize: 0 };

      const files = fs.readdirSync(CACHE_DIR);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(CACHE_DIR, file);
        if (fs.existsSync(filePath)) {
          totalSize += fs.statSync(filePath).size;
        }
      }

      return { entries: files.length, totalSize };
    } catch (error) {
      console.error(`[cache] Error getting stats: ${error.message}`);
      return { entries: 0, totalSize: 0 };
    }
  }
}

module.exports = { CompressionCache, CACHE_DIR };
