/**
 * personnel/components/CompetenciaFormModal.tsx
 *
 * Modal para criar/editar competência técnica na matriz.
 */

import React, { useCallback, useState } from 'react';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { Timestamp } from '../../../shared/services/firebase';
import { upsertCompetencia, softDeleteCompetencia } from '../services/competenciaMatrizService';
import type {
  CategoriaCompetencia,
  CompetenciaTecnica,
  CompetenciaTecnicaInput,
  NivelCompetencia,
} from '../types/CompetenciaMatriz';
import { NIVEL_LABEL, CATEGORIA_LABEL } from '../types/CompetenciaMatriz';

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-white/[0.06] border border-white/[0.09]
  text-white/90 placeholder-white/20 text-sm
  focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.08]
  disabled:opacity-40 transition-all
`.trim();

interface CompetenciaFormModalProps {
  editing: CompetenciaTecnica | null;
  prefilledColaboradorId?: string;
  prefilledItemId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function CompetenciaFormModal({
  editing,
  prefilledColaboradorId,
  prefilledItemId,
  onClose,
  onSaved,
}: CompetenciaFormModalProps) {
  const labId = useActiveLabId();
  const user = useUser();

  const [colaboradorId, setColaboradorId] = useState(editing?.colaboradorId || prefilledColaboradorId || '');
  const [colaboradorNome, setColaboradorNome] = useState(editing?.colaboradorNome || '');
  const [categoria, setCategoria] = useState<CategoriaCompetencia>(editing?.categoria || 'analito');
  const [itemId, setItemId] = useState(editing?.itemId || prefilledItemId || '');
  const [itemNome, setItemNome] = useState(editing?.itemNome || '');
  const [nivel, setNivel] = useState<NivelCompetencia>(editing?.nivel || 'nao_habilitado');
  const [dataUltimaAvaliacao, setDataUltimaAvaliacao] = useState(
    editing?.dataUltimaAvaliacao?.toDate().toISOString().split('T')[0] || '',
  );
  const [dataProximaAvaliacao, setDataProximaAvaliacao] = useState(
    editing?.dataProximaAvaliacao?.toDate().toISOString().split('T')[0] || '',
  );
  const [evidencia, setEvidencia] = useState(editing?.evidencia || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!labId || !user) return;

    if (!colaboradorNome.trim()) { setError('Nome do colaborador obrigatorio.'); return; }
    if (!itemNome.trim()) { setError('Nome do item obrigatorio.'); return; }

    setError(null);
    setSubmitting(true);

    try {
      const input: CompetenciaTecnicaInput = {
        colaboradorId: colaboradorId || colaboradorNome.trim().toLowerCase().replace(/\s+/g, '-'),
        colaboradorNome: colaboradorNome.trim(),
        categoria,
        itemId: itemId || itemNome.trim().toLowerCase().replace(/\s+/g, '-'),
        itemNome: itemNome.trim(),
        nivel,
        ...(dataUltimaAvaliacao && {
          dataUltimaAvaliacao: Timestamp.fromDate(new Date(dataUltimaAvaliacao + 'T12:00:00')),
        }),
        ...(dataProximaAvaliacao && {
          dataProximaAvaliacao: Timestamp.fromDate(new Date(dataProximaAvaliacao + 'T12:00:00')),
        }),
        ...(evidencia.trim() && { evidencia: evidencia.trim() }),
      };

      await upsertCompetencia(labId, input, editing?.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSubmitting(false);
    }
  }, [labId, user, colaboradorId, colaboradorNome, categoria, itemId, itemNome, nivel, dataUltimaAvaliacao, dataProximaAvaliacao, evidencia, editing, onSaved]);

  const handleDelete = useCallback(async () => {
    if (!labId || !editing) return;
    setSubmitting(true);
    try {
      await softDeleteCompetencia(labId, editing.id);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover.');
    } finally {
      setSubmitting(false);
    }
  }, [labId, editing, onSaved]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-[#141820] rounded-2xl shadow-2xl border border-white/[0.08] overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-base font-semibold text-white/90">
            {editing ? 'Editar Competencia' : 'Nova Competencia'}
          </h2>
          <p className="text-xs text-white/40 mt-0.5">
            DICQ 5.1.4 — Registro de habilitacao tecnica
          </p>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Colaborador */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Colaborador (nome) *</label>
              <input
                type="text"
                value={colaboradorNome}
                onChange={(e) => setColaboradorNome(e.target.value)}
                placeholder="Nome completo"
                className={INPUT_CLS}
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">ID (opcional)</label>
              <input
                type="text"
                value={colaboradorId}
                onChange={(e) => setColaboradorId(e.target.value)}
                placeholder="Auto-gerado se vazio"
                className={INPUT_CLS}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Categoria + Item */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Categoria *</label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaCompetencia)}
                className={INPUT_CLS}
                disabled={submitting}
              >
                <option value="analito">Analito</option>
                <option value="equipamento">Equipamento</option>
                <option value="procedimento">Procedimento</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-white/50 mb-1">
                {CATEGORIA_LABEL[categoria]} (nome) *
              </label>
              <input
                type="text"
                value={itemNome}
                onChange={(e) => setItemNome(e.target.value)}
                placeholder={`Ex: ${categoria === 'analito' ? 'Hemograma' : categoria === 'equipamento' ? 'Sysmex XN-550' : 'POP-012 Coleta'}`}
                className={INPUT_CLS}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Nivel */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-2">Nivel de competencia *</label>
            <div className="grid grid-cols-2 gap-2">
              {(['nao_habilitado', 'em_treinamento', 'habilitado', 'especialista'] as NivelCompetencia[]).map((n) => (
                <label key={n} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                  nivel === n
                    ? 'border-violet-500/50 bg-violet-500/10'
                    : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
                }`}>
                  <input
                    type="radio"
                    name="nivel"
                    value={n}
                    checked={nivel === n}
                    onChange={() => setNivel(n)}
                    disabled={submitting}
                    className="w-3.5 h-3.5 text-violet-600"
                  />
                  <span className="text-xs text-white/70">{NIVEL_LABEL[n]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Ultima avaliacao</label>
              <input
                type="date"
                value={dataUltimaAvaliacao}
                onChange={(e) => setDataUltimaAvaliacao(e.target.value)}
                className={INPUT_CLS}
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1">Proxima avaliacao</label>
              <input
                type="date"
                value={dataProximaAvaliacao}
                onChange={(e) => setDataProximaAvaliacao(e.target.value)}
                className={INPUT_CLS}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Evidencia */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">Evidencia (texto ou URL)</label>
            <textarea
              value={evidencia}
              onChange={(e) => setEvidencia(e.target.value)}
              placeholder="Ex: Certificado de treinamento, observacao direta em 15/05/2026..."
              rows={2}
              className={INPUT_CLS + ' resize-none'}
              disabled={submitting}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400" role="alert">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between">
          <div>
            {editing && (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={submitting}
                className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Remover
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white/50 hover:text-white/80 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!colaboradorNome.trim() || !itemNome.trim() || submitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-40 transition-colors"
            >
              {submitting ? 'Salvando...' : editing ? 'Atualizar' : 'Registrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
