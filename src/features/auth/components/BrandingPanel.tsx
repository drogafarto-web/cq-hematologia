import React from 'react';

const BrandingPanel: React.FC = () => {
    return (
        <div className="login-branding-bg hidden lg:flex flex-col relative w-full lg:w-[55%] overflow-hidden">
            {/* Content */}
            <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-12">
                {/* Logo */}
                <div className="flex-shrink-0">
                    <img
                        src="/assets/labclin-logo.png"
                        alt="LabClin Logo"
                        className="h-12 w-auto object-contain"
                        onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                    />
                </div>

                {/* Center text block */}
                <div className="flex-1 flex items-center justify-center text-center px-4">
                    <div className="px-8 py-6 rounded-2xl backdrop-blur-md bg-black/25 border border-white/10 shadow-2xl">
                        <h2 className="login-branding-headline text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                            Precisão em cada análise
                        </h2>
                        <p className="text-lg lg:text-xl text-white/85 leading-relaxed">
                            Controle de qualidade laboratorial com confiança e tecnologia
                        </p>
                    </div>
                </div>

                {/* Badge row at bottom */}
                <div className="flex-shrink-0 flex gap-4 justify-center flex-wrap">
                    <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                        <span className="text-white/90 text-sm font-medium">🔬 Precisão</span>
                    </div>
                    <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                        <span className="text-white/90 text-sm font-medium">📊 Confiabilidade</span>
                    </div>
                    <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                        <span className="text-white/90 text-sm font-medium">🛡️ Segurança</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrandingPanel;
