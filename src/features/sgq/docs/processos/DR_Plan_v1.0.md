# Plano de Continuidade / Disaster Recovery — HC Quality v1.0

**Documento ID:** DICQ-4.2-DR-001
**Versão:** 1.0
**Data Efetiva:** 2026-05-06
**Próxima Revisão:** 2026-05-06 + 12 meses
**Proprietário:** CTO
**Classificação:** DICQ 4.2 (Gestão de documentos da Qualidade)
**Status de Assinatura:** Pendente de RT

---

## Sumário Executivo

HC Quality é um sistema SaaS multi-tenant de Controle Interno de Qualidade para laboratórios clínicos. Este documento resume o Plano de Continuidade / Disaster Recovery formal, exigido por RDC 978/2025 Artigo 5.6 (Continuidade) e DICQ 4.2 (Documentação da Qualidade).

**Objetivo:** Garantir que o sistema possa se recuperar de 4 cenários críticos de falha em tempo aceitável, sem perda de dados ou comprometimento da trilha de auditoria.

**Referência completa:** `docs/DR_PLAN.md` (este repositório)

---

## Cenários Cobertos

| Cenário | RTO | RPO | Status |
|---------|-----|-----|--------|
| 1. Corrupção de dados Firestore | 2h | <1h | Documentado + Testado ✓ |
| 2. Interrupção de região GCP | 4h | <1h | Documentado + Runbook ✓ |
| 3. Credenciais comprometidas | 1h | <30m | Documentado + Runbook ✓ |
| 4. Ataque ransomware / malicioso | 24h | <1h | Documentado + Runbook ✓ |

---

## Procedimentos de Recuperação

**Runbooks detalhados:** `docs/DR_RUNBOOKS.md`

Cada cenário possui procedimentos passo a passo, incluindo:
- Detecção (alertas e critérios)
- Contenção imediata
- Forensics
- Restauração (com validação em staging)
- Reabilitação de serviços
- Comunicação com stakeholders

---

## Teste de Restore — 2026-05-06

**Objetivo:** Validar que a estratégia de backup/restore é funcional e confiável.

**Procedimento:**
1. Snapshot do banco de dados de produção exportado para GCS
2. Snapshot restaurado para projeto de staging
3. Integridade validada:
   - Contagem de documentos: ✓ Match
   - Cadeia de hashes: ✓ 100/100 docs válidos (verificação de 100 amostras)
   - Testes de fumaça: ✓ 45/45 integrações passando
   - Regras de segurança: ✓ Enforced

**Relatório:** `docs/DR_RESTORE_TEST_2026-05.md`

**Resultado:** PASSOU — Capacidade de recuperação comprovada e testada.

---

## Escalação e Contatos

| Papel | Responsabilidade | Disponibilidade |
|-------|-----------------|-----------------|
| CTO | Declarar incidente, aprovar plano de recuperação | 24/7 (pager) |
| Tech Lead | Executar procedimentos, coordenar time | Business hours + on-call |
| Security Officer | Forensics, determinação de breach, LGPD | On-call para cenários 3-4 |
| PM | Comunicação com clientes, status page | Business hours |
| DevOps | Comandos gcloud, deployment | 24/7 |

---

## Conformidade Regulatória

**RDC 978/2025 5.6 (Continuidade):**
"Sistema deve ter plano de continuidade testado anualmente."

**Status:** ✓ COMPLETO
- Plano documentado com 4 cenários
- Procedimentos descritos (Runbooks)
- Teste real executado em 2026-05-06
- Integridade da cadeia de auditoria verificada
- Próximo teste agendado para 2027-05-06

**DICQ 4.2 (Gestão de documentos):**
"Planos de contingência devem ser documentados e controlados."

**Status:** ✓ COMPLETO
- Documento versionado (v1.0)
- Aprovação pendente (assinatura RT)
- Arquivo controlado em repositório git (rastreabilidade)
- Revisão anual agendada

---

## Scripts Automáticos

Três scripts de shell executáveis estão disponíveis em `scripts/`:

1. **dr-backup-snapshot.sh** — Exporta Firestore de produção para GCS
2. **dr-restore-staging.sh** — Importa snapshot para staging para validação
3. **dr-validate-chain-hash.sh** — Verifica integridade da cadeia de hashes (100 amostras)

Todos os scripts incluem:
- Tratamento de erros com `set -euo pipefail`
- Logging de timestamps (rastreabilidade)
- Status de operações assíncronas do gcloud

---

## Cadeia de Custódia (Chain of Hash)

**Critério crítico:** A trilha de auditoria (auditLogs) deve permanecer íntegra após restauração.

Cada entrada em auditLogs contém:
```
LogicalSignature {
  hash: SHA-256 (64 caracteres hex)
  operatorId: UID do operador
  ts: timestamp ISO 8601
}
```

**Validação pós-restauração:**
- Amostra de 100 docs: 100/100 válidos
- Hash format: Todos os 64 caracteres hex válidos (nenhuma corrupção)
- Referência de operador: Intacta
- Timestamps: Preservados

**Conclusão:** Cadeia de custódia não foi comprometida durante o ciclo backup→restauração.

---

## Próximos Passos

1. **Assinatura RT:** Responsável Técnico revisa e assina este documento
2. **Integração em SGQ:** Documento rastreado em sistema de gestão de qualidade
3. **Treinamento de time:** Equipe ensaiada em procedimentos de recuperação
4. **Teste anual:** 2027-05-06 (agendado)

---

## Histórico de Revisão

| Versão | Data | Autor | Alteração |
|--------|------|-------|-----------|
| 1.0 | 2026-05-06 | CTO | Versão inicial, 4 cenários documentados, teste real comprovado |

---

**Documento controlado.** Última atualização: 2026-05-06.
Próxima revisão obrigatória: 2027-05-06.
