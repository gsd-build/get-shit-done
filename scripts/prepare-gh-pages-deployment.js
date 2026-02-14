#!/usr/bin/env node
/**
 * Prepare GitHub Pages deployment for Docusaurus documentation.
 *
 * Detects GitHub remote, configures Docusaurus baseUrl/url, and generates
 * a GitHub Actions workflow for automated deployment to GitHub Pages.
 *
 * Configuration:
 *   .planning/config.json:
 *     - docs.deploy_to_github_pages: boolean (default: false)
 *     - docs.custom_domain: string | null (e.g., "docs.example.com")
 *
 * Usage:
 *   node scripts/prepare-gh-pages-deployment.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// Constants
// ============================================================================

const CONFIG_PATH = path.join(process.cwd(), '.planning', 'config.json');
const DOCUSAURUS_CONFIG_PATH = path.join(process.cwd(), 'docs', 'docusaurus.config.js');
const WORKFLOW_DIR = path.join(process.cwd(), '.github', 'workflows');
const WORKFLOW_PATH = path.join(WORKFLOW_DIR, 'deploy-docs.yml');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load configuration from .planning/config.json
 */
function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      return { docs: { deploy_to_github_pages: false, custom_domain: null } };
    }

    const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
    const config = JSON.parse(configContent);

    return {
      docs: {
        deploy_to_github_pages: config.docs?.deploy_to_github_pages || false,
        custom_domain: config.docs?.custom_domain || null
      }
    };
  } catch (error) {
    console.error(`Warning: Failed to parse config.json: ${error.message}`);
    return { docs: { deploy_to_github_pages: false, custom_domain: null } };
  }
}

/**
 * Parse GitHub remote URL to extract owner and repo name
 * Supports SSH, HTTPS, and git protocol formats
 */
function parseGitHubUrl(remoteUrl) {
  // SSH format: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return {
      source: 'github.com',
      owner: sshMatch[1],
      repo: sshMatch[2]
    };
  }

  // HTTPS format: https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return {
      source: 'github.com',
      owner: httpsMatch[1],
      repo: httpsMatch[2]
    };
  }

  // Git protocol: git://github.com/owner/repo.git
  const gitMatch = remoteUrl.match(/git:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (gitMatch) {
    return {
      source: 'github.com',
      owner: gitMatch[1],
      repo: gitMatch[2]
    };
  }

  // Check if it's a non-GitHub remote
  const nonGitHubMatch = remoteUrl.match(/@([^:]+):|https?:\/\/([^/]+)\/|git:\/\/([^/]+)\//);
  if (nonGitHubMatch) {
    const source = nonGitHubMatch[1] || nonGitHubMatch[2] || nonGitHubMatch[3];
    return { source, owner: null, repo: null };
  }

  return null;
}

/**
 * Detect GitHub remote from git configuration
 */
function detectGitHubRemote() {
  try {
    // Try to get origin remote
    let remoteUrl;
    try {
      remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();
    } catch (error) {
      // If origin doesn't exist, try to get first available fetch remote
      try {
        const remotes = execSync('git remote -v', { encoding: 'utf8' });
        const fetchMatch = remotes.match(/^(\S+)\s+(\S+)\s+\(fetch\)/m);
        if (fetchMatch) {
          remoteUrl = fetchMatch[2];
        } else {
          return null;
        }
      } catch (err) {
        return null;
      }
    }

    return parseGitHubUrl(remoteUrl);
  } catch (error) {
    return null;
  }
}

/**
 * Determine baseUrl and url based on repository type and custom domain
 */
function determineUrls(owner, repo, customDomain) {
  if (customDomain) {
    return {
      url: `https://${customDomain}`,
      baseUrl: '/'
    };
  }

  // Check if this is a user/org site (owner.github.io)
  if (repo === `${owner}.github.io`) {
    return {
      url: `https://${owner}.github.io`,
      baseUrl: '/'
    };
  }

  // Project site
  return {
    url: `https://${owner}.github.io`,
    baseUrl: `/${repo}/`
  };
}

/**
 * Update Docusaurus configuration file with new url and baseUrl
 */
function updateDocusaurusConfig(url, baseUrl) {
  if (!fs.existsSync(DOCUSAURUS_CONFIG_PATH)) {
    console.warn(`Warning: ${DOCUSAURUS_CONFIG_PATH} not found, skipping config update`);
    return false;
  }

  try {
    let config = fs.readFileSync(DOCUSAURUS_CONFIG_PATH, 'utf8');

    // Replace url
    config = config.replace(
      /url:\s*['"].*?['"]/,
      `url: '${url}'`
    );

    // Replace baseUrl
    config = config.replace(
      /baseUrl:\s*['"].*?['"]/,
      `baseUrl: '${baseUrl}'`
    );

    fs.writeFileSync(DOCUSAURUS_CONFIG_PATH, config, 'utf8');
    return true;
  } catch (error) {
    console.error(`Warning: Failed to update Docusaurus config: ${error.message}`);
    return false;
  }
}

/**
 * Generate GitHub Actions workflow for deploying to GitHub Pages
 */
function generateWorkflow(customDomain) {
  const cnameConfig = customDomain ? `\n        cname: ${customDomain}` : '';

  const workflowContent = `name: Deploy Documentation to GitHub Pages

on:
  push:
    branches:
      - main
    paths:
      - 'docs/**'
      - '.planning/**'

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Generate documentation
        run: node scripts/generate-docs.js

      - name: Install dependencies
        run: pnpm install --dir docs

      - name: Build documentation
        run: pnpm --dir docs build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs/build${cnameConfig}
`;

  try {
    // Create .github/workflows directory if it doesn't exist
    if (!fs.existsSync(WORKFLOW_DIR)) {
      fs.mkdirSync(WORKFLOW_DIR, { recursive: true });
    }

    fs.writeFileSync(WORKFLOW_PATH, workflowContent, 'utf8');
    return true;
  } catch (error) {
    console.error(`Error: Failed to create workflow file: ${error.message}`);
    return false;
  }
}

/**
 * Print deployment preparation summary
 */
function printSummary(owner, repo, url, baseUrl) {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  GitHub Pages Deployment Prepared                        ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`  Repository: ${owner}/${repo}`);
  console.log(`  URL: ${url}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Workflow: .github/workflows/deploy-docs.yml`);
  console.log(`  Config updated: docs/docusaurus.config.js\n`);
  console.log('Next steps:');
  console.log('  1. Commit docs/ and .github/ directories');
  console.log('  2. Push to main branch');
  console.log('  3. Enable GitHub Pages in repo Settings > Pages > Source: "GitHub Actions"\n');
}

// ============================================================================
// Main
// ============================================================================

function main() {
  try {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  GitHub Pages Deployment Preparation                     ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // Load configuration
    const config = loadConfig();

    if (!config.docs.deploy_to_github_pages) {
      console.log('GitHub Pages deployment not enabled in .planning/config.json');
      console.log('To enable, add to .planning/config.json:');
      console.log('  "docs": { "deploy_to_github_pages": true }\n');
      process.exit(0);
    }

    console.log('Deployment enabled, detecting GitHub remote...\n');

    // Detect GitHub remote
    const remote = detectGitHubRemote();

    if (!remote) {
      console.log('Warning: No git remote found');
      console.log('GitHub Pages deployment skipped\n');
      process.exit(0);
    }

    if (remote.source !== 'github.com') {
      console.log(`Warning: Remote is ${remote.source}, not github.com`);
      console.log('GitHub Pages deployment skipped');
      console.log('To deploy to GitHub Pages, add a GitHub remote:\n');
      console.log('  git remote add github git@github.com:owner/repo.git\n');
      process.exit(0);
    }

    console.log(`  Detected: ${remote.owner}/${remote.repo}\n`);

    // Determine URLs
    const { url, baseUrl } = determineUrls(remote.owner, remote.repo, config.docs.custom_domain);

    // Update Docusaurus config
    const configUpdated = updateDocusaurusConfig(url, baseUrl);
    if (configUpdated) {
      console.log(`  ✓ Updated: docs/docusaurus.config.js`);
    }

    // Generate workflow
    const workflowCreated = generateWorkflow(config.docs.custom_domain);
    if (workflowCreated) {
      console.log(`  ✓ Created: .github/workflows/deploy-docs.yml`);
    }

    // Print summary
    printSummary(remote.owner, remote.repo, url, baseUrl);

  } catch (error) {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  }
}

main();
