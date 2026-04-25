import React, { useState, useRef, useEffect } from 'react';
import type { useCIQTestTypes } from '../hooks/useCIQTestTypes';
import type { CIQTestTypeConfig } from '../types/_shared_refs';

// ─── Icons ────────────────────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M9.5 1.5l2 2L4 11H2V9l7.5-7.5z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M2 3.5h9M5 3.5V2h3v1.5M10 3.5L9.5 11h-6L3 3.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M2 6.5l3.5 3.5L11 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

function HandIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M4 6V3.5a1 1 0 011-1v0a1 1 0 011 1V6m0-.5V2.5a1 1 0 011-1v0a1 1 0 011 1v3m0-.5V3a1 1 0 011-1v0a1 1 0 011 1v4m0-1.5v-1a1 1 0 011-1v0a1 1 0 011 1v5a4 4 0 01-4 4H6a3 3 0 01-2.8-1.9L2 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M7 1L2 7h3l-1 4 5-6H6l1-4z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M3 4.5l3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TestTypesAPI = ReturnType<typeof useCIQTestTypes>;

interface Props {
  types: TestTypesAPI['types'];
  addType: TestTypesAPI['addType'];
  renameType: TestTypesAPI['renameType'];
  removeType: TestTypesAPI['removeType'];
  setManual: TestTypesAPI['setManual'];
  onClose: () => void;
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function TypeRow({
  config,
  siblings,
  onRename,
  onRemove,
  onSetManual,
}: {
  config: CIQTestTypeConfig;
  siblings: string[];
  onRename: (oldName: string, newName: string) => Promise<void>;
  onRemove: (name: string) => Promise<void>;
  onSetManual: (name: string, manual: boolean) => Promise<void>;
}) {
  const { name, manual } = config;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [deleteConf, setDeleteConf] = useState(false);
  const [renameError, setRenameError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      setRenameError('');
      return;
    }
    if (siblings.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      setRenameError('Já existe um teste com esse nome.');
      return;
    }
    setBusy(true);
    setRenameError('');
    try {
      await onRename(name, trimmed);
      setEditing(false);
    } catch {
      setRenameError('Erro ao renomear. Tente novamente.');
    } finally {
      setBusy(false);
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

  async function handleToggleManual() {
    setBusy(true);
    try {
      await onSetManual(name, !manual);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div
        className={[
          'rounded-lg bg-white/[0.04] border',
          renameError ? 'border-red-400/40' : 'border-emerald-500/30',
        ].join(' ')}
      >
        <div className="flex items-center gap-2 px-3 py-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (renameError) setRenameError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
              if (e.key === 'Escape') {
                setEditing(false);
                setDraft(name);
                setRenameError('');
              }
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
            title="Salvar (Enter)"
            aria-label="Salvar"
          >
            <CheckIcon />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setDraft(name);
              setRenameError('');
            }}
            disabled={busy}
            className="p-1 rounded text-white/30 hover:text-white/60 transition-colors"
            title="Cancelar (Esc)"
            aria-label="Cancelar"
          >
            <XSmallIcon />
          </button>
        </div>
        {renameError && (
          <p className="px-3 pb-2 text-[11px] text-red-400/90" role="alert">
            {renameError}
          </p>
        )}
      </div>
    );
  }

  if (deleteConf) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg
                      bg-red-500/[0.08] border border-red-400/25"
      >
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
    <div
      className="group flex items-center gap-2 px-3 py-2 rounded-lg
                    border border-transparent hover:bg-white/[0.04]
                    hover:border-white/[0.07] transition-all"
    >
      <span className="flex-1 text-sm text-white/80 truncate">{name}</span>
      <button
        type="button"
        onClick={handleToggleManual}
        disabled={busy}
        aria-pressed={manual}
        aria-label={
          manual
            ? `${name}: teste manual. Clique pra trocar pra analisador.`
            : `${name}: teste em analisador. Clique pra trocar pra manual.`
        }
        className={[
          'flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider',
          'border transition-all disabled:opacity-40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
          manual
            ? 'bg-violet-500/15 border-violet-400/30 text-violet-300 hover:bg-violet-500/25'
            : 'bg-white/[0.03] border-white/[0.07] text-white/40 hover:text-white/70 hover:border-white/[0.15]',
        ].join(' ')}
        title={
          manual
            ? 'Teste manual — desmarcar volta a exigir equipamento'
            : 'Marcar como teste manual (sem equipamento, kit lido a olho)'
        }
      >
        {manual ? <HandIcon /> : <BoltIcon />}
        <span>{manual ? 'Manual' : 'Analisador'}</span>
        <span className="opacity-60">
          <ChevronDownIcon />
        </span>
      </button>
      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => {
            setDraft(name);
            setEditing(true);
          }}
          aria-label={`Renomear ${name}`}
          className="p-1.5 rounded text-white/35 hover:text-white/80
                     hover:bg-white/[0.05]
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40
                     transition-colors"
          title="Renomear"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={() => setDeleteConf(true)}
          aria-label={`Remover ${name}`}
          className="p-1.5 rounded text-white/35 hover:text-red-400
                     hover:bg-red-500/10
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40
                     transition-colors"
          title="Remover"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CIQTestTypeManager({
  types,
  addType,
  renameType,
  removeType,
  setManual,
  onClose,
}: Props) {
  const [newName, setNewName] = useState('');
  const [newManual, setNewManual] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (types.map((t) => t.name.toLowerCase()).includes(trimmed.toLowerCase())) {
      setAddError('Esse teste já existe.');
      return;
    }
    setAdding(true);
    setAddError('');
    try {
      await addType(trimmed, newManual);
      setNewName('');
      setNewManual(false);
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Blur overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />

      {/* Panel */}
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden
                      bg-[#141417] border border-white/[0.08]
                      shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4
                        border-b border-white/[0.07]"
        >
          <div>
            <p className="text-sm font-semibold text-white/90">Tipos de Teste</p>
            <p className="text-[11px] text-white/35 mt-0.5">
              {types.length} imunoensaio{types.length !== 1 ? 's' : ''} configurado
              {types.length !== 1 ? 's' : ''}
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
            <p className="text-xs text-white/30 text-center py-6">Nenhum tipo cadastrado.</p>
          ) : (
            types.map((config) => (
              <TypeRow
                key={config.name}
                config={config}
                siblings={types
                  .filter((t) => t.name !== config.name)
                  .map((t) => t.name)}
                onRename={renameType}
                onRemove={removeType}
                onSetManual={setManual}
              />
            ))
          )}
        </div>

        {/* Add new */}
        <div className="px-4 pb-4 pt-2 border-t border-white/[0.06]">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider
                        text-white/25 mb-2"
          >
            Adicionar novo
          </p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Nome do teste… ex: Chagas"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setAddError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
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

          <div
            className="mt-2.5 flex items-stretch p-1 rounded-lg
                       bg-white/[0.03] border border-white/[0.06]"
            role="radiogroup"
            aria-label="Tipo de execução do teste"
          >
            <button
              type="button"
              role="radio"
              aria-checked={!newManual}
              onClick={() => setNewManual(false)}
              disabled={adding}
              className={[
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md',
                'text-[11px] font-medium transition-all disabled:opacity-40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
                !newManual
                  ? 'bg-white/[0.07] text-white/85 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                  : 'text-white/40 hover:text-white/70',
              ].join(' ')}
            >
              <BoltIcon />
              Analisador
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={newManual}
              onClick={() => setNewManual(true)}
              disabled={adding}
              className={[
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md',
                'text-[11px] font-medium transition-all disabled:opacity-40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40',
                newManual
                  ? 'bg-violet-500/15 text-violet-200 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.25)]'
                  : 'text-white/40 hover:text-white/70',
              ].join(' ')}
            >
              <HandIcon />
              Manual (kit a olho)
            </button>
          </div>

          {addError && <p className="text-xs text-red-400/80 mt-1.5 ml-0.5">{addError}</p>}
          <p className="text-[10px] text-white/20 mt-2 leading-relaxed">
            <span className="text-white/40">Manual</span> = kit lido a olho (aglutinação,
            cartela, imunocromatografia) — esconde o seletor de equipamento na corrida.
            Alterações refletem imediatamente. Remover um tipo não afeta dados históricos.
          </p>
        </div>
      </div>
    </div>
  );
}
