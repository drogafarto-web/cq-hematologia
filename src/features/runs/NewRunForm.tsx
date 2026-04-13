import React, { useRef, useState } from 'react';

// ─── Icons ────────────────────────────────────────────────────────────────────

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M2 8a2 2 0 012-2h1.5l1.5-2h6l1.5 2H18a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V8z"
        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
      />
      <circle cx="11" cy="12" r="3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M10 13V4M10 4L7 7M10 4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 14v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface NewRunFormProps {
  onFile:      (file: File) => Promise<void>;
  isExtracting: boolean;
  error:        string | null;
  disabled?:    boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * NewRunForm — drag-drop / click zone for submitting a new run image.
 *
 * On mobile, the camera input triggers the device camera.
 * On desktop, any image file can be dropped or selected.
 */
export function NewRunForm({ onFile, isExtracting, error, disabled }: NewRunFormProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    onFile(files[0]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (!disabled && !isExtracting) handleFiles(e.dataTransfer.files);
  }

  const isDisabled = disabled || isExtracting;

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!isDisabled) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center gap-3 rounded-2xl
          border border-dashed px-6 py-8 transition-all
          ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isDragging
            ? 'border-violet-500/70 bg-violet-500/[0.08]'
            : 'border-white/[0.1] bg-white/[0.02] hover:border-white/[0.2] hover:bg-white/[0.04]'}
        `}
      >
        {isExtracting ? (
          <>
            <div className="text-violet-400"><Spinner /></div>
            <div className="text-center">
              <p className="text-sm font-medium text-white/80">Analisando imagem…</p>
              <p className="text-xs text-white/35 mt-0.5">IA extraindo valores do equipamento</p>
            </div>
          </>
        ) : (
          <>
            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all ${isDragging ? 'border-violet-500/40 text-violet-400 bg-violet-500/10' : 'border-white/[0.1] text-white/35 bg-white/[0.04]'}`}>
              <CameraIcon />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-white/70">
                {isDragging ? 'Solte para analisar' : 'Foto do Yumizen H550'}
              </p>
              <p className="text-xs text-white/30 mt-0.5">
                Arraste uma imagem ou use os botões abaixo
              </p>
            </div>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* Camera input — on mobile opens device camera */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => cameraRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm text-white font-medium disabled:opacity-50 transition-all shadow-lg shadow-violet-500/20"
        >
          <CameraIcon />
          Câmera
        </button>

        {/* File picker — any image */}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.1] text-sm text-white/50 hover:text-white/80 hover:border-white/[0.2] disabled:opacity-50 transition-all"
        >
          <UploadIcon />
          Arquivo
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400/90 bg-red-500/[0.07] border border-red-500/[0.15] rounded-lg px-3 py-2.5">
          {error}
        </p>
      )}
    </div>
  );
}
