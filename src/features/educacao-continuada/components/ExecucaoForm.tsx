import { useMemo, useState, type FormEvent } from 'react';

import { Timestamp, functions, httpsCallable } from '../../../shared/services/firebase';
import { useExecucoes } from '../hooks/useExecucoes';
import {
  useSaveExecucao,
  type PresencaInput,
} from '../hooks/useSaveExecucao';
import { useTreinamentos } from '../hooks/useTreinamentos';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';

// ─── ec_mintSignature wire (Fase 0b — assinatura server-side) ────────────────
interface MintWire {
  labId: string;
  payloads: Array<Record<string, string | number>>;
}
interface MintResp {
  signatures: Array<{ hash: string; operatorId: string; tsMillis: number }>;
}
const callMintSignature = httpsCallable<MintWire, MintResp>(functions, 'ec_mintSignature');
import type {
  Execucao,
  ExecucaoStatus,
  Treinamento,
} from '../types/EducacaoContinuada';

import { Field, inputClass, selectClass } from './_formPrimitives';
import { ParticipantesModal } from './ParticipantesModal';

/** Antecedência padrão do alerta de vencimento — configurável por tenant na FASE 5. */
const DIAS_ANTECEDENCIA_PADRAO = 30;

export interface ExecucaoFormProps {
  /** Modo edição quando presente. */
  execucao?: Execucao;
  onSaved: () => void;
  onCancel: () => void;
}

interface FormState {
  treinamentoId: string;
  dataPlanejada: string;
  dataAplicacao: string;
  ministrante: string;
  pauta: string;
  status: ExecucaoStatus;
  /** Usado apenas quando transição para 'adiado'. */
  novaDataPlanejada: string;
  /** Usado apenas quando transição para 'adiado'. */
  motivoAdiamento: string;
}

interface FormErrors {
  treinamentoId?: string;
  dataPlanejada?: string;
  dataAplicacao?: string;
  ministrante?: string;
  pauta?: string;
  novaDataPlanejada?: string;
  motivoAdiamento?: string;
  participantes?: string;
  submit?: string;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: ExecucaoStatus; label: string }> = [
  { value: 'planejado', label: 'Planejada' },
  { value: 'realizado', label: 'Realizada' },
  { value: 'adiado', label: 'Adiada' },
  { value: 'cancelado', label: 'Cancelada' },
];

function tsToDateInput(ts: Timestamp | null): string {
  if (!ts) return '';
  const d = ts.toDate();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateInputToTs(s: string): Timestamp | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return Timestamp.fromDate(new Date(y, m - 1, d, 0, 0, 0));
}

function buildInitialState(execucao?: Execucao): FormState {
  if (!execucao) {
    return {
      treinamentoId: '',
      dataPlanejada: '',
      dataAplicacao: '',
      ministrante: '',
      pauta: '',
      status: 'planejado',
      novaDataPlanejada: '',
      motivoAdiamento: '',
    };
  }
  return {
    treinamentoId: execucao.treinamentoId,
    dataPlanejada: tsToDateInput(execucao.dataPlanejada),
    dataAplicacao: tsToDateInput(execucao.dataAplicacao),
    ministrante: execucao.ministrante,
    pauta: execucao.pauta,
    status: execucao.status,
    novaDataPlanejada: '',
    motivoAdiamento: '',
  };
}

export function ExecucaoForm({ execucao, onSaved, onCancel }: ExecucaoFormProps) {
  const user = useUser();
  const labId = useActiveLabId();
  const { treinamentos } = useTreinamentos({ somenteAtivos: true });
  const { create, update } = useExecucoes();
  const { realizar, adiar, isSaving } = useSaveExecucao();
  const isEditing = Boolean(execucao);

  const [state, setState] = useState<FormState>(() => buildInitialState(execucao));
  const [errors, setErrors] = useState<FormErrors>({});
  const [presencas, setPresencas] = useState<PresencaInput[]>([]);
  const [participantesOpen, setParticipantesOpen] = useState<boolean>(false);

  const treinamentoSelecionado = useMemo<Treinamento | null>(
    () => treinamentos.find((t) => t.id === state.treinamentoId) ?? null,
    [treinamentos, state.treinamentoId],
  );

  const totalPresentes = useMemo(
    () => presencas.filter((p) => p.presente).length,
    [presencas],
  );

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setState((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  // Validadores por modo de salvamento — cada transição tem contrato próprio.
  const validateCamposBase = (errs: FormErrors): void => {
    if (!state.treinamentoId) errs.treinamentoId = 'Selecione um treinamento.';
    if (!state.dataPlanejada) errs.dataPlanejada = 'Informe a data planejada.';
  };

  const validateRealizado = (errs: FormErrors): void => {
    if (!state.dataAplicacao) errs.dataAplicacao = 'Data da aplicação é obrigatória.';
    if (state.ministrante.trim().length === 0) errs.ministrante = 'Ministrante é obrigatório.';
    if (state.pauta.trim().length === 0) errs.pauta = 'Pauta é obrigatória.';
    if (totalPresentes === 0) errs.participantes = 'RN-03: registre ao menos 1 participante presente.';
  };

  const validateAdiado = (errs: FormErrors): void => {
    if (!state.novaDataPlanejada) errs.novaDataPlanejada = 'Informe a nova data planejada.';
    if (state.motivoAdiamento.trim().length === 0) errs.motivoAdiamento = 'Informe o motivo do adiamento.';
    const original = dateInputToTs(state.dataPlanejada);
    const nova = dateInputToTs(state.novaDataPlanejada);
    if (original && nova && nova.toMillis() <= original.toMillis()) {
      errs.novaDataPlanejada = 'Nova data precisa ser posterior à original.';
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!user) {
      setErrors({ submit: 'Usuário não autenticado.' });
      return;
    }

    const errs: FormErrors = {};
    validateCamposBase(errs);
    if (state.status === 'realizado') validateRealizado(errs);
    if (state.status === 'adiado' && isEditing) validateAdiado(errs);

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const dataPlanejada = dateInputToTs(state.dataPlanejada);
    if (!dataPlanejada || !treinamentoSelecionado) {
      setErrors({ submit: 'Dados incompletos.' });
      return;
    }

    try {
      // Transição complexa: realizar
      if (state.status === 'realizado') {
        const dataAplicacao = dateInputToTs(state.dataAplicacao);
        if (!dataAplicacao) throw new Error('Data da aplicação inválida.');
        await realizar({
          execucaoId: execucao?.id ?? null,
          treinamento: treinamentoSelecionado,
          dataPlanejada,
          dataAplicacao,
          ministrante: state.ministrante,
          pauta: state.pauta,
          presencas,
          diasAntecedenciaAlerta: DIAS_ANTECEDENCIA_PADRAO,
        });
        onSaved();
        return;
      }

      // Transição complexa: adiar (só faz sentido em edição)
      if (state.status === 'adiado' && execucao) {
        const novaData = dateInputToTs(state.novaDataPlanejada);
        if (!novaData) throw new Error('Nova data inválida.');
        await adiar({
          execucaoOriginal: execucao,
          novaDataPlanejada: novaData,
          motivo: state.motivoAdiamento,
        });
        onSaved();
        return;
      }

      // Transições simples (planejado, cancelado) — assinatura server-side + CRUD
      if (!labId) throw new Error('Sem lab ativo.');
      const dataAplicacao = dateInputToTs(state.dataAplicacao);
      const mintResp = await callMintSignature({
        labId,
        payloads: [
          {
            treinamentoId: state.treinamentoId,
            dataPlanejada: dataPlanejada.toMillis(),
            status: state.status,
          },
        ],
      });
      const sig = mintResp.data.signatures[0];
      const assinatura = {
        hash: sig.hash,
        operatorId: sig.operatorId,
        ts: Timestamp.fromMillis(sig.tsMillis),
      };

      if (execucao) {
        await update(execucao.id, {
          treinamentoId: state.treinamentoId,
          dataPlanejada,
          dataAplicacao,
          ministrante: state.ministrante.trim(),
          pauta: state.pauta.trim(),
          status: state.status,
          assinatura,
        });
      } else {
        await create({
          treinamentoId: state.treinamentoId,
          dataPlanejada,
          dataAplicacao,
          ministrante: state.ministrante.trim(),
          pauta: state.pauta.trim(),
          status: state.status,
          assinatura,
        });
      }
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar.';
      setErrors({ submit: message });
    }
  };

  const showAdiamentoBloco = state.status === 'adiado' && isEditing;
  const showRealizacaoBloco = state.status === 'realizado';

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-100">
            {isEditing ? 'Editar execução' : 'Nova execução'}
          </h2>
          <p className="text-sm text-slate-400">
            Registro FR-001 — RDC 978/2025. Assinatura lógica gerada ao salvar.
          </p>
        </header>

        <Field
          id="execucao-treinamento"
          label="Treinamento"
          required
          error={errors.treinamentoId}
        >
          <select
            id="execucao-treinamento"
            value={state.treinamentoId}
            onChange={(e) => handleChange('treinamentoId', e.target.value)}
            disabled={isSaving || isEditing}
            aria-label="Treinamento vinculado"
            className={selectClass()}
          >
            <option value="">Selecione…</option>
            {treinamentos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.titulo}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field id="execucao-data-planejada" label="Data planejada" required error={errors.dataPlanejada}>
            <input
              id="execucao-data-planejada"
              type="date"
              value={state.dataPlanejada}
              onChange={(e) => handleChange('dataPlanejada', e.target.value)}
              disabled={isSaving}
              aria-label="Data planejada da execução"
              className={inputClass(Boolean(errors.dataPlanejada))}
            />
          </Field>

          <Field id="execucao-status" label="Status">
            <select
              id="execucao-status"
              value={state.status}
              onChange={(e) => handleChange('status', e.target.value as ExecucaoStatus)}
              disabled={isSaving}
              aria-label="Status da execução"
              className={selectClass()}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.value === 'adiado' && !isEditing}
                >
                  {opt.label}
                  {opt.value === 'adiado' && !isEditing ? ' (só em edição)' : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {showRealizacaoBloco && (
          <section className="flex flex-col gap-4 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Registro da realização
            </h3>

            <Field id="execucao-data-aplicacao" label="Data da aplicação" required error={errors.dataAplicacao}>
              <input
                id="execucao-data-aplicacao"
                type="date"
                value={state.dataAplicacao}
                onChange={(e) => handleChange('dataAplicacao', e.target.value)}
                disabled={isSaving}
                aria-label="Data efetiva da aplicação"
                className={inputClass(Boolean(errors.dataAplicacao))}
              />
            </Field>

            <Field id="execucao-ministrante" label="Ministrante" required error={errors.ministrante}>
              <input
                id="execucao-ministrante"
                type="text"
                value={state.ministrante}
                onChange={(e) => handleChange('ministrante', e.target.value)}
                disabled={isSaving}
                autoComplete="off"
                aria-label="Ministrante do treinamento"
                className={inputClass(Boolean(errors.ministrante))}
              />
            </Field>

            <Field id="execucao-pauta" label="Pauta" required error={errors.pauta}>
              <textarea
                id="execucao-pauta"
                value={state.pauta}
                onChange={(e) => handleChange('pauta', e.target.value)}
                disabled={isSaving}
                rows={3}
                aria-label="Pauta da sessão"
                className={inputClass(Boolean(errors.pauta))}
              />
            </Field>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setParticipantesOpen(true)}
                disabled={isSaving}
                className="self-start rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20"
              >
                {totalPresentes > 0
                  ? `Presenças: ${totalPresentes} marcada(s) — revisar`
                  : 'Registrar presença'}
              </button>
              {errors.participantes && (
                <p className="text-xs text-red-400">{errors.participantes}</p>
              )}
            </div>
          </section>
        )}

        {showAdiamentoBloco && (
          <section className="flex flex-col gap-4 rounded-md border border-amber-500/20 bg-amber-500/5 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Reagendamento — RN-01
            </h3>
            <p className="text-xs text-amber-200/70">
              Marcará esta execução como adiada e criará uma nova execução
              planejada automaticamente, mantendo o histórico.
            </p>

            <Field id="execucao-nova-data" label="Nova data planejada" required error={errors.novaDataPlanejada}>
              <input
                id="execucao-nova-data"
                type="date"
                value={state.novaDataPlanejada}
                onChange={(e) => handleChange('novaDataPlanejada', e.target.value)}
                disabled={isSaving}
                aria-label="Nova data planejada"
                className={inputClass(Boolean(errors.novaDataPlanejada))}
              />
            </Field>

            <Field id="execucao-motivo" label="Motivo do adiamento" required error={errors.motivoAdiamento}>
              <textarea
                id="execucao-motivo"
                value={state.motivoAdiamento}
                onChange={(e) => handleChange('motivoAdiamento', e.target.value)}
                disabled={isSaving}
                rows={2}
                aria-label="Motivo do adiamento"
                className={inputClass(Boolean(errors.motivoAdiamento))}
              />
            </Field>
          </section>
        )}

        {errors.submit && (
          <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {errors.submit}
          </p>
        )}

        <footer className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {isSaving ? 'Salvando…' : submitLabel(state.status, isEditing)}
          </button>
        </footer>
      </form>

      {participantesOpen && (
        <ParticipantesModal
          initial={presencas}
          onConfirm={(list) => {
            setPresencas(list);
            setParticipantesOpen(false);
            if (errors.participantes) setErrors((prev) => ({ ...prev, participantes: undefined }));
          }}
          onCancel={() => setParticipantesOpen(false)}
        />
      )}
    </>
  );
}

function submitLabel(status: ExecucaoStatus, isEditing: boolean): string {
  if (status === 'realizado') return 'Registrar realização';
  if (status === 'adiado') return 'Adiar execução';
  if (status === 'cancelado') return 'Cancelar execução';
  return isEditing ? 'Salvar alterações' : 'Criar execução';
}

