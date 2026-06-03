import { useState } from 'react';
import { useTreinamentos } from '../useTreinamentos';
import type { Treinamento } from '../types/Treinamento';

interface CertificadoUIProps {
  treinamento: Treinamento;
}

export function CertificadoUI({ treinamento }: CertificadoUIProps) {
  const { emitirCertificado } = useTreinamentos();
  const [loading, setLoading] = useState(false);
  const [validadesMeses, setValidadesMeses] = useState(12);

  const handleEmitir = async () => {
    setLoading(true);
    try {
      await emitirCertificado(treinamento.id, validadesMeses);
    } catch (err) {
      console.error('Erro ao emitir certificado:', err);
    } finally {
      setLoading(false);
    }
  };

  if (treinamento.status !== 'realizado') {
    return (
      <div className="p-4 bg-gray-900 border border-gray-800 rounded text-gray-400 text-sm">
        Conclua o treinamento para emitir certificado
      </div>
    );
  }

  if (treinamento.certificado) {
    const diasRestantes = Math.ceil(
      (treinamento.certificado.validoAte.toDate().getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24),
    );

    return (
      <div className="space-y-3 p-4 bg-emerald-900/10 border border-emerald-900 rounded">
        <div>
          <p className="text-xs text-gray-400">Número</p>
          <p className="text-sm font-medium text-white">{treinamento.certificado.numero}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-400">Emitido em</p>
            <p className="text-sm text-gray-300">
              {treinamento.certificado.emitidoEm.toDate().toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Válido até</p>
            <p
              className={`text-sm font-medium ${diasRestantes < 30 ? 'text-orange-400' : 'text-emerald-400'}`}
            >
              {treinamento.certificado.validoAte.toDate().toLocaleDateString('pt-BR')} (
              {diasRestantes} dias)
            </p>
          </div>
        </div>
        {treinamento.certificado.url && (
          <a
            href={treinamento.certificado.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-violet-400 hover:text-violet-300"
          >
            Baixar PDF →
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 bg-gray-900 border border-gray-800 rounded">
      <div>
        <label className="text-xs text-gray-400">Validade (meses)</label>
        <input
          type="number"
          min="1"
          max="36"
          value={validadesMeses}
          onChange={(e) => setValidadesMeses(parseInt(e.target.value))}
          className="mt-1 w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
        />
      </div>
      <button
        onClick={handleEmitir}
        disabled={loading}
        className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded transition disabled:opacity-50"
      >
        {loading ? 'Emitindo...' : 'Emitir Certificado'}
      </button>
    </div>
  );
}
