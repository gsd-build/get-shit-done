# GSD Secure Sandbox 🛡️

**Zero-Configuration, Total Security Environment for GSD Agents.**

This directory contains the "Space Suit" for running GSD agents without risking your host machine.

## Prerequisites
*   **Docker Desktop** (or Docker Engine).
*   That's it! NO Node.js, NO Python, NO Git required on your host. The container handles everything.

## Features
*   **Total Isolation**: Runs the agent in a disposable Docker container.
*   **Auto-Authentication**: Automatically mounts your `~/.gemini`, `~/.claude`, and `~/.config/opencode` keys.
*   **Smart CLI Auto-Detect 🧠**:
    *   Detects which config you have (Gemini, Claude, or OpenCode).
    *   **Automatically installs the correct CLI** at startup. No manual configuration needed.
*   **Auto-Stack™**: Automatically installs project dependencies at runtime.
    *   System Tools: Add a `` ```gsd-stack `` block to `STACK.md`.
    *   System Tools: Add a `` ```gsd-stack `` block to `STACK.md`.
    *   Node Packages: Add a `` ```gsd-npm `` block to `STACK.md`.
*   **Smart Caching ⚡**: Uses a Docker Volume (`gsd-npm-cache`) to persist NPM packages.
    *   First fun: Downloads internet.
    *   Second run: Instant install from cache.

## 🌐 Network Configuration

GSD Secure runs in a container. **By default, it works exactly like your local machine** — localhost, APIs, cloud services, everything just works.

### ✅ Default Mode: It Just Works

No configuration needed! Your container:

- 🏠 **Access localhost** - Connect to local databases, dev servers, APIs
- 🌍 **Access internet** - Connect to any cloud service, external API, database
- ⚡ **Zero friction** - `localhost:5432` works exactly as expected

> **This is the recommended mode for development.** It works for 99% of use cases.

### 🛡️ Strict Mode: Extra Security

For maximum isolation, use `--strict`. This isolates your container from localhost.

| Platform | Command |
|----------|---------|
| **Linux/Mac** | `gsd-secure --strict` |
| **Windows** | `gsd-secure -Strict` |

**What changes in strict mode:**

| Aspect | Default | `--strict` |
|--------|---------|------------|
| Access internet | ✅ Yes | ✅ Yes |
| Access localhost | ✅ Yes | ❌ No (use `host.docker.internal`) |
| Security | Standard | 🛡️ High (isolated) |

**When to use `--strict`:**
- You're running **untrusted code** inside the container
- You want the AI **completely isolated** from your local services
- You're in a **security-sensitive environment**

### 📖 Using Strict Mode with Local Services

In strict mode, `localhost` doesn't work. Use `host.docker.internal` instead — it's a special hostname that Docker provides to reach your host machine.

**The simple rule:** Replace `localhost` → `host.docker.internal`

#### Common Examples

**PostgreSQL / MySQL Database:**
```bash
# Outside container (normal)
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb

# Inside strict mode container
DATABASE_URL=postgresql://user:pass@host.docker.internal:5432/mydb
```

**Redis:**
```bash
# Outside container
REDIS_URL=redis://localhost:6379

# Inside strict mode container
REDIS_URL=redis://host.docker.internal:6379
```

**Local API Server:**
```bash
# Outside container
API_URL=http://localhost:3000/api

# Inside strict mode container
API_URL=http://host.docker.internal:3000/api
```

**In your code (JavaScript/TypeScript):**
```javascript
// Detect if running in Docker and use the right host
const DB_HOST = process.env.DOCKER_ENV ? 'host.docker.internal' : 'localhost';
const db = `postgresql://user:pass@${DB_HOST}:5432/mydb`;
```

**Environment file (.env):**
```env
# Option 1: Always use host.docker.internal (works everywhere)
DB_HOST=host.docker.internal

# Option 2: Use a variable that you change for Docker
# DB_HOST=localhost        # For running outside Docker
# DB_HOST=host.docker.internal  # For running inside Docker
```

> 💡 **Tip:** `host.docker.internal` also works in **default mode**, so you can use it everywhere without issues.

### 🔍 Quick Comparison

| Aspect | `gsd-secure` (default) | `gsd-secure --strict` |
|--------|------------------------|----------------------|
| Connect to localhost:5432 | ✅ Works | Use `host.docker.internal` |
| Connect to cloud APIs | ✅ Works | ✅ Works |
| AI can access local network | ⚠️ Yes | ❌ No |
| Recommended for | 🛠️ **Development** | 🔒 Security-sensitive work |

## 🤖 Auto-Stack™: The Intelligent Dependency System

GSD Secure includes an intelligent system that automatically detects and installs the tools your project needs.

### How It Works

1. **Detection**: During the `gsd:new-project` research phase, the GSD Agent analyzes your project requirements and identifies missing system tools (e.g., "This project needs `ffmpeg` for video processing").

2. **Structuring**: Instead of just mentioning the dependency in text, the Agent writes it to `STACK.md` in a machine-readable format:

   ```markdown
   ```gsd-stack
   ffmpeg
   imagemagick
   ```
   ```

3. **Auto-Installation**: When you launch `gsd-secure`, the container reads `STACK.md`, finds these blocks, and runs `apt-get install` automatically before giving you control.

### Why This Matters

- **Zero manual setup** — The Agent knows what you need before you do
- **Reproducible environments** — `STACK.md` is committed to your repo, so other developers get the same tools
- **No host pollution** — Dependencies install inside the container, not on your machine

### Manual Usage

You can also add tools manually to `STACK.md`:

```markdown
```gsd-stack
ffmpeg
python3-pip
```
```

Then restart `gsd-secure` — the new tools will be installed automatically.


## Usage

### Windows (PowerShell)
1.  Open PowerShell in this directory.
2.  Run the script once to load the aliases:
    ```powershell
    . .\gsd-secure.ps1
    ```
3.  Navigate to your project folder.
4.  Launch the sandbox:
    ```powershell
    gsd-secure
    ```

### Linux / macOS
1.  Source the script in your shell profile (e.g., `.bashrc` or `.zshrc`):
    ```bash
    source /path/to/repo/docker/gsd-secure.sh
    ```
2.  Launch from any project:
    ```bash
    gsd-secure
    ```

## 🔄 Maintenance & Updates

### 1. Adding New Tools (Auto-Stack)
**Normally, the Agent manages this automatically** (writing blocks in `STACK.md`).

However, you can also edit `STACK.md` manually if you need a specific tool immediately. Just add a block like this:

\`\`\`gsd-stack
ffmpeg
\`\`\`

To apply changes (from Agent or Manual):
1.  Type `exit` inside the container.
2.  Run `gsd-secure` again.
The new tools will be installed automatically at startup.

### 2. Full System Update (Rarely Needed)
Your container is built to last. You **ONLY** need to run this when:
*   A new version of GSD is released (e.g., v1.12).
*   You want to update the underlying Linux system.

**Procedure:**
1.  Run `docker rmi gsd-sandbox:latest`
2.  Run `gsd-secure` (this triggers the auto-rebuild)

```bash
# Delete the old image
docker rmi gsd-sandbox:latest

# Start (this will auto-redownload everything)
gsd-secure
```
