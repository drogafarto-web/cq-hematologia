/**
 * CertificateUploadModal.tsx
 *
 * Modal for uploading calibration certificates (PDF/JPG).
 * Validates file type, size, computes chain-hash, shows progress.
 *
 * Features:
 * - Drag & drop file selection
 * - Real-time progress bar
 * - Hash verification display
 * - Error messaging
 */

import React, { useRef, useState } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useCertificateUpload } from '../hooks/useCertificateUpload';
import { addCertificateToCalibracao } from '../services/calibracaoService';
import type { CalibracaoRecord } from '../types/index';

interface CertificateUploadModalProps {
  record: CalibracaoRecord;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Modal state machine: idle → uploading → done → close
 */
type ModalState = 'idle' | 'uploading' | 'done' | 'error';

export default function CertificateUploadModal({
  record,
  onClose,
  onSuccess,
}: CertificateUploadModalProps) {
  const labId = useAuthStore((s) => s.activeLabId);
  const userId = useAuthStore((s) => s.user?.uid);
  const { file, progress, error, upload, clear } = useCertificateUpload();
  const [state, setState] = useState<ModalState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!labId || !userId) {
    return null; // Guard: require active session
  }

  const handleFileSelect = (selectedFile: File) => {
    // Quick validation feedback
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setUploadError(
        `Tipo de arquivo inválido. Permitidos: PDF, JPG, PNG. Recebido: ${selectedFile.type}`,
      );
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (selectedFile.size > maxSize) {
      setUploadError(
        `Arquivo muito grande (${(selectedFile.size / 1024 / 1024).toFixed(1)} MB). Máximo: 10 MB.`,
      );
      return;
    }

    setUploadError(null);
    setSelectedFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUploadClick = async () => {
    if (!selectedFile) return;

    try {
      setState('uploading');
      setUploadError(null);

      // Upload file and get metadata
      const cert = await upload(selectedFile, labId, record.equipId, userId);

      // Add certificate to calibration record in Firestore
      await addCertificateToCalibracao(labId, record.equipId, cert);

      setState('done');

      // Auto-close after 2 seconds
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUploadError(message);
      setState('error');
    }
  };

  const handleReset = () => {
    setState('idle');
    setSelectedFile(null);
    setUploadError(null);
    clear();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-lg border border-white/10 bg-slate-900 p-6 shadow-lg">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 transition-colors hover:text-gray-300"
          aria-label="Fechar modal"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Header */}
        <h2 className="mb-2 text-lg font-semibold text-white">Upload de Certificado</h2>
        <p className="mb-4 text-sm text-gray-400">{record.equipName}</p>

        {state === 'idle' && !selectedFile && (
          <div className="space-y-4">
            {/* Drag & drop area */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="rounded-lg border-2 border-dashed border-white/20 bg-white/5 p-8 text-center transition-colors hover:border-white/40 hover:bg-white/10"
            >
              <svg
                className="mx-auto mb-2 h-8 w-8 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="mb-2 text-sm font-medium text-white">
                Arraste um arquivo aqui
              </p>
              <p className="text-xs text-gray-400">ou</p>
            </div>

            {/* File input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
              className="hidden"
              aria-label="Selecionar arquivo para upload"
            />

            {/* Browse button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1"
            >
              Selecionar arquivo
            </button>

            {/* File types info */}
            <p className="text-center text-xs text-gray-500">
              Formatos aceitos: PDF, JPG, PNG (máximo 10 MB)
            </p>

            {/* Error display */}
            {uploadError && (
              <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-3">
                <p className="text-xs text-red-400">{uploadError}</p>
              </div>
            )}
          </div>
        )}

        {state === 'idle' && selectedFile && (
          <div className="space-y-4">
            {/* File preview */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="mb-2 text-xs text-gray-400">Arquivo selecionado:</p>
              <p className="font-mono text-sm text-white">{selectedFile.name}</p>
              <p className="mt-2 text-xs text-gray-400">
                Tamanho: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setUploadError(null);
                }}
                className="flex-1 rounded border border-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleUploadClick}
                className="flex-1 rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1"
              >
                Fazer upload
              </button>
            </div>
          </div>
        )}

        {state === 'uploading' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">Enviando arquivo...</p>

            {/* Progress bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-violet-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-center text-xs text-gray-400">
              {Math.round(progress)}%
            </p>
          </div>
        )}

        {state === 'done' && (
          <div className="space-y-3">
            {/* Success indicator */}
            <div className="flex items-center justify-center">
              <svg
                className="h-12 w-12 text-emerald-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <p className="text-center text-sm font-medium text-emerald-400">
              Certificado enviado com sucesso!
            </p>

            <p className="text-center text-xs text-gray-400">
              Fechando em alguns segundos...
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-900/50 bg-red-900/20 p-4">
              <p className="text-sm text-red-400">Erro ao fazer upload</p>
              <p className="mt-2 text-xs text-red-300">{uploadError}</p>
            </div>

            {/* Retry buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="flex-1 rounded border border-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1"
              >
                Tentar outro arquivo
              </button>
              <button
                onClick={onClose}
                className="flex-1 rounded bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
