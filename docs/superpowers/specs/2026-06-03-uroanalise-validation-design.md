# Design Spec — Uroanálise: Flexibilização de Faixas e Correção de Validação

Data: 2026-06-03

## 1. Problema e Objetivos

No componente de lançamento de corridas de Uroanálise (`UroanaliseFormRedesigned.tsx`), há dois problemas principais de validação:

1. **Bloqueio impeditivo no envio**: Ao clicar em "Salvar e assinar", o formulário aciona o alerta genérico _"Corrija os campos destacados antes de salvar"_ e impede a persistência, mesmo quando o status é 10/10 CONFORME. Isso é causado por validações estritas no Zod (`UroanaliseFormSchema`) sobre campos opcionais que são inicializados ou enviados como strings vazias (`""`) pelo frontend (especificamente `aberturaTiraId`, `aberturaControleId`, `aberturaControle` e `validadeControle`), falhando em regras como `.min(1)` ou regex de data.
2. **Faixas de controle excessivamente rígidas**: O componente redesenhado realiza uma comparação estrita de igualdade (`value === expected`) contra um único valor esperado (ex: `'1+'`), em vez de aceitar as variações permitidas pela bula do lote de controle interno patológico (`URIC 04862025`). De acordo com a bula:
   - **Glicose**: Deve aceitar variações equivalentes a 100-1000 mg/dL (`1+` a `4+`).
   - **Corpos Cetônicos, Bilirrubina, Hemoglobina (Sangue), Leucócitos e Urobilinogênio**: Devem aceitar qualquer valor na faixa de `+` a `++++` (ou `1+` a `4+`) e variações nominais (`Aumentado` ou `Presente`).
   - **Nitrito**: Deve validar como Positivo (`PRESENTE`).
   - **Densidade**: Deve aceitar de `1.015` a `1.030` no nível patológico.
   - **pH**: Deve aceitar de `6.0` a `8.0` no nível patológico.

## 2. Solução Proposta

### 2.1. Ajuste do Schema Zod (`UroanaliseForm.schema.ts`)

Flexibilizar as regras para os campos que podem ser enviados como string vazia (`""`) pelo formulário:

- Adicionar `.or(z.literal(''))` nos campos opcionais ou regex de data que podem ser limpos no formulário.
  - `aberturaTiraId`
  - `aberturaControleId`
  - `aberturaControle`
  - `validadeControle`

### 2.2. Flexibilização de `URO_CRITERIOS` (`UroAnalyteConfig.ts`)

Atualizar a definição de critérios aceitáveis para o nível patológico (`P`) no arquivo de configuração canônico:

- `urobilinogenio`: `['1+', '2+', '3+', '4+', 'AUMENTADO', 'PRESENTE']`
- `glicose`: `['1+', '2+', '3+', '4+', 'AUMENTADO', 'PRESENTE']`
- `cetonas`: `['1+', '2+', '3+', '4+', 'AUMENTADO', 'PRESENTE']`
- `bilirrubina`: `['1+', '2+', '3+', '4+', 'AUMENTADO', 'PRESENTE']`
- `sangue`: `['1+', '2+', '3+', '4+', 'AUMENTADO', 'PRESENTE']`
- `leucocitos`: `['1+', '2+', '3+', '4+', 'AUMENTADO', 'PRESENTE']`
- `nitrito`: `['PRESENTE', 'AUMENTADO', '1+', '2+', '3+', '4+']`

### 2.3. Sincronização do Feedback Visual e Avaliação de Conformidade (`UroanaliseFormRedesigned.tsx`)

1. Importar `validateUroResultado` do validador canônico em `UroanaliseFormRedesigned.tsx`.
2. Substituir a comparação estrita (`value === expected`) na lógica do `rowConformidade` pela chamada a `validateUroResultado(analito, valor, nivel)`. Isso garante que o feedback visual (bolinha verde/vermelha) reflita fielmente as regras de conformidade canônicas.
3. Formatar o texto de valores esperados exibido para o operador na linha do analito para refletir a faixa (ex: `"1+ a 4+"`, `"6.0 – 8.0"`) em vez de um único valor default arbitrário.

### 2.4. Exposição de Erros Silenciosos de Validação

Alterar `handleSave` para imprimir no console detalhadamente os erros de validação do Zod (`parsed.error.format()`) e mostrar um `toast.error` indicando o primeiro campo inválido para que o operador saiba exatamente o que está bloqueando o formulário, caso ocorra alguma inconsistência.

## 3. Critérios de Aceitação (UAT)

1. **Persistência Liberada**: Um formulário de corrida com 10/10 analitos preenchidos e conformes salva e assina com sucesso no Firebase sem exibir o alerta de erro genérico.
2. **Faixas Flexíveis**: Para nível patológico (P), preencher Glicose com `3+` ou Cetona com `2+` deve mostrar o indicador verde (CONFORME) e permitir o envio sem erros.
3. **Exibição dos Limites**: A linha de cada analito deve exibir de forma clara os limites esperados da bula (ex: "esperado: 1+ a 4+" ou "esperado: 6,0–8,0").
4. **Erros Visíveis**: Se houver qualquer falha de validação estrutural no Zod (ex: operador sem cargo selecionado), o erro deve ser logado detalhadamente no console e exibido em toast.
