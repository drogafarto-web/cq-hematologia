import React from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ title, message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f1115] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/70 mb-6 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel} 
            className="px-4 py-2 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={() => { onConfirm(); onCancel(); }} 
            className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-400 text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
          >
            Deletar
          </button>
        </div>
      </div>
    </div>
  );
}
