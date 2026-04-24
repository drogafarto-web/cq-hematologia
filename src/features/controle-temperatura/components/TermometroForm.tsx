import { useMemo, useState } from 'react';

import { Timestamp } from '../../../shared/services/firebase';
import { useTermometros } from '../hooks/useTermometros';
import type { Termometro, TermometroInput } from '../types/ControlTemperatura';
import { Button, Field, Modal, SectionHeader, StatusBadge, TextInput } from './_shared';

function toInputDate(ts: Timestamp | Date | null | undefined): string {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : ts.toDate();
  return d.toISOString().slice(0, 10);
}

function diasAte(ts: Timestamp): number {
  return Math.round((ts.toMillis() - Date.now()) / (24 * 60 * 60 * 1000));
}

export function TermometroForm({
  open,
  onClose,
  termometro,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  termometro?: Termometro;
  onSubmit: (input: TermometroInput) => Promise<unknown>;
}) {
  const [numeroSerie, setNumeroSerie] = useState(termometro?.numeroSerie ?? '');
  const [modelo, setModelo] = useState(termometro?.modelo ?? '');
  const [fabricante, setFabricante] = useState(termometro?.fabricante ?? '');
  const [incerteza, setIncerteza] = useState(String(termometro?.incertezaMedicao ?? '0.5'));
  const [dataUlt, setDataUlt] = useState(toInputDate(termometro?.dataUltimaCalibracao));
  const [prox, setProx] = useState(toInputDate(termometro?.proximaCalibracao));
  const [certificadoUrl, setCertificadoUrl] = useState(termometro?.certificadoUrl ?? '');
  const [ativo, setAtivo] = useState(termometro?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit() {
    setErro(null);
    if (!numeroSerie.trim()) return setErro('Número de série obrigatório.');
    if (!dataUlt || !prox) return setErro('Datas de calibração obrigatórias.');
    const dUlt = Timestamp.fromDate(new Date(`${dataUlt}T00:00:00`));
    const dProx = Timestamp.fromDate(new Date(`${prox}T00:00:00`));
    if (dProx.toMillis() <= dUlt.toMillis()) {
      return setErro('Próxima calibração deve ser posterior à última.');
    }
    try {
      setSalvando(true);
      await onSubmit({
        numeroSerie: numeroSerie.trim(),
        modelo: modelo.trim(),
        fabricante: fabricante.trim(),
        incertezaMedicao: Number(incerteza),
        dataUltimaCalibracao: dUlt,
        proximaCalibracao: dProx,
        certificadoUrl: certificadoUrl.trim() || undefined,
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
      title={termometro ? 'Editar termômetro' : 'Novo termômetro'}
      subtitle="Cadastro + calibração rastreável"
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
          <Field label="Última calibração">
            <TextInput type="date" value={dataUlt} onChange={(e) => setDataUlt(e.target.value)} />
          </Field>
          <Field label="Próxima calibração">
            <TextInput type="date" value={prox} onChange={(e) => setProx(e.target.value)} />
          </Field>
        </div>
        <Field label="URL do certificado" hint="Opcional — upload via Storage integrado na v2">
          <TextInput
            value={certificadoUrl}
            onChange={(e) => setCertificadoUrl(e.target.value)}
            placeholder="https://..."
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Termômetro ativo
        </label>
        {erro ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {erro}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export function TermometrosList() {
  const { termometros, proximosAVencer, isLoading, create, update } = useTermometros();
  const [editando, setEditando] = useState<Termometro | 'novo' | null>(null);

  const vencendoIds = useMemo(() => new Set(proximosAVencer.map((t) => t.id)), [proximosAVencer]);

  if (isLoading) return <div className="p-6 text-sm text-slate-500">Carregando termômetros...</div>;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Termômetros"
        subtitle="Cadastro + calibração (alerta automático ≤ 30 dias)"
        actions={<Button onClick={() => setEditando('novo')}>+ Novo termômetro</Button>}
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Série</th>
              <th className="px-4 py-3">Modelo</th>
              <th className="px-4 py-3">Incerteza</th>
              <th className="px-4 py-3">Última calib.</th>
              <th className="px-4 py-3">Próxima calib.</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {termometros.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500">
                  Nenhum termômetro cadastrado.
                </td>
              </tr>
            ) : null}
            {termometros.map((t) => {
              const dias = diasAte(t.proximaCalibracao);
              const vence = vencendoIds.has(t.id);
              return (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{t.numeroSerie}</td>
                  <td className="px-4 py-3 text-slate-600">{t.modelo}</td>
                  <td className="px-4 py-3 text-slate-600">± {t.incertezaMedicao}°C</td>
                  <td className="px-4 py-3 text-slate-600">
                    {t.dataUltimaCalibracao.toDate().toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={vence ? 'font-semibold text-amber-700' : 'text-slate-600'}>
                      {t.proximaCalibracao.toDate().toLocaleDateString('pt-BR')}{' '}
                      <span className="text-xs">({dias}d)</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {!t.ativo ? (
                      <StatusBadge tone="neutral">Inativo</StatusBadge>
                    ) : vence ? (
                      <StatusBadge tone="warning">Vence em breve</StatusBadge>
                    ) : (
                      <StatusBadge tone="success">OK</StatusBadge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button tone="ghost" onClick={() => setEditando(t)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
          onSubmit={(input) => update(editando.id, input)}
        />
      ) : null}
    </div>
  );
}
