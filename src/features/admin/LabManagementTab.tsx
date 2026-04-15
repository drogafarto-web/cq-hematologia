import { useState, useEffect, useCallback } from 'react';
import type { AdminLabRecord } from './services/userService';
import {
  fetchAllLabs,
  deleteLabAsAdmin,
} from './services/userService';
import { createLab, updateLab } from './services/labAdminService';
import { LabAdminModal, type LabFormPayload } from './LabAdminModal';
import { UserManagementModal } from './UserManagementModal';
import { ConfirmModal } from '../../shared/components/ConfirmModal';
import { useUser } from '../../store/useAuthStore';

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1 14c0-2.8 2-4.5 5-4.5s5 1.7 5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M15 13c0-2-1.2-3.3-3-3.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4h12M6 4V2h4v2M5 4l1 9h4l1-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BeakerIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M10 4v10L4 24a2 2 0 001.8 2.9h20.4A2 2 0 0028 24L22 14V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 4h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LabManagementTab() {
  const user                            = useUser();
  const [labs, setLabs]                 = useState<AdminLabRecord[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [confirmDeleteLab, setConfirmDeleteLab] = useState<AdminLabRecord | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [showCreate, setShowCreate]     = useState(false);
  const [editingLab, setEditingLab]     = useState<AdminLabRecord | null>(null);
  const [managingLab, setManagingLab]   = useState<AdminLabRecord | null>(null);
  const [search, setSearch]             = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLabs(await fetchAllLabs());
    } catch {
      setError('Erro ao carregar laboratórios.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(payload: LabFormPayload, logoFile?: File) {
    if (!user) return;
    await createLab({ ...payload, logoFile }, user.uid);
    await load();
  }

  async function handleEdit(payload: LabFormPayload, logoFile?: File) {
    if (!editingLab) return;
    await updateLab(editingLab.id, { ...payload, logoFile });
    await load();
  }

  async function handleDelete(lab: AdminLabRecord) {
    setDeletingId(lab.id);
    setConfirmDeleteLab(null);
    try {
      await deleteLabAsAdmin(lab.id);
      setLabs((prev) => prev.filter((l) => l.id !== lab.id));
    } catch (e) {
      console.error('[deleteLabAsAdmin] erro:', e);
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setError(`Erro ao excluir: ${msg}`);
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = labs.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar laboratório..."
          className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
        />
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-all shrink-0"
        >
          <PlusIcon />
          Novo lab
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-white/40 text-sm py-8">
          <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full inline-block" />
          Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-white/25">
          <BeakerIcon />
          <p className="text-sm">{search ? 'Nenhum resultado' : 'Nenhum laboratório cadastrado'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((lab) => (
            <div
              key={lab.id}
              className="group flex items-center gap-4 px-4 py-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.05] transition-colors"
            >
              {/* Logo or placeholder */}
              <div className="w-10 h-10 rounded-xl bg-white/[0.07] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                {lab.logoUrl ? (
                  <img src={lab.logoUrl} alt={lab.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white/40 text-sm font-semibold">{lab.name[0]}</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">{lab.name}</p>
                <p className="text-xs text-white/35 mt-0.5">
                  {lab.memberCount} {lab.memberCount === 1 ? 'membro' : 'membros'}
                  &nbsp;·&nbsp;Criado em {new Intl.DateTimeFormat('pt-BR').format(lab.createdAt)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {lab.memberCount === 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditingLab(lab)}
                      className="text-blue-400 hover:text-blue-300 p-1"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteLab(lab)}
                      disabled={deletingId === lab.id}
                      className="text-red-400 hover:text-red-300 p-1 ml-1 disabled:opacity-40"
                    >
                      🗑️
                    </button>
                  </>
                )}
                {lab.memberCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setManagingLab(lab)}
                    className="text-sm text-white/50 hover:text-white/80"
                  >
                    Gerenciar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <LabAdminModal
          onConfirm={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editingLab && (
        <LabAdminModal
          lab={editingLab}
          onConfirm={handleEdit}
          onClose={() => setEditingLab(null)}
        />
      )}

      {managingLab && user && (
        <UserManagementModal
          labId={managingLab.id}
          labName={managingLab.name}
          currentUserUid={user.uid}
          onClose={() => setManagingLab(null)}
        />
      )}

      {confirmDeleteLab && (
        <ConfirmModal
          title="Deletar Lab?"
          message={`Remover ${confirmDeleteLab.name} e todos os dados?`}
          onConfirm={() => handleDelete(confirmDeleteLab)}
          onCancel={() => setConfirmDeleteLab(null)}
        />
      )}
    </div>
  );
}
