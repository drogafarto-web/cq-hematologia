# Plano de Ação: BulaProcessor Inteligente (Multi-Lote & Fallback)

Para transformar a extração de bulas atual na lógica avançada descrita (gerando 3 lotes simultâneos e inteligência de fallback com Pentra), precisaremos fazer uma **refatoração orientada a dados** em quatro frentes principais do sistema.

Entregue este plano para o seu agente desenvolvedor (Claude Code) executar passo a passo.

## Fase 1: Atualizar os Tipos de Domínio (`src/types/index.ts`)

Precisamos expandir a memória da aplicação para suportar três níveis simultaneamente e marcar a origem dos dados (fallback).

1. Modificar a interface `PendingBulaData`:

   ```typescript
   export interface BulaLevelData {
     level: 1 | 2 | 3;
     lotNumber: string | null;
     manufacturerStats: ManufacturerStats;
     // Mapeamento opcional: Indica de qual equipamento cada analito foi extraído
     // ex: { "WBC": "Yumizen H550", "RBC": "Pentra 60" }
     equipmentSources?: Record<string, string>;
   }

   export interface PendingBulaData {
     controlName: string | null;
     expiryDate: Date | null;
     levels: BulaLevelData[]; // Agora guarda a extração dos 3 níveis de uma vez
     warnings: string[];
   }
   ```

2. Exportar um mapa de sinônimos (`SYNONYM_MAP`) explícito internamente no `index.ts` das functions (para o AI usar de guia) ou `constants.ts`.

## Fase 2: Evoluir a Cloud Function (`functions/src/index.ts`)

A IA (Gemini 1.5 Flash) precisa saber como "pescar" a tabela cruzada (vários níveis ao mesmo tempo) e relatar os limites e equipamentos.

1. **Alterar o `BULA_PROMPT`:**
   - Instruir o Gemini a procurar ativamente por _três_ números de lote (Nível 1, Baixo; Nível 2, Normal; Nível 3, Alto).
   - Instruir a preferir equipamentos `Yumizen H550` (ou `Horiba ABX`).
   - Se os valores de `Yumizen H550` estiverem ausentes para certos analitos, orientar explicitamente a IA a usar a coluna de `Pentra ES 60` ou `Pentra 60` como _fallback_.
   - Solicitar que a IA devolva limites inferiores e superiores (opcionais, mas capturados pelo Regex/JSON schema).
   - Solicitar a devolução do equipamento exato encontrado _por analito_ no JSON.
2. **Atualizar os Schemas do Zod (`BulaResponseSchema`):**
   - Validar um array de níveis em vez de propriedades singulares de Média e Desvio Padrão.
   - Adicionar o suporte para capturar a `equipmentSource`.

## Fase 3: Reformular a Tabela de Revisão (`src/features/bulaparser/BulaProcessor.tsx`)

A interface deve ser capaz de mostrar a "impressão digital" dos três níveis e o alerta de Fallback.

1. Renderizar Abas ou múltiplas Colunas para exibir os Níveis 1, 2 e 3 na tela de revisão (onde a pessoa checa se a IA acertou antes de confirmar).
2. Adicionar Lógica Condicional de Cores:
   - Checar o dicionário / chave `equipmentSource`. Se o analito extraído for proveniente de "Pentra" ou de um fallback (e não do principal "Yumizen"), injetar classes de alerta Tailwind na célula: `bg-yellow-500/10 text-yellow-500`.
   - Incluir uma Tooltip alertando: _"Detectado no equipamento de mapa de fallback compatível (Pentra)"_.

## Fase 4: Refatorar o Flow de Injeção Automática

A promessa de "criar 3 lotes automaticamente" significa que o botão final de conclusão da Bula tem que automatizar a gravação de banco de dados para os 3 documentos (Lots).

1. Mudar o fluxo do `AddLotModal` e `BulaProcessor`:
   - A entrada de "Data inicial do Uso do Lote" agora serve para inicializar a criação em lote (Batch Creation).
   - Executar um `Promise.all()` iterando sobre o array `levels` extraído para disparar os saves (`setDoc`) ou chamadas locais à Action do Zustand, criando os três lotes de forma síncrona.
   - Opcional: Se já existirem lotes com o mesmo ID para o maquinário, prevenir duplicadas.
