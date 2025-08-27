'use client';

import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CodeProps extends HTMLAttributes<HTMLPreElement> {
  language?: string;
}

export function Code({ language, className, children, ...props }: CodeProps) {
  return (
    <pre
      className={cn(
        'p-4 rounded-md bg-gray-900 text-gray-100 overflow-auto',
        className
      )}
      {...props}
    >
      <code className={language ? `language-${language}` : ''}>{children}</code>
    </pre>
  );
} 
