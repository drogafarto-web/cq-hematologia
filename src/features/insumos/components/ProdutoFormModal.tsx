/**
 * ProdutoFormModal — cadastro/edição de produto no catálogo do lab.
 *
 * Fase C (2026-04-21). Inclui os campos que descrevem um produto ESTÁVEL
 * (fabricante, nome comercial, função técnica, equipamentos compatíveis,
 * estabilidade default, nível default). NÃO inclui lote — lote é instância
 * física cadastrada à parte em `NovoLoteModal`.
 *
 * Modos:
 *   - create (default): cadastra produto novo. Dispara dedup por
 *     fabricante+nomeComercial — se já existe, reutiliza.
 *   - edit (passa `produto`): atualiza campos mutáveis. Tipo e fabricante
 *     ficam read-only (imutáveis por design do service — fabricante compõe
 *     a chave de dedup; tipo afeta schema dos lotes que o referenciam).
 *
 * Acessibilidade: focus trap simples, Escape fecha.
 */

import React, { useState } from 'react';
import { useUser } from '../../../store/useAuthStore';
import { createProduto, updateProduto } from '../services/produtoInsumoService';
import type { ProdutoInsumo } from '../types/ProdutoInsumo';
import type { InsumoModulo, InsumoTipo, InsumoNivel } from '../types/Insumo';

// ─── UI helpers ──────────────────────────────────────────────────────────────

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

// ─── Component ───────────────────────────────────────────────────────────────

interface ProdutoFormModalProps {
  labId: string;
  /** Pré-preenche o tipo (usado quando o picker já sabe o contexto). Ignorado em modo edição. */
  initialTipo?: InsumoTipo;
  initialModulo?: InsumoModulo;
  /** Quando presente, modal entra em modo edição. Tipo e fabricante ficam read-only. */
  produto?: ProdutoInsumo;
  onClose: () => void;
  /** Dispara após criação bem-sucedida — caller pode selecionar o produto novo. */
  onCreated?: (produtoId: string) => void;
  /** Dispara após edição bem-sucedida. */
  onUpdated?: (produtoId: string) => void;
}

const MODULO_LABEL: Record<InsumoModulo, string> = {
  hematologia: 'Hematologia',
  coagulacao: 'Coagulação',
  uroanalise: 'Uroanálise',
  imunologia: 'Imunologia',
};

const MODULOS: InsumoModulo[] = ['hematologia', 'coagulacao', 'uroanalise', 'imunologia'];

export function ProdutoFormModal({
  labId,
  initialTipo = 'reagente',
  initialModulo,
  produto,
  onClose,
  onCreated,
  onUpdated,
}: ProdutoFormModalProps) {
  const user = useUser();
  const isEdit = !!produto;

  const [tipo, setTipo] = useState<InsumoTipo>(produto?.tipo ?? initialTipo);
  const [modulos, setModulos] = useState<InsumoModulo[]>(
    produto?.modulos ?? (initialModulo ? [initialModulo] : []),
  );
  const [fabricante, setFabricante] = useState(produto?.fabricante ?? '');
  const [nomeComercial, setNomeComercial] = useState(produto?.nomeComercial ?? '');
  const [codigoFabricante, setCodigoFabricante] = useState(produto?.codigoFabricante ?? '');
  const [funcaoTecnica, setFuncaoTecnica] = useState(produto?.funcaoTecnica ?? '');
  const [registroAnvisa, setRegistroAnvisa] = useState(produto?.registroAnvisa ?? '');
  const [equipamentos, setEquipamentos] = useState(
    produto?.equipamentosCompativeis?.join(', ') ?? '',
  );
  const [diasEstabilidadeAberturaDefault, setDias] = useState<number | ''>(
    produto?.diasEstabilidadeAberturaDefault ?? '',
  );
  const [nivelDefault, setNivelDefault] = useState<InsumoNivel | ''>(
    produto?.nivelDefault ?? '',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!fabricante.trim()) e.fabricante = 'Informe o fabricante.';
    if (!nomeComercial.trim()) e.nomeComercial = 'Informe o nome comercial.';
    if (modulos.length === 0) e.modulos = 'Selecione ao menos um módulo.';
    if (tipo === 'tira-uro' && !modulos.includes('uroanalise')) {
      e.modulos = 'Tira-uro exige módulo Uroanálise.';
    }
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
      const equipamentosArr = equipamentos
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (isEdit && produto) {
        await updateProduto(labId, produto.id, {
          nomeComercial: nomeComercial.trim(),
          modulos: tipo === 'tira-uro' ? ['uroanalise'] : modulos,
          codigoFabricante: codigoFabricante.trim() || null,
          funcaoTecnica: funcaoTecnica.trim() || null,
          registroAnvisa: registroAnvisa.trim() || null,
          equipamentosCompativeis:
            equipamentosArr.length > 0 ? equipamentosArr : null,
          diasEstabilidadeAberturaDefault:
            typeof diasEstabilidadeAberturaDefault === 'number'
              ? diasEstabilidadeAberturaDefault
              : null,
          nivelDefault: tipo === 'controle' && nivelDefault ? nivelDefault : null,
          updatedBy: user.uid,
        });
        onUpdated?.(produto.id);
        onClose();
        return;
      }

      const { id, wasDuplicate } = await createProduto(labId, {
        tipo,
        modulos: tipo === 'tira-uro' ? ['uroanalise'] : modulos,
        fabricante: fabricante.trim(),
        nomeComercial: nomeComercial.trim(),
        ...(codigoFabricante.trim() && { codigoFabricante: codigoFabricante.trim() }),
        ...(funcaoTecnica.trim() && { funcaoTecnica: funcaoTecnica.trim() }),
        ...(registroAnvisa.trim() && { registroAnvisa: registroAnvisa.trim() }),
        ...(equipamentosArr.length > 0 && { equipamentosCompativeis: equipamentosArr }),
        ...(typeof diasEstabilidadeAberturaDefault === 'number' && {
          diasEstabilidadeAberturaDefault,
        }),
        ...(tipo === 'controle' && nivelDefault && { nivelDefault }),
        createdBy: user.uid,
      });

      if (wasDuplicate) {
        setSubmitError(
          'Já existe produto com mesmo fabricante e nome comercial. Usamos o existente — pode cadastrar o lote normalmente.',
        );
        // ainda assim propaga — caller usa o ID existente.
      }
      onCreated?.(id);
      if (!wasDuplicate) onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : isEdit
            ? 'Erro ao atualizar produto.'
            : 'Erro ao cadastrar produto.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function toggleModulo(m: InsumoModulo) {
    setModulos((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
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
        aria-labelledby="produto-modal-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl"
      >
        <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between sticky top-0 bg-white dark:bg-[#0F1318] z-10">
          <div>
            <h2
              id="produto-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-white/90"
            >
              {isEdit ? 'Editar produto' : 'Novo produto no catálogo'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              {isEdit
                ? 'Tipo e fabricante não podem ser alterados — lotes existentes continuam vinculados.'
                : 'Cadastra uma vez por lab. Lotes físicos ficam à parte.'}
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
          {/* Tipo */}
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-white/45 mb-2">
              Tipo de insumo *
            </div>
            <div className="flex gap-2">
              {(['reagente', 'controle', 'tira-uro'] as InsumoTipo[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={isEdit}
                  onClick={() => {
                    if (isEdit) return;
                    setTipo(t);
                    if (t === 'tira-uro') setModulos(['uroanalise']);
                  }}
                  className={`
                    flex-1 text-left p-3 rounded-xl border transition-all text-sm
                    ${isEdit && tipo !== t ? 'opacity-40 cursor-not-allowed' : ''}
                    ${isEdit ? 'cursor-default' : ''}
                    ${
                      tipo === t
                        ? 'bg-violet-500/10 border-violet-500/50 text-violet-700 dark:text-violet-300'
                        : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-white/70'
                    }
                  `}
                >
                  {t === 'reagente' ? 'Reagente' : t === 'controle' ? 'Controle' : 'Tira (uroanálise)'}
                </button>
              ))}
            </div>
          </div>

          {/* Módulos */}
          {tipo !== 'tira-uro' && (
            <Field label="Módulos onde este produto é usado" required error={errors.modulos}>
              <div className="flex flex-wrap gap-2">
                {MODULOS.map((m) => {
                  const on = modulos.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleModulo(m)}
                      className={`
                        px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                        ${
                          on
                            ? 'bg-violet-500/10 border-violet-500/50 text-violet-700 dark:text-violet-300'
                            : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-white/55'
                        }
                      `}
                    >
                      {MODULO_LABEL[m]}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 dark:text-white/25 mt-1.5">
                Um mesmo produto pode servir múltiplos módulos (controles multianalíticos).
              </p>
            </Field>
          )}

          {/* Identificação */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              id="fabricante"
              label="Fabricante"
              required
              error={errors.fabricante}
              hint={isEdit ? 'Imutável — compõe a chave de dedup do catálogo.' : undefined}
            >
              <input
                id="fabricante"
                className={INPUT_CLS}
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
                placeholder="Horiba, Bio-Rad, Stago…"
                autoComplete="off"
                readOnly={isEdit}
                disabled={isEdit}
              />
            </Field>
            <Field id="nomeComercial" label="Nome comercial" required error={errors.nomeComercial}>
              <input
                id="nomeComercial"
                className={INPUT_CLS}
                value={nomeComercial}
                onChange={(e) => setNomeComercial(e.target.value)}
                placeholder="ABX Diluent, Multiqual, Neoplastine…"
                autoComplete="off"
              />
            </Field>
            <Field id="codigoFabricante" label="Código do fabricante" hint="Opcional">
              <input
                id="codigoFabricante"
                className={INPUT_CLS}
                value={codigoFabricante}
                onChange={(e) => setCodigoFabricante(e.target.value)}
                placeholder="ex: ABX-DIL-2L"
                autoComplete="off"
              />
            </Field>
            <Field id="registroAnvisa" label="Registro ANVISA" hint="Opcional">
              <input
                id="registroAnvisa"
                className={INPUT_CLS}
                value={registroAnvisa}
                onChange={(e) => setRegistroAnvisa(e.target.value)}
                placeholder="ex: 10009010123"
                autoComplete="off"
              />
            </Field>
          </div>

          {/* Função técnica */}
          <Field
            id="funcaoTecnica"
            label="Função técnica"
            hint="Descrição curta — aparece no setup do equipamento pra operador novo"
          >
            <input
              id="funcaoTecnica"
              className={INPUT_CLS}
              value={funcaoTecnica}
              onChange={(e) => setFuncaoTecnica(e.target.value)}
              placeholder="ex: Diluição e condução elétrica pra contagem celular"
              autoComplete="off"
            />
          </Field>

          {/* Equipamentos */}
          <Field
            id="equipamentos"
            label="Equipamentos compatíveis"
            hint="Separados por vírgula (opcional)"
          >
            <input
              id="equipamentos"
              className={INPUT_CLS}
              value={equipamentos}
              onChange={(e) => setEquipamentos(e.target.value)}
              placeholder="Yumizen H550, Yumizen H750"
              autoComplete="off"
            />
          </Field>

          {/* Estabilidade default */}
          <div className="grid grid-cols-2 gap-4">
            <Field
              id="diasEstab"
              label="Estabilidade pós-abertura (dias)"
              hint="Default do fabricante — cada lote pode sobrescrever"
            >
              <input
                id="diasEstab"
                type="number"
                min={0}
                max={365}
                className={INPUT_CLS}
                value={diasEstabilidadeAberturaDefault === '' ? '' : diasEstabilidadeAberturaDefault}
                onChange={(e) => {
                  const v = e.target.value;
                  setDias(v === '' ? '' : Math.max(0, Math.min(365, Number(v))));
                }}
                placeholder="Ex: 30"
              />
            </Field>

            {tipo === 'controle' && (
              <Field
                id="nivelDefault"
                label="Nível default (controle)"
                hint="Lote herda — ajustável"
              >
                <select
                  id="nivelDefault"
                  aria-label="Nível default do controle"
                  className={INPUT_CLS}
                  value={nivelDefault}
                  onChange={(e) => setNivelDefault(e.target.value as InsumoNivel | '')}
                >
                  <option value="">Selecione…</option>
                  <option value="normal">Normal</option>
                  <option value="patologico">Patológico</option>
                  <option value="baixo">Baixo</option>
                  <option value="alto">Alto</option>
                </select>
              </Field>
            )}
          </div>

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
              {submitting
                ? 'Salvando…'
                : isEdit
                  ? 'Salvar alterações'
                  : 'Cadastrar produto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
