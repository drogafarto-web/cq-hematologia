---
title: "CORRECTION PROMPT — CIQ-Imuno Orchestrator v2"
scope: "3 correções cirúrgicas pós-auditoria"
alvo: "_shared_refs.md, etapa1_schema.md, etapa7_westgard.md, etapa5_ocr.md"
date: "2026-04-15"
---

# CORRECTION PROMPT — Correções Cirúrgicas

Você aplicou correções em todos os MDs do módulo CIQ-Imuno. A auditoria final identificou **3 problemas remanescentes**. Execute cada correção na ordem abaixo, sem alterar nada além do que está especificado.

---

## CORREÇÃO 1 — `_shared_refs.md`

**Problema:** O arquivo atual é apenas Markdown de documentação. As etapas 1 e 7 fazem `import` dele como se fosse um módulo TypeScript — isso falha em tempo de compilação.

**Solução:** Adicionar uma seção no final do `_shared_refs.md` que instrui a criação de um arquivo TypeScript companheiro.

**Ação:** Abra `_shared_refs.md` e adicione a seguinte seção no final, preservando tudo que já existe:

```markdown
## Arquivo TypeScript Companheiro

Este `.md` é documentação. Os tipos precisam existir em um arquivo `.ts` real.

Criar: `src/features/ciq-imuno/types/_shared_refs.ts`

\`\`\`ts
// src/features/ciq-imuno/types/_shared_refs.ts
// Fonte única de verdade para tipos compartilhados do módulo CIQ-Imuno.
// Importar daqui em todos os hooks e componentes do módulo.

export type TestType =
  | 'HCG' | 'BhCG' | 'HIV' | 'HBsAg' | 'Anti-HCV'
  | 'Sifilis' | 'Dengue' | 'COVID' | 'PCR' | 'Troponina';

export type CIQStatus = 'A' | 'NA' | 'Rejeitado';

export type WestgardCatAlert =
  | 'taxa_falha_10pct'   // >10% NR no total do lote (mín 10 runs)
  | 'consecutivos_3nr'   // 3 NR consecutivos
  | 'consecutivos_4nr'   // 4+ NR nos últimos 10 runs
  | 'lote_expirado'      // validadeControle < dataRealizacao
  | 'validade_30d';      // validadeControle expira em menos de 30 dias
\`\`\`
```

Confirme: `shared-refs-ts-adicionado`

---

## CORREÇÃO 2 — `etapa1_schema.md`

**Problema:** O import atual aponta para `'../_shared_refs'` (diretório errado e arquivo inexistente).

**Ação:** Substituir apenas o bloco de código TypeScript da interface `CIQImunoRun`. Localizar este trecho:

```ts
import type { CQRun } from '../../../types';
import type { TestType, WestgardCatAlert } from '../_shared_refs';
```

Substituir por:

```ts
import type { CQRun } from '../../../types';
import type { TestType, WestgardCatAlert } from './types/_shared_refs';
```

Nada mais muda neste arquivo.

Confirme: `etapa1-import-corrigido`

---

## CORREÇÃO 3 — `etapa7_westgard.md`

Este arquivo tem dois problemas. Corrija ambos em sequência.

### 3a — Import incorreto

**Localizar:**
```ts
import type { WestgardCatAlert } from '../_shared_refs';
```

**Substituir por:**
```ts
import type { WestgardCatAlert } from '../types/_shared_refs';
```

### 3b — Regra `consecutivos_4nr` ausente

A regra `'consecutivos_4nr'` está declarada em `WestgardCatAlert` mas não está implementada no hook. Isso cria um tipo morto — ele existe na definição mas nunca é emitido.

**Localizar** o bloco da Regra 2 (consecutivos_3nr) e adicionar a Regra 3 imediatamente após o `break`:

O trecho atual termina assim:
```ts
    // Regra 2: 3 Resultados "Não Reagentes" (NR) Consecutivos
    let consecutivosNR = 0;
    for (const r of recentes) {
      if (r.resultadoObtido === 'NR') {
        consecutivosNR++;
        if (consecutivosNR >= 3) {
          alerts.push('consecutivos_3nr');
          break;
        }
      } else {
        consecutivosNR = 0;
      }
    }

    // Regra 3: Alerta de Validade do Lote (Próximo de Vencer)
```

**Substituir por:**
```ts
    // Regra 2: 3 Resultados "Não Reagentes" (NR) Consecutivos
    let consecutivosNR = 0;
    for (const r of recentes) {
      if (r.resultadoObtido === 'NR') {
        consecutivosNR++;
        if (consecutivosNR >= 3) {
          alerts.push('consecutivos_3nr');
          break;
        }
      } else {
        consecutivosNR = 0;
      }
    }

    // Regra 3: 4+ NR nos últimos 10 runs
    const ultimos10 = recentes.slice(0, 10);
    const nr10 = ultimos10.filter(r => r.resultadoObtido === 'NR').length;
    if (nr10 >= 4) alerts.push('consecutivos_4nr');

    // Regra 4: Alerta de Validade do Lote (Próximo de Vencer)
```

**Atenção:** Renumerar o comentário "Regra 3: Alerta de Validade" para "Regra 4: Alerta de Validade" para manter consistência.

Confirme: `etapa7-westgard-completo`

---

## CORREÇÃO 4 — `etapa5_ocr.md`

**Problema:** O backend callable faz `return JSON.parse(rawText)` diretamente, sem validação Zod. Se o modelo retornar formato inesperado, dados corrompidos chegam ao cliente sem erro explícito. O padrão do projeto sempre valida com Zod antes de retornar.

**Localizar** o bloco do backend e substituir apenas o corpo da função:

O trecho atual:
```ts
    const rawText = await callAIWithFallback({ 
      prompt, base64, mimeType,
      geminiKey: geminiApiKey.value(), 
      openRouterKey: openRouterApiKey.value() 
    });
    
    return JSON.parse(rawText);
```

**Substituir por:**
```ts
    const rawText = await callAIWithFallback({ 
      prompt, base64, mimeType,
      geminiKey: geminiApiKey.value(), 
      openRouterKey: openRouterApiKey.value() 
    });

    const StripResultSchema = z.object({
      resultado:  z.enum(['R', 'NR']),
      confidence: z.enum(['high', 'medium', 'low']),
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new HttpsError('internal', 'IA retornou resposta não-JSON.');
    }

    const validation = StripResultSchema.safeParse(parsed);
    if (!validation.success) {
      throw new HttpsError('internal', `Formato inválido da IA: ${validation.error.message}`);
    }

    return {
      resultadoObtido: validation.data.resultado,
      confidence:      validation.data.confidence,
    };
```

Confirme: `etapa5-zod-adicionado`

---

## VERIFICAÇÃO FINAL

Após as 4 correções, confirme o seguinte checklist:

- [ ] `_shared_refs.md` contém instrução para criar `_shared_refs.ts` com os 5 tipos
- [ ] `etapa1_schema.md` importa de `'./types/_shared_refs'`
- [ ] `etapa7_westgard.md` importa de `'../types/_shared_refs'`
- [ ] `etapa7_westgard.md` implementa as 4 regras: `taxa_falha_10pct`, `consecutivos_3nr`, `consecutivos_4nr`, `lote_expirado`/`validade_30d`
- [ ] `etapa5_ocr.md` valida o retorno da IA com Zod antes de retornar ao cliente
- [ ] Nenhum outro arquivo foi alterado

Confirmação final: `ciq-imuno-orchestrator-v2-pronto`
