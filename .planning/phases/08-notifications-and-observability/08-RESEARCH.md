# Phase 08: Notifications & Observability - Research

**Researched:** 2026-02-16
**Domain:** Telegram notification integration, speech-to-text processing, distributed tracing, LLM observability, token cost tracking, real-time progress dashboards
**Language Requirements:** English and Russian speech-to-text support required
**Confidence:** HIGH

## Summary

Phase 8 implements production-ready deployment with two core capabilities: (1) Telegram-based human-in-the-loop intervention allowing Claude to send blocking questions to users via text or audio messages with local Whisper transcription, and (2) comprehensive observability infrastructure using OpenTelemetry for distributed tracing, LLM-specific metrics (tokens, cost, context size, latency), graduated budget alerts (50%, 80%, 90%, 100% thresholds), and real-time progress dashboards built on existing EXECUTION_LOG.md infrastructure.

The Telegram integration uses **Telegraf** (modern framework with TypeScript support, webhook/polling flexibility, full Bot API 7.1 support) for bot management, **whisper-node** (local CPU-optimized transcription via C++ bindings) for speech-to-text with **multilingual base model** for English and Russian support, and conversation state management via finite state machines to handle blocking questions asynchronously. User sends audio via Telegram → bot downloads .oga file → ffmpeg converts to 16kHz .wav → whisper-node transcribes locally (auto-detects language) → Claude receives text → resumes execution with response.

The observability stack leverages **OpenTelemetry** (industry standard for distributed tracing with native LLM semantic conventions) with **OpenLLMetry** instrumentation (supports Anthropic Claude natively), **Langfuse** for token/cost tracking (handles Claude's tiered pricing with 200k threshold), and NDJSON streaming dashboards built on existing execution-log.js infrastructure. Token budget monitoring extends Phase 7's TokenBudgetMonitor with graduated alerts (50% early warning, 80% context compression trigger, 90% escalation, 100% halt), and savings reports compare auto mode vs manual profiles using historical execution data.

**Primary recommendation:** Use Telegraf webhooks (production) with conversation state tracking for blocking questions, whisper-node **base multilingual model** (74M params, supports 99 languages including English and Russian with automatic language detection) for local transcription, OpenTelemetry + OpenLLMetry for span-level tracing with gen_ai.* semantic conventions, extend existing token-monitor.js for graduated alerts, and build real-time dashboard as NDJSON streaming reader over EXECUTION_LOG.md with WebSocket updates.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| telegraf | 4.16.3+ | Telegram bot framework | Modern framework with excellent TypeScript support, webhook/polling flexibility, full Bot API 7.1, cleaner async/await patterns vs node-telegram-bot-api |
| whisper-node | 1.x | Local speech-to-text | CPU-optimized Node.js bindings for OpenAI Whisper (C++ port), local processing (no API calls), supports Apple Silicon ARM |
| @opentelemetry/sdk-node | Latest | Distributed tracing foundation | Official OpenTelemetry Node.js SDK, auto-instrumentation, vendor-agnostic, industry standard for observability |
| traceloop-sdk | Latest | LLM observability | OpenLLMetry implementation, supports Anthropic natively, captures gen_ai.* semantic conventions, token/cost metrics |
| langfuse | 3.x | Token/cost tracking | Predefined Claude models + tokenizer (@anthropic-ai/tokenizer), supports tiered pricing (200k threshold), ingestion + inference approaches |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fluent-ffmpeg | 2.x | Audio format conversion | Convert Telegram .oga files to 16kHz .wav for Whisper processing |
| @opentelemetry/exporter-otlp-grpc | Latest | Telemetry export | Export traces/metrics to OTLP-compatible backends (Jaeger, Zipkin, Grafana) |
| ws | 8.x | WebSocket server | Real-time dashboard updates streaming EXECUTION_LOG.md events |
| dotenv | 16.x | Environment variables | Securely store TELEGRAM_BOT_TOKEN, API keys, configuration |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Telegraf | node-telegram-bot-api | node-telegram-bot-api: older, more stars. Telegraf: better async/await, TypeScript, cleaner middleware patterns. |
| whisper-node | OpenAI Whisper API | OpenAI API: better accuracy (large-v3), no local setup. Local: privacy, no API cost, offline capability, lower latency for small files. |
| OpenLLMetry | Langfuse native instrumentation | Langfuse: all-in-one, UI included. OpenLLMetry: vendor-agnostic, OpenTelemetry standard, multiple backend options. |
| Webhook deployment | Long polling | Polling: works locally, simpler setup. Webhooks: faster, more efficient, no interval delays, required for production scale. |
| Whisper base model | tiny/small/medium | Tiny (39M): 32x realtime, low accuracy. **Base multilingual (74M): optimal for English + Russian, auto language detection, 4-7x realtime**. Small (244M): better accuracy, 2x slower. Medium (769M): highest accuracy, 4x slower, 3x more VRAM. Base.en (English-only): not suitable due to Russian requirement. |

**Installation:**
```bash
# Telegram integration
npm install telegraf dotenv fluent-ffmpeg
npm install whisper-node

# Download Whisper model (base multilingual for English + Russian)
npx whisper-node download --model base

# OpenTelemetry + LLM observability
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
npm install @opentelemetry/exporter-otlp-grpc
npm install traceloop-sdk

# Token/cost tracking
npm install langfuse @anthropic-ai/tokenizer

# Dashboard streaming
npm install ws
```

## Architecture Patterns

### Recommended Project Structure
```
get-shit-done/
├── bin/
│   ├── telegram-bot.js          # NEW: Telegraf bot server
│   ├── telegram-conversation.js # NEW: Conversation state FSM
│   ├── whisper-transcribe.js    # NEW: Audio → text pipeline
│   ├── observability.js         # NEW: OpenTelemetry initialization
│   ├── llm-metrics.js           # NEW: LLM-specific metric collection
│   ├── token-monitor.js         # EXTEND: Add graduated alerts (50/80/90/100)
│   ├── dashboard-server.js      # NEW: WebSocket NDJSON streaming
│   └── gsd-tools.js             # EXTEND: telegram, observability commands
│
├── workflows/
│   └── execute-roadmap.md       # EXTEND: Initialize observability, Telegram integration
│
.planning/
├── EXECUTION_LOG.md             # EXTEND: Add trace_id, span_id, cost fields
└── token_budget.json            # EXTEND: graduated_alerts field

.env (NOT COMMITTED)
├── TELEGRAM_BOT_TOKEN=...
├── TELEGRAM_OWNER_ID=...
├── OTEL_EXPORTER_OTLP_ENDPOINT=...
└── LANGFUSE_SECRET_KEY=...
```

### Language Support Requirements

**Required Languages:** English and Russian

**Implementation:**
- **Whisper Model:** Use `base` multilingual model (74M params) with automatic language detection
- **Language Detection:** Whisper automatically detects language from audio input
- **No Configuration Required:** Same model handles both English and Russian without language parameter
- **Performance:** Base model provides 4-7x realtime speed on Apple Silicon for both languages
- **Accuracy:** Base model has ~10-15% WER (Word Error Rate) for both English and Russian in typical voice message scenarios

**Alternative if accuracy insufficient:**
- Upgrade to `small` multilingual model (244M params) - 2x slower but better accuracy (~5-8% WER)
- Or `medium` multilingual model (769M params) - 4x slower, highest accuracy (~3-5% WER)

**Testing:** Verify transcription quality with sample voice messages in both English and Russian before production deployment.

### Pattern 1: Telegram Blocking Question Flow

**What:** Send blocking question to user via Telegram, await response (text or audio), resume execution with answer

**When to use:** When autonomous execution encounters decisions requiring human input (ambiguous requirements, security decisions, architecture tradeoffs)

**Example:**
```javascript
// Source: https://telegraf.js.org/ - Official Telegraf documentation
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Conversation state storage (in-memory for single user, DB for multi-user)
const pendingQuestions = new Map(); // questionId -> { resolve, reject, context }

// Send blocking question from workflow
async function askUser(question, options = {}) {
  const questionId = `q_${Date.now()}`;

  const promise = new Promise((resolve, reject) => {
    pendingQuestions.set(questionId, { resolve, reject, question, askedAt: Date.now() });
  });

  // Send to Telegram with inline keyboard if options provided
  const keyboard = options.choices
    ? { inline_keyboard: options.choices.map(c => [{ text: c, callback_data: c }]) }
    : null;

  await bot.telegram.sendMessage(
    process.env.TELEGRAM_OWNER_ID,
    `🤖 *Claude needs your input:*\n\n${question}\n\nQuestion ID: \`${questionId}\``,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  );

  // Timeout after 1 hour
  const timeout = setTimeout(() => {
    if (pendingQuestions.has(questionId)) {
      pendingQuestions.get(questionId).reject(new Error('User response timeout'));
      pendingQuestions.delete(questionId);
    }
  }, 3600000);

  const answer = await promise;
  clearTimeout(timeout);
  return answer;
}

// Handle text responses
bot.on('text', async (ctx) => {
  // Extract question ID from message (user includes it or uses reply)
  const questionId = extractQuestionId(ctx.message);

  if (pendingQuestions.has(questionId)) {
    const { resolve } = pendingQuestions.get(questionId);
    resolve({ type: 'text', content: ctx.message.text });
    pendingQuestions.delete(questionId);
    await ctx.reply('✅ Got it! Resuming execution...');
  }
});

// Handle voice messages (see Pattern 2 for transcription)
bot.on('voice', async (ctx) => {
  const questionId = getActiveQuestion(); // Latest pending question
  const audioFile = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
  const transcription = await transcribeAudio(audioFile);

  if (pendingQuestions.has(questionId)) {
    const { resolve } = pendingQuestions.get(questionId);
    resolve({ type: 'voice', content: transcription });
    pendingQuestions.delete(questionId);
    await ctx.reply(`✅ Transcribed: "${transcription}"\n\nResuming execution...`);
  }
});

bot.launch();
```

### Pattern 2: Local Audio Transcription with Whisper

**What:** Download Telegram voice message, convert to 16kHz .wav, transcribe locally with whisper-node

**When to use:** Processing voice responses from Telegram users for speech-to-text conversion

**Example:**
```javascript
// Source: https://github.com/ariym/whisper-node - Official whisper-node README
const whisper = require('whisper-node');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const https = require('https');

async function transcribeAudio(audioUrl) {
  // 1. Download audio file
  const tempOga = `/tmp/audio_${Date.now()}.oga`;
  const tempWav = `/tmp/audio_${Date.now()}.wav`;

  await downloadFile(audioUrl, tempOga);

  // 2. Convert to 16kHz .wav (Whisper requirement)
  await new Promise((resolve, reject) => {
    ffmpeg(tempOga)
      .audioFrequency(16000)
      .audioChannels(1)
      .format('wav')
      .on('end', resolve)
      .on('error', reject)
      .save(tempWav);
  });

  // 3. Transcribe with whisper-node
  const transcript = await whisper(tempWav, {
    modelName: 'base.en',        // 244M params, best accuracy/speed balance
    whisperOptions: {
      language: 'en',              // Set language for better accuracy
      word_timestamps: false       // Faster processing without word-level timing
    }
  });

  // 4. Cleanup
  await fs.unlink(tempOga);
  await fs.unlink(tempWav);

  // transcript is array of { start, end, speech } - join speech segments
  return transcript.map(t => t.speech).join(' ');
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(dest);
      reject(err);
    });
  });
}
```

### Pattern 3: OpenTelemetry LLM Tracing

**What:** Instrument LLM calls with OpenTelemetry to capture span-level traces with token metrics, cost, latency

**When to use:** All Claude API calls in autonomous execution (research, planning, execution phases)

**Example:**
```javascript
// Source: https://opentelemetry.io/blog/2024/llm-observability/ - Official OTel LLM guide
// Source: https://github.com/traceloop/openllmetry - OpenLLMetry documentation
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');
const { Traceloop } = require('traceloop-sdk');

// Initialize OpenTelemetry with LLM instrumentation
const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
  }),
  instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();

// Initialize Traceloop for LLM-specific instrumentation
Traceloop.init({
  apiKey: process.env.TRACELOOP_API_KEY,
  disableBatch: false,
  instrumentModules: {
    anthropic: true // Enable Anthropic Claude instrumentation
  }
});

// Wrapper for Claude API calls with span attributes
async function callClaudeWithTracing(prompt, options = {}) {
  const tracer = trace.getTracer('gsd-autonomous-execution');

  return tracer.startActiveSpan('claude.completion', async (span) => {
    span.setAttributes({
      'gen_ai.system': 'anthropic',
      'gen_ai.request.model': options.model || 'claude-opus-4.5',
      'gen_ai.operation.name': options.operation || 'completion',
      'gen_ai.request.max_tokens': options.max_tokens || 200000,
      'gen_ai.request.temperature': options.temperature || 1.0,
      'gsd.phase': options.phase || 'unknown',
      'gsd.plan': options.plan || 'unknown'
    });

    try {
      const response = await claudeAPI.complete(prompt, options);

      // Record token usage (from Claude API response)
      span.setAttributes({
        'gen_ai.usage.input_tokens': response.usage.input_tokens,
        'gen_ai.usage.output_tokens': response.usage.output_tokens,
        'gen_ai.usage.total_tokens': response.usage.input_tokens + response.usage.output_tokens,
      });

      // Calculate cost (Claude Opus 4.5: $5 input / $25 output per 1M tokens)
      const inputCost = (response.usage.input_tokens / 1000000) * 5;
      const outputCost = (response.usage.output_tokens / 1000000) * 25;
      span.setAttribute('gsd.cost_usd', inputCost + outputCost);

      span.setStatus({ code: SpanStatusCode.OK });
      return response;
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

### Pattern 4: Graduated Budget Alerts

**What:** Progressive token budget alerts at 50%, 80%, 90%, 100% thresholds with escalating actions

**When to use:** Throughout autonomous roadmap execution to prevent context exhaustion

**Example:**
```javascript
// Source: https://cloud.google.com/billing/docs/how-to/budgets - GCP graduated budgets pattern
// Extends existing get-shit-done/bin/token-monitor.js

const GRADUATED_THRESHOLDS = {
  early_warning: 0.50,    // 100k tokens - log warning
  compression_trigger: 0.80,  // 160k tokens - compress context (from Phase 7)
  escalation: 0.90,       // 180k tokens - notify user via Telegram
  halt: 1.00              // 200k tokens - stop execution
};

class GraduatedBudgetMonitor extends TokenBudgetMonitor {
  constructor(model, maxTokens, telegramBot) {
    super(model, maxTokens);
    this.telegramBot = telegramBot;
    this.thresholdsPassed = new Set();
  }

  recordUsage(actualTokens, phase) {
    super.recordUsage(actualTokens, phase);

    const utilization = this.currentUsage / this.maxTokens;

    // Check each threshold (only trigger once)
    if (utilization >= GRADUATED_THRESHOLDS.early_warning && !this.thresholdsPassed.has('early_warning')) {
      this.thresholdsPassed.add('early_warning');
      this.handleEarlyWarning(utilization, phase);
    }

    if (utilization >= GRADUATED_THRESHOLDS.compression_trigger && !this.thresholdsPassed.has('compression_trigger')) {
      this.thresholdsPassed.add('compression_trigger');
      this.handleCompressionTrigger(utilization, phase);
    }

    if (utilization >= GRADUATED_THRESHOLDS.escalation && !this.thresholdsPassed.has('escalation')) {
      this.thresholdsPassed.add('escalation');
      this.handleEscalation(utilization, phase);
    }

    if (utilization >= GRADUATED_THRESHOLDS.halt && !this.thresholdsPassed.has('halt')) {
      this.thresholdsPassed.add('halt');
      this.handleHalt(utilization, phase);
    }
  }

  handleEarlyWarning(utilization, phase) {
    console.warn(`⚠️  50% budget threshold reached (${this.currentUsage}/${this.maxTokens} tokens)`);
    this.alerts.push({
      level: 'INFO',
      threshold: '50%',
      action: 'Log warning',
      utilization: `${(utilization * 100).toFixed(1)}%`,
      phase,
      timestamp: new Date().toISOString()
    });
  }

  async handleCompressionTrigger(utilization, phase) {
    console.warn(`⚠️  80% budget threshold - triggering context compression`);
    this.alerts.push({
      level: 'WARN',
      threshold: '80%',
      action: 'Compress context for next phase',
      utilization: `${(utilization * 100).toFixed(1)}%`,
      phase,
      timestamp: new Date().toISOString()
    });
    // Trigger context compression from Phase 7
    await compressContext();
  }

  async handleEscalation(utilization, phase) {
    console.error(`🚨 90% budget threshold - escalating to user via Telegram`);
    this.alerts.push({
      level: 'CRITICAL',
      threshold: '90%',
      action: 'Notify user via Telegram',
      utilization: `${(utilization * 100).toFixed(1)}%`,
      phase,
      timestamp: new Date().toISOString()
    });

    // Send Telegram notification
    if (this.telegramBot) {
      await this.telegramBot.telegram.sendMessage(
        process.env.TELEGRAM_OWNER_ID,
        `🚨 *Token Budget Alert*\n\n` +
        `90% threshold reached during ${phase}\n` +
        `Usage: ${this.currentUsage} / ${this.maxTokens} tokens\n\n` +
        `Options:\n` +
        `1. Continue (may fail if next phase is large)\n` +
        `2. Pause and checkpoint\n` +
        `3. Restart with fresh context`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  handleHalt(utilization, phase) {
    console.error(`🛑 100% budget limit reached - halting execution`);
    this.alerts.push({
      level: 'STOP',
      threshold: '100%',
      action: 'Halt execution, checkpoint state',
      utilization: `${(utilization * 100).toFixed(1)}%`,
      phase,
      timestamp: new Date().toISOString()
    });

    throw new Error(`Token budget exhausted (${this.currentUsage}/${this.maxTokens}). Checkpoint saved. Resume with fresh context.`);
  }
}
```

### Pattern 5: Real-time Dashboard with NDJSON Streaming

**What:** Stream EXECUTION_LOG.md updates via WebSocket to browser dashboard for real-time progress tracking

**When to use:** Production deployments where stakeholders monitor autonomous execution progress

**Example:**
```javascript
// Source: https://blog.openreplay.com/real-time-dashboards-nodejs/ - Real-time Node.js dashboards
// Source: https://apidog.com/blog/ndjson/ - NDJSON streaming over HTTP
const WebSocket = require('ws');
const fs = require('fs');
const { getHistory, getExecutionStats } = require('./execution-log.js');

// WebSocket server for dashboard
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('Dashboard connected');

  // Send current state immediately
  ws.send(JSON.stringify({
    type: 'initial_state',
    events: getHistory(process.cwd()),
    stats: getExecutionStats(process.cwd())
  }));

  // Watch EXECUTION_LOG.md for new events
  const logPath = '.planning/EXECUTION_LOG.md';
  let lastPosition = fs.statSync(logPath).size;

  const watcher = fs.watch(logPath, (eventType) => {
    if (eventType === 'change') {
      const currentSize = fs.statSync(logPath).size;

      if (currentSize > lastPosition) {
        // Read new content
        const stream = fs.createReadStream(logPath, {
          start: lastPosition,
          encoding: 'utf8'
        });

        let buffer = '';
        stream.on('data', (chunk) => {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line in buffer

          lines.forEach(line => {
            if (line.trim() && !line.startsWith('#')) {
              try {
                const event = JSON.parse(line);
                ws.send(JSON.stringify({ type: 'event', event }));
              } catch (err) {
                // Skip invalid JSON
              }
            }
          });
        });

        stream.on('end', () => {
          lastPosition = currentSize;
        });
      }
    }
  });

  ws.on('close', () => {
    console.log('Dashboard disconnected');
    watcher.close();
  });
});

// Simple HTTP server serving dashboard HTML
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>GSD Execution Dashboard</title>
        <style>
          body { font-family: monospace; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
          .event { padding: 10px; margin: 5px 0; background: #2d2d2d; border-left: 3px solid #007acc; }
          .phase_start { border-color: #4ec9b0; }
          .phase_complete { border-color: #b5cea8; }
          .phase_failed { border-color: #f48771; }
          .stats { position: fixed; top: 20px; right: 20px; background: #252526; padding: 15px; border: 1px solid #3c3c3c; }
        </style>
      </head>
      <body>
        <h1>🚀 GSD Autonomous Execution</h1>
        <div id="stats" class="stats">Loading...</div>
        <div id="events"></div>

        <script>
          const ws = new WebSocket('ws://localhost:8080');
          const eventsDiv = document.getElementById('events');
          const statsDiv = document.getElementById('stats');

          ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);

            if (data.type === 'initial_state') {
              data.events.forEach(renderEvent);
              updateStats(data.stats);
            } else if (data.type === 'event') {
              renderEvent(data.event);
            }
          };

          function renderEvent(event) {
            const div = document.createElement('div');
            div.className = 'event ' + event.type;
            div.innerHTML = \`
              <strong>[\${new Date(event.timestamp).toLocaleTimeString()}]</strong>
              <span>\${event.type}</span>
              \${event.phase ? ' - Phase ' + event.phase : ''}
              \${event.message ? '<br>' + event.message : ''}
            \`;
            eventsDiv.insertBefore(div, eventsDiv.firstChild);
          }

          function updateStats(stats) {
            statsDiv.innerHTML = \`
              <h3>📊 Statistics</h3>
              <p>Completed: \${stats.phases_completed}</p>
              <p>Failed: \${stats.phases_failed}</p>
              <p>Checkpoints: \${stats.checkpoint_count}</p>
            \`;
          }
        </script>
      </body>
      </html>
    `);
  }
});

server.listen(3000, () => {
  console.log('Dashboard: http://localhost:3000');
  console.log('WebSocket: ws://localhost:8080');
});
```

### Anti-Patterns to Avoid

- **Polling Telegram in production:** Webhook delays are noticeable, messages processed up to polling interval seconds later. Use webhooks with secretToken for security.
- **Large Whisper models by default:** Medium/large models require 3-10GB VRAM and process 4-8x slower. Start with base.en (244M params), upgrade only if accuracy insufficient.
- **Storing TELEGRAM_BOT_TOKEN in code:** Token grants full bot control. Use .env files (gitignored) or secret managers (AWS Secrets Manager, Azure Key Vault).
- **Blocking main thread during transcription:** Whisper CPU processing blocks event loop. Use worker threads or spawn child process for transcription.
- **Missing ffmpeg conversion:** Telegram voice messages are .oga (Opus codec). Whisper requires 16kHz .wav. Skipping conversion causes "invalid format" errors.
- **Capturing full LLM prompts in production traces:** gen_ai.prompt.* can contain sensitive data. Use events sparingly, rely on token metrics instead.
- **Single 100% budget threshold:** By the time 100% triggers, next operation fails. Graduated alerts (50/80/90/100) enable proactive intervention.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Telegram Bot API client | Custom HTTP requests to api.telegram.org | Telegraf / node-telegram-bot-api | Handle webhook security (secretToken), multipart file uploads, update handling, connection management, rate limiting (30 msg/sec to same user). |
| Speech-to-text model | Train custom ASR model | Whisper (via whisper-node) | OpenAI trained on 680k hours multilingual data, handles accents/noise/speed, 99%+ WER on clean audio. Custom models require massive datasets + GPU training. |
| Distributed tracing | Custom span/trace ID generation | OpenTelemetry SDK | W3C Trace Context standard, context propagation across services, sampling strategies, vendor-agnostic exporters, semantic conventions (gen_ai.*). |
| LLM cost calculation | Manual token counting + pricing tables | Langfuse / LiteLLM | Handle model-specific tokenizers (Claude uses different tokenizer than GPT), tiered pricing (Claude charges more after 200k input tokens), prompt caching discounts (90% off), batch pricing (50% off). |
| Audio format conversion | Custom codec implementation | ffmpeg (via fluent-ffmpeg) | Handle 100+ formats, resampling algorithms, codec parameters, metadata preservation, error recovery. Whisper requires exact 16kHz .wav - ffmpeg handles edge cases. |
| Real-time log streaming | Custom file watching + WebSocket | Built-in fs.watch + ws library | Handle file rotation, partial line reads, reconnection logic, backpressure. Pattern 5 provides production-ready implementation. |
| Token budget alerts | Manual threshold checks | Extend Phase 7 TokenBudgetMonitor | Graduated alerts require state tracking (which thresholds already passed), integration with multiple alert channels (logs, Telegram, dashboards), projection vs actual usage tracking. |

**Key insight:** Telegram bot security, audio processing, and LLM observability have hidden complexity. Telegraf handles webhook signature verification and rate limiting automatically. Whisper requires precise 16kHz .wav format with specific codec parameters. OpenTelemetry semantic conventions for LLMs (gen_ai.usage.input_tokens, gen_ai.system, etc.) are still evolving—using standard libraries ensures compatibility as conventions stabilize. Hand-rolling any of these invites security vulnerabilities (bot token exposure, webhook replay attacks), data loss (audio conversion failures), or vendor lock-in (proprietary tracing formats).

## Common Pitfalls

### Pitfall 1: Telegram File Size Limits Break Audio Downloads

**What goes wrong:** Bot fails to download voice messages with "Bad Request: file is too big" error

**Why it happens:** Telegram Bot API has **20MB download limit** for getFile endpoint. Voice messages sent by users can be up to 200MB (regular audio messages), but bots can only download files ≤20MB directly.

**How to avoid:**
- Check file size before downloading: `ctx.message.voice.file_size` (in bytes)
- For files >20MB: prompt user to send shorter clips or use Telegram's built-in file compression
- Alternative: forward large files to a dummy channel, download via Telegram Client API (not Bot API)

**Warning signs:**
- Error message contains "file is too big"
- Voice messages >1-2 minutes fail while short messages work
- file_size field shows >20971520 bytes (20MB)

### Pitfall 2: Webhook Cold Starts Cause Message Delays

**What goes wrong:** First message after inactivity takes 5-30 seconds to process on serverless platforms (AWS Lambda, Vercel, Heroku)

**Why it happens:** Serverless functions cold start when idle. Telegram webhook timeout is 60 seconds—if function takes >60s to respond, Telegram retries, causing duplicate message processing.

**How to avoid:**
- Use keep-alive pings: schedule cron job to hit webhook endpoint every 5 minutes
- Respond to Telegram immediately (200 OK), process async: `await ctx.reply('Got it!'); processInBackground(ctx);`
- For production: use always-on server (VPS, Railway.app, Fly.io) instead of serverless
- Set webhook with max_connections parameter to limit concurrent requests

**Warning signs:**
- First interaction each hour is slow
- Duplicate messages processed (webhook retries)
- Logs show function initialization time >2 seconds

### Pitfall 3: Whisper Model Download Fails Silently

**What goes wrong:** `npx whisper-node download` completes, but transcription fails with "model not found"

**Why it happens:** Default download location is `~/.cache/whisper`, but whisper-node may look in node_modules or project directory depending on configuration. Model files are 140MB-3GB, download can timeout/corrupt.

**How to avoid:**
- Verify download: check `ls ~/.cache/whisper` or `ls node_modules/whisper-node/lib/whisper.cpp/models`
- Specify model path explicitly: `whisper(audioFile, { modelPath: '/absolute/path/to/model.bin' })`
- For Docker deployments: download models during build, not runtime
- Use checksums to verify integrity: compare file size to official releases

**Warning signs:**
- Error: "Could not find model"
- Transcription returns empty array
- Model file size doesn't match expected (base.en should be ~140MB)

### Pitfall 4: OpenTelemetry Trace Context Lost Between Phases

**What goes wrong:** Each phase shows as separate trace instead of single parent trace across roadmap execution

**Why it happens:** Fresh sub-coordinator spawns don't inherit trace context from parent coordinator. OpenTelemetry context propagation requires explicit passing via environment variables or HTTP headers.

**How to avoid:**
- Export trace context before spawning: `const traceParent = trace.getActiveSpan()?.spanContext()`
- Pass to sub-coordinator: `TRACEPARENT=00-${traceId}-${spanId}-01 node execute-phase.js`
- Restore in sub-coordinator: `propagation.extract(context.active(), { traceparent: process.env.TRACEPARENT })`
- Alternative: use distributed tracing via HTTP (execute-phase as microservice with trace headers)

**Warning signs:**
- Jaeger/Zipkin shows disconnected traces per phase
- Parent span missing in trace visualization
- trace_id changes between phase_start events in EXECUTION_LOG.md

### Pitfall 5: Langfuse Cost Calculation Wrong for Cached Prompts

**What goes wrong:** Token costs are 10x higher than actual Claude API billing

**Why it happens:** Claude's prompt caching gives **90% discount** on cached input tokens. Langfuse calculates cost as `(input_tokens * $5) + (output_tokens * $25)` but doesn't account for cache_read_input_tokens field in Claude API response.

**How to avoid:**
- Use ingestion approach (not inference): pass `usage_details` from Claude response to Langfuse
- Extract cache metrics: `response.usage.cache_read_input_tokens` + `cache_creation_input_tokens`
- Calculate correct cost:
  ```javascript
  const inputCost = (input_tokens - cache_read_tokens) * inputPrice + (cache_read_tokens * inputPrice * 0.1);
  ```
- Langfuse model definitions support pricing tiers—verify cache pricing is configured

**Warning signs:**
- Langfuse dashboard shows 5-10x higher cost than Claude console
- Cost doesn't decrease for repeated prompts (caching not detected)
- usage_details missing cache_read_input_tokens field

### Pitfall 6: Graduated Alerts Trigger Multiple Times

**What goes wrong:** 80% alert fires on every recordUsage call after threshold crossed, spamming Telegram

**Why it happens:** Token monitor checks thresholds on each usage record but doesn't track which alerts already sent. 90% threshold crossed → Telegram message every 500 tokens.

**How to avoid:**
- Track fired alerts: `this.thresholdsPassed = new Set(['early_warning', 'compression_trigger'])`
- Check before alerting: `if (!this.thresholdsPassed.has('escalation')) { ... }`
- Persist state: save thresholdsPassed to token_budget.json for resume scenarios
- Reset on new session: clear thresholdsPassed when starting new roadmap execution

**Warning signs:**
- Telegram flooded with duplicate "90% threshold" messages
- Alert count in token report >> 4 (should be max 4: 50/80/90/100)
- User receives alerts during every phase after 80% crossed

## Code Examples

Verified patterns from official sources.

### Telegram Webhook Setup (Production)

```javascript
// Source: https://telegraf.js.org/ - Official webhook configuration
const { Telegraf } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const app = express();

// Webhook endpoint (Telegram POSTs updates here)
app.use(await bot.createWebhook({
  domain: process.env.WEBHOOK_DOMAIN,        // e.g., 'bot.example.com'
  path: '/telegram-webhook',
  secretToken: process.env.WEBHOOK_SECRET    // Verify request authenticity
}));

app.listen(3000, () => {
  console.log('Webhook server listening on port 3000');
});

// Message handlers
bot.command('start', (ctx) => ctx.reply('Bot started. Send me questions!'));
bot.on('message', (ctx) => {
  console.log('Received:', ctx.message);
});
```

### OpenTelemetry Initialization with LLM Instrumentation

```javascript
// Source: https://opentelemetry.io/docs/languages/js/exporters/
// Source: https://github.com/traceloop/openllmetry
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'gsd-autonomous-execution',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4317', // Jaeger OTLP endpoint
  }),
});

sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
```

### Token Usage Recording with Cost Calculation

```javascript
// Source: https://langfuse.com/docs/observability/features/token-and-cost-tracking
const { Langfuse } = require('langfuse');
const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
});

async function recordLLMUsage(response, metadata) {
  const generation = langfuse.generation({
    name: metadata.operation,
    model: metadata.model,
    modelParameters: {
      temperature: metadata.temperature,
      maxTokens: metadata.maxTokens,
    },
    input: metadata.prompt, // Optional - disable in prod for privacy
    output: response.content,
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      total: response.usage.input_tokens + response.usage.output_tokens,
      // Claude-specific cache fields
      inputCost: calculateInputCost(response.usage),
      outputCost: (response.usage.output_tokens / 1000000) * 25, // $25/1M for Opus
      totalCost: calculateInputCost(response.usage) + ((response.usage.output_tokens / 1000000) * 25),
    },
    metadata: {
      phase: metadata.phase,
      plan: metadata.plan,
      trace_id: metadata.traceId,
    }
  });

  await generation.finalize();
}

function calculateInputCost(usage) {
  // Claude Opus 4.5: $5/1M base, $0.50/1M cached (90% discount)
  const baseTokens = usage.input_tokens - (usage.cache_read_input_tokens || 0);
  const cachedTokens = usage.cache_read_input_tokens || 0;

  const baseCost = (baseTokens / 1000000) * 5;
  const cachedCost = (cachedTokens / 1000000) * 0.5;

  return baseCost + cachedCost;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual token counting + hardcoded prices | Langfuse tokenizer inference + tiered pricing | 2024-2025 | Claude introduced tiered pricing (200k threshold), prompt caching (90% discount), batch API (50% off). Manual tracking missed these discounts → 10x cost overestimation. |
| Separate tracing tools per provider | OpenTelemetry gen_ai.* semantic conventions | 2024 (stable in 2026) | Unified observability across OpenAI, Anthropic, Cohere, etc. Single exporter → Jaeger/Datadog/Honeycomb. Before: vendor-specific SDKs → lock-in. |
| Long polling for Telegram bots | Webhook with secretToken | 2023+ (Bot API 6.0+) | Webhooks 10-100x faster (no polling interval), secretToken prevents replay attacks. Polling still useful for local dev, but production = webhooks. |
| Whisper API calls | Local whisper-node (C++ bindings) | 2023+ | Whisper API: $0.006/min, 25MB limit, latency. Local: free, unlimited, <100ms for short clips, privacy (no data leaves server). Tradeoff: setup complexity, VRAM requirements. |
| Single 100% budget alert | Graduated alerts (50/80/90/100) | 2025+ (cloud billing standard) | By 100%, next operation fails. Graduated: 50% early warning, 80% compress context, 90% escalate user, 100% halt. Prevents mid-execution crashes. AWS/GCP/Azure all use graduated budgets. |

**Deprecated/outdated:**
- **@opentelemetry/exporter-jaeger**: Deprecated in favor of @opentelemetry/exporter-otlp-grpc (Jaeger now supports OTLP natively)
- **Whisper large-v2**: Superseded by large-v3 (Feb 2024) with 2.7% WER vs 3.1% on LibriSpeech
- **node-telegram-bot-api polling only**: Still works, but Telegraf is modern standard (better TypeScript, async/await, webhooks)
- **Manual trace context propagation**: OpenTelemetry auto-instrumentation now handles most cases via @opentelemetry/auto-instrumentations-node

## Open Questions

1. **Telegram conversation state persistence**
   - What we know: In-memory Map works for single user, loses state on restart
   - What's unclear: Best storage for multi-user bots (SQLite? Redis? Knowledge DB?)
   - Recommendation: Start with in-memory (single user = TELEGRAM_OWNER_ID), add SQLite persistence if restart/resume required. Pattern: questionId → knowledge DB as ephemeral memory.

2. **Whisper model selection for non-English audio**
   - What we know: base.en is English-only, base is multilingual (same 74M params)
   - What's unclear: Performance difference for English audio (multilingual vs English-only)
   - Recommendation: Use base.en for English users (better accuracy). If multilingual needed, use base (same speed, slightly lower English accuracy). Test with sample audio.

3. **OpenTelemetry sampling strategy for high-volume execution**
   - What we know: Tracing every LLM call generates massive telemetry (10k+ spans per roadmap)
   - What's unclear: Optimal sampling rate (trace 1%, 10%, 100%? Always trace errors?)
   - Recommendation: Start with 100% sampling (full visibility), add tail-based sampling if backend overwhelmed. Pattern: always trace errors + 10% success.

4. **Token savings calculation methodology**
   - What we know: Compare auto mode vs fixed profile, but how to measure "same work"?
   - What's unclear: Baseline - should comparison be same phase with Opus-only? Same output quality?
   - Recommendation: Define baseline as "Opus for all operations" (no routing), measure auto mode (quality/balanced/budget routing), report % savings. Caveat: quality may differ.

5. **Graduated alert 50% threshold too early?**
   - What we know: 50% (100k tokens) triggers early in roadmap execution (phase 3-4 of 8)
   - What's unclear: Useful signal vs alert fatigue?
   - Recommendation: Test with 60% first warning (120k tokens), adjust based on feedback. Goal: ~2 phases warning before 80% compression trigger.

## Sources

### Primary (HIGH confidence)

- **Telegraf Documentation**: https://telegraf.js.org/ - Official framework docs, webhook setup, message handling
- **Telegraf GitHub**: https://github.com/telegraf/telegraf - Modern Telegram Bot Framework, v4.16.3, full Bot API 7.1 support
- **whisper-node GitHub**: https://github.com/ariym/whisper-node - Node.js bindings for OpenAI Whisper (C++ port), installation, usage, model requirements
- **OpenTelemetry LLM Observability**: https://opentelemetry.io/blog/2024/llm-observability/ - Official guide on instrumenting LLM applications
- **OpenTelemetry Semantic Conventions**: https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/ - gen_ai.* attributes for LLM tracing
- **Langfuse Token Tracking**: https://langfuse.com/docs/observability/features/token-and-cost-tracking - Claude-specific cost calculation, tiered pricing support
- **OpenLLMetry GitHub**: https://github.com/traceloop/openllmetry - LLM instrumentation library, Anthropic support
- **OpenTelemetry Exporters**: https://opentelemetry.io/docs/languages/js/exporters/ - Official Node.js exporter configuration

### Secondary (MEDIUM confidence)

- **Google Cloud Budget Alerts**: https://cloud.google.com/billing/docs/how-to/budgets - Graduated threshold patterns (50/90/100 defaults)
- **Telegram Limits**: https://limits.tginfo.me/en - File size limits, rate limits, API constraints
- **Whisper Model Comparison**: https://whisper-api.com/blog/models/ - Model size vs accuracy tradeoff analysis
- **NDJSON Streaming**: https://apidog.com/blog/ndjson/ - NDJSON format for log streaming over HTTP
- **Real-time Dashboards Node.js**: https://blog.openreplay.com/real-time-dashboards-nodejs/ - WebSocket + Node.js patterns
- **Telegraf Webhook Setup**: https://shashwatv.com/telegram-bot-webhook-setup-nodejs-telegraf/ - Production deployment guide
- **OpenTelemetry Node.js Tracing**: https://betterstack.com/community/guides/observability/opentelemetry-nodejs-tracing/ - Distributed tracing setup

### Tertiary (LOW confidence - community sources)

- **Telegram Bot Speech-to-Text Examples**: https://github.com/soberhacker/telegram-speech-recognition-bot - Community implementations (Python, not Node.js)
- **Node.js Telegram Conversations**: https://levelup.gitconnected.com/creating-a-conversational-telegram-bot-in-node-js-with-a-finite-state-machine-and-async-await-ca44f03874f9 - FSM pattern for conversation state

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Telegraf, whisper-node, OpenTelemetry are documented, production-tested, official libraries
- Architecture patterns: HIGH - Patterns verified against official docs, existing Phase 6/7 infrastructure, OpenTelemetry semantic conventions
- Pitfalls: MEDIUM - File size limits, cold starts, model downloads verified. Trace context propagation and cache cost calculations need production validation.
- Token savings calculation: LOW - Methodology unclear (what's baseline?), needs stakeholder definition

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days - relatively stable domain, but OpenTelemetry gen_ai.* conventions still evolving)

**Integration notes:**
- Phase 7 foundation: Extends TokenBudgetMonitor with graduated alerts, integrates with existing token_budget.json
- Phase 6 foundation: Streams EXECUTION_LOG.md (already NDJSON), adds trace_id/span_id fields to events
- Phase 3 foundation: Could store Telegram conversation state in knowledge DB (ephemeral memories), but in-memory Map sufficient for single-user bot

**Production deployment checklist:**
- [ ] Telegram webhook domain with HTTPS (not HTTP - Telegram requires TLS)
- [ ] TELEGRAM_BOT_TOKEN in secret manager (not .env file in repo)
- [ ] ffmpeg installed on server (`apt install ffmpeg` or Docker image with ffmpeg)
- [ ] Whisper model downloaded during build (not runtime) for Docker deployments
- [ ] OpenTelemetry exporter endpoint configured (Jaeger/Zipkin/Grafana)
- [ ] Langfuse API keys for cost tracking
- [ ] WebSocket dashboard port exposed (8080) if remote monitoring needed
- [ ] Graduated alert thresholds tuned (start 60/80/90/100, adjust based on average phase token usage)
