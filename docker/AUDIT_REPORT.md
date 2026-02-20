# GSD Secure - Audit Report

**Date:** 2026-02-08
**Auditor:** Antigravity Agent
**Scope:** `docker/Dockerfile`, `entrypoint.sh`, `gsd-secure.ps1`, `gsd-secure.sh`, `.dockerignore`

---

## 1. Critical Bugs (Blocking/High Impact)

### [CRITICAL] Shell Script Argument Expansion (Spaces in Paths)
- **File:** `docker/gsd-secure.sh`
- **Location:** Lines 49-69 (MOUNT_ARGS construction) and Lines 84/98 (Usage).
- **Description:** The script uses string concatenation to build `MOUNT_ARGS`. When variables like `$HOME` or directory paths utilize spaces, the shell execution splits arguments incorrectly because quotes embedded in the string are treated as literal characters, not delimiters.
- **Impact:** Fails completely if the user's home directory or project path contains spaces.
- **Fix:** Use Bash Arrays for `MOUNT_ARGS`.

**Proposed Code Fix (`docker/gsd-secure.sh`):**
```bash
# Change MOUNT_ARGS to an array
local MOUNT_ARGS=()

# ... detection logic ...
if [ -d "$GEMINI_PATH" ]; then
    MOUNT_ARGS+=("-v" "$GEMINI_PATH:/root/.gemini")
    echo -e "\033[0;90m [Auth] Gemini keys detected.\033[0m"
fi

# ... usage ...
docker run ... "${MOUNT_ARGS[@]}" ...
```

---

## 2. Medium Bugs (Runtime/Performance)

### [MEDIUM] Docker Image Bloat (Optimization)
- **File:** `docker/Dockerfile`
- **Location:** Line 20: `COPY . /tmp/gsd-source`
- **Description:** The current build process keeps a copy of the source code in the image history, increasing file size.
- **Impact:** Slower downloads/builds. **No impact on user workflow.**
- **Fix:** Multi-stage build. **This is fully automatic** and requires no user action.

### [INFO] Container Running as Root (Design Choice)
- **File:** `docker/Dockerfile`
- **Description:** The container runs as root.
- **Status:** **Intentional Feature.** The Security Manifesto states: *"It assumes it is running as root inside the container"*.
- **Action:** No fix needed. This is by design to simplify global package installation.

---

## 3. Improvements & Minor Issues

### [MINOR] Hardcoded Opencode Config Path
- **File:** `docker/gsd-secure.ps1` and `.sh`
- **Location:** Hardcoded checks for `.gemini`, `.claude`.
- **Improvement:** The scripts are consistent, but ensure that `opencode` CLI actually expects the config in `/root/.config/opencode`. (Verified: standard XDG path).

### [MINOR] Windows Path Separators in Docker
- **File:** `docker/gsd-secure.ps1`
- **Location:** Line 44: `${GeminiPath}:/root/.gemini`
- **Description:** PowerShell/Docker Desktop usually handles `C:\Path:...` correctly, but forcing forward slashes is safer.
- **Fix:** `$GeminiPath = $GeminiPath -replace '\\', '/'`

---

## 4. Implementation Plan

I recommend applying the **Bash Array Fix** immediately as it prevents runtime failures. I also recommend the **Multi-stage Dockerfile** to reduce image size.

1.  **Refactor `docker/gsd-secure.sh`** to use arrays.
2.  **Update `docker/Dockerfile`** to use multi-stage build.
