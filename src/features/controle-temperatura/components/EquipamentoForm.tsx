import { useState } from 'react';

import { useTermometros } from '../hooks/useTermometros';
import type {
  ConfiguracaoCalendario,
  ConfiguracaoCalendarioDia,
  EquipamentoInput,
  EquipamentoMonitorado,
  LimitesAceitabilidade,
  StatusEquipamento,
  TipoEquipamento,
} from '../types/ControlTemperatura';
import { PlusIcon, XIcon } from './_icons';
import { Button, Field, Modal, Select, TextArea, TextInput } from './_shared';

const CALENDARIO_VAZIO: ConfiguracaoCalendarioDia = { obrigatorio: false, horarios: [] };

const CALENDARIO_PADRAO: ConfiguracaoCalendario = {
  diasUteis: { obrigatorio: true, horarios: ['08:00', '14:00', '18:00'] },
  sabado: { obrigatorio: true, horarios: ['08:00'] },
  domingo: { ...CALENDARIO_VAZIO },
  feriados: { ...CALENDARIO_VAZIO },
};

const TIPOS: { value: TipoEquipamento; label: string }[] = [
  { value: 'geladeira', label: 'Geladeira' },
  { value: 'freezer', label: 'Freezer' },
  { value: 'freezer_ultrabaixo', label: 'Freezer ultrabaixo' },
  { value: 'sala', label: 'Sala / ambiente' },
  { value: 'banho_maria', label: 'Banho-maria' },
  { value: 'estufa', label: 'Estufa' },
  { value: 'incubadora', label: 'Incubadora' },
  { value: 'outro', label: 'Outro' },
];

const STATUS: { value: StatusEquipamento; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'inativo', label: 'Inativo' },
];

const CHAVES_CALENDARIO: { key: keyof ConfiguracaoCalendario; label: string }[] = [
  { key: 'diasUteis', label: 'Dias úteis' },
  { key: 'sabado', label: 'Sábado' },
  { key: 'domingo', label: 'Domingo' },
  { key: 'feriados', label: 'Feriados' },
];

export interface EquipamentoFormProps {
  open: boolean;
  onClose: () => void;
  /** Quando fornecido, o form fica em modo edição. */
  equipamento?: EquipamentoMonitorado;
  onSubmit: (input: EquipamentoInput) => Promise<unknown>;
}

export function EquipamentoForm({ open, onClose, equipamento, onSubmit }: EquipamentoFormProps) {
  const { termometros } = useTermometros({ somenteAtivos: true });
  const [nome, setNome] = useState(equipamento?.nome ?? '');
  const [tipo, setTipo] = useState<TipoEquipamento>(equipamento?.tipo ?? 'geladeira');
  const [localizacao, setLocalizacao] = useState(equipamento?.localizacao ?? '');
  const [termometroId, setTermometroId] = useState(equipamento?.termometroId ?? '');
  const [status, setStatus] = useState<StatusEquipamento>(equipamento?.status ?? 'ativo');
  const [observacoes, setObservacoes] = useState(equipamento?.observacoes ?? '');
  const [dispositivoIoTId, setDispositivoIoTId] = useState(equipamento?.dispositivoIoTId ?? '');

  const [limites, setLimites] = useState<LimitesAceitabilidade>(
    equipamento?.limites ?? { temperaturaMin: 2, temperaturaMax: 8 },
  );
  const [calendario, setCalendario] = useState<ConfiguracaoCalendario>(
    equipamento?.calendario ?? CALENDARIO_PADRAO,
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function updateCalendarioDia(
    key: keyof ConfiguracaoCalendario,
    patch: Partial<ConfiguracaoCalendarioDia>,
  ) {
    setCalendario((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  function addHorario(key: keyof ConfiguracaoCalendario) {
    setCalendario((prev) => ({
      ...prev,
      [key]: { ...prev[key], horarios: [...prev[key].horarios, '08:00'] },
    }));
  }
  function removeHorario(key: keyof ConfiguracaoCalendario, idx: number) {
    setCalendario((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        horarios: prev[key].horarios.filter((_, i) => i !== idx),
      },
    }));
  }
  function changeHorario(key: keyof ConfiguracaoCalendario, idx: number, v: string) {
    setCalendario((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        horarios: prev[key].horarios.map((h, i) => (i === idx ? v : h)),
      },
    }));
  }

  async function handleSubmit() {
    setErro(null);
    if (nome.trim().length === 0) return setErro('Nome obrigatório.');
    if (!termometroId) return setErro('Selecione o termômetro vinculado.');
    if (limites.temperaturaMin >= limites.temperaturaMax) {
      return setErro('T. mínima deve ser menor que T. máxima.');
    }
    const input: EquipamentoInput = {
      nome: nome.trim(),
      tipo,
      localizacao: localizacao.trim(),
      termometroId,
      limites,
      calendario,
      status,
      dispositivoIoTId: dispositivoIoTId.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
    };
    try {
      setSalvando(true);
      await onSubmit(input);
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={equipamento ? 'Editar equipamento' : 'Novo equipamento'}
      subtitle="Configuração de limites + calendário de leituras"
      maxWidthClass="max-w-2xl"
      footer={
        <>
          <Button tone="secondary" className="flex-1" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <TextInput
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Geladeira Reagentes — Bioquímica"
            />
          </Field>
          <Field label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoEquipamento)}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Localização">
            <TextInput
              value={localizacao}
              onChange={(e) => setLocalizacao(e.target.value)}
              placeholder="Ex: Setor Bioquímica"
            />
          </Field>
          <Field
            label="Termômetro vinculado"
            hint={termometros.length === 0 ? 'Cadastre um termômetro em Configurações primeiro.' : undefined}
          >
            <Select
              value={termometroId}
              onChange={(e) => setTermometroId(e.target.value)}
              disabled={termometros.length === 0}
            >
              <option value="">— selecione —</option>
              {termometros.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.numeroSerie} — {t.modelo}
                  {t.statusCalibracao === 'vencido' ? ' (CAL VENCIDA)' : ''}
                  {t.statusCalibracao === 'vencendo' ? ' (cal. vencendo)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusEquipamento)}
            >
              {STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dispositivo IoT vinculado" hint="Opcional — cadastre em Configurações">
            <TextInput
              value={dispositivoIoTId}
              onChange={(e) => setDispositivoIoTId(e.target.value)}
              placeholder="ID do dispositivo"
            />
          </Field>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-3 text-sm font-bold text-slate-700">Limites de aceitabilidade</h4>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="T. mínima (°C)">
              <TextInput
                type="number"
                step="0.1"
                value={limites.temperaturaMin}
                onChange={(e) =>
                  setLimites((l) => ({ ...l, temperaturaMin: Number(e.target.value) }))
                }
              />
            </Field>
            <Field label="T. máxima (°C)">
              <TextInput
                type="number"
                step="0.1"
                value={limites.temperaturaMax}
                onChange={(e) =>
                  setLimites((l) => ({ ...l, temperaturaMax: Number(e.target.value) }))
                }
              />
            </Field>
            <Field label="Umidade mín (%)" hint="opcional">
              <TextInput
                type="number"
                step="1"
                value={limites.umidadeMin ?? ''}
                onChange={(e) =>
                  setLimites((l) => ({
                    ...l,
                    umidadeMin: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
              />
            </Field>
            <Field label="Umidade máx (%)" hint="opcional">
              <TextInput
                type="number"
                step="1"
                value={limites.umidadeMax ?? ''}
                onChange={(e) =>
                  setLimites((l) => ({
                    ...l,
                    umidadeMax: e.target.value === '' ? undefined : Number(e.target.value),
                  }))
                }
              />
            </Field>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="mb-3 text-sm font-bold text-slate-700">Calendário de leituras</h4>
          <div className="space-y-3">
            {CHAVES_CALENDARIO.map(({ key, label }) => {
              const dia = calendario[key];
              return (
                <div key={key} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-slate-700">{label}</span>
                      <label className="ml-3 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          className="mr-1"
                          checked={dia.obrigatorio}
                          onChange={(e) =>
                            updateCalendarioDia(key, { obrigatorio: e.target.checked })
                          }
                        />
                        Obrigatório
                      </label>
                    </div>
                    <Button tone="ghost" onClick={() => addHorario(key)}>
                      <PlusIcon size={14} /> <span className="ml-1">Horário</span>
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {dia.horarios.map((h, idx) => (
                      <div key={`${key}-${idx}`} className="flex items-center gap-1">
                        <input
                          type="time"
                          value={h}
                          onChange={(e) => changeHorario(key, idx, e.target.value)}
                          className="rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeHorario(key, idx)}
                          className="text-slate-400 hover:text-rose-600"
                          aria-label="Remover horário"
                        >
                          <XIcon size={14} />
                        </button>
                      </div>
                    ))}
                    {dia.horarios.length === 0 ? (
                      <span className="text-xs text-slate-400">Sem horários configurados</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <Field label="Observações">
          <TextArea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </Field>

        {erro ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {erro}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
