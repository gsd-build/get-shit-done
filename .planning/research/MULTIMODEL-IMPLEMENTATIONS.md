# Multi-Model Implementations: Claude Code, Codex CLI, and Cursor

**Research Date:** 2026-03-11
**Purpose:** Understand how existing AI coding tools handle multi-model support to inform GSD v4.0 architecture

## Executive Summary

All three major AI coding tools (Claude Code, Codex CLI, Cursor) now support multiple LLM providers, but with different architectural approaches:

| Tool | Architecture | Primary Mechanism | Model Switching |
|------|--------------|-------------------|-----------------|
| **Claude Code** | Proxy-based | Environment variables + LiteLLM/CCR | Runtime via `/model` command |
| **Codex CLI** | Native config | TOML `[model_providers]` sections | CLI flag or `/model` command |
| **Cursor** | Built-in + Custom | Settings UI + OpenAI-compatible endpoints | Per-conversation dropdown |

## Claude Code

### Native Model Configuration

Claude Code's official model configuration supports:

**Configuration Priority (highest to lowest):**
1. Session command: `/model <alias|name>`
2. Startup flag: `claude --model <alias|name>`
3. Environment variable: `ANTHROPIC_MODEL=<name>`
4. Settings file: `~/.claude/settings.json`

**Settings File Locations:**
```
~/.claude/settings.json          # User global settings
.claude/settings.json            # Project settings (committed)
.claude/settings.local.json      # Local overrides (gitignored)
```

**Model Aliases:**
- `sonnet` → latest Sonnet (currently claude-sonnet-4-6)
- `opus` → latest Opus (currently claude-opus-4-6)
- `haiku` → latest Haiku (currently claude-haiku-4-5)

**Environment Variables for Custom Models:**
```bash
ANTHROPIC_DEFAULT_SONNET_MODEL="custom-sonnet-v1"
ANTHROPIC_DEFAULT_OPUS_MODEL="custom-opus-v1"
ANTHROPIC_DEFAULT_HAIKU_MODEL="custom-haiku-v1"
```

### Multi-Provider via Proxy

Claude Code doesn't natively support non-Anthropic models. Instead, the community uses proxy solutions:

#### Option 1: Claude Code Router (CCR)

**Architecture:**
```
Claude Code CLI → CCR Proxy (localhost:3456) → Multiple Providers
                       ↓
              Task-based routing rules
                       ↓
         ┌─────────────┼─────────────┐
         ↓             ↓             ↓
      OpenAI      DeepSeek       Ollama
```

**Key Features:**
- Local Fastify server on `localhost:3456`
- Task-based routing (code vs reasoning vs background)
- Request/response transformation between API formats
- 28k+ GitHub stars

**Configuration:**
```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:3456"
export ANTHROPIC_AUTH_TOKEN="any-value"  # CCR ignores this
```

**Routing Rules:**
```javascript
// Custom router function
module.exports = async (request, config) => {
  if (request.messages.some(m => m.content.includes('refactor'))) {
    return 'openai,gpt-4o';  // Use GPT for refactoring
  }
  return null;  // Fall back to default
};
```

#### Option 2: LiteLLM Gateway

**Architecture:**
```
Claude Code CLI → LiteLLM Proxy → Load Balancer → Multiple Providers
                                        ↓
                              Fallback chains
                                        ↓
                    ┌──────────┬────────┴────────┐
                    ↓          ↓                 ↓
                 Bedrock   Anthropic API      Vertex AI
```

**Key Features:**
- Universal LLM gateway (100+ providers)
- Automatic fallback on errors (429, 503)
- Cost tracking and optimization
- Enterprise audit logging

**Configuration (`litellm_config.yaml`):**
```yaml
model_list:
  - model_name: sonnet
    litellm_params:
      model: bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0
      aws_region_name: us-west-2
  - model_name: sonnet
    litellm_params:
      model: claude-3-5-sonnet-20241022
      api_key: os.environ/ANTHROPIC_API_KEY

router_settings:
  routing_strategy: simple-shuffle
  num_retries: 2
  fallbacks:
    - sonnet: [sonnet-anthropic]  # Bedrock → Anthropic fallback
```

**Complexity-Based Routing:**
```yaml
auto_router_config:
  complexity_tiers:
    SIMPLE: gpt-4o-mini
    MEDIUM: gpt-4o
    COMPLEX: claude-sonnet
    REASONING: o1-preview
```

### Effort Levels (Adaptive Reasoning)

Claude Code supports effort levels for Opus 4.6 and Sonnet 4.6:
- `low` — Faster, cheaper for straightforward tasks
- `medium` — Balanced (default)
- `high` — Deeper reasoning for complex problems

```bash
CLAUDE_CODE_EFFORT_LEVEL=high claude
```

---

## Codex CLI (OpenAI)

### Native Multi-Provider Support

Codex CLI has **first-class multi-provider support** via TOML configuration:

**Configuration File:** `~/.codex/config.toml` (or `.codex/config.toml` per-project)

```toml
# Default model and provider
model = "gpt-5.4"
model_provider = "openai"

# Built-in OpenAI provider (implicit)
[model_providers.openai]
name = "OpenAI"
base_url = "https://api.openai.com/v1"
env_key = "OPENAI_API_KEY"
wire_api = "responses"

# Azure OpenAI
[model_providers.azure]
name = "Azure OpenAI"
base_url = "https://myresource.openai.azure.com/openai/v1"
env_key = "AZURE_OPENAI_API_KEY"
wire_api = "responses"

# Ollama (local)
[model_providers.ollama]
name = "Ollama Local"
base_url = "http://localhost:11434/v1"
wire_api = "chat"

# OpenRouter (multi-model gateway)
[model_providers.openrouter]
name = "OpenRouter"
base_url = "https://openrouter.ai/api/v1"
env_key = "OPENROUTER_API_KEY"
wire_api = "chat"
```

### Model Switching

**At startup:**
```bash
codex --model gpt-5.4-pro
codex --model gpt-5.4 --oss  # Use Ollama provider
```

**During session:**
```
/model gpt-5.4-thinking
/model @azure/gpt-5-codex  # Explicit provider
```

### Wire API Protocols

Codex supports two wire protocols:
- `"responses"` — OpenAI Responses API (recommended for GPT-5.x)
- `"chat"` — OpenAI Chat Completions API (legacy, Ollama-compatible)

### Profiles (Experimental)

```toml
[profiles.work]
model = "gpt-5.4-pro"
model_provider = "azure"

[profiles.personal]
model = "gpt-4o"
model_provider = "openai"
```

```bash
codex --profile work
```

### Reasoning Effort

```toml
model_reasoning_effort = "medium"  # none, low, medium, high, xhigh
```

---

## Cursor IDE

### Built-in Multi-Model Support

Cursor has **native multi-model support** with a visual model selector:

**Supported Models (2026):**
- Claude: Sonnet 4.5, Opus 4.6
- OpenAI: GPT-5.3, GPT-5.4, o1
- Google: Gemini 3 Pro
- Cursor: Composer (proprietary)

**Model Selection:**
- Per-conversation dropdown in chat UI
- "Auto" mode selects based on task complexity
- Different models for different features:
  - Tab completions → Fast/cheap model
  - Agent/Composer → Strong reasoning model

### Custom Model Configuration

**Via Settings UI:**
1. Cursor Settings → Models → Add Custom Model
2. Select OpenAI Protocol
3. Configure API key and base URL override

**OpenAI-Compatible Endpoints:**
```
Ollama:    http://localhost:11434/v1
LM Studio: http://localhost:1234/v1
LocalAI:   http://localhost:8080/v1
```

### Hybrid Workflow Pattern

Cursor users commonly:
1. Use local models for routine tasks (privacy, cost)
2. Switch to cloud models for complex refactoring
3. Use "Auto" mode for intelligent selection

### Credit System

Cursor uses a credit-based billing system where different models consume credits at different rates:
- GPT-5.3: Low credit cost
- Claude Opus: High credit cost
- Cursor Composer: Medium credit cost

---

## Comparison Matrix

| Feature | Claude Code | Codex CLI | Cursor |
|---------|-------------|-----------|--------|
| **Native multi-provider** | No (proxy required) | Yes (TOML config) | Yes (UI + custom) |
| **Config format** | JSON + env vars | TOML | UI + JSON |
| **Provider switching** | Requires restart | Runtime `/model` | Per-conversation |
| **Local model support** | Via proxy | Native (`--oss`) | Native (custom endpoint) |
| **Fallback chains** | Via LiteLLM | Manual | Auto mode |
| **Task-based routing** | Via CCR | Manual | Auto mode |
| **Enterprise support** | Bedrock/Vertex/Foundry | Azure OpenAI | API keys only |
| **Effort/reasoning levels** | Yes (low/med/high) | Yes (none→xhigh) | No |

---

## Architectural Patterns

### Pattern 1: Proxy Gateway (Claude Code)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  CLI/IDE    │ ──▶ │ Proxy Server │ ──▶ │  Provider   │
│             │     │ (CCR/LiteLLM)│     │  (OpenAI)   │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Routing    │
                    │    Rules     │
                    └──────────────┘
```

**Pros:** No CLI changes, works with existing tools
**Cons:** Extra process, latency, complexity

### Pattern 2: Native Configuration (Codex CLI)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│    CLI      │ ──▶ │   Provider   │ ──▶ │  Provider   │
│             │     │   Selector   │     │    API      │
└─────────────┘     └──────────────┘     └─────────────┘
       │
       ▼
┌──────────────┐
│ config.toml  │
│ [providers]  │
└──────────────┘
```

**Pros:** Simple, fast, no extra processes
**Cons:** Manual switching, no intelligent routing

### Pattern 3: Integrated UI (Cursor)

```
┌─────────────────────────────────────────┐
│                  IDE                     │
│  ┌───────────┐  ┌────────────────────┐  │
│  │  Model    │  │                    │  │
│  │ Dropdown  │──│   Request Router   │  │
│  │           │  │                    │  │
│  └───────────┘  └────────────────────┘  │
│                          │              │
└──────────────────────────│──────────────┘
                           ▼
              ┌────────────┴────────────┐
              ▼            ▼            ▼
           Claude       OpenAI       Gemini
```

**Pros:** Best UX, visual feedback, auto-selection
**Cons:** IDE-specific, not portable

---

## Recommendations for GSD v4.0

Based on this research, GSD v4.0 should adopt a **hybrid approach**:

### 1. Native Provider Configuration (like Codex)

```json
// .planning/config.json
{
  "model_providers": {
    "anthropic": {
      "base_url": "https://api.anthropic.com",
      "env_key": "ANTHROPIC_API_KEY"
    },
    "azure": {
      "base_url": "https://myresource.openai.azure.com/openai/v1",
      "env_key": "AZURE_OPENAI_API_KEY"
    }
  },
  "models": {
    "primary": { "provider": "anthropic", "model": "claude-sonnet-4-6" },
    "secondary": { "provider": "azure", "model": "gpt-5.4-pro" }
  }
}
```

### 2. Task-Based Routing (like CCR)

```json
{
  "routing": {
    "research": "primary",
    "planning": "primary",
    "execution": { "default": "secondary", "complex": "primary" },
    "verification": "primary"
  }
}
```

### 3. Fallback Chains (like LiteLLM)

```json
{
  "fallbacks": {
    "primary": ["anthropic/claude-sonnet", "azure/gpt-5.4"],
    "secondary": ["azure/gpt-5.4", "azure/gpt-4o-mini"]
  }
}
```

### 4. Effort/Reasoning Levels (like Claude Code + Codex)

```json
{
  "reasoning": {
    "research": "high",
    "execution_simple": "low",
    "execution_complex": "high",
    "verification": "medium"
  }
}
```

---

## Sources

### Claude Code
- [Model Configuration - Claude Code Docs](https://code.claude.com/docs/en/model-config)
- [LLM Gateway Configuration - Claude Code Docs](https://code.claude.com/docs/en/llm-gateway)
- [Claude Code Router - GitHub](https://github.com/musistudio/claude-code-router)
- [Claude Code Router Tutorial - DataCamp](https://www.datacamp.com/tutorial/claude-code-router)
- [LiteLLM Claude Code Integration](https://docs.litellm.ai/docs/tutorials/claude_responses_api)
- [Use Claude Code with Non-Anthropic Models - LiteLLM](https://docs.litellm.ai/docs/tutorials/claude_non_anthropic_models)

### Codex CLI
- [Configuration Reference - OpenAI Codex](https://developers.openai.com/codex/config-reference/)
- [Advanced Configuration - OpenAI Codex](https://developers.openai.com/codex/config-advanced/)
- [Sample Configuration - OpenAI Codex](https://developers.openai.com/codex/config-sample/)
- [Codex Models - OpenAI](https://developers.openai.com/codex/models)
- [Codex with Azure OpenAI - Microsoft Learn](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/codex)

### Cursor
- [Models & Pricing - Cursor Docs](https://cursor.com/docs/models)
- [AI Models and Providers - Cursor Docs](https://deepwiki.com/getcursor/docs/5.1-ai-models-and-providers)
- [Choosing the Right AI Model in Cursor](https://stevekinney.com/courses/ai-development/cursor-model-selection)
- [Running Local AI Models in Cursor](https://themeansquare.medium.com/running-local-ai-models-in-cursor-the-complete-guide-4290fe0383fa)

---

*Document created: 2026-03-11*
