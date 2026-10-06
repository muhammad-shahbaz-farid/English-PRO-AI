import React from 'react';

export interface PageHeaderProps {
  icon?: React.ElementType;
  title: string;
  description: string;
  badge?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  icon: Icon,
  title,
  description,
  badge,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200/80 dark:border-white/[0.07] ${className}`}
    >
      <div className="flex items-center space-x-3">
        {Icon && (
          <div className="w-9 h-9 rounded-[9px] bg-slate-100 dark:bg-[#181D23] border border-slate-200/80 dark:border-white/[0.08] text-[#6D6FF2] flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 dark:text-[#F5F7FA]">
              {title}
            </h1>
            {badge && (
              <span className="text-[10px] font-medium tracking-wide px-2 py-0.5 rounded-[6px] bg-slate-100 dark:bg-[#181D23] text-slate-600 dark:text-[#A8B0BA] border border-slate-200 dark:border-white/[0.08]">
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-[13px] text-slate-500 dark:text-[#A8B0BA] mt-0.5 leading-normal">
            {description}
          </p>
        </div>
      </div>

      {actions && (
        <div className="flex items-center space-x-2.5 shrink-0 self-start md:self-center">
          {actions}
        </div>
      )}
    </div>
  );
};
