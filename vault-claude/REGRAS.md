# Regras de Povoamento do Vault

## Princípio Central

Menos é mais. Cada entrada deve justificar sua existência.

---

## 1. Estrutura Fixa (não criar pastas novas sem pedir)

```
vault-claude/
├── _index.md          ← mapa geral (eu leio primeiro)
├── _templates/        ← templates para novos arquivos
├── projetos/          ← 1 arquivo por projeto
├── sessoes/           ← resumos de sessão (só quando relevante)
├── decisoes/          ← decisões arquiteturais importantes
└── REGRAS.md          ← este arquivo
```

## 2. Regras por Pasta

### projetos/

- **1 arquivo por projeto**, nomeado em kebab-case (ex: `vetlab.md`)
- Máximo 60 linhas por arquivo
- Estrutura obrigatória: usar template `_templates/projeto.md`
- Atualizar status e "última sessão" a cada trabalho relevante
- NÃO listar arquivos do projeto (posso ler o código direto)
- NÃO colar código aqui

### sessoes/

- Criar APENAS quando houve progresso significativo
- Nome: `YYYY-MM-DD.md` (uma por dia, no máximo)
- Máximo 30 linhas
- Se o dia não teve nada relevante, não criar arquivo
- Apagar sessões com mais de 30 dias (exceto se linkadas em decisões)

### decisoes/

- Criar APENAS para decisões que afetam arquitetura ou direção do projeto
- Nome: `projeto-tema.md` (ex: `vetlab-sistema-pdf.md`)
- Deve conter: decisão, alternativas consideradas, motivo
- Máximo 40 linhas
- Decisões pequenas vão direto no arquivo do projeto

## 3. Regras Gerais

| Regra                                | Motivo                 |
| ------------------------------------ | ---------------------- |
| Não duplicar info que está no código | Fica desatualizado     |
| Não salvar estrutura de pastas       | Posso ler com Glob     |
| Não salvar snippets de código        | Já está no projeto     |
| Preferir atualizar a criar novo      | Evita acúmulo          |
| Usar [[links]] entre notas           | Navegação rápida       |
| Manter \_index.md atualizado         | É meu ponto de entrada |

## 4. Quando Salvar

| Situação             | Ação                          |
| -------------------- | ----------------------------- |
| Terminei uma feature | Atualizo `projetos/X.md`      |
| Decisão arquitetural | Crio em `decisoes/`           |
| Sessão produtiva     | Crio em `sessoes/`            |
| Bug corrigido        | Só atualizo status no projeto |
| Conversa casual      | Não salvo nada                |
| Usuário pede "salva" | Salvo onde fizer sentido      |

## 5. Limites de Crescimento

- `_index.md`: máximo 50 linhas
- `projetos/`: máximo 20 arquivos (arquivar os inativos)
- `sessoes/`: manter só últimos 30 dias
- `decisoes/`: sem limite, mas revisar a cada 3 meses
- Total do vault: se passar de 100 arquivos, fazer limpeza

## 6. Leitura (custo de tokens)

- Início de sessão: leio APENAS `_index.md` (~10 linhas)
- Quando o usuário pede um projeto: leio `projetos/X.md`
- Só leio `decisoes/` se for relevante para a tarefa atual
- NUNCA leio o vault inteiro de uma vez
