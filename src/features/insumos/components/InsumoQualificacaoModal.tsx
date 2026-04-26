/**
 * InsumoQualificacaoModal — fluxo formal de qualificação de lote (PR1).
 *
 * Pré-requisito: trigger só visível pra RT/biomedico (no modelo atual:
 * owner/admin do lab — vide useUserRole). Componente pai gateia com
 * `canQualificar`.
 *
 * Estrutura (dark-first):
 *   - Gate tira-uro: placeholder "PR2 — não suportado" + botão Fechar.
 *   - Bloco 1 — Inspeção de Recebimento (5 checkboxes).
 *   - Bloco 2 — Evidência Analítica (renderiza conforme qualificacaoMode):
 *       * corrida-validacao: tabela de runs candidatas + botão "Rodar corrida"
 *       * checklist-rt:      apenas badge "Modo documental"
 *       * caracterizacao-rt: placeholder PR2 + botões disabled
 *   - Senha + assinatura no rodapé:
 *       * client valida `senha.length >= 6` antes do reauth
 *       * `reauthenticateWithCredential` local — senha NUNCA trafega pro server
 *       * callable `approveQualificacao` / `reproveQualificacao` em seguida
 *
 * PR1 — 2026-04-26.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { auth, functions, httpsCallable } from '../../../shared/services/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { createQualificacao } from '../services/insumoQualificacaoFirebaseService';
import {
  resolveQualificacaoMode,
  type ProdutoInsumo,
} from '../types/ProdutoInsumo';
import type {
  QualificacaoChecklistRecebimento,
  QualificacaoMode,
} from '../types/InsumoQualificacao';
import type { Insumo } from '../types/Insumo';
import type { CIQImunoRun } from '../../ciq-imuno/types/CIQImuno';

// ─── Inline icons ────────────────────────────────────────────────────────────

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

// ─── Checklist defaults ──────────────────────────────────────────────────────

const EMPTY_CHECKLIST: QualificacaoChecklistRecebimento = {
  embalagemIntegra: false,
  prazoValidade: false,
  condicoesTransporte: false,
  dadosFabricante: false,
  registroAnvisa: false,
};

const CHECKLIST_ITEMS: Array<{
  key: keyof QualificacaoChecklistRecebimento;
  label: string;
  hint?: string;
}> = [
  { key: 'embalagemIntegra', label: 'Embalagem íntegra (sem violação visível)' },
  { key: 'prazoValidade', label: 'Prazo de validade compatível (>30 dias após chegada)' },
  { key: 'condicoesTransporte', label: 'Condições de transporte adequadas (cadeia de frio quando aplicável)' },
  { key: 'dadosFabricante', label: 'Dados do fabricante legíveis (nome, lote, validade)' },
  { key: 'registroAnvisa', label: 'Registro ANVISA presente quando aplicável (RDC 786 art. 42)' },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface InsumoQualificacaoModalProps {
  open: boolean;
  onClose: () => void;
  insumo: Insumo;
  produto: ProdutoInsumo | null;
  /**
   * Corridas candidatas para evidência. Caller fornece (já filtradas por
   * `insumosSnapshot[slotEsperado].id === insumo.id`). Vazio ⇒ UI mostra aviso
   * amber + botão "Rodar corrida de validação →" (que dispara `onRodarCorrida`).
   */
  candidateRuns: CIQImunoRun[];
  /** Disparado quando o operador clica em "Rodar corrida de validação". */
  onRodarCorrida?: () => void;
  /** Callback após aprovação/reprovação bem-sucedida. */
  onDecided?: (decision: 'aprovado' | 'reprovado') => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slotEsperadoFor(insumo: Insumo): 'reagente' | 'controlePositivo' | 'controleNegativo' | null {
  if (insumo.tipo === 'reagente') return 'reagente';
  if (insumo.tipo === 'controle' && 'nivel' in insumo) {
    if (insumo.nivel === 'positivo') return 'controlePositivo';
    if (insumo.nivel === 'negativo') return 'controleNegativo';
  }
  return null;
}

function isRunConforme(run: CIQImunoRun): boolean {
  if (run.resultadoObtido !== run.resultadoEsperado) return false;
  if (
    run.resultadoEsperadoNegativo !== undefined &&
    run.resultadoObtidoNegativo !== undefined &&
    run.resultadoObtidoNegativo !== run.resultadoEsperadoNegativo
  ) {
    return false;
  }
  return true;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function InsumoQualificacaoModal({
  open,
  onClose,
  insumo,
  produto,
  candidateRuns,
  onRodarCorrida,
  onDecided,
}: InsumoQualificacaoModalProps) {
  const labId = useActiveLabId();
  const user = useUser();

  const qualificacaoMode: QualificacaoMode = useMemo(() => {
    if (!produto) return 'checklist-rt';
    return resolveQualificacaoMode(produto);
  }, [produto]);

  const isTiraUro = insumo.tipo === 'tira-uro';
  const isPR2Mode = qualificacaoMode === 'caracterizacao-rt';

  const [checklist, setChecklist] = useState<QualificacaoChecklistRecebimento>(EMPTY_CHECKLIST);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [senha, setSenha] = useState('');
  const [motivoReprovacao, setMotivoReprovacao] = useState('');
  const [notificarNotivisa, setNotificarNotivisa] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'aprovar' | 'reprovar'>('aprovar');

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setChecklist(EMPTY_CHECKLIST);
      setSelectedRunIds([]);
      setSenha('');
      setMotivoReprovacao('');
      setNotificarNotivisa(false);
      setError(null);
      setMode('aprovar');
    }
  }, [open]);

  if (!open) return null;

  // ── Tira-uro placeholder ───────────────────────────────────────────────────
  if (isTiraUro) {
    return (
      <Backdrop onClose={onClose}>
        <ModalShell title="Qualificação de tira-uro" onClose={onClose}>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-3">
            <p className="text-sm text-white/75">
              Tiras de uroanálise não estão cobertas pelo PR1. O fluxo
              específico (UroanaliseRun com shape distinto) será entregue no
              PR2.
            </p>
            <p className="text-[12px] text-white/50">
              Por enquanto: este lote permanece elegível para uso conforme as
              regras existentes do módulo Uroanálise.
            </p>
          </div>
          <div className="flex justify-end mt-4">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/80"
            >
              Fechar
            </button>
          </div>
        </ModalShell>
      </Backdrop>
    );
  }

  const checklistAllChecked = CHECKLIST_ITEMS.every((it) => checklist[it.key] === true);
  const evidenciaOk =
    qualificacaoMode === 'checklist-rt' ||
    (qualificacaoMode === 'corrida-validacao' && selectedRunIds.length >= 1);

  const podeAprovar =
    !isPR2Mode &&
    checklistAllChecked &&
    evidenciaOk &&
    senha.length >= 6 &&
    !submitting;

  const podeReprovar =
    !isPR2Mode &&
    motivoReprovacao.trim().length >= 3 &&
    senha.length >= 6 &&
    !submitting;

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function reauth(): Promise<boolean> {
    setError(null);
    if (senha.length < 6) {
      setError('Informe sua senha (mínimo 6 caracteres).');
      return false;
    }
    const u = auth.currentUser;
    if (!u || !u.email) {
      setError('Sessão expirada. Faça login novamente.');
      return false;
    }
    try {
      const cred = EmailAuthProvider.credential(u.email, senha);
      await reauthenticateWithCredential(u, cred);
      return true;
    } catch {
      setError('Senha incorreta.');
      return false;
    }
  }

  async function handleAprovar() {
    if (!labId || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      // 1. Cria qualificação client-side em estado pendente.
      const qId = await createQualificacao(labId, {
        insumoId: insumo.id,
        produtoId: produto?.id ?? '',
        tipo: insumo.tipo === 'tira-uro' ? 'reagente' : insumo.tipo,
        nivel:
          insumo.tipo === 'controle' && 'nivel' in insumo
            ? insumo.nivel === 'positivo' || insumo.nivel === 'negativo'
              ? insumo.nivel
              : undefined
            : undefined,
        modulo: insumo.modulo,
        qualificacaoMode,
        checklistRecebimento: checklist,
        evidenciaRunIds: selectedRunIds,
        createdBy: user.uid,
      });

      // 2. Reauth (após criar — assim doc fica gravado mesmo se reauth falhar).
      const ok = await reauth();
      if (!ok) {
        setSubmitting(false);
        return;
      }

      // 3. Callable
      const fn = httpsCallable(functions, 'approveQualificacao');
      await fn({ labId, qId, evidenciaRunIds: selectedRunIds });

      onDecided?.('aprovado');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Falha ao aprovar: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReprovar() {
    if (!labId || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      const qId = await createQualificacao(labId, {
        insumoId: insumo.id,
        produtoId: produto?.id ?? '',
        tipo: insumo.tipo === 'tira-uro' ? 'reagente' : insumo.tipo,
        nivel:
          insumo.tipo === 'controle' && 'nivel' in insumo
            ? insumo.nivel === 'positivo' || insumo.nivel === 'negativo'
              ? insumo.nivel
              : undefined
            : undefined,
        modulo: insumo.modulo,
        qualificacaoMode,
        checklistRecebimento: checklist,
        evidenciaRunIds: [],
        createdBy: user.uid,
      });

      const ok = await reauth();
      if (!ok) {
        setSubmitting(false);
        return;
      }

      const fn = httpsCallable(functions, 'reproveQualificacao');
      await fn({
        labId,
        qId,
        motivoReprovacao: motivoReprovacao.trim(),
        notificarNotivisa,
      });

      onDecided?.('reprovado');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Falha ao reprovar: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const slotEsperado = slotEsperadoFor(insumo);
  const evidenciaCandidatas = candidateRuns;

  return (
    <Backdrop onClose={onClose}>
      <ModalShell title="Qualificação Formal de Insumo" onClose={onClose}>
        {/* Header info */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 mb-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-violet-300/85">
              {insumo.tipo === 'reagente' ? 'Reagente' : `Controle ${'nivel' in insumo ? `· ${insumo.nivel}` : ''}`}
            </p>
            <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-400">
              {qualificacaoMode === 'corrida-validacao'
                ? 'Modo: corrida de validação'
                : qualificacaoMode === 'checklist-rt'
                  ? 'Modo: documental'
                  : 'Modo: caracterização (PR2)'}
            </span>
          </div>
          <p className="text-[14px] font-semibold text-white/90">
            {insumo.nomeComercial} · Lote {insumo.lote}
          </p>
          <p className="text-[11px] text-white/45 mt-0.5">
            {insumo.fabricante} · Validade {insumo.validade.toDate().toLocaleDateString('pt-BR')}
          </p>
        </div>

        {/* PR2 mode placeholder */}
        {isPR2Mode && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-4">
            <p className="text-[13px] font-semibold text-amber-300">
              Caracterização (PR2) — não suportado neste release.
            </p>
            <p className="text-[12px] text-amber-200/70 mt-1">
              Multianalíticos / quantitativos com caracterização exigem fluxo
              próprio (CLSI EP15) que será entregue no PR2. Botão Aprovar
              desabilitado.
            </p>
          </div>
        )}

        {/* Bloco 1 — Inspeção de Recebimento */}
        <Section title="Inspeção de recebimento">
          <div className="space-y-2">
            {CHECKLIST_ITEMS.map((it) => (
              <label
                key={it.key}
                className="flex items-start gap-2.5 p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checklist[it.key]}
                  onChange={(e) =>
                    setChecklist((prev) => ({ ...prev, [it.key]: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-white/20 text-emerald-500 focus:ring-emerald-500"
                  disabled={submitting}
                />
                <span className="text-[13px] text-white/80 leading-snug">{it.label}</span>
              </label>
            ))}
          </div>
        </Section>

        {/* Bloco 2 — Evidência Analítica */}
        {qualificacaoMode === 'corrida-validacao' && (
          <Section title="Evidência analítica">
            {evidenciaCandidatas.length === 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-[13px] text-amber-300 font-semibold">
                  Nenhuma corrida usando este lote no slot {slotEsperado ?? '—'}.
                </p>
                <p className="text-[12px] text-amber-200/70 mt-1 mb-3">
                  Rode pelo menos uma corrida de validação com este lote
                  selecionado no slot correto. A modal de qualificação
                  permanece aberta — o drawer da corrida abre por cima.
                </p>
                {onRodarCorrida && (
                  <button
                    type="button"
                    onClick={onRodarCorrida}
                    className="h-8 px-3 rounded-lg text-[12px] font-semibold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200"
                  >
                    Rodar corrida de validação →
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-white/45">
                    <tr>
                      <th className="px-3 py-2 text-left">✓</th>
                      <th className="px-3 py-2 text-left">Run</th>
                      <th className="px-3 py-2 text-left">Data</th>
                      <th className="px-3 py-2 text-left">Esperado/Obtido</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {evidenciaCandidatas.map((run) => {
                      const conforme = isRunConforme(run);
                      const checked = selectedRunIds.includes(run.id);
                      return (
                        <tr key={run.id} className="hover:bg-white/[0.02]">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!conforme || submitting}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRunIds((p) => [...p, run.id]);
                                } else {
                                  setSelectedRunIds((p) => p.filter((id) => id !== run.id));
                                }
                              }}
                              className="h-4 w-4 rounded border-white/20 text-emerald-500"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-white/80">{run.runCode ?? run.id.slice(0, 8)}</td>
                          <td className="px-3 py-2 text-white/60">{run.dataRealizacao}</td>
                          <td className="px-3 py-2 text-white/80">
                            {run.resultadoEsperado}/{run.resultadoObtido}
                          </td>
                          <td className="px-3 py-2">
                            {conforme ? (
                              <span className="text-emerald-400 font-semibold">conforme</span>
                            ) : (
                              <span className="text-red-400 font-semibold">divergente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {qualificacaoMode === 'checklist-rt' && (
          <Section title="Evidência analítica">
            <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.08] p-4">
              <p className="text-[13px] font-semibold text-violet-300">Modo documental</p>
              <p className="text-[12px] text-white/60 mt-1">
                Este produto foi configurado para qualificação documental
                (sem corrida de validação obrigatória). A inspeção de
                recebimento + assinatura RT/biomedico já cumpre o requisito
                regulatório.
              </p>
            </div>
          </Section>
        )}

        {/* Reprovar block */}
        {mode === 'reprovar' && (
          <Section title="Motivo de reprovação">
            <textarea
              value={motivoReprovacao}
              onChange={(e) => setMotivoReprovacao(e.target.value)}
              rows={3}
              placeholder="Descreva a razão da reprovação (mínimo 3 caracteres)…"
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg text-[13px] bg-white/[0.04] border border-white/[0.08] text-white/85 placeholder:text-white/30 focus:outline-none focus:border-red-500/50"
            />
            <label className="mt-3 flex items-center gap-2 text-[12px] text-white/70">
              <input
                type="checkbox"
                checked={notificarNotivisa}
                onChange={(e) => setNotificarNotivisa(e.target.checked)}
                disabled={submitting}
                className="h-4 w-4 rounded border-white/20 text-red-500"
              />
              Notificar NOTIVISA (queixa técnica/evento adverso)
            </label>
          </Section>
        )}

        {/* Senha + assinatura */}
        <Section title="Senha + assinatura">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 mb-2 text-emerald-400">
              <ShieldIcon />
              <span className="text-[11px] uppercase tracking-wider font-semibold">
                Re-autenticação local
              </span>
            </div>
            <p className="text-[11px] text-white/50 mb-2.5 leading-snug">
              Sua senha é validada localmente (Firebase Auth). Ela NUNCA é enviada
              ao servidor — apenas o token de sessão renovado.
            </p>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite sua senha"
              disabled={submitting}
              autoComplete="current-password"
              className="w-full px-3 py-2 rounded-lg text-[13px] bg-white/[0.04] border border-white/[0.08] text-white/85 placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        </Section>

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-3 py-2 text-[12px] text-red-300">
            {error}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-9 px-4 rounded-lg text-[12px] font-semibold text-white/60 hover:text-white/85"
          >
            Cancelar
          </button>
          <div className="flex gap-2">
            {mode === 'aprovar' ? (
              <>
                <button
                  type="button"
                  onClick={() => setMode('reprovar')}
                  disabled={submitting}
                  className="h-9 px-4 rounded-lg text-[12px] font-semibold bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300"
                >
                  Reprovar
                </button>
                <button
                  type="button"
                  onClick={handleAprovar}
                  disabled={!podeAprovar}
                  className="h-9 px-4 rounded-lg text-[12px] font-semibold bg-emerald-500 hover:bg-emerald-600 disabled:bg-white/[0.06] disabled:text-white/30 text-white"
                >
                  Aprovar Insumo
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMode('aprovar')}
                  disabled={submitting}
                  className="h-9 px-4 rounded-lg text-[12px] font-semibold text-white/60 hover:text-white/85"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleReprovar}
                  disabled={!podeReprovar}
                  className="h-9 px-4 rounded-lg text-[12px] font-semibold bg-red-500 hover:bg-red-600 disabled:bg-white/[0.06] disabled:text-white/30 text-white"
                >
                  Confirmar reprovação
                </button>
              </>
            )}
          </div>
        </div>
      </ModalShell>
    </Backdrop>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl">
        {children}
      </div>
    </div>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#141417] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
        <h2 className="text-[14px] font-bold text-white/90 tracking-tight">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-white/50 hover:bg-white/[0.06] hover:text-white/80"
          aria-label="Fechar"
        >
          <XIcon />
        </button>
      </div>
      <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="text-[10px] uppercase tracking-widest font-semibold text-white/40 mb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}
