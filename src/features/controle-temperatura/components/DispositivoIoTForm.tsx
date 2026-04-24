import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { useDispositivosIoT } from '../hooks/useDispositivosIoT';
import { useEquipamentos } from '../hooks/useEquipamentos';
import {
  gerarPayloadConfigESP32,
  gerarSnippetArduino,
  iotEndpointUrl,
} from '../services/ctIoTService';
import { WifiIcon, WifiOffIcon } from './_icons';
import {
  Button,
  Field,
  Modal,
  SectionHeader,
  Select,
  StatusBadge,
  TextInput,
} from './_shared';

const INTERVALOS = [5, 10, 15, 30, 60];

export function DispositivoIoTForm({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { equipamentos } = useEquipamentos({ status: 'ativo' });
  const { createComToken } = useDispositivosIoT();

  const [equipamentoId, setEquipamentoId] = useState(equipamentos[0]?.id ?? '');
  const [macAddress, setMacAddress] = useState('');
  const [modelo, setModelo] = useState('ESP32+DHT22');
  const [intervalo, setIntervalo] = useState(10);
  const [firmware, setFirmware] = useState('1.0.0');
  const [ativo, setAtivo] = useState(true);

  const [resultado, setResultado] = useState<{
    id: string;
    tokenPlain: string;
    equipamentoNome: string;
    intervaloMinutos: number;
  } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleCriar() {
    setErro(null);
    const eq = equipamentos.find((e) => e.id === equipamentoId);
    if (!eq) return setErro('Selecione um equipamento.');
    if (!macAddress.trim()) return setErro('MAC obrigatório.');
    try {
      setSalvando(true);
      const { id, token } = await createComToken({
        equipamentoId,
        macAddress: macAddress.trim().toUpperCase(),
        modelo: modelo.trim(),
        intervaloEnvioMinutos: intervalo,
        firmwareVersao: firmware.trim(),
        ativo,
      });
      setResultado({
        id,
        tokenPlain: token.plain,
        equipamentoNome: eq.nome,
        intervaloMinutos: intervalo,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setSalvando(false);
    }
  }

  if (resultado) {
    const qrPayload = gerarPayloadConfigESP32({
      token: resultado.tokenPlain,
      intervaloSegundos: resultado.intervaloMinutos * 60,
      equipamento: resultado.equipamentoNome,
    });
    const snippet = gerarSnippetArduino({
      token: resultado.tokenPlain,
      intervaloMinutos: resultado.intervaloMinutos,
      equipamentoNome: resultado.equipamentoNome,
    });
    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Dispositivo criado"
        subtitle="⚠️ Copie o token AGORA — ele não é recuperável depois."
        maxWidthClass="max-w-xl"
        footer={
          <Button className="flex-1" onClick={onClose}>
            Concluído — token anotado
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            O token plain-text é exibido uma única vez. Flashear no ESP32 imediatamente.
          </div>

          <Field label="Token do dispositivo (plain)">
            <div className="break-all rounded-lg bg-slate-900 p-3 font-mono text-xs text-emerald-300">
              {resultado.tokenPlain}
            </div>
          </Field>

          <Field label="Endpoint">
            <div className="break-all rounded-lg bg-slate-100 p-3 font-mono text-xs text-slate-700">
              {iotEndpointUrl()}
            </div>
          </Field>

          <Field label="QR Code — provisionar via app ESP32">
            <div className="flex flex-col items-center rounded-lg bg-white p-4">
              <QRCodeSVG value={qrPayload} size={200} includeMargin />
              <p className="mt-2 text-xs text-slate-500">
                O QR code embarca endpoint + token + intervalo. Credenciais WiFi devem ser
                configuradas separadamente no firmware.
              </p>
            </div>
          </Field>

          <Field
            label="Snippet Arduino/ESP32"
            hint="Substitua WIFI_SSID / WIFI_PASSWORD antes de flashear."
          >
            <textarea
              readOnly
              value={snippet}
              aria-label="Snippet Arduino ESP32"
              title="Snippet Arduino ESP32 — copie para a IDE antes de flashear"
              className="h-48 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-800"
            />
          </Field>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo dispositivo IoT"
      subtitle="ESP32 / sensor autônomo vinculado a um equipamento"
      maxWidthClass="max-w-lg"
      footer={
        <>
          <Button tone="secondary" className="flex-1" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleCriar} disabled={salvando}>
            {salvando ? 'Gerando token...' : 'Criar + gerar token'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Equipamento vinculado">
          <Select value={equipamentoId} onChange={(e) => setEquipamentoId(e.target.value)}>
            {equipamentos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="MAC address">
            <TextInput
              value={macAddress}
              onChange={(e) => setMacAddress(e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF"
            />
          </Field>
          <Field label="Modelo">
            <TextInput value={modelo} onChange={(e) => setModelo(e.target.value)} />
          </Field>
          <Field label="Intervalo de envio">
            <Select value={intervalo} onChange={(e) => setIntervalo(Number(e.target.value))}>
              {INTERVALOS.map((i) => (
                <option key={i} value={i}>
                  {i} min
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Versão do firmware">
            <TextInput value={firmware} onChange={(e) => setFirmware(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo imediatamente
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

/** Lista + CTA de criação. Usado na aba Configurações. */
export function DispositivosIoTList() {
  const { dispositivos, isLoading } = useDispositivosIoT();
  const { equipamentos } = useEquipamentos({ includeDeleted: true });
  const [open, setOpen] = useState(false);

  if (isLoading) return <div className="p-6 text-sm text-slate-500">Carregando dispositivos...</div>;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Dispositivos IoT"
        subtitle="ESP32 e sensores vinculados a equipamentos"
        actions={<Button onClick={() => setOpen(true)}>+ Novo dispositivo</Button>}
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Equipamento</th>
              <th className="px-4 py-3">MAC</th>
              <th className="px-4 py-3">Modelo</th>
              <th className="px-4 py-3">Intervalo</th>
              <th className="px-4 py-3">Última TX</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dispositivos.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  Nenhum dispositivo cadastrado.
                </td>
              </tr>
            ) : null}
            {dispositivos.map((d) => {
              const eq = equipamentos.find((e) => e.id === d.equipamentoId);
              return (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{eq?.nome ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.macAddress}</td>
                  <td className="px-4 py-3 text-slate-600">{d.modelo}</td>
                  <td className="px-4 py-3 text-slate-600">{d.intervaloEnvioMinutos} min</td>
                  <td className="px-4 py-3 text-slate-600">
                    {d.ultimaTransmissao
                      ? d.ultimaTransmissao.toDate().toLocaleString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {!d.ativo ? (
                      <StatusBadge tone="neutral">Desativado</StatusBadge>
                    ) : d.online ? (
                      <StatusBadge tone="success">
                        <span className="inline-flex items-center gap-1">
                          <WifiIcon size={12} /> Online
                        </span>
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="danger">
                        <span className="inline-flex items-center gap-1">
                          <WifiOffIcon size={12} /> Offline
                        </span>
                      </StatusBadge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {open ? <DispositivoIoTForm open onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
