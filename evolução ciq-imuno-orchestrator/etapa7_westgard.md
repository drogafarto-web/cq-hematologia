# ETAPA 7/8: WESTGARD CATEGÓRICO — REGRAS DE DECISÃO (25min)

## Objetivo
Implementar o sistema de alertas de controle de qualidade para dados categóricos (R/NR). Ao contrário do hematologia (quantitativo), o CIQ-Imuno foca em taxas de falha e tendências de reatividade.

## Implementation Hook
Arquivo: `src/features/ciq-imuno/hooks/useCIQWestgard.ts`

Este hook é **independente** do `westgardRules.ts` para evitar conflitos de lógica quantitativa vs categórica.

```ts
import { useMemo } from 'react';
import type { CIQImunoRun } from '../types/CIQImuno';
import type { WestgardCatAlert } from '../types/_shared_refs';

export function useCIQWestgard(runs: CIQImunoRun[]) {
  return useMemo(() => {
    const alerts: WestgardCatAlert[] = [];
    const total = runs.length;
    if (total === 0) return { alerts, lotStatus: 'sem_dados' as const };

    // ORDEM CRONOLÓGICA DESCENDENTE (mais recentes primeiro)
    const recentes = [...runs].sort((a, b) => 
      new Date(b.dataRealizacao).getTime() - new Date(a.dataRealizacao).getTime()
    );

    // Regra 1: Taxa de falha (NR) > 10% no lote
    const countNR = runs.filter(r => r.resultadoObtido === 'NR').length;
    if (total >= 10 && (countNR / total) > 0.10) {
      alerts.push('taxa_falha_10pct');
    }

    // Regra 2: 3 Resultados "Não Reagentes" (NR) Consecutivos
    let consecutivosNR = 0;
    for (const r of recentes) {
      if (r.resultadoObtido === 'NR') {
        consecutivosNR++;
        if (consecutivosNR >= 3) {
          alerts.push('consecutivos_3nr');
          break;
        }
      } else {
        consecutivosNR = 0;
      }
    }

    // Regra 3: 4+ NR nos últimos 10 runs
    const ultimos10 = recentes.slice(0, 10);
    const nr10 = ultimos10.filter(r => r.resultadoObtido === 'NR').length;
    if (nr10 >= 4) alerts.push('consecutivos_4nr');

    // Regra 4: Alerta de Validade do Lote (Próximo de Vencer)
    const ultimo = recentes[0];
    if (ultimo) {
      const expira = new Date(ultimo.validadeControle);
      const hoje = new Date();
      const diffDias = (expira.getTime() - hoje.getTime()) / (1000 * 3600 * 24);
      if (diffDias < 0) alerts.push('lote_expirado');
      else if (diffDias < 30) alerts.push('validade_30d');
    }

    // Determinação do Status do Lote
    // lote_expirado também é reprovado — invalida o CIQ por completo (RDC 978 Art.128)
    const lotStatus = alerts.length === 0 ? 'valido' :
                      alerts.some(a => a === 'taxa_falha_10pct' || a === 'lote_expirado')
                        ? 'reprovado' : 'atencao';

    return { alerts, lotStatus };
  }, [runs]);
}
```

## Critérios de Aceite
- [ ] Hook `useCIQWestgard` processa apenas dados categóricos (R/NR).
- [ ] Detecção de 3 NR consecutivos ativa alerta.
- [ ] Status do lote muda para `reprovado` em caso de falha sistêmica (>10%).