/**
 * Modal de publicação oficial de documento SGQ.
 *
 * Fluxo: escolha major/minor → PIN RT → Cloud Function → snapshot PDF + transição vigente + audit.
 * Sistema sugere tipo baseado em diff % do conteúdo.
 */

import { useState, useEffect } from 'react';

import type { TipoAlteracao } from '../types/Documento';
import { formatVersao, incrementVersao } from '../types/Documento';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface PublicarDocumentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  documento: {
    id: string;
    codigo: string;
    titulo: string;
    versao: string;
    googleDocId?: string;
  };
  onPublicar: (pin: string, tipoAlteracao: TipoAlteracao, razao?: string) => Promise<void>;
  diffSugestao?: { percent: number; sugestao: TipoAlteracao } | null;
}

type ProgressState = 'idle' | 'publishing' | 'success' | 'error';

// ─── Component ──────────────────────────────────────────────────────────────

export function PublicarDocumentoModal({
  isOpen,
  onClose,
  documento,
  onPublicar,
  diffSugestao,
}: PublicarDocumentoModalProps) {
  const [pin, setPin] = useState('');
  const [razao, setRazao] = useState('');
  const [tipoAlteracao, setTipoAlteracao] = useState<TipoAlteracao>('minor');
  const [progress, setProgress] = useState<ProgressState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (diffSugestao) {
      setTipoAlteracao(diffSugestao.sugestao);
    }
  }, [diffSugestao]);

  if (!isOpen) return null;

  const canSubmit = pin.length === 4 && progress === 'idle' && razao.trim().length >= 10;
  const novaVersao = incrementVersao(documento.versao, tipoAlteracao);

  async function handlePublicar() {
    if (!canSubmit) return;
    setProgress('publishing');
    setErrorMsg('');
    try {
      await onPublicar(pin, tipoAlteracao, razao.trim() || undefined);
      setProgress('success');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Erro ao publicar documento.');
      setProgress('error');
    }
  }

  function handleClose() {
    setPin('');
    setRazao('');
    setTipoAlteracao('minor');
    setProgress('idle');
    setErrorMsg('');
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 rounded-lg border border-white/10 bg-[#141417] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-base font-semibold text-white">Publicar Documento Oficial</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-white/40 hover:text-white/80 transition-colors"
            aria-label="Fechar"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">
          {/* Document preview card */}
          <div className="rounded-md border border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <p className="text-xs text-white/40 mb-1">Documento</p>
            <p className="text-sm text-white/90 font-medium">
              <span className="font-mono text-white/60">{documento.codigo}</span>
              {' — '}
              {documento.titulo}
            </p>
            <p className="text-xs text-white/40 mt-1">
              Versão atual: {formatVersao(documento.versao)}
            </p>
          </div>

          {/* Success state */}
          {progress === 'success' ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-emerald-400"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm text-emerald-300 font-medium">
                Documento publicado com sucesso
              </p>
              <p className="text-xs text-white/40 text-center">
                Nova versão {formatVersao(novaVersao)} está agora VIGENTE.
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-2 px-4 py-2 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              >
                Fechar
              </button>
            </div>
          ) : (
            <>
              {/* Tipo de alteração */}
              <div>
                <label className="block text-xs text-white/50 mb-2">Tipo de alteração</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoAlteracao('minor')}
                    className={`flex flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors ${
                      tipoAlteracao === 'minor'
                        ? 'border-violet-500/40 bg-violet-500/10'
                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
                    }`}
                  >
                    <span
                      className={`text-xs font-semibold ${tipoAlteracao === 'minor' ? 'text-violet-300' : 'text-white/70'}`}
                    >
                      Correção / Ajuste
                    </span>
                    <span className="text-[10px] text-white/40 mt-0.5">
                      {formatVersao(documento.versao)} →{' '}
                      {formatVersao(incrementVersao(documento.versao, 'minor'))}
                    </span>
                    <span className="text-[10px] text-white/30 mt-1">Nomes, typos, formatação</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoAlteracao('major')}
                    className={`flex flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors ${
                      tipoAlteracao === 'major'
                        ? 'border-violet-500/40 bg-violet-500/10'
                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
                    }`}
                  >
                    <span
                      className={`text-xs font-semibold ${tipoAlteracao === 'major' ? 'text-violet-300' : 'text-white/70'}`}
                    >
                      Revisão Estrutural
                    </span>
                    <span className="text-[10px] text-white/40 mt-0.5">
                      {formatVersao(documento.versao)} →{' '}
                      {formatVersao(incrementVersao(documento.versao, 'major'))}
                    </span>
                    <span className="text-[10px] text-white/30 mt-1">Método, escopo, fluxo</span>
                  </button>
                </div>

                {/* Sugestão do sistema */}
                {diffSugestao && (
                  <div className="mt-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <p className="text-[10px] text-white/40">
                      <span className="text-white/50 font-medium">Sugestão do sistema:</span>{' '}
                      {diffSugestao.percent.toFixed(0)}% do conteúdo alterado →{' '}
                      <span
                        className={
                          diffSugestao.sugestao === 'major' ? 'text-amber-300' : 'text-emerald-300'
                        }
                      >
                        {diffSugestao.sugestao === 'major'
                          ? 'Revisão Estrutural'
                          : 'Correção/Ajuste'}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Razão (obrigatória) */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  Motivo da revisão <span className="text-white/30">(mín. 10 caracteres)</span>
                </label>
                <textarea
                  value={razao}
                  onChange={(e) => setRazao(e.target.value)}
                  placeholder="Ex: Atualização de responsável técnico / Revisão anual do método"
                  rows={2}
                  className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 resize-none"
                  disabled={progress !== 'idle'}
                />
                {razao.length > 0 && razao.trim().length < 10 && (
                  <p className="text-[10px] text-amber-400/70 mt-1">
                    {10 - razao.trim().length} caracteres restantes
                  </p>
                )}
              </div>

              {/* PIN RT */}
              <div>
                <label className="block text-xs text-white/50 mb-1.5">
                  PIN do Responsável Técnico
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 font-mono tracking-[0.3em] text-center"
                  disabled={progress !== 'idle'}
                  autoComplete="off"
                />
                <p className="text-[10px] text-white/30 mt-1">4 dígitos numéricos</p>
              </div>

              {/* Error */}
              {progress === 'error' && (
                <div className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2">
                  <p className="text-xs text-red-300">{errorMsg}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-colors"
                  disabled={progress === 'publishing'}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handlePublicar}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-md bg-violet-600 hover:bg-violet-700 text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {progress === 'publishing' ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Publicando...
                    </>
                  ) : (
                    <>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                      Publicar como {formatVersao(novaVersao)}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
