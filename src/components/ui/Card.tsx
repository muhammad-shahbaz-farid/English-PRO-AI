import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'elevated' | 'plain';
  hoverEffect?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'surface', hoverEffect = false, children, ...props }, ref) => {
    const variantStyles = {
      surface: 'bg-white dark:bg-[#14181D] border border-slate-200/80 dark:border-white/[0.07] rounded-[12px]',
      elevated: 'bg-[#F8F9FA] dark:bg-[#181D23] border border-slate-200 dark:border-white/[0.1] rounded-[12px]',
      plain: 'bg-transparent border-0',
    };

    return (
      <div
        ref={ref}
        className={`${variantStyles[variant]} transition-all duration-150 ${
          hoverEffect
            ? 'hover:border-slate-300 dark:hover:border-white/[0.14] hover:bg-slate-50/50 dark:hover:bg-[#161B21]'
            : ''
        } ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = '', children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-white/[0.06] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className = '', children, ...props }, ref) => {
  return (
    <h3
      ref={ref}
      className={`text-sm sm:text-base font-semibold text-slate-900 dark:text-[#F5F7FA] tracking-tight leading-snug ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
});
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className = '', children, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={`text-xs text-slate-500 dark:text-[#A8B0BA] mt-0.5 leading-relaxed ${className}`}
      {...props}
    >
      {children}
    </p>
  );
});
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = '', children, ...props }, ref) => {
  return (
    <div ref={ref} className={`p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </div>
  );
});
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className = '', children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={`p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between ${className}`}
      {...props}
    >
      {children}
    </div>
  );
});
CardFooter.displayName = 'CardFooter';
