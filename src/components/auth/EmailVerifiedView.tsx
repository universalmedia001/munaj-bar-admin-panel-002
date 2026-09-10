import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Wine, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { VerifiedEmailAnimation } from './VerifiedEmailAnimation';
import { useWorkerBranding } from '../../context/BrandingContext';
import { supabase } from '../../lib/supabase';

interface EmailVerifiedViewProps {
  onNavigateToLogin?: () => void;
}

export const EmailVerifiedView: React.FC<EmailVerifiedViewProps> = ({ onNavigateToLogin }) => {
  const { workerPosName } = useWorkerBranding();
  const shouldReduceMotion = useReducedMotion();
  const [navigating, setNavigating] = useState(false);

  // Automatically exchange code if redirected with PKCE query parameter
  useEffect(() => {
    const processExchange = async () => {
      try {
        if (typeof window !== 'undefined' && window.location.search) {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          if (code) {
            console.log('[MUNAJ Auth] Exchanging confirmation code on /email-verified...');
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              console.warn('[MUNAJ Auth] Code exchange note on /email-verified:', error.message);
            } else {
              console.log('[MUNAJ Auth] Email successfully confirmed via code exchange.');
            }
          }
        }
      } catch (err) {
        console.warn('[MUNAJ Auth] Code exchange exception on verified page:', err);
      }
    };

    processExchange();
  }, []);

  const handleGoToLogin = async () => {
    if (navigating) return;
    setNavigating(true);

    try {
      // Sign out any temporary active session established by the verification link
      // so the user lands cleanly on the existing MUNAJ BAR login form to log in
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[MUNAJ Auth] Signout notice before login transition:', e);
    }

    // Clean up any remaining URL search or hash fragments
    if (typeof window !== 'undefined') {
      try {
        window.history.replaceState({}, document.title, '/');
      } catch {
        // ignore
      }
    }

    if (onNavigateToLogin) {
      onNavigateToLogin();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const brandName = workerPosName || 'MUNAJ BAR';

  return (
    <div className="min-h-screen bg-[#050505] text-[#FFFFFF] flex flex-col justify-center items-center px-4 py-12 selection:bg-[#22C55E]/30 relative overflow-hidden font-sans">
      {/* Background Subtle Gradient Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-6 sm:mb-8"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl shadow-emerald-950/30 mb-3">
            <Wine className="w-7 h-7 text-[#22C55E]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-sans">
            {brandName}
          </h2>
          <p className="text-xs uppercase tracking-[0.25em] text-[#22C55E] font-bold mt-1">
            Admin & Management Portal
          </p>
        </motion.div>

        {/* Verification Success Card */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[#111111] rounded-3xl border border-zinc-800/90 p-6 sm:p-9 shadow-2xl backdrop-blur-xl text-center"
        >
          {/* Top Verification Status Badge */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-800/80 text-[#22C55E] text-[11px] font-bold uppercase tracking-wider mb-3"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Verification Confirmed</span>
          </motion.div>

          {/* Animated Verified-Email Vector Illustration */}
          <div className="my-3">
            <VerifiedEmailAnimation />
          </div>

          {/* Headings and Supporting Texts (Smooth Cascading Entrance) */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.45, duration: 0.5 }}
            className="space-y-2 mt-4"
          >
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Email Registered Successfully!
            </h1>
            <p className="text-xs sm:text-sm text-zinc-300 font-medium leading-relaxed">
              Your email has been registered successfully.
            </p>
            <p className="text-xs text-zinc-400 mt-2 leading-relaxed max-w-xs mx-auto">
              Please go back to the MUNAJ BAR site and log in to continue.
            </p>
          </motion.div>

          {/* Primary Action Button */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.7, duration: 0.45 }}
            className="mt-7"
          >
            <button
              type="button"
              onClick={handleGoToLogin}
              disabled={navigating}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-[#22C55E] hover:bg-[#1ea750] text-black font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/40 hover:shadow-emerald-950/60 active:scale-[0.99] cursor-pointer disabled:opacity-50 group"
            >
              <span>{navigating ? 'Opening Login...' : 'Go to MUNAJ BAR Login'}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>

          {/* Security & System Footnote */}
          <div className="mt-6 pt-4 border-t border-zinc-800/70 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            <span>End-to-End Encrypted Authentication</span>
          </div>
        </motion.div>

        {/* Support Note */}
        <div className="mt-5 text-center text-xs text-zinc-500">
          <p>
            Need help accessing your account?{' '}
            <span className="text-zinc-400">Contact the MUNAJ BAR Chief Administrator</span>
          </p>
        </div>
      </div>
    </div>
  );
};
