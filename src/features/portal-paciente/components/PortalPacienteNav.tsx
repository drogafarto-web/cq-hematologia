/**
 * PortalPacienteNav
 * Top navigation bar — patient name, lab name, logout
 */

import React from 'react';

interface PortalPacienteNavProps {
  patientName: string;
  labName: string;
  onLogout: () => void;
}

export const PortalPacienteNav: React.FC<PortalPacienteNavProps> = ({
  patientName,
  labName,
  onLogout,
}) => {
  return (
    <nav className="border-b border-white/8 bg-white/2 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        {/* Left: Patient + Lab info */}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/60">Paciente</p>
          <p className="text-sm font-medium text-white/95 truncate">{patientName}</p>
          <p className="text-xs text-white/50 mt-0.5">{labName}</p>
        </div>

        {/* Right: Logout button */}
        <button
          onClick={onLogout}
          className="ml-4 px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white/95 border border-white/10 hover:border-white/30 rounded-lg transition-colors"
        >
          Sair
        </button>
      </div>
    </nav>
  );
};
