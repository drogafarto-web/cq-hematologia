/**
 * personnel/components/CienciaTab.tsx
 *
 * Tab de Ciência de Responsabilidades.
 * Lista ciências assinadas + pendentes + modal de registro.
 */

import React, { useState } from 'react';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { Timestamp } from '../../../shared/services/firebase';
import { useCiencias, type PendenteCiencia } from '../hooks/useCiencias';
import type { CienciaResponsabilidades } from '../types/CienciaResponsabilidades';

// ─── Visual tokens ──────────────────────────────────────────────────────────

const CARD_CLS = 'rounded-xl border border-white/[0.08] bg-white/[0.03] p-4';
const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors';
const BTN_GHOST =
  'px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors';

function formatDate(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString('pt-BR');
}

// ─── Modal ──────────────────────────────────────────────────────────────────

interface CienciaModalProps {
  pendente: PendenteCiencia;
  onClose: () => void;
  onSaved: () => void;
}

function CienciaModal({ pendente, onClose, onSaved }: CienciaModalProps) {
  const labId = useActiveLabId();
  const user = useUser();
  const { create } = useCiencias();
  const [saving, setSaving] = useState(false);
  const [resultHash, setResultHash] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!labId || !user) return;
    setSaving(true);
    try {
      await create({
        colaboradorId: pendente.designacao.pessoaId,
        colaboradorNome: pendente.designacao.pessoaNome,
        cargoId: pendente.cargo.id,
        cargoTitulo: pendente.cargo.titulo,
        responsabilidades: [...pendente.cargo.responsabilidades],
        autoridades: [...pendente.cargo.autoridades],
        dataAssinatura: Timestamp.now(),
        assinadoPorId: user.uid,
        testemunhaId: user.uid,
        testemunhaNome: user.displayName || user.email || 'Admin',
      });
      // Show hash confirmation briefly
      setResultHash('assinado');
      setTimeout(() => {
        onSaved();
      }, 1200);
    } catch (err) {
      console.error('[CienciaModal] error:', err);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-2xl border border-white/[0.1] bg-[#1c1c20] p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-1">Registrar Ciência</h3>
        <p className="text-xs text-white/50 mb-4">
          {pendente.designacao.pessoaNome} confirma ciência do cargo abaixo.
        </p>

        <div className="space-y-3 mb-6">
          <div className={CARD_CLS}>
            <p className="text-xs text-white/40 mb-1">Cargo</p>
            <p className="text-sm font-semibold text-white">{pendente.cargo.titulo}</p>
          </div>

          <div className={CARD_CLS}>
            <p className="text-xs text-white/40 mb-2">Responsabilidades</p>
            <ul className="space-y-1">
              {pendente.cargo.responsabilidades.map((r, i) => (
                <li key={i} className="text-xs text-white/70 flex gap-2">
                  <span className="text-violet-400 shrink-0">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <div className={CARD_CLS}>
            <p className="text-xs text-white/40 mb-2">Autoridades</p>
            <ul className="space-y-1">
              {pendente.cargo.autoridades.map((a, i) => (
                <li key={i} className="text-xs text-white/70 flex gap-2">
                  <span className="text-emerald-400 shrink-0">•</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {resultHash ? (
          <div className="text-center py-3">
            <p className="text-sm text-emerald-400 font-medium">Ciência registrada com sucesso</p>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={BTN_GHOST} disabled={saving}>
              Cancelar
            </button>
            <button type="button" onClick={handleConfirm} className={BTN_PRIMARY} disabled={saving}>
              {saving ? 'Registrando...' : 'Confirmar Ciência'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Tab ───────────────────────────────────────────────────────────────

export function CienciaTab() {
  const { ciencias, pendentes, loading, error } = useCiencias();
  const [modalPendente, setModalPendente] = useState<PendenteCiencia | null>(null);

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
        <p className="text-sm font-medium">Erro ao carregar ciências: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pendentes */}
      {pendentes.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-amber-300 mb-3">
            Pendentes ({pendentes.length})
          </h3>
          <div className="space-y-2">
            {pendentes.map((p) => (
              <div
                key={`${p.designacao.pessoaId}-${p.cargo.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white/90">{p.designacao.pessoaNome}</p>
                  <p className="text-xs text-white/50">{p.cargo.titulo}</p>
                </div>
                <button type="button" onClick={() => setModalPendente(p)} className={BTN_PRIMARY}>
                  Registrar Ciência
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Assinadas */}
      <section>
        <h3 className="text-sm font-semibold text-white/90 mb-3">
          Ciências Assinadas ({ciencias.length})
        </h3>
        {ciencias.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-white/[0.08] rounded-xl">
            <p className="text-sm text-white/40">Nenhuma ciência registrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ciencias.map((c) => (
              <CienciaRow key={c.id} ciencia={c} />
            ))}
          </div>
        )}
      </section>

      {/* Modal */}
      {modalPendente && (
        <CienciaModal
          pendente={modalPendente}
          onClose={() => setModalPendente(null)}
          onSaved={() => setModalPendente(null)}
        />
      )}
    </div>
  );
}

// ─── Row component ──────────────────────────────────────────────────────────

function CienciaRow({ ciencia }: { ciencia: CienciaResponsabilidades }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={CARD_CLS}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/90 truncate">{ciencia.colaboradorNome}</p>
          <p className="text-xs text-white/50">{ciencia.cargoTitulo}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] font-mono text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">
            {ciencia.hash.slice(0, 8)}
          </span>
          <span className="text-xs text-white/40">{formatDate(ciencia.dataAssinatura)}</span>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-white/40 hover:text-white transition-colors"
            aria-label={expanded ? 'Recolher' : 'Expandir'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">
              Responsabilidades
            </p>
            <ul className="space-y-0.5">
              {ciencia.responsabilidades.map((r, i) => (
                <li key={i} className="text-xs text-white/60">
                  • {r}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">Autoridades</p>
            <ul className="space-y-0.5">
              {ciencia.autoridades.map((a, i) => (
                <li key={i} className="text-xs text-white/60">
                  • {a}
                </li>
              ))}
            </ul>
          </div>
          {ciencia.testemunhaNome && (
            <p className="text-xs text-white/40">Testemunha: {ciencia.testemunhaNome}</p>
          )}
        </div>
      )}
    </div>
  );
}
