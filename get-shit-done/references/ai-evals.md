# AI Evaluation Reference

> Reference used by `gsd-eval-planner` and `gsd-eval-auditor`.
> Based on "AI Evals for Everyone" course (Reganti & Badam) + industry practice.

---

## Core Concepts

### Why Evals Exist
AI systems are non-deterministic. Input X does not reliably produce output Y across runs, users, or edge cases. Evals are the continuous process of assessing whether your system's behavior meets expectations under real-world conditions — unit tests and integration tests alone are insufficient.

### Model vs. Product Evaluation
- **Model evals** (MMLU, HumanEval, GSM8K) — measure general capability in standardized conditions. Use as initial filter only.
- **Product evals** — measure behavior inside your specific system, with your data, your users, your domain rules. This is where 80% of eval effort belongs.

### The Three Components of Every Eval
- **Input** — everything affecting the system: query, history, retrieved docs, system prompt, config
- **Expected** — what good behavior looks like, defined through rubrics
- **Actual** — what the system produced, including intermediate steps, tool calls, and reasoning traces

### Three Measurement Approaches
1. **Code-based metrics** — deterministic checks: JSON validation, required disclaimers, performance thresholds, classification flags. Fast, cheap, reliable. Use first.
2. **LLM judges** — one model evaluates another against a rubric. Powerful for subjective qualities (tone, reasoning, escalation). Requires calibration against human judgment before trusting.
3. **Human evaluation** — gold standard for nuanced judgment. Doesn't scale. Use for calibration, edge cases, periodic sampling, and high-stakes decisions.

Most effective systems combine all three.

---

## Evaluation Dimensions

### Pre-Deployment (Development Phase)

| Dimension | What It Measures | When It Matters |
|-----------|-----------------|-----------------|
| **Factual accuracy** | Correctness of claims against ground truth | RAG, knowledge bases, any factual assertions |
| **Context faithfulness** | Response grounded in provided context vs. fabricated | RAG pipelines, document Q&A, retrieval-augmented systems |
| **Hallucination detection** | Plausible but unsupported claims | All generative systems, high-stakes domains |
| **Escalation accuracy** | Correct identification of when human intervention needed | Customer service, healthcare, financial advisory |
| **Policy compliance** | Adherence to business rules, legal requirements, disclaimers | Regulated industries, enterprise deployments |
| **Tone/style appropriateness** | Match with brand voice, audience expectations, emotional context | Customer-facing systems, content generation |
| **Output structure validity** | Schema compliance, required fields, format correctness | Structured extraction, API integrations, data pipelines |
| **Task completion** | Whether the system accomplished the stated goal | Agentic workflows, multi-step tasks |
| **Tool use correctness** | Correct selection and invocation of tools | Agent systems with tool calls |
| **Safety** | Absence of harmful, biased, or inappropriate outputs | All user-facing systems |

### Production Monitoring

| Dimension | Monitoring Approach |
|-----------|---------------------|
| **Safety violations** | Online guardrail — real-time, immediate intervention |
| **Compliance failures** | Online guardrail — block or escalate before user sees output |
| **Quality degradation trends** | Offline flywheel — batch analysis of sampled interactions |
| **Emerging failure modes** | Signal-metric divergence — when user behavior signals diverge from metric scores, investigate manually |
| **Cost/latency drift** | Code-based metrics — automated threshold alerts |

---

## The Guardrail vs. Flywheel Decision

Ask: "If this behavior goes wrong, would it be catastrophic for my business?"

- **Yes → Guardrail** — run online, real-time, with immediate intervention (block, escalate, hand off). Be selective: guardrails add latency.
- **No → Flywheel** — run offline as batch analysis feeding system refinements over time.

---

## Rubric Design

Generic metrics are meaningless without context. "Helpfulness" in real estate means summarizing listings clearly. In healthcare it means knowing when *not* to answer.

A rubric must define:
1. The dimension being measured
2. What scores 1, 3, and 5 on a 5-point scale (or pass/fail criteria)
3. Domain-specific examples of acceptable vs. unacceptable behavior

Without rubrics, LLM judges produce noise rather than signal.

---

## Reference Dataset Guidelines

- Start with **10-20 high-quality examples** — not 200 mediocre ones
- Cover: critical success scenarios, common user workflows, known edge cases, historical failure modes
- Have domain experts label the examples (not just engineers)
- Expand based on what you learn in production — don't build for hypothetical coverage

---

## Eval Tooling Guide

| Tool | Type | Best For | Key Strength |
|------|------|----------|-------------|
| **RAGAS** | Python library | RAG evaluation | Purpose-built metrics: faithfulness, answer relevance, context precision/recall |
| **Langfuse** | Platform (open-source, self-hostable) | All system types | Strong tracing, prompt management, good for teams wanting infrastructure control |
| **LangSmith** | Platform (commercial) | LangChain/LangGraph ecosystems | Tightest integration with LangChain; best if already in that ecosystem |
| **Arize Phoenix** | Platform (open-source + hosted) | RAG + multi-agent tracing | Strong RAG eval + trace visualization; open-source with hosted option |
| **Braintrust** | Platform (commercial) | Model-agnostic evaluation | Dataset and experiment management; good for comparing across frameworks |
| **Promptfoo** | CLI tool (open-source) | Prompt testing, CI/CD | CLI-first, excellent for CI/CD prompt regression testing |

### Tool Selection by System Type

| System Type | Recommended Tooling |
|-------------|---------------------|
| RAG / Knowledge Q&A | RAGAS + Arize Phoenix or Braintrust |
| Multi-agent systems | Langfuse + Arize Phoenix |
| Conversational / single-model | Promptfoo + Braintrust |
| Structured extraction | Promptfoo + code-based validators |
| LangChain/LangGraph projects | LangSmith (native integration) |
| Production monitoring (all types) | Langfuse, Arize Phoenix, or LangSmith |

---

## Evals in the Development Lifecycle

### Plan Phase (Evaluation-Aware Design)
Before writing code, define:
1. What type of AI system is being built → determines framework and dominant eval concerns
2. Critical failure modes (3-5 behaviors that cannot go wrong)
3. Rubrics — explicit definitions of acceptable/unacceptable behavior per dimension
4. Evaluation strategy — which dimensions use code metrics, LLM judges, or human review
5. Reference dataset requirements — size, composition, labeling approach
6. Eval tooling selection

Output: EVALS-SPEC section of AI-SPEC.md

### Execute Phase (Instrument While Building)
- Add tracing from day one (Langfuse, Arize Phoenix, or LangSmith)
- Build reference dataset concurrently with implementation
- Implement code-based checks first; add LLM judges only for subjective dimensions
- Run evals in CI/CD via Promptfoo or Braintrust

### Verify Phase (Pre-Deployment Validation)
- Run full reference dataset against all metrics
- Conduct human review of edge cases and LLM judge disagreements
- Calibrate LLM judges against human scores (target ≥ 0.7 correlation before trusting)
- Define and configure production guardrails
- Establish monitoring baseline

### Monitor Phase (Production Evaluation Loop)
- Smart sampling — weight toward interactions with concerning signals (retries, unusual length, explicit escalations)
- Online guardrails on every interaction
- Offline flywheel on sampled batch
- Watch for signal-metric divergence — the early warning system for evaluation gaps

---

## Common Pitfalls

1. **Assuming benchmarks predict product success** — they don't; model evals are a filter, not a verdict
2. **Engineering evals in isolation** — domain experts must co-define rubrics; engineers alone miss critical nuances
3. **Building comprehensive coverage on day one** — start small (10-20 examples), expand from real failure modes
4. **Trusting uncalibrated LLM judges** — validate against human judgment before relying on them
5. **Measuring everything** — only track metrics that drive decisions; "collect it all" produces noise
6. **Treating evaluation as one-time setup** — user behavior evolves, requirements change, failure modes emerge; evaluation is continuous
