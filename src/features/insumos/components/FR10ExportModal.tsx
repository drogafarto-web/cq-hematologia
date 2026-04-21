/**
 * FR10ExportModal — escolhe período + módulo + nome do equipamento, agrega
 * dados via fr10ExportService e abre o preview imprimível FR10Print.
 *
 * Default de período: mês corrente. Mudança via inputs date.
 *
 * Por que pedir equipamento como texto livre: o modelo atual de Insumo usa
 * `modulo` (hematologia/coagulacao/...), não `equipamento` como entidade
 * separada. Quando houver coleção `equipments/{id}` dedicada (roadmap futuro),
 * vira dropdown populado. Enquanto isso, usuário digita — ex: "Yumizen H550".
 */

import React, { useState } from 'react';
import { useActiveLab, useUser } from '../../../store/useAuthStore';
import { buildFR10Payload, computeFR10Hash } from '../services/fr10ExportService';
import { FR10Print } from './FR10Print';
import type { FR10Payload } from '../services/fr10ExportService';
import type { InsumoModulo } from '../types/Insumo';

interface FR10ExportModalProps {
  onClose: () => void;
}

const MODULOS: { value: InsumoModulo; label: string; equipamentoPadrao: string }[] = [
  { value: 'hematologia', label: 'Hematologia', equipamentoPadrao: 'Yumizen H550' },
  { value: 'coagulacao', label: 'Coagulação', equipamentoPadrao: 'Clot Duo' },
  { value: 'uroanalise', label: 'Uroanálise', equipamentoPadrao: 'Uri Color' },
  { value: 'imunologia', label: 'Imunologia', equipamentoPadrao: '—' },
];

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const LABEL = 'block text-[11px] font-medium text-slate-600 dark:text-white/60 mb-1.5';
const INPUT = `
  w-full px-3 h-10 rounded-xl bg-slate-50 dark:bg-white/[0.06]
  border border-slate-200 dark:border-white/[0.09]
  text-sm text-slate-900 dark:text-white/85
  focus:outline-none focus:border-violet-500/50
  transition-all
`.trim();

export function FR10ExportModal({ onClose }: FR10ExportModalProps) {
  const activeLab = useActiveLab();
  const user = useUser();

  const [modulo, setModulo] = useState<InsumoModulo>('hematologia');
  const [equipamento, setEquipamento] = useState<string>(
    MODULOS.find((m) => m.value === 'hematologia')?.equipamentoPadrao ?? '',
  );
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());

  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ payload: FR10Payload; hash: string } | null>(null);

  function handleModuloChange(next: InsumoModulo) {
    setModulo(next);
    const defaultEq = MODULOS.find((m) => m.value === next)?.equipamentoPadrao ?? '';
    setEquipamento(defaultEq);
  }

  async function handleGenerate() {
    if (!activeLab || !user) return;

    setError(null);
    setIsBuilding(true);
    try {
      const periodoInicio = new Date(`${dateFrom}T00:00:00`);
      const periodoFim = new Date(`${dateTo}T23:59:59.999`);

      if (periodoFim < periodoInicio) {
        setError('Data final deve ser posterior à inicial.');
        return;
      }

      const payload = await buildFR10Payload({
        labId: activeLab.id,
        labName: activeLab.name,
        labCnpj: activeLab.cnpj,
        equipamento: equipamento.trim(),
        modulo,
        periodoInicio,
        periodoFim,
        generatedBy: {
          uid: user.uid,
          displayName: user.displayName ?? user.email ?? 'Operador',
        },
      });

      const hash = await computeFR10Hash(payload);
      setPreview({ payload, hash });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar FR-10.');
    } finally {
      setIsBuilding(false);
    }
  }

  if (preview) {
    return <FR10Print payload={preview.payload} hash={preview.hash} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-[6px]">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#141414] border border-slate-200 dark:border-white/[0.09] shadow-2xl">
        <header className="px-6 py-5 border-b border-slate-100 dark:border-white/[0.07] flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-white/30">
              Formulário compliance
            </p>
            <h2 className="text-base font-semibold text-slate-800 dark:text-white/90 mt-0.5">
              Exportar FR-10
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-white/40 mt-1 leading-snug">
              Rastreabilidade de Insumos · Ver.00. Um PDF por equipamento por período.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-slate-400 dark:text-white/30 hover:text-slate-600 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-all"
          >
            ✕
          </button>
        </header>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="fr10-modulo" className={LABEL}>
              Módulo
            </label>
            <select
              id="fr10-modulo"
              value={modulo}
              onChange={(e) => handleModuloChange(e.target.value as InsumoModulo)}
              className={INPUT}
            >
              {MODULOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="fr10-equipamento" className={LABEL}>
              Equipamento
            </label>
            <input
              id="fr10-equipamento"
              type="text"
              value={equipamento}
              onChange={(e) => setEquipamento(e.target.value)}
              placeholder="ex: Yumizen H550"
              className={INPUT}
            />
            <p className="text-[10px] text-slate-400 dark:text-white/30 mt-1">
              Nome livre que vai no cabeçalho do FR-10.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fr10-from" className={LABEL}>
                Período inicial
              </label>
              <input
                id="fr10-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="fr10-to" className={LABEL}>
                Período final
              </label>
              <input
                id="fr10-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-[12px] text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-slate-100 dark:border-white/[0.07] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg text-xs font-medium text-slate-500 dark:text-white/55 hover:text-slate-800 dark:hover:text-white/85 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isBuilding || !equipamento.trim() || !activeLab}
            className="h-9 px-5 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isBuilding ? 'Gerando…' : 'Gerar preview'}
          </button>
        </footer>
      </div>
    </div>
  );
}
