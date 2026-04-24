import { useMemo, useState } from 'react';

import { Timestamp } from '../../../shared/services/firebase';
import { useTermometros, type TermometroComStatus } from '../hooks/useTermometros';
import type {
  CertificadoCalibracaoInput,
  Termometro,
  TermometroInput,
} from '../types/ControlTemperatura';
import { CertificadoCalibracaoModal } from './CertificadoCalibracaoModal';
import { Button, Field, Modal, SectionHeader, StatusBadge, TextInput } from './_shared';

function toInputDate(ts: Timestamp | Date | null | undefined): string {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : ts.toDate();
  return d.toISOString().slice(0, 10);
}

function diasAte(ts: Timestamp): number {
  return Math.round((ts.toMillis() - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Form de criação / edição de termômetro. Calibração inicial é preenchida
 * junto com a criação. Renovação de calibração (RN-09) vive em
 * `CertificadoCalibracaoModal` — NÃO é editada aqui.
 */
export function TermometroForm({
  open,
  onClose,
  termometro,
  onSubmit,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  termometro?: Termometro;
  onSubmit?: (input: TermometroInput) => Promise<unknown>;
  onUpdate?: (patch: Partial<Omit<TermometroInput, 'calibracaoAtual'>>) => Promise<unknown>;
}) {
  const isEdit = Boolean(termometro);
  const [numeroSerie, setNumeroSerie] = useState(termometro?.numeroSerie ?? '');
  const [modelo, setModelo] = useState(termometro?.modelo ?? '');
  const [fabricante, setFabricante] = useState(termometro?.fabricante ?? '');
  const [incerteza, setIncerteza] = useState(String(termometro?.incertezaMedicao ?? '0.5'));
  const [ativo, setAtivo] = useState(termometro?.ativo ?? true);

  // Calibração inicial — só usada no modo criação.
  const [dataEmissao, setDataEmissao] = useState('');
  const [dataValidade, setDataValidade] = useState('');
  const [numeroCertificado, setNumeroCertificado] = useState('');
  const [lab, setLab] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit() {
    setErro(null);
    if (!numeroSerie.trim()) return setErro('Número de série obrigatório.');

    if (isEdit) {
      if (!onUpdate) return;
      try {
        setSalvando(true);
        await onUpdate({
          numeroSerie: numeroSerie.trim(),
          modelo: modelo.trim(),
          fabricante: fabricante.trim(),
          incertezaMedicao: Number(incerteza),
          ativo,
        });
        onClose();
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      } finally {
        setSalvando(false);
      }
      return;
    }

    if (!onSubmit) return;
    if (!dataEmissao || !dataValidade) return setErro('Datas da calibração inicial obrigatórias.');
    const emissao = Timestamp.fromDate(new Date(`${dataEmissao}T00:00:00`));
    const validade = Timestamp.fromDate(new Date(`${dataValidade}T00:00:00`));
    if (validade.toMillis() <= emissao.toMillis()) {
      return setErro('Validade deve ser posterior à emissão.');
    }
    if (!numeroCertificado.trim() || !lab.trim()) {
      return setErro('Nº do certificado e laboratório obrigatórios.');
    }

    const calibracaoAtual: CertificadoCalibracaoInput = {
      dataEmissao: emissao,
      dataValidade: validade,
      numeroCertificado: numeroCertificado.trim(),
      laboratorioCalibrador: lab.trim(),
    };
    try {
      setSalvando(true);
      await onSubmit({
        numeroSerie: numeroSerie.trim(),
        modelo: modelo.trim(),
        fabricante: fabricante.trim(),
        incertezaMedicao: Number(incerteza),
        calibracaoAtual,
        ativo,
      });
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar termômetro' : 'Novo termômetro'}
      subtitle={
        isEdit ? 'Para renovar a calibração, use o botão "Renovar"' : 'Cadastro + calibração inicial'
      }
      maxWidthClass="max-w-lg"
      footer={
        <>
          <Button tone="secondary" className="flex-1" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Número de série">
            <TextInput value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} />
          </Field>
          <Field label="Modelo">
            <TextInput value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </Field>
          <Field label="Fabricante">
            <TextInput value={fabricante} onChange={(e) => setFabricante(e.target.value)} />
          </Field>
          <Field label="Incerteza (± °C)">
            <TextInput
              type="number"
              step="0.1"
              value={incerteza}
              onChange={(e) => setIncerteza(e.target.value)}
            />
          </Field>
        </div>

        {!isEdit ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-3 text-sm font-bold text-slate-700">Calibração inicial (v1)</h4>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data emissão">
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
                placeholder="CERT-2026-TM0001"
              />
            </Field>
            <Field label="Laboratório calibrador">
              <TextInput
                value={lab}
                onChange={(e) => setLab(e.target.value)}
                placeholder="LabMetro SP"
              />
            </Field>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Termômetro ativo
        </label>

        {toInputDate(new Date()) && false ? null : null}

        {erro ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {erro}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

// ─── Lista completa de termômetros (Tab Configurações) ────────────────────────

export function TermometrosList() {
  const { termometros, isLoading, create, update } = useTermometros();
  const [editando, setEditando] = useState<TermometroComStatus | 'novo' | null>(null);
  const [calibracaoModal, setCalibracaoModal] = useState<{
    termometro: TermometroComStatus;
    mode: 'renovar' | 'historico';
  } | null>(null);

  const grouped = useMemo(() => termometros, [termometros]);

  if (isLoading) return <div className="p-6 text-sm text-slate-500">Carregando termômetros...</div>;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Termômetros"
        subtitle="Cadastro + calibrações encadeadas (RN-09). Histórico imutável — ISO 15189 cl. 5.3.1."
        actions={<Button onClick={() => setEditando('novo')}>+ Novo termômetro</Button>}
      />

      {grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Nenhum termômetro cadastrado. Use "Novo termômetro" ou import XLSX na aba Equipamentos.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {grouped.map((t) => {
            const cal = t.calibracaoAtual;
            const dias = diasAte(cal.dataValidade);
            const tone =
              t.statusCalibracao === 'vencido'
                ? 'danger'
                : t.statusCalibracao === 'vencendo'
                  ? 'warning'
                  : 'success';
            const label =
              t.statusCalibracao === 'vencido'
                ? 'Vencida'
                : t.statusCalibracao === 'vencendo'
                  ? `${dias} dias restantes`
                  : `${dias} dias restantes`;
            return (
              <div
                key={t.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-slate-800">
                      🌡️ {t.numeroSerie} — {t.modelo}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {t.fabricante} • Incerteza: ±{t.incertezaMedicao}°C
                    </p>
                  </div>
                  <StatusBadge tone={tone}>{label}</StatusBadge>
                </div>

                <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="text-slate-700">
                    <span className="font-semibold">Certificado vigente:</span>{' '}
                    <span className="font-mono">{cal.numeroCertificado}</span> (v{cal.versao})
                  </p>
                  <p className="text-slate-600">
                    Emitido por <strong>{cal.laboratorioCalibrador}</strong>
                  </p>
                  <p className="text-slate-600">
                    Validade: {cal.dataValidade.toDate().toLocaleDateString('pt-BR')}
                  </p>
                  {cal.certificadoUrl ? (
                    <a
                      href={cal.certificadoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-indigo-600 hover:underline"
                    >
                      📄 Ver PDF
                    </a>
                  ) : (
                    <span className="mt-2 inline-block text-xs text-amber-700">
                      ⚠️ PDF do certificado pendente de upload
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button tone="secondary" onClick={() => setEditando(t)}>
                    Editar
                  </Button>
                  <Button
                    onClick={() => setCalibracaoModal({ termometro: t, mode: 'renovar' })}
                  >
                    🔄 Renovar calibração
                  </Button>
                  <Button
                    tone="ghost"
                    onClick={() => setCalibracaoModal({ termometro: t, mode: 'historico' })}
                  >
                    Histórico ({t.historicoCalibracoes.length})
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editando === 'novo' ? (
        <TermometroForm
          open
          onClose={() => setEditando(null)}
          onSubmit={(input) => create(input)}
        />
      ) : null}
      {editando && editando !== 'novo' ? (
        <TermometroForm
          open
          onClose={() => setEditando(null)}
          termometro={editando}
          onUpdate={(patch) => update(editando.id, patch)}
        />
      ) : null}
      {calibracaoModal ? (
        <CertificadoCalibracaoModal
          open
          onClose={() => setCalibracaoModal(null)}
          termometro={calibracaoModal.termometro}
          mode={calibracaoModal.mode}
        />
      ) : null}
    </div>
  );
}
