import { useCallback, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';

import { functions } from '../../../shared/services/firebase';
import { uploadAudio } from '../services/audioService';

type RecordingState = 'idle' | 'recording' | 'processing' | 'done';

interface Props {
  labId: string;
  auditoriaId: string;
  indicadorId: string;
  uid: string;
  onTranscription: (text: string) => void;
}

export function AudioRecorder({ labId, auditoriaId, indicadorId, uid, onTranscription }: Props) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) {
          setState('idle');
          return;
        }

        setState('processing');
        try {
          const { path } = await uploadAudio(labId, auditoriaId, indicadorId, blob, uid);
          const transcribe = httpsCallable<
            { labId: string; auditoriaId: string; indicadorId: string; audioPath: string },
            { transcription: string }
          >(functions, 'transcribeAuditoriaAudio');
          const result = await transcribe({ labId, auditoriaId, indicadorId, audioPath: path });
          onTranscription(result.data.transcription);
          setState('done');
          setTimeout(() => setState('idle'), 2000);
        } catch (err) {
          setError('Falha na transcricao');
          setState('idle');
          console.error('Transcription error:', err);
        }
      };

      mediaRecorder.start(1000);
      setState('recording');
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      setError('Microfone nao disponivel');
      setState('idle');
    }
  }, [labId, auditoriaId, indicadorId, uid, onTranscription]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (state === 'processing') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-white/50">
        <div className="w-3 h-3 border-2 border-white/20 border-t-violet-400 rounded-full animate-spin" />
        Transcrevendo...
      </span>
    );
  }

  if (state === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8.5l3.5 3.5 6.5-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Transcrito
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {state === 'recording' ? (
        <>
          <button
            type="button"
            onClick={stopRecording}
            className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center hover:bg-red-500/30 transition-colors"
            aria-label="Parar gravacao"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
          </button>
          <span className="text-[11px] text-red-400 font-mono tabular-nums">{formatTime(duration)}</span>
        </>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          className="w-7 h-7 rounded-full bg-white/[0.04] flex items-center justify-center hover:bg-white/[0.08] transition-colors"
          aria-label="Gravar audio"
          title="Gravar nota de voz"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/50">
            <rect x="5" y="1" width="6" height="9" rx="3" />
            <path d="M3 7v1a5 5 0 0010 0V7M8 13v2" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {error && <span className="text-[10px] text-red-400">{error}</span>}
    </span>
  );
}
