import { useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, Upload } from 'lucide-react';
import type { POP } from '../../types/POP';
import { isTreinamentoValido } from '../../types/POP';

interface TrainingAssignmentUIProps {
  pop: POP;
  operadorId: string;
  operadorNome: string;
  trainingStatus?: {
    completed: boolean;
    validoAte?: Date;
    certificadoUrl?: string;
  };
  onAssignTraining?: () => void;
}

export default function TrainingAssignmentUI({
  pop,
  operadorNome,
  trainingStatus,
  onAssignTraining,
}: TrainingAssignmentUIProps) {
  const [showUpload, setShowUpload] = useState(false);

  if (!pop.treinamentosObrigatorios.length) {
    return (
      <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-center text-white/60 text-sm">
        Este POP não tem treinamentos obrigatórios
      </div>
    );
  }

  const isValid = trainingStatus?.completed && trainingStatus?.validoAte
    ? isTreinamentoValido({ validoAte: { toDate: () => trainingStatus.validoAte! } as any })
    : false;

  return (
    <div className="space-y-4">
      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <h3 className="font-medium text-white mb-3">Treinamentos Obrigatórios</h3>

        <div className="space-y-3">
          {pop.treinamentosObrigatorios.map((treino, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-white">
                  {treino.tipoTreinamento === 'inicial' ? 'Inicial' : 'Reciclagem'}
                </p>
                <p className="text-xs text-white/60">
                  Modalidade: {treino.modulo} • Validade: {treino.periodicidadeMeses} meses
                </p>
              </div>
              <div className="text-right">
                {isValid ? (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-xs font-medium">Válido</span>
                  </div>
                ) : trainingStatus?.completed ? (
                  <div className="flex items-center gap-2 text-amber-400">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs font-medium">Vencido</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs font-medium">Pendente</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {!trainingStatus?.completed && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={onAssignTraining}
              className="flex-1 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Atribuir Treinamento
            </button>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
            </button>
          </div>
        )}

        {showUpload && (
          <div className="mt-4 p-3 border border-white/10 rounded-lg bg-black/20">
            <p className="text-xs text-white/60 mb-2">Enviar certificado</p>
            <input type="file" className="w-full text-xs" />
          </div>
        )}
      </div>

      {trainingStatus?.validoAte && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-lg">
          <p className="text-xs text-emerald-300">
            ✓ {operadorNome} está qualificado até{' '}
            {new Date(trainingStatus.validoAte).toLocaleDateString('pt-BR')}
          </p>
        </div>
      )}
    </div>
  );
}
