/**
 * FornecedorFormModal — cadastro/edição de fornecedor no catálogo do lab.
 *
 * Validação forte no CNPJ (módulo 11 + dedup server-side). Cnpj imutável em
 * modo edição — compõe a chave de dedup. Se um CNPJ foi cadastrado errado, o
 * operador deve soft-delete o cadastro errado e criar um novo.
 */

import React, { useState } from 'react';
import { useUser } from '../../../store/useAuthStore';
import {
  createFornecedor,
  updateFornecedor,
} from '../services/fornecedorService';
import type { Fornecedor } from '../types/Fornecedor';
import {
  formatCnpj,
  isValidCnpj,
  normalizeCnpj,
} from '../types/Fornecedor';

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm
  focus:outline-none focus:border-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08]
  disabled:opacity-40 transition-all
`.trim();

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
      >
        {label}
        {required && <span className="text-red-500 dark:text-red-400/70 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-slate-400 dark:text-white/25 mt-1 ml-0.5">{hint}</p>
      )}
      {error && <p className="text-xs text-red-500 dark:text-red-400/80 mt-1 ml-0.5">{error}</p>}
    </div>
  );
}

interface FornecedorFormModalProps {
  labId: string;
  fornecedor?: Fornecedor;
  onClose: () => void;
  onCreated?: (fornecedorId: string) => void;
}

export function FornecedorFormModal({
  labId,
  fornecedor,
  onClose,
  onCreated,
}: FornecedorFormModalProps) {
  const user = useUser();
  const isEdit = !!fornecedor;

  const [razaoSocial, setRazaoSocial] = useState(fornecedor?.razaoSocial ?? '');
  const [nomeFantasia, setNomeFantasia] = useState(fornecedor?.nomeFantasia ?? '');
  const [cnpj, setCnpj] = useState(
    fornecedor?.cnpj ? formatCnpj(fornecedor.cnpj) : '',
  );
  const [inscricaoEstadual, setInscricaoEstadual] = useState(
    fornecedor?.inscricaoEstadual ?? '',
  );
  const [telefone, setTelefone] = useState(fornecedor?.telefone ?? '');
  const [email, setEmail] = useState(fornecedor?.email ?? '');
  const [endereco, setEndereco] = useState(fornecedor?.endereco ?? '');
  const [observacoes, setObservacoes] = useState(fornecedor?.observacoes ?? '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!razaoSocial.trim()) e.razaoSocial = 'Informe a razão social.';
    if (!isEdit) {
      if (!cnpj.trim()) e.cnpj = 'Informe o CNPJ.';
      else if (!isValidCnpj(cnpj)) e.cnpj = 'CNPJ inválido — confira os 14 dígitos.';
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = 'E-mail em formato inválido.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleCnpjChange(ev: React.ChangeEvent<HTMLInputElement>) {
    // Deixa o user digitar livremente; format só no blur.
    setCnpj(ev.target.value);
  }

  function handleCnpjBlur() {
    const n = normalizeCnpj(cnpj);
    if (n.length === 14) setCnpj(formatCnpj(n));
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    if (!user) {
      setSubmitError('Usuário não autenticado.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      if (isEdit && fornecedor) {
        await updateFornecedor(labId, fornecedor.id, {
          razaoSocial: razaoSocial.trim(),
          nomeFantasia: nomeFantasia.trim() || null,
          inscricaoEstadual: inscricaoEstadual.trim() || null,
          telefone: telefone.trim() || null,
          email: email.trim() || null,
          endereco: endereco.trim() || null,
          observacoes: observacoes.trim() || null,
          updatedBy: user.uid,
        });
        onCreated?.(fornecedor.id);
        onClose();
        return;
      }

      const { id, wasDuplicate } = await createFornecedor(labId, {
        razaoSocial: razaoSocial.trim(),
        nomeFantasia: nomeFantasia.trim() || undefined,
        cnpj: normalizeCnpj(cnpj),
        inscricaoEstadual: inscricaoEstadual.trim() || undefined,
        telefone: telefone.trim() || undefined,
        email: email.trim() || undefined,
        endereco: endereco.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
        createdBy: user.uid,
      });

      if (wasDuplicate) {
        setSubmitError(
          'Já existe fornecedor com este CNPJ no lab. Usamos o cadastro existente.',
        );
      }
      onCreated?.(id);
      if (!wasDuplicate) onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao salvar fornecedor.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fornecedor-modal-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl"
      >
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between sticky top-0 bg-white dark:bg-[#0F1318] z-10">
          <div>
            <h2
              id="fornecedor-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-white/90"
            >
              {isEdit ? 'Editar fornecedor' : 'Novo fornecedor'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              {isEdit
                ? 'CNPJ é imutável — compõe a chave do cadastro.'
                : 'Cadastro único por lab. Notas fiscais referenciam este fornecedor.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field id="razaoSocial" label="Razão social" required error={errors.razaoSocial}>
              <input
                id="razaoSocial"
                className={INPUT_CLS}
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="ex: Bio-Rad Laboratórios Brasil Ltda"
                autoComplete="off"
              />
            </Field>
            <Field id="nomeFantasia" label="Nome fantasia" hint="Opcional — exibição comercial">
              <input
                id="nomeFantasia"
                className={INPUT_CLS}
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                placeholder="ex: Bio-Rad"
                autoComplete="off"
              />
            </Field>

            <Field
              id="cnpj"
              label="CNPJ"
              required
              error={errors.cnpj}
              hint={
                isEdit
                  ? 'Imutável — compõe a chave de dedup.'
                  : 'Validação módulo 11 · único por lab'
              }
            >
              <input
                id="cnpj"
                className={INPUT_CLS}
                value={cnpj}
                onChange={handleCnpjChange}
                onBlur={handleCnpjBlur}
                placeholder="00.000.000/0000-00"
                maxLength={18}
                autoComplete="off"
                readOnly={isEdit}
                disabled={isEdit}
                inputMode="numeric"
              />
            </Field>
            <Field
              id="inscricaoEstadual"
              label="Inscrição estadual"
              hint="Opcional — exigida pela SEFAZ em NFs"
            >
              <input
                id="inscricaoEstadual"
                className={INPUT_CLS}
                value={inscricaoEstadual}
                onChange={(e) => setInscricaoEstadual(e.target.value)}
                placeholder="ex: 123.456.789.001"
                autoComplete="off"
              />
            </Field>

            <Field id="telefone" label="Telefone" hint="Opcional">
              <input
                id="telefone"
                className={INPUT_CLS}
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 0000-0000"
                autoComplete="off"
                type="tel"
              />
            </Field>
            <Field id="email" label="E-mail" error={errors.email} hint="Opcional">
              <input
                id="email"
                className={INPUT_CLS}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="comercial@fornecedor.com.br"
                autoComplete="off"
                type="email"
              />
            </Field>
          </div>

          <Field id="endereco" label="Endereço" hint="Rua, número, cidade, UF. Opcional.">
            <input
              id="endereco"
              className={INPUT_CLS}
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Av. Brasil, 1000 · Centro · São Paulo · SP"
              autoComplete="off"
            />
          </Field>

          <Field id="observacoes" label="Observações" hint="Uso interno — não vai pra NF">
            <textarea
              id="observacoes"
              className={INPUT_CLS}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="ex: fornecedor com prazos longos — pedir com 15 dias de antecedência"
              rows={2}
            />
          </Field>

          {submitError && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700 dark:text-amber-300">
              {submitError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 h-10 rounded-xl text-sm font-medium text-slate-600 dark:text-white/55 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 text-white text-sm font-medium"
            >
              {submitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Cadastrar fornecedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
