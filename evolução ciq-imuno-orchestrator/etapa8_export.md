# ETAPA 8/8: EXPORT FR-036 — CSV E QR CODE (20min)

## Objetivo
Finalizar o módulo com as ferramentas de exportação exigidas para auditorias RDC 978, incluindo o arquivo CSV compatível com o formulário FR-036 e QR Codes de rastreabilidade.

## 📦 Dependências Adicionais
Execute no terminal:
```bash
npm i papaparse qrcode.react
npm i -D @types/papaparse
```

## 📄 Geração de CSV (PapaParse)
Arquivo: `src/features/ciq-imuno/services/ciqExportService.ts`

O CSV deve conter todas as colunas do FR-036:
```ts
import Papa from 'papaparse';

export function exportCIQToCSV(runs: CIQImunoRun[]) {
  const data = runs.map(r => ({
    'Data Realização': r.dataRealizacao,
    'Tipo de Teste': r.testType,
    'Lote Controle': r.loteControle,
    'Validade Controle': r.validadeControle,
    'Resultado Obtido': r.resultadoObtido,
    'Operador': r.operatorName,
    'Assinatura Digital': r.logicalSignature
  }));

  const csv = Papa.unparse(data);
  // ... lógica de download
}
```

## 📱 QR Code de Rastreabilidade
Arquivo: `src/features/ciq-imuno/components/CIQAuditor.tsx`

Utilize o componente `QRCodeSVG` para gerar o link de auditoria.
A URL base deve vir de uma constante de configuração — nunca hardcoded no componente:

```ts
// src/constants.ts (ou src/config/constants.ts, se já existir)
export const AUDIT_BASE_URL = import.meta.env.VITE_AUDIT_BASE_URL ?? 'https://cq.labclin.com.br/audit';
```

```tsx
import { QRCodeSVG } from 'qrcode.react';
import { AUDIT_BASE_URL } from '../../../constants';

export function CIQAuditor({ run }: { run: CIQImunoRun }) {
  const auditURL = `${AUDIT_BASE_URL}/ciq-imuno?id=${run.id}&sig=${run.logicalSignature}`;
  
  return (
    <div className="p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg">
      <QRCodeSVG value={auditURL} size={128} />
      <p className="text-[10px] mt-2 font-mono text-slate-400">SIG: {run.logicalSignature.slice(0, 8)}</p>
    </div>
  );
}
```

## Critérios de Aceite
- [ ] Exportação CSV funciona com caracteres latinos (UTF-8).
- [ ] QR Code renderizado corretamente sem bibliotecas de ícones.
- [ ] Link do QR Code inclui o `logicalSignature` para validação offline.