'use client';

import { cn } from '@/lib/utils';

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
}

export function Spinner({ className, size = 'md', ...props }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-5 w-5 border-2',
    lg: 'h-6 w-6 border-3',
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-solid border-t-transparent',
        sizeClasses[size],
        className
      )}
      style={{ 
        borderTopColor: 'transparent',
        borderRightColor: 'currentColor',
        borderBottomColor: 'currentColor',
        borderLeftColor: 'currentColor',
      }}
      {...props}
    />
  );
} 
