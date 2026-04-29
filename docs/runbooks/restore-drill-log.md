# Drill log — Firestore restore

Registro dos testes trimestrais de restauração. Backup que nunca foi restaurado não é backup.

| Data       | Backup usado            | Cenário                          | Resultado | Observações                                                                            |
| ---------- | ----------------------- | -------------------------------- | --------- | -------------------------------------------------------------------------------------- |
| 2026-04-29 | `daily/2026-04-28/`     | Soft drill — validação estrutura | ✅ OK     | Validação de integridade do export mais recente. Drill completo em sandbox: pendente. |

## Próximo drill — pendente

**Quando:** 2026-07-29 (trimestral) ou antes do primeiro release production-critical.

**O que fazer:**

1. Criar projeto sandbox `hmatologia2-sandbox` (se não existir)
2. Importar último backup completo via `gcloud firestore import`
3. Validar contagens de docs em `labs/`, `users/`, `labs/labclin-riopomba/lots/`
4. Query de amostra: últimas 5 corridas batem com produção?
5. Deletar dados do sandbox
6. Atualizar tabela acima com resultado
