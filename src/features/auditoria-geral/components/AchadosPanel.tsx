import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { toast } from '../../../shared/store/useToastStore';
import { useActiveLabId, useUser } from '../../../store/useAuthStore';
import { useAchados } from '../hooks/useAchados';
import { updateAchado, saveVerificacaoEficacia } from '../services/achadosService';
import type { Achado, TipoAchado, VerificacaoEficacia } from '../types';

interface AchadosPanelProps {
  auditoriaId: string;
  readonly?: boolean;
}

const TIPO_LABELS: Record<TipoAchado, { label: string; classes: string }> = {
  'nc-critica': { label: 'NC Crítica', classes: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
  'nc-maior': { label: 'NC Maior', classes: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' },
  'nc-menor': { label: 'NC Menor', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
  'oportunidade-melhoria': { label: 'Oportunidade', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  'observacao': { label: 'Observação', classes: 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-white/60' },
};

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  'aberto': { label: 'Aberto', classes: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' },
  'em-tratamento': { label: 'Em Tratamento', classes: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
  'fechado': { label: 'Fechado', classes: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
};

export function AchadosPanel({ auditoriaId, readonly = false }: AchadosPanelProps) {
  const labId = useActiveLabId();
  const user = useUser();
  const { achados, isLoading } = useAchados(auditoriaId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-4 bg-slate-200 dark:bg-white/[0.06] rounded w-1/3" />
        <div className="h-12 bg-slate-200 dark:bg-white/[0.06] rounded" />
        <div className="h-12 bg-slate-200 dark:bg-white/[0.06] rounded" />
      </div>
    );
  }

  if (achados.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-slate-500 dark:text-white/50">Nenhum achado registrado</p>
        <p className="text-xs text-slate-400 dark:text-white/30 mt-1">
          Achados são gerados automaticamente ao finalizar a auditoria para indicadores com score 0-2
        </p>
      </div>
    );
  }

  const abertos = achados.filter((a) => a.status === 'aberto').length;
  const emTratamento = achados.filter((a) => a.status === 'em-tratamento').length;
  const fechados = achados.filter((a) => a.status === 'fechado').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700 dark:text-white/80">
          Achados ({achados.length})
        </h3>
        <div className="flex items-center gap-2 text-[10px]">
          {abertos > 0 && <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">{abertos} abertos</span>}
          {emTratamento > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">{emTratamento} em tratamento</span>}
          {fechados > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">{fechados} fechados</span>}
        </div>
      </div>

      <div className="space-y-2">
        {achados.map((achado) => (
          <AchadoCard
            key={achado.id}
            achado={achado}
            expanded={expandedId === achado.id}
            onToggle={() => setExpandedId(expandedId === achado.id ? null : achado.id)}
            labId={labId!}
            auditoriaId={auditoriaId}
            readonly={readonly}
            currentUserUid={user?.uid ?? ''}
            currentUserNome={user?.displayName || user?.email || ''}
          />
        ))}
      </div>
    </div>
  );
}

function AchadoCard({
  achado,
  expanded,
  onToggle,
  labId,
  auditoriaId,
  readonly,
  currentUserUid,
  currentUserNome,
}: {
  achado: Achado;
  expanded: boolean;
  onToggle: () => void;
  labId: string;
  auditoriaId: string;
  readonly: boolean;
  currentUserUid: string;
  currentUserNome: string;
}) {
  const tipo = TIPO_LABELS[achado.tipo];
  const status = STATUS_LABELS[achado.status];
  const [saving, setSaving] = useState(false);

  const handleFieldSave = async (field: string, value: unknown) => {
    if (readonly) return;
    setSaving(true);
    try {
      await updateAchado(labId, auditoriaId, achado.id, { [field]: value });
    } catch {
      toast.error('Erro ao salvar achado');
    } finally {
      setSaving(false);
    }
  };

  const handleVerificacao = async (resultado: VerificacaoEficacia['resultado'], evidencia: string) => {
    setSaving(true);
    try {
      await saveVerificacaoEficacia(labId, auditoriaId, achado.id, {
        verificadorUid: currentUserUid,
        verificadorNome: currentUserNome,
        data: Timestamp.now(),
        resultado,
        evidencia,
        observacoes: '',
      });
      toast.success('Verificação registrada');
    } catch {
      toast.error('Erro ao registrar verificação');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`border rounded-lg transition-all ${
      achado.status === 'aberto'
        ? 'border-red-200 dark:border-red-500/20'
        : achado.status === 'em-tratamento'
          ? 'border-amber-200 dark:border-amber-500/20'
          : 'border-emerald-200 dark:border-emerald-500/20'
    }`}>
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center gap-3"
      >
        <span className="text-xs font-mono text-slate-500 dark:text-white/40">#{achado.numero}</span>
        <span className="text-xs font-medium text-slate-700 dark:text-white/80 flex-1 truncate">
          {achado.indicador}
        </span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${tipo.classes}`}>
          {tipo.label}
        </span>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${status.classes}`}>
          {status.label}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-white/[0.04] pt-3">
          {/* Descrição */}
          <Field
            label="Descrição"
            value={achado.descricao}
            onSave={(v) => handleFieldSave('descricao', v)}
            readonly={readonly}
          />

          {/* Evidência Objetiva */}
          <Field
            label="Evidência Objetiva"
            value={achado.evidenciaObjetiva}
            onSave={(v) => handleFieldSave('evidenciaObjetiva', v)}
            readonly={readonly}
          />

          {/* Causa Raiz */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-slate-500 dark:text-white/40 uppercase tracking-wide block mb-1">
                Método Causa Raiz
              </label>
              <select
                value={achado.metodoCausaRaiz}
                onChange={(e) => handleFieldSave('metodoCausaRaiz', e.target.value)}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-white/70"
              >
                <option value="">Selecionar...</option>
                <option value="5-porques">5 Porquês</option>
                <option value="ishikawa">Ishikawa</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <Field
              label="Causa Raiz"
              value={achado.causaRaiz}
              onSave={(v) => handleFieldSave('causaRaiz', v)}
              readonly={readonly}
            />
          </div>

          {/* Ação Corretiva */}
          <Field
            label="Ação Corretiva"
            value={achado.acaoCorretiva}
            onSave={(v) => handleFieldSave('acaoCorretiva', v)}
            readonly={readonly}
          />

          {/* Responsável + Prazo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Responsável"
              value={achado.responsavel}
              onSave={(v) => handleFieldSave('responsavel', v)}
              readonly={readonly}
            />
            <div>
              <label className="text-[10px] font-medium text-slate-500 dark:text-white/40 uppercase tracking-wide block mb-1">
                Prazo
              </label>
              <input
                type="date"
                value={achado.prazo ? achado.prazo.toDate().toISOString().slice(0, 10) : ''}
                onChange={(e) => {
                  const d = e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : null;
                  handleFieldSave('prazo', d);
                }}
                disabled={readonly}
                className="w-full bg-slate-50 border border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-white/70"
              />
            </div>
          </div>

          {/* Status transition */}
          {!readonly && achado.status !== 'fechado' && (
            <div className="flex items-center gap-2 pt-2">
              {achado.status === 'aberto' && achado.acaoCorretiva && achado.responsavel && (
                <button
                  type="button"
                  onClick={() => handleFieldSave('status', 'em-tratamento')}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-400 transition-colors"
                >
                  Iniciar Tratamento
                </button>
              )}
              {achado.status === 'em-tratamento' && (
                <button
                  type="button"
                  onClick={() => {
                    handleFieldSave('status', 'fechado');
                    handleFieldSave('dataConclusao', Timestamp.now());
                  }}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 transition-colors"
                >
                  Marcar como Concluído
                </button>
              )}
            </div>
          )}

          {/* Verificação de Eficácia */}
          {achado.status === 'fechado' && !achado.verificacaoEficacia && !readonly && (
            <VerificacaoForm
              achadoResponsavel={achado.responsavel}
              currentUserNome={currentUserNome}
              onSubmit={handleVerificacao}
              saving={saving}
            />
          )}

          {achado.verificacaoEficacia && (
            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-lg p-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-white/30">
                Verificação de Eficácia
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded font-medium ${
                  achado.verificacaoEficacia.resultado === 'eficaz'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                    : achado.verificacaoEficacia.resultado === 'ineficaz'
                      ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                }`}>
                  {achado.verificacaoEficacia.resultado === 'eficaz' ? 'Eficaz' :
                   achado.verificacaoEficacia.resultado === 'ineficaz' ? 'Ineficaz' : 'Parcialmente Eficaz'}
                </span>
                <span className="text-slate-500 dark:text-white/50">
                  por {achado.verificacaoEficacia.verificadorNome}
                </span>
                <span className="text-slate-400 dark:text-white/30">
                  {achado.verificacaoEficacia.data?.toDate?.()?.toLocaleDateString('pt-BR') ?? ''}
                </span>
              </div>
              {achado.verificacaoEficacia.evidencia && (
                <p className="text-xs text-slate-600 dark:text-white/60 mt-1">
                  {achado.verificacaoEficacia.evidencia}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onSave,
  readonly,
}: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  readonly: boolean;
}) {
  const [local, setLocal] = useState(value);

  return (
    <div>
      <label className="text-[10px] font-medium text-slate-500 dark:text-white/40 uppercase tracking-wide block mb-1">
        {label}
      </label>
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onSave(local); }}
        disabled={readonly}
        className="w-full bg-slate-50 border border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-white/70 disabled:opacity-60"
      />
    </div>
  );
}

function VerificacaoForm({
  achadoResponsavel,
  currentUserNome,
  onSubmit,
  saving,
}: {
  achadoResponsavel: string;
  currentUserNome: string;
  onSubmit: (resultado: VerificacaoEficacia['resultado'], evidencia: string) => void;
  saving: boolean;
}) {
  const [resultado, setResultado] = useState<VerificacaoEficacia['resultado']>('eficaz');
  const [evidencia, setEvidencia] = useState('');

  const isSameAsResponsavel = currentUserNome.toLowerCase() === achadoResponsavel.toLowerCase();

  return (
    <div className="bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 rounded-lg p-3 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
        Verificação de Eficácia
      </p>

      {isSameAsResponsavel && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          ⚠ Recomendado: verificador diferente do responsável pela ação
        </p>
      )}

      <div className="flex items-center gap-2">
        {(['eficaz', 'parcialmente-eficaz', 'ineficaz'] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setResultado(opt)}
            className={`px-2 py-1 text-[10px] font-medium rounded border transition-all ${
              resultado === opt
                ? opt === 'eficaz'
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-500/20 dark:border-emerald-500/40 dark:text-emerald-400'
                  : opt === 'ineficaz'
                    ? 'bg-red-100 border-red-300 text-red-700 dark:bg-red-500/20 dark:border-red-500/40 dark:text-red-400'
                    : 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-400'
                : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-white/[0.03] dark:border-white/[0.08] dark:text-white/40'
            }`}
          >
            {opt === 'eficaz' ? 'Eficaz' : opt === 'ineficaz' ? 'Ineficaz' : 'Parcial'}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Evidência da verificação..."
        value={evidencia}
        onChange={(e) => setEvidencia(e.target.value)}
        className="w-full bg-white border border-slate-200 dark:bg-white/[0.03] dark:border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-white/70 placeholder:text-slate-400 dark:placeholder:text-white/20"
      />

      <button
        type="button"
        onClick={() => onSubmit(resultado, evidencia)}
        disabled={saving || !evidencia.trim()}
        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-500 text-white hover:bg-violet-400 disabled:opacity-40 transition-colors"
      >
        {saving ? 'Salvando...' : 'Registrar Verificação'}
      </button>
    </div>
  );
}
