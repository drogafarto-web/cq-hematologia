import React, { useState, useEffect } from 'react';

export const AuthWrapper: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simula tempo de carregamento
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-xl font-semibold text-gray-600">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white shadow-md rounded-lg text-center">
        <h1 className="text-2xl font-bold mb-4">Tela de Login Básica</h1>
        <p className="text-gray-600 mb-6">Autenticação em construção...</p>
        <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Entrar (Fake)
        </button>
      </div>
    </div>
  );
};
