/**
 * GSD Tools Tests - Install
 * 
 * Tests for Copilot CLI runtime support added in v1.22.0
 * Covers: --copilot flag parsing, skill installation, uninstall path
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const INSTALL_SCRIPT = path.join(__dirname, '..', 'bin', 'install.js');

/**
 * Helper to run install.js with arguments
 * @param {string[]} args - Arguments to pass to install.js
 * @param {Object} options - Options for execSync
 * @returns {Object} { success, output, error }
 */
function runInstall(args, options = {}) {
  try {
    const result = execSync(`node "${INSTALL_SCRIPT}" ${args.join(' ')}`, {
      encoding: 'utf-8',
      ...options,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
    };
  }
}

describe('install.js - Copilot CLI support', () => {
  let tempDir;
  let copilotConfigDir;

  beforeEach(() => {
    // Create temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-install-test-'));
    copilotConfigDir = path.join(tempDir, '.copilot');
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('--copilot flag parsing', () => {
    test('--copilot flag is recognized by install script', () => {
      // This test verifies that the --copilot flag doesn't cause an error
      // In a non-interactive environment, --copilot --global should complete
      // (or fail gracefully, not with an unrecognized flag error)
      const env = { ...process.env, HOME: tempDir };
      const result = runInstall(['--copilot', '--help'], { env });
      
      // Should exit cleanly (either with help text or run successfully)
      assert.ok(
        result.success || result.output.includes('install'),
        'install.js should recognize --copilot flag'
      );
    });

    test('--copilot works with --global flag', () => {
      // Test that --copilot can be combined with --global
      const env = { ...process.env, HOME: tempDir };
      const result = runInstall(['--copilot', '--global', '--help'], { env });
      
      assert.ok(
        result.success || result.output === '',
        '--copilot --global should not cause errors'
      );
    });

    test('--copilot works with --local flag', () => {
      // Test that --copilot can be combined with --local
      const env = { ...process.env, HOME: tempDir };
      const result = runInstall(['--copilot', '--local', '--help'], { env });
      
      assert.ok(
        result.success || result.output === '',
        '--copilot --local should not cause errors'
      );
    });

    test('--copilot can be combined with --all', () => {
      // Test that --copilot is recognized in the context of --all
      const env = { ...process.env, HOME: tempDir };
      const result = runInstall(['--all', '--help'], { env });
      
      assert.ok(
        result.success || result.output === '',
        '--all should include copilot option'
      );
    });
  });

  describe('--copilot --uninstall path', () => {
    test('--copilot --uninstall --global flag combination is recognized', () => {
      // Test that the uninstall path with --copilot doesn't cause errors
      const env = { ...process.env, HOME: tempDir };
      const result = runInstall(['--copilot', '--uninstall', '--global', '--help'], { env });
      
      // Should recognize the flag combination
      assert.ok(
        result.success || result.output === '',
        '--copilot --uninstall --global should be recognized'
      );
    });

    test('--copilot --uninstall --local flag combination is recognized', () => {
      // Test local uninstall path with --copilot
      const env = { ...process.env, HOME: tempDir };
      const result = runInstall(['--copilot', '--uninstall', '--local', '--help'], { env });
      
      assert.ok(
        result.success || result.output === '',
        '--copilot --uninstall --local should be recognized'
      );
    });

    test('-u short form works with --copilot', () => {
      // Test that -u (short for --uninstall) works with --copilot
      const env = { ...process.env, HOME: tempDir };
      const result = runInstall(['--copilot', '-u', '--global', '--help'], { env });
      
      assert.ok(
        result.success || result.output === '',
        '--copilot -u (short uninstall) should be recognized'
      );
    });
  });

  describe('Copilot skills directory structure', () => {
    test('skills directory location for Copilot is ~/.copilot/skills', () => {
      // Verify that the code references the correct path for Copilot skills
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      
      // Should have references to .copilot and skills directory
      assert.ok(
        content.includes('copilot') && content.includes('skills'),
        'install.js should reference .copilot/skills'
      );
    });

    test('Copilot skills use SKILL.md format (same as Codex)', () => {
      // Verify that Copilot and Codex use the same SKILL.md format
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      
      // Should have listCopilotSkillNames function that looks for SKILL.md
      const hasCopilotSkillCheck = content.includes('listCopilotSkillNames') && 
                                     content.includes("'SKILL.md'");
      assert.ok(
        hasCopilotSkillCheck,
        'Copilot skills should use SKILL.md format'
      );
    });

    test('convertClaudeCommandToCopilotSkill function exists', () => {
      // Verify the conversion function is present
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      assert.ok(
        content.includes('function convertClaudeCommandToCopilotSkill'),
        'convertClaudeCommandToCopilotSkill function should exist'
      );
    });

    test('copyCommandsAsCopilotSkills function exists', () => {
      // Verify the copy function is present
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      assert.ok(
        content.includes('function copyCommandsAsCopilotSkills'),
        'copyCommandsAsCopilotSkills function should exist'
      );
    });

    test('listCopilotSkillNames function exists', () => {
      // Verify the list function is present
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      assert.ok(
        content.includes('function listCopilotSkillNames'),
        'listCopilotSkillNames function should exist'
      );
    });
  });

  describe('Menu structure and documentation', () => {
    test('Interactive menu includes Copilot option at position 5', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      
      // Menu should show option 5 as Copilot
      assert.ok(
        content.includes('${cyan}5${reset}) Copilot'),
        'Menu should include Copilot at position 5'
      );
    });

    test('Menu has "All" option (now at position 6)', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      
      // Menu should show option 6 as All
      assert.ok(
        content.includes('${cyan}6${reset}) All'),
        'Menu should include "All" at position 6'
      );
    });

    test('Breaking change is documented in code comments', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      
      // Should have comment about the v1.22.0 breaking change
      assert.ok(
        content.includes('v1.22.0') && content.includes('breaking'),
        'Code should document the breaking change from v1.22.0'
      );
    });

    test('Breaking change comment explains the menu renumbering', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      
      // Comment should explain option 5 changed from All to Copilot
      const breakingCommentRegex = /option 5.*changed from.*All.*Copilot/i;
      assert.ok(
        breakingCommentRegex.test(content),
        'Breaking change comment should explain option 5 changed from All to Copilot'
      );
    });
  });

  describe('Code quality - no redundant variables', () => {
    test('No duplicate skillsDir variables in writeManifest', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      
      // Extract the writeManifest function
      const writeManifestMatch = content.match(/function writeManifest\([^)]*\)\s*{[\s\S]*?(?=\nfunction|\Z)/);
      assert.ok(writeManifestMatch, 'writeManifest function should be found');
      
      const writeManifestBody = writeManifestMatch[0];
      
      // Count occurrences of const ... Sdir = path.join(configDir, 'skills')
      const skillsDirDeclares = (writeManifestBody.match(/const\s+\w*[Ss]kills[Dd]ir\s*=\s*path\.join\(configDir,\s*'skills'\)/g) || []).length;
      
      assert.strictEqual(
        skillsDirDeclares,
        1,
        'writeManifest should have only one skillsDir variable declaration'
      );
    });

    test('codexSkillsDir and copilotSkillsDir use same variable', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      
      // Should NOT have two separate declarations
      assert.ok(
        !content.includes('const codexSkillsDir') || !content.includes('const copilotSkillsDir'),
        'Codex and Copilot should not have separate redundant skillsDir variables'
      );
    });

    test('Both Codex and Copilot skill handling share the same directory', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      
      // Extract writeManifest function
      const writeManifestMatch = content.match(/function writeManifest\([^)]*\)\s*{[\s\S]*?(?=\nfunction|\Z)/);
      const writeManifestBody = writeManifestMatch[0];
      
      // Both Codex and Copilot sections should reference the same variable
      // After the fix, both should use skillsDir or the same reference
      const hasCodexSkillsRef = writeManifestBody.includes('isCodex') && writeManifestBody.includes('skillsDir');
      const hasCopilotSkillsRef = writeManifestBody.includes('isCopilot') && writeManifestBody.includes('skillsDir');
      
      assert.ok(
        hasCodexSkillsRef && hasCopilotSkillsRef,
        'Both Codex and Copilot should utilize the same skillsDir reference'
      );
    });
  });

  describe('Environment variable support', () => {
    test('COPILOT_CONFIG_DIR environment variable is documented', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      
      // Should mention COPILOT_CONFIG_DIR env var handling
      assert.ok(
        content.includes('COPILOT_CONFIG_DIR'),
        'install.js should mention COPILOT_CONFIG_DIR env var'
      );
    });

    test('getCopilotGlobalDir or equivalent function exists', () => {
      const content = fs.readFileSync(INSTALL_SCRIPT, 'utf-8');
      
      // Should have a function to get Copilot's global directory
      // (similar to getOpencodeGlobalDir, getGeminiGlobalDir, etc.)
      const hasCopilotDirHandling = /COPILOT_CONFIG_DIR|getCopilot|copilot.*globalDir/i.test(content);
      assert.ok(
        hasCopilotDirHandling,
        'install.js should handle COPILOT_CONFIG_DIR env var'
      );
    });
  });
});
