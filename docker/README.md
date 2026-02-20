# GSD Secure Sandbox 🛡️

**Think of this as a "Space Suit" for your AI Agent.**

When you run an AI agent (like GSD) on your computer, you want it to be powerful but safe. You don't want it accidentally deleting your personal photos or reading your private emails.

**GSD Secure** creates a safe, isolated bubble for the AI to work in. It can see your project, but nothing else.

---

## ✨ Why Use This?

1.  **Safety First**: The AI lives in a disposable container. If it breaks something, you just restart the container. Your computer stays clean.
2.  **Zero Setup**: You don't need to install Node.js, Python, or Git. The container has everything pre-installed.
3.  **Automatic Keys**: It automatically finds your API keys (`~/.gemini`, `~/.claude`) and passes them safely to the agent.
4.  **"It Just Works" Networking**: You can still open `localhost:3000` in your browser, just like normal.

---

## 🛠️ Prerequisites

*   **Docker Desktop** (or Docker Engine) installed and running.
*   **That's it!** You do **NOT** need Node.js, Python, or Git installed on your computer. The specialized container handles everything.

## 🚀 Quick Start

### Windows (PowerShell)
1.  **Prepare**: Open PowerShell and run this **once**:
    ```powershell
    . .\gsd-secure.ps1
    ```
2.  **Launch**: Go to your project folder and type:
    ```powershell
    gsd-secure
    ```

### Linux / macOS
1.  **Prepare**: Add this to your shell profile (`.bashrc` / `.zshrc`):
    ```bash
    source /path/to/repo/docker/gsd-secure.sh
    ```
2.  **Launch**: Go to your project and type:
    ```bash
    gsd-secure
    ```

---

## 🌐 How Connections Work (Network Modes)

We offer two modes. One for **convenience** (Default), and one for **paranoia** (Strict).

### ✅ 1. Default Mode: "Magic Connect" (Recommended)
`gsd-secure`

Use this for 99% of your work. It feels exactly like working locally.

*   **What it does**: It intelligently connects ("maps") the ports you need.
*   **Example**: If your app runs on `localhost:3000`, GSD Secure automatically opens that port so you can see it in your browser.
*   **Supported Ports**: React, Angular, Vue, Vite, Django, Spring, and many more are auto-detected.
*   **Safety Bonus**: Unlike a normal connection, **it blocks the AI from seeing your home network** (printers, other computers).

### 🛡️ 2. Strict Mode: "Fort Knox"
`gsd-secure --strict`

Use this when you are running **untrusted code** or working on **malware**.

*   **What it does**: Total isolation. The AI cannot see *anything* on your computer network.
*   **The Trade-off**: You cannot easily open `localhost:3000`. You have to use special addresses (`host.docker.internal`).
*   **Who is this for?**: Security researchers, corporate environments with sensitive intranets.

---

## 🔍 Comparison at a Glance

| Feature | Default Mode | Strict Mode |
| :--- | :--- | :--- |
| **Can I see my app in the browser?** | ✅ Yes (Easy) | ❌ No (Hard) |
| **Can the AI reach the internet?** | ✅ Yes | ✅ Yes |
| **Can the AI scan my home network?** | 🛡️ **No** (Safe) | 🛡️ **No** (Safe) |
| **Can the AI see my VPN files?** | 🛡️ **No** (Safe) | 🛡️ **No** (Safe) |

---

## 🤖 Magic Features

### 1. Auto-Stack™ (Intelligent Dependencies)
The Agent is smart. If your project needs a specific tool (like `ffmpeg` for video processing), it doesn't just ask you to install it manually.

Instead, it writes a "recipe" in a file called `STACK.md`:
```markdown
```gsd-stack
ffmpeg
imagemagick
```
```

When you start `gsd-secure`, the container reads this recipe and installs the tools **inside the bubble** automatically. Your computer stays clean, but the agent gets the tools it needs.

### 2. Smart Caching (Instant Startups)
We use a special Docker Volume (`gsd-npm-cache`) to save everything the agent downloads.
*   **First Run**: Might take a minute to download `node_modules` or `pip` packages.
*   **Next Runs**: Starts instantly because the files are already there.

It's like having a persistent hard drive for your disposable computer.

### 🔧 Under the Hood (For the Curious)

It's not actually magic. Here is what happens when you run `gsd-secure`:

| Feature | Technical Implementation |
| :--- | :--- |
| **Space Suit** | A Docker container based on `node:20-slim`. |
| **Auto-Auth** | Read-only bind mounts for `~/.gemini` and `~/.claude`. |
| **Auto-Stack** | A startup script parses `STACK.md` and runs `apt-get install`. |
| **Port Mapping** | The script dynamically builds a `docker run -p 3000:3000` command. |

---

## ❓ Troubleshooting

**"I can't see my app on localhost!"**
Check if your app is running on a standard port (3000, 5173, 8080). If it's a weird port (like 12345), add it to your `.env` file (`PORT=12345`) and restart `gsd-secure`.

**"How do I update?"**
If a new version of GSD comes out, just delete the old "Space Suit" image and let it rebuild:
```bash
docker rmi gsd-sandbox:latest
gsd-secure
```
