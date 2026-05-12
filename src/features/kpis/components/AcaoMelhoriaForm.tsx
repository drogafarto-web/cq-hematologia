/**
 * Formulário para nova ação em um plano de melhoria — persistência via addDoc na subcoleção `acoes`.
 */

import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { z } from 'zod';

import { getLabMembers, type LabMember } from '../../admin/services/labAdminService';
import { db, firestoreErrorMessage, Timestamp } from '../../../shared/services/firebase';
import { toast } from '../../../shared/store/useToastStore';

const acaoCreateSchema = z.object({
  descricao: z.string().trim().min(1, 'Descreva a ação.').max(4000),
  responsavelId: z.string().min(1, 'Selecione o responsável.'),
  prazo: z.instanceof(Timestamp),
  evidencia: z.string().trim().max(8000).optional(),
});

export interface AcaoMelhoriaFormProps {
  readonly labId: string;
  readonly planoId: string;
  readonly onSuccess: () => void;
  readonly onCancel: () => void;
}

export function AcaoMelhoriaForm({ labId, planoId, onSuccess, onCancel }: AcaoMelhoriaFormProps) {
  const [descricao, setDescricao] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [prazoInput, setPrazoInput] = useState('');
  const [evidencia, setEvidencia] = useState('');
  const [members, setMembers] = useState<LabMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setMembersLoading(true);
    void getLabMembers(labId)
      .then((list) => {
        if (!cancelled) {
          setMembers(list.filter((m) => m.active));
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Não foi possível carregar membros do laboratório.');
          setMembers([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMembersLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [labId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      setFormError('');
      if (!prazoInput) {
        setFormError('Informe o prazo da ação.');
        return;
      }
      const prazoDate = new Date(`${prazoInput}T12:00:00`);
      if (Number.isNaN(prazoDate.getTime())) {
        setFormError('Data de prazo inválida.');
        return;
      }
      const prazoTs = Timestamp.fromDate(prazoDate);
      const evidenciaTrim = evidencia.trim();
      const parsed = acaoCreateSchema.safeParse({
        descricao,
        responsavelId,
        prazo: prazoTs,
        ...(evidenciaTrim.length > 0 ? { evidencia: evidenciaTrim } : {}),
      });
      if (!parsed.success) {
        const first = parsed.error.flatten().fieldErrors;
        const msg =
          first.descricao?.[0] ??
          first.responsavelId?.[0] ??
          first.prazo?.[0] ??
          first.evidencia?.[0] ??
          'Dados inválidos.';
        setFormError(msg);
        return;
      }

      const member = members.find((m) => m.uid === parsed.data.responsavelId);
      if (!member) {
        setFormError('Responsável inválido.');
        return;
      }

      setSubmitting(true);
      try {
        const col = collection(db, `labs/${labId}/planos-melhoria/${planoId}/acoes`);
        const now = Timestamp.now();
        const docPayload: Record<string, unknown> = {
          labId,
          planoId,
          descricao: parsed.data.descricao,
          responsavelId: parsed.data.responsavelId,
          responsavelNome: member.displayName,
          prazo: parsed.data.prazo,
          status: 'pendente',
          criadoEm: now,
          updatedAt: now,
        };
        if (parsed.data.evidencia !== undefined && parsed.data.evidencia.length > 0) {
          docPayload.evidencia = parsed.data.evidencia;
        }
        await addDoc(col, docPayload);
        toast.success('Ação adicionada.');
        setDescricao('');
        setResponsavelId('');
        setPrazoInput('');
        setEvidencia('');
        onSuccess();
      } catch (err: unknown) {
        setFormError(firestoreErrorMessage(err));
      } finally {
        setSubmitting(false);
      }
    },
    [descricao, evidencia, labId, members, onSuccess, planoId, prazoInput, responsavelId],
  );

  return (
    <div className="rounded-xl border border-violet-500/25 bg-[#1a1a1d]/90 p-4">
      <h4 className="text-sm font-semibold text-white/90">Nova ação</h4>
      {formError ? (
        <div className="mt-3 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {formError}
        </div>
      ) : null}
      <form onSubmit={(ev) => void handleSubmit(ev)} className="mt-4 space-y-3">
        <div>
          <label htmlFor="acao-desc" className="block text-xs font-medium uppercase tracking-wide text-white/50">
            Descrição
          </label>
          <textarea
            id="acao-desc"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            required
            rows={3}
            maxLength={4000}
            className="mt-1.5 w-full resize-y rounded-lg border border-white/10 bg-[#141417] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            placeholder="O que será feito e como será verificado."
          />
        </div>
        <div>
          <label htmlFor="acao-resp" className="block text-xs font-medium uppercase tracking-wide text-white/50">
            Responsável
          </label>
          <select
            id="acao-resp"
            value={responsavelId}
            onChange={(e) => setResponsavelId(e.target.value)}
            required
            disabled={membersLoading}
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#141417] px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40 disabled:opacity-50"
          >
            <option value="">{membersLoading ? 'Carregando…' : 'Selecione'}</option>
            {members.map((m) => (
              <option key={m.uid} value={m.uid}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="acao-prazo" className="block text-xs font-medium uppercase tracking-wide text-white/50">
            Prazo
          </label>
          <input
            id="acao-prazo"
            type="date"
            value={prazoInput}
            onChange={(e) => setPrazoInput(e.target.value)}
            required
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#141417] px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
          />
        </div>
        <div>
          <label htmlFor="acao-evid" className="block text-xs font-medium uppercase tracking-wide text-white/50">
            Evidência (opcional)
          </label>
          <textarea
            id="acao-evid"
            value={evidencia}
            onChange={(e) => setEvidencia(e.target.value)}
            rows={2}
            maxLength={8000}
            className="mt-1.5 w-full resize-y rounded-lg border border-white/10 bg-[#141417] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            placeholder="Referência, link interno ou nota curta."
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {submitting ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </form>
    </div>
  );
}
