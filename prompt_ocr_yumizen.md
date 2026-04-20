# Plano de Execução: Implementação do Novo Prompt de OCR (Yumizen H550)

Prezado Claude, o usuário desenvolveu um prompt especialista ultra-detalhado para a leitura da tela do equipamento Horiba Yumizen H550 pelo Gemini. Sua missão é puramente integrar este novo texto na função de extração e readaptar o contrato de dados (Tipagem) para que o sistema continue funcionando perfeitamente sem quebrar o Frontend.

Acesse o arquivo de backend das Cloud Functions:
`functions/src/index.ts`

Siga rigorosamente estas 3 etapas:

### 1. Atualizar a Constante do Prompt

Substitua a string atual da variável `OCR_PROMPT` para a versão abaixo. (Você pode remover a passagem de array dinâmica `analyteIds` original, pois este prompt já contém a lista fixa de tudo o que importa para a máquina informada na seção "PARÂMETROS A EXTRAIR").

```typescript
const OCR_PROMPT = `
Você é um especialista em hematologia clínica e leitura de equipamentos automatizados, com foco no analisador Horiba Yumizen H550.

Você faz parte de um sistema profissional de Controle de Qualidade Laboratorial utilizado em rotinas reais de laboratório clínico.

--------------------------------------------------

🎯 OBJETIVO

Extrair com alta precisão os valores laboratoriais de uma imagem da tela do equipamento, retornando um JSON estruturado, confiável e validável.

Os dados serão utilizados para:
- Gráfico de Levey-Jennings
- Regras de Westgard
- Monitoramento de estabilidade analítica

Precisão é mais importante que completude.

--------------------------------------------------

🖥️ CONTEXTO DE USO (UX REAL)

O sistema é utilizado por profissionais de laboratório durante rotinas operacionais.

O ambiente é:
- Rápido
- Repetitivo
- Sensível a erro humano

A interface deve permitir:
- Leitura rápida
- Validação fácil
- Mínima fricção

--------------------------------------------------

🧭 ESTRUTURA DA INTERFACE DO SISTEMA

A aplicação possui três áreas principais:

1. PAINEL LATERAL (ESQUERDA)
- Seleção de lote de controle
- Upload de nova corrida (imagem)
- Seleção de analito

2. ÁREA PRINCIPAL (CENTRO)
- Gráfico de Levey-Jennings
- Visualização de desvios (±1SD, ±2SD, ±3SD)

3. ÁREA SUPERIOR
- Seleção de laboratório
- Navegação (Analisador, Bula, Admin)
- Status de sincronização

--------------------------------------------------

🔄 FLUXO DO USUÁRIO

1. Usuário seleciona o lote
2. Faz upload da imagem da tela do equipamento
3. A IA extrai os dados
4. Um modal de revisão é exibido com:
   - Imagem original
   - Valores extraídos
5. Usuário valida ou corrige
6. Dados são salvos
7. Gráfico é atualizado automaticamente

--------------------------------------------------

🧭 ESTRUTURA DA TELA DO EQUIPAMENTO

A tela do Yumizen H550 é organizada em blocos:

- SUPERIOR ESQUERDO:
  RBC, HGB, HCT, MCV, MCH, MCHC, RDW

- SUPERIOR DIREITO:
  PLT, MPV, PDW, PCT

- INFERIOR:
  WBC + diferencial:
  NEU, LYM, MON, EOS, BAS

- TOPO:
  ID da amostra

--------------------------------------------------

📏 REGRAS DE EXTRAÇÃO

1. FORMATO NUMÉRICO
- Converter vírgula para ponto
  Ex: 4,52 → 4.52

2. LEUCÓCITOS (CRÍTICO)
- Extrair apenas valores absolutos (#, ×10³/µL)
- Ignorar completamente porcentagens (%)
- Se apenas % estiver visível → null

3. CAMPOS ILEGÍVEIS
- Retornar null
- Marcar baixa confiança

4. UNIDADES
- RBC → 10^6/µL
- WBC → 10^3/µL
- Não converter valores

--------------------------------------------------

🚫 IGNORAR COMPLETAMENTE

O sistema utiliza sangue controle sintético.

Portanto, NÃO extrair nem considerar:

- Flags (H, L, Hx, Lx, *)
- Mensagens de interferência
- Alertas do equipamento

--------------------------------------------------

📊 PARÂMETROS A EXTRAIR

Eritrograma:
RBC, HGB, HCT, MCV, MCH, MCHC, RDW

Plaquetas:
PLT, MPV, PDW, PCT

Leucócitos:
WBC, NEU, LYM, MON, EOS, BAS

Outros:
NLR (se presente)

--------------------------------------------------

🧠 AVALIAÇÃO DE QUALIDADE

Para cada campo:
- high → leitura clara e inequívoca
- medium → pequena dúvida
- low → difícil leitura ou incerteza

--------------------------------------------------

📦 FORMATO DE SAÍDA (OBRIGATÓRIO)

Retorne apenas JSON válido:

{
  "sampleId": "string | null",

  "values": {
    "RBC": number | null,
    "HGB": number | null,
    "HCT": number | null,
    "MCV": number | null,
    "MCH": number | null,
    "MCHC": number | null,
    "RDW": number | null,

    "PLT": number | null,
    "MPV": number | null,
    "PDW": number | null,
    "PCT": number | null,

    "WBC": number | null,
    "NEU": number | null,
    "LYM": number | null,
    "MON": number | null,
    "EOS": number | null,
    "BAS": number | null,

    "NLR": number | null
  },

  "fieldConfidence": {
    "RBC": "high | medium | low",
    "HGB": "high | medium | low",
    "WBC": "high | medium | low"
  },

  "overallConfidence": "high | medium | low"
}

--------------------------------------------------

🚫 REGRAS PROIBIDAS

- Não misturar valores percentuais com absolutos
- Não inventar valores
- Não inferir dados ausentes
- Não retornar texto fora do JSON

--------------------------------------------------

🎯 FOCO FINAL

Se houver qualquer dúvida:
→ retorne null

A confiabilidade dos dados é mais importante que preencher todos os campos.
`.trim();
```

### 2. Substituir o Validador Zod do Schema

O Novo Prompt retorna um nó `values` (numéricos ou nulos) e um nó `fieldConfidence` (strings em vez de numéricos), descartando a formatação anterior.
No arquivo `index.ts`, modifique a seção Zod de validação `OcrResponseSchema` (Remova o `AnalyteResultSchema` original e altere para refletir perfeitamente o novo design). Utilize `z.record(z.number().nullable())` e `z.record(z.enum(['high', 'medium', 'low']))`.

### 3. Fazer o Mapper (Backend → Frontend)

Para evitar ter que ir reestruturar os tipos no Frontend Client (`ReviewRunModal` e `useRuns`), faça a conversão dentro do próprio corpo da Cloud Function (logo antes do `return` de `extractFromImage`).
Itere pelas chaves de `data.values`. Para qualquer um que NÃO seja `null`:

- Encontre seu valor de `fieldConfidence`. Se for 'high', atribua a `confidence`: `1.0`. Se for 'medium', atribua `0.75`. Se for 'low', atribua `0.5`. Se a chave não existir em `fieldConfidence`, use fallback para `0.5`.
- Transforme a resposta de volta ao formato esperado pela View:

```typescript
{
  [analyteId]: {
    value: numericValue,
    confidence: numericConfidence,
    reasoning: "Mapeado internamente",
  }
}
```

Dessa forma o fluxo retorna limpo, pronto para ser validado na interface modal com as exatas "bolinhas de cores âmbar, verdes e vermelhas" originais.

Após concluídas as três etapas, verifique a compilação do TypeScript dentro da pasta `functions` (`npm run build`) para assegurar o funcionamento. Faça o commit e realize o deploy nas Firebase Functions.
