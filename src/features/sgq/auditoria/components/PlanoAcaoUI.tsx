import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import type { Auditoria } from '../../types/Auditoria';
import { statusProgressoPlanoAcao } from '../../types/Auditoria';

interface PlanoAcaoUIProps {
  auditoria: Auditoria;
}

export default function PlanoAcaoUI({ auditoria }: PlanoAcaoUIProps) {
  const progresso = statusProgressoPlanoAcao(auditoria);

  if (auditoria.planosAcao.length === 0) {
    return (
      <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-center text-white/60 text-sm">
        Nenhum plano de ação registrado
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-white">Progresso</span>
          <span className="text-sm text-white/60">
            {progresso.fechados} de {progresso.total}
          </span>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-600 transition-all"
            style={{ width: `${progresso.percentual}%` }}
          />
        </div>
      </div>

      {/* Actions list */}
      <div className="space-y-2">
        {auditoria.planosAcao.map((plano) => {
          const vencida = plano.prazo.toDate() < new Date();

          return (
            <div
              key={plano.auditoriaId + plano.achadoId}
              className={`p-3 rounded-lg border ${
                plano.status === 'fechado'
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : vencida
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-start gap-3">
                {plano.status === 'fechado' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : vencida ? (
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                )}

                <div className="flex-1">
                  <p className="text-sm text-white">{plano.descricao}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-white/50">
                    <span>Responsável: {plano.responsavel}</span>
                    <span>Prazo: {plano.prazo.toDate().toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                <span
                  className={`px-2 py-1 text-xs rounded font-medium whitespace-nowrap ${
                    plano.status === 'fechado'
                      ? 'bg-emerald-600/30 text-emerald-300'
                      : plano.status === 'vencido'
                        ? 'bg-red-600/30 text-red-300'
                        : 'bg-amber-600/30 text-amber-300'
                  }`}
                >
                  {plano.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
