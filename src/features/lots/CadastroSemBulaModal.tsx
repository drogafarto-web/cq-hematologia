/**
 * CadastroSemBulaModal — cadastro batch dos 3 níveis (NV1/NV2/NV3) sem bula.
 *
 * Cenário operacional: a Controllab manda os controles físicos antes da bula
 * com os valores-alvo. Lag típico ≤7 dias. Sem este caminho, o laboratório
 * teria que parar a rotina ou inventar valores — ambos errados.
 *
 * Cria 3 lotes com `manufacturerStats: null` + `bulaPendente: true`. Quando
 * a bula chegar, `applyBulaToLots` (no useLots) preenche os valores-alvo e
 * recalcula Westgard das runs gravadas no intervalo.
 */

import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { AddLotInput } from './hooks/useLots';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CadastroSemBulaModalProps {
  onAdd: (input: AddLotInput) => Promise<string>;
  onClose: () => void;
}

interface LevelInput {
  level: 1 | 2 | 3;
  lotNumber: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function plus6Months(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CadastroSemBulaModal({ onAdd, onClose }: CadastroSemBulaModalProps) {
  const existingLots = useAppStore((s) => s.lots);

  const [controlName, setControlName] = useState('Controle Interno Hematologia Automação');
  const [equipmentName, setEquipmentName] = useState('Yumizen H550');
  const [serialNumber, setSerialNumber] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [expiryDate, setExpiryDate] = useState(plus6Months(todayISO()));

  const [levels, setLevels] = useState<LevelInput[]>([
    { level: 1, lotNumber: '' },
    { level: 2, lotNumber: '' },
    { level: 3, lotNumber: '' },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(0);

  // Detecta colisão por chave natural (mesmo lote+nível+nome) — espelha o
  // guard hard do `addLot`. Avisa ANTES do submit pra economizar tentativa.
  const collisions = useMemo(() => {
    const out: Array<{ level: 1 | 2 | 3; lotNumber: string }> = [];
    const trimmedName = controlName.trim();
    for (const lvl of levels) {
      const num = lvl.lotNumber.trim();
      if (!num) continue;
      const dup = existingLots.find(
        (l) => l.lotNumber === num && l.level === lvl.level && l.controlName === trimmedName,
      );
      if (dup) out.push({ level: lvl.level, lotNumber: num });
    }
    return out;
  }, [existingLots, levels, controlName]);

  function setLevelLote(level: 1 | 2 | 3, value: string) {
    setLevels((prev) => prev.map((l) => (l.level === level ? { ...l, lotNumber: value } : l)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!controlName.trim()) {
      setError('Nome do controle é obrigatório.');
      return;
    }
    if (!startDate) {
      setError('Data de início é obrigatória.');
      return;
    }
    if (!expiryDate) {
      setError('Data de validade é obrigatória.');
      return;
    }
    if (new Date(`${startDate}T00:00:00`) > new Date(`${expiryDate}T00:00:00`)) {
      setError('Início não pode ser posterior à validade.');
      return;
    }
    for (const lvl of levels) {
      if (!lvl.lotNumber.trim()) {
        setError(`Informe o número do lote NV${lvl.level}.`);
        return;
      }
    }
    if (collisions.length > 0) {
      const list = collisions.map((c) => `NV${c.level} (${c.lotNumber})`).join(', ');
      setError(`Lote(s) já cadastrado(s): ${list}.`);
      return;
    }

    setSubmitting(true);
    try {
      const startD = new Date(`${startDate}T00:00:00`);
      const expiryD = new Date(`${expiryDate}T00:00:00`);
      // Cria os 3 em sequência — falha em um aborta o batch.
      // Sem manufacturerStats: null requiredAnalytes vazio (será preenchido
      // quando a bula chegar via applyBulaToLots).
      let done = 0;
      for (const lvl of levels) {
        const input: AddLotInput = {
          lotNumber: lvl.lotNumber.trim(),
          controlName: controlName.trim(),
          level: lvl.level,
          equipmentName: equipmentName.trim() || 'Yumizen H550',
          serialNumber: serialNumber.trim(),
          startDate: startD,
          expiryDate: expiryD,
          requiredAnalytes: [],
          manufacturerStats: null,
          bulaPendente: true,
        };
        await onAdd(input);
        done += 1;
        setCreated(done);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar lotes.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cadastrar 3 lotes sem bula"
    >
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col bg-white dark:bg-[#0F1116] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-white">
              Cadastrar 3 lotes sem bula
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Para usar quando o sangue chegou e a bula está atrasada (≤7 dias). Westgard fica
              suspenso até a bula chegar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4"
        >
          <div className="rounded-xl bg-amber-50 dark:bg-amber-500/[0.06] border border-amber-200 dark:border-amber-500/25 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200 leading-snug">
            <strong>Lote sem bula</strong> — corridas serão registradas com valores brutos. Regras
            Westgard ficam suspensas até a bula chegar. Quando ela chegar, importe via "Importar
            bula deste lote" e o sistema recalcula tudo retroativamente.
          </div>

          {/* Metadata comum */}
          <div className="space-y-3">
            <div>
              <label
                htmlFor="csb-name"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
              >
                Nome do programa
              </label>
              <input
                id="csb-name"
                type="text"
                value={controlName}
                onChange={(e) => setControlName(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-800 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="csb-equip"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
                >
                  Equipamento
                </label>
                <input
                  id="csb-equip"
                  type="text"
                  value={equipmentName}
                  onChange={(e) => setEquipmentName(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-800 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-all"
                />
              </div>
              <div>
                <label
                  htmlFor="csb-serial"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
                >
                  Nº série
                </label>
                <input
                  id="csb-serial"
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="opcional"
                  className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-all"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="csb-start"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
                >
                  Início de uso
                </label>
                <input
                  id="csb-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-800 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-all"
                />
              </div>
              <div>
                <label
                  htmlFor="csb-exp"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
                >
                  Validade impressa
                </label>
                <input
                  id="csb-exp"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-800 dark:text-white outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Níveis */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Números dos lotes
            </p>
            <div className="space-y-2">
              {levels.map((lvl) => (
                <div key={lvl.level} className="flex items-center gap-2">
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-md ${
                      lvl.level === 1
                        ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                        : lvl.level === 2
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    NV{lvl.level}
                  </span>
                  <input
                    type="text"
                    value={lvl.lotNumber}
                    onChange={(e) => setLevelLote(lvl.level, e.target.value)}
                    placeholder={`Número do lote NV${lvl.level} (ex: HHI-1372)`}
                    autoComplete="off"
                    className="flex-1 h-10 px-3 font-mono text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-lg text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-500 dark:focus:border-blue-500/60 transition-all"
                  />
                </div>
              ))}
            </div>
          </div>

          {collisions.length > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-500/[0.08] border border-amber-300 dark:border-amber-500/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <strong>Lote(s) já cadastrado(s):</strong>{' '}
              {collisions.map((c) => `NV${c.level} (${c.lotNumber})`).join(', ')}
            </div>
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/[0.08] border border-red-200 dark:border-red-500/30 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {submitting && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Criando lote {created} de {levels.length}…
            </p>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/[0.06] flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 h-10 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting || collisions.length > 0}
            className="px-5 h-10 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-sm shadow-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? `Criando ${created}/3…` : 'Cadastrar 3 lotes'}
          </button>
        </div>
      </div>
    </div>
  );
}
