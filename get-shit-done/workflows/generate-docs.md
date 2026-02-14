<purpose>
Orchestrate documentation generation from .planning/ artifacts to browsable Docusaurus site.

Runs scripts/generate-docs.js for transformation, installs dependencies if needed, verifies output, and offers next steps.

Output: docs/ directory with Docusaurus site ready to start or build.
</purpose>

<philosophy>
**Incremental by default:**
Hash-based change detection skips unchanged files for fast regeneration. Use --force only when needed (structure changes, MDX preprocessing bugs).

**Fail fast:**
Exit immediately if .planning/ missing or Node.js version incompatible. Clear error messages guide user to fix prerequisites.

**Offer, don't assume:**
Present next steps (dev server, production build) but let user choose. Don't auto-start servers or build without permission.
</philosophy>

<process>

<step name="check_prerequisites" priority="first">
Verify environment meets requirements.

**Check .planning/ exists:**

```bash
if [ ! -d .planning ]; then
  echo "Error: .planning/ directory not found"
  echo ""
  echo "This command requires a GSD-initialized project."
  echo ""
  echo "Next steps:"
  echo "  - If greenfield project: Run /gsd:new-project"
  echo "  - If brownfield project: Run /gsd:map-codebase then /gsd:new-project"
  exit 1
fi
```

**Check Node.js version:**

```bash
NODE_VERSION=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ -z "$NODE_VERSION" ]; then
  echo "Error: Node.js not found"
  echo "Docusaurus requires Node.js 20+"
  exit 1
elif [ "$NODE_VERSION" -lt 20 ]; then
  echo "Error: Node.js $NODE_VERSION detected, but Docusaurus requires Node.js 20+"
  echo "Upgrade Node.js: https://nodejs.org/"
  exit 1
fi
```

Continue to parse_arguments.
</step>

<step name="parse_arguments">
Extract flags from command arguments.

**Parse --force flag:**

```bash
FORCE_FLAG=""
if echo "$ARGUMENTS" | grep -q "\--force"; then
  FORCE_FLAG="--force"
  echo "Force regeneration: enabled (all files will be regenerated)"
else
  echo "Incremental mode: enabled (only changed files will be regenerated)"
fi
```

Continue to run_generator.
</step>

<step name="run_generator">
Execute the documentation generator script.

**Run transformation:**

```bash
echo ""
echo "Running documentation generator..."
echo ""
node scripts/generate-docs.js $FORCE_FLAG
```

**Check exit code:**

If exit code non-zero, the generator script already printed error message. Stop here.

**Success output example:**

```
╔══════════════════════════════════════════════════════════╗
║  GSD Documentation Generator                             ║
╚══════════════════════════════════════════════════════════╝

Planning directory: /path/to/.planning
Output directory: /path/to/docs
Force regenerate: no

Checking Docusaurus scaffold...

  → Exists: docusaurus.config.js
  → Exists: sidebars.js
  → Exists: package.json
  → Exists: src/css/custom.css
  → Exists: static/img/.gitkeep
  → Exists: .gitignore

Processing .planning/ files...

  ✓ Transformed: .planning/PROJECT.md
  → Skipped (unchanged): .planning/ROADMAP.md
  ✓ Transformed: .planning/phases/01-infrastructure-foundation/01-01-SUMMARY.md
  ...

╔══════════════════════════════════════════════════════════╗
║  Generation Complete                                     ║
╚══════════════════════════════════════════════════════════╝

  Files transformed: 12
  Files skipped (unchanged): 8
  Scaffold files created: 0
```

Continue to install_dependencies.
</step>

<step name="install_dependencies">
Install Docusaurus dependencies if not already installed.

**Check if node_modules exists:**

```bash
if [ ! -d docs/node_modules ]; then
  echo ""
  echo "Installing Docusaurus dependencies..."
  echo "(This may take 1-2 minutes on first run)"
  echo ""
  pnpm install --dir docs

  if [ $? -ne 0 ]; then
    echo ""
    echo "Error: pnpm install failed"
    echo ""
    echo "Try:"
    echo "  1. cd docs"
    echo "  2. pnpm install"
    echo "  3. Check for Node.js version compatibility"
    exit 1
  fi

  echo ""
  echo "Dependencies installed successfully."
else
  echo ""
  echo "Dependencies already installed (docs/node_modules exists)."
fi
```

Continue to verify_output.
</step>

<step name="verify_output">
Verify documentation files were generated successfully.

**Check critical paths:**

```bash
echo ""
echo "Verifying output..."
echo ""

VERIFICATION_PASSED=true

# Check docs/docs/ directory exists
if [ ! -d docs/docs ]; then
  echo "  ✗ Missing: docs/docs/ directory"
  VERIFICATION_PASSED=false
else
  echo "  ✓ Found: docs/docs/ directory"
fi

# Check at least one markdown file exists
DOC_COUNT=$(find docs/docs -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "$DOC_COUNT" -eq 0 ]; then
  echo "  ✗ No markdown files found in docs/docs/"
  VERIFICATION_PASSED=false
else
  echo "  ✓ Found: $DOC_COUNT markdown files"
fi

# Check hash cache created
if [ ! -f .planning/.doc-hashes.json ]; then
  echo "  ✗ Missing: .planning/.doc-hashes.json (hash cache)"
  VERIFICATION_PASSED=false
else
  echo "  ✓ Found: .planning/.doc-hashes.json"
fi

# Check Docusaurus config exists
if [ ! -f docs/docusaurus.config.js ]; then
  echo "  ✗ Missing: docs/docusaurus.config.js"
  VERIFICATION_PASSED=false
else
  echo "  ✓ Found: docs/docusaurus.config.js"
fi

if [ "$VERIFICATION_PASSED" = false ]; then
  echo ""
  echo "Verification failed. See errors above."
  exit 1
fi
```

Continue to test_build.
</step>

<step name="test_build">
Test production build to catch MDX errors early.

**Offer build test:**

```
Production build test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test the production build now? This catches MDX preprocessing errors.

Run: pnpm --dir docs build

Reply:
  - "yes" to test build now
  - "no" to skip (you can test later)
```

Wait for user response.

**If user replies "yes":**

```bash
echo ""
echo "Testing production build..."
echo ""
pnpm --dir docs build

if [ $? -ne 0 ]; then
  echo ""
  echo "Build failed. Common issues:"
  echo "  - MDX syntax errors (check escaped < and { characters)"
  echo "  - Broken internal links"
  echo "  - Missing frontmatter"
  echo ""
  echo "Fix errors and re-run: /gsd:docs --force"
  exit 1
fi

echo ""
echo "Build test passed! Site is production-ready."
```

**If user replies "no":**

Skip build test.

Continue to offer_next.
</step>

<step name="offer_next">
Present next steps to user.

**Output format:**

```
Documentation generated successfully.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ Next Steps
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Option 1: Start development server
  pnpm --dir docs start

  Opens browser at http://localhost:3000
  Hot reload on file changes

Option 2: Build for production
  pnpm --dir docs build

  Creates static site in docs/build/
  Deploy to any static host (Vercel, Netlify, GitHub Pages)

Option 3: Regenerate docs
  /gsd:docs          (incremental - only changed files)
  /gsd:docs --force  (full regeneration)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Documentation site: docs/
Hash cache: .planning/.doc-hashes.json
```

End workflow.
</step>

</process>

<success_criteria>
- .planning/ directory exists (prerequisite check passed)
- Node.js 20+ detected (prerequisite check passed)
- scripts/generate-docs.js executed successfully
- Docusaurus dependencies installed (if needed)
- docs/docs/ contains markdown files
- Hash cache created/updated (.planning/.doc-hashes.json)
- Verification passed (critical paths exist)
- User offered clear next steps
</success_criteria>
