/**
 * FiveW2HForm — Plano de Ação 5W2H
 *
 * What, Why, Where, When, Who, How, How much
 * Usado APÓS identificar causa raiz para estruturar ações corretivas.
 * DICQ 4.10.2 — planejamento de ação corretiva
 */

import React, { useState } from 'react';
import type { Acao5W2H, FiveW2HData } from '../../types/qualityTools';

interface Props {
  initialData?: FiveW2HData;
  onSave: (data: FiveW2HData) => void;
  onCancel: () => void;
  saving?: boolean;
}

const INPUT_CLS =
  'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-violet-500 focus:border-transparent';

const EMPTY_ACAO: Acao5W2H = {
  what: '',
  why: '',
  where: '',
  when: '',
  who: '',
  how: '',
  howMuch: '',
};

const FIELD_LABELS: { key: keyof Acao5W2H; label: string; placeholder: string }[] = [
  { key: 'what', label: 'O quê? (What)', placeholder: 'Ação a ser executada' },
  { key: 'why', label: 'Por quê? (Why)', placeholder: 'Justificativa / causa raiz que endereça' },
  { key: 'where', label: 'Onde? (Where)', placeholder: 'Setor, processo ou local' },
  { key: 'when', label: 'Quando? (When)', placeholder: 'Prazo (data início e fim)' },
  { key: 'who', label: 'Quem? (Who)', placeholder: 'Responsável pela execução' },
  { key: 'how', label: 'Como? (How)', placeholder: 'Método ou procedimento detalhado' },
  {
    key: 'howMuch',
    label: 'Quanto custa? (How much)',
    placeholder: 'Recursos ou investimento necessário',
  },
];

export function FiveW2HForm({ initialData, onSave, onCancel, saving }: Props) {
  const [acoes, setAcoes] = useState<Acao5W2H[]>(
    initialData?.acoes?.length ? initialData.acoes : [{ ...EMPTY_ACAO }],
  );

  function addAcao() {
    setAcoes([...acoes, { ...EMPTY_ACAO }]);
  }

  function removeAcao(idx: number) {
    if (acoes.length <= 1) return;
    setAcoes(acoes.filter((_, i) => i !== idx));
  }

  function updateAcao(idx: number, field: keyof Acao5W2H, value: string) {
    const updated = [...acoes];
    updated[idx] = { ...updated[idx], [field]: value };
    setAcoes(updated);
  }

  const isValid = acoes.some(
    (a) => a.what.trim().length >= 5 && a.who.trim().length >= 2 && a.when.trim().length >= 2,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      tipo: '5w2h',
      acoes: acoes.filter((a) => a.what.trim()),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-white/10">
        <span className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-400">
          W
        </span>
        <h3 className="text-lg font-semibold text-white">5W2H — Plano de Ação</h3>
      </div>

      {acoes.map((acao, idx) => (
        <div
          key={idx}
          className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-violet-400">Ação {idx + 1}</span>
            {acoes.length > 1 && (
              <button
                type="button"
                onClick={() => removeAcao(idx)}
                className="text-red-400/60 hover:text-red-400 text-xs"
                disabled={saving}
              >
                Remover
              </button>
            )}
          </div>
          {FIELD_LABELS.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs font-medium text-white/60">
                {label}
                {(key === 'what' || key === 'who' || key === 'when') && (
                  <span className="text-red-400 ml-0.5">*</span>
                )}
              </label>
              <input
                type="text"
                value={acao[key]}
                onChange={(e) => updateAcao(idx, key, e.target.value)}
                placeholder={placeholder}
                className={INPUT_CLS}
                disabled={saving}
              />
            </div>
          ))}
        </div>
      ))}

      <button
        type="button"
        onClick={addAcao}
        className="text-xs text-violet-400 hover:text-violet-300"
        disabled={saving}
      >
        + Adicionar outra ação
      </button>

      <div className="flex gap-3 pt-4 border-t border-white/10">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/[0.15] text-white rounded-lg transition-colors"
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!isValid || saving}
          className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar plano'}
        </button>
      </div>
    </form>
  );
}
