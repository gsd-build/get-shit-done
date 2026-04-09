# Referência de Recursos do GSD

Visão em Português dos recursos centrais do GSD.  
Para catálogo completo e detalhamento exaustivo, consulte [FEATURES.md em inglês](../FEATURES.md).

---

## Recursos principais

- **Desenvolvimento orientado por fases** com artefatos de planejamento versionados
- **Engenharia de contexto** para reduzir degradação de qualidade em sessões longas
- **Planejamento em tarefas atômicas** para execução mais previsível
- **Execução em ondas paralelas** com controle por dependências
- **Commits atômicos por tarefa** para rastreabilidade e rollback
- **Verificação pós-execução** com foco em objetivos da fase
- **UAT guiado** via `/gsd-verify-work`
- **Suporte brownfield** com `/gsd-map-codebase`
- **Workstreams** para trilhas paralelas sem colisão de estado
- **Backlog, seeds e threads** para memória de médio/longo prazo

## Qualidade e segurança

- **Plan-check** antes de executar
- **Nyquist validation** para mapear requisito -> validação automatizada
- **Detecção de prompt injection** em entradas do usuário
- **Prevenção de path traversal** em caminhos fornecidos
- **Hooks de proteção** para alterações fora de contexto de workflow

## UX de frontend

- **`/gsd-ui-phase`**: contrato visual antes da execução
- **`/gsd-ui-review`**: auditoria visual em 6 pilares
- **UI safety gate** para uso de registries de terceiros

## Operação e manutenção

- **Perfis de modelo** (`quality`, `balanced`, `budget`, `inherit`)
- **Ajuste por toggles** para custo/qualidade/velocidade
- **Diagnóstico forense** com `/gsd-forensics`
- **Relatório de sessão** com `/gsd-session-report`

## Novidades v1.31--v1.32

- **Schema drift detection** — detecta alterações em ORM schema sem migração correspondente
- **Security enforcement** — verificação de segurança ancorada em threat model (`/gsd-secure-phase`)
- **Discuss chain mode** — encadeia discuss → plan → execute com `--chain`
- **Single-phase autonomous** — executa apenas uma fase com `--only N`
- **Scope reduction detection** — defesa em 3 camadas contra remoção silenciosa de requisitos
- **Worktree toggle** — desativa isolamento via `workflow.use_worktrees: false`
- **STATE.md consistency gates** — detecta/repara drift entre STATE.md e filesystem (v1.32)
- **Autonomous `--to N`** — para execução autônoma após fase N (v1.32)
- **Research gate** — bloqueia planejamento quando RESEARCH.md tem questões abertas (v1.32)
- **Verifier milestone scope filtering** — distingue gaps reais de itens deferidos (v1.32)
- **Read-before-edit guard** — hook que previne loops infinitos de retry (v1.32)
- **Context reduction** — truncamento de markdown e ordenação cache-friendly (v1.32)
- **`--power` flag** — respostas em batch via arquivo para discuss-phase (v1.32)
- **`--diagnose` flag** — modo diagnóstico sem modificações no `/gsd-debug` (v1.32)
- **`/gsd-analyze-dependencies`** — detecta dependências entre fases (v1.32)
- **Response language config** — `response_language` para saída consistente em idioma (v1.32)
- **Novos runtimes** — Trae IDE, Cline, Augment Code (v1.32)
- **Manual update** — procedimento de atualização sem npm (v1.32)

---

## Atalhos recomendados por cenário

| Cenário | Comandos |
|--------|----------|
| Projeto novo | `/gsd-new-project` -> `/gsd-discuss-phase` -> `/gsd-plan-phase` -> `/gsd-execute-phase` |
| Correção rápida | `/gsd-quick` |
| Código existente | `/gsd-map-codebase` -> `/gsd-new-project` |
| Fechamento de release | `/gsd-audit-milestone` -> `/gsd-complete-milestone` |

---

> [!NOTE]
> Este arquivo é uma versão de referência rápida em Português para facilitar uso diário. Para detalhes de baixo nível, requisitos formais e comportamento completo de cada recurso, use o documento original em inglês.
