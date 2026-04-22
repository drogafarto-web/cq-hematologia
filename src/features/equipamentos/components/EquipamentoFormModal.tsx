/**
 * EquipamentoFormModal — cadastro e edição de Equipamento.
 *
 * Fase D (2026-04-21 — 2º turno). Form único pra create + update — distingue
 * pelo prop `equipamento` (presente = edição). Module e modelo são imutáveis
 * pós-criação (mudar modelo = trocar equipamento; use aposentar + novo).
 *
 * Validações: name/modelo/fabricante obrigatórios. Anos entre 1990 e ano atual.
 */

import React, { useState } from 'react';
import { useUser } from '../../../store/useAuthStore';
import {
  createEquipamento,
  updateEquipamento,
} from '../services/equipamentoService';
import type { Equipamento } from '../types/Equipamento';
import type { InsumoModulo } from '../../insumos/types/Insumo';

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm
  focus:outline-none focus:border-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08]
  disabled:opacity-40 transition-all
`.trim();

const MODULE_LABEL: Record<InsumoModulo, string> = {
  hematologia: 'Hematologia',
  coagulacao: 'Coagulação',
  uroanalise: 'Uroanálise',
  imunologia: 'Imunologia',
};

interface EquipamentoFormModalProps {
  labId: string;
  /** Módulo pré-selecionado em criação. Ignorado em edição (imutável). */
  module?: InsumoModulo;
  /** Se presente, modo edição. */
  equipamento?: Equipamento;
  onClose: () => void;
  onSaved?: (equipamentoId: string) => void;
}

const MODULOS: InsumoModulo[] = ['hematologia', 'coagulacao', 'uroanalise', 'imunologia'];
const YEAR_NOW = new Date().getFullYear();

export function EquipamentoFormModal({
  labId,
  module: initialModule,
  equipamento,
  onClose,
  onSaved,
}: EquipamentoFormModalProps) {
  const user = useUser();
  const isEdit = Boolean(equipamento);

  const [moduleSel, setModuleSel] = useState<InsumoModulo>(
    equipamento?.module ?? initialModule ?? 'hematologia',
  );
  const [name, setName] = useState(equipamento?.name ?? '');
  const [modelo, setModelo] = useState(equipamento?.modelo ?? '');
  const [fabricante, setFabricante] = useState(equipamento?.fabricante ?? '');
  const [numeroSerie, setNumeroSerie] = useState(equipamento?.numeroSerie ?? '');
  const [anoFabricacao, setAnoFab] = useState<number | ''>(equipamento?.anoFabricacao ?? '');
  const [anoAquisicao, setAnoAq] = useState<number | ''>(equipamento?.anoAquisicao ?? '');
  const [registroAnvisa, setRegistro] = useState(equipamento?.registroAnvisa ?? '');
  const [observacoes, setObservacoes] = useState(equipamento?.observacoes ?? '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Nome é obrigatório (mín. 2 caracteres).';
    if (modelo.trim().length < 2) e.modelo = 'Modelo é obrigatório.';
    if (fabricante.trim().length < 2) e.fabricante = 'Fabricante é obrigatório.';
    const yr = (v: number | '') =>
      typeof v === 'number' && (v < 1990 || v > YEAR_NOW)
        ? `Ano deve estar entre 1990 e ${YEAR_NOW}.`
        : null;
    const fab = yr(anoFabricacao);
    if (fab) e.anoFabricacao = fab;
    const aq = yr(anoAquisicao);
    if (aq) e.anoAquisicao = aq;
    setErrors(e);
    return Object.keys(e).length === 0;
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
      if (isEdit && equipamento) {
        await updateEquipamento(labId, equipamento.id, {
          name: name.trim(),
          fabricante: fabricante.trim(),
          ...(numeroSerie.trim() && { numeroSerie: numeroSerie.trim() }),
          ...(typeof anoFabricacao === 'number' && { anoFabricacao }),
          ...(typeof anoAquisicao === 'number' && { anoAquisicao }),
          ...(registroAnvisa.trim() && { registroAnvisa: registroAnvisa.trim() }),
          ...(observacoes.trim() && { observacoes: observacoes.trim() }),
          updatedBy: user.uid,
          updatedByName: user.displayName ?? user.email ?? user.uid,
        });
        onSaved?.(equipamento.id);
        onClose();
      } else {
        const id = await createEquipamento(labId, {
          module: moduleSel,
          name: name.trim(),
          modelo: modelo.trim().toUpperCase().replace(/\s+/g, '_'),
          fabricante: fabricante.trim(),
          ...(numeroSerie.trim() && { numeroSerie: numeroSerie.trim() }),
          ...(typeof anoFabricacao === 'number' && { anoFabricacao }),
          ...(typeof anoAquisicao === 'number' && { anoAquisicao }),
          ...(registroAnvisa.trim() && { registroAnvisa: registroAnvisa.trim() }),
          ...(observacoes.trim() && { observacoes: observacoes.trim() }),
          createdBy: user.uid,
          createdByName: user.displayName ?? user.email ?? user.uid,
        });
        onSaved?.(id);
        onClose();
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao salvar equipamento.');
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
        aria-labelledby="equip-modal-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl"
      >
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between sticky top-0 bg-white dark:bg-[#0F1318] z-10">
          <div>
            <h2
              id="equip-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-white/90"
            >
              {isEdit ? 'Editar equipamento' : 'Novo equipamento'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              {isEdit
                ? 'Altera nome, nº série e observações. Módulo e modelo são imutáveis.'
                : 'Um equipamento por analisador. Lotes e setups referenciam este cadastro.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Módulo — imutável em edição */}
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-white/45 mb-2">
              Módulo {isEdit ? '' : <span className="text-red-500 ml-0.5">*</span>}
            </div>
            {isEdit ? (
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.04] text-sm text-slate-700 dark:text-white/65">
                {MODULE_LABEL[moduleSel]} <span className="text-slate-400 dark:text-white/30 text-xs ml-2">· imutável</span>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {MODULOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModuleSel(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      moduleSel === m
                        ? 'bg-violet-500/10 border-violet-500/50 text-violet-700 dark:text-violet-300'
                        : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-white/55'
                    }`}
                  >
                    {MODULE_LABEL[m]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field id="name" label="Nome de exibição" required error={errors.name}>
              <input
                id="name"
                className={INPUT_CLS}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Yumizen H550 — Bancada 2"
                autoComplete="off"
              />
            </Field>
            <Field
              id="modelo"
              label="Modelo normalizado"
              required
              error={errors.modelo}
              hint={isEdit ? 'Imutável após criação.' : 'UPPER_SNAKE_CASE (ex: YUMIZEN_H550)'}
            >
              <input
                id="modelo"
                className={INPUT_CLS}
                value={modelo}
                disabled={isEdit}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="YUMIZEN_H550"
                autoComplete="off"
              />
            </Field>
            <Field id="fabricante" label="Fabricante" required error={errors.fabricante}>
              <input
                id="fabricante"
                className={INPUT_CLS}
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
                placeholder="Horiba Medical"
                autoComplete="off"
              />
            </Field>
            <Field id="numeroSerie" label="Nº de série" hint="Recomendado para auditoria">
              <input
                id="numeroSerie"
                className={INPUT_CLS}
                value={numeroSerie}
                onChange={(e) => setNumeroSerie(e.target.value)}
                placeholder="ex: H550-2024-0812"
                autoComplete="off"
              />
            </Field>
            <Field id="anoFab" label="Ano de fabricação" error={errors.anoFabricacao}>
              <input
                id="anoFab"
                type="number"
                min={1990}
                max={YEAR_NOW}
                className={INPUT_CLS}
                value={anoFabricacao === '' ? '' : anoFabricacao}
                onChange={(e) =>
                  setAnoFab(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="2023"
              />
            </Field>
            <Field id="anoAq" label="Ano de aquisição" error={errors.anoAquisicao}>
              <input
                id="anoAq"
                type="number"
                min={1990}
                max={YEAR_NOW}
                className={INPUT_CLS}
                value={anoAquisicao === '' ? '' : anoAquisicao}
                onChange={(e) =>
                  setAnoAq(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="2024"
              />
            </Field>
          </div>

          <Field id="anvisa" label="Registro ANVISA" hint="Opcional — exigido em auditoria RDC 786">
            <input
              id="anvisa"
              className={INPUT_CLS}
              value={registroAnvisa}
              onChange={(e) => setRegistro(e.target.value)}
              placeholder="ex: 80146530001"
              autoComplete="off"
            />
          </Field>

          <Field id="obs" label="Observações" hint="Contrato de manutenção, calibração especial, etc">
            <textarea
              id="obs"
              rows={3}
              className={`${INPUT_CLS} resize-none`}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Livre…"
            />
          </Field>

          {submitError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
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
              {submitting ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Cadastrar equipamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id?: string;
  label: React.ReactNode;
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
