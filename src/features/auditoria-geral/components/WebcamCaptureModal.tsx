import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

type CameraState = 'loading' | 'ready' | 'preview' | 'error';

export function WebcamCaptureModal({ open, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>('loading');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setState('loading');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    if (open) {
      startCamera();
    }
    return () => {
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [open, startCamera, stopStream]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setState('preview');
        stopStream();
      },
      'image/jpeg',
      0.85,
    );
  }, [stopStream]);

  const retake = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    startCamera();
  }, [previewUrl, startCamera]);

  const confirm = useCallback(() => {
    if (blobRef.current) {
      onCapture(blobRef.current);
    }
    onClose();
  }, [onCapture, onClose]);

  const handleClose = useCallback(() => {
    stopStream();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setState('loading');
    onClose();
  }, [stopStream, previewUrl, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Captura de foto"
    >
      <div className="relative w-full max-w-2xl mx-4">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          aria-label="Fechar câmera"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
          {state === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/20 border-t-violet-400 rounded-full animate-spin" />
            </div>
          )}

          {state === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18.36 5.64a9 9 0 11-12.73 0M12 9v4M12 17h.01" strokeLinecap="round" />
              </svg>
              <span className="text-sm">Câmera não disponível</span>
              <button
                type="button"
                onClick={startCamera}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          )}

          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${state === 'preview' ? 'hidden' : ''}`}
            playsInline
            muted
          />

          {state === 'preview' && previewUrl && (
            <img src={previewUrl} alt="Preview da captura" className="w-full h-full object-cover" />
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="flex items-center justify-center gap-4 mt-4">
          {state === 'ready' && (
            <button
              type="button"
              onClick={capture}
              className="w-16 h-16 rounded-full border-4 border-white/80 bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
              aria-label="Tirar foto"
            >
              <span className="w-12 h-12 rounded-full bg-white" />
            </button>
          )}

          {state === 'preview' && (
            <>
              <button
                type="button"
                onClick={retake}
                className="px-5 py-2.5 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
              >
                Refazer
              </button>
              <button
                type="button"
                onClick={confirm}
                className="px-5 py-2.5 rounded-lg bg-violet-500 text-white text-sm hover:bg-violet-400 transition-colors"
              >
                Usar foto
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
