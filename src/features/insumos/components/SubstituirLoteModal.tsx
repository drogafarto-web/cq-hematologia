/**
 * SubstituirLoteModal — correção de cadastro com erro nos campos "duros".
 *
 * Caso de uso: operador cadastrou um lote com typo no número de lote, errou
 * o fabricante, marcou validade errada. Editar in-place quebra rastreabilidade
 * — então este fluxo descarta o antigo (motivo `correcao_cadastro`) e cria um
 * novo. Os dois ficam linkados via `replacedByInsumoId`/`replacesInsumoId`.
 *
 * Compliance:
 *  - Reauth via senha (EmailAuthProvider — senha NUNCA trafega ao server)
 *  - Justificativa obrigatória (mín 10 chars) — capturada no motivo de descarte
 *  - Service grava 2 movimentações `substituicao` no log imutável
 *  - Atomic (writeBatch): ou tudo, ou nada
 *
 * Subtype preservation: nivel (controle), equipamentoId (reagente), notaFiscal/
 * fornecedor/analitosIncluidos (tira-uro) são preservados do antigo. O operador
 * só edita os campos "duros" mais comuns (lote, fabricante, nomeComercial,
 * validade, dataAbertura, diasEstabilidadeAbertura, registroAnvisa).
 */

import React, { useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { auth } from '../../../shared/services/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useUser } from '../../../store/useAuthStore';
import { replaceInsumoForCorrection } from '../services/insumosFirebaseService';
import { isControle, isReagente, isTiraUro } from '../types/Insumo';
import type { CreateInsumoPayload } from '../services/insumosFirebaseService';
import type { Insumo } from '../types/Insumo';

// ─── Inline icons ─────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
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

const INPUT_CLS =
  'w-full px-3 py-2 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.10] text-sm text-slate-700 dark:text-white/85 placeholder-slate-400 dark:placeholder-white/25 focus:outline-none focus:border-slate-400 dark:focus:border-white/25 disabled:opacity-40';

function Field({
  htmlFor,
  label,
  required,
  hint,
  children,
}: {
  htmlFor?: string;
  label: string;
  required?: boolean;
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
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 dark:text-white/35 mt-1">{hint}</p>}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SubstituirLoteModalProps {
  insumo: Insumo;
  onClose: () => void;
  onReplaced?: (newInsumoId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SubstituirLoteModal({
  insumo,
  onClose,
  onReplaced,
}: SubstituirLoteModalProps) {
  const user = useUser();

  const [lote, setLote] = useState(insumo.lote);
  const [fabricante, setFabricante] = useState(insumo.fabricante);
  const [nomeComercial, setNomeComercial] = useState(insumo.nomeComercial);
  const [validade, setValidade] = useState(tsToInputDate(insumo.validade));
  const [dataAbertura, setDataAbertura] = useState(tsToInputDate(insumo.dataAbertura));
  const [diasEstab, setDiasEstab] = useState(String(insumo.diasEstabilidadeAbertura ?? 0));
  const [registroAnvisa, setRegistroAnvisa] = useState(insumo.registroAnvisa ?? '');
  const [justificativa, setJustificativa] = useState('');
  const [senha, setSenha] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => {
    if (lote !== insumo.lote) return true;
    if (fabricante !== insumo.fabricante) return true;
    if (nomeComercial !== insumo.nomeComercial) return true;
    if (validade !== tsToInputDate(insumo.validade)) return true;
    if (dataAbertura !== tsToInputDate(insumo.dataAbertura)) return true;
    if (Number(diasEstab) !== (insumo.diasEstabilidadeAbertura ?? 0)) return true;
    if ((registroAnvisa || undefined) !== insumo.registroAnvisa) return true;
    return false;
  }, [insumo, lote, fabricante, nomeComercial, validade, dataAbertura, diasEstab, registroAnvisa]);

  const podeSalvar =
    dirty &&
    lote.trim().length > 0 &&
    fabricante.trim().length > 0 &&
    nomeComercial.trim().length > 0 &&
    validade.length > 0 &&
    justificativa.trim().length >= 10 &&
    senha.length >= 6 &&
    !submitting;

  async function handleSubmit() {
    if (!user) return;
    setError(null);

    if (!dirty) {
      setError('Nada foi alterado. Use Editar pra ajustes secundários.');
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
      const validadeTs = inputDateToTs(validade);
      if (!validadeTs) {
        setError('Validade obrigatória.');
        setSubmitting(false);
        return;
      }
      const aberturaTs = inputDateToTs(dataAbertura);

      // Monta o payload do novo insumo preservando subtype-specific fields.
      const baseFields = {
        labId: insumo.labId,
        modulo: insumo.modulo,
        modulos: insumo.modulos,
        fabricante: fabricante.trim(),
        nomeComercial: nomeComercial.trim(),
        lote: lote.trim(),
        validade: validadeTs,
        dataAbertura: aberturaTs,
        diasEstabilidadeAbertura: dias,
        ...(registroAnvisa.trim() && { registroAnvisa: registroAnvisa.trim() }),
        ...(insumo.produtoId && { produtoId: insumo.produtoId }),
        ...(insumo.notaFiscalId && { notaFiscalId: insumo.notaFiscalId }),
        createdBy: user.uid,
      };

      let payload: CreateInsumoPayload;
      if (isControle(insumo)) {
        payload = {
          ...baseFields,
          tipo: 'controle',
          nivel: insumo.nivel,
          ...(insumo.stats && { stats: insumo.stats }),
          ...(insumo.statsPorModelo && { statsPorModelo: insumo.statsPorModelo }),
          ...(insumo.valoresEsperados && { valoresEsperados: insumo.valoresEsperados }),
          ...(insumo.equipamentosPermitidos && {
            equipamentosPermitidos: insumo.equipamentosPermitidos,
          }),
          ...(insumo.testTypesCompativeis && {
            testTypesCompativeis: insumo.testTypesCompativeis,
          }),
        };
      } else if (isReagente(insumo)) {
        payload = {
          ...baseFields,
          tipo: 'reagente',
          ...(insumo.equipamentoId && { equipamentoId: insumo.equipamentoId }),
          ...(insumo.testTypesCompativeis && {
            testTypesCompativeis: insumo.testTypesCompativeis,
          }),
        };
      } else if (isTiraUro(insumo)) {
        payload = {
          ...baseFields,
          modulo: 'uroanalise',
          modulos: ['uroanalise'],
          tipo: 'tira-uro',
          analitosIncluidos: insumo.analitosIncluidos,
          ...(insumo.notaFiscal && { notaFiscal: insumo.notaFiscal }),
          ...(insumo.fornecedor && { fornecedor: insumo.fornecedor }),
        };
      } else {
        setError('Tipo de insumo desconhecido.');
        setSubmitting(false);
        return;
      }

      const newId = await replaceInsumoForCorrection(
        insumo.labId,
        insumo.id,
        payload,
        justificativa.trim(),
        user.uid,
        user.displayName ?? user.email ?? 'Operador',
      );

      onReplaced?.(newId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao substituir lote.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-white/85">
            Substituir lote por correção
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
          {/* Aviso */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            O lote antigo será <strong>descartado</strong> com motivo{' '}
            <code className="font-mono">correcao_cadastro</code>, e um novo lote será criado com
            os dados corrigidos. Os dois ficam linkados no histórico — nenhum dado é perdido.
            Operação atômica e auditada.
          </div>

          {/* Diff visual: antigo → novo */}
          <section className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-white/45 mb-2">
              Lote antigo (será descartado)
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
                <span className="text-slate-400 dark:text-white/35">Nome: </span>
                <span className="text-slate-700 dark:text-white/75">{insumo.nomeComercial}</span>
              </div>
              <div>
                <span className="text-slate-400 dark:text-white/35">Validade: </span>
                <span className="text-slate-700 dark:text-white/75">
                  {fmtDateBR(insumo.validade)}
                </span>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-center text-slate-400 dark:text-white/30">
            <ArrowIcon />
          </div>

          {/* Editáveis */}
          <section className="rounded-xl border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/40 dark:bg-emerald-500/[0.04] px-4 py-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300 mb-1">
              Lote novo (correção)
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Field htmlFor="sub-lote" label="Lote" required>
                <input
                  id="sub-lote"
                  type="text"
                  value={lote}
                  onChange={(e) => setLote(e.target.value)}
                  disabled={submitting}
                  className={`${INPUT_CLS} font-mono`}
                />
              </Field>
              <Field htmlFor="sub-fabricante" label="Fabricante" required>
                <input
                  id="sub-fabricante"
                  type="text"
                  value={fabricante}
                  onChange={(e) => setFabricante(e.target.value)}
                  disabled={submitting}
                  className={INPUT_CLS}
                />
              </Field>
            </div>

            <Field htmlFor="sub-nome" label="Nome comercial" required>
              <input
                id="sub-nome"
                type="text"
                value={nomeComercial}
                onChange={(e) => setNomeComercial(e.target.value)}
                disabled={submitting}
                className={INPUT_CLS}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field htmlFor="sub-validade" label="Validade" required>
                <input
                  id="sub-validade"
                  type="date"
                  value={validade}
                  onChange={(e) => setValidade(e.target.value)}
                  disabled={submitting}
                  className={INPUT_CLS}
                />
              </Field>
              <Field htmlFor="sub-abertura" label="Data abertura">
                <input
                  id="sub-abertura"
                  type="date"
                  value={dataAbertura}
                  onChange={(e) => setDataAbertura(e.target.value)}
                  disabled={submitting}
                  className={INPUT_CLS}
                />
              </Field>
              <Field htmlFor="sub-estab" label="Estab. pós-abertura (d)">
                <input
                  id="sub-estab"
                  type="number"
                  min={0}
                  value={diasEstab}
                  onChange={(e) => setDiasEstab(e.target.value)}
                  disabled={submitting}
                  className={`${INPUT_CLS} tabular-nums`}
                />
              </Field>
            </div>

            <Field htmlFor="sub-anvisa" label="Registro ANVISA">
              <input
                id="sub-anvisa"
                type="text"
                value={registroAnvisa}
                onChange={(e) => setRegistroAnvisa(e.target.value)}
                disabled={submitting}
                className={`${INPUT_CLS} font-mono`}
              />
            </Field>
          </section>

          {/* Justificativa */}
          <Field
            htmlFor="sub-just"
            label="Justificativa *"
            hint="Obrigatória — mín. 10 caracteres. Vai pro audit log."
          >
            <textarea
              id="sub-just"
              rows={2}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              disabled={submitting}
              placeholder="Ex: Erro de digitação no número de lote — operador escreveu 'wedwed' em vez de 'WW2024-15'."
              className={`${INPUT_CLS} resize-none`}
            />
          </Field>

          {/* Senha */}
          <Field
            htmlFor="sub-senha"
            label="Senha do operador *"
            hint="Reauth local — não é transmitida ao servidor."
          >
            <input
              id="sub-senha"
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
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 transition-colors"
            >
              {submitting ? <SpinnerIcon /> : <ShieldIcon />} Substituir com assinatura
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
