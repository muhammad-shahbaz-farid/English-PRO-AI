import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  className = '',
  variant = 'default',
  size = 'md',
  children,
  ...props
}) => {
  const base =
    'inline-flex items-center font-medium rounded-[6px] transition-colors';

  const variants = {
    default:
      'bg-slate-100 dark:bg-[#181D23] text-slate-700 dark:text-[#A8B0BA] border border-slate-200 dark:border-white/[0.08]',
    primary:
      'bg-[#6D6FF2]/10 text-[#6D6FF2] dark:text-[#8B8EF7] border border-[#6D6FF2]/20',
    success:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    warning:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    danger:
      'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
    outline:
      'bg-transparent text-slate-600 dark:text-[#A8B0BA] border border-slate-200 dark:border-white/[0.08]',
  };

  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5 leading-none',
    md: 'text-[11px] px-2 py-0.5 leading-tight',
  };

  return (
    <span className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </span>
  );
};
