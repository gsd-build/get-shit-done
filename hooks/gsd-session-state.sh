#!/usr/bin/env bash
# gsd-hook-version: {{GSD_VERSION}}
# gsd-session-state.sh — SessionStart hook: inject project state reminder
# Outputs STATE.md head on every session start for orientation.
#
# OPT-IN: This hook is a no-op unless config.json has hooks.community: true.
# Enable with: "hooks": { "community": true } in .planning/config.json

# Check opt-in config — exit silently if not enabled
if [ -f .planning/config.json ]; then
  ENABLED=$(node -e "try{const c=require('./.planning/config.json');process.stdout.write(c.hooks?.community===true?'1':'0')}catch{process.stdout.write('0')}" 2>/dev/null)
  if [ "$ENABLED" != "1" ]; then exit 0; fi
else
  exit 0
fi

# Build the additionalContext text and emit it as a structured JSON
# envelope per the Claude Code SessionStart hook protocol (#2974). Tests
# parse the JSON and assert on typed fields (state_present: bool,
# config_mode: string, etc) rather than substring-matching free-form text.
STATE_PRESENT="false"
STATE_HEAD=""
if [ -f .planning/STATE.md ]; then
  STATE_PRESENT="true"
  STATE_HEAD=$(head -20 .planning/STATE.md)
fi

CONFIG_MODE="unknown"
if [ -f .planning/config.json ]; then
  CONFIG_MODE=$(node -e "try{const c=require('./.planning/config.json');process.stdout.write(String(c.mode||'unknown'))}catch{process.stdout.write('unknown')}" 2>/dev/null)
fi

# Use Node for JSON encoding so embedded newlines/quotes are escaped correctly.
# additionalContext is the text Claude Code injects at session start; the
# typed fields (state_present, config_mode) let tests assert on the
# structured contract without grepping the prose.
node -e '
  const [statePresent, stateHead, configMode] = process.argv.slice(1);
  const headerLines = ["## Project State Reminder", ""];
  if (statePresent === "true") {
    headerLines.push("STATE.md exists - check for blockers and current phase.");
    if (stateHead) headerLines.push(stateHead);
  } else {
    headerLines.push("No .planning/ found - suggest /gsd-new-project if starting new work.");
  }
  headerLines.push("");
  headerLines.push("Config: \"mode\": \"" + configMode + "\"");
  const additionalContext = headerLines.join("\n");
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext,
      state_present: statePresent === "true",
      config_mode: configMode,
    },
  }));
' "$STATE_PRESENT" "$STATE_HEAD" "$CONFIG_MODE"

exit 0
