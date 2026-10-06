import React from 'react';

export interface StatCardProps {
  icon?: React.ElementType;
  value: React.ReactNode;
  label: string;
  sublabel?: string;
  iconColor?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  value,
  label,
  sublabel,
  iconColor = 'text-[#6D6FF2]',
  className = '',
}) => {
  return (
    <div
      className={`p-4 sm:p-5 rounded-[12px] bg-white dark:bg-[#14181D] border border-slate-200/80 dark:border-white/[0.07] transition-all duration-150 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-medium tracking-wider uppercase text-slate-500 dark:text-[#727B87] truncate">
          {label}
        </span>
        {Icon && (
          <Icon className={`w-4 h-4 shrink-0 ${iconColor} opacity-80`} />
        )}
      </div>

      <div className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-[#F5F7FA] truncate">
        {value}
      </div>

      {sublabel && (
        <p className="text-xs text-slate-400 dark:text-[#A8B0BA] mt-1 truncate">
          {sublabel}
        </p>
      )}
    </div>
  );
};
