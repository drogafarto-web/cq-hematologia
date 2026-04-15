# ETAPA 1/8: SCHEMA DE DADOS — CIQ-IMUNO RDC 978 (15min)

## Objetivo
Definir a estrutura de dados para o módulo de Imunologia (CIQ-Imuno), estendendo o tipo base `CQRun` do projeto para garantir conformidade com a RDC 978/2025.

## Definição de Tipos
Arquivo: `src/features/ciq-imuno/types/CIQImuno.ts`

```ts
import type { CQRun } from '../../../types';
import type { TestType, WestgardCatAlert } from './_shared_refs';

/**
 * CIQImunoRun estende CQRun omitindo todos os campos quantitativos
 * (analitos numéricos, Westgard z-score, nível) e adicionando campos
 * categóricos do formulário FR-036 (RDC 978/2025).
 *
 * Campos omitidos e por quê:
 *  - westgardViolations: substituído por westgardCategorico (R/NR, não z-score)
 *  - level:              imuno não tem níveis 1/2/3 de controle quantitativo
 *  - aiData:             analitos numéricos — não existe em imunoensaio categórico
 *  - aiConfidence:       confiança por analito — substituída por confidence no OCR service
 *  - confirmedData:      mapa de valores confirmados numéricos — inaplicável
 *  - editedFields:       controle de edição de analitos numéricos — inaplicável
 *  - originalData:       valores originais de analitos — inaplicável
 */
export interface CIQImunoRun extends Omit<CQRun,
  | 'westgardViolations'
  | 'level'
  | 'aiData'
  | 'aiConfidence'
  | 'confirmedData'
  | 'editedFields'
  | 'originalData'
> {
  testType: TestType;
  loteControle: string;
  aberturaControle: string;   // YYYY-MM-DD
  validadeControle: string;   // YYYY-MM-DD
  loteReagente: string;
  reagenteStatus: 'R' | 'NR';
  aberturaReagente: string;   // YYYY-MM-DD
  validadeReagente: string;   // YYYY-MM-DD
  resultadoEsperado: 'R' | 'NR';
  resultadoObtido: 'R' | 'NR';
  dataRealizacao: string;     // YYYY-MM-DD
  westgardCategorico?: WestgardCatAlert[];
}
```

## Firestore Path
`labs/{labId}/ciq-imuno/{lotId}/runs/{runId}`

## Critérios de Aceite
- [ ] Interface `CIQImunoRun` criada e estendendo `CQRun`.
- [ ] Import de `CQRun` aponta para o path relativo correto (`../../../types`).
- [ ] Campos de validade e datas seguem o padrão `string` (YYYY-MM-DD) para compatibilidade com inputs.