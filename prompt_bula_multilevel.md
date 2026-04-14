# Implementação: BulaProcessor Multi-Nível (4 Fases)

## Contexto do Projeto

Sistema SaaS de Controle de Qualidade Hematológico. Stack: React 19 + TypeScript + Vite + Zustand + Firebase (Firestore + Functions) + `@google/genai` (Gemini).

O BulaProcessor extrai dados de PDFs de bulas de controle hematológico via IA. Hoje extrai **1 nível por vez**. O objetivo é extrair **3 níveis simultaneamente**, com fallback automático para Pentra ES 60 quando o equipamento principal (ex: Yumizen H550) não tem dados para um analito.

### Resultado validado do teste OCR (bula real Controllab HHI-1339/1340/1341)
- Gemini 2.5 Flash extrai corretamente os 3 níveis com lotes distintos por nível
- Yumizen H550: 8 analitos primários (RBC, HCT, HGB, MCH, MCHC, MPV, PLT, RDW)
- Pentra ES 60 como fallback: 13 analitos (WBC, MCV, PCT, PDW, NEU, LYM, MON, EOS, BAS, NEU#, LYM#, MON#, EOS#)
- Bug identificado: modelo copiou MCH entre níveis quando ausente — o prompt final deve proibir isso explicitamente

---

## Arquivos relevantes e estado atual

```
src/types/index.ts                              — PendingBulaData single-level, precisa reescrita
src/store/useAppStore.ts                        — tem pendingBulaData: PendingBulaData | null
src/features/bulaparser/BulaProcessor.tsx       — UI single-level, ResultPanel a reescrever
src/features/bulaparser/services/bulaGeminiService.ts — chama Cloud Function extractFromBula
src/features/lots/AddLotModal.tsx               — lê pendingBulaData, pré-preenche 1 lote
functions/src/index.ts                          — Cloud Function extractFromBula, reescrita necessária
src/constants.ts                                — tem ANALYTE_MAP com id, name, unit, decimals
```

---

## FASE 1 — Tipos (`src/types/index.ts`)

Substituir a interface `PendingBulaData` atual por:

```typescript
export interface BulaLevelData {
  level: 1 | 2 | 3;
  lotNumber: string;
  manufacturerStats: ManufacturerStats;
  /** Mapa de analyteId → nome do equipamento de onde o valor foi extraído */
  equipmentSources: Record<string, string>;
}

export interface PendingBulaData {
  controlName:   string | null;
  expiryDate:    Date | null;
  equipmentName: string | null;   // ex: "Yumizen H550"
  levels:        BulaLevelData[];
  warnings:      string[];
}
```

Remover o campo `level: 1 | 2 | 3 | null` e `lotNumber: string | null` da interface antiga.
Remover `manufacturerStats: ManufacturerStats` da interface antiga.

---

## FASE 2 — Cloud Function (`functions/src/index.ts`)

### 2a. Constantes do prompt

Substituir `ANALYTE_IDS_ALL` e `BULA_PROMPT` e todos os schemas Zod da função `extractFromBula` pelo seguinte:

```typescript
// ─── extractFromBula ──────────────────────────────────────────────────────────

const ANALYTE_IDS_ALL = [
  'WBC', 'RBC', 'HGB', 'HCT', 'MCV', 'MCH', 'MCHC', 'PLT', 'RDW',
  'MPV', 'PCT', 'PDW', 'NEU', 'LYM', 'MON', 'EOS', 'BAS',
  'NEU#', 'LYM#', 'MON#', 'EOS#',
].join(', ');

const buildBulaPrompt = (equipmentName: string) => `
Você é um especialista em interpretar bulas de controles hematológicos.
Este documento contém tabelas para MUITOS equipamentos (30+). Extraia dados APENAS para "${equipmentName}".

PASSO 1 — Encontre a tabela rotulada exatamente "${equipmentName}".
PASSO 2 — Para cada nível (Nível I, II, III) encontrado nessa tabela:
  - Identifique o número do lote específico desse nível (ex: HHI-1339, HHI-1340, HHI-1341)
  - Extraia Média (mean) e DP (sd) de cada analito SOMENTE da linha/coluna desse nível específico
  - NUNCA copie valores de um nível para outro. Se um analito está ausente num nível, omita-o naquele nível.
PASSO 3 — Fallback por analito: se um analito não constar em "${equipmentName}" para um nível específico,
  busque nas tabelas "Pentra ES 60" ou "Pentra 60" e use como substituto.
  Declare o equipamento real em equipmentSource.

Analitos aceitos: ${ANALYTE_IDS_ALL}

Mapeamento de nomes da bula → IDs do sistema:
Hemácias→RBC, Leucócitos→WBC, Hemoglobina→HGB, Hematócrito→HCT,
Plaquetas→PLT, Neutrófilos%→NEU, Neutrófilos#→NEU#,
Linfócitos%→LYM, Linfócitos#→LYM#, Monócitos%→MON, Monócitos#→MON#,
Eosinófilos%→EOS, Eosinófilos#→EOS#, Basófilos%→BAS,
RDW-CV→RDW, PDW-CV→PDW

Regras:
- Use apenas IDs exatos listados acima.
- Inclua só analitos com Média E DP claramente legíveis (ignore células com "*" sem DP).
- NUNCA invente ou copie valores entre níveis. Se ausente num nível, omita.
- Para metadados não encontrados, use null.

Retorne JSON EXATO:
{
  "controlName": "<nome comercial ou null>",
  "expiryDate": "<YYYY-MM-DD ou null>",
  "equipmentName": "${equipmentName}",
  "levels": [
    {
      "level": 1,
      "lotNumber": "<ex: HHI-1339>",
      "analytes": [
        {
          "analyteId": "<id>",
          "mean": 0.0,
          "sd": 0.0,
          "equipmentSource": "<nome exato do equipamento>"
        }
      ]
    }
  ]
}
`.trim();
```

### 2b. Schemas Zod

```typescript
const BulaAnalyteSchema = z.object({
  analyteId:       z.string(),
  mean:            z.number().positive(),
  sd:              z.number().nonnegative(),
  equipmentSource: z.string().optional(),
});

const BulaLevelSchema = z.object({
  level:     z.union([z.literal(1), z.literal(2), z.literal(3)]),
  lotNumber: z.string(),
  analytes:  z.array(BulaAnalyteSchema).min(1),
});

const BulaResponseSchema = z.object({
  controlName:   z.string().nullable().optional(),
  expiryDate:    z.string().nullable().optional(),
  equipmentName: z.string().nullable().optional(),
  levels:        z.array(BulaLevelSchema).min(1).max(3),
});
```

### 2c. Payload e corpo da função

O payload de entrada muda para incluir `equipmentName`:

```typescript
const { base64, mimeType, equipmentName } = request.data as {
  base64:        string;
  mimeType:      string;
  equipmentName: string;
};

if (!equipmentName?.trim()) {
  throw new HttpsError('invalid-argument', 'Nome do equipamento é obrigatório.');
}
```

A chamada ao Gemini usa `buildBulaPrompt(equipmentName)` em vez do prompt estático.

O modelo é `gemini-2.5-flash` (sem sufixo preview).

A função deve ter `timeoutSeconds: 120` além de `memory: '1GiB'`:
```typescript
export const extractFromBula = onCall(
  { secrets: [geminiApiKey], memory: '1GiB', timeoutSeconds: 120 },
```

### 2d. Retorno da função

```typescript
// Dentro do validation.data, construir a resposta:
const { data } = validation;
return {
  controlName:   data.controlName   ?? null,
  expiryDate:    data.expiryDate    ?? null,
  equipmentName: data.equipmentName ?? equipmentName,
  levels: data.levels.map(lvl => ({
    level:     lvl.level,
    lotNumber: lvl.lotNumber,
    analytes:  lvl.analytes,
  })),
};
```

---

## FASE 3 — BulaProcessor UI (`src/features/bulaparser/BulaProcessor.tsx`)

### 3a. Atualizar `bulaGeminiService.ts`

O tipo `ExtractFromBulaResult` e `BulaExtractionResult` precisam refletir a nova estrutura:

```typescript
// Payload para a Cloud Function
interface ExtractFromBulaPayload {
  base64:        string;
  mimeType:      string;
  equipmentName: string;
}

// Resultado bruto da Cloud Function
interface ExtractFromBulaResult {
  controlName:   string | null | undefined;
  expiryDate:    string | null | undefined;
  equipmentName: string | null | undefined;
  levels: Array<{
    level:    1 | 2 | 3;
    lotNumber: string;
    analytes: Array<{
      analyteId:       string;
      mean:            number;
      sd:              number;
      equipmentSource?: string;
    }>;
  }>;
}

// Função pública agora recebe equipmentName
export async function extractDataFromBulaPdf(
  base64:        string,
  mimeType:      string,
  equipmentName: string,
): Promise<PendingBulaData>
```

Dentro da função, construir `PendingBulaData`:
```typescript
const warnings: string[] = [];
// Parse expiryDate igual ao atual
// Para cada level, construir BulaLevelData:
const levels: BulaLevelData[] = (data.levels ?? []).map(lvl => {
  const manufacturerStats: ManufacturerStats = {};
  const equipmentSources:  Record<string, string> = {};
  for (const a of lvl.analytes) {
    manufacturerStats[a.analyteId] = { mean: a.mean, sd: a.sd };
    if (a.equipmentSource) equipmentSources[a.analyteId] = a.equipmentSource;
  }
  return {
    level: lvl.level,
    lotNumber: lvl.lotNumber,
    manufacturerStats,
    equipmentSources,
  };
});

if (levels.length === 0) {
  warnings.push('Nenhum nível extraído. Verifique se o equipamento consta na bula.');
}

return {
  controlName:   data.controlName   ?? null,
  expiryDate,
  equipmentName: data.equipmentName ?? equipmentName,
  levels,
  warnings,
};
```

### 3b. BulaProcessor.tsx — novo campo de equipamento + ResultPanel multi-nível

**Mudanças no componente principal `BulaProcessor`:**

1. Adicionar estado `equipmentName` (string, default `'Yumizen H550'`) com input text antes do DropZone
2. Passar `equipmentName` para `extractDataFromBulaPdf`

**Novo `ResultPanel`:**

Substituir o `ResultPanel` atual por uma versão com abas (tabs) por nível. Estrutura:

```tsx
// Cores por nível (já existentes no código atual)
const LEVEL_COLORS = {
  1: { tab: 'text-blue-400  border-blue-500/40  bg-blue-500/10',  badge: 'text-blue-400  bg-blue-500/15  border-blue-500/25'  },
  2: { tab: 'text-amber-400 border-amber-500/40 bg-amber-500/10', badge: 'text-amber-400 bg-amber-500/15 border-amber-500/25' },
  3: { tab: 'text-rose-400  border-rose-500/40  bg-rose-500/10',  badge: 'text-rose-400  bg-rose-500/15  border-rose-500/25'  },
};
```

**Layout do ResultPanel:**
```
[badge "Extração concluída"] [fileName]

[warnings se houver]

[card: Controle / Vencimento / Equipamento / X níveis extraídos]

[tabs: Nível I (HHI-1339) | Nível II (HHI-1340) | Nível III (HHI-1341)]

[tabela de analitos do nível ativo]
  Colunas: Analito | Média | ±DP | Fonte
  Linhas primárias: text-white/80
  Linhas fallback: bg-amber-500/[0.06] text-amber-400/90
    + badge pequeno com nome do equipamento fallback na coluna Fonte

[botões: Extrair outro PDF | Criar 3 lotes com estes dados]
```

**Regra de cor das linhas de fallback:**
```tsx
const isFallback = lvl.equipmentSources[id] !== data.equipmentName;
// linha com fallback:
className={isFallback ? 'bg-amber-500/[0.06]' : 'hover:bg-white/[0.02]'}
// célula Fonte:
{isFallback
  ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/25 text-amber-400 truncate max-w-[100px]">
      {lvl.equipmentSources[id]}
    </span>
  : <span className="text-[11px] text-emerald-500/70">primário</span>
}
```

**Contador de fallback na tab:**
```tsx
const fallbackCount = Object.values(lvl.equipmentSources)
  .filter(src => src !== data.equipmentName).length;
// Mostrar badge âmbar na tab se fallbackCount > 0:
{fallbackCount > 0 && (
  <span className="ml-1 text-[10px] px-1 rounded bg-amber-500/15 text-amber-400">
    {fallbackCount}
  </span>
)}
```

---

## FASE 4 — Injeção em lote (`src/features/lots/`)

### 4a. Novo store state

Em `useAppStore.ts`, o campo `pendingBulaData` já existe. O tipo muda de `PendingBulaData | null` para o novo `PendingBulaData` com `levels[]`. Nenhuma outra mudança no store.

### 4b. Novo componente `BulaBatchConfirmModal.tsx`

Criar `src/features/lots/BulaBatchConfirmModal.tsx`. Este componente substitui o fluxo de redirecionar para `AddLotModal` após a extração da bula.

**Props:**
```typescript
interface BulaBatchConfirmModalProps {
  data:    PendingBulaData;
  onClose: () => void;
  onConfirm: (jobs: BatchLotJob[]) => Promise<void>;
}

export interface BatchLotJob {
  level:             1 | 2 | 3;
  lotNumber:         string;
  controlName:       string;
  equipmentName:     string;
  serialNumber:      string;
  startDate:         Date;
  expiryDate:        Date;
  requiredAnalytes:  string[];
  manufacturerStats: ManufacturerStats;
  equipmentSources:  Record<string, string>;
}
```

**Layout do modal:**
```
┌─ Dados compartilhados ──────────────────────────────────┐
│  Equipamento:  [Yumizen H550         ] (pré-preenchido) │
│  Nº Série:     [                     ]                  │
│  Início de Uso: [hoje                ]                  │
│  Vencimento:   [2025-11-29           ] (pré-preenchido) │
└─────────────────────────────────────────────────────────┘

┌─ Nível I ──────────┬─ Nível II ──────────┬─ Nível III ──────┐
│ Lote: [HHI-1339]   │ Lote: [HHI-1340]    │ Lote: [HHI-1341] │
│ 8 analitos         │ 8 analitos          │ 8 analitos       │
│ 13 fallback        │ 13 fallback         │ 13 fallback      │
└────────────────────┴─────────────────────┴──────────────────┘

[Cancelar]                    [Criar 3 lotes →]
```

Cada card de nível mostra o lotNumber em input editável (pré-preenchido da extração).

**Lógica de submit — usar `writeBatch` do Firestore para atomicidade:**
```typescript
async function handleConfirm() {
  setSubmitting(true);
  try {
    // Chamar onConfirm com os 3 BatchLotJob montados
    // onConfirm executa writeBatch com os 3 setDoc
    await onConfirm(jobs);
    onClose();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Erro ao criar lotes.');
  } finally {
    setSubmitting(false);
  }
}
```

**Deduplicação:** antes de escrever, verificar se já existe documento com o mesmo `lotNumber` no lab. Se existir, mostrar warning inline (não bloquear, apenas avisar).

### 4c. Atualizar `useLots.ts` — novo método `addBatchLots`

```typescript
async function addBatchLots(jobs: BatchLotJob[]): Promise<void> {
  const labId = activeLab?.id;
  if (!labId) throw new Error('Nenhum laboratório ativo.');

  const db    = getFirestore();
  const batch = writeBatch(db);

  const now     = new Date();
  const userId  = user?.uid ?? '';

  for (const job of jobs) {
    const ref = doc(collection(db, `labs/${labId}/lots`));
    batch.set(ref, {
      labId,
      lotNumber:         job.lotNumber,
      controlName:       job.controlName,
      equipmentName:     job.equipmentName,
      serialNumber:      job.serialNumber,
      level:             job.level,
      startDate:         job.startDate,
      expiryDate:        job.expiryDate,
      requiredAnalytes:  job.requiredAnalytes,
      manufacturerStats: job.manufacturerStats,
      runs:              [],
      statistics:        null,
      runCount:          0,
      createdAt:         now,
      createdBy:         userId,
    });
  }

  await batch.commit();
}
```

Expor `addBatchLots` no retorno do hook.

### 4d. Atualizar fluxo do BulaProcessor

Em `BulaProcessor.tsx`, `handleConfirm` deixa de chamar `setPendingBulaData` + `setCurrentView('analyzer')`.

Passa a abrir `BulaBatchConfirmModal` inline (estado local `showBatchModal`):

```tsx
const [showBatchModal, setShowBatchModal] = useState(false);

function handleConfirm() {
  setShowBatchModal(true);
}

// No render:
{showBatchModal && result && (
  <BulaBatchConfirmModal
    data={result}
    onClose={() => setShowBatchModal(false)}
    onConfirm={async (jobs) => {
      await addBatchLots(jobs);
      setPendingBulaData(null);
      setCurrentView('analyzer');
    }}
  />
)}
```

### 4e. Remover pre-fill do AddLotModal para bula

Em `AddLotModal.tsx`, remover o `useEffect` que lê `pendingBulaData` do store para pré-preenchimento. O fluxo de bula agora vai direto para `BulaBatchConfirmModal`. O `AddLotModal` continua funcionando normalmente para criação manual e import via CSV.

---

## Restrições e anti-padrões

- **Não usar `Promise.all` para os 3 saves** — usar `writeBatch` para atomicidade
- **Não hardcodar equipamento no prompt** — passar como parâmetro da Cloud Function
- **Não salvar retorno do Gemini sem validação Zod** — manter `BulaResponseSchema.safeParse`
- **Não reutilizar o `AddLotModal` para o fluxo de bula** — criar `BulaBatchConfirmModal` separado
- **Modelo Gemini**: `gemini-2.5-flash` (sem sufixo preview)
- **Tailwind**: usar `amber-*` para fallback (não `yellow-*`) — consistência com o design system existente
- **Tooltip de fallback**: não instalar lib; usar `group/peer` CSS ou estado hover local

---

## Ordem de execução

1. `src/types/index.ts` — substituir `PendingBulaData`
2. `functions/src/index.ts` — reescrever `extractFromBula`
3. `src/features/bulaparser/services/bulaGeminiService.ts` — atualizar tipos e função
4. `src/features/bulaparser/BulaProcessor.tsx` — campo equipamento + ResultPanel com tabs
5. `src/features/lots/BulaBatchConfirmModal.tsx` — criar componente novo
6. `src/features/lots/hooks/useLots.ts` — adicionar `addBatchLots`
7. `src/features/lots/AddLotModal.tsx` — remover useEffect de bula
8. Verificar TypeScript sem erros (`tsc --noEmit`)
