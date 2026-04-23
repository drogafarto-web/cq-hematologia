/**
 * EquipamentoCard — card expansível com dados, setup ativo e ações do ciclo
 * de vida do equipamento. Peça central da nova InsumosView (Fase D).
 *
 * Modos:
 *   - Colapsado: header com nome/modelo/status + quick actions
 *   - Expandido: setup ativo (slots) + resumo de produtos/lotes + CTAs
 *
 * Ações disponíveis dependem do status:
 *   - ativo:      editar · entrar manutenção · aposentar
 *   - manutencao: editar · liberar manutenção · aposentar
 *   - aposentado: apenas leitura
 */

import React, { useMemo, useState } from 'react';
import { useInsumos } from '../../insumos/hooks/useInsumos';
import { useProdutos } from '../../insumos/hooks/useProdutos';
import { useEquipmentSetup } from '../../insumos/hooks/useEquipmentSetup';
import { NovoLoteModal } from '../../insumos/components/NovoLoteModal';
import { EquipamentoFormModal } from './EquipamentoFormModal';
import {
  EnterManutencaoModal,
  LeaveManutencaoModal,
  AposentarEquipamentoModal,
} from './EquipamentoLifecycleModal';
import type { Equipamento } from '../types/Equipamento';
import type { Insumo, InsumoModulo, InsumoTipo } from '../../insumos/types/Insumo';
import { insumoCobreEquipamento } from '../../insumos/types/Insumo';
import { validadeStatus, diasAteVencer } from '../../insumos/utils/validadeReal';
import { resolveInsumoState } from '../../insumos/utils/insumoState';

// ─── Tokens ──────────────────────────────────────────────────────────────────

const CHIP = `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border`;

const STATUS_CHIP: Record<Equipamento['status'], { cls: string; label: string }> = {
  ativo: {
    cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
    label: 'Ativo',
  },
  manutencao: {
    cls: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
    label: 'Em manutenção',
  },
  aposentado: {
    cls: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-600 dark:text-zinc-400',
    label: 'Aposentado',
  },
};

// ─── Card ────────────────────────────────────────────────────────────────────

interface EquipamentoCardProps {
  equipamento: Equipamento;
  canMutate: boolean;
  onTrocarSlot?: (slot: 'reagente' | 'controle' | 'tira', equipamentoId: string) => void;
  /** Abre a aba global de Catálogo, com filtro de módulo pré-aplicado. */
  onOpenCatalogo?: (moduloFilter?: InsumoModulo) => void;
}

export function EquipamentoCard({
  equipamento,
  canMutate,
  onTrocarSlot,
  onOpenCatalogo,
}: EquipamentoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showEnterManu, setShowEnterManu] = useState(false);
  const [showLeaveManu, setShowLeaveManu] = useState(false);
  const [showAposentar, setShowAposentar] = useState(false);
  const [showNovoLote, setShowNovoLote] = useState(false);

  const isAposentado = equipamento.status === 'aposentado';
  const isManutencao = equipamento.status === 'manutencao';

  const { setup } = useEquipmentSetup(expanded ? equipamento.id : null);

  // Produtos do módulo (pode ser usado neste equipamento)
  const produtoFilters = useMemo(() => ({ modulo: equipamento.module }), [equipamento.module]);
  const { produtos } = useProdutos(expanded ? produtoFilters : {});

  // Lotes ativos vinculados a este equipamento
  const insumoFilters = useMemo(
    () => ({ status: 'ativo' as const, modulo: equipamento.module }),
    [equipamento.module],
  );
  const { insumos: allAtivos } = useInsumos(expanded ? insumoFilters : {});
  const insumosDesseEquipamento = useMemo(
    () => allAtivos.filter((i) => insumoCobreEquipamento(i, equipamento.id)),
    [allAtivos, equipamento.id],
  );

  const s = STATUS_CHIP[equipamento.status];

  return (
    <>
      <div
        className={`
          rounded-2xl bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08]
          transition-all ${isAposentado ? 'opacity-60' : ''}
        `}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="p-4 flex items-start gap-4">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex-1 text-left"
            aria-expanded={expanded ? 'true' : 'false'}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`${CHIP} ${s.cls}`}>{s.label}</span>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-white/30 font-semibold">
                {equipamento.fabricante}
              </p>
            </div>
            <p className="text-base font-semibold text-slate-900 dark:text-white/90 mt-1">
              {equipamento.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
              {equipamento.modelo}
              {equipamento.numeroSerie && ` · Nº série ${equipamento.numeroSerie}`}
            </p>
            {isManutencao && equipamento.motivoManutencao && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 italic">
                Manutenção: {equipamento.motivoManutencao}
              </p>
            )}
            {isAposentado && equipamento.retencaoAte && (
              <p className="text-[11px] text-slate-400 dark:text-white/35 mt-1.5">
                Retido em auditoria até{' '}
                {equipamento.retencaoAte.toDate().toLocaleDateString('pt-BR')}
              </p>
            )}
          </button>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {canMutate && !isAposentado && (
              <ActionsMenu
                status={equipamento.status}
                onEdit={() => setShowEdit(true)}
                onEnterManu={() => setShowEnterManu(true)}
                onLeaveManu={() => setShowLeaveManu(true)}
                onAposentar={() => setShowAposentar(true)}
              />
            )}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
              aria-label={expanded ? 'Recolher' : 'Expandir'}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
                className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
              >
                <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Expanded ──────────────────────────────────────────────────── */}
        {expanded && (
          <div className="border-t border-slate-100 dark:border-white/[0.04] p-4 space-y-4">
            {/* Setup ativo */}
            {!isAposentado && (
              <section>
                <SectionTitle
                  title="Setup atual (lotes rodando agora)"
                  subtitle="Slots consumidos pela próxima corrida"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <SlotCard
                    label="Reagente"
                    insumoId={setup?.activeReagenteId ?? null}
                    insumos={allAtivos}
                    onTrocar={
                      canMutate && !isManutencao && onTrocarSlot
                        ? () => onTrocarSlot('reagente', equipamento.id)
                        : undefined
                    }
                  />
                  <SlotCard
                    label="Controle"
                    insumoId={setup?.activeControleId ?? null}
                    insumos={allAtivos}
                    onTrocar={
                      canMutate && !isManutencao && onTrocarSlot
                        ? () => onTrocarSlot('controle', equipamento.id)
                        : undefined
                    }
                  />
                  {equipamento.module === 'uroanalise' && (
                    <SlotCard
                      label="Tira"
                      insumoId={setup?.activeTiraUroId ?? null}
                      insumos={allAtivos}
                      onTrocar={
                        canMutate && !isManutencao && onTrocarSlot
                          ? () => onTrocarSlot('tira', equipamento.id)
                          : undefined
                      }
                    />
                  )}
                </div>
              </section>
            )}

            {/* Produtos compatíveis — view-only. Gestão do catálogo (criar/editar/
                excluir) fica na aba global "Catálogo de produtos" pra deixar claro
                que produto é entidade do lab, não do equipamento. */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <SectionTitle
                  title={`Produtos compatíveis · ${produtos.length}`}
                  subtitle="Do catálogo do lab, filtrados pelo módulo deste equipamento"
                />
                {onOpenCatalogo && (
                  <button
                    type="button"
                    onClick={() => onOpenCatalogo(equipamento.module)}
                    className="text-[11px] font-medium text-slate-400 dark:text-white/35 hover:text-slate-700 dark:hover:text-white/70 hover:underline transition-colors"
                  >
                    Gerenciar catálogo →
                  </button>
                )}
              </div>
              {produtos.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/[0.08] text-xs text-slate-500 dark:text-white/40">
                  Nenhum produto cadastrado neste módulo ainda.{' '}
                  {onOpenCatalogo && (
                    <button
                      type="button"
                      onClick={() => onOpenCatalogo(equipamento.module)}
                      className="text-violet-600 dark:text-violet-400 font-medium hover:underline"
                    >
                      Abrir catálogo do lab →
                    </button>
                  )}
                </div>
              ) : (
                <ul className="space-y-1 max-h-52 overflow-y-auto">
                  {produtos.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 dark:text-white/80 truncate">
                          {p.nomeComercial}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-white/40">
                          {p.fabricante}
                          {p.codigoFabricante && ` · ${p.codigoFabricante}`}
                        </p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/60 dark:bg-white/[0.05] text-slate-600 dark:text-white/50 font-medium shrink-0">
                        {p.tipo}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Lotes ativos vinculados ao equipamento */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <SectionTitle
                  title={`Lotes ativos neste equipamento · ${insumosDesseEquipamento.length}`}
                  subtitle="Controles compartilham entre equipamentos; reagentes/tiras são exclusivos"
                />
                {canMutate && !isAposentado && (
                  <button
                    type="button"
                    onClick={() => setShowNovoLote(true)}
                    className="px-3.5 h-9 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold shadow-sm shadow-violet-500/20 transition-all inline-flex items-center gap-1.5"
                    title="Ação diária — cadastrar lote novo recebido"
                  >
                    + Novo lote
                  </button>
                )}
              </div>
              {insumosDesseEquipamento.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/[0.08] text-xs text-slate-500 dark:text-white/40">
                  Nenhum lote ativo. Cadastre um lote de reagente, controle ou tira pra começar.
                </div>
              ) : (
                <ul className="space-y-1 max-h-52 overflow-y-auto">
                  {insumosDesseEquipamento.map((i) => (
                    <LoteRow key={i.id} insumo={i} />
                  ))}
                </ul>
              )}
            </section>

            {equipamento.observacoes && (
              <section>
                <SectionTitle title="Observações" subtitle="" />
                <p className="text-xs text-slate-600 dark:text-white/55 leading-relaxed">
                  {equipamento.observacoes}
                </p>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showEdit && (
        <EquipamentoFormModal
          labId={equipamento.labId}
          equipamento={equipamento}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showEnterManu && (
        <EnterManutencaoModal
          labId={equipamento.labId}
          equipamento={equipamento}
          onClose={() => setShowEnterManu(false)}
        />
      )}
      {showLeaveManu && (
        <LeaveManutencaoModal
          labId={equipamento.labId}
          equipamento={equipamento}
          onClose={() => setShowLeaveManu(false)}
        />
      )}
      {showAposentar && (
        <AposentarEquipamentoModal
          labId={equipamento.labId}
          equipamento={equipamento}
          onClose={() => setShowAposentar(false)}
        />
      )}
      {showNovoLote && (
        <NovoLoteModal
          labId={equipamento.labId}
          equipamentoId={equipamento.id}
          equipamentoModelo={equipamento.modelo}
          onClose={() => setShowNovoLote(false)}
        />
      )}
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-2">
      <p className="text-[11px] uppercase tracking-widest text-slate-400 dark:text-white/30 font-semibold">
        {title}
      </p>
      {subtitle && (
        <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

function SlotCard({
  label,
  insumoId,
  insumos,
  onTrocar,
}: {
  label: string;
  insumoId: string | null;
  insumos: Insumo[];
  onTrocar?: () => void;
}) {
  const insumo = insumoId ? insumos.find((i) => i.id === insumoId) ?? null : null;
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05] p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-500 dark:text-white/40">
          {label}
        </p>
        {onTrocar && (
          <button
            type="button"
            onClick={onTrocar}
            className="text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:underline"
          >
            Trocar →
          </button>
        )}
      </div>
      {insumo ? (
        <>
          <p className="text-sm font-medium text-slate-900 dark:text-white/85 truncate">
            {insumo.nomeComercial}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-white/40 truncate">
            Lote {insumo.lote} · vence {insumo.validadeReal.toDate().toLocaleDateString('pt-BR')}
          </p>
        </>
      ) : (
        <p className="text-xs italic text-slate-400 dark:text-white/25">
          Nenhum lote ativo
        </p>
      )}
    </div>
  );
}

function LoteRow({ insumo }: { insumo: Insumo }) {
  const v = insumo.validadeReal.toDate();
  const status = validadeStatus(v);
  const dias = diasAteVencer(v);
  const state = resolveInsumoState(insumo);
  const validadeBadge =
    status === 'expired'
      ? {
          cls: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
          label: `Venc. ${Math.abs(dias)}d`,
        }
      : status === 'warning'
        ? {
            cls: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
            label: `${dias}d`,
          }
        : {
            cls: 'bg-slate-500/10 border-slate-500/30 text-slate-600 dark:text-white/50',
            label: `${dias}d`,
          };
  const tipoLabel: Record<InsumoTipo, string> = {
    reagente: 'Reag',
    controle: 'Ctrl',
    'tira-uro': 'Tira',
  };
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200/60 dark:bg-white/[0.05] text-slate-600 dark:text-white/50 font-medium">
            {tipoLabel[insumo.tipo]}
          </span>
          <p className="text-xs font-medium text-slate-800 dark:text-white/80 truncate">
            {insumo.nomeComercial}
          </p>
          <span className={`${CHIP} ${state.chipCls}`} title={state.tooltip}>
            {state.label}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-white/40 truncate">
          Lote {insumo.lote}
        </p>
      </div>
      <span className={`${CHIP} ${validadeBadge.cls} shrink-0`}>{validadeBadge.label}</span>
    </li>
  );
}

function ActionsMenu({
  status,
  onEdit,
  onEnterManu,
  onLeaveManu,
  onAposentar,
}: {
  status: Equipamento['status'];
  onEdit: () => void;
  onEnterManu: () => void;
  onLeaveManu: () => void;
  onAposentar: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Ações"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <circle cx="3" cy="7" r="1.2" fill="currentColor" />
          <circle cx="7" cy="7" r="1.2" fill="currentColor" />
          <circle cx="11" cy="7" r="1.2" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-9 z-40 w-56 rounded-xl bg-white dark:bg-[#151d2a] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden">
            <MenuItem
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              label="Editar dados"
            />
            {status === 'ativo' ? (
              <MenuItem
                onClick={() => {
                  setOpen(false);
                  onEnterManu();
                }}
                label="Colocar em manutenção"
              />
            ) : (
              <MenuItem
                onClick={() => {
                  setOpen(false);
                  onLeaveManu();
                }}
                label="Liberar manutenção"
              />
            )}
            <MenuItem
              onClick={() => {
                setOpen(false);
                onAposentar();
              }}
              label="Aposentar…"
              tone="danger"
            />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone?: 'danger';
}) {
  const cls =
    tone === 'danger'
      ? 'text-red-600 dark:text-red-400'
      : 'text-slate-700 dark:text-white/75';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.04] text-xs font-medium transition-all ${cls}`}
    >
      {label}
    </button>
  );
}
