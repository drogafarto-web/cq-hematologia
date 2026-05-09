import React, { useState } from 'react';
import { useActiveLabId } from '../../../store/useAuthStore';
import { createPlanoAcao } from '../services/auditoriaService';

interface PlanoAcaoFormProps {
  achadoId: string;
  auditoriaId: string;
  onSuccess?: (planoId: string) => void;
}

export function PlanoAcaoForm({
  achadoId,
  auditoriaId,
  onSuccess,
}: PlanoAcaoFormProps) {
  const labId = useActiveLabId();
  const [descricao, setDescricao] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [prazo, setPrazo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!descricao.trim() || descricao.length < 20) {
      setError('Descrição deve ter ao menos 20 caracteres');
      return;
    }

    if (descricao.length > 500) {
      setError('Descrição não pode ultrapassar 500 caracteres');
      return;
    }

    if (!responsavel.trim()) {
      setError('Responsável é obrigatório');
      return;
    }

    if (!prazo) {
      setError('Prazo é obrigatório');
      return;
    }

    if (!labId) {
      setError('Lab não ativo');
      return;
    }

    try {
      setIsLoading(true);
      const prazoDate = new Date(prazo);

      if (prazoDate < new Date()) {
        setError('Prazo deve ser no futuro');
        return;
      }

      const planoId = await createPlanoAcao(
        labId,
        auditoriaId,
        achadoId,
        descricao,
        responsavel,
        prazoDate
      );

      setDescricao('');
      setResponsavel('');
      setPrazo('');
      onSuccess?.(planoId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao criar plano de ação';
      setError(errorMsg);
      console.error('Error creating plano de ação:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const descricaoLength = descricao.length;
  const isValid =
    descricaoLength >= 20 &&
    descricaoLength <= 500 &&
    responsavel.trim() !== '' &&
    prazo !== '';

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#141417] border border-white/8 rounded-lg p-6 space-y-4"
    >
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-white">Novo Plano de Ação</h3>
        <p className="text-xs text-white/60 mt-1">
          Defina as ações corretivas para este achado
        </p>
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white/90">
          Descrição da ação
          <span className="text-rose-500 ml-1">*</span>
        </label>
        <textarea
          placeholder="Descreva a ação corretiva em detalhe (mín. 20, máx. 500 caracteres)..."
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          className="w-full h-20 bg-white/5 border border-white/10 rounded-lg p-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none text-sm"
        />
        <div className="flex justify-between items-center">
          <p className="text-xs text-white/60">
            {descricaoLength}/500 caracteres
          </p>
          {descricaoLength < 20 && descricaoLength > 0 && (
            <p className="text-xs text-rose-400">Mínimo 20 caracteres</p>
          )}
        </div>
      </div>

      {/* Responsável */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white/90">
          Responsável
          <span className="text-rose-500 ml-1">*</span>
        </label>
        <input
          type="text"
          placeholder="Nome do operador responsável..."
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Prazo */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white/90">
          Prazo
          <span className="text-rose-500 ml-1">*</span>
        </label>
        <input
          type="date"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
          <p className="text-xs text-rose-400">{error}</p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="flex-1 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:bg-violet-500/50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {isLoading ? '⏳ Salvando...' : 'Criar plano de ação'}
        </button>
      </div>
    </form>
  );
}
