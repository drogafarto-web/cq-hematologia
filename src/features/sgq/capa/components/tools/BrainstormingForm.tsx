/**
 * BrainstormingForm — Sessão estruturada de geração de ideias
 *
 * Registra participantes, ideias geradas, agrupamento por 6M e seleção.
 * Precede Ishikawa — alimenta as causas por categoria.
 */

import React, { useState } from 'react';
import {
  ISHIKAWA_CATEGORIAS,
  type IshikawaCategoria,
  type BrainstormingData,
} from '../../types/qualityTools';

interface Props {
  initialData?: BrainstormingData;
  onSave: (data: BrainstormingData) => void;
  onCancel: () => void;
  saving?: boolean;
}

const INPUT_CLS =
  'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-violet-500 focus:border-transparent';
const CATEGORIAS = Object.keys(ISHIKAWA_CATEGORIAS) as IshikawaCategoria[];

export function BrainstormingForm({ initialData, onSave, onCancel, saving }: Props) {
  const [tema, setTema] = useState(initialData?.tema ?? '');
  const [participantes, setParticipantes] = useState(
    initialData?.participantes?.length ? initialData.participantes : [{ nome: '', funcao: '' }],
  );
  const [dataHora, setDataHora] = useState(initialData?.dataHora ?? '');
  const [novaIdeia, setNovaIdeia] = useState('');
  const [ideias, setIdeias] = useState<string[]>(initialData?.ideias ?? []);
  const [selecionadas, setSelecionadas] = useState<string[]>(initialData?.selecionadas ?? []);

  function addParticipante() {
    setParticipantes([...participantes, { nome: '', funcao: '' }]);
  }

  function updateParticipante(idx: number, field: 'nome' | 'funcao', value: string) {
    const updated = [...participantes];
    updated[idx] = { ...updated[idx], [field]: value };
    setParticipantes(updated);
  }

  function removeParticipante(idx: number) {
    if (participantes.length <= 1) return;
    setParticipantes(participantes.filter((_, i) => i !== idx));
  }

  function addIdeia() {
    if (!novaIdeia.trim()) return;
    setIdeias([...ideias, novaIdeia.trim()]);
    setNovaIdeia('');
  }

  function removeIdeia(idx: number) {
    const ideia = ideias[idx];
    setIdeias(ideias.filter((_, i) => i !== idx));
    setSelecionadas(selecionadas.filter((s) => s !== ideia));
  }

  function toggleSelecionada(ideia: string) {
    setSelecionadas(
      selecionadas.includes(ideia)
        ? selecionadas.filter((s) => s !== ideia)
        : [...selecionadas, ideia],
    );
  }

  const isValid =
    tema.trim().length >= 5 && ideias.length >= 1 && participantes.some((p) => p.nome.trim());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSave({
      tipo: 'brainstorming',
      tema: tema.trim(),
      participantes: participantes.filter((p) => p.nome.trim()),
      dataHora: dataHora || new Date().toISOString(),
      ideias,
      agrupamento: CATEGORIAS.reduce(
        (acc, cat) => ({ ...acc, [cat]: [] }),
        {} as Record<IshikawaCategoria, string[]>,
      ),
      selecionadas,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-white/10">
        <span className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm">
          💡
        </span>
        <h3 className="text-lg font-semibold text-white">Brainstorming Estruturado</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/90">
            Tema / NC <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="Problema a ser investigado"
            className={INPUT_CLS}
            disabled={saving}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/90">Data/hora da sessão</label>
          <input
            type="datetime-local"
            value={dataHora}
            onChange={(e) => setDataHora(e.target.value)}
            className={INPUT_CLS}
            disabled={saving}
          />
        </div>
      </div>

      {/* Participantes */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/90">
          Participantes <span className="text-red-400">*</span>
        </label>
        {participantes.map((p, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={p.nome}
              onChange={(e) => updateParticipante(idx, 'nome', e.target.value)}
              placeholder="Nome"
              className={`${INPUT_CLS} flex-1`}
              disabled={saving}
            />
            <input
              type="text"
              value={p.funcao}
              onChange={(e) => updateParticipante(idx, 'funcao', e.target.value)}
              placeholder="Função"
              className={`${INPUT_CLS} w-32`}
              disabled={saving}
            />
            {participantes.length > 1 && (
              <button
                type="button"
                onClick={() => removeParticipante(idx)}
                className="text-red-400/60 hover:text-red-400 text-xs px-1"
                disabled={saving}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addParticipante}
          className="text-xs text-violet-400 hover:text-violet-300"
          disabled={saving}
        >
          + participante
        </button>
      </div>

      {/* Ideias */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-white/90">
          Ideias geradas <span className="text-red-400">*</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={novaIdeia}
            onChange={(e) => setNovaIdeia(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addIdeia();
              }
            }}
            placeholder="Digite uma ideia e pressione Enter..."
            className={`${INPUT_CLS} flex-1`}
            disabled={saving}
          />
          <button
            type="button"
            onClick={addIdeia}
            className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs rounded-lg"
            disabled={saving || !novaIdeia.trim()}
          >
            +
          </button>
        </div>
        {ideias.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {ideias.map((ideia, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]"
              >
                <input
                  type="checkbox"
                  checked={selecionadas.includes(ideia)}
                  onChange={() => toggleSelecionada(ideia)}
                  className="rounded border-white/20"
                  disabled={saving}
                />
                <span
                  className={`flex-1 text-xs ${selecionadas.includes(ideia) ? 'text-violet-300' : 'text-white/70'}`}
                >
                  {ideia}
                </span>
                <button
                  type="button"
                  onClick={() => removeIdeia(idx)}
                  className="text-red-400/40 hover:text-red-400 text-xs"
                  disabled={saving}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {selecionadas.length > 0 && (
          <p className="text-[10px] text-emerald-400">
            {selecionadas.length} ideia(s) selecionada(s) para investigação
          </p>
        )}
      </div>

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
          {saving ? 'Salvando...' : 'Salvar sessão'}
        </button>
      </div>
    </form>
  );
}
