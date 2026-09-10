import React, { useState, useEffect } from 'react';
import {
  Wine,
  Lock,
  Mail,
  User,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkerBranding } from '../../context/BrandingContext';
import { supabase } from '../../lib/supabase';

export const LoginView: React.FC = () => {
  const { signIn, signUpAdmin, accountTerminationNotice, clearTerminationNotice } = useAuth();
  const { workerPosName } = useWorkerBranding();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Email verification instruction screen state
  const [verificationSentEmail, setVerificationSentEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Check URL for email verification errors (e.g. otp_expired)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      if (hash.includes('error=') || search.includes('error=')) {
        const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : search);
        const desc = params.get('error_description') || params.get('error') || 'Verification link expired or invalid.';
        setErrorMsg(`Email Verification: ${desc.replace(/\+/g, ' ')}`);
        // Clean URL params
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Cooldown countdown timer for resending email
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const displayNotice = errorMsg || accountTerminationNotice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setResendStatus(null);

    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          setErrorMsg('Full Name is required for administrator setup.');
          setLoading(false);
          return;
        }

        const res = await signUpAdmin(email, password, fullName);
        if (res.error) {
          setErrorMsg(res.error);
        } else if (res.needsEmailVerification) {
          setVerificationSentEmail(email.trim());
          setResendCooldown(60);
        }
      } else {
        const res = await signIn(email, password);
        if (res.error) {
          setErrorMsg(res.error);
          if (res.needsEmailVerification) {
            setVerificationSentEmail(email.trim());
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!verificationSentEmail || resendCooldown > 0 || resending) return;

    setResending(true);
    setResendStatus(null);
    try {
      const emailRedirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: verificationSentEmail,
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        setResendStatus(`Failed to resend: ${error.message}`);
      } else {
        setResendStatus('A fresh confirmation link has been sent to your inbox.');
        setResendCooldown(60);
      }
    } catch (err: any) {
      setResendStatus(`Error: ${err?.message || 'Unable to resend email'}`);
    } finally {
      setResending(false);
    }
  };

  const handleDemoAdminLogin = () => {
    setEmail('admin@munajbar.com');
    setPassword('Admin123456!');
  };

  // Step 6: Verification instruction screen
  if (verificationSentEmail) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#FFFFFF] flex flex-col justify-center items-center px-4 py-12 selection:bg-[#22C55E]/30">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl shadow-emerald-950/30 mb-4">
              <Wine className="w-7 h-7 text-[#22C55E]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-sans">
              {workerPosName}
            </h1>
            <p className="text-xs uppercase tracking-[0.25em] text-[#22C55E] font-bold mt-1">
              Admin & Management Portal
            </p>
          </div>

          <div className="bg-[#111111] rounded-3xl border border-zinc-800/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center mx-auto text-[#22C55E] shadow-xl shadow-emerald-950/40">
              <Mail className="w-8 h-8" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-800/80 text-[#22C55E] text-[11px] font-bold uppercase tracking-wider mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verification Link Sent</span>
              </div>
              <h2 className="text-xl font-black text-white">Check Your Email</h2>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                We sent a confirmation link to:
              </p>
              <div className="mt-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-xs text-emerald-400 break-all select-all">
                {verificationSentEmail}
              </div>
              <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                Please check your inbox (and spam folder) and click <strong className="text-white">Verify Email</strong> to activate your administrator account and enter MUNAJ BAR.
              </p>
            </div>

            {resendStatus && (
              <div
                className={`p-3 rounded-xl border text-xs text-left ${
                  resendStatus.includes('Failed') || resendStatus.includes('Error')
                    ? 'bg-red-950/50 border-red-800/70 text-red-300'
                    : 'bg-emerald-950/50 border-emerald-800/70 text-emerald-300'
                }`}
              >
                {resendStatus}
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending || resendCooldown > 0}
                className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                <span>
                  {resendCooldown > 0
                    ? `Resend available in ${resendCooldown}s`
                    : resending
                    ? 'Sending...'
                    : 'Resend Verification Email'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setVerificationSentEmail(null);
                  setIsSignUp(false);
                  setErrorMsg(null);
                }}
                className="w-full py-2.5 rounded-xl text-zinc-400 hover:text-white font-medium text-xs transition-colors"
              >
                ← Back to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#FFFFFF] flex flex-col justify-center items-center px-4 py-12 selection:bg-[#22C55E]/30">
      {/* Background Subtle Gradient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl shadow-emerald-950/30 mb-4">
            <Wine className="w-7 h-7 text-[#22C55E]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-sans">
            {workerPosName}
          </h1>
          <p className="text-xs uppercase tracking-[0.25em] text-[#22C55E] font-bold mt-1">
            Admin & Management Portal
          </p>
          <p className="text-xs text-zinc-400 mt-2 max-w-xs mx-auto leading-relaxed">
            Centralized control center for realtime sales, inventory auditing, cashier shifts, and thermal receipts.
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[#111111] rounded-3xl border border-zinc-800/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-zinc-800/80">
            <div>
              <h2 className="text-sm font-bold text-white">
                {isSignUp ? 'Initialize Administrator Account' : 'Administrative Sign In'}
              </h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {isSignUp ? 'Setup master admin credentials' : 'Enter your staff credentials to proceed'}
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-[#22C55E]" />
          </div>

          {displayNotice && (
            <div
              className={`p-3.5 mb-5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                accountTerminationNotice
                  ? 'bg-amber-950/70 border-amber-800/90 text-amber-200'
                  : 'bg-red-950/60 border-red-800/80 text-red-300'
              }`}
            >
              <AlertCircle
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  accountTerminationNotice ? 'text-amber-400' : 'text-red-400'
                }`}
              />
              <div className="leading-relaxed flex-1">{displayNotice}</div>
              {accountTerminationNotice && (
                <button
                  type="button"
                  onClick={() => clearTerminationNotice()}
                  className="text-[11px] text-amber-400/80 hover:text-amber-200 underline shrink-0 ml-1"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Chief Admin / Bar General Manager"
                    required={isSignUp}
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@munajbar.com"
                  required
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-[#22C55E] text-white text-xs outline-none transition-colors font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#22C55E] hover:bg-[#1ea750] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/40 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>{isSignUp ? 'Create Admin & Enter' : 'Enter Admin Control Panel'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle between Sign In & Admin Setup */}
          <div className="mt-5 pt-4 border-t border-zinc-800/80 text-center flex items-center justify-between text-xs text-zinc-400">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
                setResendStatus(null);
              }}
              className="text-[#22C55E] hover:underline font-semibold"
            >
              {isSignUp ? '← Back to Sign In' : 'Setup Initial Admin Account →'}
            </button>

            <button
              type="button"
              onClick={handleDemoAdminLogin}
              className="text-zinc-500 hover:text-zinc-300 text-[11px] underline"
            >
              Fill Sample Admin
            </button>
          </div>
        </div>

        {/* POS Distinction Disclaimer */}
        <div className="mt-6 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/60 text-center text-xs text-zinc-400 flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 text-zinc-500 mt-0.5" />
          <p className="text-left text-[11px] leading-relaxed">
            <strong className="text-white font-semibold">Security Note:</strong> Only accounts with{' '}
            <span className="text-[#22C55E] font-semibold">admin</span> or{' '}
            <span className="text-blue-400 font-semibold">manager</span> roles can sign in here.
            Floor cashiers and bar sales workers must authenticate via the {workerPosName} POS Terminal.
          </p>
        </div>
      </div>
    </div>
  );
};
