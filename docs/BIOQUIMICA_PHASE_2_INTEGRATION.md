# Bioquímica Phase 2 — OCR Integration Guide

## Pré-requisitos

- **Module base:** HC Quality v1.3+ with Bioquímica Phase 1 deployed
- **Catalog:** 50+ analytes seeded in `labs/{labId}/bioquimica/root/analitos/`
- **Gemini API key:** configured in Firebase Functions secrets (`GEMINI_API_KEY`)
- **User role:** Operator with `RT` or `OPERADOR` claim in lab
- **LGPD consent:** Patient consent token obtained before OCR processing

## Fluxo do operador (5 passos)

```
┌─────────────────────────────────────┐
│ 1. Operador acessa /bioquimica/runs │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. Clica em "Nova Run com OCR"      │
│    Sistema exibe OCRUploadModal      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 3. Drag-drop ou seleciona imagem    │
│    do laudo (PNG/JPEG/WebP <10MB)   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4a. LGPD gate: sistema valida       │
│    consentToken antes de enviar     │
│    para Gemini Vision (RDC 978 167) │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 4b. Gemini OCR extrai:              │
│    - nomes de analitos              │
│    - valores numéricos              │
│    - unidades de medida             │
│    - confiança por analito          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 5. Fuzzy match + Westgard check:    │
│    - nomes → AnalitoIds             │
│    - valores → z-scores             │
│    - interlab z-score (se ativo)    │
│    - decisão: accept/warn/reject    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 6. Resultado visual:                │
│    ✓ Accept: confirma automaticamente
│    ⚠ Warn: operador pode sobrescrever
│    ✗ Reject: exibe blockers, pede retry
└─────────────────────────────────────┘
```

## Requisitos LGPD (consent token)

**RDC 978 Art. 167** exige consentimento explícito antes de processar imagens de laudos (contêm dados de saúde sensíveis).

1. **Obter consentimento:** Sistema lê `labs/{labId}/lgpd/consents/{patientId}` antes de abrir modal
   - Campo `analyzeOCR: boolean` indica se paciente consentiu
   - Campo `ts: timestamp` marca quando foi obtido consentimento

2. **Validar token:** Cloud Function `submitBioquimicaRunWithOCR` rejeita se `consentToken` ausente
   - Erro: `permission_denied: LGPD consent token required`

3. **Logar**: Sistema NÃO loga `rawText` da OCR (privacidade). Log autorizado:
   ```
   event: 'gemini_ocr_parsed'
   labId, imageHash, analytesCount, overallConfidence
   ```

## Decisão de aceitação (acceptance engine)

Algoritmo de prioridade (rejeita = para em 1º bloqueio):

```typescript
if (westgardResult.rejectCount > 0) {
  // Qualquer violação Westgard reject → REJECT
  decision = 'reject'
} else if (interlabZScore?.classification === 'unsatisfactory') {
  // Z-score interlab |z| > 3 → REJECT
  decision = 'reject'
} else if (ocrValidation?.validationSeverity === 'reject') {
  // OCR não encontrou analitos esperados → REJECT
  decision = 'reject'
} else if (westgardResult.warnCount > 0 
           || interlabZScore?.classification === 'questionable'
           || ocrValidation?.validationSeverity === 'review') {
  // Qualquer warn → WARN
  decision = 'warn'
} else {
  decision = 'accept'
}
```

**Cenários:**

| Westgard | Interlab | OCR | Decisão | Ação |
|---|---|---|---|---|
| ✓ pass | ✓ satisf | ✓ accept | **ACCEPT** | Confirma automaticamente |
| 1-3s reject | — | — | **REJECT** | Exibe blocker, oferece retry ou override |
| ✓ pass | z=3.1 | — | **REJECT** | Exibe z-score, pede retry |
| ✓ pass | ✓ satisf | review (1 unmatched) | **WARN** | Operador confirma manualmente |
| ✓ pass | 2.5 (q) | ✓ accept | **WARN** | Ambos warn → operador decide |

## Tratamento de OCR rejeitado

Se `validationSeverity === 'reject'`, modal exibe:

```
❌ OCR Validation Rejected
━━━━━━━━━━━━━━━━━━━━━━━━━━
Expected: ALT, AST, GGT, ALP
Found:    ALT, AST (2/4)
━━━━━━━━━━━━━━━━━━━━━━━━━━
Missing: GGT, ALP
Unexpected: 5-NUCLEOTIDASE
━━━━━━━━━━━━━━━━━━━━━━━━━━
[Tentar Novamente] [Entrada Manual]
```

**Opções:**
- **Tentar Novamente:** Reset modal, volta a idle
- **Entrada Manual:** Abre form tradicional para digitar valores

## Roteiro de teste com fixture (STUB mode)

Para testar sem Gemini API:

```bash
# 1. Set env var
export GEMINI_API_KEY=STUB

# 2. Deploy functions
npm run build:functions && firebase deploy --only functions

# 3. Em client, chamar parseAnalyteStripImage
const result = await httpsCallable(functions, 'parseAnalyteStripImage')({
  labId: 'test-lab-123',
  imageStoragePath: 'gs://bucket/test.png',
  expectedAnalytes: ['alanina-aminotransferase', 'aspartato-aminotransferase'],
  consentToken: 'test-token-xyz'
})

# 4. Resultado fixture:
{
  imageStoragePath: 'gs://bucket/test.png',
  imageHash: 'sha256-abc123...',
  parsedAt: 1715000000,
  geminiModel: 'gemini-2.5-flash',
  rawText: '[STUB MODE] OCR text redacted for testing',
  analytes: [
    {
      rawName: 'alanina-aminotransferase',
      matchedAnalitoId: 'alanina-aminotransferase',
      matchConfidence: 'high',
      rawValue: '80',
      parsedValue: 80,
      rawUnit: 'U/L',
      unitMatched: true
    },
    // ... 3 more analytes
  ],
  overallConfidence: 'high',
  warnings: ['[STUB MODE] This is a test fixture']
}
```

## Limites conhecidos + fallback manual

| Limite | Impacto | Fallback |
|---|---|---|
| Imagem rotacionada >45° | OCR pode falhar | Operador reposiciona + retry |
| Texto muito pequeno (<8pt) | Fuzzy match low confidence | Manual entry modal abre auto |
| Logomarca/marcas d'água | Pode confundir OCR | Sistema ignora, foca nas áreas de valores |
| Imagem muito borrada | Confiança <0.6 | Rejeita automaticamente |
| Gráficos/tabelas mistas | Pode extrair labels errados | Unexpected[] lista, operador revisa |

**Solução:** Toda run com `validationSeverity === 'reject'` oferece `[Entrada Manual]` que abre form tradicional para digitação.

## Métricas Cloud Logs (queries esperadas)

```bash
# Query 1: OCR parsing events
resource.type="cloud_function"
resource.labels.function_name="parseAnalyteStripImage"
severity="INFO"
jsonPayload.event="gemini_ocr_parsed"

# Query 2: Westgard violations (server-side)
resource.type="cloud_function"
resource.labels.function_name="submitBioquimicaRunWithOCR"
jsonPayload.event="westgard_evaluated"

# Query 3: Acceptance decisions
resource.type="cloud_function"
resource.labels.function_name="submitBioquimicaRunWithOCR"
jsonPayload.event="bioq_run_with_ocr"
```

Sample log entry:
```json
{
  "timestamp": "2026-05-10T14:32:15.123Z",
  "event": "gemini_ocr_parsed",
  "labId": "riopomba-001",
  "imageHash": "abc123def456...",
  "analytesCount": 4,
  "overallConfidence": "high",
  "severity": "INFO"
}
```

## Compliance map (RDC 978 + DICQ 4.3 + LGPD)

| Norma | Artigo | Requisito | SA | Implementação |
|---|---|---|---|---|
| RDC 978 | 167 | Laudo digital com integridade | SA-56, SA-57 | OCR callable + signature |
| RDC 978 | 179 | CIQ obrigatório | SA-43, SA-47, SA-48 | Westgard engine |
| RDC 978 | 180 | Plano de controle | SA-45 | Analyte seed + config |
| RDC 978 | 183 | CIQ por troca de lote | SA-57 | Callables check lote |
| DICQ 4.3 | 5.5.1.1 | Planejamento CIQ | SA-43, SA-45 | Catalog + metadata |
| DICQ 4.3 | 5.6.2 | Regras Westgard | SA-44, SA-47, SA-48 | 8-rule CLSI engine |
| DICQ 4.3 | 5.6.3.1 | Critério rejeição | SA-53 | Acceptance engine |
| DICQ 4.3 | 5.6.4 | Comparação interlaboratorial | SA-50, SA-63 | Z-score + CEQ |
| LGPD | Art. 9 | Consentimento dados sensíveis | SA-51, SA-57 | LGPD gate token |

---

**Last updated:** 2026-05-09  
**Phase:** 9b (Phase 2 — OCR + Westgard CLSI 8 + Z-score)  
**Status:** 🟢 Complete (48/48 tests passing, all gates green)
