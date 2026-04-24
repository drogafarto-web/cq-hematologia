import { useMemo, useState } from 'react';

import { Timestamp } from '../../../shared/services/firebase';
import { useEquipamentos } from '../hooks/useEquipamentos';
import { useLeiturasPrevistas } from '../hooks/useLeiturasPrevistas';
import type {
  EquipamentoMonitorado,
  LeituraPrevista,
} from '../types/ControlTemperatura';
import { ClockIcon } from './_icons';
import { Button, StatusBadge } from './_shared';
import { LeituraRapidaForm } from './LeituraRapidaForm';

function inicioDoDia(d: Date = new Date()): Timestamp {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return Timestamp.fromDate(x);
}
function fimDoDia(d: Date = new Date()): Timestamp {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return Timestamp.fromDate(x);
}

/**
 * Lista as leituras previstas do turno atual, com indicador de atraso. Cada
 * linha abre o `LeituraRapidaForm` marcando a previsão como realizada no
 * mesmo batch (service em ctFirebaseService#createLeituraComNC).
 */
export function LeituraListaPendentes() {
  const inicio = useMemo(() => inicioDoDia(), []);
  const fim = useMemo(() => fimDoDia(), []);
  const { previstas, isLoading } = useLeiturasPrevistas({ inicio, fim });
  const { equipamentos } = useEquipamentos();

  const [modal, setModal] = useState<{
    equipamento: EquipamentoMonitorado;
    previsao: LeituraPrevista;
  } | null>(null);

  const equipPor = useMemo(() => {
    const map: Record<string, EquipamentoMonitorado | undefined> = {};
    equipamentos.forEach((e) => (map[e.id] = e));
    return map;
  }, [equipamentos]);

  const pendentes = previstas.filter((p) => p.status === 'pendente');

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Carregando leituras previstas...
      </div>
    );
  }

  if (pendentes.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-sm text-emerald-700">
        Todas as leituras do turno já foram registradas.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {pendentes.map((p) => {
          const eq = equipPor[p.equipamentoId];
          const agora = Date.now();
          const atrasoMs = agora - p.dataHoraPrevista.toMillis();
          const atrasado = atrasoMs > 0;
          const hora = p.dataHoraPrevista.toDate().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <div
              key={p.id}
              className={`flex flex-col gap-3 border-b border-slate-100 p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between ${
                atrasado ? 'bg-rose-50/40' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    atrasado ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <ClockIcon size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800">{eq?.nome ?? p.equipamentoId}</h4>
                  <p className="text-sm text-slate-500">
                    Previsto: {hora} • Turno {p.turno}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {atrasado ? (
                  <StatusBadge tone="danger">
                    Atraso: {Math.round(atrasoMs / 60000)} min
                  </StatusBadge>
                ) : null}
                <Button
                  onClick={() => {
                    if (eq) setModal({ equipamento: eq, previsao: p });
                  }}
                  disabled={!eq}
                >
                  Registrar
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {modal ? (
        <LeituraRapidaForm
          open
          onClose={() => setModal(null)}
          equipamento={modal.equipamento}
          leituraPrevista={modal.previsao}
        />
      ) : null}
    </>
  );
}
