import type { Timestamp } from 'firebase/firestore';
import type { VHSExam } from '../types/VHSExam';

interface VHSExamCardProps {
  exam: VHSExam;
  onVerify?: (exam: VHSExam) => void;
}

function fmtTime(ts: Timestamp | null | undefined): string {
  if (!ts) return '--:--';
  return ts.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '--/--';
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  liberado: 'Liberado',
  divergente: 'Divergente',
  cancelado: 'Cancelado',
};

export function VHSExamCard({ exam, onVerify }: VHSExamCardProps) {
  const isCancelled = exam.status === 'cancelado';

  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-[#141417] p-4 transition-opacity ${
        isCancelled ? 'opacity-60' : ''
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize">
          {STATUS_LABELS[exam.status] ?? exam.status}
        </span>
        <span className="font-mono text-xs text-zinc-500">{exam.amostraId}</span>
      </div>

      {/* Linha 1 */}
      <div className="mb-2 text-sm text-zinc-300">
        {exam.pacienteNome && (
          <span className="font-medium text-zinc-100">{exam.pacienteNome}</span>
        )}
        {exam.pacienteNome && ' · '}
        <span className="capitalize text-zinc-400">{exam.metodo}</span>
        {' · '}
        <span className="text-zinc-500">{fmtDate(exam.audit.registradoEm)}</span>
      </div>

      {/* Linha 2 */}
      <div className="text-sm text-zinc-400">
        <span className={isCancelled ? 'line-through' : ''}>
          L1: {exam.leitura1.valor.toFixed(1)} mm/h · resp: {exam.leitura1.responsavelNome} (
          {fmtTime(exam.leitura1.leituraEm)})
        </span>
        {exam.leitura2 ? (
          <span className={isCancelled ? 'line-through' : ''}>
            {' · '}L2: {exam.leitura2.valor.toFixed(1)} mm/h · resp: {exam.leitura2.responsavelNome}{' '}
            ({fmtTime(exam.leitura2.leituraEm)})
          </span>
        ) : (
          <span className="ml-2 text-amber-400">Aguardando leitura 2</span>
        )}
      </div>

      {/* Divergencia */}
      {exam.status === 'divergente' && exam.divergencia && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-rose-400"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-sm font-medium text-rose-400">
            Delta {exam.divergencia > 0 ? '+' : ''}
            {exam.divergencia.toFixed(1)} mm/h
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-3">
        {exam.status === 'pendente' && onVerify && (
          <button
            type="button"
            onClick={() => onVerify(exam)}
            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-500"
          >
            Verificar
          </button>
        )}
        {exam.status === 'liberado' && (
          <div className="flex items-center gap-1.5 text-emerald-400">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-xs font-medium">Conferido</span>
          </div>
        )}
        {isCancelled && <span className="text-xs text-zinc-500 line-through">Cancelado</span>}
      </div>
    </div>
  );
}
