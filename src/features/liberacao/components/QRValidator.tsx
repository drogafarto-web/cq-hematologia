/**
 * QRValidator — public validation surface (paste URL → see metadata).
 *
 * Displays the badge + key metadata for a laudo without exposing PII.
 * Backed by the `validarLaudoPublico` HTTPS endpoint via fetch.
 *
 * Use cases:
 *  - Auditor verifying a printed laudo's authenticity
 *  - RT confirming a laudo's hash matches what was issued
 *  - Patient checking that the document is genuine
 */
import React, { useCallback, useState } from 'react';

interface ValidationResponse {
  valid: boolean;
  hash: string;
  hashPrefix: string;
  version: number;
  isCurrent: boolean;
  supersededBy: string | null;
  rt: { name: string; registro: string };
  lab: { name: string; cnes: string };
  emissaoEm: string | null;
  criadoEm: string | null;
}

type ValidationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: ValidationResponse }
  | { status: 'not_found' }
  | { status: 'error'; message: string };

function parseUrl(input: string): { laudoId: string; version: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Accept full URL or path-only
  const match = trimmed.match(/validar-laudo\/([^/?]+)\/v(\d+)/);
  if (!match) return null;
  return { laudoId: decodeURIComponent(match[1]), version: Number(match[2]) };
}

interface QRValidatorProps {
  /** Optional pre-filled URL (e.g., from query param when this is the validation page itself). */
  initialUrl?: string;
  /** Optional override for the API base (staging/dev). */
  apiBase?: string;
}

export function QRValidator({ initialUrl = '', apiBase = '' }: QRValidatorProps) {
  const [url, setUrl] = useState(initialUrl);
  const [state, setState] = useState<ValidationState>({ status: 'idle' });

  const validate = useCallback(
    async (rawUrl: string) => {
      const parsed = parseUrl(rawUrl);
      if (!parsed) {
        setState({
          status: 'error',
          message: 'URL inválida. Cole o link completo do QR.',
        });
        return;
      }

      setState({ status: 'loading' });
      try {
        const endpoint = `${apiBase}/api/validar-laudo/${encodeURIComponent(parsed.laudoId)}/v${parsed.version}`;
        const res = await fetch(endpoint, {
          headers: { Accept: 'application/json' },
        });

        if (res.status === 404) {
          setState({ status: 'not_found' });
          return;
        }
        if (res.status === 429) {
          setState({
            status: 'error',
            message: 'Muitas tentativas. Tente novamente em alguns minutos.',
          });
          return;
        }
        if (!res.ok) {
          setState({ status: 'error', message: `Erro ${res.status}` });
          return;
        }

        const data = (await res.json()) as ValidationResponse;
        setState({ status: 'success', data });
      } catch (err) {
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Erro de rede',
        });
      }
    },
    [apiBase],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void validate(url);
  };

  return (
    <div className="mx-auto w-full max-w-xl rounded-xl border border-white/10 bg-[#141417] p-6 text-white">
      <header className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Validar laudo</h2>
        <p className="mt-1 text-sm text-white/60">
          Cole a URL do QR para confirmar a autenticidade do laudo. Nenhum dado clínico do paciente
          é exibido.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hmatologia2.web.app/api/validar-laudo/…/v1"
          className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-violet-500"
        />
        <button
          type="submit"
          disabled={state.status === 'loading'}
          className="self-start rounded-md bg-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-400 disabled:opacity-60"
        >
          {state.status === 'loading' ? 'Validando…' : 'Validar'}
        </button>
      </form>

      <div className="mt-5">
        {state.status === 'success' && <ValidationResult data={state.data} />}
        {state.status === 'not_found' && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Laudo não encontrado. Verifique o link e tente novamente.
          </div>
        )}
        {state.status === 'error' && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {state.message}
          </div>
        )}
      </div>
    </div>
  );
}

function ValidationResult({ data }: { data: ValidationResponse }) {
  const badge = data.isCurrent ? (
    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-emerald-300">
      Vigente
    </span>
  ) : (
    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-amber-300">
      Superado
    </span>
  );

  return (
    <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-emerald-200">Laudo válido</span>
        {badge}
      </div>

      {!data.isCurrent && data.supersededBy && (
        <p className="mb-3 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-100">
          Existe versão mais recente: {data.supersededBy}
        </p>
      )}

      <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-[13px] text-white/85">
        <dt className="text-xs uppercase tracking-wider text-white/50">Laboratório</dt>
        <dd>{data.lab.name}</dd>
        <dt className="text-xs uppercase tracking-wider text-white/50">CNES</dt>
        <dd className="tabular-nums">{data.lab.cnes}</dd>
        <dt className="text-xs uppercase tracking-wider text-white/50">Versão</dt>
        <dd className="tabular-nums">{data.version}</dd>
        <dt className="text-xs uppercase tracking-wider text-white/50">RT</dt>
        <dd>{data.rt.name}</dd>
        <dt className="text-xs uppercase tracking-wider text-white/50">Registro</dt>
        <dd>{data.rt.registro}</dd>
        <dt className="text-xs uppercase tracking-wider text-white/50">Emissão</dt>
        <dd className="tabular-nums">
          {data.emissaoEm ? new Date(data.emissaoEm).toLocaleString('pt-BR') : '—'}
        </dd>
        <dt className="text-xs uppercase tracking-wider text-white/50">Hash</dt>
        <dd className="break-all font-mono text-[11px] text-white/70">{data.hash}</dd>
      </dl>
    </div>
  );
}

export default QRValidator;
