/**
 * ImportarLM01Modal — bulk import Drive → SGQ.
 *
 * MVP: cola TSV (tab-separated) da Lista Mestra LM-01 do Labclin no textarea,
 * preview parsed em tabela, confirma → bulkCreateDocumentos.
 *
 * Formato TSV esperado (1 linha por documento, tab-separated):
 *
 *   codigo  titulo  url  versao  dataEmissao  proximaRevisao  autoridadeEmitente  listaDistribuicao?
 *
 * Tipo é derivado do prefixo do código:
 *   MQ-001  → MQ          PQ-01   → PQ          IT-001 → IT
 *   FR-001  → FR          POL-001 → POL         DC-001 → DC
 *   LM-01   → LM          (qualquer outro prefixo) → EXT (Documento Externo)
 *
 * Datas em ISO YYYY-MM-DD ou DD/MM/YYYY (parser aceita ambos).
 *
 * Coluna 8 (opcional) — `listaDistribuicao`: setores separados por `|`
 * (pipe). Ex: `Matriz|Mercês|Tabuleiro` ou `Hematologia|Imuno|Bioquímica`.
 * Vazio = sem controle de distribuição.
 *
 * LM-02 (Documentos Externos): cole entradas como
 *   RDC-786-2023  ANVISA · Laboratório Clínico  https://anvisa.gov.br/...  ...
 * O parser não acha prefixo nas tipos canônicos, faz fallback pra EXT.
 *
 * Status inicial = `em_revisao`. RT valida e promove pra `vigente` via UI.
 *
 * Why TSV: copy/paste direto da LM-01/LM-02 (Google Sheets) sem conversão.
 * Operador seleciona linhas, copia, cola aqui.
 */

import { useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useUser } from '../../../store/useAuthStore';
import { useActiveLabId } from '../../../store/useAuthStore';
import { bulkCreateDocumentos } from '../services/documentoService';
import type { DocumentoInput, TipoDocumento } from '../types/Documento';

interface Props {
  onClose: () => void;
  onDone?: (result: { created: number; skipped: number }) => void;
}

interface ParsedRow {
  codigo: string;
  tipo: TipoDocumento | null;
  titulo: string;
  url: string;
  versao: number;
  dataEmissao: Date | null;
  proximaRevisao: Date | null;
  autoridadeEmitente: string;
  listaDistribuicao: string[];
  errors: string[];
}

const VALID_TIPOS: TipoDocumento[] = ['MQ', 'PQ', 'IT', 'FR', 'POL', 'DC', 'LM', 'EXT'];

/**
 * Deriva o tipo a partir do prefixo do código. Códigos com prefixo canônico
 * (MQ/PQ/IT/FR/POL/DC/LM/EXT) recebem aquele tipo. Qualquer outro prefixo
 * (RDC-, ABNT-, FISPQ-, ISO-, etc) faz fallback pra `EXT` — DICQ trata
 * todo doc não-emitido pelo lab como Documento Externo.
 *
 * Retorna null APENAS quando o código não tem formato `PREFIXO-NUMERO`
 * (sinal de linha malformada).
 */
function deriveTipo(codigo: string): TipoDocumento | null {
  const match = codigo.trim().match(/^([A-Z]+)-/);
  if (!match) return null;
  const prefix = match[1];
  if (VALID_TIPOS.includes(prefix as TipoDocumento)) {
    return prefix as TipoDocumento;
  }
  // Prefixo não-canônico → trata como Documento Externo. Cobre LM-02
  // (RDC-786, ABNT-NBR-15189, FISPQ-001, ISO-15189, etc.)
  return 'EXT';
}

function parseListaDistribuicao(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  // Aceita pipe (|) como separador primário; vírgula como fallback.
  const sep = raw.includes('|') ? '|' : ',';
  return raw
    .split(sep)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  // DD/MM/YYYY
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}`);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseTSV(raw: string): ParsedRow[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const cols = line.split('\t').map((c) => c.trim());
      const [
        codigo = '',
        titulo = '',
        url = '',
        versaoRaw = '1',
        dataEmissaoRaw = '',
        proximaRevisaoRaw = '',
        autoridadeEmitente = '',
        listaDistribuicaoRaw = '',
      ] = cols;

      const tipo = deriveTipo(codigo);
      const versao = Number(versaoRaw) || 1;
      const dataEmissao = parseDate(dataEmissaoRaw);
      const proximaRevisao = parseDate(proximaRevisaoRaw);
      const listaDistribuicao = parseListaDistribuicao(listaDistribuicaoRaw);

      const errors: string[] = [];
      if (!codigo) errors.push('código vazio');
      if (!tipo) errors.push(`código "${codigo}" não tem formato PREFIXO-NUMERO`);
      if (!titulo) errors.push('título vazio');
      if (!url) errors.push('url vazia');
      if (!dataEmissao) errors.push('dataEmissao inválida');
      if (!proximaRevisao) errors.push('proximaRevisao inválida');
      if (!autoridadeEmitente) errors.push('autoridadeEmitente vazia');

      return {
        codigo,
        tipo,
        titulo,
        url,
        versao,
        dataEmissao,
        proximaRevisao,
        autoridadeEmitente,
        listaDistribuicao,
        errors,
      };
    });
}

const PLACEHOLDER = `# Cole linhas da LM-01 / LM-02 (1 por documento, tab-separated):
# código→título→url→versão→dataEmissão→próximaRevisão→autoridadeEmitente→listaDistribuicão
#
# LM-01 (docs próprios — PQ/IT/FR/MQ/POL/DC/LM):
PQ-01\tElaboração de Documentos\thttps://drive.google.com/file/d/.../view\t1\t2024-06-26\t2025-06-26\tBruno de Andrade Pires CRF-MG 13.809\tMatriz|Mercês|Tabuleiro
IT-005\tInstruções de Coleta\thttps://drive.google.com/file/d/.../view\t2\t2024-06-26\t2025-06-26\tBruno de Andrade Pires\tColeta|Recepção
#
# LM-02 (docs externos — RDC/ABNT/FISPQ/ISO viram tipo EXT automaticamente):
RDC-786-2023\tBoas Práticas em Laboratório Clínico\thttps://anvisa.gov.br/...\t1\t2023-05-01\t2028-05-01\tANVISA\t
ABNT-NBR-15189\tLaboratórios clínicos — Requisitos\thttps://abnt.org.br/...\t1\t2015-09-01\t2025-09-01\tABNT\t`;

const TEXTAREA_CLS = `
  w-full px-3 py-2 rounded-lg text-xs font-mono
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/25
  focus:outline-none focus:border-violet-500/50
  disabled:opacity-40 transition-all
`.trim();

const PRIMARY = `
  px-4 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600
  text-white text-sm font-semibold transition-all
  disabled:opacity-50 disabled:cursor-not-allowed
`.trim();

const GHOST = `
  px-4 h-10 rounded-xl text-sm font-medium
  text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/[0.05]
  transition-all
`.trim();

export function ImportarLM01Modal({ onClose, onDone }: Props) {
  const user = useUser();
  const labId = useActiveLabId();
  const [raw, setRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  const parsed = useMemo(() => parseTSV(raw), [raw]);
  const validRows = parsed.filter((r) => r.errors.length === 0);
  const invalidRows = parsed.filter((r) => r.errors.length > 0);

  async function handleConfirm() {
    if (!user || !labId || validRows.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const items = validRows.map((r) => ({
        input: {
          codigo: r.codigo,
          tipo: r.tipo as TipoDocumento,
          titulo: r.titulo,
          url: r.url,
          autoridadeEmitente: r.autoridadeEmitente,
          dataEmissao: Timestamp.fromDate(r.dataEmissao as Date),
          dataRevisao: Timestamp.fromDate(r.dataEmissao as Date),
          proximaRevisao: Timestamp.fromDate(r.proximaRevisao as Date),
          status: 'em_revisao',
          ...(r.listaDistribuicao.length > 0 && {
            listaDistribuicao: r.listaDistribuicao,
          }),
        } as DocumentoInput,
      }));

      const res = await bulkCreateDocumentos({
        labId,
        items,
        operator: {
          uid: user.uid,
          name: user.displayName ?? user.email ?? 'Operador',
        },
      });

      setResult({ created: res.created.length, skipped: res.skipped.length });
      onDone?.({ created: res.created.length, skipped: res.skipped.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="importar-lm01-title"
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.06]">
          <h2
            id="importar-lm01-title"
            className="text-sm font-semibold text-slate-900 dark:text-white/90"
          >
            Importar Lista Mestra → SGQ (TSV)
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-white/45 mt-0.5">
            LM-01 (docs próprios) + LM-02 (docs externos · RDC/ABNT/FISPQ). Status inicial será "em
            revisão" — RT promove para vigente após validar.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {result ? (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 space-y-2">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                Importação concluída
              </p>
              <ul className="text-xs text-emerald-700/80 dark:text-emerald-300/80 space-y-1">
                <li>· {result.created} documento(s) criado(s)</li>
                <li>· {result.skipped} pulado(s) (já existiam ou erro)</li>
              </ul>
              <p className="text-[11px] text-emerald-700/60 dark:text-emerald-300/60 pt-2">
                Próximo passo: revisar cada doc na lista e promover pra "vigente".
              </p>
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="lm01-tsv"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-white/55 mb-1.5"
                >
                  TSV (uma linha por documento)
                </label>
                <textarea
                  id="lm01-tsv"
                  className={TEXTAREA_CLS}
                  rows={10}
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder={PLACEHOLDER}
                  disabled={submitting}
                />
                <p className="text-[10px] text-slate-400 dark:text-white/35 mt-1">
                  Formato:{' '}
                  <code>
                    código → título → url → versão → dataEmissão (YYYY-MM-DD ou DD/MM/YYYY) →
                    próximaRevisão → autoridadeEmitente
                  </code>
                </p>
              </div>

              {parsed.length > 0 && (
                <div className="rounded-lg border border-slate-200 dark:border-white/[0.07] overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/[0.07] flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-white/70">
                      Preview · {validRows.length} válida(s) · {invalidRows.length} inválida(s)
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {parsed.map((r, i) => (
                      <div
                        key={i}
                        className={`px-3 py-2 text-[11px] ${
                          r.errors.length > 0 ? 'bg-red-500/[0.04]' : 'bg-emerald-500/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-700 dark:text-white/75">
                            {r.codigo || '(sem código)'}
                          </span>
                          <span className="text-slate-500 dark:text-white/45 truncate flex-1">
                            {r.titulo}
                          </span>
                          {r.listaDistribuicao.length > 0 && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-mono text-[10px]"
                              title={`Distribuído em: ${r.listaDistribuicao.join(', ')}`}
                            >
                              {r.listaDistribuicao.length} setor(es)
                            </span>
                          )}
                          {r.tipo && (
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
                                r.tipo === 'EXT'
                                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                  : 'bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-white/45'
                              }`}
                            >
                              {r.tipo}
                            </span>
                          )}
                        </div>
                        {r.errors.length > 0 && (
                          <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">
                            {r.errors.join(' · ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg p-3 bg-red-500/10 border border-red-500/30 text-[12px] text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100 dark:border-white/[0.06]">
          <button type="button" className={GHOST} onClick={onClose} disabled={submitting}>
            {result ? 'Fechar' : 'Cancelar'}
          </button>
          {!result && (
            <button
              type="button"
              className={PRIMARY}
              onClick={handleConfirm}
              disabled={submitting || validRows.length === 0}
            >
              {submitting ? 'Importando…' : `Importar ${validRows.length} documento(s)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
