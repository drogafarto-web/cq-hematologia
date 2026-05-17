/**
 * DocumentoUploadModal - upload de documentos vinculados a equipamento.
 * Drag-drop ou file picker. Validacao: PDF/JPG/PNG, max 10MB.
 */

import React, { useCallback, useRef, useState } from 'react';
import { useUser } from '../../../store/useAuthStore';
import { uploadDocumento } from '../services/documentoService';
import type { UploadProgress } from '../services/documentoService';
import type { DocumentoTipo } from '../types/EquipamentoDocumento';
import { DOCUMENTO_TIPO_LABEL, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../types/EquipamentoDocumento';

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm
  focus:outline-none focus:border-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08]
  disabled:opacity-40 transition-all
`.trim();

interface DocumentoUploadModalProps {
  labId: string;
  equipamentoId: string;
  onClose: () => void;
  onUploaded?: (docId: string) => void;
}

const TIPOS: DocumentoTipo[] = [
  'nota_fiscal',
  'manual',
  'contrato_manutencao',
  'laudo_manutencao',
  'certificado_calibracao',
  'qualificacao',
  'outro',
];

export function DocumentoUploadModal({
  labId,
  equipamentoId,
  onClose,
  onUploaded,
}: DocumentoUploadModalProps) {
  const user = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState<DocumentoTipo>('outro');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      if (!titulo) setTitulo(dropped.name.replace(/\.[^.]+$/, ''));
    }
  }, [titulo]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!titulo) setTitulo(selected.name.replace(/\.[^.]+$/, ''));
    }
  }, [titulo]);

  const handleSubmit = useCallback(async () => {
    if (!file || !user) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
      setError('Tipo de arquivo nao permitido. Use PDF, JPG ou PNG.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`Arquivo excede 10 MB (${(file.size / 1024 / 1024).toFixed(1)} MB).`);
      return;
    }
    if (!titulo.trim()) {
      setError('Titulo e obrigatorio.');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const docId = await uploadDocumento(
        labId,
        equipamentoId,
        file,
        {
          tipo,
          titulo: titulo.trim(),
          descricao: descricao.trim() || undefined,
          uploadedBy: user.uid,
          uploadedByName: user.displayName || user.email || 'Operador',
        },
        setProgress,
      );
      onUploaded?.(docId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer upload.');
    } finally {
      setUploading(false);
    }
  }, [file, user, labId, equipamentoId, tipo, titulo, descricao, onClose, onUploaded]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-white dark:bg-[#141820] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.08] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/[0.06]">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white/90">
            Upload de Documento
          </h2>
          <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">
            PDF, JPG ou PNG — maximo 10 MB
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all
              ${dragOver
                ? 'border-violet-500 bg-violet-500/5'
                : file
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-slate-300 dark:border-white/[0.12] hover:border-violet-400'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              <>
                <span className="text-2xl">&#128196;</span>
                <span className="text-sm font-medium text-slate-700 dark:text-white/70">{file.name}</span>
                <span className="text-xs text-slate-500 dark:text-white/40">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </>
            ) : (
              <>
                <span className="text-2xl">&#128193;</span>
                <span className="text-sm text-slate-600 dark:text-white/50">
                  Arraste o arquivo aqui ou clique para selecionar
                </span>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1">
              Tipo de documento
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as DocumentoTipo)}
              className={INPUT_CLS}
              disabled={uploading}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>{DOCUMENTO_TIPO_LABEL[t]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1">
              Titulo *
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: NF 12345 - Compra Yumizen H550"
              className={INPUT_CLS}
              disabled={uploading}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1">
              Descricao (opcional)
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Observacoes adicionais..."
              rows={2}
              className={INPUT_CLS + ' resize-none'}
              disabled={uploading}
            />
          </div>

          {uploading && progress && (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-white/40 text-center">
                {progress.percent}%
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-white/[0.06] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-white/50 hover:text-slate-900 dark:hover:text-white/80 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!file || !titulo.trim() || uploading}
            className="px-5 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl disabled:opacity-40 transition-colors"
          >
            {uploading ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
