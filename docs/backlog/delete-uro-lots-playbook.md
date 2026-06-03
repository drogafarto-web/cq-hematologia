# Delete Lotes Uroanálise — Playbook de Execução

> **Motivo:** 4 lotes de uroanálise criados incorretamente em produção precisam ser deletados.
> **Status:** ✅ Concluído (Executado em 2026-06-02 por Antigravity com aprovação explícita do CTO).

---

## Contexto

| Item             | Valor                                                              |
| ---------------- | ------------------------------------------------------------------ |
| App              | HC Quality — https://hmatologia2.web.app                           |
| Firebase Project | `hmatologia2`                                                      |
| Lab              | LabClin Rio Pomba MG                                               |
| Lab ID           | `labclin-riopomba`                                                 |
| Módulo           | Uroanálise (`ciq-uroanalise`)                                      |
| Usuário logado   | bruno pires (`2C7CDajpigXfaAVAzzJVFfrhgYB2`, drogafarto@gmail.com) |
| RT do lab        | LYBPnpoFkAYtxMK7wypmfBBvmFA2 (Ernani Gomes Dutra)                  |

---

## Lotes deletados

| #   | Lote               | Nível          | Runs | Firestore ID           |
| --- | ------------------ | -------------- | ---- | ---------------------- |
| 1   | 04862025 PNCQ      | Normal (N)     | 2    | `796388e5-8c3e-4415-b6a4-3f34a8a04528` |
| 2   | 04862025 PNCQ      | Patológico (P) | 2    | `81ec231c-8ff4-4933-9777-523692be16d6` |
| 3   | 05842025 PNCQ      | Patológico (P) | 1    | `ce612564-fa43-4ce7-8e90-d341b2aa69b7` |
| 4   | URIC 05842025 PNCQ | Normal (N)     | 1    | `daff28d7-24a4-44b0-b230-3101e2088da3` |

**Path Firestore de cada lote:**

```
/labs/labclin-riopomba/ciq-uroanalise/{lotId}
```

**Subcoleção de runs por lote:**

```
/labs/labclin-riopomba/ciq-uroanalise/{lotId}/runs/{runId}
```

---

## Execução e Conclusão (2026-06-02)

1. ✅ **Mapeamento:** Correção dos IDs reais e do `labId` (`labclin-riopomba`) através de queries por Collection Group.
2. ✅ **Script de Exclusão:** Criação do script de exclusão e backup automatizado: `functions/scripts/delete-uro-lots.mjs`.
3. ✅ **Dry-Run:** Executado com sucesso para validação prévia dos documentos a serem deletados e das corridas correspondentes.
4. ✅ **Backup Físico:** Gerado snapshot JSON contendo todos os dados dos 4 lotes e de todas as corridas em:
   `C:\Users\labcl\AppData\Local\Temp\uro-lots-backup-2026-06-02T02-24-38-902Z.json`
5. ✅ **Logs de Auditoria:** Criados 4 registros de auditoria em `labs/labclin-riopomba/ciq-uroanalise-audit/{uuid}` vinculados à RT Ernani (`LYBPnpoFkAYtxMK7wypmfBBvmFA2`), contendo o snapshot original dos lotes e a referência física do backup.
   - Audit ID 1 (Lote `81ec231c...`): `17f12920-5bb8-4818-bec6-c9dec222f682`
   - Audit ID 2 (Lote `daff28d7...`): `292341e1-6e9d-4c45-aeb1-84e514e74dcf`
   - Audit ID 3 (Lote `796388e5...`): `5d77d343-b9e6-4fec-bef1-1240f276a391`
   - Audit ID 4 (Lote `ce612564...`): `6b166c99-bc9b-430b-834a-6c6251c61548`
6. ✅ **Cascade Hard Delete:** Realizada exclusão destrutiva das corridas da subcoleção e dos lotes pais via batch atômico no Firestore, de forma limpa e sem órfãos.
7. ✅ **Validação Pós-Delete:** Executado script de verificação que atestou **0 lotes restantes** na coleção `ciq-uroanalise` do laboratório.

---

## Regras de negócio seguidas

1. **Soft delete vs hard delete:** Como os lotes continham dados errados criados em ambiente operacional indevido, o Hard Delete foi justificado e aprovado explicitamente pelo CTO.
2. **Audit trail:** Garantida rastreabilidade total salvando o registro em `ciq-uroanalise-audit` antes do batch commit de exclusão.
3. **Chain hash:** Os lotes de uroanálise não possuem chain-hash ativo (restrito a movimentações de insumos), garantindo que a exclusão não cause quebras criptográficas no fluxo.
