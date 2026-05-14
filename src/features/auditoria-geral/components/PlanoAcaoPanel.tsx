import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useActiveLabId } from '../../../store/useAuthStore';
import { usePlanosAcao } from '../hooks/usePlanosAcao';
import { savePlanoAcao } from '../services/auditoriaGeralService';
import type { PlanoAcao, RespostaIndicador } from '../types';

interface Props {
  auditoriaId: string;
  respostas: RespostaIndicador[];
}

const STATUS_LABELS: Record<PlanoAcao['status'], string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluido',
};

const STATUS_COLORS: Record<PlanoAcao['status'], string> = {
  pendente: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  em_andamento: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  concluido: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export function PlanoAcaoPanel({ auditoriaId, respostas }: Props) {
  const labId = useActiveLabId();
  const { planos, isLoading } = usePlanosAcao(auditoriaId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ acaoCorretiva: '', responsavel: '', prazo: '' });
  const [saving, setSaving] = useState(false);

  const criticos = respostas.filter((r) => r.score !== null && r.score <= 2 && !r.naoAplica);

  const handleEdit = (indicadorId: string) => {
    const existing = planos.find((p) => p.indicadorId === indicadorId);
    setForm({
      acaoCorretiva: existing?.acaoCorretiva ?? '',
      responsavel: existing?.responsavel ?? '',
      prazo: existing?.prazo ? existing.prazo.toDate().toISOString().slice(0, 10) : '',
    });
    setEditingId(indicadorId);
  };

  const handleSave = async (r: RespostaIndicador) => {
    if (!labId || saving) return;
    setSaving(true);
    try {
      const existing = planos.find((p) => p.indicadorId === r.id);
      await savePlanoAcao(labId, auditoriaId, r.id, {
        numero: r.numero,
        indicador: r.indicador,
        bloco: r.bloco,
        score: r.score ?? 0,
        acaoCorretiva: form.acaoCorretiva,
        responsavel: form.responsavel,
        prazo: form.prazo ? Timestamp.fromDate(new Date(form.prazo)) : null,
        status: existing?.status ?? 'pendente',
      });
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (r: RespostaIndicador, newStatus: PlanoAcao['status']) => {
    if (!labId) return;
    const existing = planos.find((p) => p.indicadorId === r.id);
    if (!existing) return;
    await savePlanoAcao(labId, auditoriaId, r.id, {
      numero: existing.numero,
      indicador: existing.indicador,
      bloco: existing.bloco,
      score: existing.score,
      acaoCorretiva: existing.acaoCorretiva,
      responsavel: existing.responsavel,
      prazo: existing.prazo,
      status: newStatus,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  if (criticos.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-emerald-400">Nenhum indicador critico (score &le; 2). Plano de acao nao necessario.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white/60">
          Plano de Acao — {criticos.length} indicador{criticos.length > 1 ? 'es' : ''} critico{criticos.length > 1 ? 's' : ''}
        </h3>
        <span className="text-xs text-white/40 font-mono">
          {planos.filter((p) => p.status === 'concluido').length}/{criticos.length} concluidos
        </span>
      </div>

      <div className="space-y-3">
        {criticos.map((r) => {
          const plano = planos.find((p) => p.indicadorId === r.id);
          const isEditing = editingId === r.id;

          return (
            <div key={r.id} className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-white/40">#{r.numero}</span>
                    <span className="text-sm text-white/80">{r.indicador}</span>
                    <span className="text-xs font-mono text-red-400">{r.score}/5</span>
                  </div>
                  {r.observacoes && (
                    <p className="text-xs text-white/30 mt-1">{r.observacoes}</p>
                  )}
                </div>
                {plano && !isEditing && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLORS[plano.status]}`}>
                    {STATUS_LABELS[plano.status]}
                  </span>
                )}
              </div>

              {plano && !isEditing && (
                <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-1">
                  <p className="text-xs text-white/60"><span className="text-white/30">Acao:</span> {plano.acaoCorretiva}</p>
                  <p className="text-xs text-white/60"><span className="text-white/30">Responsavel:</span> {plano.responsavel}</p>
                  {plano.prazo && (
                    <p className="text-xs text-white/60"><span className="text-white/30">Prazo:</span> {plano.prazo.toDate().toLocaleDateString('pt-BR')}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => handleEdit(r.id)} className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors">Editar</button>
                    {plano.status === 'pendente' && (
                      <button onClick={() => handleStatusChange(r, 'em_andamento')} className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors">Iniciar</button>
                    )}
                    {plano.status === 'em_andamento' && (
                      <button onClick={() => handleStatusChange(r, 'concluido')} className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors">Concluir</button>
                    )}
                  </div>
                </div>
              )}

              {isEditing && (
                <div className="mt-3 pt-3 border-t border-white/[0.04] space-y-3">
                  <textarea
                    value={form.acaoCorretiva}
                    onChange={(e) => setForm((f) => ({ ...f, acaoCorretiva: e.target.value }))}
                    placeholder="Acao corretiva..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 resize-none focus:outline-none focus:border-violet-500/40"
                    rows={2}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={form.responsavel}
                      onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
                      placeholder="Responsavel"
                      className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:outline-none focus:border-violet-500/40"
                    />
                    <input
                      type="date"
                      value={form.prazo}
                      onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
                      className="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-violet-500/40"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSave(r)}
                      disabled={saving || !form.acaoCorretiva}
                      className="px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-xs font-medium transition-colors disabled:opacity-40"
                    >
                      {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg text-white/40 hover:text-white/60 text-xs transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {!plano && !isEditing && (
                <button
                  onClick={() => handleEdit(r.id)}
                  className="mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                  + Criar plano de acao
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
