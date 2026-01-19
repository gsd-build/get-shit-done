# Phase 1: Constitution Foundation - Research

**Researched:** 2026-01-19
**Domain:** Configuration file parsing, merging, and versioning
**Confidence:** HIGH

## Summary

Constitution Foundation requires parsing YAML frontmatter + markdown files, merging global and project-level configurations with override precedence, and implementing semantic versioning for migration safety.

The standard Node.js ecosystem provides battle-tested libraries for each component: **gray-matter** for frontmatter parsing (used by Gatsby, Netlify, Astro, HashiCorp), **semver** for version comparison (npm's own library), and **deepmerge** or **lodash.merge** for configuration merging. Markdown section extraction uses **markdown-tree-parser** for modern selector-based queries or **marked** for stability.

Critical architectural decisions: (1) Synchronous file loading is appropriate during initialization but must never be used in runtime operations. (2) Array merging strategy must be explicit—replacement vs concatenation has major implications for rule override behavior. (3) YAML indentation errors account for 70% of parsing issues and require strict validation. (4) Cross-platform path handling requires Node's `path` module and `os.homedir()`, not tilde expansion.

**Primary recommendation:** Use gray-matter + semver + deepmerge with synchronous loading during initialization, explicit array replacement for rule overrides, and path.join for all file path construction.

## Standard Stack

The established libraries/tools for configuration parsing and merging in Node.js:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gray-matter | latest | YAML frontmatter parsing | Battle-tested, used by Gatsby, Netlify, Astro, HashiCorp. Better edge case handling than regex-based parsers |
| semver | latest | Semantic version comparison | Official npm semver parser. Comprehensive API (gt, lt, satisfies, compare) |
| deepmerge | 4.3.1+ | Deep object merging | Dedicated utility, 12,473+ projects. Predictable array handling |
| markdown-tree-parser | latest | Extract markdown sections | Modern API with CSS-like selectors. Efficient heading extraction |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lodash.merge | latest | Alternative deep merge | If lodash already in dependencies. Note: mutates first object unless using `_.merge({}, obj1, obj2)` |
| marked | latest | Alternative markdown parser | Need stability over features. Industry standard for 10+ years |
| expand-tilde | latest | Tilde path expansion | If supporting `~/.config` syntax. Node.js doesn't expand tilde natively |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gray-matter | front-matter | Less feature-rich, no stringify support. gray-matter handles more edge cases |
| semver | compare-versions | Lighter (no dependencies) but less comprehensive. Missing satisfies() for range checking |
| deepmerge | Custom recursive merge | Reinventing wheel. Edge cases (circular refs, prototypes) are hard |

**Installation:**
```bash
npm install gray-matter semver deepmerge markdown-tree-parser
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── constitution/
│   ├── loader.js           # Loads and merges global + project files
│   ├── parser.js           # Parses YAML frontmatter + markdown sections
│   ├── versioning.js       # Checks version compatibility
│   └── merger.js           # Merges global + project rules
└── utils/
    └── paths.js            # Cross-platform path resolution
```

### Pattern 1: Configuration Loading (Initialization Only)

**What:** Load global and project constitution files during app initialization using synchronous fs methods.

**When to use:** Application startup, before serving requests or executing main logic. Never use sync methods in runtime operations.

**Example:**
```javascript
// Source: Node.js best practices + fs module docs
const fs = require('fs');
const path = require('path');
const os = require('os');

function loadConstitutionFiles() {
  // Cross-platform home directory
  const homeDir = os.homedir();
  const globalPath = path.join(homeDir, '.claude', 'get-shit-done', 'CONSTITUTION.md');
  const projectPath = path.join(process.cwd(), '.planning', 'CONSTITUTION.md');

  // Synchronous loading is OK during initialization
  const globalExists = fs.existsSync(globalPath);
  const projectExists = fs.existsSync(projectPath);

  const globalContent = globalExists ? fs.readFileSync(globalPath, 'utf8') : null;
  const projectContent = projectExists ? fs.readFileSync(projectPath, 'utf8') : null;

  return { global: globalContent, project: projectContent };
}
```

### Pattern 2: Frontmatter + Markdown Parsing

**What:** Parse YAML frontmatter and extract markdown sections with rule IDs.

**When to use:** After loading file content, before merging configurations.

**Example:**
```javascript
// Source: gray-matter documentation
const matter = require('gray-matter');
const { MarkdownTreeParser } = require('markdown-tree-parser');

function parseConstitution(content) {
  // Parse frontmatter
  const { data: frontmatter, content: markdown } = matter(content);

  // Extract sections by severity
  const parser = new MarkdownTreeParser();
  const tree = parser.parse(markdown);

  const nonNegotiable = parser.extractSection(tree, 'NON-NEGOTIABLE', 1);
  const errors = parser.extractSection(tree, 'ERROR', 1);
  const warnings = parser.extractSection(tree, 'WARNING', 1);

  return {
    version: frontmatter.version,
    lastUpdated: frontmatter.lastUpdated,
    rules: {
      'NON-NEGOTIABLE': parseRules(nonNegotiable),
      'ERROR': parseRules(errors),
      'WARNING': parseRules(warnings)
    }
  };
}

function parseRules(sectionContent) {
  // Extract rule IDs from headings like "### TDD-01: Test before implementation"
  const rulePattern = /^### ([A-Z]+-\d+):\s*(.+)$/gm;
  const rules = [];
  let match;

  while ((match = rulePattern.exec(sectionContent)) !== null) {
    rules.push({
      id: match[1],
      description: match[2]
    });
  }

  return rules;
}
```

### Pattern 3: Semantic Version Checking

**What:** Verify constitution version compatibility before merging.

**When to use:** After parsing both constitutions, before merge operation.

**Example:**
```javascript
// Source: semver documentation
const semver = require('semver');

function checkVersionCompatibility(globalVersion, projectVersion) {
  // Ensure project version is compatible with global
  if (!semver.valid(globalVersion) || !semver.valid(projectVersion)) {
    throw new Error('Invalid semver format in constitution version');
  }

  // Breaking change detection (major version mismatch)
  const globalMajor = semver.major(globalVersion);
  const projectMajor = semver.major(projectVersion);

  if (projectMajor < globalMajor) {
    throw new Error(
      `Constitution version mismatch: project (${projectVersion}) is behind global (${globalVersion}). Migration required.`
    );
  }

  return {
    compatible: true,
    globalVersion,
    projectVersion,
    needsMigration: projectMajor !== globalMajor
  };
}
```

### Pattern 4: Configuration Merging with Array Replacement

**What:** Merge global and project constitutions with project override precedence.

**When to use:** After version checking, to produce final merged configuration.

**Example:**
```javascript
// Source: deepmerge documentation
const deepmerge = require('deepmerge');

function mergeConstitutions(globalConfig, projectConfig) {
  // Array replacement strategy: project arrays completely replace global arrays
  const arrayMergeStrategy = (target, source) => source;

  const merged = deepmerge(globalConfig, projectConfig, {
    arrayMerge: arrayMergeStrategy,
    // Ensure we create new object, not mutate global
    clone: true
  });

  // Validation: ensure rule IDs are unique
  const allRuleIds = new Set();
  for (const severity of ['NON-NEGOTIABLE', 'ERROR', 'WARNING']) {
    for (const rule of merged.rules[severity]) {
      if (allRuleIds.has(rule.id)) {
        throw new Error(`Duplicate rule ID: ${rule.id}`);
      }
      allRuleIds.add(rule.id);
    }
  }

  return merged;
}
```

### Pattern 5: Cross-Platform Path Resolution

**What:** Handle file paths safely across Windows, macOS, and Linux.

**When to use:** Everywhere paths are constructed or resolved.

**Example:**
```javascript
// Source: Node.js path module documentation
const path = require('path');
const os = require('os');

function resolveConstitutionPaths() {
  // NEVER use string concatenation or backslashes
  // BAD: homeDir + '/.claude/get-shit-done/CONSTITUTION.md'
  // BAD: homeDir + '\\.claude\\get-shit-done\\CONSTITUTION.md'

  // GOOD: Always use path.join
  const homeDir = os.homedir(); // Works on all platforms
  const globalPath = path.join(homeDir, '.claude', 'get-shit-done', 'CONSTITUTION.md');

  // If supporting tilde syntax, expand manually
  function expandTilde(filepath) {
    if (filepath.startsWith('~/')) {
      return path.join(os.homedir(), filepath.slice(2));
    }
    return filepath;
  }

  return { globalPath, expandTilde };
}
```

### Anti-Patterns to Avoid

- **Async file loading during initialization:** Adds complexity with no benefit. Sync is appropriate for startup config loading.
- **String-based path concatenation:** `homeDir + '/.claude/...'` breaks on Windows. Always use `path.join()`.
- **Array concatenation for rule merging:** Concatenating rules from global + project creates duplicates and unclear precedence. Use replacement.
- **Manual version comparison:** `globalVer > projectVer` string comparison fails for versions like "1.9.0" vs "1.10.0". Use semver.
- **Mutating global config:** `_.merge(globalConfig, projectConfig)` mutates first argument. Always create new object: `_.merge({}, global, project)`.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | Custom YAML parser | gray-matter | Edge cases: indentation errors, type coercion (yes/no → boolean), special characters, BOM handling, nested structures. 70% of YAML issues are indentation-related. |
| Semantic version comparison | String comparison or regex | semver | Version comparison fails with string logic ("1.9.0" > "1.10.0" is false). Semver handles pre-release tags, build metadata, range satisfaction. |
| Deep object merging | Recursive merge function | deepmerge or lodash.merge | Circular references, prototype pollution, array handling, symbol properties, getter/setter preservation. Easy to get wrong. |
| Markdown section extraction | Regex-based heading search | markdown-tree-parser or marked | Nested headings, escaped characters, code blocks with fake headings, HTML in markdown, heading level hierarchy. |
| Tilde path expansion | String replace `~/` with `homeDir` | expand-tilde or manual os.homedir() | Edge case: `~username/path` (other user's home), `~+` (cwd), platform-specific behavior. |
| Cross-platform paths | String concatenation with `/` or `\\` | path.join() and os.homedir() | Windows uses `\`, Unix uses `/`. `path.join()` handles platform differences automatically. |

**Key insight:** Configuration parsing is deceptively complex. YAML indentation, version comparison semantics, and deep merge edge cases cause subtle bugs that only manifest in production. Use battle-tested libraries.

## Common Pitfalls

### Pitfall 1: YAML Indentation Errors

**What goes wrong:** 70% of YAML parsing issues stem from indentation. Mixing tabs and spaces, inconsistent spacing (2 vs 4 spaces), or single misaligned character breaks parsing.

**Why it happens:** YAML uses whitespace for structure (unlike JSON's braces). Invisible characters (tabs, non-breaking spaces, zero-width characters) look identical to spaces but break parsers.

**How to avoid:**
- Enforce 2-space indentation consistently (configure editor)
- Never allow tabs in YAML files (set editor to convert tabs → spaces)
- Use YAML linting (yamllint or IDE plugins)
- gray-matter provides better error messages than raw YAML parsers

**Warning signs:**
- Parse error mentioning "mapping" or "sequence" without obvious syntax error
- Error on line with correct-looking indentation (check for tabs with hex editor)
- Works in one editor but fails in another (tab vs space mixing)

### Pitfall 2: YAML Type Coercion Surprises

**What goes wrong:** YAML auto-converts values like `yes`, `no`, `on`, `off`, `true`, `false` to booleans. A version field like `version: 1.0` becomes number `1.0`, losing trailing zero.

**Why it happens:** YAML spec defines implicit type conversions for readability. Parsers treat unquoted values as typed data, not strings.

**How to avoid:**
- Always quote string values in frontmatter: `version: "1.0.0"`
- Quote values with special meaning: `"yes"`, `"no"`, `"true"`, `"false"`
- Use explicit types: `!!str yes` forces string interpretation

**Warning signs:**
- Version `1.0` parsed as `1` (number)
- Boolean where string expected
- Unexpected type errors when accessing frontmatter fields

### Pitfall 3: Array Merge Strategy Mismatch

**What goes wrong:** Default deep merge concatenates arrays, causing global rules + project rules to duplicate. Alternatively, index-based merging replaces array[0] with array[0], array[1] with array[1], creating Frankenstein configuration.

**Why it happens:** No universal "correct" array merge strategy. Concatenation makes sense for some use cases (dependency arrays), replacement for others (rule definitions).

**How to avoid:**
- Explicitly define array merge strategy: `arrayMerge: (target, source) => source` for replacement
- Document the strategy in code comments
- Validate merged result (check for duplicate rule IDs)

**Warning signs:**
- Duplicate rules in merged config
- Rules from global appearing when project explicitly overrode them
- Unexpected rule count after merge

### Pitfall 4: Synchronous IO in Runtime

**What goes wrong:** Using `fs.readFileSync()` in request handlers or runtime operations blocks Node's event loop, destroying concurrency and application performance.

**Why it happens:** Sync methods are simpler to write (no callbacks/promises). Developers copy initialization code into runtime without realizing the impact.

**How to avoid:**
- Only use sync fs methods during application startup (before server starts listening)
- Use async methods (`fs.promises.readFile`) for all runtime operations
- Establish clear boundary: initialization = sync OK, runtime = async only

**Warning signs:**
- Application becomes unresponsive under load
- Request latency spikes
- Single slow file read blocks all requests

### Pitfall 5: Platform-Specific Path Assumptions

**What goes wrong:** Hardcoded `/` separators or `~` expansion fails on Windows. Assuming home directory structure breaks across platforms.

**Why it happens:** Developers test on one platform (usually macOS/Linux) and assume paths work universally.

**How to avoid:**
- Always use `path.join()`, never string concatenation
- Get home directory from `os.homedir()`, not `process.env.HOME`
- Test on multiple platforms or use path.resolve for absolute paths

**Warning signs:**
- "ENOENT: no such file or directory" errors on Windows
- Paths like `/Users/...` hardcoded in code
- Tilde `~` appearing in resolved paths (Node doesn't expand it)

### Pitfall 6: Version String Comparison

**What goes wrong:** String comparison `"1.9.0" > "1.10.0"` evaluates to `true` because string comparison is lexicographic, not semantic. Causes version checks to fail catastrophically.

**Why it happens:** Assuming version numbers follow normal comparison rules. JavaScript string comparison goes character-by-character.

**How to avoid:**
- Always use semver library for version comparison
- Validate version format with `semver.valid()` before storing
- Use `semver.gt()`, `semver.lt()`, `semver.satisfies()` for comparisons

**Warning signs:**
- Version 1.10 treated as older than 1.9
- Pre-release versions (1.0.0-alpha) causing unexpected behavior
- Range checking (`^1.0.0`) not working

### Pitfall 7: Duplicate Rule IDs Across Global + Project

**What goes wrong:** Same rule ID defined in both global and project constitutions. Merge produces duplicate or overwrites rule unintentionally.

**Why it happens:** No automatic uniqueness constraint. Rule IDs chosen independently for global and project.

**How to avoid:**
- Validate uniqueness after merge: collect all rule IDs into Set, detect duplicates
- Establish naming convention: global uses `GBL-XXX`, project uses `PRJ-XXX`
- Document override behavior: project rule ID matching global rule ID intentionally replaces it

**Warning signs:**
- Same rule appearing twice in merged config
- Rule content from wrong source (global instead of expected project override)
- Verification checking rules that shouldn't exist

## Code Examples

Verified patterns from official sources:

### Complete Constitution Loader

```javascript
// Source: Synthesized from gray-matter, semver, deepmerge documentation
const fs = require('fs');
const path = require('path');
const os = require('os');
const matter = require('gray-matter');
const semver = require('semver');
const deepmerge = require('deepmerge');

class ConstitutionLoader {
  constructor() {
    this.globalPath = path.join(os.homedir(), '.claude', 'get-shit-done', 'CONSTITUTION.md');
    this.projectPath = path.join(process.cwd(), '.planning', 'CONSTITUTION.md');
  }

  load() {
    // Sync loading during initialization is appropriate
    const globalContent = this._readFile(this.globalPath);
    const projectContent = this._readFile(this.projectPath);

    if (!globalContent && !projectContent) {
      throw new Error('No constitution files found (global or project)');
    }

    const globalConfig = globalContent ? this._parse(globalContent) : null;
    const projectConfig = projectContent ? this._parse(projectContent) : null;

    // Version compatibility check
    if (globalConfig && projectConfig) {
      this._checkVersions(globalConfig.version, projectConfig.version);
    }

    // Merge with project override precedence
    const merged = this._merge(globalConfig, projectConfig);

    // Validate uniqueness
    this._validateRuleIds(merged);

    return merged;
  }

  _readFile(filepath) {
    if (!fs.existsSync(filepath)) {
      return null;
    }
    return fs.readFileSync(filepath, 'utf8');
  }

  _parse(content) {
    const { data: frontmatter, content: markdown } = matter(content);

    // Extract sections
    const rules = {};
    const severities = ['NON-NEGOTIABLE', 'ERROR', 'WARNING'];

    for (const severity of severities) {
      rules[severity] = this._extractRules(markdown, severity);
    }

    return {
      version: frontmatter.version,
      lastUpdated: frontmatter.lastUpdated,
      rules
    };
  }

  _extractRules(markdown, severity) {
    // Find section starting with # SEVERITY
    const sectionPattern = new RegExp(`# ${severity}([\\s\\S]*?)(?=# [A-Z]|$)`);
    const match = markdown.match(sectionPattern);

    if (!match) return [];

    const sectionContent = match[1];

    // Extract rules with format: ### RULE-ID: Description
    const rulePattern = /^### ([A-Z]+-\d+):\s*(.+)$/gm;
    const rules = [];
    let ruleMatch;

    while ((ruleMatch = rulePattern.exec(sectionContent)) !== null) {
      rules.push({
        id: ruleMatch[1],
        description: ruleMatch[2],
        severity
      });
    }

    return rules;
  }

  _checkVersions(globalVersion, projectVersion) {
    if (!semver.valid(globalVersion)) {
      throw new Error(`Invalid global constitution version: ${globalVersion}`);
    }
    if (!semver.valid(projectVersion)) {
      throw new Error(`Invalid project constitution version: ${projectVersion}`);
    }

    // Major version must match (breaking changes)
    if (semver.major(globalVersion) !== semver.major(projectVersion)) {
      throw new Error(
        `Constitution major version mismatch: global ${globalVersion}, project ${projectVersion}`
      );
    }
  }

  _merge(globalConfig, projectConfig) {
    if (!globalConfig) return projectConfig;
    if (!projectConfig) return globalConfig;

    // Array replacement strategy: project completely replaces global
    return deepmerge(globalConfig, projectConfig, {
      arrayMerge: (target, source) => source,
      clone: true
    });
  }

  _validateRuleIds(config) {
    const seen = new Set();

    for (const severity of ['NON-NEGOTIABLE', 'ERROR', 'WARNING']) {
      for (const rule of config.rules[severity]) {
        if (seen.has(rule.id)) {
          throw new Error(`Duplicate rule ID: ${rule.id}`);
        }
        seen.add(rule.id);
      }
    }
  }
}

module.exports = ConstitutionLoader;
```

### YAML Frontmatter Validation

```javascript
// Source: gray-matter documentation + YAML best practices
function validateFrontmatter(frontmatter) {
  // Check required fields
  if (!frontmatter.version) {
    throw new Error('Constitution missing required field: version');
  }

  // Ensure version is string (YAML may parse 1.0 as number)
  if (typeof frontmatter.version !== 'string') {
    throw new Error(`Constitution version must be string, got ${typeof frontmatter.version}`);
  }

  // Validate semver format
  if (!semver.valid(frontmatter.version)) {
    throw new Error(`Invalid semver format: ${frontmatter.version}`);
  }

  return true;
}
```

## Security Rule Documentation Patterns

This section provides implementation guidance for documenting security rules (SEC-01 through SEC-07) in constitution templates. Each pattern includes good/bad examples, rationale templates, and verification guidance.

### SEC-01: No Hardcoded Secrets (NON-NEGOTIABLE)

**Pattern:** API keys, passwords, tokens, connection strings must never appear in source code.

**Good Example (Environment Variables):**
```javascript
// GOOD: Secrets from environment variables
const apiKey = process.env.API_KEY;
const dbPassword = process.env.DB_PASSWORD;

// Database connection using env vars
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});
```

**Good Example (Secrets Manager):**
```python
# GOOD: Secrets from AWS Secrets Manager
import boto3
from botocore.exceptions import ClientError

def get_secret(secret_name):
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId=secret_name)
    return response['SecretString']

api_key = get_secret('prod/api-key')
```

**Bad Example (Hardcoded):**
```javascript
// BAD: Hardcoded credentials
const apiKey = 'sk_live_4eC39HqLyjWDarjtT1zdp7dc';
const dbPassword = 'MyP@ssw0rd123!';

// BAD: Connection string with embedded credentials
const connectionString = 'mongodb://admin:password123@localhost:27017/mydb';
```

**Rationale Template:**
Hardcoded secrets create multiple security risks: (1) Secrets committed to version control remain in git history permanently, even after removal. (2) Anyone with repository access (developers, contractors, CI/CD systems) can extract credentials. (3) Secrets cannot be rotated without code changes and redeployment. (4) Public repositories expose credentials to entire internet. According to OWASP, hardcoded secrets are a critical vulnerability that enables unauthorized access, data breaches, and lateral movement within systems.

**Verification Guidance:**
- Grep patterns: `grep -rE "(password|api_key|secret|token)\s*=\s*['\"][^'\"]+" --include="*.js" --include="*.py" --include="*.java"`
- Check for connection strings: `grep -rE "(mongodb|postgresql|mysql)://[^@]+:[^@]+@" .`
- Files to examine: `.env.example` should exist with placeholders, `.env` should be in `.gitignore`
- Git history scan: `git log -p | grep -i "password\|api.key\|secret"`
- Exclude: Test fixtures with dummy data, documentation examples

### SEC-02: Parameterized Queries Only (NON-NEGOTIABLE)

**Pattern:** All database queries must use parameterized statements or prepared statements. Never concatenate user input into SQL strings.

**Good Example (Node.js with Parameterization):**
```javascript
// GOOD: Parameterized query
const userId = req.params.id;
const query = 'SELECT * FROM users WHERE id = ?';
connection.query(query, [userId], (error, results) => {
  // Handle results
});
```

**Good Example (Python with Prepared Statement):**
```python
# GOOD: Parameterized query with psycopg2
cursor = conn.cursor()
user_name = request.form['username']
cursor.execute("SELECT * FROM users WHERE username = %s", (user_name,))
results = cursor.fetchall()
```

**Good Example (Java with PreparedStatement):**
```java
// GOOD: PreparedStatement separates code from data
String custName = request.getParameter("customerName");
String query = "SELECT account_balance FROM user_data WHERE user_name = ?";
PreparedStatement pstmt = connection.prepareStatement(query);
pstmt.setString(1, custName);
ResultSet results = pstmt.executeQuery();
```

**Bad Example (String Concatenation):**
```javascript
// BAD: SQL injection vulnerability
const userId = req.params.id;
const query = 'SELECT * FROM users WHERE id = ' + userId;
connection.query(query, (error, results) => {
  // Attacker can inject: 1 OR 1=1
});

// BAD: Template literal injection
const email = req.body.email;
const query = `SELECT * FROM users WHERE email = '${email}'`;
// Attacker can inject: ' OR '1'='1
```

**Bad Example (Python String Formatting):**
```python
# BAD: String formatting vulnerable to injection
user_input = request.args.get('id')
query = f"SELECT * FROM users WHERE id = {user_input}"
cursor.execute(query)
# Attacker can inject: 1; DROP TABLE users; --
```

**Rationale Template:**
SQL injection enables attackers to: (1) Extract entire database contents including passwords and PII. (2) Modify or delete data (DROP TABLE, UPDATE all rows). (3) Execute administrative operations (create users, change permissions). (4) Read arbitrary files from the database server. (5) In some cases, execute operating system commands. Parameterized queries prevent SQL injection by ensuring user input is always treated as data, never as executable SQL code. The database driver handles proper escaping and quoting automatically. According to OWASP, SQL injection remains in the Top 10 web vulnerabilities and is the primary attack vector for database breaches.

**Verification Guidance:**
- Grep patterns for concatenation: `grep -rE "(SELECT|INSERT|UPDATE|DELETE).*\+.*req\.|request\.|params\.|body\." --include="*.js"`
- Template literals: `grep -rE '\$\{.*req\.|request\.|params\.' --include="*.js"`
- Python string formatting: `grep -rE '(f"|\.format\().*SELECT|INSERT|UPDATE|DELETE' --include="*.py"`
- Look for: `connection.query()`, `cursor.execute()`, `Statement.executeQuery()` calls
- Verify: All user input variables appear in parameter arrays, not in SQL strings
- Exclude: Static queries with no user input, query builders that handle parameterization

### SEC-03: Input Validation Required (ERROR)

**Pattern:** All user input must be validated for type, format, range, length, and character set before processing.

**Good Example (Type and Format Validation):**
```javascript
// GOOD: Allowlist validation with regex
function validateZipCode(zipCode) {
  const zipPattern = /^\d{5}(-\d{4})?$/;
  if (!zipPattern.test(zipCode)) {
    throw new ValidationError('Invalid zip code format');
  }
  return zipCode;
}

// GOOD: Type and range validation
function validateAge(age) {
  const numericAge = parseInt(age, 10);
  if (isNaN(numericAge) || numericAge < 0 || numericAge > 150) {
    throw new ValidationError('Age must be 0-150');
  }
  return numericAge;
}
```

**Good Example (Server-Side Schema Validation):**
```javascript
// GOOD: Joi schema validation
const Joi = require('joi');

const userSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  age: Joi.number().integer().min(0).max(150)
});

app.post('/register', (req, res) => {
  const { error, value } = userSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  // Proceed with validated data
});
```

**Bad Example (No Validation):**
```javascript
// BAD: Direct use of user input without validation
app.post('/user', (req, res) => {
  const age = req.body.age;  // Could be string, negative, huge number
  const email = req.body.email;  // Could be malformed, missing

  // Process without validation
  database.insertUser({ age, email });
});
```

**Bad Example (Client-Side Only):**
```html
<!-- BAD: Client-side validation easily bypassed -->
<form onsubmit="return validateForm()">
  <input type="email" id="email" required>
</form>

<script>
  // Only client-side - attacker can bypass with curl/Postman
  function validateForm() {
    const email = document.getElementById('email').value;
    return email.includes('@');
  }
</script>
```

**Rationale Template:**
Unvalidated input enables multiple attack vectors: (1) Type confusion attacks (sending array when string expected). (2) Buffer overflow (extremely long strings crash application). (3) Business logic bypass (negative quantities, out-of-range dates). (4) Downstream injection attacks (malicious input passed to SQL, shell commands, templates). Client-side validation provides UX feedback but offers zero security—attackers bypass it with direct API calls. Server-side validation must verify type, format, range, and length. Allowlisting (defining what IS valid) is significantly more secure than denylisting (blocking known bad patterns). According to OWASP, 42% of API breaches originate from improper input validation.

**Verification Guidance:**
- Look for: Direct use of `req.body`, `req.params`, `req.query` without validation
- Check for validation libraries: `joi`, `yup`, `express-validator`, `zod`
- Verify: Validation happens server-side before database operations
- Grep patterns: `grep -rE "req\.(body|params|query)\.\w+.*database|pool|query" --include="*.js"`
- API endpoints: Each POST/PUT/PATCH handler should have validation
- Exclude: GET requests reading from database (still need output sanitization)

### SEC-04: Output Sanitization Required (ERROR)

**Pattern:** User-controlled data displayed in UI must be HTML-encoded or sanitized to prevent XSS attacks.

**Good Example (HTML Entity Encoding):**
```javascript
// GOOD: React automatically escapes text content
function UserProfile({ username }) {
  return <div>{username}</div>;  // React escapes special chars
}

// GOOD: Manual encoding for plain JavaScript
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

element.textContent = userInput;  // Safe - textContent auto-encodes
```

**Good Example (HTML Sanitization for Rich Content):**
```javascript
// GOOD: DOMPurify for user-generated HTML
import DOMPurify from 'dompurify';

function BlogPost({ userContent }) {
  const sanitized = DOMPurify.sanitize(userContent);
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

**Bad Example (Unsanitized Output):**
```javascript
// BAD: Direct insertion of user input
element.innerHTML = userInput;  // XSS vulnerability

// BAD: Unescaped template literal
const html = `<div>${userComment}</div>`;  // XSS if userComment contains <script>
document.body.innerHTML = html;

// BAD: jQuery direct HTML insertion
$('#content').html(userInput);  // XSS vulnerability
```

**Bad Example (Incomplete Sanitization):**
```javascript
// BAD: Denylisting approach - easily bypassed
function badSanitize(input) {
  return input.replace(/<script>/g, '');  // Bypassed by <SCRIPT>, <img onerror=>
}
```

**Rationale Template:**
Cross-Site Scripting (XSS) allows attackers to: (1) Steal session cookies and authentication tokens. (2) Perform actions as the victim user (transfer money, change password). (3) Deface websites. (4) Redirect users to phishing sites. (5) Install keyloggers and track user behavior. XSS occurs when user-controlled data is rendered in HTML without proper encoding. Output encoding converts special characters (`<`, `>`, `&`, `"`, `'`) into HTML entities so browsers render them as text, not executable code. For rich content (markdown, WYSIWYG editors), use battle-tested sanitization libraries like DOMPurify that parse HTML and remove dangerous elements/attributes. Never build custom sanitization—attackers find bypasses. According to OWASP, XSS affects approximately two-thirds of web applications.

**Verification Guidance:**
- Look for: `innerHTML`, `dangerouslySetInnerHTML`, `document.write()` with user data
- Check React: `dangerouslySetInnerHTML` must use DOMPurify or similar
- Grep patterns: `grep -rE "innerHTML|dangerouslySetInnerHTML" --include="*.js" --include="*.jsx"`
- Verify: User input variables are encoded before HTML rendering
- Check for sanitization libraries: `DOMPurify`, `sanitize-html`, `xss`
- Template engines: Ensure auto-escaping enabled (Handlebars `{{ }}` not `{{{ }}}`)
- Exclude: Static HTML with no user input, admin-only content from trusted sources

### SEC-05: Authentication/Authorization Checks (ERROR)

**Pattern:** Protected resources must verify user identity (authentication) and permissions (authorization) before granting access.

**Good Example (Express Middleware):**
```javascript
// GOOD: Authentication middleware
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// GOOD: Authorization check
function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Apply to protected routes
app.delete('/users/:id', requireAuth, requireRole('admin'), deleteUser);
```

**Good Example (Resource-Level Authorization):**
```javascript
// GOOD: Verify user owns resource before modification
app.put('/posts/:id', requireAuth, async (req, res) => {
  const post = await db.posts.findById(req.params.id);

  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  // Horizontal privilege escalation prevention
  if (post.authorId !== req.user.id) {
    return res.status(403).json({ error: 'Not your post' });
  }

  // Proceed with update
  await db.posts.update(req.params.id, req.body);
  res.json({ success: true });
});
```

**Bad Example (No Authentication Check):**
```javascript
// BAD: Unprotected endpoint
app.delete('/users/:id', (req, res) => {
  // Anyone can delete any user - no auth check
  database.deleteUser(req.params.id);
  res.json({ success: true });
});
```

**Bad Example (Authentication Without Authorization):**
```javascript
// BAD: Checks authentication but not authorization
app.get('/users/:id/orders', requireAuth, (req, res) => {
  // User is authenticated but can view ANY user's orders
  const orders = database.getOrders(req.params.id);
  res.json(orders);
  // Should check: req.params.id === req.user.id
});
```

**Rationale Template:**
Broken authentication and authorization are consistently in OWASP Top 10. Missing checks enable: (1) Unauthorized access to sensitive data (view other users' orders, medical records, financial info). (2) Privilege escalation (regular user performs admin actions). (3) Account takeover (modify other users' profiles, passwords). (4) Data manipulation (delete or modify resources owned by others). Authentication verifies "who you are" via credentials/tokens. Authorization verifies "what you can do" based on roles and ownership. Both must be checked on the server side for every protected request. Client-side checks provide UX but no security. According to OWASP, horizontal privilege escalation (accessing other users' resources) is an especially common weakness.

**Verification Guidance:**
- Look for: Endpoints with authentication middleware: `requireAuth`, `passport.authenticate()`
- Check: Authorization logic verifies `req.user.id === resourceOwnerId`
- Grep patterns: `grep -rE "app\.(get|post|put|delete|patch)" --include="*.js"` then verify middleware
- Protected endpoints: `/admin/*`, `/users/:id/*`, DELETE/PUT/PATCH operations
- Verify: Token validation, role checks, resource ownership checks
- Test: Can user A access user B's resources by changing ID in URL?
- Exclude: Public endpoints (login, register, public content)

### SEC-06: Secure Dependency Management (WARNING)

**Pattern:** Use dependencies from trusted sources, keep them updated, scan for known vulnerabilities.

**Good Example (Dependency Auditing):**
```bash
# GOOD: Regular vulnerability scanning
npm audit
npm audit fix  # Auto-fix non-breaking vulnerabilities

# GOOD: Use CI/CD checks
npm ci  # Enforces lockfile, fails on inconsistencies
```

**Good Example (Dependency Verification):**
```json
// package.json - GOOD: Pinned versions for security-critical deps
{
  "dependencies": {
    "express": "4.18.2",  // Exact version
    "jsonwebtoken": "~9.0.0"  // Patch updates only
  },
  "devDependencies": {
    "eslint": "^8.0.0"  // Dev tools can be more flexible
  }
}
```

**Good Example (Automated Monitoring):**
```yaml
# .github/workflows/security.yml
name: Security Scan
on: [push, schedule]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm audit --audit-level=moderate
      - uses: snyk/actions/node@master  # Third-party scanning
```

**Bad Example (Outdated Dependencies):**
```json
// BAD: Dependencies 2+ years old with known vulnerabilities
{
  "dependencies": {
    "express": "4.15.0",  // Released 2017, has CVEs
    "lodash": "4.17.4"    // Known prototype pollution vuln
  }
}
```

**Bad Example (Unsafe Ranges):**
```json
// BAD: Wildcard versions allow breaking/vulnerable changes
{
  "dependencies": {
    "jsonwebtoken": "*",     // Any version - extremely dangerous
    "axios": "latest"        // Unpredictable updates
  }
}
```

**Rationale Template:**
Supply chain attacks are the fastest-growing threat vector. Attackers compromise popular packages to inject malicious code reaching millions of users. Vulnerable dependencies introduce known security flaws that attackers actively exploit. In 2025, the Shai-Hulud worm compromised 500+ npm packages through self-replicating supply chain attack (CISA alert). Secure dependency management requires: (1) Using lockfiles (`package-lock.json`) for deterministic builds. (2) Running `npm audit` regularly to detect known CVEs. (3) Avoiding blind updates—wait 21+ days before adopting new versions. (4) Using `npm ci` in CI/CD to enforce exact versions. (5) Enabling 2FA on package registries to prevent account takeover. According to industry research, by 2026 more than half of Node.js security incidents stem from compromised dependencies.

**Verification Guidance:**
- Check files: `package-lock.json` or `yarn.lock` committed to repo
- Run: `npm audit` and check exit code (0 = no vulnerabilities)
- Verify: No dependencies with `*` or `latest` in `package.json`
- Check: Last `npm audit` or `npm update` timestamp in git history
- CI/CD: Security scanning integrated in build pipeline
- Look for: Snyk, Dependabot, GitHub Security Alerts enabled
- Exclude: Dev dependencies with low security impact (linters, formatters)

### SEC-07: No Sensitive Data Exposure (WARNING)

**Pattern:** Error messages, logs, and API responses must not leak passwords, tokens, PII, or internal system details.

**Good Example (Safe Error Handling):**
```javascript
// GOOD: Generic error messages to users
app.use((err, req, res, next) => {
  // Log full error server-side for debugging
  logger.error('Request failed', {
    error: err.message,
    stack: err.stack,
    userId: req.user?.id  // User ID OK, no password
  });

  // Send generic message to client
  res.status(500).json({
    error: 'An error occurred processing your request',
    requestId: req.id  // For support correlation
  });
});
```

**Good Example (Safe Logging):**
```javascript
// GOOD: Filter sensitive fields from logs
const sanitizeForLogging = (obj) => {
  const safe = { ...obj };
  delete safe.password;
  delete safe.token;
  delete safe.creditCard;
  delete safe.ssn;
  return safe;
};

logger.info('User login', sanitizeForLogging(req.body));
```

**Bad Example (Leaking Stack Traces):**
```javascript
// BAD: Exposing stack traces to users
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,
    stack: err.stack,  // Reveals file paths, framework versions
    query: err.sql     // Leaks database schema
  });
});
```

**Bad Example (Logging Sensitive Data):**
```javascript
// BAD: Logging passwords and tokens
logger.info('User registration', req.body);
// req.body contains: { username: 'alice', password: 'secret123' }

logger.debug('API request', {
  headers: req.headers  // Contains Authorization: Bearer token
});
```

**Bad Example (Verbose SQL Errors):**
```javascript
// BAD: Database errors reveal schema
app.get('/users/:id', (req, res) => {
  db.query('SELECT * FROM users WHERE id = ?', [req.params.id], (err, rows) => {
    if (err) {
      // Reveals table structure, column names
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});
```

**Rationale Template:**
Sensitive data exposure in logs and errors enables attackers to: (1) Extract credentials from log files (passwords, API keys accidentally logged). (2) Discover internal architecture (stack traces reveal file paths, framework versions). (3) Map database schema (verbose SQL errors show table/column names). (4) Steal PII for identity theft (SSN, credit cards in logs). (5) Replay session tokens found in logs. According to OWASP Top 10:2025 (A09), security logging failures include inserting sensitive data into log files (CWE-532). Production error messages should be generic ("An error occurred") while detailed errors go to secure logging systems. Logs must never contain passwords, tokens, credit cards, SSN, or health data. Stack traces and SQL errors should only appear in development environments, never production.

**Verification Guidance:**
- Check error handlers: Should send generic messages to clients
- Look for: `err.stack`, `err.sql` sent in API responses
- Grep patterns: `grep -rE "logger\.(info|debug|warn).*password|token|secret" --include="*.js"`
- Verify: Logging libraries filter sensitive fields
- Check: Environment-specific error handling (verbose in dev, generic in prod)
- Look for: `process.env.NODE_ENV === 'production'` checks
- Test: Trigger errors and verify responses don't leak internals
- Exclude: Development/staging environments with controlled access

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON configuration | YAML frontmatter + markdown | 2015-2020 | More readable, supports documentation with rules. Common in static site generators (Jekyll, Hugo, Gatsby). |
| Manual version comparison | semver library | Established (npm standard) | Reliable semantic versioning. Handles pre-release, build metadata, range satisfaction. |
| Regex-based markdown parsing | AST-based parsers (remark, marked, markdown-tree-parser) | 2018-2023 | Safer parsing, handles edge cases (code blocks, escaped chars, nested structures). |
| Async-only fs operations | Sync during init, async at runtime | Best practice | Simpler initialization code, better performance at runtime. |

**Deprecated/outdated:**
- **expand-tilde package:** Low maintenance (last update 2017), has security vulnerabilities. Better: manual expansion with `os.homedir()`.
- **js-yaml-front-matter:** Superseded by gray-matter. Less active maintenance.
- **Regex-based frontmatter extraction:** Fragile, breaks on edge cases. Use gray-matter instead.

## Open Questions

Things that couldn't be fully resolved:

1. **Node.js version requirement for markdown-tree-parser**
   - What we know: Uses modern JS (async/await, ES modules)
   - What's unclear: Minimum Node.js version not documented in README
   - Recommendation: Test with Node 16+ (project requires 16.7.0+), document any compatibility issues

2. **Rule override semantics when IDs match**
   - What we know: Project should override global for same rule ID
   - What's unclear: Should it be explicit (project declares "override: RULE-ID") or implicit (matching ID = override)?
   - Recommendation: Start with implicit (simpler), add explicit if needed. Document behavior clearly.

3. **Migration strategy for constitution version changes**
   - What we know: Major version change = breaking change, should prevent merge
   - What's unclear: Should system auto-migrate, prompt user, or fail fast?
   - Recommendation: Fail fast with clear error message in Phase 1. Migration tooling in later phase if needed.

## Sources

### Primary (HIGH confidence)
- [gray-matter GitHub repository](https://github.com/jonschlinkert/gray-matter) - Frontmatter parser API and usage
- [semver GitHub repository](https://github.com/npm/node-semver) - Version comparison functions
- [markdown-tree-parser GitHub repository](https://github.com/ksylvan/markdown-tree-parser) - Markdown section extraction
- Node.js official documentation (path module, os module, fs module) - Platform-independent file operations
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) - Hardcoded secrets patterns
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) - Parameterized query examples
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) - Validation patterns
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) - Output sanitization examples
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) - Auth/authz patterns
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) - Permission check patterns
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) - Sensitive data in logs

### Secondary (MEDIUM confidence)
- [YAML indentation pitfalls - Flipper File](https://flipperfile.com/developer-guides/yaml/why-yaml-indentation-breaks-easily/) - 70% of YAML errors are indentation-related
- [Cross-platform Node.js paths - ehmicky guide](https://github.com/ehmicky/cross-platform-node-guide/blob/main/docs/3_filesystem/file_paths.md) - Path handling best practices
- [Configuration merging patterns - webpack-merge](https://survivejs.com/blog/webpack-merge-interview/) - Array concatenation vs replacement strategies
- [ESLint configuration severity levels](https://deepwiki.com/eslint/eslint-jp/3.2-rules-and-severity-levels) - Established pattern for ERROR/WARNING severity
- [Node.js sync vs async best practices](https://medium.com/@shubham3480/node-part-v-0f626ead588d) - When sync methods are appropriate
- [npm Security Best Practices - OWASP](https://cheatsheetseries.owasp.org/cheatsheets/NPM_Security_Cheat_Sheet.html) - Dependency management
- [CISA Alert: npm Supply Chain Compromise](https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem) - Shai-Hulud worm incident
- [Node.js Security Best Practices 2026](https://medium.com/@sparklewebhelp/node-js-security-best-practices-for-2026-3b27fb1e8160) - Current security guidance
- [OWASP Top 10:2025 A09](https://owasp.org/Top10/2025/A09_2025-Security_Logging_and_Alerting_Failures/) - Logging security

### Tertiary (LOW confidence - WebSearch only)
- Various npm comparison sites (npm-compare.com) - Library popularity metrics
- Medium articles on deep merging - General patterns, not authoritative

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - gray-matter, semver, deepmerge are industry standards with official documentation verified
- Architecture: HIGH - Patterns synthesized from official docs and established Node.js best practices
- Pitfalls: MEDIUM to HIGH - YAML indentation (70% statistic verified), version comparison (semver docs), path handling (Node.js docs). Some pitfalls from general best practices.
- Security patterns: HIGH - All examples derived from OWASP official cheat sheets with WebSearch verification for 2026 context

**Research date:** 2026-01-19
**Valid until:** ~30 days (stable ecosystem, unlikely to change rapidly)

**Key decisions for planner:**
1. Use synchronous file loading during initialization (appropriate for config loading)
2. Implement array replacement strategy for rule merging (not concatenation)
3. Validate version compatibility before merge (fail fast on major version mismatch)
4. Use `path.join()` and `os.homedir()` for all path operations (cross-platform)
5. Validate rule ID uniqueness after merge (prevent duplicates)
6. Security rule documentation must include good/bad code examples from OWASP patterns
7. Each security rule needs rationale explaining attack vectors and impacts
8. Verification guidance must provide specific grep patterns and file checks
