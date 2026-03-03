#!/bin/bash
set -e

# Auto-Stack Logic (STACK.md can be in multiple locations)
# Priority: root > .planning/research/
if [ -f "/app/STACK.md" ]; then
    STACK_FILE="/app/STACK.md"
elif [ -f "/app/.planning/research/STACK.md" ]; then
    STACK_FILE="/app/.planning/research/STACK.md"
else
    STACK_FILE=""
fi

# Helper function to extract code blocks
extract_block() {
    local file="$1"
    local lang="$2"
    if [ -f "$file" ]; then
        # Sed magic: find lines between ```lang and ```, then remove the markers
        sed -n "/^\`\`\`$lang\r\?$/,/^\`\`\`\r\?$/ p" "$file" | sed '1d;$d'
    fi
}

echo -e "\033[0;35m[GSD-AutoStack] Checking for User CLI preferences...\033[0m"
CLI_PACKAGES=""

# 1. Detect Gemini Preference (Folder mounted at /root/.gemini)
if [ -d "/root/.gemini" ]; then
    echo -e "\033[0;36m  Detected ~/.gemini -> Installing @google/gemini-cli\033[0m"
    CLI_PACKAGES="$CLI_PACKAGES @google/gemini-cli"
fi

# 2. Detect Claude Preference (Folder mounted at /root/.claude)
if [ -d "/root/.claude" ]; then
    echo -e "\033[0;36m  Detected ~/.claude -> Installing @anthropic-ai/claude-code\033[0m"
    CLI_PACKAGES="$CLI_PACKAGES @anthropic-ai/claude-code"
fi

# 3. Detect OpenCode Preference (Folder mounted at /root/.config/opencode)
if [ -d "/root/.config/opencode" ]; then
    echo -e "\033[0;36m  Detected ~/.config/opencode -> Installing opencode-ai\033[0m"
    CLI_PACKAGES="$CLI_PACKAGES opencode-ai"
fi

if [ -n "$CLI_PACKAGES" ]; then
    echo -e "\033[0;35m[GSD-AutoStack] Installing preferred CLIs...\033[0m"
    npm install -g --silent $CLI_PACKAGES
fi

if [ -n "$STACK_FILE" ]; then
    echo -e "\033[0;35m[GSD-AutoStack] Found: $STACK_FILE\033[0m"

    # 1. System Dependencies (APT)
    # Block type: ```gsd-stack
    APT_PACKAGES=$(extract_block "$STACK_FILE" "gsd-stack" | tr '\n' ' ')
    
    if [ -n "$APT_PACKAGES" ]; then
        echo -e "\033[0;35m[GSD-AutoStack] Installing APT packages: $APT_PACKAGES\033[0m"
        apt-get update -qq >/dev/null 2>&1
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq $APT_PACKAGES >/dev/null 2>&1
        echo -e "\033[0;32m[GSD-AutoStack] APT Installation complete.\033[0m"
    fi

    # 2. Node Dependencies (NPM)
    # Block type: ```gsd-npm
    NPM_PACKAGES=$(extract_block "$STACK_FILE" "gsd-npm" | tr '\n' ' ')
    
    if [ -n "$NPM_PACKAGES" ]; then
         echo -e "\033[0;35m[GSD-AutoStack] Installing NPM packages: $NPM_PACKAGES\033[0m"
         npm install -g $NPM_PACKAGES >/dev/null 2>&1
         echo -e "\033[0;32m[GSD-AutoStack] NPM Installation complete.\033[0m"
    fi
else
    echo -e "\033[0;33m[GSD-AutoStack] STACK.md not found. Skipping auto-installation.\033[0m"
fi

# Execute the CMD (usually /bin/bash)
exec "$@"
