# Design Spec: Dupla Checagem Opcional no VHS com Interface Progressiva

**Data:** 2026-06-03  
**Status:** Aprovado (CTO/Goal Mode)  
**Autor:** Antigravity AI  

---

## 1. Contexto e Motivação
A funcionalidade de dupla checagem consiste na validação de 1ª e 2ª hora para amostra marcadora de VHS (Controle de Qualidade / CIQ). Atualmente, o módulo de VHS opera com leitura padrão de 1ª hora (com a possibilidade de uma 2ª leitura por um segundo operador para verificação de tolerância). 

Para amostras marcadoras de controle, o protocolo exige leituras de 1ª e 2ª hora tanto para a **Leitura Inicial** quanto para a **Validação** (dupla checagem), totalizando 4 leituras simultâneas.

Este design adiciona essa funcionalidade de maneira opcional e progressiva no formulário `VHSExamForm.tsx`, mantendo a interface padrão limpa e enxuta, e persistindo os dados de forma limpa no Firestore.

---

## 2. Arquitetura e Modelagem de Dados

### 2.1 Extensões no Schema do Firestore (`src/features/vhs/types/VHSExam.ts`)
Estenderemos as interfaces `VHSExam` e `VHSExamInput` com os seguintes campos:
- `isValidationActive`: boolean simples no documento do exame indicando se a dupla checagem foi ativada.
- `validacaoLeitura1`: `VHSLeitura | null` representando a leitura de Validação da 1ª Hora.
- `validacaoLeitura2`: `VHSLeitura | null` representando a leitura de Validação da 2ª Hora.

```typescript
export interface VHSExam {
  // ... campos existentes
  isValidationActive?: boolean;
  validacaoLeitura1?: VHSLeitura | null;
  validacaoLeitura2?: VHSLeitura | null;
}

export interface VHSExamInput {
  // ... campos existentes
  isValidationActive?: boolean;
  validacaoLeitura1?: VHSLeituraInput | null;
  validacaoLeitura2?: VHSLeituraInput | null;
}
```

### 2.2 Payload Limpo para o Firestore (`src/features/vhs/services/vhsService.ts`)
Se `isValidationActive` for `false` ou omitido:
- Não incluímos os campos `validacaoLeitura1` e `validacaoLeitura2` no payload (ou enviamos explicitamente como `null`), economizando espaço no banco.
- Se `isValidationActive` for `true`, as assinaturas criptográficas SHA-256 serão geradas para todas as 4 leituras no hook `useVHSSave` e persistidas no Firestore.

---

## 3. Interface de Usuário (UI Progressiva)

### 3.1 Estado do Formulário
No `VHSExamForm.tsx`, adicionamos o estado booleano:
```typescript
const [isValidationActive, setIsValidationActive] = useState(false);
```

### 3.2 Gatilho Discreto
Adicionamos um pequeno botão ou ícone de checagem ao lado do título da seção de leituras ou dos campos tradicionais do VHS. 
- Quando inativo, exibe um ícone sutil cinza.
- Quando ativo, destaca-se com a cor da marca (ex: `text-rose-500` / `bg-rose-500/10`) e com uma mensagem/tooltip explicativa ("Dupla Checagem Ativa").
- Clicar nesse botão alterna `isValidationActive`.

### 3.3 Renderização Condicional
* Quando `isValidationActive` for `true`:
  1. A `Leitura 2` (Leitura Inicial 2ª Hora) é exibida e exigida automaticamente. O botão de remover/adicionar leitura 2 tradicional fica oculto para evitar conflitos de estado.
  2. Renderiza uma nova seção `Validação (Dupla Checagem)` contendo os campos de `Validação 1ª Hora` e `Validação 2ª Hora` (com seu respectivo responsável e data/hora da validação).
* Quando `isValidationActive` for `false`:
  * Estes elementos de validação não existem no DOM (`isValidationActive && (...)`). A interface permanece idêntica à atual.

---

## 4. Validação de Envio (onSubmit)

### 4.1 Regras de Validação no `handleSubmit`
* **Se `isValidationActive` for `false`**:
  * Ignora os campos de validação.
  * O formulário exige o preenchimento de `Leitura 1` (Leitura Inicial 1ª Hora) e, se o toggle tradicional `showL2` estiver ativo, de `Leitura 2` (Leitura Inicial 2ª Hora).
* **Se `isValidationActive` for `true`**:
  * Exige o preenchimento de **todas as 4 leituras**:
    1. Leitura Inicial 1ª Hora (`l1Valor`)
    2. Leitura Inicial 2ª Hora (`l2Valor`)
    3. Validação 1ª Hora (`val1Valor`)
    4. Validação 2ª Hora (`val2Valor`)
  * Também exige os respectivos campos de responsável e data/hora de leitura para cada bloco.

---

## 5. Plano de Testes e Validação
1. **Verificação de Compilação:** Executar `npm run typecheck` para garantir conformidade do TypeScript com a extensão do schema.
2. **Testes Unitários:** Ajustar `src/features/vhs/__tests__/vhsService.test.ts` para testar a persistência do exame com dupla checagem ativa e inativa.
3. **Verificação Manual:** Validar se a interface não apresenta vazamento de campos quando inativa e se exige todos os 4 campos quando ativa.
