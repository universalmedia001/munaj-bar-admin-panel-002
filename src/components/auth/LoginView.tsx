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
  Eye,
  EyeOff,
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
  const [showPassword, setShowPassword] = useState(false);
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
      const emailRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}/email-verified` : undefined;
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
      <div className="min-h-screen bg-[#020604] text-[#FFFFFF] flex flex-col justify-center items-center px-4 py-12 selection:bg-[#00FF66]/30 relative overflow-hidden font-sans">
        {/* Cinematic Atmospheric Background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,#071A10_0%,#020604_65%,#000000_100%)] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,#00FF66_1px,transparent_1px),linear-gradient(to_bottom,#00FF66_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,#000_70%,transparent_100%)] pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[600px] h-[600px] bg-[#00FF66]/[0.08] rounded-full blur-[140px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* 3D Floating Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-4 flex items-center justify-center">
              <div className="absolute -inset-2 bg-black/80 rounded-3xl blur-xl transform translate-y-3" />
              <div className="absolute -inset-1 bg-gradient-to-b from-[#00FF66]/30 via-[#00D957]/15 to-transparent rounded-3xl blur-lg opacity-80" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1c2820] via-[#09170e] to-[#020704] p-[1.5px] shadow-[0_16px_36px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.25)]">
                <div className="w-full h-full rounded-[14px] bg-gradient-to-b from-[#0f2316] via-[#08160d] to-[#040b07] flex items-center justify-center border border-[#00FF66]/25 shadow-[inset_0_2px_4px_rgba(0,255,102,0.2)]">
                  <Wine className="w-9 h-9 text-[#00FF66] drop-shadow-[0_0_14px_rgba(0,255,102,0.8)]" />
                </div>
              </div>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase font-sans">
              {workerPosName}
            </h1>
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-[#00FF66] font-bold mt-1">
              Admin & Management Portal
            </p>
          </div>

          <div className="rounded-[28px] sm:rounded-[32px] bg-[#071A10]/75 border border-white/10 p-7 sm:p-9 shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(0,255,102,0.06),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-[#0a2013] border border-[#00FF66]/40 flex items-center justify-center mx-auto text-[#00FF66] shadow-[0_0_25px_rgba(0,255,102,0.25)]">
              <Mail className="w-8 h-8" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30 text-[#00FF66] text-[11px] font-bold uppercase tracking-wider mb-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verification Link Sent</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">Check Your Email</h2>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                We sent a confirmation link to:
              </p>
              <div className="mt-2 px-3 py-2 rounded-xl bg-[#020604] border border-white/10 font-mono text-xs text-[#00FF66] break-all select-all">
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
                    : 'bg-[#00FF66]/10 border-[#00FF66]/30 text-[#00FF66]'
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
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00FF66] via-[#00E55C] to-[#00B84A] text-black font-extrabold text-xs uppercase tracking-wider transition-all shadow-[0_4px_20px_rgba(0,255,102,0.3)] hover:brightness-105 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
                className="w-full py-2.5 rounded-xl text-zinc-400 hover:text-white font-medium text-xs transition-colors cursor-pointer"
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
    <div className="min-h-screen bg-[#020604] text-[#FFFFFF] flex flex-col justify-center items-center px-4 py-10 sm:py-14 selection:bg-[#00FF66]/30 relative overflow-hidden font-sans">
      {/* Layer 1: Atmospheric Cinematic Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,#071A10_0%,#020604_65%,#000000_100%)] pointer-events-none" />

      {/* Layer 2: Subtle Architectural Space Grid */}
      <div className="absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,#00FF66_1px,transparent_1px),linear-gradient(to_bottom,#00FF66_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Layer 3: Neon Green Ambient Lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[620px] h-[620px] bg-[#00FF66]/[0.09] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-[#00D957]/[0.05] rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[260px] bg-[#00B84A]/[0.03] rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* MUNAJ BAR 3D Floating Dimensional Logo */}
        <div className="flex flex-col items-center mb-6 sm:mb-8 group">
          <div className="relative mb-3.5 flex items-center justify-center">
            {/* Soft Ambient Depth Shadow */}
            <div className="absolute -inset-3 bg-black/90 rounded-3xl blur-xl transform translate-y-3.5" />
            {/* Neon Green Ambient Aura */}
            <div className="absolute -inset-1.5 bg-gradient-to-b from-[#00FF66]/35 via-[#00D957]/20 to-transparent rounded-3xl blur-lg opacity-80 group-hover:opacity-100 transition-opacity" />

            {/* 3D Beveled Outer Metallic Shield */}
            <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-gradient-to-br from-[#1c2820] via-[#09170e] to-[#020704] p-[1.5px] shadow-[0_16px_36px_rgba(0,0,0,0.95),inset_0_1px_1px_rgba(255,255,255,0.28)]">
              {/* Inner Metallic Facet */}
              <div className="w-full h-full rounded-[14px] bg-gradient-to-b from-[#0f2316] via-[#08160d] to-[#040b07] flex items-center justify-center border border-[#00FF66]/25 shadow-[inset_0_2px_4px_rgba(0,255,102,0.25),inset_0_-2px_4px_rgba(0,0,0,0.8)] relative overflow-hidden">
                {/* Metallic Sheen Highlight */}
                <div className="absolute -top-6 left-0 right-0 h-10 bg-gradient-to-b from-white/15 to-transparent transform -skew-y-12 pointer-events-none" />
                {/* Glowing Neon Green Logo Motif */}
                <Wine className="w-9 h-9 sm:w-10 sm:h-10 text-[#00FF66] drop-shadow-[0_0_14px_rgba(0,255,102,0.85)]" />
              </div>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-black tracking-widest text-white uppercase font-sans drop-shadow-md">
            {workerPosName}
          </h1>
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em] text-[#00FF66] font-bold mt-1 drop-shadow-[0_0_8px_rgba(0,255,102,0.4)]">
            Admin & Management Portal
          </p>
        </div>

        {/* Premium Glassmorphism Card */}
        <div className="relative rounded-[28px] sm:rounded-[32px] bg-[#071A10]/75 border border-white/10 p-7 sm:p-9 shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(0,255,102,0.06),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl">
          {/* Subtle Top Rim Highlight */}
          <div className="absolute top-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-[#00FF66]/50 to-transparent pointer-events-none" />

          {/* Heading */}
          <div className="text-center mb-7">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isSignUp ? (
                <>
                  Initialize{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF66] via-[#00E55C] to-[#00D957] drop-shadow-[0_0_12px_rgba(0,255,102,0.4)]">
                    Admin
                  </span>
                </>
              ) : (
                <>
                  Welcome{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00FF66] via-[#00E55C] to-[#00D957] drop-shadow-[0_0_12px_rgba(0,255,102,0.4)]">
                    Back
                  </span>
                </>
              )}
            </h2>
            <p className="text-xs text-zinc-400 mt-1.5 font-medium">
              {isSignUp
                ? 'Setup master administrator credentials'
                : 'Sign in to continue to your management portal'}
            </p>
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
                  className="text-[11px] text-amber-400/80 hover:text-amber-200 underline shrink-0 ml-1 cursor-pointer"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isSignUp && (
              <div className="relative rounded-2xl bg-[#0A0D0C]/80 border border-white/[0.08] hover:border-white/[0.16] focus-within:border-[#00FF66] focus-within:ring-1 focus-within:ring-[#00FF66]/40 focus-within:bg-[#071A10]/90 transition-all p-3 sm:py-3 sm:px-4 flex items-center gap-3.5 shadow-inner group">
                <User className="w-5 h-5 text-zinc-500 group-focus-within:text-[#00FF66] transition-colors shrink-0" />
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] font-semibold text-zinc-400 tracking-wide uppercase group-focus-within:text-[#00FF66] transition-colors">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Chief Admin / Bar General Manager"
                    required={isSignUp}
                    className="w-full bg-transparent text-white text-xs sm:text-sm font-normal outline-none placeholder:text-zinc-600 font-sans"
                  />
                </div>
              </div>
            )}

            {/* Email Address Input Container */}
            <div className="relative rounded-2xl bg-[#0A0D0C]/80 border border-white/[0.08] hover:border-white/[0.16] focus-within:border-[#00FF66] focus-within:ring-1 focus-within:ring-[#00FF66]/40 focus-within:bg-[#071A10]/90 transition-all p-3 sm:py-3 sm:px-4 flex items-center gap-3.5 shadow-inner group">
              <Mail className="w-5 h-5 text-zinc-500 group-focus-within:text-[#00FF66] transition-colors shrink-0" />
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-semibold text-zinc-400 tracking-wide uppercase group-focus-within:text-[#00FF66] transition-colors">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full bg-transparent text-white text-xs sm:text-sm font-normal outline-none placeholder:text-zinc-600 font-sans"
                />
              </div>
            </div>

            {/* Password Input Container */}
            <div className="relative rounded-2xl bg-[#0A0D0C]/80 border border-white/[0.08] hover:border-white/[0.16] focus-within:border-[#00FF66] focus-within:ring-1 focus-within:ring-[#00FF66]/40 focus-within:bg-[#071A10]/90 transition-all p-3 sm:py-3 sm:px-4 flex items-center gap-3.5 shadow-inner group">
              <Lock className="w-5 h-5 text-zinc-500 group-focus-within:text-[#00FF66] transition-colors shrink-0" />
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-semibold text-zinc-400 tracking-wide uppercase group-focus-within:text-[#00FF66] transition-colors">
                  Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-transparent text-white text-xs sm:text-sm font-normal outline-none font-mono placeholder:text-zinc-600"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
                className="text-zinc-500 hover:text-white transition-colors cursor-pointer p-1"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-end pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(
                    'To reset your password, contact your master administrator or configure Supabase recovery for admin@munajbar.com'
                  );
                }}
                className="text-xs text-zinc-400 hover:text-[#00FF66] transition-colors font-medium cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            {/* Large Premium Sign-In Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-[#00FF66] via-[#00E55C] to-[#00B84A] hover:from-[#14ff73] hover:to-[#00c850] text-black font-extrabold text-sm tracking-wide transition-all shadow-[0_6px_25px_rgba(0,255,102,0.35)] hover:shadow-[0_8px_35px_rgba(0,255,102,0.5)] hover:brightness-105 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>

          {/* "or continue with" Divider */}
          <div className="relative flex items-center justify-center my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.08]" />
            </div>
            <div className="relative px-3 bg-[#071A10] text-[11px] uppercase tracking-wider text-zinc-400 font-medium">
              or continue with
            </div>
          </div>

          {/* Social Login Area */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {/* Google */}
            <button
              type="button"
              onClick={() =>
                setErrorMsg(
                  'Single Sign-On (Google Workspace) is reserved for domain managers. Use your email & password or Fill Sample Admin.'
                )
              }
              className="h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-[#00FF66]/50 hover:bg-white/[0.06] hover:shadow-[0_0_15px_rgba(0,255,102,0.2)] transition-all flex items-center justify-center cursor-pointer group"
              title="Sign in with Google"
            >
              <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
            </button>

            {/* GitHub */}
            <button
              type="button"
              onClick={() =>
                setErrorMsg(
                  'Single Sign-On (GitHub Enterprise) is reserved for domain managers. Use your email & password or Fill Sample Admin.'
                )
              }
              className="h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-[#00FF66]/50 hover:bg-white/[0.06] hover:shadow-[0_0_15px_rgba(0,255,102,0.2)] transition-all flex items-center justify-center cursor-pointer group"
              title="Sign in with GitHub"
            >
              <svg
                className="w-5 h-5 fill-current text-white/80 group-hover:text-white transition-all group-hover:scale-110"
                viewBox="0 0 24 24"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            </button>

            {/* LinkedIn */}
            <button
              type="button"
              onClick={() =>
                setErrorMsg(
                  'Single Sign-On (LinkedIn) is reserved for domain managers. Use your email & password or Fill Sample Admin.'
                )
              }
              className="h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-[#00FF66]/50 hover:bg-white/[0.06] hover:shadow-[0_0_15px_rgba(0,255,102,0.2)] transition-all flex items-center justify-center cursor-pointer group"
              title="Sign in with LinkedIn"
            >
              <svg className="w-5 h-5 fill-current text-[#00FF66] group-hover:text-white transition-all group-hover:scale-110" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
              </svg>
            </button>
          </div>

          {/* Sign Up Footer */}
          <div className="text-center pt-1 border-t border-white/[0.06]">
            <p className="text-xs text-zinc-400 mt-4">
              {isSignUp ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(false);
                      setErrorMsg(null);
                    }}
                    className="text-[#00FF66] font-semibold hover:underline cursor-pointer ml-1"
                  >
                    Sign In
                  </button>
                </>
              ) : (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(true);
                      setErrorMsg(null);
                    }}
                    className="text-[#00FF66] font-semibold hover:underline cursor-pointer ml-1"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </p>

            {/* Quick Fill Sample Admin for demo & testing */}
            <button
              type="button"
              onClick={handleDemoAdminLogin}
              className="mt-3 text-[11px] text-zinc-500 hover:text-[#00FF66] underline cursor-pointer transition-colors"
            >
              Fill Sample Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
