import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export const VerifiedEmailAnimation: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    setHasLoaded(true);
  }, []);

  // If user prefers reduced motion, render immediate static verified state
  if (shouldReduceMotion) {
    return (
      <div className="relative w-48 h-44 sm:w-56 sm:h-48 mx-auto flex items-center justify-center select-none">
        <svg
          viewBox="0 0 220 180"
          className="w-full h-full drop-shadow-2xl overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle Glow Behind Envelope */}
          <circle cx="110" cy="90" r="70" fill="#22C55E" fillOpacity="0.12" />

          {/* Envelope Body */}
          <rect
            x="25"
            y="48"
            width="170"
            height="100"
            rx="16"
            fill="#18181B"
            stroke="#27272A"
            strokeWidth="2"
          />

          {/* Inner Letter Document peeking out */}
          <rect
            x="45"
            y="26"
            width="130"
            height="70"
            rx="8"
            fill="#27272A"
            stroke="#3F3F46"
            strokeWidth="1.5"
          />
          <line x1="60" y1="42" x2="110" y2="42" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="60" y1="52" x2="160" y2="52" stroke="#71717A" strokeWidth="2" strokeLinecap="round" />
          <line x1="60" y1="62" x2="140" y2="62" stroke="#71717A" strokeWidth="2" strokeLinecap="round" />

          {/* Envelope Flap Lines */}
          <path
            d="M 27 50 L 110 110 L 193 50"
            stroke="#3F3F46"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 27 146 L 85 96"
            stroke="#27272A"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M 193 146 L 135 96"
            stroke="#27272A"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Verification Badge */}
          <g transform="translate(145, 105)">
            <circle cx="20" cy="20" r="22" fill="#22C55E" />
            <circle cx="20" cy="20" r="22" stroke="#15803D" strokeWidth="2" />
            <path
              d="M 13 20 L 18 25 L 28 15"
              stroke="#FFFFFF"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div className="relative w-52 h-44 sm:w-60 sm:h-48 mx-auto flex items-center justify-center select-none">
      {/* Background Soft Glow Pulse */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: [0.15, 0.28, 0.15], scale: [0.95, 1.08, 0.95] }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute w-44 h-44 rounded-full bg-emerald-500/20 blur-2xl pointer-events-none"
      />

      <svg
        viewBox="0 0 240 200"
        className="w-full h-full drop-shadow-2xl overflow-visible"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="envelopeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1E1E22" />
            <stop offset="100%" stopColor="#121215" />
          </linearGradient>

          <linearGradient id="badgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="50%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#16A34A" />
          </linearGradient>

          <filter id="badgeShadow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#052e16" floodOpacity="0.6" />
          </filter>

          <filter id="softGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#000000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Floating Ambient Sparkles / Confirmation Elements */}
        {/* Sparkle 1: Top-Left */}
        <motion.g
          initial={{ scale: 0, opacity: 0, x: 30, y: 35 }}
          animate={hasLoaded ? { scale: [0, 1.2, 1], opacity: [0, 1, 0.85] } : {}}
          transition={{ delay: 0.85, duration: 0.6, ease: 'easeOut' }}
        >
          <motion.path
            d="M 35 25 Q 35 32 28 32 Q 35 32 35 39 Q 35 32 42 32 Q 35 32 35 25 Z"
            fill="#22C55E"
            animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.1, 0.95, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          />
        </motion.g>

        {/* Sparkle 2: Top-Right */}
        <motion.g
          initial={{ scale: 0, opacity: 0, x: 195, y: 22 }}
          animate={hasLoaded ? { scale: [0, 1.3, 1], opacity: [0, 1, 0.9] } : {}}
          transition={{ delay: 0.95, duration: 0.55, ease: 'easeOut' }}
        >
          <motion.path
            d="M 200 18 Q 200 25 193 25 Q 200 25 200 32 Q 200 25 207 25 Q 200 25 200 18 Z"
            fill="#4ADE80"
            animate={{ rotate: [0, -20, 20, 0], scale: [1, 1.15, 0.9, 1] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
          />
        </motion.g>

        {/* Particle Dots */}
        <motion.circle
          cx="215"
          cy="75"
          r="2.5"
          fill="#86EFAC"
          initial={{ scale: 0, opacity: 0 }}
          animate={hasLoaded ? { scale: 1, opacity: 0.7 } : {}}
          transition={{ delay: 1.1, duration: 0.4 }}
        />
        <motion.circle
          cx="24"
          cy="110"
          r="2"
          fill="#22C55E"
          initial={{ scale: 0, opacity: 0 }}
          animate={hasLoaded ? { scale: 1, opacity: 0.6 } : {}}
          transition={{ delay: 1.15, duration: 0.4 }}
        />
        <motion.circle
          cx="175"
          cy="16"
          r="2"
          fill="#34D399"
          initial={{ scale: 0, opacity: 0 }}
          animate={hasLoaded ? { scale: 1, opacity: 0.5 } : {}}
          transition={{ delay: 1.2, duration: 0.4 }}
        />

        {/* Main Floating Envelope Group */}
        <motion.g
          initial={{ opacity: 0, scale: 0.82, y: 18 }}
          animate={hasLoaded ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Subtle Gentle Idle Floating */}
          <motion.g
            animate={{ y: [0, -3.5, 0] }}
            transition={{
              repeat: Infinity,
              duration: 3.8,
              ease: 'easeInOut',
            }}
          >
            {/* Envelope Ground Shadow */}
            <ellipse cx="115" cy="165" rx="80" ry="9" fill="#000000" fillOpacity="0.35" />

            {/* Inner Letter Document (Slides out slightly upon load) */}
            <motion.g
              initial={{ y: 22, opacity: 0 }}
              animate={hasLoaded ? { y: 0, opacity: 1 } : {}}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Document Paper */}
              <rect
                x="48"
                y="30"
                width="134"
                height="80"
                rx="10"
                fill="#24242A"
                stroke="#3F3F46"
                strokeWidth="1.5"
                filter="url(#softGlow)"
              />
              {/* Document Header Bar */}
              <rect x="62" y="44" width="46" height="5" rx="2.5" fill="#22C55E" />
              {/* Document Text Lines */}
              <line x1="62" y1="58" x2="168" y2="58" stroke="#71717A" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="62" y1="70" x2="152" y2="70" stroke="#52525B" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="62" y1="82" x2="120" y2="82" stroke="#3F3F46" strokeWidth="2.5" strokeLinecap="round" />
            </motion.g>

            {/* Envelope Back Body */}
            <rect
              x="26"
              y="54"
              width="178"
              height="104"
              rx="18"
              fill="url(#envelopeGradient)"
              stroke="#3F3F46"
              strokeWidth="2"
            />

            {/* Folded Flap Lines */}
            <path
              d="M 28 56 L 115 118 L 202 56"
              stroke="#52525B"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Lower Side Seam Shadows */}
            <path
              d="M 28 156 L 92 104"
              stroke="#27272A"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M 202 156 L 138 104"
              stroke="#27272A"
              strokeWidth="1.8"
              strokeLinecap="round"
            />

            {/* Top Accent Line on Front Edge */}
            <path
              d="M 36 55 L 115 114 L 194 55"
              stroke="#22C55E"
              strokeOpacity="0.45"
              strokeWidth="1.2"
              strokeLinecap="round"
            />

            {/* Verification Badge (Pops in at lower right of envelope) */}
            <motion.g
              initial={{ scale: 0, opacity: 0 }}
              animate={hasLoaded ? { scale: 1, opacity: 1 } : {}}
              transition={{
                delay: 0.6,
                type: 'spring',
                stiffness: 420,
                damping: 22,
              }}
              transform="translate(150, 106)"
              filter="url(#badgeShadow)"
            >
              {/* Ripple Ring Expanding Once */}
              <motion.circle
                cx="24"
                cy="24"
                r="24"
                fill="none"
                stroke="#22C55E"
                strokeWidth="2"
                initial={{ scale: 0.8, opacity: 0.8 }}
                animate={hasLoaded ? { scale: 1.45, opacity: 0 } : {}}
                transition={{ delay: 0.8, duration: 0.75, ease: 'easeOut' }}
              />

              {/* Badge Outer Halo Ring */}
              <circle
                cx="24"
                cy="24"
                r="26"
                fill="#052E16"
                fillOpacity="0.4"
                stroke="#22C55E"
                strokeWidth="1"
                strokeOpacity="0.5"
              />

              {/* Badge Main Disc */}
              <circle
                cx="24"
                cy="24"
                r="22"
                fill="url(#badgeGradient)"
                stroke="#4ADE80"
                strokeWidth="2"
              />

              {/* Checkmark Drawing SVG */}
              <motion.path
                d="M 15 24.5 L 21.5 31 L 33 18.5"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="3.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={hasLoaded ? { pathLength: 1, opacity: 1 } : {}}
                transition={{
                  delay: 0.8,
                  duration: 0.45,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            </motion.g>
          </motion.g>
        </motion.g>
      </svg>
    </div>
  );
};
