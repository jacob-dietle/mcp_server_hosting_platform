"use client"

import React from 'react';
import { ConversationCarousel } from './conversation-carousel';

export function HeroChat({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const isMobile = variant === 'mobile';
  
  // Define height based on viewport size for responsive design
  const heightClass = isMobile 
    ? 'max-h-[350px] h-[calc(50vh-100px)]' // For mobile: either 350px or 50vh minus header space
    : 'max-h-[550px] h-[calc(150vh-120px)]'; // For desktop: either 500px or 70vh minus header space
  
  return (
    <div className={`rounded-lg border border-black dark:border-dark-border bg-light-bg dark:bg-dark-bg shadow-md dark:shadow-none ${isMobile ? 'w-full' : ''} overflow-hidden`}>
      {/* Terminal header */}
      <div className="bg-accent dark:bg-dark-accent text-light-text dark:text-dark-text border-b border-black dark:border-dark-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <div className="w-3 h-3 rounded-full bg-destructive"></div>
          <div className="w-3 h-3 rounded-full bg-warning"></div>
          <div className="w-3 h-3 rounded-full bg-success"></div>
        </div>
        <div className="text-xs font-medium text-light-text/90 dark:text-dark-text/90">DeepTech Intelligence Terminal</div>
        <div className="text-xs text-light-text/70 dark:text-dark-text/70">v1.0.2</div>
      </div>
      
      {/* Responsive height container with custom scrollbar styling */}
      <div 
        className={`${heightClass} overflow-y-auto conversation-scrollbar bg-light-bg dark:bg-dark-bg`}
        style={{
          // Custom scrollbar styling for Firefox
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(0, 0, 0, 0.2) transparent',
          // Ensure the content doesn't overflow horizontally
          overflowX: 'hidden',
        }}
      >
        {/* Add inline styles for WebKit browsers */}
        <style dangerouslySetInnerHTML={{ __html: `
          .conversation-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          
          .conversation-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          
          .conversation-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgba(0, 0, 0, 0.2);
            border-radius: 3px;
          }

          @media (prefers-color-scheme: dark) {
            .conversation-scrollbar::-webkit-scrollbar-thumb {
              background-color: rgba(255, 255, 255, 0.2);
            }
            
            .conversation-scrollbar::-webkit-scrollbar-thumb:hover {
              background-color: rgba(255, 255, 255, 0.3);
            }
          }
          
          .conversation-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: rgba(0, 0, 0, 0.3);
          }
        `}} />
        
        <div className={`${isMobile ? 'p-4' : 'p-5 lg:p-6'}`}>
          <div className="text-xs font-mono text-black dark:text-dark-text mb-4">
            <span className="text-primary">{'>>'}</span> Initializing DeepTech Intelligence Terminal...
            <div className="text-success-green dark:text-success mt-1">Connection established to the Deeptech Knowledge Graph.</div>
            <div className="text-black/70 dark:text-dark-text/70 mt-1 mb-3">Type your query or use suggested commands below:</div>
          </div>
          
          <ConversationCarousel 
            isMobile={isMobile}
            cycleTime={28000} // 28 seconds per conversation to accommodate citations
            fadeTime={600}    // 600ms fade transition
          />
        </div>
      </div>
    </div>
  );
} 
