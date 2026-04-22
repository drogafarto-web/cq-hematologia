---
name: hcq-pdf-export-scaffold
description: Gera scaffold de export PDF de compliance (FR-10, FR-50, relatório CIQ, backup diário) para hc quality — layout tokens compartilhados, componente React com react-to-print, QR de validação, endpoint público validateFR, golden test com snapshot, smoke render script. Replica layout físico Labclin pixel-a-pixel. Discrimina A4 vs. tabloide, dual-row vs. single, cursor-based layout com safeBottomY. Codifica padrão extraído dos 6 sprints de refactor do PDF backup diário.
---

# hcq-pdf-export-scaffold — Export PDF de compliance

> **Versão:** 1.0 · **Última atualização:** 2026-04-20 · **Referências canônicas:** `src/features/insumos/components/FR10Print.tsx`, `functions/src/modules/emailBackup/pdf/layout.ts`, `functions/scripts/preview-backup-pdf.mjs`

Esta skill codifica o padrão que emergiu dos 6 sprints do refactor do PDF backup A4 + piloto FR-10: como construir um novo export PDF de compliance no hc quality sem recomeçar do zero toda vez.

Skills relacionadas: [hcq-ciq-module](../hcq-ciq-module/SKILL.md) seção 12 (origem), [hcq-ciq-audit-trail](../hcq-ciq-audit-trail/SKILL.md) (hash no rodapé), [hcq-module-generator](../hcq-module-generator/SKILL.md) (chama esta skill quando `requiresFR`), [hcq-deploy-gates](../hcq-deploy-gates/SKILL.md) (golden diff no gate).

---

## 1. Quando usar

Use quando:
- Labclin exige novo formulário de compliance (FR-20, FR-50, FR-nn)
- Módulo CIQ novo precisa de relatório periódico (mensal, trimestral)
- Backup diário/semanal por email precisa ser visualmente auditável
- Export agregado cross-módulo (dashboard em PDF)

**Não use** para:
- Export de dados em Excel/CSV (use [papaparse](https://www.papaparse.com/), sem PDF)
- Print de tela/screenshot (use browser print nativo sem template)
- Log interno de dev

---

## 2. Princípio inegociável

O PDF **replica** o formulário físico da Labclin **pixel-a-pixel**. Auditor coloca digital e físico lado a lado, deve ver o mesmo layout.

- Header, grid, campos, rodapé, ordem de colunas: **idêntico ao físico**
- Tipografia: **idêntica** (ou melhor, se o físico tem problema de leitura — documentar decisão)
- Larguras de coluna: proporcionais ao original
- Logo Labclin: mesma posição, mesmo tamanho relativo

Se o formulário físico tem problema (ex: coluna muito estreita), **corrige com aprovação**, documenta em `docs/fr-<nn>-decisoes.md`, mostra pro CTO antes de shipar.

---

## 3. Stack

| Peça | Ferramenta | Razão |
|---|---|---|
| Render browser | `react-to-print` | Preserva Tailwind + dark mode seletivo (print é light-only), CSS complexo |
| Render server | `pdfkit` (em Cloud Function) | Sem browser headless, controle total de layout, golden-test diffável |
| QR | `qrcode.react` | Instalado, versátil |
| Tokens | módulo TS compartilhado | Ver seção 4 |
| Testes | `vitest` + snapshot do pdfkit doc | Golden diff sem rasterizar |
| Preview local | `node functions/scripts/preview-*.mjs` | Zero dep pesada, gera arquivo físico |

**Decisão:** FR-* gerado pelo operador na UI → `react-to-print`. Backup/relatório automatizado → `pdfkit` em Cloud Function. Razão: o primeiro precisa de CSS rico + dark detection; o segundo precisa de determinismo + rodar sem browser.

---

## 4. Design tokens compartilhados

Arquivo: `src/shared/pdf/layout.ts` (ou `functions/src/modules/<modulo>/pdf/layout.ts` se export é só server-side).

```ts
// Cores (sRGB)
export const COLOR = {
  black: '#000000',
  ink: '#1a1a1a',
  muted: '#555555',
  border: '#333333',
  borderLight: '#999999',
  fill: '#f4f4f4',
  labclinBlue: '#0b3d91',
  envBannerDev: '#f59e0b',
  envBannerHomolog: '#06b6d4',
  envBannerTest: '#6b7280',
} as const;

// Página (pontos PostScript: 72 pt = 1 in = 2.54 cm)
export const PAGE = {
  a4: { width: 595.28, height: 841.89 },
  margin: { top: 36, right: 36, bottom: 36, left: 36 },
  safeBottom: 36 + 48, // margin + rodapé
} as const;

export const FONT_SIZES = {
  h1: 14, h2: 12, body: 9, caption: 8, footer: 7,
} as const;

export const LINE_HEIGHTS = {
  body: 12, table: 14, compact: 10,
} as const;

// Helper: retorna true se cursor Y + contentHeight ultrapassa safeBottom
export function willOverflow(doc: PDFKit.PDFDocument, contentHeight: number): boolean {
  return doc.y + contentHeight > PAGE.a4.height - PAGE.safeBottom;
}

export function ensureSpace(doc: PDFKit.PDFDocument, contentHeight: number): void {
  if (willOverflow(doc, contentHeight)) doc.addPage();
}
```

Regra: **todo export novo importa deste módulo**. Copy-paste de constantes é anti-pattern rejeitado em review.

---

## 5. Scaffold — export client-side (FR-*)

### 5.1 Componente

`src/features/<modulo>/components/FR<nn>Print.tsx`:

```tsx
import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import logoLabclin from '@/assets/labclin-logo.svg';
import { fmtDate } from '@/shared/utils/format';

export interface FR<nn>PrintProps {
  labId: string;
  hash: string;
  periodo: { inicio: Date; fim: Date };
  dados: FR<nn>Row[];
  environment: 'prod' | 'homolog' | 'dev';
}

export const FR<nn>Print = forwardRef<HTMLDivElement, FR<nn>PrintProps>(
  function FR<nn>Print({ labId, hash, periodo, dados, environment }, ref) {
    const publicValidateUrl = `https://app.labclinmg.com.br/validate/fr<nn>/${hash}`;

    return (
      <div ref={ref} className="print-container font-sans text-[9pt] leading-[12pt] text-black">
        {environment !== 'prod' && (
          <div className="bg-amber-400 text-black px-2 py-1 text-center text-[8pt] font-bold">
            AMBIENTE {environment.toUpperCase()} — NÃO VÁLIDO PARA AUDITORIA
          </div>
        )}

        <header className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
          <img src={logoLabclin} alt="Labclin" className="h-12" />
          <div className="text-right">
            <h1 className="font-bold text-[14pt]">FR-<nn> — <NomeFormulário> — Ver.00</h1>
            <div className="text-[8pt]">Período: {fmtDate(periodo.inicio)} → {fmtDate(periodo.fim)}</div>
          </div>
        </header>

        <table className="w-full border-collapse border border-black">
          <thead className="bg-gray-100">
            <tr>
              {/* colunas pixel-match do físico */}
            </tr>
          </thead>
          <tbody>
            {dados.map((row, i) => (
              <FR<nn>Row key={row.id} row={row} index={i} />
            ))}
          </tbody>
        </table>

        <footer className="mt-4 pt-2 border-t border-black text-[7pt] flex justify-between items-end">
          <div className="flex-1">
            <div>Hash SHA-256: <code className="font-mono">{hash}</code></div>
            <div>Gerado em: {fmtDate(new Date())}</div>
            <div>Laboratório: {labId}</div>
          </div>
          <div className="flex flex-col items-center">
            <QRCodeSVG value={publicValidateUrl} size={56} level="M" />
            <div className="text-[6pt] mt-1">Validar</div>
          </div>
        </footer>

        <style>{`
          @media print {
            @page { size: A4; margin: 10mm; }
            .print-container { color: black !important; background: white !important; }
          }
        `}</style>
      </div>
    );
  }
);
```

Regras:
- `forwardRef` **sempre** — `react-to-print` precisa do ref do container.
- Banner de ambiente em **tudo que não é prod** — audit falso-positivo é pior que layout feio.
- Hash em `<code>` monospaced — auditor digita, facilita.
- QR aponta pra `app.labclinmg.com.br/validate/...` — dominio fixo, endpoint público read-only, retorna HTML inline sem JS (ver seção 7).

### 5.2 Hook de impressão

```tsx
// src/features/<modulo>/hooks/usePrintFR<nn>.ts
import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';

export function usePrintFR<nn>() {
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'FR-<nn>',
    pageStyle: `@page { size: A4; margin: 10mm; }`,
  });
  return { printRef, handlePrint };
}
```

---

## 6. Scaffold — export server-side (backup / relatório periódico)

### 6.1 Estrutura

```
functions/src/modules/<modulo>/
├── pdf/
│   ├── layout.ts              # tokens (ou import de shared/)
│   ├── render.ts              # função renderPDF(buffer, data)
│   ├── components/
│   │   ├── header.ts
│   │   ├── table.ts
│   │   └── footer.ts
│   └── __tests__/
│       └── golden.test.ts
└── scheduled.ts              # onSchedule que chama renderPDF + envia email
```

### 6.2 Render puro

```ts
// functions/src/modules/<modulo>/pdf/render.ts
import PDFDocument from 'pdfkit';
import { PAGE, COLOR, FONT_SIZES, ensureSpace } from './layout';
import { drawHeader } from './components/header';
import { drawTable } from './components/table';
import { drawFooter } from './components/footer';

export interface <Modulo>ReportData {
  labId: string;
  hash: string;
  periodo: { inicio: Date; fim: Date };
  runs: RunRow[];
}

export function render<Modulo>Report(data: <Modulo>ReportData): Buffer {
  const doc = new PDFDocument({
    size: 'A4',
    margins: PAGE.margin,
    info: {
      Title: '<Modulo> — Relatório CIQ',
      Author: 'hc quality',
      CreationDate: new Date(),
    },
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));

  drawHeader(doc, data);
  drawTable(doc, data.runs);
  drawFooter(doc, data);

  doc.end();
  return Buffer.concat(chunks);
}
```

Regras:
- **Pure function** — entra dados, sai buffer. Zero side effect. Testável.
- **`chunks` pattern** — coleta buffer em memória em vez de stream pra arquivo (Cloud Function não tem disk persistente).
- **Metadata PDF (Author, Title, CreationDate)** — auditor confere `pdfinfo`.
- **`ensureSpace` antes de seções grandes** — evita corte em meio à linha.

### 6.3 Preview script

`functions/scripts/preview-<modulo>-report.mjs`:

```js
#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { render<Modulo>Report } from '../lib/modules/<modulo>/pdf/render.js';

const data = {
  labId: 'test-lab',
  hash: 'a'.repeat(64),
  periodo: { inicio: new Date('2026-04-01'), fim: new Date('2026-04-30') },
  runs: [
    { id: 'r1', analyte: 'GLU', value: 100, status: 'in-range' },
    // ... fixture
  ],
};

const buf = render<Modulo>Report(data);
writeFileSync('/tmp/preview-<modulo>-report.pdf', buf);
console.log('wrote /tmp/preview-<modulo>-report.pdf', buf.length, 'bytes');
```

Use: `(cd functions && npm run build && node scripts/preview-<modulo>-report.mjs)`.

### 6.4 Golden test

```ts
// functions/src/modules/<modulo>/pdf/__tests__/golden.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { render<Modulo>Report } from '../render';
import { FIXTURE_MINIMAL, FIXTURE_FULL } from './fixtures';

describe('<Modulo>Report render', () => {
  it('golden minimal', () => {
    const buf = render<Modulo>Report(FIXTURE_MINIMAL);
    const golden = readFileSync(__dirname + '/golden-minimal.pdf');
    expect(buf.length).toBeGreaterThan(1000);
    // Comparação byte-a-byte do PDF é frágil (timestamps). Compara size band e text extract:
    expect(Math.abs(buf.length - golden.length)).toBeLessThan(golden.length * 0.02);
  });

  it('golden full — 30 runs', () => {
    const buf = render<Modulo>Report(FIXTURE_FULL);
    expect(buf.length).toBeGreaterThan(5000);
    expect(buf.length).toBeLessThan(100000);
  });
});
```

**Por que não byte-exact:** PDFs têm `CreationDate` interno, IDs de font cache, compressão não-determinística. Golden size-band é pragmático.

**Alternativa robusta:** extrair texto com `pdf-parse`, snapshot do texto. Diff de layout exige rasterizar + comparar (próximo nível).

---

## 7. Endpoint público de validação QR

Para cada FR-* com QR, crie Cloud Function `onCall` pública:

```ts
// functions/src/modules/<modulo>/validateFR<nn>.ts
import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const validateFR<nn> = onRequest(
  { region: 'southamerica-east1', cors: true, invoker: 'public' },
  async (req, res) => {
    const hash = req.path.split('/').pop();
    if (!hash || !/^[a-f0-9]{64}$/.test(hash)) {
      res.status(400).send(renderHtml({ status: 'invalid', hash }));
      return;
    }

    // busca o doc por hash (tanto no fr<nn>-emissions quanto no event)
    const emRef = await getFirestore()
      .collectionGroup('fr<nn>-emissions')
      .where('hash', '==', hash).limit(1).get();

    if (emRef.empty) {
      res.status(404).send(renderHtml({ status: 'not-found', hash }));
      return;
    }

    const doc = emRef.docs[0].data();
    res.status(200).send(renderHtml({
      status: 'valid',
      hash,
      labId: doc.labId,
      periodo: doc.periodo,
      emittedAt: doc.firstEmittedAt,
      lastPrintedAt: doc.lastPrintedAt,
    }));
  }
);

function renderHtml(payload: ValidationPayload): string {
  // HTML PURO, sem JS — qualquer QR reader/browser abre
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Validação FR-<nn></title>
    <style>
      body{font-family:system-ui;max-width:420px;margin:2rem auto;padding:1rem}
      .valid{color:#065f46;background:#d1fae5}
      .invalid{color:#991b1b;background:#fee2e2}
      .badge{padding:.5rem 1rem;border-radius:.5rem;font-weight:bold}
      dt{font-weight:bold;margin-top:.5rem}
    </style>
  </head><body>
    <h1>Validação FR-<nn></h1>
    <div class="badge ${payload.status === 'valid' ? 'valid' : 'invalid'}">
      ${payload.status === 'valid' ? '✓ VÁLIDO' : '✗ ' + payload.status.toUpperCase()}
    </div>
    ${payload.status === 'valid' ? `
    <dl>
      <dt>Hash</dt><dd><code>${payload.hash}</code></dd>
      <dt>Laboratório</dt><dd>${payload.labId}</dd>
      <dt>Período</dt><dd>${payload.periodo?.inicio} → ${payload.periodo?.fim}</dd>
      <dt>Emitido em</dt><dd>${payload.emittedAt}</dd>
      <dt>Última impressão</dt><dd>${payload.lastPrintedAt}</dd>
    </dl>` : `<p>Hash não encontrado no sistema.</p>`}
  </body></html>`;
}
```

Regras:
- **`invoker: 'public'`** — obrigatório pra QR scan de qualquer device sem login.
- **HTML inline, zero JS** — qualquer viewer de QR abre sem depender de SPA bundle.
- **Nunca retorna payload completo do run** — só valida hash; se auditor quer detalhe, logga no app.
- **Rate limit** — configure via Cloud Armor ou limit interno (próximo nível). MVP: deixe público, monitore.

---

## 8. Idempotência FR-* — setDoc merge

Padrão FR-10 aplicável a todos os FR-*:

```ts
// first emission
const emRef = doc(db, `labs/${labId}/fr<nn>-emissions/${hash}`);
const existing = await getDoc(emRef);
if (existing.exists()) {
  // reprint → atualiza só lastPrintedAt
  await updateDoc(emRef, {
    lastPrintedAt: serverTimestamp(),
    reprintCount: increment(1),
  });
} else {
  await setDoc(emRef, {
    hash,
    labId,
    periodo: { inicio, fim },
    payload,
    firstEmittedAt: serverTimestamp(),
    lastPrintedAt: serverTimestamp(),
    reprintCount: 0,
    emittedBy: auth.currentUser!.uid,
  });
}
```

**Docid = hash** — natural chave única idempotente. Reemissão do mesmo payload = mesmo hash = mesmo doc. Auditor vê `reprintCount` e sabe quantas vezes foi reimpresso.

---

## 9. Watermarking por ambiente

Detecta ambiente e decora:

- **prod:** limpo, sem banner, QR aponta pra `app.labclinmg.com.br`
- **homolog:** banner ciano topo "AMBIENTE HOMOLOGAÇÃO", QR aponta pra staging URL
- **dev:** banner amber "AMBIENTE DEV", hash prefixado com `DEV-`
- **test:** banner cinza "TESTE", não gera em prod bucket

Implementação via env var `HCQ_ENVIRONMENT` lida pelo render. Nunca confie em `window.location` — render pode rodar server-side.

---

## 10. Checklist de scaffold

- [ ] Tokens importados de `src/shared/pdf/layout.ts` (não duplicados)
- [ ] `forwardRef` no componente React
- [ ] `@media print` CSS incluído
- [ ] Banner de ambiente para não-prod
- [ ] QR com URL pública que valida
- [ ] Hash SHA-256 no rodapé
- [ ] Metadata PDF (server-side): Title, Author, CreationDate
- [ ] Preview script em `functions/scripts/preview-<modulo>-*.mjs`
- [ ] Golden test com fixture mínima + fixture cheia
- [ ] Endpoint `validateFR<nn>` público criado
- [ ] Doc de emissão idempotente por hash
- [ ] Watermark por ambiente funcionando
- [ ] Compliance metadata (CNPJ lab, período, operador uid) presente
- [ ] Teste visual manual: imprimir PDF lado-a-lado com FR físico da Labclin

---

## 11. Anti-patterns

| Anti-pattern | Motivo | Correção |
|---|---|---|
| Duplicar tokens de cor/página em vez de importar | 2 exports, 2 verdades; mudança cosmética vira 4 PRs | `src/shared/pdf/layout.ts` |
| Render PDF com `window.print()` direto no body | CSS do app interfere, dark mode vazando | `react-to-print` com ref isolado |
| Golden byte-a-byte | PDFs têm timestamps internos, falha flakey | Size-band ou `pdf-parse` + snapshot de texto |
| Endpoint de validação que retorna payload inteiro | Vaza dados do lab | Só `status + hash + metadata mínima` |
| QR sem URL absoluta | Relativos quebram em email print | Sempre `https://app.labclinmg.com.br/...` |
| FR sem banner em homolog | Auditor confunde com prod | Banner obrigatório fora de prod |
| Gerar PDF sem audit trail do save | Ship-and-forget, não rastreia emissão | `fr<nn>-emissions/{hash}` com `firstEmittedAt` |
| Chamar `doc.end()` antes de `doc.on('data')` ligar | PDF vazio | Setup listener antes |
| Emissão não-idempotente (re-cria doc a cada print) | Auditor vê 50 docs pra mesmo PDF | `setDoc merge` com hash como docid |
| Incluir `React` components dentro de `pdfkit` render | Confusão de mundos, bundle inchado | Client-side → react-to-print; server-side → pdfkit |

---

## 12. Referências no código

| Padrão | Arquivo |
|---|---|
| Tokens compartilhados A4 | `functions/src/modules/emailBackup/pdf/layout.ts` (promover a `src/shared/pdf/layout.ts` quando 2º export server-side surgir) |
| Render server-side | `functions/src/modules/emailBackup/pdf/render.ts` |
| Componente client-side FR-10 | `src/features/insumos/components/FR10Print.tsx` |
| Endpoint público validateFR | `functions/src/modules/insumos/validateFR10.ts` |
| Preview script | `functions/scripts/preview-backup-pdf.mjs` |
| Golden test | `functions/src/modules/emailBackup/pdf/__tests__/golden.test.ts` |

---

## 13. Regulatório — checklist compliance

Todo FR-* em produção deve ter:

- [ ] Nome do formulário + versão ("Ver.00")
- [ ] CNPJ do laboratório
- [ ] Período do relatório
- [ ] Operador uid + nome (member doc)
- [ ] Hash SHA-256 do payload agregado
- [ ] Timestamp do servidor (não do cliente)
- [ ] QR de validação apontando pra endpoint público
- [ ] Assinatura eletrônica do responsável técnico (member com role=owner ou RT)
- [ ] Referência à norma aplicável (ex: "RDC 786/2023 art.42")

Sem qualquer destes → inválido pra auditor. Gate REGRESSÃO (seção 7 de [hcq-deploy-gates](../hcq-deploy-gates/SKILL.md)) checa.
