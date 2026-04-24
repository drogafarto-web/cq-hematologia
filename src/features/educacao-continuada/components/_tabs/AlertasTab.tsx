import { useMemo } from 'react';

import { useAlertasVencimento } from '../../hooks/useAlertasVencimento';
import { useTreinamentos } from '../../hooks/useTreinamentos';
import type {
  AlertaVencimento,
  StatusAlertaVencimento,
  Treinamento,
} from '../../types/EducacaoContinuada';

const STATUS_LABEL: Record<StatusAlertaVencimento, { label: string; cls: string }> = {
  pendente: {
    label: 'Pendente',
    cls: 'border-slate-700 bg-slate-800/40 text-slate-300',
  },
  notificado: {
    label: 'Notificado',
    cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  resolvido: {
    label: 'Resolvido',
    cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
};

export function AlertasTab() {
  const {
    alertas,
    alertasIminentes,
    alertasVencidos,
    isLoading,
    marcarNotificado,
    resolver,
    reabrir,
  } = useAlertasVencimento();
  const { treinamentos } = useTreinamentos({ includeDeleted: true });

  const treinamentoMap = useMemo(() => {
    const m = new Map<string, Treinamento>();
    for (const t of treinamentos) m.set(t.id, t);
    return m;
  }, [treinamentos]);

  const pendentesNormais = useMemo<AlertaVencimento[]>(() => {
    const vencidosIds = new Set(alertasVencidos.map((a) => a.id));
    const iminentesIds = new Set(alertasIminentes.map((a) => a.id));
    return alertas.filter(
      (a) => a.status !== 'resolvido' && !vencidosIds.has(a.id) && !iminentesIds.has(a.id),
    );
  }, [alertas, alertasVencidos, alertasIminentes]);

  const resolvidos = useMemo(
    () => alertas.filter((a) => a.status === 'resolvido'),
    [alertas],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-slate-100">Alertas de vencimento</h2>
        <p className="text-sm text-slate-400">
          Gerados automaticamente no registro de execuções realizadas (RN-05).
        </p>
      </header>

      {isLoading && <SkeletonList rows={4} />}

      {!isLoading && alertas.length === 0 && (
        <Empty text="Nenhum alerta registrado ainda." />
      )}

      {!isLoading && alertasVencidos.length > 0 && (
        <AlertaGroup
          titulo={`Vencidos (${alertasVencidos.length})`}
          accent="red"
          alertas={alertasVencidos}
          treinamentoMap={treinamentoMap}
          onNotificado={marcarNotificado}
          onResolver={resolver}
          onReabrir={reabrir}
        />
      )}

      {!isLoading && alertasIminentes.length > 0 && (
        <AlertaGroup
          titulo={`Iminentes (${alertasIminentes.length})`}
          accent="amber"
          alertas={alertasIminentes}
          treinamentoMap={treinamentoMap}
          onNotificado={marcarNotificado}
          onResolver={resolver}
          onReabrir={reabrir}
        />
      )}

      {!isLoading && pendentesNormais.length > 0 && (
        <AlertaGroup
          titulo={`Agendados (${pendentesNormais.length})`}
          accent="slate"
          alertas={pendentesNormais}
          treinamentoMap={treinamentoMap}
          onNotificado={marcarNotificado}
          onResolver={resolver}
          onReabrir={reabrir}
        />
      )}

      {!isLoading && resolvidos.length > 0 && (
        <AlertaGroup
          titulo={`Resolvidos (${resolvidos.length})`}
          accent="slate"
          muted
          alertas={resolvidos}
          treinamentoMap={treinamentoMap}
          onNotificado={marcarNotificado}
          onResolver={resolver}
          onReabrir={reabrir}
        />
      )}
    </div>
  );
}

// ─── Group ────────────────────────────────────────────────────────────────────

type Accent = 'red' | 'amber' | 'slate';

const GROUP_HEADER_ACCENT: Record<Accent, string> = {
  red: 'text-red-300',
  amber: 'text-amber-300',
  slate: 'text-slate-400',
};

interface AlertaGroupProps {
  titulo: string;
  accent: Accent;
  muted?: boolean;
  alertas: AlertaVencimento[];
  treinamentoMap: Map<string, Treinamento>;
  onNotificado: (id: string) => Promise<void>;
  onResolver: (id: string) => Promise<void>;
  onReabrir: (id: string) => Promise<void>;
}

function AlertaGroup({
  titulo,
  accent,
  muted,
  alertas,
  treinamentoMap,
  onNotificado,
  onResolver,
  onReabrir,
}: AlertaGroupProps) {
  return (
    <section className={`flex flex-col gap-2 ${muted ? 'opacity-70' : ''}`}>
      <h3
        className={`text-xs font-semibold uppercase tracking-wider ${GROUP_HEADER_ACCENT[accent]}`}
      >
        {titulo}
      </h3>
      <ul className="flex flex-col divide-y divide-slate-800/60 rounded-lg border border-slate-800 bg-slate-900/40">
        {alertas.map((a) => {
          const treinamento = treinamentoMap.get(a.treinamentoId);
          const status = STATUS_LABEL[a.status];
          const hoje = Date.now();
          const venc = a.dataVencimento.toMillis();
          const diasRestantes = Math.ceil((venc - hoje) / (24 * 60 * 60 * 1000));
          return (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-slate-100">
                  {treinamento?.titulo ?? 'Treinamento removido'}
                </span>
                <span className="text-xs text-slate-500">
                  Vence em {a.dataVencimento.toDate().toLocaleDateString('pt-BR')}
                  {diasRestantes >= 0
                    ? ` · ${diasRestantes} dia(s) restante(s)`
                    : ` · ${Math.abs(diasRestantes)} dia(s) vencido(s)`}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${status.cls}`}
                >
                  {status.label}
                </span>
                {a.status === 'pendente' && (
                  <button
                    type="button"
                    onClick={() => onNotificado(a.id)}
                    className="rounded px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Marcar notificado
                  </button>
                )}
                {a.status !== 'resolvido' && (
                  <button
                    type="button"
                    onClick={() => onResolver(a.id)}
                    className="rounded px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                  >
                    Resolver
                  </button>
                )}
                {a.status === 'resolvido' && (
                  <button
                    type="button"
                    onClick={() => onReabrir(a.id)}
                    className="rounded px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    Reabrir
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SkeletonList({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded border border-slate-800 bg-slate-900/40" />
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 py-12 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}
