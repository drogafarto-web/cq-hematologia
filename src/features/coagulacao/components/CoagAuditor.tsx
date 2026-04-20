import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { AUDIT_BASE_URL } from '../../../constants';
import type { CoagulacaoRun } from '../types/Coagulacao';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CoagAuditorProps {
  run: CoagulacaoRun;
  lotId: string;
  /** Tamanho do QR Code em px. Default: 128 */
  size?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * CoagAuditor — QR Code de rastreabilidade para uma corrida de coagulação.
 *
 * O link codificado permite auditores escanearem e validarem a corrida offline
 * pelo logicalSignature (SHA-256), sem acesso ao Firestore.
 *
 * URL: {AUDIT_BASE_URL}/coagulacao?id={runId}&lot={lotId}&sig={signature}
 *
 * RDC 978/2025 Art. 128 — rastreabilidade completa de corridas.
 */
export function CoagAuditor({ run, lotId, size = 128 }: CoagAuditorProps) {
  const sig = run.logicalSignature ?? '';

  const auditURL = `${AUDIT_BASE_URL}/coagulacao?id=${run.id}&lot=${lotId}&sig=${sig}`;

  // Primeiros 8 chars da assinatura — suficiente para identificação visual rápida
  const sigShort = sig ? sig.slice(0, 8) : '—';

  return (
    <div
      className="inline-flex flex-col items-center gap-2.5
                    p-4 rounded-xl
                    bg-white dark:bg-white/[0.04]
                    border border-slate-200 dark:border-white/[0.08]"
    >
      {/* QR Code — fundo branco é necessário para leitores ópticos */}
      <div className="p-2 bg-white rounded-lg">
        <QRCodeSVG value={auditURL} size={size} level="M" includeMargin={false} />
      </div>

      <div className="text-center space-y-0.5">
        <p className="text-[10px] font-mono text-slate-400 dark:text-white/30 tracking-wider">
          SIG: {sigShort}…
        </p>
        <p className="text-[9px] text-slate-300 dark:text-white/20">
          Nível {run.nivel} · {run.dataRealizacao}
        </p>
      </div>
    </div>
  );
}
