import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`py-12 px-6 rounded-[12px] bg-slate-50/50 dark:bg-[#14181D] border border-dashed border-slate-200 dark:border-white/[0.08] text-center space-y-3 ${className}`}
    >
      <div className="w-9 h-9 rounded-[9px] bg-slate-100 dark:bg-[#181D23] border border-slate-200 dark:border-white/[0.08] text-slate-400 dark:text-[#727B87] flex items-center justify-center mx-auto">
        <Icon className="w-4 h-4" />
      </div>
      <div className="space-y-1 max-w-sm mx-auto">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FA]">
          {title}
        </h4>
        <p className="text-xs text-slate-500 dark:text-[#A8B0BA] leading-relaxed">
          {description}
        </p>
      </div>
      {actionLabel && onAction && (
        <div className="pt-2">
          <Button size="sm" variant="secondary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
