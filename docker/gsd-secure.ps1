# Function to build and run GSD in Docker

function gsd-secure {
    param(
        [switch]$Strict  # Use isolated network + DNS fix for extra security
    )
    
    # [REPO VERSION] Uses the script's own directory as Docker context
    $DockerDir = $PSScriptRoot
    $ImageName = "gsd-sandbox"
    
    # 0. Check if Docker is running
    $DockerStatus = docker info 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Docker is not running!" -ForegroundColor Red
        Write-Host "Please open 'Docker Desktop' and wait for the whale icon to stop moving." -ForegroundColor Yellow
        return
    }

    # 1. Build Image (if missing)
    if (-not (docker images -q $ImageName)) {
        Write-Host "Building GSD Sandbox image... (First run only)" -ForegroundColor Cyan
        # Build with --no-cache to ensure updates are picked up
        docker build --no-cache -t $ImageName -f "$PSScriptRoot\Dockerfile" "$PSScriptRoot\.."
    }

    # 2. Get Context
    $GitName = git config --get user.name
    if (-not $GitName) { $GitName = "gsd-user" }
    
    $GitEmail = git config --get user.email
    if (-not $GitEmail) { $GitEmail = "gsd@local" }

    # Robust path resolution
    $CurrentDir = (Get-Location).Path
    
    # Universal Auth Mapping
    $MountArgs = @()
    
    # 1. Gemini
    $GeminiPath = "$HOME\.gemini".Replace('\', '/')
    if (Test-Path $GeminiPath) {
        $MountArgs += "-v"
        $MountArgs += "${GeminiPath}:/root/.gemini"
        Write-Host " [Auth] Gemini keys detected." -ForegroundColor DarkGray
    }

    # 2. Claude
    $ClaudePath = "$HOME\.claude".Replace('\', '/')
    if (Test-Path $ClaudePath) {
        $MountArgs += "-v"
        $MountArgs += "${ClaudePath}:/root/.claude"
        Write-Host " [Auth] Claude keys detected." -ForegroundColor DarkGray
    }

    # 3. OpenCode
    $OpenCodePath = "$HOME\.config\opencode".Replace('\', '/')
    if (Test-Path $OpenCodePath) {
        $MountArgs += "-v"
        $MountArgs += "${OpenCodePath}:/root/.config/opencode"
        Write-Host " [Auth] OpenCode keys detected." -ForegroundColor DarkGray
    }

    # 4. Codex (for OpenCode's Codex auth)
    $CodexPath = "$HOME\.codex".Replace('\', '/')
    if (Test-Path $CodexPath) {
        $MountArgs += "-v"
        $MountArgs += "${CodexPath}:/root/.codex"
        Write-Host " [Auth] Codex keys detected." -ForegroundColor DarkGray
    }

    # 5. Antigravity (for OpenCode's Antigravity auth)
    $AntigravityPath = "$HOME\.antigravity".Replace('\', '/')
    if (Test-Path $AntigravityPath) {
        $MountArgs += "-v"
        $MountArgs += "${AntigravityPath}:/root/.antigravity"
        Write-Host " [Auth] Antigravity keys detected." -ForegroundColor DarkGray
    }

    # 6. OpenCode Cache & Local Share (Persistence)
    $CachePath = "$HOME\.cache\opencode".Replace('\', '/')
    if (Test-Path $CachePath) {
        $MountArgs += "-v"
        $MountArgs += "${CachePath}:/root/.cache/opencode"
    }
    $LocalSharePath = "$HOME\.local\share\opencode".Replace('\', '/')
    if (Test-Path $LocalSharePath) {
        $MountArgs += "-v"
        $MountArgs += "${LocalSharePath}:/root/.local/share/opencode"
    }



    Write-Host "Entering GSD Secure Sandbox..." -ForegroundColor Green
    Write-Host "  Project: $CurrentDir" -ForegroundColor Gray
    Write-Host "  Identity: $GitName <$GitEmail>" -ForegroundColor Gray

    # ==========================================
    # INTELLIGENT PORT MAPPING
    # Windows/macOS don't support --network host
    # We use default ports + auto-detection
    # ==========================================
    
    # Default ports covering 99% of dev use cases
    $DefaultPorts = @(
        1234,                 # Parcel
        1455,                 # OpenCode/OpenAI Browser Auth
        3000, 3001,           # Express, Next.js, React, Rails
        4000,                 # GraphQL, NestJS, Phoenix
        4173,                 # Vite preview
        4200,                 # Angular CLI
        5000, 5001,           # .NET, Flask
        5173, 5174,           # Vite dev
        8000, 8080, 8081,     # Django, Spring, Metro (React Native)
        8888,                 # Jupyter Notebook
        9000                  # PHP-FPM, SonarQube
    )
    
    # Auto-detect ports from project configuration
    function Detect-ProjectPorts {
        param([string]$ProjectPath)
        
        $detected = @()
        
        # Check .env for PORT=
        $envFile = Join-Path $ProjectPath ".env"
        if (Test-Path $envFile) {
            $content = Get-Content $envFile -Raw
            if ($content -match 'PORT=(\d+)') {
                $detected += [int]$matches[1]
            }
            # Also check for VITE_PORT, API_PORT, etc.
            $portMatches = [regex]::Matches($content, '(?:^|\s)(\w*PORT\w*)\s*=\s*(\d+)', 'Multiline')
            foreach ($match in $portMatches) {
                $detected += [int]$match.Groups[2].Value
            }
        }
        
        # Check package.json for --port in scripts
        $packageJson = Join-Path $ProjectPath "package.json"
        if (Test-Path $packageJson) {
            $content = Get-Content $packageJson -Raw
            $portMatches = [regex]::Matches($content, '--port[=\s]+(\d+)')
            foreach ($match in $portMatches) {
                $detected += [int]$match.Groups[1].Value
            }
        }
        
        # Check vite.config.ts/js for server.port
        $viteConfigs = @("vite.config.ts", "vite.config.js", "client/vite.config.ts", "client/vite.config.js")
        foreach ($configFile in $viteConfigs) {
            $configPath = Join-Path $ProjectPath $configFile
            if (Test-Path $configPath) {
                $content = Get-Content $configPath -Raw
                if ($content -match 'port\s*:\s*(\d+)') {
                    $detected += [int]$matches[1]
                }
            }
        }
        
        return $detected | Sort-Object -Unique
    }
    
    # Combine default + detected ports
    $DetectedPorts = Detect-ProjectPorts -ProjectPath $CurrentDir
    $AllPorts = ($DefaultPorts + $DetectedPorts) | Sort-Object -Unique
    
    # Build port mapping arguments
    $PortArgs = @()
    foreach ($port in $AllPorts) {
        $PortArgs += "-p"
        $PortArgs += "${port}:${port}"
    }
    
    if ($DetectedPorts.Count -gt 0) {
        Write-Host " [Ports] Auto-detected: $($DetectedPorts -join ', ')" -ForegroundColor DarkGray
    }
    Write-Host " [Ports] Mapped: $($AllPorts.Count) ports ready" -ForegroundColor DarkGray

    # Run Container with appropriate network mode
    if ($Strict) {
        # Strict mode: isolated network with reliable DNS
        # Use host.docker.internal to access localhost services
        Write-Host " [Network] Strict mode enabled (isolated network + DNS fix)" -ForegroundColor Cyan
        docker run --rm -it `
            --dns 8.8.8.8 `
            --dns 1.1.1.1 `
            -v "${CurrentDir}:/app" `
            -v "gsd-npm-cache:/root/.npm" `
            $MountArgs `
            -e "GIT_AUTHOR_NAME=$GitName" `
            -e "GIT_AUTHOR_EMAIL=$GitEmail" `
            -e "GIT_COMMITTER_NAME=$GitName" `
            -e "GIT_COMMITTER_EMAIL=$GitEmail" `
            $ImageName
    } else {
        # Default: Bridge network with intelligent port forwarding
        # Works on Windows, macOS, and Linux
        docker run --rm -it `
            $PortArgs `
            -v "${CurrentDir}:/app" `
            -v "gsd-npm-cache:/root/.npm" `
            $MountArgs `
            -e "GIT_AUTHOR_NAME=$GitName" `
            -e "GIT_AUTHOR_EMAIL=$GitEmail" `
            -e "GIT_COMMITTER_NAME=$GitName" `
            -e "GIT_COMMITTER_EMAIL=$GitEmail" `
            $ImageName
    }
}

# Add alias for convenience
Set-Alias gsd-box gsd-secure

Write-Host "GSD Sandbox loaded. Type 'gsd-secure' to launch." -ForegroundColor Green
