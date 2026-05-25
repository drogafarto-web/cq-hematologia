# M001: Coagulação — Correção do Modelo de Corrida

**Vision:** Cada corrida de coagulação = 1 nível + 1 lote de controle. Analitos exibidos dinamicamente por equipamento + insumos configurados. Fim do fibrinogênio fantasma no Clotimer Duorrida é 1 nível. Fim do TTPA sem insumo.

**Success Criteria:**
- Form de nova corrida exige nível antes de mostrar resultados
- Lotes de controle filtrados por nível selecionado
- Apenas analitos suportados pelo equipamento + com insumo configurado são exibidos
- Fibrinogênio não aparece no Clotimer Duo (a menos que outro equipamento)
- TTPA não aparece se não há insumo de TTPA no setup
- Schema Zod valida resultados dinamicamente (não mais shape fixo de 3 analitos)
- Runs existentes continuam legíveis sem migração

**Slices:**
1. S01 — `EQUIP_ANALYTES` + schema dinâmico
2. S02 — Form: nível obrigatório + filtro de lotes por nível
3. S03 — Renderização condicional de analitos por equipamento + setup
4. S04 — Smoke test E2E