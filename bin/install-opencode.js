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
const configPathJson = path.join(configDir, "opencode.json")
const configPathJsonc = path.join(configDir, "opencode.jsonc")

const pluginSource = path.join(repoRoot, ".opencode", "plugin", "gsd.ts")
const toolSource = path.join(repoRoot, ".opencode", "tool", "gsd.ts")
const commandsSource = path.join(repoRoot, "commands", "gsd")
const templatesSource = path.join(repoRoot, "get-shit-done")

fs.mkdirSync(pluginDir, { recursive: true })
fs.mkdirSync(toolDir, { recursive: true })
fs.mkdirSync(path.join(gsdRoot, "commands"), { recursive: true })

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
    return { config: { "$schema": "https://opencode.ai/config.json" }, configPath }
  }
  const raw = readText(configPath)
  const parsed = JSON.parse(stripJsonComments(raw))
  return { config: parsed, configPath }
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

const { config, configPath } = loadConfig()
const gsdCommands = buildCommandMap()
config.command = { ...(config.command || {}), ...gsdCommands }
fs.mkdirSync(configDir, { recursive: true })
fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

console.log(`Installed GSD OpenCode plugin to ${configDir}`)
console.log(`Registered ${Object.keys(gsdCommands).length} commands in ${configPath}`)
