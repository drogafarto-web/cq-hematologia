import { useState, useMemo } from 'react';
import { useUser, useUserRole } from '../../../store/useAuthStore';
import { useVHSSave } from '../hooks/useVHSSave';
import { VHS_TOLERANCIA_MM_H } from '../constants/vhsConstants';
import type { Timestamp } from 'firebase/firestore';
import type { VHSExam } from '../types/VHSExam';

interface VHSDualVerificationProps {
  exam: VHSExam;
  onSuccess?: (exam: VHSExam) => void;
}

function fmtTime(ts: Timestamp | null | undefined): string {
  if (!ts || typeof (ts as any).toDate !== 'function') return '--:--';
  const d = (ts as Timestamp).toDate();
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(ts: Timestamp | null | undefined): string {
  if (!ts || typeof (ts as any).toDate !== 'function') return '--/--';
  const d = (ts as Timestamp).toDate();
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function VHSDualVerification({ exam, onSuccess }: VHSDualVerificationProps) {
  const user = useUser();
  const role = useUserRole();
  const {
    saveSecondReading,
    approveDivergent,
    cancelExam,
    twoLoading,
    approveLoading,
    cancelLoading,
    errors,
  } = useVHSSave();

  const [valor2, setValor2] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveMotivo, setApproveMotivo] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [result, setResult] = useState<VHSExam | null>(null);

  const isAdmin = role === 'owner' || role === 'admin';

  const previewDelta = useMemo(() => {
    const v2 = parseFloat(valor2);
    if (Number.isNaN(v2)) return null;
    return v2 - exam.leitura1.valor;
  }, [valor2, exam.leitura1.valor]);

  const isDivergentPreview = useMemo(() => {
    if (previewDelta === null) return false;
    return Math.abs(previewDelta) > VHS_TOLERANCIA_MM_H;
  }, [previewDelta]);

  async function handleSecondReading(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const v2 = parseFloat(valor2);
    if (Number.isNaN(v2) || v2 < 0 || v2 > 200) return;

    try {
      const updated = await saveSecondReading(exam.id, {
        leitura2: {
          valor: v2,
          operadorId: user.uid,
          operadorNome: user.displayName || user.email || 'Operador',
        },
      });
      setResult(updated);
      onSuccess?.(updated);
    } catch {
      // erro ja esta em errors.two
    }
  }

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    if (approveMotivo.trim().length < 10) return;
    try {
      await approveDivergent(exam.id, approveMotivo.trim());
      setShowApproveModal(false);
      setApproveMotivo('');
      // atualiza o exam chamando onSuccess com um objeto mergeado (aproximacao)
      onSuccess?.({ ...exam, status: 'liberado' } as VHSExam);
    } catch {
      // erro ja esta em errors.approve
    }
  }

  async function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    if (cancelMotivo.trim().length < 5) return;
    try {
      await cancelExam(exam.id, cancelMotivo.trim());
      setShowCancelModal(false);
      setCancelMotivo('');
      onSuccess?.({ ...exam, status: 'cancelado' } as VHSExam);
    } catch {
      // erro ja esta em errors.cancel
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border border-zinc-800 bg-[#141417] p-6">
        <h2 className="mb-1 text-lg font-semibold text-zinc-100">
          Verificacao dupla — Leitura 2 (operador 2)
        </h2>
        <p className="mb-6 text-sm text-zinc-400">
          Conferencia do exame registrado em {fmtDate(exam.criadoEm)}.
        </p>

        {/* Leitura 1 */}
        <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Leitura 1</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-zinc-100">
              {exam.leitura1.valor.toFixed(1)}
            </span>
            <span className="text-sm text-zinc-400">mm/h</span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {exam.leitura1.operadorNome} · {fmtTime(exam.leitura1.ts)}
          </p>
        </div>

        {result ? (
          <div
            className={`rounded-lg border p-4 ${
              result.status === 'liberado'
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : result.status === 'divergente'
                  ? 'border-rose-500/30 bg-rose-500/10'
                  : 'border-zinc-800 bg-zinc-900/50'
            }`}
          >
            {result.status === 'liberado' && (
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
                  className="text-emerald-400"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <div>
                  <p className="font-semibold text-emerald-400">Liberado</p>
                  {result.divergencia ? (
                    <p className="text-sm text-zinc-400">
                      Delta = {result.divergencia.delta > 0 ? '+' : ''}
                      {result.divergencia.delta.toFixed(1)} mm/h (dentro da tolerancia)
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-400">
                      Delta dentro da tolerancia de {VHS_TOLERANCIA_MM_H} mm/h
                    </p>
                  )}
                </div>
              </div>
            )}
            {result.status === 'divergente' && (
              <div>
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
                  <p className="font-semibold text-rose-400">Divergente</p>
                </div>
                {result.divergencia && (
                  <p className="mt-2 text-sm text-rose-300">
                    Delta = {result.divergencia.delta > 0 ? '+' : ''}
                    {result.divergencia.delta.toFixed(1)} mm/h (acima de ±{VHS_TOLERANCIA_MM_H}{' '}
                    mm/h)
                  </p>
                )}
                <p className="mt-2 text-sm text-zinc-400">Aguardando aprovacao do RT.</p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSecondReading} className="space-y-4">
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
                  Preview do delta: {previewDelta > 0 ? '+' : ''}
                  {previewDelta.toFixed(1)} mm/h
                  {isDivergentPreview ? ' (divergente)' : ' (dentro da tolerancia)'}
                </p>
              )}
            </div>

            {errors.two && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                {errors.two}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={twoLoading || !valor2}
                className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {twoLoading ? 'Registrando...' : 'Registrar leitura 2'}
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
        )}

        {/* Aprovar divergente (quando o exam já veio divergente do backend ou após submit) */}
        {(exam.status === 'divergente' || result?.status === 'divergente') && (
          <div className="mt-6 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4">
            <p className="text-sm font-medium text-rose-400">
              Exame divergente — aguardando aprovacao do RT
            </p>
            <button
              type="button"
              onClick={() => setShowApproveModal(true)}
              disabled={approveLoading}
              className="mt-3 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {approveLoading ? 'Processando...' : 'Aprovar divergente'}
            </button>
          </div>
        )}
      </div>

      {/* Modal aprovar */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#141417] p-6">
            <h3 className="mb-2 text-base font-semibold text-zinc-100">Aprovar exame divergente</h3>
            <p className="mb-4 text-sm text-zinc-400">
              Informe o motivo da liberacao (minimo 10 caracteres).
            </p>
            <form onSubmit={handleApprove} className="space-y-4">
              <textarea
                value={approveMotivo}
                onChange={(e) => setApproveMotivo(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-rose-500"
                placeholder="Motivo da liberacao..."
                required
                minLength={10}
              />
              {errors.approve && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                  {errors.approve}
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
                  {approveLoading ? 'Processando...' : 'Confirmar liberacao'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal cancelar */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#141417] p-6">
            <h3 className="mb-2 text-base font-semibold text-zinc-100">Cancelar exame</h3>
            <p className="mb-4 text-sm text-zinc-400">
              Informe o motivo do cancelamento (minimo 5 caracteres).
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
              {errors.cancel && (
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
                  {errors.cancel}
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
      )}
    </div>
  );
}
