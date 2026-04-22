/**
 * EquipamentoLifecycleModal — modals de ciclo de vida do equipamento.
 *
 * Exporta 3 componentes, um por ação:
 *   - EnterManutencaoModal: entrada em manutenção (motivo obrigatório)
 *   - LeaveManutencaoModal: saída de manutenção (nota opcional)
 *   - AposentarModal: soft-delete com motivo + destino + aviso de retenção 5a
 *
 * Cada modal é independente mas compartilha o mesmo visual. Todas as mutações
 * são atômicas (writeBatch) + audit event imutável.
 */

import React, { useState } from 'react';
import { useUser } from '../../../store/useAuthStore';
import {
  aposentarEquipamento,
  enterManutencao,
  leaveManutencao,
} from '../services/equipamentoService';
import {
  RETENCAO_ANOS_POS_APOSENTADORIA,
  type Equipamento,
  type EquipamentoDestinoFinal,
} from '../types/Equipamento';

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm
  focus:outline-none focus:border-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08]
  disabled:opacity-40 transition-all resize-none
`.trim();

function Shell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl"
      >
        <header className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06]">
          <p className="text-sm font-semibold text-slate-900 dark:text-white/90">{title}</p>
          <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">{subtitle}</p>
        </header>
        {children}
      </div>
    </div>
  );
}

// ─── EnterManutencao ─────────────────────────────────────────────────────────

interface EnterManutencaoModalProps {
  labId: string;
  equipamento: Equipamento;
  onClose: () => void;
  onDone?: () => void;
}

export function EnterManutencaoModal({
  labId,
  equipamento,
  onClose,
  onDone,
}: EnterManutencaoModalProps) {
  const user = useUser();
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (motivo.trim().length < 10) {
      setError('Motivo obrigatório — mínimo 10 caracteres.');
      return;
    }
    if (!user) {
      setError('Usuário não autenticado.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await enterManutencao(labId, equipamento.id, {
        motivo: motivo.trim(),
        operadorId: user.uid,
        operadorName: user.displayName ?? user.email ?? user.uid,
      });
      onDone?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar manutenção.');
      setSubmitting(false);
    }
  }

  return (
    <Shell
      title={`Entrar em manutenção — ${equipamento.name}`}
      subtitle="Bloqueia criação de corridas enquanto a manutenção durar. Registro imutável."
      onClose={onClose}
    >
      <div className="p-5 space-y-4">
        <div>
          <label htmlFor="motivo-manu" className="block text-xs uppercase tracking-widest font-semibold text-slate-500 dark:text-white/40 mb-1.5">
            Motivo <span className="text-red-500 ml-0.5">*</span>
          </label>
          <textarea
            id="motivo-manu"
            autoFocus
            rows={4}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: substituição do módulo de contagem elétrica; parado até recebimento da peça X (OS 12345)."
            className={INPUT_CLS}
          />
          <p className="text-[11px] text-slate-500 dark:text-white/35 mt-1">
            Mínimo 10 caracteres. Fica no histórico imutável do equipamento.
          </p>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      <footer className="px-5 py-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-4 h-9 rounded-lg text-xs font-medium text-slate-600 dark:text-white/55 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 h-9 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all disabled:opacity-60"
        >
          {submitting ? 'Registrando…' : 'Colocar em manutenção'}
        </button>
      </footer>
    </Shell>
  );
}

// ─── LeaveManutencao ─────────────────────────────────────────────────────────

export function LeaveManutencaoModal({
  labId,
  equipamento,
  onClose,
  onDone,
}: EnterManutencaoModalProps) {
  const user = useUser();
  const [nota, setNota] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!user) {
      setError('Usuário não autenticado.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await leaveManutencao(labId, equipamento.id, {
        operadorId: user.uid,
        operadorName: user.displayName ?? user.email ?? user.uid,
        ...(nota.trim() && { nota: nota.trim() }),
      });
      onDone?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao liberar manutenção.');
      setSubmitting(false);
    }
  }

  return (
    <Shell
      title={`Liberar manutenção — ${equipamento.name}`}
      subtitle={`Em manutenção desde ${
        equipamento.manutencaoDesde
          ? equipamento.manutencaoDesde.toDate().toLocaleDateString('pt-BR')
          : '—'
      }. Após liberar, volta a aceitar corridas.`}
      onClose={onClose}
    >
      <div className="p-5 space-y-4">
        {equipamento.motivoManutencao && (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
            <strong className="block mb-0.5">Motivo atual da manutenção:</strong>
            {equipamento.motivoManutencao}
          </div>
        )}

        <div>
          <label htmlFor="nota-leave" className="block text-xs uppercase tracking-widest font-semibold text-slate-500 dark:text-white/40 mb-1.5">
            Nota de conclusão <span className="text-slate-400 dark:text-white/25 font-normal normal-case">(opcional)</span>
          </label>
          <textarea
            id="nota-leave"
            autoFocus
            rows={3}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ex: peça substituída pela OS 12345; calibração OK; QC executado e aprovado."
            className={INPUT_CLS}
          />
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      <footer className="px-5 py-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-4 h-9 rounded-lg text-xs font-medium text-slate-600 dark:text-white/55 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all disabled:opacity-60"
        >
          {submitting ? 'Liberando…' : 'Liberar para uso'}
        </button>
      </footer>
    </Shell>
  );
}

// ─── Aposentar ───────────────────────────────────────────────────────────────

const DESTINO_LABEL: Record<EquipamentoDestinoFinal, string> = {
  venda: 'Venda a terceiro (com NF)',
  devolucao: 'Devolução ao fabricante/locadora',
  sucateamento: 'Sucateamento (sucata eletrônica / WEEE)',
  'descarte-ambiental': 'Descarte ambiental especializado',
  doacao: 'Doação (sem contrapartida)',
};

export function AposentarEquipamentoModal({
  labId,
  equipamento,
  onClose,
  onDone,
}: EnterManutencaoModalProps) {
  const user = useUser();
  const [motivo, setMotivo] = useState('');
  const [destino, setDestino] = useState<EquipamentoDestinoFinal | ''>('');
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expected = `APOSENTAR ${equipamento.name.toUpperCase()}`;

  async function handleSubmit() {
    if (motivo.trim().length < 10) {
      setError('Motivo obrigatório — mínimo 10 caracteres.');
      return;
    }
    if (!destino) {
      setError('Selecione o destino final.');
      return;
    }
    if (confirmText.trim().toUpperCase() !== expected) {
      setError(`Digite "${expected}" para confirmar.`);
      return;
    }
    if (!user) {
      setError('Usuário não autenticado.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await aposentarEquipamento(labId, equipamento.id, {
        motivo: motivo.trim(),
        destinoFinal: destino,
        operadorId: user.uid,
        operadorName: user.displayName ?? user.email ?? user.uid,
      });
      onDone?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aposentar equipamento.');
      setSubmitting(false);
    }
  }

  return (
    <Shell
      title={`Aposentar equipamento — ${equipamento.name}`}
      subtitle={`Soft-delete com retenção de ${RETENCAO_ANOS_POS_APOSENTADORIA} anos · RDC 786/2023 art. 42.`}
      onClose={onClose}
    >
      <div className="p-5 space-y-4">
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
          <p className="font-semibold mb-1">⚠ Ação com retenção obrigatória de 5 anos</p>
          <p className="leading-relaxed">
            O equipamento some das telas de rotina, mas o registro + a trilha de auditoria ficam
            preservados imutáveis até <strong>{formatRetencaoDate()}</strong>. Após esse prazo a
            Cloud Function de limpeza remove automaticamente.
          </p>
          <p className="mt-1.5 leading-relaxed">
            Lotes vinculados a este equipamento continuam válidos — mas não poderão ser ativados
            em setup de outro equipamento sem cadastro manual.
          </p>
        </div>

        <div>
          <label htmlFor="motivo-apo" className="block text-xs uppercase tracking-widest font-semibold text-slate-500 dark:text-white/40 mb-1.5">
            Motivo da aposentadoria <span className="text-red-500 ml-0.5">*</span>
          </label>
          <textarea
            id="motivo-apo"
            autoFocus
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: equipamento vendido para LabClin Conceição; NF 4821/2026; retirada em 2026-04-25."
            className={INPUT_CLS}
          />
          <p className="text-[11px] text-slate-500 dark:text-white/35 mt-1">Mínimo 10 caracteres.</p>
        </div>

        <div>
          <label htmlFor="destino" className="block text-xs uppercase tracking-widest font-semibold text-slate-500 dark:text-white/40 mb-1.5">
            Destino final <span className="text-red-500 ml-0.5">*</span>
          </label>
          <select
            id="destino"
            className={INPUT_CLS}
            value={destino}
            onChange={(e) => setDestino(e.target.value as EquipamentoDestinoFinal | '')}
          >
            <option value="">Selecione…</option>
            {(Object.entries(DESTINO_LABEL) as Array<[EquipamentoDestinoFinal, string]>).map(
              ([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label htmlFor="confirm" className="block text-xs uppercase tracking-widest font-semibold text-slate-500 dark:text-white/40 mb-1.5">
            Digite para confirmar <span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            id="confirm"
            className={INPUT_CLS}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={expected}
            autoComplete="off"
          />
          <p className="text-[11px] text-slate-500 dark:text-white/35 mt-1">
            Previne aposentadoria acidental. Digite: <code className="px-1 bg-slate-100 dark:bg-white/[0.06] rounded">{expected}</code>
          </p>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      <footer className="px-5 py-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-4 h-9 rounded-lg text-xs font-medium text-slate-600 dark:text-white/55 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all disabled:opacity-60"
        >
          {submitting ? 'Aposentando…' : 'Aposentar definitivamente'}
        </button>
      </footer>
    </Shell>
  );
}

function formatRetencaoDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + RETENCAO_ANOS_POS_APOSENTADORIA);
  return d.toLocaleDateString('pt-BR');
}
