import { useState, useRef } from 'react';
import type { Lab } from '../../types';

interface Props {
  lab?: Lab;
  onConfirm: (name: string, logoFile?: File) => Promise<void>;
  onClose: () => void;
}

export function LabAdminModal({ lab, onConfirm, onClose }: Props) {
  const [name, setName]             = useState(lab?.name ?? '');
  const [logoFile, setLogoFile]     = useState<File | undefined>();
  const [preview, setPreview]       = useState<string | null>(lab?.logoUrl ?? null);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const fileRef                     = useRef<HTMLInputElement>(null);
  const isEdit                      = Boolean(lab);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo deve ter no máximo 2 MB.');
      return;
    }
    setLogoFile(file);
    setPreview(URL.createObjectURL(file));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Nome obrigatório.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onConfirm(trimmed, logoFile);
      onClose();
    } catch {
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-[#141414] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.07]">
          <h2 className="text-base font-semibold text-white/90">
            {isEdit ? 'Editar laboratório' : 'Novo laboratório'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-20 h-20 rounded-2xl border-2 border-dashed border-white/15 flex items-center justify-center cursor-pointer hover:border-white/30 transition-colors overflow-hidden bg-white/[0.03]"
              onClick={() => fileRef.current?.click()}
            >
              {preview ? (
                <img src={preview} alt="Logo preview" className="w-full h-full object-cover" />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-white/20">
                  <path d="M4 16l4-4 4 4 4-6 4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              {preview ? 'Trocar logo' : 'Adicionar logo'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              aria-label="Selecionar logo do laboratório"
              className="hidden"
            />
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
              Nome do laboratório
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Lab Central"
              autoFocus
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 focus:bg-white/[0.07] transition-all"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white/90 hover:bg-white/[0.05] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
