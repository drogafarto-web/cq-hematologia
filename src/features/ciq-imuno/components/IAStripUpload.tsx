/**
 * IAStripUpload — Drag-drop upload component for immunoassay strip images
 *
 * Features:
 * - Drag-and-drop or click-to-select
 * - File size validation (8 MB cap)
 * - Image preview (240×240 object-fit:cover)
 * - Analisar button calls geminiStripParser callable
 * - Result panel with confidence bars
 * - Error state with retry
 *
 * LGPD: No patient identifiers in image. Consent gate in IAFeedbackLoop.
 */

import React, { useState, useCallback, useRef } from 'react';
import { httpsCallable, getFunctions } from 'firebase/functions';

export interface StripParseResult {
  analytes: Array<{
    name: string;
    value: number;
    unit: string;
    confidence: number;
  }>;
  rawJson: string;
  modelVersion: string;
}

interface Props {
  labId: string;
  expectedAnalytes: string[];
  onParsed?: (result: StripParseResult) => void;
}

const MAX_FILE_SIZE_MB = 8;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function IAStripUpload({ labId, expectedAnalytes, onParsed }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StripParseResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate file
  const validateFile = useCallback((f: File): string | null => {
    if (!f.type.startsWith('image/')) {
      return 'Arquivo deve ser uma imagem (PNG ou JPEG)';
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      return `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE_MB} MB`;
    }
    return null;
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(
    (f: File) => {
      const validationError = validateFile(f);
      if (validationError) {
        setError(validationError);
        return;
      }

      setFile(f);
      setError(null);
      setResult(null);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(f);
    },
    [validateFile]
  );

  // Drag handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  // Handle click-to-select
  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        handleFileSelect(e.target.files[0]);
      }
    },
    [handleFileSelect]
  );

  // Call Gemini parser
  const handleAnalyze = useCallback(async () => {
    if (!file || !labId) {
      setError('Arquivo e lab ID obrigatórios');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Base64 encode image
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = (e.target?.result as string).split(',')[1];
          const functions = getFunctions();
          const geminiStripParser = httpsCallable<
            { labId: string; imageBase64: string; expectedAnalytes: string[] },
            StripParseResult
          >(functions, 'geminiStripParser');

          const response = await geminiStripParser({
            labId,
            imageBase64: base64,
            expectedAnalytes,
          });

          setResult(response.data);
          onParsed?.(response.data);
        } catch (err: any) {
          setError(
            err.message || 'Falha ao analisar imagem via Gemini'
          );
        } finally {
          setIsLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setIsLoading(false);
    }
  }, [file, labId, expectedAnalytes, onParsed]);

  // Cleanup preview
  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Respect prefers-reduced-motion
  const supportsReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  return (
    <div className="space-y-4">
      {/* Drag-drop zone or error/result panel */}
      {!result && !error && !file ? (
        // Drag-drop area
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              e.preventDefault();
              handleClick();
            }
          }}
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            isDragOver && !supportsReducedMotion
              ? 'bg-violet-500/10 border-violet-500/50'
              : 'bg-white/5 border-white/20 hover:border-white/30'
          }`}
          aria-label="Arrastar imagem de tira ou clicar para selecionar"
        >
          <div className="space-y-3">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center text-2xl">
                📸
              </div>
            </div>
            <div>
              <p className="text-white font-medium">Arrastar tira imunológica aqui</p>
              <p className="text-white/50 text-sm mt-1">ou clicar para selecionar</p>
            </div>
            <p className="text-white/40 text-xs">
              PNG ou JPEG, máximo {MAX_FILE_SIZE_MB} MB
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={handleInputChange}
            aria-label="Selecionar arquivo de imagem"
          />
        </div>
      ) : null}

      {/* File preview */}
      {file && preview && !result && (
        <div className="space-y-3">
          <div className="relative inline-block">
            <img
              src={preview}
              alt="Prévia da tira"
              className="h-60 w-60 rounded-lg object-cover border border-white/10"
            />
          </div>
          <div className="space-y-2">
            <p className="text-white/70 text-sm">
              <span className="font-medium">Arquivo:</span> {file.name}
            </p>
            <p className="text-white/70 text-sm">
              <span className="font-medium">Tamanho:</span>{' '}
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>
      )}

      {/* Analyze button */}
      {file && !result && (
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              setFile(null);
              setPreview(null);
              setError(null);
            }}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !file}
            aria-busy={isLoading}
            className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141417] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 rounded-full bg-white/50 animate-pulse" />
                Analisando...
              </span>
            ) : (
              'Analisar'
            )}
          </button>
        </div>
      )}

      {/* Result panel */}
      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-emerald-300 text-sm font-medium">
              ✓ Análise concluída com sucesso
            </p>
            <p className="text-white/50 text-xs mt-1">
              Modelo: {result.modelVersion}
            </p>
          </div>

          {/* Results table */}
          {result.analytes.length > 0 && (
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 text-left text-white/70 font-medium">Analito</th>
                    <th className="px-4 py-3 text-right text-white/70 font-medium">Valor</th>
                    <th className="px-4 py-3 text-left text-white/70 font-medium">Confiança</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {result.analytes.map((analyte, i) => (
                    <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-white">
                        <div className="font-medium">{analyte.name}</div>
                        <div className="text-xs text-white/40">{analyte.unit}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-white">
                        {analyte.value.toFixed(3)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-violet-500 transition-all"
                              style={{
                                width: `${(analyte.confidence || 0) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-white/70 font-mono w-8 text-right">
                            {((analyte.confidence || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={() => {
              setResult(null);
              setFile(null);
              setPreview(null);
            }}
            className="w-full px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          >
            Nova Análise
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4">
          <p className="text-rose-300 text-sm">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setFile(null);
              setPreview(null);
            }}
            className="mt-2 text-rose-400 hover:text-rose-300 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
