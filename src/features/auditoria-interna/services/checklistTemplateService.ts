/**
 * Checklist Template Service
 *
 * Loads and manages DICQ checklist templates (~115 items).
 * Templates are static JSON seed data, immutable after load.
 * Installation via Cloud Function callable (Phase 05-03+).
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../shared/services/firebase';
import templatesData from '../data/checklistTemplates.json';
import type { TemplateChecklist } from '../types';

/**
 * Type for template metadata (without items)
 */
export interface TemplateMetadata {
  id: string;
  nome: string;
  versao: string;
  descricao: string;
  itemCount: number;
}

/**
 * Get a checklist template by ID
 *
 * Returns the full template with all ~115 DICQ items.
 * Throws if template not found.
 */
export function getTemplateById(templateId: string): TemplateChecklist {
  const template = (templatesData as Record<string, any>)[templateId];
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  return template as TemplateChecklist;
}

/**
 * List all available templates (metadata only)
 *
 * Returns: { id, nome, versao, descricao, itemCount }[]
 * Useful for UI selectors to show available templates.
 */
export function listAvailableTemplates(): TemplateMetadata[] {
  return Object.entries(templatesData as Record<string, any>).map(([id, template]) => ({
    id,
    nome: template.nome,
    versao: template.versao,
    descricao: template.descricao,
    itemCount: template.itens?.length ?? 0,
  }));
}

/**
 * Install a template into a session via Cloud Function callable
 *
 * Cloud Function handles:
 * 1. Load template from admin seeds
 * 2. Create sessão if not exists
 * 3. Batch-create checklist items (max 500 per call)
 * 4. Return sessaoId + item count
 *
 * Input: labId, templateId (+ optional auditoriaId, sessaoId for updates)
 * Returns: { sessaoId: string; itemsCreated: number }
 */
export async function installTemplate(
  labId: string,
  templateId: string
): Promise<{ sessaoId: string; itemsCreated: number }> {
  const callable = httpsCallable(functions, 'installChecklistTemplate');

  const result = await callable({
    labId,
    templateId,
  });

  // Callable returns { sessaoId: string; itemsCreated: number }
  return result.data as { sessaoId: string; itemsCreated: number };
}

/**
 * Get a template's item count
 *
 * Useful for UI displaying "115 items" label.
 */
export function getTemplateItemCount(templateId: string): number {
  const template = getTemplateById(templateId);
  return template.itens.length;
}

/**
 * Filter checklist items by bloco (A-J) or categoria
 *
 * Returns subset of items from a template.
 */
export function filterTemplateItems(
  templateId: string,
  options: {
    bloco?: string;
    categoria?: string;
    applicableOnly?: boolean;
  }
): TemplateChecklist['itens'] {
  const template = getTemplateById(templateId);
  let items = template.itens;

  if (options.applicableOnly) {
    items = items.filter((item) => item.isApplicable);
  }

  if (options.bloco) {
    items = items.filter((item) => item.bloco === options.bloco);
  }

  if (options.categoria) {
    items = items.filter((item) => item.categoria === options.categoria);
  }

  return items;
}
