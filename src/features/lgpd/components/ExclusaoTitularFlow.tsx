/**
 * ExclusaoTitularFlow Component — Multi-step LGPD Art. 18 data subject deletion flow
 *
 * Steps:
 * 1. CPF + Reason input
 * 2. Email verification via OTP
 * 3. Final confirmation (irreversible warning)
 * 4. Processing + success (auto-logout)
 *
 * Security:
 * - OTP expires 10 min
 * - Max 3 attempts per CPF
 * - Rate-limited 1 req/min per CPF
 * - Chain-hash preservation verified
 */

import React, { useState, useEffect } from 'react';
import { sendOTP, deleteTitularData } from '../services/lgpdService';
import { useUser } from '../../../store/useAuthStore';

type Step = 'cpf-input' | 'otp-verification' | 'final-confirmation' | 'processing' | 'success' | 'error';

interface ExclusaoTitularFlowProps {
  labId: string;
}

// Simple CPF formatter (XX.XXX.XXX-XX)
function formatCPF(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Simple CPF validator
function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.length === 11;
}

export function ExclusaoTitularFlow({ labId }: ExclusaoTitularFlowProps) {
  const user = useUser();

  // Step management
  const [currentStep, setCurrentStep] = useState<Step>('cpf-input');

  // Step 1: CPF + Reason
  const [cpf, setCpf] = useState('');
  const [motivo, setMotivo] = useState('Exclusão solicitada pelo titular');

  // Step 2: OTP
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpResend, setOtpResend] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Step 3: Confirmation
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);

  // Step 4: Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [deletedDocCount, setDeletedDocCount] = useState(0);

  // OTP countdown timer
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  // ─────────────────────────────────────────────────────────────
  // Step 1: CPF + Reason
  // ─────────────────────────────────────────────────────────────

  const handleSendOTP = async () => {
    if (!isValidCPF(cpf)) {
      setProcessError('CPF inválido');
      return;
    }

    setOtpSending(true);
    setProcessError(null);

    try {
      // Use logged-in user's email for OTP
      const email = user?.email;
      if (!email) {
        throw new Error('Email do usuário não encontrado');
      }

      setOtpEmail(email);

      const result = await sendOTP(email, 'Lab');
      setOtpToken(result.otpToken);
      setOtpCountdown(300); // 5 minutes
      setCurrentStep('otp-verification');
    } catch (err) {
      setProcessError(
        err instanceof Error ? err.message : 'Erro ao enviar código OTP',
      );
    } finally {
      setOtpSending(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Step 2: OTP Verification
  // ─────────────────────────────────────────────────────────────

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setProcessError('Código OTP deve ter 6 dígitos');
      return;
    }

    // Move to final confirmation
    setCurrentStep('final-confirmation');
    setOtp(otp); // Store OTP for final step
  };

  const handleResendOTP = async () => {
    setOtpResend(true);
    setProcessError(null);

    try {
      if (!otpEmail) {
        throw new Error('Email não encontrado');
      }

      const result = await sendOTP(otpEmail, 'Lab');
      setOtpToken(result.otpToken);
      setOtp(''); // Clear previous OTP input
      setOtpCountdown(300);
    } catch (err) {
      setProcessError(
        err instanceof Error ? err.message : 'Erro ao reenviar código OTP',
      );
    } finally {
      setOtpResend(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Step 3: Final Confirmation
  // ─────────────────────────────────────────────────────────────

  const handleConfirmDeletion = async () => {
    if (!confirmCheckbox) {
      setProcessError('Você deve confirmar que compreende que esta ação é irreversível');
      return;
    }

    if (!otpToken) {
      setProcessError('Token OTP inválido');
      return;
    }

    setCurrentStep('processing');
    setIsProcessing(true);
    setProcessError(null);

    try {
      const result = await deleteTitularData({
        cpf,
        otp,
        otpToken,
        motivo,
      });

      setDeletedDocCount(result.deletedDocCount);
      setCurrentStep('success');

      // Auto-logout after 3 seconds
      setTimeout(() => {
        // Sign out user
        window.location.href = '/';
      }, 3000);
    } catch (err) {
      setProcessError(
        err instanceof Error ? err.message : 'Erro ao processar exclusão',
      );
      setCurrentStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Render: Step 1 — CPF Input
  // ─────────────────────────────────────────────────────────────

  if (currentStep === 'cpf-input') {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Solicitar Exclusão de Dados</h1>
            <p className="text-white/60 text-sm">
              LGPD Art. 18 — Direito do Titular à Exclusão
            </p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Warning */}
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-sm text-red-200">
                ⚠ Esta ação é irreversível. Seus dados pessoais serão permanentemente
                deletados.
              </p>
            </div>

            {/* CPF Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">CPF</label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-500"
              />
              {cpf && !isValidCPF(cpf) && (
                <p className="text-xs text-red-400">CPF inválido</p>
              )}
            </div>

            {/* Reason Dropdown */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo da Exclusão</label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-violet-500"
              >
                <option value="Exclusão solicitada pelo titular">
                  Exclusão solicitada pelo titular
                </option>
                <option value="Fim da relação contratual">
                  Fim da relação contratual
                </option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            {/* Error */}
            {processError && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                ✗ {processError}
              </div>
            )}

            {/* Next Button */}
            <button
              onClick={handleSendOTP}
              disabled={!isValidCPF(cpf) || otpSending}
              className="w-full px-4 py-3 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              {otpSending ? 'Enviando código...' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Render: Step 2 — OTP Verification
  // ─────────────────────────────────────────────────────────────

  if (currentStep === 'otp-verification') {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Verificar Email</h1>
            <p className="text-white/60 text-sm">
              Enviamos um código de 6 dígitos para {otpEmail}
            </p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* OTP Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Código OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-violet-500 text-center text-2xl tracking-widest"
              />
            </div>

            {/* Resend */}
            <div className="text-center">
              {otpCountdown > 0 ? (
                <p className="text-sm text-white/60">
                  Reenviar código em {otpCountdown}s
                </p>
              ) : (
                <button
                  onClick={handleResendOTP}
                  disabled={otpResend}
                  className="text-sm text-violet-400 hover:text-violet-300 disabled:opacity-50"
                >
                  {otpResend ? 'Enviando...' : 'Reenviar código'}
                </button>
              )}
            </div>

            {/* Error */}
            {processError && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                ✗ {processError}
              </div>
            )}

            {/* Next Button */}
            <button
              onClick={handleVerifyOTP}
              disabled={otp.length !== 6}
              className="w-full px-4 py-3 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
            >
              Verificar código
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Render: Step 3 — Final Confirmation
  // ─────────────────────────────────────────────────────────────

  if (currentStep === 'final-confirmation') {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Confirmar Exclusão</h1>
            <p className="text-white/60 text-sm">Última chance para cancelar esta ação</p>
          </div>

          {/* Form */}
          <div className="space-y-6">
            {/* Warning Box */}
            <div className="p-4 border-l-4 border-red-500 bg-red-500/10 rounded">
              <p className="font-semibold text-red-200 mb-2">Aviso de Irreversibilidade</p>
              <ul className="text-sm text-red-100 space-y-1">
                <li>• Seus dados pessoais serão permanentemente deletados</li>
                <li>• Esta ação não pode ser desfeita</li>
                <li>• Você poderá perder acesso a serviços relacionados</li>
              </ul>
            </div>

            {/* Confirmation Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer p-4 bg-white/5 rounded-lg border border-white/10">
              <input
                type="checkbox"
                checked={confirmCheckbox}
                onChange={(e) => setConfirmCheckbox(e.target.checked)}
                className="w-5 h-5 mt-1 rounded bg-white/10 border border-white/20 cursor-pointer accent-violet-500"
              />
              <span className="text-sm leading-relaxed">
                Entendo que esta ação é irreversível e não posso ser revertida
              </span>
            </label>

            {/* Error */}
            {processError && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                ✗ {processError}
              </div>
            )}

            {/* Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleConfirmDeletion}
                disabled={!confirmCheckbox || isProcessing}
                className="w-full px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
              >
                {isProcessing ? 'Processando...' : 'Confirmar Exclusão'}
              </button>
              <button
                onClick={() => setCurrentStep('cpf-input')}
                className="w-full px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Render: Step 4 — Processing
  // ─────────────────────────────────────────────────────────────

  if (currentStep === 'processing') {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="animate-spin">
              <svg className="w-12 h-12 text-violet-500" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                <path
                  d="M22 12a10 10 0 00-10-10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
          <p className="text-lg font-medium">Processando sua solicitação...</p>
          <p className="text-white/60">Por favor, aguarde enquanto seus dados são deletados</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Render: Step 5 — Success
  // ─────────────────────────────────────────────────────────────

  if (currentStep === 'success') {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-8">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Solicitação Concluída</h1>
            <p className="text-white/60">
              Seus dados pessoais foram deletados com sucesso. Total de registros afetados:{' '}
              <span className="text-emerald-400 font-semibold">{deletedDocCount}</span>
            </p>
          </div>

          {/* Auto-logout message */}
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <p className="text-sm text-white/60">
              Você será desconectado em alguns segundos...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Render: Error state
  // ─────────────────────────────────────────────────────────────

  if (currentStep === 'error') {
    return (
      <div className="min-h-screen bg-[#141417] text-white/90 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-8">
          {/* Error Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Erro no Processamento</h1>
            <p className="text-white/60">{processError || 'Erro desconhecido'}</p>
          </div>

          {/* Retry Button */}
          <button
            onClick={() => {
              setCurrentStep('final-confirmation');
              setProcessError(null);
            }}
            className="w-full px-4 py-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default ExclusaoTitularFlow;
