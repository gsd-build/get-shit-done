const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const VIBE_HOME = process.env.VIBE_HOME || path.join(os.homedir(), '.vibe');
const GSD_SRC = path.resolve(__dirname, '..');
const GSD_DEST = path.join(VIBE_HOME, 'get-shit-done');

// Directories to create
const DIRS = [
  path.join(VIBE_HOME, 'skills'),
  path.join(VIBE_HOME, 'agents'),
  path.join(VIBE_HOME, 'prompts'),
  GSD_DEST,
  path.join(GSD_DEST, 'bin'),
  path.join(GSD_DEST, 'workflows'),
  path.join(GSD_DEST, 'templates'),
  path.join(GSD_DEST, 'references'),
];

// Helper to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Setup Directories
function ensureDirectories() {
  console.log('Setting up directories...');
  DIRS.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created ${dir}`);
    }
  });
}

// 2. Copy Core Files
function copyCoreFiles() {
  console.log('Copying core GSD files...');
  copyDir(path.join(GSD_SRC, 'get-shit-done/bin'), path.join(GSD_DEST, 'bin'));
  copyDir(path.join(GSD_SRC, 'get-shit-done/templates'), path.join(GSD_DEST, 'templates'));
  copyDir(path.join(GSD_SRC, 'get-shit-done/references'), path.join(GSD_DEST, 'references'));

  // Make bin executable
  try {
    if (fs.existsSync(path.join(GSD_DEST, 'bin'))) {
      const binFiles = fs.readdirSync(path.join(GSD_DEST, 'bin'));
      binFiles.forEach(f => fs.chmodSync(path.join(GSD_DEST, 'bin', f), '755'));
    }
  } catch (e) {
    console.warn('Could not chmod bin files (expected on Windows).');
  }
}

// 3. Convert Commands to Skills
function convertCommandsToSkills() {
  console.log('Converting commands to skills...');
  const commandsDir = path.join(GSD_SRC, 'commands/gsd');
  if (fs.existsSync(commandsDir)) {
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.md'));

    files.forEach(file => {
      const content = fs.readFileSync(path.join(commandsDir, file), 'utf8');
      const slug = file.replace('.md', '');
      const skillName = `gsd-${slug}`;
      const skillDir = path.join(VIBE_HOME, 'skills', skillName);

      if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });

      // Transform content
      let newContent = content
        .replace(/~\/\.claude/g, '~/.vibe')
        .replace(/name: gsd:([\w-]+)/, `name: gsd-$1\nuser-invocable: true`)
        .replace(/Task\(prompt="(?<prompt>[\s\S]*?)", subagent_type="(?<agent>[\w-]+)",.*?\)/g, (match, prompt, agent) => {
          return `task(task="${prompt.replace(/"/g, '\\"')}", agent="${agent}")`;
        });

      // Fix allowed tools
      const toolMap = {
        'Read': 'read_file',
        'Write': 'write_file',
        'Bash': 'bash',
        'Glob': 'list_dir',
        'Grep': 'grep',
        'AskUserQuestion': 'ask_user_question',
        'Task': 'task'
      };

      newContent = newContent.replace(/allowed-tools:\s*\n((?:\s+-\s+\w+\n?)+)/, (match, toolsBlock) => {
        const tools = toolsBlock.split('\n')
          .map(t => t.trim().replace('- ', ''))
          .filter(t => t)
          .map(t => toolMap[t] || t)
          .map(t => `  - ${t}`)
          .join('\n');
        return `allowed-tools:\n${tools}\n`;
      });

      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), newContent);
      console.log(`Created skill: ${skillName}`);
    });
  }
}

// 4. Convert Agents
function convertAgents() {
  console.log('Converting agents...');
  const agentsDir = path.join(GSD_SRC, 'agents');
  if (fs.existsSync(agentsDir)) {
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md'));

    files.forEach(file => {
      const content = fs.readFileSync(path.join(agentsDir, file), 'utf8');
      const agentName = file.replace('.md', '');

      // 4.1 Write System Prompt
      const promptPath = path.join(VIBE_HOME, 'prompts', `${agentName}.md`);
      // Remove frontmatter for the prompt file
      const promptContent = content.replace(/^---\n[\s\S]+?\n---\n/, '');
      fs.writeFileSync(promptPath, promptContent);

      // 4.2 Write Agent TOML
      const tomlPath = path.join(VIBE_HOME, 'agents', `${agentName}.toml`);
      const tomlContent = `
system_prompt_id = "${agentName}"
active_model = "mistral-large-latest"
agent_type = "subagent"

[tools]
read_file.permission = "always"
write_file.permission = "always"
bash.permission = "always"
grep.permission = "always"
list_dir.permission = "always"
ask_user_question.permission = "always"
`;
      fs.writeFileSync(tomlPath, tomlContent.trim());
      console.log(`Created agent: ${agentName}`);
    });
  }
}


// 5. Patch Workflows
function patchWorkflows() {
  console.log('Patching workflows...');
  const workflowsSrc = path.join(GSD_SRC, 'get-shit-done/workflows');
  const workflowsDest = path.join(GSD_DEST, 'workflows');

  if (fs.existsSync(workflowsSrc)) {
    const files = fs.readdirSync(workflowsSrc).filter(f => f.endsWith('.md'));

    files.forEach(file => {
      let content = fs.readFileSync(path.join(workflowsSrc, file), 'utf8');

      // Patch paths
      content = content.replace(/~\/\.claude/g, '~/.vibe');

      // Patch Task calls
      content = content.replace(/Task\(\s*prompt\s*=\s*"([\s\S]*?)",\s*subagent_type\s*=\s*"([^"]+)"(?:,\s*model\s*=\s*"[^"]+")?\s*\)/g, (match, prompt, agent) => {
        return `task(task="${prompt}", agent="${agent}")`;
      });

      // Fix path to agent prompts (which are in prompts/ dir, not agents/ dir)
      content = content.replace(/~\/\.vibe\/agents\/([a-zA-Z0-9_-]+\.md)/g, '~/.vibe/prompts/$1');

      fs.writeFileSync(path.join(workflowsDest, file), content);
      console.log(`Patched workflow: ${file}`);
    });
  }
}

async function main() {
  console.log('Starting GSD Vibe installation...');

  ensureDirectories();
  copyCoreFiles();
  convertCommandsToSkills();
  convertAgents();
  patchWorkflows();

  console.log('Installation complete! Please restart Vibe CLI.');
}

main().catch(err => {
  console.error('Installation failed:', err);
  process.exit(1);
});
