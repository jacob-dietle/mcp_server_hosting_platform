"use client"

import React from 'react';
import { TypedQuestions } from './typed-questions';
import { TypedResponse } from './typed-response';
import { MessageSquare } from 'lucide-react';

interface ChatBubbleProps {
  variant: 'founder' | 'agent';
  children?: React.ReactNode;
  isTypingAnimation?: boolean;
  isMobile?: boolean;
}

export function ChatBubble({ 
  variant, 
  children, 
  isTypingAnimation = false,
  isMobile = false
}: ChatBubbleProps) {
  const isFounder = variant === 'founder';
  
  return (
    <div className={`flex items-start ${isMobile ? 'gap-3' : 'gap-4'}`}>
      <div className={`flex ${isMobile ? 'h-8 w-8' : 'h-10 w-10'} shrink-0 items-center justify-center rounded-full bg-card shadow border ${!isFounder ? 'bg-secondary text-secondary-foreground' : ''}`}>
        <MessageSquare className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} ${isFounder ? 'text-primary' : ''}`} />
      </div>
      <div className={`flex-1 ${isMobile ? 'min-w-0' : ''}`}>
        <p className={`${isMobile ? 'text-xs mb-1.5' : 'text-sm mb-2'} font-medium`}>
          {isFounder ? 'Deeptech Founder' : 'Ecosystem Intelligence Agent'}
        </p>
        <div className={`rounded-lg ${isFounder ? 'bg-muted' : 'bg-secondary/10'} ${isMobile ? 'p-2.5 text-sm' : 'p-3'}`}>
          {isTypingAnimation && isFounder ? (
            <TypedQuestions className="inline-block break-words" />
          ) : isTypingAnimation && !isFounder ? (
            <TypedResponse isMobile={isMobile} />
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
} 
