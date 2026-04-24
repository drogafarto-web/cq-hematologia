import { useState } from 'react';

import { useActiveLabId } from '../../../store/useAuthStore';
import {
  importarXlsxBatch,
  type ImportResultado,
} from '../services/ctFirebaseService';
import {
  downloadCtTemplate,
  parseImportXlsx,
  type ImportParseResult,
} from '../services/ctXlsxService';
import {
  AlertTriangleIcon,
  CheckIcon,
  DownloadIcon,
  XIcon,
} from './_icons';
import { Button, Modal, StatusBadge } from './_shared';

export interface CTImportXlsxProps {
  open: boolean;
  onClose: () => void;
  onImported?: (result: ImportResultado) => void;
}

/**
 * Import em massa via XLSX (RN-10). 2-fase:
 *   1. parse client-side — valida linha por linha, sem escrita.
 *   2. user confirma → writeBatch atômico (equipamentos + termômetros +
 *      previsões de 7 dias).
 *
 * Sem confirmar, nenhum byte vai pro Firestore.
 */
export function CTImportXlsx({ open, onClose, onImported }: CTImportXlsxProps) {
  const labId = useActiveLabId();
  const [parse, setParse] = useState<ImportParseResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ImportResultado | null>(null);
  const [erroGlobal, setErroGlobal] = useState<string | null>(null);

  async function handleFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setFileName(file.name);
    setParsing(true);
    setErroGlobal(null);
    setResultado(null);
    try {
      const result = await parseImportXlsx(file);
      setParse(result);
    } catch (e) {
      setErroGlobal(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirm() {
    if (!labId || !parse) return;
    setImportando(true);
    setErroGlobal(null);
    try {
      const r = await importarXlsxBatch(labId, parse.termometros, parse.equipamentos);
      setResultado(r);
      onImported?.(r);
    } catch (e) {
      setErroGlobal(e instanceof Error ? e.message : String(e));
    } finally {
      setImportando(false);
    }
  }

  function reset() {
    setParse(null);
    setFileName(null);
    setResultado(null);
    setErroGlobal(null);
  }

  const canConfirm =
    parse !== null &&
    parse.erros.length === 0 &&
    (parse.termometros.length > 0 || parse.equipamentos.length > 0);

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Importar equipamentos via XLSX"
      subtitle="Download do modelo → preencher → validar → confirmar"
      maxWidthClass="max-w-2xl"
      footer={
        resultado ? (
          <Button
            className="flex-1"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Fechar
          </Button>
        ) : (
          <>
            <Button
              tone="secondary"
              onClick={() => {
                reset();
                onClose();
              }}
              className="flex-1"
              disabled={importando}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={!canConfirm || importando}
            >
              {importando
                ? 'Importando...'
                : parse
                  ? `Confirmar (${parse.termometros.length} termômetros, ${parse.equipamentos.length} equipamentos)`
                  : 'Aguardando arquivo'}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        {!resultado ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="font-semibold text-slate-800">1. Baixe o modelo</p>
                <p className="text-xs text-slate-500">
                  3 abas: Equipamentos, Termômetros, Instruções. Não renomear abas.
                </p>
              </div>
              <Button tone="secondary" onClick={downloadCtTemplate}>
                <span className="inline-flex items-center gap-2">
                  <DownloadIcon size={16} /> Baixar modelo
                </span>
              </Button>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <p className="mb-2 font-semibold text-slate-800">2. Anexe o XLSX preenchido</p>
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-label="Selecione o arquivo XLSX preenchido"
                title="Selecione o XLSX"
                onChange={(e) => handleFile(e.target.files)}
                className="w-full text-sm"
              />
              {fileName ? (
                <p className="mt-2 text-xs text-slate-500">
                  Arquivo: <span className="font-mono">{fileName}</span>
                </p>
              ) : null}
            </div>

            {parsing ? (
              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                Validando linhas...
              </div>
            ) : null}

            {parse ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <StatusBadge tone="success">
                    <span className="inline-flex items-center gap-1">
                      <CheckIcon size={14} /> {parse.termometros.length} termômetros válidos
                    </span>
                  </StatusBadge>
                  <StatusBadge tone="success">
                    <span className="inline-flex items-center gap-1">
                      <CheckIcon size={14} /> {parse.equipamentos.length} equipamentos válidos
                    </span>
                  </StatusBadge>
                  {parse.erros.length > 0 ? (
                    <StatusBadge tone="danger">
                      <span className="inline-flex items-center gap-1">
                        <XIcon size={14} /> {parse.erros.length} erro(s)
                      </span>
                    </StatusBadge>
                  ) : null}
                  {parse.warnings.length > 0 ? (
                    <StatusBadge tone="warning">
                      <span className="inline-flex items-center gap-1">
                        <AlertTriangleIcon size={14} /> {parse.warnings.length} aviso(s)
                      </span>
                    </StatusBadge>
                  ) : null}
                </div>

                {parse.erros.length > 0 ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                    <p className="mb-2 font-semibold">Erros — corrija e tente novamente:</p>
                    <ul className="ml-4 list-disc space-y-1">
                      {parse.erros.slice(0, 15).map((e, i) => (
                        <li key={i}>
                          <span className="font-mono text-xs">{e.aba} L{e.linha}</span> — {e.mensagem}
                        </li>
                      ))}
                      {parse.erros.length > 15 ? (
                        <li className="text-xs text-rose-600">
                          +{parse.erros.length - 15} erros adicionais…
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}

                {parse.warnings.length > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <p className="mb-2 font-semibold">Avisos:</p>
                    <ul className="ml-4 list-disc space-y-1">
                      {parse.warnings.map((w, i) => (
                        <li key={i}>
                          <span className="font-mono text-xs">{w.aba} L{w.linha}</span> — {w.mensagem}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {resultado ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="mb-2 flex items-center gap-2 font-bold">
              <CheckIcon size={18} /> Importação concluída
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>{resultado.termometrosCriados} termômetros criados</li>
              <li>{resultado.equipamentosCriados} equipamentos criados</li>
              <li>{resultado.previstasGeradas} previsões de leitura geradas para 7 dias</li>
            </ul>
            <p className="mt-3 text-xs text-emerald-700">
              Próximo passo: anexar PDFs dos certificados em Configurações → Termômetros.
            </p>
          </div>
        ) : null}

        {erroGlobal ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {erroGlobal}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
