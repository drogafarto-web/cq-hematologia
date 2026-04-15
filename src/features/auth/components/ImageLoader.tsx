import React, { useState } from 'react';

interface ImageLoaderProps {
    className?: string;
}

const ImageLoader: React.FC<ImageLoaderProps> = ({ className = '' }) => {
    const [isLoaded, setIsLoaded] = useState(false);

    const handleImageLoad = () => {
        setIsLoaded(true);
    };

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {/* LQIP placeholder with blur */}
            <img
                src="/assets/login-low.webp"
                alt=""
                className="absolute inset-0 w-full h-full object-cover filter blur-[20px] scale-105"
                aria-hidden
            />

            {/* Main responsive image */}
            <picture>
                <source media="(max-width: 768px)" srcSet="/assets/login-mobile.webp" />
                <img
                    src="/assets/login.webp"
                    alt="CQ Labclin - Login Background"
                    className={`w-full h-full object-cover transition-opacity duration-600 ${isLoaded ? 'opacity-100' : 'opacity-0'
                        }`}
                    onLoad={handleImageLoad}
                />
            </picture>
        </div>
    );
};

export default ImageLoader;
