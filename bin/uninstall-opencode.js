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

const gsdRoot = path.join(configDir, "get-shit-done")
const pluginPath = path.join(configDir, "plugin", "gsd.ts")
const toolPath = path.join(configDir, "tool", "gsd.ts")
const exploreAgentPath = path.join(configDir, "agent", "Explore.md")
const generalAgentPath = path.join(configDir, "agent", "general-purpose.md")
const configPathJson = path.join(configDir, "opencode.json")
const configPathJsonc = path.join(configDir, "opencode.jsonc")

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8")
}

function stripJsonComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
}

function loadConfig() {
  const configPath = fs.existsSync(configPathJsonc) ? configPathJsonc : configPathJson
  if (!fs.existsSync(configPath)) return null
  const raw = readText(configPath)
  try {
    const parsed = JSON.parse(stripJsonComments(raw))
    return { config: parsed, configPath }
  } catch (err) {
    console.warn(`Warning: Failed to parse ${configPath}. Skipping command cleanup.`)
    return null
  }
}

if (fs.existsSync(gsdRoot)) {
  fs.rmSync(gsdRoot, { recursive: true, force: true })
}
if (fs.existsSync(pluginPath)) {
  fs.rmSync(pluginPath, { force: true })
}
if (fs.existsSync(toolPath)) {
  fs.rmSync(toolPath, { force: true })
}
if (fs.existsSync(exploreAgentPath)) {
  fs.rmSync(exploreAgentPath, { force: true })
}
if (fs.existsSync(generalAgentPath)) {
  fs.rmSync(generalAgentPath, { force: true })
}

const loaded = loadConfig()
if (loaded) {
  const { config, configPath } = loaded
  if (config.command) {
    for (const key of Object.keys(config.command)) {
      if (key.startsWith("gsd:")) delete config.command[key]
    }
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  console.log(`Removed GSD commands from ${configPath}`)
}

console.log(`Removed GSD OpenCode plugin from ${configDir}`)
