import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, updateDoc, getDoc } from '../../shared/services/firebase';
import { db } from '../../shared/services/firebase';
import { functions } from '../../config/firebase.config';
import { useActiveLab, useUserRole, useIsSuperAdmin } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';

// ─── Icons ────────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M1 6l7 4 7-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M7 4v3.5l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CQIConfig {
  cqiEnabled: boolean;
  cqiEmail:   string;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

type SectorStatus = 'sent' | 'no-data' | 'failed';
interface TriggerCQIResult {
  ok:       boolean;
  overall:  'sent' | 'no-data' | 'disabled' | 'partial' | 'failed';
  email?:   string;
  sectors: { hematologia: SectorStatus; imunologia: SectorStatus };
}

type SendNowState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; result: TriggerCQIResult }
  | { kind: 'error'; message: string };

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled }: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500
        ${value ? 'bg-violet-500' : 'bg-slate-300 dark:bg-white/10'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
          ${value ? 'translate-x-5' : 'translate-x-1'}`}
      />
    </button>
  );
}

// ─── Frequency option ─────────────────────────────────────────────────────────

function FreqOption({ label, description, selected, soon, onClick }: {
  label:       string;
  description: string;
  selected:    boolean;
  soon?:       boolean;
  onClick?:    () => void;
}) {
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      disabled={soon}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-150
        ${selected && !soon
          ? 'border-violet-500/40 bg-violet-500/5 dark:bg-violet-500/10'
          : 'border-slate-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02]'}
        ${soon ? 'opacity-40 cursor-not-allowed' : 'hover:border-slate-300 dark:hover:border-white/15 cursor-pointer'}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${selected && !soon ? 'text-violet-700 dark:text-violet-300' : 'text-slate-700 dark:text-white/70'}`}>
              {label}
            </span>
            {soon && (
              <span className="text-[10px] px-1.5 py-px rounded bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-white/25 font-medium">
                Em breve
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 dark:text-white/35 mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
        <span className={`shrink-0 mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all
          ${selected && !soon
            ? 'bg-violet-500 border-violet-500 text-white'
            : 'border-slate-300 dark:border-white/20'}`}
        >
          {selected && !soon && <CheckIcon />}
        </span>
      </div>
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function LabCQISettings() {
  const activeLab     = useActiveLab();
  const role          = useUserRole();
  const isSuperAdmin  = useIsSuperAdmin();
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const canEdit     = role === 'owner' || role === 'admin';
  const canSendNow  = isSuperAdmin;

  const [config,      setConfig]      = useState<CQIConfig>({ cqiEnabled: false, cqiEmail: '' });
  const [loading,     setLoading]     = useState(true);
  const [saveState,   setSaveState]   = useState<SaveState>('idle');
  const [emailErr,    setEmailErr]    = useState('');
  const [sendNow,     setSendNow]     = useState<SendNowState>({ kind: 'idle' });

  // ── Load current config from Firestore ──────────────────────────────────────
  useEffect(() => {
    if (!activeLab) return;
    let cancelled = false;

    getDoc(doc(db, 'labs', activeLab.id)).then((snap) => {
      if (cancelled || !snap.exists()) return;
      const d = snap.data();
      const backup = d['backup'] as Record<string, unknown> | undefined;
      setConfig({
        cqiEnabled: Boolean(backup?.['cqiEnabled'] ?? backup?.['enabled'] ?? false),
        cqiEmail:   String(backup?.['cqiEmail'] ?? backup?.['email'] ?? ''),
      });
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeLab]);

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!activeLab || !canEdit) return;

    const email = config.cqiEmail.trim();
    if (config.cqiEnabled && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setEmailErr('Digite um e-mail válido para ativar o envio.');
      return;
    }
    setEmailErr('');
    setSaveState('saving');

    try {
      await updateDoc(doc(db, 'labs', activeLab.id), {
        'backup.cqiEnabled': config.cqiEnabled,
        'backup.cqiEmail':   email,
      });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
    }
  }

  // ── Send now (SuperAdmin only) ──────────────────────────────────────────────
  async function handleSendNow() {
    if (!activeLab || !canSendNow) return;
    setSendNow({ kind: 'sending' });

    try {
      const call = httpsCallable<{ labId: string }, TriggerCQIResult>(functions, 'triggerCQIReport');
      const res  = await call({ labId: activeLab.id });
      setSendNow({ kind: 'done', result: res.data });
      setTimeout(() => setSendNow({ kind: 'idle' }), 8000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao disparar envio.';
      setSendNow({ kind: 'error', message });
      setTimeout(() => setSendNow({ kind: 'idle' }), 6000);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const labelCls = 'block text-[11px] font-semibold text-slate-500 dark:text-white/35 uppercase tracking-wider mb-1.5';
  const inputCls = 'w-full bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/20 focus:outline-none focus:border-violet-400 dark:focus:border-violet-500/50 transition-all';

  if (!activeLab) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-white">

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 sm:px-6 h-12 border-b border-slate-200/80 dark:border-white/[0.06] bg-slate-50/80 dark:bg-[#0B0F14]/80 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setCurrentView('hub')}
          aria-label="Voltar"
          className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70 transition-colors"
        >
          <BackIcon />
          Voltar
        </button>
        <span className="text-slate-300 dark:text-white/15 select-none">·</span>
        <span className="text-sm font-medium text-slate-700 dark:text-white/60">
          Configurações de Relatório
        </span>
      </header>

      {/* ── Body ── */}
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* Title */}
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">
            Relatório CQI por E-mail
          </h1>
          <p className="text-sm text-slate-500 dark:text-white/35 mt-1">
            {activeLab.name}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="w-5 h-5 border-2 border-slate-200 dark:border-white/10 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Ativação ── */}
            <section className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] rounded-2xl p-5 space-y-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-white/80">
                    Envio automático ativo
                  </p>
                  <p className="text-xs text-slate-400 dark:text-white/30 mt-0.5">
                    Relatório PDF gerado e enviado automaticamente
                  </p>
                </div>
                <Toggle
                  value={config.cqiEnabled}
                  onChange={(v) => setConfig((c) => ({ ...c, cqiEnabled: v }))}
                  disabled={!canEdit}
                />
              </div>
            </section>

            {/* ── Email ── */}
            <section className="space-y-2">
              <label className={labelCls}>
                <span className="flex items-center gap-1.5">
                  <MailIcon />
                  E-mail destinatário
                </span>
              </label>
              <input
                type="email"
                value={config.cqiEmail}
                onChange={(e) => { setConfig((c) => ({ ...c, cqiEmail: e.target.value })); setEmailErr(''); }}
                placeholder="responsavel@seulab.com.br"
                disabled={!canEdit}
                className={inputCls + (!canEdit ? ' opacity-50 cursor-not-allowed' : '')}
              />
              {emailErr && (
                <p className="text-xs text-red-500">{emailErr}</p>
              )}
              <p className="text-xs text-slate-400 dark:text-white/25">
                O relatório PDF com gráficos Levey-Jennings e alertas Westgard será entregue neste endereço.
              </p>
            </section>

            {/* ── Frequência ── */}
            <section className="space-y-2">
              <p className={labelCls}>
                <span className="flex items-center gap-1.5">
                  <ClockIcon />
                  Frequência de envio
                </span>
              </p>
              <div className="space-y-2">
                <FreqOption
                  label="Diário — 23:00 BRT"
                  description="Consolidado do dia com todas as corridas confirmadas. Enviado automaticamente após encerramento do expediente."
                  selected
                />
                <FreqOption
                  label="Após cada corrida"
                  description="Relatório individual gerado e enviado em tempo real após a confirmação de cada corrida."
                  selected={false}
                  soon
                />
              </div>
            </section>

            {/* ── Status da agenda ── */}
            <section className="bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.05] rounded-xl px-4 py-3.5 space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-white/25 uppercase tracking-wider">
                Próximo envio agendado
              </p>
              <NextSendInfo enabled={config.cqiEnabled} email={config.cqiEmail} />
            </section>

            {/* ── Enviar agora (SuperAdmin) ── */}
            {canSendNow && (
              <section className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.07] rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-white/80">
                      Enviar agora
                    </p>
                    <p className="text-xs text-slate-400 dark:text-white/30 mt-0.5 leading-relaxed">
                      Dispara o relatório imediatamente, sem esperar o agendamento.
                      Só envia se houver corridas confirmadas no dia.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendNow}
                    disabled={sendNow.kind === 'sending' || !config.cqiEnabled || !config.cqiEmail}
                    className="shrink-0 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-sm font-medium text-slate-700 dark:text-white/75 hover:bg-slate-50 dark:hover:bg-white/[0.07] active:bg-slate-100 dark:active:bg-white/[0.09] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {sendNow.kind === 'sending' ? 'Enviando…' : 'Testar envio'}
                  </button>
                </div>

                {sendNow.kind === 'done' && (() => {
                  const { overall, email, sectors } = sendNow.result;
                  const sectorLabel = (id: 'hematologia' | 'imunologia') =>
                    id === 'hematologia' ? 'Hematologia' : 'Imunologia';
                  const sentSectors = (Object.keys(sectors) as Array<keyof typeof sectors>)
                    .filter(k => sectors[k] === 'sent')
                    .map(sectorLabel);
                  const failedSectors = (Object.keys(sectors) as Array<keyof typeof sectors>)
                    .filter(k => sectors[k] === 'failed')
                    .map(sectorLabel);

                  if (overall === 'sent') {
                    return (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        ✓ Relatório enviado para {email} ({sentSectors.join(', ')}).
                      </p>
                    );
                  }
                  if (overall === 'partial') {
                    return (
                      <p className="text-xs text-amber-600 dark:text-amber-400/80">
                        Enviado parcialmente: {sentSectors.join(', ')}. Falhou: {failedSectors.join(', ')}.
                      </p>
                    );
                  }
                  if (overall === 'no-data') {
                    return (
                      <p className="text-xs text-slate-500 dark:text-white/40">
                        Nenhum setor com corridas hoje — nenhum relatório foi enviado.
                      </p>
                    );
                  }
                  if (overall === 'disabled') {
                    return (
                      <p className="text-xs text-amber-600 dark:text-amber-400/80">
                        Envio desabilitado no Firestore (backup.enabled = false).
                      </p>
                    );
                  }
                  return (
                    <p className="text-xs text-red-500 dark:text-red-400/80">
                      Falha no envio em ambos os setores. Verifique os logs.
                    </p>
                  );
                })()}
                {sendNow.kind === 'error' && (
                  <p className="text-xs text-red-500 dark:text-red-400/80">
                    Falha: {sendNow.message}
                  </p>
                )}
                {(!config.cqiEnabled || !config.cqiEmail) && (
                  <p className="text-xs text-slate-400 dark:text-white/25">
                    Ative o envio automático e defina um e-mail para usar o disparo manual.
                  </p>
                )}
              </section>
            )}

            {/* ── Permissão ── */}
            {!canEdit && (
              <p className="text-xs text-amber-600 dark:text-amber-400/70 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-3">
                Apenas proprietários e administradores podem alterar estas configurações.
              </p>
            )}

            {/* ── Footer ── */}
            {canEdit && (
              <div className="flex items-center justify-between pt-2">
                <p className={`text-xs transition-all duration-300 ${
                  saveState === 'saved' ? 'text-emerald-600 dark:text-emerald-400' :
                  saveState === 'error' ? 'text-red-500' : 'text-transparent'
                }`}>
                  {saveState === 'saved' ? '✓ Configurações salvas' :
                   saveState === 'error' ? 'Erro ao salvar. Tente novamente.' : '.'}
                </p>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveState === 'saving'}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {saveState === 'saving' ? 'Salvando…' : 'Salvar configurações'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── NextSendInfo ─────────────────────────────────────────────────────────────

function NextSendInfo({ enabled, email }: { enabled: boolean; email: string }) {
  const now = new Date();

  const nextSend = new Date();
  nextSend.setHours(23, 0, 0, 0);
  if (now.getHours() >= 23) nextSend.setDate(nextSend.getDate() + 1);

  const fmt = nextSend.toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
    timeZone: 'America/Sao_Paulo',
  });

  if (!enabled) {
    return (
      <p className="text-sm text-slate-400 dark:text-white/25">
        Envio desativado — ative o toggle para programar.
      </p>
    );
  }

  const dest = email.trim() || '—';

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-slate-700 dark:text-white/65">
        {fmt} às 23:00 BRT
      </p>
      <p className="text-xs text-slate-400 dark:text-white/30">
        Para: {dest}
      </p>
    </div>
  );
}
