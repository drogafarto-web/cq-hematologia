---
name: hcq-insumo-picker-integrator
description: Integra o InsumoPicker em um form de módulo CIQ existente no hc quality — adiciona campo nullable no schema Zod, componente UI no form, onSelect handler que pré-preenche campos legados sem substituir, gate CQ-pendente (bloqueia uso de controle com CIQ não aprovado), validação de validade/reagente ativo. Use ao extender módulos existentes (coagulacao, uroanalise, ciq-imuno) com rastreabilidade, ou quando um módulo novo gerado pelo hcq-module-generator precisa do Picker plugado.
---

# hcq-insumo-picker-integrator — Integração de rastreabilidade de insumos em forms

> **Versão:** 1.0 · **Última atualização:** 2026-04-20 · **Referências canônicas:** `src/features/insumos/components/InsumoPicker.tsx`, `src/features/coagulacao/components/CoagulacaoForm.tsx`

Esta skill é o workflow para plugar o `InsumoPicker` num form de CIQ. Cada módulo que consome reagentes, controles ou tiras precisa do Picker para fechar o loop de rastreabilidade (RDC 786/2023 art.42, chain hash de movimentações).

Skills relacionadas: [hcq-ciq-module](../hcq-ciq-module/SKILL.md) seção 7 (origem), [hcq-module-generator](../hcq-module-generator/SKILL.md) (gera form com esta integração), [hcq-ciq-audit-trail](../hcq-ciq-audit-trail/SKILL.md) (Picker contribui com `insumoControleId` na assinatura).

---

## 1. Quando usar

Use quando:
- Adicionar rastreabilidade a form CIQ existente (coagulacao, uroanalise, ciq-imuno hoje)
- Form de run em módulo novo precisa plugar Picker após scaffold
- Analyzer (hematologia) vai receber seleção de insumo (pendência conhecida)

**Não use** se:
- Form não consome insumos (analítico puro sobre dados já registrados)
- Form é de cadastro do próprio insumo (nesse caso é `InsumoForm`, não Picker)

---

## 2. Modelo mental

```
  ┌────────────────────┐
  │  InsumoPicker      │ ◄── modulo + tipo (filtra cadastro do lab)
  │  (value, onSelect) │
  └─────────┬──────────┘
            │ onSelect(insumo | null)
            ▼
  ┌─────────────────────────┐
  │  Form state             │
  │  - insumoControleId     │ ◄── novo campo obrigatório (nullable)
  │  - loteControle         │ ◄── legados, pré-preenchidos
  │  - fabricanteControle   │
  │  - validadeControle     │
  │  - aberturaControle     │
  └─────────┬───────────────┘
            │ onSubmit
            ▼
  ┌──────────────────────────────┐
  │  Gate CQ-pendente            │ ◄── bloqueia se insumo.qcValidationRequired && !aprovado
  │  useSave<Modulo>Run          │
  └──────────────────────────────┘
```

**Princípios:**
1. Picker **preenche**, não substitui. Se o usuário já digitou manualmente, seleção sobrescreve mas loga evento (UX: toast informativo).
2. Campo novo único: `insumoControleId: string | null`. Null = entrada manual (backwards compat).
3. Gate CQ-pendente é **no hook de save**, não no Picker. Picker mostra o estado; hook impede persistência.

---

## 3. Passo-a-passo de integração

### 3.1 Atualizar schema Zod

`src/features/<modulo>/components/<Modulo>Form.schema.ts`:

```diff
 export const <Modulo>RunInputSchema = z.object({
   equipamentoId: z.string().min(1),
   loteControle: z.string().min(1),
   fabricanteControle: z.string().min(1),
   validadeControle: firestoreTimestampSchema,
   aberturaControle: firestoreTimestampSchema.optional(),
+  insumoControleId: z.string().nullable().default(null),
+  insumoReagenteIds: z.array(z.string()).default([]),
   // ...
 });
```

Regras:
- `nullable()` (não `optional()`) — null é valor explícito "escolheu entrada manual"; `undefined` seria ambíguo.
- `default(null)` e `default([])` — form não precisa pré-setar.
- Se o módulo usa múltiplos controles (ex: Normal + Patológico em coag), use array: `insumoControleIds: z.array(...).length(2)`.

### 3.2 Adicionar Picker no Form

`src/features/<modulo>/components/<Modulo>Form.tsx`:

```tsx
import { InsumoPicker } from '@/features/insumos/components/InsumoPicker';
import type { Insumo, InsumoControle } from '@/features/insumos/types/Insumo';
import { isControle } from '@/features/insumos/types/Insumo';

// ... dentro do JSX do form:

<fieldset className="border border-slate-200 dark:border-white/[0.1] rounded-lg p-4">
  <legend className="px-2 text-sm font-medium">Controle utilizado</legend>

  <InsumoPicker
    tipo="controle"
    modulo="<modulo>"                               /* 'coagulacao' | 'uroanalise' | 'imuno' | ... */
    value={form.insumoControleId ?? null}
    onSelect={(insumo) => handleControleSelect(insumo)}
    ariaLabel="Selecionar controle cadastrado"
  />

  {/* Campos legados — mantêm funcionando em modo manual */}
  <div className="grid grid-cols-2 gap-3 mt-3">
    <TextField label="Lote" value={form.loteControle} onChange={...} />
    <TextField label="Fabricante" value={form.fabricanteControle} onChange={...} />
    <DateField label="Validade" value={form.validadeControle} onChange={...} />
    <DateField label="Abertura" value={form.aberturaControle} onChange={...} />
  </div>
</fieldset>
```

Se o módulo também consome **reagentes**:

```tsx
<InsumoPickerMulti
  tipo="reagente"
  modulo="<modulo>"
  value={form.insumoReagenteIds}
  onSelect={(insumos) => setField('insumoReagenteIds', insumos.map(i => i.id))}
  ariaLabel="Selecionar reagentes utilizados"
/>
```

### 3.3 onSelect handler

```tsx
function handleControleSelect(insumo: Insumo | null) {
  if (!insumo) {
    setField('insumoControleId', null);
    // NÃO limpa campos legados — usuário pode ter digitado manual
    return;
  }
  if (!isControle(insumo)) {
    console.warn('InsumoPicker retornou tipo inesperado:', insumo.tipo);
    return;
  }

  // Pré-preenche — sobrescrita explícita
  setField('insumoControleId', insumo.id);
  setField('loteControle', insumo.lote);
  setField('fabricanteControle', insumo.fabricante);
  setField('validadeControle', insumo.validade);
  if (insumo.dataAbertura) setField('aberturaControle', insumo.dataAbertura);

  // UX: toast informativo se havia valor manual
  const hadManualInput = form.loteControle || form.fabricanteControle;
  if (hadManualInput) {
    toast.info('Campos preenchidos a partir do insumo selecionado');
  }
}
```

### 3.4 Gate CQ-pendente no hook de save

`src/features/<modulo>/hooks/useSave<Modulo>Run.ts`:

```ts
import { getInsumo } from '@/features/insumos/services/insumosFirebaseService';
import { isControleAprovado } from '@/features/insumos/utils/qcGate';

export function useSave<Modulo>Run(labId: string) {
  return async (input: <Modulo>RunInput): Promise<string> => {
    const parsed = <Modulo>RunInputSchema.parse(input);

    // ┌── GATE CQ-PENDENTE ──┐
    if (parsed.insumoControleId) {
      const insumo = await getInsumo(labId, parsed.insumoControleId);
      if (!insumo) throw new Error('Controle selecionado não existe mais no cadastro');
      if (insumo.qcValidationRequired && !isControleAprovado(insumo)) {
        throw new Error(
          `Controle ${insumo.lote} tem CIQ pendente de aprovação. ` +
          `Aprove o CIQ no módulo ${insumo.modulo} antes de usar em corrida.`
        );
      }
      if (insumo.validade && insumo.validade < new Date()) {
        throw new Error(`Controle ${insumo.lote} está vencido (${insumo.validade.toISOString().slice(0,10)})`);
      }
      if (insumo.status === 'descartado' || insumo.status === 'fechado') {
        throw new Error(`Controle ${insumo.lote} está ${insumo.status}`);
      }
    }
    // └──────────────────────┘

    // ... resto do save (signature, audit, setDoc) — ver hcq-ciq-audit-trail
  };
}
```

Regras:
- Gate é **sempre no server-path (hook)**, nunca só no UI. Bypass via DevTools é trivial.
- Rule Firestore também deve validar (defense-in-depth): `allow create: if ... && resource.data.insumoControleId is string`.
- Mensagens de erro são **acionáveis em pt-BR** — dizem exatamente o que fazer, não "insumo inválido".

---

## 4. `isControleAprovado` — lógica central

Arquivo: `src/features/insumos/utils/qcGate.ts` (criar se não existir):

```ts
import type { InsumoControle } from '../types/Insumo';

/**
 * Controle está "aprovado" quando tem pelo menos 1 run CIQ com status 'in-range' 
 * no módulo correspondente, e nenhuma regra Westgard rejeitou a última run.
 *
 * Como insumo não carrega runs embedded, quem chama deve passar o resultado
 * do último CIQ (computed no hook useControleQCStatus).
 */
export function isControleAprovado(insumo: InsumoControle & { lastQCStatus?: 'approved' | 'pending' | 'rejected' }): boolean {
  if (!insumo.qcValidationRequired) return true; // flag soft: off = sempre aprovado
  return insumo.lastQCStatus === 'approved';
}
```

E o hook `useControleQCStatus(insumoId)` deriva status das últimas N runs no módulo correspondente.

---

## 5. UI de feedback no Picker

O `InsumoPicker` já exibe:
- Badge verde "CQ aprovado" se `lastQCStatus === 'approved'`
- Badge amber "CQ pendente" se pending
- Badge vermelho "CQ rejeitado" se rejected
- Disabled se vencido ou descartado

Se o Picker não suporta essa feature ainda no seu módulo alvo, **estenda o Picker** (isso é feature novo do Picker, não desse módulo — PR separado).

---

## 6. Testes obrigatórios após integração

Adicione em `src/features/<modulo>/__tests__/`:

### 6.1 Teste unit — gate bloqueia CIQ pendente

```ts
describe('useSave<Modulo>Run — gate CIQ', () => {
  it('bloqueia save se controle tem CIQ pendente', async () => {
    mockGetInsumo.mockResolvedValue({
      id: 'c1', lote: 'LOTE-A', qcValidationRequired: true,
      lastQCStatus: 'pending', status: 'aberto', validade: futureDate(),
    });
    const save = useSave<Modulo>Run('lab1');
    await expect(save({ insumoControleId: 'c1', ... })).rejects.toThrow(/CIQ pendente/);
  });

  it('permite save se controle não exige CIQ', async () => {
    mockGetInsumo.mockResolvedValue({
      id: 'c1', qcValidationRequired: false,
      status: 'aberto', validade: futureDate(),
    });
    const save = useSave<Modulo>Run('lab1');
    await expect(save({ insumoControleId: 'c1', ... })).resolves.toBeDefined();
  });
});
```

### 6.2 Teste integration — canonical inclui insumoControleId

```ts
it('logicalSignature muda quando insumoControleId muda', async () => {
  const sigA = await logicalSignature({ insumoControleId: 'a', ...rest });
  const sigB = await logicalSignature({ insumoControleId: 'b', ...rest });
  expect(sigA).not.toBe(sigB);
});
```

### 6.3 Teste UI — seleção pré-preenche

```tsx
it('selecionar controle preenche lote e fabricante', async () => {
  render(<<Modulo>Form ... />);
  await userEvent.click(screen.getByRole('combobox', { name: /controle/i }));
  await userEvent.click(screen.getByText(/LOTE-123/));
  expect(screen.getByLabelText(/lote/i)).toHaveValue('LOTE-123');
});
```

---

## 7. Checklist de integração

- [ ] Schema tem `insumoControleId: z.string().nullable()` (e `insumoReagenteIds` se aplicável)
- [ ] `<InsumoPicker tipo=.. modulo=..>` no form, dentro de `fieldset`
- [ ] `handleControleSelect` pré-preenche campos legados
- [ ] Campos legados (`loteControle` etc.) permanecem editáveis
- [ ] Hook de save valida `qcValidationRequired && lastQCStatus === 'approved'`
- [ ] Hook de save valida validade, status 'aberto'
- [ ] Mensagens de erro em pt-BR acionáveis
- [ ] Rule Firestore valida `insumoControleId is string or null`
- [ ] Canonical payload inclui `insumoControleId` (e reagenteIds)
- [ ] 3+ testes: gate pass, gate fail, signature-varia-com-seleção
- [ ] Smoke manual: selecionar controle vencido → mensagem acionável; selecionar controle CQ-pendente → banner; aprovar CQ → banner some

---

## 8. Anti-patterns

| Anti-pattern | Motivo | Correção |
|---|---|---|
| `insumoControleId: z.string().optional()` | `undefined` vs. `null` ambíguo no Firestore | `.nullable()` com `default(null)` |
| Picker substitui campos legados (remove do UI) | Quebra forms legados de labs que não migraram cadastro | Preenche, não substitui |
| Gate só no UI (`disabled={!approved}`) | Bypass via DevTools | Hook de save rejeita |
| Gate no rule Firestore apenas | Exige fetch do insumo dentro da rule → complexo, lento | Gate no hook + rule valida apenas tipo |
| Mensagem genérica "insumo inválido" | Operador não sabe o que fazer | "Controle LOTE-X vencido em DD/MM/YYYY" |
| Não incluir `insumoControleId` no canonical | Assinatura não rastreia mudança de insumo → audit inválido | Sempre no canonical |
| Pré-preencher em modo read-only | Operador não pode corrigir um bug do cadastro | Campos legados continuam editáveis, Picker é atalho |
| Toast de sucesso ao sobrescrever sem pedir | Operador perde valor digitado sem perceber | Toast informativo é o mínimo; ideal: confirm antes |
| Múltiplos controles sem ordem estável no canonical | Reordenar array muda hash | Sort antes de canonicalizar |
| `getInsumo` sem cache no hook | Cada save refaz fetch | Passar insumo já carregado via context, ou memoizar |

---

## 9. Referências no código

| Padrão | Arquivo |
|---|---|
| InsumoPicker base | `src/features/insumos/components/InsumoPicker.tsx` |
| InsumoPickerMulti | `src/features/insumos/components/InsumoPickerMulti.tsx` |
| Integração de referência (coag) | `src/features/coagulacao/components/CoagulacaoForm.tsx` |
| `isControle` narrowing | `src/features/insumos/types/Insumo.ts` |
| Gate CQ-pendente utility | `src/features/insumos/utils/qcGate.ts` (criar se ausente) |
| `useSaveInsumoMovimentacao` — canonical reference de save com gate | `src/features/insumos/hooks/useSaveInsumoMovimentacao.ts` |

Se algum desses arquivos for renomeado, atualize esta skill.
