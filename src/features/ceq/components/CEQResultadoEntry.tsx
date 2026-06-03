/**
 * CEQResultadoEntry — Record PT result with Z-score display
 *
 * Shows real-time Z-score calculation and NC creation feedback
 */

import { useState, useMemo } from 'react';
import { calcularZScore } from '../services/ceqService';
import type { CEQAmostra, CEQResultadoInput } from '../types/CEQ';

interface CEQResultadoEntryProps {
  amostra: CEQAmostra;
  onSubmit: (input: CEQResultadoInput) => Promise<void>;
  loading: boolean;
}

export function CEQResultadoEntry({ amostra, onSubmit, loading }: CEQResultadoEntryProps) {
  const [formData, setFormData] = useState({
    analyteId: 'hb',
    analyteName: 'Hemoglobin',
    valorObtido: '',
    unidade: 'g/dL',
    valorReferencia: '',
    desvioEstimado: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Real-time Z-score calculation
  const zScoreResult = useMemo(() => {
    const obtido = parseFloat(formData.valorObtido);
    const ref = parseFloat(formData.valorReferencia);
    const desvio = parseFloat(formData.desvioEstimado);

    if (!isNaN(obtido) && !isNaN(ref) && !isNaN(desvio)) {
      return calcularZScore(obtido, ref, desvio);
    }

    return null;
  }, [formData]);

  const interpret = () => {
    if (!zScoreResult) return '';
    const z = zScoreResult.zScore;
    const abs = Math.abs(z);

    if (abs < 2) {
      return `Satisfatório (Z = ${z.toFixed(2)})`;
    } else if (abs < 3) {
      return `Questionável (Z = ${z.toFixed(2)}) ⚠️ Warning`;
    } else {
      return `Insatisfatório (Z = ${z.toFixed(2)}) 🚨 NC GRAVE criada automaticamente`;
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.valorObtido) newErrors.valorObtido = 'Obrigatório';
    if (!formData.valorReferencia) newErrors.valorReferencia = 'Obrigatório';
    if (!formData.desvioEstimado) newErrors.desvioEstimado = 'Obrigatório';

    const obtido = parseFloat(formData.valorObtido);
    const ref = parseFloat(formData.valorReferencia);
    const desvio = parseFloat(formData.desvioEstimado);

    if (isNaN(obtido)) newErrors.valorObtido = 'Deve ser um número';
    if (isNaN(ref)) newErrors.valorReferencia = 'Deve ser um número';
    if (isNaN(desvio)) newErrors.desvioEstimado = 'Deve ser um número';
    if (desvio <= 0) newErrors.desvioEstimado = 'Deve ser > 0';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const input: CEQResultadoInput = {
      ceqAmostraId: amostra.id,
      ceqParticipacaoId: amostra.ceqParticipacaoId,
      analyteId: formData.analyteId,
      analyteName: formData.analyteName,
      valorObtido: parseFloat(formData.valorObtido),
      unidade: formData.unidade,
      valorReferencia: parseFloat(formData.valorReferencia),
      desvioEstimado: parseFloat(formData.desvioEstimado),
    };

    await onSubmit(input);
    setFormData({
      analyteId: 'hb',
      analyteName: 'Hemoglobin',
      valorObtido: '',
      unidade: 'g/dL',
      valorReferencia: '',
      desvioEstimado: '',
    });
  };

  const isCritical = zScoreResult && Math.abs(zScoreResult.zScore) >= 3;
  const isWarning =
    zScoreResult && Math.abs(zScoreResult.zScore) >= 2 && Math.abs(zScoreResult.zScore) < 3;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-white/5 p-4 rounded border border-white/10"
    >
      <h4 className="font-medium">
        Rodada {amostra.rodada}/{amostra.ano}
      </h4>

      {/* Analyte */}
      <div>
        <label className="block text-sm font-medium mb-1">Analito</label>
        <select
          value={formData.analyteId}
          onChange={(e) => {
            const analyteName = ['Hemoglobin', 'Hematócrito', 'RBC', 'WBC', 'Platelets'][
              ['hb', 'hct', 'rbc', 'wbc', 'plt'].indexOf(e.target.value)
            ];
            setFormData((prev) => ({
              ...prev,
              analyteId: e.target.value,
              analyteName: analyteName || 'Unknown',
            }));
          }}
          className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm"
        >
          {[
            { id: 'hb', name: 'Hemoglobin' },
            { id: 'hct', name: 'Hematócrito' },
            { id: 'rbc', name: 'RBC' },
            { id: 'wbc', name: 'WBC' },
            { id: 'plt', name: 'Platelets' },
          ].map((a) => (
            <option key={a.id} value={a.id} className="bg-[#141417]">
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Valor Obtido */}
        <div>
          <label className="block text-sm font-medium mb-1">Valor Obtido</label>
          <input
            type="number"
            step="0.01"
            value={formData.valorObtido}
            onChange={(e) => setFormData((prev) => ({ ...prev, valorObtido: e.target.value }))}
            placeholder="0.00"
            className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm"
          />
          {errors.valorObtido && <p className="text-red-400 text-xs mt-1">{errors.valorObtido}</p>}
        </div>

        {/* Unidade */}
        <div>
          <label className="block text-sm font-medium mb-1">Unidade</label>
          <input
            type="text"
            value={formData.unidade}
            onChange={(e) => setFormData((prev) => ({ ...prev, unidade: e.target.value }))}
            className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Valor Referência */}
        <div>
          <label className="block text-sm font-medium mb-1">Valor Referência</label>
          <input
            type="number"
            step="0.01"
            value={formData.valorReferencia}
            onChange={(e) => setFormData((prev) => ({ ...prev, valorReferencia: e.target.value }))}
            placeholder="0.00"
            className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm"
          />
          {errors.valorReferencia && (
            <p className="text-red-400 text-xs mt-1">{errors.valorReferencia}</p>
          )}
        </div>

        {/* Desvio Estimado */}
        <div>
          <label className="block text-sm font-medium mb-1">Desvio Estimado (SD)</label>
          <input
            type="number"
            step="0.01"
            value={formData.desvioEstimado}
            onChange={(e) => setFormData((prev) => ({ ...prev, desvioEstimado: e.target.value }))}
            placeholder="0.00"
            className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-white text-sm"
          />
          {errors.desvioEstimado && (
            <p className="text-red-400 text-xs mt-1">{errors.desvioEstimado}</p>
          )}
        </div>
      </div>

      {/* Z-Score Display */}
      {zScoreResult && (
        <div
          className={`p-3 rounded border text-sm font-medium ${
            isCritical
              ? 'bg-red-500/10 border-red-500/30 text-red-200'
              : isWarning
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
          }`}
        >
          {interpret()}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-50 text-blue-200 rounded font-medium text-sm transition-colors"
      >
        {loading ? 'Lançando...' : 'Lançar Resultado'}
      </button>
    </form>
  );
}
