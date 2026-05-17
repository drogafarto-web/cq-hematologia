/**
 * personnel/components/AutorizacoesTab.tsx
 *
 * Tab de Autorizações Formais.
 * Lista, filtra, concede e revoga autorizações.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { Timestamp } from '../../../shared/services/firebase';
import { useAutorizacoes } from '../hooks/useAutorizacoes';
import type { AutorizacaoFormal } from '../types/AutorizacaoFormal';
import { TIPO_AUTORIZACAO_LABEL, type TipoAutorizacao } from '../types/AutorizacaoFormal';

// ─── Visual tokens ──────────────────────────────────────────────────────────

const CARD_CLS = 'rounded-xl border border-white/[0.08] bg-white/[0.03] p-4';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors';
const BTN_DANGER = 'px-2.5 py-1 text-[10px] font-medium text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition-colors';
const BTN_GHOST = 'px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors';
const INPUT_CLS = 'w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.09] text-white/90 placeholder-white/20 text-sm focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.08] disabled:opacity-40 transition-all';
const SELECT_CLS = 'px-2.5 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.09] text-xs text-white/80';

type FilterStatus = 'todas' | 'ativas' | 'revogadas';

function formatDate(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString('pt-BR');
}

// ─── Form Modal ─────────────────────────────────────────────────────────────

interface FormModalProps {
  onClose: () => void;
  onSaved: () => void;
}

function AutorizacaoFormModal({ onClose, onSaved }: FormModalProps) {
  const labId = useActiveLabId();
  const user = useUser();
  const { create } = useAutorizacoes();

  const [colaboradorId, setColaboradorId] = useState('');
  const [colaboradorNome, setColaboradorNome] = useState('');
  const [tipo, setTipo] = useState<TipoAutorizacao>('liberar_laudo');
  const [descricao, setDescricao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labId || !user || !colaboradorNome.trim() || !descricao.trim()) return;

    setSaving(true);
    try {
      await create({
        colaboradorId: colaboradorId || colaboradorNome.toLowerCase().replace(/\s+/g, '-'),
        colaboradorNome: colaboradorNome.trim(),
        tipo,
        descricao: descricao.trim(),
        dataConcessao: Timestamp.now(),
        concedidoPorId: user.uid,
        concedidoPorNome: user.displayName || user.email || 'Admin',
        ativa: true,
        observacoes: observacoes.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      console.error('[AutorizacaoFormModal] error:', err);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg mx-4 rounded-2xl border border-white/[0.1] bg-[#1c1c20] p-6 shadow-2xl"
      >
        <h3 className="text-lg font-bold text-white mb-4">Conceder Autorização</h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Colaborador</label>
            <input
              type="text"
              value={colaboradorNome}
              onChange={(e) => setColaboradorNome(e.target.value)}
              placeholder="Nome do colaborador"
              className={INPUT_CLS}
              required
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">ID do Colaborador (opcional)</label>
            <input
              type="text"
              value={colaboradorId}
              onChange={(e) => setColaboradorId(e.target.value)}
              placeholder="ID (se conhecido)"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Tipo de Autorização</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoAutorizacao)}
              className={`${INPUT_CLS} appearance-none`}
            >
              {Object.entries(TIPO_AUTORIZACAO_LABEL).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva a autorização concedida"
              rows={3}
              className={INPUT_CLS}
              required
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Observações (opcional)</label>
            <input
              type="text"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Notas adicionais"
              className={INPUT_CLS}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className={BTN_GHOST} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className={BTN_PRIMARY} disabled={saving}>
            {saving ? 'Salvando...' : 'Conceder'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Tab ───────────────────────────────────────────────────────────────

export function AutorizacoesTab() {
  const { autorizacoes, porColaborador, loading, error, revogar } = useAutorizacoes();
  const [showForm, setShowForm] = useState(false);
  const [filterTipo, setFilterTipo] = useState<TipoAutorizacao | ''>('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todas');
  const [revoking, setRevoking] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let items = autorizacoes;
    if (filterTipo) {
      items = items.filter((a) => a.tipo === filterTipo);
    }
    if (filterStatus === 'ativas') {
      items = items.filter((a) => a.ativa);
    } else if (filterStatus === 'revogadas') {
      items = items.filter((a) => !a.ativa);
    }
    return items;
  }, [autorizacoes, filterTipo, filterStatus]);

  // Group filtered by colaborador
  const grouped = useMemo(() => {
    const map = new Map<string, { nome: string; items: AutorizacaoFormal[] }>();
    for (const a of filtered) {
      const entry = map.get(a.colaboradorId) || { nome: a.colaboradorNome, items: [] };
      entry.items.push(a);
      map.set(a.colaboradorId, entry);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleRevogar = useCallback(async (id: string) => {
    setRevoking(id);
    try {
      await revogar(id);
    } catch (err) {
      console.error('[AutorizacoesTab] revogar error:', err);
    } finally {
      setRevoking(null);
    }
  }, [revogar]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-white/5" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-500/10 p-4 text-red-200">
        <p className="text-sm font-medium">Erro ao carregar autorizações: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value as TipoAutorizacao | '')}
            className={SELECT_CLS}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(TIPO_AUTORIZACAO_LABEL).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className={SELECT_CLS}
          >
            <option value="todas">Todas</option>
            <option value="ativas">Ativas</option>
            <option value="revogadas">Revogadas</option>
          </select>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className={BTN_PRIMARY}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Conceder Autorização
        </button>
      </div>

      {/* Content */}
      {autorizacoes.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-white/[0.08] rounded-xl">
          <p className="text-sm text-white/40">Nenhuma autorização registrada.</p>
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-white/40">Nenhum resultado para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([colabId, { nome, items }]) => (
            <div key={colabId} className={CARD_CLS}>
              <h4 className="text-sm font-semibold text-white/90 mb-3">{nome}</h4>
              <div className="space-y-2">
                {items.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.02] px-3 py-2 border border-white/[0.05]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${a.ativa ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="text-xs font-medium text-white/80">
                          {TIPO_AUTORIZACAO_LABEL[a.tipo]}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/50 mt-0.5 truncate">{a.descricao}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">
                        Concedida em {formatDate(a.dataConcessao)} por {a.concedidoPorNome}
                        {a.dataRevogacao && ` | Revogada em ${formatDate(a.dataRevogacao)}`}
                      </p>
                    </div>
                    {a.ativa && (
                      <button
                        type="button"
                        onClick={() => handleRevogar(a.id)}
                        disabled={revoking === a.id}
                        className={BTN_DANGER}
                      >
                        {revoking === a.id ? '...' : 'Revogar'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <AutorizacaoFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
