import { useState, useMemo } from 'react';
import { useActiveLab } from '../../../store/useAuthStore';
import { useAttempts } from '../hooks/useAttempts';
import { useRTAction } from '../hooks/useRTAction';
import { AttemptList } from './AttemptList';
import { ActionModal } from './internal/ActionModal';
import { NotivisaModal } from './internal/NotivisaModal';
import type { Attempt } from '../types/Attempt';

export function RTPanel() {
  const lab = useActiveLab();
  const labId = lab?.id ?? '';
  const { attempts } = useAttempts(labId);
  const { create, isSaving } = useRTAction(labId);

  const [actionTarget, setActionTarget] = useState<{
    type: 'aprovar' | 'rejeitar';
    attempt: Attempt;
  } | null>(null);
  const [notivisaTarget, setNotivisaTarget] = useState<Attempt | null>(null);

  const kpis = useMemo(() => {
    const total = attempts.length;
    const conformes = attempts.filter((a) => a.conformidade === 'A').length;
    return { total, conformes, rejeitadas: total - conformes };
  }, [attempts]);

  async function handleAprovar(motivo: string) {
    if (!actionTarget) return;
    await create({
      tipo: 'aprovar_controle',
      controlOperacionalId: actionTarget.attempt.controlOperacionalId,
      payload: { decisao: 'A', motivo },
    });
    setActionTarget(null);
  }

  async function handleRejeitar(motivo: string) {
    if (!actionTarget) return;
    await create({
      tipo: 'rejeitar_controle',
      controlOperacionalId: actionTarget.attempt.controlOperacionalId,
      payload: { motivo },
    });
    setActionTarget(null);
  }

  async function handleNotivisa(data: { notivisaTipo: 'queixa_tecnica' | 'evento_adverso'; motivo: string }) {
    if (!notivisaTarget) return;
    await create({
      tipo: 'notificar_notivisa',
      attemptId: notivisaTarget.id,
      payload: { notivisaTipo: data.notivisaTipo, motivo: data.motivo },
    });
    setNotivisaTarget(null);
  }

  const pctConforme = kpis.total > 0 ? Math.round((kpis.conformes / kpis.total) * 100) : 100;

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-semibold text-white">{kpis.total}</p>
          <p className="text-xs text-zinc-500">tentativas</p>
        </div>
        <div className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-semibold text-emerald-400">{pctConforme}%</p>
          <p className="text-xs text-zinc-500">conformes</p>
        </div>
        <div className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-center">
          <p className="text-2xl font-semibold text-red-400">{kpis.rejeitadas}</p>
          <p className="text-xs text-zinc-500">rejeitadas</p>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-300">Tentativas recentes</h3>
        <AttemptList
          labId={labId}
          onAprovar={(att) => setActionTarget({ type: 'aprovar', attempt: att })}
          onRejeitar={(att) => setActionTarget({ type: 'rejeitar', attempt: att })}
          onNotivisa={(att) => setNotivisaTarget(att)}
        />
      </div>

      {actionTarget?.type === 'aprovar' && (
        <ActionModal
          title="Aprovar tentativa"
          description="Confirme que a ação corretiva foi suficiente e o resultado pode ser aceito."
          actionLabel="Aprovar"
          isSaving={isSaving}
          onConfirm={handleAprovar}
          onClose={() => setActionTarget(null)}
        />
      )}

      {actionTarget?.type === 'rejeitar' && (
        <ActionModal
          title="Rejeitar tentativa"
          description="Confirme que esta tentativa deve ser rejeitada e investigada."
          actionLabel="Rejeitar"
          actionColor="red"
          isSaving={isSaving}
          onConfirm={handleRejeitar}
          onClose={() => setActionTarget(null)}
        />
      )}

      {notivisaTarget && (
        <NotivisaModal
          isSaving={isSaving}
          onConfirm={handleNotivisa}
          onClose={() => setNotivisaTarget(null)}
        />
      )}
    </div>
  );
}
