/**
 * ListaMestraView.tsx
 *
 * Three-tab view for Lista Mestra surfaces:
 * - Lista Mestra Dashboard (catalog)
 * - Hierarquia Tree (MQ → PQ → IT → FR)
 * - Distribuição Matrix (docs × setores)
 */

import { useState } from 'react';
import { ListaMestraDashboard } from './components/lm/ListaMestraDashboard';
import { HierarquiaTree } from './components/hierarquia/HierarquiaTree';
import { DistribuicaoMatrix } from './components/distribuicao/DistribuicaoMatrix';
import { useActiveLab } from '../../store/useAuthStore';

type Tab = 'catalog' | 'hierarquia' | 'distribuicao';

/**
 * Mock data — replace with real Firestore hooks
 */
interface DocumentoLM {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  status: 'draft' | 'em-revisao' | 'vigente' | 'obsoleto';
  versao: number;
  setoresLD: string[];
  ultimaAtualizacao: Date;
  criadoEm: Date;
}

const MOCK_DOCS: DocumentoLM[] = [
  {
    id: 'mq-001',
    codigo: 'MQ-001',
    titulo: 'Manual da Qualidade',
    tipo: 'MQ',
    status: 'vigente',
    versao: 2,
    setoresLD: ['Bioquímica', 'Hematologia', 'Qualidade'],
    ultimaAtualizacao: new Date('2024-12-01'),
    criadoEm: new Date('2024-01-01'),
  },
  {
    id: 'pq-001',
    codigo: 'PQ-001',
    titulo: 'Procedimento de Controle de Qualidade Analítico',
    tipo: 'PQ',
    status: 'vigente',
    versao: 1,
    setoresLD: ['Bioquímica', 'Hematologia'],
    ultimaAtualizacao: new Date('2024-11-15'),
    criadoEm: new Date('2024-06-01'),
  },
];

export function ListaMestraView() {
  const activeLab = useActiveLab();
  const [currentTab, setCurrentTab] = useState<Tab>('catalog');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const labId = activeLab?.id ?? '';

  const handleDocumentSelect = (id: string) => {
    setSelectedDocId(id);
    // TODO: Open detail modal
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Sistema de Gestão Documental</h1>
          <p className="text-white/60 text-sm mt-2">
            Gerenciamento centralizado de documentos da qualidade
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10">
          <button
            onClick={() => setCurrentTab('catalog')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors duration-150 ${
              currentTab === 'catalog'
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-white/60 hover:text-white/80'
            }`}
          >
            Catálogo
          </button>
          <button
            onClick={() => setCurrentTab('hierarquia')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors duration-150 ${
              currentTab === 'hierarquia'
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-white/60 hover:text-white/80'
            }`}
          >
            Hierarquia
          </button>
          <button
            onClick={() => setCurrentTab('distribuicao')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors duration-150 ${
              currentTab === 'distribuicao'
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-white/60 hover:text-white/80'
            }`}
          >
            Distribuição
          </button>
        </div>

        {/* Content */}
        <div className="pt-4">
          {currentTab === 'catalog' && (
            <ListaMestraDashboard
              labId={labId}
              documentos={MOCK_DOCS}
              onDocumentSelect={handleDocumentSelect}
            />
          )}

          {currentTab === 'hierarquia' && (
            <div className="space-y-4">
              <HierarquiaTree
                data={MOCK_DOCS.map((doc) => ({
                  id: doc.id,
                  codigo: doc.codigo,
                  titulo: doc.titulo,
                  tipo: doc.tipo as any,
                  status: doc.status,
                  children: [],
                }))}
                onNodeSelect={handleDocumentSelect}
              />
            </div>
          )}

          {currentTab === 'distribuicao' && (
            <DistribuicaoMatrix
              documentos={MOCK_DOCS.map((doc) => ({
                id: doc.id,
                codigo: doc.codigo,
                titulo: doc.titulo,
                tipo: doc.tipo as any,
                status: doc.status,
                setoresDistribuidos: doc.setoresLD,
              }))}
              onDocumentClick={handleDocumentSelect}
              userSetores={['Bioquímica']}
            />
          )}
        </div>
      </div>
    </div>
  );
}
