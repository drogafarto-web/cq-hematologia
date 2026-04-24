import { lazy, Suspense, useMemo, useState } from 'react';

import { Timestamp } from '../../shared/services/firebase';
import { useAppStore } from '../../store/useAppStore';
import { useActiveLab, useActiveLabId, useUser } from '../../store/useAuthStore';
import { CTDashboard } from './components/CTDashboard';
import { CTImportXlsx } from './components/CTImportXlsx';
import { CTIndicadores } from './components/CTIndicadores';
import { DispositivosIoTList } from './components/DispositivoIoTForm';
import { EquipamentoForm } from './components/EquipamentoForm';
import { GraficoTemperatura } from './components/GraficoTemperatura';
import { LeituraListaPendentes } from './components/LeituraListaPendentes';
import { NCList } from './components/NCList';
import { TermometrosList } from './components/TermometroForm';
import {
  ActivityIcon,
  AlertTriangleIcon,
  CalendarIcon,
  ClockIcon,
  FileTextIcon,
  ServerIcon,
  SettingsIcon,
  SunIcon,
} from './components/_icons';
import {
  Button,
  SectionHeader,
  Select,
  StatusBadge,
  borderForStatusCard,
  toneForStatusCard,
} from './components/_shared';
import { useCTIndicadores } from './hooks/useCTIndicadores';
import { useDispositivosIoT } from './hooks/useDispositivosIoT';
import { useEquipamentos } from './hooks/useEquipamentos';
import { useLeituras } from './hooks/useLeituras';
import { useLeiturasPrevistas } from './hooks/useLeiturasPrevistas';
import { useNCs } from './hooks/useNCs';
import { useTermometros } from './hooks/useTermometros';
import {
  montarRelatorioFR11,
  type RelatorioFR11,
} from './services/ctExportService';
import type {
  EquipamentoInput,
  EquipamentoMonitorado,
} from './types/ControlTemperatura';

// Relatório PDF é pesado (react-to-print + layout A4) — lazy evita custo na
// primeira renderização do módulo.
const CTRelatorioPrint = lazy(() =>
  import('./components/CTRelatorioPrint').then((m) => ({ default: m.CTRelatorioPrint })),
);

type TabId = 'dashboard' | 'leituras' | 'equipamentos' | 'ncs' | 'relatorios' | 'configuracoes';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <ActivityIcon size={18} /> },
  { id: 'leituras', label: 'Leituras', icon: <ClockIcon size={18} /> },
  { id: 'equipamentos', label: 'Equipamentos', icon: <ServerIcon size={18} /> },
  { id: 'ncs', label: 'Não conformidades', icon: <AlertTriangleIcon size={18} /> },
  { id: 'relatorios', label: 'Relatórios (FR-11)', icon: <FileTextIcon size={18} /> },
  { id: 'configuracoes', label: 'Configurações', icon: <SettingsIcon size={18} /> },
];

/**
 * Entry point do módulo Controle de Temperatura.
 *
 * Layout fiel ao mock aprovado (2026-04-24): sidebar dark à esquerda
 * (bg-slate-900) com brand + nav + footer de contexto (lab + usuário);
 * content area light à direita (bg-slate-50) com header sticky mostrando
 * a tab ativa e avatar do operador. Em mobile a sidebar vira top-strip
 * horizontal com scroll. Cada tab tem estado isolado — Firestore dedup
 * listeners, então trocar de aba não é custoso.
 */
export function ControlTemperaturaView() {
  const labId = useActiveLabId();
  const lab = useActiveLab();
  const user = useUser();
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const [tab, setTab] = useState<TabId>('dashboard');

  if (!labId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Selecione um laboratório para continuar.
      </div>
    );
  }

  const activeLabel = TABS.find((t) => t.id === tab)?.label ?? '';
  const initials =
    (user?.displayName?.split(' ')[0]?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase();

  return (
    <div className="flex min-h-full flex-col bg-slate-50 font-sans text-slate-900 md:flex-row">
      <aside className="z-10 flex w-full flex-col bg-slate-900 text-slate-300 shadow-xl md:min-h-screen md:w-64">
        <button
          type="button"
          onClick={() => setCurrentView('hub')}
          aria-label="Voltar ao hub de módulos"
          className="border-b border-slate-800 p-6 text-left transition-colors hover:bg-slate-800/60"
        >
          <div className="mb-1 flex items-center gap-3">
            <SunIcon size={28} className="text-indigo-400" />
            <h1 className="text-xl font-bold tracking-tight text-white">HC Quality</h1>
          </div>
          <p className="ml-10 text-xs text-slate-500">
            Controle de Temperatura <span className="text-slate-600">· clique para voltar</span>
          </p>
        </button>

        <nav className="flex flex-1 flex-row overflow-x-auto py-2 md:flex-col md:overflow-visible md:py-4">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex w-full items-center gap-3 whitespace-nowrap px-6 py-3.5 text-left transition-colors ${
                  active
                    ? 'border-r-4 border-indigo-500 bg-indigo-600/10 font-medium text-indigo-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className={active ? 'text-indigo-400' : 'text-slate-500'}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="hidden border-t border-slate-800 p-4 text-center text-xs text-slate-500 md:block">
          <div className="font-mono">{lab?.name ?? labId.slice(0, 16)}</div>
          <div className="mt-1">{user?.displayName ?? user?.email ?? 'Operador'}</div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentView('hub')}
              aria-label="Voltar ao hub"
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M8.5 3.5 5 7l3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Hub
            </button>
            <div className="h-8 w-px bg-slate-200" aria-hidden />
            <div>
              <h2 className="text-xl font-semibold capitalize text-slate-800">{activeLabel}</h2>
              <p className="text-xs text-slate-500">
                FR-11 • PQ-06 • ISO 15189:2022 cl. 5.3 • RDC 978/2025
              </p>
            </div>
          </div>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700"
            title={user?.displayName ?? user?.email ?? 'Usuário'}
          >
            {initials}
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-6 sm:p-8">
          <div key={tab} className="animate-in fade-in duration-300">
            {tab === 'dashboard' && <CTDashboard />}
            {tab === 'leituras' && <TabLeituras />}
            {tab === 'equipamentos' && <TabEquipamentos />}
            {tab === 'ncs' && <NCList />}
            {tab === 'relatorios' && <TabRelatorios />}
            {tab === 'configuracoes' && <TabConfiguracoes />}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Tab: Leituras ────────────────────────────────────────────────────────────

function TabLeituras() {
  const { equipamentos } = useEquipamentos();
  const [expandido, setExpandido] = useState<string | null>(null);

  const { leituras } = useLeituras({
    equipamentoId: expandido ?? undefined,
  });

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Leituras pendentes — hoje"
        subtitle="Registre a leitura conforme o calendário de cada equipamento."
      />
      <LeituraListaPendentes />

      <SectionHeader
        title="Histórico"
        subtitle="Clique em um equipamento para expandir a linha temporal."
      />
      <div className="space-y-3">
        {equipamentos.map((eq) => {
          const expanded = expandido === eq.id;
          return (
            <div
              key={eq.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => setExpandido(expanded ? null : eq.id)}
                className="flex w-full items-center justify-between p-4 text-left hover:bg-slate-50"
              >
                <div>
                  <p className="font-semibold text-slate-800">{eq.nome}</p>
                  <p className="text-xs text-slate-500">{eq.localizacao}</p>
                </div>
                <span className="text-sm text-indigo-600">{expanded ? '▲' : '▼'}</span>
              </button>
              {expanded ? (
                <div className="border-t border-slate-100 p-4">
                  <GraficoTemperatura equipamento={eq} leituras={leituras} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: Equipamentos ────────────────────────────────────────────────────────

function TabEquipamentos() {
  const { equipamentos, isLoading, create, update, softDelete } = useEquipamentos();
  const { leituras } = useLeituras();
  const { previstas } = useLeiturasPrevistas();
  const { ncs } = useNCs();
  const { dispositivos } = useDispositivosIoT();
  const { cards } = useCTIndicadores({
    equipamentos,
    leituras,
    previstas,
    ncs,
    dispositivos,
  });

  const [form, setForm] = useState<EquipamentoMonitorado | 'novo' | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const cardPor = useMemo(() => {
    const m: Record<string, (typeof cards)[number] | undefined> = {};
    cards.forEach((c) => (m[c.equipamento.id] = c));
    return m;
  }, [cards]);

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">Carregando equipamentos...</div>;
  }

  async function onSubmit(input: EquipamentoInput): Promise<void> {
    if (form && form !== 'novo') await update(form.id, input);
    else await create(input);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Equipamentos monitorados"
        actions={
          <>
            <Button tone="secondary" onClick={() => setImportOpen(true)}>
              Importar XLSX
            </Button>
            <Button onClick={() => setForm('novo')}>+ Novo equipamento</Button>
          </>
        }
      />
      {equipamentos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Nenhum equipamento cadastrado. Clique em "+ Novo equipamento" para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {equipamentos.map((eq) => {
            const c = cardPor[eq.id];
            return (
              <div
                key={eq.id}
                className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm border-t-4 ${borderForStatusCard(
                  c?.statusCard ?? 'cinza',
                )}`}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-slate-800">{eq.nome}</h4>
                    <p className="text-xs capitalize text-slate-500">
                      {eq.tipo.replace('_', ' ')} • {eq.localizacao}
                    </p>
                  </div>
                  <StatusBadge tone={toneForStatusCard(c?.statusCard ?? 'cinza')}>
                    {c?.motivo ?? eq.status}
                  </StatusBadge>
                </div>
                <div className="mb-3 text-xs text-slate-500">
                  Limites: {eq.limites.temperaturaMin.toFixed(1)}°C –{' '}
                  {eq.limites.temperaturaMax.toFixed(1)}°C
                  {eq.limites.umidadeMin !== undefined ? ` • Umidade ${eq.limites.umidadeMin}-${eq.limites.umidadeMax}%` : ''}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <Button tone="ghost" onClick={() => setForm(eq)}>
                    Editar
                  </Button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm(`Arquivar "${eq.nome}"? (deleção lógica — pode restaurar depois)`)) {
                        await softDelete(eq.id);
                      }
                    }}
                    className="text-xs text-slate-400 hover:text-rose-600"
                  >
                    Arquivar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form === 'novo' ? (
        <EquipamentoForm open onClose={() => setForm(null)} onSubmit={onSubmit} />
      ) : null}
      {form && form !== 'novo' ? (
        <EquipamentoForm
          open
          onClose={() => setForm(null)}
          equipamento={form}
          onSubmit={onSubmit}
        />
      ) : null}
      {importOpen ? <CTImportXlsx open onClose={() => setImportOpen(false)} /> : null}
    </div>
  );
}

// ─── Tab: Relatórios ──────────────────────────────────────────────────────────

function TabRelatorios() {
  const { equipamentos } = useEquipamentos();
  const { termometros } = useTermometros({ includeDeleted: true });
  const { ncs } = useNCs();

  const hoje = new Date();
  const [equipamentoId, setEquipamentoId] = useState<string>('');
  const [mes, setMes] = useState<number>(hoje.getMonth() + 1);
  const [ano, setAno] = useState<number>(hoje.getFullYear());

  const eqSelecionado = equipamentos.find((e) => e.id === equipamentoId) ?? equipamentos[0];
  const termometroVinculado = eqSelecionado
    ? termometros.find((t) => t.id === eqSelecionado.termometroId) ?? null
    : null;

  const inicio = useMemo(() => {
    const d = new Date(ano, mes - 1, 1, 0, 0, 0);
    return Timestamp.fromDate(d);
  }, [ano, mes]);
  const fim = useMemo(() => {
    const d = new Date(ano, mes, 0, 23, 59, 59);
    return Timestamp.fromDate(d);
  }, [ano, mes]);

  const { leituras } = useLeituras({
    equipamentoId: eqSelecionado?.id,
    inicio,
    fim,
  });

  const [payload, setPayload] = useState<RelatorioFR11 | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    if (!eqSelecionado) return;
    setErro(null);
    setGerando(true);
    try {
      const p = await montarRelatorioFR11({
        equipamento: eqSelecionado,
        termometro: termometroVinculado,
        mes,
        ano,
        leituras,
        ncs,
        resolveResponsavel: (uid) => uid.slice(0, 6),
      });
      setPayload(p);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Emissão de FR-11" subtitle="Relatório mensal por equipamento" />

      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-slate-700">Equipamento</span>
          <Select value={equipamentoId} onChange={(e) => setEquipamentoId(e.target.value)}>
            <option value="">— selecione —</option>
            {equipamentos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-slate-700">Mês</span>
          <Select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, '0')}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-slate-700">Ano</span>
          <Select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => hoje.getFullYear() - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </label>
        <div className="flex items-end">
          <Button className="w-full" onClick={gerar} disabled={!eqSelecionado || gerando}>
            <span className="inline-flex items-center gap-2">
              <CalendarIcon size={16} />
              {gerando ? 'Montando...' : 'Gerar preview'}
            </span>
          </Button>
        </div>
      </div>

      {erro ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <strong>Não foi possível emitir o FR-11:</strong>
          <p className="mt-1">{erro}</p>
        </div>
      ) : null}

      {!payload ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Selecione equipamento + mês/ano e clique em "Gerar preview" para visualizar o FR-11.
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="p-6 text-sm text-slate-500">Carregando preview do FR-11…</div>
          }
        >
          <CTRelatorioPrint payload={payload} onClose={() => setPayload(null)} />
        </Suspense>
      )}
    </div>
  );
}

// ─── Tab: Configurações ───────────────────────────────────────────────────────

function TabConfiguracoes() {
  return (
    <div className="space-y-10">
      <CTIndicadores />
      <TermometrosList />
      <DispositivosIoTList />
    </div>
  );
}
