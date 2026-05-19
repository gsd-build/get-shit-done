---
type: Added
pr: 3081
---
review.max_prompt_tokens and review.max_prompt_tokens_per_reviewer config keys auto-trim assembled review prompts to fit small-context local model servers (ollama, llama.cpp, lm-studio), with deterministic trim policy (drop CONTEXT → RESEARCH → REQUIREMENTS; head-shrink PROJECT.md; tail-truncate PLANs proportionally), trim metadata in REVIEWS.md frontmatter, and a reviewer-visible disclosure note when trimming occurs.
