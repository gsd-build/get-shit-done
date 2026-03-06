---
layout: default
title: Home
---

# Get Shit Done

**A meta-prompting system for Claude Code that actually ships software.**

Stop wrestling with context rot. Stop watching Claude lose track of what it's building. GSD is a context engineering layer that makes Claude Code reliable—so you can describe what you want and have it built correctly, consistently, and at scale.

<div class="terminal-preview">
  {% include terminal.html %}
</div>

```bash
npx get-shit-done-cc
```

<div class="badges">
  <a href="https://www.npmjs.com/package/get-shit-done-cc"><img src="https://img.shields.io/npm/v/get-shit-done-cc?style=flat-square&color=CB3837" alt="npm version"></a>
  <a href="https://github.com/glittercowboy/get-shit-done"><img src="https://img.shields.io/github/stars/glittercowboy/get-shit-done?style=flat-square&color=181717" alt="GitHub stars"></a>
  <a href="https://www.npmjs.com/package/get-shit-done-cc"><img src="https://img.shields.io/npm/dm/get-shit-done-cc?style=flat-square&color=CB3837" alt="npm downloads"></a>
</div>

---

## The Problem

Claude Code is powerful. But extended sessions degrade. Context fills up. Quality drops. You end up hand-holding an AI that forgets what it was doing three tasks ago.

**Context rot is real.** The longer Claude works, the worse it gets.

## The Solution

GSD solves context rot through **spec-driven development** and **context engineering**:

- **Plans are prompts.** Every task is an executable prompt with clear objectives, file references, and success criteria
- **Atomic execution.** 2-3 tasks per plan. Complete before context degrades
- **Fresh contexts.** Subagents spawn with full 200k windows for heavy lifting
- **Structured artifacts.** PROJECT.md, REQUIREMENTS.md, ROADMAP.md—Claude always knows what's happening

<div class="testimonials">
  <p>"If you know clearly what you want, this WILL build it for you. No bs."</p>
  <p>"I've done SpecKit, OpenSpec and Taskmaster — this has produced the best results for me."</p>
  <p>"By far the most powerful addition to my Claude Code. Nothing over-engineered. Literally just gets shit done."</p>
</div>

---

## How It Works

<div class="workflow-steps" markdown="1">

**1. Define** → `/gsd:new-project`
Deep questioning about goals, constraints, and tech. Creates PROJECT.md, REQUIREMENTS.md, and ROADMAP.md.

**2. Plan** → `/gsd:plan-phase`
Research implementation approaches. Break into atomic tasks. Generate executable PLAN.md files.

**3. Execute** → `/gsd:execute-phase`
Claude builds each plan with fresh context. Atomic commits per task. Verification at each step.

**4. Verify** → `/gsd:verify-work`
User acceptance testing. Automated checks. Fix plans if issues found.

**5. Ship** → `/gsd:complete-milestone`
Tag release. Archive artifacts. Start fresh for next version.

</div>

---

## Who It's For

**Solo developers** who want to describe ideas clearly and have them built properly—without pretending they're managing a 50-person org.

No enterprise bullshit. No story points. No sprint ceremonies. No RACI matrices.

Just you, Claude, and a lightweight system optimized for shipping.

---

## Trusted By

Engineers at **Amazon**, **Google**, **Shopify**, and **Webflow**.

---

## Get Started

```bash
# Install GSD
npx get-shit-done-cc

# Start a new project
/gsd:new-project
```

[Getting Started Guide →](/getting-started)

---

## Links

- [GitHub Repository](https://github.com/glittercowboy/get-shit-done)
- [How It Works](/how-it-works)
- [Commands Reference](/commands)
- [Philosophy](/philosophy)
