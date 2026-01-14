// GSD OpenCode Extension
// Main entry point for the OpenCode extension

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/**
 * Command Translator
 * Converts OpenCode commands to Claude-style slash commands
 */
class CommandTranslator {
  static toClaudeCommand(opencodeCommand) {
    // opencode.gsd.newProject -> /gsd:new-project
    const parts = opencodeCommand.split('.');
    if (parts.length >= 3 && parts[0] === 'opencode' && parts[1] === 'gsd') {
      const action = parts[2];
      // Convert camelCase to kebab-case
      const kebabAction = action.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `/gsd:${kebabAction}`;
    }
    return opencodeCommand;
  }

  static extractArgs(opencodeCommand, args) {
    // For commands that need arguments, pass them through
    return args || [];
  }
}

/**
 * GSD Command Handler
 */
class GSDCommandHandler {
  constructor(context) {
    this.context = context;
    this.gsdPath = null;
    this.detectGSDPath();
  }

  detectGSDPath() {
    // Find the GSD installation path
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
      // Check for local .opencode/gsd
      const localPath = path.join(workspaceFolders[0].uri.fsPath, '.opencode', 'gsd');
      if (fs.existsSync(localPath)) {
        this.gsdPath = localPath;
        return;
      }
    }

    // Check for global ~/.opencode/gsd
    const globalPath = path.join(os.homedir(), '.opencode', 'gsd');
    if (fs.existsSync(globalPath)) {
      this.gsdPath = globalPath;
      return;
    }

    // Fallback: assume commands are in the same directory as this extension
    this.gsdPath = path.join(this.context.extensionPath, '..', 'gsd');
  }

  async executeCommand(commandId, ...args) {
    const claudeCommand = CommandTranslator.toClaudeCommand(commandId);
    const commandArgs = CommandTranslator.extractArgs(commandId, args);

    // Find the corresponding .md file
    const commandFile = this.findCommandFile(claudeCommand);
    if (!commandFile) {
      vscode.window.showErrorMessage(`GSD command not found: ${claudeCommand}`);
      return;
    }

    // Read and execute the command
    try {
      const content = fs.readFileSync(commandFile, 'utf8');
      await this.processCommand(content, commandArgs);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to execute GSD command: ${error.message}`);
    }
  }

  findCommandFile(claudeCommand) {
    // Extract command name from /gsd:command
    const commandName = claudeCommand.slice(5); // Remove /gsd:
    const fileName = `${commandName}.md`;

    const filePath = path.join(this.gsdPath, fileName);
    if (fs.existsSync(filePath)) {
      return filePath;
    }

    return null;
  }

  async processCommand(content, args) {
    const outputChannel = vscode.window.createOutputChannel('GSD');
    outputChannel.show();
    outputChannel.clear();

    outputChannel.appendLine('🚀 GSD Command Execution');
    outputChannel.appendLine('========================');
    outputChannel.appendLine('');

    // Parse command name from content
    const lines = content.split('\n');
    let commandName = 'unknown';
    for (const line of lines) {
      if (line.startsWith('name: gsd:')) {
        commandName = line.split('gsd:')[1].trim();
        break;
      }
    }

    outputChannel.appendLine(`Command: /gsd:${commandName}`);
    outputChannel.appendLine(`Arguments: ${args.join(' ') || 'none'}`);
    outputChannel.appendLine('');

    // Check if this command requires agent execution
    const requiresAgents = this.commandRequiresAgents(commandName);

    if (requiresAgents) {
      outputChannel.appendLine('⚠️  AGENT EXECUTION REQUIRED');
      outputChannel.appendLine('─────────────────────────────');
      outputChannel.appendLine('');
      outputChannel.appendLine('This GSD command requires spawning AI agents to execute complex workflows.');
      outputChannel.appendLine('The current OpenCode integration does not yet support full agent execution.');
      outputChannel.appendLine('');
      outputChannel.appendLine('🔄 WORKAROUNDS:');
      outputChannel.appendLine('• Use Claude Code for agent-based commands');
      outputChannel.appendLine('• Manual execution of the workflow steps');
      outputChannel.appendLine('• Check the command documentation for manual steps');
      outputChannel.appendLine('');

      // Show command documentation
      this.showCommandDocumentation(content, outputChannel);
    } else {
      outputChannel.appendLine('✅ BASIC COMMAND EXECUTION');
      outputChannel.appendLine('──────────────────────────');
      outputChannel.appendLine('');
      outputChannel.appendLine('This command can be executed manually. See documentation below:');
      outputChannel.appendLine('');

      this.showCommandDocumentation(content, outputChannel);
    }

    outputChannel.appendLine('');
    outputChannel.appendLine('💡 For full GSD functionality, use Claude Code');
    outputChannel.appendLine('   The OpenCode integration is currently in development.');
  }

  commandRequiresAgents(commandName) {
    // Commands that require spawning AI agents/subagents
    const agentCommands = [
      'map-codebase',     // Spawns Explore agents
      'execute-plan',     // Spawns general-purpose agents
      'execute-phase',    // Spawns multiple agents in parallel
      'plan-phase',       // May spawn research agents
      'research-phase',   // Spawns research agents
      'debug'             // Spawns debugging agents
    ];

    return agentCommands.includes(commandName);
  }

  showCommandDocumentation(content, outputChannel) {
    const lines = content.split('\n');
    let inObjective = false;
    let inProcess = false;
    let objective = '';
    let process = '';

    for (const line of lines) {
      if (line.includes('<objective>')) {
        inObjective = true;
        continue;
      }
      if (line.includes('</objective>')) {
        inObjective = false;
        continue;
      }
      if (inObjective && !line.includes('<objective>')) {
        objective += line + '\n';
      }

      if (line.includes('<process>')) {
        inProcess = true;
        continue;
      }
      if (line.includes('</process>')) {
        inProcess = false;
        continue;
      }
      if (inProcess && !line.includes('<process>')) {
        process += line + '\n';
      }
    }

    if (objective.trim()) {
      outputChannel.appendLine('🎯 OBJECTIVE:');
      outputChannel.appendLine(objective.trim());
      outputChannel.appendLine('');
    }

    if (process.trim()) {
      outputChannel.appendLine('📋 MANUAL EXECUTION STEPS:');
      outputChannel.appendLine(process.trim());
    }
  }
}

/**
 * Activate the extension
 */
function activate(context) {
  console.log('GSD for OpenCode is now active!');

  const handler = new GSDCommandHandler(context);

  // Register all GSD commands
  const commands = [
    'opencode.gsd.help',
    'opencode.gsd.newProject',
    'opencode.gsd.createRoadmap',
    'opencode.gsd.mapCodebase',
    'opencode.gsd.discussPhase',
    'opencode.gsd.researchPhase',
    'opencode.gsd.listPhaseAssumptions',
    'opencode.gsd.planPhase',
    'opencode.gsd.executePlan',
    'opencode.gsd.executePhase',
    'opencode.gsd.status',
    'opencode.gsd.addPhase',
    'opencode.gsd.insertPhase',
    'opencode.gsd.removePhase',
    'opencode.gsd.discussMilestone',
    'opencode.gsd.newMilestone',
    'opencode.gsd.completeMilestone',
    'opencode.gsd.progress',
    'opencode.gsd.resumeWork',
    'opencode.gsd.pauseWork',
    'opencode.gsd.considerIssues',
    'opencode.gsd.debug',
    'opencode.gsd.addTodo',
    'opencode.gsd.checkTodos',
    'opencode.gsd.planFix',
    'opencode.gsd.verifyWork'
  ];

  commands.forEach(command => {
    const disposable = vscode.commands.registerCommand(command, (...args) => {
      return handler.executeCommand(command, ...args);
    });
    context.subscriptions.push(disposable);
  });

  // Show welcome message
  vscode.window.showInformationMessage(
    'GSD for OpenCode loaded! Use Ctrl+Shift+G Ctrl+Shift+H for help.'
  );
}

/**
 * Deactivate the extension
 */
function deactivate() {
  console.log('GSD for OpenCode deactivated');
}

module.exports = {
  activate,
  deactivate
};