# Monitor de Contexto

O monitor de contexto ajuda a evitar degradação de qualidade em sessões longas, alertando sobre uso excessivo da janela de contexto.

Para detalhes completos de implementação, veja [context-monitor.md em inglês](../context-monitor.md).

---

## Objetivos

- identificar quando a sessão principal está saturando
- recomendar ações de recuperação (`/clear`, `/gsd-resume-work`, `/gsd-progress`)
- manter previsibilidade durante ciclos longos de desenvolvimento

## Como funciona

1. coleta sinais de uso da janela de contexto
2. compara com limiares de alerta
3. emite avisos progressivos
4. sugere retomada por artefatos persistentes

## Estratégia recomendada

- Limpe contexto entre fases grandes
- Execute tarefas pesadas em subagentes
- Mantenha o estado em `.planning/` como fonte de verdade

## Recuperação quando há degradação

```bash
/clear
/gsd-resume-work
# ou
/gsd-progress
```

---

> [!TIP]
> O monitor não substitui boas práticas de escopo. Planos pequenos e verificáveis continuam sendo o principal fator de qualidade.
