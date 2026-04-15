# ETAPA 3/8: FORMULÁRIO FR-036 — ZOD + STATE (25min)

## Objetivo
Implementar o formulário de lançamento de CIQ seguindo o padrão FR-036, utilizando Zod para validação e `useState` nativo para controle de estado (sem bibliotecas de formulário externas).

## Schema de Validação (Zod)
Arquivo: `src/features/ciq-imuno/components/CIQImunoForm.schema.ts`

```ts
import { z } from 'zod';

export const CIQImunoFormSchema = z.object({
  testType:           z.enum(['HCG','BhCG','HIV','HBsAg','Anti-HCV','Sifilis','Dengue','COVID','PCR','Troponina']),
  loteControle:       z.string().min(1, 'Lote do controle é obrigatório'),
  aberturaControle:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  validadeControle:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  loteReagente:       z.string().min(1, 'Lote do reagente é obrigatório'),
  reagenteStatus:     z.enum(['R','NR'], { required_error: 'Status de abertura obrigatório' }),
  aberturaReagente:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validadeReagente:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resultadoEsperado:  z.enum(['R','NR']),
  resultadoObtido:    z.enum(['R','NR']),
  dataRealizacao:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(d => d.dataRealizacao <= d.validadeControle, {
  message: 'Data de realização não pode ser posterior à validade do controle',
  path: ['dataRealizacao']
}).refine(d => d.dataRealizacao <= d.validadeReagente, {
  message: 'Data de realização não pode ser posterior à validade do reagente',
  path: ['dataRealizacao']
});

export type CIQImunoFormData = z.infer<typeof CIQImunoFormSchema>;
```

## Padrão de Implementação do Componente
Utilize o padrão real do projeto (Tailwind 4 + state local):

```tsx
const [form, setForm] = useState<Partial<CIQImunoFormData>>({
  resultadoEsperado: 'R', // default comum
  dataRealizacao: new Date().toISOString().split('T')[0]
});
const [errors, setErrors] = useState<Record<string, string>>({});

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const result = CIQImunoFormSchema.safeParse(form);
  
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    setErrors(Object.fromEntries(
      Object.entries(fieldErrors).map(([k, v]) => [k, v?.[0] ?? ''])
    ));
    return;
  }
  
  onSave(result.data);
};
```

## Critérios de Aceite
- [ ] Validação Zod impede envio se datas de validade expiraram.
- [ ] Estilo segue o design system (Tailwind 4).
- [ ] Nenhum import de `react-hook-form` ou `clsx`.