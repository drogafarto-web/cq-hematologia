/**
 * Portal RT — Sections Barrel Export
 */

export { DashboardSection, type DashboardSectionProps } from './DashboardSection';
export { CriticosSection, type CriticosSectionProps } from './CriticosSection';
export { ResultadosSection, type ResultadosSectionProps } from './ResultadosSection';
export { ComplianceSection, type ComplianceSectionProps } from './ComplianceSection';
export { ConfiguracaoSection, type ConfiguracaoSectionProps } from './ConfiguracaoSection';

// Type exports for section data models
export type { CriticoAlert } from './CriticosSection';
export type { Resultado, ResultadoStatus } from './ResultadosSection';
export type { DICQItem, RiskItem, TrainingAlert } from './ComplianceSection';
export type { RTUserProfile, LabConfig } from './ConfiguracaoSection';
