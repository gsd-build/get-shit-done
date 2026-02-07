# Function to build and run GSD in Docker

function gsd-secure {
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
    $GeminiPath = "$HOME\.gemini"
    if (Test-Path $GeminiPath) {
        $MountArgs += "-v"
        $MountArgs += "${GeminiPath}:/root/.gemini"
        Write-Host " [Auth] Gemini keys detected." -ForegroundColor DarkGray
    }

    # 2. Claude
    $ClaudePath = "$HOME\.claude"
    if (Test-Path $ClaudePath) {
        $MountArgs += "-v"
        $MountArgs += "${ClaudePath}:/root/.claude"
        Write-Host " [Auth] Claude keys detected." -ForegroundColor DarkGray
    }

    # 3. OpenCode
    $OpenCodePath = "$HOME\.config\opencode"
    if (Test-Path $OpenCodePath) {
        $MountArgs += "-v"
        $MountArgs += "${OpenCodePath}:/root/.config/opencode"
        Write-Host " [Auth] OpenCode keys detected." -ForegroundColor DarkGray
    }

    # 4. Amp (Legacy)
    $AmpPath = "$HOME\.config\amp"
    if (Test-Path $AmpPath) {
        $MountArgs += "-v"
        $MountArgs += "${AmpPath}:/root/.config/amp"
        Write-Host " [Auth] Amp keys detected." -ForegroundColor DarkGray
    }

    Write-Host "Entering GSD Secure Sandbox..." -ForegroundColor Green
    Write-Host "  Project: $CurrentDir" -ForegroundColor Gray
    Write-Host "  Identity: $GitName <$GitEmail>" -ForegroundColor Gray

    # Run Container
    # -v gsd-npm-cache:/root/.npm : Persists NPM cache to avoid re-downloading packages
    docker run --rm -it `
        -v "${CurrentDir}:/app" `
        -v "gsd-npm-cache:/root/.npm" `
        $MountArgs `
        -e "GIT_AUTHOR_NAME=$GitName" `
        -e "GIT_AUTHOR_EMAIL=$GitEmail" `
        -e "GIT_COMMITTER_NAME=$GitName" `
        -e "GIT_COMMITTER_EMAIL=$GitEmail" `
        $ImageName
}

# Add alias for convenience
Set-Alias gsd-box gsd-secure

Write-Host "GSD Sandbox loaded. Type 'gsd-secure' to launch." -ForegroundColor Green
