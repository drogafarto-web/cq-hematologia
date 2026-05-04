import React, { useState } from 'react';
import { useLGPD } from '../useLGPD';

/**
 * RequestForm — Data subject request form (access, rectification, deletion, portability).
 * LGPD/GDPR/CCPA alignment with 30-day SLA enforcement.
 */
export function RequestForm() {
  const { criarSolicitacao } = useLGPD();

  const [form, setForm] = useState({
    titular_id: '',
    titular_nome: '',
    titular_email: '',
    tipo: 'acesso' as 'acesso' | 'retificacao' | 'exclusao' | 'portabilidade',
    motivo: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await criarSolicitacao(
        form.titular_id,
        form.titular_nome,
        form.titular_email,
        form.tipo,
        form.motivo
      );

      setSuccess(true);
      setForm({
        titular_id: '',
        titular_nome: '',
        titular_email: '',
        tipo: 'acesso',
        motivo: '',
      });

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar solicitação');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="text-sm text-blue-900">
          <strong>Seus Direitos LGPD:</strong>
          <ul className="mt-2 ml-4 space-y-1 list-disc">
            <li><strong>Acesso:</strong> Solicite cópia de seus dados processados</li>
            <li><strong>Retificação:</strong> Corrija dados incompletos ou incorretos</li>
            <li><strong>Exclusão:</strong> Solicite exclusão de seus dados (direito ao esquecimento)</li>
            <li><strong>Portabilidade:</strong> Receba seus dados em formato estruturado</li>
          </ul>
          <div className="mt-3 text-xs">Prazo de resposta: 30 dias</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium text-gray-700">ID do Titular</label>
          <input
            type="text"
            value={form.titular_id}
            onChange={(e) => handleChange('titular_id', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
          <input
            type="text"
            value={form.titular_nome}
            onChange={(e) => handleChange('titular_nome', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={form.titular_email}
            onChange={(e) => handleChange('titular_email', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Tipo de Solicitação</label>
          <select
            value={form.tipo}
            onChange={(e) => handleChange('tipo', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="acesso">Acesso aos dados</option>
            <option value="retificacao">Retificação de dados</option>
            <option value="exclusao">Exclusão de dados</option>
            <option value="portabilidade">Portabilidade de dados</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Motivo (opcional)</label>
          <textarea
            value={form.motivo}
            onChange={(e) => handleChange('motivo', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={3}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            Solicitação criada com sucesso. Prazo: 30 dias
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Enviando...' : 'Criar Solicitação'}
        </button>
      </form>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-xs text-gray-600">
          <strong>Proteção de Dados:</strong>
          <p className="mt-2">
            Seus dados serão processados de forma segura conforme LGPD 14.506/2018.
            Você receberá confirmação por email e pode acompanhar o status da solicitação aqui.
          </p>
        </div>
      </div>
    </div>
  );
}
