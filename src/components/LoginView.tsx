import React, { useState, useEffect } from 'react';
import { Lock, Mail, AlertCircle, LogIn, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkerBranding } from '../context/WorkerBrandingContext';
import { getSupabase } from '../lib/supabase';

export const LoginView: React.FC = () => {
  const { signIn, error: authError, clearError } = useAuth();
  const { workerSiteName, workerPrimaryColor, textColor, businessLogo } = useWorkerBranding();
  const [logoImgError, setLogoImgError] = useState(false);

  useEffect(() => {
    setLogoImgError(false);
  }, [businessLogo]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isForgotMode, setIsForgotMode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);
    clearError();

    if (!email || !password) {
      setLocalError('Please enter your email and password.');
      return;
    }

    try {
      setIsLoading(true);
      await signIn(email.trim(), password);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setLocalError('Please enter your email address.');
      return;
    }
    try {
      setIsLoading(true);
      setLocalError(null);
      const supabase = getSupabase();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setSuccessMessage('Password reset link sent to your email.');
      setIsForgotMode(false);
    } catch (err: any) {
      setLocalError(err.message || 'Could not send reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  const errorToShow = localError || authError;

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          {businessLogo && !logoImgError ? (
            <div 
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl shadow-xl mb-4 bg-[#141414] border border-[#2A2A2A] p-2"
              style={{
                boxShadow: `0 10px 25px -5px rgba(var(--worker-primary-rgb, 183, 255, 0), 0.25)`,
              }}
            >
              <img
                src={businessLogo}
                alt={workerSiteName}
                className="w-full h-full object-contain rounded-xl"
                referrerPolicy="no-referrer"
                onError={() => setLogoImgError(true)}
              />
            </div>
          ) : (
            <div 
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-xl font-black text-3xl mb-4 border"
              style={{
                backgroundColor: workerPrimaryColor,
                color: textColor,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                boxShadow: `0 10px 25px -5px rgba(var(--worker-primary-rgb, 183, 255, 0), 0.3)`,
              }}
            >
              {workerSiteName.charAt(0).toUpperCase() || 'M'}
            </div>
          )}
          <h1 className="text-3xl font-black text-white tracking-wider">
            {workerSiteName}
          </h1>
          <div 
            className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-widest border"
            style={{
              backgroundColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.15)',
              borderColor: 'rgba(var(--worker-primary-rgb, 183, 255, 0), 0.35)',
              color: workerPrimaryColor,
            }}
          >
            Worker POS
          </div>
          <p className="text-sm text-[#A1A1AA] mt-2">
            Authorized Cashier & Bar Staff Terminal
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          
          {/* Top glow accent */}
          <div 
            className="absolute top-0 left-0 right-0 h-1"
            style={{ backgroundColor: workerPrimaryColor }}
          />

          {/* Success Banner */}
          {successMessage && (
            <div className="mb-5 p-3.5 bg-green-950/40 border border-green-500/40 rounded-xl flex items-center space-x-2.5 text-green-400 text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorToShow && (
            <div className="mb-5 p-3.5 bg-red-950/40 border border-red-500/40 rounded-xl flex items-start space-x-2.5 text-red-400 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorToShow}</span>
            </div>
          )}

          {!isForgotMode ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Email Input */}
              <div>
                <label className="block text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-2">
                  Worker Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="login-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cashier@munajbar.com"
                    className="w-full bg-[#181818] border border-[#2c2c2c] focus:border-[var(--worker-primary)] text-white rounded-xl pl-10 pr-4 py-3 text-sm transition-colors outline-hidden"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(true);
                      setLocalError(null);
                    }}
                    style={{ color: workerPrimaryColor }}
                    className="text-xs hover:opacity-80 font-medium transition-opacity cursor-pointer"
                  >
                    FORGOT PASSWORD?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="login-password-input"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#181818] border border-[#2c2c2c] focus:border-[var(--worker-primary)] text-white rounded-xl pl-10 pr-4 py-3 text-sm transition-colors outline-hidden"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                style={{
                  backgroundColor: workerPrimaryColor,
                  color: textColor,
                  boxShadow: `0 8px 20px -4px rgba(var(--worker-primary-rgb, 183, 255, 0), 0.35)`,
                }}
                className="w-full font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all flex items-center justify-center space-x-2 mt-6 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span>VERIFYING CREDENTIALS...</span>
                  </div>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>SIGN IN</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <h3 className="text-white font-bold text-base mb-1">Reset Password</h3>
              <p className="text-xs text-[#A1A1AA] mb-4">
                Enter your registered worker email to receive recovery instructions.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#A1A1AA] uppercase tracking-wider mb-2">
                  Worker Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#71717A]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cashier@munajbar.com"
                    className="w-full bg-[#181818] border border-[#2c2c2c] focus:border-[var(--worker-primary)] text-white rounded-xl pl-10 pr-4 py-3 text-sm transition-colors outline-hidden"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotMode(false);
                    setLocalError(null);
                  }}
                  className="flex-1 bg-[#1c1c1c] hover:bg-[#262626] text-[#A1A1AA] font-bold py-3 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Back to Login
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    backgroundColor: workerPrimaryColor,
                    color: textColor,
                  }}
                  className="flex-1 font-bold py-3 rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? 'Sending...' : 'Send Link'}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Security Notice Footer */}
        <p className="text-center text-[11px] text-[#52525B] mt-6">
          {workerSiteName} POS • Secure Authentication
        </p>

      </div>
    </div>
  );
};
