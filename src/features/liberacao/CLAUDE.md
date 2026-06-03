# Módulo: Liberação de Laudos (Phase 10)

**Status:** Phase 10-01 Complete (Foundation)
**Milestone:** v1.3
**RDC 978:** Arts. 167 (14 campos), 184-191 (críticos+comunicação)
**DICQ:** Blocos G (5.7.x) + I (5.8.x, 5.9.x)

## O que é

Primeiro módulo de laudo do HC Quality. Workflow híbrido de liberação (auto-liberar exames rotina, RT revisa críticos), com assinatura LogicalSignature SHA-256 (ADR 0001), histórico imutável de versões, e comunicação de valores críticos por email com log auditável.

## Decisões locked

| Aspecto              | Decisão                             | Rationale                                               |
| -------------------- | ----------------------------------- | ------------------------------------------------------- |
| Assinatura RT        | LogicalSignature SHA-256 (ADR 0001) | Padrão HC Quality; audit chain imutável; aceita RDC 978 |
| State machine        | Híbrida por classificação exame     | Auto-libera rotina; RT revisa críticos                  |
| Comunicação críticos | Email (MVP) + UI registro verbal    | SMS defer v1.4 (Zenvia/Twilio)                          |
| Histórico versões    | Retificação cria v2/v3 imutáveis    | RDC 978 Art. 167 + DICQ 5.9.3                           |
| PDF                  | 14 campos RDC + QR validação        | Defer geração para Plan 10-04                           |

## Schema Firestore

```
/labs/{labId}/
  laudos/{laudoId}                    # Laudo principal (mutable status)
    criadoEm, status, classification, criticoFlag, ...
  laudo-versions/{versionId}          # Versão imutável (snapshot congelado)
    version, snapshot, signature, chainHash, pdfUrl
  comunicacoes/{comunicacaoId}        # Log imutável de comunicação crítico
    laudoId, canal, receptor, signature, criadoEm
  exames-config/{exameId}             # Config de classificação exame
    examCode, classification, autoReleaseEnabled
  criticos-thresholds/{thresholdId}   # Valores críticos por analito
    analito, minValue, maxValue, severidade
```

## Gotchas

1. **chainHash sequencial:** Cada nova versão calcula hash baseado no anterior. Client calcula, server valida (não confia no client).
2. **Soft delete only:** Nunca use deleteDoc; sempre marca `deletadoEm`.
3. **Multi-tenant labId obrigatório:** Toda coleção filtra por labId; rules validam em read/write.
4. **Assinatura server-side:** RTSignatureGate client coleta PIN; liberarLaudo callable server-side recalcula hash e assina.
5. **Auto-release é opt-in:** Lab configura quais exames auto-liberam; padrão é revisão RT.

## Arquivo de referência

- `src/features/auditoria/` — pattern de chainHash + LogicalSignature (replicar)
- `src/features/educacao-continuada/` — pattern de assinatura RT em certificados
- `docs/adr/0001-audit-chain.md` — definição de LogicalSignature

## Próximos planos

- **10-02:** RT Signature Workflow + ReviewLaudoModal + liberarLaudo callable
- **10-03:** Críticos Thresholds + Comunicação Email + auto-escalação
- **10-04:** Geração PDF + QR Validação
- **10-05:** Portal Médico (auth externa)
