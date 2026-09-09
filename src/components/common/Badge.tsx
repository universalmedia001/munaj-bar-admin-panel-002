import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'zinc';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'zinc',
  size = 'sm',
  className = '',
}) => {
  const variantStyles = {
    green: 'bg-emerald-950/70 text-emerald-400 border-emerald-800/60',
    red: 'bg-red-950/70 text-red-400 border-red-800/60',
    orange: 'bg-amber-950/70 text-amber-400 border-amber-800/60',
    blue: 'bg-blue-950/70 text-blue-400 border-blue-800/60',
    purple: 'bg-purple-950/70 text-purple-400 border-purple-800/60',
    zinc: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-0.5 text-xs font-medium',
    md: 'px-3 py-1 text-xs font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};
