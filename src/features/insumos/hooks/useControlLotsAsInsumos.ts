/**
 * Adapta `ControlLot[]` (store, alimentado por `/lots`) para `InsumoControle[]`
 * sem fetch adicional. Caller deve excluir lotes já presentes em `/insumos`
 * via `excludeLotes` — este hook só complementa o que vive só em `/lots`.
 */

import { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAppStore } from '../../../store/useAppStore';
import { bulaLevelToNivel } from '../utils/controlLotAdapter';
import type { InsumoControle, InsumoModulo } from '../types/Insumo';

interface Options {
  modulo?: InsumoModulo;
  /** Lotes já presentes em `/insumos` — evita duplicar na lista combinada. */
  excludeLotes?: ReadonlySet<string>;
}

export function useControlLotsAsInsumos(opts: Options = {}): InsumoControle[] {
  const lots = useAppStore((s) => s.lots);
  const modulo = opts.modulo ?? 'hematologia';

  return useMemo(() => {
    const out: InsumoControle[] = [];
    for (const lot of lots) {
      if (opts.excludeLotes?.has(lot.lotNumber)) continue;

      // Status derivado da validade — ControlLot não tem `status` próprio.
      // Vencido vira 'vencido' pra UI bloquear; restante 'ativo' (não temos
      // sinal de fechado/lacrado na entidade legada).
      const isExpired = lot.expiryDate.getTime() < Date.now();
      const status: InsumoControle['status'] = isExpired ? 'vencido' : 'ativo';

      out.push({
        id: lot.id,
        labId: lot.labId,
        tipo: 'controle',
        nivel: bulaLevelToNivel(lot.level),
        modulo,
        modulos: [modulo],
        fabricante: 'Controllab',
        nomeComercial: lot.controlName,
        lote: lot.lotNumber,
        validade: Timestamp.fromDate(lot.expiryDate),
        dataAbertura: null,
        diasEstabilidadeAbertura: 0,
        validadeReal: Timestamp.fromDate(lot.expiryDate),
        status,
        createdAt: Timestamp.fromDate(lot.createdAt),
        createdBy: lot.createdBy,
        stats: lot.manufacturerStats ?? undefined,
        bulaLevel: lot.level,
        controlProgramName: lot.controlName,
        startDate: Timestamp.fromDate(lot.startDate),
        equipmentName: lot.equipmentName,
        serialNumber: lot.serialNumber,
        requiredAnalytes: lot.requiredAnalytes,
        runCount: lot.runCount,
      });
    }

    return out;
  }, [lots, modulo, opts.excludeLotes]);
}
