import React, { useState } from 'react';
import {
  useActiveLab,
  useIsSuperAdmin,
  useUser,
  useUserRole,
  useAvailableLabs,
} from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useAuthFlow } from '../auth/hooks/useAuthFlow';
import { ThemeToggle } from '../../shared/components/ui/ThemeToggle';
import type { View } from '../../types';
import { useCIQLots } from '../ciq-imuno/hooks/useCIQLots';
import { useCoagLots } from '../coagulacao/hooks/useCoagLots';
import { useUroLots } from '../uroanalise/hooks/useUroLots';

/* ╭─────────────────────────────────────────────────────────────────────────╮
   │ Inline SVG icons (no external lib — see hcquality_design_tokens)        │
   ╰─────────────────────────────────────────────────────────────────────────╯ */

const Svg = ({
  size = 18,
  children,
}: {
  size?: number;
  children: React.ReactNode;
}) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden>
    {children}
  </svg>
);

const ActivityIcon = (p: { size?: number }) => (
  <Svg size={p.size}>
    <path
      d="M2.5 10h3l2-5 3 10 2-5h5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const AlertOctaIcon = (p: { size?: number }) => (
  <Svg size={p.size}>
    <path
      d="M7 2.5h6L17.5 7v6L13 17.5H7L2.5 13V7L7 2.5z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M10 6.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="13.5" r="0.9" fill="currentColor" />
  </Svg>
);

const SearchIcon = (p: { size?: number }) => (
  <Svg size={p.size}>
    <circle cx="8.5" cy="8.5" r="5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12.5 12.5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </Svg>
);

const BellIcon = (p: { size?: number }) => (
  <Svg size={p.size}>
    <path
      d="M5.5 8.5a4.5 4.5 0 1 1 9 0v3l1.5 2H4l1.5-2v-3z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M8.5 16a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </Svg>
);

const CheckCircleIcon = (p: { size?: number }) => (
  <Svg size={p.size}>
    <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6.5 10.2l2.5 2.5L13.5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const AlertTriIcon = (p: { size?: number }) => (
  <Svg size={p.size}>
    <path d="M10 3l7.5 13h-15L10 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M10 8.5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="14" r="0.9" fill="currentColor" />
  </Svg>
);

const ClockIcon = (p: { size?: number }) => (
  <Svg size={p.size}>
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10 6v4l2.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </Svg>
);

const ShiftIcon = (p: { size?: number }) => (
  <Svg size={p.size}>
    <circle cx="10" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10 10v2.5M6 15.5h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M7 13a3 3 0 016 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </Svg>
);

const MenuIcon = (p: { size?: number }) => (
  <Svg size={p.size}>
    <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

const CloseIcon = (p: { size?: number }) => (
  <Svg size={p.size}>
    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

const ChevronRightIcon = (p: { size?: number }) => (
  <Svg size={p.size}>
    <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/* ── Analytical module icons ─────────────────────────────────────────────── */

const HematologyIcon = () => (
  <Svg size={20}>
    <circle cx="10" cy="10" r="4.5" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="10" cy="10" r="1.5" fill="currentColor" />
    <path d="M10 2.5v2.5M10 15v2.5M2.5 10H5M15 10h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </Svg>
);

const BiochemIcon = () => (
  <Svg size={20}>
    <path d="M7.5 3h5l1.5 4H6L7.5 3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M6 7l-1.5 9.5h11L14 7" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M8.5 12.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5" stroke="currentColor" strokeWidth="1.2" />
  </Svg>
);

const CoagIcon = () => (
  <Svg size={20}>
    <path
      d="M2.5 10C4 7 6 13 8 10C10 7 12 13 14 10C15.5 7.5 17 10 17.5 10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const UrineIcon = () => (
  <Svg size={20}>
    <path d="M10 2.5C10 2.5 5 9 5 13a5 5 0 0 0 10 0C15 9 10 2.5 10 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M7.5 14.5C7.5 15.6 8.6 16.3 10 16.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </Svg>
);

const ImunoIcon = () => (
  <Svg size={20}>
    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10 2v3M10 15v3M2 10h3M15 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
  </Svg>
);

const EducacaoIcon = () => (
  <Svg size={20}>
    <path d="M2 7l8-3 8 3-8 3-8-3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M5 8.5v3.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18 7v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </Svg>
);

const ControlTempIcon = () => (
  <Svg size={20}>
    <path d="M12 3a2 2 0 1 0-4 0v9.2a3.5 3.5 0 1 0 4 0V3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="10" cy="14.5" r="1.5" fill="currentColor" />
  </Svg>
);

/* ── DICQ / SGQ icons ────────────────────────────────────────────────────── */

const DocsIcon = () => (
  <Svg size={20}>
    <path d="M5 2.5h7l3 3v12H5V2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M12 2.5v3h3M7.5 9.5h5M7.5 12.5h5M7.5 15h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </Svg>
);

const PeopleIcon = () => (
  <Svg size={20}>
    <circle cx="7.5" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="13.5" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M3 16c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4M12 16c0-1.8 1.5-3 3-3s3 1.2 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </Svg>
);

const EquipmentIcon = () => (
  <Svg size={20}>
    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18M4.4 4.4l1.8 1.8M13.8 13.8l1.8 1.8M4.4 15.6l1.8-1.8M13.8 6.2l1.8-1.8"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </Svg>
);

const AwardIcon = () => (
  <Svg size={20}>
    <circle cx="10" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10 12.5v5M7.5 18l2.5-1.5L12.5 18l-.5-3M7.5 18l.5-3" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
  </Svg>
);

const TrendingIcon = () => (
  <Svg size={20}>
    <path d="M2.5 16.5h15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M3.5 13l3.5-4 3 2.5L13 7l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="16.5" cy="10.5" r="1" fill="currentColor" />
  </Svg>
);

const RiskIcon = () => (
  <Svg size={20}>
    <path
      d="M10 2.5L3.5 5v5.5c0 3.5 2.7 6.5 6.5 7.5 3.8-1 6.5-4 6.5-7.5V5L10 2.5z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <path d="M10 7v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="10" cy="13" r="0.9" fill="currentColor" />
  </Svg>
);

const PrePosIcon = () => (
  <Svg size={20}>
    <path
      d="M6 3h4l-1 3v4l3 5.5c.4.7-.1 1.5-.9 1.5H4.9c-.8 0-1.3-.8-.9-1.5L7 11V6L6 3z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path d="M14 6.5l3 3M14.5 12.5l3-3-2-2-3 3 2 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SupplyIcon = () => (
  <Svg size={20}>
    <path d="M2 6h9v8H2V6zM11 8.5h4l2.5 2.5V14h-6.5V8.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="5.5" cy="15.5" r="1.5" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="14" cy="15.5" r="1.5" stroke="currentColor" strokeWidth="1.4" />
  </Svg>
);

const SettingsIcon = () => (
  <Svg size={20}>
    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M16.5 10a6.5 6.5 0 0 0-.1-1.1l1.7-1.3-1.6-2.8-2 .8a6.5 6.5 0 0 0-1.9-1.1L12.2 2.5h-3.4L8.4 4.5A6.5 6.5 0 0 0 6.5 5.6l-2-.8L3 7.6l1.7 1.3A6.5 6.5 0 0 0 4.5 10c0 .4 0 .8.1 1.1l-1.7 1.3 1.6 2.8 2-.8a6.5 6.5 0 0 0 1.9 1.1l.4 2h3.4l.4-2a6.5 6.5 0 0 0 1.9-1.1l2 .8 1.6-2.8-1.7-1.3c.1-.3.1-.7.1-1.1z"
      stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
  </Svg>
);

const PdfIcon = () => (
  <Svg size={20}>
    <rect x="4" y="2" width="12" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </Svg>
);

const ReportsIcon = () => (
  <Svg size={20}>
    <rect x="2.5" y="2.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.4" />
    <path d="M6 13V9.5M10 13V6M14 13v-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </Svg>
);

const InsumosIcon = () => (
  <Svg size={20}>
    <path d="M3 5h14v10H3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M7 5V3h6v2M7 9h6M7 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </Svg>
);

const ShieldIcon = () => (
  <Svg size={20}>
    <path d="M10 2.5L3.5 5v5.5c0 3.5 2.7 6.5 6.5 7.5 3.8-1 6.5-4 6.5-7.5V5L10 2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </Svg>
);

const TraceIcon = () => (
  <Svg size={20}>
    <circle cx="5" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="15" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.3" />
    <path d="M6.5 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="1.5 1.5" />
    <path d="M10 4v3M10 13v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </Svg>
);

const BarChartIcon = () => (
  <Svg size={20}>
    <path d="M3 16.5h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <rect x="4" y="10" width="3" height="6.5" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
    <rect x="8.5" y="6" width="3" height="10.5" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
    <rect x="13" y="3" width="3" height="13.5" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
  </Svg>
);

const DownloadTrayIcon = () => (
  <Svg size={20}>
    <path d="M10 3v9M7 9l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3.5 13.5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/* ╭─────────────────────────────────────────────────────────────────────────╮
   │ Module definitions                                                       │
   ╰─────────────────────────────────────────────────────────────────────────╯ */

interface ModuleDef {
  id: string;
  name: string;
  tagline: string;
  bullets: string[]; // 3 sub-features for module card
  icon: React.ReactNode;
  bloco: string;
  iconBg: string;
  iconColor: string;
  status: 'active' | 'soon';
  category: 'analitico' | 'sgq';
  view?: View;
  statusLabel?: string; // contextual status (e.g., "1 alerta Westgard")
}

const MODULES: ModuleDef[] = [
  // ── DICQ Bloco 4: Qualidade Analítica ────────────────────────────────────
  {
    id: 'hematology',
    name: 'Hematologia',
    tagline: 'CIQ quantitativo · 17 analitos · Yumizen H550',
    bullets: ['Levey-Jennings', 'Westgard 1-3s/2-2s/R-4s', 'Multi-nível'],
    icon: <HematologyIcon />,
    bloco: 'Bloco 4',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    status: 'active',
    category: 'analitico',
    view: 'analyzer',
  },
  {
    id: 'coagulation',
    name: 'Coagulação',
    tagline: 'CIQ quantitativo · AP · RNI · TTPA',
    bullets: ['Clotimer Duo', 'Níveis 1/2/3', 'Westgard'],
    icon: <CoagIcon />,
    bloco: 'Bloco 4',
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-rose-400',
    status: 'active',
    category: 'analitico',
    view: 'coagulacao',
  },
  {
    id: 'urinalysis',
    name: 'Uroanálise',
    tagline: 'CIQ híbrido · tiras reagentes · 10 analitos',
    bullets: ['CLSI GP16', 'Multi-nível', 'Glicose, cetonas, pH...'],
    icon: <UrineIcon />,
    bloco: 'Bloco 4',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    status: 'active',
    category: 'analitico',
    view: 'uroanalise',
  },
  {
    id: 'ciq-imuno',
    name: 'CIQ-Imuno',
    tagline: 'Imunoensaios rápidos · strips · OCR',
    bullets: ['HIV, Dengue, HCG, Sífilis, COVID', 'Manual + analisador', 'pinHistory append-only'],
    icon: <ImunoIcon />,
    bloco: 'Bloco 4',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    status: 'active',
    category: 'analitico',
    view: 'ciq-imuno',
  },
  {
    id: 'biochemistry',
    name: 'Bioquímica',
    tagline: 'CIQ quantitativo · 17 analitos · multi-instrumento',
    bullets: ['Westgard CLSI (1-2s · 1-3s · 2-2s · R-4s)', 'Bula PDF + estatística interna', 'Levey-Jennings multi-equipamento'],
    icon: <BiochemIcon />,
    bloco: 'Bloco 4',
    iconBg: 'bg-sky-500/15',
    iconColor: 'text-sky-400',
    status: 'active',
    category: 'analitico',
    view: 'bioquimica' as View,
    statusLabel: 'Foundation',
  },
  {
    id: 'controle-temperatura',
    name: 'Controle de Temperatura',
    tagline: 'Monitoramento térmico · IoT',
    bullets: ['FR-11 · PQ-06', 'ISO 15189 cl. 5.3', 'Alertas em tempo real'],
    icon: <ControlTempIcon />,
    bloco: 'Bloco 3',
    iconBg: 'bg-cyan-500/15',
    iconColor: 'text-cyan-400',
    status: 'active',
    category: 'analitico',
    view: 'controle-temperatura',
  },
  {
    id: 'educacao-continuada',
    name: 'Educação Continuada',
    tagline: 'Treinamentos · Avaliação de competência',
    bullets: ['FR-001/013/027', 'Dossiê de competência', 'Programa anual'],
    icon: <EducacaoIcon />,
    bloco: 'Bloco 2',
    iconBg: 'bg-indigo-500/15',
    iconColor: 'text-indigo-400',
    status: 'active',
    category: 'analitico',
    view: 'educacao-continuada',
  },
  {
    id: 'turnos',
    name: 'Turnos & Supervisão',
    tagline: 'RDC 978 Art. 122 · Registro de supervisor por turno',
    bullets: ['Supervisor presente por turno', 'Cobertura 90 dias', 'Audit trail com chainHash'],
    icon: <ShiftIcon />,
    bloco: 'Bloco 2',
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
    status: 'active',
    category: 'analitico',
    view: 'turnos' as View,
  },
  {
    id: 'risks',
    name: 'Gestão de Riscos',
    tagline: 'DICQ 4.14.6 · FMEA-Lite (P×S×D, NPR 1–125)',
    bullets: ['Matriz 5×5 heatmap', 'NPR server-side', 'Revisão periódica (cron)', 'Assinatura + auditoria'],
    icon: <AlertTriIcon />,
    bloco: 'Bloco 2',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    status: 'active',
    category: 'analitico',
    view: 'risks' as View,
  },

  // ── DICQ Sistema de Gestão da Qualidade ──────────────────────────────────
  {
    id: 'gestao-documental',
    name: 'Gestão Documental',
    tagline: 'Controle de documentos do SGQ',
    bullets: ['Manual da Qualidade', 'POPs, IT, Lista mestra', 'Versionamento + obsoletos'],
    icon: <DocsIcon />,
    bloco: 'Bloco 1',
    iconBg: 'bg-slate-500/15',
    iconColor: 'text-slate-300',
    status: 'active',
    category: 'sgq',
    view: 'sgq-documentos',
  },
  {
    id: 'gestao-pessoal',
    name: 'Gestão de Pessoal',
    tagline: 'Dossiês, competência e saúde ocupacional',
    bullets: ['Qualificação + cargos', 'Avaliação de competência', 'EPI, vacinação, NR-32'],
    icon: <PeopleIcon />,
    bloco: 'Bloco 2',
    iconBg: 'bg-pink-500/10',
    iconColor: 'text-pink-400/60',
    status: 'soon',
    category: 'sgq',
  },
  {
    id: 'gestao-equipamentos',
    name: 'Gestão de Equipamentos',
    tagline: 'Inventário, calibração e manutenção',
    bullets: ['Cadastro com 12 campos DICQ', 'Calibração + rastreabilidade', 'Manutenção preventiva'],
    icon: <EquipmentIcon />,
    bloco: 'Bloco 3',
    iconBg: 'bg-zinc-500/10',
    iconColor: 'text-zinc-400/60',
    status: 'soon',
    category: 'sgq',
  },
  {
    id: 'ceq',
    name: 'CQ Externo (CEQ)',
    tagline: 'Ensaios interlaboratoriais · Z-score · ISO 17043',
    bullets: ['Controllab · BIPEA · PNCQ', 'Z-score por analito · NC automática', 'DICQ 4.5 · RDC 978'],
    icon: <AwardIcon />,
    bloco: 'Bloco 4',
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
    status: 'active',
    category: 'sgq',
    view: 'ceq' as View,
  },
  {
    id: 'auditoria-interna',
    name: 'Auditoria Interna',
    tagline: 'Planejamento e execução de auditorias DICQ 4.3',
    bullets: ['Plano anual de auditorias', 'Sessões de execução in-loco', 'Registro de achados'],
    icon: <CheckCircleIcon />,
    bloco: 'Bloco 6',
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
    status: 'active',
    category: 'sgq',
    view: 'auditoria-interna' as View,
  },
  {
    id: 'nao-conformidades',
    name: 'Não Conformidades',
    tagline: 'RNCs, causa-raiz e CAPA',
    bullets: ['Ishikawa + 5-porquês', 'Ação corretiva + preventiva', 'Análise de eficácia'],
    icon: <AlertOctaIcon />,
    bloco: 'Bloco 5',
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-400/60',
    status: 'soon',
    category: 'sgq',
  },
  {
    id: 'indicadores',
    name: 'Indicadores & Melhoria',
    tagline: 'KPIs, auditoria interna, análise crítica',
    bullets: ['Painel pré/analítico/pós', 'Auditoria interna', 'Análise crítica da direção'],
    icon: <TrendingIcon />,
    bloco: 'Bloco 6',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400/60',
    status: 'soon',
    category: 'sgq',
  },
  {
    id: 'gestao-riscos',
    name: 'Gestão de Riscos',
    tagline: 'Mapeamento, matriz e plano',
    bullets: ['Probabilidade × gravidade', 'Plano de desastres', 'Eventos adversos'],
    icon: <RiskIcon />,
    bloco: 'Bloco 7',
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-400/60',
    status: 'soon',
    category: 'sgq',
  },
  {
    id: 'pre-pos-analitico',
    name: 'Pré & Pós-analítico',
    tagline: 'Cadastro, coleta, laudos',
    bullets: ['Order entry + consentimento', 'Triagem + valores críticos', 'Laudos + revisão'],
    icon: <PrePosIcon />,
    bloco: 'Bloco 8',
    iconBg: 'bg-fuchsia-500/10',
    iconColor: 'text-fuchsia-400/60',
    status: 'soon',
    category: 'sgq',
  },
  {
    id: 'apoio-fornecedores',
    name: 'Apoio & Fornecedores',
    tagline: 'Qualificação, estoque, terceirização',
    bullets: ['Qualificação + monitoramento', 'Lotes + rastreabilidade', 'Laboratórios de apoio'],
    icon: <SupplyIcon />,
    bloco: 'Bloco 9',
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-400/60',
    status: 'soon',
    category: 'sgq',
  },

  // ── Ferramentas transversais ──────────────────────────────────────────────
  {
    id: 'analytics',
    name: 'Analytics',
    tagline: 'Inteligência analítica · tendências · conformidade',
    bullets: ['KPIs de conformidade', 'Tendências CIQ', 'NC heatmap'],
    icon: <BarChartIcon />,
    bloco: 'Cross',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    status: 'active',
    category: 'sgq',
    view: 'analytics' as View,
  },
  {
    id: 'exports',
    name: 'Exportações',
    tagline: 'XLSX, relatórios PDF, histórico de exports',
    bullets: ['Export XLSX multi-módulo', 'Relatórios PDF', 'Histórico de jobs'],
    icon: <DownloadTrayIcon />,
    bloco: 'Cross',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    status: 'active',
    category: 'sgq',
    view: 'exports' as View,
  },
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
};

/* ╭─────────────────────────────────────────────────────────────────────────╮
   │ Sidebar navigation groups                                                │
   ╰─────────────────────────────────────────────────────────────────────────╯ */

interface SidebarItem {
  label: string;
  icon: React.ReactNode;
  view?: View;
  badge?: 'em-breve';
  notification?: number;
  onClick?: () => void;
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

/* ╭─────────────────────────────────────────────────────────────────────────╮
   │ ModuleHub                                                                │
   ╰─────────────────────────────────────────────────────────────────────────╯ */

export function ModuleHub() {
  const { signOut } = useAuthFlow();
  const activeLab = useActiveLab();
  const isSuperAdmin = useIsSuperAdmin();
  const user = useUser();
  const role = useUserRole();
  const availableLabs = useAvailableLabs();
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const canManageSettings = role === 'owner' || role === 'admin';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const firstName =
    user?.displayName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Você';

  const sidebarGroups: SidebarGroup[] = [
    {
      label: 'Painel',
      items: [
        { label: 'Visão Geral', icon: <ActivityIcon /> },
      ],
    },
    {
      label: 'Qualidade Analítica',
      items: MODULES.filter((m) => m.category === 'analitico').map((m) => ({
        label: m.name,
        icon: m.icon,
        view: m.view,
        badge: m.status === 'soon' ? ('em-breve' as const) : undefined,
      })),
    },
    {
      label: 'Sistema da Qualidade',
      items: MODULES.filter((m) => m.category === 'sgq').map((m) => ({
        label: m.name,
        icon: m.icon,
        view: m.view,
        badge: m.status === 'soon' ? ('em-breve' as const) : undefined,
      })),
    },
    {
      label: 'Ferramentas',
      items: [
        { label: 'Analytics', icon: <BarChartIcon />, view: 'analytics' as View },
        { label: 'Exportações', icon: <DownloadTrayIcon />, view: 'exports' as View },
        { label: 'Importar bula PDF', icon: <PdfIcon />, view: 'bulaparser' as View },
        { label: 'Rastreabilidade', icon: <TraceIcon />, view: 'rastreabilidade' as View },
        { label: 'Relatórios', icon: <ReportsIcon />, view: 'reports' as View },
        { label: 'Insumos', icon: <InsumosIcon />, view: 'insumos' as View },
        ...(canManageSettings
          ? [{ label: 'Configurações', icon: <SettingsIcon />, view: 'lab-settings' as View }]
          : []),
        ...(isSuperAdmin
          ? [{ label: 'Super Admin', icon: <ShieldIcon />, view: 'superadmin' as View }]
          : []),
      ],
    },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-white transition-colors duration-300">
      {/* ╭─ Mobile drawer overlay ────────────────────────────────────────╮ */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ╭─ Sidebar ──────────────────────────────────────────────────────╮ */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 shrink-0 bg-[#141417] text-slate-300 flex flex-col transition-transform duration-200 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="px-5 h-14 flex items-center gap-3 border-b border-white/[0.06] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/90 flex items-center justify-center text-white font-bold text-xs">
            HC
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">
              hc-quality
            </p>
            <p className="text-[10px] text-white/40 leading-tight">
              SGQ · Acreditação DICQ
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="lg:hidden text-white/50 hover:text-white"
            aria-label="Fechar menu"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {sidebarGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] uppercase font-semibold text-white/30 mb-2 px-3 tracking-wider">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item, idx) => (
                  <SidebarNavItem
                    key={`${group.label}-${idx}`}
                    item={item}
                    onNavigate={(v) => {
                      setCurrentView(v);
                      setDrawerOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/[0.06] shrink-0 flex items-center justify-between">
          <ThemeToggle size="sm" />
          <button
            type="button"
            onClick={signOut}
            className="text-xs text-white/40 hover:text-red-400 px-2 py-1 rounded transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* ╭─ Main ──────────────────────────────────────────────────────────╮ */}
      <main className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-14 border-b border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#0B0F14]/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-[#0B0F14]/60 flex items-center px-4 sm:px-6 gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-1.5 rounded-md text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
            aria-label="Abrir menu"
          >
            <MenuIcon size={20} />
          </button>

          <h1 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
            Painel do SGQ
          </h1>
          <span className="hidden sm:inline-flex items-center text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
            DICQ 8ª ed.
          </span>

          <div className="flex-1" />

          <div className="hidden md:flex items-center relative">
            <SearchIcon size={14} />
            <input
              type="text"
              placeholder="Buscar POP, NC, lote..."
              className="ml-[-22px] pl-8 pr-4 h-9 w-56 rounded-lg text-sm bg-slate-100 dark:bg-white/[0.04] border border-transparent text-slate-700 dark:text-white/80 placeholder-slate-400 dark:placeholder-white/30 focus:bg-white dark:focus:bg-white/[0.06] focus:border-emerald-400 dark:focus:border-emerald-500/40 focus:outline-none transition"
            />
          </div>

          <button
            type="button"
            className="relative p-2 text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/85 transition-colors"
            aria-label="Notificações"
            disabled
          >
            <BellIcon size={18} />
          </button>

          {/* User menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="w-9 h-9 rounded-full bg-slate-800 dark:bg-white/[0.08] text-white flex items-center justify-center text-xs font-semibold hover:ring-2 hover:ring-emerald-400/40 transition"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              {firstName.slice(0, 2).toUpperCase()}
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-40 w-60 rounded-xl bg-white dark:bg-[#151d2a] border border-slate-200 dark:border-white/[0.1] shadow-2xl overflow-hidden py-1">
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.07] mb-1">
                    <p className="text-xs font-medium text-slate-700 dark:text-white/70 truncate">
                      {user?.displayName ?? user?.email}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-white/35 truncate mt-0.5">
                      {activeLab?.name ?? 'Sem laboratório'}
                      {role && ` · ${ROLE_LABELS[role] ?? role}`}
                    </p>
                  </div>
                  {availableLabs.length > 1 && (
                    <button
                      type="button"
                      disabled
                      className="w-full px-4 py-2 text-left text-sm text-slate-400 dark:text-white/25 cursor-not-allowed flex items-center"
                    >
                      Trocar laboratório
                      <span className="ml-1.5 text-[10px] bg-slate-100 dark:bg-white/[0.05] px-1 py-0.5 rounded">
                        em breve
                      </span>
                    </button>
                  )}
                  <div className="h-px bg-slate-100 dark:bg-white/[0.06] my-1" />
                  <button
                    type="button"
                    onClick={signOut}
                    className="w-full px-4 py-2 text-left text-sm text-red-500/80 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                  >
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Dashboard content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {/* Greeting + audit readiness */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white tracking-tight">
                  Olá, {firstName}
                </h2>
                <p className="text-sm text-slate-500 dark:text-white/40 mt-1">
                  {activeLab?.name ?? 'Nenhum laboratório'}
                  {role && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-white/30 font-medium">
                      {ROLE_LABELS[role] ?? role}
                    </span>
                  )}
                </p>
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/[0.08] border border-emerald-200/70 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                <CheckCircleIcon size={18} />
                <div className="text-left">
                  <p className="text-[10px] uppercase tracking-wider font-semibold opacity-70">
                    Prontidão para auditoria
                  </p>
                  <p className="text-sm font-semibold">Em construção</p>
                </div>
              </div>
            </div>

            {/* Alert widgets — placeholder até módulos SGQ ativarem */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AlertWidget
                tone="muted"
                icon={<AlertTriIcon size={18} />}
                title="Não Conformidades"
                value="—"
                subtitle="Aguardando módulo SGQ — Bloco 5"
              />
              <AlertWidget
                tone="muted"
                icon={<DocsIcon />}
                title="Documentos"
                value="—"
                subtitle="Aguardando módulo SGQ — Bloco 1"
              />
              <AlertWidget
                tone="info"
                icon={<AwardIcon />}
                title="CQ Externo (CEQ)"
                value="—"
                subtitle="Participações interlaboratoriais · Z-score"
              />
            </div>

            {/* Bancada section (cross-module) */}
            <HubBancadaSection onNavigate={setCurrentView} />

            {/* Module grid — Módulos Analíticos */}
            <section>
              <SectionHeading
                eyebrow="Em produção"
                title="Módulos analíticos"
                subtitle="Controle interno da qualidade — DICQ Bloco 4"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {MODULES.filter((m) => m.category === 'analitico').map((mod) => (
                  <ModuleCard key={mod.id} mod={mod} onNavigate={setCurrentView} />
                ))}
              </div>
            </section>

            {/* Module grid — SGQ */}
            <section>
              <SectionHeading
                eyebrow="Roadmap"
                title="Sistema da Qualidade"
                subtitle="Blocos normativos DICQ 8ª ed. / ISO 15189:2015"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {MODULES.filter((m) => m.category === 'sgq').map((mod) => (
                  <ModuleCard key={mod.id} mod={mod} onNavigate={setCurrentView} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ╭─────────────────────────────────────────────────────────────────────────╮
   │ SidebarNavItem                                                           │
   ╰─────────────────────────────────────────────────────────────────────────╯ */

function SidebarNavItem({
  item,
  onNavigate,
}: {
  item: SidebarItem;
  onNavigate: (view: View) => void;
}) {
  const isDisabled = !item.view && !item.onClick;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => {
        if (item.view) onNavigate(item.view);
        else if (item.onClick) item.onClick();
      }}
      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
        isDisabled
          ? 'text-white/25 cursor-not-allowed'
          : 'text-white/65 hover:bg-white/[0.05] hover:text-white/90'
      }`}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <span className="shrink-0 opacity-70">{item.icon}</span>
        <span className="truncate">{item.label}</span>
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        {item.notification !== undefined && (
          <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {item.notification}
          </span>
        )}
        {item.badge === 'em-breve' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30 font-medium tracking-wide">
            EM BREVE
          </span>
        )}
      </span>
    </button>
  );
}

/* ╭─────────────────────────────────────────────────────────────────────────╮
   │ AlertWidget                                                              │
   ╰─────────────────────────────────────────────────────────────────────────╯ */

function AlertWidget({
  tone,
  icon,
  title,
  value,
  subtitle,
}: {
  tone: 'danger' | 'warning' | 'info' | 'muted';
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
}) {
  const palette: Record<typeof tone, string> = {
    danger:
      'bg-rose-50 dark:bg-rose-500/[0.06] border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-300',
    warning:
      'bg-amber-50 dark:bg-amber-500/[0.06] border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300',
    info:
      'bg-blue-50 dark:bg-blue-500/[0.06] border-blue-200 dark:border-blue-500/20 text-blue-800 dark:text-blue-300',
    muted:
      'bg-slate-100/70 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-white/40',
  };

  return (
    <div className={`p-4 rounded-xl border ${palette[tone]}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="p-2 rounded-lg bg-white dark:bg-white/[0.05] shadow-sm">
          {icon}
        </div>
        <span className="text-2xl font-bold text-slate-800 dark:text-white/85">
          {value}
        </span>
      </div>
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-[11px] mt-0.5 opacity-70">{subtitle}</p>
    </div>
  );
}

/* ╭─────────────────────────────────────────────────────────────────────────╮
   │ SectionHeading                                                           │
   ╰─────────────────────────────────────────────────────────────────────────╯ */

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400/80">
        {eyebrow}
      </p>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mt-0.5">
        {title}
      </h3>
      <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">{subtitle}</p>
    </div>
  );
}

/* ╭─────────────────────────────────────────────────────────────────────────╮
   │ ModuleCard                                                               │
   ╰─────────────────────────────────────────────────────────────────────────╯ */

function ModuleCard({
  mod,
  onNavigate,
}: {
  mod: ModuleDef;
  onNavigate: (view: View) => void;
}) {
  const isSoon = mod.status === 'soon';

  return (
    <button
      type="button"
      disabled={isSoon}
      onClick={() => mod.view && onNavigate(mod.view)}
      className={`group text-left rounded-xl border p-5 flex flex-col h-full transition-all ${
        isSoon
          ? 'bg-white dark:bg-white/[0.01] border-slate-200 dark:border-white/[0.04] opacity-50 cursor-not-allowed'
          : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] hover:border-emerald-400/60 dark:hover:border-emerald-500/30 hover:shadow-md dark:hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl ${mod.iconBg} ${mod.iconColor}`}>
          {mod.icon}
        </div>
        <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-1 rounded bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-white/35">
          {mod.bloco}
        </span>
      </div>

      <h3
        className={`text-base font-semibold transition-colors ${
          isSoon
            ? 'text-slate-700 dark:text-white/55'
            : 'text-slate-900 dark:text-white/85 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
        }`}
      >
        {mod.name}
      </h3>
      <p className="text-xs text-slate-500 dark:text-white/40 mt-1 mb-3">
        {mod.tagline}
      </p>

      <ul className="text-[11px] text-slate-500 dark:text-white/35 space-y-1 mb-4 flex-1">
        {mod.bullets.map((b, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/20 shrink-0" />
            {b}
          </li>
        ))}
      </ul>

      <div className="pt-3 border-t border-slate-100 dark:border-white/[0.04] flex items-center justify-between">
        {isSoon ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-white/30">
            <ClockIcon size={12} /> Em breve
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400/80 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            {mod.statusLabel ?? 'Ativo'}
          </span>
        )}
        {!isSoon && (
          <span className="text-slate-300 dark:text-white/20 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all">
            <ChevronRightIcon size={14} />
          </span>
        )}
      </div>
    </button>
  );
}

/* ╭─────────────────────────────────────────────────────────────────────────╮
   │ HubBancadaSection — cross-module pinned lots (Fase 5 — 2026-04-25)      │
   ╰─────────────────────────────────────────────────────────────────────────╯ */

function HubBancadaSection({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { lots: imunoLots } = useCIQLots();
  const { lots: coagLots } = useCoagLots();
  const { lots: uroLots } = useUroLots();

  type PinnedItem = {
    key: string;
    module: 'imuno' | 'coag' | 'uro';
    moduleLabel: string;
    moduleView: View;
    accent: 'emerald' | 'rose' | 'amber';
    title: string;
    subtitle: string;
    setupType: 'principal' | 'validacao_paralela';
    runCount: number;
    validade: string;
  };

  const items: PinnedItem[] = [
    ...imunoLots
      .filter((l) => l.setupType === 'principal' || l.setupType === 'validacao_paralela')
      .map((l): PinnedItem => ({
        key: `imuno-${l.id}`,
        module: 'imuno',
        moduleLabel: 'CIQ Imuno',
        moduleView: 'ciq-imuno',
        accent: 'emerald',
        title: l.testType,
        subtitle: l.loteControle,
        setupType: l.setupType as 'principal' | 'validacao_paralela',
        runCount: l.runCount,
        validade: l.validadeControle,
      })),
    ...coagLots
      .filter((l) => l.setupType === 'principal' || l.setupType === 'validacao_paralela')
      .map((l): PinnedItem => ({
        key: `coag-${l.id}`,
        module: 'coag',
        moduleLabel: 'Coagulação',
        moduleView: 'coagulacao',
        accent: 'rose',
        title: `Nível ${l.nivel}`,
        subtitle: l.loteControle,
        setupType: l.setupType as 'principal' | 'validacao_paralela',
        runCount: l.runCount,
        validade: l.validadeControle,
      })),
    ...uroLots
      .filter((l) => l.setupType === 'principal' || l.setupType === 'validacao_paralela')
      .map((l): PinnedItem => ({
        key: `uro-${l.id}`,
        module: 'uro',
        moduleLabel: 'Uroanálise',
        moduleView: 'uroanalise',
        accent: 'amber',
        title: `Nível ${l.nivel}`,
        subtitle: l.loteControle,
        setupType: l.setupType as 'principal' | 'validacao_paralela',
        runCount: l.runCount,
        validade: l.validadeControle,
      })),
  ];

  if (items.length === 0) return null;

  const moduleAccent: Record<PinnedItem['accent'], string> = {
    emerald:
      'bg-emerald-50/60 dark:bg-emerald-500/[0.06] border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    rose: 'bg-rose-50/60 dark:bg-rose-500/[0.06] border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-400',
    amber:
      'bg-amber-50/60 dark:bg-amber-500/[0.06] border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400',
  };

  return (
    <section>
      <SectionHeading
        eyebrow={`Bancada · ${items.length} setup${items.length !== 1 ? 's' : ''} vinculado${items.length !== 1 ? 's' : ''}`}
        title="Lotes em uso na rotina"
        subtitle="Setup oficial e validações paralelas dos módulos analíticos"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {items.map((it) => {
          const isPrincipal = it.setupType === 'principal';
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onNavigate(it.moduleView)}
              className={`text-left rounded-xl border p-3.5 transition-all hover:brightness-105 ${moduleAccent[it.accent]}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                  {it.moduleLabel}
                </span>
                <span
                  className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-full ${
                    isPrincipal
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                      : 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300'
                  }`}
                >
                  {isPrincipal ? 'Oficial' : 'Validação'}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white/85 truncate">
                {it.title}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-white/45 font-mono truncate mt-0.5">
                {it.subtitle}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-white/30 mt-1.5">
                {it.runCount} corrida{it.runCount !== 1 ? 's' : ''} · Val. {it.validade}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
