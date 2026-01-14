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
    // Parse the markdown content and extract the command logic
    const lines = content.split('\n');

    // Find the objective section
    let inObjective = false;
    let objective = '';

    for (const line of lines) {
      if (line.includes('<objective>')) {
        inObjective = true;
        continue;
      }
      if (line.includes('</objective>')) {
        inObjective = false;
        break;
      }
      if (inObjective) {
        objective += line + '\n';
      }
    }

    // For now, display the objective in the output channel
    // In a full implementation, this would integrate with OpenCode's agent system
    const outputChannel = vscode.window.createOutputChannel('GSD');
    outputChannel.show();
    outputChannel.appendLine(`Executing: ${objective.trim()}`);
    outputChannel.appendLine(`Args: ${JSON.stringify(args)}`);
    outputChannel.appendLine('---');
    outputChannel.appendLine('Note: Full GSD integration requires OpenCode agent bridge implementation');
    outputChannel.appendLine('This is a placeholder for the command execution logic.');
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