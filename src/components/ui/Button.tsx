import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center font-medium transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6D6FF2] focus-visible:ring-offset-1 dark:focus-visible:ring-offset-[#0B0D10] disabled:opacity-40 disabled:pointer-events-none cursor-pointer active:scale-[0.98]';

    const variants = {
      primary:
        'bg-[#6D6FF2] hover:bg-[#7C7FF5] text-white active:bg-[#5E60EC] border border-[#6D6FF2]/40 shadow-xs',
      secondary:
        'bg-slate-100 dark:bg-[#181D23] hover:bg-slate-200 dark:hover:bg-[#1E242C] text-slate-800 dark:text-[#F5F7FA] border border-slate-200 dark:border-white/[0.08]',
      outline:
        'bg-transparent hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-800 dark:text-[#F5F7FA] border border-slate-200 dark:border-white/[0.08]',
      ghost:
        'bg-transparent hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-600 dark:text-[#A8B0BA] hover:text-slate-900 dark:hover:text-[#F5F7FA]',
      danger:
        'bg-rose-600/90 hover:bg-rose-600 text-white active:bg-rose-700',
      success:
        'bg-emerald-600/90 hover:bg-emerald-600 text-white active:bg-emerald-700',
    };

    const sizes = {
      xs: 'text-xs px-2.5 py-1 rounded-[8px] gap-1.5 h-7',
      sm: 'text-xs font-medium px-3 py-1.5 rounded-[9px] gap-1.5 h-[34px]',
      md: 'text-[13px] font-medium px-3.5 py-2 rounded-[9px] gap-2 h-[38px]',
      lg: 'text-sm font-medium px-4.5 py-2.5 rounded-[10px] gap-2 h-[42px]',
      icon: 'p-2 rounded-[9px] w-[38px] h-[38px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
