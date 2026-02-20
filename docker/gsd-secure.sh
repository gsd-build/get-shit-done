#!/bin/bash

# Function to build and run GSD in Docker
function gsd-secure() {
    # [REPO VERSION] Uses the script's own directory as Docker context
    # This magic line gets the directory where the script is located
    local DOCKER_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    local IMAGE_NAME="gsd-sandbox"
    
    # Network Mode: "host" (default, full access) or "strict" (isolated with DNS fix)
    local NETWORK_MODE="host"
    
    # Parse arguments
    for arg in "$@"; do
        case $arg in
            --strict)
                NETWORK_MODE="strict"
                echo -e "\033[0;36m [Network] Strict mode enabled (isolated network + DNS fix)\033[0m"
                ;;
        esac
    done
    
    # 0. Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        echo -e "\033[0;31mERROR: Docker is not running!\033[0m"
        echo -e "\033[0;33mPlease start Docker Desktop or the Docker daemon.\033[0m"
        return 1
    fi

    # 1. Build Image (if missing)
    if [[ "$(docker images -q $IMAGE_NAME 2> /dev/null)" == "" ]]; then
        echo -e "\033[0;36mBuilding GSD Sandbox image... (First run only)\033[0m"
        # Use Repo Root as context to include 'agents/' folder
        # --no-cache ensures updates are always picked up
        docker build --no-cache -t $IMAGE_NAME -f "$DOCKER_DIR/Dockerfile" "$DOCKER_DIR/.."
    fi

    # 2. Get Context
    local GIT_NAME=$(git config --get user.name)
    if [ -z "$GIT_NAME" ]; then GIT_NAME="gsd-user"; fi
    
    local GIT_EMAIL=$(git config --get user.email)
    if [ -z "$GIT_EMAIL" ]; then GIT_EMAIL="gsd@local"; fi

    # Robust path resolution
    local CURRENT_DIR=$(pwd)
    
    # Universal Auth Mapping
    local MOUNT_ARGS=()
    
    # 1. Gemini
    local GEMINI_PATH="$HOME/.gemini"
    if [ -d "$GEMINI_PATH" ]; then
        MOUNT_ARGS+=("-v" "$GEMINI_PATH:/root/.gemini")
        echo -e "\033[0;90m [Auth] Gemini keys detected.\033[0m"
    fi

    # 2. Claude
    local CLAUDE_PATH="$HOME/.claude"
    if [ -d "$CLAUDE_PATH" ]; then
        MOUNT_ARGS+=("-v" "$CLAUDE_PATH:/root/.claude")
        echo -e "\033[0;90m [Auth] Claude keys detected.\033[0m"
    fi

    # 3. OpenCode
    if [ -d "$HOME/.config/opencode" ]; then
        MOUNT_ARGS+=("-v" "$HOME/.config/opencode:/root/.config/opencode")
        echo -e "\033[0;90m [Auth] OpenCode keys detected.\033[0m"
    fi

    # 4. Codex (for OpenCode's Codex auth)
    if [ -d "$HOME/.codex" ]; then
        MOUNT_ARGS+=("-v" "$HOME/.codex:/root/.codex")
        echo -e "\033[0;90m [Auth] Codex keys detected.\033[0m"
    fi

    # 5. Antigravity (for OpenCode's Antigravity auth)
    if [ -d "$HOME/.antigravity" ]; then
        MOUNT_ARGS+=("-v" "$HOME/.antigravity:/root/.antigravity")
        echo -e "\033[0;90m [Auth] Antigravity keys detected.\033[0m"
    fi

    # 6. OpenCode Cache & Local Share (Persistence)
    if [ -d "$HOME/.cache/opencode" ]; then
        MOUNT_ARGS+=("-v" "$HOME/.cache/opencode:/root/.cache/opencode")
    fi
    if [ -d "$HOME/.local/share/opencode" ]; then
        MOUNT_ARGS+=("-v" "$HOME/.local/share/opencode:/root/.local/share/opencode")
    fi



    echo -e "\033[0;32mEntering GSD Secure Sandbox...\033[0m"
    echo -e "\033[0;37m  Project: $CURRENT_DIR\033[0m"
    echo -e "\033[0;37m  Identity: $GIT_NAME <$GIT_EMAIL>\033[0m"

    # ==========================================
    # INTELLIGENT PORT MAPPING
    # Linux: --network host works
    # macOS: requires port mapping (like Windows)
    # ==========================================
    
    # Detect OS
    local OS_TYPE="linux"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS_TYPE="macos"
    elif [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* ]]; then
        OS_TYPE="windows_bash"
    fi
    
    # Default ports covering 99% of dev use cases
    # 1455: OpenCode/OpenAI Browser Auth
    local DEFAULT_PORTS=(1234 1455 3000 3001 4000 4173 4200 5000 5001 5173 5174 8000 8080 8081 8888 9000)
    
    # Auto-detect ports from project configuration
    detect_project_ports() {
        local project_path="$1"
        local detected=()
        
        # Check .env for PORT=
        if [ -f "$project_path/.env" ]; then
            local env_ports=$(grep -oE '(^|\s)[A-Z_]*PORT[A-Z_]*\s*=\s*[0-9]+' "$project_path/.env" | grep -oE '[0-9]+')
            for port in $env_ports; do
                detected+=("$port")
            done
        fi
        
        # Check package.json for --port in scripts
        if [ -f "$project_path/package.json" ]; then
            local pkg_ports=$(grep -oE '\-\-port[=\s]+[0-9]+' "$project_path/package.json" | grep -oE '[0-9]+')
            for port in $pkg_ports; do
                detected+=("$port")
            done
        fi
        
        # Check vite.config.ts/js for server.port
        for config in "vite.config.ts" "vite.config.js" "client/vite.config.ts" "client/vite.config.js"; do
            if [ -f "$project_path/$config" ]; then
                local vite_port=$(grep -oE 'port\s*:\s*[0-9]+' "$project_path/$config" | grep -oE '[0-9]+')
                if [ -n "$vite_port" ]; then
                    detected+=("$vite_port")
                fi
            fi
        done
        
        # Return unique sorted ports
        echo "${detected[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' '
    }
    
    # Run Container with appropriate network mode
    if [ "$NETWORK_MODE" = "strict" ]; then
        # Strict mode: isolated network with reliable DNS
        # Use host.docker.internal to access localhost services
        docker run --rm -it \
            --dns 8.8.8.8 \
            --dns 1.1.1.1 \
            -v "$CURRENT_DIR:/app" \
            -v "gsd-npm-cache:/root/.npm" \
            "${MOUNT_ARGS[@]}" \
            -e "GIT_AUTHOR_NAME=$GIT_NAME" \
            -e "GIT_AUTHOR_EMAIL=$GIT_EMAIL" \
            -e "GIT_COMMITTER_NAME=$GIT_NAME" \
            -e "GIT_COMMITTER_EMAIL=$GIT_EMAIL" \
            $IMAGE_NAME
    elif [ "$OS_TYPE" = "linux" ]; then
        # Linux: --network host works natively
        echo -e "\033[0;90m [Network] Using host network (Linux)\033[0m"
        docker run --rm -it \
            --network host \
            -v "$CURRENT_DIR:/app" \
            -v "gsd-npm-cache:/root/.npm" \
            "${MOUNT_ARGS[@]}" \
            -e "GIT_AUTHOR_NAME=$GIT_NAME" \
            -e "GIT_AUTHOR_EMAIL=$GIT_EMAIL" \
            -e "GIT_COMMITTER_NAME=$GIT_NAME" \
            -e "GIT_COMMITTER_EMAIL=$GIT_EMAIL" \
            $IMAGE_NAME
    else
        # macOS / Windows (Bash): requires port mapping
        local DETECTED_PORTS=$(detect_project_ports "$CURRENT_DIR")
        local ALL_PORTS=(${DEFAULT_PORTS[@]} ${DETECTED_PORTS[@]})
        # Remove duplicates
        ALL_PORTS=($(echo "${ALL_PORTS[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' '))
        
        # Build port arguments
        local PORT_ARGS=()
        for port in "${ALL_PORTS[@]}"; do
            PORT_ARGS+=("-p" "${port}:${port}")
        done
        
        if [ -n "$DETECTED_PORTS" ]; then
            echo -e "\033[0;90m [Ports] Auto-detected: $DETECTED_PORTS\033[0m"
        fi
        echo -e "\033[0;90m [Ports] Mapped: ${#ALL_PORTS[@]} ports ready (Intelligent Mapping Mode)\033[0m"
        
        docker run --rm -it \
            "${PORT_ARGS[@]}" \
            -v "$CURRENT_DIR:/app" \
            -v "gsd-npm-cache:/root/.npm" \
            "${MOUNT_ARGS[@]}" \
            -e "GIT_AUTHOR_NAME=$GIT_NAME" \
            -e "GIT_AUTHOR_EMAIL=$GIT_EMAIL" \
            -e "GIT_COMMITTER_NAME=$GIT_NAME" \
            -e "GIT_COMMITTER_EMAIL=$GIT_EMAIL" \
            $IMAGE_NAME
    fi
}

# Add alias for convenience
alias gsd-box=gsd-secure

echo -e "\033[0;32mGSD Sandbox loaded. Type 'gsd-secure' to launch.\033[0m"
