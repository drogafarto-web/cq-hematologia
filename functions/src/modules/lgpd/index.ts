// Existing LGPD functions (Fase 0a pattern — request-based)
export { criarSolicitacao, processarExclusao, gerarDPIA, scheduledProcessarSolicitacoesVencidas } from './lgpd';

// Phase 6 — New LGPD callables (Fase 0b pattern — OTP-verified, chain-hash preserving)
export { deleteTitularData } from './deleteTitularData';
export { sendOTP } from './sendOTP';
export { recordPrivacyAceite } from './recordAceite';

// Phase 0 — LGPD Document Compliance (POL-LGPD-001 + IT-LGPD-DPIA-001 annual review scheduler)
export { lgpd_scheduledAnnualReview } from './scheduledAnnualReview';
