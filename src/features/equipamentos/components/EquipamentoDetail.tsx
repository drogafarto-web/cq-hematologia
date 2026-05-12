/**
 * EquipamentoDetail — ficha resumida: calibração (badge) + lista de manutenções.
 *
 * Reutiliza `useCalibracaoStatus`, `CalibracaoBadge`, `ManutencaoList` (sem novo listener).
 */

import { useCallback, useState } from 'react';
import { httpsCallable } from 'firebase/functions';

import type { Equipamento } from '../types/Equipamento';
import { useCalibracaoStatus } from '../hooks/useCalibracaoStatus';
import { CalibracaoBadge } from './CalibracaoBadge';
import { ManutencaoList } from './ManutencaoList';
import { functions } from '../../../shared/services/firebase';

const callGenerateEquipamentoReport = httpsCallable<
  { labId: string; equipamentoId: string },
  { url: string }
>(functions, 'generateEquipamentoReport');

export interface EquipamentoDetailProps {
  equipamento: Equipamento;
}

export function EquipamentoDetail({ equipamento }: EquipamentoDetailProps) {
  const proximaCalibracao = equipamento.proximaCalibracao;
  const { calibracaoStatus } = useCalibracaoStatus(proximaCalibracao);
  const showCalibracaoBadge = proximaCalibracao != null;
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportReport = useCallback(async () => {
    setExportError(null);
    setExporting(true);
    try {
      const { data } = await callGenerateEquipamentoReport({
        labId: equipamento.labId,
        equipamentoId: equipamento.id,
      });
      if (data?.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar relatório.';
      setExportError(msg);
    } finally {
      setExporting(false);
    }
  }, [equipamento.id, equipamento.labId]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void handleExportReport()}
          disabled={exporting}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/[0.12] dark:bg-[#141417] dark:text-white/90 dark:hover:bg-white/[0.06]"
        >
          {exporting ? 'Gerando…' : 'Exportar relatório'}
        </button>
      </div>
      {exportError ? (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {exportError}
        </p>
      ) : null}

      {showCalibracaoBadge ? (
        <div
          className="rounded-2xl bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] p-4 flex flex-wrap items-center justify-between gap-3"
          aria-labelledby="equipamento-detail-cal-title"
        >
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest font-semibold text-slate-400 dark:text-white/30">
              Calibração
            </p>
            <p
              id="equipamento-detail-cal-title"
              className="text-sm font-semibold text-slate-900 dark:text-white/90 mt-0.5"
            >
              Próxima{' '}
              <span className="font-normal text-slate-600 dark:text-white/55">
                {proximaCalibracao.toDate().toLocaleDateString('pt-BR')}
              </span>
            </p>
          </div>
          <CalibracaoBadge calibracaoStatus={calibracaoStatus} />
        </div>
      ) : null}

      <ManutencaoList
        labId={equipamento.labId}
        equipamentoId={equipamento.id}
        omitCalibracaoBadge
      />
    </div>
  );
}
