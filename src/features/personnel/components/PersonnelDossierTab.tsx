/**
 * PersonnelDossierTab — REQ-403 fatia 1 + Point 5 (validade) + Point 7 (timeline)
 *
 * Dossiê por colaborador (CV, registros, certificações em texto) + lista de qualificações
 * (`OperatorQualificacoesTab`), usando `Colaborador.id` como chave (mesmo que `operadorId` em qualificações).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Timestamp } from '../../../shared/services/firebase';
import { useColaboradores } from '../../educacao-continuada/hooks/useColaboradores';
import { useActiveLabId } from '../../../store/useAuthStore';
import { toast } from '../../../shared/store/useToastStore';
import { usePersonnelDossier } from '../hooks/usePersonnelDossier';
import { normalizePersonnelDossierInput } from '../services/personnelDossierService';
import { OperatorQualificacoesTab } from './OperatorQualificacoesTab';
import { DossieTreinamentosSection } from './DossieTreinamentosSection';
import { AlertasCertificacoesCard } from './AlertasCertificacoesCard';
import { DesignacaoTimeline } from './DesignacaoTimeline';
import type { CertificacaoRegistro } from '../types';

interface FormState {
  cvUrl: string;
  cvResumo: string;
  registroCRF: string;
  registroCRBM: string;
  registroCREF: string;
  registroCRFValidade: Timestamp | null;
  registroCRBMValidade: Timestamp | null;
  registroCREFValidade: Timestamp | null;
  certificacoesNotas: string;
  certificacoes: CertificacaoRegistro[];
}

const emptyForm: FormState = {
  cvUrl: '',
  cvResumo: '',
  registroCRF: '',
  registroCRBM: '',
  registroCREF: '',
  registroCRFValidade: null,
  registroCRBMValidade: null,
  registroCREFValidade: null,
  certificacoesNotas: '',
  certificacoes: [],
};

interface PersonnelDossierTabProps {
  canEdit: boolean;
}

export function PersonnelDossierTab({ canEdit }: PersonnelDossierTabProps): React.ReactElement {
  const labId = useActiveLabId();
  const { colaboradores, isLoading: colabLoading, error: colabError } = useColaboradores({
    somenteAtivos: true,
  });

  const sorted = useMemo(
    () => [...colaboradores].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [colaboradores],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (sorted.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (prev && sorted.some((c) => c.id === prev)) return prev;
      return sorted[0]?.id ?? null;
    });
  }, [sorted]);

  const { dossier, loading: dossierLoading, error: dossierError, save } = usePersonnelDossier(selectedId);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dossier) {
      setForm(emptyForm);
      return;
    }
    setForm({
      cvUrl: dossier.cvUrl ?? '',
      cvResumo: dossier.cvResumo ?? '',
      registroCRF: dossier.registroCRF ?? '',
      registroCRBM: dossier.registroCRBM ?? '',
      registroCREF: dossier.registroCREF ?? '',
      registroCRFValidade: dossier.registroCRFValidade ?? null,
      registroCRBMValidade: dossier.registroCRBMValidade ?? null,
      registroCREFValidade: dossier.registroCREFValidade ?? null,
      certificacoesNotas: dossier.certificacoesNotas ?? '',
      certificacoes: dossier.certificacoes ?? [],
    });
  }, [dossier]);

  const handleSave = useCallback(async () => {
    if (!selectedId || !canEdit) return;
    setSaving(true);
    try {
      const editable = normalizePersonnelDossierInput(form);
      await save(editable);
      toast.success('Dossiê salvo.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao salvar dossiê.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [selectedId, canEdit, form, save]);

  const selectId = 'personnel-dossier-colaborador';

  if (!labId) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-sm text-white/60">
        Selecione um laboratório para gerenciar dossiês.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {colabError && (
        <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-200">
          Erro ao carregar colaboradores: {colabError.message}
        </div>
      )}

      <section aria-labelledby={`${selectId}-heading`} className="space-y-4">
        <h2 id={`${selectId}-heading`} className="text-lg font-semibold text-white">
          Colaborador
        </h2>
        {colabLoading ? (
          <div className="h-11 animate-pulse rounded-lg bg-white/5" />
        ) : sorted.length === 0 ? (
          <p className="text-sm text-white/50">Nenhum colaborador ativo cadastrado em Educação Continuada.</p>
        ) : (
          <div className="max-w-xl">
            <label htmlFor={selectId} className="mb-2 block text-xs font-medium text-white/50">
              Selecionar colaborador
            </label>
            <select
              id={selectId}
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="w-full rounded-lg border border-white/10 bg-[#1a1a1f] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            >
              {sorted.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} — {c.cargo}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      {selectedId && (
        <>
          {dossierError && (
            <div className="rounded-lg bg-red-500/10 p-4 text-sm text-red-200">
              Erro ao carregar dossiê: {dossierError.message}
            </div>
          )}

          <section aria-labelledby="personnel-dossier-form-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="personnel-dossier-form-heading" className="text-lg font-semibold text-white">
                Dados do dossiê
              </h2>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || dossierLoading}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              )}
            </div>

            {dossierLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Field
                  label="URL do CV (opcional)"
                  id="dossier-cv-url"
                  value={form.cvUrl}
                  onChange={(v) => setForm((f) => ({ ...f, cvUrl: v }))}
                  disabled={!canEdit}
                  placeholder="https://…"
                />
                <div className="md:col-span-2">
                  <Field
                    label="Resumo do CV"
                    id="dossier-cv-resumo"
                    value={form.cvResumo}
                    onChange={(v) => setForm((f) => ({ ...f, cvResumo: v }))}
                    disabled={!canEdit}
                    multiline
                    rows={4}
                  />
                </div>
                <Field
                  label="CRF"
                  id="dossier-crf"
                  value={form.registroCRF}
                  onChange={(v) => setForm((f) => ({ ...f, registroCRF: v }))}
                  disabled={!canEdit}
                />
                <DateField
                  label="Validade CRF"
                  id="dossier-crf-validade"
                  value={form.registroCRFValidade}
                  onChange={(v) => setForm((f) => ({ ...f, registroCRFValidade: v }))}
                  disabled={!canEdit}
                />
                <Field
                  label="CRBM"
                  id="dossier-crbm"
                  value={form.registroCRBM}
                  onChange={(v) => setForm((f) => ({ ...f, registroCRBM: v }))}
                  disabled={!canEdit}
                />
                <DateField
                  label="Validade CRBM"
                  id="dossier-crbm-validade"
                  value={form.registroCRBMValidade}
                  onChange={(v) => setForm((f) => ({ ...f, registroCRBMValidade: v }))}
                  disabled={!canEdit}
                />
                <Field
                  label="CREF"
                  id="dossier-cref"
                  value={form.registroCREF}
                  onChange={(v) => setForm((f) => ({ ...f, registroCREF: v }))}
                  disabled={!canEdit}
                />
                <DateField
                  label="Validade CREF"
                  id="dossier-cref-validade"
                  value={form.registroCREFValidade}
                  onChange={(v) => setForm((f) => ({ ...f, registroCREFValidade: v }))}
                  disabled={!canEdit}
                />
                <div className="md:col-span-2">
                  <Field
                    label="Certificações e notas"
                    id="dossier-cert"
                    value={form.certificacoesNotas}
                    onChange={(v) => setForm((f) => ({ ...f, certificacoesNotas: v }))}
                    disabled={!canEdit}
                    multiline
                    rows={4}
                  />
                </div>
              </div>
            )}
            {!canEdit && (
              <p className="text-xs text-white/45">Somente leitura — permissão insuficiente para editar.</p>
            )}
          </section>

          <section aria-labelledby="personnel-dossier-qual-heading" className="space-y-4 border-t border-white/10 pt-8">
            <h2 id="personnel-dossier-qual-heading" className="text-lg font-semibold text-white">
              Qualificações e treinamentos registrados
            </h2>
            <OperatorQualificacoesTab operadorId={selectedId} labId={labId} canEdit={canEdit} />
          </section>

          <section aria-labelledby="personnel-dossier-trein-heading" className="space-y-4 border-t border-white/10 pt-8">
            <h2 id="personnel-dossier-trein-heading" className="text-lg font-semibold text-white">
              Histórico de Treinamentos
            </h2>
            <DossieTreinamentosSection colaboradorId={selectedId} />
          </section>

          {/* Point 5: Alertas de Vencimento */}
          {dossier && (
            <section aria-labelledby="personnel-dossier-alertas-heading" className="space-y-4 border-t border-white/10 pt-8">
              <h2 id="personnel-dossier-alertas-heading" className="text-lg font-semibold text-white">
                Alertas de Vencimento
              </h2>
              <AlertasCertificacoesCard dossier={dossier} />
            </section>
          )}

          {/* Point 7: Histórico de Funções (Timeline) */}
          <section aria-labelledby="personnel-dossier-timeline-heading" className="space-y-4 border-t border-white/10 pt-8">
            <h2 id="personnel-dossier-timeline-heading" className="text-lg font-semibold text-white">
              Histórico de Funções
            </h2>
            <DesignacaoTimeline colaboradorId={selectedId} />
          </section>
        </>
      )}
    </div>
  );
}

function Field(props: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const { label, id, value, onChange, disabled, placeholder, multiline, rows } = props;
  const base =
    'w-full rounded-lg border border-white/10 bg-[#1a1a1f] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-medium text-white/50">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows ?? 3}
          className={`${base} min-h-[88px] resize-y`}
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={base}
        />
      )}
    </div>
  );
}

function DateField(props: {
  label: string;
  id: string;
  value: Timestamp | null;
  onChange: (v: Timestamp | null) => void;
  disabled: boolean;
}) {
  const { label, id, value, onChange, disabled } = props;
  const base =
    'w-full rounded-lg border border-white/10 bg-[#1a1a1f] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60';

  const dateStr = value ? value.toDate().toISOString().split('T')[0] : '';

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-medium text-white/50">
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={dateStr}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onChange(null);
          } else {
            onChange(Timestamp.fromDate(new Date(v + 'T00:00:00')));
          }
        }}
        disabled={disabled}
        className={base}
      />
    </div>
  );
}
