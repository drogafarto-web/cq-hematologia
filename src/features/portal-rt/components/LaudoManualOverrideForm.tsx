/**
 * LaudoManualOverrideForm — Manual entry fallback for OCR field extraction
 *
 * Allows RT/director to manually enter fields 10–12 when OCR fails or results
 * are ambiguous. Includes reason tracking and approval workflow.
 *
 * RDC 978 Art. 167 compliance: maintains audit trail + source attribution.
 */

import React, { useState } from 'react';
// Input type for manual override callable
type SaveLaudoFieldsManuallyInput = {
  labId: string;
  laudoId: string;
  field10Text: string;
  field11CapturedBy?: string;
  field11Notes?: string;
  field12CapturedBy?: string;
  field12Notes?: string;
  field12Date?: string;
};

interface LaudoManualOverrideFormProps {
  // Lab and laudo identifiers
  labId: string;
  laudoId: string;

  // Current user info
  userId: string;
  userRole: 'RT' | 'director' | 'admin';

  // Optional: pre-fill form with OCR results (for correction)
  initialField10?: string;
  initialField11Notes?: string;
  initialField12Notes?: string;
  initialField12Date?: string;

  // Callback when form is submitted
  onSubmit: (input: SaveLaudoFieldsManuallyInput) => Promise<void>;

  // Callback on cancel
  onCancel?: () => void;

  // Optional: show reason/justification field
  showReasonField?: boolean;

  // Loading state (while submitting)
  isLoading?: boolean;
}

/**
 * TextAreaField — labeled textarea with character count
 */
const TextAreaField: React.FC<{
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  required?: boolean;
  hint?: string;
}> = ({ label, placeholder, value, onChange, maxLength = 1000, required, hint }) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-900 dark:text-white">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
      />
      <div className="flex items-center justify-between">
        {hint && <p className="text-xs text-gray-600 dark:text-gray-400">{hint}</p>}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {value.length} / {maxLength}
        </p>
      </div>
    </div>
  );
};

/**
 * DateInputField — date picker with ISO format handling
 */
const DateInputField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}> = ({ label, value, onChange, hint }) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-900 dark:text-white">{label}</label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
      />
      {hint && <p className="text-xs text-gray-600 dark:text-gray-400">{hint}</p>}
    </div>
  );
};

/**
 * CheckboxField — toggle for optional fields
 */
const CheckboxField: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}> = ({ label, checked, onChange, hint }) => {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-blue-600"
        />
        <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
      </label>
      {hint && <p className="text-xs text-gray-600 dark:text-gray-400 ml-7">{hint}</p>}
    </div>
  );
};

/**
 * Main Form Component
 */
export const LaudoManualOverrideForm: React.FC<LaudoManualOverrideFormProps> = ({
  labId,
  laudoId,
  userId,
  userRole,
  initialField10,
  initialField11Notes,
  initialField12Notes,
  initialField12Date,
  onSubmit,
  onCancel,
  showReasonField = true,
  isLoading = false,
}) => {
  // Form state
  const [field10Text, setField10Text] = useState(initialField10 || '');
  const [field11Captured, setField11Captured] = useState(false);
  const [field11Notes, setField11Notes] = useState(initialField11Notes || '');
  const [field12Captured, setField12Captured] = useState(false);
  const [field12Notes, setField12Notes] = useState(initialField12Notes || '');
  const [field12Date, setField12Date] = useState(initialField12Date || '');
  const [overrideReason, setOverrideReason] = useState('');
  const [agreeToOverride, setAgreeToOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate field10 (required)
    if (!field10Text.trim()) {
      setError('Campo 10 (Observações) é obrigatório');
      return;
    }

    // Validate override reason if showing
    if (showReasonField && !overrideReason.trim()) {
      setError('Por favor, forneça um motivo para a entrada manual');
      return;
    }

    // Validate confirmation checkbox
    if (!agreeToOverride) {
      setError('Você deve confirmar que revisa e aprova esta entrada manual');
      return;
    }

    try {
      const input: SaveLaudoFieldsManuallyInput = {
        labId,
        laudoId,
        field10Text: field10Text.trim(),
        field11CapturedBy: field11Captured ? userId : undefined,
        field11Notes: field11Captured ? field11Notes : undefined,
        field12CapturedBy: field12Captured ? userId : undefined,
        field12Notes: field12Captured ? field12Notes : undefined,
        field12Date: field12Captured ? field12Date : undefined,
      };

      await onSubmit(input);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao salvar entrada manual. Tente novamente.',
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-2xl">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Entrada Manual de Campos — Laudo {laudoId}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Preencha os campos abaixo se a extração automática falhou ou precisa de correção. Campo 10
          (Observações) é obrigatório.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Field 10 — Observações (Required) */}
      <TextAreaField
        label="Campo 10 — Observações (Texto livre)"
        placeholder="Digite ou copie o texto da seção de observações do laudo..."
        value={field10Text}
        onChange={setField10Text}
        maxLength={2000}
        required
        hint="Seção obrigatória (RDC 978 Art. 167)"
      />

      {/* Field 11 — RT Signature (Optional) */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-gray-900 dark:text-white">
          Campo 11 — Assinatura/Carimbo do RT
        </h3>

        <CheckboxField
          label="Assinatura/carimbo do RT foi capturada ou verificada"
          checked={field11Captured}
          onChange={setField11Captured}
          hint="Marque se a assinatura do Responsável Técnico foi localizada e capturada no laudo"
        />

        {field11Captured && (
          <TextAreaField
            label="Notas sobre a assinatura/carimbo do RT"
            placeholder="Ex: Assinatura clara no canto inferior esquerdo..."
            value={field11Notes}
            onChange={setField11Notes}
            maxLength={500}
            hint="Descrição breve da localização e condição da assinatura"
          />
        )}
      </div>

      {/* Field 12 — Director Signature + Date (Optional) */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-gray-900 dark:text-white">
          Campo 12 — Assinatura/Carimbo do Diretor + Data
        </h3>

        <CheckboxField
          label="Assinatura/carimbo do Diretor foi capturada ou verificada"
          checked={field12Captured}
          onChange={setField12Captured}
          hint="Marque se a assinatura do Diretor foi localizada no laudo"
        />

        {field12Captured && (
          <>
            <TextAreaField
              label="Notas sobre a assinatura/carimbo do Diretor"
              placeholder="Ex: Assinatura legível com carimbo em tinta preta..."
              value={field12Notes}
              onChange={setField12Notes}
              maxLength={500}
            />

            <DateInputField
              label="Data do laudo (extraída da assinatura ou documento)"
              value={field12Date}
              onChange={setField12Date}
              hint="Formato: YYYY-MM-DD"
            />
          </>
        )}
      </div>

      {/* Override Reason (if enabled) */}
      {showReasonField && (
        <TextAreaField
          label="Motivo da entrada manual"
          placeholder="Ex: Extração automática não detectou assinaturas. Informações capturadas manualmente após revisão visual."
          value={overrideReason}
          onChange={setOverrideReason}
          maxLength={500}
          required
          hint="Explique por que a entrada manual foi necessária (obrigatório para auditoria)"
        />
      )}

      {/* Confirmation Checkbox */}
      <CheckboxField
        label="Confirmo que revisei e aprovo esta entrada manual (RDC 978 Art. 167)"
        checked={agreeToOverride}
        onChange={setAgreeToOverride}
        hint={`Como ${userRole}, você é responsável pelas informações inseridas. Esta ação será auditada.`}
      />

      {/* Footer Buttons */}
      <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="submit"
          disabled={isLoading || !agreeToOverride || !field10Text.trim()}
          className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition ${
            isLoading || !agreeToOverride || !field10Text.trim()
              ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800'
          }`}
        >
          {isLoading ? 'Salvando...' : 'Salvar Entrada Manual'}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium text-sm transition disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default LaudoManualOverrideForm;
