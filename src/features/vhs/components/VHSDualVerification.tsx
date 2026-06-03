import { useState, useMemo } from 'react';
import { useUserRole } from '../../../store/useAuthStore';
import { useVHSSave } from '../hooks/useVHSSave';
import { toast } from '../../../shared/store/useToastStore';
import { VHS_TOLERANCIA_MM_H } from '../constants/vhsConstants';
import type { Timestamp } from 'firebase/firestore';
import type { VHSExam, VHSLeituraInput } from '../types/VHSExam';

interface VHSDualVerificationProps {
  exam: VHSExam;
  labId: string;
  onSuccess?: () => void;
}

function fmtTime(ts: Timestamp | null | undefined): string {
  if (!ts) return '--:--';
  return ts.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '--/--';
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** UIs conformam-se a estes estados. Qualquer outro → fallback silencioso. */
type VHSDualMode = { kind: 'pendente' } | { kind: 'divergente' } | { kind: 'terminal' };

function useMode(exam: VHSExam): VHSDualMode {
  if (exam.status === 'pendente') return { kind: 'pendente' };
  if (exam.status === 'divergente') return { kind: 'divergente' };
  return { kind: 'terminal' };
}

export function VHSDualVerification({ exam, labId, onSuccess }: VHSDualVerificationProps) {
  const role = useUserRole();
  const {
    completeExam,
    approveDivergent,
    cancelExam,
    completeLoading,
    approveLoading,
    cancelLoading,
    completeError,
    approveError,
    cancelError,
  } = useVHSSave(labId);

  const mode = useMode(exam);
  const isAdmin = role === 'owner' || role === 'admin';

  // ── Complete form state ────────────────────────────────────────────────────
  const [responsavel, setResponsavel] = useState('');
  const [leituraEmStr, setLeituraEmStr] = useState(toDateTimeLocal(new Date()));
  const [valor2, setValor2] = useState('');

  // ── Approve modal state ────────────────────────────────────────────────────
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveMotivo, setApproveMotivo] = useState('');

  // ── Cancel modal state ─────────────────────────────────────────────────────
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');

  // ── Live delta preview ─────────────────────────────────────────────────────
  const previewDelta = useMemo(() => {
    const v2 = parseFloat(valor2);
    if (Number.isNaN(v2)) return null;
    return v2 - exam.leitura1.valor;
  }, [valor2, exam.leitura1.valor]);

  const isDivergentPreview = useMemo(() => {
    if (previewDelta === null) return false;
    return Math.abs(previewDelta) > VHS_TOLERANCIA_MM_H;
  }, [previewDelta]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleComplete(e: React.FormEvent) {
    e.preventDefault();

    const v2 = parseFloat(valor2);
    if (Number.isNaN(v2) || v2 < 0 || v2 > 200) return;
    if (!responsavel.trim()) return;

    const leituraEmDate = new Date(leituraEmStr);
    if (Number.isNaN(leituraEmDate.getTime())) return;

    const input: VHSLeituraInput = {
      valor: v2,
      responsavelNome: responsavel.trim(),
      leituraEm: leituraEmDate,
    };

    const ok = await completeExam(exam.id, input, exam.amostraId, exam.metodo);
    if (ok) {
      toast.success('Leitura 2 registrada');
      onSuccess?.();
    }
  }

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    if (approveMotivo.trim().length < 10) return;

    const ok = await approveDivergent(exam.id, approveMotivo.trim());
    if (ok) {
      setShowApproveModal(false);
      setApproveMotivo('');
      toast.success('Exame liberado');
      onSuccess?.();
    }
  }

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    if (cancelMotivo.trim().length < 5) return;

    const ok = await cancelExam(exam.id, cancelMotivo.trim());
    if (ok) {
      setShowCancelModal(false);
      setCancelMotivo('');
      toast.success('Exame cancelado');
      onSuccess?.();
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderLeitura1() {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Leitura 1</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-zinc-100">
            {exam.leitura1.valor.toFixed(1)}
          </span>
          <span className="text-sm text-zinc-400">mm/h</span>
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          {exam.leitura1.responsavelNome} · {fmtTime(exam.leitura1.leituraEm)}
        </p>
      </div>
    );
  }

  function renderPendente() {
    return (
      <form onSubmit={handleComplete} className="space-y-4">
        {/* Responsavel */}
        <div>
          <label
            htmlFor="vhs-responsavel2"
            className="mb-1 block text-sm font-medium text-zinc-300"
          >
            Responsável (leitura 2) <span className="text-rose-400">*</span>
          </label>
          <input
            id="vhs-responsavel2"
            type="text"
            required
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
            placeholder="Nome do operador 2"
          />
        </div>

        {/* Data/hora da leitura */}
        <div>
          <label htmlFor="vhs-leituraEm2" className="mb-1 block text-sm font-medium text-zinc-300">
            Data/hora da leitura <span className="text-rose-400">*</span>
          </label>
          <input
            id="vhs-leituraEm2"
            type="datetime-local"
            required
            value={leituraEmStr}
            onChange={(e) => setLeituraEmStr(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
          />
        </div>

        {/* Valor */}
        <div>
          <label htmlFor="vhs-valor2" className="mb-1 block text-sm font-medium text-zinc-300">
            Valor Leitura 2 (mm/h) <span className="text-rose-400">*</span>
          </label>
          <input
            id="vhs-valor2"
            type="number"
            step="0.1"
            min={0}
            max={200}
            required
            value={valor2}
            onChange={(e) => setValor2(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
            placeholder="0.0"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Operador 2 — deve ser diferente do operador 1
          </p>
          {previewDelta !== null && (
            <p
              className={`mt-1 text-xs font-medium ${
                isDivergentPreview ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              Delta: {previewDelta > 0 ? '+' : ''}
              {previewDelta.toFixed(1)} mm/h
              {isDivergentPreview ? ' (divergente)' : ' (dentro da tolerância)'}
            </p>
          )}
        </div>

        {completeError && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
            {completeError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={completeLoading || !valor2 || !responsavel.trim()}
            className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {completeLoading ? 'Registrando...' : 'Registrar leitura 2'}
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              Cancelar exame
            </button>
          )}
        </div>
      </form>
    );
  }

  function renderDivergente() {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4">
          <div className="flex items-center gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-rose-400"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="font-semibold text-rose-400">Exame divergente</p>
              <p className="mt-1 text-sm text-rose-300">
                Delta: {exam.divergencia?.toFixed(1)} mm/h (acima de &plusmn;
                {VHS_TOLERANCIA_MM_H} mm/h)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowApproveModal(true)}
            disabled={approveLoading}
            className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {approveLoading ? 'Processando...' : 'Aprovar divergente'}
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              Cancelar exame
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderTerminal() {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
        <p className="text-sm text-zinc-400">
          Este exame já foi {exam.status === 'liberado' ? 'liberado' : 'cancelado'}.
        </p>
      </div>
    );
  }

  function renderApproveModal() {
    if (!showApproveModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#141417] p-6">
          <h3 className="mb-2 text-base font-semibold text-zinc-100">Aprovar exame divergente</h3>
          <p className="mb-4 text-sm text-zinc-400">
            Informe o motivo da liberação (mínimo 10 caracteres).
          </p>
          <form onSubmit={handleApprove} className="space-y-4">
            <textarea
              value={approveMotivo}
              onChange={(e) => setApproveMotivo(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
              placeholder="Motivo da liberação..."
              required
              minLength={10}
            />
            {approveError && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                {approveError}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowApproveModal(false)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={approveLoading || approveMotivo.trim().length < 10}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {approveLoading ? 'Processando...' : 'Confirmar liberação'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderCancelModal() {
    if (!showCancelModal) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#141417] p-6">
          <h3 className="mb-2 text-base font-semibold text-zinc-100">Cancelar exame</h3>
          <p className="mb-4 text-sm text-zinc-400">
            Informe o motivo do cancelamento (mínimo 5 caracteres).
          </p>
          <form onSubmit={handleCancel} className="space-y-4">
            <textarea
              value={cancelMotivo}
              onChange={(e) => setCancelMotivo(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
              placeholder="Motivo do cancelamento..."
              required
              minLength={5}
            />
            {cancelError && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                {cancelError}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={cancelLoading || cancelMotivo.trim().length < 5}
                className="rounded-lg bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancelLoading ? 'Processando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-zinc-800 bg-[#141417] p-6">
        <h2 className="mb-1 text-lg font-semibold text-zinc-100">
          Verificação dupla — Leitura 2 (operador 2)
        </h2>
        <p className="mb-6 text-sm text-zinc-400">
          Conferência do exame registrado em {fmtDate(exam.audit.registradoEm)}.
        </p>

        {/* Leitura 1 — sempre visível */}
        {renderLeitura1()}

        <div className="mt-6">
          {mode.kind === 'pendente' && renderPendente()}
          {mode.kind === 'divergente' && renderDivergente()}
          {mode.kind === 'terminal' && renderTerminal()}
        </div>
      </div>

      {renderApproveModal()}
      {renderCancelModal()}
    </div>
  );
}
