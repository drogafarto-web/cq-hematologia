import { AlertTriangle, Lock, Unlock } from 'lucide-react';
import type { NaoConformidade } from '../../types/NaoConformidade';
import { isBloqueada } from '../../types/NaoConformidade';

interface SeverityGateUIProps {
  nc: NaoConformidade;
}

const MODULO_LABEL: Record<string, string> = {
  hematologia: 'Hematologia',
  coagulacao: 'Coagulação',
  imunologia: 'Imunologia',
  bioquimica: 'Bioquímica',
  uroanalise: 'Uroanálise',
  'uroanalise-qf': 'Uroanálise QF',
};

export default function SeverityGateUI({ nc }: SeverityGateUIProps) {
  const bloqueada = isBloqueada(nc);

  return (
    <div className={`p-4 border rounded-lg ${
      bloqueada
        ? 'bg-red-500/10 border-red-500/30'
        : 'bg-emerald-500/10 border-emerald-500/30'
    }`}>
      <div className="flex items-start gap-3">
        {bloqueada ? (
          <Lock className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
        ) : (
          <Unlock className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        )}

        <div className="flex-1">
          <h4 className={`font-medium ${bloqueada ? 'text-red-300' : 'text-emerald-300'}`}>
            {bloqueada ? 'Operações Bloqueadas' : 'Operações Permitidas'}
          </h4>

          <p className={`text-sm mt-1 ${bloqueada ? 'text-red-200/70' : 'text-emerald-200/70'}`}>
            {bloqueada
              ? 'Esta não-conformidade bloqueou operações em módulos críticos'
              : 'Sem bloqueios em operações'}
          </p>

          {bloqueada && nc.modulosBloqueados && nc.modulosBloqueados.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {nc.modulosBloqueados.map((modulo) => (
                <div
                  key={modulo}
                  className="px-3 py-1 bg-red-600/30 border border-red-500/50 rounded-full text-xs text-red-200"
                >
                  {MODULO_LABEL[modulo] || modulo}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Aviso se vencido */}
      {nc.prazoClosure && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-xs text-white/60">
            Prazo: {nc.prazoClosure.toDate().toLocaleDateString('pt-BR')}
          </p>
        </div>
      )}
    </div>
  );
}
