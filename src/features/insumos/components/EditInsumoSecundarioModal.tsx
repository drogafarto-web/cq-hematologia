/**
 * EditInsumoSecundarioModal — edição de campos secundários de um Insumo.
 *
 * Editáveis: nomeComercial, registroAnvisa, dataAbertura, diasEstabilidadeAbertura,
 * notaFiscalId. Campos "duros" (lote, fabricante, validade, tipo, produtoId)
 * permanecem imutáveis — para corrigi-los, use SubstituirLoteModal.
 *
 * Compliance:
 *  - Reauth via senha (EmailAuthProvider — senha NUNCA trafega ao server)
 *  - Justificativa obrigatória (mín 10 chars)
 *  - Service grava movimentação `edit_secundario` com prevValues/newValues
 *    no log imutável (chain-hash sealed pela Cloud Function)
 */

import React, { useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { auth } from '../../../shared/services/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useUser } from '../../../store/useAuthStore';
import { updateInsumo } from '../services/insumosFirebaseService';
import type { Insumo } from '../types/Insumo';

// ─── Inline icons ─────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path
        d="M22 12a10 10 0 00-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tsToInputDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  const d = ts.toDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function inputDateToTs(s: string): Timestamp | null {
  if (!s) return null;
  return Timestamp.fromDate(new Date(`${s}T00:00:00`));
}

function fmtDateBR(ts: Timestamp | null | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('pt-BR');
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const INPUT_CLS =
  'w-full px-3 py-2 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.10] text-sm text-slate-700 dark:text-white/85 placeholder-slate-400 dark:placeholder-white/25 focus:outline-none focus:border-slate-400 dark:focus:border-white/25 disabled:opacity-40';

function Field({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-white/45 mb-1.5"
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 dark:text-white/35 mt-1">{hint}</p>}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditInsumoSecundarioModalProps {
  insumo: Insumo;
  onClose: () => void;
  onSaved?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditInsumoSecundarioModal({
  insumo,
  onClose,
  onSaved,
}: EditInsumoSecundarioModalProps) {
  const user = useUser();

  const [nomeComercial, setNomeComercial] = useState(insumo.nomeComercial);
  const [registroAnvisa, setRegistroAnvisa] = useState(insumo.registroAnvisa ?? '');
  const [dataAbertura, setDataAbertura] = useState(tsToInputDate(insumo.dataAbertura));
  const [diasEstab, setDiasEstab] = useState(String(insumo.diasEstabilidadeAbertura ?? 0));
  const [notaFiscalId, setNotaFiscalId] = useState(insumo.notaFiscalId ?? '');
  const [justificativa, setJustificativa] = useState('');
  const [senha, setSenha] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => {
    if (nomeComercial !== insumo.nomeComercial) return true;
    if ((registroAnvisa || undefined) !== insumo.registroAnvisa) return true;
    if (tsToInputDate(insumo.dataAbertura) !== dataAbertura) return true;
    if (Number(diasEstab) !== (insumo.diasEstabilidadeAbertura ?? 0)) return true;
    if ((notaFiscalId || undefined) !== insumo.notaFiscalId) return true;
    return false;
  }, [insumo, nomeComercial, registroAnvisa, dataAbertura, diasEstab, notaFiscalId]);

  const podeSalvar = dirty && justificativa.trim().length >= 10 && senha.length >= 6 && !submitting;

  async function handleSubmit() {
    if (!user) return;
    setError(null);

    if (!dirty) {
      setError('Nenhuma alteração foi feita.');
      return;
    }
    if (justificativa.trim().length < 10) {
      setError('Justificativa precisa ter pelo menos 10 caracteres.');
      return;
    }
    const u = auth.currentUser;
    if (!u || !u.email) {
      setError('Sessão expirada. Faça login novamente.');
      return;
    }
    if (senha.length < 6) {
      setError('Informe sua senha (mínimo 6 caracteres).');
      return;
    }

    setSubmitting(true);
    try {
      const cred = EmailAuthProvider.credential(u.email, senha);
      await reauthenticateWithCredential(u, cred);
    } catch {
      setError('Senha incorreta.');
      setSubmitting(false);
      return;
    }

    try {
      const dias = Number(diasEstab);
      if (!Number.isFinite(dias) || dias < 0) {
        setError('Dias de estabilidade inválido.');
        setSubmitting(false);
        return;
      }

      await updateInsumo(
        insumo.labId,
        insumo.id,
        {
          ...(nomeComercial !== insumo.nomeComercial && { nomeComercial }),
          ...(registroAnvisa !== (insumo.registroAnvisa ?? '') && {
            registroAnvisa: registroAnvisa || undefined,
          }),
          ...(tsToInputDate(insumo.dataAbertura) !== dataAbertura && {
            dataAbertura: inputDateToTs(dataAbertura),
          }),
          ...(dias !== insumo.diasEstabilidadeAbertura && {
            diasEstabilidadeAbertura: dias,
          }),
          ...(notaFiscalId !== (insumo.notaFiscalId ?? '') && {
            notaFiscalId: notaFiscalId || undefined,
          }),
          justificativa: justificativa.trim(),
        },
        {
          validade: insumo.validade,
          dataAbertura: insumo.dataAbertura,
          diasEstabilidadeAbertura: insumo.diasEstabilidadeAbertura,
          nomeComercial: insumo.nomeComercial,
          registroAnvisa: insumo.registroAnvisa,
          notaFiscalId: insumo.notaFiscalId,
        },
        user.uid,
        user.displayName ?? user.email ?? 'Operador',
      );

      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-white/85">
            Editar dados do lote
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fechar"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-colors"
          >
            <XIcon />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Read-only — campos imutáveis */}
          <section className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] px-4 py-3 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/45">
              Campos imutáveis (use Substituir lote pra corrigir)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 dark:text-white/35">Lote: </span>
                <span className="font-mono text-slate-700 dark:text-white/75">{insumo.lote}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-white/35">Fabricante: </span>
                <span className="text-slate-700 dark:text-white/75">{insumo.fabricante}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-white/35">Validade: </span>
                <span className="text-slate-700 dark:text-white/75">
                  {fmtDateBR(insumo.validade)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-white/35">Tipo: </span>
                <span className="text-slate-700 dark:text-white/75">{insumo.tipo}</span>
              </div>
            </div>
          </section>

          {/* Editáveis */}
          <Field htmlFor="edit-nome" label="Nome comercial">
            <input
              id="edit-nome"
              type="text"
              value={nomeComercial}
              onChange={(e) => setNomeComercial(e.target.value)}
              disabled={submitting}
              className={INPUT_CLS}
            />
          </Field>

          <Field
            htmlFor="edit-anvisa"
            label="Registro ANVISA"
            hint="Opcional — exigido pela RDC 786 em inspeções quando aplicável."
          >
            <input
              id="edit-anvisa"
              type="text"
              value={registroAnvisa}
              onChange={(e) => setRegistroAnvisa(e.target.value)}
              disabled={submitting}
              placeholder="Ex: 10269230117"
              className={`${INPUT_CLS} font-mono`}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              htmlFor="edit-abertura"
              label="Data de abertura"
              hint="Vazio = lote ainda lacrado. validadeReal recalculada automaticamente."
            >
              <input
                id="edit-abertura"
                type="date"
                value={dataAbertura}
                onChange={(e) => setDataAbertura(e.target.value)}
                disabled={submitting}
                className={INPUT_CLS}
              />
            </Field>

            <Field
              htmlFor="edit-estab"
              label="Dias de estabilidade pós-abertura"
              hint="Declarado pelo fabricante. 0 = mesma validade fechada."
            >
              <input
                id="edit-estab"
                type="number"
                min={0}
                value={diasEstab}
                onChange={(e) => setDiasEstab(e.target.value)}
                disabled={submitting}
                className={`${INPUT_CLS} tabular-nums`}
              />
            </Field>
          </div>

          <Field htmlFor="edit-nf" label="Nota fiscal (ID)" hint="Opcional — link pro doc de NF.">
            <input
              id="edit-nf"
              type="text"
              value={notaFiscalId}
              onChange={(e) => setNotaFiscalId(e.target.value)}
              disabled={submitting}
              className={`${INPUT_CLS} font-mono`}
            />
          </Field>

          {/* Justificativa */}
          <Field
            htmlFor="edit-just"
            label="Justificativa *"
            hint="Obrigatória — mín. 10 caracteres. Vai pro audit log."
          >
            <textarea
              id="edit-just"
              rows={2}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              disabled={submitting}
              placeholder="Ex: Operador esqueceu de informar o registro ANVISA no cadastro inicial."
              className={`${INPUT_CLS} resize-none`}
            />
          </Field>

          {/* Senha */}
          <Field
            htmlFor="edit-senha"
            label="Senha do operador *"
            hint="Reauth local — não é transmitida ao servidor."
          >
            <input
              id="edit-senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={submitting}
              placeholder="••••••"
              className={INPUT_CLS}
            />
          </Field>

          {/* Erro */}
          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-400/25 bg-red-50 dark:bg-red-500/[0.07] px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Ações */}
          <div className="flex justify-between items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-9 px-4 rounded-lg text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/[0.10] hover:bg-slate-50 dark:hover:bg-white/[0.05] disabled:opacity-40 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!podeSalvar}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 transition-colors"
            >
              {submitting ? <SpinnerIcon /> : <ShieldIcon />} Salvar com assinatura
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
