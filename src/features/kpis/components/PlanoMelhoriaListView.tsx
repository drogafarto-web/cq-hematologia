import { useCallback, useEffect, useMemo, useState } from 'react';
import { getLabMembers, type LabMember } from '../../admin/services/labAdminService';
import { toast } from '../../../shared/store/useToastStore';
import {
  firestoreErrorMessage,
  functions,
  httpsCallable,
  Timestamp,
} from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import { usePlanosMelhoria } from '../hooks/usePlanosMelhoria';
import type { UsePlanosMelhoriaFilters } from '../hooks/usePlanosMelhoria';
import { usePlanosMelhoriaPendentesCounts } from '../hooks/usePlanosMelhoriaPendentesCounts';
import type { PlanoMelhoria, PlanoMelhoriaStatus } from '../types/PlanoMelhoria';
import { KPIDashboard } from './KPIDashboard';
import { PlanoMelhoriaCard } from './PlanoMelhoriaCard';
import { PlanoMelhoriaDetail } from './PlanoMelhoriaDetail';

type StatusFilter = 'all' | PlanoMelhoriaStatus;

const STATUS_FILTERS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
] as const;

interface CriarPlanoMelhoriaInput {
  labId: string;
  titulo: string;
  descricao: string;
  responsavelId: string;
  prazoMeta: Timestamp;
  kpiOrigemId?: string;
}

interface CriarPlanoMelhoriaResult {
  planoId: string;
}

const callCriarPlanoMelhoria = httpsCallable<CriarPlanoMelhoriaInput, CriarPlanoMelhoriaResult>(
  functions,
  'criarPlanoMelhoria',
);

interface GenerateKPIReportInput {
  labId: string;
  mesInicio: Timestamp;
  mesFim: Timestamp;
}

interface GenerateKPIReportResult {
  url: string;
}

const callGenerateKPIReport = httpsCallable<GenerateKPIReportInput, GenerateKPIReportResult>(
  functions,
  'generateKPIReport',
);

function currentMonthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthStartTs(monthStr: string): Timestamp {
  const parts = monthStr.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 0 || m > 11) {
    return Timestamp.fromDate(new Date(NaN));
  }
  return Timestamp.fromDate(new Date(y, m, 1, 0, 0, 0, 0));
}

function monthEndTs(monthStr: string): Timestamp {
  const parts = monthStr.split('-');
  const y = Number(parts[0]);
  const mo = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
    return Timestamp.fromDate(new Date(NaN));
  }
  return Timestamp.fromDate(new Date(y, mo, 0, 23, 59, 59, 999));
}

interface NovoPlanoMelhoriaModalProps {
  readonly isOpen: boolean;
  readonly labId: string;
  readonly onClose: () => void;
  readonly onCreated: (planoId: string) => void;
}

function NovoPlanoMelhoriaModal({
  isOpen,
  labId,
  onClose,
  onCreated,
}: NovoPlanoMelhoriaModalProps) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [responsavelId, setResponsavelId] = useState('');
  const [prazoInput, setPrazoInput] = useState('');
  const [members, setMembers] = useState<LabMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    setFormError('');
    void getLabMembers(labId)
      .then((list) => {
        if (!cancelled) {
          setMembers(list.filter((m) => m.active));
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Não foi possível carregar membros do laboratório.');
          setMembers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, labId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setFormError('');
    if (!titulo.trim() || !descricao.trim()) {
      setFormError('Título e descrição são obrigatórios.');
      return;
    }
    if (!responsavelId) {
      setFormError('Selecione o responsável.');
      return;
    }
    if (!prazoInput) {
      setFormError('Informe o prazo meta.');
      return;
    }
    const prazoDate = new Date(`${prazoInput}T12:00:00`);
    if (Number.isNaN(prazoDate.getTime())) {
      setFormError('Data de prazo inválida.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await callCriarPlanoMelhoria({
        labId,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        responsavelId,
        prazoMeta: Timestamp.fromDate(prazoDate),
      });
      const planoId = res.data?.planoId;
      if (!planoId) {
        setFormError('Resposta inválida do servidor.');
        return;
      }
      toast.success('Plano de melhoria criado.');
      setTitulo('');
      setDescricao('');
      setResponsavelId('');
      setPrazoInput('');
      onCreated(planoId);
      onClose();
    } catch (err: unknown) {
      setFormError(firestoreErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="novo-plano-melhoria-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#141417] p-6 shadow-xl"
      >
        <h2
          id="novo-plano-melhoria-title"
          className="text-lg font-semibold tracking-tight text-white"
        >
          Novo plano de melhoria
        </h2>
        <p className="mt-1 text-sm text-white/50">
          O plano nasce em rascunho; ajustes finos entram na próxima entrega.
        </p>

        {formError ? (
          <div className="mt-4 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {formError}
          </div>
        ) : null}

        <form onSubmit={(ev) => void handleSubmit(ev)} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="pm-titulo"
              className="block text-xs font-medium uppercase tracking-wide text-white/50"
            >
              Título
            </label>
            <input
              id="pm-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              maxLength={200}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1a1a1d] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              placeholder="Ex.: Reduzir retrabalho em coagulação"
            />
          </div>
          <div>
            <label
              htmlFor="pm-desc"
              className="block text-xs font-medium uppercase tracking-wide text-white/50"
            >
              Descrição
            </label>
            <textarea
              id="pm-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
              rows={4}
              className="mt-1.5 w-full resize-y rounded-lg border border-white/10 bg-[#1a1a1d] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              placeholder="Contexto, meta e critérios de sucesso."
            />
          </div>
          <div>
            <label
              htmlFor="pm-resp"
              className="block text-xs font-medium uppercase tracking-wide text-white/50"
            >
              Responsável
            </label>
            <select
              id="pm-resp"
              value={responsavelId}
              onChange={(e) => setResponsavelId(e.target.value)}
              required
              disabled={membersLoading}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1a1a1d] px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40 disabled:opacity-50"
            >
              <option value="">{membersLoading ? 'Carregando…' : 'Selecione'}</option>
              {members.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="pm-prazo"
              className="block text-xs font-medium uppercase tracking-wide text-white/50"
            >
              Prazo meta
            </label>
            <input
              id="pm-prazo"
              type="date"
              value={prazoInput}
              onChange={(e) => setPrazoInput(e.target.value)}
              required
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#1a1a1d] px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition-colors hover:bg-violet-500 disabled:opacity-50"
            >
              {submitting ? 'Criando…' : 'Criar plano'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PlanoMelhoriaListView() {
  const labId = useActiveLabId();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlanoId, setSelectedPlanoId] = useState<string | null>(null);
  const [mesInicioMonth, setMesInicioMonth] = useState(currentMonthStr);
  const [mesFimMonth, setMesFimMonth] = useState(currentMonthStr);
  const [reportLoading, setReportLoading] = useState(false);

  const planoFilters = useMemo<UsePlanosMelhoriaFilters | undefined>(
    () => (filter === 'all' ? undefined : { status: filter }),
    [filter],
  );

  const { planos, loading, error } = usePlanosMelhoria(planoFilters);
  const planoIds = useMemo(() => planos.map((p) => p.id), [planos]);
  const pendentesByPlano = usePlanosMelhoriaPendentesCounts(labId, planoIds);

  const handleSelectPlano = useCallback((plano: PlanoMelhoria) => {
    setSelectedPlanoId(plano.id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedPlanoId(null);
  }, []);

  const handleCreated = useCallback((_planoId: string) => {
    // Lista atualiza via onSnapshot; opcionalmente abrir detalhe:
    // setSelectedPlanoId(planoId);
  }, []);

  const handleGenerateKpiReport = useCallback(async (): Promise<void> => {
    if (!labId) return;
    const mesInicio = monthStartTs(mesInicioMonth);
    const mesFim = monthEndTs(mesFimMonth);
    if (Number.isNaN(mesInicio.toMillis()) || Number.isNaN(mesFim.toMillis())) {
      toast.error('Selecione meses válidos.');
      return;
    }
    if (mesInicio.toMillis() > mesFim.toMillis()) {
      toast.error('Mês início deve ser anterior ou igual ao mês fim.');
      return;
    }
    setReportLoading(true);
    try {
      const res = await callGenerateKPIReport({
        labId,
        mesInicio,
        mesFim,
      });
      const url = res.data?.url;
      if (!url || typeof url !== 'string') {
        toast.error('Resposta inválida do servidor.');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success('Relatório gerado. Abrindo em nova aba…');
    } catch (err: unknown) {
      toast.error(firestoreErrorMessage(err));
    } finally {
      setReportLoading(false);
    }
  }, [labId, mesFimMonth, mesInicioMonth]);

  if (!labId) {
    return (
      <p className="text-sm text-white/55">
        Selecione um laboratório para ver os planos de melhoria.
      </p>
    );
  }

  if (selectedPlanoId) {
    return <PlanoMelhoriaDetail planoId={selectedPlanoId} onBack={handleBack} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Planos de melhoria</h1>
          <p className="mt-1 text-sm text-white/50">
            Acompanhamento de planos vinculados a KPIs e ações corretivas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/25 transition-colors hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400/70"
        >
          Novo plano
        </button>
      </div>

      <section
        className="rounded-2xl border border-white/10 bg-[#1a1a1d]/40 p-5"
        aria-labelledby="kpi-dashboard-heading"
      >
        <h2 id="kpi-dashboard-heading" className="text-sm font-semibold tracking-tight text-white">
          Indicadores (KPI)
        </h2>
        <p className="mt-1 text-xs text-white/45">
          Último dia agregado, metas ativas e alertas recentes.
        </p>
        <div className="mt-4">
          <KPIDashboard labId={labId} />
        </div>
      </section>

      <section
        className="rounded-2xl border border-white/10 bg-[#1a1a1d]/40 p-5"
        aria-labelledby="kpi-report-heading"
      >
        <h2 id="kpi-report-heading" className="text-sm font-semibold tracking-tight text-white">
          Relatório KPI (PDF)
        </h2>
        <p className="mt-1 text-xs text-white/45">
          Consolida métricas diárias, metas ativas e planos em rascunho ou ativo.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="kpi-mes-inicio"
              className="block text-xs font-medium uppercase tracking-wide text-white/50"
            >
              Mês início
            </label>
            <input
              id="kpi-mes-inicio"
              type="month"
              value={mesInicioMonth}
              onChange={(e) => setMesInicioMonth(e.target.value)}
              className="mt-1.5 rounded-lg border border-white/10 bg-[#141417] px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>
          <div>
            <label
              htmlFor="kpi-mes-fim"
              className="block text-xs font-medium uppercase tracking-wide text-white/50"
            >
              Mês fim
            </label>
            <input
              id="kpi-mes-fim"
              type="month"
              value={mesFimMonth}
              onChange={(e) => setMesFimMonth(e.target.value)}
              className="mt-1.5 rounded-lg border border-white/10 bg-[#141417] px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleGenerateKpiReport()}
            disabled={reportLoading}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {reportLoading ? 'Gerando…' : 'Gerar relatório KPI'}
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por status">
        {STATUS_FILTERS.map(({ value, label }) => {
          const active = filter === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
                active
                  ? 'bg-violet-600 text-white ring-1 ring-violet-400/50'
                  : 'bg-white/5 text-white/65 ring-1 ring-white/10 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {firestoreErrorMessage(error)}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-xl border border-white/5 bg-[#1a1a1d]/80"
            />
          ))}
        </div>
      ) : planos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#1a1a1d]/50 p-8 text-center">
          <p className="text-sm text-white/55">Nenhum plano neste filtro.</p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-3 text-sm font-medium text-violet-400 hover:text-violet-300"
          >
            Criar o primeiro plano
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {planos.map((plano) => (
            <li key={plano.id}>
              <PlanoMelhoriaCard
                plano={plano}
                pendentesCount={pendentesByPlano[plano.id] ?? 0}
                onSelect={handleSelectPlano}
              />
            </li>
          ))}
        </ul>
      )}

      <NovoPlanoMelhoriaModal
        isOpen={modalOpen}
        labId={labId}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
