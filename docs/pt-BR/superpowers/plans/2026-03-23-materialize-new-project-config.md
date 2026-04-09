# Plano: Materializar Configuração no `new-project` (pt-BR)

Data original: 2026-03-23  
Fonte canônica: `docs/superpowers/plans/2026-03-18-materialize-new-project-config.md`

---

## Contexto

Este plano formaliza a materialização explícita da configuração do projeto durante `/gsd-new-project`, garantindo que escolhas feitas na inicialização sejam persistidas de forma determinística em `.planning/config.json`.

## Objetivos

- garantir persistência imediata de decisões de setup
- reduzir divergência entre estado interativo e arquivo de configuração
- facilitar retomada de sessão e reprodutibilidade

## Escopo

Inclui:

- mapeamento de respostas de setup para chaves de configuração
- escrita idempotente de `.planning/config.json`
- validação mínima de schema antes de persistir

Não inclui:

- redesenho completo do schema
- migração profunda de versões legadas

## Estratégia de implementação

1. Capturar decisões de setup em estrutura intermediária
2. Normalizar valores (tipos/enum/padrões)
3. Aplicar merge controlado no config existente
4. Persistir arquivo final e registrar resumo no estado

## Critérios de aceitação

- após `/gsd-new-project`, `config.json` reflete as escolhas feitas
- rerun não duplica nem corrompe campos
- comandos subsequentes observam os valores persistidos

## Riscos e mitigação

- **Risco:** configuração parcial em caso de falha no meio  
  **Mitigação:** escrita atômica (arquivo temporário + replace)
- **Risco:** inconsistência com defaults implícitos  
  **Mitigação:** normalização centralizada com fallback explícito

## Verificação

- teste de inicialização limpa
- teste de reexecução com config pré-existente
- teste de compatibilidade com comandos dependentes de config

---

> [!NOTE]
> Esta versão em Português é uma tradução operacional do plano para consulta rápida. O documento original permanece como referência técnica canônica.
