# Referência de Agentes do GSD

Este documento descreve os papéis dos agentes especializados no ecossistema GSD.  
Para a listagem completa com regras detalhadas, consulte [AGENTS.md em inglês](../AGENTS.md).

---

## Visão geral

O GSD usa um **orquestrador leve** para coordenar subagentes especializados por etapa:

- pesquisa
- planejamento
- execução
- validação
- depuração

Cada agente tem responsabilidade clara, entradas/saídas definidas e contexto de trabalho limitado.

## Famílias de agentes

### Pesquisa

- **Project/Phase researchers**: investigam stack, arquitetura, padrões e riscos
- **Research synthesizer**: consolida descobertas em artefatos utilizáveis

### Planejamento

- **Planner**: transforma requisitos em planos atômicos
- **Plan checker**: valida consistência, escopo, verificabilidade e dependências

### Execução

- **Executor**: implementa tarefas do plano com contexto fresco
- **Integration checker**: verifica se as partes integram corretamente

### Verificação

- **Verifier**: compara entrega contra objetivos da fase
- **UAT support**: auxilia no processo de validação manual guiada

### Diagnóstico

- **Debugger**: identifica causa-raiz quando há falhas
- **Forensics**: investiga inconsistências de estado/artefatos/histórico

## Padrões operacionais

- **Contexto isolado por tarefa**: evita poluição acumulada
- **Commits atômicos**: um commit por unidade de trabalho
- **Execução em ondas**: paralelo quando possível, sequencial quando necessário
- **Loop de revisão**: planejamento e validação iteram até critérios mínimos

## Boas práticas

- Prefira tarefas pequenas e verificáveis
- Trave decisões de implementação no `CONTEXT.md`
- Use `assumptions mode` quando já houver padrão consolidado no código
- Ajuste perfil de modelo conforme custo x qualidade

---

> [!NOTE]
> Esta versão em Português é uma referência operacional. Se você estiver contribuindo com o núcleo do framework ou alterando comportamento de agentes, consulte sempre o documento em inglês para detalhes normativos.
