import { useCallback, useRef, useState } from 'react';

import { useUser } from '../../../store/useAuthStore';
import { saveResposta, uploadFotoEvidencia } from '../services/auditoriaGeralService';
import type { Indicador, RespostaIndicador } from '../types';
import { AudioRecorder } from './AudioRecorder';
import { ModuleLinkBadge } from './ModuleLinkBadge';
import { ScoreSelector } from './ScoreSelector';

interface IndicadorCardProps {
  indicador: Indicador;
  resposta: RespostaIndicador | undefined;
  labId: string;
  auditoriaId: string;
}

const MAX_FOTOS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function IndicadorCard({
  indicador,
  resposta,
  labId,
  auditoriaId,
}: IndicadorCardProps) {
  const user = useUser();
  const [obs, setObs] = useState(resposta?.observacoes ?? '');
  const [showObs, setShowObs] = useState(Boolean(resposta?.observacoes));
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleTranscription = useCallback((text: string) => {
    const updated = obs ? `${obs}\n${text}` : text;
    setObs(updated);
    setShowObs(true);
    saveResposta(labId, auditoriaId, indicador.id, {
      observacoes: updated,
      respondidoPor: user?.uid ?? null,
    });
  }, [obs, labId, auditoriaId, indicador.id, user?.uid]);

  const handleScoreChange = (score: number | null, naoAplica: boolean) => {
    saveResposta(labId, auditoriaId, indicador.id, {
      numero: indicador.numero,
      indicador: indicador.indicador,
      bloco: indicador.bloco,
      score,
      naoAplica,
      observacoes: obs,
      respondidoPor: user?.uid ?? null,
    });
  };

  const handleObsBlur = () => {
    if (obs === (resposta?.observacoes ?? '')) return;
    saveResposta(labId, auditoriaId, indicador.id, {
      observacoes: obs,
      respondidoPor: user?.uid ?? null,
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!ALLOWED_TYPES.includes(file.type)) return;
    if (file.size > MAX_FILE_SIZE) return;

    setUploading(true);
    try {
      await uploadFotoEvidencia(
        labId,
        auditoriaId,
        indicador.id,
        file,
        user.uid,
        resposta?.fotos ?? []
      );
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const fotos = resposta?.fotos ?? [];
  const canUpload = fotos.length < MAX_FOTOS;

  return (
    <div className="bg-white/[0.02] border border-white/[0.08] rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-violet-500/10 text-violet-400 text-xs font-mono font-medium">
          {indicador.numero}
        </span>
        <span className="text-sm font-medium text-white/90">
          {indicador.indicador}
        </span>
        <span className="text-[10px] text-white/50 bg-white/[0.04] px-2 py-0.5 rounded-full">
          {indicador.marcoRegulatorio}
        </span>
        <ModuleLinkBadge moduloVinculado={indicador.moduloVinculado} />
      </div>

      <ScoreSelector
        value={resposta?.score ?? null}
        naoAplica={resposta?.naoAplica ?? false}
        niveis={indicador.niveis}
        onChange={handleScoreChange}
      />

      {showObs ? (
        <textarea
          placeholder="Observacoes (opcional)"
          rows={2}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          onBlur={handleObsBlur}
          autoFocus
          className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white/70 placeholder:text-white/20 resize-none focus:outline-none focus:border-violet-500/40"
        />
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowObs(true)}
            className="text-xs text-white/50 hover:text-white/70 transition-colors"
          >
            + Adicionar nota
          </button>
          {user && (
            <AudioRecorder
              labId={labId}
              auditoriaId={auditoriaId}
              indicadorId={indicador.id}
              uid={user.uid}
              onTranscription={handleTranscription}
            />
          )}
        </div>
      )}

      {/* Fotos */}
      <div className="flex items-center gap-2 flex-wrap">
        {fotos.map((foto, i) => (
          <a
            key={i}
            href={foto.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-12 h-12 rounded-md overflow-hidden border border-white/[0.08] hover:border-violet-500/40 transition-colors"
          >
            <img src={foto.url} alt={foto.nome} className="w-full h-full object-cover" />
          </a>
        ))}
        {canUpload && (
          <label
            className={`w-12 h-12 rounded-md border border-dashed border-white/[0.12] flex items-center justify-center cursor-pointer hover:border-violet-500/40 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {uploading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-violet-400 rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
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
        )}
      </div>
    </div>
  );
}