import { useState } from 'react';
import ReviewForm from './ReviewForm';
import ReviewHistory from './ReviewHistory';
import ReviewDetail from './ReviewDetail';
import AminutesEditor from './AminutesEditor';
import { useFetchManagementReview } from '../hooks/useManagementReview';
import { ManagementReview } from '../types';

/**
 * ManagementReviewDashboard
 * Main container component for management review module
 *
 * Tabs:
 * 1. Nova Revisão (create form)
 * 2. Histórico (past reviews)
 * 3. Atas (meeting minutes)
 */

type TabType = 'new' | 'history' | 'atas' | 'detail';

interface ViewState {
  tab: TabType;
  selectedReviewId?: string | null;
}

export default function ManagementReviewDashboard() {
  const [view, setView] = useState<ViewState>({ tab: 'new' });
  const { review: selectedReview, loading: reviewLoading } = useFetchManagementReview(
    view.selectedReviewId || null
  );

  const handleSelectReview = (reviewId: string) => {
    setView({ tab: 'detail', selectedReviewId: reviewId });
  };

  const handleSubmitReview = (reviewId: string) => {
    setView({ tab: 'detail', selectedReviewId: reviewId });
  };

  const handleBackToHistory = () => {
    setView({ tab: 'history', selectedReviewId: undefined });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0d] via-[#141417] to-[#0a0a0d] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">
            Análise Crítica pela Direção
          </h1>
          <p className="text-white/60">
            DICQ 4.15 — Gestão de Revisões Anuais e Atas de Reunião
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-white/10">
          <button
            onClick={() => setView({ tab: 'new' })}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              view.tab === 'new'
                ? 'text-white border-b-violet-500'
                : 'text-white/60 border-b-transparent hover:text-white'
            }`}
          >
            Nova Revisão
          </button>

          <button
            onClick={() => setView({ tab: 'history' })}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              view.tab === 'history'
                ? 'text-white border-b-violet-500'
                : 'text-white/60 border-b-transparent hover:text-white'
            }`}
          >
            Histórico
          </button>

          <button
            onClick={() => setView({ tab: 'atas' })}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              view.tab === 'atas'
                ? 'text-white border-b-violet-500'
                : 'text-white/60 border-b-transparent hover:text-white'
            }`}
          >
            Atas de Reunião
          </button>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {/* New Review Tab */}
          {view.tab === 'new' && (
            <ReviewForm
              mode="create"
              onSubmitSuccess={handleSubmitReview}
              onCancel={() => setView({ tab: 'history' })}
            />
          )}

          {/* History Tab */}
          {view.tab === 'history' && (
            <ReviewHistory onSelectReview={handleSelectReview} />
          )}

          {/* Atas Tab */}
          {view.tab === 'atas' && (
            <div className="space-y-6">
              <div className="bg-[#141417] rounded-lg border border-white/5 p-8">
                <h2 className="text-2xl font-semibold text-white mb-6">
                  Atas de Reunião
                </h2>

                <div className="grid grid-cols-1 gap-4">
                  {/* Create new ata */}
                  <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                    <AminutesEditor
                      mode="create"
                      onSave={(ata) => {
                        console.log('Ata salva:', ata);
                        // Call service to save
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detail Tab */}
          {view.tab === 'detail' && selectedReview && !reviewLoading && (
            <ReviewDetail
              review={selectedReview}
              onClose={handleBackToHistory}
              onEdit={() => {
                // Switch to edit mode
                console.log('Edit review:', selectedReview.id);
              }}
            />
          )}

          {view.tab === 'detail' && reviewLoading && (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto mb-4"></div>
                <p className="text-white/70">Carregando revisão...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
