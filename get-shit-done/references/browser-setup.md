<browser_setup>

# Browser Pre-Verification Setup

Guide for configuring automated browser testing in `/gsd:verify-work`.

## Prerequisites

- Chrome or Chromium installed
- `chrome-devtools-mcp` configured in Claude Code
- A running dev server (or a `startup_command` configured)

## Step 1: Install chrome-devtools-mcp

Add to your Claude Code MCP settings (`~/.claude/settings.json` or project `.claude/settings.json`):

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/chrome-devtools-mcp@latest"]
    }
  }
}
```

Restart Claude Code after adding the MCP server.

## Step 2: Enable in GSD Config

**Option A: Via /gsd:settings**

Run `/gsd:settings` and select "Enabled" for the Browser Pre-Verify option.

**Option B: Via CLI**

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set browser.enabled true
```

**Option C: Edit config.json directly**

Add to `.planning/config.json`:

```json
{
  "browser": {
    "enabled": true,
    "base_url": "http://localhost:3000"
  }
}
```

## Step 3: Configure for Your App

### Next.js (default)

No extra config needed — defaults work with `npm run dev` on port 3000.

```json
{
  "browser": {
    "enabled": true,
    "base_url": "http://localhost:3000",
    "startup_command": "npm run dev"
  }
}
```

### Vite

```json
{
  "browser": {
    "enabled": true,
    "base_url": "http://localhost:5173",
    "startup_command": "npm run dev"
  }
}
```

### Custom Port

```json
{
  "browser": {
    "enabled": true,
    "base_url": "http://localhost:8080"
  }
}
```

### Apps with Login

If your app requires authentication:

```json
{
  "browser": {
    "enabled": true,
    "base_url": "http://localhost:3000",
    "auth": {
      "login_url": "http://localhost:3000/login",
      "username_field": "Email",
      "password_field": "Password",
      "username": "test@example.com",
      "password_env_var": "TEST_PASSWORD",
      "submit_selector": "Sign in"
    }
  }
}
```

The `username_field`, `password_field`, and `submit_selector` use accessible names (labels, button text) — not CSS selectors. The browser agent uses the accessibility tree.

Set the password via environment variable:

```bash
export TEST_PASSWORD="your-test-password"
```

### Persistent Sessions

To reuse an existing Chrome profile (e.g., with saved cookies/sessions):

```json
{
  "browser": {
    "enabled": true,
    "user_data_dir": "/path/to/chrome/profile"
  }
}
```

## How It Works

1. `/gsd:verify-work` extracts tests from SUMMARY.md as usual
2. Before presenting tests to the user, it spawns a `gsd-browser-verifier` agent
3. The agent navigates the app, interacts with UI, and observes results
4. Each test is classified:
   - **auto_pass** — Clear evidence of expected behavior (skipped in human UAT)
   - **auto_fail** — Concrete error found (marked pending with diagnostic note)
   - **needs_human** — Ambiguous or visual/subjective (presented normally)
5. Only non-auto-passed tests are presented to the user
6. UAT.md records all results including auto-pass evidence

## Troubleshooting

### "Browser pre-verification: disabled"

Browser is not enabled. Run:

```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-set browser.enabled true
```

### "App not running at localhost:3000"

Start your dev server before running `/gsd:verify-work`, or configure `startup_command`:

```json
{
  "browser": {
    "startup_command": "npm run dev",
    "startup_wait_seconds": 15
  }
}
```

### MCP tools not available

If `mcp__chrome-devtools__*` tools are not available:

1. Verify MCP config in `~/.claude/settings.json`
2. Restart Claude Code
3. Check that `npx @anthropic-ai/chrome-devtools-mcp@latest` runs without errors

The feature degrades gracefully — if MCP is unavailable, all tests fall through to manual UAT.

### Port conflicts

If Chrome DevTools Protocol port 9222 is in use:

```json
{
  "browser": {
    "port": 9223
  }
}
```

### OAuth / External Auth

Browser pre-verification works best with username/password login forms. For OAuth flows (Google, GitHub, etc.), use `user_data_dir` with a pre-authenticated Chrome profile, or leave auth unconfigured and expect auth-gated tests to be classified as `needs_human`.

### Slow startup

If your dev server takes longer than 10 seconds to start:

```json
{
  "browser": {
    "startup_wait_seconds": 30
  }
}
```

</browser_setup>
