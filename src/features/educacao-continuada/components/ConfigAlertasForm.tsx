import { useEffect, useState, type FormEvent } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  getCertificadoConfig,
  getConfigAlerta,
  saveCertificadoConfig,
  saveConfigAlerta,
} from '../services/ecFirebaseService';
import type {
  CertificadoConfigInput,
  ConfiguracaoAlertaInput,
} from '../types/EducacaoContinuada';

import { Field, inputClass } from './_formPrimitives';

export interface ConfigAlertasFormProps {
  onClose: () => void;
}

interface FormState {
  diasAntecedencia: string;
  emailResponsavel: boolean;
  emailColaborador: boolean;
  horaEnvio: string;
  emailsCopiaRaw: string;
  // Certificado config
  nomeDoLab: string;
  logoUrl: string;
  assinaturaUrl: string;
  textoRodape: string;
}

/**
 * Configuração unificada de alertas por email + certificado (Fase 9). Ambos
 * singletons por lab. Escrita direta via service (não exige callable — são
 * admin configs, não-regulatórios).
 */
export function ConfigAlertasForm({ onClose }: ConfigAlertasFormProps) {
  const labId = useActiveLabId();
  const [state, setState] = useState<FormState>({
    diasAntecedencia: '30',
    emailResponsavel: true,
    emailColaborador: false,
    horaEnvio: '08:00',
    emailsCopiaRaw: '',
    nomeDoLab: '',
    logoUrl: '',
    assinaturaUrl: '',
    textoRodape:
      'Este certificado comprova a participação e aprovação no treinamento indicado, conforme RDC 978/2025 e ISO 15189:2022.',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!labId) return;
    void (async () => {
      const [alertaCfg, certCfg] = await Promise.all([
        getConfigAlerta(labId),
        getCertificadoConfig(labId),
      ]);
      setState((prev) => ({
        ...prev,
        diasAntecedencia: String(alertaCfg?.diasAntecedenciaVencimento ?? 30),
        emailResponsavel: alertaCfg?.emailResponsavel ?? true,
        emailColaborador: alertaCfg?.emailColaborador ?? false,
        horaEnvio: alertaCfg?.horaEnvio ?? '08:00',
        emailsCopiaRaw: (alertaCfg?.emailsCopia ?? []).join(', '),
        nomeDoLab: certCfg?.nomeDoLab ?? '',
        logoUrl: certCfg?.logoUrl ?? '',
        assinaturaUrl: certCfg?.assinaturaResponsavelUrl ?? '',
        textoRodape: certCfg?.textoRodape ?? prev.textoRodape,
      }));
      setIsLoading(false);
    })();
  }, [labId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErr(null);
    setSuccess(false);
    if (!labId) {
      setErr('Sem lab ativo.');
      return;
    }
    const dias = Number(state.diasAntecedencia);
    if (!Number.isInteger(dias) || dias < 0 || dias > 365) {
      setErr('Dias de antecedência deve ser um inteiro entre 0 e 365.');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(state.horaEnvio)) {
      setErr('Hora de envio inválida (formato HH:mm).');
      return;
    }

    const emailsCopia = state.emailsCopiaRaw
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && /@/.test(e));

    const alertaInput: ConfiguracaoAlertaInput = {
      diasAntecedenciaVencimento: dias,
      emailResponsavel: state.emailResponsavel,
      emailColaborador: state.emailColaborador,
      horaEnvio: state.horaEnvio,
      emailsCopia,
    };

    const certInput: CertificadoConfigInput = {
      nomeDoLab: state.nomeDoLab.trim(),
      logoUrl: state.logoUrl.trim() || undefined,
      assinaturaResponsavelUrl: state.assinaturaUrl.trim() || undefined,
      textoRodape: state.textoRodape.trim(),
    };

    setIsSaving(true);
    try {
      await Promise.all([
        saveConfigAlerta(labId, alertaInput),
        saveCertificadoConfig(labId, certInput),
      ]);
      setSuccess(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar configuração.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-4">
        <header className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-lg font-semibold text-slate-100">Configurações</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            ✕
          </button>
        </header>
        <div className="h-32 animate-pulse rounded border border-slate-800 bg-slate-900/40" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 className="text-lg font-semibold text-slate-100">Configurações</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          ✕
        </button>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <section className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold text-slate-200">Alertas por email</h3>
          <p className="text-xs text-slate-500">
            Executado diariamente às {state.horaEnvio} no fuso São Paulo via scheduled
            Cloud Function. Usa Resend para envio.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Field id="cfg-dias" label="Dias de antecedência">
              <input
                id="cfg-dias"
                type="number"
                min="0"
                max="365"
                value={state.diasAntecedencia}
                onChange={(e) => setState((p) => ({ ...p, diasAntecedencia: e.target.value }))}
                disabled={isSaving}
                aria-label="Dias de antecedência"
                className={inputClass(false)}
              />
            </Field>
            <Field id="cfg-hora" label="Hora de envio (SP)">
              <input
                id="cfg-hora"
                type="time"
                value={state.horaEnvio}
                onChange={(e) => setState((p) => ({ ...p, horaEnvio: e.target.value }))}
                disabled={isSaving}
                aria-label="Hora de envio"
                className={inputClass(false)}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={state.emailResponsavel}
              onChange={(e) => setState((p) => ({ ...p, emailResponsavel: e.target.checked }))}
              disabled={isSaving}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500"
            />
            Enviar email ao responsável
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={state.emailColaborador}
              onChange={(e) => setState((p) => ({ ...p, emailColaborador: e.target.checked }))}
              disabled={isSaving}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500"
            />
            Enviar email ao colaborador (requer lista de emails configurada)
          </label>

          <Field id="cfg-emails" label="Emails de cópia (separados por vírgula)">
            <input
              id="cfg-emails"
              type="text"
              value={state.emailsCopiaRaw}
              onChange={(e) => setState((p) => ({ ...p, emailsCopiaRaw: e.target.value }))}
              disabled={isSaving}
              placeholder="responsavel@lab.com, copia@lab.com"
              aria-label="Emails de cópia"
              className={inputClass(false)}
            />
          </Field>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold text-slate-200">Certificado</h3>

          <Field id="cfg-nome-lab" label="Nome do lab (exibido no PDF)">
            <input
              id="cfg-nome-lab"
              type="text"
              value={state.nomeDoLab}
              onChange={(e) => setState((p) => ({ ...p, nomeDoLab: e.target.value }))}
              disabled={isSaving}
              placeholder="Laboratório de Análises Clínicas XYZ"
              aria-label="Nome do lab"
              className={inputClass(false)}
            />
          </Field>

          <Field id="cfg-logo" label="URL do logo (opcional)">
            <input
              id="cfg-logo"
              type="url"
              value={state.logoUrl}
              onChange={(e) => setState((p) => ({ ...p, logoUrl: e.target.value }))}
              disabled={isSaving}
              aria-label="URL do logo"
              className={inputClass(false)}
            />
          </Field>

          <Field id="cfg-assinatura" label="URL da assinatura do responsável (opcional)">
            <input
              id="cfg-assinatura"
              type="url"
              value={state.assinaturaUrl}
              onChange={(e) => setState((p) => ({ ...p, assinaturaUrl: e.target.value }))}
              disabled={isSaving}
              aria-label="URL da assinatura"
              className={inputClass(false)}
            />
          </Field>

          <Field id="cfg-rodape" label="Texto do rodapé">
            <textarea
              id="cfg-rodape"
              value={state.textoRodape}
              onChange={(e) => setState((p) => ({ ...p, textoRodape: e.target.value }))}
              disabled={isSaving}
              rows={3}
              aria-label="Texto do rodapé"
              className={inputClass(false)}
            />
          </Field>
        </section>

        {err && (
          <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {err}
          </p>
        )}
        {success && (
          <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            Configuração salva com sucesso.
          </p>
        )}

        <footer className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            Fechar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {isSaving ? 'Salvando…' : 'Salvar'}
          </button>
        </footer>
      </form>
    </div>
  );
}
