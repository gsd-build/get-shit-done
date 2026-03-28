# Discuss Mode (Modo de Discussão)

O GSD oferece dois estilos para `/gsd:discuss-phase`:

- **`standard`**: entrevista aberta para levantar preferências
- **`assumptions`**: análise do código primeiro, seguida de confirmação/correção de suposições

Para referência completa, veja [workflow-discuss-mode.md em inglês](../workflow-discuss-mode.md).

---

## Quando usar `standard`

Use quando:

- o projeto ainda não tem padrões claros
- você quer explorar alternativas livremente
- há decisões de produto/UX em aberto

Vantagem: descoberta ampla.  
Trade-off: pode consumir mais tempo de perguntas.

## Quando usar `assumptions`

Use quando:

- o código já tem convenções estáveis
- você quer reduzir fricção no intake
- o time prefere revisão de propostas em vez de entrevista aberta

Vantagem: velocidade e consistência com o código existente.  
Trade-off: depende da qualidade do mapeamento de contexto.

## Como habilitar

Via `/gsd:settings`, defina:

```json
{
  "workflow": {
    "discuss_mode": "assumptions"
  }
}
```

## Fluxo no modo `assumptions`

1. GSD lê `PROJECT.md`, mapeamento de código e convenções
2. Gera lista estruturada de suposições
3. Você confirma, corrige ou expande
4. GSD escreve `CONTEXT.md` com decisões consolidadas

## Boas práticas

- Revise suposições antes do `plan-phase`
- Corrija ambiguidades de nomes/paths cedo
- Se o plano sair desalinhado, volte ao discuss-phase e refine

---

> [!NOTE]
> Para ambientes com múltiplos runtimes e perfis de modelo dinâmicos, prefira `assumptions` quando o reuso de padrões de código for prioridade.
