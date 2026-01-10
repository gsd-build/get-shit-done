import { readFileSync, readdirSync, existsSync } from "node:fs"
import path from "node:path"

const configDir = path.resolve(import.meta.dir, "..")
const gsdRoot = path.join(configDir, "get-shit-done")
const commandsDir = path.join(gsdRoot, "commands", "gsd")

function readText(filePath: string) {
  return readFileSync(filePath, "utf8")
}

function parseFrontMatterName(content: string) {
  if (!content.startsWith("---\n")) return null
  const end = content.indexOf("\n---", 4)
  if (end === -1) return null
  const frontMatter = content.slice(4, end).split("\n")
  for (const line of frontMatter) {
    const match = line.match(/^name:\s*(.+)$/)
    if (match) return match[1].trim()
  }
  return null
}

function listCommandFiles() {
  if (!existsSync(commandsDir)) return []
  return readdirSync(commandsDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => path.join(commandsDir, file))
}

function loadCommandsIndex() {
  const index = new Map<string, { name: string; filePath: string }>()
  for (const filePath of listCommandFiles()) {
    const content = readText(filePath)
    const frontmatterName = parseFrontMatterName(content)
    const fileName = path.basename(filePath, ".md")
    const name = frontmatterName || fileName
    const entry = { name, filePath }
    index.set(name, entry)
    if (name.startsWith("gsd:")) {
      index.set(name.slice("gsd:".length), entry)
    } else {
      index.set(`gsd:${name}`, entry)
    }
  }
  return index
}

function normalizeCommandName(input: string) {
  if (input.startsWith("gsd:")) return input
  return `gsd:${input}`
}

function loadReferences(content: string) {
  const references: Record<string, string> = {}
  const missing: string[] = []
  const regex = /@~\/\.claude\/get-shit-done\/([^\s]+)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(content))) {
    const relPath = match[1]
    const sourcePath = path.join(gsdRoot, relPath)
    const key = `get-shit-done/${relPath}`
    if (references[key]) continue
    try {
      references[key] = readText(sourcePath)
    } catch {
      missing.push(key)
    }
  }

  return { references, missing }
}

function buildInjectedPrompt(command: string, argsText: string) {
  const { references, missing } = loadReferences(command)
  const referenceBlocks = Object.entries(references).map(([key, value]) => {
    return `## Reference: ${key}\n\n\`\`\`md\n${value}\n\`\`\``
  })
  const missingBlock = missing.length
    ? `## Missing References\n- ${missing.join("\n- ")}`
    : ""

  return [
    "You are running a GSD command. Follow the instructions exactly.",
    `Command arguments: ${argsText || "(none)"}`,
    "",
    command.trim(),
    "",
    referenceBlocks.join("\n\n"),
    missingBlock,
  ]
    .filter(Boolean)
    .join("\n")
}

function isGsdInvocation(text: string) {
  return text.trim().startsWith("/gsd:")
}

function parseInvocation(text: string) {
  const trimmed = text.trim()
  const [commandPart, ...rest] = trimmed.split(/\s+/)
  const name = commandPart.replace(/^\/?/, "").slice(0)
  return { name, argsText: rest.join(" ") }
}

function buildCommandPayload(
  commandName: string,
  argsText: string,
  entry: { name: string; filePath: string } | undefined,
  worktree: string,
) {
  if (!entry) {
    return `Unknown GSD command: ${commandName}`
  }

  const commandContent = readText(entry.filePath)
  const injected = buildInjectedPrompt(commandContent, argsText)
  const planningContext = resolvePlanningContext(worktree)
  const contextBlock = planningContext.length
    ? `## GSD Planning Context\n\n${planningContext.join("\n\n")}`
    : ""

  return [injected, contextBlock].filter(Boolean).join("\n\n")
}

function resolvePlanningContext(worktree: string) {
  const planningDir = path.join(worktree, ".planning")
  const candidates = [
    "PROJECT.md",
    "ROADMAP.md",
    "STATE.md",
    "PLAN.md",
    "SUMMARY.md",
    "ISSUES.md",
  ]

  const contextBlocks = []
  for (const file of candidates) {
    const fullPath = path.join(planningDir, file)
    if (!existsSync(fullPath)) continue
    const content = readText(fullPath)
    contextBlocks.push(`## ${file}\n\n\`\`\`md\n${content}\n\`\`\``)
  }

  return contextBlocks
}

function parseTuiCommand(command: string) {
  const trimmed = command.trim()
  if (!trimmed.startsWith("gsd")) return null
  if (trimmed === "gsd") return "help"
  if (trimmed.startsWith("gsd:")) return trimmed.slice("gsd:".length)
  if (trimmed.startsWith("gsd ")) return trimmed.slice("gsd ".length)
  return null
}

export const GsdPlugin = async ({ worktree, client }) => {
  const commandsIndex = loadCommandsIndex()

  return {
    event: async ({ event }) => {
      if (event.type !== "tui.command.execute") return
      const commandText = parseTuiCommand(event.properties.command)
      if (!commandText) return

      const slashCommand = `/gsd:${commandText.trim()}`
      await client.tui.clearPrompt()
      await client.tui.appendPrompt({ body: { text: slashCommand } })
      await client.tui.submitPrompt()
    },

    "chat.message": async (_input, output) => {
      const textPart = output.parts.find((part) => part.type === "text")
      if (!textPart || !isGsdInvocation(textPart.text)) return

      const { name, argsText } = parseInvocation(textPart.text)
      const commandName = normalizeCommandName(name.replace("/gsd:", "gsd:"))
      const entry = commandsIndex.get(commandName)
      textPart.text = buildCommandPayload(commandName, argsText, entry, worktree)
      textPart.synthetic = true
    },

    "experimental.chat.messages.transform": async (_input, output) => {
      for (const message of output.messages) {
        if (message.info.role !== "user") continue
        const textPart = message.parts.find((part) => part.type === "text")
        if (!textPart || !isGsdInvocation(textPart.text)) continue

        const { name, argsText } = parseInvocation(textPart.text)
        const commandName = normalizeCommandName(name.replace("/gsd:", "gsd:"))
        const entry = commandsIndex.get(commandName)
        textPart.text = buildCommandPayload(commandName, argsText, entry, worktree)
        textPart.synthetic = true
      }
    },

    "experimental.session.compacting": async (_input, output) => {
      const contextBlocks = resolvePlanningContext(worktree)
      if (contextBlocks.length) {
        output.context.push(`## GSD Planning Context\n\n${contextBlocks.join("\n\n")}`)
      }
    },
  }
}
