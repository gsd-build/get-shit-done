# Manual: Auto-Advance Workflow Progression

Guia para aplicar as mudanças que fazem o auto-advance funcionar end-to-end.

## Problema

O auto-advance (`workflow.auto_advance` / flag `--auto`) existia mas **quebrava na transição entre fases**. O `transition.md` usava `SlashCommand()` para invocar a próxima fase, mas `SlashCommand` **não funciona dentro de Task subagents**. Resultado: a cadeia parava no final de cada fase.

## Solução

Substituir todas as chamadas `SlashCommand()` por spawns `Task()` com referência direta aos arquivos de workflow. Além disso, remover o `--no-transition` do spawn de execute-phase para que a cadeia continue através do transition automaticamente.

### Cadeia completa após as mudanças:

```
discuss-phase --auto
  └→ spawna plan-phase como Task()
       └→ spawna execute-phase como Task() (COM --auto, SEM --no-transition)
            └→ roda transition.md inline
                 └→ spawna discuss-phase(next) ou plan-phase(next) como Task()
                      └→ ... repete até milestone acabar ou erro/gap parar a cadeia
```

---

## Arquivo 1: `get-shit-done/bin/lib/config.cjs`

### O que mudar
Adicionar `auto_advance: false` nos defaults hardcoded do workflow.

### Localização
Dentro da função `cmdConfigEnsureSection`, no objeto `hardcoded.workflow`.

### Antes
```js
workflow: {
  research: true,
  plan_check: true,
  verifier: true,
  nyquist_validation: false,
},
```

### Depois
```js
workflow: {
  research: true,
  plan_check: true,
  verifier: true,
  auto_advance: false,
  nyquist_validation: false,
},
```

### Por quê
Sem isso, `config-get workflow.auto_advance` retorna "Key not found" em projetos novos. O default precisa existir no código, não só no template JSON.

---

## Arquivo 2: `get-shit-done/workflows/transition.md`

### Mudança A: Route A (yolo mode) — Próxima fase com CONTEXT.md

#### Localização
Dentro de `<if mode="yolo">`, bloco **"If CONTEXT.md exists"**.

#### Antes
```
Exit skill and invoke SlashCommand("/gsd:plan-phase [X+1] --auto")
```

#### Depois
```markdown
Spawn plan-phase as Task with direct workflow file reference (do NOT use Skill tool or SlashCommand — they don't resolve inside Task subagents):

Task(
  prompt="
    <objective>
    You are the plan-phase orchestrator. Create executable plans for Phase ${NEXT_PHASE}: ${NEXT_PHASE_NAME}, then auto-advance to execution.
    </objective>

    <execution_context>
    @~/.claude/get-shit-done/workflows/plan-phase.md
    @~/.claude/get-shit-done/references/ui-brand.md
    @~/.claude/get-shit-done/references/model-profile-resolution.md
    </execution_context>

    <arguments>
    PHASE=${NEXT_PHASE}
    ARGUMENTS='${NEXT_PHASE} --auto'
    </arguments>

    <instructions>
    1. Read plan-phase.md from execution_context for your complete workflow
    2. Follow ALL steps: initialize, validate, load context, research, plan, verify, auto-advance
    3. The --auto flag means: after planning completes, spawn execute-phase as a Task
    4. When spawning agents (gsd-phase-researcher, gsd-planner, gsd-plan-checker), use Task with specified subagent_type and model
    5. For auto-advance to execute: spawn execute-phase as a Task with DIRECT file reference. Include @file refs to execute-phase.md, checkpoints.md, tdd.md, model-profile-resolution.md. Pass --auto flag (NOT --no-transition) so the chain continues after execution.
    6. Do NOT use the Skill tool or /gsd: commands. Read workflow .md files directly.
    7. Return: PHASE COMPLETE, PLANNING COMPLETE, PLANNING INCONCLUSIVE, or GAPS FOUND
    </instructions>
  ",
  subagent_type="general-purpose",
  description="Plan Phase ${NEXT_PHASE}"
)
```

---

### Mudança B: Route A (yolo mode) — Próxima fase SEM CONTEXT.md

#### Localização
Dentro de `<if mode="yolo">`, bloco **"If CONTEXT.md does NOT exist"**.

#### Antes
```
Exit skill and invoke SlashCommand("/gsd:discuss-phase [X+1] --auto")
```

#### Depois
```markdown
Spawn discuss-phase as Task with direct workflow file reference (do NOT use Skill tool or SlashCommand — they don't resolve inside Task subagents):

Task(
  prompt="
    <objective>
    You are the discuss-phase orchestrator. Gather implementation context for Phase ${NEXT_PHASE}: ${NEXT_PHASE_NAME}, then auto-advance to planning and execution.
    </objective>

    <execution_context>
    @~/.claude/get-shit-done/workflows/discuss-phase.md
    </execution_context>

    <arguments>
    PHASE=${NEXT_PHASE}
    ARGUMENTS='${NEXT_PHASE} --auto'
    </arguments>

    <instructions>
    1. Read discuss-phase.md from execution_context for your complete workflow
    2. Follow ALL steps: initialize, check_existing, scout_codebase, analyze_phase, present_gray_areas, discuss_areas, write_context
    3. The --auto flag means: after context is captured, spawn plan-phase as a Task (see auto_advance step in discuss-phase.md)
    4. For checkpoint handling in auto mode: auto-approve human-verify checkpoints, auto-select first option for decision checkpoints, present human-action checkpoints to user
    5. Do NOT use the Skill tool or /gsd: commands. Read workflow .md files directly.
    6. Return: PHASE COMPLETE (full chain succeeded), CONTEXT CAPTURED (discuss done, downstream failed), or DISCUSSION BLOCKED
    </instructions>
  ",
  subagent_type="general-purpose",
  description="Discuss Phase ${NEXT_PHASE}"
)

**Handle Task return:**
- **PHASE COMPLETE** → Display: `Auto-advance pipeline finished for Phase ${NEXT_PHASE}. Next: /gsd:progress`
- **PLANNING COMPLETE / CONTEXT CAPTURED** → Display partial status and manual next step
- **GAPS FOUND** → Display gaps, stop chain: `/gsd:plan-phase ${NEXT_PHASE} --gaps`
```

---

### Mudança C: Route B (yolo mode) — Milestone complete

#### Localização
Dentro de `<if mode="yolo">`, bloco de milestone complete (Route B).

#### Antes
```
Exit skill and invoke SlashCommand("/gsd:complete-milestone {version}")
```

#### Depois
```markdown
Spawn complete-milestone as Task with direct workflow file reference (do NOT use Skill tool or SlashCommand — they don't resolve inside Task subagents):

Task(
  prompt="
    <objective>
    Complete milestone {version}. Archive planning artifacts and prepare for next milestone.
    </objective>

    <execution_context>
    @~/.claude/get-shit-done/workflows/complete-milestone.md
    </execution_context>

    <arguments>
    ARGUMENTS='{version}'
    </arguments>

    <instructions>
    1. Read complete-milestone.md from execution_context for your complete workflow
    2. Follow ALL steps to archive the milestone
    3. Do NOT use the Skill tool or /gsd: commands. Read workflow .md files directly.
    4. Return: MILESTONE COMPLETE or MILESTONE BLOCKED
    </instructions>
  ",
  subagent_type="general-purpose",
  description="Complete Milestone {version}"
)

**Handle Task return:**
- **MILESTONE COMPLETE** → Display: `Milestone {version} archived. Run /gsd:new-milestone to start the next cycle.`
- **MILESTONE BLOCKED** → Display blocker and manual next step
```

---

## Arquivo 3: `get-shit-done/workflows/plan-phase.md`

### O que mudar
No step 14 (Auto-Advance Check), o spawn de execute-phase precisa de 4 ajustes:
1. Objetivo agora inclui "then transition to the next phase automatically"
2. Adicionar `transition.md` ao `execution_context`
3. Trocar `--auto --no-transition` por apenas `--auto`
4. Atualizar instruções para refletir cadeia completa
5. Atualizar return handling para incluir MILESTONE COMPLETE

### Antes (bloco Task do execute-phase)
```
<objective>
You are the execute-phase orchestrator. Execute all plans for Phase ${PHASE}: ${PHASE_NAME}.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/references/checkpoints.md
...
</execution_context>

<arguments>
PHASE=${PHASE}
ARGUMENTS='${PHASE} --auto --no-transition'
</arguments>

<instructions>
...
3. The --no-transition flag means: after verification + roadmap update, STOP and return status. Do NOT run transition.md.
...
7. Do NOT use the Skill tool or /gsd: commands
</instructions>
```

### Depois
```
<objective>
You are the execute-phase orchestrator. Execute all plans for Phase ${PHASE}: ${PHASE_NAME}, then transition to the next phase automatically.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-phase.md
@~/.claude/get-shit-done/workflows/transition.md
@~/.claude/get-shit-done/references/checkpoints.md
...
</execution_context>

<arguments>
PHASE=${PHASE}
ARGUMENTS='${PHASE} --auto'
</arguments>

<instructions>
...
2. Follow ALL steps: initialize, handle_branching, validate_phase, discover_and_group_plans, execute_waves, aggregate_results, close_parent_artifacts, verify_phase_goal, update_roadmap, offer_next
3. The --auto flag WITHOUT --no-transition means: after verification + roadmap update, run transition.md inline, which will spawn the next phase as a Task() automatically
...
7. Do NOT use the Skill tool or /gsd: commands. Read workflow .md files directly.
8. The auto-advance chain continues through transition → discuss/plan next phase → execute next phase → ... until milestone completes or an error/gap stops it
</instructions>
```

### Return handling — Antes
```
- **PHASE COMPLETE** → "Auto-advance pipeline finished. Next: /gsd:discuss-phase ${NEXT_PHASE} --auto"
```

### Return handling — Depois
```
- **PHASE COMPLETE** or **MILESTONE COMPLETE** → "GSD ► AUTO-ADVANCE PIPELINE COMPLETE ✓ ... Run /gsd:progress to see current status."
```

---

## Arquivo 4: `get-shit-done/workflows/discuss-phase.md`

### Mudança A: Instruções do Task spawn (step auto_advance)

#### Antes (instrução 4)
```
4. For step 14 (auto-advance to execute): spawn execute-phase as a Task with DIRECT file reference — tell it to read execute-phase.md. Include @file refs to execute-phase.md, checkpoints.md, tdd.md, model-profile-resolution.md. Pass --no-transition flag so execute-phase returns results instead of chaining further.
```

#### Depois
```
4. For step 14 (auto-advance to execute): spawn execute-phase as a Task with DIRECT file reference — tell it to read execute-phase.md. Include @file refs to execute-phase.md, transition.md, checkpoints.md, tdd.md, model-profile-resolution.md. Pass --auto flag (NOT --no-transition) so the full chain continues: execute → transition → next phase discuss/plan/execute automatically.
```

#### Antes (instrução 6)
```
6. Return: PHASE COMPLETE (full pipeline success), PLANNING COMPLETE (planning done but execute failed/skipped), PLANNING INCONCLUSIVE, or GAPS FOUND
```

#### Depois
```
6. Return: PHASE COMPLETE (current phase done), MILESTONE COMPLETE (all phases done), PLANNING COMPLETE (planning done but execute failed/skipped), PLANNING INCONCLUSIVE, or GAPS FOUND
```

### Mudança B: Return handling

#### Antes
```
- **PHASE COMPLETE** → Full chain succeeded. Display: "GSD ► PHASE ${PHASE} COMPLETE ... Auto-advance pipeline finished: discuss → plan → execute ... Next: /gsd:discuss-phase ${NEXT_PHASE} --auto"
```

#### Depois
```
- **PHASE COMPLETE** or **MILESTONE COMPLETE** → Full auto-advance chain succeeded. Display: "GSD ► AUTO-ADVANCE PIPELINE COMPLETE ✓ ... [Include details from plan-phase return] ... Run /gsd:progress to see current status."
```

---

## Arquivo 5: `get-shit-done/workflows/progress.md`

### Mudança A: Route A — Adicionar check de auto-advance config

#### Localização
No **Route A** (Unexecuted plan exists), antes do bloco de output.

#### Adicionar (antes do bloco de template)
```markdown
Check auto-advance config:
\`\`\`bash
AUTO_CFG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-get workflow.auto_advance 2>/dev/null || echo "false")
\`\`\`
```

#### Dentro do template, após a linha `/gsd:execute-phase {phase}`, adicionar:
```
{If AUTO_CFG is true: `Autopilot: ON — add --auto to run through remaining phases automatically`}
```

### Mudança B: Route B — Adicionar opções de autopilot

#### Localização
No **Route B** (Phase needs planning), bloco **"If CONTEXT.md does NOT exist"**, seção "Also available".

#### Adicionar ao "Also available":
```
- `/gsd:discuss-phase {phase} --auto` — autopilot: discuss → plan → execute → next phase automatically
- `/gsd:settings` — enable auto-advance for all future phases
```

### Mudança C: Route C — Adicionar opções de autopilot

#### Localização
No **Route C** (Phase complete, more phases remain), seção "Also available".

#### Adicionar ao "Also available":
```
- `/gsd:discuss-phase {Z+1} --auto` — autopilot: discuss → plan → execute → next phase automatically
- `/gsd:settings` — enable auto-advance for all future phases
```

---

## Arquivo 6: `tests/config.test.cjs`

### Adicionar 4 testes novos

#### No describe `config-set command`, após o teste "sets nested values via dot-notation":

```js
test('sets workflow.auto_advance to true', () => {
  const result = runGsdTools('config-set workflow.auto_advance true', tmpDir);
  assert.ok(result.success, `Command failed: ${result.error}`);

  const config = readConfig(tmpDir);
  assert.strictEqual(config.workflow.auto_advance, true);
});

test('sets workflow.auto_advance to false', () => {
  // First enable it
  runGsdTools('config-set workflow.auto_advance true', tmpDir);
  // Then disable it
  const result = runGsdTools('config-set workflow.auto_advance false', tmpDir);
  assert.ok(result.success, `Command failed: ${result.error}`);

  const config = readConfig(tmpDir);
  assert.strictEqual(config.workflow.auto_advance, false);
});
```

#### No describe `config-get command`, após o teste "gets a nested value via dot-notation":

```js
test('gets workflow.auto_advance default value (false)', () => {
  const result = runGsdTools('config-get workflow.auto_advance', tmpDir);
  assert.ok(result.success, `Command failed: ${result.error}`);

  const output = JSON.parse(result.output);
  assert.strictEqual(output, false);
});

test('gets workflow.auto_advance after setting to true', () => {
  runGsdTools('config-set workflow.auto_advance true', tmpDir);
  const result = runGsdTools('config-get workflow.auto_advance', tmpDir);
  assert.ok(result.success, `Command failed: ${result.error}`);

  const output = JSON.parse(result.output);
  assert.strictEqual(output, true);
});
```

---

## Como usar após aplicar

### Opção 1: Flag por sessão
```
/gsd:discuss-phase 1 --auto
```

### Opção 2: Config permanente
```
/gsd:settings    → ativa "Auto-Advance: Yes"
```
Ou direto:
```bash
node gsd-tools.cjs config-set workflow.auto_advance true
```

### Quando a cadeia para automaticamente
- Milestone completo
- Gaps encontrados na verificação
- Checkpoint tipo `human-action`
- Qualquer erro de execução

### Verificar status
```
/gsd:progress
```
Agora mostra a opção de autopilot quando auto_advance está ativo.
