/**
 * Knowledge Layer — Shared constants
 * Ported from ACG's knowledge engine for GSD integration.
 */
'use strict';

/** Schema version for all knowledge JSON files. */
const VERSION = '1.0';

/** Directories to ignore during codebase walks. */
const IGNORE_DIRS = new Set([
  '.git', 'node_modules', '.planning', 'dist', 'build', 'coverage',
  '__pycache__', '.next', '.nuxt', '.svelte-kit', 'vendor', '.venv',
  'venv', 'env', '.tox', '.mypy_cache', '.pytest_cache', '.turbo',
  '.worktrees', 'gsd-local-patches',
]);

/** File extensions considered source code. */
const CODE_EXTS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.swift', '.kt', '.scala',
  '.sh', '.bash', '.zsh', '.sql', '.html', '.css', '.scss', '.json',
  '.yaml', '.yml', '.toml', '.xml', '.md', '.vue', '.svelte', '.astro',
  '.cjs', '.mjs',
]);

/** Extension to language name mapping. */
const LANG_MAP = {
  '.js': 'javascript', '.jsx': 'javascript', '.cjs': 'javascript', '.mjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript',
  '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust', '.java': 'java',
  '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp', '.cs': 'csharp',
  '.php': 'php', '.swift': 'swift', '.kt': 'kotlin', '.scala': 'scala',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.sql': 'sql', '.html': 'html', '.css': 'css', '.scss': 'scss',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.xml': 'xml', '.md': 'markdown', '.txt': 'text',
  '.vue': 'vue', '.svelte': 'svelte', '.astro': 'astro',
};

/** Common English stop words removed from search queries. */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'because', 'and', 'or', 'but', 'not', 'no',
  'nor', 'if', 'that', 'this', 'it', 'its', 'i', 'we', 'they', 'them',
  'my', 'our', 'your', 'his', 'her', 'their', 'what', 'which', 'who',
  'whom', 'these', 'those', 'am', 'about', 'up', 'also', 'need', 'make',
  'like', 'use', 'using', 'used', 'get', 'got', 'new', 'want',
]);

/** File extensions considered binary (skip during indexing). */
const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z', '.rar',
  '.mp4', '.avi', '.mov', '.mkv', '.mp3', '.wav', '.flac',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.exe', '.dll', '.so', '.dylib', '.bin',
]);

module.exports = { VERSION, IGNORE_DIRS, CODE_EXTS, LANG_MAP, STOP_WORDS, BINARY_EXTS };
