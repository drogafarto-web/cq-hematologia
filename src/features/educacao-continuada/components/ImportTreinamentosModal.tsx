import { useRef, useState } from 'react';

import { useExecucoes } from '../hooks/useExecucoes';
import { useTreinamentos } from '../hooks/useTreinamentos';
import {
  downloadTemplate,
  parseTreinamentosXlsx,
  type TreinamentoParseResult,
} from '../services/ecImportService';
import { Timestamp, functions, httpsCallable } from '../../../shared/services/firebase';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';

// ─── ec_mintSignature wire (Fase 0b — assinatura server-side em lote) ───────
interface MintWire {
  labId: string;
  payloads: Array<Record<string, string | number>>;
}
interface MintResp {
  signatures: Array<{ hash: string; operatorId: string; tsMillis: number }>;
}
const callMintSignature = httpsCallable<MintWire, MintResp>(functions, 'ec_mintSignature');

export interface ImportTreinamentosModalProps {
  onClose: () => void;
  /** Disparado quando ≥ 1 treinamento foi criado (consumidor fecha o modal). */
  onImported: (quantity: number) => void;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'parsing' }
  | { kind: 'preview'; result: TreinamentoParseResult; fileName: string }
  | { kind: 'importing'; done: number; total: number; execucoesDone: number }
  | {
      kind: 'done';
      imported: number;
      failed: number;
      execucoesImported: number;
      errors: string[];
    }
  | { kind: 'error'; message: string };

export function ImportTreinamentosModal({ onClose, onImported }: ImportTreinamentosModalProps) {
  const { create } = useTreinamentos();
  const { create: createExecucao } = useExecucoes({});
  const user = useUser();
  const labId = useActiveLabId();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File): Promise<void> => {
    setPhase({ kind: 'parsing' });
    try {
      const result = await parseTreinamentosXlsx(file);
      setPhase({ kind: 'preview', result, fileName: file.name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler arquivo.';
      setPhase({ kind: 'error', message: msg });
    }
  };

  const handleImport = async (): Promise<void> => {
    if (phase.kind !== 'preview') return;
    if (!user) {
      setPhase({ kind: 'error', message: 'Usuário não autenticado — recarregue a página.' });
      return;
    }
    if (!labId) {
      setPhase({ kind: 'error', message: 'Sem laboratório ativo — recarregue a página.' });
      return;
    }
    const rows = phase.result.ok;
    setPhase({ kind: 'importing', done: 0, total: rows.length, execucoesDone: 0 });

    let done = 0;
    let failed = 0;
    let execucoesDone = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const treinamentoId = await create(row.input);
        done++;

        // Pre-mint todas as assinaturas desta linha em uma única callable
        // (1 round-trip em vez de N). Falha do mint aborta as execuções desta
        // linha mas não as outras linhas — log + continua.
        if (row.datasPlanejadas.length > 0) {
          let signatures: MintResp['signatures'] = [];
          try {
            const payloads = row.datasPlanejadas.map((date) => ({
              treinamentoId,
              dataPlanejada: Timestamp.fromDate(date).toMillis(),
              status: 'planejado',
            }));
            const mintResp = await callMintSignature({ labId, payloads });
            signatures = mintResp.data.signatures;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Linha ${row.linha} — mint de assinaturas: ${msg}`);
          }

          for (let i = 0; i < row.datasPlanejadas.length; i++) {
            const date = row.datasPlanejadas[i];
            const sig = signatures[i];
            if (!sig) continue; // mint falhou; já logado
            try {
              const dataPlanejada = Timestamp.fromDate(date);
              await createExecucao({
                treinamentoId,
                dataPlanejada,
                dataAplicacao: null,
                ministrante: row.input.responsavel,
                pauta: row.input.tema,
                status: 'planejado',
                assinatura: {
                  hash: sig.hash,
                  operatorId: sig.operatorId,
                  ts: Timestamp.fromMillis(sig.tsMillis),
                },
              });
              execucoesDone++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              errors.push(
                `Linha ${row.linha} — execução ${date.toLocaleDateString('pt-BR')}: ${msg}`,
              );
            }
          }
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Linha ${row.linha}: ${msg}`);
      }
      setPhase({
        kind: 'importing',
        done: done + failed,
        total: rows.length,
        execucoesDone,
      });
    }

    setPhase({
      kind: 'done',
      imported: done,
      failed,
      execucoesImported: execucoesDone,
      errors,
    });
    if (done > 0) onImported(done);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleFilePick = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-slate-800 bg-slate-950 shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 id="import-title" className="text-base font-semibold text-slate-100">
              Importar cronograma XLSX
            </h2>
            <p className="text-xs text-slate-400">
              Baixe o modelo, preencha as linhas e envie de volta.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            Fechar
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {phase.kind === 'idle' && (
            <IdleState
              fileInputRef={fileInputRef}
              onDrop={handleDrop}
              onPick={handleFilePick}
            />
          )}

          {phase.kind === 'parsing' && (
            <p className="py-10 text-center text-sm text-slate-400">Lendo arquivo…</p>
          )}

          {phase.kind === 'preview' && (
            <PreviewState result={phase.result} fileName={phase.fileName} />
          )}

          {phase.kind === 'importing' && (
            <ImportingState
              done={phase.done}
              total={phase.total}
              execucoesDone={phase.execucoesDone}
            />
          )}

          {phase.kind === 'done' && <DoneState state={phase} />}

          {phase.kind === 'error' && (
            <p
              role="alert"
              className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-3 text-sm text-red-300"
            >
              {phase.message}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-800 px-6 py-4">
          <button
            type="button"
            onClick={() => downloadTemplate()}
            className="text-sm text-slate-400 hover:text-emerald-300"
          >
            Baixar modelo.xlsx
          </button>
          <div className="flex items-center gap-2">
            {phase.kind === 'preview' && phase.result.ok.length > 0 && (
              <button
                type="button"
                onClick={handleImport}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Importar {phase.result.ok.length} treinamento(s)
              </button>
            )}
            {phase.kind === 'done' && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Concluir
              </button>
            )}
            {(phase.kind === 'idle' || phase.kind === 'preview' || phase.kind === 'error') && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ─── Sub-estados ─────────────────────────────────────────────────────────────

interface IdleStateProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onPick: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

function IdleState({ fileInputRef, onDrop, onPick }: IdleStateProps) {
  return (
    <div className="flex flex-col gap-4">
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-700 bg-slate-900/40 py-12 text-center"
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
          <path
            d="M8 24h16M16 4v16M10 10l6-6 6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-slate-500"
          />
        </svg>
        <p className="text-sm text-slate-300">Arraste o XLSX aqui ou</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
        >
          selecionar arquivo
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onPick}
          className="hidden"
          aria-label="Arquivo XLSX do cronograma"
        />
      </div>

      <div className="rounded-md border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
        <p className="mb-1 font-medium text-slate-300">Formato esperado:</p>
        <p>
          9 colunas — Título, Tema, Carga (h), Modalidade, Unidade, Responsável,
          Periodicidade, Ativo, Datas Planejadas. A coluna "Datas Planejadas" é
          opcional (DD/MM/AAAA separadas por <code>;</code>) e cria execuções
          no cronograma. A aba "Instruções" do modelo lista os valores aceitos.
        </p>
      </div>
    </div>
  );
}

function PreviewState({
  result,
  fileName,
}: {
  result: TreinamentoParseResult;
  fileName: string;
}) {
  const hasErrors = result.errors.length > 0;
  const totalExecucoes = result.ok.reduce((sum, r) => sum + r.datasPlanejadas.length, 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm">
        <span className="text-slate-400">Arquivo:</span>
        <span className="truncate font-medium text-slate-200">{fileName}</span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Stat label="Linhas" value={result.total} tone="slate" />
        <Stat label="Válidas" value={result.ok.length} tone="emerald" />
        <Stat label="Execuções" value={totalExecucoes} tone="emerald" />
        <Stat label="Com erro" value={result.errors.length} tone={hasErrors ? 'red' : 'slate'} />
      </div>

      {hasErrors && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-red-300">
            Erros ({result.errors.length})
          </h3>
          <ul className="max-h-48 overflow-y-auto rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200">
            {result.errors.map((e, i) => (
              <li key={i} className="py-0.5">
                <span className="font-mono text-red-300">Linha {e.linha}</span>
                {e.coluna && <span className="text-red-400"> · {e.coluna}</span>}
                {' — '}
                {e.mensagem}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400">
            Corrija o arquivo e envie novamente, ou importe apenas as linhas válidas (os erros serão ignorados).
          </p>
        </div>
      )}

      {result.ok.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            Preview ({result.ok.length})
          </h3>
          <ul className="max-h-56 overflow-y-auto rounded-md border border-slate-800 bg-slate-900/40 p-2 text-xs">
            {result.ok.slice(0, 30).map((r) => (
              <li key={r.linha} className="truncate py-0.5 text-slate-300">
                <span className="text-slate-500">L{r.linha}</span> ·{' '}
                <span className="font-medium">{r.input.titulo}</span>{' '}
                <span className="text-slate-500">
                  · {r.input.periodicidade} · {r.input.cargaHoraria}h
                  {r.datasPlanejadas.length > 0
                    ? ` · ${r.datasPlanejadas.length} execução(ões)`
                    : ' · sem datas'}
                </span>
              </li>
            ))}
            {result.ok.length > 30 && (
              <li className="py-0.5 text-slate-500">… + {result.ok.length - 30} outros</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function ImportingState({
  done,
  total,
  execucoesDone,
}: {
  done: number;
  total: number;
  execucoesDone: number;
}) {
  return (
    <div className="flex flex-col gap-3 py-6">
      <p className="text-center text-sm text-slate-300">
        Criando treinamentos… {done}/{total}
      </p>
      <progress
        value={done}
        max={Math.max(total, 1)}
        aria-label="Progresso da importação"
        className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-emerald-500 [&::-webkit-progress-bar]:bg-slate-800 [&::-webkit-progress-value]:bg-emerald-500 [&::-webkit-progress-value]:transition-all"
      />
      <p className="text-center text-xs text-slate-500">
        {execucoesDone} execução(ões) planejada(s) criada(s)
      </p>
    </div>
  );
}

function DoneState({ state }: { state: Extract<Phase, { kind: 'done' }> }) {
  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
        <span>
          {state.imported} treinamento(s) criado(s).
          {state.failed > 0 && ` ${state.failed} falhou(aram).`}
        </span>
        {state.execucoesImported > 0 && (
          <span className="text-xs text-emerald-400/80">
            {state.execucoesImported} execução(ões) planejada(s) no cronograma.
          </span>
        )}
      </div>
      {state.errors.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200">
          {state.errors.map((e, i) => (
            <li key={i} className="py-0.5">{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'slate' | 'emerald' | 'red';
}) {
  const text =
    tone === 'emerald' ? 'text-emerald-300'
      : tone === 'red' ? 'text-red-300'
      : 'text-slate-200';
  return (
    <div className="flex flex-col gap-1 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className={`text-lg font-semibold ${text}`}>{value}</span>
    </div>
  );
}

