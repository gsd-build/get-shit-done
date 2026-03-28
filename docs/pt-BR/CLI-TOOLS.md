# Referência de Ferramentas CLI

Resumo em Português das ferramentas CLI do GSD.  
Para API completa (assinaturas, argumentos e comportamento detalhado), consulte [CLI-TOOLS.md em inglês](../CLI-TOOLS.md).

---

## Objetivo

As ferramentas CLI permitem que comandos e agentes do GSD executem ações padronizadas de:

- leitura e escrita de artefatos
- gerenciamento de fases e roadmap
- execução e validação de planos
- integração com git e automação

## Áreas funcionais

### Projeto e estado

- inicialização de artefatos (`PROJECT`, `REQUIREMENTS`, `ROADMAP`, `STATE`)
- atualização de estado por fase
- controle de milestones

### Planejamento

- criação de planos atômicos
- validação pré-execução
- consolidação de pesquisa

### Execução

- despacho de tarefas por onda
- persistência de sumários
- checkpoints de progresso

### Verificação

- comparação de saída com objetivos
- geração de relatórios de validação
- apoio ao UAT

### Utilitários

- leitura/escrita segura de arquivos
- parsing de argumentos
- normalização de paths

## Boas práticas para autores de agentes

- Use artefatos existentes como fonte de verdade
- Evite lógica duplicada entre agentes
- Registre saídas em arquivos canônicos de fase
- Garanta que toda tarefa tenha critério claro de done/verify

---

## Fluxo típico (programático)

```text
Ler contexto do projeto
 -> montar input da etapa
 -> executar ferramenta CLI
 -> persistir artefatos
 -> atualizar estado/roadmap
 -> retornar resumo para o orquestrador
```

---

> [!NOTE]
> Este arquivo é um guia prático em Português para quem integra ou estende workflows. Para contratos estritos e detalhes técnicos completos, use o documento original em inglês.
