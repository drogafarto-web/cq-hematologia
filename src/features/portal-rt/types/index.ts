/**
 * Portal RT — Type definitions
 *
 * Responsible Technician (RT) dashboard types for operational QC hub.
 */

export type PortalRTSectionType =
  | 'dashboard'
  | 'criticos'
  | 'resultados'
  | 'compliance'
  | 'configuracao';

export interface PortalRTState {
  activeSection: PortalRTSectionType;
  escalationCount: number;
  isLoading: boolean;
}

export interface PortalRTNavItem {
  id: PortalRTSectionType;
  label: string;
  icon: 'dashboard' | 'alert-circle' | 'file-text' | 'shield-check' | 'settings';
  badge?: number;
}
