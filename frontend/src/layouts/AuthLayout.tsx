import React from 'react';
import { Outlet } from 'react-router-dom';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white">GravyStream</h1>
          <p className="mt-2 text-primary-200">Omnichannel CRM Platform</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <Outlet />
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-primary-200">
          Self-hosted customer support platform
        </p>
      </div>
    </div>
  );
};

export default AuthLayout;
