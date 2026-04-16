import React, { useState, useRef, useEffect } from 'react';
import type { useCIQTestTypes } from '../hooks/useCIQTestTypes';

// ─── Icons ────────────────────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M9.5 1.5l2 2L4 11H2V9l7.5-7.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M2 3.5h9M5 3.5V2h3v1.5M10 3.5L9.5 11h-6L3 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M2 6.5l3.5 3.5L11 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XSmallIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TestTypesAPI = ReturnType<typeof useCIQTestTypes>;

interface Props {
  types:      TestTypesAPI['types'];
  addType:    TestTypesAPI['addType'];
  renameType: TestTypesAPI['renameType'];
  removeType: TestTypesAPI['removeType'];
  onClose:    () => void;
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function TypeRow({
  name,
  onRename,
  onRemove,
}: {
  name:     string;
  onRename: (oldName: string, newName: string) => Promise<void>;
  onRemove: (name: string) => Promise<void>;
}) {
  const [editing,   setEditing]   = useState(false);
  const [draft,     setDraft]     = useState(name);
  const [busy,      setBusy]      = useState(false);
  const [deleteConf, setDeleteConf] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function handleSave() {
    if (!draft.trim() || draft === name) { setEditing(false); return; }
    setBusy(true);
    try {
      await onRename(name, draft.trim());
    } finally {
      setBusy(false);
      setEditing(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await onRemove(name);
    } finally {
      setBusy(false);
      setDeleteConf(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg
                      bg-white/[0.04] border border-emerald-500/30">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  { e.preventDefault(); handleSave(); }
            if (e.key === 'Escape') { setEditing(false); setDraft(name); }
          }}
          className="flex-1 bg-transparent text-sm text-white/90 outline-none
                     placeholder-white/25"
          disabled={busy}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !draft.trim()}
          className="p-1 rounded text-emerald-400 hover:text-emerald-300
                     disabled:opacity-40 transition-colors"
          title="Salvar"
        >
          <CheckIcon />
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setDraft(name); }}
          disabled={busy}
          className="p-1 rounded text-white/30 hover:text-white/60 transition-colors"
          title="Cancelar"
        >
          <XSmallIcon />
        </button>
      </div>
    );
  }

  if (deleteConf) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg
                      bg-red-500/[0.08] border border-red-400/25">
        <span className="flex-1 text-sm text-red-400/90 truncate">
          Remover <span className="font-medium text-red-300">{name}</span>?
        </span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="px-2.5 py-1 rounded text-xs font-medium
                     bg-red-500/20 border border-red-400/30
                     text-red-300 hover:bg-red-500/30 transition-colors
                     disabled:opacity-40"
        >
          Remover
        </button>
        <button
          type="button"
          onClick={() => setDeleteConf(false)}
          disabled={busy}
          className="p-1 rounded text-white/30 hover:text-white/60 transition-colors"
          title="Cancelar"
        >
          <XSmallIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2 px-3 py-2 rounded-lg
                    border border-transparent hover:bg-white/[0.04]
                    hover:border-white/[0.07] transition-all">
      <span className="flex-1 text-sm text-white/80 truncate">{name}</span>
      <button
        type="button"
        onClick={() => { setDraft(name); setEditing(true); }}
        className="p-1.5 rounded text-white/25 hover:text-white/60
                   opacity-0 group-hover:opacity-100 transition-all"
        title="Renomear"
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        onClick={() => setDeleteConf(true)}
        className="p-1.5 rounded text-white/25 hover:text-red-400
                   opacity-0 group-hover:opacity-100 transition-all"
        title="Remover"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CIQTestTypeManager({ types, addType, renameType, removeType, onClose }: Props) {
  const [newName,  setNewName]  = useState('');
  const [adding,   setAdding]   = useState(false);
  const [addError, setAddError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (types.map(t => t.toLowerCase()).includes(trimmed.toLowerCase())) {
      setAddError('Esse teste já existe.');
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      await addType(trimmed);
      setNewName('');
      inputRef.current?.focus();
    } catch {
      setAddError('Erro ao adicionar. Tente novamente.');
    } finally {
      setAdding(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Blur overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />

      {/* Panel */}
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden
                      bg-[#141417] border border-white/[0.08]
                      shadow-[0_32px_80px_rgba(0,0,0,0.6)]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4
                        border-b border-white/[0.07]">
          <div>
            <p className="text-sm font-semibold text-white/90">
              Tipos de Teste
            </p>
            <p className="text-[11px] text-white/35 mt-0.5">
              {types.length} imunoensaio{types.length !== 1 ? 's' : ''} configurado{types.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/70
                       hover:bg-white/[0.06] transition-all"
            title="Fechar"
          >
            <XSmallIcon />
          </button>
        </div>

        {/* List */}
        <div className="px-3 py-3 max-h-72 overflow-y-auto space-y-0.5">
          {types.length === 0 ? (
            <p className="text-xs text-white/30 text-center py-6">
              Nenhum tipo cadastrado.
            </p>
          ) : (
            types.map((name) => (
              <TypeRow
                key={name}
                name={name}
                onRename={renameType}
                onRemove={removeType}
              />
            ))
          )}
        </div>

        {/* Add new */}
        <div className="px-4 pb-4 pt-2 border-t border-white/[0.06]">
          <p className="text-[10px] font-semibold uppercase tracking-wider
                        text-white/25 mb-2">
            Adicionar novo
          </p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Nome do teste… ex: Chagas"
              value={newName}
              onChange={(e) => { setNewName(e.target.value); setAddError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              disabled={adding}
              className={[
                'flex-1 px-3 py-2 rounded-xl text-sm outline-none transition-all',
                'bg-white/[0.06] border text-white/90 placeholder-white/20',
                addError
                  ? 'border-red-400/40 focus:border-red-400/60'
                  : 'border-white/[0.09] focus:border-emerald-500/50',
                'disabled:opacity-40',
              ].join(' ')}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl
                         bg-emerald-500 hover:bg-emerald-400
                         text-white text-sm font-medium
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all"
            >
              <PlusIcon />
            </button>
          </div>
          {addError && (
            <p className="text-xs text-red-400/80 mt-1.5 ml-0.5">{addError}</p>
          )}
          <p className="text-[10px] text-white/20 mt-2">
            Alterações refletem imediatamente no formulário de registro.
            Remover um tipo não afeta dados históricos.
          </p>
        </div>
      </div>
    </div>
  );
}
