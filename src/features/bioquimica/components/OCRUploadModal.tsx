/**
 * bioquimica/components/OCRUploadModal.tsx
 *
 * Drag-and-drop image upload modal with OCR parsing preview.
 * Dark-first design, WCAG AA compliant.
 *
 * Compliance: RDC 978 Art. 167, LGPD Art. 9 (consent gate),
 * WCAG 2.1 AA, dark-first design system.
 */

import React, { useCallback, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useOCRValidation } from '../hooks/useOCRValidation';
import type { AnalitoId } from '../types/_shared_refs';
import type { OCRValidationReport } from '../types/ocrResults';

// ─── Component Types ──────────────────────────────────────────────────────

export interface OCRUploadModalProps {
  open: boolean;
  onClose: () => void;
  expectedAnalytes: AnalitoId[];
  onAccept: (report: OCRValidationReport, imageStoragePath: string) => void;
  consentToken: string; // patient consent — caller must obtain before opening
}

// ─── States ────────────────────────────────────────────────────────────────

type ModalState = 'idle' | 'uploading' | 'parsing' | 'preview' | 'error' | 'rejected';

// ─── Component ─────────────────────────────────────────────────────────────

export function OCRUploadModal(props: OCRUploadModalProps): JSX.Element {
  const { open, onClose, expectedAnalytes, onAccept, consentToken } = props;

  const ocrValidation = useOCRValidation();
  const [state, setState] = useState<ModalState>('idle');
  const [imageStoragePath, setImageStoragePath] = useState<string>('');
  const dragOverRef = useRef<boolean>(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = true;
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = false;
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = false;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      handleFileSelect(file);
    }
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setState('error');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setState('error');
      return;
    }

    // In a real implementation, upload to GCS and get path
    // For now, use file name as placeholder
    const path = `uploads/${file.name}-${Date.now()}`;
    setImageStoragePath(path);

    setState('parsing');
    performOCR(path);
  }, []);

  const performOCR = useCallback(
    async (path: string) => {
      try {
        const report = await ocrValidation.validateImage({
          imageStoragePath: path,
          expectedAnalytes,
          consentToken,
        });

        if (report.validationSeverity === 'reject') {
          setState('rejected');
        } else {
          setState('preview');
        }
      } catch (err) {
        setState('error');
      }
    },
    [ocrValidation, expectedAnalytes, consentToken],
  );

  const handleAccept = useCallback(() => {
    if (ocrValidation.validation) {
      onAccept(ocrValidation.validation, imageStoragePath);
      onClose();
      ocrValidation.reset();
    }
  }, [ocrValidation, imageStoragePath, onAccept, onClose]);

  const handleRetry = useCallback(() => {
    ocrValidation.reset();
    setState('idle');
    setImageStoragePath('');
  }, [ocrValidation]);

  if (!open) {
    return <div />;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1a1f] p-6">
        {/* Header */}
        <h2 id="ocr-modal-title" className="text-xl font-medium tracking-tight text-white">
          Upload Analyte Strip
        </h2>

        {/* Idle State */}
        {state === 'idle' && (
          <div className="mt-4 space-y-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors duration-200 ${
                dragOverRef.current
                  ? 'border-violet-500/60 bg-violet-500/5'
                  : 'border-white/20 hover:border-white/30'
              }`}
            >
              <p className="text-sm text-white/70">Drag image here or click to browse</p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                className="mt-2 hidden"
                aria-label="Upload image"
              />
            </div>
          </div>
        )}

        {/* Parsing State */}
        {state === 'parsing' && (
          <div className="mt-4 space-y-4">
            <div className="h-8 w-full animate-pulse rounded bg-white/10" />
            <p className="text-sm text-white/70">Processing image...</p>
          </div>
        )}

        {/* Preview State */}
        {state === 'preview' && ocrValidation.validation && (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-white/70">Found Analytes</h3>
              <div className="space-y-1">
                {ocrValidation.parsed?.analytes.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded bg-white/5 px-3 py-2 text-sm"
                  >
                    <span className="text-white">{a.rawName}</span>
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        a.matchConfidence === 'high'
                          ? 'bg-emerald-500/15 text-emerald-200'
                          : a.matchConfidence === 'medium'
                            ? 'bg-amber-500/15 text-amber-200'
                            : 'bg-rose-500/15 text-rose-200'
                      }`}
                    >
                      {a.matchConfidence}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={handleAccept}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Accept and Use
            </button>
          </div>
        )}

        {/* Rejected State */}
        {state === 'rejected' && ocrValidation.validation && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
              <p className="text-sm text-rose-200">
                {ocrValidation.validation.unmatched.length} analytes not recognized
              </p>
            </div>
            <button
              onClick={handleRetry}
              className="w-full rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/5"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Error State */}
        {state === 'error' && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
              <p className="text-sm text-rose-200">
                {ocrValidation.error || 'An error occurred. Please try again.'}
              </p>
            </div>
            <button
              onClick={handleRetry}
              className="w-full rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/5"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-lg px-4 py-2 text-sm text-white/50 transition-colors hover:text-white/70"
        >
          Close
        </button>
      </div>
    </div>
  );
}
