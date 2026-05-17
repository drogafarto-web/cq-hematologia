import { useCallback, useEffect, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';

import { functions } from '../../../shared/services/firebase';
import { toast } from '../../../shared/store/useToastStore';
import { useUser } from '../../../store/useAuthStore';
import { saveResposta, uploadFotoEvidencia } from '../services/auditoriaGeralService';
import type { AudioEvidencia, CriticaStatus, Indicador, RespostaIndicador } from '../types';
import { AudioRecorder } from './AudioRecorder';
import { CriticaSelector } from './CriticaSelector';
import { JustificativaNA } from './JustificativaNA';
import { ModuleLinkBadge } from './ModuleLinkBadge';
import { ScoreSelectorWithRubric } from './ScoreSelectorWithRubric';
import { WebcamCaptureModal } from './WebcamCaptureModal';

interface IndicadorCardProps {
  indicador: Indicador;
  resposta: RespostaIndicador | undefined;
  labId: string;
  auditoriaId: string;
  readonly?: boolean;
}

const MAX_ANEXOS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function IndicadorCard({
  indicador,
  resposta,
  labId,
  auditoriaId,
  readonly = false,
}: IndicadorCardProps) {
  const user = useUser();
  const [obs, setObs] = useState(resposta?.observacoes ?? '');
  const [showObs, setShowObs] = useState(Boolean(resposta?.observacoes));
  const [uploading, setUploading] = useState(false);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [iaResult, setIaResult] = useState<{ veredito: string; justificativa: string; confianca: number; sugestao: string | null } | null>(null);
  const [validating, setValidating] = useState(false);
  const [showIaDetail, setShowIaDetail] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    if (resposta?.critica === 'NÃO CONFORME') {
      setShowObs(true);
    }
  }, [resposta?.critica]);

  const handleTranscription = useCallback(async (text: string) => {
    const updated = obs ? `${obs}\n${text}` : text;
    setObs(updated);
    setShowObs(true);
    try {
      await saveResposta(labId, auditoriaId, indicador.id, {
        observacoes: updated,
        respondidoPor: user?.uid ?? null,
      });
    } catch {
      toast.error('Erro ao salvar observação');
    }
  }, [obs, labId, auditoriaId, indicador.id, user?.uid]);

  const handleAudioSaved = useCallback(async (audio: AudioEvidencia) => {
    const updatedAudios = [...(resposta?.audios ?? []), audio];
    try {
      await saveResposta(labId, auditoriaId, indicador.id, {
        audios: updatedAudios,
        respondidoPor: user?.uid ?? null,
      });
    } catch {
      toast.error('Erro ao salvar áudio');
    }
  }, [resposta?.audios, labId, auditoriaId, indicador.id, user?.uid]);

  const handleScoreChange = async (score: number | null, naoAplica: boolean) => {
    if (readonly) return;
    try {
      await saveResposta(labId, auditoriaId, indicador.id, {
        numero: indicador.numero,
        indicador: indicador.indicador,
        bloco: indicador.bloco,
        score,
        naoAplica,
        observacoes: obs,
        respondidoPor: user?.uid ?? null,
      });
    } catch {
      toast.error('Erro ao salvar resposta');
    }
  };

  const handleCriticaChange = async (critica: CriticaStatus | null) => {
    if (readonly) return;
    try {
      await saveResposta(labId, auditoriaId, indicador.id, {
        critica,
        respondidoPor: user?.uid ?? null,
      });
    } catch {
      toast.error('Erro ao salvar julgamento');
    }
  };

  const handleJustificativaChange = async (justificativa: string) => {
    try {
      await saveResposta(labId, auditoriaId, indicador.id, {
        justificativaNA: justificativa,
        respondidoPor: user?.uid ?? null,
      });
    } catch {
      toast.error('Erro ao salvar justificativa');
    }
  };

  const handleObsBlur = async () => {
    if (obs === (resposta?.observacoes ?? '')) return;
    try {
      await saveResposta(labId, auditoriaId, indicador.id, {
        observacoes: obs,
        respondidoPor: user?.uid ?? null,
      });
    } catch {
      toast.error('Erro ao salvar observação');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Tipo de arquivo não suportado');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Arquivo excede 10MB');
      return;
    }

    setUploading(true);
    try {
      await uploadFotoEvidencia(
        labId,
        auditoriaId,
        indicador.id,
        file,
        user.uid,
        resposta?.fotos ?? [],
        { numero: indicador.numero, indicador: indicador.indicador, bloco: indicador.bloco }
      );
    } catch {
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleWebcamCapture = async (blob: Blob) => {
    if (!user) return;
    const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' });
    setUploading(true);
    try {
      await uploadFotoEvidencia(
        labId,
        auditoriaId,
        indicador.id,
        file,
        user.uid,
        resposta?.fotos ?? [],
        { numero: indicador.numero, indicador: indicador.indicador, bloco: indicador.bloco }
      );
    } catch {
      toast.error('Erro ao enviar foto');
    } finally {
      setUploading(false);
    }
  };

  const handleValidateIA = async () => {
    if (validating || fotos.length === 0) return;
    setValidating(true);
    setIaResult(null);
    try {
      const fn = httpsCallable<any, { veredito: string; justificativa: string; confianca: number; sugestao: string | null }>(
        functions,
        'validateEvidenciaIA',
      );
      const result = await fn({
        labId,
        auditoriaId,
        indicadorId: indicador.id,
        evidenciaUrl: fotos[0].url,
        indicadorNome: indicador.indicador,
        marcoRegulatorio: indicador.marcoRegulatorio,
        niveis: indicador.niveis,
        scoreAtual: resposta?.score ?? null,
      });
      setIaResult(result.data);
    } catch {
      toast.error('Erro ao validar com IA');
    } finally {
      setValidating(false);
    }
  };

  const fotos = resposta?.fotos ?? [];
  const canUpload = fotos.length < MAX_ANEXOS;

  return (
    <div className={`bg-white border border-slate-200 dark:bg-white/[0.02] dark:border-white/[0.08] rounded-lg p-5 space-y-4 ${readonly ? 'opacity-75' : ''}`}>
      {readonly && (
        <div className="text-[10px] text-slate-500 dark:text-white/40 bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded px-2 py-1 inline-flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          Auditoria finalizada — somente leitura
        </div>
      )}
      {/* Header: número + nome + marco regulatório */}
      <div className="flex items-start gap-3 flex-wrap">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 text-xs font-mono font-medium shrink-0">
          {indicador.numero}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-slate-900 dark:text-white/90 block">
            {indicador.indicador}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-white/40 mt-0.5 block">
            {indicador.marcoRegulatorio}
          </span>
        </div>
        <ModuleLinkBadge moduloVinculado={indicador.moduloVinculado} />
      </div>

      {/* Rubrica com todos os níveis */}
      <ScoreSelectorWithRubric
        value={resposta?.score ?? null}
        naoAplica={resposta?.naoAplica ?? false}
        niveis={indicador.niveis}
        onChange={handleScoreChange}
      />

      {/* Justificativa N/A (condicional) */}
      {resposta?.naoAplica && (
        <JustificativaNA
          value={resposta?.justificativaNA ?? null}
          onChange={handleJustificativaChange}
        />
      )}

      {/* Crítica (julgamento de conformidade) */}
      {!resposta?.naoAplica && (
        <CriticaSelector
          value={resposta?.critica ?? null}
          score={resposta?.score ?? null}
          onChange={handleCriticaChange}
        />
      )}

      {/* Observações */}
      {showObs ? (
        <div>
          <textarea
            placeholder={resposta?.critica === 'NÃO CONFORME' ? 'Justifique a não conformidade (obrigatório)' : 'Observações (opcional)'}
            rows={2}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            onBlur={handleObsBlur}
            autoFocus
            className="w-full bg-slate-50 border border-slate-200 dark:bg-white/[0.02] dark:border-white/[0.06] rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-white/70 placeholder:text-slate-400 dark:placeholder:text-white/20 resize-none focus:outline-none focus:border-violet-500/40"
          />
          {resposta?.critica === 'NÃO CONFORME' && !obs.trim() && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">Justifique a não conformidade</p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowObs(true)}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/70 transition-colors"
          >
            + Adicionar observação
          </button>
          {user && (
            <AudioRecorder
              labId={labId}
              auditoriaId={auditoriaId}
              indicadorId={indicador.id}
              uid={user.uid}
              existingAudios={resposta?.audios ?? []}
              onAudioSaved={handleAudioSaved}
              onTranscription={handleTranscription}
            />
          )}
        </div>
      )}

      {/* Anexos (fotos, PDFs, docs, xlsx) */}
      <div className="flex items-center gap-2 flex-wrap">
        {fotos.map((foto, i) => {
          const isImage = foto.nome.match(/\.(jpe?g|png|webp)$/i);
          const isPdf = foto.nome.match(/\.pdf$/i);
          const isDoc = foto.nome.match(/\.(docx?|doc)$/i);
          const isXls = foto.nome.match(/\.(xlsx?|xls)$/i);

          return (
            <a
              key={i}
              href={foto.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 rounded-md overflow-hidden border border-slate-200 dark:border-white/[0.08] hover:border-violet-500/40 transition-colors flex items-center justify-center bg-slate-50 dark:bg-white/[0.02]"
              title={foto.nome}
            >
              {isImage ? (
                <img src={foto.url} alt={foto.nome} className="w-full h-full object-cover" />
              ) : isPdf ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M9 15h6M9 11h6" />
                </svg>
              ) : isDoc ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M9 13h6M9 17h4" />
                </svg>
              ) : isXls ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M9 13l6 6M15 13l-6 6" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" />
                </svg>
              )}
            </a>
          );
        })}
        {canUpload && (
          <>
            <label
              className={`w-12 h-12 rounded-md border border-dashed border-slate-300 dark:border-white/[0.12] flex items-center justify-center cursor-pointer hover:border-violet-500/40 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              title="Enviar arquivo (imagem, PDF, doc, xlsx)"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-slate-200 dark:border-white/20 border-t-violet-400 rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400 dark:text-white/40">
                  <path d="M8 3v10M3 8h10" />
                </svg>
              )}
              <input
                ref={fileRef}
                type="file"
                hidden
                accept={ALLOWED_TYPES.join(',')}
                onChange={handleFileChange}
              />
            </label>
            {isMobile ? (
              <label
                className={`w-12 h-12 rounded-md border border-dashed border-slate-300 dark:border-white/[0.12] flex items-center justify-center cursor-pointer hover:border-emerald-500/40 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                title="Tirar foto"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400 dark:text-white/40">
                  <rect x="2" y="4" width="12" height="9" rx="2" />
                  <circle cx="8" cy="8.5" r="2.5" />
                  <path d="M5.5 4L6.5 2h3l1 2" />
                </svg>
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                />
              </label>
            ) : (
              <button
                type="button"
                onClick={() => setWebcamOpen(true)}
                className={`w-12 h-12 rounded-md border border-dashed border-slate-300 dark:border-white/[0.12] flex items-center justify-center hover:border-emerald-500/40 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
                title="Tirar foto (webcam)"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400 dark:text-white/40">
                  <rect x="2" y="4" width="12" height="9" rx="2" />
                  <circle cx="8" cy="8.5" r="2.5" />
                  <path d="M5.5 4L6.5 2h3l1 2" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>

      {/* Validação IA */}
      {fotos.length > 0 && !readonly && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleValidateIA}
            disabled={validating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-500/10 dark:hover:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/20 transition-colors disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
              <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 16.4 5.7 21l2.3-7L2 9.4h7.6z" />
            </svg>
            {validating ? 'Validando...' : iaResult ? 'Revalidar IA' : 'Validar com IA'}
          </button>

          {iaResult && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setShowIaDetail((v) => !v)}
                className="inline-flex items-center gap-1.5"
              >
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  iaResult.veredito === 'adequada' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                  iaResult.veredito === 'parcial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400' :
                  iaResult.veredito === 'inadequada' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                  'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-white/60'
                }`}>
                  IA: {iaResult.veredito.charAt(0).toUpperCase() + iaResult.veredito.slice(1)}
                  {iaResult.confianca < 0.7 && ' (baixa confiança)'}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-slate-400 transition-transform ${showIaDetail ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showIaDetail && (
                <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-white/60 space-y-1">
                  <p>{iaResult.justificativa}</p>
                  {iaResult.sugestao && (
                    <p className="text-violet-600 dark:text-violet-400">Sugestão: {iaResult.sugestao}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <WebcamCaptureModal
        open={webcamOpen}
        onCapture={handleWebcamCapture}
        onClose={() => setWebcamOpen(false)}
      />
    </div>
  );
}
