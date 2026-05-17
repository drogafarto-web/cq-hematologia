import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../shared/services/firebase';
import { useActiveLab, useUserRole } from '../../store/useAuthStore';
import { toast } from '../../shared/store/useToastStore';

const ALLOWED_MODELS = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'Rápido, custo baixo' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', desc: 'Mais preciso, custo maior' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', desc: 'Versão anterior estável' },
  { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', desc: 'Legacy' },
  { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', desc: 'Legacy, alta precisão' },
];

export function AIModelConfig() {
  const activeLab = useActiveLab();
  const role = useUserRole();
  const canEdit = role === 'owner' || role === 'admin';

  const [currentModel, setCurrentModel] = useState('gemini-2.5-flash');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!activeLab) return;
    getDoc(doc(db, `labs/${activeLab.id}/settings/ai`))
      .then((snap) => {
        if (snap.exists() && snap.data()?.geminiModel) {
          setCurrentModel(snap.data().geminiModel);
        }
      })
      .finally(() => setLoaded(true));
  }, [activeLab]);

  const handleChange = async (modelId: string) => {
    if (!activeLab || !canEdit || saving) return;
    setSaving(true);
    try {
      await setDoc(doc(db, `labs/${activeLab.id}/settings/ai`), {
        geminiModel: modelId,
        updatedAt: new Date(),
      }, { merge: true });
      setCurrentModel(modelId);
      toast.success(`Modelo IA alterado para ${modelId}`);
    } catch {
      toast.error('Erro ao salvar configuração de IA');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-white/80">Modelo de IA</p>
        <p className="text-xs text-slate-400 dark:text-white/30 mt-0.5">
          Modelo usado para validação de evidências, resumos e OCR. Alteração aplica imediatamente, sem deploy.
        </p>
      </div>

      <div className="space-y-1.5">
        {ALLOWED_MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => handleChange(m.id)}
            disabled={!canEdit || saving || m.id === currentModel}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
              m.id === currentModel
                ? 'bg-violet-50 border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-white/[0.02] dark:border-white/[0.08] dark:hover:border-white/[0.14]'
            } disabled:cursor-not-allowed`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${
                  m.id === currentModel
                    ? 'text-violet-700 dark:text-violet-400'
                    : 'text-slate-700 dark:text-white/70'
                }`}>
                  {m.label}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-white/30 mt-0.5">{m.desc}</p>
              </div>
              {m.id === currentModel && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400">
                  Ativo
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {!canEdit && (
        <p className="text-xs text-amber-600 dark:text-amber-400/70">
          Apenas admin/owner pode alterar o modelo.
        </p>
      )}
    </section>
  );
}
