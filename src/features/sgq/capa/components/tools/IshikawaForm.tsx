/**
 * IshikawaForm — Diagrama de Causa e Efeito (6M)
 *
 * Categorias: Mão de obra, Método, Material, Máquina, Meio ambiente, Medição
 * DICQ 4.10.1 — ferramenta principal de análise de causa raiz
 */

import React, { useState } from 'react';
import {
  ISHIKAWA_CATEGORIAS,
  type IshikawaCategoria,
  type IshikawaData,
} from '../../types/qualityTools';

interface Props {
  initialData?: IshikawaData;
  onSave: (data: IshikawaData) => void;
  onCancel: () => void;
  saving?: boolean;
}

const INPUT_CLS =
  'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-violet-500 focus:border-transparent';

const CATEGORIAS = Object.keys(ISHIKAWA_CATEGORIAS) as IshikawaCategoria[];

const CATEGORIA_HINTS: Record<IshikawaCategoria, string> = {
  'mao-de-obra': 'Treinamento, competência, fadiga, comunicação, supervisão',
  metodo: 'POP inadequado, POP não seguido, sequência incorreta, falta de padronização',
  material: 'Reagentes, insumos, calibradores, controles, amostras',
  maquina: 'Manutenção, calibração, falha, obsolescência, software',
  'meio-ambiente': 'Temperatura, umidade, iluminação, contaminação, espaço',
  medicao: 'Instrumento, incerteza, padrão, rastreabilidade metrológica',
};

export function IshikawaForm({ initialData, onSave, onCancel, saving }: Props) {
  const [efeito, setEfeito] = useState(initialData?.efeito ?? '');
  const [causas, setCausas] = useState<Record<IshikawaCategoria, string[]>>(
    initialData?.causas ?? {
      'mao-de-obra': [''],
      metodo: [''],
      material: [''],
      maquina: [''],
      'meio-ambiente': [''],
      medicao: [''],
    },
  );
  const [causaRaizSelecionada, setCausaRaizSelecionada] = useState(
    initialData?.causaRaizSelecionada ?? '',
  );
  const [categoriaCausaRaiz, setCategoriaCausaRaiz] = useState<IshikawaCategoria>(
    initialData?.categoriaCausaRaiz ?? 'metodo',
  );

  function addCausa(cat: IshikawaCategoria) {
    setCausas({ ...causas, [cat]: [...causas[cat], ''] });
  }

  function updateCausa(cat: IshikawaCategoria, idx: number, value: string) {
    const updated = [...causas[cat]];
    updated[idx] = value;
    setCausas({ ...causas, [cat]: updated });
  }

  function removeCausa(cat: IshikawaCategoria, idx: number) {
    if (causas[cat].length <= 1) return;
    setCausas({ ...causas, [cat]: causas[cat].filter((_, i) => i !== idx) });
  }

  const totalCausas = CATEGORIAS.reduce(
    (sum, cat) => sum + causas[cat].filter((c) => c.trim()).length,
    0,
  );
  const isValid =
    efeito.trim().length >= 5 && totalCausas >= 1 && causaRaizSelecionada.trim().length >= 5;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    const cleanCausas = {} as Record<IshikawaCategoria, string[]>;
    for (const cat of CATEGORIAS) {
      cleanCausas[cat] = causas[cat].filter((c) => c.trim());
    }
    onSave({
      tipo: 'ishikawa',
      efeito: efeito.trim(),
      causas: cleanCausas,
      causaRaizSelecionada: causaRaizSelecionada.trim(),
      categoriaCausaRaiz,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-white/10">
        <span className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-400">
          ⟨
        </span>
        <h3 className="text-lg font-semibold text-white">Diagrama de Ishikawa (6M)</h3>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white/90">
          Efeito (NC observada) <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={efeito}
          onChange={(e) => setEfeito(e.target.value)}
          placeholder="Qual é o efeito/problema observado?"
          className={INPUT_CLS}
          disabled={saving}
        />
      </div>

      <div className="space-y-4">
        <label className="text-sm font-medium text-white/90">
          Causas por categoria (6M) <span className="text-red-400">*</span>
        </label>

        {CATEGORIAS.map((cat) => (
          <div
            key={cat}
            className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-violet-400 uppercase tracking-wider">
                {ISHIKAWA_CATEGORIAS[cat]}
              </span>
              <span className="text-[10px] text-white/30">{CATEGORIA_HINTS[cat]}</span>
            </div>
            {causas[cat].map((causa, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={causa}
                  onChange={(e) => updateCausa(cat, idx, e.target.value)}
                  placeholder={`Causa em ${ISHIKAWA_CATEGORIAS[cat]}...`}
                  className={`${INPUT_CLS} flex-1`}
                  disabled={saving}
                />
                {causas[cat].length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCausa(cat, idx)}
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
              onClick={() => addCausa(cat)}
              className="text-[11px] text-violet-400/70 hover:text-violet-400"
              disabled={saving}
            >
              + causa
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
        <label className="text-sm font-medium text-emerald-300">
          Causa raiz selecionada <span className="text-red-400">*</span>
        </label>
        <div className="flex gap-2">
          <select
            value={categoriaCausaRaiz}
            onChange={(e) => setCategoriaCausaRaiz(e.target.value as IshikawaCategoria)}
            className="px-2 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white"
            disabled={saving}
          >
            {CATEGORIAS.map((cat) => (
              <option key={cat} value={cat}>
                {ISHIKAWA_CATEGORIAS[cat]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={causaRaizSelecionada}
            onChange={(e) => setCausaRaizSelecionada(e.target.value)}
            placeholder="Descreva a causa raiz principal identificada"
            className={`${INPUT_CLS} flex-1`}
            disabled={saving}
          />
        </div>
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
          {saving ? 'Salvando...' : 'Salvar diagrama'}
        </button>
      </div>
    </form>
  );
}
