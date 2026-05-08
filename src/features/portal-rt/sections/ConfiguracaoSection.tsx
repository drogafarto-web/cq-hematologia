/**
 * Portal RT — Configuração Section
 *
 * RT user profile, change password, 2FA toggle (auth service), lab config view (read-only)
 */

import React, { useEffect, useState } from 'react';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import {
  PortalSection,
  PortalCard,
  PortalBadge,
  PortalTextSecondary,
  PortalRTTokens,
  PortalDivider,
} from '../components/_ui';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RTUserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'RT' | 'AUDITOR' | 'ADMIN';
  criadoEm: number;
  ultimoLogin: number;
  twoFAEnabled: boolean;
  telefoneCelular?: string;
}

export interface LabConfig {
  nome: string;
  cnpj: string;
  endereco: string;
  responsavelTecnico: string;
  telefone: string;
  notivisaEnabled: boolean;
}

// ─── Settings group ───────────────────────────────────────────────────────────

interface SettingGroupProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function SettingGroup({ title, description, children }: SettingGroupProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className={`text-sm font-medium ${PortalRTTokens.text.primary}`}>{title}</h3>
        {description && (
          <p className={`text-xs ${PortalRTTokens.text.tertiary} mt-1`}>{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Profile field ────────────────────────────────────────────────────────────

interface ProfileFieldProps {
  label: string;
  value: string;
  isEditable?: boolean;
  onEdit?: () => void;
}

function ProfileField({ label, value, isEditable, onEdit }: ProfileFieldProps) {
  return (
    <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default} flex items-center justify-between`}>
      <div className="flex-1">
        <p className={`text-xs ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-1`}>
          {label}
        </p>
        <p className={`${PortalRTTokens.text.primary}`}>{value}</p>
      </div>
      {isEditable && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="px-3 py-1 text-sm rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors"
        >
          Editar
        </button>
      )}
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ enabled, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${
        enabled ? 'bg-emerald-500' : `${PortalRTTokens.bg.interactive}`
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function ConfiguracaoSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-24 rounded bg-white/8 animate-pulse" />
          <div className="h-12 w-full rounded bg-white/8 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface ConfiguracaoSectionProps {
  labId?: string;
}

export function ConfiguracaoSection({ labId }: ConfiguracaoSectionProps) {
  const activeLabId = useActiveLabId();
  const currentLabId = labId || activeLabId;
  const user = useUser();

  const [profile, setProfile] = useState<RTUserProfile | null>(null);
  const [labConfig, setLabConfig] = useState<LabConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [twoFAState, setTwoFAState] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  // RT presence state (Wave 4 — RDC 978 Art. 22)
  const [rtPresenceCheckedIn, setRtPresenceCheckedIn] = useState(false);
  const [rtPresenceSessionId, setRtPresenceSessionId] = useState<string | null>(null);
  const [rtPresenceCheckedInAt, setRtPresenceCheckedInAt] = useState<Date | null>(null);
  const [rtPresenceModalOpen, setRtPresenceModalOpen] = useState(false);
  const [rtPresenceLoading, setRtPresenceLoading] = useState(false);

  // Mock data initialization
  useEffect(() => {
    // In Phase 4.2+, this will load from Firestore:
    // - /users/{uid}
    // - /labs/{labId}/config
    const timer = setTimeout(() => {
      setProfile({
        uid: user?.uid || 'user-123',
        email: user?.email || 'rt@lab.com.br',
        displayName: user?.displayName || 'Responsável Técnico',
        role: 'RT',
        criadoEm: Date.now() - 180 * 86400000,
        ultimoLogin: Date.now() - 2 * 3600000,
        twoFAEnabled: false,
        telefoneCelular: '(11) 98765-4321',
      });

      setLabConfig({
        nome: 'Laboratório Clínico Test',
        cnpj: '12.345.678/0001-90',
        endereco: 'Rua das Flores, 123 — São Paulo, SP',
        responsavelTecnico: 'Dr. João Silva',
        telefone: '(11) 3456-7890',
        notivisaEnabled: true,
      });

      setTwoFAState(false);
      setIsLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [user]);

  const handleTwoFAChange = async (enabled: boolean) => {
    // In Phase 4.3+, call auth service to enable/disable 2FA
    setTwoFAState(enabled);
  };

  const handlePasswordChange = async (oldPassword: string, newPassword: string) => {
    // In Phase 4.3+, call auth service to change password
    console.log('[ConfiguracaoSection] Password change request');
    setPasswordModalOpen(false);
  };

  // ─── RT Presence handlers (Wave 4 — RDC 978 Art. 22) ──────────────────────────

  const handleRtPresenceCheckin = async () => {
    if (!currentLabId) {
      console.error('[ConfiguracaoSection] No lab ID for RT checkin');
      return;
    }

    setRtPresenceLoading(true);
    try {
      // Call rtPresenceCheckin Cloud Function callable
      // const response = await functions.httpsCallable('rtPresenceCheckin')({ labId: currentLabId });
      // Mocked for now
      const mockSessionId = `rt-${currentLabId}-${Date.now()}`;
      const mockCheckedInAt = new Date();

      setRtPresenceSessionId(mockSessionId);
      setRtPresenceCheckedInAt(mockCheckedInAt);
      setRtPresenceCheckedIn(true);
      setRtPresenceModalOpen(false);

      console.log('[ConfiguracaoSection] RT checked in', { sessionId: mockSessionId });
    } catch (error) {
      console.error('[ConfiguracaoSection] RT checkin failed', error);
      // Show toast error
    } finally {
      setRtPresenceLoading(false);
    }
  };

  const handleRtPresenceCheckout = async () => {
    if (!currentLabId || !rtPresenceSessionId) {
      console.error('[ConfiguracaoSection] No session for RT checkout');
      return;
    }

    setRtPresenceLoading(true);
    try {
      // Call rtPresenceCheckout Cloud Function callable
      // const response = await functions.httpsCallable('rtPresenceCheckout')({
      //   labId: currentLabId,
      //   sessionId: rtPresenceSessionId,
      // });
      // Mocked for now

      setRtPresenceSessionId(null);
      setRtPresenceCheckedInAt(null);
      setRtPresenceCheckedIn(false);

      console.log('[ConfiguracaoSection] RT checked out');
    } catch (error) {
      console.error('[ConfiguracaoSection] RT checkout failed', error);
    } finally {
      setRtPresenceLoading(false);
    }
  };

  const getRtPresenceDuration = (): string => {
    if (!rtPresenceCheckedInAt) return '—';

    const now = new Date();
    const diffMs = now.getTime() - rtPresenceCheckedInAt.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`;
    return `${diffMins}m`;
  };

  const getRtPresenceExpiryWarning = (): string | null => {
    if (!rtPresenceCheckedInAt) return null;

    const now = new Date();
    const diffMs = now.getTime() - rtPresenceCheckedInAt.getTime();
    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
    const SEVEN_HOURS_45_MINS_MS = 7.75 * 60 * 60 * 1000;

    if (diffMs > SEVEN_HOURS_45_MINS_MS) {
      const remainingMins = Math.round((EIGHT_HOURS_MS - diffMs) / (1000 * 60));
      return `Expira em ${remainingMins} minutos — faça logout antes da expiração`;
    }

    return null;
  };

  if (isLoading || !profile || !labConfig) {
    return (
      <PortalSection title="Configuração" subtitle="Ajustes e preferências">
        <ConfiguracaoSkeleton />
      </PortalSection>
    );
  }

  const lastLoginText = () => {
    const diff = Math.floor((Date.now() - profile.ultimoLogin) / 1000);
    if (diff < 60) return 'Agora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return `${Math.floor(diff / 86400)}d atrás`;
  };

  return (
    <PortalSection title="Configuração" subtitle="Ajustes e preferências">
      {/* User Profile */}
      <PortalCard>
        <SettingGroup
          title="Perfil do Operador"
          description="Suas informações de conta e acesso"
        >
          <div className="space-y-3">
            <ProfileField label="Nome" value={profile.displayName} />
            <ProfileField label="Email" value={profile.email} />
            <ProfileField label="Telefone" value={profile.telefoneCelular || '—'} isEditable onEdit={() => {}} />

            <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default}`}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-xs ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-1`}>
                    Função
                  </p>
                  <div className="flex items-center gap-2">
                    <PortalBadge variant="info">{profile.role}</PortalBadge>
                  </div>
                </div>
                <div>
                  <p className={`text-xs ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-1`}>
                    Último Login
                  </p>
                  <p className={`text-sm ${PortalRTTokens.text.primary}`}>
                    {lastLoginText()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SettingGroup>
      </PortalCard>

      <PortalDivider className="my-6" />

      {/* RT Presence (Wave 4 — RDC 978 Art. 22) */}
      <PortalCard>
        <SettingGroup
          title="Presença de RT (RDC 978 Art. 22)"
          description="Registre sua presença para operações críticas"
        >
          <div className="space-y-4">
            {/* Presence Status */}
            <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      rtPresenceCheckedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
                    }`}
                  />
                  <div>
                    <p className={`text-sm font-medium ${PortalRTTokens.text.primary}`}>
                      {rtPresenceCheckedIn ? 'RT Presente' : 'RT Ausente'}
                    </p>
                    {rtPresenceCheckedIn && rtPresenceCheckedInAt && (
                      <>
                        <PortalTextSecondary className="text-xs mt-1">
                          Presença desde {rtPresenceCheckedInAt.toLocaleTimeString('pt-BR')}
                        </PortalTextSecondary>
                        <PortalTextSecondary className="text-xs mt-0.5">
                          Duração: {getRtPresenceDuration()}
                        </PortalTextSecondary>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    rtPresenceCheckedIn
                      ? handleRtPresenceCheckout()
                      : setRtPresenceModalOpen(true)
                  }
                  disabled={rtPresenceLoading}
                  className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                    rtPresenceCheckedIn
                      ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                  } ${rtPresenceLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {rtPresenceCheckedIn ? 'Finalizar Presença' : 'Iniciar Presença'}
                </button>
              </div>

              {/* Expiry warning */}
              {getRtPresenceExpiryWarning() && (
                <div className="mt-3 p-3 rounded bg-amber-500/10 border border-amber-500/30">
                  <p className="text-xs text-amber-200">{getRtPresenceExpiryWarning()}</p>
                </div>
              )}
            </div>

            {/* Info text */}
            <div className={`p-3 rounded-lg bg-blue-500/10 border border-blue-500/30`}>
              <p className="text-xs text-blue-200">
                A presença de RT é obrigatória para operações críticas conforme RDC 978/2025 Art. 22.
                Sessões expiram automaticamente após 8 horas.
              </p>
            </div>
          </div>
        </SettingGroup>
      </PortalCard>

      <PortalDivider className="my-6" />

      {/* Security Settings */}
      <PortalCard>
        <SettingGroup
          title="Segurança"
          description="Gerenciar senha e autenticação"
        >
          <div className="space-y-4">
            {/* Change password */}
            <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default} flex items-center justify-between`}>
              <div>
                <p className={`text-sm font-medium ${PortalRTTokens.text.primary}`}>
                  Alterar Senha
                </p>
                <PortalTextSecondary className="text-xs mt-1">
                  Última mudança há mais de 90 dias
                </PortalTextSecondary>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(true)}
                className="px-4 py-2 text-sm rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors"
              >
                Alterar
              </button>
            </div>

            {/* 2FA toggle */}
            <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default} flex items-center justify-between`}>
              <div className="flex-1">
                <p className={`text-sm font-medium ${PortalRTTokens.text.primary}`}>
                  Autenticação de Dois Fatores
                </p>
                <PortalTextSecondary className="text-xs mt-1">
                  {twoFAState ? 'Ativado — mais seguro' : 'Desativado — ativar recomendado'}
                </PortalTextSecondary>
              </div>
              <ToggleSwitch
                enabled={twoFAState}
                onChange={handleTwoFAChange}
              />
            </div>

            {/* Recovery codes */}
            <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${PortalRTTokens.text.primary}`}>
                    Códigos de Recuperação
                  </p>
                  <PortalTextSecondary className="text-xs mt-1">
                    Salve em local seguro
                  </PortalTextSecondary>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 text-sm rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                >
                  Gerar
                </button>
              </div>
            </div>
          </div>
        </SettingGroup>
      </PortalCard>

      <PortalDivider className="my-6" />

      {/* Lab Configuration (Read-only) */}
      <PortalCard>
        <SettingGroup
          title="Configuração do Laboratório"
          description="Informações da instituição (somente leitura)"
        >
          <div className="space-y-3">
            <ProfileField label="Nome do Lab" value={labConfig.nome} />
            <ProfileField label="CNPJ" value={labConfig.cnpj} />
            <ProfileField label="Responsável Técnico" value={labConfig.responsavelTecnico} />
            <ProfileField label="Telefone" value={labConfig.telefone} />
            <ProfileField label="Endereço" value={labConfig.endereco} />

            <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default} flex items-center justify-between`}>
              <div>
                <p className={`text-xs ${PortalRTTokens.text.tertiary} uppercase tracking-wide mb-1`}>
                  Integração NOTIVISA
                </p>
                <p className={`text-sm ${PortalRTTokens.text.primary}`}>
                  {labConfig.notivisaEnabled ? 'Ativado' : 'Desativado'}
                </p>
              </div>
              <PortalBadge variant={labConfig.notivisaEnabled ? 'success' : 'neutral'}>
                {labConfig.notivisaEnabled ? 'Ativo' : 'Inativo'}
              </PortalBadge>
            </div>
          </div>
        </SettingGroup>
      </PortalCard>

      <PortalDivider className="my-6" />

      {/* Session & Activity */}
      <PortalCard>
        <SettingGroup
          title="Sessão e Atividade"
          description="Gerenciar sua sessão"
        >
          <div className="space-y-3">
            <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default} flex items-center justify-between`}>
              <div>
                <p className={`text-sm font-medium ${PortalRTTokens.text.primary}`}>
                  Logout
                </p>
                <PortalTextSecondary className="text-xs mt-1">
                  Encerrar sua sessão atual
                </PortalTextSecondary>
              </div>
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors"
              >
                Sair
              </button>
            </div>

            <div className={`p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default} flex items-center justify-between`}>
              <div>
                <p className={`text-sm font-medium ${PortalRTTokens.text.primary}`}>
                  Logout em Todos os Devices
                </p>
                <PortalTextSecondary className="text-xs mt-1">
                  Encerrar em todos os navegadores
                </PortalTextSecondary>
              </div>
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors"
              >
                Sair Tudo
              </button>
            </div>
          </div>
        </SettingGroup>
      </PortalCard>

      {/* Info footer */}
      <div className={`mt-6 p-4 rounded-lg ${PortalRTTokens.bg.card} border ${PortalRTTokens.border.default}`}>
        <p className={`text-xs ${PortalRTTokens.text.tertiary}`}>
          Para alterar dados do laboratório ou políticas de acesso, contate o administrador do sistema.
        </p>
      </div>
    </PortalSection>
  );
}
