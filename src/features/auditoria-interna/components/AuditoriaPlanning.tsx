import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { functions } from '../../../shared/services/firebase';
import type { Auditoria } from '../types';

interface AuditoriaPlanningProps {
  auditorias: Auditoria[];
}

export function AuditoriaPlanning({ auditorias }: AuditoriaPlanningProps) {
  const labId = useActiveLabId();
  const user = useUser();
  const [showModal, setShowModal] = useState(false);
  const [ano, setAno] = useState(new Date().getFullYear().toString());
  const [frequencia, setFrequencia] = useState<'anual' | 'semestral' | 'trimestral' | 'mensal'>('anual');
  const [proximaData, setProximaData] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const auditoriasThisYear = auditorias.filter((a) => a.ano === currentYear);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId || !user) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const callable = httpsCallable(functions, 'createAuditoria');
      await callable({
        labId,
        ano: Number(ano),
        frequencia,
        responsavelTecnico: user.displayName || user.email || user.uid,
        proximaAuditoriaPlanejada: new Date(proximaData).getTime(),
      });
      setShowModal(false);
      setProximaData('');
    } catch (err: any) {
      const msg = err?.message || 'Erro ao criar auditoria';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Próxima Auditoria */}
        <div className="border border-white/10 rounded-lg p-6 bg-white/5">
          <p className="text-sm text-white/60 mb-2">Próxima Auditoria</p>
          <div className="text-lg font-semibold">
            {auditoriasThisYear[0]?.proximaAuditoriaPlanejada
              ? new Date(auditoriasThisYear[0].proximaAuditoriaPlanejada.toDate()).toLocaleDateString('pt-BR')
              : 'Não agendada'}
          </div>
        </div>

        {/* Frequência */}
        <div className="border border-white/10 rounded-lg p-6 bg-white/5">
          <p className="text-sm text-white/60 mb-2">Frequência</p>
          <div className="text-lg font-semibold capitalize">
            {auditoriasThisYear[0]?.frequencia || '—'}
          </div>
        </div>

        {/* Responsável */}
        <div className="border border-white/10 rounded-lg p-6 bg-white/5">
          <p className="text-sm text-white/60 mb-2">Responsável Técnico</p>
          <div className="text-lg font-semibold truncate">
            {auditoriasThisYear[0]?.responsavelTecnico || '—'}
          </div>
        </div>
      </div>

      {/* Create button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium transition-colors"
        >
          + Novo Plano Anual
        </button>
      </div>

      {/* List of auditorias for current year */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Auditorias Planejadas para {currentYear}</h2>
        {auditoriasThisYear.length === 0 ? (
          <div className="border border-white/10 rounded-lg p-12 text-center">
            <p className="text-white/60">Nenhuma auditoria planejada para este ano</p>
          </div>
        ) : (
          auditoriasThisYear.map((auditoria) => (
            <div
              key={auditoria.id}
              className="border border-white/10 rounded-lg p-4 bg-white/5 hover:bg-white/10 transition cursor-pointer"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-white/60 mb-1">Ano {auditoria.ano}</p>
                  <p className="font-medium capitalize">Frequência: {auditoria.frequencia}</p>
                  <p className="text-sm text-white/70 mt-2">
                    Responsável: {auditoria.responsavelTecnico}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300">
                  {auditoria.status === 'planejada' && 'Planejada'}
                  {auditoria.status === 'em_execução' && 'Em Execução'}
                  {auditoria.status === 'finalizada' && 'Finalizada'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal to create new auditoria */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141417] border border-white/10 rounded-lg shadow-2xl w-full max-w-md">
            <div className="px-6 py-6 border-b border-white/10">
              <h3 className="text-lg font-semibold">Novo Plano Anual</h3>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-6">
              {submitError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                  {submitError}
                </div>
              )}

              {/* Ano */}
              <div>
                <label className="block text-sm font-medium mb-2">Ano</label>
                <input
                  type="number"
                  value={ano}
                  onChange={(e) => setAno(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                  min={currentYear}
                />
              </div>

              {/* Frequência */}
              <div>
                <label className="block text-sm font-medium mb-2">Frequência</label>
                <select
                  value={frequencia}
                  onChange={(e) => setFrequencia(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                >
                  <option value="anual">Anual</option>
                  <option value="semestral">Semestral</option>
                  <option value="trimestral">Trimestral</option>
                  <option value="mensal">Mensal</option>
                </select>
              </div>

              {/* Próxima Auditoria */}
              <div>
                <label className="block text-sm font-medium mb-2">Data da Próxima Auditoria</label>
                <input
                  type="date"
                  value={proximaData}
                  onChange={(e) => setProximaData(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setSubmitError(null); }}
                  className="flex-1 px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-white transition"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !proximaData}
                  className="flex-1 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition"
                >
                  {isSubmitting ? 'Criando...' : 'Criar Plano'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
