import { useMemo, useState } from 'react';

import { Timestamp } from '../../../shared/services/firebase';
import { useSaveLeitura } from '../hooks/useSaveLeitura';
import { avaliarForaDosLimites } from '../services/ctFirebaseService';
import type {
  EquipamentoMonitorado,
  LeituraPrevista,
  TurnoLeitura,
} from '../types/ControlTemperatura';
import { AlertTriangleIcon } from './_icons';
import { Button, Field, Modal, TextArea, TextInput } from './_shared';

export interface LeituraRapidaFormProps {
  open: boolean;
  onClose: () => void;
  equipamento: EquipamentoMonitorado;
  /** Quando fornecida, a previsão é marcada como realizada no mesmo batch. */
  leituraPrevista?: LeituraPrevista;
  onSaved?: (leituraId: string, ncId: string | null) => void;
}

function turnoFromHour(hour: number): TurnoLeitura {
  if (hour < 12) return 'manha';
  if (hour < 18) return 'tarde';
  return 'noite';
}

function parseNumber(v: string): number | null {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Formulário mobile-first de registro manual de leitura.
 *
 * UX do mock:
 *   - Input de temperatura grande e central, com estado de cor calculado
 *     ao digitar (verde dentro dos limites, vermelho fora).
 *   - Strip horizontal com min/max do equipamento sempre visível.
 *   - Aviso explícito antes do submit quando vai abrir NC automática.
 *   - Campos opcionais (termômetro max/min, umidade, observação) colapsados
 *     visualmente — focus inicial vai pro campo principal.
 */
export function LeituraRapidaForm({
  open,
  onClose,
  equipamento,
  leituraPrevista,
  onSaved,
}: LeituraRapidaFormProps) {
  const { save, isSaving } = useSaveLeitura();

  const [temperatura, setTemperatura] = useState('');
  const [umidade, setUmidade] = useState('');
  const [tMax, setTMax] = useState('');
  const [tMin, setTMin] = useState('');
  const [observacao, setObservacao] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [marcarJustificada, setMarcarJustificada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const tempNumber = parseNumber(temperatura);
  const umidadeNumber = umidade.trim() === '' ? undefined : parseNumber(umidade) ?? undefined;
  const avaliacao = useMemo(() => {
    if (tempNumber === null) return { fora: false, violado: null as null | string };
    return avaliarForaDosLimites(tempNumber, umidadeNumber, equipamento.limites);
  }, [tempNumber, umidadeNumber, equipamento.limites]);

  const limitesUmidade =
    equipamento.limites.umidadeMin !== undefined || equipamento.limites.umidadeMax !== undefined;

  async function handleSubmit() {
    if (tempNumber === null) {
      setErro('Informe a temperatura atual.');
      return;
    }
    const tMaxNumber = parseNumber(tMax) ?? tempNumber;
    const tMinNumber = parseNumber(tMin) ?? tempNumber;
    const agora = Timestamp.now();
    const turno = leituraPrevista?.turno ?? turnoFromHour(agora.toDate().getHours());
    try {
      const { leituraId, ncId } = await save(
        {
          equipamentoId: equipamento.id,
          dataHora: leituraPrevista?.dataHoraPrevista ?? agora,
          turno,
          temperaturaAtual: tempNumber,
          umidade: umidadeNumber,
          temperaturaMax: tMaxNumber,
          temperaturaMin: tMinNumber,
          origem: 'manual',
          status: marcarJustificada ? 'justificada' : 'realizada',
          justificativaPerdida: marcarJustificada ? justificativa.trim() : undefined,
          observacao: observacao.trim() || undefined,
        },
        equipamento,
        {
          leituraPrevistaId: leituraPrevista?.id,
          observacaoNC: observacao.trim() || undefined,
        },
      );
      onSaved?.(leituraId, ncId);
      // reset
      setTemperatura('');
      setUmidade('');
      setTMax('');
      setTMin('');
      setObservacao('');
      setJustificativa('');
      setMarcarJustificada(false);
      setErro(null);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  const inputBorderCls =
    temperatura.trim() === ''
      ? 'border-slate-200 focus:border-indigo-500'
      : avaliacao.fora
        ? 'border-rose-500 text-rose-600 bg-rose-50'
        : 'border-emerald-500 text-emerald-700 bg-emerald-50';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar Leitura"
      subtitle={equipamento.nome}
      maxWidthClass="max-w-md"
      footer={
        <>
          <Button tone="secondary" className="flex-1" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            tone={avaliacao.fora ? 'danger' : 'primary'}
            className="flex-1"
            onClick={handleSubmit}
            disabled={isSaving || temperatura.trim() === ''}
          >
            {isSaving ? 'Salvando...' : avaliacao.fora ? 'Salvar e abrir NC' : 'Salvar assinatura'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-xl bg-slate-100 p-4 text-sm">
          <div className="text-center">
            <span className="block text-slate-500">Mínimo</span>
            <span className="font-bold text-slate-800">
              {equipamento.limites.temperaturaMin.toFixed(1)}°C
            </span>
          </div>
          <div className="h-10 w-px bg-slate-300" />
          <div className="text-center">
            <span className="block text-slate-500">Máximo</span>
            <span className="font-bold text-slate-800">
              {equipamento.limites.temperaturaMax.toFixed(1)}°C
            </span>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Temperatura Atual (°C)
          </label>
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={temperatura}
            onChange={(e) => setTemperatura(e.target.value)}
            className={`w-full rounded-xl border-2 p-4 text-center text-4xl font-bold outline-none transition-colors ${inputBorderCls}`}
            placeholder="0,0"
          />
          {avaliacao.fora ? (
            <p className="mt-2 flex items-center gap-1 text-sm font-medium text-rose-600">
              <AlertTriangleIcon size={16} /> Valor fora dos limites. Uma NC será aberta
              automaticamente.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="T. Máxima" hint="do termômetro">
            <TextInput
              inputMode="decimal"
              value={tMax}
              onChange={(e) => setTMax(e.target.value)}
              placeholder="opcional"
            />
          </Field>
          <Field label="T. Mínima" hint="do termômetro">
            <TextInput
              inputMode="decimal"
              value={tMin}
              onChange={(e) => setTMin(e.target.value)}
              placeholder="opcional"
            />
          </Field>
        </div>

        {limitesUmidade ? (
          <Field
            label="Umidade (%)"
            hint={`${equipamento.limites.umidadeMin ?? '—'}% a ${equipamento.limites.umidadeMax ?? '—'}%`}
          >
            <TextInput
              inputMode="decimal"
              value={umidade}
              onChange={(e) => setUmidade(e.target.value)}
              placeholder="opcional"
            />
          </Field>
        ) : null}

        <Field label="Observação">
          <TextArea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Opcional — contexto da leitura"
          />
        </Field>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={marcarJustificada}
            onChange={(e) => setMarcarJustificada(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            <span className="font-semibold">Registrar como justificada</span>
            <span className="block text-xs text-slate-500">
              Ex: equipamento em limpeza, sala em manutenção. Exige justificativa.
            </span>
          </span>
        </label>

        {marcarJustificada ? (
          <Field label="Justificativa">
            <TextArea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Obrigatória quando marcada como justificada"
            />
          </Field>
        ) : null}

        {erro ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {erro}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
