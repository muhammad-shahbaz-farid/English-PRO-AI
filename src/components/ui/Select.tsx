import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, helperText, leftIcon, id, children, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-medium text-slate-700 dark:text-[#A8B0BA]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#727B87] pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}
          <select
            ref={ref}
            id={selectId}
            className={`w-full rounded-[9px] text-[13px] border bg-white dark:bg-[#14181D] text-slate-900 dark:text-[#F5F7FA] focus:outline-none focus:ring-1 focus:ring-[#6D6FF2] focus:border-[#6D6FF2] transition-colors duration-150 h-[38px] ${
              leftIcon ? 'pl-9' : 'pl-3'
            } pr-9 py-2 appearance-none cursor-pointer ${
              error
                ? 'border-rose-500/80 focus:ring-rose-500 focus:border-rose-500'
                : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.14]'
            } ${className}`}
            {...props}
          >
            {children}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#727B87] pointer-events-none">
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>
        {error && (
          <p className="text-[11px] font-medium text-rose-500 dark:text-rose-400">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="text-[11px] text-slate-500 dark:text-[#727B87]">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';
