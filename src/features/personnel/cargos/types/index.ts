/**
 * Personnel - Cargos Type System
 *
 * Types para cargos (roles) e matrix de autoridade.
 * Multi-tenant: escoped a `/labs/{labId}/cargos`
 */

export type SecaoLab = 'análise' | 'coleta' | 'qualidade' | 'direção' | 'administrativo';

export interface Cargo {
  id: string;
  labId: string;
  nome: string;
  descricao: string;
  requisitosMinimos: string;
  secao: SecaoLab;
  reportaA?: string;
  substituidor?: string;
  dataDesignacao: number;
  createdAt: number;
  createdBy: string;
  deletedAt?: number;
}

export interface CargoPermissions {
  canReleaseLaudos: boolean;
  canFlagNC: boolean;
  canApproveNC: boolean;
  canManageInventory: boolean;
  canEditEquipamento: boolean;
  canConductAudit: boolean;
  canApproveTraining: boolean;
  canManagePersonnel: boolean;
  canAccessReports: boolean;
}

export type CargoAuthorityMatrix = Record<string, CargoPermissions>;

export const DEFAULT_CARGO_IDS = [
  'responsavel-tecnico',
  'gerente-qualidade',
  'diretor-laboratorio',
  'supervisor-ciq',
  'analista-senior',
  'analista-junior',
  'coletador',
  'auxiliar-laboratorio',
] as const;
