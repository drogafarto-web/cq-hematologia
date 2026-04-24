import { useRef, useState } from 'react';

import {
  getDownloadURL,
  ref as storageRef,
  storage,
  Timestamp,
  uploadBytesResumable,
} from '../../../shared/services/firebase';
import { useActiveLabId } from '../../../store/useAuthStore';
import { useSaveCalibracao } from '../hooks/useSaveCalibracao';
import type {
  CertificadoCalibracao,
  CertificadoCalibracaoInput,
  Termometro,
} from '../types/ControlTemperatura';
import { Button, Field, Modal, TextInput } from './_shared';

export interface CertificadoCalibracaoModalProps {
  open: boolean;
  onClose: () => void;
  termometro: Termometro;
  /** 'renovar' abre form de nova versão; 'historico' só lista versões anteriores. */
  mode: 'renovar' | 'historico';
}

function toDateInput(ts: Timestamp | null | undefined): string {
  if (!ts) return '';
  return ts.toDate().toISOString().slice(0, 10);
}

function formatDate(ts: Timestamp | undefined): string {
  if (!ts) return '—';
  return ts.toDate().toLocaleDateString('pt-BR');
}

/**
 * Renovação de calibração (RN-09): arquiva anterior + cria nova versão em
 * transaction atômica. PDF do certificado é opcional — pode ser anexado
 * pós-criação via Storage.
 */
export function CertificadoCalibracaoModal({
  open,
  onClose,
  termometro,
  mode,
}: CertificadoCalibracaoModalProps) {
  const labId = useActiveLabId();
  const { registrar, atualizarUrl, isSaving } = useSaveCalibracao();
  const fileRef = useRef<HTMLInputElement>(null);

  const [dataEmissao, setDataEmissao] = useState('');
  const [dataValidade, setDataValidade] = useState('');
  const [numeroCertificado, setNumeroCertificado] = useState('');
  const [laboratorioCalibrador, setLaboratorioCalibrador] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function handleRenovar() {
    setErro(null);
    if (!labId) return;
    if (!dataEmissao || !dataValidade) return setErro('Datas obrigatórias.');
    const emissao = Timestamp.fromDate(new Date(`${dataEmissao}T00:00:00`));
    const validade = Timestamp.fromDate(new Date(`${dataValidade}T00:00:00`));
    if (validade.toMillis() <= emissao.toMillis()) {
      return setErro('Validade deve ser posterior à emissão.');
    }
    if (!numeroCertificado.trim() || !laboratorioCalibrador.trim()) {
      return setErro('Número do certificado e laboratório obrigatórios.');
    }

    const input: CertificadoCalibracaoInput = {
      dataEmissao: emissao,
      dataValidade: validade,
      numeroCertificado: numeroCertificado.trim(),
      laboratorioCalibrador: laboratorioCalibrador.trim(),
    };

    try {
      const novaVersao = await registrar(termometro.id, input);

      if (pdfFile) {
        const path = `labs/${labId}/controle-temperatura/calibracoes/${termometro.id}-v${novaVersao}.pdf`;
        const fileRefStorage = storageRef(storage, path);
        const task = uploadBytesResumable(fileRefStorage, pdfFile, {
          contentType: 'application/pdf',
        });
        await new Promise<void>((resolve, reject) => {
          task.on(
            'state_changed',
            (snap) => setUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            (err) => reject(err),
            () => resolve(),
          );
        });
        const url = await getDownloadURL(fileRefStorage);
        await atualizarUrl(termometro.id, url);
      }

      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadPct(null);
    }
  }

  if (mode === 'historico') {
    const versoes: CertificadoCalibracao[] = [...termometro.historicoCalibracoes].sort(
      (a, b) => b.versao - a.versao,
    );
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Histórico de calibrações"
        subtitle={`${termometro.numeroSerie} — ${termometro.modelo}`}
        maxWidthClass="max-w-2xl"
        footer={<Button onClick={onClose} className="flex-1">Fechar</Button>}
      >
        <p className="mb-4 text-sm text-slate-500">
          Histórico imutável — requisito ISO 15189:2022 cl. 5.3.1. Nenhuma
          versão pode ser deletada.
        </p>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Versão</th>
                <th className="px-3 py-2 text-left">Período</th>
                <th className="px-3 py-2 text-left">Nº Certificado</th>
                <th className="px-3 py-2 text-left">Lab calibrador</th>
                <th className="px-3 py-2 text-left">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {versoes.map((v) => (
                <tr key={v.versao}>
                  <td className="px-3 py-2 font-semibold text-slate-800">v{v.versao}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {formatDate(v.dataEmissao)} → {formatDate(v.dataValidade)}
                    {v.arquivadoEm ? (
                      <span className="ml-1 text-xs text-slate-400">(arquivada {formatDate(v.arquivadoEm)})</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{v.numeroCertificado}</td>
                  <td className="px-3 py-2 text-slate-600">{v.laboratorioCalibrador}</td>
                  <td className="px-3 py-2">
                    {v.certificadoUrl ? (
                      <a
                        href={v.certificadoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline"
                      >
                        Ver PDF
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">sem anexo</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Renovar calibração"
      subtitle={`${termometro.numeroSerie} — nova versão encadeada (RN-09)`}
      maxWidthClass="max-w-lg"
      footer={
        <>
          <Button tone="secondary" onClick={onClose} disabled={isSaving} className="flex-1">
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleRenovar} disabled={isSaving}>
            {isSaving
              ? uploadPct !== null
                ? `Enviando PDF ${uploadPct}%...`
                : 'Arquivando anterior...'
              : 'Registrar nova versão'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <strong>Versão atual:</strong> v{termometro.calibracaoAtual.versao} •
          válida até {formatDate(termometro.calibracaoAtual.dataValidade)} •
          certificado {termometro.calibracaoAtual.numeroCertificado}. Será arquivada
          automaticamente ao salvar.
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Data de emissão">
            <TextInput
              type="date"
              value={dataEmissao}
              onChange={(e) => setDataEmissao(e.target.value)}
            />
          </Field>
          <Field label="Validade">
            <TextInput
              type="date"
              value={dataValidade}
              onChange={(e) => setDataValidade(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Nº do certificado">
          <TextInput
            value={numeroCertificado}
            onChange={(e) => setNumeroCertificado(e.target.value)}
            placeholder="CERT-2026-TM0012"
          />
        </Field>
        <Field label="Laboratório calibrador">
          <TextInput
            value={laboratorioCalibrador}
            onChange={(e) => setLaboratorioCalibrador(e.target.value)}
            placeholder="LabMetro SP"
          />
        </Field>
        <Field label="Certificado (PDF)" hint="Opcional — pode anexar depois.">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            aria-label="Upload do certificado PDF"
            title="Selecione o PDF do certificado"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </Field>
        {toDateInput(termometro.calibracaoAtual.dataValidade) ? null : null}
        {erro ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {erro}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
