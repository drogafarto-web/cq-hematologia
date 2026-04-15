import React from 'react';
import ImageLoader from './ImageLoader';

const BrandingPanel: React.FC = () => {
    return (
        <div className="hidden lg:flex flex-col relative w-full lg:w-[55%] bg-[#0B0F14] overflow-hidden">
            {/* Background image with overlay */}
            <div className="absolute inset-0">
                <ImageLoader className="w-full h-full" />
                {/* Dark gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-[rgba(11,15,20,0.35)] via-[rgba(11,15,20,0.45)] to-[rgba(11,15,20,0.50)]" />
            </div>

            {/* Content */}
            <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-12">
                {/* Logo — wrapped in white pill so the PNG's white background is intentional */}
                <div className="flex-shrink-0 inline-flex items-center bg-white/95 rounded-lg px-3 py-2 shadow-md">
                    <img
                        src="/assets/labclin-logo.png"
                        alt="CQ Labclin"
                        className="h-9 w-auto object-contain"
                        onError={(e) => {
                            // Hide broken-image placeholder if file can't load
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                    />
                </div>

                {/* Center text block */}
                <div className="flex-1 flex items-center justify-center text-center px-4">
                    <div>
                        <h2 className="text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                            Precisão em cada análise
                        </h2>
                        <p className="text-lg lg:text-xl text-white/80 leading-relaxed">
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
