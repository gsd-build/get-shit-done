#!/usr/bin/env node
const fs = require("fs")
const path = require("path")
const os = require("os")

const args = process.argv.slice(2)
const configArgIndex = args.findIndex((arg) => arg === "--config-dir")
const explicitConfigDir =
  configArgIndex === -1 ? null : args[configArgIndex + 1]

const configDir =
  explicitConfigDir ||
  process.env.OPENCODE_CONFIG_DIR ||
  path.join(os.homedir(), ".config", "opencode")

const repoRoot = path.resolve(__dirname, "..")
const gsdRoot = path.join(configDir, "get-shit-done")
const pluginDir = path.join(configDir, "plugin")
const toolDir = path.join(configDir, "tool")
const agentDir = path.join(configDir, "agent")
const configPathJson = path.join(configDir, "opencode.json")
const configPathJsonc = path.join(configDir, "opencode.jsonc")

const pluginSource = path.join(repoRoot, ".opencode", "plugin", "gsd.ts")
const toolSource = path.join(repoRoot, ".opencode", "tool", "gsd.ts")
const commandsSource = path.join(repoRoot, "commands", "gsd")
const templatesSource = path.join(repoRoot, "get-shit-done")

fs.mkdirSync(pluginDir, { recursive: true })
fs.mkdirSync(toolDir, { recursive: true })
fs.mkdirSync(path.join(gsdRoot, "commands"), { recursive: true })
fs.mkdirSync(agentDir, { recursive: true })

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8")
}

function parseFrontMatter(content) {
  if (!content.startsWith("---\n")) return {}
  const end = content.indexOf("\n---", 4)
  if (end === -1) return {}
  const frontMatter = content.slice(4, end).split("\n")
  const result = {}
  for (const line of frontMatter) {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/)
    if (match) result[match[1]] = match[2].trim()
  }
  return result
}

function stripFrontMatter(content) {
  if (!content.startsWith("---\n")) return content
  const end = content.indexOf("\n---", 4)
  if (end === -1) return content
  return content.slice(end + 4).trim()
}

function rewriteReferences(content) {
  return content.replace(
    /@~\/\.claude\/get-shit-done\//g,
    "@~/.config/opencode/get-shit-done/",
  )
}

function stripJsonComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
}

function loadConfig() {
  const configPath = fs.existsSync(configPathJsonc) ? configPathJsonc : configPathJson
  if (!fs.existsSync(configPath)) {
    return { config: { "$schema": "https://opencode.ai/config.json" }, configPath, raw: null, parseError: null }
  }
  const raw = readText(configPath)
  try {
    const parsed = JSON.parse(stripJsonComments(raw))
    return { config: parsed, configPath, raw, parseError: null }
  } catch (err) {
    return { config: null, configPath, raw, parseError: err }
  }
}

function buildCommandMap() {
  const entries = fs.readdirSync(commandsSource).filter((file) => file.endsWith(".md"))
  const map = {}
  for (const file of entries) {
    const content = readText(path.join(commandsSource, file))
    const fm = parseFrontMatter(content)
    if (!fm.name || !fm.name.startsWith("gsd:")) continue
    const body = rewriteReferences(stripFrontMatter(content))
    const template = [
      `Command arguments: $ARGUMENTS`,
      "",
      body,
    ].join("\n")
    map[fm.name] = {
      template,
      description: fm.description || "GSD command",
    }
  }
  return map
}

fs.cpSync(pluginSource, path.join(pluginDir, "gsd.ts"), {
  recursive: false,
  force: true,
})
fs.cpSync(toolSource, path.join(toolDir, "gsd.ts"), {
  recursive: false,
  force: true,
})
fs.cpSync(templatesSource, gsdRoot, { recursive: true, force: true })
fs.cpSync(commandsSource, path.join(gsdRoot, "commands", "gsd"), {
  recursive: true,
  force: true,
})

const exploreAgent = `---
description: Codebase exploration agent for GSD
mode: subagent
permission:
  read: allow
  list: allow
  glob: allow
  grep: allow
  bash: allow
  edit: deny
---

Explore the codebase and report findings. Do not edit files.
`

const generalAgent = `---
description: General-purpose GSD execution agent
mode: subagent
permission:
  read: allow
  list: allow
  glob: allow
  grep: allow
  bash: allow
  edit: allow
---

Execute assigned tasks and report results clearly.
`

fs.writeFileSync(path.join(agentDir, "Explore.md"), exploreAgent)
fs.writeFileSync(path.join(agentDir, "general-purpose.md"), generalAgent)

const { config, configPath, raw, parseError } = loadConfig()
const gsdCommands = buildCommandMap()
const finalConfig = config || { "$schema": "https://opencode.ai/config.json" }
finalConfig.command = { ...(finalConfig.command || {}), ...gsdCommands }
fs.mkdirSync(configDir, { recursive: true })

if (!config && raw && parseError) {
  const backupPath = `${configPath}.bak.${Date.now()}`
  fs.writeFileSync(backupPath, raw)
  console.warn(`Warning: Failed to parse ${configPath}. Backed up to ${backupPath}.`)
}

fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2))

console.log(`Installed GSD OpenCode plugin to ${configDir}`)
console.log(`Registered ${Object.keys(gsdCommands).length} commands in ${configPath}`)
