/**
 * CEQPdfUpload — Upload de PDFs PNCQ com parsing automático
 *
 * Flow: upload → parse (Cloud Function) → preview → confirmar → dados no Firestore
 */

import { useState, useCallback, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';
import { storage, functions } from '../../../config/firebase.config';
import { useActiveLab } from '../../../store/useAuthStore';

const confirmCEQSchema = z.object({
  labId: z.string().min(1),
  reports: z.array(z.object({
    fileName: z.string(),
    especialidade: z.string(),
    mesAno: z.string(),
    loteProEx: z.string(),
    resultados: z.array(z.object({
      type: z.enum(['quantitativo', 'qualitativo']),
      constituinte: z.string(),
      conceito: z.string(),
    }).passthrough()),
  })).min(1),
  rodada: z.number().int().min(1).max(12),
  ano: z.number().int().min(2020).max(2035),
});

interface ParsedResult {
  type: 'quantitativo' | 'qualitativo';
  constituinte: string;
  conceito: string;
  valorLab?: number;
  media?: number;
  dp?: number;
}

interface ParsedReport {
  fileName: string;
  especialidade: string;
  mesAno: string;
  loteProEx: string;
  resultados: ParsedResult[];
}

type UploadState =
  | { step: 'idle' }
  | { step: 'uploading'; progress: number }
  | { step: 'parsing' }
  | { step: 'preview'; reports: ParsedReport[] }
  | { step: 'confirming' }
  | { step: 'done'; amostras: number; resultados: number; ncsGeradas: number }
  | { step: 'error'; message: string };

export function CEQPdfUpload() {
  const activeLab = useActiveLab();
  const [state, setState] = useState<UploadState>({ step: 'idle' });
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const pdfs = Array.from(fileList).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    const oversized = pdfs.filter(f => f.size > MAX_PDF_SIZE);
    if (oversized.length > 0) {
      setState({ step: 'error', message: `Arquivo(s) excede(m) 20MB: ${oversized.map(f => f.name).join(', ')}` });
      return;
    }
    setFiles(pdfs);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleUploadAndParse = async () => {
    if (!activeLab || files.length === 0) return;
    const labId = activeLab.id;

    try {
      // Upload files to Storage
      setState({ step: 'uploading', progress: 0 });
      const timestamp = Date.now();
      const storagePaths: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = `labs/${labId}/ceq-uploads/${timestamp}/${file.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        storagePaths.push(path);
        setState({ step: 'uploading', progress: Math.round(((i + 1) / files.length) * 100) });
      }

      // Call parse function
      setState({ step: 'parsing' });
      const parseFn = httpsCallable<{ labId: string; storagePaths: string[] }, { reports: ParsedReport[] }>(
        functions, 'parsePNCQReport'
      );
      const result = await parseFn({ labId, storagePaths });

      if (result.data.reports.length === 0) {
        setState({ step: 'error', message: 'Nenhum resultado encontrado nos PDFs enviados.' });
        return;
      }

      setState({ step: 'preview', reports: result.data.reports });
    } catch (e: any) {
      setState({ step: 'error', message: e.message || 'Erro ao processar PDFs.' });
    }
  };

  const handleConfirm = async () => {
    if (state.step !== 'preview' || !activeLab) return;

    try {
      setState({ step: 'confirming' });
      const now = new Date();
      const payload = {
        labId: activeLab.id,
        reports: state.reports,
        rodada: now.getMonth() + 1,
        ano: now.getFullYear(),
      };

      const validated = confirmCEQSchema.safeParse(payload);
      if (!validated.success) {
        setState({ step: 'error', message: `Dados inválidos: ${validated.error.issues[0]?.message}` });
        return;
      }

      const confirmFn = httpsCallable<typeof payload, { amostras: number; resultados: number; ncsGeradas: number }>(
        functions, 'confirmCEQResults'
      );
      const result = await confirmFn(validated.data);

      setState({ step: 'done', ...result.data });
    } catch (e: any) {
      setState({ step: 'error', message: e.message || 'Erro ao confirmar resultados.' });
    }
  };

  const reset = () => {
    setState({ step: 'idle' });
    setFiles([]);
  };

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-4">
        Upload de Relatórios PNCQ
      </h3>

      {/* Idle / File selection */}
      {state.step === 'idle' && (
        <div className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-white/10 hover:border-teal-500/40 rounded-xl p-8 text-center cursor-pointer transition-colors"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="mx-auto mb-3 text-white/30" aria-hidden>
              <path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm text-white/50">Arraste PDFs do PNCQ aqui ou clique para selecionar</p>
            <p className="text-[11px] text-white/25 mt-1">Aceita múltiplos arquivos PDF</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-white/40">{files.length} arquivo(s) selecionado(s):</p>
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <span key={i} className="text-[11px] px-2 py-1 rounded bg-white/[0.05] text-white/60 border border-white/[0.08]">
                    {f.name}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={handleUploadAndParse}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-white text-sm font-medium transition-colors"
              >
                Enviar e processar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Uploading */}
      {state.step === 'uploading' && (
        <div className="text-center py-8">
          <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden mb-3">
            <div className="h-full bg-teal-400 rounded-full transition-all" style={{ width: `${state.progress}%` }} />
          </div>
          <p className="text-sm text-white/50">Enviando arquivos... {state.progress}%</p>
        </div>
      )}

      {/* Parsing */}
      {state.step === 'parsing' && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-white/50">Processando PDFs...</p>
          <p className="text-[11px] text-white/25 mt-1">Extraindo resultados do PNCQ</p>
        </div>
      )}

      {/* Preview */}
      {state.step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/70 font-medium">
              {state.reports.length} relatório(s) · {state.reports.reduce((s, r) => s + r.resultados.length, 0)} resultado(s)
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={reset} className="text-xs text-white/40 hover:text-white/60 px-3 py-1.5 rounded border border-white/10 transition-colors">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirm} className="text-xs text-white px-3 py-1.5 rounded bg-teal-500 hover:bg-teal-400 font-medium transition-colors">
                Confirmar e gravar
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {state.reports.map((r, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.05] rounded-lg px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/80 font-medium capitalize">{r.especialidade.replace(/-/g, ' ')}</p>
                    <p className="text-[11px] text-white/35">{r.mesAno} · Lote {r.loteProEx}</p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-teal-500/10 border border-teal-500/20 text-teal-400">
                    {r.resultados.length} resultado(s)
                  </span>
                </div>
                <div className="mt-2 flex gap-1 flex-wrap">
                  {r.resultados.map((res, j) => {
                    const color = res.conceito === 'B' ? 'text-emerald-400' : res.conceito === 'A' ? 'text-amber-400' : 'text-red-400';
                    return (
                      <span key={j} className={`text-[10px] ${color}`}>
                        {res.constituinte}({res.conceito})
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirming */}
      {state.step === 'confirming' && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-white/50">Gravando resultados no Firestore...</p>
        </div>
      )}

      {/* Done */}
      {state.step === 'done' && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400" />
              <path d="M6.5 10.2l2.5 2.5L13.5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400" />
            </svg>
          </div>
          <p className="text-sm text-white/80 font-medium">Resultados gravados com sucesso</p>
          <p className="text-[11px] text-white/40 mt-1">
            {state.amostras} amostra(s) · {state.resultados} resultado(s)
            {state.ncsGeradas > 0 && <span className="text-red-400"> · {state.ncsGeradas} NC(s) gerada(s)</span>}
          </p>
          <button type="button" onClick={reset} className="mt-4 text-xs text-teal-400 hover:text-teal-300 transition-colors">
            Enviar mais relatórios
          </button>
        </div>
      )}

      {/* Error */}
      {state.step === 'error' && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-red-400" />
            </svg>
          </div>
          <p className="text-sm text-red-300 font-medium">Erro ao processar</p>
          <p className="text-[11px] text-white/40 mt-1">{state.message}</p>
          <button type="button" onClick={reset} className="mt-4 text-xs text-teal-400 hover:text-teal-300 transition-colors">
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}