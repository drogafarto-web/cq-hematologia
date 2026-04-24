import { useRef, useState } from 'react';

import { useColaboradores } from '../hooks/useColaboradores';
import {
  downloadColaboradoresTemplate,
  parseColaboradoresXlsx,
  type ParseResult,
} from '../services/ecImportService';
import type { ColaboradorInput } from '../types/EducacaoContinuada';

export interface ImportColaboradoresModalProps {
  onClose: () => void;
  /** Disparado quando ≥ 1 colaborador foi criado (consumidor fecha o modal). */
  onImported: (quantity: number) => void;
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'parsing' }
  | { kind: 'preview'; result: ParseResult<ColaboradorInput>; fileName: string }
  | { kind: 'importing'; done: number; total: number }
  | { kind: 'done'; imported: number; failed: number; errors: string[] }
  | { kind: 'error'; message: string };

export function ImportColaboradoresModal({
  onClose,
  onImported,
}: ImportColaboradoresModalProps) {
  const { create } = useColaboradores();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File): Promise<void> => {
    setPhase({ kind: 'parsing' });
    try {
      const result = await parseColaboradoresXlsx(file);
      setPhase({ kind: 'preview', result, fileName: file.name });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler arquivo.';
      setPhase({ kind: 'error', message: msg });
    }
  };

  const handleImport = async (): Promise<void> => {
    if (phase.kind !== 'preview') return;
    const rows = phase.result.ok;
    setPhase({ kind: 'importing', done: 0, total: rows.length });

    let done = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        await create(row.input);
        done++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Linha ${row.linha}: ${msg}`);
      }
      setPhase({ kind: 'importing', done: done + failed, total: rows.length });
    }

    setPhase({ kind: 'done', imported: done, failed, errors });
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
        aria-labelledby="import-colab-title"
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-slate-800 bg-slate-950 shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex flex-col gap-0.5">
            <h2 id="import-colab-title" className="text-base font-semibold text-slate-100">
              Importar colaboradores XLSX
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
            <ImportingState done={phase.done} total={phase.total} />
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
            onClick={() => downloadColaboradoresTemplate()}
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
                Importar {phase.result.ok.length} colaborador(es)
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
          aria-label="Arquivo XLSX de colaboradores"
        />
      </div>

      <div className="rounded-md border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
        <p className="mb-1 font-medium text-slate-300">Formato esperado:</p>
        <p>
          4 colunas — Nome, Cargo, Setor, Ativo. A aba "Instruções" do modelo
          lista os valores aceitos.
        </p>
      </div>
    </div>
  );
}

function PreviewState({
  result,
  fileName,
}: {
  result: ParseResult<ColaboradorInput>;
  fileName: string;
}) {
  const hasErrors = result.errors.length > 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm">
        <span className="text-slate-400">Arquivo:</span>
        <span className="truncate font-medium text-slate-200">{fileName}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Linhas encontradas" value={result.total} tone="slate" />
        <Stat label="Válidas" value={result.ok.length} tone="emerald" />
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
                <span className="font-medium">{r.input.nome}</span>{' '}
                <span className="text-slate-500">
                  · {r.input.cargo} · {r.input.setor}
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

function ImportingState({ done, total }: { done: number; total: number }) {
  return (
    <div className="flex flex-col gap-3 py-6">
      <p className="text-center text-sm text-slate-300">
        Criando colaboradores… {done}/{total}
      </p>
      <progress
        value={done}
        max={Math.max(total, 1)}
        aria-label="Progresso da importação"
        className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-emerald-500 [&::-webkit-progress-bar]:bg-slate-800 [&::-webkit-progress-value]:bg-emerald-500 [&::-webkit-progress-value]:transition-all"
      />
    </div>
  );
}

function DoneState({ state }: { state: Extract<Phase, { kind: 'done' }> }) {
  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex items-center justify-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
        {state.imported} colaborador(es) criado(s).
        {state.failed > 0 && ` ${state.failed} falhou(aram).`}
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
