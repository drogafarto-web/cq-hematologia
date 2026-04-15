# ETAPA 5/8: FIREBASE AI OCR — ANALISADOR DE STRIPS (30min)

## Objetivo
Implementar a análise por IA de imagens de strips de imunoensaio (HCG, HIV, etc.) utilizando o padrão de segurança do projeto: **Firebase Callables**. A chave de API reside apenas no backend.

## 🔒 Padrão Obrigatório de Segurança
O frontend JAMAIS chama o Gemini diretamente. Toda análise passa por uma Cloud Function v2.

### Parte 1: Frontend Service
Arquivo: `src/features/ciq-imuno/services/ciqOCRService.ts`

```ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../config/firebase.config';
import type { TestType } from '../types/CIQImuno';

interface StripOCRPayload { 
  base64: string; 
  mimeType: string; 
  testType: TestType; 
}

interface StripOCRResult { 
  resultadoObtido: 'R' | 'NR'; 
  confidence: 'high' | 'medium' | 'low'; 
}

const _analyzeImmunoStrip = httpsCallable<StripOCRPayload, StripOCRResult>(
  functions, 'analyzeImmunoStrip'
);

export async function analyzeImmunoStrip(file: File, testType: TestType): Promise<StripOCRResult> {
  const base64 = await fileToBase64(file);
  const result = await _analyzeImmunoStrip({ base64, mimeType: file.type, testType });
  return result.data;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

### Parte 2: Backend (Cloud Function)
Arquivo: `functions/src/index.ts`

**Modelos utilizados pelo `callAIWithFallback`:**
- Primário: `gemini-3.1-flash-image-preview` (Gemini Direct)
- Fallback automático: `google/gemini-2.0-flash-001` via OpenRouter (ativado se o primário falhar)

O fallback é transparente — o frontend não precisa tratar os dois casos. `callAIWithFallback` já lida internamente.

```ts
export const analyzeImmunoStrip = onCall(
  { secrets: [geminiApiKey, openRouterApiKey], memory: '512MiB', timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Acesso negado.');
    
    const { base64, mimeType, testType } = request.data;
    const prompt = `Analise a imagem de um strip de imunoensaio do tipo ${testType}.
Responda APENAS com JSON: { "resultado": "R" | "NR", "confidence": "high" | "medium" | "low" }
Instruções: R = Reagente (duas linhas) | NR = Não Reagente (uma linha de controle apenas)`;

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
  }
);
```

## Critérios de Aceite
- [ ] Nenhum import de `@google/genai` no diretório `src/`.
- [ ] Uso exclusivo do callable `analyzeImmunoStrip`.
- [ ] Modelo `gemini-3.1-flash-image-preview` configurado no backend.