import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';

import { useActiveLab } from '../../../store/useAuthStore';
import type { RelatorioFR11 } from '../services/ctExportService';
import { nomeMes } from '../services/ctExportService';
import { DownloadIcon } from './_icons';
import { Button } from './_shared';

export interface CTRelatorioPrintProps {
  payload: RelatorioFR11;
  onClose: () => void;
}

/**
 * Preview + impressão do FR-11 fiel ao formulário papel (PQ-06).
 *
 * react-to-print isola o DOM apontado por `contentRef` — evita que o shell
 * do app seja incluso no print. Tabela tem exatamente 31 linhas (mês mais
 * longo) com 2 colunas de leitura (manhã/tarde); dias inexistentes ficam em
 * branco com traço.
 */
export function CTRelatorioPrint({ payload, onClose }: CTRelatorioPrintProps) {
  const lab = useActiveLab();
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `FR-11_${payload.equipamento.nome.replace(/\s+/g, '_')}_${payload.mes}_${payload.ano}`,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fr11-title"
        className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <h2 id="fr11-title" className="text-base font-semibold text-slate-800">
              Pré-visualização — FR-11
            </h2>
            <p className="text-xs text-slate-500">
              "Imprimir" → selecione "Salvar como PDF" para arquivar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button tone="secondary" onClick={onClose}>
              Fechar
            </Button>
            <Button onClick={handlePrint}>
              <span className="inline-flex items-center gap-2">
                <DownloadIcon size={16} /> Exportar PDF
              </span>
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-slate-100">
          <div className="mx-auto my-6 max-w-4xl bg-white p-8 shadow-sm">
            <div ref={printRef} className="text-sm text-slate-900">
              <style>{`
                @media print {
                  @page { size: A4 portrait; margin: 12mm 10mm; }
                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                  .avoid-break { page-break-inside: avoid; break-inside: avoid; }
                }
              `}</style>

              <FR11Header
                labNome={lab?.name ?? '—'}
                equipamento={payload.equipamento.nome}
                localizacao={payload.equipamento.localizacao}
                termometro={payload.termometro?.numeroSerie ?? '—'}
                mes={payload.mes}
                ano={payload.ano}
                limites={payload.equipamento.limites}
              />

              <table className="mb-6 w-full border-collapse border-2 border-slate-800 text-center text-xs">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="border border-slate-800 p-1">Dia</th>
                    <th className="border border-slate-800 p-1">Hora</th>
                    <th className="border border-slate-800 p-1">T. Atual</th>
                    <th className="border border-slate-800 p-1">Umid.</th>
                    <th className="border border-slate-800 p-1">T. Máx.</th>
                    <th className="border border-slate-800 p-1">T. Mín.</th>
                    <th className="border border-slate-800 p-1">Resp.</th>
                    <th className="border border-slate-800 bg-slate-200 p-1">Hora</th>
                    <th className="border border-slate-800 bg-slate-200 p-1">T. Atual</th>
                    <th className="border border-slate-800 bg-slate-200 p-1">Umid.</th>
                    <th className="border border-slate-800 bg-slate-200 p-1">T. Máx.</th>
                    <th className="border border-slate-800 bg-slate-200 p-1">T. Mín.</th>
                    <th className="border border-slate-800 bg-slate-200 p-1">Resp.</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.linhas.map((l) => (
                    <tr key={l.dia} className="avoid-break">
                      <td className="border border-slate-800 font-bold">
                        {String(l.dia).padStart(2, '0')}
                      </td>
                      <CelulaLeitura cell={l.manha} />
                      <CelulaLeitura cell={l.tarde} tarde />
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mb-4 text-xs font-bold">
                Obs.: Valores fora dos limites de aceitabilidade são sinalizados com "*"; as
                ações adotadas estão registradas abaixo. Células com "J" indicam leitura
                justificada; "—" indica leitura não realizada.
              </div>

              {payload.ncs.length > 0 ? (
                <div className="avoid-break mb-6 border border-slate-800">
                  <div className="border-b border-slate-800 bg-slate-100 px-2 py-1 text-xs font-bold">
                    Não conformidades do período
                  </div>
                  <table className="w-full border-collapse text-xs">
                    <thead className="bg-slate-50 text-left">
                      <tr>
                        <th className="border-b border-slate-800 px-2 py-1">Data</th>
                        <th className="border-b border-slate-800 px-2 py-1">Equipamento</th>
                        <th className="border-b border-slate-800 px-2 py-1">Valor</th>
                        <th className="border-b border-slate-800 px-2 py-1">Ação imediata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.ncs.map((n, i) => (
                        <tr key={i}>
                          <td className="border-b border-slate-200 px-2 py-1">{n.data}</td>
                          <td className="border-b border-slate-200 px-2 py-1">{n.equipamento}</td>
                          <td className="border-b border-slate-200 px-2 py-1 font-medium text-rose-700">
                            {n.valor}
                          </td>
                          <td className="border-b border-slate-200 px-2 py-1">{n.acaoImediata}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div className="avoid-break grid grid-cols-2 border border-slate-800">
                <div className="flex h-16 items-end border-r border-slate-800 p-2">
                  <span className="mr-2 font-bold">Gerência da Qualidade:</span>
                  <div className="flex-1 border-b border-slate-800 text-center italic text-indigo-700">
                    Assinado eletronicamente
                  </div>
                </div>
                <div className="flex h-16 items-end p-2">
                  <span className="mr-2 font-bold">Data:</span>
                  <div className="flex-1 border-b border-slate-800 text-center">
                    {payload.emitidoEm.toDate().toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
              {payload.termometro ? (
                <div className="avoid-break mt-3 rounded border border-slate-300 bg-slate-50 p-2 text-[10px] leading-snug text-slate-700">
                  <p className="font-bold">Rastreabilidade metrológica — ISO 15189:2022 cl. 5.3.1</p>
                  <p>
                    Termômetro: <span className="font-mono">{payload.termometro.numeroSerie}</span>
                    {' '}| {payload.termometro.modelo} | Incerteza: ±{payload.termometro.incertezaMedicao}°C
                  </p>
                  <p>
                    Certificado:{' '}
                    <span className="font-mono">
                      {payload.termometro.calibracaoAtual.numeroCertificado}
                    </span>
                    {' '}(v{payload.termometro.calibracaoAtual.versao}) | Válido até:{' '}
                    {payload.termometro.calibracaoAtual.dataValidade
                      .toDate()
                      .toLocaleDateString('pt-BR')}
                    {' '}| Emitido por {payload.termometro.calibracaoAtual.laboratorioCalibrador}
                  </p>
                </div>
              ) : null}

              <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                <span>PQ-06 — Gestão de Materiais</span>
                <span>
                  Emitido por HC Quality em{' '}
                  {payload.emitidoEm.toDate().toLocaleString('pt-BR')} • Hash:{' '}
                  {payload.hashDocumento.slice(0, 16)}…
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FR11Header({
  labNome,
  equipamento,
  localizacao,
  termometro,
  mes,
  ano,
  limites,
}: {
  labNome: string;
  equipamento: string;
  localizacao: string;
  termometro: string;
  mes: number;
  ano: number;
  limites: { temperaturaMin: number; temperaturaMax: number; umidadeMin?: number; umidadeMax?: number };
}) {
  return (
    <>
      <div className="mb-4 flex border-2 border-slate-800">
        <div className="flex w-1/4 items-center justify-center border-r-2 border-slate-800 p-3">
          <div className="text-center">
            <div className="text-xl font-bold tracking-tight text-rose-700">
              lab<span className="font-light text-slate-700">clin</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500">{labNome}</div>
          </div>
        </div>
        <div className="flex w-2/4 items-center justify-center border-r-2 border-slate-800 p-3">
          <h1 className="text-lg font-bold tracking-wider">CONTROLE DE TEMPERATURA</h1>
        </div>
        <div className="w-1/4 text-center text-xs">
          <div className="border-b-2 border-slate-800 p-1 font-bold">FR - 11</div>
          <div className="border-b border-slate-800 p-1">Ver. 02</div>
          <div className="p-1">Página 1 de 1</div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 border-2 border-slate-800 bg-slate-50 text-xs">
        <div className="border-r border-slate-800 p-2">
          <span className="font-bold">Ambiente:</span> {localizacao || '—'}
        </div>
        <div className="border-r border-slate-800 p-2">
          <span className="font-bold">Equipamento:</span> {equipamento}
        </div>
        <div className="p-2">
          <span className="font-bold">Aceitabilidade:</span>{' '}
          {limites.temperaturaMin.toFixed(1)}°C a {limites.temperaturaMax.toFixed(1)}°C
          {limites.umidadeMin !== undefined && limites.umidadeMax !== undefined
            ? ` • ${limites.umidadeMin}% a ${limites.umidadeMax}%`
            : ''}
        </div>
        <div className="border-r border-t border-slate-800 p-2">
          <span className="font-bold">Termômetro:</span> {termometro || '—'}
        </div>
        <div className="border-r border-t border-slate-800 p-2">
          <span className="font-bold">Mês:</span> {nomeMes(mes)}
        </div>
        <div className="border-t border-slate-800 p-2">
          <span className="font-bold">Ano:</span> {ano}
        </div>
      </div>
    </>
  );
}

function CelulaLeitura({
  cell,
  tarde = false,
}: {
  cell: null | import('../services/ctExportService').CelulaLeituraFR11;
  tarde?: boolean;
}) {
  const bg = tarde ? 'bg-slate-50' : '';
  if (!cell) {
    return (
      <>
        <td className={`border border-slate-800 text-slate-300 ${bg}`}>—</td>
        <td className={`border border-slate-800 text-slate-300 ${bg}`}>—</td>
        <td className={`border border-slate-800 text-slate-300 ${bg}`}>—</td>
        <td className={`border border-slate-800 text-slate-300 ${bg}`}>—</td>
        <td className={`border border-slate-800 text-slate-300 ${bg}`}>—</td>
        <td className={`border border-slate-800 text-slate-300 ${bg}`}>—</td>
      </>
    );
  }
  const valor = cell.justificada
    ? 'J'
    : `${cell.temperaturaAtual}${cell.foraDosLimites ? '*' : ''}`;
  const valorCls = cell.foraDosLimites ? 'font-bold text-rose-600' : '';
  return (
    <>
      <td className={`border border-slate-800 ${bg}`}>{cell.hora}</td>
      <td className={`border border-slate-800 ${valorCls} ${bg}`}>{valor}</td>
      <td className={`border border-slate-800 ${bg}`}>{cell.umidade}</td>
      <td className={`border border-slate-800 ${bg}`}>{cell.temperaturaMax}</td>
      <td className={`border border-slate-800 ${bg}`}>{cell.temperaturaMin}</td>
      <td className={`border border-slate-800 text-[10px] ${bg}`}>{cell.responsavel}</td>
    </>
  );
}
