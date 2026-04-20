import React from 'react';
import BrandingPanel from './BrandingPanel';
import LoginForm from './LoginForm';

const LoginLayout: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex bg-gray-50 dark:bg-[#0B0F14]">
      {/* Left Panel: Branding (hidden on mobile) */}
      <BrandingPanel />

      {/* Right Panel: Login Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <LoginForm />
      </div>
    </div>
  );
};

export default LoginLayout;
