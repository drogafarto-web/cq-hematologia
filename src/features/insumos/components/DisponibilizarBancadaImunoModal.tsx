/**
 * DisponibilizarBancadaImunoModal — fluxo "cadastrei um lote imuno, quero rodar
 * a corrida de validação".
 *
 * O cadastro em si só cria o doc físico em `/insumos`. Para o lote aparecer na
 * Bancada de Imunoensaios precisa de um envelope `CIQImunoLot` vinculado com
 * `setupType='validacao_paralela'`. Este modal preenche essa lacuna em 1 clique:
 *
 *   1. Operador escolhe o Tipo de Teste alvo (ex: "Dengue NS1", "PCR látex").
 *   2. findOrCreate envelope `(testType, loteControle = insumo.lote)`.
 *   3. Vincula como `validacao_paralela` (não pode ir como `principal` porque o
 *      lote ainda não foi formalmente qualificado pelo RT — PR1).
 *
 * Pós-PR1 (2026-04-26): a corrida registrada com este envelope vira
 * `classificacaoImuno='validacao'` e pode ser usada como evidência analítica
 * no `InsumoQualificacaoModal` (RDC 978/2025 Art.128).
 */

import React, { useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useUser } from '../../../store/useAuthStore';
import { useCIQTestTypes } from '../../ciq-imuno/hooks/useCIQTestTypes';
import {
  findCIQLot,
  createCIQLot,
  vincularCIQLot,
} from '../../ciq-imuno/services/ciqFirebaseService';
import type { Insumo } from '../types/Insumo';

// ─── UI tokens ───────────────────────────────────────────────────────────────

const SELECT = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 text-sm
  focus:outline-none focus:border-violet-500/50
  disabled:opacity-40 transition-all
`.trim();

const PRIMARY = `
  px-4 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600
  text-white text-sm font-semibold transition-all
  disabled:opacity-50 disabled:cursor-not-allowed
`.trim();

const GHOST = `
  px-4 h-10 rounded-xl text-sm font-medium
  text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/[0.05]
  transition-all
`.trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toYMD(ts: { toDate: () => Date } | null | undefined, fallbackToday: boolean): string {
  if (!ts) {
    if (!fallbackToday) return '';
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }
  return ts.toDate().toISOString().slice(0, 10);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  insumo: Insumo;
  onClose: () => void;
  /** Chamado após vinculação bem-sucedida com o id do CIQImunoLot envelope. */
  onDone: (envelopeId: string) => void;
}

export function DisponibilizarBancadaImunoModal({ insumo, onClose, onDone }: Props) {
  const user = useUser();
  const { types, loading: typesLoading } = useCIQTestTypes();

  const [testType, setTestType] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manuais primeiro (kits imunoensaio rápido), depois automatizados.
  const orderedTypes = useMemo(() => {
    const sorted = [...types];
    sorted.sort((a, b) => {
      if (a.manual === b.manual) return a.name.localeCompare(b.name);
      return a.manual ? -1 : 1;
    });
    return sorted;
  }, [types]);

  async function handleConfirm() {
    if (!user || !testType) return;
    setSubmitting(true);
    setError(null);
    try {
      // 1. Encontra envelope existente (testType, loteControle = insumo.lote)
      let envelopeId = (await findCIQLot(insumo.labId, testType, insumo.lote))?.id ?? null;

      // 2. Cria se não existir. validadeControle/aberturaControle são strings
      // YYYY-MM-DD — extraídas do Insumo. Sem dataAbertura usa hoje (lacrado
      // ainda, será atualizado se/quando for aberto via openInsumo).
      if (!envelopeId) {
        envelopeId = await createCIQLot(insumo.labId, {
          labId: insumo.labId,
          testType,
          loteControle: insumo.lote,
          aberturaControle: toYMD(insumo.dataAbertura, true),
          validadeControle: toYMD(insumo.validade, false) || toYMD(insumo.validadeReal, true),
          runCount: 0,
          lotStatus: 'sem_dados',
          createdBy: user.uid,
        });
      }

      // 3. Vincula como validacao_paralela. principal exigiria ciqDecision='A'
      // (lote já aprovado pelo RT) — pré-qualificação ainda não tem.
      await vincularCIQLot(insumo.labId, envelopeId, 'validacao_paralela', user.uid);

      onDone(envelopeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao disponibilizar lote.');
    } finally {
      setSubmitting(false);
    }
  }

  // Heads-up sobre o estado pós-vinculação
  const helpText =
    'O lote vai aparecer na Bancada de Imunoensaios como "Em validação". ' +
    'As corridas registradas serão classificadas como evidência analítica e ' +
    'poderão ser usadas para qualificar o lote (RDC 978/2025 Art.128).';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white/90">
            Disponibilizar lote para corrida de validação
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-white/45 mt-0.5">
            {insumo.nomeComercial} · Lote {insumo.lote}
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-white/55 mb-1.5">
              Tipo de teste
            </label>
            {typesLoading ? (
              <div className="text-sm text-slate-500 dark:text-white/40">Carregando…</div>
            ) : orderedTypes.length === 0 ? (
              <div className="rounded-lg p-3 bg-amber-500/10 border border-amber-500/30 text-[12px] text-amber-700 dark:text-amber-300">
                Nenhum Tipo de Teste cadastrado. Cadastre antes em CIQ-Imuno → Tipos de Teste.
              </div>
            ) : (
              <select
                className={SELECT}
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                disabled={submitting}
              >
                <option value="">— selecione —</option>
                {orderedTypes.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                    {t.manual ? ' · manual' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-white/40 leading-relaxed">
            {helpText}
          </p>

          {error && (
            <div className="rounded-lg p-3 bg-red-500/10 border border-red-500/30 text-[12px] text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 dark:border-white/[0.06]">
          <button type="button" className={GHOST} onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            type="button"
            className={PRIMARY}
            onClick={handleConfirm}
            disabled={submitting || !testType || orderedTypes.length === 0}
          >
            {submitting ? 'Vinculando…' : 'Disponibilizar como Em Validação'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Reservado pra uso futuro — silencia warning do TypeScript noUnusedLocals
void Timestamp;
