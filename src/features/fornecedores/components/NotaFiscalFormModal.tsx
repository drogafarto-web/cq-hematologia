/**
 * NotaFiscalFormModal — cadastro de uma nota fiscal de entrada.
 *
 * Inclui picker de fornecedor (busca por CNPJ/nome) com atalho
 * "+ Cadastrar novo fornecedor" que abre o FornecedorFormModal inline e
 * retorna com o fornecedor recém-criado já selecionado.
 */

import React, { useMemo, useRef, useState } from 'react';
import { useUser } from '../../../store/useAuthStore';
import { Timestamp } from '../../../shared/services/firebase';
import { useFornecedores } from '../hooks/useFornecedores';
import {
  createNotaFiscal,
} from '../services/notaFiscalService';
import {
  createFornecedor,
  findFornecedorByCnpj,
} from '../services/fornecedorService';
import { FornecedorFormModal } from './FornecedorFormModal';
import type { Fornecedor } from '../types/Fornecedor';
import { formatCnpj, normalizeCnpj } from '../types/Fornecedor';
import { parseDanfeXml, joinEndereco } from '../utils/parseDanfeXml';

const INPUT_CLS = `
  w-full px-3.5 py-2.5 rounded-xl
  bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.09]
  text-slate-900 dark:text-white/90 placeholder-slate-400 dark:placeholder-white/20 text-sm
  focus:outline-none focus:border-violet-500/50 focus:bg-white dark:focus:bg-white/[0.08]
  disabled:opacity-40 transition-all
`.trim();

interface NotaFiscalFormModalProps {
  labId: string;
  onClose: () => void;
  /** Chamado com o ID da nota recém-criada — caller pode pré-selecionar. */
  onCreated?: (notaId: string) => void;
}

export function NotaFiscalFormModal({
  labId,
  onClose,
  onCreated,
}: NotaFiscalFormModalProps) {
  const user = useUser();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [fornecedorId, setFornecedorId] = useState<string | null>(null);
  const [fornecedorSearch, setFornecedorSearch] = useState('');
  const [showNovoFornecedor, setShowNovoFornecedor] = useState(false);

  const [numero, setNumero] = useState('');
  const [serie, setSerie] = useState('1');
  const [chaveAcesso, setChaveAcesso] = useState('');
  const [dataEmissao, setDataEmissao] = useState(todayIso);
  const [dataRecebimento, setDataRecebimento] = useState(todayIso);
  const [valorTotal, setValorTotal] = useState<number | ''>('');
  const [observacoes, setObservacoes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [xmlImporting, setXmlImporting] = useState(false);
  const [xmlInfo, setXmlInfo] = useState<string | null>(null);
  const xmlInputRef = useRef<HTMLInputElement | null>(null);

  const filters = useMemo(
    () => ({ ativo: true, query: fornecedorSearch.trim() || undefined }),
    [fornecedorSearch],
  );
  const { fornecedores, isLoading: loadingFornecedores } = useFornecedores(filters);

  const fornecedorSelecionado: Fornecedor | null = useMemo(
    () => fornecedores.find((f) => f.id === fornecedorId) ?? null,
    [fornecedores, fornecedorId],
  );

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!fornecedorId) e.fornecedorId = 'Selecione o fornecedor.';
    if (!numero.trim()) e.numero = 'Informe o número da nota.';
    if (!dataEmissao) e.dataEmissao = 'Informe a data de emissão.';
    if (!dataRecebimento) e.dataRecebimento = 'Informe a data de recebimento.';
    if (dataEmissao && dataRecebimento) {
      const emi = new Date(`${dataEmissao}T00:00:00`).getTime();
      const rec = new Date(`${dataRecebimento}T00:00:00`).getTime();
      if (rec < emi) {
        e.dataRecebimento = 'Recebimento não pode ser anterior à emissão.';
      }
    }
    if (chaveAcesso.trim() && chaveAcesso.replace(/\D/g, '').length !== 44) {
      e.chaveAcesso = 'Chave de acesso precisa ter 44 dígitos.';
    }
    if (typeof valorTotal === 'number' && valorTotal < 0) {
      e.valorTotal = 'Valor não pode ser negativo.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleXmlImport(file: File) {
    if (!user) {
      setSubmitError('Usuário não autenticado.');
      return;
    }
    setXmlImporting(true);
    setXmlInfo(null);
    setSubmitError(null);
    try {
      const text = await file.text();
      const parsed = parseDanfeXml(text);

      // Fornecedor: dedup por CNPJ. Se já existe, só seleciona; se não, cria
      // um cadastro novo com os dados ricos da NFe.
      const cnpjRaw = parsed.emitente.cnpj;
      if (cnpjRaw) {
        const cnpj = normalizeCnpj(cnpjRaw);
        let existing = await findFornecedorByCnpj(labId, cnpj);
        if (!existing && parsed.emitente.razaoSocial) {
          try {
            const { id } = await createFornecedor(labId, {
              razaoSocial: parsed.emitente.razaoSocial,
              nomeFantasia: parsed.emitente.nomeFantasia,
              cnpj,
              inscricaoEstadual: parsed.emitente.inscricaoEstadual,
              telefone: parsed.emitente.telefone,
              email: parsed.emitente.email,
              endereco: joinEndereco(parsed.emitente.endereco),
              createdBy: user.uid,
            });
            existing = { id } as Fornecedor;
          } catch (err) {
            // createFornecedor pode falhar se CNPJ da NFe for inválido.
            // Não interrompe o fluxo — operador pode cadastrar manualmente.
            setSubmitError(
              'CNPJ do emitente rejeitado — confira o XML ou cadastre manualmente. ' +
                (err instanceof Error ? err.message : ''),
            );
          }
        }
        if (existing) setFornecedorId(existing.id);
      }

      // Dados da nota
      if (parsed.nota.numero) setNumero(parsed.nota.numero);
      if (parsed.nota.serie) setSerie(parsed.nota.serie);
      if (parsed.nota.chaveAcesso) setChaveAcesso(parsed.nota.chaveAcesso);
      if (parsed.nota.dataEmissao) {
        setDataEmissao(parsed.nota.dataEmissao.toISOString().slice(0, 10));
      }
      if (typeof parsed.nota.valorTotal === 'number') {
        setValorTotal(parsed.nota.valorTotal);
      }

      setXmlInfo(
        `XML importado. Campos preenchidos — revise antes de salvar.` +
          (parsed.itens.length > 0 ? ` ${parsed.itens.length} item(ns) detectado(s).` : ''),
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Falha ao importar XML.');
    } finally {
      setXmlImporting(false);
      // limpa o input pra permitir reimportar o mesmo arquivo
      if (xmlInputRef.current) xmlInputRef.current.value = '';
    }
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    if (!user) {
      setSubmitError('Usuário não autenticado.');
      return;
    }
    if (!fornecedorId) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const id = await createNotaFiscal(labId, {
        fornecedorId,
        numero: numero.trim(),
        ...(serie.trim() && { serie: serie.trim() }),
        ...(chaveAcesso.trim() && { chaveAcesso: chaveAcesso.replace(/\D/g, '') }),
        dataEmissao: Timestamp.fromDate(new Date(`${dataEmissao}T00:00:00`)),
        dataRecebimento: Timestamp.fromDate(new Date(`${dataRecebimento}T00:00:00`)),
        ...(typeof valorTotal === 'number' && { valorTotal }),
        ...(observacoes.trim() && { observacoes: observacoes.trim() }),
        createdBy: user.uid,
      });
      onCreated?.(id);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao cadastrar nota.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="presentation"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="nota-modal-title"
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[#0F1318] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl"
        >
          <div className="px-6 py-5 border-b border-slate-200 dark:border-white/[0.06] flex items-center justify-between sticky top-0 bg-white dark:bg-[#0F1318] z-10">
            <div>
              <h2
                id="nota-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-white/90"
              >
                Nova nota fiscal
              </h2>
              <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
                Documento de entrada — rastreia a origem fiscal dos lotes.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-white/40 dark:hover:text-white/80 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Atalho: importar XML da NFe */}
            <div className="rounded-xl bg-violet-500/[0.04] border border-violet-500/20 p-3 flex items-start gap-3">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-violet-600 dark:text-violet-400 shrink-0 mt-0.5"
                aria-hidden
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M12 18v-6M9 15l3-3 3 3" />
              </svg>
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-800 dark:text-white/80">
                  Importar do XML da NFe
                </p>
                <p className="text-[11px] text-slate-500 dark:text-white/45 mt-0.5 leading-relaxed">
                  Arraste o XML ou clique pra selecionar. Fornecedor é cadastrado automaticamente
                  se o CNPJ for novo — senão, reaproveita o existente. Você revisa tudo antes de salvar.
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => xmlInputRef.current?.click()}
                    disabled={xmlImporting}
                    className="px-3 h-8 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 text-white text-xs font-medium transition-all"
                  >
                    {xmlImporting ? 'Processando…' : 'Selecionar XML'}
                  </button>
                  <input
                    ref={xmlInputRef}
                    type="file"
                    accept=".xml,application/xml,text/xml"
                    aria-label="Arquivo XML da NFe"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleXmlImport(f);
                    }}
                  />
                  <span className="text-[11px] text-slate-400 dark:text-white/30">
                    ou preencha manualmente abaixo
                  </span>
                </div>
                {xmlInfo && (
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-2">
                    {xmlInfo}
                  </p>
                )}
              </div>
            </div>

            {/* Fornecedor */}
            <div>
              <label
                htmlFor="fornecedor-search"
                className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
              >
                Fornecedor <span className="text-red-500 dark:text-red-400/70 ml-0.5">*</span>
              </label>

              {fornecedorSelecionado ? (
                <div className="rounded-xl bg-violet-500/5 border border-violet-500/30 p-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white/90 truncate">
                      {fornecedorSelecionado.nomeFantasia ?? fornecedorSelecionado.razaoSocial}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-white/45 mt-0.5">
                      {fornecedorSelecionado.razaoSocial}
                      {' · '}
                      CNPJ {formatCnpj(fornecedorSelecionado.cnpj)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFornecedorId(null)}
                    className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline whitespace-nowrap"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    id="fornecedor-search"
                    className={INPUT_CLS}
                    value={fornecedorSearch}
                    onChange={(e) => setFornecedorSearch(e.target.value)}
                    placeholder="Buscar por razão social, nome fantasia ou CNPJ…"
                    autoComplete="off"
                  />
                  <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] max-h-52 overflow-y-auto">
                    {loadingFornecedores ? (
                      <p className="p-3 text-xs text-slate-500 dark:text-white/40">
                        Carregando…
                      </p>
                    ) : fornecedores.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 dark:text-white/40 flex items-center justify-between gap-3">
                        <span>
                          {fornecedorSearch.trim()
                            ? 'Nenhum fornecedor encontrado com este filtro.'
                            : 'Nenhum fornecedor cadastrado.'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowNovoFornecedor(true)}
                          className="text-violet-600 dark:text-violet-400 font-medium hover:underline whitespace-nowrap"
                        >
                          + Cadastrar novo
                        </button>
                      </div>
                    ) : (
                      <ul>
                        {fornecedores.slice(0, 20).map((f) => (
                          <li key={f.id}>
                            <button
                              type="button"
                              onClick={() => setFornecedorId(f.id)}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/[0.03] border-b border-slate-100 dark:border-white/[0.04] last:border-b-0 transition-colors"
                            >
                              <p className="text-xs font-medium text-slate-800 dark:text-white/80 truncate">
                                {f.nomeFantasia ?? f.razaoSocial}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-white/40 truncate">
                                {f.razaoSocial} · {formatCnpj(f.cnpj)}
                              </p>
                            </button>
                          </li>
                        ))}
                        <li>
                          <button
                            type="button"
                            onClick={() => setShowNovoFornecedor(true)}
                            className="w-full text-left px-3 py-2 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-500/[0.05] transition-colors"
                          >
                            + Cadastrar novo fornecedor
                          </button>
                        </li>
                      </ul>
                    )}
                  </div>
                </div>
              )}
              {errors.fornecedorId && (
                <p className="text-xs text-red-500 dark:text-red-400/80 mt-1 ml-0.5">
                  {errors.fornecedorId}
                </p>
              )}
            </div>

            {/* Dados da nota */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="numero"
                  className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
                >
                  Número da nota <span className="text-red-500 dark:text-red-400/70 ml-0.5">*</span>
                </label>
                <input
                  id="numero"
                  className={INPUT_CLS}
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="ex: 12345"
                  autoComplete="off"
                />
                {errors.numero && (
                  <p className="text-xs text-red-500 mt-1">{errors.numero}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="serie"
                  className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
                >
                  Série
                </label>
                <input
                  id="serie"
                  className={INPUT_CLS}
                  value={serie}
                  onChange={(e) => setSerie(e.target.value)}
                  placeholder="1"
                  autoComplete="off"
                />
              </div>

              <div>
                <label
                  htmlFor="dataEmissaoNF"
                  className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
                >
                  Data de emissão <span className="text-red-500 dark:text-red-400/70 ml-0.5">*</span>
                </label>
                <input
                  id="dataEmissaoNF"
                  aria-label="Data de emissão da nota"
                  type="date"
                  max={todayIso}
                  className={INPUT_CLS}
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                />
                {errors.dataEmissao && (
                  <p className="text-xs text-red-500 mt-1">{errors.dataEmissao}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="dataRecebimentoNF"
                  className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
                >
                  Data de recebimento <span className="text-red-500 dark:text-red-400/70 ml-0.5">*</span>
                </label>
                <input
                  id="dataRecebimentoNF"
                  aria-label="Data de recebimento no lab"
                  type="date"
                  max={todayIso}
                  className={INPUT_CLS}
                  value={dataRecebimento}
                  onChange={(e) => setDataRecebimento(e.target.value)}
                />
                {errors.dataRecebimento && (
                  <p className="text-xs text-red-500 mt-1">{errors.dataRecebimento}</p>
                )}
              </div>

              <div className="col-span-2">
                <label
                  htmlFor="chaveAcesso"
                  className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
                >
                  Chave de acesso (NFe)
                  <span className="text-slate-400 dark:text-white/25 font-normal ml-1">
                    44 dígitos · opcional
                  </span>
                </label>
                <input
                  id="chaveAcesso"
                  className={`${INPUT_CLS} font-mono tracking-tight`}
                  value={chaveAcesso}
                  onChange={(e) => setChaveAcesso(e.target.value)}
                  placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
                  autoComplete="off"
                  inputMode="numeric"
                />
                {errors.chaveAcesso && (
                  <p className="text-xs text-red-500 mt-1">{errors.chaveAcesso}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="valorTotal"
                  className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
                >
                  Valor total (R$)
                </label>
                <input
                  id="valorTotal"
                  type="number"
                  step="0.01"
                  min={0}
                  className={INPUT_CLS}
                  value={valorTotal === '' ? '' : valorTotal}
                  onChange={(e) => {
                    const v = e.target.value;
                    setValorTotal(v === '' ? '' : Number(v));
                  }}
                  placeholder="0,00"
                />
                {errors.valorTotal && (
                  <p className="text-xs text-red-500 mt-1">{errors.valorTotal}</p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="nf-observacoes"
                className="block text-xs font-medium text-slate-500 dark:text-white/45 mb-1.5 ml-0.5"
              >
                Observações
              </label>
              <textarea
                id="nf-observacoes"
                className={INPUT_CLS}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="ex: entrega parcial, itens pendentes, etc."
                rows={2}
              />
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700 dark:text-red-300">
                {submitError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 h-10 rounded-xl text-sm font-medium text-slate-600 dark:text-white/55 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 h-10 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-600/50 text-white text-sm font-medium"
              >
                {submitting ? 'Salvando…' : 'Cadastrar nota'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showNovoFornecedor && (
        <FornecedorFormModal
          labId={labId}
          onClose={() => setShowNovoFornecedor(false)}
          onCreated={(id) => {
            setFornecedorId(id);
            setShowNovoFornecedor(false);
          }}
        />
      )}
    </>
  );
}
