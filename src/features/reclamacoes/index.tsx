import React, { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ReclamacaoDashboard } from './components/ReclamacaoDashboard';

interface ReclamacoesViewProps {
  routeParams?: { id?: string };
}

export const ReclamacoesView: React.FC<ReclamacoesViewProps> = ({ routeParams }) => {
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  useEffect(() => {
    setCurrentView('reclamacoes');
  }, [setCurrentView]);

  // For now, show the dashboard
  // Detail view will be accessed via navigation
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0c0c0c] py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <ReclamacaoDashboard />
      </div>
    </div>
  );
};

export default ReclamacoesView;
