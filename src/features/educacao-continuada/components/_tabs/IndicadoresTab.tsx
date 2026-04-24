import { useMemo, useState } from 'react';

import { Timestamp } from '../../../../shared/services/firebase';
import { useTreinamentos } from '../../hooks/useTreinamentos';
import type { RelatorioFR027 } from '../../services/ecExportService';

import { ECIndicadores } from '../ECIndicadores';
import { ECRelatorioPrint } from '../ECRelatorioPrint';

export function IndicadoresTab() {
  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState<number>(currentYear);
  const [relatorio, setRelatorio] = useState<RelatorioFR027 | null>(null);

  const { treinamentos } = useTreinamentos({ somenteAtivos: true });

  const anos = useMemo<number[]>(() => {
    // Últimos 3 anos + corrente. Prazo de guarda RDC é 5 anos — expandir se
    // auditoria exigir faixa maior.
    return [currentYear - 2, currentYear - 1, currentYear];
  }, [currentYear]);

  const handleEmitirFR027 = (): void => {
    const periodoInicio = Timestamp.fromDate(new Date(ano, 0, 1));
    const periodoFim = Timestamp.fromDate(new Date(ano, 11, 31, 23, 59, 59));
    setRelatorio({
      tipo: 'FR-027',
      treinamentos,
      periodoInicio,
      periodoFim,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold text-slate-100">Indicadores e relatórios</h2>
          <p className="text-sm text-slate-400">
            Painel consolidado e emissão dos formulários regulatórios em PDF.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            Ano
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              aria-label="Ano do painel"
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleEmitirFR027}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Emitir FR-027 ({ano})
          </button>
        </div>
      </header>

      <ECIndicadores ano={ano} />

      {relatorio && (
        <ECRelatorioPrint payload={relatorio} onClose={() => setRelatorio(null)} />
      )}
    </div>
  );
}
