/**
 * CEQParticipacaoForm — Enroll lab in PT program
 *
 * Form to create new CEQParticipacao with PT provider selection
 */

import { useState } from 'react';
import type { CEQParticipacaoInput } from '../types/CEQ';

interface CEQParticipacaoFormProps {
  onSubmit: (input: CEQParticipacaoInput) => Promise<void>;
  loading: boolean;
}

const PROVEDORES = [
  { id: 'controllab', nome: 'Controllab' },
  { id: 'eqa-provider', nome: 'EQA Provider' },
  { id: 'pncq', nome: 'PNCQ' },
];

const ESQUEMAS = {
  controllab: [
    { id: 'hematologia-basica', nome: 'Hematologia Básica' },
    { id: 'bioquimica-rotina', nome: 'Bioquímica Rotina' },
  ],
  'eqa-provider': [
    { id: 'imunologia', nome: 'Imunologia' },
  ],
  pncq: [
    { id: 'hematologia-basica', nome: 'Hematologia Básica' },
    { id: 'coagulacao', nome: 'Coagulação' },
    { id: 'urinalise', nome: 'Urinálise' },
    { id: 'urinalise-virtual', nome: 'Urinálise Virtual' },
    { id: 'vhs', nome: 'VHS' },
  ],
};

const FREQUENCIAS = [
  { id: 'mensal', nome: 'Mensal' },
  { id: 'bimestral', nome: 'Bimestral' },
  { id: 'trimestral', nome: 'Trimestral' },
];

export function CEQParticipacaoForm({ onSubmit, loading }: CEQParticipacaoFormProps) {
  const [formData, setFormData] = useState({
    provedorId: 'controllab',
    provedorNome: 'Controllab',
    esquema: ESQUEMAS.controllab[0].id,
    dataInicio: new Date().toISOString().split('T')[0],
    frequencia: 'mensal' as const,
    analitosParticipados: [] as string[],
    ativo: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleProvedorChange = (provedorId: string) => {
    const provedor = PROVEDORES.find((p) => p.id === provedorId);
    if (!provedor) return;

    setFormData((prev) => ({
      ...prev,
      provedorId,
      provedorNome: provedor.nome,
      esquema: ESQUEMAS[provedorId as keyof typeof ESQUEMAS][0].id,
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.provedorId) {
      newErrors.provedorId = 'Selecione um provedor';
    }

    if (!formData.esquema) {
      newErrors.esquema = 'Selecione um esquema';
    }

    if (!formData.dataInicio) {
      newErrors.dataInicio = 'Informe a data de início';
    }

    if (formData.analitosParticipados.length === 0) {
      newErrors.analitosParticipados = 'Selecione pelo menos um analito';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const input: CEQParticipacaoInput = {
      provedorId: formData.provedorId,
      provedorNome: formData.provedorNome,
      esquema: formData.esquema,
      dataInicio: new Date(formData.dataInicio),
      frequencia: formData.frequencia as 'mensal' | 'bimestral' | 'trimestral' | 'anual',
      analitosParticipados: formData.analitosParticipados,
      ativo: formData.ativo,
    };

    await onSubmit(input);
  };

  const selectedEsquemas = ESQUEMAS[formData.provedorId as keyof typeof ESQUEMAS] || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white/5 p-6 rounded-lg border border-white/10">
      <h3 className="text-lg font-semibold">Nova Participação em PT</h3>

      {/* Provedor Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">Provedor</label>
        <select
          value={formData.provedorId}
          onChange={(e) => handleProvedorChange(e.target.value)}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
        >
          {PROVEDORES.map((p) => (
            <option key={p.id} value={p.id} className="bg-[#141417]">
              {p.nome}
            </option>
          ))}
        </select>
        {errors.provedorId && <p className="text-red-400 text-xs mt-1">{errors.provedorId}</p>}
      </div>

      {/* Esquema Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">Esquema</label>
        <select
          value={formData.esquema}
          onChange={(e) => setFormData((prev) => ({ ...prev, esquema: e.target.value }))}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
        >
          {selectedEsquemas.map((e) => (
            <option key={e.id} value={e.id} className="bg-[#141417]">
              {e.nome}
            </option>
          ))}
        </select>
        {errors.esquema && <p className="text-red-400 text-xs mt-1">{errors.esquema}</p>}
      </div>

      {/* Start Date */}
      <div>
        <label className="block text-sm font-medium mb-2">Data de Início</label>
        <input
          type="date"
          value={formData.dataInicio}
          onChange={(e) => setFormData((prev) => ({ ...prev, dataInicio: e.target.value }))}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
        />
        {errors.dataInicio && <p className="text-red-400 text-xs mt-1">{errors.dataInicio}</p>}
      </div>

      {/* Frequency */}
      <div>
        <label className="block text-sm font-medium mb-2">Frequência</label>
        <select
          value={formData.frequencia}
          onChange={(e) => setFormData((prev) => ({ ...prev, frequencia: e.target.value as any }))}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-white text-sm"
        >
          {FREQUENCIAS.map((f) => (
            <option key={f.id} value={f.id} className="bg-[#141417]">
              {f.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Analytes */}
      <div>
        <label className="block text-sm font-medium mb-2">Analitos Participados</label>
        <div className="bg-white/5 border border-white/10 rounded p-3 space-y-2">
          {['hb', 'hct', 'rbc', 'wbc', 'plt'].map((id) => (
            <label key={id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.analitosParticipados.includes(id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData((prev) => ({
                      ...prev,
                      analitosParticipados: [...prev.analitosParticipados, id],
                    }));
                  } else {
                    setFormData((prev) => ({
                      ...prev,
                      analitosParticipados: prev.analitosParticipados.filter((a) => a !== id),
                    }));
                  }
                }}
                className="w-4 h-4"
              />
              <span className="text-sm">{id.toUpperCase()}</span>
            </label>
          ))}
        </div>
        {errors.analitosParticipados && (
          <p className="text-red-400 text-xs mt-1">{errors.analitosParticipados}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 text-emerald-200 rounded font-medium text-sm transition-colors"
      >
        {loading ? 'Criando...' : 'Criar Participação'}
      </button>
    </form>
  );
}
