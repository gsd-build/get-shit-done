# Referência de Configuração do GSD

Configurações do projeto ficam em `.planning/config.json`.  
Esta versão resume os parâmetros principais em Português. Para schema completo, veja [inglês](../CONFIGURATION.md).

---

## Estrutura base

```json
{
  "mode": "interactive",
  "granularity": "standard",
  "model_profile": "balanced",
  "planning": {
    "commit_docs": true,
    "search_gitignored": false
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true,
    "ui_phase": true,
    "ui_safety_gate": true,
    "research_before_questions": false,
    "discuss_mode": "standard",
    "skip_discuss": false
  }
}
```

## Configurações principais

| Chave | Opções | Padrão | Descrição |
|------|--------|--------|-----------|
| `mode` | `interactive`, `yolo` | `interactive` | `yolo` autoaprova; `interactive` confirma cada etapa |
| `granularity` | `coarse`, `standard`, `fine` | `standard` | Granularidade de fases/planos |
| `model_profile` | `quality`, `balanced`, `budget`, `inherit` | `balanced` | Perfil de modelos por agente |

## Planning

| Chave | Padrão | Descrição |
|------|--------|-----------|
| `planning.commit_docs` | `true` | Comitar `.planning/` no git |
| `planning.search_gitignored` | `false` | Incluir arquivos ignorados em buscas amplas |

## Workflow toggles

| Chave | Padrão | Descrição |
|------|--------|-----------|
| `workflow.research` | `true` | Pesquisa antes de planejar |
| `workflow.plan_check` | `true` | Loop de verificação de plano |
| `workflow.verifier` | `true` | Verificação pós-execução |
| `workflow.nyquist_validation` | `true` | Camada de validação automatizada por requisito |
| `workflow.ui_phase` | `true` | Contrato de UI para fases frontend |
| `workflow.ui_safety_gate` | `true` | Gate de segurança para registry UI |
| `workflow.research_before_questions` | `false` | Pesquisa antes da discussão |
| `workflow.discuss_mode` | `standard` | Discussão aberta; use `assumptions` para modo baseado em código |
| `workflow.skip_discuss` | `false` | Pula discuss-phase no modo autônomo |

## Git branching

| Chave | Opções | Padrão | Descrição |
|------|--------|--------|-----------|
| `git.branching_strategy` | `none`, `phase`, `milestone` | `none` | Estratégia de criação de branches |
| `git.phase_branch_template` | string | `gsd/phase-{phase}-{slug}` | Nome para branch por fase |
| `git.milestone_branch_template` | string | `gsd/{milestone}-{slug}` | Nome para branch de milestone |
| `git.quick_branch_template` | string ou `null` | `null` | Branch opcional para `/gsd:quick` |

## Perfis de modelo

| Perfil | Objetivo |
|--------|----------|
| `quality` | Melhor qualidade, maior custo |
| `balanced` | Equilíbrio (padrão recomendado) |
| `budget` | Menor custo |
| `inherit` | Herdar modelo da sessão/runtime |

Troca rápida:

```bash
/gsd:set-profile budget
```
