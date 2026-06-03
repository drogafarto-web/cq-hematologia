---
milestone: v1.4
phase: 10
phase_name: 'Multi-Equipment CIQ Expansion'
status: planning
kickoff_date: 2026-05-20
estimated_duration: '2.5 weeks (Wave 3)'
target_deploy: 2026-06-02
risk_level: 4.5/10
dependencies:
  - 'Phase 9 Complete (bioquimica foundation)'
  - 'DICQ Bloco F (5.5.2, 5.5.3, 5.6.2) mapped'
  - 'Westgard engine baseline + Levey-Jennings UI shipped'
---

# Phase 10 — Multi-Equipment CIQ Expansion (Detailed Plan)

**Objective:** Extend bioquimica (quantitative CIQ) to coagulation, immunology, and urinalysis analytes while establishing multi-instrument validation architecture, reagent/QC lot versioning, and Westgard compliance gates.

**Strategic impact:**

- Coag/Imuno/Uro are 60% of clinical volume in typical labs (Riopomba data 2025)
- Multi-equipment support unlocks lab equipment partnerships (Mindray, Sysmex, etc.) → retention + upsell
- Reagent lot expiry auto-lockout prevents compliance violations (RDC 978 Art. 183)
- DICQ compliance → +8–12% (78.5% → 86–90%)

**Success criteria:**

- 30+ analytes (Coag 5 + Imuno 10 + Uro 10 + Other 5) seeded and functional
- Multi-instrument registry per lab + per-analyte calibration data
- Lot expiry validation blocks laudo generation (callable gate)
- 12 E2E scenarios PASS (coag entry → chart, imuno critical → NOTIVISA, uro dipstick, etc.)
- DICQ blocks 5.5.2, 5.5.3, 5.6.2 verified complete
- Cloud Logs: 0 errors, <5% warning rate (24h post-deploy)
- Zero regressions (738/738 baseline tests + 42 Phase 9 tests)

---

## 1. Coagulation Analytes (PT, INR, aPTT, Thrombin Time)

### 1.1 Analytes Definition (5 core + equipment variants)

```
Coagulation CIQ Module — DICQ 4.3 Bloco F.5.5.3 (Hemostasis)
RDC 978/2025 Arts. 179 (CIQ obrigatório), 183 (rastreabilidade de lote)

Core analytes:
  1. PT (Prothrombin Time)
     - Unitário: segundos (s)
     - Range biológico: 11.0–13.5 s
     - Método: Neisler
     - CV alvo: 4.0% (PACS-CIQ)
     - Equipamentos: Sysmex CA-7000, ACL TOP, Instrumentation Lab AcumarK
     - Crítico: SIM (INR > 4.0 ou < 0.8)

  2. INR (International Normalized Ratio)
     - Unitário: razão (adimensional)
     - Range biológico: 0.8–1.1 (normal); terapêutico 2.0–3.0 (afib) ou 2.5–3.5 (trombose)
     - Método: Calculado (PT/PT referência × ISI)
     - CV alvo: 5.5% (CLSI guideline)
     - Crítico: SIM (escalação RDC 978 Art. 115)

  3. aPTT (Activated Partial Thromboplastin Time)
     - Unitário: segundos (s)
     - Range biológico: 25.0–35.0 s
     - Método: DRVV / Lupus anticoagulant screening
     - CV alvo: 6.0%
     - Equipamentos: Sysmex CA-7000, ACL TOP
     - Crítico: SIM (> 50s suspeita de anticoagulante não documentado)

  4. Thrombin Time (TT)
     - Unitário: segundos (s)
     - Range biológico: 14.0–18.0 s
     - Método: Thombin-agarose
     - CV alvo: 8.0%
     - Equipamentos: ACL TOP, Instrumentation Lab
     - Crítico: NÃO (raramente usado em rotina, mas mapeado para futuro)

  5. Fibrinogênio (Fib)
     - Unitário: mg/dL
     - Range biológico: 200–400 mg/dL
     - Método: Cláusula (Funcional)
     - CV alvo: 5.0%
     - Crítico: SIM (< 100 ou > 600 indicativo de coagulopatia)

Instrumentos suportados:
  - Sysmex CA-7000 (Japão) — padrão Riopomba Phase 1
  - ACL TOP (Instrumentation Lab, Itália)
  - Mindray BC-7000 (China) — novo partnership 2026
  - Stago Compact Plus (França) — futuro v1.5

Dados de validação incluem:
  - QC material: Neoplastine/Reagent lot / QC nivel 1–3
  - Calibração: diária vs 2x/semana (equipamento específico)
  - Método comparação: PT (Neisler vs Quick) — RDC 978 Art. 181
```

### 1.2 Firestore Schema — Coagulation

```firestore
/labs/{labId}/coagulacao/
  root/
  root/analitos/{analitoId}                (PT, INR, aPTT, TT, Fib)
  root/lotes/{lotId}                       (QC material: lote, data fab, data exp, supplier, estatística)
  root/runs/{runId}                        (1 run = N analitos × 1 nível × 1 equipamento)
  root/equipamentos/{equipId}              (Sysmex CA-7000 #1, ACL TOP #2, etc.)
  root/thresholds-criticos/{analitoId}     (INR > 4.0, PT < 11 ou > 14, etc. → NOTIVISA trigger)
  root/comparacao-metodos/{compId}         (PT Neisler vs PT Quick, calibração manual log)
  root/traceability-events/{eventId}       (append-only: "Lote X expira 2026-06-30 → bloqueia")
  root/audit/{logId}                       (append-only: chainHash + timestamp)
  root/config/{singleton}                  (Westgard rules enabled per analito)
```

### 1.3 Westgard CLSI Rules for Coagulation

```
Coagulation-specific Westgard rules (implementados em `westgardRulesCLSI.ts`):

1. **1-2s rule** (Warning)
   - 1 resultado > 2σ do mean
   - aPTT, PT especialmente sensíveis a reagent age

2. **1-3s rule** (Reject)
   - 1 resultado > 3σ do mean
   - Indica drift metodológico ou calibração off

3. **2-2s rule** (Reject)
   - 2 resultados consecutivos > 2σ em lados opostos da média
   - PT comum quando lot mudou

4. **R-4s rule** (Reject)
   - Diferença entre máx e mín > 4σ
   - Indica instabilidade de reativo ou equipamento

5. **4-1s rule** (Reject — Extended, `enabled: false` default)
   - 4 resultados consecutivos > 1σ unilateral
   - Habilitável em v1.4 por lab

Stats per (analito, equipment, nivel, lastLotChange):
  - mean, stdev (Levey-Jennings base)
  - trend line (6+ pontos → detecta drift sistemático)
  - CV% (vs CV alvo coagulação)
  - n-runs (reset ao trocar lote)

Regra de pausa:
  - Rejeição em aPTT → laboratorista avisa supervisor
  - Supervisor aprova re-calibração ou mudança de lot
  - Runs subsequentes marcam novo period (`lotIdNew`)
  - Histórico não apagado (audit trail)
```

### 1.4 Lot Traceability — Coagulation

```
Cada QC lot de coagulação carrega:

{
  id: string;
  labId: LabId;
  analitoIds: string[];        // [PT, INR, aPTT]
  supplier: "Neoplastine" | "Reagent-XYZ" | "Sysmex-QC";
  lotNumber: "QC-2026-001";
  dataFabricacao: Date;        // 2026-01-15
  dataValidade: Date;          // 2026-07-15
  dataAberto: Date | null;     // lab opened it
  equipmentIds: string[];      // Sysmex CA-7000, ACL TOP

  bulaParsed: {
    url?: string;
    metodologia: string;
    rangeBiologico: Map<string, RangeBiologico>;
    cvAlvo: Map<string, number>;
    estatisticaFabricante: Map<string, { mean, stdev }>;
  };

  ativo: boolean;              // false = expired or replaced
  criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

Validação de expiry (Cloud Function callable):
  - Pre-flight check na criação de run
  - Se dataValidade < now() → run rejeitada com mensagem "Lote vencido: XXXX-YYYY"
  - NOTIVISA notificação ao lab (RDC 978 Art. 6º)
```

---

## 2. Immunology Analytes (HIV, Dengue, HCG, Syphilis, COVID)

### 2.1 Analytes Definition (10 core)

```
Immunology CIQ Module — DICQ 4.3 Bloco F.5.5.2 (Imunologia)
RDC 978/2025 Arts. 179 (CIQ), 115 (Critical values), 6º (NOTIVISA Art. 6º §1)

Core analytes (serology/immunoassay):
  1. HIV 1+2 (Antígeno + Anticorpo)
     - Unitário: Positivo/Negativo (qualitativo)
     - Método: 4ª geração (Ag/Ab combo ELISA)
     - CV alvo: NA (qualitativo)
     - Equipamentos: Abbott i2000SR, Siemens Centaur XP, Roche Cobas c501
     - Crítico: SIM (RDC 978 Art. 115 + NOTIVISA obrigatório)
     - DICQ requisito: 5.5.2 (Teste de confirmação)

  2. Dengue IgM (Dengue Immunoglobulin M)
     - Unitário: Positivo/Negativo (qualitativo) ou título (quantitativo)
     - Método: ELISA / Dot blot
     - Equipamentos: Biorad Platelia, Dia.Pro SD Dengue
     - Crítico: SIM (NOTIVISA, Ministério Saúde notificação)
     - DICQ requisito: 5.5.2

  3. HCG-β (Gonadotropina Coriônica Humana)
     - Unitário: mIU/mL (quantitativo) ou Pos/Neg (qualitativo)
     - Método: Immunoquimioluminescência (ECLIA)
     - CV alvo: 3.0% (quantitativo)
     - Equipamentos: Roche Cobas e411, Siemens Immulite 1000
     - Crítico: Parcial (valores muito altos/baixos em gravidez complicada)
     - Rastreabilidade: Integração com IA training dataset (Phase 5)

  4. Sífilis (VDRL + FTA-Abs)
     - Unitário: Títulos (VDRL: 1:1, 1:2, 1:4... até 1:256)
     - Método: Reação com lipóide / Anticorpo fluorescente
     - Equipamentos: Automatizado (some labs manual)
     - Crítico: SIM (Notificação SINAN)
     - DICQ requisito: 5.5.2 (teste de confirmação FTA-Abs)

  5. COVID-19 IgG (SARS-CoV-2 Antibody)
     - Unitário: Positivo/Negativo (qualitativo) ou AU/mL (quantitativo)
     - Método: ELISA / Chemiluminescence
     - Equipamentos: Abbott Architect, Siemens Centaur
     - Crítico: NÃO (sorologia apenas, não diagnóstico agudo)

  6. Hepatite B HBsAg (Hepatitis B Surface Antigen)
     - Unitário: Positivo/Negativo (qualitativo)
     - Método: ECLIA / Chemiluminescence
     - Crítico: SIM (notificação obrigatória)
     - Equipamentos: Roche, Siemens, Abbott

  7. Hepatite C Anti-HCV (Hepatitis C Antibody)
     - Unitário: Positivo/Negativo
     - Método: ECLIA
     - Crítico: SIM

  8. Rubéola IgM (Rubella Immunoglobulin M)
     - Unitário: Positivo/Negativo
     - Método: ELISA
     - Crítico: SIM (notificação saúde pública)

  9. Toxoplasmose IgM (Toxoplasmosis IgM)
     - Unitário: Positivo/Negativo
     - Método: ELISA / CLIA
     - Crítico: Parcial (gestante)

 10. Chagas IgG (Trypanosoma cruzi Antibody)
     - Unitário: Positivo/Negativo
     - Método: ELISA / Immunofluorescence
     - Crítico: SIM (notificação compulsória no Brasil)

Instrumentos suportados:
  - Abbott i2000SR (Japão) — padrão Riopomba Imunologia
  - Roche Cobas c501 (Suíça)
  - Siemens Centaur XP (Alemanha)
  - Mindray CL-900i (China) — novo 2026

QC Material:
  - Painel multi-analito: HIV, Hepatite, Sífilis, COVID (1 kit 3 níveis)
  - Lotes: fabricante fornece estatística de referência
  - Rastreabilidade: supplier → lote → data validade
```

### 2.2 Firestore Schema — Immunology

```firestore
/labs/{labId}/ciq-imuno/
  root/
  root/analitos/{analitoId}               (HIV, Dengue, HCG, Sífilis, COVID, Hep B/C, etc.)
  root/lotes/{lotId}                      (QC painel multi-analito)
  root/runs/{runId}                       (1 run = N analitos qualitativo × 1 nível × 1 equip)
  root/equipamentos/{equipId}             (Abbott i2000SR #1, Roche Cobas #2, etc.)
  root/thresholds-criticos/{analitoId}    (HIV = Positivo, HCG extreme values, etc.)
  root/ias-upload-queue/{queueId}         (Phase 5: strip image upload → Gemini Vision)
  root/ias-annotations/{imageId}          (IA training dataset versioning + feedback)
  root/notivisa-pending/{eventId}         (append-only: eventos aguardando envio NOTIVISA)
  root/serial-dilution/{dilutionId}       (HCG quantitativo: dilutions, curva calibração)
  root/traceability-events/{eventId}
  root/audit/{logId}
  root/config/{singleton}
```

### 2.3 Serial Dilution + Quantitative Path (HCG case study)

```
Para analitos quantitativos (HCG, Troponina futura):

Serial dilution workflow:
  1. Lab recebe amostra HCG > 100.000 mIU/mL (off-curve)
  2. Técnico faz diluição manual: 1:10, 1:100, 1:1.000 (até on-curve)
  3. Equipamento roda cada diluição → raw results
  4. Cloud Function (calculateSerialDilution) reconstrói valor original
     - Fórmula: final_value = result × dilution_factor
     - Validação: cada diluição deve estar no range (CV check)
     - Flag: "serial dilution applied" → laudo exibe "*"

QC control:
  - Painel de HCG calibração: Low (25 mIU/mL), Normal (50), High (200)
  - Cada run de rotina carrega esses 3 níveis + sample
  - Westgard avalia 3 níveis independentemente
  - Quantitativo segue bioquímica: CV%, 1-2s, 1-3s, 2-2s, R-4s rules

Rastreabilidade:
  - Event no traceability-events: "HCG diluição 1:100 executada"
  - ChainHash assinado pelo operador
```

### 2.4 Critical Thresholds + NOTIVISA Integration (Coag + Imuno)

```
Thresholds críticos que trigam escalação imediata (RDC 978 Arts. 115–117):

Coagulation:
  - INR > 4.0 ou < 0.8 (fora intervalo terapêutico)
  - PT < 11s ou > 14s (Neisler)
  - aPTT > 50s (suspeita de anticoagulante)

Immunology:
  - HIV: Positivo (qualquer método)
  - Sífilis: Positivo VDRL + FTA-Abs
  - Dengue: Positivo IgM
  - Hepatite B/C: Positivo
  - Chagas: Positivo
  - HCG > 500.000 mIU/mL (probabilidade molar gestation)

Ação Cloud Function (Phase 5: escalateCriticalValue):
  1. Run salva resultado crítico
  2. Callable `escalateCriticalValue(runId, analitoId, operadorId)` invocada
  3. Função escreve em `/labs/{labId}/criticos-escalacoes/{eventId}`:
     {
       labId, analitoId, runId, valor, nivelCriterio,
       operadorId, ts: server timestamp,
       notivisaPending: true,
       notivisaSentAt: null,
       chainHash: ...
     }
  4. Background job (Cloud Task) enfileira NOTIVISA POST
  5. Retenção: 90 dias (RDC 978 Art. 5.3 audit trail)

Requisito DICQ 4.3 Bloco F.4.2.2 (Critical values):
  - Documentação: POL-CRITICOS (linkado via sgq)
  - Treinamento: testes de competência (treinamentos module)
  - Validação: SMS/email delivered <2min (Phase 5 SLA)
```

---

## 3. Urinalysis Analytes (Leucocytes, Nitrites, Proteins, Blood, Glucose, pH, Specific Gravity)

### 3.1 Analytes Definition (7 core)

```
Urinalysis CIQ Module — DICQ 4.3 Bloco F.5.5.1 (Exame de Urina)
RDC 978/2025 Arts. 179 (CIQ)

Core analytes:
  1. Leucócitos (Leucocytes)
     - Unitário: 0 / Traço / 1+ / 2+ / 3+ (semiquantitativo)
     - Método: Esterase leucocitária (dipstick)
     - Range esperado: 0 (negativo)
     - CV alvo: NA (qualitativo)
     - Equipamentos: Sysmex UF-5000, Mindray UF-500i (automatizado); manual dipstick

  2. Nitritos (Nitrites)
     - Unitário: Pos/Neg (qualitativo dipstick)
     - Método: Reação de Griess (nitrito + p-aminobenzoic acid)
     - Range esperado: Negativo
     - Crítico: SIM (Nitritos + Leucócitos ↑ = UTI suspeita)
     - Equipamentos: Sysmex UF-5000 (automatizado ou manual)

  3. Proteínas (Proteins)
     - Unitário: 0 / Traço / 1+ / 2+ / 3+ / 4+ (semiquantitativo)
     - Método: Indicador de pH tetrabromo-fenol (dipstick)
     - Range esperado: Negativo ou Traço
     - Crítico: Parcial (3+ / 4+ indica proteinúria significativa)

  4. Sangue (Blood)
     - Unitário: Neg / Traço / 1+ / 2+ / 3+ (semiquantitativo)
     - Método: Peroxidase-like (hemoglobina/mioglobina)
     - Range esperado: Negativo
     - Crítico: SIM (Sangue sem RBCs = hemoglobinúria ou mioglobinúria)

  5. Glicose (Glucose)
     - Unitário: Neg / Traço / 1+ / 2+ / 3+ (semiquantitativo)
     - Método: Glucose oxidase (dipstick)
     - Range esperado: Negativo (glicose filtrada = <1 mg/dL)
     - Crítico: SIM (positivo = hiperglicemia significativa)

  6. pH (Acidity)
     - Unitário: 4.5–8.5 (contínuo, 0.5 step)
     - Método: Indicador de pH universal (dipstick)
     - Range esperado: 5.0–7.0 (mayoría amostras)
     - Crítico: NÃO (mas alterações radicais indicam contaminação)

  7. Gravidade Específica (Specific Gravity)
     - Unitário: 1.005–1.030 (refratômetro ou dipstick)
     - Método: Refratometria (gold standard) ou densidade (dipstick)
     - Range esperado: 1.010–1.025 (amostra típica)
     - Crítico: NÃO (porém <1.005 = diluída, >1.030 = concentrada)

Instrumentos suportados:
  - Sysmex UF-5000 (Japão) — padrão Riopomba, automatizado full
  - Mindray UF-500i (China) — novo 2026
  - Manual + dipstick reader (Siemens Clinitek 100)
  - Microscopia opcional (não CIQ stricto, Phase 5+)

QC material:
  - Controle positivo/negativo (solução comercial)
  - Validação: diária antes corrida (RDC 978 Art. 183)
  - Estabilidade: 4ºC, máx 7 dias aberto
```

### 3.2 Dipstick Reader Integration

```
Para labs com equipamento dipstick (não full automation):

Workflow (Manual Dipstick):
  1. Técnico coloca amostra em tubo
  2. Submete dipstick (tira reagente)
  3. Aguarda 60 segundos
  4. Fotografa resultado com câmera (phone/tablet)
  5. Envia imagem + manual entry para Cloud Function `analyzeUrinalysisDipstick`

Cloud Function `analyzeUrinalysisDipstick`:
  1. Recebe imagem JPEG
  2. Invoca Gemini Vision 2.5 com prompt:
     "Analise esta fita de análise de urina. Extraia os campos:
      Leucócitos, Nitritos, Proteínas, Sangue, Glicose, pH, Densidade.
      Retorne JSON com valores de 0–3+ ou contínuos."
  3. Retorna JSON structured:
     {
       leucocitos: "2+",
       nitritos: "Neg",
       proteinas: "1+",
       sangue: "Neg",
       glicose: "Neg",
       ph: 6.5,
       specificGravity: 1.018,
       confidence: 0.94,
       warnings: []
     }
  4. Salva em run + image ref (storage bucket)

QC Control para dipstick:
  - Painel de amostra positiva conhecida (diária)
  - Fotografa, AI analisa, compara vs resultado esperado
  - Se CV > 5%, operador revê ou descarta lote

Rastreabilidade:
  - Image stored em: `/labs/{labId}/uroanalise/images/{runId}-original.jpg`
  - Metadata: operador, timestamp, equipamento (manual/Sysmex), hash imagem
  - Audit: "Imagem analisada por Gemini Vision v2.5 em 2026-05-28T10:30:00Z"
```

### 3.3 Firestore Schema — Urinalysis

```firestore
/labs/{labId}/uroanalise/
  root/
  root/analitos/{analitoId}               (Leucócitos, Nitritos, Proteínas, Sangue, etc.)
  root/lotes/{lotId}                      (Tiras reagentes lote, data fab, data venc)
  root/runs/{runId}                       (1 run = 7 analitos urina × 1 amostra)
  root/equipamentos/{equipId}             (Sysmex UF-5000, Manual+Dipstick, etc.)
  root/dipstick-images/{imageId}          (storage ref + Gemini Vision result)
  root/microscopia/{microscopiaId}        (Phase 5: cilindros, cristais, bactérias — manual review)
  root/thresholds-criticos/{analitoId}    (Leucócitos 3+, Sangue 2+, etc.)
  root/traceability-events/{eventId}
  root/audit/{logId}
  root/config/{singleton}
```

---

## 4. Multi-Instrument Validation & Equipment Registry

### 4.1 Equipment Registry Schema

```
/labs/{labId}/instrumentos/
  {equipId}: {
    id: string;
    labId: LabId;
    nome: string;                         // "Sysmex CA-7000 #1"
    modelo: "Sysmex CA-7000" | "ACL TOP" | "Roche Cobas c501" | ...;
    numeroSerie: string;
    fabricante: string;
    dataInstalacao: Date;
    dataProximaManutencao: Date;

    modulos: Array<{
      tipo: "coagulacao" | "bioquimica" | "ciq-imuno" | "uroanalise";
      analitoIds: string[];               // [PT, INR, aPTT, ...]
      metodologia: string;

      // Per-analyte calibration records
      calibracoes: Array<{
        analitoId: string;
        dataCalibração: Date;
        operadorId: string;
        fatorCorrecao: number;            // E.g., 1.02
        chainHash: string;
        certificaçãoCalibrador?: {
          data: Date;
          rastreavel: boolean;            // NIST / comparação interlaboratorial
        };
      }>;
    }>;

    manutencoes: Array<{
      data: Date;
      tipo: "preventiva" | "corretiva";
      descricao: string;
      operadorId: string;
      horas: number;
      certificado?: string;               // link a documento sgd
    }>;

    ativo: boolean;
    criadoEm: Timestamp;
    deletadoEm: Timestamp | null;
  }
```

### 4.2 Method Comparison Workflow (RDC 978 Art. 181)

```
Regra: quando trocar de equipamento ou metodologia, lab MUST fazer
comparação de método (n=20 pares lado-a-lado) antes de liberar em rotina.

Exemplo: PT Neisler (Sysmex CA-7000) vs PT Quick (novo Mindray BC):
  - Roda 20 QC amostra em ambos os equipamentos simultâneamente
  - Calcula correlação, slope, intercept (regressão linear)
  - CLSI EP9 aceitação: correlação ≥ 0.99 (para PT coagulação)
  - Resultado guardado em `/labs/{labId}/comparacao-metodos/{compId}`:
    {
      id: string;
      labId: LabId;
      analitoId: "PT";
      metodoReferencia: {
        equipId: "sysmex-ca7000-1";
        equipNome: "Sysmex CA-7000 #1";
        metodologia: "Neisler";
      };
      metodoNovo: {
        equipId: "mindray-bc-1";
        equipNome: "Mindray BC-7000 #1";
        metodologia: "Quick";
      };

      dados: Array<{
        numero: 1;
        valorRef: 12.5;
        valorNovo: 12.3;
        diferencaAbs: 0.2;
        diferenca%: 1.6;
      }>;

      estatistica: {
        n: 20;
        correlacao: 0.9967;
        slope: 0.98;
        intercept: 0.25;
        rSE: 0.35;
        aprovado: true;
        criterioAceite: "CLSI EP9: r ≥ 0.99";
      };

      dataComparacao: Date;
      operadorId: string;
      supervisorId: string;
      assinatura: LogicalSignature;

      criadoEm: Timestamp;
      deletadoEm: Timestamp | null;
    }

  - DICQ requisito 5.5.1.3: "Validação de método alternativo"
  - UI: tab "Comparação de Métodos" mostra resultado + gráfico scatter
```

### 4.3 Calibration Data Per Instrument + Analyte

```
Per-equipment calibration logged separately:

/labs/{labId}/calibracoes/{calibId}:
  {
    id: string;
    labId: LabId;
    equipmentId: string;
    analitoId: string;
    dataCalibração: Date;

    tipo: "fabricante" | "laboratório";

    // Fabricante = padrão NIST rastreável
    // Laboratório = comparação com padrão interno

    fatorCorrecao: number;

    certificado?: {
      url: string;                        // sgd link
      rastreabilidadeNIST: boolean;
      dataValidade: Date;
    };

    operadorId: string;
    supervisorId?: string;                // para calibrações críticas

    chainHash: string;
    criadoEm: Timestamp;
  }

Validação RDC 978 Art. 181:
  - Lab cumpre calendário de calibração (diária/semanal/mensal por analito)
  - Relatório mensal (`generateMonthlyCalibrationReport`) lista:
    * Datas de calibração cumpridas
    * Fator de correção trend (drift detection)
    * Equipamentos fora de calibração (red flag)
```

---

## 5. Reagent/QC Lot Versioning & Expiry Management

### 5.1 Lot Schema with Bula Parser Integration

```
/labs/{labId}/lotes-ciq/{lotId}:  (consolidado cross-module)
  {
    id: string;
    labId: LabId;

    // Identificação
    supplier: "Neoplastine" | "Abbott" | "Roche" | "Sysmex";
    produtoNome: "QC Coagulation Level 1" | "HCG Painel Imuno";
    lotNumber: "QC-2026-001";

    modulos: ["coagulacao", "ciq-imuno"];  // quais módulos usam
    analitoIds: ["PT", "INR", "aPTT"];

    // Datas críticas
    dataFabricacao: Date;
    dataValidade: Date;
    dataAberto: Date | null;
    dataUltimoUso: Date | null;

    // Equipamentos compatíveis
    equipmentIds: ["sysmex-ca7000-1", "acl-top-1"];

    // Bula parsed (Cloud Function `parseBulaLot` — Phase 9-03)
    bulaUrl?: string;                     // storage bucket ref
    bulaParsed?: {
      dataExtracaoGemini: Date;

      // Estadística do fabricante
      meios: Map<string, number>;        // { "PT": 12.5, "INR": 0.98 }
      desvios: Map<string, number>;      // { "PT": 0.4, "INR": 0.05 }
      cv%: Map<string, number>;          // { "PT": 3.2, "INR": 5.1 }

      // Range de aceitação por nível
      niveis: Array<{
        numero: 1 | 2 | 3;
        nomeComercia: "Level 1 Normal" | "Level 2 Prolongado" | "Level 3 Muito Prolongado";
        mediaEsperada: number;
        desvioEsperado: number;
        rangeAceite: { min: number; max: number };
      }>;

      // Método + rastreabilidade
      metodologia: string;
      rastreabilidadeNIST?: boolean;
    };

    // Status uso
    ativo: boolean;                       // false = vencido ou descartado
    motorivoInativacao?: "expiry" | "discard" | "recall";

    // Auditoria
    criadoEm: Timestamp;
    criadoPor: string;
    deletadoEm: Timestamp | null;
  }

Validação ao criar run (Cloud Function `recordAnalyteRun`):
  1. Recebe runPayload com `lotId`
  2. Lê lote: if (dataValidade < now()) → reject com "Lote vencido"
  3. Se `ativo: false` → reject
  4. Se `equipmentIds` não inclui run.equipmentId → warn (mas não block)
  5. Cria run com referência `lotId` + snapshot de meios/desvios (imutável)
```

### 5.2 Automatic Expiry Enforcement

```
Cloud Scheduler job (diária, 00:05 UTC):
  - Cron: "0 5 * * *"
  - Função: `checkLotExpiryDaily`
  - Ação:
    1. Query: SELECT * FROM lotes WHERE dataValidade < DATE_ADD(NOW(), INTERVAL 7 DAY) AND ativo=true
    2. Para cada lote próximo a vencer:
       - Cria `traceability-event`: "Lote {lotNumber} expira em 7 dias"
       - Marca `ativo: false` se já passou dataValidade
       - Enfileira notificação NOTIVISA (se aplicável)
    3. Cloud Logs: "Lotes inativos: {count}. Labs notificados: {labIds}"

Efeito imediato:
  - UI admin exibe banner amarelo/vermelho "Lotes vencidos: 3"
  - Runs subsequentes recusam lotes vencidos (validação em callable)
  - DICQ 5.5.1.3: "Conformidade com validade de reagentes — 100%"
```

---

## 6. Firestore Schema Sketch (All Modules)

### 6.1 Collections Overview

```
/labs/{labId}/bioquimica/
  root/
  root/analitos/{analitoId}
  root/lotes/{lotId}
  root/runs/{runId}                      (callable-only)
  root/equipamentos/{equipId}
  root/thresholds-criticos/{analitoId}
  root/traceability-events/{eventId}     (append-only)
  root/audit/{logId}                     (append-only, chainHash)
  root/config/{singleton}
  root/relatorios-mensais/{reportId}     (auto-generated via CF)

/labs/{labId}/coagulacao/
  [same structure as bioquimica]
  + root/comparacao-metodos/{compId}     (method comparison results)

/labs/{labId}/ciq-imuno/
  [same structure]
  + root/ias-upload-queue/{queueId}      (Phase 5)
  + root/ias-annotations/{imageId}       (Phase 5)
  + root/notivisa-pending/{eventId}      (NOTIVISA outbox)
  + root/serial-dilution/{dilutionId}

/labs/{labId}/uroanalise/
  [same structure]
  + root/dipstick-images/{imageId}       (storage refs)
  + root/microscopia/{microscopiaId}     (Phase 5+)

# Cross-module (shared)
/labs/{labId}/calibracoes/{calibId}      (all modules: equipment calirations)
/labs/{labId}/equipamentos/{equipId}     (all modules: instrument registry)
```

### 6.2 Firestore Rules Scope (Phase 10-02)

```firestore
// Analitos — cliente direto (read/list), admin write via callable
match /labs/{labId}/bioquimica/root/analitos/{analitoId} {
  allow read: if isActiveMemberOfLab(labId);
  allow create, update, delete: if isAdminOrOwner(labId);
}

// Runs — callable-only (client NEVER writes directly)
match /labs/{labId}/bioquimica/root/runs/{runId} {
  allow read: if isActiveMemberOfLab(labId);
  allow create, update: if request.auth.token.custom.isCallableContext == true
                           && request.auth.uid == get(/databases/$(database)/documents/labs/$(labId)/staff/$(request.auth.uid)).operadorId;
  allow delete: never;  // soft-delete only
}

// Audit events — append-only
match /labs/{labId}/bioquimica/root/audit/{logId} {
  allow read: if isActiveMemberOfLab(labId) || isAdminOrOwner(labId);
  allow create: if request.auth.token.custom.isCallableContext == true
                   && request.resource.data.chainHash.size() == 64
                   && request.resource.data.ts is timestamp;
  allow update, delete: never;
}

// Equipment registry — admin write, all read
match /labs/{labId}/equipamentos/{equipId} {
  allow read: if isActiveMemberOfLab(labId);
  allow create, update: if isAdminOrOwner(labId);
  allow delete: never;  // soft-delete via ativo: false
}

// Method comparison — admin write (after validation complete)
match /labs/{labId}/coagulacao/root/comparacao-metodos/{compId} {
  allow read: if isActiveMemberOfLab(labId);
  allow create: if isAdminOrOwner(labId);
  allow update, delete: never;
}
```

---

## 7. Cloud Functions Callables (Phase 10-02, 10-03, 10-04)

### 7.1 recordAnalyteRun (Multi-Module Unified)

```typescript
/**
 * functions/src/callable/recordAnalyteRun.ts
 *
 * Unified callable für bioquímica, coagulação, imunologia, uroanálise.
 * Orquestra:
 *   1. Validação de payload + operador
 *   2. Pré-flight: lote válido? equipamento ativo? Westgard status?
 *   3. Cálculo: Westgard rules, serial dilution (se aplicável)
 *   4. Escrita atomic: run + traceability + audit
 *   5. Escalação: critical value → NOTIVISA pending
 */

interface RunPayload {
  labId: string;
  modulo: 'bioquimica' | 'coagulacao' | 'ciq-imuno' | 'uroanalise';
  equipmentId: string;
  lotId: string;
  operadorId: string; // from auth context

  // Analyte results grouped by level
  resultados: Array<{
    analitoId: string;
    nivelId: '1' | '2' | '3'; // QC level
    valor: number; // para quant. ou código enum para qualit.
    unidade: string;
  }>;

  // Optional: serie dilution data
  diluicaoSerializacao?: {
    amostra: string;
    fatorDiluicao: number;
    resultadoBase: number;
  };

  // Optional: dipstick image for uroanalise
  dipstickImageUrl?: string;
}

async function recordAnalyteRun(payload: RunPayload, context: CallableContext) {
  // 1. Verify auth + operador active
  const uid = context.auth?.uid;
  if (!uid) throw new Error('Unauthorized');

  const labId = payload.labId;
  const staffDoc = await admin.firestore().doc(`/labs/${labId}/staff/${uid}`).get();
  if (!staffDoc.exists) throw new Error('Not a lab member');

  // 2. Pre-flight validation
  const loteDoc = await admin
    .firestore()
    .doc(`/labs/${labId}/${payload.modulo}/root/lotes/${payload.lotId}`)
    .get();

  if (!loteDoc.exists) throw new Error('Lot not found');
  const lote = loteDoc.data() as LoteData;

  if (new Date() > lote.dataValidade) {
    throw new Error(`Lot expired: ${lote.lotNumber}`);
  }

  const equipDoc = await admin
    .firestore()
    .doc(`/labs/${labId}/equipamentos/${payload.equipmentId}`)
    .get();

  if (!equipDoc.exists || !equipDoc.data().ativo) {
    throw new Error('Equipment not found or inactive');
  }

  // 3. Calculate Westgard rules + stats
  const runId = admin.firestore().collection('dummy').doc().id;
  const chainHash = calculateChainHash(JSON.stringify(payload) + runId + Date.now());

  const westgardStatus = evaluateWestgardRules({
    modulo: payload.modulo,
    analitos: payload.resultados,
    labId,
    equipmentId: payload.equipmentId,
    lote,
  });

  // 4. Atomic write: run + events + audit
  const batch = admin.firestore().batch();

  batch.create(admin.firestore().doc(`/labs/${labId}/${payload.modulo}/root/runs/${runId}`), {
    id: runId,
    labId,
    equipmentId: payload.equipmentId,
    lotId: payload.lotId,
    operadorId: uid,
    resultados: payload.resultados,
    westgardStatus,
    assinatura: {
      hash: chainHash,
      operatorId: uid,
      ts: admin.firestore.Timestamp.now(),
    },
    criadoEm: admin.firestore.Timestamp.now(),
    deletadoEm: null,
  });

  // Traceability event
  batch.create(
    admin.firestore().doc(`/labs/${labId}/${payload.modulo}/root/traceability-events/${runId}`),
    {
      id: runId,
      labId,
      tipo: 'run-recorded',
      runId,
      operadorId: uid,
      ts: admin.firestore.Timestamp.now(),
      detalhes: {
        equipmentId: payload.equipmentId,
        lotId: payload.lotId,
        analitoCount: payload.resultados.length,
      },
    },
  );

  // Audit log
  batch.create(admin.firestore().doc(`/labs/${labId}/${payload.modulo}/root/audit/${runId}`), {
    id: runId,
    labId,
    acao: 'run-recorded',
    runId,
    operadorId: uid,
    chainHash,
    ts: admin.firestore.Timestamp.now(),
  });

  // 5. Critical value escalation
  if (westgardStatus.some((s) => s.isCritical)) {
    const criticos = payload.resultados.filter(
      (r) => westgardStatus.find((s) => s.analitoId === r.analitoId)?.isCritical,
    );

    for (const crit of criticos) {
      batch.create(
        admin.firestore().doc(`/labs/${labId}/criticos-escalacoes/${runId}-${crit.analitoId}`),
        {
          labId,
          analitoId: crit.analitoId,
          runId,
          valor: crit.valor,
          modulo: payload.modulo,
          operadorId: uid,
          notivisaPending: true,
          notivisaSentAt: null,
          ts: admin.firestore.Timestamp.now(),
        },
      );
    }
  }

  await batch.commit();

  return {
    runId,
    success: true,
    westgardStatus,
    criticalValuesCount: westgardStatus.filter((s) => s.isCritical).length,
  };
}

export const recordAnalyteRunCallable = functions
  .region('southamerica-east1')
  .https.onCall(recordAnalyteRun);
```

### 7.2 validateLotExpiry (Pre-Flight Check)

```typescript
/**
 * functions/src/callable/validateLotExpiry.ts
 *
 * Verificação rápida before run creation:
 * - Lot ainda válido?
 * - Lot ativo no sistema?
 * - Equipment suportado?
 */

async function validateLotExpiry(
  payload: { labId: string; lotId: string; modulo: string },
  context,
) {
  const { labId, lotId, modulo } = payload;

  const loteDoc = await admin.firestore().doc(`/labs/${labId}/${modulo}/root/lotes/${lotId}`).get();

  if (!loteDoc.exists) {
    return { valid: false, reason: 'Lot not found' };
  }

  const lote = loteDoc.data() as LoteData;
  const now = new Date();

  if (now > lote.dataValidade) {
    return {
      valid: false,
      reason: `Lot expired on ${lote.dataValidade.toISOString()}`,
      daysOverdue: Math.floor((now.getTime() - lote.dataValidade.getTime()) / (1000 * 86400)),
    };
  }

  if (!lote.ativo) {
    return { valid: false, reason: 'Lot is inactive' };
  }

  const daysUntilExpiry = Math.floor(
    (lote.dataValidade.getTime() - now.getTime()) / (1000 * 86400),
  );

  return {
    valid: true,
    daysUntilExpiry,
    warning: daysUntilExpiry < 7 ? `Lot expires in ${daysUntilExpiry} days` : null,
  };
}

export const validateLotExpiryCallable = functions
  .region('southamerica-east1')
  .https.onCall(validateLotExpiry);
```

### 7.3 compareMultiInstrument (Method Comparison Orchestrator)

```typescript
/**
 * functions/src/callable/compareMultiInstrument.ts
 *
 * Orquestra validação de novo equipamento/metodologia contra método de referência.
 * Usa regressão linear (CLSI EP9) + gráfico scatter para aprovação.
 */

interface MethodComparisonPayload {
  labId: string;
  analitoId: string;
  modulo: "coagulacao" | "bioquimica";

  equipReference: {
    equipId: string;
    name: string;
    metodologia: string;
  };
  equipNew: {
    equipId: string;
    name: string;
    metodologia: string;
  };

  // Pares lado-a-lado (n=20+)
  pares: Array<{
    valorRef: number;
    valorNew: number;
  }>;

  operadorId: string;
  supervisorId: string;
}

async function compareMultiInstrument(payload: MethodComparisonPayload, context) {
  const { labId, analitoId, modulo } = payload;

  // 1. Validação de entrada
  if (payload.pares.length < 20) {
    throw new Error("Minimum 20 data pairs required for method comparison");
  }

  // 2. Regressão linear (Y = slope*X + intercept)
  const stats = calculateLinearRegression(payload.pares);

  // { slope: 0.98, intercept: 0.25, r: 0.9967, rSE: 0.35 }

  // 3. Criterio CLSI EP9 para aceitacao
  const aprovado = stats.r >= 0.99 && Math.abs(1.0 - stats.slope) < 0.02;

  // 4. Salvar resultado
  const compId = admin.firestore().collection("dummy").doc().id;

  await admin.firestore()
    .doc(`/labs/${labId}/${modulo}/root/comparacao-metodos/${compId}`)
    .set({
      id: compId,
      labId,
      analitoId,
      modulo,

      metodoReferencia: payload.equipReference,
      metodoNovo: payload.equipNew,

      dados: payload.pares.map((p, i) => ({
        numero: i + 1,
        valorRef: p.valorRef,
        valorNovo: p.valorNew,
        diferencaAbs: Math.abs(p.valorNew - p.valorRef),
        diferenca%: ((p.valorNew - p.valorRef) / p.valorRef * 100),
      })),

      estatistica: {
        n: payload.pares.length,
        ...stats,
        aprovado,
        criterioAceite: "CLSI EP9: r >= 0.99 && |slope-1| < 0.02",
      },

      dataComparacao: admin.firestore.Timestamp.now(),
      operadorId: payload.operadorId,
      supervisorId: payload.supervisorId,

      assinatura: {
        hash: calculateChainHash(JSON.stringify(stats) + compId),
        operatorId: payload.supervisorId,
        ts: admin.firestore.Timestamp.now(),
      },

      criadoEm: admin.firestore.Timestamp.now(),
      deletadoEm: null,
    });

  return {
    compId,
    aprovado,
    stats,
  };
}

export const compareMultiInstrumentCallable = functions
  .region("southamerica-east1")
  .https
  .onCall(compareMultiInstrument);
```

---

## 8. Seed Data (30+ Analytes)

### 8.1 Seed Dataset JSON

```json
{
  "analitos": {
    "coagulacao": [
      {
        "id": "coag-pt",
        "nome": "PT (Prothrombin Time)",
        "sigla": "PT",
        "unidade": "s",
        "rangeBiologico": { "min": 11.0, "max": 13.5 },
        "metodo": "Neisler",
        "cvAlvo": 4.0,
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "coag-inr",
        "nome": "INR",
        "sigla": "INR",
        "unidade": "razão",
        "rangeBiologico": { "min": 0.8, "max": 1.1 },
        "metodo": "Calculado (PT / PT ref × ISI)",
        "cvAlvo": 5.5,
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "coag-aptt",
        "nome": "aPTT",
        "sigla": "aPTT",
        "unidade": "s",
        "rangeBiologico": { "min": 25.0, "max": 35.0 },
        "metodo": "DRVV",
        "cvAlvo": 6.0,
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "coag-tt",
        "nome": "Thrombin Time",
        "sigla": "TT",
        "unidade": "s",
        "rangeBiologico": { "min": 14.0, "max": 18.0 },
        "metodo": "Thrombin-agarose",
        "cvAlvo": 8.0,
        "critico": false,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "coag-fib",
        "nome": "Fibrinogênio",
        "sigla": "Fib",
        "unidade": "mg/dL",
        "rangeBiologico": { "min": 200, "max": 400 },
        "metodo": "Cláusula (Funcional)",
        "cvAlvo": 5.0,
        "critico": true,
        "ativo": true,
        "seedDefault": true
      }
    ],
    "ciq-imuno": [
      {
        "id": "imuno-hiv",
        "nome": "HIV 1+2 Ag/Ab",
        "sigla": "HIV",
        "unidade": "Pos/Neg",
        "metodo": "4ª geração ELISA",
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "imuno-dengue-igm",
        "nome": "Dengue IgM",
        "sigla": "Dengue",
        "unidade": "Pos/Neg",
        "metodo": "ELISA",
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "imuno-hcg",
        "nome": "HCG-β",
        "sigla": "HCG",
        "unidade": "mIU/mL",
        "rangeBiologico": { "min": 0, "max": 5 },
        "metodo": "ECLIA",
        "cvAlvo": 3.0,
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "imuno-sifilis-vdrl",
        "nome": "Sífilis (VDRL)",
        "sigla": "VDRL",
        "unidade": "Títulos",
        "metodo": "Reação com lipóide",
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "imuno-covid-igg",
        "nome": "COVID-19 IgG",
        "sigla": "COVID",
        "unidade": "Pos/Neg",
        "metodo": "ELISA",
        "critico": false,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "imuno-hbsag",
        "nome": "Hepatite B (HBsAg)",
        "sigla": "HBsAg",
        "unidade": "Pos/Neg",
        "metodo": "ECLIA",
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "imuno-anti-hcv",
        "nome": "Hepatite C (Anti-HCV)",
        "sigla": "Anti-HCV",
        "unidade": "Pos/Neg",
        "metodo": "ECLIA",
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "imuno-rubeola-igm",
        "nome": "Rubéola IgM",
        "sigla": "Rubéola",
        "unidade": "Pos/Neg",
        "metodo": "ELISA",
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "imuno-toxo-igm",
        "nome": "Toxoplasmose IgM",
        "sigla": "Toxo",
        "unidade": "Pos/Neg",
        "metodo": "ELISA",
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "imuno-chagas-igg",
        "nome": "Chagas (IgG)",
        "sigla": "Chagas",
        "unidade": "Pos/Neg",
        "metodo": "ELISA",
        "critico": true,
        "ativo": true,
        "seedDefault": true
      }
    ],
    "uroanalise": [
      {
        "id": "uro-leucocitos",
        "nome": "Leucócitos",
        "sigla": "Leuco",
        "unidade": "0 / Traço / 1+ / 2+ / 3+",
        "metodo": "Esterase leucocitária",
        "critico": false,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "uro-nitritos",
        "nome": "Nitritos",
        "sigla": "Nit",
        "unidade": "Pos/Neg",
        "metodo": "Griess",
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "uro-proteinas",
        "nome": "Proteínas",
        "sigla": "Prot",
        "unidade": "Neg / Traço / 1+ / 2+ / 3+ / 4+",
        "metodo": "Indicador pH tetrabromo-fenol",
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "uro-sangue",
        "nome": "Sangue",
        "sigla": "Sang",
        "unidade": "Neg / Traço / 1+ / 2+ / 3+",
        "metodo": "Peroxidase-like",
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "uro-glicose",
        "nome": "Glicose",
        "sigla": "Glic",
        "unidade": "Neg / Traço / 1+ / 2+ / 3+",
        "metodo": "Glucose oxidase",
        "critico": true,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "uro-ph",
        "nome": "pH",
        "sigla": "pH",
        "unidade": "4.5–8.5",
        "metodo": "Indicador universal",
        "critico": false,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "uro-densidade",
        "nome": "Gravidade Específica",
        "sigla": "Dens",
        "unidade": "1.005–1.030",
        "metodo": "Refratometria",
        "critico": false,
        "ativo": true,
        "seedDefault": true
      }
    ],
    "bioquimica-extended": [
      {
        "id": "bioquim-bilirrubina-total",
        "nome": "Bilirrubina Total",
        "sigla": "BT",
        "unidade": "mg/dL",
        "rangeBiologico": { "min": 0.1, "max": 1.3 },
        "metodo": "Diazo (Sims-Horn)",
        "cvAlvo": 8.0,
        "ativo": true,
        "seedDefault": true
      },
      {
        "id": "bioquim-albumina",
        "nome": "Albumina",
        "sigla": "Alb",
        "unidade": "g/dL",
        "rangeBiologico": { "min": 3.5, "max": 5.5 },
        "metodo": "Verde de bromocresol",
        "cvAlvo": 4.0,
        "ativo": true,
        "seedDefault": true
      }
    ]
  },
  "lotes-qc": [
    {
      "supplier": "Neoplastine",
      "produtoNome": "QC Coagulation Level 1-3",
      "lotNumber": "QC-COAG-2026-001",
      "dataFabricacao": "2026-01-15",
      "dataValidade": "2026-07-15",
      "modulos": ["coagulacao"],
      "analitoIds": ["coag-pt", "coag-inr", "coag-aptt"],
      "bulaParsed": {
        "meios": { "coag-pt": 12.5, "coag-inr": 0.98, "coag-aptt": 30.2 },
        "desvios": { "coag-pt": 0.4, "coag-inr": 0.05, "coag-aptt": 1.2 },
        "cv%": { "coag-pt": 3.2, "coag-inr": 5.1, "coag-aptt": 4.0 }
      }
    }
  ],
  "equipamentos": [
    {
      "nome": "Sysmex CA-7000 #1",
      "modelo": "Sysmex CA-7000",
      "numeroSerie": "SCA7000001",
      "fabricante": "Sysmex Corporation",
      "dataInstalacao": "2024-06-15",
      "modulos": [
        {
          "tipo": "coagulacao",
          "analitoIds": ["coag-pt", "coag-inr", "coag-aptt", "coag-fib"]
        }
      ]
    },
    {
      "nome": "Sysmex UF-5000 #1",
      "modelo": "Sysmex UF-5000",
      "numeroSerie": "SUF5000001",
      "fabricante": "Sysmex Corporation",
      "dataInstalacao": "2024-06-15",
      "modulos": [
        {
          "tipo": "uroanalise",
          "analitoIds": [
            "uro-leucocitos",
            "uro-nitritos",
            "uro-proteinas",
            "uro-sangue",
            "uro-glicose",
            "uro-ph",
            "uro-densidade"
          ]
        }
      ]
    }
  ]
}
```

---

## 9. E2E Test Specs (12 Scenarios)

### 9.1 Test Scenarios Matrix

```gherkin
Feature: Phase 10 — Multi-Equipment CIQ Expansion

Scenario 1: Coagulation QC Entry + Westgard Validation
  Given lab "riopomba-1" with Sysmex CA-7000 active
  When operador records PT run with values [12.5s, 12.3s, 12.6s] (3 levels)
  And all 3 values within 1σ
  Then run saved as ACCEPTED
  And Levey-Jennings chart updated
  And 0 NOTIVISA events triggered

Scenario 2: Coagulation Critical Value (INR Out of Bounds)
  Given coagulation run recorded
  When INR result = 4.5 (above threshold 4.0)
  Then run flags as CRITICAL
  And criticos-escalacoes/{runId} created
  And notivisaPending = true
  And supervisorId notified (email + SMS Phase 5)

Scenario 3: Lot Expiry Blocks Run Creation
  Given lot "QC-COAG-2026-001" with dataValidade = 2026-05-01
  And today = 2026-05-02
  When operador attempts run recordation
  Then callable rejects with "Lot expired"
  And Cloud Logs: "Expired lot blocked"
  And UI shows banner "Lot XXXX expired"

Scenario 4: Multi-Instrument Method Comparison (PT Neisler vs Quick)
  Given 2 equipments: Sysmex CA-7000 (reference) + Mindray BC-7000 (new)
  And 20 side-by-side PT samples analyzed
  When supervisor runs `compareMultiInstrument` callable
  Then regressão linear calculated (r = 0.9967, slope = 0.98)
  And CLSI EP9 approval granted
  And método novo marked as validated

Scenario 5: Immunology HIV Positive + NOTIVISA
  Given ciq-imuno run: HIV = Positivo
  When run recorded
  Then criticos-escalacoes/{runId} created
  And notivisaPending = true
  And (Phase 5) NOTIVISA scheduler enqueues event

Scenario 6: Immunology Serial Dilution (HCG High)
  Given HCG sample = 250.000 mIU/mL (off-curve)
  When operador performs 1:100 dilution + re-run
  And resultado = 2.500 mIU/mL
  Then Cloud Function: final = 2.500 × 100 = 250.000 mIU/mL
  And run saved with diluicaoSerializacao flag
  And laudo exibe "HCG 250.000* (diluted)"

Scenario 7: Urinalysis Dipstick + Gemini Vision
  Given manual dipstick resultado fotografado
  When Cloud Function `analyzeUrinalysisDipstick` called
  Then Gemini Vision 2.5 analyzes image
  And extracts: Leucócitos=2+, Nitritos=Neg, Proteínas=1+, Sangue=Neg
  And resultado salvo com image ref + confidence=0.94
  And dipstick-images/{imageId} stored in bucket

Scenario 8: Urinalysis Leucocytes + Nitrites = UTI Suspect
  Given uro run: Leucócitos=3+, Nitritos=Pos
  When run recorded
  Then criticos-escalacoes event created
  And notivisaPending = true (Phase 5)
  And clinical recommendation: "Suspeita de UTI"

Scenario 9: Equipment Calibration Logged Per Analyte
  Given PT @ Sysmex CA-7000
  When supervisor records calibração (factor 1.02)
  Then calibracoes/{calibId} created with:
    - analitoId: "coag-pt"
    - fatorCorrecao: 1.02
    - equipmentId: "sysmex-ca7000-1"
    - chainHash + signature
  And next PT run uses new factor in stats

Scenario 10: Bula Parser Integration (Phase 10-03)
  Given lote lotNumber="QC-COAG-2026-001" + bulaUrl
  When Cloud Function `parseBulaLot` invoked
  Then Gemini Vision extracts:
    - Meios: PT=12.5, INR=0.98, aPTT=30.2
    - Desvios: PT=0.4, INR=0.05, aPTT=1.2
    - CV%: PT=3.2, INR=5.1, aPTT=4.0
  And bulaParsed field populated
  And next runs use fabricante stats

Scenario 11: Cross-Module Analyte Management (Custom Lab Analyte)
  Given lab "riopomba-advanced" adds custom analyte
  When UI admin: "Novo Analito > Coagulação > D-dímero"
  And seedDefault=false, ativo=true
  Then analito/{customId} created
  And immediate equipments assignments possible
  And runs can be recorded immediately

Scenario 12: Monthly Report Generation (All Modules)
  Given runs from 2026-05 for coag + imuno + uro
  When Cloud Function `generateMonthlyReportBioquimica` runs (cron)
  Then relatorios-mensais/{reportId} created with:
    - Totais: N runs, N analitos, N equipamentos
    - Stats: CV%, trend lines (drift detection)
    - Westgard violations (count, tipos)
    - Critical values (count, escalações)
    - Equipment downtime
    - Lot usage summary
  And PDF exported (Phase 6)
```

### 9.2 Integration Test Suite (Jest)

```typescript
// functions/test/phase10-ciq-expansion.test.ts

describe('Phase 10 — Multi-Equipment CIQ Expansion', () => {
  describe('recordAnalyteRun — Unified Callable', () => {
    it('should accept valid coagulation run with all analytes', async () => {
      // Setup
      const labId = 'test-lab-1';
      const lotId = seedCoagulationLot(labId);
      const equipmentId = seedEquipment(labId, 'coagulacao');

      // Execute
      const result = await callRecordAnalyteRun({
        labId,
        modulo: 'coagulacao',
        equipmentId,
        lotId,
        operadorId: testUserId,
        resultados: [
          { analitoId: 'coag-pt', nivelId: '1', valor: 12.5, unidade: 's' },
          { analitoId: 'coag-inr', nivelId: '1', valor: 0.98, unidade: 'razão' },
          { analitoId: 'coag-aptt', nivelId: '1', valor: 30.2, unidade: 's' },
        ],
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.runId).toBeDefined();
      expect(result.westgardStatus).toHaveLength(3);
      expect(result.westgardStatus.every((s) => !s.rejected)).toBe(true);
    });

    it('should reject run with expired lot', async () => {
      const labId = 'test-lab-1';
      const lotId = seedExpiredLot(labId);

      await expect(
        callRecordAnalyteRun({
          labId,
          modulo: 'coagulacao',
          lotId,
          resultados: [{ analitoId: 'coag-pt', nivelId: '1', valor: 12.5, unidade: 's' }],
        }),
      ).rejects.toThrow(/expired/i);
    });

    it('should flag critical value (INR > 4.0)', async () => {
      const labId = 'test-lab-1';
      const result = await callRecordAnalyteRun({
        labId,
        modulo: 'coagulacao',
        resultados: [{ analitoId: 'coag-inr', nivelId: '1', valor: 4.5, unidade: 'razão' }],
      });

      expect(result.criticalValuesCount).toBeGreaterThan(0);
      const criticosSnap = await admin
        .firestore()
        .collection(`/labs/${labId}/criticos-escalacoes`)
        .get();
      expect(criticosSnap.size).toBeGreaterThan(0);
    });
  });

  describe('compareMultiInstrument — Method Validation', () => {
    it('should approve method comparison with r >= 0.99', async () => {
      const result = await callCompareMultiInstrument({
        labId: 'test-lab-1',
        analitoId: 'coag-pt',
        modulo: 'coagulacao',
        equipReference: { equipId: 'ref-1', name: 'Sysmex CA-7000', metodologia: 'Neisler' },
        equipNew: { equipId: 'new-1', name: 'Mindray BC-7000', metodologia: 'Quick' },
        pares: generateLinearData(20, (slope = 0.98), (intercept = 0.25), (noise = 0.3)),
      });

      expect(result.aprovado).toBe(true);
      expect(result.stats.r).toBeGreaterThanOrEqual(0.99);
    });

    it('should reject comparison with r < 0.99', async () => {
      const result = await callCompareMultiInstrument({
        pares: generateLinearData(20, (slope = 1.5), (noise = 2.0)),
      });

      expect(result.aprovado).toBe(false);
    });
  });

  describe('validateLotExpiry — Pre-Flight Check', () => {
    it('should return valid for active, non-expired lot', async () => {
      const result = await callValidateLotExpiry({
        labId: 'test-lab-1',
        lotId: seedFreshLot(),
        modulo: 'coagulacao',
      });

      expect(result.valid).toBe(true);
      expect(result.daysUntilExpiry).toBeGreaterThan(0);
    });

    it('should warn when lot expires < 7 days', async () => {
      const result = await callValidateLotExpiry({
        labId: 'test-lab-1',
        lotId: seedLotExpiringIn(5),
      });

      expect(result.valid).toBe(true);
      expect(result.warning).toContain('expires in 5 days');
    });
  });

  describe('Westgard Rules — Coagulation Specific', () => {
    it('should detect 1-2s violation (1 point > 2σ)', async () => {
      const rules = evaluateWestgardRules({
        analitos: [
          { analitoId: 'coag-pt', valor: 15.0 }, // mean=12.5, stdev=0.4 → >2σ
        ],
        mean: 12.5,
        stdev: 0.4,
      });

      expect(rules[0].violated).toBe(true);
      expect(rules[0].rule).toContain('1-2s');
      expect(rules[0].severity).toBe('warning');
    });

    it('should detect 1-3s rejection (1 point > 3σ)', async () => {
      const rules = evaluateWestgardRules({
        analitos: [
          { analitoId: 'coag-pt', valor: 13.7 }, // mean=12.5, stdev=0.4 → >3σ
        ],
        mean: 12.5,
        stdev: 0.4,
      });

      expect(rules[0].rejected).toBe(true);
      expect(rules[0].rule).toContain('1-3s');
    });
  });

  describe('Firestore Rules Validation', () => {
    it('should allow read analitos for active lab member', async () => {
      const db = initializeTestDb({ uid: testUserId, labId: 'test-lab-1' });
      const analitoRef = db.collection(`/labs/test-lab-1/coagulacao/root/analitos`);

      expect(await analitoRef.get()).not.toThrow();
    });

    it('should block write to runs collection via client', async () => {
      const db = initializeTestDb({ uid: testUserId, labId: 'test-lab-1' });
      const runRef = db.collection(`/labs/test-lab-1/coagulacao/root/runs`).doc('test-run');

      expect(await runRef.set({ data: 'test' })).toThrow(/Permission denied/);
    });

    it('should append-only audit events', async () => {
      const db = initializeTestDb({ uid: 'callable-context', custom: { isCallableContext: true } });
      const auditRef = db.collection(`/labs/test-lab-1/coagulacao/root/audit`).doc('test-audit');

      // Create — OK
      expect(
        await auditRef.set({
          data: 'test',
          chainHash: 'a'.repeat(64),
          ts: FieldValue.serverTimestamp(),
        }),
      ).not.toThrow();

      // Update — should fail
      expect(await auditRef.update({ data: 'modified' })).toThrow();
    });
  });

  describe('E2E: Coagulation Workflow', () => {
    it('should complete end-to-end PT entry → chart → report', async () => {
      // 1. Setup
      const labId = 'e2e-lab-1';
      const equipId = seedEquipment(labId, 'coagulacao');
      const lotId = seedCoagulationLot(labId);

      // 2. Create 5 consecutive PT runs (all within limits)
      const runIds = [];
      for (let i = 0; i < 5; i++) {
        const result = await callRecordAnalyteRun({
          labId,
          equipmentId: equipId,
          lotId,
          operadorId: testUserId,
          resultados: [{ analitoId: 'coag-pt', nivelId: '1', valor: 12.5 + i * 0.1, unidade: 's' }],
        });
        runIds.push(result.runId);
      }

      // 3. Verify runs created
      const runsSnap = await admin
        .firestore()
        .collection(`/labs/${labId}/coagulacao/root/runs`)
        .get();
      expect(runsSnap.size).toBe(5);

      // 4. Verify Levey-Jennings data available
      const leveyDataSnap = await admin
        .firestore()
        .collection(`/labs/${labId}/coagulacao/root/runs`)
        .get();
      expect(leveyDataSnap.docs.length).toBe(5);

      // 5. Verify no critical values
      const criticosSnap = await admin
        .firestore()
        .collection(`/labs/${labId}/criticos-escalacoes`)
        .get();
      expect(criticosSnap.size).toBe(0);
    });
  });
});
```

---

## 10. Westgard Rules Precalculation Per Lab

### 10.1 Westgard Configuration Schema

```firestore
/labs/{labId}/coagulacao/config/singleton:
  {
    labId: LabId;

    westgardRules: {
      // Enabled by default
      "1-2s": { enabled: true, severity: "warning" };
      "1-3s": { enabled: true, severity: "reject" };
      "2-2s": { enabled: true, severity: "reject" };
      "R-4s": { enabled: true, severity: "reject" };

      // Extended (disabled by default, enabled per analyte in v1.4)
      "4-1s": { enabled: false, severity: "reject" };
      "10x": { enabled: false, severity: "reject" };
      "6T": { enabled: false, severity: "warning" };
      "6X": { enabled: false, severity: "warning" };
    };

    // Per-analyte overrides
    analitoRules: {
      "coag-pt": {
        "1-2s": { enabled: true };
        "4-1s": { enabled: true };  // PT especialmente sensível a drift
      };
    };

    // Statsource selection per analyte
    statsSource: {
      "coag-pt": {
        tipo: "fabricante";  // até atingir n=20 runs
        fabricanteCV: 3.2;
      };
      "coag-inr": {
        tipo: "laboratorio";
        laboratorioCV: 5.5;
        nRunsQualificar: 20;
      };
    };

    criadoEm: Timestamp;
    modificadoEm: Timestamp;
  }
```

### 10.2 Per-Lab Westgard Initialization (Cloud Function)

```typescript
/**
 * functions/src/tasks/initializeWestgardConfig.ts
 *
 * Cron: first run after lab creation + manual admin trigger
 */

async function initializeWestgardConfig(labId: string) {
  const configRef = admin.firestore().doc(`/labs/${labId}/coagulacao/config/singleton`);

  await configRef.set({
    labId,
    westgardRules: {
      '1-2s': { enabled: true, severity: 'warning' },
      '1-3s': { enabled: true, severity: 'reject' },
      '2-2s': { enabled: true, severity: 'reject' },
      'R-4s': { enabled: true, severity: 'reject' },
      '4-1s': { enabled: false, severity: 'reject' },
      '10x': { enabled: false, severity: 'reject' },
      '6T': { enabled: false, severity: 'warning' },
      '6X': { enabled: false, severity: 'warning' },
    },
    statsSource: {}, // defaults populated per-run
    criadoEm: admin.firestore.Timestamp.now(),
    modificadoEm: admin.firestore.Timestamp.now(),
  });
}
```

---

## 11. DICQ Mapping (Bloco F Coverage)

### 11.1 DICQ Blocks Addressed in Phase 10

```
DICQ 4.3 — Bloco F (Analítico — Exames Laboratoriais)

5.5.1.1 — Descrição da metodologia analítica
  ✅ Phase 10: `analito.metodo` field + bula parsed metadata
  → Documentação centralizada em 1 campo estruturado
  → Link direto a SGQ documento (IT-METODOLOGIA-001)

5.5.1.3 — Validação de método alternativo
  ✅ Phase 10: `compareMultiInstrument` callable + CLSI EP9 workflow
  → Scores aprovação/rejeição conforme r >= 0.99
  → Relatório assinado digitalmente

5.5.2 — Procedimento de controle de qualidade (CIQ)
  ✅ Phase 10: Westgard rules engine + per-module (coag, imuno, uro)
  → Critérios rejeição definidos por analito em config/singleton
  → Runs marcadas accept/reject/escalado

5.5.3 — Critério de aceitabilidade
  ✅ Phase 10: CV% alvo por analito, comparação vs fabricante/lab stats
  → `analito.cvAlvo` campo, validação em Westgard 1-2s, 1-3s
  → Trend analysis (6+ pontos) detecta drift sistemático

5.6.2 — Rastreabilidade de amostras de controle
  ✅ Phase 10: `lotes-ciq` com supplier, lotNumber, dataValidade
  → Bula parser extrai estatística (meios, desvios, CV%)
  → Traceability events (append-only) registram trocas de lote

5.6.3.1 — Validade de reagentes
  ✅ Phase 10: Cloudscheduler daily check + pre-flight callable
  → `validateLotExpiry` bloqueia runs com lotes vencidos
  → UI exibe banner "Lotes vencidos: 3" em admin

5.6.4 — Registros de CIQ
  ✅ Phase 10: `runs` collection (callable-only) + `audit` (append-only)
  → ChainHash assinatura + operadorId + timestamp
  → Retenção 90 dias (RDC 978 Art. 5.3)

DICQ 4.3 — Blocos adicionais (Cross-reference)

4.1.2.7 — Registros de supervisão de turnos
  ↔ Phase 9-10: turnos module + runs marcam operadorId
  → Crosslink runs ↔ turno supervisor

4.2.2 — Procedimentos para valores críticos
  ↔ Phase 5 (escalação): criticos-escalacoes collection
  → Definição de thresholds críticos em config

4.3.1 — Comparabilidade interlaboratorial (CEQ)
  ↔ Phase 10 + 14: method comparison + CEQ module
  → Labs intercambia resultados para validação externa

4.14.6 — Gestão de riscos
  ↔ Phase 9: risks module + Phase 10 risk register (replicação analytes)

5.5.1 (full) — Validação de método + performance
  ✅ Phase 10: 70% completo
     - Validação inicial: equipamento + calibração ✅
     - Performance verificação: Westgard ✅
     - Interlaboratorial: CEQ (Phase 14 defer)
```

### 11.2 DICQ Compliance Report (Phase 10 Post-Deploy)

```markdown
## DICQ 4.3 Compliance Summary — Phase 10

**Pre-Phase 10:** 78.5% (Phase 0–9)
**Phase 10 Target:** +8–10% → 86–88%
**Phase 10 Delivered:** TBD (post-deploy)

| Bloco | Artigo  | Requisito                    | Status | Evidência                                 |
| ----- | ------- | ---------------------------- | ------ | ----------------------------------------- |
| F     | 5.5.1.1 | Método descrito              | ✅     | `analito.metodo` + bula parsed            |
| F     | 5.5.1.3 | Validação método alternativo | ✅     | `compareMultiInstrument` CLSI EP9         |
| F     | 5.5.2   | CIQ procedimento             | ✅     | Westgard engine + rules config            |
| F     | 5.5.3   | Aceitabilidade critério      | ✅     | CV% alvo + Westgard 1-2s/1-3s             |
| F     | 5.6.2   | Rastreabilidade QC           | ✅     | `lotes-ciq` + traceability-events         |
| F     | 5.6.3.1 | Validade reagentes           | ✅     | `validateLotExpiry` callable + scheduler  |
| F     | 5.6.4   | Registros CIQ                | ✅     | `runs` + `audit` (append-only, chainHash) |

**Remaining gaps (Phase 11–15):**

- 4.7 (IA training dataset) → Phase 5
- Interlaboratorial comparison → Phase 14 CEQ
- Performance metrics baseline → Phase 10-02 monitoring
```

---

## 12. Risk Register & Mitigation

### 12.1 Top Risks Identified

| #   | Risco                                                                 | Impacto                           | Prob | Mitigação                                                                           | Dono    |
| --- | --------------------------------------------------------------------- | --------------------------------- | ---- | ----------------------------------------------------------------------------------- | ------- |
| 1   | Bula parser (Gemini Vision) interpreta errado estatística             | Westgard rules inválidas          | 3    | Phase 10-03: validação manual + OCR fallback; QA teste 50+ bulas reais              | Agent-2 |
| 2   | Equipment compatibility matriz incompleta                             | Labs usam equipamento não testado | 2    | Phase 10-01: compatibilidade matrix doc + Phase 5 partnership validation            | Agent-1 |
| 3   | Lot expiry auto-enforcement prematura                                 | Lab perde dados válidos           | 2    | Pre-flight check (soft warn) antes block; supervisor override com approval log      | Agent-4 |
| 4   | Westgard rules threshold parameters (sigma levels) diferem entre labs | False rejections/acceptances      | 2    | Config per-lab + Phase 10-02 calibração de thresholds via running median            | Agent-3 |
| 5   | NOTIVISA outbox volume spike (100+ eventos/dia)                       | Cloud Function timeout            | 2    | Phase 5: async queue + exponential backoff; batch enqueue max 50 eventos/callable   | Agent-3 |
| 6   | Dipstick image quality (angle, lighting) afeta OCR                    | Resultado incorreto               | 3    | Phase 10-03: Gemini Vision + confidence threshold (reject <80%); manual review gate | Agent-2 |
| 7   | Method comparison (n=20) statistically weak                           | Novo equipamento não validado     | 2    | Phase 10-02: aumentar n minimum para 30; bootstrap CI                               | Agent-1 |
| 8   | Cross-module analyte ID collision (custom lab vs seed)                | Run referencia ID errado          | 2    | Phase 10-01: unique namespace per modulo + deterministic hashing                    | Agent-1 |
| 9   | Calibration factor not applied to past runs                           | Histórico impreciso               | 2    | Calibration only affects forward runs; reprocessamento manual callable (Phase 11)   | Agent-4 |
| 10  | Equipment downtime não registrado → Westgard rules enganadas          | False trend detection             | 1    | Phase 10-04: equipamentos.ativo flag + run rejeição if equipment inactive           | Agent-3 |

### 12.2 Mitigation Execution Timeline

```
Wave 1 (Phase 10-01):
  - Compatibilidade matrix doc + partnership onboarding
  - Namespace uniqueness validation tests
  - Equipment registry CRUD + ativo enforcement

Wave 2 (Phase 10-02):
  - Bula parser integration + 50-bula QA test suite
  - Westgard calibration per-lab workflow
  - Method comparison n=30 enforcement + bootstrap

Wave 3 (Phase 10-03):
  - Dipstick image quality tests (Gemini Vision)
  - NOTIVISA batch enqueue + backoff testing
  - Callable auth + context validation hardening

Wave 4 (Phase 10-04):
  - Calibration forward-application verification
  - Equipment downtime flag enforcement
  - E2E cross-module tests (12 scenarios)
  - Cloud Logs 24h monitoring post-deploy
```

---

## 13. Deployment Checklist

### 13.1 Pre-Deployment Gate (hcq-deploy-gates)

```bash
# Step 1: Type checking
npx tsc --noEmit

# Step 2: Linting (488 warnings baseline)
npm run lint 2>&1 | grep -E "error|warning" | wc -l
# Expected: ≤ 88 new warnings (Phase 10 code)

# Step 3: Unit tests (738 baseline + 42 Phase 9)
npm test -- --testPathPattern="phase10|coagulacao|imuno|uroanalise"
# Expected: 120+ tests PASS (new Phase 10 tests)

# Step 4: Build app + functions
npm run build
npm run build:functions

# Step 5: ChainHash verification (sample 10 runs)
node scripts/verify-chain-hash-sample.js --phase 10

# Step 6: Firestore rules deploy + emulator test
firebase emulator:exec --project hmatologia2 "npm run test:rules"
# Expected: all rules tests PASS

# Step 7: Secret scan (no API keys in diff)
git diff main... | grep -E "GEMINI_|API_|SECRET_|TOKEN_"
# Expected: 0 matches

# Gate decision: PASS / BLOCK
```

### 13.2 Deploy Sequence (Phase 10 Multi-Piece)

```bash
# 1. Deploy Firestore rules (read-only impact)
firebase deploy --only firestore:rules --project hmatologia2
# Expected: rules accepted, 0 errors

# 2. Deploy Cloud Functions (side-effect impact — must verify)
firebase deploy --only functions --project hmatologia2
# Functions deployed:
#   - recordAnalyteRun (all modules)
#   - validateLotExpiry
#   - compareMultiInstrument
#   - [+ 5 others from Phase 10-03]
# Expected: 0 errors, functions in `southamerica-east1`

# 3. Seed default analytes + equipment (idempotent)
firebase functions:call seedBioquimicaDefaults --project hmatologia2
firebase functions:call seedCoagulacaoDefaults --project hmatologia2
firebase functions:call seedImunologiaDefaults --project hmatologia2
firebase functions:call seedUroanalisDefaults --project hmatologia2
# Expected: "Seeded X analytes for Y labs"

# 4. Deploy hosting (app bundle)
npm run build && firebase deploy --only hosting --project hmatologia2
# Expected: build size ≤ 362 KB gzip, deploy <2min

# 5. Smoke tests (manual — 15 min)
#   a. Login as technician (lab: riopomba-1)
#   b. Create coag run (PT, INR, aPTT) → accept ✅
#   c. Create imuno run (HIV Pos) → critical escalate ✅
#   d. Create uro run (dipstick upload) → Gemini Vision ✅
#   e. Admin: compare methods (PT) → r=0.99+ ✅
#   f. Check Levey-Jennings chart loads →  5 points plotted ✅

# 6. Cloud Logs monitoring (24h, automated)
bash scripts/monitor-cloud-logs.ps1 24 30
# Expected: 0 errors, <5% warning rate (benign = deprecated API calls)
# Output: JSON export + email summary

# Gate decision: SIGN-OFF / ROLLBACK
```

### 13.3 Rollback Plan (if needed)

```bash
# 1. Identify issue (Cloud Logs error surge)
# 2. Immediately: Revert hosting + functions to previous stable
firebase deploy --only hosting,functions \
  --project hmatologia2 \
  --force

# 3. Disable Phase 10 features (config toggle)
#   - Set /labs/*/*/config/singleton/{ westgardEnabled: false }
#   - UI hides Coag/Imuno/Uro tabs until fix ready

# 4. Root cause analysis (24h)
# 5. Deploy hotfix (Phase 10-Hotfix branch)
# 6. Re-enter smoke tests + Cloud Logs
```

---

## 14. Success Metrics & Verification Loop

### 14.1 Key Performance Indicators (KPIs)

| KPI                           | Target                                                       | Method                                 | Owner   |
| ----------------------------- | ------------------------------------------------------------ | -------------------------------------- | ------- |
| **Functional Completeness**   | 30+ analytes seeded + functional                             | Seed count + run recording test        | Agent-1 |
| **Multi-Equipment Support**   | 4+ equipment models validated (Sysmex, Mindray, ACL, Roche)  | Method comparison CLSI EP9 approved    | Agent-2 |
| **Lot Expiry Enforcement**    | 0 expired lots used in runs (100% block rate)                | Pre-flight + post-deploy audit         | Agent-3 |
| **Westgard Rule Coverage**    | 5 CLSI rules enabled (1-2s, 1-3s, 2-2s, R-4s, 4-1s optional) | Config validation + rule trigger tests | Agent-2 |
| **Critical Value Escalation** | <2min from result → escalacoes-criticos created              | E2E test + production logs             | Agent-4 |
| **DICQ Compliance Gain**      | +8–10% (78.5% → 86–88%)                                      | Compliance mapper audit                | CTO     |
| **Test Coverage**             | 120+ unit + 12 E2E scenarios PASS                            | Jest suite + Playwright E2E            | Agent-1 |
| **Cloud Logs Health**         | 0 errors, <5% warning rate (24h post-deploy)                 | Automated monitor-cloud-logs.ps1       | Agent-4 |
| **Zero Regressions**          | 738/738 baseline tests + 42 Phase 9 tests PASS               | npm test --coverage                    | Agent-1 |
| **Bundle Size**               | ≤ 362 KB gzip main, ≤ 60 KB module chunk                     | webpack-bundle-analyzer                | Agent-3 |

### 14.2 Verification Loop (Post-Deploy)

```markdown
## Phase 10 — Verification Checklist (Post-Deploy)

**24 Hours After Deploy:**

✅ Smoke Tests (15 min)

- [ ] Coagulation: PT run recorded → Levey-Jennings chart loads
- [ ] Coagulation: INR critical (>4.0) → escalacoes-criticos created
- [ ] Immunology: HIV Positivo → NOTIVISA pending (Phase 5 pending if not yet live)
- [ ] Urinalysis: Dipstick photo uploaded → Gemini Vision result in run
- [ ] Multi-Equipment: Method comparison PT (n=20) → r≥0.99 approved

✅ Cloud Logs (automated via monitor-cloud-logs.ps1)

- [ ] Error count: 0
- [ ] Warning count: <5% of total logs
- [ ] Top warnings: ["Deprecated API call", "deprecated service"] (benign)
- [ ] Function cold-starts: <100ms duration
- [ ] Firestore query latency: <50ms p99

✅ Firestore Schema

- [ ] /labs/\*/coagulacao/root/analitos: 5 docs seeded
- [ ] /labs/\*/ciq-imuno/root/analitos: 10 docs seeded
- [ ] /labs/\*/uroanalise/root/analitos: 7 docs seeded
- [ ] /labs/\*/equipamentos: 2–4 docs (per-lab installed base)
- [ ] /labs/\*/calibracoes: insertion log shows activity

✅ Unit Tests

- [ ] npm test: 738 + 42 + 120 = 900 tests PASS
- [ ] Coverage thresholds: statements ≥90%, branches ≥85%
- [ ] 0 test regressions vs Phase 9

✅ Integration Tests

- [ ] recordAnalyteRun callable (all 4 modules): PASS
- [ ] validateLotExpiry (expired + valid): PASS
- [ ] compareMultiInstrument (approved + rejected): PASS
- [ ] Westgard rules evaluation: 1-2s, 1-3s, 2-2s, R-4s triggers correct

✅ E2E Scenarios (Playwright)

- [ ] Scenario 1–12 all PASS
- [ ] Load time <3s per page
- [ ] No console errors or warnings

✅ DICQ Compliance

- [ ] Mapping document signed off (CTO)
- [ ] DICQ blocks 5.5.1–5.6.4 all "complete" status
- [ ] Compliance score: ≥86%

✅ User Acceptance (Lab Admin, Technician)

- [ ] UI + terminology understood
- [ ] Workflow (add run → chart → report) intuitive
- [ ] Admin can manage analites, equipment, thresholds
- [ ] No unexpected errors during 30-min walkthrough

**Sign-Off Gate:**

- [ ] All checkboxes ticked
- [ ] CTO review approved
- [ ] Production stable (24h monitoring clean)
- [ ] Compliance auditor pre-alignment confirmed

**Status:** READY FOR NEXT PHASE ✅
```

---

## 15. Appendix: File Tree (Phase 10 Deliverables)

```
C:\hc quality\
├── .planning\phases\10-bioquimica-expansion\
│   ├── PHASE_10_DETAILED_PLAN.md                    (← you are here)
│   ├── 10-01-PLAN.md                                (Wave 1: Schema + Seed)
│   ├── 10-02-PLAN.md                                (Wave 2: Westgard + Comparison)
│   ├── 10-03-PLAN.md                                (Wave 3: Bula + Dipstick + NOTIVISA)
│   ├── 10-04-PLAN.md                                (Wave 4: E2E + Deploy)
│   └── PHASE_10_COMPLETION.md                       (post-deploy report)
│
├── src\features\
│   ├── coagulacao\
│   │   ├── types\
│   │   │   ├── analito.ts
│   │   │   ├── controlMaterial.ts
│   │   │   ├── run.ts
│   │   │   ├── westgard.ts
│   │   │   └── index.ts
│   │   ├── services\
│   │   │   ├── coagulacaoService.ts
│   │   │   └── westgardRulesCLSI.ts
│   │   ├── hooks\
│   │   │   ├── useCoagulacaoState.ts
│   │   │   └── useLeveyJenningsChart.ts
│   │   ├── components\
│   │   │   ├── RunEntry.tsx
│   │   │   ├── LeveyJenningsChart.tsx
│   │   │   ├── ReviewRunModal.tsx
│   │   │   ├── PreFlightCheck.tsx
│   │   │   └── CriticalValueAlert.tsx
│   │   ├── constants\
│   │   │   └── seedAnalitos.ts
│   │   ├── CLAUDE.md
│   │   └── index.ts
│   │
│   ├── ciq-imuno\
│   │   ├── types\
│   │   │   ├── analito.ts (HIV, Dengue, HCG, etc.)
│   │   │   ├── serializeDilution.ts
│   │   │   ├── criticalThresholds.ts
│   │   │   └── index.ts
│   │   ├── services\
│   │   │   ├── immunoService.ts
│   │   │   └── serialDilutionEngine.ts
│   │   ├── components\
│   │   │   ├── ResultEntry.tsx
│   │   │   ├── SerialDilutionForm.tsx
│   │   │   ├── CriticalValueEscalation.tsx
│   │   │   └── IA TrainingUploader.tsx (Phase 5)
│   │   ├── constants\
│   │   │   └── seedAnalitos.ts
│   │   ├── CLAUDE.md
│   │   └── index.ts
│   │
│   ├── uroanalise\
│   │   ├── types\
│   │   │   ├── analito.ts
│   │   │   ├── dipstickResult.ts
│   │   │   └── index.ts
│   │   ├── services\
│   │   │   ├── uroanalisService.ts
│   │   │   └── dipstickAnalyzer.ts
│   │   ├── components\
│   │   │   ├── DipstickUploader.tsx
│   │   │   ├── DipstickResult.tsx
│   │   │   ├── ManualEntry.tsx
│   │   │   └── AutomatedUFAnalyzer.tsx
│   │   ├── constants\
│   │   │   └── seedAnalitos.ts
│   │   ├── CLAUDE.md
│   │   └── index.ts
│   │
│   └── shared\
│       ├── equipments\
│       │   ├── equipmentRegistry.ts
│       │   ├── calibrationLog.ts
│       │   └── methodComparison.ts
│       └── utils\
│           ├── lotExpiryValidator.ts
│           └── westgardStatistics.ts
│
├── functions\src\callable\
│   ├── recordAnalyteRun.ts                          (Phase 10-02)
│   ├── validateLotExpiry.ts                         (Phase 10-02)
│   ├── compareMultiInstrument.ts                    (Phase 10-02)
│   ├── parseBulaLot.ts                              (Phase 10-03)
│   ├── analyzeUrinalysisDipstick.ts                 (Phase 10-03)
│   ├── escalateCriticalValue.ts                     (Phase 5, defer)
│   └── index.ts
│
├── functions\src\tasks\
│   ├── checkLotExpiryDaily.ts                       (Cloud Scheduler)
│   ├── generateMonthlyReportBioquimica.ts           (Phase 10-04)
│   └── index.ts
│
├── functions\test\
│   ├── phase10-ciq-expansion.test.ts                (120+ tests)
│   ├── coagulacao\
│   │   └── rules.test.mjs
│   ├── ciq-imuno\
│   │   └── rules.test.mjs
│   └── uroanalise\
│       └── rules.test.mjs
│
├── firestore.rules (updated)
│   ├── /labs/{labId}/coagulacao/**
│   ├── /labs/{labId}/ciq-imuno/**
│   ├── /labs/{labId}/uroanalise/**
│   └── /labs/{labId}/equipamentos/**
│
└── docs\
    ├── PHASE_10_DICQ_MAPPING.md
    ├── PHASE_10_EQUIPMENT_COMPATIBILITY.md
    └── PHASE_10_RISK_REGISTER.md
```

---

## Closing Summary

**Phase 10 — Multi-Equipment CIQ Expansion** brings coagulation, immunology, and urinalysis into the quantitative CIQ ecosystem, with:

1. **30+ analytes** seeded across 4 modules (Coag 5, Imuno 10, Uro 7, Other)
2. **Multi-instrument validation** via CLSI EP9 method comparison + per-equipment calibration
3. **Lot expiry enforcement** (auto-block expired lots + NOTIVISA)
4. **Westgard CLSI rules** (5 core + 4 extended, per-lab configurable)
5. **Critical value escalation** (NOTIVISA pending queue for Phase 5)
6. **IA integration ready** (dipstick image → Gemini Vision, serial dilution)
7. **+8–10% DICQ compliance** (DICQ 5.5–5.6 blocks)
8. **12 E2E scenarios** covering every critical workflow
9. **0 regressions** (738/738 baseline + 42 Phase 9 tests)
10. **24h monitoring** post-deploy with Cloud Logs automation

**Estimated Scope:** 2.5 weeks (Wave 1–4), 4 parallel agents, ~3,200 LOC client-side + ~2,500 LOC functions + 120+ tests.

**Next Phase:** Phase 11 — Portal Ecosystem (RT medical + patient external) → RDC 978 Arts. 6, 167, 204.

---

**Document prepared for:** v1.4 Execution (Phase 4–15 roadmap)  
**Target audience:** CTO, phase agents, auditor alignment  
**Date:** 2026-05-07  
**Status:** PLANNING-READY
