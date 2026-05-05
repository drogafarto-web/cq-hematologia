/**
 * CEQDashboard — Overview of PT program results
 *
 * Shows:
 * - Active participations
 * - Recent results (Z-scores)
 * - Unsatisfactory results (blockers)
 * - NC status
 */

import { useCEQ } from '../hooks/useCEQ';
import { CEQParticipacaoForm } from './CEQParticipacaoForm';
import { CEQResultadoEntry } from './CEQResultadoEntry';
import type { CEQParticipacaoInput } from '../types/CEQ';

export function CEQDashboard() {
  const {
    participacoes,
    amostras,
    resultados,
    selectedParticipacao,
    selectedAmostra,
    loading,
    error,
    selectParticipacao,
    selectAmostra,
    criarParticipacao,
    receberAmostra,
    lancarResultado,
  } = useCEQ();

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold">CEQ — Ensaios de Aptidão Externa</h2>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Participations */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Participações Ativas</h3>

          {participacoes.length === 0 ? (
            <p className="text-white/50 text-sm">Nenhuma participação ativa</p>
          ) : (
            <div className="space-y-2">
              {participacoes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectParticipacao(p)}
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    selectedParticipacao?.id === p.id
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-200'
                      : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  }`}
                >
                  <div className="font-medium text-sm">{p.provedorNome}</div>
                  <div className="text-xs text-white/60">{p.esquema}</div>
                </button>
              ))}
            </div>
          )}

          <CEQParticipacaoForm onSubmit={criarParticipacao} loading={loading} />
        </div>

        {/* Center: Amostras */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Amostras</h3>

          {selectedParticipacao ? (
            amostras.length === 0 ? (
              <p className="text-white/50 text-sm">Nenhuma amostra recebida</p>
            ) : (
              <div className="space-y-2">
                {amostras.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => selectAmostra(a)}
                    className={`w-full text-left p-3 rounded border transition-colors ${
                      selectedAmostra?.id === a.id
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-200'
                        : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                    }`}
                  >
                    <div className="font-medium text-sm">Rodada {a.rodada}/{a.ano}</div>
                    <div className="text-xs text-white/60">{a.status}</div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <p className="text-white/50 text-sm">Selecione uma participação</p>
          )}
        </div>

        {/* Right: Result Entry */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Lançar Resultado</h3>

          {selectedAmostra ? (
            <CEQResultadoEntry amostra={selectedAmostra} onSubmit={lancarResultado} loading={loading} />
          ) : (
            <p className="text-white/50 text-sm">Selecione uma amostra</p>
          )}
        </div>
      </div>

      {/* Results Summary */}
      {selectedAmostra && (
        <div className="mt-8 space-y-4">
          <h3 className="text-lg font-semibold">Resultados Lançados</h3>

          {resultados.length === 0 ? (
            <p className="text-white/50 text-sm">Nenhum resultado lançado</p>
          ) : (
            <div className="grid gap-3">
              {resultados.map((r) => (
                <div
                  key={r.id}
                  className={`p-4 rounded border grid grid-cols-1 md:grid-cols-5 gap-4 items-center ${
                    r.temNCGrave
                      ? 'bg-red-500/10 border-red-500/30'
                      : r.interpretacao === 'questionavel'
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium">{r.analyteName}</div>
                    <div className="text-xs text-white/60">{r.analyteId}</div>
                  </div>

                  <div className="text-sm">
                    <div className="text-white/60">Obtido</div>
                    <div className="font-medium">{r.valorObtido.toFixed(2)}</div>
                  </div>

                  <div className="text-sm">
                    <div className="text-white/60">Referência</div>
                    <div className="font-medium">{r.valorReferencia.toFixed(2)}</div>
                  </div>

                  <div className="text-sm">
                    <div className="text-white/60">Z-Score</div>
                    <div className="font-medium">{r.zScore.toFixed(2)}</div>
                  </div>

                  <div className="text-sm">
                    <div className="text-white/60">Status</div>
                    <div className="font-medium">
                      {r.temNCGrave ? '🚨 NC Grave' : r.interpretacao === 'questionavel' ? '⚠️ Questionável' : '✓ Satisfatório'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
