import React, { useState } from 'react'
import { useActiveLabId } from '../../store/useAuthStore'
import { useSGDDocumentos } from './hooks/useSGDDocumentos'
import { SGDViewer } from './components/SGDViewer'
import { DriveImporterWizard } from './components/DriveImporterWizard'
import { cn } from '../../utils/cn'
import { DICABloco, SGDDocumento } from './types/SGDDocumento'

/**
 * SGDView — Sistema de Gestão de Documentos Externos
 * Displays imported documents from Google Drive with filtering, search, and categorization.
 */
export const SGDView: React.FC = () => {
  const labId = useActiveLabId()

  if (!labId) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] text-white flex items-center justify-center">
        <p className="text-white/60">Laboratório não selecionado</p>
      </div>
    )
  }

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [showImporter, setShowImporter] = useState(false)
  const [categoria, setCategoria] = useState<DICABloco | undefined>(undefined)
  const [searchTerm, setSearchTerm] = useState('')

  const { data: documentos, loading } = useSGDDocumentos(labId, { categoria })

  // Filter by search term
  const filtered = documentos.filter((doc) =>
    doc.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // KPI calculations
  const totalDocs = documentos.length
  const categorizedDocs = documentos.filter((d) => d.categoriaICQ).length
  const linkedDocs = documentos.filter((d) => d.linksConfirmados && d.linksConfirmados.length > 0).length

  const dicqBlocos: DICABloco[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
  const dicqLabels: Record<DICABloco, string> = {
    A: 'Estabelecimento',
    B: 'Responsável Técnico',
    C: 'Estrutura Física',
    D: 'Recursos Humanos',
    E: 'Equipamentos',
    F: 'Qualidade Analítica',
    G: 'Pré-Analítico',
    H: 'Analítico',
    I: 'Pós-Analítico',
    J: 'Qualidade Geral'
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#141417]/50 backdrop-blur">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-semibold">Documentos Externos</h1>
              <p className="text-sm text-white/60 mt-1">
                Gerencie documentos importados do Google Drive com categorização DICQ
              </p>
            </div>
            <button
              onClick={() => setShowImporter(true)}
              className="bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Importar do Drive
            </button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <p className="text-white/60 text-sm font-medium mb-1">Total</p>
              <p className="text-3xl font-semibold">{totalDocs}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <p className="text-white/60 text-sm font-medium mb-1">Categorizados</p>
              <p className="text-3xl font-semibold">{categorizedDocs}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <p className="text-white/60 text-sm font-medium mb-1">Vinculados</p>
              <p className="text-3xl font-semibold">{linkedDocs}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="px-6 py-4 border-b border-white/10 bg-[#141417]/30 backdrop-blur">
        <div className="flex gap-4 items-center">
          {/* Search */}
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-white/40 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoria || ''}
            onChange={(e) => setCategoria((e.target.value as DICABloco) || undefined)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition-colors"
          >
            <option value="">Todos os Blocos DICQ</option>
            {dicqBlocos.map((bloco) => (
              <option key={bloco} value={bloco}>
                Bloco {bloco} — {dicqLabels[bloco]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents List */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-white/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-white/60">Nenhum documento encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} onSelect={() => setSelectedDocId(doc.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Viewer Modal */}
      {selectedDocId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#141417] border border-white/10 rounded-xl w-full h-5/6 max-w-4xl overflow-hidden flex flex-col">
            <SGDViewer
              labId={labId}
              docId={selectedDocId}
              onClose={() => setSelectedDocId(null)}
            />
          </div>
        </div>
      )}

      {/* Import Wizard Modal */}
      {showImporter && (
        <DriveImporterWizard
          labId={labId}
          onComplete={(count) => {
            setShowImporter(false)
            // TODO: show toast "X documentos importados"
          }}
          onCancel={() => setShowImporter(false)}
        />
      )}
    </div>
  )
}

// Document Row Component
const DocumentRow: React.FC<{
  doc: SGDDocumento
  onSelect: () => void
}> = ({ doc, onSelect }) => {
  const dicqLabels: Record<DICABloco, string> = {
    A: 'Estabelecimento',
    B: 'Responsável Técnico',
    C: 'Estrutura Física',
    D: 'Recursos Humanos',
    E: 'Equipamentos',
    F: 'Qualidade Analítica',
    G: 'Pré-Analítico',
    H: 'Analítico',
    I: 'Pós-Analítico',
    J: 'Qualidade Geral'
  }

  return (
    <button
      onClick={onSelect}
      className="w-full text-left bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg p-4 transition-colors group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white group-hover:text-violet-300 transition-colors truncate">
            {doc.titulo}
          </p>
          {doc.descricao && <p className="text-sm text-white/60 mt-1 line-clamp-1">{doc.descricao}</p>}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {doc.categoriaICQ && (
            <span className="inline-block bg-violet-900/30 text-violet-200 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
              {dicqLabels[doc.categoriaICQ]}
            </span>
          )}

          {doc.linksConfirmados && doc.linksConfirmados.length > 0 && (
            <span className="inline-block bg-emerald-900/30 text-emerald-200 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
              {doc.linksConfirmados.length} link
              {doc.linksConfirmados.length !== 1 ? 's' : ''}
            </span>
          )}

          <svg className="w-4 h-4 text-white/40 group-hover:text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  )
}
