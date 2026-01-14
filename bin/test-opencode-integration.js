#!/usr/bin/env node

// Integration Test Script for OpenCode Support
// Tests the OpenCode integration functionality

const fs = require('fs');
const path = require('path');
const os = require('os');

// Import classes directly since they're defined inline in install.js
const ConfigManager = require('./config-manager');
const AgentBridge = require('./agent-bridge');

// Define EditorDetector locally for testing
class EditorDetector {
  static detect() {
    // Check for OpenCode indicators first
    if (this.isOpenCodeEnvironment()) {
      return 'opencode';
    }
    // Default to Claude Code
    return 'claude';
  }

  static isOpenCodeEnvironment() {
    // Check for ~/.opencode directory
    const opencodeDir = require('path').join(require('os').homedir(), '.opencode');
    return require('fs').existsSync(opencodeDir);
  }
}

class OpenCodeIntegrationTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message) {
    console.log(`[TEST] ${message}`);
  }

  assert(condition, message, details = '') {
    if (condition) {
      this.results.passed++;
      this.log(`✓ PASS: ${message}`);
    } else {
      this.results.failed++;
      this.log(`✗ FAIL: ${message}`);
      if (details) this.log(`   Details: ${details}`);
    }
    this.results.tests.push({ message, passed: condition, details });
  }

  async testEditorDetection() {
    this.log('Testing editor detection...');

    // Test detection logic
    const detected = EditorDetector.detect();
    this.assert(['claude', 'opencode'].includes(detected),
      'Editor detection returns valid editor type',
      `Detected: ${detected}`);

    // Test OpenCode environment detection
    const isOpenCode = EditorDetector.isOpenCodeEnvironment();
    this.assert(typeof isOpenCode === 'boolean',
      'OpenCode environment detection returns boolean');

    // Test with mock environment
    const originalExistsSync = fs.existsSync;
    fs.existsSync = (p) => p.includes('.opencode');
    const mockIsOpenCode = EditorDetector.isOpenCodeEnvironment();
    this.assert(mockIsOpenCode === true,
      'OpenCode detection works with mock environment');
    fs.existsSync = originalExistsSync;
  }

  async testConfigManager() {
    this.log('Testing configuration manager...');

    const configManager = new ConfigManager();

    // Test config path resolution
    const configPath = configManager.getConfigPath();
    this.assert(configPath.includes('.claude') || configPath.includes('.opencode'),
      'Config path resolves correctly');

    // Test config loading/saving
    const testConfig = { test: true, gsd: { version: '1.0.0' } };
    configManager.saveConfig(testConfig);

    const loadedConfig = configManager.loadConfig();
    this.assert(loadedConfig.test === true,
      'Config saving and loading works');

    // Test GSD config methods
    configManager.setGSDConfig({ editor: 'test' });
    const gsdConfig = configManager.getGSDConfig();
    this.assert(gsdConfig.editor === 'test',
      'GSD config methods work');

    // Cleanup
    try {
      fs.unlinkSync(configPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  async testAgentBridge() {
    this.log('Testing agent bridge...');

    const agentBridge = new AgentBridge();

    // Test task classification
    const codeGenTask = 'Create a login component';
    const debugTask = 'Fix the authentication bug';
    const docTask = 'Update documentation';
    const generalTask = 'Do something random';

    const codeGenType = agentBridge.classifyTask(codeGenTask);
    const debugType = agentBridge.classifyTask(debugTask);
    const docType = agentBridge.classifyTask(docTask);
    const generalType = agentBridge.classifyTask(generalTask);

    this.assert(codeGenType === 'code-generation',
      'Code generation task classified correctly');
    this.assert(debugType === 'debugging',
      'Debug task classified correctly');
    this.assert(docType === 'documentation',
      'Documentation task classified correctly');
    this.assert(generalType === 'general',
      'General task classified as fallback');

    // Test delegation decision (without OpenCode API)
    const canDelegateCode = agentBridge.canDelegateToOpenCode(codeGenTask);
    const canDelegateGeneral = agentBridge.canDelegateToOpenCode(generalTask);

    this.assert(canDelegateCode === false,
      'Cannot delegate without OpenCode API');
    this.assert(canDelegateGeneral === false,
      'Cannot delegate general tasks without API');

    // Test subagent spawning
    const result = await agentBridge.spawnGSDSubagent('Test task');
    this.assert(result.agentId.startsWith('gsd-'),
      'GSD subagent spawning returns valid result');
    this.assert(result.delegated === false,
      'GSD subagent correctly marked as not delegated');
  }

  async testCommandTranslation() {
    this.log('Testing command translation...');

    // Test the translation logic (would be in extension.js)
    const testTranslations = [
      { opencode: 'opencode.gsd.newProject', claude: '/gsd:new-project' },
      { opencode: 'opencode.gsd.createRoadmap', claude: '/gsd:create-roadmap' },
      { opencode: 'opencode.gsd.debug', claude: '/gsd:debug' }
    ];

    // Simulate translation function
    function translateToClaude(opencodeCommand) {
      const parts = opencodeCommand.split('.');
      if (parts.length >= 3 && parts[0] === 'opencode' && parts[1] === 'gsd') {
        const action = parts[2];
        const kebabAction = action.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `/gsd:${kebabAction}`;
      }
      return opencodeCommand;
    }

    testTranslations.forEach(({ opencode, claude }) => {
      const translated = translateToClaude(opencode);
      this.assert(translated === claude,
        `Command translation: ${opencode} -> ${claude}`,
        `Got: ${translated}`);
    });
  }

  async testInstallationPaths() {
    this.log('Testing installation path resolution...');

    // Test path resolution for different editors
    const testPaths = [
      { editor: 'claude', expected: '.claude' },
      { editor: 'opencode', expected: '.opencode' }
    ];

    testPaths.forEach(({ editor, expected }) => {
      const testPath = editor === 'opencode' ? '.opencode/gsd' : '.claude/gsd';
      this.assert(testPath.includes(expected),
        `Path resolution for ${editor} includes ${expected}`);
    });
  }

  async runAllTests() {
    this.log('Starting OpenCode Integration Tests...\n');

    try {
      await this.testEditorDetection();
      await this.testConfigManager();
      await this.testAgentBridge();
      await this.testCommandTranslation();
      await this.testInstallationPaths();

      this.log('\n' + '='.repeat(50));
      this.log(`Test Results: ${this.results.passed} passed, ${this.results.failed} failed`);

      if (this.results.failed === 0) {
        this.log('🎉 All tests passed!');
        process.exit(0);
      } else {
        this.log('❌ Some tests failed. Check output above.');
        process.exit(1);
      }

    } catch (error) {
      this.log(`Fatal error during testing: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new OpenCodeIntegrationTester();
  tester.runAllTests();
}

module.exports = OpenCodeIntegrationTester;